import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/transcription/socket
 * Endpoint to get DeepGram API credentials for client-side WebSocket connection
 */
export async function GET(req: NextRequest) {
  try {
    // In a production app, you might want to check authentication here
    // and only provide the API key to authenticated users
    
    // For security reasons, we're not returning the actual API key directly
    // Instead, we're confirming that it exists in the environment variables
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DeepGram API key not configured' },
        { status: 500 }
      );
    }
    
    // Return information needed for the client to establish a connection
    return NextResponse.json({
      configured: true,
      socketUrl: 'wss://api.deepgram.com/v1/listen',
      // In a production app, you might want to generate a short-lived token here
      // instead of exposing your API key to the client
    });
  } catch (error) {
    console.error('Error fetching DeepGram configuration:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DeepGram configuration' },
      { status: 500 }
    );
  }
}
