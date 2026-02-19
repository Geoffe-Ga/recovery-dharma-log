"""Book router: chapters and reading assignments."""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas import (
    BookChapterResponse,
    ReadingAssignmentResponse,
    ReadingPlanStatus,
)

router = APIRouter(prefix="/book", tags=["book"])


@router.get("/chapters", response_model=list[BookChapterResponse])
def list_chapters(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all book chapters."""
    # TODO: implement real query
    return [
        {
            "id": 1,
            "order": 1,
            "start_page": "IX",
            "end_page": "X",
            "title": "Preface",
            "page_count": 1,
        },
        {
            "id": 2,
            "order": 2,
            "start_page": "X",
            "end_page": "XIII",
            "title": "What is Recovery Dharma?",
            "page_count": 3,
        },
    ]


@router.get("/assignments", response_model=list[ReadingAssignmentResponse])
def list_assignments(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all reading assignments."""
    # TODO: implement real query
    return [
        {
            "id": 1,
            "assignment_order": 1,
            "chapters": [
                {
                    "id": 1,
                    "order": 1,
                    "start_page": "IX",
                    "end_page": "X",
                    "title": "Preface",
                    "page_count": 1,
                },
            ],
            "total_pages": 1,
        },
    ]


@router.get("/plan", response_model=ReadingPlanStatus)
def get_reading_plan(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Get the current reading plan builder state."""
    # TODO: implement real logic
    return {
        "current_assignment_chapters": [],
        "current_assignment_total_pages": 0,
        "next_chapter": {
            "id": 1,
            "order": 1,
            "start_page": "IX",
            "end_page": "X",
            "title": "Preface",
            "page_count": 1,
        },
        "completed_assignments": [],
    }


@router.post("/plan/add-chapter", response_model=ReadingPlanStatus)
def add_chapter_to_assignment(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Add the next chapter to the current reading assignment."""
    # TODO: implement real logic
    return {
        "current_assignment_chapters": [
            {
                "id": 1,
                "order": 1,
                "start_page": "IX",
                "end_page": "X",
                "title": "Preface",
                "page_count": 1,
            },
        ],
        "current_assignment_total_pages": 1,
        "next_chapter": {
            "id": 2,
            "order": 2,
            "start_page": "X",
            "end_page": "XIII",
            "title": "What is Recovery Dharma?",
            "page_count": 3,
        },
        "completed_assignments": [],
    }


@router.post("/plan/finalize", response_model=ReadingAssignmentResponse)
def finalize_assignment(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Finalize the current reading assignment."""
    # TODO: implement real logic
    return {
        "id": 1,
        "assignment_order": 1,
        "chapters": [
            {
                "id": 1,
                "order": 1,
                "start_page": "IX",
                "end_page": "X",
                "title": "Preface",
                "page_count": 1,
            },
        ],
        "total_pages": 1,
    }
