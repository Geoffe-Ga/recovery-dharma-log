"""Core business logic for the Recovery Dharma Secretary Log."""

from datetime import date, timedelta
import json
import secrets

from sqlalchemy.orm import Session

from app.models import (
    ActivityLog,
    BookChapter,
    FormatOverride,
    FormatRotation,
    Group,
    MeetingLog,
    ReadingAssignment,
    Topic,
    TopicDeckState,
    User,
)

# --- Page number helpers ---

ROMAN_MAP = {"IX": -6, "X": -5, "XI": -4, "XII": -3, "XIII": -2, "XIV": -1, "XV": 0}


def page_to_int(page: str) -> int:
    """Convert a page string (numeric or roman numeral) to an integer."""
    if page in ROMAN_MAP:
        return ROMAN_MAP[page]
    return int(page)


def page_count(start_page: str, end_page: str) -> int:
    """Calculate the number of pages between start and end."""
    return page_to_int(end_page) - page_to_int(start_page)


def _chapter_to_dict(ch: BookChapter) -> dict:
    """Convert a BookChapter model to a dictionary."""
    return {
        "id": ch.id,
        "order": ch.order,
        "start_page": ch.start_page,
        "end_page": ch.end_page,
        "title": ch.title,
        "page_count": page_count(ch.start_page, ch.end_page),
    }


# --- Activity Logging ---


def log_activity(
    db: Session,
    group: Group,
    user: User,
    action: str,
    details: str | None = None,
) -> None:
    """Record an activity log entry. Failures are silently ignored."""
    try:
        entry = ActivityLog(
            group_id=group.id,
            user_id=user.id,
            action=action,
            details=details,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


# --- Format Rotation Engine ---


def get_rotation_for_group(db: Session, group: Group) -> list[str]:
    """Get the format rotation cycle as an ordered list of format strings."""
    rotations = (
        db.query(FormatRotation)
        .filter(FormatRotation.group_id == group.id)
        .order_by(FormatRotation.position)
        .all()
    )
    if not rotations:
        return ["Speaker", "Topic", "Book Study", "Topic", "Book Study"]
    return [r.format_type for r in rotations]


def get_next_meeting_date(group: Group, after: date | None = None) -> date:
    """Calculate the next meeting date for a group."""
    if after is None:
        after = date.today()
    # Find the next occurrence of meeting_day on or after `after`
    days_ahead = group.meeting_day - after.weekday()
    if days_ahead < 0:
        days_ahead += 7
    if days_ahead == 0:
        return after
    return after + timedelta(days=days_ahead)


def count_meetings_since_start(
    db: Session,
    group: Group,
    up_to: date,
) -> int:
    """Count non-cancelled meetings from start_date up to (not including) a date."""
    cancelled_count = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == group.id,
            MeetingLog.is_cancelled.is_(True),
            MeetingLog.meeting_date >= group.start_date,
            MeetingLog.meeting_date < up_to,
        )
        .count()
    )
    if up_to < group.start_date:
        return 0
    total_weeks = (up_to - group.start_date).days // 7
    return total_weeks - cancelled_count


def get_format_for_date(
    db: Session,
    group: Group,
    meeting_date: date,
) -> str:
    """Determine the format type for a given meeting date.

    Checks for a per-date override first; falls back to the week-of-month
    rotation if no override exists.
    """
    override = (
        db.query(FormatOverride)
        .filter(
            FormatOverride.group_id == group.id,
            FormatOverride.meeting_date == meeting_date,
        )
        .first()
    )
    if override:
        return override.format_type

    rotation = get_rotation_for_group(db, group)
    if not rotation:
        return "Topic"
    week_of_month = (meeting_date.day - 1) // 7
    return rotation[week_of_month % len(rotation)]


# --- Topic Deck Engine ---


def _get_current_cycle(db: Session, group: Group) -> int:
    """Get the current deck cycle number for a group."""
    current_cycle = (
        db.query(TopicDeckState.deck_cycle)
        .filter(TopicDeckState.group_id == group.id)
        .order_by(TopicDeckState.deck_cycle.desc())
        .first()
    )
    return current_cycle[0] if current_cycle else 1


