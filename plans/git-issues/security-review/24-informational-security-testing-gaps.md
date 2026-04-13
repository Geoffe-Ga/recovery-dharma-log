# [Informational] Security testing gaps

## Summary

The project has strong functional-test discipline (coverage thresholds, mutation testing via Stryker/mutmut, pre-commit linters). It does **not** yet have targeted *security* tests. This file lists recommended additions, classified by test pyramid layer.

## Static analysis (already partial)

Present:
- `bandit` — Python static SAST (configured in `pyproject.toml`, runs in pre-commit).
- `ruff` — includes some security-relevant rules (`S` plugin isn't enabled currently — consider adding `"S"` to the ruff select list).
- `detect-secrets` — prevents obvious credentials from being committed.
- `mypy --strict` — type safety (prevents many logic bugs that would manifest as authZ holes).

Recommended additions:
- **`ruff` with Bandit rules:** add `"S"` to `[tool.ruff.lint] select = [...]` — overlaps with bandit but reports during normal ruff run.
- **`semgrep --config auto`** in CI — finds OWASP-pattern issues (e.g. `f"...<...{var}..."` HTML emission, `except Exception: pass`).
- **CodeQL** weekly for Python + TypeScript ([#14](./14-medium-dependency-pinning-and-scanning.md)).
- **`pip-audit`** / **`npm audit`** gates in CI ([#14](./14-medium-dependency-pinning-and-scanning.md)).
- **Trivy fs** scan for Dockerfile, lockfiles, and embedded config ([#15](./15-medium-docker-container-hardening.md)).

## Unit tests

Add the following under `backend/tests/security/`:

```python
# backend/tests/security/test_config.py
def test_missing_secret_key_fails(monkeypatch):
    monkeypatch.delenv("RD_LOG_SECRET_KEY", raising=False)
    monkeypatch.setenv("RD_LOG_ENVIRONMENT", "production")
    with pytest.raises(Exception):
        importlib.reload(config)

def test_dev_secret_in_source_removed():
    # assert the dev-secret string no longer appears in app/*.py
    root = pathlib.Path("backend/app")
    for p in root.rglob("*.py"):
        assert "dev-secret-key-change-in-production" not in p.read_text()
```

```python
# backend/tests/security/test_password_policy.py
def test_reject_short_password(client):
    r = client.post("/auth/register", json={"username": "u", "password": "short"})
    assert r.status_code == 422

def test_reject_over_72_bytes(client):
    r = client.post("/auth/register", json={"username": "u", "password": "A" * 100})
    assert r.status_code == 422
```

```python
# backend/tests/security/test_html_escape.py
def test_printable_export_escapes_group_name(client, auth, db):
    set_group_name(db, "<script>x</script>")
    body = client.get("/api/export/printable", headers=auth).text
    assert "<script>x</script>" not in body
    assert "&lt;script&gt;" in body
```

```python
# backend/tests/security/test_csv_injection.py
@pytest.mark.parametrize("payload", ["=1+1", "+SUM(A1)", "-2+3", "@A1", "\tleading"])
def test_csv_neutralises_formula(payload, client, auth, db):
    set_speaker_name(db, payload)
    body = client.get("/api/export/csv", headers=auth).text
    for line in body.splitlines()[1:]:
        assert not any(field.startswith((c, '"' + c)) for field in line.split(",") for c in "=+-@\t")
```

```python
# backend/tests/security/test_authorization.py
def test_cross_group_isolation(client, alice_token, bob_token, bob_group):
    r = client.get(f"/api/overrides/", headers={"Authorization": f"Bearer {alice_token}"})
    assert bob_group_id_not_in(r.json(), bob_group)

def test_member_cannot_change_settings(member_client):
    r = member_client.put("/api/settings/", json={"name": "evil"})
    assert r.status_code == 403

def test_forged_jwt_rejected(client):
    forged = jwt.encode({"sub": "1", "exp": 9999999999}, "wrong-key", algorithm="HS256")
    r = client.get("/api/meetings/upcoming", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401
```

```python
# backend/tests/security/test_rate_limit.py
def test_login_rate_limited(client):
    for _ in range(5):
        client.post("/auth/login", data={"username": "x", "password": "y"})
    r = client.post("/auth/login", data={"username": "x", "password": "y"})
    assert r.status_code == 429
```

```python
# backend/tests/security/test_headers.py
def test_security_headers(client):
    r = client.get("/api/health")
    assert "content-security-policy" in r.headers
    assert r.headers["x-content-type-options"] == "nosniff"
    assert "referrer-policy" in r.headers
```

## Property-based tests (hypothesis)

```python
# backend/tests/security/test_property.py
from hypothesis import given, strategies as st

@given(st.text(min_size=0, max_size=2000))
def test_speaker_name_roundtrip_csv(name):
    # After going through generate_csv_export, the speaker cell must parse back to the original.
    ...

@given(st.text())
def test_topic_name_html_safe(name):
    out = render_printable_cell(name)
    assert "<script" not in out.lower() or "&lt;script" in out.lower()
```

## Integration / end-to-end (Playwright or Cypress, future)

- Login / logout flows.
- XSS regression: inject payload, open printable export, assert no `alert` fires and no `localStorage` read.
- CORS: test from an allowed and a disallowed origin.
- CSP violation reporter: set up a `/csp-report` endpoint; alert on unexpected reports from production.

## Dynamic scanning

- **OWASP ZAP baseline scan** in CI (nightly, against a local deploy):
  ```yaml
  - uses: zaproxy/action-baseline@v0.12.0
    with:
      target: 'http://localhost:8000'
  ```
- **nuclei** community templates against a staging endpoint.

## Fuzz testing

FastAPI is Pydantic-driven so most boundary-condition fuzzing shows up as 422s. Still, worth a **hypothesis-fastapi** or **schemathesis** run against the OpenAPI:

```yaml
- run: |
    pip install schemathesis
    schemathesis run http://localhost:8000/api/openapi.json --checks all
```

## Manual pentest checklist (before public launch)

- [ ] Run through every attack tree in [`22-informational-threat-model.md`](./22-informational-threat-model.md).
- [ ] Burp repeater: send each endpoint an oversize body (1 MB), malformed JSON, unexpected types.
- [ ] Subdomain takeover check for the deployed hostname (CNAME to Railway).
- [ ] `testssl.sh` against the public domain — score A or above.
- [ ] Logged-out review of `/docs` and `/openapi.json` — disabled in prod.
- [ ] Dependency re-check week of release.

## Monitoring & alerting

- [ ] 4xx/5xx rate alerts (Grafana Cloud / Datadog / Railway metrics).
- [ ] Auth failure rate alert (sudden spike → potential credential stuffing).
- [ ] CSP report-uri alerting.
- [ ] Weekly `pip-audit` / `npm audit` summary posted to a channel.

## Coverage goal for security tests

A reasonable target: the `backend/tests/security/` directory should reach the same 90% branch-coverage bar as the rest of the tests, and every finding in this review should have at least one regression test tied to its fix PR.
