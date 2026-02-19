"""Seed script for initial data: book chapters and default topics."""

from app.database import SessionLocal
from app.models import BookChapter, Group, Topic

DEFAULT_TOPICS = [
    "Karma",
    "Lovingkindness",
    "Mindfulness of the Body Using Elements",
    "Mindfulness of Feeling Tones",
    "Mindfulness",
    "Spiritual Maturity",
    "What We Mean When We Say Suffering",
    "Mindfulness of the Body Using Breath",
    "Renunciation",
    "5 Precepts",
]

BOOK_CHAPTERS = [
    (1, "IX", "X", "Preface"),
    (2, "X", "XIII", "What is Recovery Dharma?"),
    (3, "XIII", "XV", "Where to Begin"),
    (4, "XV", "1", "The Practice"),
    (5, "1", "7", "Awakening: Buddha"),
    (6, "7", "8", "The Truth: Dharma"),
    (7, "8", "13", "The First Noble Truth"),
    (8, "13", "15", "The Second Noble Truth"),
    (9, "15", "16", "The Third Noble Truth"),
    (10, "16", "17", "The Fourth Noble Truth"),
    (11, "17", "20", "Wise Understanding"),
    (12, "20", "27", "Wise Intention"),
    (13, "27", "29", "Wise Speech"),
    (14, "29", "31", "Wise Action"),
    (15, "31", "32", "Wise Livelihood"),
    (16, "32", "34", "Wise Effort"),
    (17, "34", "37", "Wise Mindfulness"),
    (18, "37", "41", "Wise Concentration"),
    (19, "41", "43", "Community: Sangha"),
    (20, "43", "46", "Isolation and Connection"),
    (21, "46", "49", "Reaching Out"),
    (22, "49", "50", "Wise Friends and Mentors"),
    (23, "50", "53", "Service and Generosity"),
    (24, "53", "57", "Recovery is Possible"),
    (25, "57", "58", "Personal Recovery Stories (Intro)"),
    (26, "58", "62", "Amy's Story"),
    (27, "62", "67", "Chance's Story"),
    (28, "67", "72", "Synyi's Story"),
    (29, "72", "78", "Matthew's Story"),
    (30, "78", "82", "Berlinda's Story"),
    (31, "82", "86", "Jean's Story"),
    (32, "86", "91", "Destiny's Story"),
    (33, "91", "95", "Ned's Story"),
    (34, "95", "100", "Kara's Story"),
    (35, "100", "105", "Unity's Story"),
    (36, "105", "109", "Randall's Story"),
    (37, "109", "113", "Lacey's Story"),
    (38, "113", "117", "Paul's Story"),
    (39, "117", "122", "Eunsung's Story"),
]


def seed_group(group_id: int) -> None:
    """Seed a group with default topics and book chapters."""
    db = SessionLocal()
    try:
        for topic_name in DEFAULT_TOPICS:
            topic = Topic(group_id=group_id, name=topic_name, is_active=True)
            db.add(topic)

        for order, start_page, end_page, title in BOOK_CHAPTERS:
            chapter = BookChapter(
                group_id=group_id,
                order=order,
                start_page=start_page,
                end_page=end_page,
                title=title,
            )
            db.add(chapter)

        db.commit()
    finally:
        db.close()


def seed_all() -> None:
    """Seed all groups. Creates a default group if none exist."""
    db = SessionLocal()
    try:
        groups = db.query(Group).all()
        if not groups:
            return
        for group in groups:
            existing_topics = db.query(Topic).filter(Topic.group_id == group.id).count()
            if existing_topics == 0:
                seed_group(group.id)
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
