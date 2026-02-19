"""Pydantic request/response schemas."""

from datetime import date, time

from pydantic import BaseModel

# --- Auth ---


class UserCreate(BaseModel):
    """Request schema for user registration."""

    username: str
    password: str


class UserResponse(BaseModel):
    """Response schema for user info."""

    id: int
    username: str
    group_id: int

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


# --- Group / Settings ---


class GroupSettings(BaseModel):
    """Response schema for group settings."""

    id: int
    name: str
    meeting_day: int
    meeting_time: time
    start_date: date
    format_rotation: list[str]

    model_config = {"from_attributes": True}


class GroupSettingsUpdate(BaseModel):
    """Request schema for updating group settings."""

    name: str | None = None
    meeting_day: int | None = None
    meeting_time: time | None = None
    start_date: date | None = None
    format_rotation: list[str] | None = None


# --- Meetings ---


class MeetingResponse(BaseModel):
    """Response schema for a meeting."""

    id: int
    meeting_date: date
    format_type: str
    content_summary: str | None = None
    speaker_name: str | None = None
    topic_name: str | None = None
    reading_assignment_summary: str | None = None
    is_cancelled: bool = False

    model_config = {"from_attributes": True}


class UpcomingMeeting(BaseModel):
    """Response schema for the next upcoming meeting."""

    meeting_date: date
    format_type: str
    content_summary: str | None = None
    speaker_name: str | None = None
    topic_name: str | None = None
    reading_assignment_summary: str | None = None
    topics_remaining: int | None = None
    topics_total: int | None = None
    banners: list[str] = []


class MeetingCancel(BaseModel):
    """Request schema for cancelling a meeting."""

    meeting_date: date
    is_cancelled: bool = True


# --- Topics ---


class TopicResponse(BaseModel):
    """Response schema for a topic."""

    id: int
    name: str
    is_active: bool
    is_drawn: bool = False

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    """Request schema for creating a topic."""

    name: str


class TopicDrawResponse(BaseModel):
    """Response schema after drawing a topic."""

    topic: TopicResponse
    topics_remaining: int
    topics_total: int
    deck_cycle: int


# --- Book ---


class BookChapterResponse(BaseModel):
    """Response schema for a book chapter."""

    id: int
    order: int
    start_page: str
    end_page: str
    title: str
    page_count: int

    model_config = {"from_attributes": True}


class ReadingAssignmentResponse(BaseModel):
    """Response schema for a reading assignment."""

    id: int
    assignment_order: int
    chapters: list[BookChapterResponse]
    total_pages: int

    model_config = {"from_attributes": True}


class ReadingPlanStatus(BaseModel):
    """Response schema for reading plan builder state."""

    current_assignment_chapters: list[BookChapterResponse]
    current_assignment_total_pages: int
    next_chapter: BookChapterResponse | None
    completed_assignments: list[ReadingAssignmentResponse]


# --- Speakers ---


class SpeakerSchedule(BaseModel):
    """Response schema for a speaker schedule entry."""

    meeting_date: date
    speaker_name: str | None = None


class SpeakerScheduleCreate(BaseModel):
    """Request schema for scheduling a speaker."""

    meeting_date: date
    speaker_name: str


# --- Export ---


class ExportResponse(BaseModel):
    """Response wrapper for export endpoints."""

    content: str
    filename: str
    content_type: str
