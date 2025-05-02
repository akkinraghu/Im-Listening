import OpenAI from 'openai';

// Singleton instance
let openaiInstance: OpenAI | null = null;

/**
 * Get the OpenAI client instance (singleton)
 */
export function getOpenAIInstance(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable.');
    }

    openaiInstance = new OpenAI({
      apiKey,
    });
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
  const openai = getOpenAIInstance();
  
  const { model = 'gpt-3.5-turbo', temperature = 0.7, max_tokens = 500 } = options;
  
  const response = await openai.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });
  
  return response.choices[0]?.message?.content || '';
}

/**
 * Parse JSON from an OpenAI response, with fallback handling
 */
export function parseJsonResponse<T>(content: string, fallback: T): T {
  try {
    return JSON.parse(content) as T;
  } catch (e) {
    console.error('Failed to parse JSON from OpenAI response:', e);
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
