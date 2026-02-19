"""Export router: CSV and printable log."""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import User
from app.services import generate_csv_export, generate_printable_export

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
def export_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    """Export meeting log as CSV."""
    csv_content = generate_csv_export(db, current_user.group)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=meeting_log.csv"},
    )


@router.get("/printable")
def export_printable(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PlainTextResponse:
    """Export a printable HTML log template."""
    html = generate_printable_export(db, current_user.group)
    return PlainTextResponse(content=html, media_type="text/html")
