#!/bin/bash

# Start timing
START_TIME=$(date +%s)

echo "=== Starting Docker Development Environment ==="
echo "Current time: $(date)"
echo "Step 1: Stopping any existing containers..."

# Stop any running containers
docker-compose down
STOP_TIME=$(date +%s)
STOP_DURATION=$((STOP_TIME - START_TIME))
echo "✓ Containers stopped in ${STOP_DURATION} seconds"

echo "Step 2: Building containers (if needed)..."
BUILD_START=$(date +%s)
docker-compose build
BUILD_TIME=$(date +%s)
BUILD_DURATION=$((BUILD_TIME - BUILD_START))
echo "✓ Build completed in ${BUILD_DURATION} seconds"

echo "Step 3: Starting containers with force-recreate..."
UP_START=$(date +%s)
docker-compose up --force-recreate -d
UP_TIME=$(date +%s)
UP_DURATION=$((UP_TIME - UP_START))
echo "✓ Containers started in ${UP_DURATION} seconds"

# Wait for app to be ready
echo "Step 4: Waiting for application to be ready..."
READY_START=$(date +%s)

# Check if app is ready by polling the port
while ! nc -z localhost 3005 >/dev/null 2>&1; do
  echo "  - Waiting for app to be available on port 3005..."
  sleep 1
  
  # Timeout after 30 seconds
  if [ $(($(date +%s) - READY_START)) -gt 30 ]; then
    echo "⚠ Timeout waiting for app to be ready"
    break
  fi
done

READY_TIME=$(date +%s)
READY_DURATION=$((READY_TIME - READY_START))
echo "✓ Application ready in ${READY_DURATION} seconds"

# Calculate total time
TOTAL_DURATION=$((READY_TIME - START_TIME))
echo "=== Docker Development Environment Ready ==="
echo "Total setup time: ${TOTAL_DURATION} seconds"
echo "Application URL: http://localhost:3005"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: npm run docker:down"
echo ""

# Show logs
echo "Showing logs (press Ctrl+C to exit logs, containers will keep running)..."
docker-compose logs -f
