"""Setup wizard router: onboarding endpoints for new groups."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import FormatRotation, Topic, User
from app.schemas import SetupBasics, SetupBookPosition, SetupRotation, SetupTopics
from app.services import set_chapter_marker

router = APIRouter(prefix="/setup", tags=["setup"])


@router.post("/basics")
def setup_basics(
    data: SetupBasics,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Wizard step 1: set group name, meeting day, time, start date."""
    group = current_user.group
    group.name = data.name
    group.meeting_day = data.meeting_day
    group.meeting_time = data.meeting_time
    group.start_date = data.start_date
    db.commit()
    return {"status": "ok"}


@router.post("/rotation")
def setup_rotation(
    data: SetupRotation,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Wizard step 2: set format rotation."""
    group = current_user.group
    db.query(FormatRotation).filter(
        FormatRotation.group_id == group.id,
    ).delete()
    for i, fmt in enumerate(data.format_rotation):
        db.add(FormatRotation(group_id=group.id, position=i, format_type=fmt))
    db.commit()
    return {"status": "ok"}


@router.post("/topics")
def setup_topics(
    data: SetupTopics,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Wizard step 3: keep selected default topics and add new ones."""
    group = current_user.group
    # Deactivate topics not in keep list
    all_topics = db.query(Topic).filter(Topic.group_id == group.id).all()
    keep_set = set(data.keep_topics)
    for topic in all_topics:
        topic.is_active = topic.name in keep_set
    # Add new topics
    for name in data.new_topics:
        name = name.strip()
        if name:
            db.add(Topic(group_id=group.id, name=name, is_active=True))
    db.commit()
    return {"status": "ok"}


@router.post("/book-position")
def setup_book_position(
    data: SetupBookPosition,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Wizard step 4: set initial book position via chapter marker."""
    try:
        set_chapter_marker(db, current_user.group, data.chapter_order)
        db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    return {"status": "ok"}


@router.post("/complete")
def setup_complete(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Mark setup as completed."""
    group = current_user.group
    group.setup_completed = True
    db.commit()
    return {"status": "ok"}
