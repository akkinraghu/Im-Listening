import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Article from '@/models/Article';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const apiKey = searchParams.get('apiKey');
    
    // Simple API key validation
    if (!apiKey || apiKey !== process.env.ARTICLE_LOAD_API_KEY) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    await connectToDatabase();
    
    // Create a simple test article without embeddings
    const testArticle = {
      title: 'Test Article',
      content: 'This is a test article for the vector database.',
      source: 'Test Source',
      url: 'https://example.com/test-article',
      author: 'Test Author',
      publishedDate: new Date()
    };
    
    // Save the article to the database
    const savedArticle = await Article.create(testArticle);
    
    return NextResponse.json({
      status: 'success',
      message: 'Test article created successfully',
      article: {
        id: savedArticle._id,
        title: savedArticle.title
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
