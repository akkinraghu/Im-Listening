'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import TranscriptionRecorder, { TranscriptionRecorderHandle } from '@/components/transcription/TranscriptionRecorder';

// Define the user types
type UserType = 'Raghav' | 'General Practitioner' | 'School Lecture';

// Define the output formats
type OutputFormat = 'Plain' | 'SOAP' | 'HTML';

export default function EnhancedTranscriptionPage() {
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userType, setUserType] = useState<UserType>('Raghav');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('Plain');
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [isFormatting, setIsFormatting] = useState(false);
  
  // Reference to the TranscriptionRecorder component
  const recorderRef = useRef<TranscriptionRecorderHandle>(null);

  // Handle transcription updates from the recorder component
  const handleTranscriptionUpdate = (text: string, isFinal: boolean) => {
    setTranscription(text);
  };

  // Save the transcription to the database
  const saveTranscription = async (text: string) => {
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
            userType: userType,
            purpose: getPurposeFromUserType(userType),
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save transcription');
      }
      
      setError(null);
      return await response.json();
    } catch (err) {
      setError('Failed to save transcription. Please try again.');
      console.error('Error saving transcription:', err);
      return null;
    }
  };

  // Get the purpose based on the user type
  const getPurposeFromUserType = (type: UserType): string => {
    switch (type) {
      case 'General Practitioner':
        return 'medical_consultation';
      case 'Raghav':
        return 'personal_notes';
      case 'School Lecture':
        return 'education';
      default:
        return 'general';
    }
  };

  // Format the transcription based on the selected output format
  const formatTranscription = async () => {
    if (!transcription.trim()) {
      setError('No transcription to format');
      return;
    }

    setIsFormatting(true);
    
    try {
      // Call the formatting API endpoint
      const response = await fetch('/api/transcription/format', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: transcription,
          format: outputFormat,
          userType: userType,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to format transcription');
      }
      
      const data = await response.json();
      setFormattedOutput(data.formattedText);
      setError(null);
    } catch (err) {
      setError('Failed to format transcription. Please try again.');
      console.error('Error formatting transcription:', err);
    } finally {
      setIsFormatting(false);
    }
  };

  // Handle recording state changes
  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
  };

  // Function to start recording
  function startRecording() {
    if (recorderRef.current) {
      recorderRef.current.startRecording();
    }
  }

  // Function to stop recording
  function stopRecording() {
    if (recorderRef.current) {
      recorderRef.current.stopRecording();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-gray-100">
      <header className="bg-white shadow-sm border-b border-purple-100">
        <div className="container mx-auto px-4 py-2">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-purple-600 hover:text-purple-800 text-xs font-normal">
              ← Back
            </Link>
            <h1 className="text-xl font-semibold text-purple-800">Voice Transcription</h1>
            <div className="w-10"></div> {/* Empty div for balanced spacing */}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-purple-100 p-1 inline-flex">
            {(['Raghav', 'General Practitioner', 'School Lecture'] as UserType[]).map((type) => (
              <button
                key={type}
                onClick={() => setUserType(type)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  userType === type
                    ? 'bg-purple-600 text-white font-medium'
                    : 'text-gray-600 hover:bg-purple-50'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="max-w-3xl mx-auto">
          {/* Live Transcription Area */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-medium text-purple-800">Live Transcribe</h2>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isRecording ? (
                  <>
                    <span className="mr-2 h-2 w-2 rounded-full bg-white animate-pulse"></span>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <span className="mr-2">🎤</span>
                    Start Recording
                  </>
                )}
              </button>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-purple-100 overflow-hidden">
              <textarea
                className="w-full h-48 p-4 text-gray-700 resize-none focus:outline-none"
                placeholder="Your transcription will appear here..."
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                readOnly={isRecording}
              ></textarea>
            </div>
          </div>

          {/* Hidden Transcription Recorder Component */}
          <div className="hidden">
            <TranscriptionRecorder 
              ref={recorderRef}
              onTranscriptionUpdate={handleTranscriptionUpdate}
              onTranscriptionComplete={saveTranscription}
              onError={(err) => setError(err.message)}
              onRecordingStateChange={handleRecordingStateChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
