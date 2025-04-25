import { NextResponse } from 'next/server';
import connectToPostgres from '@/lib/postgres';
import { executeQuery } from '@/lib/postgres';

export async function GET() {
  try {
    // Test PostgreSQL connection
    const client = await connectToPostgres();
    const pgVersion = await client.query('SELECT version()');
    client.release();
    
    return NextResponse.json({
      status: 'success',
      database: {
        type: 'PostgreSQL',
        version: pgVersion.rows[0].version,
        connectionStatus: 'connected'
      },
      message: 'API is working correctly'
    });
  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json(
      { 
        status: 'error', 
        message: 'API error', 
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
