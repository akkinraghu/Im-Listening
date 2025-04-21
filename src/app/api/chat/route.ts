import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ArticleChunk from '@/models/ArticleChunk';
import Article from '@/models/Article';

// Simple in-memory cache for chat responses
interface CacheEntry {
  response: string;
  sources: any[];
  timestamp: number;
}

const chatCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache TTL

// Generate a cache key from request parameters
function generateCacheKey(query: string, userType: string): string {
  return `${query}_${userType}`;
}

/**
 * POST /api/chat
 * Process a chat query using vector search and OpenAI
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, userType } = body;
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }
    
    // Check cache first
    const cacheKey = generateCacheKey(query, userType);
    const cachedResult = chatCache.get(cacheKey);
    const now = Date.now();
    
    if (cachedResult && (now - cachedResult.timestamp) < CACHE_TTL) {
      console.log('Cache hit! Returning cached chat response');
      return NextResponse.json({
        response: cachedResult.response,
        sources: cachedResult.sources,
        fromCache: true
      });
    }
    
    console.log('Cache miss. Generating new chat response.');
    
    await connectToDatabase();
    
    // Step 1: Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Step 2: Perform vector search to find relevant chunks
    const relevantChunks = await performVectorSearch(queryEmbedding, 5);
    
    // Step 3: Retrieve full article data for the chunks
    const articleIds = Array.from(new Set(relevantChunks.map(chunk => chunk.articleId.toString())));
    const articles = await Article.find({ _id: { $in: articleIds } });
    
    // Create a map for quick lookup
    const articleMap = new Map();
    articles.forEach(article => {
      articleMap.set(article._id.toString(), article);
    });
    
    // Attach article data to chunks
    const chunksWithArticleData = relevantChunks.map(chunk => {
      const article = articleMap.get(chunk.articleId.toString());
      return {
        ...chunk.toObject(),
        article: article ? {
          title: article.title,
          source: article.source,
          url: article.url,
          author: article.author,
          publishedDate: article.publishedDate
        } : null
      };
    });
    
    // Step 4: Generate AI response using OpenAI
    const aiResponse = await generateAIResponse(query, chunksWithArticleData, userType);
    
    // Extract sources for citation
    const sources = chunksWithArticleData
      .filter(chunk => chunk.article)
      .map(chunk => ({
        title: chunk.article.title,
        url: chunk.article.url,
        author: chunk.article.author,
        publishedDate: chunk.article.publishedDate
      }));
    
    // Remove duplicates from sources
    const uniqueSources = Array.from(
      new Map(sources.map(item => [item.title, item])).values()
    );
    
    // Cache the result
    chatCache.set(cacheKey, {
      response: aiResponse,
      sources: uniqueSources,
      timestamp: now
    });
    
    return NextResponse.json({
      response: aiResponse,
      sources: uniqueSources,
      fromCache: false
    });
  } catch (error) {
    console.error('Error in chat processing:', error);
    return NextResponse.json(
      { error: 'Failed to process chat query' },
      { status: 500 }
    );
  }
}

/**
 * Generate embedding for a text using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    
    // Return a mock embedding for development/fallback
    return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
  }
}

/**
 * Perform vector search using MongoDB
 */
async function performVectorSearch(embedding: number[], limit: number = 5) {
  try {
    // Use MongoDB's $vectorSearch if available
    if (process.env.USE_VECTOR_SEARCH === 'true') {
      return await ArticleChunk.aggregate([
        {
          $vectorSearch: {
            index: 'embedding_index',
            queryVector: embedding,
            path: 'embedding',
            numCandidates: limit * 10,
            limit: limit
          }
        }
      ]);
    } else {
      // Fallback to text search for development/testing
      return await ArticleChunk.find(
        {},
        { score: { $meta: 'textScore' } }
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);
    }
  } catch (error) {
    console.error('Error in vector search:', error);
    
    // Return empty results if search fails
    return [];
  }
}

/**
 * Generate AI response using OpenAI
 */
async function generateAIResponse(query: string, chunks: any[], userType: string): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
  
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is missing');
  }
  
  // Prepare context from chunks
  const context = chunks.map(chunk => {
    const articleInfo = chunk.article 
      ? `Title: ${chunk.article.title}${chunk.article.author ? `, Author: ${chunk.article.author}` : ''}`
      : 'Unknown source';
    
    return `[${articleInfo}]\n${chunk.content}\n`;
  }).join('\n---\n');
  
  // Create system prompt based on user type
  let systemPrompt = '';
  switch (userType) {
    case 'General Practitioner':
      systemPrompt = 'You are an AI assistant for medical professionals. Provide accurate, evidence-based information using the context provided. Use medical terminology appropriate for healthcare providers. Always cite your sources.';
      break;
    case 'School Lecture':
      systemPrompt = 'You are an AI assistant for educators. Provide clear, educational information using the context provided. Structure your responses in a way that would be helpful for teaching or learning. Always cite your sources.';
      break;
    default:
      systemPrompt = 'You are a helpful AI assistant. Answer questions accurately based on the context provided. Always cite your sources.';
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `I need information about the following query: "${query}"\n\nHere is relevant context from articles:\n\n${context}` }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'I apologize, but I encountered an error while processing your request. Please try again later.';
  }
}