def ensure_deck_initialized(db: Session, group: Group) -> None:
    """Ensure the topic deck is initialized for this group."""
    existing = (
        db.query(TopicDeckState).filter(TopicDeckState.group_id == group.id).count()
    )
    if existing == 0:
        topics = (
            db.query(Topic)
            .filter(Topic.group_id == group.id, Topic.is_active.is_(True))
            .all()
        )
        for topic in topics:
            state = TopicDeckState(
                group_id=group.id,
                topic_id=topic.id,
                is_drawn=False,
                deck_cycle=1,
            )
            db.add(state)
        db.flush()


def get_deck_stats(db: Session, group: Group) -> tuple[int, int]:
    """Return (remaining, total) topics in the current deck."""
    ensure_deck_initialized(db, group)
    cycle = _get_current_cycle(db, group)
    total = (
        db.query(TopicDeckState)
        .filter(
            TopicDeckState.group_id == group.id,
            TopicDeckState.deck_cycle == cycle,
        )
        .count()
    )
    remaining = (
        db.query(TopicDeckState)
        .filter(
            TopicDeckState.group_id == group.id,
            TopicDeckState.deck_cycle == cycle,
            TopicDeckState.is_drawn.is_(False),
        )
        .count()
    )
    return remaining, total


def draw_random_topic(db: Session, group: Group) -> Topic:
    """Draw a random undrawn topic from the deck, reshuffling if needed."""
    ensure_deck_initialized(db, group)

    remaining, _total = get_deck_stats(db, group)
    if remaining == 0:
        reshuffle_deck(db, group)

    cycle = _get_current_cycle(db, group)
    undrawn = (
        db.query(TopicDeckState)
        .filter(
            TopicDeckState.group_id == group.id,
            TopicDeckState.deck_cycle == cycle,
            TopicDeckState.is_drawn.is_(False),
        )
        .all()
    )

    chosen = secrets.choice(undrawn)
    chosen.is_drawn = True
    db.flush()

    topic = db.query(Topic).filter(Topic.id == chosen.topic_id).one()
    return topic


def undo_topic_draw(db: Session, group: Group, meeting_date: date) -> None:
    """Undo a topic draw: return topic to deck and clear from meeting log."""
    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == group.id,
            MeetingLog.meeting_date == meeting_date,
        )
        .first()
    )
    if not log_entry or not log_entry.topic_id:
        raise ValueError("No topic drawn for this meeting")

    # Return topic to deck (mark as undrawn)
    cycle = _get_current_cycle(db, group)
    deck_state = (
        db.query(TopicDeckState)
        .filter(
            TopicDeckState.group_id == group.id,
            TopicDeckState.topic_id == log_entry.topic_id,
            TopicDeckState.deck_cycle == cycle,
            TopicDeckState.is_drawn.is_(True),
        )
        .first()
    )
    if deck_state:
        deck_state.is_drawn = False

    # Clear topic from meeting log
    log_entry.topic_id = None
    db.flush()


def reshuffle_deck(db: Session, group: Group) -> int:
    """Reshuffle the deck by creating a new cycle. Returns new cycle number."""
    current_cycle = _get_current_cycle(db, group)
    new_cycle = current_cycle + 1

    topics = (
        db.query(Topic)
        .filter(Topic.group_id == group.id, Topic.is_active.is_(True))
        .all()
    )
    for topic in topics:
        state = TopicDeckState(
            group_id=group.id,
            topic_id=topic.id,
            is_drawn=False,
            deck_cycle=new_cycle,
        )
        db.add(state)
    db.flush()
    return new_cycle


# --- Book Study Date Projection ---


