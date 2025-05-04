/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Disable ESLint during production builds to avoid deployment issues
    ignoreDuringBuilds: true,
    // Run ESLint on file save
    dirs: ['src'],
  },
  // Ensure Next.js listens on all network interfaces
  output: 'standalone',
  
  // Explicitly configure webpack to handle path aliases
  webpack: (config, { isServer, dev }) => {
    // Add path aliases
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    
    // Override pgvector in production builds to prevent errors
    if (!dev) {
      console.log('Production build detected, overriding pgvector module');
      config.resolve.alias['pgvector/pg'] = path.join(__dirname, 'src/utils/pgvectorOverride.js');
    }
    
    return config;
  },
};

module.exports = nextConfig;
