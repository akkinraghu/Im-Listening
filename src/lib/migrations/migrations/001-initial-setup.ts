import mongoose from 'mongoose';

/**
 * Initial database setup migration
 * Creates indexes for vector search and ensures proper schema setup
 */
export const initialSetup = {
  name: '001-initial-setup',
  
  up: async () => {
    console.log('Running initial setup migration...');
    
    // Ensure indexes are created for Article model
    const Article = mongoose.model('Article');
    await Article.createIndexes();
    
    // Ensure indexes are created for ArticleChunk model
    const ArticleChunk = mongoose.model('ArticleChunk');
    await ArticleChunk.createIndexes();
    
    // Ensure indexes are created for Transcription model
    const Transcription = mongoose.model('Transcription');
    await Transcription.createIndexes();
    
    // Ensure indexes are created for User model
    const User = mongoose.model('User');
    await User.createIndexes();
    
    console.log('Initial setup migration completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back initial setup migration...');
    
    // Drop indexes (keeping the collections and data)
    const Article = mongoose.model('Article');
    await Article.collection.dropIndexes();
    
    const ArticleChunk = mongoose.model('ArticleChunk');
    await ArticleChunk.collection.dropIndexes();
    
    const Transcription = mongoose.model('Transcription');
    await Transcription.collection.dropIndexes();
    
    const User = mongoose.model('User');
    await User.collection.dropIndexes();
    
    console.log('Initial setup rollback completed successfully');
  }
};
