"""Tests for core business logic in services module."""

from datetime import date
import json

import pytest
from sqlalchemy.orm import Session

from app.models import (
    BookChapter,
    FormatOverride,
    FormatRotation,
    Group,
    MeetingLog,
    ReadingAssignment,
    Topic,
)
from app.services import (
    add_chapter_to_current_assignment,
    add_chapters_to_current_assignment,
    advance_book_position,
    count_meetings_since_start,
    delete_assignment,
    draw_random_topic,
    finalize_current_assignment,
    generate_csv_export,
    generate_printable_export,
    get_book_position,
    get_current_draft_assignment,
    get_deck_stats,
    get_format_for_date,
    get_next_meeting_date,
    get_nth_book_study_date,
    get_plan_status,
    get_rotation_for_group,
    get_upcoming_meeting_data,
    get_upcoming_meetings,
    page_count,
    page_to_int,
    reshuffle_deck,
    restart_book,
    set_book_position,
    set_chapter_marker,
    undo_topic_draw,
    update_assignment_chapters,
)


def _create_group(db: Session, start: date = date(2025, 1, 5)) -> Group:
    """Helper to create a test group with default 5-week rotation."""
    group = Group(name="Test Meeting", meeting_day=6, start_date=start)
    db.add(group)
    db.flush()
    # Default rotation: Speaker, Topic, Book Study, Topic, Book Study
    for i, fmt in enumerate(["Speaker", "Topic", "Book Study", "Topic", "Book Study"]):
        db.add(FormatRotation(group_id=group.id, position=i, format_type=fmt))
    db.flush()
    return group


def _create_group_no_rotation(db: Session) -> Group:
    """Helper to create a test group without format rotation."""
    group = Group(name="Bare Group", meeting_day=6, start_date=date(2025, 1, 5))
    db.add(group)
    db.flush()
    return group


def _create_topics(db: Session, group: Group, count: int = 3) -> list[Topic]:
    """Helper to create test topics."""
    topics = []
    for i in range(count):
        t = Topic(group_id=group.id, name=f"Topic {i + 1}", is_active=True)
        db.add(t)
        topics.append(t)
    db.flush()
    return topics


def _create_chapters(db: Session, group: Group) -> list[BookChapter]:
    """Helper to create a few test chapters."""
    chapters_data = [
        (1, "IX", "X", "Preface"),
        (2, "X", "XIII", "What is Recovery Dharma?"),
        (3, "XIII", "XV", "Where to Begin"),
    ]
    chapters = []
    for order, start, end, title in chapters_data:
        ch = BookChapter(
            group_id=group.id,
            order=order,
            start_page=start,
            end_page=end,
            title=title,
        )
        db.add(ch)
        chapters.append(ch)
    db.flush()
    return chapters


class TestPageHelpers:
    """Tests for page number conversion."""

    def test_roman_numeral_conversion(self) -> None:
        assert page_to_int("IX") == -6
        assert page_to_int("XIII") == -2
        assert page_to_int("XV") == 0

    def test_numeric_conversion(self) -> None:
        assert page_to_int("1") == 1
        assert page_to_int("122") == 122

    def test_page_count_roman(self) -> None:
        assert page_count("IX", "X") == 1
        assert page_count("X", "XIII") == 3

    def test_page_count_numeric(self) -> None:
        assert page_count("1", "7") == 6

    def test_page_count_roman_to_numeric(self) -> None:
        assert page_count("XV", "1") == 1  # crossing boundary


