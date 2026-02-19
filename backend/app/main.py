"""FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, book, export, meetings, speakers, topics
from app.routers import settings as settings_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    """Create database tables on startup."""
    Base.metadata.create_all(bind=engine)
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
app.include_router(export.router)


@app.get("/health")
def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy", "app": settings.app_name}
