/**
 * PMC Article Update Scheduler for PostgreSQL
 * 
 * This script sets up a scheduled job to update PMC articles daily using PostgreSQL.
 * It uses node-cron to schedule the job and runs the update-pmc-articles-pg.ts script.
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { main as updatePmcArticlesPg } from './update-pmc-articles-pg';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Log file path
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'pmc-update-pg.log');

// Ensure log directory exists
async function ensureLogDirectoryExists() {
  try {
    await fs.access(LOG_DIR);
  } catch {
    await fs.mkdir(LOG_DIR, { recursive: true });
  }
}

// Function to log messages with timestamp
function logMessage(message: string): void {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  console.log(logEntry.trim());
  
  // Append to log file
  fs.appendFile(LOG_FILE, logEntry);
}

// Schedule the job to run daily at 3:00 AM
// The cron format is: minute hour day-of-month month day-of-week
cron.schedule('0 3 * * *', async () => {
  logMessage('Starting scheduled PMC article update job with PostgreSQL');
  
  try {
    await ensureLogDirectoryExists();
    await updatePmcArticlesPg();
    logMessage('PMC article update job with PostgreSQL completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`PMC article update job with PostgreSQL failed: ${errorMessage}`);
  }
});

// Check for command line arguments to run immediately
if (process.argv.includes('--run-now')) {
  (async () => {
    logMessage('Starting immediate PMC article update job with PostgreSQL');
    
    try {
      await ensureLogDirectoryExists();
      await updatePmcArticlesPg();
      logMessage('Immediate PMC article update job with PostgreSQL completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`Immediate PMC article update job with PostgreSQL failed: ${errorMessage}`);
    }
  })();
}

// Log startup message
logMessage('PMC article update scheduler with PostgreSQL started');
console.log('PMC article update scheduler with PostgreSQL is running...');
console.log('Press Ctrl+C to stop');
