"""Tests for the activity/audit log feature."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import ActivityLog, Group, User
from app.services import log_activity


class TestLogActivityService:
    """Tests for the log_activity service function."""

    def test_log_activity_creates_entry(self, db_session: Session) -> None:
        """log_activity creates a new ActivityLog row."""
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        db_session.add(group)
        db_session.flush()

        user = User(
            username="tester",
            hashed_password="fake",
            group_id=group.id,
        )
        db_session.add(user)
        db_session.commit()

        log_activity(db_session, group, user, "topic_drawn", "Mindfulness")

        entries = db_session.query(ActivityLog).all()
        assert len(entries) == 1
        assert entries[0].action == "topic_drawn"
        assert entries[0].details == "Mindfulness"
        assert entries[0].group_id == group.id
        assert entries[0].user_id == user.id
        assert entries[0].created_at is not None

    def test_log_activity_without_details(self, db_session: Session) -> None:
        """log_activity works without details."""
        group = Group(name="Test", meeting_day=6, start_date=date(2025, 1, 5))
        db_session.add(group)
        db_session.flush()

        user = User(
            username="tester",
            hashed_password="fake",
            group_id=group.id,
        )
        db_session.add(user)
        db_session.commit()

        log_activity(db_session, group, user, "deck_reshuffled")

        entries = db_session.query(ActivityLog).all()
        assert len(entries) == 1
        assert entries[0].action == "deck_reshuffled"
        assert entries[0].details is None


class TestActivityEndpoint:
    """Tests for GET /activity/ endpoint."""

    def test_get_activity_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Activity endpoint returns 200 with empty list initially."""
        response = client.get("/activity/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_activity_requires_auth(self, client: TestClient) -> None:
        """Activity endpoint returns 401 without auth."""
        response = client.get("/activity/")
        assert response.status_code == 401

    def test_activity_logged_on_topic_draw(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Drawing a topic creates an activity log entry."""
        # Draw a topic (this should trigger logging)
        draw_response = client.post("/topics/draw", headers=auth_headers)
        assert draw_response.status_code == 200

        # Check activity log
        response = client.get("/activity/", headers=auth_headers)
        assert response.status_code == 200
        entries = response.json()
        assert len(entries) == 1
        assert entries[0]["action"] == "topic_drawn"
        assert entries[0]["details"] is not None

    def test_activity_logged_on_settings_update(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Updating settings creates an activity log entry."""
        client.put(
            "/settings/",
            json={"name": "New Name"},
            headers=auth_headers,
        )

        response = client.get("/activity/", headers=auth_headers)
        entries = response.json()
        assert any(e["action"] == "settings_updated" for e in entries)

    def test_activity_logged_on_meeting_cancel(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Cancelling a meeting creates an activity log entry."""
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-02-02", "is_cancelled": True},
            headers=auth_headers,
        )

        response = client.get("/activity/", headers=auth_headers)
        entries = response.json()
        assert any(e["action"] == "meeting_cancelled" for e in entries)
