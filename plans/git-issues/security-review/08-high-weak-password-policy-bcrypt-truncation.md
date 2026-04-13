# [High] Weak password policy and silent bcrypt 72-byte truncation

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 6.8 — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N
**CWEs:** CWE-521 (Weak Password Requirements), CWE-20 (Improper Input Validation), CWE-916 (Use of Password Hash with Insufficient Computational Effort — adjacent)
**OWASP:** A07:2021 Identification and Authentication Failures, ASVS V2.1.1–V2.1.9

## Summary

There are no constraints on passwords, and a well-known bcrypt gotcha goes unhandled:

1. **No minimum length / complexity.** `UserCreate` in `schemas.py:10-15` declares `password: str` with no validators. An empty string, a single character, `"password"`, or `"12345678"` are all accepted.
2. **No maximum length.** `bcrypt.hashpw` silently truncates inputs longer than 72 bytes. Two distinct passwords that share the first 72 bytes hash identically — a user who thinks they chose a 100-character passphrase actually picked a 72-byte one. Worse, if they ever paste a very long string from a password manager with a common prefix, collisions are possible.
3. **No Pwned Passwords / breach check.** Users can (and do) reuse breached passwords.
4. **No password reset flow.** Combined with #19 (no token revocation on password change), a compromised user has no clean recovery path.
5. **Username not validated.** `UserCreate.username` is bare `str` with no regex or length cap. Whitespace-only, `" "`, names with embedded nulls, extreme-length names that would blow through the 255-char column, homoglyph attacks, etc., are all accepted at the API boundary. Any failure cascades into a 500 when the DB rejects.

## Where

- `backend/app/schemas.py:10-15` — `UserCreate` schema.
- `backend/app/auth.py:18-27` — `hash_password` / `verify_password`.
- `backend/app/routers/auth.py:19-85` — register handler.

## Recommended fix

### Pydantic validation

```python
# backend/app/schemas.py
from pydantic import BaseModel, Field, field_validator
import unicodedata

USERNAME_RE = r"^[a-z0-9][a-z0-9._-]{2,30}$"

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=USERNAME_RE)
    password: str = Field(min_length=12, max_length=128)
    invite_code: str | None = Field(default=None, pattern=r"^[A-Z0-9]{8}$")

    @field_validator("username", mode="before")
    @classmethod
    def _normalise_username(cls, v: str) -> str:
        v = unicodedata.normalize("NFKC", v).strip().lower()
        return v

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        # Reject passwords whose *byte* length exceeds bcrypt's 72-byte input ceiling.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("password too long (max 72 bytes after UTF-8 encoding)")
        # Require a minimum of 3 of: lower, upper, digit, symbol. Simple and NIST-compatible.
        classes = (
            any(c.islower() for c in v),
            any(c.isupper() for c in v),
            any(c.isdigit() for c in v),
            any(not c.isalnum() for c in v),
        )
        if sum(classes) < 2:
            raise ValueError("password must include at least 2 of: lowercase, uppercase, digit, symbol")
        return v
```

### Bcrypt input safety net

```python
# backend/app/auth.py
def hash_password(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("password exceeds 72-byte bcrypt input limit")
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    encoded = plain.encode("utf-8")[:72]   # explicit truncation parity with register path
    return bcrypt.checkpw(encoded, hashed.encode("utf-8"))
```

(Explicit truncation on verify keeps existing users whose passwords happened to be >72 bytes able to log in, but the length check on register prevents new users from creating ambiguous credentials.)

### Alternative: migrate off bcrypt

`bcrypt` is still acceptable per OWASP ASVS V2.4.1 but has the 72-byte gotcha and tuning caps. Consider **argon2id** via `argon2-cffi`:

```python
from argon2 import PasswordHasher
_ph = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=4)

def hash_password(pw: str) -> str:
    return _ph.hash(pw)

def verify_password(pw: str, hashed: str) -> bool:
    try:
        _ph.verify(hashed, pw)
        return True
    except Exception:
        return False
```

Argon2id is the current OWASP-preferred KDF; no input length limitation, parameters are in the hash string, and it resists GPU/ASIC attacks better. Migration is feasible by rehashing on successful login.

### Breach check (optional, high-value)

On register / password change, query HaveIBeenPwned Passwords v3 range API with the first 5 hex chars of SHA-1 and reject if the local suffix appears. Offline: ship a compact bloom filter of the top 1M breached passwords.

### Username policy

See the regex above. In addition, reject usernames that normalise-equal an existing username (Unicode confusables) to prevent account impersonation once UIs start showing names alongside avatars.

## Acceptance criteria

- [ ] `POST /auth/register` with `password=""`, `password="short"`, or `password=<73+ bytes>` returns 422.
- [ ] `POST /auth/register` with `password="correct horse battery staple !" ` succeeds (length & complexity met).
- [ ] Register with `username="root admin"` returns 422; register with `username="Root"` and a subsequent `"root"` are treated as conflict (case-insensitive unique).
- [ ] Integration test asserts bcrypt truncation is explicitly prevented: two passwords sharing 72-byte prefix fail on register.
- [ ] Docs updated: `docs/security/passwords.md` describes policy.

## References

- OWASP ASVS V2.1: https://owasp.org/www-project-application-security-verification-standard/
- bcrypt 72-byte limitation: https://github.com/pyca/bcrypt/#maximum-password-length
- NIST SP 800-63B (passwords): https://pages.nist.gov/800-63-3/sp800-63b.html
- argon2-cffi: https://argon2-cffi.readthedocs.io/
