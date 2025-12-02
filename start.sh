#!/bin/sh
set -e

echo "[INFO] Starting BotNexus Application..."

# Check if running in production or development
if [ "$NODE_ENV" = "production" ]; then
    echo "[INFO] Running in production mode"
    
    # Check if dist exists
    if [ ! -d "dist" ]; then
        echo "[ERROR] dist directory not found. Build may have failed."
        exit 1
    fi
    
    # Run database migrations
    echo "[INFO] Running database migrations..."
    npm run db:push || echo "[WARN] Migration failed, continuing..."
    
    # Start the production server
    echo "[INFO] Starting production server..."
    exec node dist/index.cjs
else
    echo "[INFO] Running in development mode"
    
    # Ensure dependencies are installed
    if [ ! -d "node_modules" ]; then
        echo "[INFO] Installing dependencies..."
        npm install
    fi
    
    # Run database migrations
    echo "[INFO] Running database migrations..."
    npm run db:push || echo "[WARN] Migration failed, continuing..."
    
    # Start development server
    echo "[INFO] Starting development server..."
    exec npm run dev
fi
