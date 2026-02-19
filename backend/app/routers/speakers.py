"""Speakers router: schedule and manage speakers."""

from datetime import date

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas import SpeakerSchedule, SpeakerScheduleCreate

router = APIRouter(prefix="/speakers", tags=["speakers"])


@router.get("/schedule", response_model=list[SpeakerSchedule])
def get_speaker_schedule(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Get upcoming speaker schedule."""
    # TODO: implement real query
    return [
        {"meeting_date": date(2025, 3, 2), "speaker_name": "Clare"},
        {"meeting_date": date(2025, 4, 6), "speaker_name": None},
    ]


@router.post("/schedule", response_model=SpeakerSchedule)
def schedule_speaker(
    schedule_in: SpeakerScheduleCreate,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Schedule a speaker for a specific meeting date."""
    # TODO: implement real logic
    return {
        "meeting_date": schedule_in.meeting_date,
        "speaker_name": schedule_in.speaker_name,
    }


@router.delete("/schedule/{meeting_date}")
def unschedule_speaker(
    meeting_date: date,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Remove a scheduled speaker."""
    # TODO: implement real logic
    return {"detail": f"Speaker unscheduled for {meeting_date}"}
