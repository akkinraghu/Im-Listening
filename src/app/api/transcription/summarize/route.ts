import { NextResponse } from 'next/server';
import { getOpenAIInstance, generateChatCompletion, parseJsonResponse } from '../../../../utils/openai';
import { getVectorStore } from '../../../../utils/vectorStore';
import { ArticlePg } from '../../../../models/postgres/Article';

// Function to fetch real search results for a topic
async function fetchRealResourcesForTopic(topic: string) {
  try {
    // Use the web search API to get real, current results
    const searchQuery = `${topic} educational resources lecture`;
    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=10&responseFilter=Webpages,Videos`, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY || '',
      }
    });

    if (!response.ok) {
      console.error(`Search API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Extract web pages (articles)
    const articles = data.webPages?.value 
      ? data.webPages.value
          .slice(0, 5)
          .map((page: any) => ({
            title: page.name,
            url: page.url,
            snippet: page.snippet
          }))
      : [];
    
    // Extract videos - prioritize YouTube videos
    const videos = data.videos?.value
      ? data.videos.value
          .slice(0, 5)
          .map((video: any) => {
            // Extract video ID for YouTube videos
            try {
              const url = new URL(video.hostPageUrl);
              const videoId = url.searchParams.get('v');
              
              return {
                title: video.name,
                platform: video.hostPageUrl.includes('youtube.com') ? 'YouTube' : 
                         video.hostPageUrl.includes('vimeo.com') ? 'Vimeo' : 'Video',
                creator: video.publisher?.[0]?.name || 'Content Creator',
                url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : video.hostPageUrl,
                thumbnail: video.thumbnailUrl
              };
            } catch (e) {
              return {
                title: video.name,
                platform: 'Video',
                creator: video.publisher?.[0]?.name || 'Content Creator',
                url: video.hostPageUrl,
                thumbnail: video.thumbnailUrl
              };
            }
          })
      : [];
    
    // Try a second search specifically for videos if we didn't get enough
    if (videos.length < 2) {
      try {
        const videoSearchQuery = `${topic} lecture video`;
        const videoResponse = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(videoSearchQuery)}&count=5&responseFilter=Videos`, {
          headers: {
            'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY || '',
          }
        });
        
        if (videoResponse.ok) {
          const videoData = await videoResponse.json();
          
          if (videoData.videos?.value) {
            const additionalVideos = videoData.videos.value
              .slice(0, 3)
              .map((video: any) => {
                try {
                  const url = new URL(video.hostPageUrl);
                  const videoId = url.searchParams.get('v');
                  
                  return {
                    title: video.name,
                    platform: video.hostPageUrl.includes('youtube.com') ? 'YouTube' : 
                             video.hostPageUrl.includes('vimeo.com') ? 'Vimeo' : 'Video',
                    creator: video.publisher?.[0]?.name || 'Content Creator',
                    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : video.hostPageUrl,
                    thumbnail: video.thumbnailUrl
                  };
                } catch (e) {
                  return {
                    title: video.name,
                    platform: 'Video',
                    creator: video.publisher?.[0]?.name || 'Content Creator',
                    url: video.hostPageUrl,
                    thumbnail: video.thumbnailUrl
                  };
                }
              });
              
            videos.push(...additionalVideos);
          }
        }
      } catch (error) {
        console.error('Error in additional video search:', error);
        // Continue with what we have
      }
    }
    
    return {
      articles,
      videos
    };
  } catch (error) {
    console.error('Error fetching real resources:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    console.log('Summarize API: Starting request processing');
    
    // Parse the request body
    const body = await request.json().catch(e => {
      console.error('Summarize API: Error parsing request body:', e);
      return {};
    });
    
    const { text, userType } = body;

    if (!text || text.trim() === '') {
      console.error('Summarize API: No text provided');
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Truncate text to a reasonable length to speed up processing
    const truncatedText = text.length > 10000 ? text.substring(0, 10000) + '...' : text;
    console.log('Summarize API: Text received, length:', truncatedText.length);

    // Check if we have a valid OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.error('Summarize API: OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('Summarize API: Generating summary with OpenAI');
    
    // Generate a summary of the lecture
    let summary;
    try {
      summary = await generateChatCompletion([
        {
          role: "system",
          content: "You are an expert educational assistant that helps summarize lecture content. Be concise and focus on key points."
        },
        {
          role: "user",
          content: `Summarize this lecture transcript in 2-3 paragraphs, highlighting the main points: ${truncatedText}`
        }
      ], {
        model: "gpt-3.5-turbo-0125", // Use the latest optimized model
        temperature: 0.3, // Lower temperature for faster, more deterministic responses
        max_tokens: 400 // Limit token count
      });
    } catch (error) {
      console.error('Summarize API: Error generating summary:', error);
      return NextResponse.json(
        { error: 'Failed to generate summary', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    console.log('Summarize API: Summary generated successfully');
    
    // Extract key topics from the lecture - use a shorter text sample for speed
    console.log('Summarize API: Extracting key topics');
    
    let topicsContent;
    try {
      topicsContent = await generateChatCompletion([
        {
          role: "system",
          content: "Extract 3-5 key topics from the lecture as a JSON array of strings. Format your response as: [\"topic1\", \"topic2\", \"topic3\"]"
        },
        {
          role: "user",
          content: `Extract key topics from this lecture summary: ${summary}`
        }
      ], {
        model: "gpt-3.5-turbo-0125", // Use the latest optimized model
        temperature: 0.3, // Lower temperature for faster responses
        max_tokens: 100 // Limit token count
      });
    } catch (error) {
      console.error('Summarize API: Error extracting topics:', error);
      return NextResponse.json(
        { error: 'Failed to extract topics', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }

    // Parse topics with fallback handling
    let topics: string[] = [];
    try {
      topics = parseJsonResponse<string[]>(topicsContent, []);
      
      // If parsing fails, try to extract topics manually
      if (topics.length === 0) {
        topics = topicsContent
          .replace(/[\[\]"]/g, '')
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0);
      }
      
      // Limit to 5 topics maximum
      topics = topics.slice(0, 5);
      
      console.log('Summarize API: Parsed topics:', topics);
    } catch (error) {
      console.error('Summarize API: Error parsing topics:', error);
      // Continue with empty topics array
    }

    // Generate key points from the summary
    console.log('Summarize API: Generating key points');
    
    let keyPointsContent;
    try {
      keyPointsContent = await generateChatCompletion([
        {
          role: "system",
          content: "Extract 3-5 key points from the lecture summary as bullet points. Format your response as a simple list with each point on a new line, starting with a dash."
        },
        {
          role: "user",
          content: `Extract key points from this lecture summary: ${summary}`
        }
      ], {
        model: "gpt-3.5-turbo-0125", // Use the latest optimized model
        temperature: 0.3, // Lower temperature for faster responses
        max_tokens: 200 // Limit token count
      });
    } catch (error) {
      console.error('Summarize API: Error extracting key points:', error);
      keyPointsContent = "";
    }

    // Generate sample questions for the lecture
    console.log('Summarize API: Generating sample questions');
    
    let sampleQuestionsContent;
    try {
      sampleQuestionsContent = await generateChatCompletion([
        {
          role: "system",
          content: "Generate 5 sample questions about the lecture content that would help a student understand the material better. Format your response as a simple list with each question on a new line, starting with a number."
        },
        {
          role: "user",
          content: `Generate sample questions for this lecture summary: ${summary}`
        }
      ], {
        model: "gpt-3.5-turbo-0125", // Use the latest optimized model
        temperature: 0.7, // Higher temperature for more creative questions
        max_tokens: 250 // Limit token count
      });
    } catch (error) {
      console.error('Summarize API: Error generating sample questions:', error);
      sampleQuestionsContent = "";
    }

    // Initialize vector store in parallel with topic extraction to save time
    const vectorStorePromise = getVectorStore().catch(error => {
      console.error('Summarize API: Error getting vector store:', error);
      return null;
    });
    
    // Define an interface for the article type
    interface RelatedArticle {
      id: string | number;  
      title: string;
      url?: string;
      source?: string;
      snippet?: string;
      similarity?: number;
    }
    
    const relatedArticles: RelatedArticle[] = [];

    // Only search for related articles if vectorStore is available
    const vectorStore = await vectorStorePromise;
    if (vectorStore && topics.length > 0) {
      console.log('Summarize API: Searching for related articles');
      
      // Only use the first topic to reduce processing time
      const topic = topics[0];
      
      try {
        // Search for related articles using vector similarity
        console.log(`Summarize API: Searching for topic: "${topic}"`);
        const results = await vectorStore.similaritySearch(topic, 2);
        
        if (results && results.length > 0) {
          console.log(`Summarize API: Found ${results.length} results for topic "${topic}"`);
          
          // Process only up to 2 results to avoid timeouts
          const limitedResults = results.slice(0, 2);
          
          for (const result of limitedResults) {
            try {
              // Skip database lookup and just use the chunk content
              relatedArticles.push({
                id: result.metadata.id,
                title: `Related content ${result.metadata.id}`,
                snippet: result.pageContent.substring(0, 200) + '...',
                similarity: result.metadata.similarity
              });
              console.log(`Summarize API: Added content snippet to related articles`);
            } catch (error) {
              console.error(`Summarize API: Error processing result:`, error);
            }
          }
        } else {
          console.log(`Summarize API: No results found for topic "${topic}"`);
        }
      } catch (error) {
        console.error(`Summarize API: Error searching for topic "${topic}":`, error);
      }
    } else {
      console.log('Summarize API: Skipping related articles search (no vector store or topics)');
    }

    // For external resources, only use the first topic and fetch in parallel
    const additionalResources: any[] = [];
    
    // Process all topics for external resources to get more results
    const topicsToSearch = topics.slice(0, 3); // Use up to 3 topics for search
    
    // Initialize arrays for articles and videos
    let allArticles = [];
    let allVideos = [];
    
    // Check if Bing Search API key is available
    const hasBingKey = !!process.env.BING_SEARCH_API_KEY;
    console.log('Summarize API: Bing Search API key available:', hasBingKey);
    
    if (topicsToSearch.length > 0 && hasBingKey) {
      console.log(`Summarize API: Fetching external resources for ${topicsToSearch.length} topics:`, topicsToSearch);
      
      try {
        // Process topics in parallel
        const resourcePromises = topicsToSearch.map(topic => 
          fetchRealResourcesForTopic(topic).catch(error => {
            console.error(`Summarize API: Error fetching resources for topic "${topic}":`, error);
            return null;
          })
        );
        
        // Wait for all resource fetches to complete
        const allResources = await Promise.all(resourcePromises);
        
        // Combine all resources
        const combinedResources = {
          articles: [] as any[],
          videos: [] as any[]
        };
        
        // Merge all resources
        allResources.forEach(resource => {
          if (resource) {
            if (resource.articles && resource.articles.length > 0) {
              combinedResources.articles.push(...resource.articles);
            }
            if (resource.videos && resource.videos.length > 0) {
              combinedResources.videos.push(...resource.videos);
            }
          }
        });
        
        // Deduplicate articles by URL
        const uniqueArticles = Array.from(
          new Map(combinedResources.articles.map((article: any) => [article.url, article])).values()
        );
        
        // Deduplicate videos by URL
        const uniqueVideos = Array.from(
          new Map(combinedResources.videos.map((video: any) => [video.url, video])).values()
        );
        
        // Use up to 5 articles and 3 videos
        allArticles = uniqueArticles.slice(0, 5);
        allVideos = uniqueVideos.slice(0, 3);
        
        console.log(`Summarize API: Found ${allArticles.length} articles and ${allVideos.length} videos`);
      } catch (error) {
        console.error(`Summarize API: Error processing external resources:`, error);
      }
    } else {
      console.log('Summarize API: Using fallback resources (no topics or API key)');
      
      // Provide fallback resources when API key is not available
      if (topics.length > 0) {
        const mainTopic = topics[0];
        
        // Fallback articles
        allArticles = [
          {
            title: `Introduction to ${mainTopic}`,
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(mainTopic.replace(/\s+/g, '_'))}`,
            snippet: `Learn about the fundamentals of ${mainTopic} and how it relates to the lecture content.`
          },
          {
            title: `${mainTopic} - Educational Resources`,
            url: `https://www.khanacademy.org/search?referer=%2F&page_search_query=${encodeURIComponent(mainTopic)}`,
            snippet: `Khan Academy resources related to ${mainTopic} with comprehensive explanations and examples.`
          },
          {
            title: `${mainTopic} Research Papers`,
            url: `https://scholar.google.com/scholar?q=${encodeURIComponent(mainTopic)}`,
            snippet: `Academic research and papers on ${mainTopic} from Google Scholar.`
          }
        ];
        
        // Fallback videos
        allVideos = [
          {
            title: `${mainTopic} - Educational Video`,
            platform: 'YouTube',
            creator: 'Educational Content',
            url: `https://www.youtube.com/results?search_query=${encodeURIComponent(mainTopic)}+lecture`,
            thumbnail: 'https://i.ytimg.com/vi/default/hqdefault.jpg'
          },
          {
            title: `Learn about ${mainTopic}`,
            platform: 'YouTube',
            creator: 'Educational Content',
            url: `https://www.youtube.com/results?search_query=learn+${encodeURIComponent(mainTopic)}`,
            thumbnail: 'https://i.ytimg.com/vi/default/hqdefault.jpg'
          }
        ];
        
        console.log(`Summarize API: Added ${allArticles.length} fallback articles and ${allVideos.length} fallback videos`);
      }
    }

    // Combine everything into the response
    const response = {
      summary: summary || "",
      topics: topics || [],
      keyPoints: keyPointsContent || "",
      sampleQuestions: sampleQuestionsContent || "",
      relatedArticles: relatedArticles || [],
      additionalResources: additionalResources || [],
      resources: {
        articles: allArticles,
        videos: allVideos
      }
    };
    
    // Log the resources to debug
    console.log('Summarize API: Response resources:', {
      articlesCount: response.resources.articles.length,
      videosCount: response.resources.videos.length,
      additionalResourcesCount: additionalResources.length
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Summarize API: Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'An unexpected error occurred',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
