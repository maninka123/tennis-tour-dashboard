#!/bin/bash

# Tennis Dashboard - Quick Start Script

echo "🎾 Tennis Live Dashboard"
echo "========================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Navigate to backend directory
cd "$DIR/backend"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt --quiet

# Start the backend server in background
echo "🚀 Starting backend server..."
PORT=5001 python app.py &
BACKEND_PID=$!

# Wait for server to start
sleep 2

# Navigate to frontend directory
cd "$DIR/frontend"

# Start a simple HTTP server for frontend
echo "🌐 Starting frontend server..."
python3 -m http.server 8080 &
FRONTEND_PID=$!

echo ""
echo "✅ Dashboard is running!"
echo ""
echo "   Frontend: http://localhost:8080"
echo "   Backend:  http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all servers"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
