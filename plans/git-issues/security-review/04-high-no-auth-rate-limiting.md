# [High] No rate limiting on authentication or expensive endpoints

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 7.5 — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:L
**CWEs:** CWE-307 (Improper Restriction of Excessive Authentication Attempts), CWE-770 (Allocation of Resources Without Limits or Throttling), CWE-799 (Improper Control of Interaction Frequency)
**OWASP:** A07:2021 Identification and Authentication Failures, API4:2023 Unrestricted Resource Consumption, ASVS V2.2.1

## Summary

No endpoint in the application enforces a rate limit — neither at FastAPI middleware, nor at the reverse proxy, nor via platform configuration (`railway.json` has no rate-limit directive). The worst gaps:

- **`POST /auth/login`** (`backend/app/routers/auth.py:88`). Bcrypt adds per-attempt cost (~80ms at the default factor) but that is still **~12 attempts/second per connection × thousands of concurrent connections**. With the default 24-hour token TTL ([#05](./05-high-jwt-design-weaknesses.md)), every successful guess yields a long-lived token.
- **`POST /auth/register`** (same file, line 19). An attacker can enumerate usernames ([#10](./10-medium-username-enumeration.md)) and also use register to probe invite codes ([#11](./11-medium-invite-code-abuse.md)).
- **`POST /auth/register` with `invite_code`** performs an unrestricted guess against the 8-char alphanumeric space without any IP-based throttling.
- **Expensive reads** such as `GET /meetings/upcoming/lookahead?weeks=12` (`routers/meetings.py:39`), `GET /speakers/upcoming?weeks=52` (`routers/speakers.py:38`), and `GET /export/printable` each walk weeks of data and fire many per-date DB queries through `get_format_for_date`. Left unthrottled, any authenticated user can sustain high DB load.
- **`POST /topics/draw`** triggers a cascade of queries and commits; no throttle.

Bcrypt provides **per-attempt** cost but not **per-source** throttling. It does not stop:
- Distributed credential stuffing with stolen password lists.
- Sequential password spraying at 10 req/s against known usernames.
- Authenticated users hammering DoS-capable endpoints.

## Where

- `backend/app/main.py:140-148` — FastAPI app instantiation. No rate-limit middleware.
- `backend/app/routers/auth.py:19-102` — register/login handlers have no throttle.
- `backend/app/routers/auth.py:29-36` — invite-code verification path.
- `backend/app/routers/meetings.py:38-45` — unbounded week lookahead up to 12.
- `backend/app/routers/speakers.py:36-67` — 52-week lookahead with per-week DB query.

## Recommended fix

### Backend middleware — `slowapi` (drop-in for FastAPI)

```python
# requirements.txt
slowapi>=0.1.9

# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],   # global per-IP
    storage_uri=os.environ.get("RD_LOG_RATELIMIT_STORAGE", "memory://"),
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Per-route tightening:

```python
# backend/app/routers/auth.py
from slowapi.util import get_remote_address
from app.main import limiter   # circular-import-safe pattern: use a shared module

@router.post("/login", response_model=Token)
@limiter.limit("5/minute;30/hour")
def login(...): ...

@router.post("/register", response_model=UserResponse)
@limiter.limit("3/minute;10/hour")
def register(...): ...
```

### Account-level lockout (complementary)

Rate limiting by IP alone is defeated by rotating-IP botnets. Add a per-account backoff:

```python
# pseudocode
failed = redis.incr(f"login_fail:{username}")
if failed == 1:
    redis.expire(f"login_fail:{username}", 900)  # 15 min window
if failed > 10:
    raise HTTPException(429, "Account temporarily locked")
```

Use **exponential delays** on consecutive failures rather than a hard lock (avoids DoS-by-lockout of a known username). Reset on successful login.

### Storage for limits

- For single-instance deployments (today): in-process `memory://` is fine.
- For multi-replica (future): Redis (`redis://...`). Railway offers a managed Redis add-on.

### Platform-level defence-in-depth

- Configure Cloudflare / Railway edge rate limit, e.g. 60 req/min per IP for `/auth/*`.
- Add `fail2ban`-style tailing of access logs if edge isn't available.

### Bound expensive endpoints

- Keep `weeks` upper bound low (the existing `le=12` for meetings and `le=52` for speakers are too permissive). Reduce to `le=8` and `le=16` respectively, or implement pagination.
- Add `@limiter.limit("30/minute")` on `/export/*`, `/meetings/upcoming/lookahead`, and `/speakers/upcoming`.

## Acceptance criteria

- [ ] After 5 failures on `/auth/login` from the same IP within 60s, the 6th returns HTTP 429.
- [ ] After 10 failed logins for `user=alice` (any IP), successive attempts are delayed at least 1s per attempt.
- [ ] `/export/printable` returns 429 after sustained 30 req/min from a single user.
- [ ] Integration tests in `backend/tests/test_rate_limit.py` verify 429 on login brute force and invite-code brute force.
- [ ] Rate-limit events are logged with `{user_or_ip, endpoint, count, window}` to the audit log.

## References

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- slowapi: https://slowapi.readthedocs.io/
- CWE-307: https://cwe.mitre.org/data/definitions/307.html
