"""Topics router: CRUD and deck draw."""

from fastapi import APIRouter, Depends

from app.auth import get_current_user
from app.models import User
from app.schemas import TopicCreate, TopicDrawResponse, TopicResponse

router = APIRouter(prefix="/topics", tags=["topics"])


@router.get("/", response_model=list[TopicResponse])
def list_topics(
    _current_user: User = Depends(get_current_user),
) -> list[dict]:
    """List all topics with their deck status."""
    # TODO: implement real query
    return [
        {"id": 1, "name": "Karma", "is_active": True, "is_drawn": False},
        {
            "id": 2,
            "name": "Lovingkindness",
            "is_active": True,
            "is_drawn": True,
        },
    ]


@router.post("/", response_model=TopicResponse)
def create_topic(
    topic_in: TopicCreate,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Add a new topic to the deck."""
    # TODO: implement real creation
    return {"id": 99, "name": topic_in.name, "is_active": True, "is_drawn": False}


@router.delete("/{topic_id}")
def delete_topic(
    topic_id: int,
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Remove a topic from the deck."""
    # TODO: implement real deletion
    return {"detail": f"Topic {topic_id} deleted"}


@router.post("/draw", response_model=TopicDrawResponse)
def draw_topic(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Draw a random topic from the remaining deck."""
    # TODO: implement real deck-of-cards logic
    return {
        "topic": {
            "id": 1,
            "name": "Karma",
            "is_active": True,
            "is_drawn": True,
        },
        "topics_remaining": 6,
        "topics_total": 10,
        "deck_cycle": 1,
    }


@router.post("/reshuffle")
def reshuffle_deck(
    _current_user: User = Depends(get_current_user),
) -> dict:
    """Manually reshuffle the topic deck."""
    # TODO: implement real reshuffle
    return {"detail": "Deck reshuffled", "deck_cycle": 2}
