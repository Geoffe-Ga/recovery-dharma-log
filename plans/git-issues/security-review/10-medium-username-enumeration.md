# [Medium] Username enumeration on registration endpoint

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 5.3 — AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N
**CWEs:** CWE-203 (Observable Discrepancy), CWE-204 (Observable Response Discrepancy)
**OWASP:** ASVS V3.2.2 / V2.1.12

## Summary

`POST /auth/register` responds with `"Username already registered"` when the chosen username exists (`backend/app/routers/auth.py:22-27`). This confirms account existence without authentication and without rate limiting (see [#04](./04-high-no-auth-rate-limiting.md)). An attacker can:

1. Enumerate which usernames are in use.
2. Feed that list into password-spraying attacks against `/auth/login` (also unrate-limited).
3. Combine with invite-code abuse ([#11](./11-medium-invite-code-abuse.md)) to identify which groups the user is in.

`/auth/login` does use a generic `"Incorrect username or password"` — good — but that defence is undone by the register endpoint.

Secondary source of enumeration: `/speakers/names` (`routers/speakers.py:17`) returns all speaker names in the group — if a group member uses their real name as both speaker and username, speaker listings trivially leak usernames.

## Where

- `backend/app/routers/auth.py:22-27`
- `backend/app/routers/speakers.py:17-33` (secondary, smaller risk)

## Recommended fix

Two complementary patterns:

### Option A — Uniform response ("we've sent a confirmation")

Introduce an account-confirmation email flow. Register always returns `202 Accepted` with "If the username is available, you'll receive a confirmation shortly" regardless of whether the username existed. Creation happens on confirmation-link click.

### Option B — Uniform error + rate limiting

If email confirmation is not planned:

```python
if existing or invalid_username:
    # Uniform response for both "already taken" and "invalid format"
    raise HTTPException(400, "Registration failed — try a different username")
```

Combine with per-IP rate limit of 5 registrations / hour ([#04](./04-high-no-auth-rate-limiting.md)) and per-IP /login limit.

### Timing

Ensure the register handler performs a dummy bcrypt hash when the username exists so attackers cannot distinguish "exists" from "doesn't exist" via timing:

```python
_DUMMY_HASH = bcrypt.hashpw(b"timing-safety", bcrypt.gensalt()).decode()

def register(...):
    existing = db.query(User).filter(User.username == user_in.username).first()
    if existing:
        bcrypt.checkpw(user_in.password.encode(), _DUMMY_HASH.encode())   # match timing
        raise HTTPException(400, "Registration failed — try a different username")
    ...
```

### Audit

Re-audit other endpoints for enumeration:
- `GET /speakers/names` — already returns names but is authenticated and scoped to group; acceptable.
- `POST /topics/` `detail=...` error — currently none that reveals existence; OK.

## Acceptance criteria

- [ ] Timing analysis of 100 register attempts for existing vs. non-existing usernames produces indistinguishable distributions (assert p-value > 0.05 via a t-test in a dedicated test).
- [ ] Register error text is identical regardless of root cause (conflict vs. validation).
- [ ] Integration test verifies that `existing` and `valid-but-available` usernames both yield the same response body.

## References

- OWASP "Testing for Account Enumeration": https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/03-Identity_Management_Testing/04-Testing_for_Account_Enumeration_and_Guessable_User_Account
- CWE-203: https://cwe.mitre.org/data/definitions/203.html
