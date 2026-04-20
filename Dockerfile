#
# Hardened multi-stage build for the Recovery Dharma Log application.
#
# Addresses security review Issue #15 (Docker container hardening):
#   - Runs the runtime container as an unprivileged user (uid 1001).
#   - Installs Python dependencies into an isolated virtualenv in a build stage
#     so that `pip` is NOT present in the final runtime image.
#   - Uses exec-form CMD so SIGTERM propagates directly to uvicorn.
#   - Declares a HEALTHCHECK for local docker/compose usage.
#
# NOTE on image digest pinning: CIS Docker Benchmark recommends pinning to an
# immutable `@sha256:<digest>` as well. We leave this to the release workflow
# (renovate / dependabot / Trivy) so that digests stay fresh and verified
# against the registry. See `.github/workflows/security.yml`.

# ---- Stage 1: frontend build --------------------------------------------- #
# Pinned to major LTS track. The frontend stage is discarded after build, so
# only the compiled dist/ artifacts carry into the runtime image.
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: python deps (isolated so we can drop pip from runtime) ----- #
FROM python:3.12-slim AS python-build
WORKDIR /build

# Create an isolated virtualenv and install dependencies into it. The
# virtualenv is copied into the runtime image; pip is explicitly removed there.
RUN python -m venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ---- Stage 3: minimal runtime -------------------------------------------- #
FROM python:3.12-slim AS runtime

# Create an unprivileged system user/group to run the application.
# Using a fixed uid/gid keeps file ownership deterministic across rebuilds and
# makes Kubernetes `runAsUser` / `runAsNonRoot` policies easy to enforce.
RUN groupadd --system --gid 1001 app \
 && useradd  --system --uid 1001 --gid app --home-dir /app --shell /sbin/nologin app

# `gosu` is a tiny (<2MB) setuid-aware wrapper that drops privileges from
# root to the target user before exec'ing the command. The init script
# (`docker-entrypoint.sh`) uses it so that the container can briefly run as
# root to chown Railway's root-owned bind-mounted volume, then hand off to
# the hardened `app` user for the actual application process.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gosu \
 && rm -rf /var/lib/apt/lists/* \
 && gosu nobody true

WORKDIR /app

# Copy the virtualenv from the build stage, then strip pip from both the
# venv and the base image's system Python so that an attacker who reaches
# arbitrary code execution cannot install additional packages.
COPY --from=python-build /opt/venv /opt/venv
RUN rm -f /opt/venv/bin/pip /opt/venv/bin/pip3 /opt/venv/bin/pip3.* \
          /usr/local/bin/pip /usr/local/bin/pip3 /usr/local/bin/pip3.* \
 && rm -rf /usr/local/lib/python3.12/ensurepip
ENV PATH=/opt/venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONHASHSEED=random

# Application source + built frontend. Chown everything to the unprivileged
# user so that read-only root filesystems still work with write-local volumes.
COPY --chown=app:app backend/app/ ./app/
COPY --from=frontend-build --chown=app:app /app/frontend/dist ./static/dist

# Init script: when launched as root (the Railway/default case) it chowns
# the SQLite database directory so the unprivileged app user can write to
# it, then drops to `app:app` via gosu and exec's CMD. When the container
# is run with a non-root uid enforced by the orchestrator, the script
# skips the chown step and exec's CMD directly, so the image remains
# usable in environments that pin the uid themselves.
COPY --chmod=0755 backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

# Start as root so the entrypoint can adjust volume ownership. The
# entrypoint immediately drops to uid 1001 via `gosu` before exec'ing the
# CMD, so the long-running Python process still satisfies the hardening
# requirement from Issue #15 (verified by the security workflow, which
# runs `id -u` *through* the entrypoint to observe the effective main-
# process uid).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Exec form so the Python process is PID 1 and receives SIGTERM directly from
# the container runtime (Railway, docker, kubelet). ``app.entrypoint`` reads
# PORT/HOST at start time, which is what Railway expects, without needing
# shell expansion in CMD.
CMD ["python", "-m", "app.entrypoint"]

# Local healthcheck (Railway uses its own probe from railway.json).
# The production app mounts FastAPI under /api, so /api/health is the live
# route; see backend/app/main.py.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import sys, urllib.request; \
sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3).status == 200 else 1)"
