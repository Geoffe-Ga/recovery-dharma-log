# Feature Reimagining: RD Log

**Date**: 2026-02-20
**Scope**: Every user-facing feature and key architectural concern, analyzed against the current production site.

---

## Table of Contents

1. [Authentication & Onboarding](#1-authentication--onboarding)
2. [Landing Page (Upcoming Meeting)](#2-landing-page-upcoming-meeting)
3. [Meeting Log](#3-meeting-log)
4. [Navigation & App Shell](#4-navigation--app-shell)
5. [Format Rotation System](#5-format-rotation-system)
6. [Topic Deck](#6-topic-deck)
7. [Speaker Scheduling](#7-speaker-scheduling)
8. [Book Reading Plan](#8-book-reading-plan)
9. [Settings Page (General)](#9-settings-page-general)
10. [Data Export](#10-data-export)
11. [Error Handling & Feedback](#11-error-handling--feedback)
12. [Architecture & Data Model](#12-architecture--data-model)

---

## 1. Authentication & Onboarding

**Current state**: A login/register toggle form. Registration creates a group named "My Meeting" with `start_date` hardcoded to 2025-01-05, `meeting_day` = Sunday. The user is immediately dropped onto the landing page with no guidance.

### 1a. Add a setup wizard after registration

**Problem**: New users land on an upcoming meeting card with no context. The group is called "My Meeting", the start date is a year in the past, and nothing is configured. The user has to discover Settings on their own and figure out what to change.

**Improvement**: After registration, present a 3-step onboarding wizard:
1. **Group basics** — Group name, meeting day, meeting time, start date (defaulting to *next occurrence of the chosen weekday*)
2. **Format rotation** — Pre-filled with the default 5-slot rotation, editable before first use
3. **Quick topic seed** — Show the 10 default topics with checkboxes to deselect any that don't apply, plus an "add more" field

This replaces the current pattern of hardcoded defaults + hoping the user finds Settings.

### 1b. Show a human-readable date for the meeting day

**Problem**: The meeting day is stored as an integer (0–6) and displayed on the Settings page as a 3-letter abbreviation looked up from a static array. But it isn't *editable* — it's display-only. The user can never change their meeting day after registration.

**Improvement**: Make `meeting_day` editable in Settings via a `<select>` dropdown (Monday–Sunday). Already supported by the `GroupSettingsUpdate` schema (`meeting_day?: number`) but the frontend never sends it.

### 1c. Improve session persistence and token UX

**Problem**: The `useAuth` hook creates a placeholder `{ username, group_id: 0 }` user object when a token exists in localStorage, without validating the token. If the token is expired, every API call fails with 401, but the UI still shows the authenticated shell — the user sees errors everywhere with no clear "your session expired" message.

**Improvement**:
- On app mount, make a lightweight validation call (e.g., `GET /settings/`) to confirm the token is still valid. If it 401s, clear the token and show the login form with a "Session expired — please log in again" message.
- Add a global 401 interceptor in the API client that auto-logs-out and redirects to login with a flash message, instead of showing per-page error states.

### 1d. Allow multiple users per group (invite flow)

**Problem**: Currently, registration creates a new group per user. If two secretaries share responsibilities for the same meeting, they each get independent groups with separate data.

**Improvement**: Add an invite code or join flow. After the first user registers and creates a group, they can generate an invite link/code from Settings. A second user enters that code during registration to join the existing group instead of creating a new one.

---

## 2. Landing Page (Upcoming Meeting)

**Current state**: A single `<article>` card with a gradient teal header showing the meeting date (raw ISO `YYYY-MM-DD` format) and a format badge. The body shows format-specific content: a "Draw Topic" button, a "Schedule Speaker" button/form, or a book chapter summary.

### 2a. Format the meeting date for humans

**Problem**: The date displays as `2026-02-22` — raw ISO 8601. This is the most prominent text on the entire site (it's the `<h2>` in the card header) and it reads like a database field.

**Improvement**: Format as a friendly, readable string: **"Sunday, February 22"**. The weekday is already known (it's the group's `meeting_day`), and the month/day are trivially formatted. Consider also showing a relative hint like "(this week)" or "(next week)" when applicable.

### 2b. Show all upcoming weeks, not just the next one

**Problem**: The landing page is a single-meeting view. If this week's meeting just happened, the card shows *next* week. But the secretary often needs to plan ahead — who's speaking in 3 weeks? What's the format next month? There's no way to see that without mentally computing the rotation.

**Improvement**: Below the primary "next meeting" card, show a compact 4–6 week lookahead list:

```
Feb 22  Topic         3 of 10 topics remain
Mar 1   Speaker       ⚠ No speaker scheduled
Mar 8   Book Study    Wise Mindfulness (pp. 34–37)
Mar 15  Topic
Mar 22  Speaker
```

Each row is tappable/expandable for actions (draw topic, schedule speaker). This is extremely high-leverage — it turns the landing page from a single-data-point view into a planning dashboard.

### 2c. Add a "Cancel This Week" action to the landing page

**Problem**: The `POST /meetings/cancel` endpoint exists, and the backend correctly handles cancellation. But there is *no UI anywhere* to cancel a meeting. The only way to create a cancellation is via direct API call. This is a core secretary workflow (holidays, weather, etc.) that is completely inaccessible.

**Improvement**: Add a "Cancel Meeting" button (outline/danger style) to the landing page card. On click, show a confirmation, then call `cancelMeeting(meeting_date, true)`. When the meeting is cancelled, the card should show a struck-through or dimmed state with an "Uncancel" option.

### 2d. Show the meeting time

**Problem**: The `Group` model has a `meeting_time` field (default 18:00), the `GroupSettings` schema returns it, but it is never displayed anywhere on the site. The most natural place for it is the landing page header alongside the date.

**Improvement**: Display "Sunday, February 22 at 6:00 PM" in the card header. If `meeting_time` is null, omit the time portion.

---

## 3. Meeting Log

**Current state**: A table with columns Date, Format, Content, Status. Dates are raw ISO. Content shows speaker name, topic name, or "—". Export links (CSV, Printable) are above the table.

### 3a. Format dates and add filtering/sorting

**Problem**: Dates are raw ISO strings. There's no way to filter by format type, search for a speaker name, or limit to a date range. For a group that's been meeting weekly for a year, this becomes a 52-row table with no interactivity.

**Improvement**:
- Format dates as "Jan 5, 2025" or similar
- Add a format-type filter (All / Speaker / Topic / Book Study / Cancelled)
- Add a simple text search that filters across speaker names and topic names
- Consider pagination or "load more" for groups with long histories

### 3b. Make log entries editable

**Problem**: Once a meeting is logged (via drawing a topic or scheduling a speaker), there's no way to correct mistakes. If the wrong topic was drawn, or a speaker name was misspelled, the secretary has no recourse. There's also no way to manually record what happened at a past meeting.

**Improvement**: Make each log row clickable/expandable to show an edit form:
- **Speaker meetings**: Edit speaker name
- **Topic meetings**: Change the logged topic (dropdown of all topics)
- **Any meeting**: Toggle cancelled status, add a content summary/note
- **Empty past dates**: Allow retroactively logging a meeting that wasn't captured in real-time

### 3c. Show richer content in the table

**Problem**: The Content column shows a single field — speaker name OR topic name OR "—". For Book Study meetings, it always shows "—" because the `content_summary` and `reading_assignment_summary` fields are never populated by the backend's meeting log query.

**Improvement**:
- For Book Study rows, show the chapter assignment (e.g., "Wise Mindfulness, pp. 34–37")
- For Topic rows, show the topic name
- For Speaker rows, show the speaker name
- Add a Notes column or expandable row for `content_summary` if the group wants to record meeting notes

---

## 4. Navigation & App Shell

**Current state**: Sticky navbar with "RD Log" brand, three links (Home, Log, Settings), and a Logout button. No active-state styling on the current route. No mobile considerations beyond Pico CSS defaults.

### 4a. Highlight the active navigation link

**Problem**: All three nav links look identical regardless of which page you're on. There's no visual indicator of current location.

**Improvement**: Use React Router's `NavLink` (or check `useLocation`) to apply an active class to the current route's link. Style with a bottom border, bolder weight, or teal text color to distinguish it from inactive links.

### 4b. Add the group name to the navbar

**Problem**: The navbar brand always says "RD Log", which is the app name, not the group name. The group name is only visible on the Settings page. If a secretary manages the site for "Sunday Night Sangha", that name should be front and center.

**Improvement**: Fetch and display the group name in the navbar (e.g., "Sunday Night Sangha" in place of or alongside "RD Log"). This gives the app a personalized feel and confirms to the user which group they're viewing.

### 4c. Improve mobile layout

**Problem**: The Pico CSS `container` class does basic responsive layout, but the nav links and buttons can get cramped on small screens. The Settings page with its many sections can become very long on mobile with no way to jump between sections.

**Improvement**:
- On narrow viewports, collapse nav links behind a hamburger/menu icon
- On Settings, add sticky section tabs or an anchor-jump menu so users can quickly reach Topic Deck, Reading Plan, etc.
- Ensure touch targets are at least 44px for all interactive elements

---

## 5. Format Rotation System

**Current state**: Editable dropdowns on Settings (just implemented). Week-of-month logic determines format. Default is [Speaker, Topic, Book Study, Topic, Book Study].

### 5a. Add a visual preview calendar

**Problem**: The rotation dropdowns are abstract — you configure positions 1–5 but can't see what the actual schedule looks like for the coming months. The user has to mentally map "position 3 = 3rd Sunday = Feb 15" themselves.

**Improvement**: Below the rotation editor, show a 2-month preview grid that maps each meeting date to its format. This makes the rotation tangible and immediately verifiable. Format as:

```
February 2026          March 2026
 1  Speaker             1  Speaker
 8  Topic               8  Topic
15  Book Study          15 Book Study
22  Topic               22 Topic
                        29 Book Study
```

### 5b. Handle 5th-week months gracefully

**Problem**: Some months have 5 occurrences of a weekday (e.g., March 2026 has 5 Sundays). With the default 5-slot rotation this works fine, but if a user configures only 3 or 4 slots, the 5th week wraps via modulo. This may surprise users who don't expect the rotation to restart mid-month.

**Improvement**: When the rotation length is shorter than the maximum possible week-of-month (5), show a note: "Months with a 5th [weekday] will use position 1's format." Consider also allowing a special "5th week override" format (some groups do a Business Meeting or Social on 5th weeks).

### 5c. Allow per-date format overrides

**Problem**: The rotation is purely algorithmic — there's no way to say "on March 15, we're doing a Speaker instead of Book Study because we have a guest." The only workaround is to change the entire rotation or manually log a different format after the fact.

**Improvement**: Add a "format override" concept: a simple table of `(meeting_date, format_type)` overrides that take precedence over the rotation algorithm. Expose this via the upcoming-weeks lookahead (improvement 2b) — tapping a future week's format lets you override it for just that date.

---

## 6. Topic Deck

**Current state**: Settings shows two lists (In Deck / Drawn This Cycle), an "Add Topic" inline form, and a "Reshuffle Deck" button. Landing page shows a "Draw Topic" button when the format is Topic.

### 6a. Show deck state on the landing page more prominently

**Problem**: The deck stats ("3 of 10 topics remain in deck") are a small muted line below the drawn topic. Before a topic is drawn, the secretary sees only a "Draw Topic" button with no context about what's in the deck or how many remain.

**Improvement**: Show the deck counter prominently *before* drawing (not just after). Add a visual progress indicator (e.g., a segmented bar or fraction badge like "7/10 remaining") so the secretary can see at a glance whether a reshuffle is coming soon.

### 6b. Add undo/re-draw capability

**Problem**: If a topic is drawn that was discussed recently at another meeting, or if the draw was accidental, there's no way to put it back and draw again. The secretary is stuck with whatever `secrets.choice()` returned.

**Improvement**: After drawing, show the topic with two actions: "Keep" (confirm) and "Re-draw" (put it back, draw another). Alternatively, allow the secretary to manually select a topic from the remaining deck instead of relying purely on random draw.

### 6c. Track topic history

**Problem**: There's no record of when each topic was last discussed. The deck reshuffles ensure even distribution across cycles, but a secretary can't answer "When did we last discuss Karma?" without scrolling through the entire meeting log.

**Improvement**: On the Settings topic list (and optionally on the draw result), show the date each topic was last used. This can be derived from `MeetingLog` entries where `topic_id` matches. Sort the "Drawn This Cycle" list by most-recently-used.

### 6d. Allow topic categories or weighting

**Problem**: All topics are equally likely to be drawn. Some groups may want to draw certain foundational topics more frequently (e.g., "Mindfulness" every other cycle) or group topics by theme.

**Improvement**: This is lower priority but high leverage for groups with large topic decks. Add an optional "weight" field (1–3) to topics, where weight 2 means the topic appears twice in the deck shuffle. This is a simple multiplier on the TopicDeckState entries created during reshuffle.

---

## 7. Speaker Scheduling

**Current state**: On the landing page, if the format is Speaker and no speaker is assigned, a "Schedule Speaker" button reveals an inline form. Banners warn about unscheduled speaker weeks within 30 days. The speaker schedule is accessible via `GET /speakers/schedule` but has no dedicated UI.

### 7a. Build a dedicated speaker schedule view

**Problem**: The speaker schedule endpoint returns all future speakers, but this data isn't shown anywhere as a list. The secretary can only see one speaker at a time (the next meeting's). Planning speakers 4+ weeks out requires visiting Settings or just knowing who's scheduled.

**Improvement**: Add a "Speaker Schedule" section — either as a card on the landing page below the upcoming meeting, or as a sub-section accessible from the landing page. Show all upcoming Speaker-format dates with the assigned speaker (or "Open" with a quick-assign button). This turns speaker scheduling from a reactive per-week task into proactive forward planning.

### 7b. Allow editing/removing a scheduled speaker

**Problem**: Once a speaker is scheduled, there's no UI to change or remove them. The `DELETE /speakers/schedule/{date}` and re-scheduling endpoints exist, but the frontend never exposes them. If a speaker cancels, the secretary has no recourse.

**Improvement**: When a speaker is assigned (on the landing page card or in the speaker schedule view), show an Edit/Remove action. "Edit" replaces the name with an input field. "Remove" calls the unschedule endpoint and reverts to the "Schedule Speaker" button state.

### 7c. Add a speaker roster / autocomplete

**Problem**: Speaker names are free-text with no memory. If "Jane D." speaks in February and again in June, the secretary has to retype the name exactly. Variations ("Jane D.", "Jane Doe", "jane") create inconsistent records.

**Improvement**: Maintain a speaker roster derived from historical `MeetingLog` entries where `speaker_name` is non-null. Use this as an autocomplete/suggestion list on the speaker input. Deduplicate by normalizing case. This also enables a "speaker history" view: how many times has each person spoken, and when was the last time?

---

## 8. Book Reading Plan

**Current state**: Settings has a reading plan builder. You add chapters one at a time to a "current assignment", finalize it, then start the next. Completed assignments can be edited (checkbox chapter picker) or deleted. The landing page shows a chapter summary string for Book Study weeks.

### 8a. Show reading plan progress visually

**Problem**: The plan builder is purely functional — add, finalize, repeat. There's no sense of progress through the book. The 39 chapters span from Preface (p. IX) to Eunsung's Story (p. 122), but there's no indication of how far through the book the group is or how many weeks remain.

**Improvement**: Add a progress bar or fraction ("12 of 39 chapters assigned, ~27 weeks remaining at current pace"). Show the total pages assigned vs. total pages in the book. This gives the secretary a planning tool: "at 2 chapters per assignment, we'll finish in 14 more Book Study weeks."

### 8b. Allow multi-chapter selection instead of one-at-a-time adding

**Problem**: Building an assignment requires clicking "+ Add Next Chapter" repeatedly — one click per chapter. If the secretary wants to assign 3 chapters, that's 3 clicks + waiting for 3 API round trips. There's no way to add chapters out of order or skip a chapter.

**Improvement**: Replace the sequential "add next" pattern with a chapter picker: show all unassigned chapters with checkboxes, let the secretary select multiple at once, then save. This also enables skipping chapters (some groups skip certain personal stories) and reordering.

### 8c. Connect assignments to specific meeting dates

**Problem**: Assignments are numbered abstractly (Assignment 1, 2, 3...) but not tied to specific dates. The landing page calculates which assignment to show based on `count of past Book Study meetings % number of assignments`, which is fragile and opaque. The secretary can't answer "which assignment is for March 15?"

**Improvement**: Explicitly tie each assignment to a meeting date (or at least show the projected mapping). The reading plan view could show:

```
Assignment 1 — Feb 15: Preface + What is Recovery Dharma? (4 pages)
Assignment 2 — Mar 15: Where to Begin + The Practice (8 pages)
Assignment 3 — Apr 19: Awakening: Buddha + The Truth: Dharma (8 pages)
(projected based on Book Study rotation dates)
```

### 8d. Support restarting or cycling the book

**Problem**: Once all 39 chapters are assigned and the group finishes the book, there's no mechanism to restart from the beginning for a second read-through. The `next_chapter` becomes null permanently.

**Improvement**: When all chapters are assigned, show a "Restart Book" button that creates a new round of assignments from chapter 1. Track which cycle the group is on (analogous to topic deck cycles). Some groups read the book annually, so this is a natural workflow.

---

## 9. Settings Page (General)

**Current state**: Four card sections — Meeting Info (name, day, start date, save button), Format Rotation (dropdowns), Topic Deck (add/remove/reshuffle), Book Reading Plan (add/finalize/edit/delete).

### 9a. Add section navigation for the long page

**Problem**: The Settings page has 4+ sections that stack vertically. On mobile especially, scrolling to the Book Reading Plan section requires passing through everything else. There's no way to jump to a specific section.

**Improvement**: Add a sticky sub-nav or tab bar at the top of Settings: "Meeting | Rotation | Topics | Reading Plan". Each tab scrolls to (or toggles visibility of) its section. This also visually communicates the page's scope at a glance.

### 9b. Save rotation and settings together, with feedback

**Problem**: The rotation dropdowns update local state immediately but only persist when the user clicks "Save Changes" in the Meeting Info section. This is non-obvious — the save button is visually separated from the rotation section. A user could edit the rotation, scroll past it, and never realize they need to scroll back up to save.

**Improvement**: Either:
- Add a sticky "Save" footer bar that appears whenever there are unsaved changes (with a visual dirty-state indicator)
- Or auto-save rotation changes via debounced API calls (each dropdown change triggers a save after 500ms of inactivity)

The sticky save bar is more predictable and prevents accidental data loss.

### 9c. Add a "Danger Zone" for destructive actions

**Problem**: "Reshuffle Deck" (resets all drawn topics) uses `window.confirm()`, which is jarring and provides no context. Delete actions on assignments also use `window.confirm()`. These are mixed in with non-destructive controls.

**Improvement**: Group destructive actions (reshuffle, delete all assignments, reset group) into a clearly-labeled "Danger Zone" section at the bottom, styled with a red/warning border. Replace `window.confirm()` with inline confirmation patterns (e.g., click "Delete" → button transforms to "Are you sure? Confirm / Cancel"). This is both more accessible (screen readers don't handle `window.confirm` well) and more intentional.

---

## 10. Data Export

**Current state**: Two links on the Log page: "Export CSV" (downloads a file) and "Printable View" (opens HTML in new tab). CSV columns: date, format, speaker, topic, book_section, cancelled. The `book_section` column is always empty.

### 10a. Populate the book_section column in CSV export

**Problem**: The CSV export has a `book_section` column that is always empty (`,,`). The `generate_csv_export` function in `services.py` never populates it — it only extracts `speaker_name` and `topic_name` from the log entry but doesn't look up reading assignments.

**Improvement**: For Book Study entries, look up the corresponding reading assignment and include the chapter titles and page range in the `book_section` column. This makes the CSV actually useful as a complete historical record.

### 10b. Add date range filtering to exports

**Problem**: Exports always dump the entire history. For annual reports or for sharing a semester's worth of data, the secretary has to export everything and manually trim in a spreadsheet.

**Improvement**: Add optional date-range parameters to the export endpoints (`?start=2025-09-01&end=2026-01-31`). On the Log page, provide date inputs alongside the export links.

### 10c. Improve the printable export layout

**Problem**: The printable HTML is functional but plain — serif font, basic table, 10 blank rows appended. It doesn't include the group name prominently, doesn't show format-specific content, and the blank rows are a guess at how many the secretary needs.

**Improvement**:
- Use the RD brand styling (Lato font, teal accents) in the print export
- Include the group name, date range, and meeting day in the header
- Show speaker/topic/chapter content in the Content column (currently the printable export does show `speaker_name` but shows nothing for topics and nothing for book study)
- Let the user specify how many blank rows to include (or auto-calculate based on upcoming weeks through end of year)

---

## 11. Error Handling & Feedback

**Current state**: Errors display as red `<p role="alert">` at the top of each page. No success feedback. No loading indicators beyond disabled buttons and "Please wait..." text.

### 11a. Add success/toast notifications

**Problem**: When the user draws a topic, schedules a speaker, saves settings, or adds a chapter, the only feedback is that the data refreshes. There's no explicit "Saved!" or "Topic drawn successfully" confirmation. The user has to visually scan the page to confirm the action worked.

**Improvement**: Add a lightweight toast/snackbar system. On successful mutations, show a brief (3-second) non-blocking success message at the top or bottom of the viewport. Keep it simple — a green bar with text like "Speaker scheduled" that auto-dismisses. This provides positive feedback without interrupting flow.

### 11b. Add loading skeletons for initial page loads

**Problem**: Each page shows `<p aria-busy="true">Loading...</p>` during initial data fetch. This is a blank page with italic text — a jarring flash of empty content, especially on slower connections.

**Improvement**: Replace with skeleton/placeholder UI that mimics the shape of the real content. The landing page could show a card outline with pulsing placeholder bars for the date, badge, and content area. This feels faster and more polished.

### 11c. Add retry capability for failed requests

**Problem**: If a network request fails, the user sees a red error message and has no way to retry short of reloading the entire page. There's no "Try again" button.

**Improvement**: On error states, include a "Retry" button alongside the error message that re-invokes the failed request. For transient network errors, this is much better than a full page reload (which loses any in-progress form state).

---

## 12. Architecture & Data Model

### 12a. Add an explicit meeting_date ↔ assignment mapping

**Problem**: The current Book Study logic computes which assignment to show via `count of past Book Study meetings % len(finalized_assignments)`. This is fragile: if a Book Study meeting is cancelled and un-cancelled, or if assignments are deleted and re-created, the mapping shifts unpredictably. There's no stable "assignment X is for date Y" record.

**Improvement**: Add a `meeting_date` (nullable) column to `ReadingAssignment`, or a join table `AssignmentSchedule(assignment_id, meeting_date)`. When the secretary finalizes an assignment, auto-project it onto the next unassigned Book Study date. This makes the mapping explicit, stable, and queryable.

### 12b. Add an activity log / audit trail

**Problem**: There's no record of *who* did *what* and *when*. If two secretaries share a group (improvement 1d), or if the secretary wants to review their own actions, there's no history. "Who scheduled that speaker?" "When was the deck reshuffled?" — unanswerable.

**Improvement**: Add an `ActivityLog` model: `(id, group_id, user_id, action, details_json, created_at)`. Log key events: topic drawn, speaker scheduled/unscheduled, meeting cancelled, deck reshuffled, settings changed, assignment finalized. This is low-cost to implement and high-value for accountability and debugging.

### 12c. Replace `content_summary` with structured fields

**Problem**: `MeetingLog.content_summary` is a catch-all text field that's never written to by any code path. Meanwhile, the actual content (speaker name, topic, reading assignment) is spread across separate fields. The `MeetingResponse` schema exposes `content_summary` but it's always null.

**Improvement**: Either:
- Remove `content_summary` from the model and schema (it's dead code)
- Or repurpose it as a "meeting notes" free-text field that the secretary can optionally fill in for any meeting (e.g., "Great discussion, 15 attendees, newcomer orientation done")

The notes approach adds genuine value — many secretaries keep informal notes about each meeting.

### 12d. Add attendance tracking

**Problem**: There's no way to record how many people attended a meeting. This is a common requirement for Recovery Dharma groups that report to a central body or want to track growth.

**Improvement**: Add an `attendance_count` (nullable integer) field to `MeetingLog`. Show it as an optional input on the landing page (or in the log entry editor from improvement 3b). Display it in the log table and include it in CSV exports.

---

## Priority Matrix

| Improvement | Impact | Effort | Priority |
|---|---|---|---|
| 2a. Format dates | High (every visit) | Trivial | P0 |
| 2c. Cancel meeting UI | High (missing core feature) | Low | P0 |
| 2d. Show meeting time | Medium | Trivial | P0 |
| 4a. Active nav link | Medium (orientation) | Trivial | P0 |
| 10a. Populate book_section CSV | Medium (data completeness) | Low | P0 |
| 2b. Multi-week lookahead | Very High (planning) | Medium | P1 |
| 7a. Speaker schedule view | High (planning) | Medium | P1 |
| 7b. Edit/remove speaker | High (missing workflow) | Low | P1 |
| 3a. Format dates + filtering | High (usability) | Medium | P1 |
| 11a. Success toasts | Medium (feedback) | Low | P1 |
| 1c. Session expiry handling | Medium (reliability) | Low | P1 |
| 5a. Rotation preview calendar | High (comprehension) | Medium | P1 |
| 9b. Sticky save bar | Medium (prevent data loss) | Low | P1 |
| 6b. Undo/re-draw topic | Medium (error recovery) | Low | P1 |
| 3b. Editable log entries | High (missing workflow) | Medium | P2 |
| 8a. Reading plan progress | Medium (planning) | Low | P2 |
| 8b. Multi-chapter selection | Medium (efficiency) | Medium | P2 |
| 6a. Prominent deck state | Medium (visibility) | Low | P2 |
| 6c. Topic last-used dates | Medium (information) | Low | P2 |
| 1b. Editable meeting day | Medium (flexibility) | Trivial | P2 |
| 12c. Meeting notes field | Medium (utility) | Low | P2 |
| 12d. Attendance tracking | Medium (reporting) | Low | P2 |
| 7c. Speaker autocomplete | Medium (consistency) | Medium | P2 |
| 8c. Date-tied assignments | High (reliability) | Medium | P2 |
| 4b. Group name in navbar | Low-Medium | Trivial | P2 |
| 9a. Section navigation | Medium (mobile UX) | Medium | P3 |
| 9c. Danger zone | Low-Medium (safety) | Low | P3 |
| 11b. Loading skeletons | Low (polish) | Medium | P3 |
| 11c. Retry buttons | Low-Medium | Low | P3 |
| 5b. 5th-week handling | Low (edge case) | Low | P3 |
| 5c. Per-date overrides | Medium (flexibility) | Medium | P3 |
| 10b. Date range exports | Low-Medium | Low | P3 |
| 10c. Printable export polish | Low | Medium | P3 |
| 4c. Mobile hamburger nav | Medium (mobile) | Medium | P3 |
| 1a. Onboarding wizard | Medium (first-run) | High | P3 |
| 1d. Multi-user invite | Medium (collaboration) | High | P3 |
| 12a. Assignment-date mapping | Medium (architecture) | Medium | P3 |
| 12b. Activity/audit log | Low-Medium | Medium | P3 |
| 6d. Topic weighting | Low (niche) | Medium | P4 |
| 8d. Book restart/cycle | Low (long-term) | Low | P4 |
