import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Article from '@/models/Article';
import ArticleChunk from '@/models/ArticleChunk';
import mongoose from 'mongoose';

// Define the params type according to Next.js 15 requirements
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Check if article exists
    const article = await Article.findById(id);
    
    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Get all chunks for this article
    const chunks = await ArticleChunk.find({ articleId: id })
      .sort({ chunkIndex: 1 })
      .select('-embedding'); // Exclude the embedding vector to reduce response size
    
    return NextResponse.json({ chunks });
  } catch (error) {
    console.error('Error fetching article chunks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article chunks' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles/[id]/chunks
 * Generate chunks and embeddings for an article
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { chunkSize = 1000, overlapSize = 200 } = body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Check if article exists
    const article = await Article.findById(id);
    
    if (!article) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Delete existing chunks for this article
    await ArticleChunk.deleteMany({ articleId: id });
    
    // Generate chunks from the article content
    const chunks = generateChunks(article.content, chunkSize, overlapSize);
    
    // In a real application, we would generate embeddings here
    // using Azure OpenAI API, but for now we'll just create placeholder embeddings
    const placeholderEmbedding = Array(1536).fill(0).map(() => Math.random());
    
    // Create chunks in the database
    const chunkDocs = await Promise.all(
      chunks.map(async (chunk, index) => {
        return await ArticleChunk.create({
          articleId: id,
          content: chunk,
          chunkIndex: index,
          embedding: placeholderEmbedding,
          metadata: {
            title: article.title,
            source: article.source,
            chunkSize,
            overlapSize
          }
        });
      })
    );
    
    return NextResponse.json({
      message: 'Chunks and embeddings generated successfully',
      chunkCount: chunkDocs.length
    });
  } catch (error) {
    console.error('Error generating article chunks:', error);
    return NextResponse.json(
      { error: 'Failed to generate article chunks' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to split text into chunks with overlap
 */
function generateChunks(text: string, chunkSize: number, overlapSize: number): string[] {
  const chunks: string[] = [];
  let startIndex = 0;
  
  while (startIndex < text.length) {
    // Calculate end index for this chunk
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    
    // Extract the chunk
    const chunk = text.substring(startIndex, endIndex);
    
    // Add the chunk to our list
    chunks.push(chunk);
    
    // Move the start index for the next chunk, accounting for overlap
    startIndex = endIndex - overlapSize;
    
    // If we've reached the end of the text, break out of the loop
    if (startIndex >= text.length) {
      break;
    }
  }
  
  return chunks;
}