class TestFormatRotation:
    """Tests for the format rotation engine (week-of-month based)."""

    def test_first_sunday_is_speaker(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 5, 2025 is the 1st Sunday → position 0 = Speaker
        fmt = get_format_for_date(db_session, group, date(2025, 1, 5))
        assert fmt == "Speaker"

    def test_second_sunday_is_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 12 is the 2nd Sunday → position 1 = Topic
        fmt = get_format_for_date(db_session, group, date(2025, 1, 12))
        assert fmt == "Topic"

    def test_third_sunday_is_book_study(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 19 is the 3rd Sunday → position 2 = Book Study
        fmt = get_format_for_date(db_session, group, date(2025, 1, 19))
        assert fmt == "Book Study"

    def test_fourth_sunday_is_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 26 is the 4th Sunday → position 3 = Topic
        fmt = get_format_for_date(db_session, group, date(2025, 1, 26))
        assert fmt == "Topic"

    def test_rotation_resets_each_month(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Feb 2 is the 1st Sunday of February → position 0 = Speaker (resets!)
        fmt = get_format_for_date(db_session, group, date(2025, 2, 2))
        assert fmt == "Speaker"

    def test_cancellation_does_not_shift_rotation(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Cancel the 2nd Sunday (Jan 12)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 12),
                format_type="Topic",
                is_cancelled=True,
            )
        )
        db_session.flush()
        # 3rd Sunday (Jan 19) is still Book Study, not shifted
        fmt = get_format_for_date(db_session, group, date(2025, 1, 19))
        assert fmt == "Book Study"

    def test_default_rotation_when_none_configured(self, db_session: Session) -> None:
        group = _create_group_no_rotation(db_session)
        rotation = get_rotation_for_group(db_session, group)
        assert rotation == ["Speaker", "Topic", "Book Study", "Topic", "Book Study"]

    def test_count_meetings_before_start_returns_zero(
        self, db_session: Session
    ) -> None:
        group = _create_group(db_session)
        count = count_meetings_since_start(db_session, group, date(2024, 12, 1))
        assert count == 0


class TestFormatOverrides:
    """Tests for per-date format overrides."""

    def test_override_takes_precedence(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 5, 2025 is normally Speaker (position 0)
        assert get_format_for_date(db_session, group, date(2025, 1, 5)) == "Speaker"
        # Add an override to make it Topic
        db_session.add(
            FormatOverride(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Topic",
            )
        )
        db_session.flush()
        assert get_format_for_date(db_session, group, date(2025, 1, 5)) == "Topic"

    def test_override_does_not_affect_other_dates(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            FormatOverride(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Book Study",
            )
        )
        db_session.flush()
        # Jan 12 should still follow the rotation (Topic)
        assert get_format_for_date(db_session, group, date(2025, 1, 12)) == "Topic"

    def test_override_does_not_shift_rotation(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Override Jan 5 from Speaker to Topic
        db_session.add(
            FormatOverride(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Topic",
            )
        )
        db_session.flush()
        # Other weeks still follow rotation by week-of-month
        assert get_format_for_date(db_session, group, date(2025, 1, 19)) == "Book Study"
        assert get_format_for_date(db_session, group, date(2025, 1, 26)) == "Topic"

    def test_override_with_book_study(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Jan 12 is normally Topic, override to Book Study
        db_session.add(
            FormatOverride(
                group_id=group.id,
                meeting_date=date(2025, 1, 12),
                format_type="Book Study",
            )
        )
        db_session.flush()
        assert get_format_for_date(db_session, group, date(2025, 1, 12)) == "Book Study"


class TestNextMeetingDate:
    """Tests for next meeting date calculation."""

    def test_meeting_day_ahead(self) -> None:
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        # Monday Jan 6 -> next Sunday Jan 12
        result = get_next_meeting_date(group, after=date(2025, 1, 6))
        assert result == date(2025, 1, 12)

    def test_meeting_day_today(self) -> None:
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        # Sunday Jan 5 -> today
        result = get_next_meeting_date(group, after=date(2025, 1, 5))
        assert result == date(2025, 1, 5)

    def test_meeting_day_yesterday(self) -> None:
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        # Monday after Sunday -> next Sunday
        result = get_next_meeting_date(group, after=date(2025, 1, 13))
        assert result == date(2025, 1, 19)

    def test_default_after_uses_today(self) -> None:
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        result = get_next_meeting_date(group)
        # Should return a date (whatever the next Sunday is from today)
        assert result.weekday() == 6  # Sunday


class TestTopicDeck:
    """Tests for the topic deck draw system."""

    def test_initial_deck_stats(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=5)
        remaining, total = get_deck_stats(db_session, group)
        assert remaining == 5
        assert total == 5

    def test_draw_reduces_remaining(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=5)
        draw_random_topic(db_session, group)
        remaining, total = get_deck_stats(db_session, group)
        assert remaining == 4
        assert total == 5

    def test_draw_returns_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        topics = _create_topics(db_session, group, count=3)
        drawn = draw_random_topic(db_session, group)
        assert drawn.name in [t.name for t in topics]

    def test_draw_all_triggers_reshuffle(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=2)
        draw_random_topic(db_session, group)
        draw_random_topic(db_session, group)
        # All drawn, next draw should auto-reshuffle
        drawn = draw_random_topic(db_session, group)
        assert drawn is not None
        remaining, total = get_deck_stats(db_session, group)
        assert total == 2
        assert remaining == 1  # drew 1 from new deck

    def test_manual_reshuffle(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        draw_random_topic(db_session, group)
        new_cycle = reshuffle_deck(db_session, group)
        assert new_cycle == 2
        remaining, total = get_deck_stats(db_session, group)
        assert remaining == 3
        assert total == 3


class TestUndoTopicDraw:
    """Tests for undoing a topic draw."""

    def test_undo_returns_topic_to_deck(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        drawn = draw_random_topic(db_session, group)

        # Create a meeting log with the drawn topic
        meeting_date = date(2025, 1, 12)
        log_entry = MeetingLog(
            group_id=group.id,
            meeting_date=meeting_date,
            format_type="Topic",
            topic_id=drawn.id,
        )
        db_session.add(log_entry)
        db_session.flush()

        # Before undo: 2 remaining
        remaining, _total = get_deck_stats(db_session, group)
        assert remaining == 2

        undo_topic_draw(db_session, group, meeting_date)

        # After undo: 3 remaining (topic returned to deck)
        remaining, _total = get_deck_stats(db_session, group)
        assert remaining == 3

        # Log entry no longer has topic_id
        db_session.refresh(log_entry)
        assert log_entry.topic_id is None

    def test_undo_raises_when_no_topic_drawn(self, db_session: Session) -> None:
        group = _create_group(db_session)
        meeting_date = date(2025, 1, 12)

        with pytest.raises(ValueError, match="No topic drawn"):
            undo_topic_draw(db_session, group, meeting_date)

    def test_undo_raises_when_log_has_no_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        meeting_date = date(2025, 1, 12)
        log_entry = MeetingLog(
            group_id=group.id,
            meeting_date=meeting_date,
            format_type="Topic",
        )
        db_session.add(log_entry)
        db_session.flush()

        with pytest.raises(ValueError, match="No topic drawn"):
            undo_topic_draw(db_session, group, meeting_date)


class TestBookReadingPlan:
    """Tests for the book reading plan builder."""

    def test_initial_plan_status(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        status = get_plan_status(db_session, group)
        assert status["current_assignment_chapters"] == []
        assert status["next_chapter"] is not None
        assert status["next_chapter"]["title"] == "Preface"

    def test_add_chapter(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        status = add_chapter_to_current_assignment(db_session, group)
        assert len(status["current_assignment_chapters"]) == 1
        assert status["current_assignment_chapters"][0]["title"] == "Preface"
        assert status["next_chapter"]["title"] == "What is Recovery Dharma?"

    def test_add_multiple_chapters(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        status = add_chapter_to_current_assignment(db_session, group)
        assert len(status["current_assignment_chapters"]) == 2
        assert status["current_assignment_total_pages"] == 4  # 1 + 3

    def test_batch_add_creates_draft(self, db_session: Session) -> None:
        group = _create_group(db_session)
        chapters = _create_chapters(db_session, group)
        ids = [chapters[0].id, chapters[1].id]
        status = add_chapters_to_current_assignment(db_session, group, ids)
        assert len(status["current_assignment_chapters"]) == 2
        titles = [c["title"] for c in status["current_assignment_chapters"]]
        assert "Preface" in titles
        assert "What is Recovery Dharma?" in titles

    def test_batch_add_extends_existing_draft(self, db_session: Session) -> None:
        group = _create_group(db_session)
        chapters = _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        status = add_chapters_to_current_assignment(db_session, group, [chapters[1].id])
        assert len(status["current_assignment_chapters"]) == 2

    def test_batch_add_deduplicates_input(self, db_session: Session) -> None:
        group = _create_group(db_session)
        chapters = _create_chapters(db_session, group)
        cid = chapters[0].id
        status = add_chapters_to_current_assignment(db_session, group, [cid, cid, cid])
        assert len(status["current_assignment_chapters"]) == 1

    def test_batch_add_invalid_group_raises(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        with pytest.raises(ValueError, match="Invalid chapter IDs"):
            add_chapters_to_current_assignment(db_session, group, [9999])

    def test_batch_add_empty_returns_status(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        status = add_chapters_to_current_assignment(db_session, group, [])
        assert status["current_assignment_chapters"] == []

    def test_finalize_assignment(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        result = finalize_current_assignment(db_session, group)
        assert result is not None
        assert result["assignment_order"] == 1
        assert len(result["chapters"]) == 2
        assert result["total_pages"] == 4

    def test_finalize_creates_new_draft(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)
        # After finalize of 1 chapter, plan shows empty current + next unassigned
        status = get_plan_status(db_session, group)
        assert status["current_assignment_chapters"] == []
        assert status["next_chapter"]["title"] == "What is Recovery Dharma?"
        assert len(status["completed_assignments"]) == 1

    def test_finalize_no_draft_returns_none(self, db_session: Session) -> None:
        group = _create_group(db_session)
        result = finalize_current_assignment(db_session, group)
        assert result is None

    def test_finalize_empty_draft_returns_none(self, db_session: Session) -> None:
        group = _create_group(db_session)
        # Create an empty draft assignment
        db_session.add(
            ReadingAssignment(group_id=group.id, assignment_order=1, chapters_json="[]")
        )
        db_session.flush()
        result = finalize_current_assignment(db_session, group)
        assert result is None

    def test_add_chapter_when_all_assigned(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        # Add all 3 chapters
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        # Try to add another - should return status with no next chapter
        status = add_chapter_to_current_assignment(db_session, group)
        assert status["next_chapter"] is None

    def test_plan_status_no_chapters(self, db_session: Session) -> None:
        group = _create_group(db_session)
        status = get_plan_status(db_session, group)
        assert status["current_assignment_chapters"] == []
        assert status["next_chapter"] is None
        assert status["completed_assignments"] == []

    def test_plan_status_unassigned_chapters(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)  # 3 chapters

        # Initially all chapters are unassigned
        status = get_plan_status(db_session, group)
        assert len(status["unassigned_chapters"]) == 3
        assert status["unassigned_chapters"][0]["title"] == "Preface"

        # Add one chapter to draft
        add_chapter_to_current_assignment(db_session, group)
        status = get_plan_status(db_session, group)
        assert len(status["unassigned_chapters"]) == 2
        assert status["unassigned_chapters"][0]["title"] == "What is Recovery Dharma?"

        # Finalize and add another
        finalize_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        status = get_plan_status(db_session, group)
        # 1 finalized + 1 in draft = 2 assigned, 1 unassigned
        assert len(status["unassigned_chapters"]) == 1
        assert status["unassigned_chapters"][0]["title"] == "Where to Begin"

    def test_plan_status_unassigned_empty_when_all_assigned(
        self, db_session: Session
    ) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)  # 3 chapters
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        status = get_plan_status(db_session, group)
        assert status["unassigned_chapters"] == []

    def test_plan_status_progress_fields(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)  # 3 chapters: 1 + 3 + 2 = 6 pages

        # Initially no chapters assigned
        status = get_plan_status(db_session, group)
        assert status["total_chapters"] == 3
        assert status["assigned_chapters"] == 0
        assert status["total_pages"] == 6
        assert status["assigned_pages"] == 0

        # Add and finalize first chapter (1 page)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)

        status = get_plan_status(db_session, group)
        assert status["total_chapters"] == 3
        assert status["assigned_chapters"] == 1
        assert status["total_pages"] == 6
        assert status["assigned_pages"] == 1

        # Add and finalize second chapter (3 pages)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)

        status = get_plan_status(db_session, group)
        assert status["assigned_chapters"] == 2
        assert status["assigned_pages"] == 4


class TestBookStudyDateProjection:
    """Tests for computing Book Study meeting dates."""

    def test_first_book_study_date(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        # Rotation: Speaker, Topic, Book Study, Topic, Book Study
        # Week-of-month: 1st Sun=Speaker, 2nd=Topic, 3rd=Book Study
        result = get_nth_book_study_date(db_session, group, 1)
        assert result == date(2025, 1, 19)  # 3rd Sunday of Jan 2025

    def test_second_book_study_date(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        # Week-of-month position 2 = Book Study. Jan 19 is first, Feb 16 is second.
        result = get_nth_book_study_date(db_session, group, 2)
        assert result == date(2025, 2, 16)  # 3rd Sunday of Feb 2025

    def test_invalid_n_returns_none(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        assert get_nth_book_study_date(db_session, group, 0) is None
        assert get_nth_book_study_date(db_session, group, -1) is None

    def test_skips_cancelled_book_study(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        # Cancel the first Book Study (3rd Sunday = Jan 19)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 19),
                format_type="Book Study",
                is_cancelled=True,
            )
        )
        db_session.flush()
        # The 1st non-cancelled Book Study should skip Jan 19
        result = get_nth_book_study_date(db_session, group, 1)
        assert result != date(2025, 1, 19)
        assert result is not None

    def test_finalize_sets_meeting_date(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        result = finalize_current_assignment(db_session, group)
        assert result is not None
        assert result["meeting_date"] == date(2025, 1, 19)

    def test_finalize_second_assignment_gets_second_date(
        self, db_session: Session
    ) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_chapters(db_session, group)
        # Finalize first assignment
        add_chapter_to_current_assignment(db_session, group)
        result1 = finalize_current_assignment(db_session, group)
        assert result1 is not None

        # Finalize second assignment
        add_chapter_to_current_assignment(db_session, group)
        result2 = finalize_current_assignment(db_session, group)
        assert result2 is not None
        assert result2["meeting_date"] is not None
        # Second date should be after first
        assert result2["meeting_date"] > result1["meeting_date"]

    def test_plan_status_includes_meeting_date(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)
        status = get_plan_status(db_session, group)
        assert len(status["completed_assignments"]) == 1
        assert status["completed_assignments"][0]["meeting_date"] == date(2025, 1, 19)


class TestAssignmentEditing:
    """Tests for editing and deleting finalized assignments."""

    def test_update_assignment_chapters(self, db_session: Session) -> None:
        group = _create_group(db_session)
        chapters = _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        result = finalize_current_assignment(db_session, group)
        assert result is not None

        # Update to only have the first chapter
        updated = update_assignment_chapters(
            db_session, group, result["id"], [chapters[0].id]
        )
        assert len(updated["chapters"]) == 1
        assert updated["chapters"][0]["title"] == "Preface"

    def test_update_assignment_not_found(self, db_session: Session) -> None:
        group = _create_group(db_session)
        with pytest.raises(ValueError, match="Assignment not found"):
            update_assignment_chapters(db_session, group, 9999, [])

    def test_update_assignment_invalid_chapter_ids(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        result = finalize_current_assignment(db_session, group)
        assert result is not None

        with pytest.raises(ValueError, match="Invalid chapter IDs"):
            update_assignment_chapters(db_session, group, result["id"], [9999])

    def test_delete_assignment(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        # Create two finalized assignments
        add_chapter_to_current_assignment(db_session, group)
        result1 = finalize_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        result2 = finalize_current_assignment(db_session, group)
        assert result1 is not None
        assert result2 is not None

        # Delete the first assignment
        delete_assignment(db_session, group, result1["id"])

        # Second assignment should be renumbered to order 1
        status = get_plan_status(db_session, group)
        assert len(status["completed_assignments"]) == 1
        assert status["completed_assignments"][0]["assignment_order"] == 1

    def test_delete_assignment_adjusts_position(self, db_session: Session) -> None:
        """Deleting an assignment before current position shifts index down."""
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        # Create three finalized assignments
        add_chapter_to_current_assignment(db_session, group)
        a1 = finalize_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)
        assert a1 is not None

        # Set position to assignment index 2 (third assignment)
        set_book_position(db_session, group, 2)
        assert group.current_book_assignment_index == 2

        # Delete first assignment — position should shift down to 1
        delete_assignment(db_session, group, a1["id"])
        assert group.current_book_assignment_index == 1

    def test_delete_last_assignment_clamps_position(self, db_session: Session) -> None:
        """Deleting the last assignment when positioned at it clamps to 0."""
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        a1 = finalize_current_assignment(db_session, group)
        assert a1 is not None
        assert group.current_book_assignment_index == 0

        # Delete the only assignment — index should reset to 0
        delete_assignment(db_session, group, a1["id"])
        assert group.current_book_assignment_index == 0

    def test_delete_assignment_not_found(self, db_session: Session) -> None:
        group = _create_group(db_session)
        with pytest.raises(ValueError, match="Assignment not found"):
            delete_assignment(db_session, group, 9999)


class TestUpcomingMeeting:
    """Tests for the upcoming meeting aggregation."""

    def test_returns_meeting_data(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=5)
        data = get_upcoming_meeting_data(db_session, group)
        assert "meeting_date" in data
        assert "format_type" in data
        assert data["format_type"] in ["Speaker", "Topic", "Book Study"]
        assert data["is_cancelled"] is False

    def test_cancelled_meeting_returns_is_cancelled_true(
        self, db_session: Session
    ) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)
        next_date = get_next_meeting_date(group)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=next_date,
                format_type="Topic",
                is_cancelled=True,
            )
        )
        db_session.flush()
        data = get_upcoming_meeting_data(db_session, group)
        assert data["is_cancelled"] is True

    def test_includes_meeting_time(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)
        data = get_upcoming_meeting_data(db_session, group)
        assert "meeting_time" in data
        assert data["meeting_time"] == group.meeting_time

    def test_topic_week_shows_deck_stats(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=5)
        data = get_upcoming_meeting_data(db_session, group)
        assert "topics_remaining" in data
        assert "topics_total" in data

    def test_speaker_week_with_logged_speaker(self, db_session: Session) -> None:
        # Start date is a Sunday, first week is Speaker
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)
        # Find the next meeting date
        meeting_date = get_next_meeting_date(group)
        fmt = get_format_for_date(db_session, group, meeting_date)
        if fmt == "Speaker":
            # Log a speaker for this date
            db_session.add(
                MeetingLog(
                    group_id=group.id,
                    meeting_date=meeting_date,
                    format_type="Speaker",
                    speaker_name="Jane Doe",
                )
            )
            db_session.flush()
            data = get_upcoming_meeting_data(db_session, group)
            assert data["speaker_name"] == "Jane Doe"

    def test_book_study_week_with_assignment(self, db_session: Session) -> None:
        # Use a start date where the third week (Book Study) is reachable
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)
        _create_chapters(db_session, group)

        # Create a finalized reading assignment
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)

        # Test the helper directly for a Book Study week
        from app.services import _get_book_chapter_summary

        summary = _get_book_chapter_summary(
            db_session,
            group,
            date(2025, 1, 19),  # 3rd week = Book Study
        )
        assert summary is not None
        assert "Preface" in summary
        assert "pp." in summary
        assert "pages" in summary

    def test_book_study_no_assignments_returns_none(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        from app.services import _get_book_chapter_summary

        summary = _get_book_chapter_summary(db_session, group, date(2025, 1, 19))
        assert summary is None

    def test_topic_details_with_logged_topic(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        topics = _create_topics(db_session, group, count=3)
        log_entry = MeetingLog(
            group_id=group.id,
            meeting_date=date(2025, 1, 12),
            format_type="Topic",
            topic_id=topics[0].id,
        )
        db_session.add(log_entry)
        db_session.flush()

        from app.services import _get_topic_details

        name, _remaining, total = _get_topic_details(db_session, group, log_entry)
        assert name == "Topic 1"
        assert total == 3

    def test_topic_details_without_log_entry(self, db_session: Session) -> None:
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)

        from app.services import _get_topic_details

        name, _remaining, total = _get_topic_details(db_session, group, None)
        assert name is None
        assert total == 3

    def test_grace_period_shows_meeting_day_after(
        self, db_session: Session
    ) -> None:
        """On the day after a meeting, the landing page still shows it."""
        from unittest.mock import patch

        # Meeting day is Sunday (6), start_date is Sun Jan 5 2025
        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=5)

        # On Monday Jan 6 (day after the Jan 5 meeting), should still show Jan 5
        with patch("app.services.date") as mock_date:
            mock_date.today.return_value = date(2025, 1, 6)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            data = get_upcoming_meeting_data(db_session, group)
        assert data["meeting_date"] == date(2025, 1, 5)

    def test_grace_period_advances_two_days_after(
        self, db_session: Session
    ) -> None:
        """Two days after a meeting, the landing page shows the next one."""
        from unittest.mock import patch

        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=5)

        # On Tuesday Jan 7 (two days after), should show next Sunday Jan 12
        with patch("app.services.date") as mock_date:
            mock_date.today.return_value = date(2025, 1, 7)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            data = get_upcoming_meeting_data(db_session, group)
        assert data["meeting_date"] == date(2025, 1, 12)

    def test_grace_period_shows_meeting_on_meeting_day(
        self, db_session: Session
    ) -> None:
        """On meeting day itself, the landing page shows today's meeting."""
        from unittest.mock import patch

        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=5)

        # On Sunday Jan 5 (meeting day), should show Jan 5
        with patch("app.services.date") as mock_date:
            mock_date.today.return_value = date(2025, 1, 5)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            data = get_upcoming_meeting_data(db_session, group)
        assert data["meeting_date"] == date(2025, 1, 5)


class TestSpeakerBanners:
    """Tests for speaker banner warnings."""

    def test_no_banners_when_speaker_scheduled(self, db_session: Session) -> None:
        group = _create_group(db_session)
        from app.services import get_speaker_banners

        # Schedule a speaker for every speaker week in next 30 days
        meeting_date = get_next_meeting_date(group)
        from datetime import timedelta

        current = meeting_date
        lookahead = date.today() + timedelta(days=30)
        while current <= lookahead:
            fmt = get_format_for_date(db_session, group, current)
            if fmt == "Speaker":
                db_session.add(
                    MeetingLog(
                        group_id=group.id,
                        meeting_date=current,
                        format_type="Speaker",
                        speaker_name="Jane",
                    )
                )
            current += timedelta(days=7)
        db_session.flush()

        banners = get_speaker_banners(db_session, group)
        assert banners == []

    def test_banner_for_unscheduled_speaker_week(self, db_session: Session) -> None:
        group = _create_group(db_session)
        from app.services import get_speaker_banners

        banners = get_speaker_banners(db_session, group)
        # Depending on today's date relative to start, there may or may not
        # be a speaker week in the next 30 days. Just verify it returns a list.
        assert isinstance(banners, list)

    def test_banners_included_in_upcoming_data(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        data = get_upcoming_meeting_data(db_session, group)
        assert "banners" in data
        assert isinstance(data["banners"], list)


class TestUpcomingMeetings:
    """Tests for multi-week lookahead."""

    def test_returns_correct_count(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        result = get_upcoming_meetings(db_session, group, weeks=4)
        assert len(result) == 4

    def test_meetings_are_weekly(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        result = get_upcoming_meetings(db_session, group, weeks=3)
        dates = [r["meeting_date"] for r in result]
        assert (dates[1] - dates[0]).days == 7
        assert (dates[2] - dates[1]).days == 7

    def test_includes_format_type(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        result = get_upcoming_meetings(db_session, group, weeks=1)
        assert result[0]["format_type"] in ["Speaker", "Topic", "Book Study"]

    def test_cancelled_meeting_shown(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_topics(db_session, group, count=3)
        next_date = get_next_meeting_date(group)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=next_date,
                format_type="Topic",
                is_cancelled=True,
            )
        )
        db_session.flush()
        result = get_upcoming_meetings(db_session, group, weeks=1)
        assert result[0]["is_cancelled"] is True

    def test_grace_period_includes_meeting_day_after(
        self, db_session: Session
    ) -> None:
        """On the day after a meeting, the lookahead still starts with it."""
        from unittest.mock import patch

        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)

        # Monday Jan 6 (day after Sunday Jan 5 meeting)
        with patch("app.services.date") as mock_date:
            mock_date.today.return_value = date(2025, 1, 6)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            result = get_upcoming_meetings(db_session, group, weeks=2)
        assert result[0]["meeting_date"] == date(2025, 1, 5)
        assert result[1]["meeting_date"] == date(2025, 1, 12)

    def test_grace_period_advances_two_days_after(
        self, db_session: Session
    ) -> None:
        """Two days after a meeting, the lookahead starts with next meeting."""
        from unittest.mock import patch

        group = _create_group(db_session, start=date(2025, 1, 5))
        _create_topics(db_session, group, count=3)

        # Tuesday Jan 7 (two days after)
        with patch("app.services.date") as mock_date:
            mock_date.today.return_value = date(2025, 1, 7)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            result = get_upcoming_meetings(db_session, group, weeks=2)
        assert result[0]["meeting_date"] == date(2025, 1, 12)
        assert result[1]["meeting_date"] == date(2025, 1, 19)


class TestExport:
    """Tests for CSV and printable export generation."""

    def test_csv_export_empty(self, db_session: Session) -> None:
        group = _create_group(db_session)

        csv = generate_csv_export(db_session, group)
        assert "date,format" in csv
        # Only header line when no entries
        assert csv.count("\n") == 1

    def test_csv_export_with_entries(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Speaker",
                speaker_name="Dave",
            )
        )
        db_session.flush()

        csv = generate_csv_export(db_session, group)
        assert "Dave" in csv
        assert "2025-01-05" in csv

    def test_csv_export_with_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        topics = _create_topics(db_session, group, count=1)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 12),
                format_type="Topic",
                topic_id=topics[0].id,
            )
        )
        db_session.flush()

        csv = generate_csv_export(db_session, group)
        assert "Topic 1" in csv

    def test_csv_export_with_book_study(self, db_session: Session) -> None:
        group = _create_group(db_session)
        _create_chapters(db_session, group)
        # Create a finalized reading assignment with 2 chapters
        add_chapter_to_current_assignment(db_session, group)
        add_chapter_to_current_assignment(db_session, group)
        finalize_current_assignment(db_session, group)
        # Log a Book Study meeting
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 19),
                format_type="Book Study",
            )
        )
        db_session.flush()

        csv = generate_csv_export(db_session, group)
        assert "Book Study" in csv
        assert "Preface" in csv
        assert "pp." in csv

    def test_csv_export_includes_dana(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Speaker",
                speaker_name="Dave",
                dana_amount=15.50,
            )
        )
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 12),
                format_type="Topic",
                dana_amount=None,
            )
        )
        db_session.flush()

        csv = generate_csv_export(db_session, group)
        assert "dana" in csv.split("\n")[0]
        assert "15.50" in csv
        # Null dana renders as empty, not "None"
        assert "None" not in csv

    def test_printable_export(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Speaker",
                speaker_name="Clare",
            )
        )
        db_session.flush()

        html = generate_printable_export(db_session, group)
        assert "<!DOCTYPE html>" in html
        assert "Test Meeting" in html
        assert "Clare" in html
        assert "<table>" in html

    def test_printable_export_empty(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group)
        assert "<!DOCTYPE html>" in html
        assert "Test Meeting" in html

    def test_printable_export_uses_lato_font(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group)
        assert "fonts.googleapis.com" in html
        assert "Lato" in html

    def test_printable_export_blank_rows_default(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group)
        # Default is 10 blank rows; each has class="blank-row"
        assert html.count('class="blank-row"') == 10

    def test_printable_export_blank_rows_custom(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group, blank_rows=5)
        assert html.count('class="blank-row"') == 5

    def test_printable_export_blank_rows_zero(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group, blank_rows=0)
        assert 'class="blank-row"' not in html

    def test_printable_export_date_range_header(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Speaker",
            )
        )
        db_session.flush()

        html = generate_printable_export(
            db_session,
            group,
            start_date=date(2025, 1, 1),
            end_date=date(2025, 3, 31),
        )
        assert "January 2025" in html
        assert "March 2025" in html

    def test_printable_export_rd_brand_colors(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group)
        assert "#1b6b6d" in html
        assert "#c4922a" in html

    def test_printable_export_footer(self, db_session: Session) -> None:
        group = _create_group(db_session)

        html = generate_printable_export(db_session, group)
        assert "Generated from RD Log" in html

    def test_printable_export_shows_dana(self, db_session: Session) -> None:
        group = _create_group(db_session)
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 5),
                format_type="Speaker",
                speaker_name="Clare",
                dana_amount=15.50,
            )
        )
        db_session.flush()

        html = generate_printable_export(db_session, group)
        assert "$15.50" in html
        assert "Dana" in html

    def test_printable_export_shows_topic(self, db_session: Session) -> None:
        group = _create_group(db_session)
        topic = Topic(group_id=group.id, name="Letting Go", is_active=True)
        db_session.add(topic)
        db_session.flush()
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 12),
                format_type="Topic",
                topic_id=topic.id,
            )
        )
        db_session.flush()

        html = generate_printable_export(db_session, group)
        assert "Letting Go" in html

    def test_printable_export_shows_book_study(self, db_session: Session) -> None:
        group = _create_group(db_session)
        ch = BookChapter(
            group_id=group.id,
            order=1,
            start_page="1",
            end_page="20",
            title="Introduction",
        )
        db_session.add(ch)
        db_session.flush()
        ra = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json=f"[{ch.id}]",
            meeting_date=date(2025, 1, 19),
        )
        db_session.add(ra)
        db_session.flush()
        db_session.add(
            MeetingLog(
                group_id=group.id,
                meeting_date=date(2025, 1, 19),
                format_type="Book Study",
            )
        )
        db_session.flush()

        html = generate_printable_export(db_session, group)
        assert "Introduction" in html


