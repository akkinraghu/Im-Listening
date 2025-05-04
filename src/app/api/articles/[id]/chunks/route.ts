import { NextResponse } from 'next/server';
import { pool } from '@/utils/postgres';
import { isValidUUID } from '@/utils/validation';
import { generateChunks } from '../../../../../utils/text';

/**
 * GET /api/articles/[id]/chunks
 * Get all chunks for an article
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    // Check if article exists
    const articleResult = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    if (articleResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Get all chunks for this article
    const chunksResult = await pool.query(
      'SELECT * FROM article_chunks WHERE article_id = $1 ORDER BY chunk_index',
      [id]
    );
    
    return NextResponse.json({ chunks: chunksResult.rows });
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
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    // Check if article exists
    const articleResult = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    if (articleResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    const article = articleResult.rows[0];
    const content = article.content;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Article has no content to chunk' },
        { status: 400 }
      );
    }
    
    // Generate chunks
    const chunkSize = 1000;
    const overlapSize = 200;
    const chunks = generateChunks(content, chunkSize, overlapSize);
    
    // Delete existing chunks
    await pool.query(
      'DELETE FROM article_chunks WHERE article_id = $1',
      [id]
    );
    
    // Insert new chunks
    for (let i = 0; i < chunks.length; i++) {
      await pool.query(
        'INSERT INTO article_chunks (article_id, content, chunk_index) VALUES ($1, $2, $3)',
        [id, chunks[i], i]
      );
    }
    
    return NextResponse.json({ 
      message: 'Article chunks generated successfully',
      chunkCount: chunks.length
    });
  } catch (error) {
    console.error('Error generating article chunks:', error);
    return NextResponse.json(
      { error: 'Failed to generate article chunks' },
      { status: 500 }
    );
  }
}
