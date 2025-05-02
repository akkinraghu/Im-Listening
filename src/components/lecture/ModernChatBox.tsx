import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { SummaryResponse } from '@/types/summary';

interface ModernChatBoxProps {
  summaryData: SummaryResponse;
}

export interface ModernChatBoxHandle {
  askQuestion: (question: string) => Promise<void>;
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

const ModernChatBox = forwardRef<ModernChatBoxHandle, ModernChatBoxProps>(({ summaryData }, ref) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hi there! I can answer questions about this lecture. What would you like to know?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage }
    ];
    setMessages(newMessages);
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    setIsLoading(true);
    
    try {
      // Call the API to get a response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          context: summaryData
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant response to chat
      setMessages([
        ...newMessages,
        { role: 'assistant' as const, content: data.response }
      ]);
    } catch (error) {
      console.error('Error in chat:', error);
      // Add error message to chat
      setMessages([
        ...newMessages,
        { role: 'assistant' as const, content: 'Sorry, I encountered an error while processing your question. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to ask a question programmatically
  const askQuestion = async (question: string) => {
    if (!question.trim() || isLoading) return;
    
    // Add user message to chat
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: question }
    ];
    setMessages(newMessages);
    
    setIsLoading(true);
    
    try {
      // Call the API to get a response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          context: summaryData
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      
      // Add assistant response to chat
      setMessages([
        ...newMessages,
        { role: 'assistant' as const, content: data.response }
      ]);
    } catch (error) {
      console.error('Error in chat:', error);
      // Add error message to chat
      setMessages([
        ...newMessages,
        { role: 'assistant' as const, content: 'Sorry, I encountered an error while processing your question. Please try again.' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the askQuestion method
  useImperativeHandle(ref, () => ({
    askQuestion
  }), [messages, isLoading]);

  return (
    <div ref={chatContainerRef} className="flex flex-col h-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-purple-400 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-sm">Lecture Assistant</h3>
            <p className="text-xs text-gray-500">Ask questions about this lecture</p>
          </div>
        </div>
      </div>
      
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="prose prose-sm max-w-none">
                {message.content.split('\n').map((paragraph, idx) => (
                  <p key={idx} className={`${idx > 0 ? 'mt-2' : 'mt-0'} mb-0`}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 rounded-2xl px-4 py-2">
              <div className="flex space-x-1 items-center h-6">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Auto-scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Chat input */}
      <div className="border-t border-gray-200 p-3">
        <form onSubmit={handleSubmit} className="flex items-end">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none min-h-[40px] max-h-[200px] text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="ml-2 p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
        <div className="mt-2 text-xs text-gray-500 text-center">
          Press Enter to send, Shift+Enter for a new line
        </div>
      </div>
    </div>
  );
});

export default ModernChatBox;
