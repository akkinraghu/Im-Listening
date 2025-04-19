import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import Transcription from '@/models/Transcription';

/**
 * GET /api/transcription
 * Retrieve all transcriptions, with optional pagination
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;
    const userType = searchParams.get('userType');
    const purpose = searchParams.get('purpose');

    await connectToDatabase();
    
    // Build query based on filters
    const query: any = {};
    if (userType) {
      query.userType = userType;
    }
    if (purpose) {
      query.purpose = purpose;
    }
    
    const transcriptions = await Transcription.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Transcription.countDocuments(query);
    
    return NextResponse.json({
      transcriptions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
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
    
    await connectToDatabase();
    
    // Extract userType and purpose from metadata if provided there
    const extractedUserType = userType || (metadata?.userType || 'Other');
    const extractedPurpose = purpose || (metadata?.purpose || 'general');
    
    const transcription = await Transcription.create({
      text,
      metadata,
      userId,
      userType: extractedUserType,
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
