import { Pool, PoolClient, QueryResult, QueryConfig } from 'pg';

// Initialize PostgreSQL connection pool
export const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'im_listening',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Helper function to execute a query
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Error executing query', { text, error });
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
