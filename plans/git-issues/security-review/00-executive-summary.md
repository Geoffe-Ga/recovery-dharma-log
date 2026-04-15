# Executive Summary — Security Review

## Posture at a glance

**Overall rating:** ⚠ **Needs work before untrusted-public deployment.**

The Recovery Dharma Secretary Log is a well-structured FastAPI + React application with many right-shaped primitives already in place: bcrypt password hashing, a proper OAuth2-password token flow, Pydantic request validation, SQLAlchemy ORM (no raw SQL in request handlers), bandit/ruff/mypy/detect-secrets in pre-commit, and CI gates. That foundation is strong.

However, the review surfaced **2 Critical**, **6 High**, **9 Medium**, **4 Low**, and **3 Informational** findings. The critical-rated issues are exploitable by any authenticated group member against other group members (stored XSS in the printable export) and by any operator who omits an environment variable (a dev JWT signing key hardcoded in source). Together they push the current risk above the bar for running the instance on the open internet.

## Threat model (summary)

- **Primary attacker:** an authenticated user in a group who wants to escalate to other members of the same group (stored XSS, CSV injection).
- **Secondary attacker:** an unauthenticated internet user who wants to guess invite codes, brute-force passwords, enumerate usernames, or DoS expensive endpoints.
- **Tertiary attacker:** an operator who makes a benign config mistake (forgetting `RD_LOG_ENVIRONMENT=production`) and inadvertently exposes a known secret.
- **Supply-chain attacker:** a malicious dependency/action update reaching the app via unbounded version specifiers or a GitHub Actions workflow trigger.

See [`22-informational-threat-model.md`](./22-informational-threat-model.md) for the full STRIDE breakdown.

## Top-five actions (if you only do five)

1. **Remove the hardcoded dev JWT secret fallback** and fail-closed on any environment where `RD_LOG_SECRET_KEY` is not set — not merely when `RD_LOG_ENVIRONMENT != "development"`. See [#01](./01-critical-hardcoded-dev-secret-fallback.md).
2. **HTML-escape all data rendered into the printable export** (`group.name`, `speaker_name`, `topic.name`, chapter `title`). Use a templating engine with autoescape (Jinja2 `autoescape=True`) or `html.escape` applied per field. See [#02](./02-critical-stored-xss-html-export.md).
3. **Sanitise CSV cell values** with RFC-4180-compliant quoting **and** leading-formula-character neutralisation (`=`, `+`, `-`, `@`, CR, LF, TAB). See [#03](./03-high-csv-formula-injection.md).
4. **Rate-limit authentication endpoints** (`/auth/login`, `/auth/register`) and invite-code-based joins. Add a minimum password policy, reject passwords > 72 bytes, and (ideally) check Pwned Passwords. See [#04](./04-high-no-auth-rate-limiting.md) and [#08](./08-high-weak-password-policy-bcrypt-truncation.md).
5. **Ship default security headers** (CSP with `script-src 'self'`, HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`) and tighten CORS away from `allow_methods=["*"]` / `allow_headers=["*"]`. See [#07](./07-high-missing-security-headers.md) and [#09](./09-medium-cors-permissive-configuration.md).

## Severity scoring

Severity in this review is a composite of:
- **Exploitability** (prerequisites, attacker privilege required, discoverability)
- **Blast radius** (single user vs. one group vs. all users vs. host compromise)
- **Data sensitivity** (recovery-community association is sensitive even though the product doesn't collect regulated PII)
- **Fix cost** (low cost + high impact = elevated priority)

CVSS-style vector strings are provided on each individual finding where useful.

## What looks good

- **Password hashing.** `bcrypt.hashpw` with fresh salt on each registration; `bcrypt.checkpw` on verify. Not MD5/SHA; not a home-rolled KDF. (`backend/app/auth.py:18-27`)
- **ORM-only data access.** No f-string `WHERE` clauses in request handlers; all filters go through SQLAlchemy expression language. The single place that uses `text(...)` is the idempotent startup migration runner with a hardcoded list (still worth reviewing — see [#17](./17-medium-migration-sql-risk-and-race.md)).
- **Secure randomness.** `secrets.choice` is used for topic draws and invite-code generation, not `random.random`.
- **Authorization-by-group.** Every data-mutating endpoint filters by `current_user.group_id` (verified across `routers/{meetings,book,topics,speakers,overrides,settings,setup,activity,export}.py`) — no direct-object-reference (IDOR) holes across group boundaries.
- **React 19.** Default auto-escaping; no `dangerouslySetInnerHTML` or `innerHTML` anywhere in `frontend/src` (verified via grep). The frontend side of stored XSS is closed.
- **Pre-commit stack.** `bandit`, `ruff`, `mypy --strict`, `detect-secrets`, `tryceratops`, `refurb`, `vulture`, `prettier` — an above-average static-analysis baseline.

## What doesn't look good

- **Single-tenant trust assumptions in a multi-tenant design.** Any group member can rewrite any group setting, generate invite codes, and trigger XSS against other members. There is no admin vs. member role ([#12](./12-medium-no-rbac-or-admin-roles.md)).
- **JWT in `localStorage`.** Token is accessible to any script that executes on the SPA origin; combined with the lack of CSP, an XSS breach leaks sessions for 24 hours ([#06](./06-high-token-storage-localstorage-xss.md), [#05](./05-high-jwt-design-weaknesses.md)).
- **No rate limiting anywhere.** Neither at FastAPI middleware nor at the edge (Railway terms). Easy credential stuffing and deck/export DoS ([#04](./04-high-no-auth-rate-limiting.md)).
- **Unbounded Python dep versions** (`>=`) and no `pip-audit` / `npm audit` gate in CI ([#14](./14-medium-dependency-pinning-and-scanning.md)).
- **Docker image runs as `root`** and bundles `pip` in the runtime image ([#15](./15-medium-docker-container-hardening.md)).

## Compliance / framework mapping

| Framework | Gap area | Findings |
|-----------|----------|----------|
| OWASP Top 10 (2021) | A01 Broken Access Control | #12, #11 |
| | A02 Cryptographic Failures | #01, #05 |
| | A03 Injection | #02, #03, #17 |
| | A05 Security Misconfiguration | #07, #09, #15, #17 |
| | A07 Identification/Auth Failures | #04, #05, #06, #08, #19 |
| | A08 Software & Data Integrity | #13, #14, #16 |
| | A09 Logging & Monitoring | #13, #21, #24 |
| OWASP API Security Top 10 (2023) | API2 Broken Auth | #04, #05, #06, #08 |
| | API4 Unrestricted Resource Consumption | #04 |
| | API5 Broken Function-Level Authorization | #12 |
| | API8 Security Misconfiguration | #07, #09 |
| | API9 Improper Inventory | #14 |
| OWASP ASVS v4.0.3 | V2 Authentication | #04, #05, #08 |
| | V3 Session Management | #05, #06, #19 |
| | V5 Validation/Sanitisation | #02, #03, #21 |
| | V7 Error Handling & Logging | #13, #18, #21 |
| | V14 Configuration | #01, #07, #09, #15 |
| SSDF (NIST SP 800-218) | PW.4, PW.7, PW.8 | #14, #16, #24 |
