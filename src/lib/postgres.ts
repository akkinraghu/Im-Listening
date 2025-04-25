import { Pool, PoolClient } from 'pg';
import pgvector from 'pgvector/pg';

const POSTGRES_URI = process.env.POSTGRES_URI!;

if (!POSTGRES_URI) {
  throw new Error('Please define the POSTGRES_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
// Define the type for the cached connection
interface PostgresCache {
  pool: Pool | null;
  client: PoolClient | null;
  promise: Promise<PoolClient> | null;
}

// Declare the global variable with the correct type
declare global {
  var postgres: PostgresCache | undefined;
}

let cached: PostgresCache = global.postgres || { pool: null, client: null, promise: null };

// Initialize the cached connection if not already done
if (!global.postgres) {
  global.postgres = cached;
}

// Create a new pool if not already created
if (!cached.pool) {
  cached.pool = new Pool({
    connectionString: POSTGRES_URI,
  });
  
  // Register pgvector with pg
  pgvector.registerType({ pg: Pool.prototype });
}

async function connectToPostgres(): Promise<PoolClient> {
  if (cached.client) {
    return cached.client;
  }

  if (!cached.promise) {
    cached.promise = cached.pool!.connect();
  }

  try {
    cached.client = await cached.promise;
    
    // Enable vector extension if not already enabled
    await cached.client.query('CREATE EXTENSION IF NOT EXISTS vector;');
  } catch (e) {
    cached.promise = null;
    cached.client = null;
    throw e;
  }

  return cached.client;
}

export default connectToPostgres;

// Helper function to get a client from the pool for a single operation
export async function withPostgresClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await cached.pool!.connect();
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
