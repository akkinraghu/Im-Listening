import { Pool } from 'pg';
import pgvector from 'pgvector/pg';

// Register pgvector with pg
pgvector.registerType({ pg: Pool });

// Create a singleton database connection
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URI || 'postgres://postgres:example@postgres:5432/im_listening';
    
    pool = new Pool({
      connectionString,
    });
    
    // Log connection status
    pool.on('connect', () => {
      console.log('Connected to PostgreSQL database');
    });
    
    pool.on('error', (err: Error) => {
      console.error('PostgreSQL connection error:', err);
    });
  }
  
  return pool;
}

// Function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW()');
      console.log('Database connection successful:', result.rows[0]);
      return true;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Function to check if vector extension is enabled
export async function checkVectorExtension(): Promise<boolean> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      const isEnabled = result.rows.length > 0;
      console.log('Vector extension enabled:', isEnabled);
      return isEnabled;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error checking vector extension:', error);
    return false;
  }
}

// Function to perform vector search
export async function performVectorSearch(embedding: number[], limit: number = 5): Promise<any[]> {
  try {
    console.log('Starting vector search with embedding of length:', embedding.length);
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      // Check if vector extension is enabled
      const vectorEnabled = await checkVectorExtension();
      if (!vectorEnabled) {
        console.log('Vector extension not enabled, falling back to text search');
        return await performTextSearch(limit);
      }
      
      // Use direct vector search query instead of stored procedure
      const result = await client.query(`
        SELECT 
          ac.id,
          ac.article_id,
          ac.chunk_index,
          ac.content,
          ac.embedding <=> $1::vector AS similarity
        FROM 
          article_chunks ac
        WHERE
          ac.embedding IS NOT NULL
        ORDER BY 
          ac.embedding <=> $1::vector
        LIMIT $2;
      `, [JSON.stringify(embedding), limit]);
      
      console.log(`Vector search returned ${result.rows.length} results`);
      
      if (result.rows.length > 0) {
        console.log('First result article ID:', result.rows[0].article_id);
        console.log('First result similarity score:', result.rows[0].similarity);
        return result.rows;
      } else {
        console.log('No results from vector search, falling back to text search');
        return await performTextSearch(limit);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in vector search:', error);
    return [];
  }
}

// Function to perform text search as fallback
export async function performTextSearch(limit: number = 5): Promise<any[]> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      // Get random samples from the article_chunks table
      const result = await client.query(
        'SELECT id, article_id, chunk_index, content FROM article_chunks ORDER BY RANDOM() LIMIT $1',
        [limit]
      );
      
      console.log(`Text search returned ${result.rows.length} random results`);
      return result.rows;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in text search:', error);
    return [];
  }
}

// Function to get article details by ID
export async function getArticleById(articleId: number): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM articles WHERE id = $1',
        [articleId]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting article by ID:', error);
    return null;
  }
}

// Function to get transcription by ID
export async function getTranscriptionById(id: number): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM transcriptions WHERE id = $1',
        [id]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting transcription by ID:', error);
    return null;
  }
}

// Function to create a new transcription
export async function createTranscription(transcription: { text: string, user_id?: string, user_type?: string, purpose?: string, metadata?: any }): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO transcriptions 
         (text, user_id, user_type, purpose, metadata) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [
          transcription.text,
          transcription.user_id || null,
          transcription.user_type || null,
          transcription.purpose || null,
          transcription.metadata ? JSON.stringify(transcription.metadata) : null
        ]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating transcription:', error);
    return null;
  }
}

// Function to get user by ID
export async function getUserById(id: number): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

// Function to get user by email
export async function getUserByEmail(email: string): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

// Function to create a new user
export async function createUser(user: { name: string, email: string, image?: string, email_verified?: Date }): Promise<any | null> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO users 
         (name, email, image, email_verified) 
         VALUES ($1, $2, $3, $4) 
         RETURNING *`,
        [
          user.name,
          user.email,
          user.image || null,
          user.email_verified || null
        ]
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      } else {
        return null;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}
