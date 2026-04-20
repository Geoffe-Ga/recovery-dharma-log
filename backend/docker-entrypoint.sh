#!/bin/sh
# Container init script.
#
# Railway (and many other bind-mounted volume providers) mount persistent
# volumes with root ownership. The application image runs as the
# unprivileged `app` user (uid 1001) per the container-hardening work in
# Issue #15, so it cannot write to a root-owned mount. When that mount
# holds the SQLite database, startup migrations fail with
# `sqlite3.OperationalError: attempt to write a readonly database`.
#
# This script runs as PID 1 when the container starts. If it is invoked as
# root, it ensures the SQLite database directory exists and is owned by
# `app:app`, then drops privileges via `gosu` before exec'ing the real
# command. If it is already running as a non-root user (e.g. when an
# orchestrator enforces `runAsUser` itself), it just exec's the command
# unchanged — the process UID remains 1001, preserving the hardening
# guarantee.

set -eu

APP_USER="app"

# Parse the SQLAlchemy SQLite URL in RD_LOG_DATABASE_URL and echo the
# filesystem path of the database file. Prints nothing (and exits 0) for
# non-SQLite URLs or unset values.
#
# SQLAlchemy URL convention:
#   sqlite:///relative/path.db   (three slashes -> path is relative to CWD)
#   sqlite:////abs/path.db       (four  slashes -> path is absolute)
resolve_sqlite_path() {
    url="${RD_LOG_DATABASE_URL:-}"
    case "$url" in
        sqlite:*) ;;
        *) return 0 ;;
    esac

    # Strip the "sqlite://" scheme prefix, then drop exactly one leading
    # slash. Whatever remains is the raw SQLAlchemy path: relative paths
    # have no leading slash, absolute paths still start with '/'.
    rest="${url#sqlite://}"
    rest="${rest#/}"

    case "$rest" in
        /*) printf '%s\n' "$rest" ;;
        *)  printf '%s/%s\n' "$(pwd)" "$rest" ;;
    esac
}

prepare_sqlite_dir() {
    path="$(resolve_sqlite_path)"
    [ -n "$path" ] || return 0

    dir="$(dirname "$path")"
    mkdir -p "$dir"

    # Chown the directory (and, if it already exists, the db file) so the
    # unprivileged app user can open a write transaction. `|| true` keeps
    # startup resilient if the filesystem disallows chown (e.g. a read-only
    # bind mount used deliberately by the operator).
    chown -R "${APP_USER}:${APP_USER}" "$dir" 2>/dev/null || true
    if [ -f "$path" ]; then
        chown "${APP_USER}:${APP_USER}" "$path" 2>/dev/null || true
    fi
}

if [ "$(id -u)" = "0" ]; then
    prepare_sqlite_dir
    exec gosu "${APP_USER}:${APP_USER}" "$@"
fi

exec "$@"
