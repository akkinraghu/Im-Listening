import mongoose from 'mongoose';
import connectToDatabase from '../mongodb';

interface Migration {
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

// Schema for tracking migrations
const MigrationSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  appliedAt: { type: Date, default: Date.now }
});

// Create or get the Migration model
const MigrationModel = mongoose.models.Migration || 
  mongoose.model('Migration', MigrationSchema);

// Define the initial setup migration
const initialSetup: Migration = {
  name: '001-initial-setup',
  
  up: async () => {
    console.log('Running initial setup migration...');
    
    // Ensure indexes are created for Article model
    const Article = mongoose.model('Article');
    await Article.createIndexes();
    
    // Ensure indexes are created for ArticleChunk model
    const ArticleChunk = mongoose.model('ArticleChunk');
    await ArticleChunk.createIndexes();
    
    // Create vector index for embeddings
    // This is a MongoDB-specific command for vector search
    try {
      const db = mongoose.connection.db;
      if (db) {
        // Using any type assertion for MongoDB Atlas vector search which isn't fully typed in mongoose
        await db.collection('articlechunks').createIndex(
          { embedding: "vectorEmbedding" } as any,
          { 
            name: "embeddingVectorIndex",
            dimensions: 1536 // Adjust based on the embedding model dimensions
          } as any
        );
        console.log('Vector index created successfully');
      } else {
        console.warn('Database connection not established, skipping vector index creation');
      }
    } catch (error) {
      console.warn('Error creating vector index:', error);
      console.log('Vector index creation may require MongoDB Atlas or a MongoDB version that supports vector search');
    }
    
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

// List of all migrations in order
const migrations: Migration[] = [
  initialSetup,
  // Add more migrations here as your schema evolves
];

/**
 * Run all pending migrations
 */
export async function runMigrations() {
  console.log('Starting database migrations...');
  
  // Connect to the database
  await connectToDatabase();
  
  // Get all applied migrations
  const appliedMigrations = await MigrationModel.find().sort({ name: 1 });
  const appliedMigrationNames = new Set(appliedMigrations.map(m => m.name));
  
  // Filter migrations that haven't been applied yet
  const pendingMigrations = migrations.filter(
    migration => !appliedMigrationNames.has(migration.name)
  );
  
  if (pendingMigrations.length === 0) {
    console.log('No pending migrations to apply.');
    return;
  }
  
  console.log(`Found ${pendingMigrations.length} pending migrations to apply.`);
  
  // Apply each pending migration
  for (const migration of pendingMigrations) {
    console.log(`Applying migration: ${migration.name}`);
    
    try {
      await migration.up();
      
      // Record that this migration has been applied
      await MigrationModel.create({
        name: migration.name,
        appliedAt: new Date()
      });
      
      console.log(`Successfully applied migration: ${migration.name}`);
    } catch (error) {
      console.error(`Error applying migration ${migration.name}:`, error);
      throw error;
    }
  }
  
  console.log('All migrations completed successfully!');
}

/**
 * Rollback the last applied migration
 */
export async function rollbackLastMigration() {
  console.log('Rolling back the last migration...');
  
  // Connect to the database
  await connectToDatabase();
  
  // Get the last applied migration
  const lastMigration = await MigrationModel.findOne().sort({ appliedAt: -1 });
  
  if (!lastMigration) {
    console.log('No migrations to roll back.');
    return;
  }
  
  // Find the migration in our list
  const migrationToRollback = migrations.find(m => m.name === lastMigration.name);
  
  if (!migrationToRollback) {
    console.error(`Cannot find migration ${lastMigration.name} to roll back.`);
    return;
  }
  
  try {
    console.log(`Rolling back migration: ${migrationToRollback.name}`);
    await migrationToRollback.down();
    
    // Remove the migration record
    await MigrationModel.deleteOne({ name: lastMigration.name });
    
    console.log(`Successfully rolled back migration: ${migrationToRollback.name}`);
  } catch (error) {
    console.error(`Error rolling back migration ${migrationToRollback.name}:`, error);
    throw error;
  }
}
