"""Meetings router: log and upcoming meeting."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MeetingLog, User
from app.schemas import (
    DanaUpdate,
    MeetingCancel,
    MeetingLogUpdate,
    MeetingResponse,
    UpcomingMeeting,
    UpcomingMeetingBrief,
)
from app.services import (
    get_format_for_date,
    get_upcoming_meeting_data,
    get_upcoming_meetings,
    log_activity,
)

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/upcoming", response_model=UpcomingMeeting)
def get_upcoming_meeting(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get the next upcoming meeting with its format and content."""
    return get_upcoming_meeting_data(db, current_user.group)


@router.get("/upcoming/lookahead", response_model=list[UpcomingMeetingBrief])
def get_upcoming_lookahead(
    weeks: int = Query(default=4, ge=1, le=12),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Get the next N upcoming meetings with their formats."""
    return get_upcoming_meetings(db, current_user.group, weeks)


@router.get("/log", response_model=list[MeetingResponse])
def get_meeting_log(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MeetingLog]:
    """Get the meeting history log."""
    return (
        db.query(MeetingLog)
        .filter(MeetingLog.group_id == current_user.group_id)
        .order_by(MeetingLog.meeting_date.desc())
        .all()
    )


@router.put("/log/{entry_id}", response_model=MeetingResponse)
def update_meeting_log_entry(
    entry_id: int,
    update: MeetingLogUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingLog:
    """Update an existing meeting log entry."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.id == entry_id,
            MeetingLog.group_id == current_user.group_id,
        )
        .first()
    )
    if not log_entry:
        raise HTTPException(status_code=404, detail="Meeting log entry not found")
    for field, value in update.model_dump(exclude_none=True).items():
        setattr(log_entry, field, value)
    db.commit()
    db.refresh(log_entry)
    return log_entry


@router.post("/cancel", response_model=MeetingResponse)
def cancel_meeting(
    cancel: MeetingCancel,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingLog:
    """Cancel or un-cancel a meeting."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.meeting_date == cancel.meeting_date,
        )
        .first()
    )
    if log_entry:
        log_entry.is_cancelled = cancel.is_cancelled
    else:
        fmt = get_format_for_date(db, current_user.group, cancel.meeting_date)
        log_entry = MeetingLog(
            group_id=current_user.group_id,
            meeting_date=cancel.meeting_date,
            format_type=fmt,
            is_cancelled=cancel.is_cancelled,
        )
        db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    action = "meeting_cancelled" if cancel.is_cancelled else "meeting_restored"
    log_activity(
        db,
        current_user.group,
        current_user,
        action,
        str(cancel.meeting_date),
    )
    return log_entry


@router.put("/{meeting_date}/dana", response_model=MeetingResponse)
def update_dana(
    meeting_date: date,
    body: DanaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeetingLog:
    """Set or clear the dana amount for a meeting."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == current_user.group_id,
            MeetingLog.meeting_date == meeting_date,
        )
        .first()
    )
    if log_entry:
        log_entry.dana_amount = body.dana_amount
    else:
        fmt = get_format_for_date(db, current_user.group, meeting_date)
        log_entry = MeetingLog(
            group_id=current_user.group_id,
            meeting_date=meeting_date,
            format_type=fmt,
            dana_amount=body.dana_amount,
        )
        db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return log_entry