# --- Book Position Tracking Tests ---


def _create_group_with_assignments(
    db: Session,
    num_assignments: int = 3,
) -> tuple[Group, list[BookChapter]]:
    """Create a group with chapters and finalized assignments."""
    group = _create_group(db)
    chapters = []
    for i in range(num_assignments):
        ch = BookChapter(
            group_id=group.id,
            order=i + 1,
            start_page=str(i * 10 + 1),
            end_page=str((i + 1) * 10),
            title=f"Chapter {i + 1}",
        )
        db.add(ch)
        chapters.append(ch)
    db.flush()

    for i, ch in enumerate(chapters):
        ra = ReadingAssignment(
            group_id=group.id,
            assignment_order=i + 1,
            chapters_json=json.dumps([ch.id]),
            meeting_date=date(2025, 2, 1 + i * 7),
        )
        db.add(ra)
    # Add empty draft
    db.add(
        ReadingAssignment(
            group_id=group.id,
            assignment_order=num_assignments + 1,
            chapters_json="[]",
        )
    )
    db.flush()
    return group, chapters


class TestBookPositionTracking:
    """Tests for book position tracking features."""

    def test_get_book_chapter_summary_uses_index_not_modulo(
        self,
        db_session: Session,
    ) -> None:
        """Book chapter summary uses current_book_assignment_index."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        # Default index is 0 -> first assignment
        from app.services import _get_book_chapter_summary

        summary = _get_book_chapter_summary(db_session, group, date(2025, 3, 1))
        assert summary is not None
        assert "Chapter 1" in summary

        # Move to index 2 -> third assignment
        group.current_book_assignment_index = 2
        db_session.flush()
        summary = _get_book_chapter_summary(db_session, group, date(2025, 3, 1))
        assert summary is not None
        assert "Chapter 3" in summary

    def test_get_book_position_returns_correct_data(
        self,
        db_session: Session,
    ) -> None:
        """get_book_position returns position, cycle, total, assignment."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        result = get_book_position(db_session, group)
        assert result["current_assignment_index"] == 0
        assert result["book_cycle"] == 1
        assert result["total_assignments"] == 3
        assert result["current_assignment"] is not None
        assert result["chapter_marker"] is None

    def test_get_book_position_empty_when_no_assignments(
        self,
        db_session: Session,
    ) -> None:
        """get_book_position returns 0 total when no finalized assignments."""
        group = _create_group(db_session)
        result = get_book_position(db_session, group)
        assert result["total_assignments"] == 0
        assert result["current_assignment"] is None

    def test_set_position_validates_bounds(
        self,
        db_session: Session,
    ) -> None:
        """set_book_position rejects out-of-range index."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        with pytest.raises(ValueError, match="out of range"):
            set_book_position(db_session, group, 5)
        with pytest.raises(ValueError, match="out of range"):
            set_book_position(db_session, group, -1)

    def test_set_position_validates_no_assignments(
        self,
        db_session: Session,
    ) -> None:
        """set_book_position rejects when no finalized assignments."""
        group = _create_group(db_session)
        with pytest.raises(ValueError, match="No finalized"):
            set_book_position(db_session, group, 0)

    def test_set_position_updates_index(
        self,
        db_session: Session,
    ) -> None:
        """set_book_position updates the index correctly."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        set_book_position(db_session, group, 2)
        assert group.current_book_assignment_index == 2

    def test_advance_wraps_and_increments_cycle(
        self,
        db_session: Session,
    ) -> None:
        """advance_book_position wraps to 0 and increments cycle at end."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        # Advance 3 times: 0->1, 1->2, 2->wrap to 0 (cycle 2)
        advance_book_position(db_session, group)
        assert group.current_book_assignment_index == 1
        assert group.book_cycle == 1

        advance_book_position(db_session, group)
        assert group.current_book_assignment_index == 2
        assert group.book_cycle == 1

        result = advance_book_position(db_session, group)
        assert group.current_book_assignment_index == 0
        assert group.book_cycle == 2
        assert result["current_assignment_index"] == 0
        assert result["book_cycle"] == 2

    def test_advance_fails_with_no_assignments(
        self,
        db_session: Session,
    ) -> None:
        """advance_book_position raises when no finalized assignments."""
        group = _create_group(db_session)
        with pytest.raises(ValueError, match="No finalized"):
            advance_book_position(db_session, group)

    def test_restart_resets_to_zero_increments_cycle(
        self,
        db_session: Session,
    ) -> None:
        """restart_book resets index to 0 and increments cycle."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        group.current_book_assignment_index = 2
        group.book_cycle = 1
        db_session.flush()

        result = restart_book(db_session, group)
        assert group.current_book_assignment_index == 0
        assert group.book_cycle == 2
        assert result["current_assignment_index"] == 0
        assert result["book_cycle"] == 2

    def test_restart_from_start_does_not_increment_cycle(
        self,
        db_session: Session,
    ) -> None:
        """restart_book is a no-op on cycle when already at index 0."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        group.current_book_assignment_index = 0
        group.book_cycle = 1
        db_session.flush()

        result = restart_book(db_session, group)
        assert group.current_book_assignment_index == 0
        assert group.book_cycle == 1
        assert result["book_cycle"] == 1

    def test_set_chapter_marker_valid(
        self,
        db_session: Session,
    ) -> None:
        """set_chapter_marker sets the marker for a valid chapter."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        set_chapter_marker(db_session, group, 2)
        assert group.current_chapter_marker == 2

    def test_set_chapter_marker_invalid(
        self,
        db_session: Session,
    ) -> None:
        """set_chapter_marker raises for nonexistent chapter order."""
        group, _chapters = _create_group_with_assignments(db_session, 3)
        with pytest.raises(ValueError, match="not found"):
            set_chapter_marker(db_session, group, 999)

    def test_chapter_marker_auto_advances_on_finalize(
        self,
        db_session: Session,
    ) -> None:
        """Finalizing assignment auto-advances when marker matches."""
        group = _create_group(db_session)
        # Create chapters
        ch1 = BookChapter(
            group_id=group.id,
            order=1,
            start_page="1",
            end_page="10",
            title="Ch 1",
        )
        ch2 = BookChapter(
            group_id=group.id,
            order=2,
            start_page="11",
            end_page="20",
            title="Ch 2",
        )
        ch3 = BookChapter(
            group_id=group.id,
            order=3,
            start_page="21",
            end_page="30",
            title="Ch 3",
        )
        db_session.add_all([ch1, ch2, ch3])
        db_session.flush()

        # Set chapter marker to chapter 3
        group.current_chapter_marker = 3
        db_session.flush()

        # Create first assignment with ch1, finalize it
        ra1 = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json=json.dumps([ch1.id]),
            meeting_date=date(2025, 2, 1),
        )
        db_session.add(ra1)
        # Create draft assignment with ch2+ch3
        draft = ReadingAssignment(
            group_id=group.id,
            assignment_order=2,
            chapters_json=json.dumps([ch2.id, ch3.id]),
        )
        db_session.add(draft)
        db_session.flush()

        # Finalize the draft (contains chapter 3 which >= marker 3)
        finalize_current_assignment(db_session, group)

        # Index should have been set to point to this assignment (index 1)
        assert group.current_book_assignment_index == 1

    def test_chapter_marker_cleared_after_auto_advance(
        self,
        db_session: Session,
    ) -> None:
        """Marker is cleared after auto-advance so subsequent finalizes don't repeat."""
        group = _create_group(db_session)
        ch1 = BookChapter(
            group_id=group.id, order=1, start_page="1", end_page="10", title="Ch 1"
        )
        ch2 = BookChapter(
            group_id=group.id, order=2, start_page="11", end_page="20", title="Ch 2"
        )
        db_session.add_all([ch1, ch2])
        db_session.flush()

        group.current_chapter_marker = 1
        db_session.flush()

        ra1 = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json=json.dumps([ch1.id]),
            meeting_date=date(2025, 2, 1),
        )
        draft = ReadingAssignment(
            group_id=group.id,
            assignment_order=2,
            chapters_json=json.dumps([ch2.id]),
        )
        db_session.add_all([ra1, draft])
        db_session.flush()

        finalize_current_assignment(db_session, group)

        assert group.current_chapter_marker is None
        assert group.current_book_assignment_index == 1

    def test_second_finalize_does_not_auto_advance_after_marker_cleared(
        self,
        db_session: Session,
    ) -> None:
        """After marker is cleared, a second finalize does not auto-advance."""
        group = _create_group(db_session)
        ch1 = BookChapter(
            group_id=group.id, order=1, start_page="1", end_page="10", title="Ch 1"
        )
        ch2 = BookChapter(
            group_id=group.id, order=2, start_page="11", end_page="20", title="Ch 2"
        )
        ch3 = BookChapter(
            group_id=group.id, order=3, start_page="21", end_page="30", title="Ch 3"
        )
        db_session.add_all([ch1, ch2, ch3])
        db_session.flush()

        group.current_chapter_marker = 1
        db_session.flush()

        # One finalized assignment + a draft with ch2
        ra1 = ReadingAssignment(
            group_id=group.id,
            assignment_order=1,
            chapters_json=json.dumps([ch1.id]),
            meeting_date=date(2025, 2, 1),
        )
        draft = ReadingAssignment(
            group_id=group.id,
            assignment_order=2,
            chapters_json=json.dumps([ch2.id]),
        )
        db_session.add_all([ra1, draft])
        db_session.flush()

        # First finalize — auto-advance fires and clears marker
        finalize_current_assignment(db_session, group)
        assert group.current_chapter_marker is None
        assert group.current_book_assignment_index == 1

        # Simulate explicit advance (as handleConfirmQueue does)
        advance_book_position(db_session, group)

        # Now add ch3 to the new draft and finalize again
        new_draft = get_current_draft_assignment(db_session, group)
        assert new_draft is not None
        new_draft.chapters_json = json.dumps([ch3.id])
        db_session.flush()

        # Record position before second finalize
        idx_before = group.current_book_assignment_index
        finalize_current_assignment(db_session, group)

        # Position should NOT have changed — marker was already cleared
        assert group.current_book_assignment_index == idx_before

    def test_chapter_summary_shows_marker_when_no_assignments(
        self,
        db_session: Session,
    ) -> None:
        """When no finalized assignments, show chapter marker info."""
        group = _create_group(db_session)
        ch = BookChapter(
            group_id=group.id,
            order=5,
            start_page="41",
            end_page="50",
            title="The Fifth Fold",
        )
        db_session.add(ch)
        db_session.flush()
        group.current_chapter_marker = 5
        db_session.flush()

        from app.services import _get_book_chapter_summary

        summary = _get_book_chapter_summary(db_session, group, date(2025, 3, 1))
        assert summary is not None
        assert "The Fifth Fold" in summary
        assert "chapter marker" in summary


