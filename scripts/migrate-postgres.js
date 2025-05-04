// Migration script for PostgreSQL
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

// Get connection string from environment
const connectionString = process.env.POSTGRES_URI;

if (!connectionString) {
  console.error('Error: POSTGRES_URI environment variable is not set');
  process.exit(1);
}

// Create a new PostgreSQL client
const pool = new Pool({
  connectionString,
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL database');
    
    // Read SQL files
    const initSql = fs.readFileSync(
      path.resolve(process.cwd(), 'postgres/init/01-init.sql'),
      'utf8'
    );
    
    const createTablesSql = fs.readFileSync(
      path.resolve(process.cwd(), 'postgres/init/02-create-tables.sql'),
      'utf8'
    );
    
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('Running initialization SQL...');
    await client.query(initSql);
    
    console.log('Creating tables...');
    await client.query(createTablesSql);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration();
