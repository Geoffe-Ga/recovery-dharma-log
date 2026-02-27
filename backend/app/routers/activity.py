"""Activity log router: view audit log entries."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import ActivityLog, User
from app.schemas import ActivityLogResponse

router = APIRouter(prefix="/activity", tags=["activity"])


@router.get("/", response_model=list[ActivityLogResponse])
def list_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ActivityLog]:
    """Get the last 50 activity log entries for the group."""
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.group_id == current_user.group_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(50)
        .all()
    )
