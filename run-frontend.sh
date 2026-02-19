#!/usr/bin/env bash
# run-frontend.sh - Start the Vite dev server for the React frontend
# Usage: ./run-frontend.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

cd "$FRONTEND_DIR"

echo "Starting frontend dev server at http://localhost:5173"
npx vite
