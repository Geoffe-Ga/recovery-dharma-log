## Problem

Dividing a book into reading assignments is painfully tedious. Users must:

1. Scroll through 66+ chapters in a checkbox list
2. Manually select chapters for each assignment
3. Click "Add Selected" (fires N individual API calls, one per chapter)
4. Click "Finalize Assignment"
5. Scroll back to the top and repeat 9-10 times

This should be a quick, one-time setup task — not a multi-minute scrolling ordeal.

## Proposed Solution

Add an **auto-assign** feature that groups chapters into assignments of ~7 pages each (configurable). The backend already has `page_count` data for every chapter, so this is straightforward.

### Backend
- New endpoint: `POST /book/plan/auto-assign` accepting `target_pages` (default 7)
- Groups consecutive unassigned chapters until reaching ~target page count
- Handles overshoot: if adding a chapter exceeds target, include it if it's closer to target than excluding it
- Auto-finalizes each group as a separate assignment
- Returns updated plan status

### Frontend
- Replace the tedious checkbox flow with an "Auto-assign (~7 pages each)" button
- Show a preview of the suggested groupings before confirming
- Keep manual chapter selection as a fallback for fine-tuning
- Reduce scrolling by collapsing the chapter list or using a more compact layout

## Key Files

- `backend/app/services.py` — `add_chapter_to_current_assignment()`, `finalize_current_assignment()`
- `backend/app/routers/book.py` — add new auto-assign endpoint
- `frontend/src/pages/Settings.tsx` — Reading Plan section (lines 556-607)
- `frontend/src/api/index.ts` — add API call

## Acceptance Criteria

- [ ] "Auto-assign" button groups all unassigned chapters into ~7-page assignments
- [ ] Target page count is configurable (default 7)
- [ ] Auto-assignment completes in a single click (no repeated scrolling)
- [ ] Manual chapter selection still available for adjustments
- [ ] Existing finalized assignments are preserved
