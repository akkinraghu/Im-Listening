import React, { useState, useRef } from 'react';
import { SummaryResponse, VideoResource, ArticleResource } from '@/types/summary';
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

  const { summary, topics, keyPoints, sampleQuestions, relatedArticles, resources } = summaryData;
  
  // Get all videos and articles from resources
  const allVideos = resources?.videos || [];
  const allArticles = resources?.articles || [];
  
  // Debug log to see what resources we have
  console.log('LectureArticleView resources:', {
    videosCount: allVideos.length,
    articlesCount: allArticles.length,
    videos: allVideos,
    articles: allArticles
  });

  return (
    <div className="bg-white rounded-lg shadow-md border border-purple-100 overflow-hidden">
      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Lecture Summary Section */}
            <section className="mb-8" ref={summaryRef}>
              <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Lecture Summary
              </h2>
              <div className="prose max-w-none text-gray-700">
                <p className="whitespace-pre-line">{summary}</p>
              </div>
              
              {/* Key Points Section - inside the summary section */}
              {keyPoints && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold text-purple-700 mb-3">Key Points</h3>
                  <div className="bg-purple-50 p-4 rounded-md">
                    <div className="whitespace-pre-line text-gray-700">{keyPoints}</div>
                  </div>
                </div>
              )}
              
              {/* Sample Questions Section - inside the summary section */}
              {sampleQuestions && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold text-purple-700 mb-3">Sample Questions</h3>
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="whitespace-pre-line text-gray-700">{sampleQuestions}</div>
                  </div>
                </div>
              )}
            </section>

            {/* Online Resources Section */}
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-purple-800 mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                Online Resources
              </h2>
              
              {/* Videos Section */}
              {allVideos && allVideos.length > 0 ? (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-purple-700 mb-3">Videos</h3>
                  <div className="space-y-4">
                    {allVideos.map((video, idx) => (
                      <a 
                        key={idx} 
                        href={video.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-4 border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <div className="flex items-start">
                          {video.thumbnail ? (
                            <img 
                              src={video.thumbnail} 
                              alt={video.title} 
                              className="w-24 h-16 object-cover rounded mr-4"
                            />
                          ) : (
                            <div className="w-24 h-16 bg-gray-200 rounded mr-4 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <h4 className="font-medium text-gray-800 line-clamp-2">{video.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">{video.platform} • {video.creator}</p>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No videos available for this topic.</p>
              )}
              
              {/* Articles Section */}
              {allArticles && allArticles.length > 0 ? (
                <div>
                  <h3 className="text-lg font-semibold text-purple-700 mb-3">Articles</h3>
                  <div className="space-y-4">
                    {allArticles.map((article, idx) => (
                      <a 
                        key={idx} 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block p-4 border border-gray-200 rounded-lg hover:bg-purple-50 transition-colors"
                      >
                        <div className="flex items-start">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3 flex-shrink-0">
                            <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-800 line-clamp-2">{article.title}</h4>
                            <p className="text-sm text-gray-500 mt-1">{article.url ? new URL(article.url).hostname.replace('www.', '') : 'Online Resource'}</p>
                          </div>
                        </div>
                        {article.snippet && (
                          <p className="text-sm text-gray-600 mt-3 line-clamp-3">{article.snippet}</p>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No articles available for this topic.</p>
              )}
            </section>

            {/* Key Topics Section */}
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
          
          {/* Chat Section - Now on the right side */}
          <div className="lg:col-span-1">
            <section className="sticky top-6" id="chat-section">
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
      </div>
    </div>
  );
};

export default LectureArticleView;
