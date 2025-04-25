import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/postgres';
import { createTranscription } from '@/lib/db';

/**
 * GET /api/transcription
 * Retrieve all transcriptions, with optional pagination
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    const userType = searchParams.get('userType');
    const purpose = searchParams.get('purpose');

    try {
      // Build query based on filters
      let query = 'SELECT * FROM transcriptions WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;
      
      if (userType) {
        query += ` AND user_type = $${paramIndex}`;
        params.push(userType);
        paramIndex++;
      }
      
      if (purpose) {
        query += ` AND purpose = $${paramIndex}`;
        params.push(purpose);
        paramIndex++;
      }
      
      // Add sorting, pagination
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      // Execute query
      const result = await executeQuery(query, params);
      
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) FROM transcriptions WHERE 1=1';
      const countParams: any[] = [];
      let countParamIndex = 1;
      
      if (userType) {
        countQuery += ` AND user_type = $${countParamIndex}`;
        countParams.push(userType);
        countParamIndex++;
      }
      
      if (purpose) {
        countQuery += ` AND purpose = $${countParamIndex}`;
        countParams.push(purpose);
        countParamIndex++;
      }
      
      const countResult = await executeQuery<{ count: string }>(countQuery, countParams);
      const total = parseInt(countResult[0].count);
      
      return NextResponse.json({
        transcriptions: result,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error fetching transcriptions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcriptions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/transcription
 * Create a new transcription
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, metadata, userId, userType, purpose } = body;
    
    if (!text) {
      return NextResponse.json(
        { error: 'Transcription text is required' },
        { status: 400 }
      );
    }
    
    // Extract userType and purpose from metadata if provided there
    const extractedUserType = userType || (metadata?.userType || 'Other');
    const extractedPurpose = purpose || (metadata?.purpose || 'general');
    
    const transcription = await createTranscription({
      text,
      metadata,
      user_id: userId,
      user_type: extractedUserType,
      purpose: extractedPurpose
    });
    
    return NextResponse.json(transcription, { status: 201 });
  } catch (error) {
    console.error('Error creating transcription:', error);
    return NextResponse.json(
      { error: 'Failed to create transcription' },
      { status: 500 }
    );
  }
}
