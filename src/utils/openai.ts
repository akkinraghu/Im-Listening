import OpenAI from 'openai';

// Detect build environment - specifically for Netlify
const isBuildTime = process.env.NETLIFY === 'true' || 
                   process.env.CONTEXT === 'production' || 
                   process.env.CONTEXT === 'deploy-preview' ||
                   process.env.CONTEXT === 'branch-deploy';

// Singleton instance
let openaiInstance: OpenAI | null = null;

/**
 * Get the OpenAI client instance (singleton)
 */
export function getOpenAIInstance(): OpenAI {
  // Skip actual OpenAI initialization during build time
  if (isBuildTime) {
    console.log('OpenAI: Using mock instance during build time');
    return {
      chat: {
        completions: {
          create: () => Promise.resolve({ choices: [{ message: { content: 'Build time mock response' } }] })
        }
      }
    } as unknown as OpenAI;
  }

  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI: API key is missing');
      throw new Error('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable.');
    }

    try {
      console.log('OpenAI: Initializing client');
      openaiInstance = new OpenAI({
        apiKey,
      });
      console.log('OpenAI: Client initialized successfully');
    } catch (error) {
      console.error('OpenAI: Error initializing client:', error);
      throw new Error(`Failed to initialize OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return openaiInstance;
}

/**
 * Generate a chat completion using OpenAI
 */
export async function generateChatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
) {
  try {
    console.log(`OpenAI: Generating chat completion with model ${options.model || 'gpt-3.5-turbo'}`);
    
    // Skip actual API calls during build time
    if (isBuildTime) {
      console.log('OpenAI: Returning mock response during build time');
      return 'Build time mock response';
    }
    
    const openai = getOpenAIInstance();
    
    const { model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 500 } = options;
    
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
    });
    
    if (!response.choices || response.choices.length === 0) {
      console.error('OpenAI: No choices returned in response');
      throw new Error('No response choices returned from OpenAI');
    }
    
    const content = response.choices[0].message.content;
    
    if (!content) {
      console.error('OpenAI: Empty content returned');
      throw new Error('Empty content returned from OpenAI');
    }
    
    console.log(`OpenAI: Successfully generated content (${content.length} chars)`);
    return content;
  } catch (error) {
    console.error('OpenAI: Error generating chat completion:', error);
    
    // Check for specific OpenAI API errors
    if (error instanceof OpenAI.APIError) {
      console.error('OpenAI API Error:', {
        status: error.status,
        message: error.message,
        type: error.type,
        code: error.code
      });
      
      // Handle rate limiting
      if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      
      // Handle authentication errors
      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check your API key and try again.');
      }
    }
    
    throw new Error(`Failed to generate chat completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse JSON from an OpenAI response, with fallback handling
 */
export function parseJsonResponse<T>(content: string, fallback: T): T {
  try {
    // Try to find JSON in the response
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    
    // If no JSON object/array found, try parsing the whole string
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn('Failed to parse JSON from OpenAI response:', error);
    console.warn('Content that failed to parse:', content);
    return fallback;
  }
}

interface OpenAIEmbeddingsConfig {
  openAIApiKey?: string;
  modelName?: string;
}

export class OpenAIEmbeddings {
  private openai: OpenAI;
  private modelName: string;

  constructor(config: OpenAIEmbeddingsConfig) {
    const apiKey = config.openAIApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.openai = new OpenAI({
      apiKey,
    });
    this.modelName = config.modelName || 'text-embedding-ada-002';
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: this.modelName,
        input: text,
      });

      if (!response.data[0]?.embedding) {
        throw new Error('No embedding returned from OpenAI API');
      }

      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    if (documents.length === 0) {
      return [];
    }
    
    try {
      const response = await this.openai.embeddings.create({
        model: this.modelName,
        input: documents,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embeddings returned from OpenAI API');
      }

      return response.data.map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      console.error('Error generating embeddings for documents:', error);
      throw new Error('Failed to generate embeddings for documents');
    }
  }
}
