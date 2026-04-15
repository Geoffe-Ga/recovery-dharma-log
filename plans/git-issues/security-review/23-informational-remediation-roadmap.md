# [Informational] Remediation roadmap

A phased plan that sequences the findings so each phase delivers a real security improvement without blocking on the next.

## Phase 0 — Halt the bleeding (same-day)

Do these today; they have low code cost and outsized impact.

- [ ] **#01 — Remove the hardcoded dev JWT fallback.** Fail-closed when `RD_LOG_SECRET_KEY` is unset, regardless of `RD_LOG_ENVIRONMENT`.
- [ ] **#02 — HTML-escape all interpolation in the printable export.** Port to Jinja2 autoescape.
- [ ] **#03 — Use the `csv` module + formula-prefix neutralisation** in the CSV export.
- [ ] **Audit-fix:** Run a manual check that no production deployment is currently running on the dev secret; rotate if so.
- [ ] Write release notes explaining the breaking config change.

## Phase 1 — Authentication & session hardening (week 1)

- [ ] **#04 — Add `slowapi` rate limiting** on `/auth/*` and expensive read endpoints.
- [ ] **#08 — Strengthen password policy** and prevent bcrypt 72-byte silent truncation.
- [ ] **#10 — Make register and login responses indistinguishable**; add dummy bcrypt on existing-username path.
- [ ] **#19 — Add `/auth/logout`, `/auth/change-password`, `/auth/logout-all`** with revocation via `jti` blocklist + `password_version`.
- [ ] **#05 — Shorten access-token TTL to 60 minutes**; add a refresh-token flow; add `iss`, `aud`, `jti`, `iat`, `nbf` claims.

## Phase 2 — Defence-in-depth in the browser (week 2)

- [ ] **#07 — Security-headers middleware** (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-*-Policy).
- [ ] **#06 — Migrate from `localStorage` to httpOnly cookies** + double-submit CSRF token.
- [ ] **#09 — Tighten CORS** (explicit methods/headers; validate origin entries; remove CORS entirely on the same-origin production mount).
- [ ] **Self-host Lato font** to tighten `font-src` in CSP.

## Phase 3 — Access control & multi-tenancy (week 3)

- [ ] **#12 — Introduce `User.role`** (`admin`, `secretary`, `member`) and gate mutation endpoints.
- [ ] **#11 — Invite codes: expire (24h default), single-use by default, hashed at rest**, with notification to existing members on join.
- [ ] **#20 — Gate self-registration** behind a feature flag; require CAPTCHA when enabled.
- [ ] **#18 — Error envelope** with request IDs and a uniform 500 handler.

## Phase 4 — Operational & supply chain (week 4)

- [ ] **#14 — Hash-pin dependencies** (`pip-audit` in CI, `npm audit` in CI, Dependabot for pip/npm/actions/docker, CodeQL, SBOM, gitleaks).
- [ ] **#15 — Dockerfile hardening** (non-root user, drop pip, exec form, pinned digests).
- [ ] **#16 — GitHub Actions hardening** (author-association guard, SHA-pinning, least-privilege `GITHUB_TOKEN`, workflow_run split-pattern).
- [ ] **#17 — Alembic migrations** + Railway release command + advisory locks.
- [ ] **#13 — Audit log** within-transaction commit, structured fallback to stdout, log more events, retention policy.
- [ ] **#21 — Sanitise `details` field** (control-char strip, length cap).

## Phase 5 — Assurance (ongoing)

- [ ] **#24 — Add security-focused tests** (see that file).
- [ ] **Red-team exercise**: an internal or external tester attempts the attack trees in [`22-informational-threat-model.md`](./22-informational-threat-model.md).
- [ ] **Quarterly dependency review** tied to a calendar reminder.
- [ ] **Security runbook** in `docs/operations/`:
  - Secret rotation SOP.
  - Incident response: what to do when a token / invite code / DB is exposed.
  - Operator-visible logs & how to read them.

## "What gets us on the open internet" bar

Minimum to consider the app safe to serve to the public internet:
- Phase 0 and Phase 1 done.
- `#07` (CSP) done.
- Deployment is running with `RD_LOG_ENVIRONMENT=production`, a rotated `RD_LOG_SECRET_KEY` ≥ 256 bits, and Railway-managed Postgres (not SQLite).
- Dependabot alerts for critical vulns are zero.
- CI pipeline includes `pip-audit` / `npm audit` (at least warning, then fail).

## Estimation guidance

Most items are small surgical changes. The largest (in engineering time) are:
- **#06 (httpOnly cookies + CSRF)** — touches backend auth, frontend client, and every POST/PUT/DELETE call.
- **#12 (RBAC)** — DB migration, route annotations, UI guards.
- **#17 (Alembic)** — initial migration generation and docs, then ongoing discipline.

Everything else is in the tens-of-minutes-to-half-day range.
