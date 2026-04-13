# [High] Access token stored in `localStorage` — fully exposed to any XSS

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 7.3 — AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:N
**CWEs:** CWE-922 (Insecure Storage of Sensitive Information), CWE-614 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute — adjacent), CWE-1004 (Sensitive Cookie Without 'HttpOnly' — adjacent)
**OWASP:** A07:2021 Identification and Authentication Failures, ASVS V3.2.3

## Summary

The SPA stores the bearer token in `localStorage`:

```ts
// frontend/src/api/client.ts
export const TOKEN_KEY = "rd_log_token";
export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else       localStorage.removeItem(TOKEN_KEY);
}
```

`localStorage` is accessible synchronously to any JavaScript running on the same origin. Combined with the lack of CSP ([#07](./07-high-missing-security-headers.md)), any successful XSS (see [#02](./02-critical-stored-xss-html-export.md)) or any malicious third-party dependency loaded from `fonts.googleapis.com` / `fonts.gstatic.com` (currently used for Lato) can read the token and exfiltrate it.

The attacker's window is the remaining TTL (up to 24 hours today — see [#05](./05-high-jwt-design-weaknesses.md)) because the token cannot be revoked server-side.

## Why not "just fix XSS"

Defense in depth. `httpOnly` cookies take the token out of JS reach completely, so a stored XSS loses the session-stealing capability and reduces to "arbitrary actions in the victim's session while the tab is open" — still bad, but recoverable. Multiple real-world breaches (Slack 2023, etc.) trace the final escalation to `localStorage` token theft.

## Where

- `frontend/src/api/client.ts:1-16`
- `frontend/src/hooks/useAuth.ts:1-97` — reads token via `isLoggedIn()`.
- `backend/app/routers/auth.py:88-102` — issues token in JSON body, not a Set-Cookie.

## Recommended fix

Move to **HTTP-only, Secure, SameSite=Strict/Lax cookies** for the access token. Add a CSRF token using the **double-submit cookie** pattern because `fetch` is used for state-changing calls.

### Backend

```python
# backend/app/routers/auth.py
from fastapi import Response
from secrets import token_urlsafe

@router.post("/login")
def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Incorrect username or password",
                            headers={"WWW-Authenticate": "Bearer"})

    access = create_access_token(user, audience=settings.public_url)
    csrf = token_urlsafe(32)
    response.set_cookie(
        "rd_log_token", access,
        httponly=True, secure=True, samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        "rd_log_csrf", csrf,
        httponly=False, secure=True, samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return Token(access_token="", token_type="cookie")   # body only for back-compat
```

Change `get_current_user` to read the cookie **or** `Authorization` header (back-compat for the migration window). Add middleware that, on POST/PUT/DELETE requests, requires the `X-CSRF-Token` header to equal the `rd_log_csrf` cookie value.

### Frontend

```ts
// frontend/src/api/client.ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (method !== "GET" && method !== "HEAD") {
    const csrf = document.cookie.match(/(?:^|; )rd_log_csrf=([^;]+)/)?.[1];
    if (csrf) headers["X-CSRF-Token"] = decodeURIComponent(csrf);
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
  // ...
}
```

`setToken` / `getToken` / `TOKEN_KEY` are deleted. `useAuth` checks authentication by calling a cheap `GET /auth/me` at mount and on `storage` events.

### Bonus: Sign out cleanly

Implement `POST /auth/logout` that (a) revokes the JWT `jti` ([#05](./05-high-jwt-design-weaknesses.md)), and (b) sends `Set-Cookie: rd_log_token=; Max-Age=0`.

### If the cookie migration is too expensive short-term

- At minimum, add a **strict CSP** ([#07](./07-high-missing-security-headers.md)) so XSS becomes much harder to land.
- Add **Trusted Types** (`Content-Security-Policy: require-trusted-types-for 'script'`) — React 19 supports this.
- Fetch the Lato font from a bundled/self-hosted location instead of Google Fonts to remove that supply-chain leaf.

## Acceptance criteria

- [ ] Login response sets `rd_log_token` cookie with `HttpOnly; Secure; SameSite=Lax`.
- [ ] `localStorage.getItem("rd_log_token")` returns `null` anywhere in the app.
- [ ] State-changing requests without an `X-CSRF-Token` header return HTTP 403.
- [ ] Logout endpoint clears both cookies and revokes the JWT `jti`.
- [ ] E2E test verifies that document.cookie cannot be read for the access token (`HttpOnly` enforcement).

## References

- OWASP Session Management: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- CWE-922: https://cwe.mitre.org/data/definitions/922.html
- Double-submit cookie pattern: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#double-submit-cookie
