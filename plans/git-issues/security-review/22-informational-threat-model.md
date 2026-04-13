# [Informational] Threat model — STRIDE for Recovery Dharma Secretary Log

## Assets

| Asset | Sensitivity | Location |
|-------|-------------|----------|
| User credentials (bcrypt hashes) | High | `users.hashed_password` |
| JWTs (in flight & in `localStorage`) | High | HTTP `Authorization`, browser storage |
| Group membership (the "who is in a recovery meeting" list) | **High** — strongly sensitive by community norms, though not regulated PHI | `users`, `activity_log` |
| Speaker names & meeting history | Medium–High | `meeting_logs`, `activity_log` |
| Dana (donation) amounts | Medium | `meeting_logs.attendance_count` (aliased) |
| Group settings & invite codes | Medium | `groups.invite_code`, `groups.*` |
| Source code + deploy config | Medium | GitHub repo, Railway |
| Signing key (`RD_LOG_SECRET_KEY`) | **Critical** | Env var on Railway |

## Trust boundaries

```
  ┌───────────────────┐      HTTPS (Railway TLS edge)      ┌────────────────────────┐
  │ Browser (user)    │ ───────────────────────────────────▶ FastAPI / Uvicorn        │
  │  SPA: React 19    │                                    │  ├─ /api/* routers       │
  │  token in LS      │  ◀────────────────────────────────  │  ├─ JWT validation       │
  └───────────────────┘        CORS boundary                 │  └─ ORM (SQLAlchemy)     │
           ▲                                                 └──────────┬──────────────┘
           │                                                            │
      public internet                                                   │ SQL
           │                                                            ▼
           │                                                 ┌───────────────────────┐
  ┌───────────────────┐                                      │ SQLite (dev)          │
  │ GitHub (repo,     │   Actions OIDC / OAuth token          │ Postgres (prod)       │
  │ Actions runners)  │ ────────────────────────────────────▶ │                       │
  └───────────────────┘                                       └───────────────────────┘
```

## Actors

- **Unauthenticated visitor** — hits `/api/*` without a token, or the SPA bundle.
- **Group member** — authenticated user associated with one group; can read/write every data row for that group.
- **(Future) Group admin** — see [#12](./12-medium-no-rbac-or-admin-roles.md); role does not exist today.
- **Operator** — person who sets environment variables on Railway, can read the DB, can merge code.
- **GitHub user (non-member)** — can comment on issues and potentially trigger workflows ([#16](./16-medium-github-actions-abuse.md)).
- **Third-party supply chain** — npm/PyPI, GitHub Actions marketplace, Google Fonts (Lato).

## STRIDE — per-component summary

### Browser SPA

| Threat | Description | Finding |
|--------|-------------|---------|
| **S**poofing | XSS steals token, impersonates user | #02, #06 |
| **T**ampering | DOM injection via uncontrolled input | #02 |
| **R**epudiation | User denies action; activity log not ironclad | #13 |
| **I**nformation disclosure | Referer leak, 3rd-party requests (Google Fonts) | #07 |
| **D**enial of service | Unbounded API calls from the SPA | #04 |
| **E**levation | XSS + open CORS → access to other origins | #02, #06, #07, #09 |

### FastAPI backend

| Threat | Description | Finding |
|--------|-------------|---------|
| **S**poofing | Forged JWT using dev secret | #01 |
| **T**ampering | CSV / HTML output injection | #02, #03, #21 |
| **R**epudiation | Audit log failures swallowed | #13 |
| **I**nformation disclosure | Username enumeration, error detail leakage | #10, #18 |
| **D**enial of service | Brute force, expensive endpoints, unbounded weeks | #04, #11 |
| **E**levation | Any member = admin; invite-code guess → join | #11, #12 |

### Database

| Threat | Description | Finding |
|--------|-------------|---------|
| **T**ampering | DDL at startup; race across replicas | #17 |
| **R**epudiation | Audit log on same DB, mutable | #13 |
| **I**nformation disclosure | Default SQLite on disk in container | #15 |
| **D**oS | Schema migrations run concurrently | #17 |

### CI/CD & Supply chain

| Threat | Description | Finding |
|--------|-------------|---------|
| **S**poofing | Fake `@claude` trigger from any GitHub user | #16 |
| **T**ampering | Moving-tag Actions, unpinned dep versions | #14, #16 |
| **R**epudiation | No signed commits / SBOM / attestation | #14 |
| **I**nformation disclosure | Build artefacts / OIDC tokens in logs | #16 |
| **D**oS | CI cost abuse | #16 |
| **E**levation | Prompt injection to Claude Actions | #16 |

## Attack trees (selected)

### A1. Take over a group

```
Take over group
├── 1. Forge JWT
│   └── 1a. Operator forgets RD_LOG_ENVIRONMENT=production  ⇒ dev secret in use  (#01)
├── 2. Steal a member's token
│   ├── 2a. XSS via printable export payload             (#02)
│   └── 2b. Trick user into running a malicious bookmarklet; localStorage exposed  (#06)
├── 3. Guess a member's password
│   ├── 3a. Weak password + no rate limit              (#04, #08)
│   └── 3b. Breached password reused                    (#08)
└── 4. Brute-force an invite code and self-join
    └── 4a. No rate limit; codes never expire           (#11, #04)
```

### A2. Exfiltrate meeting attendance data

```
Exfiltrate data
├── 1. Any of A1 (gain member access)
├── 2. Dev secret → full read of any group               (#01)
└── 3. Supply-chain attack
    ├── 3a. Compromised Action @v4 tag                    (#14, #16)
    └── 3b. Compromised dep in >= range                   (#14)
```

### A3. DoS / cost attack

```
DoS
├── 1. Unauth: hammer /auth/login (bcrypt ~80ms each, no limit)  (#04)
├── 2. Unauth: hammer /auth/register (creates Group + 49 seed rows each)  (#20)
├── 3. Auth:   /meetings/upcoming/lookahead?weeks=12 in a loop  (#04)
└── 4. Auth:   /export/printable with wide date range           (#04)
```

## Data-flow diagram (simplified)

```
Browser (1) ──HTTP, JWT──▶ FastAPI (2) ──ORM──▶ DB (3)
           ◀──JSON/HTML──                     ◀──rows──

Static (2a) ──serve SPA──▶ Browser

GitHub (4) ──webhook/event──▶ Actions runner (5) ──OAuth token──▶ Anthropic/GitHub APIs
```

Trust boundaries to watch:
- 1↔2 (JWT verification, CORS, CSP)
- 2↔3 (migrations, injection surface, connection string secret)
- 4↔5 (workflow triggers, secret leakage)
- 5↔Anthropic (prompt injection)

## Out-of-scope for this threat model

- Detailed cryptanalysis of bcrypt/argon2.
- Supply-chain attacks on Railway itself.
- Physical access to operator's machine.
- GDPR / HIPAA / other regulatory positioning (the product declares no special compliance posture).

## How to use this model

When reviewing a new feature, walk each STRIDE category for each component it touches, and tag every identified threat with either (a) a mitigating control that already exists, (b) a new control you are adding in this PR, or (c) an issue reference deferring it. Require an explicit written note from the author before merging for any (c).
