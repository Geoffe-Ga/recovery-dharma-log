"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError
from starlette.applications import Starlette
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.routing import Mount
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

from app.config import settings
from app.database import Base, engine
from app.routers import (
    activity,
    auth,
    book,
    export,
    meetings,
    overrides,
    speakers,
    topics,
)
from app.routers import (
    settings as settings_router,
)

logger = logging.getLogger(__name__)

_DEV_SECRET_KEY = "dev-secret-key-change-in-production"  # nosec B105 - compared, not used as credential

# Columns added after initial schema. Each entry is (table, column, type).
_MIGRATIONS: list[tuple[str, str, str]] = [
    ("meeting_logs", "attendance_count", "INTEGER"),
    ("reading_assignments", "meeting_date", "DATE"),
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


@asynccontextmanager
async def lifespan(_app: Any) -> AsyncGenerator[None, None]:
    """Create database tables on startup; guard against dev secrets in prod."""
    if settings.environment != "development" and settings.secret_key == _DEV_SECRET_KEY:
        raise RuntimeError(
            "Refusing to start: RD_LOG_SECRET_KEY must be changed "
            "from the default in non-development environments."
        )
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
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


@app.get("/health")
def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}


# ---------------------------------------------------------------------------
# Production ASGI entrypoint
# ---------------------------------------------------------------------------
# When the built frontend exists (static/dist/), wrap FastAPI with a Starlette
# router that serves API routes at /api/* and the SPA at /*.
# In development (no dist/), `application` is just the bare FastAPI app.
# ---------------------------------------------------------------------------


class SPAStaticFiles(StaticFiles):
    """StaticFiles with SPA fallback: returns index.html for unmatched paths."""

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        except StarletteHTTPException as exc:
            if exc.status_code == 404:
                scope["path"] = "/index.html"
                await super().__call__(scope, receive, send)
            else:
                raise


_static_dir = Path(__file__).resolve().parent.parent / "static" / "dist"

if _static_dir.is_dir():
    logger.info("Serving static files from %s", _static_dir)
    application = Starlette(
        lifespan=lifespan,
        routes=[
            Mount("/api", app=app),
            Mount("/", app=SPAStaticFiles(directory=str(_static_dir), html=True)),
        ],
    )
else:
    application = app
