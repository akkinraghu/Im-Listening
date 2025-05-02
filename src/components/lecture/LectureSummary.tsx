import React from 'react';

interface Resource {
  title: string;
  platform?: string;
  creator?: string;
  publisher?: string;
  author?: string;
  year?: string;
  url: string;
}

interface TopicResource {
  topic: string;
  description: string;
  videos: Resource[];
  articles: Resource[];
  book: {
    title: string;
    author: string;
    year: string;
  } | null;
}

interface RelatedArticle {
  id: number;
  title: string;
  url: string;
  source: string;
  snippet: string;
  similarity: number;
}

interface SummaryResponse {
  summary: string;
  topics: string[];
  relatedArticles: RelatedArticle[];
  topicResources: TopicResource[];
}

interface LectureSummaryProps {
  summaryResponse: SummaryResponse;
  isLoading?: boolean;
}

const LectureSummary: React.FC<LectureSummaryProps> = ({
  summaryResponse,
  isLoading = false
}) => {
  const { summary, topics, relatedArticles, topicResources } = summaryResponse || {};
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-purple-700 font-medium">Generating lecture summary and resources...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a minute or two</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 text-gray-500">
        <p>Click "Summarize" to generate a summary and find related resources</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
      <div className="p-6">
        {/* Main Summary */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-purple-800 mb-4">Lecture Summary</h2>
          <div className="prose max-w-none">
            {summary.split('\n').map((paragraph, idx) => (
              <p key={idx} className="mb-4 text-gray-700">
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/* Key Topics */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-purple-700 mb-3">Key Topics</h3>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic, idx) => (
              <span 
                key={idx} 
                className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Topic Resources */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-purple-700 mb-4">Deep Dive Resources</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topicResources.map((resource, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="text-lg font-medium text-purple-800 mb-2">{resource.topic}</h4>
                <p className="text-gray-700 mb-3 text-sm">{resource.description}</p>
                
                {/* Videos */}
                {resource.videos.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Videos</h5>
                    <ul className="space-y-2">
                      {resource.videos.map((video, vidx) => (
                        <li key={vidx} className="text-sm">
                          <a 
                            href={video.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"></path>
                              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"></path>
                            </svg>
                            {video.title} ({video.platform} - {video.creator})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Articles */}
                {resource.articles.length > 0 && (
                  <div className="mb-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Articles</h5>
                    <ul className="space-y-2">
                      {resource.articles.map((article, aidx) => (
                        <li key={aidx} className="text-sm">
                          <a 
                            href={article.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                            </svg>
                            {article.title} ({article.publisher})
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* Book */}
                {resource.book && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Recommended Book</h5>
                    <p className="text-sm text-gray-700">
                      <svg className="w-4 h-4 mr-1 inline" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
                      </svg>
                      <span className="font-medium">{resource.book.title}</span> by {resource.book.author} ({resource.book.year})
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Related Articles from Database */}
        {relatedArticles.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-purple-700 mb-4">Related Articles from Our Database</h3>
            <div className="space-y-4">
              {relatedArticles.map((article, idx) => (
                <div key={idx} className="border-l-4 border-purple-300 pl-4 py-2">
                  <h4 className="font-medium text-purple-800 mb-1">
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {article.title}
                    </a>
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">{article.snippet}</p>
                  <div className="flex items-center text-xs text-gray-500">
                    <span className="mr-2">Source: {article.source}</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      {Math.round(article.similarity * 100)}% match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LectureSummary;