def get_nth_book_study_date(
    db: Session,
    group: Group,
    n: int,
) -> date | None:
    """Return the date of the Nth Book Study meeting (1-indexed).

    Walks forward from the group's start_date, counting weeks whose
    format is "Book Study" according to get_format_for_date, skipping
    cancelled meetings.
    """
    if n < 1:
        return None

    current = get_next_meeting_date(group, after=group.start_date)
    count = 0
    # Safety cap to avoid infinite loops (10 years of weekly meetings).
    max_iterations = 520
    for _ in range(max_iterations):
        fmt = get_format_for_date(db, group, current)
        if fmt == "Book Study":
            # Check if the meeting is cancelled
            log_entry = (
                db.query(MeetingLog)
                .filter(
                    MeetingLog.group_id == group.id,
                    MeetingLog.meeting_date == current,
                    MeetingLog.is_cancelled.is_(True),
                )
                .first()
            )
            if not log_entry:
                count += 1
                if count == n:
                    return current
        current += timedelta(days=7)
    return None


# --- Book Reading Plan Engine ---


def get_next_unassigned_chapter(db: Session, group: Group) -> BookChapter | None:
    """Get the next chapter that hasn't been assigned yet."""
    assigned_chapter_ids = set()
    assignments = (
        db.query(ReadingAssignment).filter(ReadingAssignment.group_id == group.id).all()
    )
    for assignment in assignments:
        chapter_ids = json.loads(assignment.chapters_json)
        assigned_chapter_ids.update(chapter_ids)

    query = db.query(BookChapter).filter(BookChapter.group_id == group.id)
    if assigned_chapter_ids:
        query = query.filter(~BookChapter.id.in_(assigned_chapter_ids))
    return query.order_by(BookChapter.order).first()


def get_current_draft_assignment(
    db: Session,
    group: Group,
) -> ReadingAssignment | None:
    """Get the current un-finalized reading assignment (the draft)."""
    return (
        db.query(ReadingAssignment)
        .filter(ReadingAssignment.group_id == group.id)
        .order_by(ReadingAssignment.assignment_order.desc())
        .first()
    )


def _chapters_for_ids(db: Session, chapter_ids: list[int]) -> list[dict]:
    """Load chapters by IDs and return as dicts."""
    if not chapter_ids:
        return []
    chapters = (
        db.query(BookChapter)
        .filter(BookChapter.id.in_(chapter_ids))
        .order_by(BookChapter.order)
        .all()
    )
    return [_chapter_to_dict(ch) for ch in chapters]


def _get_plan_progress(
    db: Session,
    group: Group,
    completed: list[dict],
    current_chapters: list[dict],
) -> dict:
    """Compute progress stats and unassigned chapters for the reading plan."""
    all_chapters = db.query(BookChapter).filter(BookChapter.group_id == group.id).all()
    total_chapters = len(all_chapters)
    total_pages = sum(page_count(ch.start_page, ch.end_page) for ch in all_chapters)

    assigned_chapter_ids: set[int] = set()
    for entry in completed:
        for ch in entry["chapters"]:
            assigned_chapter_ids.add(ch["id"])

    assigned_chapters = len(assigned_chapter_ids)
    assigned_pages = sum(
        page_count(ch.start_page, ch.end_page)
        for ch in all_chapters
        if ch.id in assigned_chapter_ids
    )

    # Collect all chapter IDs in any assignment (finalized or current draft)
    all_assigned_ids = set(assigned_chapter_ids)
    for ch in current_chapters:
        all_assigned_ids.add(ch["id"])

    unassigned = [
        _chapter_to_dict(ch) for ch in all_chapters if ch.id not in all_assigned_ids
    ]

    return {
        "unassigned_chapters": unassigned,
        "total_chapters": total_chapters,
        "assigned_chapters": assigned_chapters,
        "total_pages": total_pages,
        "assigned_pages": assigned_pages,
    }


