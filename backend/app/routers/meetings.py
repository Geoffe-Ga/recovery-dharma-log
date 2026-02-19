"""Meetings router: log and upcoming meeting."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MeetingLog, User
from app.schemas import MeetingCancel, MeetingResponse, UpcomingMeeting
from app.services import get_format_for_date, get_upcoming_meeting_data

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/upcoming", response_model=UpcomingMeeting)
def get_upcoming_meeting(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get the next upcoming meeting with its format and content."""
    return get_upcoming_meeting_data(db, current_user.group)


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
    return log_entry
