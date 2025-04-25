import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/postgres';
import { getTranscriptionById } from '@/lib/db';

/**
 * GET /api/transcription/[id]
 * Retrieve a specific transcription by ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const transcriptionId = parseInt(id);
    const body = await req.json();
    const { text, metadata } = body;
    
    if (isNaN(transcriptionId)) {
      return NextResponse.json(
        { error: 'Invalid transcription ID' },
        { status: 400 }
      );
    }
    
    // Check if transcription exists
    const existingTranscription = await getTranscriptionById(transcriptionId);
    
    if (!existingTranscription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Update the transcription
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (text !== undefined) {
      updateFields.push(`text = $${paramIndex}`);
      values.push(text);
      paramIndex++;
    }
    
    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(metadata));
      paramIndex++;
    }
    
    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);
    
    // Add ID as the last parameter
    values.push(transcriptionId);
    
    const query = `
      UPDATE transcriptions 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    const result = await executeQuery(query, values);
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Failed to update transcription' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result[0]);
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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const transcriptionId = parseInt(id);
    
    if (isNaN(transcriptionId)) {
      return NextResponse.json(
        { error: 'Invalid transcription ID' },
        { status: 400 }
      );
    }
    
    // Check if transcription exists
    const existingTranscription = await getTranscriptionById(transcriptionId);
    
    if (!existingTranscription) {
      return NextResponse.json(
        { error: 'Transcription not found' },
        { status: 404 }
      );
    }
    
    // Delete the transcription
    const result = await executeQuery(
      'DELETE FROM transcriptions WHERE id = $1 RETURNING id',
      [transcriptionId]
    );
    
    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Failed to delete transcription' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transcription:', error);
    return NextResponse.json(
      { error: 'Failed to delete transcription' },
      { status: 500 }
    );
  }
}
