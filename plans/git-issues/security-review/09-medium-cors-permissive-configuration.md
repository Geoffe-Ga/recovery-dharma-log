# [Medium] Permissive CORS configuration (wildcard methods & headers with credentials)

**Severity:** 🟡 Medium
**CVSS v3.1 (estimated):** 5.3 — AV:N/AC:H/PR:L/UI:R/S:U/C:L/I:L/A:N
**CWEs:** CWE-942 (Permissive Cross-domain Policy with Untrusted Domains), CWE-346 (Origin Validation Error)
**OWASP:** A05:2021 Security Misconfiguration, API8:2023 Security Misconfiguration, ASVS V14.5

## Summary

The CORS configuration in `backend/app/main.py:142-148` is:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Three problems compound:

1. **`allow_methods=["*"]` + `allow_headers=["*"]` + `allow_credentials=True`** is the riskiest legal combination. Modern Starlette's `CORSMiddleware` reflects the request header list rather than echoing `*`, which sidesteps the browser spec prohibition — but it also means a cross-origin attacker with any allowed origin can carry custom headers (including `Authorization` if cookies/token flow ever moves) without preflight limits.
2. **Origin list parsed from a comma-separated env var with no validation**. `RD_LOG_CORS_ORIGINS=,,http://attacker.tld,http://localhost:5173` yields `["", "", "http://attacker.tld", "http://localhost:5173"]` — the empty strings are tolerated by CORSMiddleware. An operator misconfiguration (e.g. accidentally using `*` or a regex-looking value) gets silently baked into production.
3. **No protection against null origin** (e.g. local file:// or sandboxed iframe contexts). `null` is not in the default `allow_origins` list, which is fine, but there is no assertion and no test.

Because there is no cookie-based session today (token lives in `Authorization` header / `localStorage`), the practical exploitation surface via CORS is narrow right now. That changes the moment cookies are introduced ([#06](./06-high-token-storage-localstorage-xss.md)) or if a third-party site is added to `allow_origins` for any reason.

## Where

- `backend/app/main.py:142-148`
- `backend/app/config.py:14` — default `"http://localhost:5173,http://localhost:3000"`.
- `.env.example:17` — operator-facing documentation.

## Recommended fix

```python
# backend/app/main.py
from urllib.parse import urlparse

def _parse_origins(raw: str) -> list[str]:
    origins: list[str] = []
    for entry in raw.split(","):
        o = entry.strip()
        if not o:
            continue
        parsed = urlparse(o)
        if parsed.scheme not in ("http", "https"):
            raise RuntimeError(f"Invalid CORS origin (scheme): {o!r}")
        if not parsed.netloc:
            raise RuntimeError(f"Invalid CORS origin (host): {o!r}")
        if parsed.scheme == "http" and parsed.hostname not in ("localhost", "127.0.0.1"):
            raise RuntimeError(f"Refusing non-HTTPS origin outside localhost: {o!r}")
        if o == "*":
            raise RuntimeError("Wildcard CORS origin is not allowed with credentials")
        origins.append(o)
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_origins(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
    max_age=600,
)
```

### Defence-in-depth

- Add a startup assertion: if the app is running at `environment == "production"` and any origin is non-HTTPS (except `localhost` in test harnesses), log an error and refuse to start.
- Add a unit test over `_parse_origins` covering empties, wildcards, bad schemes, and mixed cases.
- If the API domain is same-origin with the SPA in production (via Railway Starlette mount), **remove** CORSMiddleware entirely for the production path — it is unnecessary when the SPA is served from the same origin and only invites misconfiguration.

### API vs. SPA split

`main.py` mounts `api` at `/api` when `static/dist/` exists. In that deployment mode, CORS is not needed at all. Add:

```python
if _static_dir.is_dir():
    # same-origin deployment: no CORS needed
    pass
else:
    app.add_middleware(CORSMiddleware, ...)
```

## Acceptance criteria

- [ ] Deployment with same-origin SPA does not add `Access-Control-Allow-Origin` to responses at all.
- [ ] Origin string with `*`, empty entry, or `http://` (non-localhost) fails startup in production.
- [ ] Allowed methods/headers are explicit lists, not `["*"]`.
- [ ] Unit tests cover origin parsing edge cases.

## References

- MDN CORS: https://developer.mozilla.org/docs/Web/HTTP/CORS
- OWASP CORS Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#cors
- CWE-942: https://cwe.mitre.org/data/definitions/942.html