class TestInviteCodes:
    """Tests for invite code service functions."""

    def test_generate_invite_code_is_8_chars(
        self,
        db_session: Session,
    ) -> None:
        """Generated code is 8 alphanumeric characters."""
        group = _create_group(db_session)
        from app.services import generate_invite_code

        code = generate_invite_code(db_session, group)
        assert len(code) == 8
        assert code.isalnum()
        assert group.invite_code == code

    def test_revoke_clears_code(
        self,
        db_session: Session,
    ) -> None:
        """Revoking sets invite_code to None."""
        group = _create_group(db_session)
        from app.services import generate_invite_code, revoke_invite_code

        generate_invite_code(db_session, group)
        assert group.invite_code is not None
        revoke_invite_code(db_session, group)
        assert group.invite_code is None

    def test_find_group_by_invite_code(
        self,
        db_session: Session,
    ) -> None:
        """Can look up a group by its invite code."""
        group = _create_group(db_session)
        from app.services import find_group_by_invite_code, generate_invite_code

        code = generate_invite_code(db_session, group)
        db_session.flush()
        found = find_group_by_invite_code(db_session, code)
        assert found is not None
        assert found.id == group.id

    def test_find_group_by_invite_code_case_insensitive(
        self,
        db_session: Session,
    ) -> None:
        """Invite code lookup is case-insensitive."""
        group = _create_group(db_session)
        from app.services import find_group_by_invite_code, generate_invite_code

        code = generate_invite_code(db_session, group)
        db_session.flush()
        found = find_group_by_invite_code(db_session, code.lower())
        assert found is not None
        assert found.id == group.id

    def test_find_nonexistent_code_returns_none(
        self,
        db_session: Session,
    ) -> None:
        """Looking up a nonexistent code returns None."""
        from app.services import find_group_by_invite_code

        found = find_group_by_invite_code(db_session, "NOTACODE")
        assert found is None

    def test_generate_invite_code_raises_after_retries(
        self,
        db_session: Session,
    ) -> None:
        """generate_invite_code raises ValueError when all retries collide."""
        from unittest.mock import patch

        from app.services import generate_invite_code

        group1 = _create_group(db_session)
        # Manually set a known code on group1
        group1.invite_code = "AAAAAAAA"
        db_session.flush()

        group2 = _create_group(db_session)
        # Mock secrets.choice to always return "A" → code is always "AAAAAAAA"
        with (
            patch("app.services.secrets.choice", return_value="A"),
            pytest.raises(ValueError, match="Could not generate unique"),
        ):
            generate_invite_code(db_session, group2)
