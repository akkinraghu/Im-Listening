/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
