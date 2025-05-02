import React, { useState, useRef } from 'react';
import { SummaryResponse, VideoResource, ArticleResource, TopicResource } from '@/types/summary';
import ModernChatBox, { ModernChatBoxHandle } from './ModernChatBox';

interface LectureArticleViewProps {
  summaryData: SummaryResponse;
  isLoading: boolean;
}

const LectureArticleView: React.FC<LectureArticleViewProps> = ({
  summaryData,
  isLoading
}) => {
  // Reference to the chat box to programmatically ask questions
  const chatBoxRef = useRef<ModernChatBoxHandle>(null);

  // Create a ref for the lecture summary section
  const summaryRef = useRef<HTMLDivElement>(null);

  // Function to handle topic click
  const handleTopicClick = (topic: string) => {
    if (chatBoxRef.current) {
      // Formulate a question about the topic
      const question = `Tell me more about ${topic}. What are the key points I should understand?`;
      
      // Ask the question in the chat
      chatBoxRef.current.askQuestion(question);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-purple-700 font-medium">Generating lecture summary and resources...</p>
        <p className="text-sm text-gray-500 mt-2">This may take a minute or two</p>
      </div>
    );
  }

  if (!summaryData || !summaryData.summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 p-8 text-gray-500">
        <p>Click "Summarize" to generate a summary and find related resources</p>
      </div>
    );
  }

  const { summary, topics, topicResources } = summaryData;
  
  // Get all videos and articles from topic resources
  const allVideos = topicResources.flatMap((resource: TopicResource) => resource.videos || []).slice(0, 3);
  const allArticles = topicResources.flatMap((resource: TopicResource) => resource.articles || []).slice(0, 3);

  return (
    <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
      <div className="flex flex-col gap-6 p-6">
        {/* Lecture Content Section */}
        <div>
          {/* Lecture Summary Section */}
          <section className="mb-8" ref={summaryRef} id="lecture-summary">
            <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Lecture Summary
            </h2>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 h-64 overflow-y-auto custom-scrollbar">
              <div className="prose max-w-none">
                {summary.split('\n').map((paragraph: string, idx: number) => (
                  <p key={idx} className="mb-4 text-gray-700">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          </section>

          {/* Online Resources Section - Moved up */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 019-9" />
              </svg>
              Online Resources
            </h2>
            
            {/* Videos */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-purple-700 mb-3">Educational Videos</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {allVideos.length > 0 ? (
                  allVideos.map((video: VideoResource, idx: number) => (
                    <a 
                      key={idx}
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-video bg-gray-100 relative">
                        {video.thumbnail ? (
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                            <svg className="w-12 h-12 text-gray-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path d="M8 16a.999.999 0 01-.555-.168l-6-4A1 1 0 011 11V5a1 1 0 01.445-.832l6-4a1 1 0 011.11 0l6 4A1 1 0 0115 5v6a1 1 0 01-.445.832l-6 4A.999.999 0 018 16zm-5-5.764l5 3.333 5-3.333V5.764L8 2.431 3 5.764v4.472z" />
                            </svg>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <div className="bg-purple-600 text-white rounded-full p-2">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium text-gray-800 line-clamp-1">{video.title}</h4>
                        <p className="text-sm text-gray-500 mt-1">{video.platform} • {video.creator}</p>
                      </div>
                    </a>
                  ))
                ) : (
                  <p className="col-span-3 text-gray-500 italic">No videos available for this topic.</p>
                )}
              </div>
            </div>
            
            {/* Articles */}
            <div>
              <h3 className="text-lg font-semibold text-purple-700 mb-3">Educational Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {allArticles.length > 0 ? (
                  allArticles.map((article: ArticleResource, idx: number) => (
                    <a 
                      key={idx}
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4"
                    >
                      <div className="flex items-start">
                        <div className="bg-purple-100 rounded-full p-2 mr-3">
                          <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-800 line-clamp-2">{article.title}</h4>
                          <p className="text-sm text-gray-500 mt-1">{article.publisher}</p>
                        </div>
                      </div>
                      {article.snippet && (
                        <p className="text-sm text-gray-600 mt-3 line-clamp-3">{article.snippet}</p>
                      )}
                    </a>
                  ))
                ) : (
                  <p className="col-span-3 text-gray-500 italic">No articles available for this topic.</p>
                )}
              </div>
            </div>
          </section>

          {/* Key Topics Section - Moved down and made clickable */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Key Topics
            </h2>
            <div className="flex flex-wrap gap-2">
              {topics.map((topic: string, idx: number) => (
                <button 
                  key={idx} 
                  onClick={() => handleTopicClick(topic)}
                  className="px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors cursor-pointer flex items-center"
                >
                  {topic}
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 mt-2">Click on a topic to ask the assistant about it</p>
          </section>
        </div>
        
        {/* Chat Section - Now below the content with ref */}
        <section className="mt-6" id="chat-section">
          <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Ask Questions
          </h2>
          <div className="h-[500px]">
            <ModernChatBox ref={chatBoxRef} summaryData={summaryData} />
          </div>
        </section>
      </div>
    </div>
  );
};

export default LectureArticleView;
