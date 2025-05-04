/**
 * Mock implementation of pgvector for build time
 * This prevents errors during Netlify builds
 */

// Create a mock for pgvector
const pgvectorMock = {
  registerType: () => {
    console.log('Mock pgvector registerType called');
    return null;
  }
};

export default pgvectorMock;
