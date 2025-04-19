import mongoose, { Schema, Document } from 'mongoose';

export interface IArticleChunk extends Document {
  articleId: mongoose.Types.ObjectId;
  content: string;
  chunkIndex: number;
  embedding: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Define schema type that matches Mongoose's expectations
type SchemaDefinition = {
  articleId: any;
  content: any;
  chunkIndex: any;
  embedding: any;
  metadata: any;
};

const ArticleChunkSchema = new Schema<IArticleChunk, {}, {}, {}, SchemaDefinition>({
  articleId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Article',
    required: true,
    index: true
  },
  content: { 
    type: String, 
    required: true 
  },
  chunkIndex: { 
    type: Number, 
    required: true 
  },
  embedding: { 
    type: [Number],
    required: true
    // Note: We'll create the vector index programmatically instead of in the schema definition
    // since TypeScript doesn't recognize the vector index type
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create compound index for article and chunk index
ArticleChunkSchema.index({ articleId: 1, chunkIndex: 1 }, { unique: true });

// Create text index for basic text search
ArticleChunkSchema.index({ content: 'text' });

// Create vector index programmatically
// This will be handled during the migration process
// We'll use the MongoDB command directly:
// db.articleChunks.createIndex(
//   { embedding: "vectorEmbedding" },
//   { 
//     name: "embeddingVectorIndex",
//     dimensions: 1536
//   }
// );

export default mongoose.models.ArticleChunk || 
  mongoose.model<IArticleChunk>('ArticleChunk', ArticleChunkSchema);
