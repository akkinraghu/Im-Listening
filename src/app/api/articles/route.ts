import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Article from '@/models/Article';

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
    const skip = (page - 1) * limit;
    
    // Build filter object
    const filter: any = {};
    if (source) filter.source = source;
    if (query) filter.$text = { $search: query };
    
    await connectToDatabase();
    
    const articles = await Article.find(filter)
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Article.countDocuments(filter);
    
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
    const { title, content, source, url, author, publishedDate, metadata } = body;
    
    if (!title || !content || !source) {
      return NextResponse.json(
        { error: 'Title, content, and source are required' },
        { status: 400 }
      );
    }
    
    await connectToDatabase();
    
    // Check if article with same URL already exists
    if (url) {
      const existingArticle = await Article.findOne({ url });
      if (existingArticle) {
        return NextResponse.json(
          { error: 'Article with this URL already exists', articleId: existingArticle._id },
          { status: 409 }
        );
      }
    }
    
    const article = await Article.create({
      title,
      content,
      source,
      url,
      author,
      publishedDate: publishedDate ? new Date(publishedDate) : undefined,
      metadata
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
