import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { deepgramService } from '@/services/deepgramService';

interface TranscriptionRecorderProps {
  onTranscriptionUpdate?: (text: string, isFinal: boolean) => void;
  onTranscriptionComplete?: (text: string) => void;
  onError?: (error: Error) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export interface TranscriptionRecorderHandle {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearTranscription: () => void;
}

type RecordingStatus = 'idle' | 'connecting' | 'connected' | 'recording' | 'error' | 'disconnected';

const TranscriptionRecorder = forwardRef<TranscriptionRecorderHandle, TranscriptionRecorderProps>(({
  onTranscriptionUpdate,
  onTranscriptionComplete,
  onError,
  onRecordingStateChange
}, ref) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcription, setTranscription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  
  // Initialize the DeepGram service
  useEffect(() => {
    const initialize = async () => {
      try {
        const success = await deepgramService.initialize();
        setIsInitialized(success);
        
        if (!success) {
          setErrorMessage('Failed to initialize transcription service');
          if (onError) onError(new Error('Failed to initialize transcription service'));
        }
      } catch (error) {
        setErrorMessage('Error initializing transcription service');
        if (onError) onError(error as Error);
      }
    };
    
    initialize();
    
    // Set up event handlers
    deepgramService.onStatusChange((newStatus) => {
      setStatus(newStatus as RecordingStatus);
      if (newStatus === 'error') {
        setIsRecording(false);
      }
    });
    
    deepgramService.onError((error) => {
      setErrorMessage(error.message);
      setIsRecording(false);
      if (onError) onError(error);
    });
    
    deepgramService.onTranscription((result) => {
      if (result.isFinal) {
        finalTranscriptRef.current += ' ' + result.transcript;
        interimTranscriptRef.current = '';
      } else {
        interimTranscriptRef.current = result.transcript;
      }
      
      const fullTranscript = finalTranscriptRef.current + ' ' + interimTranscriptRef.current;
      setTranscription(fullTranscript.trim());
      
      if (onTranscriptionUpdate) {
        onTranscriptionUpdate(fullTranscript.trim(), result.isFinal);
      }
    });
  }, [onTranscriptionUpdate, onError]);
  
  // Start recording
  const startRecording = async () => {
    if (!isInitialized) {
      setErrorMessage('Transcription service not initialized');
      return;
    }
    
    try {
      setErrorMessage(null);
      finalTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      setTranscription('');
      
      await deepgramService.startRecording();
      setIsRecording(true);
      if (onRecordingStateChange) {
        onRecordingStateChange(true);
      }
    } catch (error) {
      setErrorMessage((error as Error).message);
      if (onError) onError(error as Error);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (isRecording) {
      deepgramService.stopRecording();
      setIsRecording(false);
      if (onRecordingStateChange) {
        onRecordingStateChange(false);
      }
      
      if (onTranscriptionComplete) {
        onTranscriptionComplete(finalTranscriptRef.current.trim());
      }
    }
  };
  
  // Clear the transcription
  const clearTranscription = () => {
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setTranscription('');
  };
  
  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording,
    clearTranscription
  }));
  
  return (
    <div className="w-full">
      <div className="flex flex-col space-y-4">
        {/* Status indicator */}
        <div className="flex items-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full ${
              status === 'idle' ? 'bg-gray-400' :
              status === 'connecting' ? 'bg-yellow-400' :
              status === 'connected' ? 'bg-blue-400' :
              status === 'recording' ? 'bg-green-400 animate-pulse' :
              status === 'disconnected' ? 'bg-gray-400' :
              'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {status === 'idle' ? 'Ready' :
             status === 'connecting' ? 'Connecting...' :
             status === 'connected' ? 'Connected' :
             status === 'recording' ? 'Recording' :
             status === 'disconnected' ? 'Disconnected' :
             'Error'}
          </span>
        </div>
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          <button
            onClick={startRecording}
            disabled={isRecording || !isInitialized}
            className={`px-4 py-2 rounded-md text-white ${
              isRecording || !isInitialized ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'
            }`}
            data-recording-button="true"
          >
            Start
          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className={`px-4 py-2 rounded-md text-white ${
              !isRecording ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
            }`}
            data-recording-stop="true"
          >
            Stop
          </button>
          <button
            onClick={clearTranscription}
            className="px-4 py-2 rounded-md text-white bg-gray-500 hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
        
        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700">
            {errorMessage}
          </div>
        )}
        
        {/* Transcription display */}
        <div className="bg-white p-4 rounded-lg border border-gray-200 min-h-[200px] mb-4 overflow-y-auto">
          {transcription ? (
            <p className="text-gray-800">{transcription}</p>
          ) : (
            <p className="text-gray-500 italic">Transcription will appear here...</p>
          )}
        </div>
      </div>
    </div>
  );
});

TranscriptionRecorder.displayName = 'TranscriptionRecorder';

export default TranscriptionRecorder;
