'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sources?: {
    title: string;
    url?: string;
    author?: string;
    publishedDate?: string;
  }[];
}

interface ChatBotProps {
  userType: string;
}

export default function ChatBot({ userType }: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: `Hello! I'm your AI assistant. How can I help you with your ${userType.toLowerCase()} queries today?`,
      role: 'assistant',
      timestamp: '',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Set the timestamp for the initial message and get the base URL after component mounts
  useEffect(() => {
    // Update the timestamp for the initial message
    setMessages(prev => 
      prev.map(msg => 
        msg.id === '1' ? {...msg, timestamp: new Date().toISOString()} : msg
      )
    );
    
    // Set the base URL
    setBaseUrl(window.location.origin);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // Use the baseUrl state instead of checking window
      const apiUrl = `${baseUrl || 'http://localhost:3007'}/api/chat`;
      
      // Call the chat API endpoint
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          userType,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant message with sources
      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: data.response,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        sources: data.sources,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error in chat:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error while processing your request. Please try again.',
        role: 'assistant',
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-purple-600 to-purple-500 text-white">
        <h2 className="text-lg font-medium">AI Assistant</h2>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-4 ${
              message.role === 'user' ? 'text-right' : 'text-left'
            }`}
          >
            <div
              className={`inline-block max-w-[80%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-purple-100 text-gray-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              
              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300 text-xs text-gray-600">
                  <p className="font-semibold">Sources:</p>
                  <ul className="list-disc pl-4 mt-1">
                    {message.sources.map((source, index) => (
                      <li key={index}>
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-600 hover:underline"
                          >
                            {source.title}
                          </a>
                        ) : (
                          source.title
                        )}
                        {source.author && ` by ${source.author}`}
                        {source.publishedDate && ` (${new Date(source.publishedDate).toLocaleDateString()})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC'  // Use UTC to ensure consistency between server and client
              }) : ''}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-r-lg hover:from-purple-700 hover:to-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors flex items-center"
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Thinking...
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
