/**
 * Clean PMC Database Script
 *
 * This script cleans the MongoDB database by removing all PMC articles and chunks.
 * Use with caution as it will delete all data in the articles and articlechunks collections.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// MongoDB connection string with authentication
const MONGODB_URI = 'mongodb://root:example@localhost:27017/im_listening?authSource=admin';

// State file path
const STATE_FILE = path.join(__dirname, 'pmc-update-state.json');

// Connect to MongoDB
async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Define the Article model
const articleSchema = new mongoose.Schema({
  title: String,
  content: String,
  source: String,
  url: String,
  author: String,
  publishedDate: Date,
});

const Article = mongoose.model('Article', articleSchema);

// Define the ArticleChunk model
const articleChunkSchema = new mongoose.Schema({
  content: String,
  embedding: String,
  articleId: mongoose.Schema.Types.ObjectId,
  chunkIndex: Number,
});

const ArticleChunk = mongoose.model('ArticleChunk', articleChunkSchema);

// Clean the database
async function cleanDatabase(): Promise<void> {
  try {
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    
    console.log('Deleting all article chunks...');
    const chunksResult = await ArticleChunk.deleteMany({});
    console.log(`Deleted ${chunksResult.deletedCount} article chunks`);
    
    console.log('Deleting all articles...');
    const articlesResult = await Article.deleteMany({});
    console.log(`Deleted ${articlesResult.deletedCount} articles`);
    
    // Remove the state file if it exists
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log('Removed state file');
    }
    
    console.log('Database cleaning completed');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
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
