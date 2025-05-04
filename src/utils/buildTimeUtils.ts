/**
 * This file contains utilities for handling build-time scenarios,
 * particularly for Netlify and other serverless environments.
 */

// Mock pgvector module to prevent errors during build time
export const mockPgVector = {
  registerType: () => {
    console.log('Mock pgvector registerType called');
  }
};

// Helper to determine if we're in a build environment
export const isBuildTime = () => {
  return process.env.NODE_ENV === 'production' && 
         (process.env.NETLIFY === 'true' || 
          process.env.CONTEXT === 'production' || 
          process.env.CONTEXT === 'deploy-preview' || 
          process.env.CONTEXT === 'branch-deploy');
};

// Helper to safely get pgvector
export const getPgVector = () => {
  try {
    if (isBuildTime()) {
      console.log('Using mock pgvector during build time');
      return mockPgVector;
    }
    
    // In runtime, return the real pgvector
    console.log('Using real pgvector');
    return require('pgvector/pg');
  } catch (error) {
    console.warn('Failed to import pgvector, using mock:', error);
    return mockPgVector;
  }
};
