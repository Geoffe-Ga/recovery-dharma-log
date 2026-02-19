#!/usr/bin/env bash
# scripts/format.sh - Format code with Black and Ruff import sorting
# Usage: ./scripts/format.sh [--fix] [--check] [--verbose] [--help]
# shellcheck disable=SC2034

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

FIX=false
CHECK=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fix)
            FIX=true
            shift
            ;;
        --check)
            CHECK=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            cat << EOF
Usage: $(basename "$0") [OPTIONS]

Format code using Black and Ruff import sorting.

OPTIONS:
    --fix       Apply formatting changes (default)
    --check     Check only, fail if changes needed
    --verbose   Show detailed output
    --help      Display this help message

EXIT CODES:
    0           Code is properly formatted
    1           Formatting issues found
    2           Error running checks

EXAMPLES:
    $(basename "$0") --fix         # Apply formatting
    $(basename "$0") --check       # Check only
    $(basename "$0") --verbose     # Show detailed output
EOF
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            exit 2
            ;;
    esac
done

cd "$PROJECT_ROOT"

# Set verbosity
if $VERBOSE; then
    set -x
fi

echo "=== Formatting (Black + Ruff imports) ==="

# Determine mode
if $CHECK; then
    MODE="--check"
else
    MODE=""
fi

# Run ruff import sorting (single source of truth for import order)
if $VERBOSE; then
    echo "Running ruff import sorting..."
fi
if $CHECK; then
    ruff check --select I . || { echo "✗ Import sorting failed" >&2; exit 1; }
else
    ruff check --select I --fix . || { echo "✗ Import sorting failed" >&2; exit 1; }
fi

# Run Black
if $VERBOSE; then
    echo "Running Black..."
fi
black $MODE . || { echo "✗ Black failed" >&2; exit 1; }

if [ -n "$MODE" ]; then
    echo "✓ Code formatting check passed"
else
    echo "✓ Code formatted successfully"
fi
exit 0
