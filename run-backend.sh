#!/usr/bin/env bash
# run-backend.sh - Start the FastAPI backend server
# Usage: ./run-backend.sh [--reload]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

cd "$BACKEND_DIR"

# Activate venv
source .venv/bin/activate

# Default to reload mode for development
RELOAD_FLAG="--reload"
if [[ "${1:-}" == "--no-reload" ]]; then
    RELOAD_FLAG=""
fi

echo "Starting backend server at http://localhost:8000"
uvicorn app.main:app --host 0.0.0.0 --port 8000 $RELOAD_FLAG
