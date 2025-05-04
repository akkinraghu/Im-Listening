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
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(__dirname, 'src');
    return config;
  },
};

module.exports = nextConfig;
