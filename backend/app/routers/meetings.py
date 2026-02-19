"""Meetings router: log and upcoming meeting."""

from datetime import date

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas import MeetingCancel, MeetingResponse, UpcomingMeeting

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/upcoming", response_model=UpcomingMeeting)
def get_upcoming_meeting(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Get the next upcoming meeting with its format and content."""
    # TODO: implement real logic with format rotation engine
    return {
        "meeting_date": date(2025, 2, 23),
        "format_type": "topic",
        "content_summary": None,
        "speaker_name": None,
        "topic_name": None,
        "reading_assignment_summary": None,
        "topics_remaining": 7,
        "topics_total": 10,
        "banners": [],
    }


@router.get("/log", response_model=list[MeetingResponse])
def get_meeting_log(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get the meeting history log."""
    # TODO: implement real query
    return [
        {
            "id": 1,
            "meeting_date": date(2025, 2, 16),
            "format_type": "speaker",
            "content_summary": "Speaker: Dave",
            "speaker_name": "Dave",
            "topic_name": None,
            "reading_assignment_summary": None,
            "is_cancelled": False,
        },
    ]


@router.post("/cancel", response_model=MeetingResponse)
def cancel_meeting(
    cancel: MeetingCancel,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Cancel or un-cancel a meeting."""
    # TODO: implement real logic
    return {
        "id": 1,
        "meeting_date": cancel.meeting_date,
        "format_type": "topic",
        "is_cancelled": cancel.is_cancelled,
    }