def get_plan_status(db: Session, group: Group) -> dict:
    """Get the full reading plan builder state."""
    assignments = (
        db.query(ReadingAssignment)
        .filter(ReadingAssignment.group_id == group.id)
        .order_by(ReadingAssignment.assignment_order)
        .all()
    )

    current_chapters: list[dict] = []
    current_total_pages = 0
    completed: list[dict] = []

    for i, assignment in enumerate(assignments):
        chapter_ids = json.loads(assignment.chapters_json)
        chapter_dicts = _chapters_for_ids(db, chapter_ids)
        total = sum(int(c["page_count"]) for c in chapter_dicts)

        if i == len(assignments) - 1:
            current_chapters = chapter_dicts
            current_total_pages = total
        else:
            completed.append(
                {
                    "id": assignment.id,
                    "assignment_order": assignment.assignment_order,
                    "chapters": chapter_dicts,
                    "total_pages": total,
                    "meeting_date": assignment.meeting_date,
                }
            )

    next_chapter = get_next_unassigned_chapter(db, group)
    next_chapter_dict = _chapter_to_dict(next_chapter) if next_chapter else None

    progress = _get_plan_progress(db, group, completed, current_chapters)

    return {
        "current_assignment_chapters": current_chapters,
        "current_assignment_total_pages": current_total_pages,
        "next_chapter": next_chapter_dict,
        "completed_assignments": completed,
        **progress,
    }


def add_chapter_to_current_assignment(db: Session, group: Group) -> dict:
    """Add the next chapter to the current draft assignment."""
    next_chapter = get_next_unassigned_chapter(db, group)
    if not next_chapter:
        return get_plan_status(db, group)

    draft = get_current_draft_assignment(db, group)
    if draft is None:
        draft = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json="[]",
        )
        db.add(draft)
        db.flush()

    chapter_ids = json.loads(draft.chapters_json)
    chapter_ids.append(next_chapter.id)
    draft.chapters_json = json.dumps(chapter_ids)
    db.flush()

    return get_plan_status(db, group)


def add_chapters_to_current_assignment(
    db: Session, group: Group, chapter_ids_to_add: list[int]
) -> dict:
    """Add multiple specific chapters to the current draft assignment in one operation."""
    if not chapter_ids_to_add:
        return get_plan_status(db, group)

    # Validate that all chapter IDs belong to this group
    valid_count = (
        db.query(BookChapter)
        .filter(
            BookChapter.id.in_(chapter_ids_to_add),
            BookChapter.group_id == group.id,
        )
        .count()
    )
    if valid_count != len(chapter_ids_to_add):
        raise ValueError("Invalid chapter IDs")

    draft = get_current_draft_assignment(db, group)
    if draft is None:
        draft = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json="[]",
        )
        db.add(draft)
        db.flush()

    existing_ids = json.loads(draft.chapters_json)
    existing_ids.extend(chapter_ids_to_add)
    draft.chapters_json = json.dumps(existing_ids)
    db.flush()

    return get_plan_status(db, group)


def finalize_current_assignment(db: Session, group: Group) -> dict | None:
    """Finalize the current draft and prepare for the next assignment."""
    draft = get_current_draft_assignment(db, group)
    if draft is None:
        return None

    chapter_ids = json.loads(draft.chapters_json)
    if not chapter_ids:
        return None

    # Compute the meeting date for this assignment: it's the Nth Book Study
    # date, where N = this assignment's order.
    meeting_date = get_nth_book_study_date(db, group, draft.assignment_order)
    draft.meeting_date = meeting_date

    chapter_dicts = _chapters_for_ids(db, chapter_ids)
    total = sum(int(c["page_count"]) for c in chapter_dicts)

    new_draft = ReadingAssignment(
        group_id=group.id,
        assignment_order=draft.assignment_order + 1,
        chapters_json="[]",
    )
    db.add(new_draft)
    db.flush()

    return {
        "id": draft.id,
        "assignment_order": draft.assignment_order,
        "chapters": chapter_dicts,
        "total_pages": total,
        "meeting_date": meeting_date,
    }


def update_assignment_chapters(
    db: Session,
    group: Group,
    assignment_id: int,
    chapter_ids: list[int],
) -> dict:
    """Replace the chapters in an existing assignment (finalized or draft)."""
    assignment = (
        db.query(ReadingAssignment)
        .filter(
            ReadingAssignment.id == assignment_id,
            ReadingAssignment.group_id == group.id,
        )
        .first()
    )
    if assignment is None:
        raise ValueError("Assignment not found")

    # Validate that all chapter_ids belong to this group
    if chapter_ids:
        valid_count = (
            db.query(BookChapter)
            .filter(
                BookChapter.id.in_(chapter_ids),
                BookChapter.group_id == group.id,
            )
            .count()
        )
        if valid_count != len(chapter_ids):
            raise ValueError("Invalid chapter IDs")

    assignment.chapters_json = json.dumps(chapter_ids)
    db.flush()

    chapter_dicts = _chapters_for_ids(db, chapter_ids)
    total = sum(int(c["page_count"]) for c in chapter_dicts)
    return {
        "id": assignment.id,
        "assignment_order": assignment.assignment_order,
        "chapters": chapter_dicts,
        "total_pages": total,
        "meeting_date": assignment.meeting_date,
    }


