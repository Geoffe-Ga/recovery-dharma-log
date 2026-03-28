# Backlog Progress Report — 2026-02-27

## Current State

**Main branch**: `8491b8e` (after merging PRs #71 and #72)

### Merged This Session (Batch 3, partial)

| PR | Issue | Title | Status |
|----|-------|-------|--------|
| #71 | #44 | feat: add activity/audit log for key events | Merged |
| #72 | #48 | refactor: migrate from fireEvent to userEvent in tests | Merged |

### Open PRs (rebased, awaiting CI re-run + merge)

| PR | Issue | Title | Status |
|----|-------|-------|--------|
| #73 | #37 | feat: allow per-date format overrides | CI failed after rebase — frontend `api.test.ts` 401 redirect test hits jsdom `window.location.href` limitation; backend import sorting was auto-fixed by linter |
| #74 | #39 | feat: polish printable export with RD brand styling | CI green after rebase, ready to merge |

## Immediate Next Steps

### 1. Fix PR #73 (issue #37) frontend CI failure

The test at `tests/api.test.ts:74` triggers the 401 session-expiry path in `src/api/client.ts:37` which sets `window.location.href = "/login?expired=1"`. jsdom throws "not implemented" for navigation.

**Fix**: The test already mocks `window.location` via `jest.spyOn(window, "location", "get")` in `beforeEach` (line 15-21), but the mock provides a getter — the code assigns to `.href` (a setter). Need to make the mock writable, e.g.:

```typescript
Object.defineProperty(window, 'location', {
  writable: true,
  value: { ...window.location, href: '', assign: jest.fn(), replace: jest.fn(), reload: jest.fn() },
});
```

Or use `delete (window as any).location` then assign. After fixing, amend commit, force-push, wait for CI green.

### 2. Merge PR #74 (issue #39)

Already CI green. Merge with `gh pr merge 74 --squash --delete-branch`.

### 3. Merge PR #73 (issue #37)

After fixing CI, merge with `gh pr merge 73 --squash --delete-branch`.

### 4. Close issues #37 and #39

After merging their respective PRs.

### 5. Clean up worktrees

Remove stale worktrees:
```bash
git worktree remove /Users/geoffgallinger/Projects/rd-log-worktrees/issue_40 --force  # already merged
git worktree remove /Users/geoffgallinger/Projects/rd-log-worktrees/issue_44 --force  # just merged
git worktree remove /Users/geoffgallinger/Projects/rd-log-worktrees/issue_48 --force  # just merged
git worktree remove /Users/geoffgallinger/Projects/rd-log-worktrees/issue_37 --force  # after merge
git worktree remove /Users/geoffgallinger/Projects/rd-log-worktrees/issue_39 --force  # after merge
```

## Remaining Open Issues

| Issue | Priority | Title | Area |
|-------|----------|-------|------|
| #41 | P3 | Add post-registration setup wizard | auth |
| #42 | P3 | Add multi-user invite flow | auth |
| #45 | P4 | Add topic categories or weighting | topics |
| #46 | P4 | Support restarting/cycling the book | book |

### Suggested Next Batch

Issues #41 and #42 are both P3 auth-related features. They could be done in parallel since #41 (setup wizard) is about onboarding new groups and #42 (invite flow) is about adding users to existing groups — minimal overlap.

Issues #45 and #46 are P4 and more complex (topic weighting, book cycling). These can wait or be tackled after #41/#42.

## Session Summary

Across this session, completed 16 issues total (P1 through P3), from the original backlog of 20+ issues. The codebase now has:
- Backend: ~136 tests, 92%+ coverage
- Frontend: ~195 tests, all quality checks green
- Features: toast notifications, session handling, multi-week lookahead, speaker management, log filtering with export date params, topic undo/redraw, rotation calendar, sticky save bar, section nav, loading skeletons, 5th-week handling, danger zone confirmations, retry buttons, hamburger nav, format overrides, printable export polish, audit log, userEvent migration, multi-chapter selection, speaker autocomplete, assignment-date mapping, speaker schedule list
