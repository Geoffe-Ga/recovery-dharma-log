"""Smoke tests for all API endpoints - Phase 1 gate check."""

from fastapi.testclient import TestClient


class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_health_returns_200(self, client: TestClient) -> None:
        """Health endpoint returns 200 with status healthy."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


class TestAuthEndpoints:
    """Tests for authentication endpoints."""

    def test_register_creates_user(self, client: TestClient) -> None:
        """Register returns 200 with user data."""
        response = client.post(
            "/auth/register",
            json={"username": "newuser", "password": "pass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "newuser"
        assert "id" in data

    def test_register_duplicate_fails(self, client: TestClient) -> None:
        """Registering same username twice returns 400."""
        client.post(
            "/auth/register",
            json={"username": "dupe", "password": "pass123"},
        )
        response = client.post(
            "/auth/register",
            json={"username": "dupe", "password": "pass456"},
        )
        assert response.status_code == 400

    def test_login_returns_token(self, client: TestClient) -> None:
        """Login returns JWT token."""
        client.post(
            "/auth/register",
            json={"username": "loginuser", "password": "pass123"},
        )
        response = client.post(
            "/auth/login",
            data={"username": "loginuser", "password": "pass123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_wrong_password(self, client: TestClient) -> None:
        """Login with wrong password returns 401."""
        client.post(
            "/auth/register",
            json={"username": "wrongpw", "password": "correct"},
        )
        response = client.post(
            "/auth/login",
            data={"username": "wrongpw", "password": "incorrect"},
        )
        assert response.status_code == 401


class TestMeetingsEndpoints:
    """Tests for meeting endpoints."""

    def test_upcoming_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Upcoming meeting endpoint returns valid response."""
        response = client.get("/meetings/upcoming", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "meeting_date" in data
        assert "format_type" in data
        assert "is_cancelled" in data

    def test_log_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Meeting log endpoint returns a list."""
        response = client.get("/meetings/log", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_cancel_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Cancel meeting endpoint returns valid response."""
        response = client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-03-01", "is_cancelled": True},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_lookahead_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Lookahead endpoint returns a list of upcoming meetings."""
        response = client.get(
            "/meetings/upcoming/lookahead?weeks=4",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4
        assert "meeting_date" in data[0]
        assert "format_type" in data[0]

    def test_lookahead_default_weeks(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Lookahead defaults to 4 weeks."""
        response = client.get(
            "/meetings/upcoming/lookahead",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert len(response.json()) == 4

    def test_update_log_speaker_name(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /meetings/log/{id} updates speaker_name."""
        # Create an entry via cancel
        resp = client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-04-01", "is_cancelled": False},
            headers=auth_headers,
        )
        entry_id = resp.json()["id"]
        response = client.put(
            f"/meetings/log/{entry_id}",
            json={"speaker_name": "Alice"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["speaker_name"] == "Alice"

    def test_update_log_content_summary(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /meetings/log/{id} updates content_summary."""
        resp = client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-04-01", "is_cancelled": False},
            headers=auth_headers,
        )
        entry_id = resp.json()["id"]
        response = client.put(
            f"/meetings/log/{entry_id}",
            json={"content_summary": "Great discussion"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["content_summary"] == "Great discussion"

    def test_update_log_is_cancelled(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /meetings/log/{id} updates is_cancelled."""
        resp = client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-04-01", "is_cancelled": False},
            headers=auth_headers,
        )
        entry_id = resp.json()["id"]
        response = client.put(
            f"/meetings/log/{entry_id}",
            json={"is_cancelled": True},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_cancelled"] is True

    def test_update_log_not_found(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /meetings/log/{id} returns 404 for nonexistent entry."""
        response = client.put(
            "/meetings/log/99999",
            json={"speaker_name": "Nobody"},
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_attendance_sets_count(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT attendance sets attendance count on a meeting."""
        response = client.put(
            "/meetings/2025-03-01/attendance",
            json={"attendance_count": 15},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["attendance_count"] == 15

    def test_attendance_null_clears_count(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT attendance with null clears attendance count."""
        # First set a count
        client.put(
            "/meetings/2025-03-01/attendance",
            json={"attendance_count": 15},
            headers=auth_headers,
        )
        # Then clear it
        response = client.put(
            "/meetings/2025-03-01/attendance",
            json={"attendance_count": None},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["attendance_count"] is None

    def test_attendance_rejects_negative(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT attendance with negative count returns 422."""
        response = client.put(
            "/meetings/2025-03-01/attendance",
            json={"attendance_count": -1},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_upcoming_includes_attendance(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Upcoming meeting response includes attendance_count field."""
        response = client.get("/meetings/upcoming", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "attendance_count" in data

    def test_endpoints_require_auth(self, client: TestClient) -> None:
        """Meeting endpoints return 401 without auth."""
        assert client.get("/meetings/upcoming").status_code == 401
        assert client.get("/meetings/log").status_code == 401


class TestTopicsEndpoints:
    """Tests for topic endpoints."""

    def test_list_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List topics returns valid response."""
        response = client.get("/topics/", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_create_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Create topic returns valid response."""
        response = client.post(
            "/topics/",
            json={"name": "New Topic"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Topic"

    def test_draw_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Draw topic returns valid response."""
        response = client.post("/topics/draw", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "topic" in data
        assert "topics_remaining" in data

    def test_reshuffle_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Reshuffle deck returns valid response."""
        response = client.post("/topics/reshuffle", headers=auth_headers)
        assert response.status_code == 200

    def test_delete_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Delete topic returns valid response."""
        response = client.delete("/topics/1", headers=auth_headers)
        assert response.status_code == 200

    def test_undo_after_draw_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Undo topic draw after drawing returns valid response."""
        # First draw a topic
        client.post("/topics/draw", headers=auth_headers)
        # Then undo it
        response = client.post("/topics/undo", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["detail"] == "Topic draw undone"

    def test_undo_without_draw_returns_400(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Undo without a prior draw returns 400."""
        response = client.post("/topics/undo", headers=auth_headers)
        assert response.status_code == 400

    def test_list_topics_includes_last_used(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List topics returns last_used field, null when never used."""
        response = client.get("/topics/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        for topic in data:
            assert "last_used" in topic

    def test_last_used_populated_after_draw(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """After drawing a topic, its last_used date is populated."""
        draw_response = client.post("/topics/draw", headers=auth_headers)
        assert draw_response.status_code == 200
        drawn_topic_id = draw_response.json()["topic"]["id"]

        response = client.get("/topics/", headers=auth_headers)
        topics = response.json()
        drawn = next(t for t in topics if t["id"] == drawn_topic_id)
        assert drawn["last_used"] is not None


class TestBookEndpoints:
    """Tests for book/reading plan endpoints."""

    def test_list_chapters_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List chapters returns valid response."""
        response = client.get("/book/chapters", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_list_assignments_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List assignments returns valid response."""
        response = client.get("/book/assignments", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_plan_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Get reading plan returns valid response."""
        response = client.get("/book/plan", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "current_assignment_chapters" in data

    def test_add_chapter_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Add chapter to assignment returns valid response."""
        response = client.post(
            "/book/plan/add-chapter",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_finalize_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Finalize assignment returns valid response."""
        # First add a chapter to the plan
        client.post("/book/plan/add-chapter", headers=auth_headers)
        response = client.post("/book/plan/finalize", headers=auth_headers)
        assert response.status_code == 200


class TestSpeakersEndpoints:
    """Tests for speaker endpoints."""

    def test_get_schedule_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Get speaker schedule returns valid response."""
        response = client.get("/speakers/schedule", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_schedule_speaker_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Schedule speaker returns valid response."""
        response = client.post(
            "/speakers/schedule",
            json={"meeting_date": "2025-03-02", "speaker_name": "Clare"},
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_upcoming_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Upcoming speaker dates returns a list."""
        response = client.get(
            "/speakers/upcoming?weeks=8",
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        for entry in data:
            assert "meeting_date" in entry
            assert "speaker_name" in entry

    def test_upcoming_includes_unassigned(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Upcoming speaker dates include dates without a speaker assigned."""
        response = client.get(
            "/speakers/upcoming?weeks=8",
            headers=auth_headers,
        )
        data = response.json()
        if data:
            # At least one entry should have speaker_name as null
            # (no speakers scheduled by default)
            has_null = any(e["speaker_name"] is None for e in data)
            assert has_null

    def test_upcoming_reflects_scheduled_speaker(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """After scheduling a speaker, upcoming shows that speaker."""
        # Get upcoming dates first
        response = client.get(
            "/speakers/upcoming?weeks=8",
            headers=auth_headers,
        )
        data = response.json()
        if not data:
            return  # Skip if no speaker dates in rotation

        target_date = data[0]["meeting_date"]
        # Schedule a speaker for that date
        client.post(
            "/speakers/schedule",
            json={
                "meeting_date": target_date,
                "speaker_name": "Test Speaker",
            },
            headers=auth_headers,
        )
        # Verify it shows up
        response = client.get(
            "/speakers/upcoming?weeks=8",
            headers=auth_headers,
        )
        updated = response.json()
        match = next(
            (e for e in updated if e["meeting_date"] == target_date),
            None,
        )
        assert match is not None
        assert match["speaker_name"] == "Test Speaker"

    def test_unschedule_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Unschedule speaker returns valid response."""
        # First schedule a speaker
        client.post(
            "/speakers/schedule",
            json={"meeting_date": "2025-03-02", "speaker_name": "Clare"},
            headers=auth_headers,
        )
        response = client.delete(
            "/speakers/schedule/2025-03-02",
            headers=auth_headers,
        )
        assert response.status_code == 200

    def test_get_names_empty(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Get speaker names returns empty list when none scheduled."""
        response = client.get("/speakers/names", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_get_names_returns_deduplicated_sorted(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Get speaker names returns deduplicated sorted list."""
        # Schedule multiple speakers, some duplicates
        client.post(
            "/speakers/schedule",
            json={"meeting_date": "2025-03-02", "speaker_name": "Zara"},
            headers=auth_headers,
        )
        client.post(
            "/speakers/schedule",
            json={"meeting_date": "2025-03-09", "speaker_name": "Alice"},
            headers=auth_headers,
        )
        client.post(
            "/speakers/schedule",
            json={"meeting_date": "2025-03-16", "speaker_name": "Zara"},
            headers=auth_headers,
        )
        response = client.get("/speakers/names", headers=auth_headers)
        assert response.status_code == 200
        names = response.json()
        assert names == ["Alice", "Zara"]


class TestSettingsEndpoints:
    """Tests for settings endpoints."""

    def test_get_settings_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Get settings returns valid response."""
        response = client.get("/settings/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "format_rotation" in data

    def test_update_settings_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Update settings returns valid response."""
        response = client.put(
            "/settings/",
            json={"name": "Updated Meeting"},
            headers=auth_headers,
        )
        assert response.status_code == 200


class TestExportEndpoints:
    """Tests for export endpoints."""

    def test_csv_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export returns valid response."""
        response = client.get("/export/csv", headers=auth_headers)
        assert response.status_code == 200
        assert "text/csv" in response.headers["content-type"]

    def test_printable_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Printable export returns valid HTML."""
        response = client.get("/export/printable", headers=auth_headers)
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
