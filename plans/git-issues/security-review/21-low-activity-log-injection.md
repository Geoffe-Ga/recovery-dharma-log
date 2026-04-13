# [Low] Activity-log `details` field is user-controlled and unsanitised

**Severity:** 🟢 Low
**CWEs:** CWE-117 (Improper Output Neutralization for Logs), CWE-93 (CRLF Injection)
**OWASP:** ASVS V7.3.1

## Summary

`log_activity(db, group, user, action, details=...)` writes the `details` field verbatim to `ActivityLog.details`. Values flowing in include:

- `topic.name` on `topic_drawn` (user-controlled; see [#02](./02-critical-stored-xss-html-export.md)).
- `f"{schedule_in.speaker_name} on {schedule_in.meeting_date}"` on `speaker_scheduled`.
- `str(cancel.meeting_date)` on `meeting_cancelled` / `meeting_restored` (safe).
- `str(meeting_date)` on `speaker_removed` (safe).

Two concerns:

1. **Log-injection (CWE-117).** If logs are later rendered to a plain-text console, piped to an aggregator that doesn't properly JSON-encode lines, or printed into an ops chat, embedded newlines/CR/ANSI escapes can forge fake log lines, obscure real ones, or execute terminal commands in legacy viewers. Python's stdlib logging is structured enough to mostly avoid this but the DB column itself stores raw user input for later re-rendering.
2. **Fan-out into XSS sinks.** If any future UI renders `details` with `dangerouslySetInnerHTML` or passes it through a markdown renderer without sanitisation, XSS re-opens via this vector. React 19's default auto-escaping covers today's `details` rendering in the Log page, but the hazard is latent.

## Where

- `backend/app/services.py:54-72` — `log_activity`.
- `backend/app/routers/topics.py:142` — `log_activity(... "topic_drawn", topic.name)`.
- `backend/app/routers/speakers.py:119-125` — `log_activity(... "speaker_scheduled", f"{name} on {date}")`.
- `backend/app/routers/meetings.py:115-123` — meeting_cancelled / meeting_restored.
- `backend/app/routers/settings.py:67` — settings_updated.

## Recommended fix

### Sanitise on write

```python
import re

_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

def _safe_details(value: str | None) -> str | None:
    if value is None:
        return None
    # Strip ANSI escapes and C0 control chars. Keep newlines? → collapse to spaces.
    cleaned = _CONTROL_RE.sub("", value)
    cleaned = cleaned.replace("\r", " ").replace("\n", " ").strip()
    return cleaned[:1000]  # hard cap


def log_activity(db, group, user, action, details=None) -> None:
    try:
        db.add(ActivityLog(group_id=group.id, user_id=user.id,
                           action=action, details=_safe_details(details)))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("audit log write failed")
```

### Structure the payload

Instead of a free-text `details` string, use JSON:

```python
class ActivityLog(Base):
    ...
    payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)   # or JSON for SQLite
```

```python
log_activity(db, group, user, "speaker_scheduled",
             payload={"speaker_name": name, "meeting_date": str(date)})
```

UI renders fields individually (inherently safe via React auto-escape).

### Safe rendering

- The Log/Activity UI uses plain text interpolation (React auto-escape). Keep it that way; do not introduce a markdown renderer on audit log text.
- If an export ever prints audit rows into HTML (printable report), use the same autoescape-on-by-default template approach as [#02](./02-critical-stored-xss-html-export.md).

## Acceptance criteria

- [ ] `ActivityLog.details` contains no control characters after a handler writes user-supplied text with newlines / tabs / ANSI escapes (integration test).
- [ ] Details length is capped at 1000 characters.
- [ ] (Optional) `payload` column replaces unstructured `details`; migration copies existing data into `{"details": "..."}`.

## References

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude
- CWE-117: https://cwe.mitre.org/data/definitions/117.html
