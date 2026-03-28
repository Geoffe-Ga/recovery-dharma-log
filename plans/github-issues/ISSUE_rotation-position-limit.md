## Problem

"Add Position" in the format rotation section allows unlimited positions, but there can only ever be 4-5 occurrences of any given weekday in a month. Adding more than 5 positions makes no sense and creates confusion.

Currently the rotation uses `weekOfMonth % formatRotation.length` to wrap around, so having 7 positions means positions 6 and 7 never get used independently — they just alias positions 1 and 2 for 5th-week months.

## Proposed Solution

- Cap the maximum number of rotation positions at 5
- Hide the "Add Position" button once 5 positions are reached
- If fewer than 5 positions are set, show the existing note about 5th-occurrence wrapping behavior

## Key Files

- `frontend/src/pages/Settings.tsx` — format rotation section (lines 375-423)
- `frontend/src/components/RotationCalendar.tsx` — position calculation (line 45-50)

## Acceptance Criteria

- [ ] Maximum 5 rotation positions allowed
- [ ] "Add Position" button hidden when 5 positions exist
- [ ] Existing groups with >5 positions can still remove extras
- [ ] 5th-week wrapping note only shown when rotation has <5 positions
