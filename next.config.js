/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Enable ESLint during production builds
    ignoreDuringBuilds: false,
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
