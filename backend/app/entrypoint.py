"""Container entrypoint for the FastAPI/Starlette application.

Invoked by the Dockerfile's ``CMD`` (exec form). Using a tiny Python wrapper
instead of a shell wrapper means:

* SIGTERM is delivered directly to the Python process (PID 1), which in turn
  signals uvicorn via its standard handlers. No shell stands between the
  container runtime and the server.
* The ``PORT`` environment variable — which Railway assigns dynamically — is
  resolved at start time without relying on shell expansion in ``CMD``.
* ``HOST`` and ``PORT`` are validated before uvicorn is started so that
  mis-configuration fails fast with a clear error.
"""

from __future__ import annotations

import os


def _parse_port(raw: str | None, default: int = 8000) -> int:
    """Return a valid TCP port parsed from *raw*, falling back to *default*.

    Raises ``ValueError`` if *raw* is set but is not a valid port number.
    """

    if raw is None or raw == "":
        return default
    try:
        port = int(raw)
    except ValueError as exc:  # pragma: no cover - defensive
        raise ValueError(f"PORT must be an integer, got {raw!r}") from exc
    if not 1 <= port <= 65535:
        raise ValueError(f"PORT must be in 1-65535, got {port}")
    return port


def main() -> None:
    """Start uvicorn, honouring ``HOST``/``PORT`` env overrides."""

    import uvicorn

    # The container is expected to bind all interfaces: Railway and docker
    # publish the container port externally via their own networking layer.
    host = os.environ.get("HOST", "0.0.0.0")  # nosec B104 - container binding
    port = _parse_port(os.environ.get("PORT"))
    uvicorn.run("app.main:application", host=host, port=port)


if __name__ == "__main__":  # pragma: no cover - exercised by container only
    main()
