/**
 * Utility functions for handling build-time scenarios
 * This file helps prevent errors during Netlify builds
 */

// Detect if we're in a build environment (Netlify)
export const isBuildEnvironment = (): boolean => {
  return process.env.NETLIFY === 'true' || 
         process.env.CONTEXT === 'production' || 
         process.env.CONTEXT === 'deploy-preview' ||
         process.env.CONTEXT === 'branch-deploy';
};

// Create a mock for pgvector during build time
export const createPgVectorMock = () => {
  return {
    registerType: () => {
      console.log('Mock pgvector registerType called during build');
    }
  };
};

// Safe wrapper for pgvector initialization
export const safeInitPgVector = (pgvector: any, client: any) => {
  if (isBuildEnvironment()) {
    console.log('Skipping pgvector initialization during build');
    return;
  }
  
  try {
    // Only try to register if we're not in a build environment
    pgvector.registerType(client);
    console.log('pgvector registered successfully');
  } catch (error) {
    console.warn('Failed to register pgvector:', error);
  }
};
