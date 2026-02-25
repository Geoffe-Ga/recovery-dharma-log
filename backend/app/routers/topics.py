"""Topics router: CRUD and deck draw."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import MeetingLog, Topic, TopicDeckState, User
from app.schemas import TopicCreate, TopicDrawResponse, TopicResponse
from app.services import (
    draw_random_topic,
    get_deck_stats,
    get_format_for_date,
    get_next_meeting_date,
    reshuffle_deck,
    undo_topic_draw,
)

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("/", response_model=list[TopicResponse])
def list_topics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    """List all topics with their deck status."""
    topics = (
        db.query(Topic)
        .filter(Topic.group_id == current_user.group_id, Topic.is_active.is_(True))
        .all()
    )
    result = []
    for topic in topics:
        drawn_state = (
            db.query(TopicDeckState)
            .filter(
                TopicDeckState.topic_id == topic.id,
                TopicDeckState.is_drawn.is_(True),
            )
            .order_by(TopicDeckState.deck_cycle.desc())
            .first()
        )
        last_log = (
            db.query(MeetingLog)
            .filter(MeetingLog.topic_id == topic.id)
            .order_by(MeetingLog.meeting_date.desc())
            .first()
        )
        result.append(
            {
                "id": topic.id,
                "name": topic.name,
                "is_active": topic.is_active,
                "is_drawn": drawn_state is not None,
                "last_used": last_log.meeting_date if last_log else None,
            }
        )
    return result


@router.post("/", response_model=TopicResponse)
def create_topic(
    topic_in: TopicCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Add a new topic to the deck."""
    topic = Topic(
        group_id=current_user.group_id,
        name=topic_in.name,
        is_active=True,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return {
        "id": topic.id,
        "name": topic.name,
        "is_active": True,
        "is_drawn": False,
        "last_used": None,
    }


@router.delete("/{topic_id}")
def delete_topic(
    topic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Remove a topic from the deck (soft delete)."""
    topic = (
        db.query(Topic)
        .filter(Topic.id == topic_id, Topic.group_id == current_user.group_id)
        .first()
    )
    if not topic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Topic not found",
        )
    topic.is_active = False
    db.commit()
    return {"detail": f"Topic {topic_id} deleted"}


@router.post("/draw", response_model=TopicDrawResponse)
def draw_topic(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Draw a random topic from the remaining deck."""
    group = current_user.group
    topic = draw_random_topic(db, group)

    # Store topic_id in meeting log
    meeting_date = get_next_meeting_date(group)
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == group.id,
            MeetingLog.meeting_date == meeting_date,
        )
        .first()
    )
    if log_entry:
        log_entry.topic_id = topic.id
    else:
        fmt = get_format_for_date(db, group, meeting_date)
        log_entry = MeetingLog(
            group_id=group.id,
            meeting_date=meeting_date,
            format_type=fmt,
            topic_id=topic.id,
        )
        db.add(log_entry)

    remaining, total = get_deck_stats(db, group)
    db.commit()
    return {
        "topic": {
            "id": topic.id,
            "name": topic.name,
            "is_active": topic.is_active,
            "is_drawn": True,
        },
        "topics_remaining": remaining,
        "topics_total": total,
        "deck_cycle": 1,
    }


@router.post("/reshuffle")
def reshuffle(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Manually reshuffle the topic deck."""
    new_cycle = reshuffle_deck(db, current_user.group)
    db.commit()
    return {"detail": "Deck reshuffled", "deck_cycle": new_cycle}


@router.post("/undo")
def undo_draw(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Undo the last topic draw for the next meeting."""
    group = current_user.group
    meeting_date = get_next_meeting_date(group)
    try:
        undo_topic_draw(db, group, meeting_date)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    db.commit()
    return {"detail": "Topic draw undone"}
