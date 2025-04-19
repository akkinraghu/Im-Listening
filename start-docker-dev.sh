#!/bin/bash

# Stop any running containers
echo "Stopping any running containers..."
docker-compose down

# Build and start the containers
echo "Building and starting containers..."
docker-compose build
docker-compose up -d

# Show logs
echo "Showing logs (press Ctrl+C to exit logs, containers will keep running)..."
docker-compose logs -f app
