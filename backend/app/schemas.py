"""Pydantic request/response schemas."""

from datetime import date, time

from pydantic import BaseModel, Field

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

    name: str
    meeting_day: int
    meeting_time: time | None = None
    start_date: date
    format_rotation: list[str]


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
    attendance_count: int | None = None

    model_config = {"from_attributes": True}


class UpcomingMeeting(BaseModel):
    """Response schema for the next upcoming meeting."""

    meeting_date: date
    meeting_time: time | None = None
    format_type: str
    is_cancelled: bool = False
    topic_name: str | None = None
    speaker_name: str | None = None
    book_chapter: str | None = None
    topics_remaining: int = 0
    topics_total: int = 0
    banners: list[str] = []
    attendance_count: int | None = None


class UpcomingMeetingBrief(BaseModel):
    """Brief meeting info for multi-week lookahead."""

    meeting_date: date
    meeting_time: time | None = None
    format_type: str
    is_cancelled: bool = False


class MeetingLogUpdate(BaseModel):
    """Request schema for updating a meeting log entry."""

    speaker_name: str | None = None
    content_summary: str | None = None
    is_cancelled: bool | None = None


class MeetingCancel(BaseModel):
    """Request schema for cancelling a meeting."""

    meeting_date: date
    is_cancelled: bool = True


class AttendanceUpdate(BaseModel):
    """Request schema for updating attendance count."""

    attendance_count: int | None = Field(default=None, ge=0)


# --- Topics ---


class TopicResponse(BaseModel):
    """Response schema for a topic."""

    id: int
    name: str
    is_active: bool
    is_drawn: bool = False
    last_used: date | None = None

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


class AssignmentUpdate(BaseModel):
    """Request schema for updating an assignment's chapters."""

    chapter_ids: list[int]


class ReadingPlanStatus(BaseModel):
    """Response schema for reading plan builder state."""

    current_assignment_chapters: list[BookChapterResponse]
    current_assignment_total_pages: int
    next_chapter: BookChapterResponse | None
    completed_assignments: list[ReadingAssignmentResponse]
    total_chapters: int = 0
    assigned_chapters: int = 0
    total_pages: int = 0
    assigned_pages: int = 0


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
