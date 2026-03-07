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
        assert data, "Expected at least one upcoming speaker date"
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
        assert data, "Expected at least one upcoming speaker date"

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


class TestOverridesEndpoints:
    """Tests for format override endpoints."""

    def test_list_overrides_empty(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List overrides returns empty list when none exist."""
        response = client.get("/overrides/", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []

    def test_set_override(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT creates a new override for a date."""
        response = client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Speaker"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["meeting_date"] == "2025-03-02"
        assert data["format_type"] == "Speaker"
        assert "id" in data

    def test_set_override_updates_existing(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT updates an existing override for a date."""
        client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Speaker"},
            headers=auth_headers,
        )
        response = client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Topic"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["format_type"] == "Topic"

    def test_set_override_invalid_format_type(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT with invalid format_type returns 422."""
        response = client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Invalid"},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_list_overrides_after_create(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """List overrides returns created overrides."""
        client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Speaker"},
            headers=auth_headers,
        )
        client.put(
            "/overrides/2025-03-09",
            json={"format_type": "Topic"},
            headers=auth_headers,
        )
        response = client.get("/overrides/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["meeting_date"] == "2025-03-02"
        assert data[1]["meeting_date"] == "2025-03-09"

    def test_delete_override(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """DELETE removes an existing override."""
        client.put(
            "/overrides/2025-03-02",
            json={"format_type": "Speaker"},
            headers=auth_headers,
        )
        response = client.delete("/overrides/2025-03-02", headers=auth_headers)
        assert response.status_code == 200
        # Verify it's gone
        response = client.get("/overrides/", headers=auth_headers)
        assert response.json() == []

    def test_delete_nonexistent_override(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """DELETE for a nonexistent override returns 404."""
        response = client.delete("/overrides/2025-03-02", headers=auth_headers)
        assert response.status_code == 404

    def test_override_affects_upcoming_meetings(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Override changes the format shown in upcoming meetings."""
        # Get upcoming meetings first
        response = client.get(
            "/meetings/upcoming/lookahead?weeks=4",
            headers=auth_headers,
        )
        meetings = response.json()
        target = meetings[0]
        original_format = target["format_type"]

        # Pick a different format
        new_format = "Speaker" if original_format != "Speaker" else "Topic"
        client.put(
            f"/overrides/{target['meeting_date']}",
            json={"format_type": new_format},
            headers=auth_headers,
        )

        # Verify lookahead reflects the override
        response = client.get(
            "/meetings/upcoming/lookahead?weeks=4",
            headers=auth_headers,
        )
        updated = response.json()
        assert updated[0]["format_type"] == new_format

    def test_overrides_require_auth(self, client: TestClient) -> None:
        """Override endpoints return 401 without auth."""
        assert client.get("/overrides/").status_code == 401
        assert client.put("/overrides/2025-03-02").status_code == 401
        assert client.delete("/overrides/2025-03-02").status_code == 401


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

    def test_csv_with_start_date(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export with start_date filters out earlier entries."""
        # Create entries at two different dates
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-01-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-06-01", "is_cancelled": False},
            headers=auth_headers,
        )
        response = client.get(
            "/export/csv?start_date=2025-03-01",
            headers=auth_headers,
        )
        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        # Header + only the June entry
        assert len(lines) == 2
        assert "2025-06-01" in lines[1]

    def test_csv_with_end_date(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export with end_date filters out later entries."""
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-01-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-06-01", "is_cancelled": False},
            headers=auth_headers,
        )
        response = client.get(
            "/export/csv?end_date=2025-03-01",
            headers=auth_headers,
        )
        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        assert len(lines) == 2
        assert "2025-01-01" in lines[1]

    def test_csv_with_date_range(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export with both start and end date returns only matching."""
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-01-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-04-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-08-01", "is_cancelled": False},
            headers=auth_headers,
        )
        response = client.get(
            "/export/csv?start_date=2025-02-01&end_date=2025-06-01",
            headers=auth_headers,
        )
        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        assert len(lines) == 2
        assert "2025-04-01" in lines[1]

    def test_printable_with_date_range(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Printable export with date range filters entries."""
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-01-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-06-01", "is_cancelled": False},
            headers=auth_headers,
        )
        response = client.get(
            "/export/printable?start_date=2025-03-01",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert "2025-06-01" in response.text
        assert "2025-01-01" not in response.text

    def test_csv_no_date_params_returns_all(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """CSV export without date params returns all entries."""
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-01-01", "is_cancelled": False},
            headers=auth_headers,
        )
        client.post(
            "/meetings/cancel",
            json={"meeting_date": "2025-06-01", "is_cancelled": False},
            headers=auth_headers,
        )
        response = client.get("/export/csv", headers=auth_headers)
        assert response.status_code == 200
        lines = response.text.strip().split("\n")
        assert len(lines) == 3  # header + 2 entries

    def test_printable_blank_rows_param(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Printable export respects blank_rows query param."""
        response = client.get(
            "/export/printable?blank_rows=3",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.text.count('class="blank-row"') == 3

    def test_printable_blank_rows_validation(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Printable export rejects blank_rows outside 0-52 range."""
        response = client.get(
            "/export/printable?blank_rows=100",
            headers=auth_headers,
        )
        assert response.status_code == 422


class TestBookPositionEndpoints:
    """Tests for book position tracking endpoints."""

    def _finalize_assignments(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        count: int = 3,
    ) -> None:
        """Helper to create finalized assignments."""
        for _ in range(count):
            client.post("/book/plan/add-chapter", headers=auth_headers)
            client.post("/book/plan/finalize", headers=auth_headers)

    def test_get_position_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """GET /book/position returns valid response."""
        response = client.get("/book/position", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "current_assignment_index" in data
        assert "book_cycle" in data
        assert "total_assignments" in data

    def test_get_position_after_finalize(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Position shows correct total after finalization."""
        self._finalize_assignments(client, auth_headers, 2)
        response = client.get("/book/position", headers=auth_headers)
        data = response.json()
        assert data["total_assignments"] == 2
        assert data["current_assignment"] is not None

    def test_set_position_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /book/position updates index."""
        self._finalize_assignments(client, auth_headers, 3)
        response = client.put(
            "/book/position",
            json={"assignment_index": 2},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["current_assignment_index"] == 2

    def test_set_position_out_of_range(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """PUT /book/position with invalid index returns 400."""
        self._finalize_assignments(client, auth_headers, 2)
        response = client.put(
            "/book/position",
            json={"assignment_index": 10},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_advance_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /book/advance moves to next assignment."""
        self._finalize_assignments(client, auth_headers, 3)
        response = client.post("/book/advance", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["current_assignment_index"] == 1

    def test_restart_returns_200(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /book/restart resets index and increments cycle."""
        self._finalize_assignments(client, auth_headers, 3)
        # Move forward first
        client.post("/book/advance", headers=auth_headers)
        response = client.post("/book/restart", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["current_assignment_index"] == 0
        assert data["book_cycle"] == 2

    def test_position_requires_auth(self, client: TestClient) -> None:
        """Position endpoints return 401 without auth."""
        assert client.get("/book/position").status_code == 401
        assert client.put("/book/position").status_code == 401
        assert client.post("/book/advance").status_code == 401
        assert client.post("/book/restart").status_code == 401


class TestSetupWizardEndpoints:
    """Tests for setup wizard endpoints."""

    def test_setup_basics_saves_group_settings(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/basics updates group name, day, time, start date."""
        response = client.post(
            "/setup/basics",
            json={
                "name": "Dharma Group",
                "meeting_day": 3,
                "meeting_time": "19:30:00",
                "start_date": "2026-01-07",
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        # Verify via settings
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["name"] == "Dharma Group"
        assert settings["meeting_day"] == 3

    def test_setup_rotation_replaces_formats(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/rotation replaces format rotation."""
        response = client.post(
            "/setup/rotation",
            json={"format_rotation": ["Topic", "Book Study"]},
            headers=auth_headers,
        )
        assert response.status_code == 200
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["format_rotation"] == ["Topic", "Book Study"]

    def test_setup_topics_deactivates_unchecked(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/topics deactivates topics not in keep list."""
        # Verify we start with 10 default topics
        before = client.get("/topics/", headers=auth_headers).json()
        assert len(before) == 10
        response = client.post(
            "/setup/topics",
            json={"keep_topics": ["Karma", "Mindfulness"], "new_topics": []},
            headers=auth_headers,
        )
        assert response.status_code == 200
        # GET /topics/ only returns active topics
        after = client.get("/topics/", headers=auth_headers).json()
        names = [t["name"] for t in after]
        assert "Karma" in names
        assert "Mindfulness" in names
        assert len(after) == 2

    def test_setup_topics_adds_new_topics(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/topics adds new custom topics."""
        response = client.post(
            "/setup/topics",
            json={
                "keep_topics": ["Karma"],
                "new_topics": ["Compassion", "Equanimity"],
            },
            headers=auth_headers,
        )
        assert response.status_code == 200
        topics = client.get("/topics/", headers=auth_headers).json()
        names = [t["name"] for t in topics]
        assert "Compassion" in names
        assert "Equanimity" in names

    def test_setup_book_position_sets_marker(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/book-position sets chapter marker."""
        response = client.post(
            "/setup/book-position",
            json={"chapter_order": 5},
            headers=auth_headers,
        )
        assert response.status_code == 200
        pos = client.get("/book/position", headers=auth_headers).json()
        assert pos["chapter_marker"] == 5

    def test_setup_book_position_invalid_chapter(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/book-position with invalid chapter returns 400."""
        response = client.post(
            "/setup/book-position",
            json={"chapter_order": 999},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_setup_complete_sets_flag(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /setup/complete marks setup as done."""
        response = client.post("/setup/complete", headers=auth_headers)
        assert response.status_code == 200
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["setup_completed"] is True

    def test_settings_shows_setup_completed(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """GET /settings/ includes setup_completed field."""
        settings = client.get("/settings/", headers=auth_headers).json()
        assert "setup_completed" in settings
        # New registration defaults to False
        assert settings["setup_completed"] is False

    def test_setup_requires_auth(self, client: TestClient) -> None:
        """Setup endpoints return 401 without auth."""
        assert client.post("/setup/basics").status_code == 401
        assert client.post("/setup/rotation").status_code == 401
        assert client.post("/setup/topics").status_code == 401
        assert client.post("/setup/book-position").status_code == 401
        assert client.post("/setup/complete").status_code == 401


class TestInviteFlowEndpoints:
    """Tests for invite code and multi-user join flow."""

    def test_generate_invite_code(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """POST /settings/invite-code generates an 8-char code."""
        response = client.post("/settings/invite-code", headers=auth_headers)
        assert response.status_code == 200
        code = response.json()["invite_code"]
        assert len(code) == 8
        assert code.isalnum()

    def test_invite_code_in_settings(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Generated invite code appears in GET /settings/."""
        client.post("/settings/invite-code", headers=auth_headers)
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["invite_code"] is not None
        assert len(settings["invite_code"]) == 8

    def test_revoke_invite_code(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """DELETE /settings/invite-code clears the code."""
        client.post("/settings/invite-code", headers=auth_headers)
        response = client.delete("/settings/invite-code", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["invite_code"] is None
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["invite_code"] is None

    def test_register_with_invite_joins_group(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Registering with invite code joins existing group."""
        # Generate invite code
        resp = client.post("/settings/invite-code", headers=auth_headers)
        code = resp.json()["invite_code"]
        # Register new user with invite code
        resp2 = client.post(
            "/auth/register",
            json={
                "username": "invited_user",
                "password": "pass123",
                "invite_code": code,
            },
        )
        assert resp2.status_code == 200
        # Log in as invited user and verify they see the same group settings
        invited_token = client.post(
            "/auth/login",
            data={"username": "invited_user", "password": "pass123"},
        ).json()["access_token"]
        invited_headers = {"Authorization": f"Bearer {invited_token}"}
        invited_settings = client.get("/settings/", headers=invited_headers).json()
        original_settings = client.get("/settings/", headers=auth_headers).json()
        # Same group = same settings (name, start_date, rotation, etc.)
        assert invited_settings["name"] == original_settings["name"]
        assert invited_settings["start_date"] == original_settings["start_date"]

    def test_register_with_invalid_invite_returns_400(
        self,
        client: TestClient,
    ) -> None:
        """Registering with invalid invite code returns 400."""
        response = client.post(
            "/auth/register",
            json={
                "username": "bad_invite",
                "password": "pass123",
                "invite_code": "INVALID1",
            },
        )
        assert response.status_code == 400
        assert "Invalid invite code" in response.json()["detail"]

    def test_invited_user_skips_setup(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Invited user's group already has setup_completed from original user."""
        # Complete setup as first user
        client.post("/setup/complete", headers=auth_headers)
        # Generate invite
        resp = client.post("/settings/invite-code", headers=auth_headers)
        code = resp.json()["invite_code"]
        # Register and login as invited user
        client.post(
            "/auth/register",
            json={
                "username": "invited2",
                "password": "pass123",
                "invite_code": code,
            },
        )
        login_resp = client.post(
            "/auth/login",
            data={"username": "invited2", "password": "pass123"},
        )
        invited_headers = {
            "Authorization": f"Bearer {login_resp.json()['access_token']}"
        }
        # Invited user should see setup as already completed
        settings = client.get("/settings/", headers=invited_headers).json()
        assert settings["setup_completed"] is True

    def test_register_without_invite_creates_new_group(
        self,
        client: TestClient,
    ) -> None:
        """Normal registration without invite creates a new group."""
        resp1 = client.post(
            "/auth/register",
            json={"username": "user_a", "password": "pass123"},
        )
        resp2 = client.post(
            "/auth/register",
            json={"username": "user_b", "password": "pass456"},
        )
        assert resp1.json()["group_id"] != resp2.json()["group_id"]

    def test_settings_starts_without_invite_code(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """New group has no invite code by default."""
        settings = client.get("/settings/", headers=auth_headers).json()
        assert settings["invite_code"] is None

    def test_invite_endpoints_require_auth(self, client: TestClient) -> None:
        """Invite endpoints return 401 without auth."""
        assert client.post("/settings/invite-code").status_code == 401
        assert client.delete("/settings/invite-code").status_code == 401
