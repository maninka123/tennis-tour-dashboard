#!/bin/bash

# Tennis Dashboard - Quick Start Script

echo "🎾 Tennis Live Dashboard"
echo "========================"
echo ""

# Detect Python command
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
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
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
if [ -f "venv/Scripts/activate" ]; then
    # Windows
    source venv/Scripts/activate
else
    # Linux, macOS
    source venv/bin/activate
fi

# Install dependencies
echo "📥 Installing dependencies..."
pip install -r requirements.txt --quiet

# Determine which python to use inside venv
if command -v python &> /dev/null; then
    VENV_PYTHON="python"
elif command -v python3 &> /dev/null; then
    VENV_PYTHON="python3"
else
    VENV_PYTHON="$PYTHON_CMD"
fi

# Start the backend server in background
echo "🚀 Starting backend server..."
PORT=5001 $VENV_PYTHON app.py &
BACKEND_PID=$!

# Wait for server to start
sleep 2

# Navigate to frontend directory
cd "$DIR/frontend"

# Start a no-cache HTTP server for frontend
echo "🌐 Starting frontend server..."
$VENV_PYTHON no_cache_server.py &
FRONTEND_PID=$!

echo ""
echo "✅ Dashboard is running!"
echo ""
echo "   Frontend: http://localhost:8085"
echo "   Backend:  http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop all servers"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
