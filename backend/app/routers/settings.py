"""Settings router: group configuration."""

from datetime import date, time

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas import GroupSettings, GroupSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=GroupSettings)
def get_settings(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Get current group settings."""
    # TODO: implement real query
    return {
        "id": 1,
        "name": "My Meeting",
        "meeting_day": 6,
        "meeting_time": time(18, 0),
        "start_date": date(2025, 1, 5),
        "format_rotation": ["speaker", "topic", "book", "topic", "book"],
    }


@router.put("/", response_model=GroupSettings)
def update_settings(
    settings_in: GroupSettingsUpdate,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Update group settings."""
    # TODO: implement real update
    return {
        "id": 1,
        "name": settings_in.name or "My Meeting",
        "meeting_day": settings_in.meeting_day or 6,
        "meeting_time": settings_in.meeting_time or time(18, 0),
        "start_date": settings_in.start_date or date(2025, 1, 5),
        "format_rotation": settings_in.format_rotation
        or ["speaker", "topic", "book", "topic", "book"],
    }