def delete_assignment(db: Session, group: Group, assignment_id: int) -> None:
    """Delete an assignment and renumber remaining ones."""
    assignment = (
        db.query(ReadingAssignment)
        .filter(
            ReadingAssignment.id == assignment_id,
            ReadingAssignment.group_id == group.id,
        )
        .first()
    )
    if assignment is None:
        raise ValueError("Assignment not found")

    deleted_order = assignment.assignment_order
    db.delete(assignment)
    db.flush()

    # Renumber remaining assignments
    remaining = (
        db.query(ReadingAssignment)
        .filter(
            ReadingAssignment.group_id == group.id,
            ReadingAssignment.assignment_order > deleted_order,
        )
        .order_by(ReadingAssignment.assignment_order)
        .all()
    )
    for a in remaining:
        a.assignment_order -= 1
    db.flush()


# --- Upcoming Meeting ---


def _get_topic_details(
    db: Session,
    group: Group,
    log_entry: MeetingLog | None,
) -> tuple[str | None, int, int]:
    """Get topic name and deck stats for a Topic format meeting."""
    topics_remaining, topics_total = get_deck_stats(db, group)
    topic_name = None
    if log_entry and log_entry.topic_id:
        topic = db.query(Topic).filter(Topic.id == log_entry.topic_id).first()
        topic_name = topic.name if topic else None
    return topic_name, topics_remaining, topics_total


def _get_book_chapter_summary(
    db: Session,
    group: Group,
    meeting_date: date,
) -> str | None:
    """Get the book chapter summary for a Book Study format meeting."""
    assignments = (
        db.query(ReadingAssignment)
        .filter(ReadingAssignment.group_id == group.id)
        .order_by(ReadingAssignment.assignment_order)
        .all()
    )
    book_weeks = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == group.id,
            MeetingLog.format_type == "Book Study",
            MeetingLog.is_cancelled.is_(False),
            MeetingLog.meeting_date < meeting_date,
        )
        .count()
    )
    finalized = [a for a in assignments if json.loads(a.chapters_json)]
    if not finalized:
        return None
    idx = book_weeks % len(finalized)
    assignment = finalized[idx]
    chapter_ids = json.loads(assignment.chapters_json)
    chapters = (
        db.query(BookChapter)
        .filter(BookChapter.id.in_(chapter_ids))
        .order_by(BookChapter.order)
        .all()
    )
    titles = " + ".join(ch.title for ch in chapters)
    start_page = chapters[0].start_page
    end_page = chapters[-1].end_page
    total_pages = page_count(start_page, end_page)
    return f"{titles} (pp. {start_page}\u2013{end_page}, {total_pages} pages)"


def get_speaker_banners(db: Session, group: Group) -> list[str]:
    """Check for Speaker weeks within 30 days that lack an assigned speaker."""
    banners: list[str] = []
    today = date.today()
    lookahead = today + timedelta(days=30)
    rotation = get_rotation_for_group(db, group)
    if not rotation:
        return banners

    current = get_next_meeting_date(group, after=today)
    while current <= lookahead:
        fmt = get_format_for_date(db, group, current)
        if fmt == "Speaker":
            log_entry = (
                db.query(MeetingLog)
                .filter(
                    MeetingLog.group_id == group.id,
                    MeetingLog.meeting_date == current,
                )
                .first()
            )
            has_speaker = log_entry and log_entry.speaker_name
            is_cancelled = log_entry and log_entry.is_cancelled
            if not has_speaker and not is_cancelled:
                banners.append(f"No speaker scheduled for {current.strftime('%b %-d')}")
        current += timedelta(days=7)
    return banners


