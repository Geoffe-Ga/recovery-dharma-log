# [Low] Error messages leak implementation details

**Severity:** 🟢 Low
**CVSS v3.1 (estimated):** 3.7 — AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N
**CWEs:** CWE-209 (Generation of Error Message Containing Sensitive Information), CWE-200 (Exposure of Sensitive Information)
**OWASP:** A05:2021 Security Misconfiguration, ASVS V7.4

## Summary

Several routers echo `str(exc)` back to the caller:

- `backend/app/routers/book.py:141-145, 181-185, 200-203, 229-232, 249-252, 265-268` — `detail=str(exc)` for ValueError.
- `backend/app/routers/topics.py:179-183` — `detail=str(e)`.
- `backend/app/routers/setup.py:81-84` — `detail=str(e)`.
- `backend/app/routers/settings.py:87-91` — `detail=str(exc)` including generate-invite-code failure.

Today the ValueError messages come from handler-local logic and are relatively benign ("Assignment not found", "Invalid chapter IDs", "Index 5 out of range (0-3)"). The danger is two-fold:

1. **Future regression.** The pattern encourages developers to let any internal exception bubble up. A future `ValueError("connection string must contain...")` could end up in a client response.
2. **Stack-trace disclosure.** FastAPI's default exception handler returns a generic 500 in production **unless** `debug=True`. The `FastAPI(title=..., lifespan=...)` constructor leaves `debug` at its default (False) — good — but there is no explicit guard that turns it off. An operator who toggles debug while chasing a bug exposes full stack traces including file paths, library versions, and environment variables in repr form.
3. **No request-id in errors.** When a real 500 happens, clients see "Internal Server Error" and operators have no correlation id to look up in logs.

## Recommended fix

### Uniform error envelope

Wrap handlers with a small translation helper:

```python
# backend/app/errors.py
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from uuid import uuid4
import logging

logger = logging.getLogger(__name__)

class DomainError(ValueError):
    """Safe-to-expose domain error. Message is returned verbatim."""


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = request.headers.get("x-request-id", str(uuid4()))
    logger.exception("unhandled exception", extra={"request_id": request_id, "path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": request_id},
    )
```

Register it:

```python
app.add_exception_handler(Exception, unhandled_exception_handler)
```

Then in handlers, raise `DomainError` for user-facing messages and let everything else 500:

```python
try:
    set_book_position(db, current_user.group, body.assignment_index)
except DomainError as exc:
    raise HTTPException(400, str(exc)) from exc
```

Change `set_book_position` / `set_chapter_marker` / `update_assignment_chapters` / `delete_assignment` / `advance_book_position` to raise `DomainError(...)` instead of `ValueError(...)`. Ordinary bugs surface as 500 + request_id.

### Request IDs

```python
# backend/app/middleware.py
class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response
```

Include `request_id` in log lines and in error bodies; operators can now correlate a user's "it broke" with a single line in stdout logs.

### Disable docs in production (optional)

`/docs` and `/redoc` (FastAPI's Swagger UI / ReDoc) are enabled by default. Consider:

```python
app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.environment != "production" else None,
)
```

Authenticated-only docs are also an option if the team uses them.

### Harden 404/405 handlers

Starlette's default HTTP 405 returns `Allow:` headers listing all methods. That's fine and useful. Just ensure 404 for unknown paths on `/api/*` returns the standard JSON shape rather than Starlette's text body.

## Acceptance criteria

- [ ] All public handlers use `DomainError` instead of `ValueError` for user-facing messages; other exceptions map to a uniform 500 response.
- [ ] Every response includes an `x-request-id` header.
- [ ] `/docs` / `/openapi.json` are disabled (or authenticated) in production.
- [ ] Logs contain `request_id` for every request and are correlatable with client 500 responses.

## References

- OWASP Error Handling Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html
- CWE-209: https://cwe.mitre.org/data/definitions/209.html
