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
    
    // Enable vector extension first
    console.log('Enabling vector extension...');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      console.log('Vector extension enabled successfully');
    } catch (error) {
      console.warn('Warning: Could not enable vector extension:', error.message);
    }
    
    // Split the SQL files into individual statements
    const initStatements = initSql.split(';').filter(stmt => stmt.trim().length > 0);
    const createTablesStatements = createTablesSql.split(';').filter(stmt => stmt.trim().length > 0);
    
    // Execute initialization SQL statements one by one
    console.log('Running initialization SQL...');
    for (const stmt of initStatements) {
      try {
        await client.query(stmt);
      } catch (error) {
        console.warn(`Warning: Statement failed, but continuing: ${error.message}`);
        console.warn('Failed statement:', stmt.substring(0, 100) + '...');
      }
    }
    
    // Execute create tables SQL statements one by one
    console.log('Creating tables...');
    for (const stmt of createTablesStatements) {
      try {
        await client.query(stmt);
      } catch (error) {
        // Skip errors about existing objects
        if (error.message.includes('already exists')) {
          console.warn(`Warning: Object already exists: ${error.message}`);
        } else {
          console.error('Error executing statement:', error.message);
          console.error('Failed statement:', stmt.substring(0, 100) + '...');
          throw error;
        }
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Migration completed successfully!');
    
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
