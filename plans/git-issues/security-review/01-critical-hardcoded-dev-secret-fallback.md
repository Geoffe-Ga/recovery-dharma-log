# [Critical] Hardcoded dev JWT secret key with insufficient production guard

**Severity:** 🔴 Critical
**CVSS v3.1 (estimated):** 9.1 — AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N
**CWEs:** CWE-798 (Use of Hard-coded Credentials), CWE-1188 (Insecure Default Initialization of Resource), CWE-321 (Use of Hard-coded Cryptographic Key)
**OWASP:** A02:2021 Cryptographic Failures, A05:2021 Security Misconfiguration, ASVS V2.10.3 / V14.1.1

## Summary

`Settings.secret_key` defaults to the publicly visible constant `"dev-secret-key-change-in-production"` in [`backend/app/config.py:11`](../../../backend/app/config.py). The production guard in [`backend/app/main.py:129-134`](../../../backend/app/main.py) only trips when `settings.environment != "development"`. The environment defaults to `"development"` (`config.py:15`) — so an operator who **sets `RD_LOG_DATABASE_URL` and `RD_LOG_CORS_ORIGINS` but forgets `RD_LOG_ENVIRONMENT=production`** will run a publicly accessible instance with a secret key that is literally in this Git history.

Because the JWT algorithm is HS256 (symmetric), anyone who knows the key — which is everyone who has read the repo — can mint a valid token for any `sub` (username). The backend's `get_current_user` dependency looks up the user by `username` from the JWT; no other claim is checked. A single forged JWT → full compromise of any existing account, full control of that user's group (settings, invite codes, meeting log, book position), and arbitrary actions recorded against them in the audit log.

## Where

- `backend/app/config.py:11` — default value `"dev-secret-key-change-in-production"`.
- `backend/app/config.py:15` — default environment `"development"`.
- `backend/app/main.py:129-134` — guard only fires on `environment != "development"`.
- `backend/app/auth.py:30-37` — signs with this key.
- `backend/app/auth.py:50-55` — verifies with this key.
- `.env.example` — documents the variables but an operator can still miss one.

## Attack narrative

1. Attacker reads the public GitHub repository and notes the dev secret.
2. Attacker forges a JWT with `{"sub": "<victim-username>", "exp": <future>}` signed with `HS256` and the known key using a one-line script:
   ```python
   import jwt, time
   print(jwt.encode({"sub": "alice", "exp": int(time.time()) + 3600},
                    "dev-secret-key-change-in-production", algorithm="HS256"))
   ```
3. Attacker sends the token in `Authorization: Bearer …`. The server accepts it.
4. Attacker has full in-group privileges of `alice`.

Username discovery is easy: the register endpoint discloses which usernames exist ([#10](./10-medium-username-enumeration.md)). Even without that, common names (`admin`, `secretary`, group organiser's first name) are worth trying.

## Why the current guard is not sufficient

- **Default fails open.** `environment` defaults to `"development"`, so the most dangerous configuration is the zero-config one.
- **Startup-only check.** Triggers only during `lifespan`. In unit tests, scripts (`seed.py`), or any tooling that imports `app.auth` without starting the app, nothing stops the dev key from being used.
- **Not a function of the key's value.** The guard compares a string constant to a string constant; if the value of the fallback changes in future, the guard still won't detect "an operator is using the repo default".

## Recommended fix

Adopt a **fail-closed** default: treat the absence of `RD_LOG_SECRET_KEY` as an error, except in the explicit test environment.

```python
# backend/app/config.py
import os
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Recovery Dharma Secretary Log"
    database_url: str = "sqlite:///./rd_log.db"
    secret_key: SecretStr  # REQUIRED; no default
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60  # also see #05
    cors_origins: str = "http://localhost:5173"
    environment: str = "development"

    model_config = {"env_prefix": "RD_LOG_"}


def _load_settings() -> Settings:
    # Auto-generate a per-process ephemeral key only when clearly in tests.
    if os.environ.get("PYTEST_CURRENT_TEST") or os.environ.get("RD_LOG_ENVIRONMENT") == "test":
        os.environ.setdefault("RD_LOG_SECRET_KEY", "test-only-" + os.urandom(16).hex())
    return Settings()


settings = _load_settings()
```

Access it as `settings.secret_key.get_secret_value()` wherever it is consumed.

Additionally:
- Remove the hardcoded `_DEV_SECRET_KEY` from `main.py`. The value should never be compared — it should never exist.
- Log a **warning** (not an error) at startup with `settings.algorithm`, `access_token_expire_minutes`, `environment`, and a hashed fingerprint (`hashlib.sha256(key).hexdigest()[:8]`) of the secret to help operators confirm rotation across deployments **without** leaking the value.
- Document a key-rotation SOP: rotate on compromise, and plan rotation as part of scheduled maintenance.

### Defence-in-depth

- Add `iss` (`"rd-log"`) and `aud` (deployment hostname) claims to tokens (see [#05](./05-high-jwt-design-weaknesses.md)) — so a leaked key from a test deployment still won't sign tokens accepted by production.
- Migrate off HS256 to asymmetric (EdDSA / RS256) once you have a second service, so the signing key need not live on every backend instance.
- Consider moving to a managed KMS (Railway secrets + KMS integration, or AWS KMS signing) if operational complexity allows.

## Acceptance criteria

- [ ] Startup fails with a clear message on any environment where `RD_LOG_SECRET_KEY` is unset **and** `RD_LOG_ENVIRONMENT` is not one of `{"test", "development"}`.
- [ ] In `"development"`, startup fails unless either a real key is supplied or a well-known `"dev-"` prefix is explicitly used **and** the server refuses to bind to anything other than `localhost`.
- [ ] `"dev-secret-key-change-in-production"` is removed from the source tree (ripgrep returns zero matches after the fix).
- [ ] Unit test asserts that constructing `Settings()` without `RD_LOG_SECRET_KEY` raises `ValidationError`.
- [ ] Operations runbook (`docs/operations/secrets.md`) documents generation (`python -c "import secrets; print(secrets.token_urlsafe(32))"`), rotation, and revocation of tokens after rotation.

## References

- CWE-798: https://cwe.mitre.org/data/definitions/798.html
- OWASP ASVS V2.10: https://owasp.org/www-project-application-security-verification-standard/
- `python-jose` JWT best practice: https://datatracker.ietf.org/doc/html/rfc8725
