"""SQLAlchemy ORM models for the Recovery Dharma Secretary Log."""

from datetime import UTC, date, datetime, time

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Group(Base):
    """A Recovery Dharma meeting group."""

    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    meeting_day: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=6,
    )  # 0=Mon, 6=Sun
    meeting_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
        default=time(18, 0),
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    users: Mapped[list["User"]] = relationship(back_populates="group")
    format_rotations: Mapped[list["FormatRotation"]] = relationship(
        back_populates="group",
    )
    format_overrides: Mapped[list["FormatOverride"]] = relationship(
        back_populates="group",
    )
    topics: Mapped[list["Topic"]] = relationship(back_populates="group")
    topic_deck_states: Mapped[list["TopicDeckState"]] = relationship(
        back_populates="group",
    )
    book_chapters: Mapped[list["BookChapter"]] = relationship(
        back_populates="group",
    )
    reading_assignments: Mapped[list["ReadingAssignment"]] = relationship(
        back_populates="group",
    )
    meeting_logs: Mapped[list["MeetingLog"]] = relationship(
        back_populates="group",
    )


class User(Base):
    """Application user (secretary)."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )

    group: Mapped["Group"] = relationship(back_populates="users")


class FormatRotation(Base):
    """One entry in a group's format rotation cycle."""

    __tablename__ = "format_rotations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    format_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # "speaker", "topic", "book"

    group: Mapped["Group"] = relationship(back_populates="format_rotations")


class Topic(Base):
    """A discussion topic in the deck."""

    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    deck_states: Mapped[list["TopicDeckState"]] = relationship(
        back_populates="topic",
    )
    group: Mapped["Group"] = relationship(back_populates="topics")


class TopicDeckState(Base):
    """Tracks which topics have been drawn in the current deck cycle."""

    __tablename__ = "topic_deck_states"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    topic_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("topics.id"),
        nullable=False,
    )
    is_drawn: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    deck_cycle: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )

    group: Mapped["Group"] = relationship(back_populates="topic_deck_states")
    topic: Mapped["Topic"] = relationship(back_populates="deck_states")


class BookChapter(Base):
    """A chapter from the Recovery Dharma book."""

    __tablename__ = "book_chapters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    start_page: Mapped[str] = mapped_column(String(10), nullable=False)
    end_page: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)

    group: Mapped["Group"] = relationship(back_populates="book_chapters")


class ReadingAssignment(Base):
    """A group of chapters assigned for one Book Study session."""

    __tablename__ = "reading_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    assignment_order: Mapped[int] = mapped_column(Integer, nullable=False)
    chapters_json: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",
    )
    meeting_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    group: Mapped["Group"] = relationship(
        back_populates="reading_assignments",
    )


class ActivityLog(Base):
    """An audit log entry recording a user action."""

    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(UTC),
    )

    group: Mapped["Group"] = relationship()
    user: Mapped["User"] = relationship()


class MeetingLog(Base):
    """A record of a single meeting."""

    __tablename__ = "meeting_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    format_type: Mapped[str] = mapped_column(String(50), nullable=False)
    content_summary: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    speaker_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    topic_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("topics.id"),
        nullable=True,
    )
    reading_assignment_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("reading_assignments.id"),
        nullable=True,
    )
    is_cancelled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    dana_amount: Mapped[float | None] = mapped_column(
        "attendance_count",
        Float,
        nullable=True,
    )

    group: Mapped["Group"] = relationship(back_populates="meeting_logs")


class FormatOverride(Base):
    """A per-date format override that takes precedence over the rotation."""

    __tablename__ = "format_overrides"
    __table_args__ = (UniqueConstraint("group_id", "meeting_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    group_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("groups.id"),
        nullable=False,
    )
    meeting_date: Mapped[date] = mapped_column(Date, nullable=False)
    format_type: Mapped[str] = mapped_column(String(50), nullable=False)

    group: Mapped["Group"] = relationship(back_populates="format_overrides")
