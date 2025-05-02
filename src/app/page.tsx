'use client';

import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getFeatureFlags, getEnabledUserTypes } from '@/utils/featureFlags';
import ExampleLectureButtons from '@/components/lecture/ExampleLectureButtons';

// Dynamically import the TranscriptionRecorder component with no SSR
const TranscriptionRecorder = dynamic(
  () => import('@/components/transcription/TranscriptionRecorder').then(mod => mod.default),
  { ssr: false }
);

// Import the ChatBot component
import ChatBot from '@/components/chat/ChatBot';
import LectureArticleView from '@/components/lecture/LectureArticleView';
import { SummaryResponse as LectureSummaryResponse } from '@/types/summary';

// Import the TranscriptionRecorderHandle type
import type { TranscriptionRecorderHandle } from '@/components/transcription/TranscriptionRecorder';

// Define the user types
type UserType = 'General Practitioner' | 'School Lecture' | 'Raghav';

// Define the output formats
type OutputFormat = 'Plain' | 'SOAP' | 'Clinical Summary' | 'Bullet Points' | 'HTML' | 'Markdown';

// Define the summary response type
interface SummaryResponse {
  summary: string;
  topics: string[];
  relatedArticles: {
    id: number;
    title: string;
    url: string;
    source: string;
    snippet: string;
    similarity: number;
  }[];
  topicResources: {
    topic: string;
    description: string;
    videos: {
      title: string;
      platform: string;
      creator: string;
      url: string;
    }[];
    articles: {
      title: string;
      publisher: string;
      url: string;
    }[];
    book: {
      title: string;
      author: string;
      year: string;
    } | null;
  }[];
}

// Define the page configuration by user type
interface PageConfig {
  showAIAssistant: boolean;
  defaultOutputFormat: OutputFormat;
  availableFormats: OutputFormat[];
  autoConvert: boolean;
  showFormatControls: boolean;
  showManualConvertButton: boolean;
  containerWidth: string; // Width of the container
  outputType: 'formatted' | 'summary'; // Type of output to display
}

