/**
 * Clean PMC Database Script
 *
 * This script cleans the PostgreSQL database by removing all PMC articles and chunks.
 * Use with caution as it will delete all data in the articles and article_chunks tables.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URI || 'postgres://postgres:example@localhost:5432/im_listening'
});

// State file path
const STATE_FILE = path.join(__dirname, 'pmc-last-update.json');

/**
 * Clean the database
 */
async function cleanDatabase(): Promise<void> {
  console.log('Starting database cleanup...');
  
  const client = await pool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    // Delete all article chunks
    const deleteChunksResult = await client.query('DELETE FROM article_chunks');
    console.log(`Deleted ${deleteChunksResult.rowCount} article chunks`);
    
    // Delete all articles
    const deleteArticlesResult = await client.query('DELETE FROM articles');
    console.log(`Deleted ${deleteArticlesResult.rowCount} articles`);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database cleanup completed successfully');
    
    // Reset the state file if it exists
    if (fs.existsSync(STATE_FILE)) {
      fs.writeFileSync(STATE_FILE, JSON.stringify({ lastUpdate: null }));
      console.log('Reset state file');
    }
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error cleaning database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the clean database function
cleanDatabase()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
