import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/utils/postgres';
import { isValidUUID } from '@/utils/validation';

type RouteParams = {
  params: {
    id: string;
  };
};

/**
 * GET /api/articles/[id]
 * Retrieve a specific article by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    // Get article from PostgreSQL
    const result = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json(
      { error: 'Failed to fetch article' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/articles/[id]
 * Update a specific article
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const body = await request.json();
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    // Check if article exists
    const checkResult = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Update article
    const { title, abstract, content, pmcid, doi, publicationDate, journal, authors, url } = body;
    
    const updateResult = await pool.query(
      `UPDATE articles 
       SET title = $1, abstract = $2, content = $3, pmcid = $4, doi = $5, 
           publication_date = $6, journal = $7, authors = $8, url = $9, 
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [title, abstract, content, pmcid, doi, publicationDate, journal, authors, url, id]
    );
    
    return NextResponse.json(updateResult.rows[0]);
  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json(
      { error: 'Failed to update article' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[id]
 * Delete a specific article and its chunks
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { error: 'Invalid article ID' },
        { status: 400 }
      );
    }
    
    // Check if article exists
    const checkResult = await pool.query(
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Article not found' },
        { status: 404 }
      );
    }
    
    // Delete article chunks first (foreign key constraint)
    await pool.query(
      'DELETE FROM article_chunks WHERE article_id = $1',
      [id]
    );
    
    // Delete article
    await pool.query(
      'DELETE FROM articles WHERE id = $1',
      [id]
    );
    
    return NextResponse.json({ message: 'Article deleted successfully' });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json(
      { error: 'Failed to delete article' },
      { status: 500 }
    );
  }
}
