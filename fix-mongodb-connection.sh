#!/bin/bash

# Script to fix MongoDB connection string in Docker environment

# Create a temporary .env.local file with the correct MongoDB connection string
cat > /tmp/env.local.tmp << 'EOF'
# MongoDB
# MONGODB_URI=mongodb://root:example@localhost:27017/im_listening?authSource=admin
MONGODB_URI=mongodb://root:example@mongodb:27017/im_listening?authSource=admin

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_key_here

# DeepGram API
DEEPGRAM_API_KEY="7d17e82aaf43545cfe7855816fc337b7dd56d122"
NEXT_PUBLIC_DEEPGRAM_API_KEY="7d17e82aaf43545cfe7855816fc337b7dd56d122"

# OpenAI (Standard API)
OPENAI_API_KEY=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
EOF

# Copy the temporary file to .env.local
cp /tmp/env.local.tmp .env.local

# Restart Docker containers
docker-compose down
docker-compose up -d

echo "MongoDB connection string has been fixed in Docker environment."
echo "Your application should now be able to connect to MongoDB correctly."
