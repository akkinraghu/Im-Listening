'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';

interface SearchResult {
  chunkId: string;
  articleId: string;
  content: string;
  chunkIndex: number;
  article: {
    title: string;
    source: string;
    url?: string;
    author?: string;
    publishedDate?: string;
  } | null;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: 10,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to perform search');
      }
      
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      setError('Failed to perform search. Please try again.');
      console.error('Error searching:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="gradient-bg min-h-screen">
      {/* Animated flowing dots */}
      <div className="flowing-dots">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-6">
          <Link href="/" className="text-white hover:text-purple-200 flex items-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Home
          </Link>
        </div>

        <div className="glass-card rounded-xl shadow-lg p-6 mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-4 text-center">Semantic Search</h1>
          <p className="text-gray-700 mb-6 text-center">
            Search through articles using semantic understanding powered by Azure OpenAI embeddings
          </p>
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-300 rounded text-red-700 mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your search query..."
                className="flex-grow px-4 py-3 glass-input rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="purple-button px-6 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                disabled={isLoading || !query.trim()}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </span>
                ) : (
                  'Search'
                )}
              </button>
            </div>
          </form>
          
          {results.length > 0 ? (
            <div>
              <h2 className="text-2xl font-semibold gradient-text mb-4">Search Results</h2>
              <div className="space-y-6">
                {results.map((result) => (
                  <div key={result.chunkId} className="glass-card p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-800 mb-2">
                      {result.article?.title || 'Untitled Article'}
                    </h3>
                    {result.article?.source && (
                      <p className="text-sm text-gray-600 mb-2">
                        Source: {result.article.source}
                        {result.article.author && ` • Author: ${result.article.author}`}
                        {result.article.publishedDate && ` • Published: ${result.article.publishedDate}`}
                      </p>
                    )}
                    <p className="text-gray-700 mb-2">{result.content}</p>
                    {result.article?.url && (
                      <a 
                        href={result.article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-800 text-sm inline-flex items-center"
                      >
                        Read more
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !isLoading && query.trim() && (
              <div className="text-center p-8">
                <p className="text-gray-600">No results found for your query.</p>
                <p className="text-gray-500 text-sm mt-2">Try using different keywords or phrases.</p>
              </div>
            )
          )}
          
          {!isLoading && !query.trim() && !results.length && (
            <div className="text-center p-8 glass-card rounded-lg">
              <p className="text-gray-600">Enter a search query to find relevant articles.</p>
              <p className="text-gray-500 text-sm mt-2">Our semantic search understands the meaning behind your query, not just keywords.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
