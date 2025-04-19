import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  emailVerified?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true,
    unique: true
  },
  image: String,
  emailVerified: Date
}, {
  timestamps: true
});

// Create indexes for better query performance
UserSchema.index({ email: 1 });

export default mongoose.models.User || 
  mongoose.model<IUser>('User', UserSchema);
