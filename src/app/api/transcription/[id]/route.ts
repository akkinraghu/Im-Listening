import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/postgres';
import { getTranscriptionById } from '@/lib/db';

/**
 * GET /api/transcription/[id]
 * Retrieve a specific transcription by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transcriptionId = parseInt(id);
    
    if (isNaN(transcriptionId)) {
      return NextResponse.json(
        { error: 'Invalid transcription ID' },
        { status: 400 }
      );
    }
    
    const transcription = await getTranscriptionById(transcriptionId);
    
    if (!transcription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(transcription);
  } catch (error) {
    console.error('Error fetching transcription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcription' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/transcription/[id]
 * Update a specific transcription
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transcriptionId = parseInt(id);
    const body = await request.json();
    
    if (isNaN(transcriptionId)) {
      return NextResponse.json(
        { error: 'Invalid transcription ID' },
        { status: 400 }
      );
    }
    
    // Check if transcription exists
    const checkResult = await executeQuery(
      'SELECT * FROM transcriptions WHERE id = $1',
      [transcriptionId]
    );
    
    // Check if the result has any rows
    if (!checkResult || !Array.isArray(checkResult) || checkResult.length === 0) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Update transcription
    const { text, metadata } = body;
    
    const updateResult = await executeQuery(
      `UPDATE transcriptions 
       SET content = $1, metadata = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [text, metadata, transcriptionId]
    );
    
    // Check if the update was successful
    if (!updateResult || !Array.isArray(updateResult) || updateResult.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update transcription' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updateResult[0]);
  } catch (error) {
    console.error('Error updating transcription:', error);
    return NextResponse.json(
      { error: 'Failed to update transcription' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/transcription/[id]
 * Delete a specific transcription
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const transcriptionId = parseInt(id);
    
    if (isNaN(transcriptionId)) {
      return NextResponse.json(
        { error: 'Invalid transcription ID' },
        { status: 400 }
      );
    }
    
    // Check if transcription exists
    const checkResult = await executeQuery(
      'SELECT * FROM transcriptions WHERE id = $1',
      [transcriptionId]
    );
    
    // Check if the result has any rows
    if (!checkResult || !Array.isArray(checkResult) || checkResult.length === 0) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Delete transcription
    await executeQuery(
      'DELETE FROM transcriptions WHERE id = $1',
      [transcriptionId]
    );
    
    return NextResponse.json({ message: 'Transcription deleted successfully' });
  } catch (error) {
    console.error('Error deleting transcription:', error);
    return NextResponse.json(
      { error: 'Failed to delete transcription' },
      { status: 500 }
    );
  }
}
