'use client';

import Link from 'next/link';
import { useState } from 'react';
import TranscriptionRecorder from '@/components/transcription/TranscriptionRecorder';
import { useRouter } from 'next/navigation';

export default function TranscriptionPage() {
  const router = useRouter();
  const [savedTranscriptions, setSavedTranscriptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleTranscriptionComplete = async (text: string) => {
    if (!text.trim()) return;
    
    try {
      // Save transcription to the database
      const response = await fetch('/api/transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          metadata: {
            source: 'deepgram',
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save transcription');
      }
      
      // Add to local state
      setSavedTranscriptions(prev => [...prev, text]);
      
      // Show success message
      setError(null);
    } catch (err) {
      setError('Failed to save transcription. Please try again.');
      console.error('Error saving transcription:', err);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/" className="text-primary-600 hover:text-primary-800 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Home
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-primary-700 mb-4">Voice Transcription</h1>
        <p className="text-gray-600 mb-6">
          This feature uses DeepGram&apos;s live socket API to transcribe your voice in real-time.
        </p>

        {error && (
          <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700 mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-full max-w-md">
            <TranscriptionRecorder 
              onTranscriptionComplete={handleTranscriptionComplete}
              onError={(err) => setError(err.message)}
            />
          </div>
        </div>
      </div>

      {savedTranscriptions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-primary-700 mb-4">Saved Transcriptions</h2>
          <div className="space-y-4">
            {savedTranscriptions.map((text, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
