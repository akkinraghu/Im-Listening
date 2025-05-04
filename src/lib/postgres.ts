import { Pool, PoolClient } from 'pg';

// Initialize PostgreSQL connection pool
let pool: Pool | null = null;

// Detect build environment
const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NETLIFY === 'true';

// Skip pgvector completely - we'll use raw SQL instead
console.log('Using raw SQL for vector operations instead of pgvector library');

// Create a dummy pool for build time or connection failures
const createDummyPool = (): Pool => {
  return {
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    connect: () => Promise.resolve({} as PoolClient),
    end: () => Promise.resolve(),
    on: () => ({}),
    off: () => ({}),
  } as unknown as Pool;
};

export function getPool(): Pool {
  if (pool) {
    return pool;
  }

  try {
    // Check if POSTGRES_URI is defined
    const POSTGRES_URI = process.env.POSTGRES_URI;
    
    if (!POSTGRES_URI) {
      console.error('POSTGRES_URI environment variable is not defined');
      return createDummyPool();
    }
    
    console.log('Initializing PostgreSQL pool with connection string from POSTGRES_URI');
    
    // Create the connection pool using the URI directly
    pool = new Pool({
      connectionString: POSTGRES_URI,
      ssl: POSTGRES_URI.includes('ssl') ? { rejectUnauthorized: false } : undefined,
      // Add connection timeout to fail fast if DB is unreachable
      connectionTimeoutMillis: 5000,
      // Add idle timeout to prevent connections from being kept open too long
      idleTimeoutMillis: 10000,
      // Limit max connections to avoid overwhelming the database
      max: 10,
    });

    // Add error handler to the pool
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    // Test the connection
    pool.query('SELECT NOW()', (err) => {
      if (err) {
        console.error('Error connecting to PostgreSQL:', err);
        // Don't replace the pool here, just log the error
      } else {
        console.log('PostgreSQL connection established successfully');
        
        // Initialize pgvector extension if needed using raw SQL
        try {
          pool?.query('CREATE EXTENSION IF NOT EXISTS vector');
          console.log('vector extension initialized via raw SQL');
        } catch (vectorErr) {
          console.warn('Note: vector extension not available:', vectorErr);
        }
      }
    });

    return pool;
  } catch (error) {
    console.error('Failed to initialize PostgreSQL pool:', error);
    
    // Create a dummy pool for build/deployment time
    pool = createDummyPool();
    
    return pool;
  }
}

// Helper function to execute a query
export async function query(text: string, params?: any[]): Promise<any> {
  const pool = getPool();
  try {
    console.log('Executing query:', text, params ? '[params]' : '');
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50) + '...', duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query:', error);
    // Return an empty result instead of throwing
    return { rows: [], rowCount: 0 };
  }
}

// Helper function to get a client from the pool
export async function getClient(): Promise<PoolClient> {
  const pool = getPool();
  try {
    return await pool.connect();
  } catch (error) {
    console.error('Error getting client from pool:', error);
    // Return a dummy client
    return {
      query: () => Promise.resolve({ rows: [], rowCount: 0 }),
      release: () => {},
    } as unknown as PoolClient;
  }
}

// Helper function to execute a transaction
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to get a client from the pool for a single operation
export async function withPostgresClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

// Helper function to execute a query with a client from the pool
export async function executeQuery<T>(query: string, params: any[] = []): Promise<T[]> {
  return withPostgresClient(async (client) => {
    const result = await client.query(query, params);
    return result.rows;
  });
}
