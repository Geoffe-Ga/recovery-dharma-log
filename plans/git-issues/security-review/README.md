# Security Review — Recovery Dharma Secretary Log

**Date:** 2026-04-13
**Branch:** `claude/security-review-analysis-mU0gt`
**Scope:** Full-stack review of `backend/` (FastAPI / SQLAlchemy / JWT / bcrypt) and `frontend/` (React 19 / Vite / TypeScript), plus infrastructure (`Dockerfile`, `railway.json`), CI/CD (`.github/workflows/`), and pre-commit configuration.
**Methodology:** OWASP ASVS v4.0.3 (Levels 1–2), OWASP Top 10 (2021), OWASP API Security Top 10 (2023), STRIDE threat modelling, SANS CWE/SANS Top 25, and supply-chain / SSDF practices (NIST SP 800-218). Analysis is code-level (manual review), configuration-level, dependency-surface, and infrastructure.

## How to use this directory

Each file below is drafted as a standalone GitHub Issue. Open each one, validate against your environment, then copy into `gh issue create` (or drop straight into the web UI). Files are numbered by **severity-ordered priority**, not by CVSS alone — practical exploitability, blast radius, and fix-cost all factor into ordering.

> The recommended remediation roadmap lives in [`23-informational-remediation-roadmap.md`](./23-informational-remediation-roadmap.md). Start there if you want a phased plan.

## Quick index

| # | File | Severity | Area |
|---|------|----------|------|
| 00 | [00-executive-summary.md](./00-executive-summary.md) | — | Overview, risk ranking, scoring rationale |
| 01 | [01-critical-hardcoded-dev-secret-fallback.md](./01-critical-hardcoded-dev-secret-fallback.md) | 🔴 Critical | Auth / Config |
| 02 | [02-critical-stored-xss-html-export.md](./02-critical-stored-xss-html-export.md) | 🔴 Critical | XSS / Export |
| 03 | [03-high-csv-formula-injection.md](./03-high-csv-formula-injection.md) | 🟠 High | Injection / Export |
| 04 | [04-high-no-auth-rate-limiting.md](./04-high-no-auth-rate-limiting.md) | 🟠 High | Auth / DoS |
| 05 | [05-high-jwt-design-weaknesses.md](./05-high-jwt-design-weaknesses.md) | 🟠 High | Auth / Session |
| 06 | [06-high-token-storage-localstorage-xss.md](./06-high-token-storage-localstorage-xss.md) | 🟠 High | Session / XSS |
| 07 | [07-high-missing-security-headers.md](./07-high-missing-security-headers.md) | 🟠 High | Transport / Browser |
| 08 | [08-high-weak-password-policy-bcrypt-truncation.md](./08-high-weak-password-policy-bcrypt-truncation.md) | 🟠 High | Auth / Crypto |
| 09 | [09-medium-cors-permissive-configuration.md](./09-medium-cors-permissive-configuration.md) | 🟡 Medium | CORS |
| 10 | [10-medium-username-enumeration.md](./10-medium-username-enumeration.md) | 🟡 Medium | Information disclosure |
| 11 | [11-medium-invite-code-abuse.md](./11-medium-invite-code-abuse.md) | 🟡 Medium | Auth / Access control |
| 12 | [12-medium-no-rbac-or-admin-roles.md](./12-medium-no-rbac-or-admin-roles.md) | 🟡 Medium | Authorization |
| 13 | [13-medium-audit-log-silent-failure.md](./13-medium-audit-log-silent-failure.md) | 🟡 Medium | Logging / Integrity |
| 14 | [14-medium-dependency-pinning-and-scanning.md](./14-medium-dependency-pinning-and-scanning.md) | 🟡 Medium | Supply chain |
| 15 | [15-medium-docker-container-hardening.md](./15-medium-docker-container-hardening.md) | 🟡 Medium | Container |
| 16 | [16-medium-github-actions-abuse.md](./16-medium-github-actions-abuse.md) | 🟡 Medium | CI/CD / Supply chain |
| 17 | [17-medium-migration-sql-risk-and-race.md](./17-medium-migration-sql-risk-and-race.md) | 🟡 Medium | DB / Operations |
| 18 | [18-low-error-info-disclosure.md](./18-low-error-info-disclosure.md) | 🟢 Low | Information disclosure |
| 19 | [19-low-logout-no-revocation.md](./19-low-logout-no-revocation.md) | 🟢 Low | Session |
| 20 | [20-low-self-registration-open.md](./20-low-self-registration-open.md) | 🟢 Low | Access control |
| 21 | [21-low-activity-log-injection.md](./21-low-activity-log-injection.md) | 🟢 Low | Logging |
| 22 | [22-informational-threat-model.md](./22-informational-threat-model.md) | ℹ Info | Threat model |
| 23 | [23-informational-remediation-roadmap.md](./23-informational-remediation-roadmap.md) | ℹ Info | Roadmap |
| 24 | [24-informational-security-testing-gaps.md](./24-informational-security-testing-gaps.md) | ℹ Info | Testing |

## Severity legend

- 🔴 **Critical** — Remote compromise of confidentiality, integrity, or availability feasible with low effort. Fix immediately; consider the application unsafe to run on the open internet until addressed.
- 🟠 **High** — Meaningful weakening of a security boundary; realistic attack paths under normal usage. Fix within days.
- 🟡 **Medium** — Hardening gaps that combine with other flaws to amplify impact, or require privileged position / unusual conditions.
- 🟢 **Low** — Defence-in-depth gaps and good-hygiene deviations.
- ℹ **Informational** — Context, reasoning, or remediation guidance rather than a direct vulnerability.

## Out of scope

- Third-party runtime (Railway platform itself, TLS termination, edge WAF).
- Protection of the RD Log book content (copyright, not security).
- Physical / social engineering against operators.
- Detailed cryptanalysis of bcrypt / HS256 primitives.

## Assumptions

- Deployment target is Railway with HTTPS terminated at the edge; `uvicorn` is reached via HTTP behind that edge.
- Users are recovery-meeting volunteers (secretaries). The data is sensitive (association with a recovery community, personal names, meeting attendance) but not regulated PHI/PII.
- A "group" represents one weekly meeting; members of a group trust each other, but members of different groups do **not** trust each other.
