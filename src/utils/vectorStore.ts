import { Pool } from 'pg';
import { OpenAIEmbeddings } from './openai';

// Import PostgreSQL connection pool
import { pool } from './postgres';

// Define the result type for similarity search
interface SimilaritySearchResult {
  pageContent: string;
  metadata: any;
  score?: number;
}

// Define the vector store configuration
interface PGVectorStoreConfig {
  tableName: string;
  columns: {
    idColumn: string;
    vectorColumn: string;
    contentColumn: string;
    metadataColumn: string;
  };
}

let vectorStore: PGVectorStore | null = null;

export async function getVectorStore(): Promise<PGVectorStore> {
  if (vectorStore) {
    return vectorStore;
  }

  try {
    // Initialize the OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize the PGVector store
    vectorStore = new PGVectorStore(
      pool,
      {
        tableName: 'article_embeddings',
        columns: {
          idColumn: 'id',
          vectorColumn: 'embedding',
          contentColumn: 'content',
          metadataColumn: 'metadata',
        },
      },
      embeddings
    );

    return vectorStore;
  } catch (error) {
    console.error('Error initializing vector store:', error);
    throw new Error('Failed to initialize vector store');
  }
}

export class PGVectorStore {
  private pool: Pool;
  private tableName: string;
  private columns: {
    idColumn: string;
    vectorColumn: string;
    contentColumn: string;
    metadataColumn: string;
  };
  private embeddings: OpenAIEmbeddings;

  constructor(
    pool: Pool,
    config: PGVectorStoreConfig,
    embeddings: OpenAIEmbeddings
  ) {
    this.pool = pool;
    this.tableName = config.tableName;
    this.columns = config.columns;
    this.embeddings = embeddings;
  }

  async similaritySearch(query: string, k: number = 4): Promise<SimilaritySearchResult[]> {
    try {
      // Generate embedding for the query
      const embedding = await this.embeddings.embedQuery(query);
      
      // Perform similarity search using cosine distance
      const result = await this.pool.query(
        `SELECT 
          ${this.columns.idColumn}, 
          ${this.columns.contentColumn}, 
          ${this.columns.metadataColumn},
          1 - (${this.columns.vectorColumn} <=> $1) as similarity
        FROM ${this.tableName}
        ORDER BY similarity DESC
        LIMIT $2`,
        [embedding, k]
      );

      // Format the results
      return result.rows.map((row: any) => ({
        pageContent: row[this.columns.contentColumn],
        metadata: row[this.columns.metadataColumn],
        score: row.similarity
      }));
    } catch (error) {
      console.error('Error in similarity search:', error);
      return [];
    }
  }
}
