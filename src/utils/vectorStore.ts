import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

// Import PostgreSQL connection pool
import { pool } from './postgres';

// Detect build environment
const isBuildTime = process.env.NODE_ENV === 'production' && 
                   (process.env.NETLIFY === 'true' || process.env.VERCEL_ENV === 'production') && 
                   process.env.NEXT_PHASE === 'phase-production-build';

// Define the result type for similarity search
interface SimilaritySearchResult {
  pageContent: string;
  metadata: {
    id: number;
    articleId: number;
    chunkIndex: number;
    similarity: number;
  };
}

// Define the interface for the vector store configuration
interface PGVectorStoreConfig {
  tableName: string;
  columns: {
    idColumn: string;
    vectorColumn: string;
    contentColumn: string;
    metadataColumn: string;
  };
}

// Create a dummy query result for build time
const createDummyQueryResult = () => {
  return {
    rows: [],
    command: '',
    rowCount: 0,
    oid: 0,
    fields: []
  };
};

let vectorStore: PGVectorStore | null = null;

export async function getVectorStore(): Promise<PGVectorStore> {
  if (vectorStore) {
    return vectorStore;
  }

  try {
    // For build time, return a dummy vector store
    if (isBuildTime) {
      console.log('Using dummy vector store for build time');
      return new PGVectorStore(
        {
          query: () => Promise.resolve(createDummyQueryResult())
        },
        {
          tableName: "article_embeddings",
          columns: {
            idColumn: "id",
            vectorColumn: "embedding",
            contentColumn: "content",
            metadataColumn: "metadata",
          },
        },
        new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
        })
      );
    }

    // Initialize the OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize the PGVector store
    vectorStore = new PGVectorStore(
      pool,
      {
        tableName: "article_embeddings",
        columns: {
          idColumn: "id",
          vectorColumn: "embedding",
          contentColumn: "content",
          metadataColumn: "metadata",
        },
      },
      embeddings
    );

    return vectorStore;
  } catch (error) {
    console.error('Error initializing vector store:', error);
    
    // Return a dummy vector store on error
    return new PGVectorStore(
      {
        query: () => Promise.resolve(createDummyQueryResult())
      },
      {
        tableName: "article_embeddings",
        columns: {
          idColumn: "id",
          vectorColumn: "embedding",
          contentColumn: "content",
          metadataColumn: "metadata",
        },
      },
      new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-build',
      })
    );
  }
}

// PGVectorStore class implementation
export class PGVectorStore {
  pool: any;
  config: PGVectorStoreConfig;
  embeddings: OpenAIEmbeddings;

  constructor(pool: any, config: PGVectorStoreConfig, embeddings: OpenAIEmbeddings) {
    this.pool = pool;
    this.config = config;
    this.embeddings = embeddings;
  }

  async similaritySearch(query: string, k: number = 4): Promise<SimilaritySearchResult[]> {
    try {
      // Skip actual search during build time
      if (isBuildTime) {
        console.log('Skipping similarity search during build time');
        return [];
      }

      // Generate embedding for the query
      const embedding = await this.embeddings.embedQuery(query);
      
      // Execute the similarity search query
      const result = await this.pool.query(
        `SELECT 
          id, 
          article_id, 
          chunk_index, 
          content, 
          1 - (embedding <=> $1) as similarity
        FROM ${this.config.tableName}
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1
        LIMIT $2`,
        [embedding, k]
      );

      // Map the results to the expected format
      return result.rows.map((row: any) => ({
        pageContent: row.content,
        metadata: {
          id: row.id,
          articleId: row.article_id,
          chunkIndex: row.chunk_index,
          similarity: row.similarity
        }
      }));
    } catch (error) {
      console.error('Error in similarity search:', error);
      return [];
    }
  }
}
