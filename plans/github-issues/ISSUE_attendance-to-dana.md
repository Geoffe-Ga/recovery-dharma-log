## Problem

"Record Attendance" tracks headcount, which no one actually needs. What *is* useful is tracking how much dana (donations) were collected at each meeting.

## Proposed Solution

Rename "Record Attendance" to "Record Dana" and change the data from an integer headcount to a currency amount (dollars).

### Backend
- Rename `MeetingLog.attendance_count` column to `dana_amount` (decimal/float, nullable)
- Rename `AttendanceUpdate` schema to `DanaUpdate` with `dana_amount: float | None`
- Rename endpoint `PUT /meetings/{date}/attendance` to `PUT /meetings/{date}/dana`
- Migration: rename column, preserve existing data (or drop — attendance counts aren't useful)

### Frontend
- Rename button label: "Record Attendance" → "Record Dana"
- Change input from integer to currency (dollar amount, 2 decimal places)
- Update display format: show as `$X.XX` instead of raw number
- Update placeholder text: "Amount collected" instead of attendance count

## Key Files

- `backend/app/models.py` — `MeetingLog.attendance_count` (line 294)
- `backend/app/schemas.py` — `AttendanceUpdate` (lines 119-122)
- `backend/app/routers/meetings.py` — `PUT /meetings/{date}/attendance` (lines 126-155)
- `frontend/src/pages/Landing.tsx` — attendance UI (lines 494-545)
- `frontend/src/types/index.ts` — `UpcomingMeeting.attendance_count`

## Acceptance Criteria

- [ ] "Record Dana" button replaces "Record Attendance"
- [ ] Input accepts dollar amounts (e.g., `42.50`)
- [ ] Displayed as currency format (`$42.50`)
- [ ] Backend stores as decimal/float, nullable
- [ ] Migration handles existing data gracefully
- [ ] All references to "attendance" renamed to "dana" in code and UI
