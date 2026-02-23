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