def get_upcoming_meeting_data(db: Session, group: Group) -> dict:
    """Build the full upcoming meeting response."""
    meeting_date = get_next_meeting_date(group)
    format_type = get_format_for_date(db, group, meeting_date)

    log_entry = (
        db.query(MeetingLog)
        .filter(
            MeetingLog.group_id == group.id,
            MeetingLog.meeting_date == meeting_date,
        )
        .first()
    )

    topic_name = None
    speaker_name = None
    book_chapter = None
    topics_remaining = 0
    topics_total = 0

    if format_type == "Topic":
        topic_name, topics_remaining, topics_total = _get_topic_details(
            db,
            group,
            log_entry,
        )

    if format_type == "Speaker" and log_entry and log_entry.speaker_name:
        speaker_name = log_entry.speaker_name

    if format_type == "Book Study":
        book_chapter = _get_book_chapter_summary(db, group, meeting_date)

    banners = get_speaker_banners(db, group)
    is_cancelled = bool(log_entry and log_entry.is_cancelled)
    dana_amount = log_entry.dana_amount if log_entry else None

    return {
        "meeting_date": meeting_date,
        "meeting_time": group.meeting_time,
        "format_type": format_type,
        "is_cancelled": is_cancelled,
        "topic_name": topic_name,
        "speaker_name": speaker_name,
        "book_chapter": book_chapter,
        "topics_remaining": topics_remaining,
        "topics_total": topics_total,
        "banners": banners,
        "dana_amount": dana_amount,
    }


def get_upcoming_meetings(
    db: Session,
    group: Group,
    weeks: int = 4,
) -> list[dict]:
    """Get the next N upcoming meetings with their formats."""
    results: list[dict] = []
    current = get_next_meeting_date(group)

    for _ in range(weeks):
        fmt = get_format_for_date(db, group, current)

        log_entry = (
            db.query(MeetingLog)
            .filter(
                MeetingLog.group_id == group.id,
                MeetingLog.meeting_date == current,
            )
            .first()
        )
        is_cancelled = bool(log_entry and log_entry.is_cancelled)

        results.append(
            {
                "meeting_date": current,
                "meeting_time": group.meeting_time,
                "format_type": fmt,
                "is_cancelled": is_cancelled,
            }
        )
        current += timedelta(days=7)

    return results


# --- Export ---


def _query_meeting_log(
    db: Session,
    group: Group,
    start_date: date | None = None,
    end_date: date | None = None,
    *,
    exclude_cancelled: bool = False,
) -> list[MeetingLog]:
    """Query meeting log entries with optional date range filtering."""
    query = db.query(MeetingLog).filter(MeetingLog.group_id == group.id)
    if exclude_cancelled:
        query = query.filter(MeetingLog.is_cancelled.is_(False))
    if start_date is not None:
        query = query.filter(MeetingLog.meeting_date >= start_date)
    if end_date is not None:
        query = query.filter(MeetingLog.meeting_date <= end_date)
    return query.order_by(MeetingLog.meeting_date).all()


def _format_csv_row(db: Session, group: Group, entry: MeetingLog) -> str:
    """Format a single meeting log entry as a CSV row."""
    topic_name = ""
    if entry.topic_id:
        topic = db.query(Topic).filter(Topic.id == entry.topic_id).first()
        topic_name = topic.name if topic else ""
    book_section = ""
    if entry.format_type == "Book Study" and not entry.is_cancelled:
        summary = _get_book_chapter_summary(db, group, entry.meeting_date)
        if summary:
            book_section = summary
    cancelled = "Yes" if entry.is_cancelled else ""
    speaker = entry.speaker_name or ""
    dana = f"{entry.dana_amount:.2f}" if entry.dana_amount is not None else ""
    return (
        f"{entry.meeting_date},{entry.format_type},"
        f'"{speaker}","{topic_name}","{book_section}",{cancelled},{dana}'
    )


