# Backlog Grooming — 2026-02-25

## PRs Analyzed

| PR | Title | Merged | Issues |
|----|-------|--------|--------|
| #58 | feat: add attendance tracking | 2026-02-25 | Closes #28 |
| #57 | feat: show topic last-used dates | 2026-02-25 | Closes #25 |
| #56 | feat: show reading plan progress visually | 2026-02-25 | Closes #22 |
| #55 | feat: make meeting log entries editable | 2026-02-25 | Closes #21 |

Also merged directly to main: fix for duplicate isort config keys in `pyproject.toml` (no issue).

## Issues Closed

| Issue | Title | PR | Auto-closed | Comment Added |
|-------|-------|-----|-------------|---------------|
| #21 | Editable log entries | #55 | Yes | Yes |
| #22 | Reading plan progress | #56 | Yes | Yes |
| #25 | Topic last-used dates | #57 | Yes | Yes |
| #28 | Attendance tracking | #58 | Yes | Yes |

## Gaps Identified

- pyproject.toml had duplicate `force_sort_within_sections` and `known_first_party` keys causing TOML parse failures — fixed directly on main, no issue needed.

## Current Backlog

### Open Issues by Priority

| Priority | Count | Issues |
|----------|-------|--------|
| P2 | 5 | #23, #27, #29, #30, #50 |
| P3 | 13 | #32-#44, #47, #48 |
| P4 | 2 | #45, #46 |
| **Total** | **20** | |

### P2 Issues (next up)
- **#23** — Allow multi-chapter selection for assignments (area:book)
- **#27** — Add meeting notes field (area:architecture)
- **#29** — Add speaker name autocomplete from history (area:speakers)
- **#30** — Tie reading assignments to specific meeting dates (area:book)
- **#50** — Show all upcoming Speaker-format dates as a list (area:speakers)

### No Duplicates Found
All open issues are distinct.

## Statistics

- PRs analyzed: 4
- Issues closed: 4
- Issues created: 0
- Issues updated: 0
- Backlog before: 24 open (4 P2, 13 P3, 2 P4, plus 4 now-closed P2s, plus 1 now-closed issue)
- Backlog after: 20 open (5 P2, 13 P3, 2 P4)
- All P1 issues: 0 remaining
