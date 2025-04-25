import React from 'react';

interface Source {
  title: string;
  url?: string;
  author?: string;
  publishedDate?: string;
}

interface ReferenceCardProps {
  source: Source;
}

const ReferenceCard: React.FC<ReferenceCardProps> = ({ source }) => {
  return (
    <div className="bg-white border border-purple-200 rounded-lg shadow-sm p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start">
        {/* Article icon */}
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
          </div>
        </div>
        
        {/* Article details */}
        <div className="flex-1">
          <h3 className="font-medium text-sm text-gray-800">
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
          </h3>
          
          {/* Metadata */}
          <div className="mt-1 text-xs text-gray-600 space-y-1">
            {source.author && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Author: {source.author}</span>
              </div>
            )}
            
            {source.publishedDate && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Published: {new Date(source.publishedDate).toLocaleDateString()}</span>
              </div>
            )}
            
            {source.url && (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline"
                >
                  View original article
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferenceCard;
