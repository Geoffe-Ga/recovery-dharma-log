# [Low] Open self-registration with immediate group creation

**Severity:** 🟢 Low (high depending on deployment model)
**CWEs:** CWE-284 (Improper Access Control), CWE-770 (Allocation of Resources Without Limits)
**OWASP:** ASVS V2.1.14

## Summary

`POST /auth/register` (no `invite_code`) creates a brand-new `Group`, seeds it with default topics + chapters, and logs the user in — with no email verification, no administrative approval, no CAPTCHA, and no rate limit ([#04](./04-high-no-auth-rate-limiting.md)).

Attackers or even well-meaning scripts can create unbounded groups. This consumes database rows, adds seed-topic fanout, and pollutes the `groups` table with unused data. If the app is deployed in a single-tenant model (one organization owns the instance), every self-registration is an unwanted account; if it's deployed as a public service, every such registration is fine but should have guardrails.

Today:
- `Group` rows are never deleted anywhere in the codebase.
- `Topic` and `BookChapter` rows (10 topics + 39 chapters per new group) are seeded from `app/seed.py`.
- Activity logs and meeting logs compound over time.

## Attack narrative

- A nuisance actor runs `ab -c 10 -n 10000 -p reg.json -T application/json https://rd-log.example.com/api/auth/register`.
- Database fills with 10,000 groups, 100,000 topics, 390,000 chapters, 10,000 users.
- No abuse detection fires. The app stays running but becomes slow and expensive.

## Recommended fix

### Choose a deployment model and enforce it

The product should have a deliberate posture. Pick one:

**Single-tenant (likely the intended model).** Lock registration to:

- Initial bootstrap: during deploy, run a one-off CLI (`python -m app.bootstrap <admin-username>`). No self-registration thereafter.
- Existing admins invite new members via invite codes ([#11](./11-medium-invite-code-abuse.md)).
- `/auth/register` either: (a) is removed, or (b) is guarded by `settings.allow_self_registration` default False.

**Multi-tenant public service.**

- Require email verification before the account is usable.
- Rate-limit registration per IP (5/hour) and per email domain (20/hour).
- Add a simple CAPTCHA (hCaptcha / Cloudflare Turnstile) on the register form.
- Add a "group creation" approval step, separate from "user creation": a user registers; to create a new group they must additionally be approved or must verify a domain.
- Soft-delete idle groups (no members, no activity for 30 days).

### Immediate mitigations (either model)

- Rate limit `/auth/register` to 3/min, 10/hour per IP.
- Introduce a feature flag `RD_LOG_ALLOW_SELF_REGISTRATION` (env-driven) that defaults to `false` in production.
- Add a CAPTCHA challenge to the register form when the flag is `true`.
- Add an admin-only API to list and delete orphan groups.

## Acceptance criteria

- [ ] A `RD_LOG_ALLOW_SELF_REGISTRATION` env var controls access to `/auth/register` (404 when disabled).
- [ ] When enabled, the endpoint requires CAPTCHA and is rate-limited.
- [ ] Admin endpoint `DELETE /admin/groups/{id}` exists and purges orphan groups.
- [ ] Integration test proves that with the flag off, register returns 404.

## References

- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- "Why open signup is a decision, not a default" — various — add internal docs link.
