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
RUN npm ci --no-audit --no-fund
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

# Drop privileges.
USER app:app

EXPOSE 8000

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
