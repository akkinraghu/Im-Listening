import mongoose, { Schema, Document, model, models } from 'mongoose';

export interface ITranscription extends Document {
  text: string;
  createdAt: Date;
  userId?: string;
  userType?: string;
  purpose?: string;
  metadata?: {
    duration?: number;
    confidence?: number;
    source?: string;
    userType?: string;
    purpose?: string;
    [key: string]: any;
  };
}

const TranscriptionSchema: Schema = new Schema({
  text: { 
    type: String, 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  userId: { 
    type: String,
    index: true
  },
  userType: {
    type: String,
    index: true
  },
  purpose: {
    type: String,
    index: true
  },
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
TranscriptionSchema.index({ createdAt: -1 });
TranscriptionSchema.index({ text: 'text' });

// Use mongoose.models.Transcription if it exists, otherwise create a new model
const Transcription = models.Transcription || model<ITranscription>('Transcription', TranscriptionSchema);

export default Transcription as mongoose.Model<ITranscription>;
