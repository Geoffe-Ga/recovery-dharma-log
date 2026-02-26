"""Book router: chapters and reading assignments."""

import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import BookChapter, ReadingAssignment, User
from app.schemas import (
    AssignmentUpdate,
    BookChapterResponse,
    ReadingAssignmentResponse,
    ReadingPlanStatus,
)
from app.services import (
    add_chapter_to_current_assignment,
    delete_assignment,
    finalize_current_assignment,
    get_plan_status,
    page_count,
    update_assignment_chapters,
)

router = APIRouter(prefix="/book", tags=["book"])


@router.get("/chapters", response_model=list[BookChapterResponse])
def list_chapters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all book chapters."""
    chapters = (
        db.query(BookChapter)
        .filter(BookChapter.group_id == current_user.group_id)
        .order_by(BookChapter.order)
        .all()
    )
    return [
        {
            "id": ch.id,
            "order": ch.order,
            "start_page": ch.start_page,
            "end_page": ch.end_page,
            "title": ch.title,
            "page_count": page_count(ch.start_page, ch.end_page),
        }
        for ch in chapters
    ]


@router.get("/assignments", response_model=list[ReadingAssignmentResponse])
def list_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all reading assignments."""
    assignments = (
        db.query(ReadingAssignment)
        .filter(ReadingAssignment.group_id == current_user.group_id)
        .order_by(ReadingAssignment.assignment_order)
        .all()
    )
    result = []
    for assignment in assignments:
        chapter_ids = json.loads(assignment.chapters_json)
        if not chapter_ids:
            continue
        chapters = (
            db.query(BookChapter)
            .filter(BookChapter.id.in_(chapter_ids))
            .order_by(BookChapter.order)
            .all()
        )
        chapter_dicts = [
            {
                "id": ch.id,
                "order": ch.order,
                "start_page": ch.start_page,
                "end_page": ch.end_page,
                "title": ch.title,
                "page_count": page_count(ch.start_page, ch.end_page),
            }
            for ch in chapters
        ]
        total = sum(page_count(ch.start_page, ch.end_page) for ch in chapters)
        result.append(
            {
                "id": assignment.id,
                "assignment_order": assignment.assignment_order,
                "chapters": chapter_dicts,
                "total_pages": total,
                "meeting_date": assignment.meeting_date,
            }
        )
    return result


@router.get("/plan", response_model=ReadingPlanStatus)
def get_reading_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Get the current reading plan builder state."""
    return get_plan_status(db, current_user.group)


@router.post("/plan/add-chapter", response_model=ReadingPlanStatus)
def add_chapter_to_assignment(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Add the next chapter to the current reading assignment."""
    result = add_chapter_to_current_assignment(db, current_user.group)
    db.commit()
    return result


@router.post("/plan/finalize", response_model=ReadingAssignmentResponse)
def finalize_assignment(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Finalize the current reading assignment."""
    result = finalize_current_assignment(db, current_user.group)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No chapters to finalize",
        )
    db.commit()
    return result


@router.put(
    "/assignments/{assignment_id}",
    response_model=ReadingAssignmentResponse,
)
def update_assignment(
    assignment_id: int,
    body: AssignmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update the chapters in an existing assignment."""
    try:
        result = update_assignment_chapters(
            db, current_user.group, assignment_id, body.chapter_ids
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    db.commit()
    return result


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete an assignment and renumber remaining ones."""
    try:
        delete_assignment(db, current_user.group, assignment_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    db.commit()
