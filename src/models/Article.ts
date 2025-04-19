import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  title: string;
  content: string;
  source: string;
  url?: string;
  author?: string;
  publishedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

const ArticleSchema: Schema = new Schema({
  title: { 
    type: String, 
    required: true,
    index: true
  },
  content: { 
    type: String, 
    required: true 
  },
  source: { 
    type: String, 
    required: true,
    index: true
  },
  url: { 
    type: String,
    index: true
  },
  author: String,
  publishedDate: Date,
  metadata: {
    type: Map,
    of: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
ArticleSchema.index({ title: 'text', content: 'text' });

export default mongoose.models.Article || 
  mongoose.model<IArticle>('Article', ArticleSchema);
