import { Pool, PoolClient, QueryResult, QueryConfig } from 'pg';

// Initialize PostgreSQL connection pool
let pool: Pool;

try {
  // Check if POSTGRES_URI is defined
  const POSTGRES_URI = process.env.POSTGRES_URI;
  
  if (!POSTGRES_URI) {
    console.error('POSTGRES_URI environment variable is not defined');
    throw new Error('POSTGRES_URI environment variable is required');
  }
  
  console.log('Initializing PostgreSQL pool with connection string from POSTGRES_URI');
  
  // Create the connection pool using the URI directly
  pool = new Pool({
    connectionString: POSTGRES_URI,
    ssl: POSTGRES_URI.includes('ssl') ? { rejectUnauthorized: false } : undefined,
  });

  // Test the connection
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.error('Error connecting to PostgreSQL:', err);
    } else {
      console.log('PostgreSQL connection established successfully');
      
      // Initialize pgvector extension if needed
      try {
        pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('pgvector extension initialized');
      } catch (vectorErr) {
        console.warn('Note: pgvector extension not available:', vectorErr);
      }
    }
  });
} catch (error) {
  console.error('Failed to initialize PostgreSQL pool:', error);
  // Create a dummy pool for build/deployment time
  pool = {
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    connect: () => Promise.resolve({} as PoolClient),
    end: () => Promise.resolve(),
  } as unknown as Pool;
}

export { pool };

// Helper function to execute a query
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  try {
    console.log('Executing query:', text, params);
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
}

// Add lastQuery property to PoolClient
interface ExtendedPoolClient extends PoolClient {
  lastQuery?: any;
}

// Helper function to get a client from the pool
export async function getClient(): Promise<ExtendedPoolClient> {
  const client = await pool.connect() as ExtendedPoolClient;
  
  // Store the original methods
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${JSON.stringify(client.lastQuery)}`);
  }, 5000);
  
  // We need to maintain the original method's type signature
  // Handle the most common overloads explicitly
  client.query = function(textOrConfig: string | QueryConfig, values?: any[], callback?: Function) {
    client.lastQuery = { textOrConfig, values };
    
    if (typeof textOrConfig === 'string' && values) {
      return originalQuery(textOrConfig, values, callback as any);
    } else if (typeof textOrConfig === 'string' && !values) {
      return originalQuery(textOrConfig);
    } else {
      return originalQuery(textOrConfig as QueryConfig);
    }
  } as typeof client.query; // Cast to preserve the complex type
  
  // Replace the release method
  client.release = function() {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };
  
  return client;
}

// Close the pool during application shutdown
process.on('SIGINT', () => {
  pool.end().then(() => {
    console.log('Database pool has ended');
    process.exit(0);
  });
});
