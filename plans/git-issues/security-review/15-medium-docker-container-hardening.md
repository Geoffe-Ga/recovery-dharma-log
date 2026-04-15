# [Medium] Docker image runs as root and ships unnecessary build tooling

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 5.1 — AV:L/AC:H/PR:L/UI:N/S:C/C:L/I:L/A:L
**CWEs:** CWE-250 (Execution with Unnecessary Privileges), CWE-276 (Incorrect Default Permissions), CWE-732 (Incorrect Permission Assignment for Critical Resource)
**OWASP:** A05:2021 Security Misconfiguration, CIS Docker Benchmark 4.1, NIST SP 800-190

## Summary

`Dockerfile` does not drop root, does not set a filesystem-read-only hint, exposes everything pip installed during build (including `pip` itself) in the runtime image, and has no `HEALTHCHECK`:

```dockerfile
FROM python:3.12-slim AS runtime
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ ./app/
COPY --from=frontend-build /app/frontend/dist ./static/dist
EXPOSE 8000
CMD uvicorn app.main:application --host 0.0.0.0 --port ${PORT:-8000}
```

Consequences:

- **PID 1 runs as root.** A post-exploitation foothold (RCE via any future vuln, or via a compromised dep) immediately has UID 0 in the container. Container escape CVEs in the kernel become catastrophic.
- **`pip` remains installed.** An attacker who lands arbitrary Python exec can `pip install` malicious packages at runtime.
- **`CMD` is shell form** (`CMD uvicorn ...`) which spawns `/bin/sh -c`; exec form (`CMD ["uvicorn", ...]`) gives cleaner signal handling (SIGTERM propagates to uvicorn directly) and avoids a shell in the tree.
- **No `HEALTHCHECK`.** Railway has its own health probe (`railway.json`), but local Docker/Compose usage won't restart a stuck container.
- **`EXPOSE 8000` is cosmetic only** but the `CMD` binds `0.0.0.0`. In Railway this is fine; elsewhere, consider binding to `127.0.0.1` and reverse-proxying.
- **No `.dockerignore` enforcement of secrets.** `.dockerignore` excludes `.env` — good — but does not exclude `*.sqlite3` / `*.db`. If an operator has a local `rd_log.db` with production-like data, it currently would be excluded by `*.db` — OK. Still worth explicit tests.

## Where

- `Dockerfile` (full file)
- `.dockerignore`

## Recommended fix

```dockerfile
# syntax=docker/dockerfile:1.7

# ---- Stage 1: frontend build ---------------------------------------------
FROM node:20.12.2-alpine@sha256:<digest> AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: python deps (separate so we can drop pip from runtime) -----
FROM python:3.12.4-slim@sha256:<digest> AS python-build
WORKDIR /build
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir --require-hashes -r requirements.txt

# ---- Stage 3: minimal runtime --------------------------------------------
FROM python:3.12.4-slim@sha256:<digest> AS runtime

# Non-root user
RUN groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home-dir /app --shell /sbin/nologin app

WORKDIR /app
COPY --from=python-build /opt/venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random

COPY --chown=app:app backend/app/ ./app/
COPY --from=frontend-build --chown=app:app /app/frontend/dist ./static/dist

USER app:app
EXPOSE 8000

# Run uvicorn directly (exec form) so SIGTERM reaches it
CMD ["uvicorn", "app.main:application", "--host", "0.0.0.0", "--port", "8000"]

# Local Docker healthcheck (Railway uses its own)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/api/health',timeout=2).status==200 else 1)"
```

### Additional hardening

- Mount the data volume (if any persistent SQLite were ever used in prod) as `:ro` except for the DB path. Strongly prefer managed Postgres (Railway) over SQLite in production.
- Run with the container read-only filesystem when possible: `read_only: true` in compose, with a tmpfs for `/tmp` only.
- Drop Linux capabilities to none and re-add only what uvicorn needs: `--cap-drop=ALL`.
- Seccomp: allow only the default Docker seccomp profile (Railway does this).

### Static scanning

Add `trivy fs .` and `trivy image <image>` steps to the security CI workflow ([#14](./14-medium-dependency-pinning-and-scanning.md)):

```yaml
- uses: aquasecurity/trivy-action@master
  with:
    scan-type: fs
    severity: HIGH,CRITICAL
    exit-code: 1
```

### Config at runtime

- `PORT` should default in Python code, not only in the shell: `--port ${PORT:-8000}` works because of shell form today; with exec form, move the default into `uvicorn` config or start with a tiny entrypoint wrapper.

## Acceptance criteria

- [ ] `docker run --rm -it <image> id` prints `uid=1001(app)`.
- [ ] `docker run --rm -it <image> which pip` returns non-zero (pip is absent).
- [ ] `HEALTHCHECK` is defined and passes in local `docker compose up`.
- [ ] `FROM` lines include `@sha256:` digests.
- [ ] `CMD` uses exec form.
- [ ] Trivy scan has no HIGH/CRITICAL findings in CI.

## References

- NIST SP 800-190: https://csrc.nist.gov/publications/detail/sp/800-190/final
- CIS Docker Benchmark: https://www.cisecurity.org/benchmark/docker
- Trivy: https://aquasecurity.github.io/trivy/
