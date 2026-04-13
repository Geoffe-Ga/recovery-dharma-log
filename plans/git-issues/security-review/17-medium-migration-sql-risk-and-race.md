# [Medium] Startup migrations use f-string SQL and race across replicas

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 4.6 — AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:L
**CWEs:** CWE-89 (SQL Injection — latent/pattern), CWE-362 (Race Condition), CWE-710 (Improper Adherence to Coding Standards)
**OWASP:** A03:2021 Injection (pattern), A05:2021 Security Misconfiguration

## Summary

`backend/app/main.py:_run_migrations` and `_run_data_migrations` apply schema changes at every app startup:

```python
conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
```

Today the `table` / `column` / `col_type` values come from a **hardcoded list** — so no injection is actually possible. But the pattern is dangerous:

- **Latent CWE-89.** If anyone later pipes a user-derived name into this loop (e.g. "per-group migration runs"), the f-string swallows it without complaint. Static analysers (bandit B608) probably flag this. Better to use a whitelisted column-type enum and psycopg/SQLAlchemy identifier quoting.
- **Race across replicas.** In a multi-instance Railway deployment, all replicas run `_run_migrations` concurrently on boot. `Base.metadata.create_all` and `ALTER TABLE` are broadly idempotent but not transactional across replicas; PostgreSQL throws on duplicate-column and the `except OperationalError: logger.debug(...)` catches it silently — but silent exception swallowing of *any* OperationalError (not just duplicate-column) hides real failures.
- **Swallow of OperationalError.** The current code treats every `OperationalError` as "already applied". A connection-refused, constraint violation, or serialization failure is logged at DEBUG and ignored.
- **`alembic` is in requirements** but not wired in. Idiomatic migrations should happen in a one-shot job, not on every `lifespan` start.
- **`create_all` at startup** creates missing tables outside a migration framework, which makes the schema diverge between "clean-install via SQLAlchemy models" and "migrated-from-scratch via alembic" over time.

## Where

- `backend/app/main.py:39-124` — migration loops.
- `backend/app/main.py:127-137` — `lifespan` that always runs them.

## Recommended fix

### Use Alembic for real

1. `alembic init backend/alembic` once.
2. Move every row of `_MIGRATIONS` and `_TYPE_MIGRATIONS` into an Alembic revision.
3. Replace `Base.metadata.create_all(bind=engine)` with nothing at runtime; let Alembic own the schema.
4. Build a Railway "release command" (`railway.json` supports one) that runs `alembic upgrade head` once per deploy, before starting web containers. Railway's release phase is designed for this.

### Belt-and-suspenders: narrow exception handling

If the inline migrations must stay as a transition step:

```python
from sqlalchemy.exc import OperationalError, ProgrammingError

ALLOWED_TYPES = {"REAL", "DATE", "INTEGER DEFAULT 0", "INTEGER DEFAULT 1",
                 "BOOLEAN DEFAULT 0", "VARCHAR(8)", "INTEGER", "DOUBLE PRECISION"}

_IDENT_RE = re.compile(r"^[a-z_][a-z0-9_]*$")

def _valid(name: str) -> bool:
    return bool(_IDENT_RE.match(name))


def _run_migrations() -> None:
    inspector = inspect(engine)
    for table, column, col_type in _MIGRATIONS:
        assert _valid(table) and _valid(column), f"invalid identifier: {table}.{column}"
        assert col_type in ALLOWED_TYPES, f"disallowed type: {col_type}"
        existing = [c["name"] for c in inspector.get_columns(table)]
        if column in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f'ALTER TABLE "{table}" ADD COLUMN "{column}" {col_type}'))
        except (OperationalError, ProgrammingError) as exc:
            msg = str(exc).lower()
            if "already exists" in msg or "duplicate column" in msg:
                logger.info("migration %s.%s already applied", table, column)
            else:
                logger.exception("migration %s.%s failed", table, column)
                raise
```

### Cross-replica locking

Before mutating, take an advisory lock:

```python
with engine.begin() as conn:
    conn.execute(text("SELECT pg_advisory_lock(hashtext('rd-log-migrations'))"))
    try:
        _apply_migrations(conn)
    finally:
        conn.execute(text("SELECT pg_advisory_unlock(hashtext('rd-log-migrations'))"))
```

SQLite (single-writer by default) doesn't need this but multi-replica Postgres does.

### Split create-all from migrations

Make `Base.metadata.create_all` the default **only** in tests / local dev. In production, rely exclusively on migrations and fail fast if expected tables are missing.

```python
if settings.environment == "development" and settings.database_url.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)
```

### Don't run on every start

Move migration execution out of `lifespan`. Two good options:

- **Release command** on Railway (`"deploy": { "preDeployCommand": "alembic upgrade head" }`).
- **Separate one-shot job** (`python -m app.migrate`) with a `--dry-run` flag.

## Acceptance criteria

- [ ] Alembic revisions exist for every row currently in `_MIGRATIONS` / `_TYPE_MIGRATIONS` / `_DATA_MIGRATIONS`.
- [ ] `lifespan` no longer runs DDL.
- [ ] Railway release phase runs `alembic upgrade head`; webapp container fails to start if schema is behind.
- [ ] `pg_advisory_lock` (or engine-native equivalent) wraps any remaining inline migrations.
- [ ] Tests assert the identifier-whitelist rejects injection-shaped names.

## References

- Alembic docs: https://alembic.sqlalchemy.org/
- "Running schema migrations in a Kubernetes-like environment": https://engineering.atspotify.com/2019/01/ (pattern general to Railway too)
- CWE-89: https://cwe.mitre.org/data/definitions/89.html
