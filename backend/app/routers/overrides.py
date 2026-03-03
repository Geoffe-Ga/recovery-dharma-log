"""Format overrides router: per-date format override management."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FormatOverride, User
from app.schemas import FormatOverrideCreate, FormatOverrideResponse

router = APIRouter(prefix="/overrides", tags=["overrides"])

VALID_FORMAT_TYPES = {"Speaker", "Topic", "Book Study"}


@router.get("/", response_model=list[FormatOverrideResponse])
def list_overrides(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[FormatOverride]:
    """List all format overrides for the current group."""
    return (
        db.query(FormatOverride)
        .filter(FormatOverride.group_id == current_user.group_id)
        .order_by(FormatOverride.meeting_date)
        .all()
    )


@router.put("/{meeting_date}", response_model=FormatOverrideResponse)
def set_override(
    meeting_date: date,
    body: FormatOverrideCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FormatOverride:
    """Set or update a format override for a specific date."""
    if body.format_type not in VALID_FORMAT_TYPES:
        valid = ", ".join(sorted(VALID_FORMAT_TYPES))
        raise HTTPException(
            status_code=422,
            detail=f"Invalid format_type. Must be one of: {valid}",
        )

    override = (
        db.query(FormatOverride)
        .filter(
            FormatOverride.group_id == current_user.group_id,
            FormatOverride.meeting_date == meeting_date,
        )
        .first()
    )

    if override:
        override.format_type = body.format_type
    else:
        override = FormatOverride(
            group_id=current_user.group_id,
            meeting_date=meeting_date,
            format_type=body.format_type,
        )
        db.add(override)

    db.commit()
    db.refresh(override)
    return override


@router.delete("/{meeting_date}")
def delete_override(
    meeting_date: date,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Remove a format override for a specific date."""
    override = (
        db.query(FormatOverride)
        .filter(
            FormatOverride.group_id == current_user.group_id,
            FormatOverride.meeting_date == meeting_date,
        )
        .first()
    )
    if not override:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No override found for this date",
        )
    db.delete(override)
    db.commit()
    return {"detail": "Override removed"}
