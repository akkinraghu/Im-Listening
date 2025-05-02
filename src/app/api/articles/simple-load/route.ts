import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/utils/postgres';

// API key for security
const API_KEY = process.env.ARTICLE_LOAD_API_KEY || 'default_key';

/**
 * GET /api/articles/simple-load
 * Load a simple test article
 */
export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKey = searchParams.get('apiKey');
    
    // Simple API key validation
    if (!apiKey || apiKey !== API_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    // Create a simple test article without embeddings
    const testArticle = {
      title: 'Test Article',
      content: 'This is a test article for the vector database.',
      source: 'Test Source',
      url: 'https://example.com/test-article',
      author: 'Test Author',
      publishedDate: new Date()
    };
    
    // Insert the article into PostgreSQL
    const result = await pool.query(
      `INSERT INTO articles 
       (title, content, source, url, author, published_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id`,
      [testArticle.title, testArticle.content, testArticle.source, testArticle.url, testArticle.author, testArticle.publishedDate]
    );

    const articleId = result.rows[0].id;

    return NextResponse.json({
      status: 'success',
      message: 'Test article created successfully',
      article: {
        id: articleId,
        title: testArticle.title
      }
    });
  } catch (error) {
    console.error('Error in simple article load:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Failed to create test article',
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
