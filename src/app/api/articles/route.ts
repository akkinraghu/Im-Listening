import { NextRequest, NextResponse } from 'next/server';
import { ArticlePg } from '@/models/postgres/Article';

/**
 * GET /api/articles
 * Retrieve all articles, with optional pagination and filtering
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const source = searchParams.get('source');
    const query = searchParams.get('query');
    const offset = (page - 1) * limit;
    
    let articles;
    let total = 0;
    
    if (query) {
      // Search by title if query is provided
      articles = await ArticlePg.findByTitle(query, limit);
      total = articles.length; // Simplified for now
    } else if (source) {
      // Filter by source
      articles = await ArticlePg.findBySource(source, limit, offset);
      total = await ArticlePg.countBySource(source);
    } else {
      // Get all articles with pagination
      articles = await ArticlePg.findAll(limit, offset);
      total = await ArticlePg.count();
    }
    
    return NextResponse.json({
      articles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch articles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles
 * Create a new article
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.title || !body.content || !body.source) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, source' },
        { status: 400 }
      );
    }
    
    // Create the article
    const article = await ArticlePg.create({
      title: body.title,
      content: body.content,
      source: body.source,
      url: body.url,
      author: body.author,
      published_date: body.publishedDate ? new Date(body.publishedDate) : undefined,
      metadata: body.metadata
    });
    
    return NextResponse.json(article, { status: 201 });
  } catch (error) {
    console.error('Error creating article:', error);
    return NextResponse.json(
      { error: 'Failed to create article' },
      { status: 500 }
    );
  }
}
