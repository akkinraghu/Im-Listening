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
  ssl: connectionString.includes('ssl') ? { rejectUnauthorized: false } : undefined,
});

// Function to execute SQL statements directly from a file
async function executeSqlFile(client, filePath) {
  console.log(`Executing SQL file: ${filePath}`);
  const sql = fs.readFileSync(filePath, 'utf8');
  
  try {
    await client.query(sql);
    console.log(`Successfully executed ${filePath}`);
    return true;
  } catch (error) {
    console.warn(`Warning: Error executing ${filePath}: ${error.message}`);
    
    // If the error is about objects already existing, consider it a success
    if (error.message.includes('already exists')) {
      console.log('Objects already exist, continuing...');
      return true;
    }
    
    return false;
  }
}

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Connected to PostgreSQL database');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Enable vector extension first
    console.log('Enabling vector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('Vector extension enabled successfully');
    } catch (error) {
      console.warn('Warning: Could not enable vector extension:', error.message);
    }
    
    // Execute SQL files directly
    const initSqlPath = path.resolve(process.cwd(), 'postgres/init/01-init.sql');
    const createTablesSqlPath = path.resolve(process.cwd(), 'postgres/init/02-create-tables.sql');
    
    const initSuccess = await executeSqlFile(client, initSqlPath);
    const tablesSuccess = await executeSqlFile(client, createTablesSqlPath);
    
    if (initSuccess && tablesSuccess) {
      // Commit transaction
      await client.query('COMMIT');
      console.log('Migration completed successfully!');
    } else {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      console.error('Migration failed due to SQL errors');
    }
    
    // Check if tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Available tables:');
    tablesResult.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
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
