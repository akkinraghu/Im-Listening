/**
 * PMC Article Update Scheduler
 * 
 * This script sets up a scheduled job to update PMC articles daily.
 * It uses node-cron to schedule the job and runs the update-pmc-articles.ts script.
 */

import dotenv from 'dotenv';
import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';
import { main as updatePmcArticles } from './update-pmc-articles';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Log file path
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'pmc-update.log');

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
  logMessage('Starting scheduled PMC article update job');
  
  try {
    await updatePmcArticles();
    logMessage('PMC article update job completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logMessage(`PMC article update job failed: ${errorMessage}`);
    console.error(error);
  }
});

// Also provide a way to run the job manually
if (process.argv.includes('--run-now')) {
  logMessage('Running PMC article update job manually');
  
  updatePmcArticles()
    .then(() => {
      logMessage('Manual PMC article update job completed successfully');
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logMessage(`Manual PMC article update job failed: ${errorMessage}`);
      console.error(error);
    });
}

ensureLogDirectoryExists();

logMessage('PMC article update scheduler started');
console.log('Scheduler is running. The update job will run daily at 3:00 AM.');
console.log('Press Ctrl+C to stop the scheduler.');
