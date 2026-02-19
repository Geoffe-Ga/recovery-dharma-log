"""Export router: CSV and printable log."""

from fastapi import APIRouter, Depends
from fastapi.responses import PlainTextResponse

from app.auth import get_current_user
from app.models import User

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
def export_csv(
    _current_user: User = Depends(get_current_user),
) -> PlainTextResponse:
    """Export meeting log as CSV."""
    # TODO: implement real CSV generation
    csv_content = (
        "date,format,content,speaker,topic,book_section\n"
        '2025-02-16,speaker,"Speaker: Dave",Dave,,\n'
    )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=meeting_log.csv"},
    )


@router.get("/printable")
def export_printable(
    _current_user: User = Depends(get_current_user),
) -> PlainTextResponse:
    """Export a printable HTML log template."""
    # TODO: implement real printable template
    html = """<!DOCTYPE html>
<html>
<head><title>Meeting Log</title></head>
<body>
<h1>Recovery Dharma - Meeting Log</h1>
<p>Printable template coming soon.</p>
</body>
</html>"""
    return PlainTextResponse(content=html, media_type="text/html")
