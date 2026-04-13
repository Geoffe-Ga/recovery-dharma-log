# [High] JWT design weaknesses — no revocation, long TTL, missing standard claims

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 7.1 — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N
**CWEs:** CWE-613 (Insufficient Session Expiration), CWE-384 (Session Fixation adjacent), CWE-287 (Improper Authentication)
**OWASP:** A07:2021 Identification and Authentication Failures, API2:2023 Broken Authentication, ASVS V3.3 / V3.5

## Summary

The JWT implementation works but leaves out nearly every defence-in-depth claim and mechanism recommended in RFC 8725 (JWT Best Current Practices):

1. **24-hour token lifetime by default** (`config.py:13` — `access_token_expire_minutes: int = 1440`). That is an acceptable life for a *session*, but here it is also the life of a *stolen token* because there is no revocation.
2. **No refresh-token pattern.** Clients must keep a long-lived access token in `localStorage` ([#06](./06-high-token-storage-localstorage-xss.md)) for the full 24 hours.
3. **No `jti` (JWT ID).** Server cannot blocklist a single token.
4. **No `iss` or `aud` claim.** A token minted for one deployment (staging) is usable on another (production) if the keys happen to overlap. Not a direct bug today but a footgun once multiple environments exist.
5. **No `nbf` (not-before).** Minor, but helps detect clock-skew abuse.
6. **Username as `sub`.** `get_current_user` looks up `User.username == payload.sub` (`auth.py:62`). Usernames are human-editable in theory; if a rename feature is added later and `sub` isn't migrated, orphan tokens could point to wrong accounts. Prefer an immutable numeric `sub` (user id).
7. **`jwt.decode` does not pin the algorithm list strictly enough.** It uses `algorithms=[settings.algorithm]` which is safe *today*, but if `settings.algorithm` ever becomes a comma-separated list the decode call silently becomes permissive. Use an explicit constant list: `algorithms=["HS256"]`.
8. **No logout revocation.** `/auth/logout` does not exist in the backend; `setToken(null)` is client-side only ([#19](./19-low-logout-no-revocation.md)).
9. **`OAuth2PasswordBearer(tokenUrl="/auth/login")`** conflicts with the mounted Starlette `/api` prefix in production. When the app is wrapped behind `Mount("/api", app=app)` (`main.py:197`), the FastAPI-auto-generated OpenAPI swagger UI's "Try it out" points to `/auth/login` at the root, not `/api/auth/login`. Cosmetic but worth fixing.
10. **`access_token_expire_minutes` is an `int`, user-configurable**, with no lower/upper validation. An operator misconfiguring this to a year is silently accepted.

## Where

- `backend/app/auth.py:15, 30-37, 40-65`
- `backend/app/config.py:12-14`
- `backend/app/routers/auth.py:88-102`

## Attack narratives enabled by this

- **Session stealing via XSS:** once a token is exfiltrated (via [#02](./02-critical-stored-xss-html-export.md) or any future XSS), it remains valid for up to 24 hours with no way to revoke.
- **Credential rotation ineffective:** changing the bcrypt password does not invalidate tokens already issued — `get_current_user` never reads `user.hashed_password`. A compromised user cannot evict an attacker who stole their pre-rotation token.
- **Key rotation downtime or flag day:** without `kid` (key ID) in the header, operators can't roll secrets without an immediate invalidate-all.

## Recommended fix

### Token contents

```python
# backend/app/auth.py
import uuid
from datetime import UTC, datetime, timedelta

_ISSUER = "rd-log"

def create_access_token(user: User, audience: str) -> str:
    now = datetime.now(UTC)
    to_encode = {
        "sub": str(user.id),                   # immutable numeric ID
        "preferred_username": user.username,   # optional, for logging
        "iat": int(now.timestamp()),
        "nbf": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
        "jti": str(uuid.uuid4()),
        "iss": _ISSUER,
        "aud": audience,                       # derive from settings.cors_origins or settings.public_url
    }
    return jwt.encode(to_encode, settings.secret_key.get_secret_value(),
                      algorithm="HS256", headers={"kid": settings.key_id})


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(401, "Could not validate credentials",
                                          headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(
            token,
            settings.secret_key.get_secret_value(),
            algorithms=["HS256"],                          # hard-coded list
            issuer=_ISSUER,
            audience=settings.public_url,
            options={"require": ["exp", "iat", "sub", "jti", "iss", "aud"]},
        )
        sub = payload["sub"]
        jti = payload["jti"]
    except jwt.PyJWTError as err:
        raise credentials_exception from err

    if is_revoked(db, jti):                                # see revocation section
        raise credentials_exception
    try:
        user_id = int(sub)
    except ValueError as err:
        raise credentials_exception from err
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user
```

### Lifetime & refresh

- Reduce access-token lifetime to **15–60 minutes**.
- Add a **refresh token** (opaque random 256-bit string, stored hashed in DB with per-user revocation) with a 14-day sliding window; issue via `POST /auth/refresh`.
- Rotate refresh tokens on every use and detect reuse (token replay → revoke the whole family).

### Revocation

Two options:
- **Blocklist `jti`s** of explicitly-logged-out tokens, stored in Redis or a `revoked_jtis` table with TTL == original exp. Cheap.
- **Password-bound invalidation**: include `user.password_version` (bumped on password change) as a claim; refuse tokens whose version doesn't match current.

Prefer blocklist + password-version together.

### Logout endpoint

See [#19](./19-low-logout-no-revocation.md).

### Validate configuration

```python
# config.py
from pydantic import field_validator

access_token_expire_minutes: int = 60

@field_validator("access_token_expire_minutes")
@classmethod
def _cap(cls, v: int) -> int:
    if not (1 <= v <= 24 * 60):
        raise ValueError("must be 1..1440")
    return v
```

### Future: asymmetric keys

When a second service joins (e.g. a worker or an analytics component), migrate to EdDSA / RS256 with a public-key verification path, so signing authority stays in one service and the secret is not distributed.

## Acceptance criteria

- [ ] Default access-token TTL ≤ 60 minutes; refresh-token TTL documented.
- [ ] `POST /auth/logout` exists and revokes the current token's `jti`.
- [ ] Changing a user's password invalidates all pre-change tokens (integration test).
- [ ] `jwt.decode(..., algorithms=["HS256"])` is a hard-coded list; `settings.algorithm` is removed or narrowed to `Literal["HS256", "RS256"]`.
- [ ] OpenAPI `tokenUrl` correctly reflects `/api/auth/login` when mounted.

## References

- RFC 8725 (JWT BCP): https://datatracker.ietf.org/doc/html/rfc8725
- OWASP JWT Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html
- CWE-613: https://cwe.mitre.org/data/definitions/613.html
