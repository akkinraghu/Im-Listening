'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the TranscriptionRecorder component with no SSR
const TranscriptionRecorder = dynamic(
  () => import('@/components/transcription/TranscriptionRecorder').then(mod => mod.default),
  { ssr: false }
);

// Import the ChatBot component
import ChatBot from '@/components/chat/ChatBot';

// Import the TranscriptionRecorderHandle type
import type { TranscriptionRecorderHandle } from '@/components/transcription/TranscriptionRecorder';

// Define the user types
type UserType = 'General Practitioner' | 'School Lecture' | 'Raghav';

// Define the output formats
type OutputFormat = 'Plain' | 'SOAP' | 'Clinical Summary' | 'Bullet Points' | 'HTML' | 'Markdown';

export default function Home() {
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userType, setUserType] = useState<UserType>('General Practitioner');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('Plain');
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  
  // Reference to the TranscriptionRecorder component
  const recorderRef = useRef<TranscriptionRecorderHandle>(null);

  // Set base URL after component mounts
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

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
    // Show immediate feedback by setting a loading message
    setFormattedOutput('Formatting your text...');
    
    try {
      // Use the baseUrl state instead of checking window
      const apiUrl = `${baseUrl || 'http://localhost:3007'}/api/transcription/format`;
      
      console.log('Making format API call to:', apiUrl);
      
      // Call the formatting API endpoint with the correct base URL
      const response = await fetch(apiUrl, {
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Format API error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      // If the response came from cache, show that to the user
      if (data.fromCache) {
        setFormattedOutput(data.formattedText + "\n\n(Retrieved from cache)");
      } else {
        setFormattedOutput(data.formattedText);
      }
      
      setError(null);
    } catch (err: any) {
      setError(`Failed to format transcription: ${err.message || 'Unknown error'}`);
      console.error('Error formatting transcription:', err);
      // Clear the loading message if there's an error
      setFormattedOutput('');
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
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-gray-100">
      <header className="bg-white shadow-md border-b border-purple-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-center items-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-400">I'm Listening</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg shadow-md border border-purple-100 p-1 inline-flex">
            {(['General Practitioner', 'School Lecture', 'Raghav'] as UserType[]).map((type) => (
              <button
                key={type}
                onClick={() => setUserType(type)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  userType === type
                    ? 'bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium shadow-sm'
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

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Transcription Area */}
            <div>
              {/* Live Transcription Area */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium text-purple-800">Live Transcribe</h2>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm ${
                      isRecording
                        ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700'
                        : 'bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:from-purple-700 hover:to-purple-600'
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
                <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
                  <textarea
                    className="w-full h-48 p-4 text-gray-700 resize-none focus:outline-none"
                    placeholder="Your transcription will appear here..."
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    readOnly={isRecording}
                  ></textarea>
                </div>
              </div>

              {/* Format Controls - Only show for General Practitioner */}
              {userType === 'General Practitioner' && (
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="flex-grow md:flex-grow-0">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                      <select
                        className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                        value={outputFormat}
                        onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                        disabled={isFormatting}
                      >
                        <option value="Plain">Plain Text</option>
                        <option value="SOAP">SOAP Format</option>
                        <option value="Clinical Summary">Clinical Summary</option>
                        <option value="Bullet Points">Bullet Points</option>
                        <option value="HTML">HTML Format</option>
                        <option value="Markdown">Markdown</option>
                      </select>
                    </div>
                    <div className="flex-shrink-0 self-end">
                      <button
                        onClick={formatTranscription}
                        disabled={!transcription.trim() || isFormatting}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors flex items-center"
                      >
                        {isFormatting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Converting...
                          </>
                        ) : (
                          'Convert'
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Formatted Output Text Area */}
                  <div>
                    <h3 className="text-md font-medium text-purple-800 mb-2">Formatted Output</h3>
                    <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
                      {outputFormat === 'HTML' ? (
                        <div className="p-4">
                          <div dangerouslySetInnerHTML={{ __html: formattedOutput }} className="prose max-w-none" />
                        </div>
                      ) : (
                        <textarea
                          className="w-full h-64 p-4 text-gray-700 resize-none focus:outline-none font-mono"
                          placeholder="Formatted output will appear here after clicking Convert..."
                          value={formattedOutput}
                          onChange={(e) => setFormattedOutput(e.target.value)}
                          readOnly={isFormatting}
                        ></textarea>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
            
            {/* Right Column - ChatBot */}
            <div className="h-[calc(100vh-200px)]">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-medium text-purple-800">AI Assistant</h2>
              </div>
              <ChatBot userType={userType} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
