# [Medium] Activity log silently swallows all errors — audit integrity is compromised

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 4.9 — AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:L
**CWEs:** CWE-778 (Insufficient Logging), CWE-390 (Detection of Error Condition Without Action), CWE-223 (Omission of Security-relevant Information)
**OWASP:** A09:2021 Security Logging and Monitoring Failures, ASVS V7.1 / V8.3.1

## Summary

```python
# backend/app/services.py:54-72
def log_activity(...) -> None:
    try:
        entry = ActivityLog(...)
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
```

A bare `except Exception` followed by silent `rollback()` makes the audit log **best-effort** in the worst possible sense — every failure is swallowed with no stderr, no structured log, no metric. Specific issues:

1. **No logging of the swallow.** If the `ActivityLog` table is missing (migration not run), if a constraint fails, or if the DB is read-only, the app continues as if everything is fine.
2. **Commit happens inside the audit function.** Any in-flight transaction from the calling handler gets committed with potentially partial state (the handler normally does its own commit before calling `log_activity`, so this isn't catastrophic today, but it's fragile).
3. **`log_activity` is called post-commit**, which means the audit row is committed *separately* from the action it describes. If `log_activity` fails, the action happened but the audit row didn't.
4. **No log shipping.** ActivityLog lives in the primary DB; an attacker who gains DB write access can erase their tracks.
5. **`/activity/` endpoint returns the last 50 rows only** (`routers/activity.py:14-26`) with no pagination, filtering, or admin-only guard. Any member can read it (fine for intra-group visibility), but operators can't see cross-group audit data.
6. **User-controlled `details` field** is stored without control-character filtering — see [#21](./21-low-activity-log-injection.md).

## Where

- `backend/app/services.py:54-72` — `log_activity`.
- `backend/app/routers/activity.py:14-26` — activity endpoint.
- `backend/app/models.py:231-257` — `ActivityLog` model.

## Recommended fix

### Log the swallow

```python
import logging
logger = logging.getLogger("rd_log.audit")

def log_activity(db, group, user, action, details=None) -> None:
    try:
        db.add(ActivityLog(group_id=group.id, user_id=user.id, action=action, details=details))
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "audit log write failed",
            extra={"group_id": group.id, "user_id": user.id, "action": action},
        )
        # Fall back to structured stderr JSON so log shippers still see the event.
        logger.error("AUDIT_FALLBACK", extra={
            "group_id": group.id, "user_id": user.id,
            "action": action, "details": details,
            "timestamp": datetime.now(UTC).isoformat(),
        })
```

### Write-ahead shipping

- Add a second sink: for production, emit structured JSON to stdout so Railway's log shipper captures it. Even if the DB is wiped, the observability stack has a copy.
- Optionally ship to an append-only store (S3 + Object Lock, or a separate tenant-isolated DB).

### Atomicity with the calling action

Perform the audit insert *within* the same transaction as the action:

```python
# Use db.flush() in log_activity (not commit). Let the caller commit once.
def log_activity(db, ...):
    db.add(ActivityLog(...))
    db.flush()   # raises on failure, caller rolls back
```

This way, either the action *and* its audit row are both persisted or neither is.

### Audit-only admin endpoint

Add `GET /admin/activity` for the platform operator (role `operator`, not in-group role) that paginates and filters by group/user/date. Enforce read-only; no delete.

### Log what matters

Currently `log_activity` is called on `topic_drawn`, `deck_reshuffled`, `topic_undo`, `speaker_scheduled`, `speaker_removed`, `meeting_cancelled`, `meeting_restored`, `settings_updated`. Add:
- `user_registered` / `user_logged_in` / `user_logged_out`
- `invite_code_created` / `invite_code_revoked`
- `invite_code_used` (the join event — currently NOT logged)
- `password_changed` (once password-change exists)
- Failed login attempts with username + IP (retained 30 days only; tie with [#04](./04-high-no-auth-rate-limiting.md))
- `export_downloaded` with `format=csv|printable`, `row_count`, `date_range`
- `assignment_deleted`, `meeting_log_updated`

### Retention & privacy

ActivityLog stores PII (usernames, speaker names). Document a retention policy (e.g. 365 days) with a periodic purge job, and redact on export where appropriate.

## Acceptance criteria

- [ ] `log_activity` failures produce a structured stderr JSON log with the intended payload.
- [ ] Login, logout, registration, invite-create, invite-use, password-change, export events are all written to `ActivityLog`.
- [ ] Audit row and the mutation it describes are in the same DB transaction.
- [ ] Admin audit view paginates 50-per-page with filters by user/action/date.
- [ ] Retention job exists (`backend/app/jobs/purge_activity.py`) and tests verify it.

## References

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- CWE-778: https://cwe.mitre.org/data/definitions/778.html
- NIST SP 800-92 (Computer Security Log Management): https://csrc.nist.gov/publications/detail/sp/800-92/final
