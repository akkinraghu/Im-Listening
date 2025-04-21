#!/bin/bash

# Script to fix Tailwind CSS configuration directly in the Docker container

# Stop any running containers
docker-compose down

# Create a temporary directory for the fix
mkdir -p /tmp/tailwind-fix

# Create a correct postcss.config.js file
cat > /tmp/tailwind-fix/postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Create a correct tailwind.config.js file
cat > /tmp/tailwind-fix/tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
  plugins: [],
}
EOF

# Create a package.json entry for the correct dependencies
cat > /tmp/tailwind-fix/tailwind-deps.json << 'EOF'
{
  "devDependencies": {
    "tailwindcss": "3.3.3",
    "postcss": "8.4.31",
    "autoprefixer": "10.4.16"
  }
}
EOF

# Copy the files to the project
cp /tmp/tailwind-fix/postcss.config.js ./postcss.config.js
cp /tmp/tailwind-fix/tailwind.config.js ./tailwind.config.js

# Update the Dockerfile to not copy these files
sed -i '' 's/COPY next.config.js tsconfig.json tailwind.config.js postcss.config.js/COPY next.config.js tsconfig.json/' Dockerfile.dev

# Modify docker-compose.yml to mount these files as volumes
sed -i '' '/- .\/tailwind.config.js/d' docker-compose.yml
sed -i '' '/- .\/postcss.config.js/d' docker-compose.yml
sed -i '' '/- .\/next.config.js/a\
      - ./tailwind.config.js:/app/tailwind.config.js\
      - ./postcss.config.js:/app/postcss.config.js' docker-compose.yml

# Install the correct dependencies locally
npm uninstall tailwindcss postcss autoprefixer
npm install --save-dev tailwindcss@3.3.3 postcss@8.4.31 autoprefixer@10.4.16

# Clean up
rm -rf /tmp/tailwind-fix

# Rebuild and restart the containers
docker-compose build --no-cache app
docker-compose up -d

echo "Tailwind CSS configuration has been fixed and Docker containers have been rebuilt."
echo "Please wait a moment for the application to start, then access it at http://localhost:3005"
