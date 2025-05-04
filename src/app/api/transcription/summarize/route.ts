import { NextResponse } from 'next/server';
import { getOpenAIInstance, generateChatCompletion, parseJsonResponse } from '../../../../utils/openai';
import { getVectorStore } from '../../../../utils/vectorStore';
import { ArticlePg } from '../../../../models/postgres/Article';

// Function to fetch real search results for a topic
async function fetchRealResourcesForTopic(topic: string) {
  try {
    // Use the web search API to get real, current results
    const searchQuery = `${topic} educational resources`;
    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=5&responseFilter=Webpages,Videos`, {
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
          .slice(0, 3)
          .map((page: any) => ({
            title: page.name,
            url: page.url,
            snippet: page.snippet
          }))
      : [];
    
    // Extract videos
    const videos = data.videos?.value
      ? data.videos.value
          .slice(0, 2)
          .filter((video: any) => video.hostPageUrl && video.hostPageUrl.includes('youtube.com'))
          .map((video: any) => {
            // Extract video ID for YouTube videos
            try {
              const url = new URL(video.hostPageUrl);
              const videoId = url.searchParams.get('v');
              
              return {
                title: video.name,
                platform: 'YouTube',
                creator: video.publisher?.[0]?.name || 'YouTube Creator',
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
          content: "Extract 2-3 key topics from the lecture as a JSON array of strings. Format your response as: [\"topic1\", \"topic2\", \"topic3\"]"
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
      
      // Limit to 2 topics maximum for faster processing
      topics = topics.slice(0, 2);
      
      console.log('Summarize API: Parsed topics:', topics);
    } catch (error) {
      console.error('Summarize API: Error parsing topics:', error);
      // Continue with empty topics array
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
    
    // Start fetching external resources in parallel with database search
    let externalResourcesPromise: Promise<any> = Promise.resolve(null);
    if (topics.length > 0 && process.env.BING_SEARCH_API_KEY) {
      const externalResourceTopic = topics[0];
      externalResourcesPromise = fetchRealResourcesForTopic(externalResourceTopic).catch(error => {
        console.error(`Summarize API: Error fetching real resources:`, error);
        return null;
      });
    }
    
    // Wait for external resources to complete
    const realResources = await externalResourcesPromise;
    if (realResources) {
      // Limit resources to reduce response size
      const limitedResources = {
        articles: realResources.articles?.slice(0, 2) || [],
        videos: realResources.videos?.slice(0, 1) || []
      };
      
      additionalResources.push(limitedResources);
      console.log(`Summarize API: Added external resources`);
    }

    // Combine everything into the response
    const response = {
      summary,
      topics,
      relatedArticles,
      additionalResources
    };

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
