import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';

export async function GET() {
  try {
    // Test database connection
    const mongoose = await connectToDatabase();
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful',
      mongooseVersion: mongoose.version,
      connectionState: mongoose.connection.readyState
    });
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Database connection failed',
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
