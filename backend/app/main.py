"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.database import Base, engine
from app.routers import (
    activity,
    auth,
    book,
    export,
    meetings,
    overrides,
    setup,
    speakers,
    topics,
)
from app.routers import (
    settings as settings_router,
)

# Columns added after initial schema. Each entry is (table, column, type).
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("meeting_logs", "attendance_count", "INTEGER"),
    ("reading_assignments", "meeting_date", "DATE"),
    ("groups", "current_book_assignment_index", "INTEGER DEFAULT 0"),
    ("groups", "book_cycle", "INTEGER DEFAULT 1"),
    ("groups", "current_chapter_marker", "INTEGER"),
    ("groups", "setup_completed", "BOOLEAN DEFAULT 0"),
]


_DATA_MIGRATIONS: list[str] = [
    # Existing groups should be treated as already set up
    "UPDATE groups SET setup_completed = 1 WHERE setup_completed = 0"
    " AND id IN (SELECT group_id FROM users)",
]


def _run_migrations() -> None:
    """Add columns that may be missing from existing databases.

    Idempotent: checks column existence before altering.
    Safe: catches OperationalError so a duplicate column never crashes startup.
    """
    inspector = inspect(engine)
    for table, column, col_type in _MIGRATIONS:
        existing = [c["name"] for c in inspector.get_columns(table)]
        if column not in existing:
            try:
                with engine.connect() as conn:
                    conn.execute(
                        text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
                    )
                    conn.commit()
            except OperationalError:
                pass  # Column already exists (race or stale inspector cache)

    for sql in _DATA_MIGRATIONS:
        try:
            with engine.connect() as conn:
                conn.execute(text(sql))
                conn.commit()
        except OperationalError:
            pass


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(meetings.router)
app.include_router(topics.router)
app.include_router(book.router)
app.include_router(speakers.router)
app.include_router(settings_router.router)
app.include_router(overrides.router)
app.include_router(export.router)
app.include_router(activity.router)
app.include_router(setup.router)


@app.get("/health")
def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}
