#!/usr/bin/env bash
# scripts/check-all.sh - Run all quality checks for backend and frontend
# Usage: ./scripts/check-all.sh [--backend|--frontend|--verbose|--help]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RUN_BACKEND=true
RUN_FRONTEND=true
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend)
            RUN_FRONTEND=false
            shift
            ;;
        --frontend)
            RUN_BACKEND=false
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            cat << EOF
Usage: $(basename "$0") [OPTIONS]

Run all quality checks for both backend and frontend.

OPTIONS:
    --backend   Run backend checks only
    --frontend  Run frontend checks only
    --verbose   Show detailed output
    --help      Display this help message

EXIT CODES:
    0           All checks passed
    1           One or more checks failed
    2           Error running checks
EOF
            exit 0
            ;;
        *)
            echo "Error: Unknown option: $1" >&2
            exit 2
            ;;
    esac
done

VERBOSE_FLAG=""
if $VERBOSE; then
    VERBOSE_FLAG="--verbose"
fi

FAILED=()
PASSED=()

run_suite() {
    local suite_name=$1
    shift

    echo "========================================"
    echo "  $suite_name"
    echo "========================================"
    echo ""

    if "$@" $VERBOSE_FLAG; then
        PASSED+=("$suite_name")
    else
        FAILED+=("$suite_name")
    fi
    echo ""
}

if $RUN_BACKEND; then
    BACKEND_CHECK="$PROJECT_ROOT/backend/scripts/check-all.sh"
    BACKEND_VENV="$PROJECT_ROOT/backend/.venv/bin/activate"
    if [ -f "$BACKEND_CHECK" ]; then
        if [ -f "$BACKEND_VENV" ]; then
            # shellcheck disable=SC1090
            source "$BACKEND_VENV"
        fi
        run_suite "Backend Checks" "$BACKEND_CHECK"
        if [ -n "${VIRTUAL_ENV:-}" ]; then
            deactivate
        fi
    else
        echo "Warning: backend/scripts/check-all.sh not found, skipping" >&2
    fi
fi

if $RUN_FRONTEND; then
    if [ -f "$PROJECT_ROOT/frontend/scripts/check-all.sh" ]; then
        run_suite "Frontend Checks" "$PROJECT_ROOT/frontend/scripts/check-all.sh"
    else
        echo "Warning: frontend/scripts/check-all.sh not found, skipping" >&2
    fi
fi

echo "========================================"
echo "  Overall Summary"
echo "========================================"
echo "Passed: ${#PASSED[@]}"
echo "Failed: ${#FAILED[@]}"

if [ ${#FAILED[@]} -gt 0 ]; then
    echo ""
    echo "Failed suites:"
    for suite in "${FAILED[@]}"; do
        echo "  ✗ $suite"
    done
    exit 1
else
    echo ""
    echo "✓ All quality checks passed!"
    exit 0
fi
