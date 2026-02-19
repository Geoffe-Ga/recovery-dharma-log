"""SQLAlchemy database engine and session management."""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


def get_db() -> Generator[Session, None, None]:
    """Yield a database session, closing it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
