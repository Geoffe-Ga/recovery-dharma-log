# Backlog Grooming — 2026-02-23

## PRs Analyzed

| PR | Title | Merged | Issues Referenced |
|---|---|---|---|
| #6 | Add Claude Code GitHub Workflow | 2026-02-20 | None |
| #5 | Feat: Add cancel/restore meeting UI | 2026-02-23 | #11 (closed previously) |
| #4 | Fix: Populate book_section in CSV export | 2026-02-20 | #10 (closed previously) |
| #3 | Feat: Display meeting time on Landing page | 2026-02-21 | #9 (closed previously) |
| #2 | Fix: Highlight active navigation link | 2026-02-20 | #8 (closed previously) |
| #1 | Fix: Format dates for human readability | 2026-02-20 | #7 (closed previously) |
| — | Direct commit ca83713 (P1 features) | 2026-02-23 | #12-#20 |

## Issues Closed (this session)

| Issue | Title | Resolution |
|---|---|---|
| #12 | Show multi-week lookahead on Landing page | Fully resolved |
| #13 | Build dedicated speaker schedule view | Partially resolved (edit/remove only, not full list view) |
| #14 | Allow editing/removing a scheduled speaker | Fully resolved |
| #15 | Add filtering and sorting to meeting log | Fully resolved (filtering; sorting/pagination deferred) |
| #16 | Add success toast notifications | Fully resolved |
| #17 | Handle expired sessions gracefully | Fully resolved |
| #18 | Add rotation preview calendar on Settings | Fully resolved |
| #19 | Add sticky save bar for Settings changes | Fully resolved |
| #20 | Add undo/re-draw capability for topics | Fully resolved |

## Issues Created (this session)

| Issue | Title | Priority | Reason |
|---|---|---|---|
| #50 | Show all upcoming Speaker-format dates as a list | P2 | Follow-up from partial #13 resolution |

## Gaps Identified

1. **Draw endpoint fix** — `POST /topics/draw` now stores `topic_id` in MeetingLog (was missing). Covered under #20.
2. **Speaker schedule list view** — #13 asked for a full list of upcoming Speaker dates; only edit/remove on single card was implemented. Created #50.
3. **Log pagination** — #15 mentioned pagination for 50+ entries as a "consider" item. Not implemented, not worth a standalone issue yet.

## Statistics

- PRs analyzed: 6 + 1 direct commit
- Issues closed: 9 (#12-#20)
- Issues created: 1 (#50)
- Issues updated: 0
- Open P1 issues remaining: 0
- Open P2 issues: 12 (#21-#31, #49, #50)
- Open P3 issues: 13 (#32-#44, #47-#48)
- Open P4 issues: 2 (#45-#46)
- Total open issues: 27

## Backlog Health

- **Before**: 9 P1 issues open, all resolved but not tracked
- **After**: 0 P1 issues, all closed with resolution comments, 1 follow-up created
- **Status**: Clean — all completed work reflected in issue tracker
