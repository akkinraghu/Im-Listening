// Netlify Build Plugin to handle pgvector during build
module.exports = {
  onPreBuild: ({ utils }) => {
    console.log('Setting up environment for pgvector handling...');
    
    // Add a mock for pgvector during build
    process.env.NETLIFY = 'true';
    
    // Log environment variables (without sensitive values)
    console.log('Build environment:', {
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY: process.env.NETLIFY,
      CONTEXT: process.env.CONTEXT,
      POSTGRES_URI: process.env.POSTGRES_URI ? '[REDACTED]' : 'undefined'
    });
  },
  
  onBuild: () => {
    console.log('Build in progress, pgvector handling enabled');
  },
  
  onPostBuild: () => {
    console.log('Build completed with pgvector handling');
  }
};
