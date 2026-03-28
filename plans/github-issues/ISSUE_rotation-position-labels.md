## Problem

Rotation slots are labeled "1.", "2.", "3." etc., which is meaningless without context. Users have to mentally map "Position 1" to "First Sunday of the Month" — this mapping should be explicit in the UI.

## Proposed Solution

Replace numeric labels with ordinal weekday labels based on the group's `meeting_day` setting:

| Current | Proposed (if meeting_day = Sunday) |
|---------|-------------------------------------|
| 1.      | 1st Sunday                          |
| 2.      | 2nd Sunday                          |
| 3.      | 3rd Sunday                          |
| 4.      | 4th Sunday                          |
| 5.      | 5th Sunday                          |

The label should be dynamic — if the group meets on Wednesdays, show "1st Wednesday", "2nd Wednesday", etc.

Also update the "Add Position" button text to something clearer like "+ Add Week" or show the next ordinal: "+ Add 4th Sunday".

## Key Files

- `frontend/src/pages/Settings.tsx` — rotation slot labels (line 382: `{i + 1}.`)
- `frontend/src/pages/Settings.tsx` — "Add Position" button (line 421)
- Already has `DAYS_OF_WEEK` array and `settings.meeting_day` available

## Acceptance Criteria

- [ ] Rotation slots show "1st [Day]", "2nd [Day]", etc. instead of "1.", "2."
- [ ] Day name matches the group's `meeting_day` setting
- [ ] "Add Position" button shows the next ordinal (e.g., "+ Add 4th Sunday")
- [ ] 5th-week note uses the same clear language
