# [Medium] Invite-code brute force and unrestricted group joining

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 5.4 — AV:N/AC:L/PR:N/UI:N/S:C/C:L/I:L/A:N
**CWEs:** CWE-330 (Use of Insufficiently Random Values — adjacent), CWE-521 (Weak Password Requirements), CWE-799 (Improper Control of Interaction Frequency)
**OWASP:** A07:2021 Identification and Authentication Failures, A01:2021 Broken Access Control

## Summary

Invite codes are 8 characters over a 32-character alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`) — roughly 2^40 ≈ 1.1 × 10¹² combinations. That sounds like a lot, but:

- **No rate limit on `/auth/register` with invite_code** ([#04](./04-high-no-auth-rate-limiting.md)). An attacker can guess at tens of attempts per second per IP, thousands with a botnet.
- **Invite codes are long-lived.** They do not expire. They are revoked only if an admin explicitly clicks "revoke" in Settings. Groups often forget.
- **A correct guess silently adds the attacker to the group** with full privileges (see [#12](./12-medium-no-rbac-or-admin-roles.md)). No admin approval, no notification to existing members.
- **Invite codes are per-group unique but a single code has no per-use limit.** Anyone who learns a code once can share it or mint unlimited accounts into the group.
- **Validation mismatch.** `find_group_by_invite_code` uses `code.upper()` (`services.py:887`) but `InviteCode` is returned directly in uppercase from `generate_invite_code`. If any code path ever stored a lowercase value, the lookup would fail silently.
- **Code generation is "10 attempts only"** in `generate_invite_code` (`services.py:869`). On collision, it raises `ValueError` rather than expanding the attempt count, opening a micro DoS on new-invite generation if an attacker fills enough codes — not a real risk at 2^40 but worth noting.

## Attack narratives

- **Targeted lurker.** Mallory wants to surveil Alice's recovery group. With no rate limit, Mallory runs `curl POST /auth/register` in a loop with guessed invite codes. 2^40 is infeasible to exhaust, but real groups often regenerate codes to the same 8-char space from the same `secrets` RNG — so if Mallory already has one code from a public poster flyer and wants to join a *different* group, it remains infeasible. The real risk is the combination with **code leakage** — groups post codes to Slack, GitHub issues, emails.
- **Code leak.** A code is pasted into a public chat channel. Anyone who sees it joins. No expiration, no single-use.

## Where

- `backend/app/services.py:866-887` — generation & lookup.
- `backend/app/routers/auth.py:29-45` — join via invite code on register.
- `backend/app/routers/settings.py:78-105` — generate / revoke.

## Recommended fix

### Expiration & single-use

```python
# backend/app/models.py — extend Group (or new InviteCode table)
class InviteCode(Base):
    __tablename__ = "invite_codes"
    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # ^ Store sha256(code) — even if DB is dumped, raw codes stay secret.
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
```

Default policy: **24-hour** expiry, **1 use**. Admin can toggle longer / multi-use per code.

Lookup compares `sha256(code)` against `code_hash`, enforces `expires_at > now` and `uses < max_uses` and `revoked_at is null`, and increments `uses` atomically on successful join.

### Admin approval

Optionally require existing group members to approve a pending join. Add a `PendingMember` model with `approved_at`; on register, create the pending row and send an in-app notification. This aligns with [#12](./12-medium-no-rbac-or-admin-roles.md).

### Notification

Email (or in-app toast shown at next login) notifies existing members "X joined the group" with timestamp and the inviter. Enables social detection of abuse.

### Rate limit

Per-IP `5/min, 30/hour` on `/auth/register?invite_code=...` via slowapi ([#04](./04-high-no-auth-rate-limiting.md)). Consider a per-group failure counter — after N wrong codes against one group, require a slowdown / CAPTCHA.

### Constant-time comparison

When validating:

```python
import hmac
candidate_hash = hashlib.sha256(code.upper().encode()).digest()
for row in candidate_rows:
    if hmac.compare_digest(candidate_hash, bytes.fromhex(row.code_hash)):
        ...
```

(Per-group comparisons are few; constant-time is mostly symbolic but good hygiene.)

### Strengthen code space (optional)

Move to 10-char codes with a 36-char alphabet (10^10 ≈ 2^50 entropy in the same human-friendly Crockford-Base32 space).

## Acceptance criteria

- [ ] Invite codes expire after 24h by default; admin can set 1–30 days.
- [ ] Codes are hashed at rest (DB inspection does not reveal valid codes).
- [ ] Per-IP rate limit on `/auth/register` returns 429 after 5 attempts in 60s.
- [ ] Joining a group sends a notification event to other members.
- [ ] Tests cover: expired code → 400, revoked code → 400, already-used single-use code → 400, case-insensitive match → 200.

## References

- OWASP "Invitation Links" pattern: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- CWE-330: https://cwe.mitre.org/data/definitions/330.html
