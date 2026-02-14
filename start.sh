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
BACKEND_PORT=5001
FRONTEND_PORT=8085

is_port_in_use() {
    local port="$1"
    if command -v lsof > /dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN > /dev/null 2>&1
    else
        return 1
    fi
}

# Navigate to backend directory
cd "$DIR/backend"

# Helper to activate the backend virtual environment
activate_venv() {
    if [ -f "venv/Scripts/activate" ]; then
        # Windows
        source venv/Scripts/activate
    else
        # Linux, macOS
        source venv/bin/activate
    fi
}

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    $PYTHON_CMD -m venv venv
fi

# Activate virtual environment
activate_venv

# Determine which python to use inside venv
if command -v python &> /dev/null; then
    VENV_PYTHON="python"
elif command -v python3 &> /dev/null; then
    VENV_PYTHON="python3"
else
    VENV_PYTHON="$PYTHON_CMD"
fi

# Check if the current venv is healthy before install.
# Some stale venvs can make pip hang indefinitely.
echo "🔍 Checking virtual environment..."
if ! "$PYTHON_CMD" - "$VENV_PYTHON" <<'PY'
import subprocess
import sys

venv_python = sys.argv[1]
try:
    subprocess.run(
        [venv_python, "-m", "pip", "--version"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=20,
        check=True,
    )
except Exception:
    sys.exit(1)
PY
then
    TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
    BROKEN_DIR="venv.broken.$TIMESTAMP"
    echo "⚠️ Existing virtual environment is unresponsive. Recreating..."
    deactivate 2>/dev/null || true
    mv venv "$BROKEN_DIR"
    $PYTHON_CMD -m venv venv
    activate_venv
    if command -v python &> /dev/null; then
        VENV_PYTHON="python"
    elif command -v python3 &> /dev/null; then
        VENV_PYTHON="python3"
    else
        VENV_PYTHON="$PYTHON_CMD"
    fi
fi

# Install dependencies
echo "📥 Installing dependencies (this can take a minute on first run)..."
$VENV_PYTHON -m pip install -r requirements.txt || exit 1

# Check required ports before startup
if is_port_in_use "$BACKEND_PORT"; then
    echo "❌ Port $BACKEND_PORT is already in use. Stop the existing process and try again."
    exit 1
fi

if is_port_in_use "$FRONTEND_PORT"; then
    echo "❌ Port $FRONTEND_PORT is already in use. Stop the existing process and try again."
    exit 1
fi

# Start the backend server in background
echo "🚀 Starting backend server..."
PORT=$BACKEND_PORT $VENV_PYTHON app.py &
BACKEND_PID=$!

# Wait for server to start
sleep 2
if ! kill -0 "$BACKEND_PID" > /dev/null 2>&1; then
    echo "❌ Backend failed to start. Check the logs above."
    exit 1
fi

# Navigate to frontend directory
cd "$DIR/frontend"

# Start a no-cache HTTP server for frontend
echo "🌐 Starting frontend server..."
$VENV_PYTHON no_cache_server.py &
FRONTEND_PID=$!
sleep 1
if ! kill -0 "$FRONTEND_PID" > /dev/null 2>&1; then
    echo "❌ Frontend failed to start. Check the logs above."
    kill "$BACKEND_PID" > /dev/null 2>&1 || true
    exit 1
fi

echo ""
echo "✅ Dashboard is running!"
echo ""
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo ""
echo "Press Ctrl+C to stop all servers"

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# Wait for processes
wait
