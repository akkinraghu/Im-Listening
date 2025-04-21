#!/bin/bash

# Script to completely rebuild Docker setup with fresh Tailwind CSS configuration

echo "Stopping Docker containers..."
docker-compose down

echo "Removing Docker images to ensure a clean rebuild..."
docker-compose rm -f

echo "Creating fresh Tailwind CSS configuration..."
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
EOF

echo "Rebuilding Docker containers..."
docker-compose build --no-cache

echo "Starting Docker containers..."
docker-compose up -d

echo "Docker containers have been rebuilt with fresh Tailwind CSS configuration."
echo "Please wait a moment for the application to start, then access it at http://localhost:3005"
