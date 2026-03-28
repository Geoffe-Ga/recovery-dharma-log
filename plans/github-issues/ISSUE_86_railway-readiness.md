## Problem

The app has no deployment configuration. It only runs locally via
`run-backend.sh` + `run-frontend.sh`. There is no way to demo it on a
phone or share it with others.

Specific gaps:
- No Dockerfile or container config
- CORS is hardcoded to `localhost:5173` and `localhost:3000`
- `database.py` passes `check_same_thread=False` unconditionally (SQLite-only)
- Frontend uses a Vite dev proxy for `/api` — no production serving strategy
- No `.env.example` documenting required environment variables
- No `railway.json` or deployment manifest
- The dev secret key (`dev-secret-key-change-in-production`) has no guard
  against accidental use in production

## Proposed Solution

Make the app deployable to Railway as a **single service** that serves
both the FastAPI backend and the Vite-built frontend static files.

### Architecture: Monolithic Single-Service Deploy

```
Railway Service (single container)
├── FastAPI (uvicorn) on $PORT
│   ├── /health          → health check
│   ├── /auth/*, /meetings/*, ...  → API routes
│   └── /*               → serves frontend/dist/ (static files + SPA fallback)
└── SQLite on Railway Volume (/data/rd_log.db)
```

**Why single service?** Simpler, cheaper, no CORS issues. The frontend
build is ~2MB of static files — FastAPI can serve them directly via
`StaticFiles` with an SPA fallback.

### Deliverables

1. **Dockerfile** (multi-stage)
   - Stage 1: Node 20 — `npm ci && npm run build` in `frontend/`
   - Stage 2: Python 3.12-slim — install backend deps, copy built frontend
   - Run: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

2. **`railway.json`** — build/deploy config with health check

3. **`.env.example`** — document all `RD_LOG_*` env vars

4. **Backend changes**:
   - `main.py`: Mount `StaticFiles` for frontend + SPA fallback route
   - `main.py`: Make CORS origins configurable via `RD_LOG_CORS_ORIGINS`
   - `config.py`: Add `cors_origins` and `port` settings; add startup
     guard that refuses to start if secret key is the dev default and
     `RD_LOG_ENV` is `production`
   - `database.py`: Only pass `check_same_thread=False` for SQLite URLs

5. **`.dockerignore`** — keep image small

## Acceptance Criteria

- [ ] `docker build -t rd-log .` succeeds from repo root
- [ ] `docker run -p 8000:8000 rd-log` serves the full app at `localhost:8000`
- [ ] Health check at `/health` returns 200
- [ ] API routes work at `/auth/login`, `/meetings/upcoming`, etc.
- [ ] Frontend SPA loads at `/` with client-side routing working
- [ ] `railway.json` present with build + deploy + healthcheck config
- [ ] `.env.example` documents all required env vars
- [ ] CORS origins configurable via environment variable
- [ ] Dev secret key blocked in production mode
- [ ] SQLite `check_same_thread` only applied for SQLite URLs
- [ ] All existing backend + frontend tests still pass
- [ ] `./scripts/check-all.sh` passes in both `backend/` and `frontend/`
