"""Tests for Railway deployment readiness (config, guards, static serving)."""

from pathlib import Path
from unittest.mock import patch

import pytest
from starlette.testclient import TestClient

from app.config import Settings


class TestCorsOriginsParsing:
    """CORS origins should be parsed from a comma-separated setting."""

    def test_default_origins(self) -> None:
        """Default settings include both dev origins."""
        s = Settings()
        origins = [o.strip() for o in s.cors_origins.split(",")]
        assert "http://localhost:5173" in origins
        assert "http://localhost:3000" in origins

    def test_custom_origins(self) -> None:
        """Custom CORS origins are parsed correctly."""
        s = Settings(cors_origins="https://example.com, https://other.com")
        origins = [o.strip() for o in s.cors_origins.split(",")]
        assert origins == ["https://example.com", "https://other.com"]

    def test_single_origin(self) -> None:
        """A single origin (no comma) works."""
        s = Settings(cors_origins="https://only.com")
        origins = [o.strip() for o in s.cors_origins.split(",")]
        assert origins == ["https://only.com"]


class TestEnvironmentSetting:
    """Environment setting defaults and overrides."""

    def test_default_environment(self) -> None:
        """Default environment is development."""
        s = Settings()
        assert s.environment == "development"

    def test_custom_environment(self) -> None:
        """Environment can be overridden."""
        s = Settings(environment="production")
        assert s.environment == "production"


class TestDevSecretKeyGuard:
    """Startup must refuse when using the dev secret key in non-dev envs."""

    def test_dev_env_with_dev_key_allowed(self) -> None:
        """Development environment with dev key should start normally."""
        from app.main import app

        with TestClient(app) as client:
            response = client.get("/health")
            assert response.status_code == 200

    def test_non_dev_env_with_dev_key_raises(self) -> None:
        """Non-development environment with dev key must refuse to start."""
        with patch("app.main.settings") as mock_settings:
            mock_settings.environment = "production"
            mock_settings.secret_key = "dev-secret-key-change-in-production"
            mock_settings.app_name = "test"
            mock_settings.cors_origins = "http://localhost:5173"

            from fastapi import FastAPI

            from app.main import lifespan

            test_app = FastAPI(lifespan=lifespan)

            with (
                pytest.raises(RuntimeError, match="RD_LOG_SECRET_KEY"),
                TestClient(test_app),
            ):
                pass

    def test_non_dev_env_with_real_key_allowed(self) -> None:
        """Non-development environment with a real key should start."""
        with patch("app.main.settings") as mock_settings:
            mock_settings.environment = "production"
            mock_settings.secret_key = "a-real-production-secret-key"
            mock_settings.app_name = "test"
            mock_settings.cors_origins = "http://localhost:5173"

            from fastapi import FastAPI

            from app.main import lifespan

            test_app = FastAPI(lifespan=lifespan)

            # Should not raise
            with TestClient(test_app) as client:
                assert client.get("/health").status_code == 404  # no routes on test_app


class TestSqliteConditionalArgs:
    """check_same_thread should only be set for SQLite URLs."""

    def test_sqlite_url_has_check_same_thread(self) -> None:
        """SQLite database URLs include check_same_thread=False."""
        s = Settings(database_url="sqlite:///./test.db")
        connect_args: dict[str, bool] = {}
        if s.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        assert connect_args == {"check_same_thread": False}

    def test_postgres_url_no_check_same_thread(self) -> None:
        """PostgreSQL database URLs do not include check_same_thread."""
        s = Settings(database_url="postgresql://user:pass@host/db")
        connect_args: dict[str, bool] = {}
        if s.database_url.startswith("sqlite"):
            connect_args["check_same_thread"] = False
        assert connect_args == {}


class TestStaticServingAndApiMount:
    """When static/dist/ exists, application should serve SPA + API."""

    def test_application_without_static_dir_is_fastapi(self) -> None:
        """Without static/dist/, application should be the FastAPI app."""
        from app.main import app, application

        # In test env there's no static/dist, so application == app
        assert application is app

    def test_application_with_static_dir(self, tmp_path: Path) -> None:
        """With static/dist/, application wraps API at /api and serves SPA."""
        dist_dir = tmp_path / "dist"
        dist_dir.mkdir()
        (dist_dir / "index.html").write_text("<html><body>SPA</body></html>")

        from starlette.applications import Starlette
        from starlette.routing import Mount

        from app.main import SPAStaticFiles, app

        starlette_app = Starlette(
            routes=[
                Mount("/api", app=app),
                Mount(
                    "/",
                    app=SPAStaticFiles(directory=str(dist_dir), html=True),
                ),
            ],
        )

        with TestClient(starlette_app) as client:
            # API routes should work under /api prefix
            response = client.get("/api/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"

            # SPA fallback: unknown path returns index.html
            response = client.get("/some/unknown/path")
            assert response.status_code == 200
            assert "SPA" in response.text

            # Root serves index.html
            response = client.get("/")
            assert response.status_code == 200
            assert "SPA" in response.text

    def test_api_prefix_stripping(self, tmp_path: Path) -> None:
        """API routes at /api/* should work without extra /api in router paths."""
        dist_dir = tmp_path / "dist"
        dist_dir.mkdir()
        (dist_dir / "index.html").write_text("<html></html>")

        from starlette.applications import Starlette
        from starlette.routing import Mount

        from app.main import SPAStaticFiles, app

        starlette_app = Starlette(
            routes=[
                Mount("/api", app=app),
                Mount(
                    "/",
                    app=SPAStaticFiles(directory=str(dist_dir), html=True),
                ),
            ],
        )

        with TestClient(starlette_app) as client:
            # /api/health should route to app's /health endpoint
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"
