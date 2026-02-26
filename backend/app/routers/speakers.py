"""Speakers router: schedule and manage speakers."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MeetingLog, User
from app.schemas import SpeakerSchedule, SpeakerScheduleCreate
from app.services import get_format_for_date, get_next_meeting_date

router = APIRouter(prefix="/speakers", tags=["speakers"])


@router.get("/names", response_model=list[str])
def get_speaker_names(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    """Get all unique speaker names from history."""
    entries = (
        db.query(MeetingLog.speaker_name)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.speaker_name.isnot(None),
            MeetingLog.speaker_name != "",
        )
        .distinct()
        .all()
    )
    return sorted(name for (name,) in entries)


@router.get("/upcoming", response_model=list[SpeakerSchedule])
def get_upcoming_speaker_dates(
    weeks: int = Query(default=8, ge=1, le=52),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SpeakerSchedule]:
    """Get all upcoming Speaker-format dates with assigned speakers."""
    group = current_user.group
    results: list[SpeakerSchedule] = []
    current = get_next_meeting_date(group)

    for _ in range(weeks):
        fmt = get_format_for_date(db, group, current)
        if fmt == "Speaker":
            log_entry = (
                db.query(MeetingLog)
                .filter(
                    MeetingLog.group_id == group.id,
                    MeetingLog.meeting_date == current,
                )
                .first()
            )
            speaker_name = log_entry.speaker_name if log_entry else None
            results.append(
                SpeakerSchedule(
                    meeting_date=current,
                    speaker_name=speaker_name,
                )
            )
        current += timedelta(days=7)

    return results


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