def generate_csv_export(
    db: Session,
    group: Group,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    """Generate CSV content from the meeting log."""
    entries = _query_meeting_log(db, group, start_date, end_date)
    lines = ["date,format,speaker,topic,book_section,cancelled,dana"]
    for entry in entries:
        lines.append(_format_csv_row(db, group, entry))
    return "\n".join(lines) + "\n"


def _format_date_range(start_date: date | None, end_date: date | None) -> str:
    """Format date range for display in the printable export header."""
    if start_date and end_date:
        start_str = start_date.strftime("%B %Y")
        end_str = end_date.strftime("%B %Y")
        if start_str == end_str:
            return start_str
        return f"{start_str} &mdash; {end_str}"
    if start_date:
        return f"From {start_date.strftime('%B %Y')}"
    if end_date:
        return f"Through {end_date.strftime('%B %Y')}"
    return ""


def _get_entry_content(db: Session, group: Group, entry: MeetingLog) -> str:
    """Extract display content from a meeting log entry based on format type."""
    if entry.format_type == "Speaker":
        return entry.speaker_name or "_______________"
    if entry.format_type == "Topic" and entry.topic_id:
        topic = db.query(Topic).filter(Topic.id == entry.topic_id).first()
        return topic.name if topic else ""
    if entry.format_type == "Book Study":
        summary = _get_book_chapter_summary(db, group, entry.meeting_date)
        return summary or ""
    return ""


def _build_export_rows(
    db: Session,
    group: Group,
    entries: list[MeetingLog],
    blank_rows: int,
) -> str:
    """Build HTML table rows for the printable export."""
    rows = []
    for entry in entries:
        content = _get_entry_content(db, group, entry)
        dana = f"${entry.dana_amount:.2f}" if entry.dana_amount is not None else ""
        rows.append(
            f"<tr><td>{entry.meeting_date}</td>"
            f"<td>{entry.format_type}</td>"
            f"<td>{content}</td>"
            f"<td>{dana}</td></tr>"
        )

    for _ in range(blank_rows):
        rows.append(
            '<tr class="blank-row"><td>&nbsp;</td><td></td><td></td><td></td></tr>'
        )

    return "\n".join(rows)


def generate_printable_export(
    db: Session,
    group: Group,
    start_date: date | None = None,
    end_date: date | None = None,
    blank_rows: int = 10,
) -> str:
    """Generate a printable HTML meeting log with RD brand styling."""
    entries = _query_meeting_log(
        db, group, start_date, end_date, exclude_cancelled=True
    )

    table_rows = _build_export_rows(db, group, entries, blank_rows)

    date_range = _format_date_range(start_date, end_date)
    date_range_html = f'<p class="date-range">{date_range}</p>' if date_range else ""

    font_url = "https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Meeting Log - {group.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{font_url}" rel="stylesheet">
<style>
body {{
  font-family: 'Lato', sans-serif;
  max-width: 750px;
  margin: 2em auto;
  color: #333;
}}
h1 {{
  text-align: center;
  color: #1b6b6d;
  margin-bottom: 0.2em;
  font-weight: 700;
}}
.header-rule {{
  border: none;
  border-top: 3px solid #c4922a;
  margin: 0 auto 0.5em auto;
  width: 60%;
}}
.date-range {{
  text-align: center;
  color: #666;
  font-size: 0.95em;
  margin-top: 0;
}}
table {{ width: 100%; border-collapse: collapse; margin-top: 1.2em; }}
th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
th {{
  background: #1b6b6d;
  color: #fff;
  font-weight: 700;
  font-size: 0.9em;
}}
tr:nth-child(even) {{ background: #f7f7f7; }}
.blank-row td {{ height: 1.6em; }}
.footer {{
  text-align: center;
  color: #aaa;
  font-size: 0.8em;
  margin-top: 2em;
}}
@media print {{
  body {{ margin: 0; }}
  .footer {{ color: #ccc; }}
}}
</style>
</head>
<body>
<h1>{group.name}</h1>
<hr class="header-rule">
{date_range_html}
<table>
<thead><tr><th>Date</th><th>Format</th><th>Content</th><th>Dana</th></tr></thead>
<tbody>
{table_rows}
</tbody>
</table>
<p class="footer">Generated from RD Log</p>
</body>
</html>"""
