# RCA: Railway Healthcheck Failure

## Problem Statement

Railway deployment builds and starts successfully. Logs show:
```
Starting Container
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

But the healthcheck at `/api/health` fails:
```
Attempt #1 failed with service unavailable. Continuing to retry for 19s
Attempt #2 failed with service unavailable. Continuing to retry for 8s
1/1 replicas never became healthy!
```

"Service unavailable" means Railway cannot reach the app — not an HTTP error code, but a connection failure.

## Verified NOT the Cause

| Hypothesis | Evidence ruling it out |
|---|---|
| Starlette routing broken | Local TestClient simulation: `GET /api/health` → 200 |
| SPA fallback interfering | Local test: API routes take priority over static mount |
| Startup guard crash | Logs show "Application startup complete" — guard passed |
| Frontend build failed | Docker build succeeded (container started) |
| Missing package-lock.json | `frontend/package-lock.json` is tracked in git |
| FastAPI lifespan not called | `/health` doesn't use DB; would return 200 regardless |

## Root Cause (most likely)

**PORT mismatch**: Railway sets a `PORT` env var and routes healthchecks to that port inside the container. The app logs show it's listening on port 8000, which means either:

1. Railway didn't set `PORT` (so `${PORT:-8000}` defaulted to 8000), but Railway routes healthchecks to a *different* internal port, OR
2. Railway set `PORT` to 8000, but the `railway.json` healthcheck config isn't being parsed correctly (wrong schema URL or field names), causing Railway to use a different healthcheck mechanism

We cannot verify which without Railway CLI access or dashboard inspection of the actual `PORT` variable.

## Contributing Factors

- `railway.json` schema URL (`https://railway.com/railway.schema.json`) may be incorrect — Railway docs show varying formats
- `healthcheckTimeout: 30` may be a field Railway doesn't recognize (could be `healthCheckTimeout` or a different structure)
- No explicit `PORT` variable set in Railway — relying on Railway's auto-injection

## Fix Strategy

### Option A: Remove railway.json healthcheck, configure in dashboard (RECOMMENDED)
Railway's dashboard healthcheck config is authoritative. The `railway.json` might be silently ignored or misconfigured. Configure healthcheck path and timeout directly in Railway's service settings.

### Option B: Explicit PORT variable
Add `PORT=8000` in Railway's Variables tab so there's no ambiguity.

### Option C: Both A and B
Belt and suspenders. Do both.

## Prevention

- Always verify Railway config by checking deploy logs for PORT binding
- Use Railway CLI (`railway logs`) for debugging when possible
- Test Docker image locally before deploying: `docker run -p 8000:8000 -e RD_LOG_SECRET_KEY=test rd-log`
