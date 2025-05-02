import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { 
  checkDatabaseConnection, 
  performVectorSearch, 
  getArticleById 
} from '@/lib/db';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Simple in-memory cache for chat responses
interface CacheEntry {
  response: string;
  sources: any[];
  timestamp: number;
}

const chatCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes cache TTL

// Generate a cache key from request parameters
function generateCacheKey(query: string, userType: string): string {
  return `${query}_${userType}`;
}

/**
 * POST /api/chat
 * Process a chat query using vector search and OpenAI
 */
export async function POST(request: NextRequest) {
  try {
    const { query, userType, messages, context } = await request.json();

    // Handle lecture-specific chat if context is provided
    if (context) {
      return handleLectureChat(messages, context);
    }

    // Regular chat processing for non-lecture queries
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    console.log('Starting chat API request');
    console.log(`Chat query: "${query}", User type: ${userType}`);
    
    // Check cache first
    const now = Date.now();
    const cacheKey = generateCacheKey(query, userType);
    
    if (chatCache.has(cacheKey)) {
      const cachedResult = chatCache.get(cacheKey)!;
      
      // Check if the cache is still valid
      if (now - cachedResult.timestamp < CACHE_TTL) {
        console.log('Returning cached response');
        return NextResponse.json({
          response: cachedResult.response,
          sources: cachedResult.sources,
          fromCache: true
        });
      } else {
        console.log('Cache expired, generating new response');
        chatCache.delete(cacheKey);
      }
    }
    
    console.log('Cache miss. Generating new chat response.');
    
    // Check database connection
    const isConnected = await checkDatabaseConnection();
    console.log('Database connection status:', isConnected);

    // Generate embeddings for the query
    const embedding = await generateEmbedding(query);

    // Get relevant chunks from the database
    const chunks = await performVectorSearch(embedding, 5);
    console.log(`Found ${chunks.length} relevant chunks`);

    // Generate AI response
    const aiResponse = await generateAIResponse(query, chunks, userType);

    // Get article details for the chunks
    const articleIds = Array.from(new Set(chunks.map(chunk => chunk.article_id)));
    const articles = [];
    
    for (const articleId of articleIds) {
      const article = await getArticleById(articleId);
      if (article) {
        articles.push({
          title: article.title,
          source: article.source,
          url: article.url,
          author: article.author,
          publishedDate: article.published_date
        });
      }
    }

    // Cache the result
    chatCache.set(cacheKey, {
      response: aiResponse,
      sources: articles,
      timestamp: now
    });

    return NextResponse.json({
      response: aiResponse,
      sources: articles,
      fromCache: false
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Generate embeddings using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    // Return a zero vector as fallback
    return Array(1536).fill(0);
  }
}

/**
 * Generate AI response using OpenAI
 */
async function generateAIResponse(query: string, chunks: any[], userType: string): Promise<string> {
  try {
    // Prepare context from chunks
    const context = chunks.map(chunk => chunk.content).join("\n\n");

    // Prepare system message based on user type
    let systemMessage = '';
    
    if (userType === 'gp') {
      systemMessage = `You are a helpful medical assistant. Answer the user's question based on the provided medical literature. 
      If the information is not in the provided context, say that you don't have enough information and provide a general response based on your knowledge.
      Always cite your sources when you use information from the provided context.`;
    } else if (userType === 'school') {
      systemMessage = `You are a helpful teaching assistant. Answer the student's question based on the provided educational material.
      If the information is not in the provided context, say that you don't have enough information and provide a general response based on your knowledge.
      Always cite your sources when you use information from the provided context.`;
    } else {
      systemMessage = `You are a helpful assistant. Answer the user's question based on the provided information.
      If the information is not in the provided context, say that you don't have enough information and provide a general response based on your knowledge.
      Always cite your sources when you use information from the provided context.`;
    }

    // Generate response using OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Context information is below.\n\n${context}\n\nGiven the context information and not prior knowledge, answer the query: ${query}` }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    return response.choices[0].message.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Error generating AI response:', error);
    return 'Sorry, there was an error generating a response. Please try again.';
  }
}

/**
 * Handle lecture-specific chat questions
 */
async function handleLectureChat(messages: any[], context: any) {
  try {
    // Get the last user message
    const lastUserMessage = messages.findLast(m => m.role === 'user')?.content || '';
    
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: 'No user message found' },
        { status: 400 }
      );
    }

    // Extract context information
    const { summary, topics, topicResources } = context;
    
    // Create a context string from the lecture information
    const contextString = `
LECTURE SUMMARY:
${summary}

KEY TOPICS:
${topics.join(', ')}

TOPIC DETAILS:
${topicResources.map((resource: any) => 
  `Topic: ${resource.topic}
   Description: ${resource.description}
   Resources: ${resource.videos.length} videos, ${resource.articles.length} articles
  `).join('\n')}
`;

    // Generate response using OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a helpful educational assistant answering questions about a lecture. 
          Use the following lecture context to inform your answers. 
          Be concise, accurate, and helpful. If you don't know the answer based on the context, 
          say so and suggest resources the user might want to check.
          
          ${contextString}`
        },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    return NextResponse.json({
      response: aiResponse
    });
  } catch (error) {
    console.error('Error handling lecture chat:', error);
    return NextResponse.json(
      { error: 'Failed to process lecture chat' },
      { status: 500 }
    );
  }
}
