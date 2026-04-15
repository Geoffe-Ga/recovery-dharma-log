# [Medium] Unpinned Python dependencies and no CI dependency-vulnerability gate

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 5.5 — AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:L
**CWEs:** CWE-1104 (Use of Unmaintained Third-Party Components), CWE-1357 (Reliance on Insufficiently Trustworthy Component), CWE-937 (Using Components with Known Vulnerabilities)
**OWASP:** A06:2021 Vulnerable and Outdated Components, A08:2021 Software & Data Integrity Failures, SSDF PW.4

## Summary

### Python (backend)

`backend/requirements.txt` uses `>=` version specifiers for every package. There is no `requirements.lock` / Poetry lockfile / pip-tools `requirements.txt` with pinned hashes. A rebuild picks up whatever was latest on PyPI at image-build time. Combined with Railway's cache behaviours, two successive deploys can silently ship different dependency graphs.

```
fastapi>=0.129.0
uvicorn[standard]>=0.41.0
sqlalchemy>=2.0.0
alembic>=1.18.0
pydantic>=2.12.0
pydantic-settings>=2.13.0
PyJWT[crypto]>=2.8.0
bcrypt>=4.0.0
python-multipart>=0.0.22
```

`pip-audit>=2.6.0` is listed in `pyproject.toml` optional `dev`, but **is not executed in `.github/workflows/ci.yml`**. `backend/scripts/check-all.sh` isn't in the repo at the top level — unclear whether pip-audit runs locally. Either way, CI has no visible gate on known CVEs.

### Node (frontend)

`frontend/package.json` uses `^` caret ranges. `package-lock.json` is committed (good — reproducible builds locally). But `npm audit` is not run in CI. Dependabot / Renovate are not configured.

### GitHub Actions

`ci.yml` uses `actions/checkout@v4` and `actions/setup-node@v4` / `actions/setup-python@v5`. The Claude Code actions use `anthropics/claude-code-action@v1`. None are pinned to commit SHAs; a compromised or hijacked `@v4` tag on a third-party action is a supply-chain risk.

### Dockerfile

`FROM node:20-alpine` and `FROM python:3.12-slim` are unpinned by digest. `pip install --no-cache-dir -r requirements.txt` with no `--require-hashes`.

## Where

- `backend/requirements.txt` (all lines)
- `backend/pyproject.toml:16-28` (dev deps not enforced in CI)
- `.github/workflows/ci.yml` (no audit steps)
- `.github/workflows/claude*.yml` (actions pinned to `@v1/@v4/@v5` tags)
- `Dockerfile:2, 10` (no image digests)

## Recommended fix

### Python

- Introduce `pip-tools` (or `uv pip compile`):
  ```bash
  # backend/requirements.in
  fastapi
  uvicorn[standard]
  ...
  ```
  ```bash
  uv pip compile requirements.in -o requirements.txt --generate-hashes
  pip install --require-hashes -r requirements.txt
  ```
- Commit `requirements.txt` (generated, hash-pinned) + `requirements.in` (human-edited).
- In the Dockerfile, add `--require-hashes`:
  ```dockerfile
  RUN pip install --no-cache-dir --require-hashes -r requirements.txt
  ```

### Node

- Enforce `npm ci` (already used in CI ✓) and add `npm audit --omit=dev --audit-level=high` as a CI step.
- Enable Dependabot or Renovate with a weekly schedule and auto-merge minor/patch for green CI.

### Vulnerability scanning in CI

Add a new workflow `.github/workflows/security.yml`:

```yaml
name: Security
on:
  pull_request:
  schedule: [ { cron: "0 6 * * 1" } ]   # Monday 06:00 UTC

permissions:
  contents: read
  security-events: write

jobs:
  pip-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - name: pip-audit
        run: |
          pip install pip-audit
          pip-audit -r backend/requirements.txt --strict

  npm-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci --prefix frontend
      - run: npm audit --prefix frontend --audit-level=high

  codeql:
    uses: github/codeql-action/.github/workflows/codeql.yml@main
    # (or inline a CodeQL job with language: [python, javascript-typescript])

  sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: anchore/sbom-action@v0
        with: { path: ., format: cyclonedx-json, upload-artifact: true }

  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: gitleaks/gitleaks-action@v2
```

### Pin GitHub Actions to commit SHAs

```yaml
- uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11   # v4.1.1
```

Use Dependabot with `package-ecosystem: github-actions` to get automated SHA-pin bumps.

### Pin base-image digests

```dockerfile
FROM node:20.12.2-alpine@sha256:...  AS frontend-build
FROM python:3.12.4-slim@sha256:...   AS runtime
```

Refresh digests monthly via Dependabot's `docker` ecosystem.

### SBOM on release

Publish a CycloneDX SBOM as a release asset for each tag. Makes incident response (e.g. "are we exposed to CVE-XXXX?") fast.

## Acceptance criteria

- [ ] `requirements.txt` uses hash-pinned entries; `pip install --require-hashes` succeeds in Docker build.
- [ ] CI fails on any `pip-audit` high/critical finding.
- [ ] CI fails on any `npm audit --audit-level=high` finding for production deps.
- [ ] All GitHub Actions are pinned to commit SHAs.
- [ ] Dockerfile `FROM` lines include `@sha256:` digests.
- [ ] Dependabot configured for `pip`, `npm`, `docker`, `github-actions`.
- [ ] CodeQL workflow runs weekly.
- [ ] Gitleaks scan runs on PRs.

## References

- SSDF PW.4: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf
- SLSA supply-chain framework: https://slsa.dev/
- `pip-audit`: https://pypi.org/project/pip-audit/
- Gitleaks: https://github.com/gitleaks/gitleaks
