#!/bin/bash
# Local development server starter

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo "Tennis Dashboard - Local Development"
echo "=========================================="

# Start backend
cd "$PROJECT_DIR/backend"
echo "Starting backend on port 5001..."
python app.py &
BACKEND_PID=$!

sleep 2

# Start frontend
cd "$PROJECT_DIR/frontend"
echo "Starting frontend on port 8000..."
python -m http.server 8000 &
FRONTEND_PID=$!

echo "=========================================="
echo "✓ Backend running: http://localhost:5001"
echo "✓ Frontend running: http://localhost:8000"
echo "✓ Open browser to http://localhost:8000"
echo "=========================================="

# Keep running
wait