export default function Home() {
  const [transcription, setTranscription] = useState<string>('');
  const [transcriptionByUserType, setTranscriptionByUserType] = useState<Record<UserType, string>>({
    'General Practitioner': '',
    'School Lecture': '',
    'Raghav': ''
  });
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [userType, setUserType] = useState<UserType>('School Lecture');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('Plain');
  const [formattedOutput, setFormattedOutput] = useState<string>('');
  const [isFormatting, setIsFormatting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [summaryResponse, setSummaryResponse] = useState<LectureSummaryResponse | null>(null);
  const [enabledUserTypes, setEnabledUserTypes] = useState<UserType[]>(['School Lecture']);
  
  // Reference to the TranscriptionRecorder component
  const recorderRef = useRef<TranscriptionRecorderHandle>(null);

  // Configuration for each user type
  const pageConfigs: Record<UserType, PageConfig> = {
    'General Practitioner': {
      showAIAssistant: true,
      defaultOutputFormat: 'SOAP',
      availableFormats: ['Plain', 'SOAP', 'Clinical Summary', 'Bullet Points', 'HTML', 'Markdown'],
      autoConvert: false,
      showFormatControls: true,
      showManualConvertButton: true,
      containerWidth: 'max-w-3xl', // Default width
      outputType: 'formatted'
    },
    'School Lecture': {
      showAIAssistant: false,
      defaultOutputFormat: 'Bullet Points',
      availableFormats: ['Bullet Points'],
      autoConvert: true,
      showFormatControls: false,
      showManualConvertButton: true,
      containerWidth: 'w-3/4', // 75% of window space
      outputType: 'summary'
    },
    'Raghav': {
      showAIAssistant: true,
      defaultOutputFormat: 'Plain',
      availableFormats: ['Plain', 'Bullet Points', 'HTML', 'Markdown'],
      autoConvert: false,
      showFormatControls: true,
      showManualConvertButton: true,
      containerWidth: 'max-w-3xl', // Default width
      outputType: 'formatted'
    }
  };

  // Set base URL after component mounts and initialize feature flags
  useEffect(() => {
    setBaseUrl(window.location.origin);
    
    // Get enabled user types from feature flags
    const enabledTypes = getEnabledUserTypes();
    setEnabledUserTypes(enabledTypes);
    
    // If current user type is not enabled, switch to the first enabled type
    if (enabledTypes.length > 0 && !enabledTypes.includes(userType)) {
      setUserType(enabledTypes[0]);
    }
  }, []);

  // Update output format when user type changes
  useEffect(() => {
    setOutputFormat(pageConfigs[userType].defaultOutputFormat);
  }, [userType, pageConfigs]);

  // Handle transcription updates from the recorder component
  const handleTranscriptionUpdate = (text: string, isFinal: boolean) => {
    setTranscription(text);
    setTranscriptionByUserType(prev => ({
      ...prev,
      [userType]: text
    }));
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
    } finally {
      setIsFormatting(false);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      if (recorderRef.current) {
        await recorderRef.current.startRecording();
        setIsRecording(true);
      }
    } catch (err: any) {
      setError(`Failed to start recording: ${err.message || 'Unknown error'}`);
      console.error('Error starting recording:', err);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    try {
      if (recorderRef.current) {
        recorderRef.current.stopRecording();
        setIsRecording(false);
        
        // Auto-convert if enabled for this user type
        if (pageConfigs[userType].autoConvert) {
          // Wait a moment for the final transcription to be processed
          setTimeout(() => {
            if (pageConfigs[userType].outputType === 'summary') {
              getSummary();
            } else {
              formatTranscription();
            }
          }, 500);
        }
      }
    } catch (err: any) {
      setError(`Failed to stop recording: ${err.message || 'Unknown error'}`);
      console.error('Error stopping recording:', err);
    }
  };

  // Clear the current transcription
  const clearCurrentTranscription = () => {
    if (recorderRef.current) {
      recorderRef.current.clearTranscription();
    }
    setTranscription('');
    setFormattedOutput('');
    setTranscriptionByUserType(prev => ({
      ...prev,
      [userType]: ''
    }));
    setSummaryResponse(null);
  };

  // Handle recording state change from the recorder component
  const handleRecordingStateChange = (isRecording: boolean) => {
    setIsRecording(isRecording);
  };

  // Get the summary of the transcription
  const getSummary = async () => {
    if (!transcription.trim()) {
      setError('No transcription to summarize');
      return;
    }

    setIsFormatting(true);
    // Show immediate feedback by setting a loading message
    setSummaryResponse(null);
    
    try {
      // Use the baseUrl state instead of checking window
      const apiUrl = `${baseUrl || 'http://localhost:3007'}/api/transcription/summarize`;
      
      console.log('Making summarize API call to:', apiUrl);
      
      // Call the summarization API endpoint with the correct base URL
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: transcription,
          userType: userType,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Summarize API error: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`);
      }
      
      const data = await response.json();
      
      setSummaryResponse(data);
      
      setError(null);
    } catch (err: any) {
      setError(`Failed to summarize transcription: ${err.message || 'Unknown error'}`);
      console.error('Error summarizing transcription:', err);
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex justify-center">
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-400">
              {enabledUserTypes.length === 1 && enabledUserTypes[0] === 'School Lecture' 
                ? 'School Lecture Transcriber' 
                : "I'm Listening"}
            </h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs - Only show if there are multiple enabled user types */}
        {enabledUserTypes.length > 1 && (
          <div className="flex justify-center mb-6">
            <div className="bg-white rounded-lg shadow-md border border-purple-100 p-1 inline-flex">
              {enabledUserTypes.map((type) => (
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
        )}

        {error && (
          <div className="max-w-3xl mx-auto mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="max-w-5xl mx-auto">
          <div className={`grid grid-cols-1 ${pageConfigs[userType].showAIAssistant ? 'md:grid-cols-2' : ''} gap-6`}>
            {/* Left Column - Transcription Area */}
            <div className={`${pageConfigs[userType].showAIAssistant ? '' : pageConfigs[userType].containerWidth + ' mx-auto'}`}>
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
                  {!transcription.trim() ? (
                    <div className="p-4">
                      <p className="text-gray-500 mb-4">Select an example lecture below or start recording to transcribe your own lecture.</p>
                      <ExampleLectureButtons 
                        onSelectLecture={(content) => {
                          setTranscription(content);
                          setTranscriptionByUserType(prev => ({
                            ...prev,
                            [userType]: content
                          }));
                        }} 
                      />
                    </div>
                  ) : (
                    <textarea
                      className="w-full h-48 p-4 text-gray-700 resize-none focus:outline-none"
                      placeholder="Your transcription will appear here..."
                      value={transcription}
                      onChange={(e) => {
                        const newText = e.target.value;
                        setTranscription(newText);
                        setTranscriptionByUserType(prev => ({
                          ...prev,
                          [userType]: newText
                        }));
                      }}
                      readOnly={isRecording}
                    ></textarea>
                  )}
                </div>
              </div>

              {/* Format Controls - Only show for tabs that have format controls enabled */}
              {pageConfigs[userType].showFormatControls && (
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
                        {pageConfigs[userType].availableFormats.map(format => (
                          <option key={format} value={format}>
                            {format === 'Plain' ? 'Plain Text' : 
                             format === 'SOAP' ? 'SOAP Format' : 
                             format === 'HTML' ? 'HTML Format' : 
                             format === 'Markdown' ? 'Markdown' : 
                             `${format}`}
                          </option>
                        ))}
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
                </div>
              )}
              
              {/* Manual Convert Button for School Lecture - Show only when format controls are hidden */}
              {!pageConfigs[userType].showFormatControls && pageConfigs[userType].showManualConvertButton && (
                <div className="mb-6 flex justify-end">
                  <button
                    onClick={getSummary}
                    disabled={!transcription.trim() || isFormatting}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg hover:from-purple-700 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors flex items-center"
                  >
                    {isFormatting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Summarizing...
                      </>
                    ) : (
                      <>
                        <span className="mr-2">📝</span>
                        Summarize
                      </>
                    )}
                  </button>
                </div>
              )}
                
              {/* Formatted Output Text Area - Always show this */}
              <div className="mb-6">
                <h3 className="text-md font-medium text-purple-800 mb-2">{pageConfigs[userType].outputType === 'summary' ? 'Summary' : 'Formatted Output'}</h3>
                <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
                  {pageConfigs[userType].outputType === 'summary' ? (
                    summaryResponse ? (
                      <LectureArticleView summaryData={summaryResponse} isLoading={isFormatting} />
                    ) : (
                      <div className="p-4 text-gray-700">
                        {isFormatting ? 'Summarizing...' : 'Summary will appear here after clicking Summarize...'}
                      </div>
                    )
                  ) : outputFormat === 'HTML' ? (
                    <div className="p-4">
                      <div dangerouslySetInnerHTML={{ __html: formattedOutput }} className="prose max-w-none" />
                    </div>
                  ) : (
                    <textarea
                      className="w-full h-64 p-4 text-gray-700 resize-none focus:outline-none font-mono"
                      placeholder={pageConfigs[userType].autoConvert 
                        ? "Output will appear automatically after recording stops..." 
                        : "Formatted output will appear here after clicking Convert..."}
                      value={formattedOutput}
                      onChange={(e) => setFormattedOutput(e.target.value)}
                      readOnly={isFormatting}
                    ></textarea>
                  )}
                </div>
              </div>

              {/* Clear button for the current transcription */}
              <div className="flex justify-end mb-4">
                <button
                  onClick={clearCurrentTranscription}
                  className="px-3 py-1 text-sm text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors"
                  disabled={!transcription.trim()}
                >
                  Clear Current Transcription
                </button>
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
            
            {/* Right Column - ChatBot (only shown for certain user types) */}
            {pageConfigs[userType].showAIAssistant && (
              <div className="h-[calc(100vh-200px)]">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-medium text-purple-800">AI Assistant</h2>
                </div>
                <ChatBot userType={userType} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
