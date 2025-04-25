import { OpenAI } from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embeddings for a given text
 * @param text The text to generate embeddings for
 * @returns An array of numbers representing the embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use OpenAI to generate embeddings
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Return a zero vector as fallback in case of error
    return Array(1536).fill(0);
  }
}
