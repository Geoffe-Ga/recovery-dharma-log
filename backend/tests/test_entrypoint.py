"""Tests for the container entrypoint module.

The entrypoint wraps uvicorn so the container can run under exec-form CMD
(Issue #15 — Docker container hardening). These tests exercise the port
parsing logic directly and use a uvicorn stub to verify that ``main()``
forwards the resolved HOST/PORT values without actually binding a socket.
"""

from __future__ import annotations

import sys
import types
from typing import Any

import pytest

from app import entrypoint


class TestParsePort:
    """``_parse_port`` must accept valid ports and reject malformed input."""

    def test_none_returns_default(self) -> None:
        assert entrypoint._parse_port(None) == 8000

    def test_empty_string_returns_default(self) -> None:
        assert entrypoint._parse_port("") == 8000

    def test_custom_default_respected(self) -> None:
        assert entrypoint._parse_port(None, default=9999) == 9999

    @pytest.mark.parametrize(
        "raw,expected", [("1", 1), ("8000", 8000), ("65535", 65535)]
    )
    def test_valid_ports(self, raw: str, expected: int) -> None:
        assert entrypoint._parse_port(raw) == expected

    def test_non_numeric_raises(self) -> None:
        with pytest.raises(ValueError, match="PORT must be an integer"):
            entrypoint._parse_port("not-a-number")

    @pytest.mark.parametrize("raw", ["0", "-1", "65536", "99999"])
    def test_out_of_range_raises(self, raw: str) -> None:
        with pytest.raises(ValueError, match="PORT must be in 1-65535"):
            entrypoint._parse_port(raw)


class TestMain:
    """``main`` must read HOST/PORT from the environment and invoke uvicorn."""

    @staticmethod
    def _install_uvicorn_stub(
        monkeypatch: pytest.MonkeyPatch,
    ) -> dict[str, Any]:
        """Install a fake ``uvicorn`` module and return the captured call args."""

        captured: dict[str, Any] = {}

        def fake_run(app: str, **kwargs: Any) -> None:
            captured["app"] = app
            captured.update(kwargs)

        stub = types.ModuleType("uvicorn")
        stub.run = fake_run  # type: ignore[attr-defined]
        monkeypatch.setitem(sys.modules, "uvicorn", stub)
        return captured

    def test_defaults_when_env_unset(self, monkeypatch: pytest.MonkeyPatch) -> None:
        captured = self._install_uvicorn_stub(monkeypatch)
        monkeypatch.delenv("HOST", raising=False)
        monkeypatch.delenv("PORT", raising=False)

        entrypoint.main()

        assert captured["app"] == "app.main:application"
        assert captured["host"] == "0.0.0.0"
        assert captured["port"] == 8000

    def test_honours_env_overrides(self, monkeypatch: pytest.MonkeyPatch) -> None:
        captured = self._install_uvicorn_stub(monkeypatch)
        monkeypatch.setenv("HOST", "127.0.0.1")
        monkeypatch.setenv("PORT", "9000")

        entrypoint.main()

        assert captured["host"] == "127.0.0.1"
        assert captured["port"] == 9000

    def test_invalid_port_env_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self._install_uvicorn_stub(monkeypatch)
        monkeypatch.setenv("PORT", "-42")

        with pytest.raises(ValueError, match="PORT must be in 1-65535"):
            entrypoint.main()
