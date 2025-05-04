import { NextResponse } from 'next/server';
import { getOpenAIInstance, generateChatCompletion, parseJsonResponse } from '../../../../utils/openai';
import { getVectorStore } from '../../../../utils/vectorStore';
import { ArticlePg } from '../../../../models/postgres/Article';

// Function to fetch real search results for a topic
async function fetchRealResourcesForTopic(topic: string) {
  try {
    // Use the web search API to get real, current results
    const searchQuery = `${topic} educational resources`;
    const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(searchQuery)}&count=15&responseFilter=Webpages,Videos`, {
      headers: {
        'Ocp-Apim-Subscription-Key': process.env.BING_SEARCH_API_KEY || '',
      }
    });

    if (!response.ok) {
      console.error(`Search API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Extract and verify videos
    let validVideos = [];
    if (data.videos?.value) {
      // Get more videos than needed in case some are unavailable
      const videoResults = data.videos.value.slice(0, 6);
      
      // Process videos in parallel
      const videoPromises = videoResults.map(async (video: any) => {
        // Check if it's a YouTube video
        if (video.hostPageUrl && video.hostPageUrl.includes('youtube.com')) {
          try {
            // Extract video ID
            const url = new URL(video.hostPageUrl);
            const videoId = url.searchParams.get('v');
            
            if (videoId) {
              // Check if video exists using YouTube oEmbed API
              const checkUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
              const checkResponse = await fetch(checkUrl);
              
              // If response is ok, video exists
              if (checkResponse.ok) {
                return {
                  title: video.name,
                  platform: 'YouTube',
                  creator: video.publisher?.[0]?.name || 'YouTube Creator',
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                  thumbnail: video.thumbnailUrl,
                  verified: true
                };
              }
            }
          } catch (error) {
            console.error('Error checking video availability:', error);
          }
          return null;
        }
        
        // For non-YouTube videos, include them but mark as unverified
        return {
          title: video.name,
          platform: video.hostPageDisplayUrl?.split('.')?.[1] || 'Video Platform',
          creator: video.publisher?.[0]?.name || 'Content Creator',
          url: video.contentUrl || video.hostPageUrl,
          thumbnail: video.thumbnailUrl,
          verified: false
        };
      });
      
      // Wait for all video checks to complete
      const checkedVideos = await Promise.all(videoPromises);
      
      // Filter out null results and take up to 3 videos
      validVideos = checkedVideos
        .filter(v => v !== null)
        .slice(0, 3);
    }
    
    // Extract articles
    const articles = data.webPages?.value?.slice(0, 3).map((page: any) => {
      try {
        const hostname = new URL(page.url).hostname.replace('www.', '');
        return {
          title: page.name,
          publisher: hostname,
          url: page.url,
          snippet: page.snippet
        };
      } catch (error) {
        return {
          title: page.name,
          publisher: 'Online Resource',
          url: page.url,
          snippet: page.snippet
        };
      }
    }) || [];

    return {
      videos: validVideos,
      articles
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

    console.log('Summarize API: Text received, length:', text.length);

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
          content: "You are an expert educational assistant that helps summarize lecture content and provide additional learning resources."
        },
        {
          role: "user",
          content: `Please summarize the following lecture transcript and identify 3-5 key topics for further exploration:
          
  ${text}`
        }
      ], {
        model: "gpt-4",
        temperature: 0.5,
        max_tokens: 1000
      });
      
      console.log('Summarize API: Summary generated successfully');
    } catch (error) {
      console.error('Summarize API: Error generating summary:', error);
      return NextResponse.json(
        { 
          error: 'Failed to generate summary',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

    console.log('Summarize API: Extracting key topics');
    
    // Extract key topics for deep dive
    let topicsContent;
    try {
      topicsContent = await generateChatCompletion([
        {
          role: "system",
          content: "Extract 3-5 key topics from the lecture summary as a JSON array of strings. Only respond with the JSON array."
        },
        {
          role: "user",
          content: summary
        }
      ], {
        model: "gpt-3.5-turbo",
        temperature: 0.3,
        max_tokens: 200
      });
      
      console.log('Summarize API: Topics extracted successfully');
    } catch (error) {
      console.error('Summarize API: Error extracting topics:', error);
      return NextResponse.json(
        { 
          error: 'Failed to extract topics',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
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
      
      console.log('Summarize API: Parsed topics:', topics);
    } catch (error) {
      console.error('Summarize API: Error parsing topics:', error);
      // Continue with empty topics array
    }

    // Search for related articles in our database
    let vectorStore;
    try {
      console.log('Summarize API: Getting vector store');
      vectorStore = await getVectorStore();
      console.log('Summarize API: Vector store initialized successfully');
    } catch (error) {
      console.error('Summarize API: Error getting vector store:', error);
      return NextResponse.json(
        { 
          error: 'Failed to initialize vector store',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }
    
    // Define an interface for the article type
    interface RelatedArticle {
      id: string | number;  
      title: string;
      url?: string;
      source?: string;
      snippet?: string;
      similarity?: number;
      abstract?: string;
      journal?: string;
      authors?: string[];
      publicationDate?: Date;
    }
    
    const relatedArticles: RelatedArticle[] = [];

    console.log('Summarize API: Searching for related articles');
    
    for (const topic of topics) {
      try {
        // Search for related articles using vector similarity
        console.log(`Summarize API: Searching for topic: "${topic}"`);
        const results = await vectorStore.similaritySearch(topic, 2);
        
        if (results && results.length > 0) {
          console.log(`Summarize API: Found ${results.length} results for topic "${topic}"`);
          
          for (const result of results) {
            try {
              // Check if this article is already in our list to avoid duplicates
              const isDuplicate = relatedArticles.some(article => article.id === result.metadata.id);
              
              if (!isDuplicate) {
                // Get the full article from the database
                console.log(`Summarize API: Getting article with ID ${result.metadata.id}`);
                const article = await ArticlePg.findById(result.metadata.id);
                
                if (article) {
                  relatedArticles.push({
                    id: article.id,
                    title: article.title,
                    url: article.url,
                    source: article.source,
                    snippet: article.content.substring(0, 200) + '...',
                    similarity: result.metadata.similarity
                  });
                  console.log(`Summarize API: Added article "${article.title}" to related articles`);
                } else {
                  console.log(`Summarize API: Article with ID ${result.metadata.id} not found in database`);
                }
              } else {
                console.log(`Summarize API: Skipping duplicate article with ID ${result.metadata.id}`);
              }
            } catch (error) {
              console.error(`Summarize API: Error processing result:`, error);
              // Continue with next result
            }
          }
          
          // Limit to 5 articles total
          if (relatedArticles.length >= 5) {
            console.log('Summarize API: Reached maximum of 5 related articles, stopping search');
            break;
          }
        } else {
          console.log(`Summarize API: No results found for topic "${topic}"`);
        }
      } catch (error) {
        console.error(`Summarize API: Error searching for topic "${topic}":`, error);
        // Continue with next topic
      }
    }

    // For each topic, get additional resources from OpenAI and real web search
    const resourcesPromises = topics.map(async (topic) => {
      // Get topic description from OpenAI
      const descriptionContent = await generateChatCompletion([
        {
          role: "system",
          content: `Write a brief description (2-3 sentences) of the topic "${topic}" as it relates to environmental science or climate change.`
        },
        {
          role: "user",
          content: `Describe: ${topic}`
        }
      ], {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 200
      });

      // Try to fetch real resources from the web
      const realResources = process.env.BING_SEARCH_API_KEY 
        ? await fetchRealResourcesForTopic(topic)
        : null;
      
      // If we have real resources, use them
      if (realResources) {
        // Get book recommendation from OpenAI
        const bookContent = await generateChatCompletion([
          {
            role: "system",
            content: `Recommend one current, well-regarded book about "${topic}" related to environmental science or climate change. Respond in JSON format: {"title": "book title", "author": "author name", "year": "publication year (recent)"}`
          },
          {
            role: "user",
            content: `Book recommendation for: ${topic}`
          }
        ], {
          model: "gpt-3.5-turbo",
          temperature: 0.7,
          max_tokens: 200
        });
        
        const defaultBook = {
          title: "Understanding Climate Change",
          author: "Various Authors",
          year: "2023"
        };
        
        const book = parseJsonResponse(bookContent, defaultBook);
        
        return {
          topic,
          description: descriptionContent,
          videos: realResources.videos,
          articles: realResources.articles,
          book
        };
      }
      
      // Fallback to OpenAI-generated resources if web search fails
      const resourcesContent = await generateChatCompletion([
        {
          role: "system",
          content: `Generate a JSON object with educational resources for the topic "${topic}". Include:
          1. A brief description (2-3 sentences)
          2. 2-3 recommended videos (title, platform, creator name, and a URL)
          3. 2-3 recommended articles (title, publisher, and a URL)
          4. 1 book recommendation (title, author, year)
          
          Format as valid JSON with the structure:
          {
            "topic": "topic name",
            "description": "brief description",
            "videos": [{"title": "video title", "platform": "YouTube/Vimeo/etc", "creator": "creator name", "url": "url"}],
            "articles": [{"title": "article title", "publisher": "publisher name", "url": "url"}],
            "book": {"title": "book title", "author": "author name", "year": "publication year"}
          }
          
          IMPORTANT: Only include REAL, CURRENT resources that are likely to exist and be available online.`
        },
        {
          role: "user",
          content: `Generate educational resources for: ${topic}`
        }
      ], {
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 500
      });

      const fallback = {
        topic,
        description: descriptionContent || "Additional resources unavailable",
        videos: [],
        articles: [],
        book: null
      };
      
      return parseJsonResponse(resourcesContent, fallback);
    });

    const topicResources = await Promise.all(resourcesPromises);

    // Combine everything into the response
    const response = {
      summary,
      topics,
      relatedArticles,
      topicResources
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error in summarize API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to summarize',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
