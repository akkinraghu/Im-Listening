import { Pool, PoolClient } from 'pg';

// Conditionally import pgvector based on environment
let pgvector: any;

// Detect build environment - specifically for Netlify
const isBuildTime = process.env.NETLIFY === 'true' || 
                   process.env.CONTEXT === 'production' || 
                   process.env.CONTEXT === 'deploy-preview' ||
                   process.env.CONTEXT === 'branch-deploy';

// Log environment detection for debugging
console.log('PostgreSQL Environment:', {
  NETLIFY: process.env.NETLIFY,
  CONTEXT: process.env.CONTEXT,
  NODE_ENV: process.env.NODE_ENV,
  isBuildTime,
  hasPostgresUri: !!process.env.POSTGRES_URI
});

// Import real or mock pgvector based on environment
try {
  if (isBuildTime) {
    // Use mock during build time
    console.log('Using pgvector mock during build');
    pgvector = { registerType: () => console.log('Mock pgvector registerType called') };
  } else {
    // Use real pgvector in runtime
    pgvector = require('pgvector/pg');
    console.log('Imported real pgvector module');
  }
} catch (error) {
  console.warn('Failed to import pgvector, using mock:', error);
  pgvector = { registerType: () => console.log('Fallback mock pgvector registerType called') };
}

// Check if POSTGRES_URI is defined
const POSTGRES_URI = process.env.POSTGRES_URI;

// Create a dummy client for build time
const createDummyClient = () => {
  return {
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    release: () => {},
  } as unknown as PoolClient;
};

// Create a dummy pool for build time
const createDummyPool = () => {
  return {
    query: () => Promise.resolve({ rows: [], rowCount: 0 }),
    connect: () => Promise.resolve(createDummyClient()),
    end: () => Promise.resolve(),
  } as unknown as Pool;
};

// Don't throw an error during build time
if (!POSTGRES_URI && isBuildTime) {
  console.warn('POSTGRES_URI is not defined, but we are in build environment, continuing with dummy connection');
} else if (!POSTGRES_URI) {
  console.error('POSTGRES_URI environment variable is missing. Database connections will fail.');
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
  try {
    if (isBuildTime) {
      console.log('Using dummy PostgreSQL pool for build time');
      cached.pool = createDummyPool();
    } else {
      console.log('Initializing PostgreSQL pool with connection string');
      
      if (!POSTGRES_URI) {
        throw new Error('POSTGRES_URI is required for database connection');
      }
      
      // Create the real connection pool
      cached.pool = new Pool({
        connectionString: POSTGRES_URI,
        // Add connection timeout to fail fast if DB is unreachable
        connectionTimeoutMillis: 5000,
      });
      
      // Test the connection immediately
      cached.pool.query('SELECT NOW()')
        .then(() => console.log('PostgreSQL connection test successful'))
        .catch(err => console.error('PostgreSQL connection test failed:', err));
      
      console.log('PostgreSQL pool initialized');
    }
  } catch (error) {
    console.error('Failed to initialize PostgreSQL pool:', error);
    cached.pool = createDummyPool();
  }
}

// Safe pgvector initialization
const initPgVector = async (client: PoolClient) => {
  if (isBuildTime) {
    console.log('Skipping pgvector initialization during build');
    return;
  }
  
  try {
    // Register pgvector with the client
    console.log('Registering pgvector with PostgreSQL client');
    pgvector.registerType(client);
    
    // Create the extension if it doesn't exist
    console.log('Ensuring pgvector extension is enabled');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector extension initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize pgvector extension:', error);
    // Continue without pgvector - this allows the app to work without vector search
  }
};

async function connectToPostgres(): Promise<PoolClient> {
  if (cached.client) {
    return cached.client;
  }

  // For build time, return a dummy client
  if (isBuildTime) {
    console.log('Using dummy PostgreSQL client for build time');
    cached.client = createDummyClient();
    return cached.client;
  }

  if (!cached.promise) {
    cached.promise = cached.pool!.connect();
  }

  try {
    cached.client = await cached.promise;
    
    // Initialize pgvector
    await initPgVector(cached.client);
  } catch (e) {
    console.error('Error connecting to PostgreSQL:', e);
    cached.promise = null;
    cached.client = null;
    
    // Return a dummy client on error
    return createDummyClient();
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
