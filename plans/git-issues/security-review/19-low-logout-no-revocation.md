# [Low] "Logout" is client-side only — tokens remain valid server-side

**Severity:** 🟢 Low
**CVSS v3.1 (estimated):** 3.1 — AV:N/AC:H/PR:L/UI:N/S:U/C:L/I:N/A:N
**CWEs:** CWE-613 (Insufficient Session Expiration)
**OWASP:** A07:2021 Identification and Authentication Failures, ASVS V3.5.2

## Summary

The frontend logout flow is:

```ts
// frontend/src/api/index.ts
export function logout(): void {
  setToken(null);
}
```

There is no backend endpoint. If a user clicks "Log Out" on a shared device and the token was stolen beforehand, the attacker's copy of the token remains valid for up to 24 hours ([#05](./05-high-jwt-design-weaknesses.md)).

The problem compounds with:

- **No token revocation on password change** (there is no password-change endpoint at all — `POST /auth/register` is the only password-writing path).
- **No "sign out of all sessions" control** for users who suspect compromise.
- **Token stored in `localStorage`** ([#06](./06-high-token-storage-localstorage-xss.md)) — extractable by any XSS.

## Where

- `frontend/src/api/index.ts:54-56` — client-only logout.
- `backend/app/routers/auth.py` — no logout endpoint.
- `backend/app/auth.py:40-65` — no revocation list consulted.

## Recommended fix

### Revocation store

A minimal design:

```python
# backend/app/models.py
class RevokedToken(Base):
    __tablename__ = "revoked_tokens"
    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(UTC))
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    # expires_at == original token exp → row can be purged after that time
```

Add a daily job (or on-access lazy cleanup) that deletes rows where `expires_at < now()`.

### Endpoints

```python
# backend/app/routers/auth.py
@router.post("/logout")
def logout(
    payload: dict = Depends(_verify_token_raw),   # returns the decoded payload, not the User
    db: Session = Depends(get_db),
) -> dict:
    db.add(RevokedToken(jti=payload["jti"], expires_at=datetime.fromtimestamp(payload["exp"], UTC)))
    db.commit()
    log_activity(db, ..., action="user_logged_out")
    return {"status": "ok"}


@router.post("/logout-all")
def logout_all(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    # Bump password_version so all pre-increment tokens fail validation
    current_user.password_version = (current_user.password_version or 0) + 1
    db.commit()
    log_activity(db, ..., action="user_logged_out_all")
    return {"status": "ok"}


@router.post("/change-password")
def change_password(body: PasswordChange,
                    current_user: User = Depends(get_current_user),
                    db: Session = Depends(get_db)) -> dict:
    if not verify_password(body.old_password, current_user.hashed_password):
        raise HTTPException(401, "Old password incorrect")
    current_user.hashed_password = hash_password(body.new_password)
    current_user.password_version = (current_user.password_version or 0) + 1   # invalidate old tokens
    db.commit()
    return {"status": "ok"}
```

Add `password_version` to `User` (default 0). Include it in `create_access_token` as `pv`; in `get_current_user`, require `payload["pv"] == user.password_version`.

### Frontend wiring

```ts
// frontend/src/api/index.ts
export async function logout(): Promise<void> {
  try { await api.post("/auth/logout"); }
  catch { /* ignore — we still clear the client state */ }
  setToken(null);
}
```

Add a "Log out of all sessions" button in Settings.

### With cookies ([#06](./06-high-token-storage-localstorage-xss.md))

The logout endpoint clears the cookies via `Set-Cookie: rd_log_token=; Max-Age=0`. Browser-side storage is never exposed to JS.

## Acceptance criteria

- [ ] `POST /auth/logout` revokes the current JWT's `jti` in the DB.
- [ ] A revoked JWT used in `Authorization: Bearer` returns 401.
- [ ] `POST /auth/logout-all` invalidates every token for the user (by bumping `password_version`).
- [ ] `POST /auth/change-password` invalidates all pre-change tokens.
- [ ] Retention job purges expired rows from `revoked_tokens`.

## References

- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- RFC 7009 (Token Revocation): https://datatracker.ietf.org/doc/html/rfc7009
