"""Settings router: group configuration."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FormatRotation, Group, User
from app.schemas import GroupSettings, GroupSettingsUpdate, InviteCodeResponse
from app.services import generate_invite_code, log_activity, revoke_invite_code

router = APIRouter(prefix="/settings", tags=["settings"])


def _settings_dict(group: Group, rotations: list[FormatRotation]) -> dict:
    """Build settings response dict."""
    return {
        "name": group.name,
        "meeting_day": group.meeting_day,
        "start_date": group.start_date,
        "meeting_time": group.meeting_time,
        "format_rotation": [r.format_type for r in rotations],
        "setup_completed": group.setup_completed,
        "invite_code": group.invite_code,
    }


@router.get("/", response_model=GroupSettings)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get current group settings."""
    group = current_user.group
    rotations = (
        db.query(FormatRotation)
        .filter(FormatRotation.group_id == group.id)
        .order_by(FormatRotation.position)
        .all()
    )
    return _settings_dict(group, rotations)


@router.put("/", response_model=GroupSettings)
def update_settings(
    settings_in: GroupSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update group settings."""
    group = current_user.group
    if settings_in.name is not None:
        group.name = settings_in.name
    if settings_in.meeting_day is not None:
        group.meeting_day = settings_in.meeting_day
    if settings_in.meeting_time is not None:
        group.meeting_time = settings_in.meeting_time
    if settings_in.format_rotation is not None:
        # Replace rotation entries
        db.query(FormatRotation).filter(
            FormatRotation.group_id == group.id,
        ).delete()
        for i, fmt in enumerate(settings_in.format_rotation):
            db.add(FormatRotation(group_id=group.id, position=i, format_type=fmt))
    db.commit()
    db.refresh(group)
    log_activity(db, group, current_user, "settings_updated")

    rotations = (
        db.query(FormatRotation)
        .filter(FormatRotation.group_id == group.id)
        .order_by(FormatRotation.position)
        .all()
    )
    return _settings_dict(group, rotations)


@router.post("/invite-code", response_model=InviteCodeResponse)
def create_invite_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Generate an invite code for the group."""
    group = current_user.group
    code = generate_invite_code(db, group)
    db.commit()
    return {"invite_code": code}


@router.delete("/invite-code", response_model=InviteCodeResponse)
def delete_invite_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Revoke the current invite code."""
    group = current_user.group
    revoke_invite_code(db, group)
    db.commit()
    return {"invite_code": None}
