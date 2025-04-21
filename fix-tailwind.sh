#!/bin/bash

# Script to fix Tailwind CSS configuration in Docker container

# Stop and remove the existing container
docker-compose down

# Rebuild the container with the updated configuration
docker-compose build --no-cache app

# Start the container
docker-compose up -d

echo "Docker container rebuilt with updated Tailwind CSS configuration"
