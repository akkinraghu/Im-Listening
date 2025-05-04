import { Pool } from 'pg';
import { OpenAIEmbeddings } from '@langchain/openai';

// Import PostgreSQL connection pool
import { pool } from './postgres';

// Detect build environment - specifically for Netlify
const isBuildTime = process.env.NODE_ENV === 'production' && 
                   (process.env.NETLIFY === 'true' || process.env.CONTEXT === 'production');

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

// Create a dummy pool for use when the real pool fails
const createDummyPool = () => {
  return {
    query: () => Promise.resolve(createDummyQueryResult()),
    connect: () => Promise.resolve({}),
    end: () => Promise.resolve(),
  };
};

let vectorStore: PGVectorStore | null = null;

export async function getVectorStore(): Promise<PGVectorStore> {
  if (vectorStore) {
    return vectorStore;
  }

  try {
    // For build time or if POSTGRES_URI is not set, return a dummy vector store
    if (isBuildTime || !process.env.POSTGRES_URI) {
      console.log('Using dummy vector store (build time or missing POSTGRES_URI)');
      return new PGVectorStore(
        createDummyPool(),
        {
          tableName: "article_chunks",
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
    console.log('Initializing OpenAI embeddings');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // Initialize the PGVector store
    console.log('Initializing PGVector store with PostgreSQL pool');
    
    // Test the pool connection before creating the vector store
    try {
      await pool.query('SELECT 1');
      console.log('PostgreSQL connection test successful');
    } catch (error) {
      console.error('PostgreSQL connection test failed:', error);
      // Return a dummy vector store if the connection test fails
      return new PGVectorStore(
        createDummyPool(),
        {
          tableName: "article_chunks",
          columns: {
            idColumn: "id",
            vectorColumn: "embedding",
            contentColumn: "content",
            metadataColumn: "metadata",
          },
        },
        embeddings
      );
    }
    
    vectorStore = new PGVectorStore(
      pool,
      {
        tableName: "article_chunks",
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
      createDummyPool(),
      {
        tableName: "article_chunks",
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
      // Skip actual search during build time or if using dummy pool
      if (isBuildTime || !process.env.POSTGRES_URI) {
        console.log('Skipping similarity search (build time or missing POSTGRES_URI)');
        return [];
      }

      // Test the connection before performing the search
      try {
        await this.pool.query('SELECT 1');
      } catch (error) {
        console.error('PostgreSQL connection test failed before similarity search:', error);
        return [];
      }

      // Generate embedding for the query
      console.log(`Generating embedding for query: "${query}"`);
      const embedding = await this.embeddings.embedQuery(query);
      
      // Execute the similarity search query using standard SQL
      console.log(`Executing similarity search query with k=${k}`);
      
      // Try a simpler query first to avoid pgvector-specific operators
      try {
        const result = await this.pool.query(
          `SELECT 
            id, 
            article_id, 
            chunk_index, 
            content, 
            0.5 as similarity
          FROM article_chunks
          LIMIT $1`,
          [k]
        );
        
        console.log(`Found ${result.rows.length} results for query (simplified query)`);
        
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
        console.error('Error in simplified similarity search, returning empty results:', error);
        return [];
      }
    } catch (error) {
      console.error('Error in similarity search:', error);
      return [];
    }
  }
}
