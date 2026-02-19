"""Speakers router: schedule and manage speakers."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MeetingLog, User
from app.schemas import SpeakerSchedule, SpeakerScheduleCreate

router = APIRouter(prefix="/speakers", tags=["speakers"])


@router.get("/schedule", response_model=list[SpeakerSchedule])
def get_speaker_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get upcoming speaker schedule."""
    entries = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.speaker_name.isnot(None),
            MeetingLog.meeting_date >= date.today(),
        )
        .order_by(MeetingLog.meeting_date)
        .all()
    )
    return [
        {"meeting_date": e.meeting_date, "speaker_name": e.speaker_name}
        for e in entries
    ]


@router.post("/schedule", response_model=SpeakerSchedule)
def schedule_speaker(
    schedule_in: SpeakerScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Schedule a speaker for a specific meeting date."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.meeting_date == schedule_in.meeting_date,
        )
        .first()
    )
    if log_entry:
        log_entry.speaker_name = schedule_in.speaker_name
        log_entry.format_type = "Speaker"
    else:
        log_entry = MeetingLog(
            group_id=current_user.group_id,
            meeting_date=schedule_in.meeting_date,
            format_type="Speaker",
            speaker_name=schedule_in.speaker_name,
        )
        db.add(log_entry)
    db.commit()
    return {
        "meeting_date": schedule_in.meeting_date,
        "speaker_name": schedule_in.speaker_name,
    }


@router.delete("/schedule/{meeting_date}")
def unschedule_speaker(
    meeting_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Remove a scheduled speaker."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.meeting_date == meeting_date,
        )
        .first()
    )
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No speaker scheduled for this date",
        )
    log_entry.speaker_name = None
    db.commit()
    return {"detail": "Speaker unscheduled"}
