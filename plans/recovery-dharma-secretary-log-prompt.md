# Recovery Dharma Secretary Log — Implementation Prompt

## Role

You are a senior full-stack engineer building a mobile-first web application for a single user (a Recovery Dharma meeting secretary). You follow **Tracer Code methodology**: wire the entire system end-to-end with stubs first, then iteratively replace stubs with real logic — always maintaining a working, demoable app at every phase. You write clean, well-documented code with clear separation of concerns, and you favor simplicity over cleverness.

## Goal

Build a **Recovery Dharma Secretary Log** — a lightweight web app that helps a meeting secretary track weekly meeting formats, draw discussion topics, schedule speakers, and follow a book-study reading plan. The app replaces a Google Sheets spreadsheet and should feel fast and natural on a phone screen.

The deliverable is a fully functional MVP with:
- FastAPI (Python) backend with a SQLite database
- React frontend (Vite + TypeScript) optimized for mobile viewports
- Basic auth (username/password) with JWT tokens, architected so multi-group tenancy can be added later
- A responsive web app (not a PWA — just responsive HTML/CSS/JS)

## Context

### What is Recovery Dharma?

Recovery Dharma is a peer-led addiction recovery community that uses Buddhist practices. Meetings happen weekly and rotate through three formats:

| Format | Description |
|---|---|
| **Speaker** | One member shares their recovery story. The secretary schedules speakers in advance. |
| **Topic** | The group reads and discusses a pre-selected topic (e.g., "Karma", "Mindfulness"). The topic is drawn randomly at the meeting from a "deck of cards" pool. |
| **Book Study** | The group reads the next section from the *Recovery Dharma* book (2nd edition), cycling back to the beginning when complete. |

### Current meeting details (seed data for MVP)

- **Day/time**: Sundays at 6:00 PM
- **Format rotation** (5-week cycle): Speaker → Topic → Book → Topic → Book
- This rotation pattern is configurable — the secretary can edit the cycle length and format assignments.

### The "Deck of Cards" topic system

Topics are drawn randomly but **without replacement** — once a topic is drawn, it stays out of the deck until all topics have been drawn, at which point the deck reshuffles automatically. The draw happens manually (secretary taps a button) on the day of the meeting, not in advance.

The initial topic list (all configurable — topics can be added and removed):

| # | Topic |
|---|---|
| 1 | Karma |
| 2 | Lovingkindness |
| 3 | Mindfulness of the Body Using Elements |
| 4 | Mindfulness of Feeling Tones |
| 5 | Mindfulness |
| 6 | Spiritual Maturity |
| 7 | What We Mean When We Say Suffering |
| 8 | Mindfulness of the Body Using Breath |
| 9 | Renunciation |
| 10 | 5 Precepts |

### Book Study reading plan

The book is divided into sections from the Table of Contents. The secretary builds a reading plan by adding chapters one at a time using an **"Add Next Chapter"** button. Each addition shows the chapter title, page range, and page count so the secretary can balance reading load per session.

Book sections cycle: after the last section is read, the next Book Study week returns to section 1.

**Full Table of Contents — Recovery Dharma, 2nd Edition:**

The app should seed with these chapters as the available pool, in order. Each entry includes start page, end page, and section title. The secretary uses "Add Next Chapter" to compose reading assignments from sequential chapters.

| Order | Start Page | End Page | Section Title |
|---|---|---|---|
| 1 | IX | X | Preface |
| 2 | X | XIII | What is Recovery Dharma? |
| 3 | XIII | XV | Where to Begin |
| 4 | XV | 1 | The Practice |
| 5 | 1 | 7 | Awakening: Buddha |
| 6 | 7 | 8 | The Truth: Dharma |
| 7 | 8 | 13 | The First Noble Truth |
| 8 | 13 | 15 | The Second Noble Truth |
| 9 | 15 | 16 | The Third Noble Truth |
| 10 | 16 | 17 | The Fourth Noble Truth |
| 11 | 17 | 20 | Wise Understanding |
| 12 | 20 | 27 | Wise Intention |
| 13 | 27 | 29 | Wise Speech |
| 14 | 29 | 31 | Wise Action |
| 15 | 31 | 32 | Wise Livelihood |
| 16 | 32 | 34 | Wise Effort |
| 17 | 34 | 37 | Wise Mindfulness |
| 18 | 37 | 41 | Wise Concentration |
| 19 | 41 | 43 | Community: Sangha |
| 20 | 43 | 46 | Isolation and Connection |
| 21 | 46 | 49 | Reaching Out |
| 22 | 49 | 50 | Wise Friends and Mentors |
| 23 | 50 | 53 | Service and Generosity |
| 24 | 53 | 57 | Recovery is Possible |
| 25 | 57 | 58 | Personal Recovery Stories (Intro) |
| 26 | 58 | 62 | Amy's Story |
| 27 | 62 | 67 | Chance's Story |
| 28 | 67 | 72 | Synyi's Story |
| 29 | 72 | 78 | Matthew's Story |
| 30 | 78 | 82 | Berlinda's Story |
| 31 | 82 | 86 | Jean's Story |
| 32 | 86 | 91 | Destiny's Story |
| 33 | 91 | 95 | Ned's Story |
| 34 | 95 | 100 | Kara's Story |
| 35 | 100 | 105 | Unity's Story |
| 36 | 105 | 109 | Randall's Story |
| 37 | 109 | 113 | Lacey's Story |
| 38 | 113 | 117 | Paul's Story |
| 39 | 117 | 122 | Eunsung's Story |

Note: Appendix sections (Selected Meditations, Inquiry Questions, Glossary, Meeting Format, Dedication of Merit) are **not** included in the reading plan.

Page numbering note: Pages IX–XV use Roman numerals. For page-count calculations, treat IX=9, X=10, XI=11, XII=12, XIII=13, XIV=14, XV=15 relative to a hypothetical page 1 that aligns with the Arabic numbering. (i.e., the "page count" for a Roman-numeral range is just the arithmetic difference, same as Arabic.)

### Speaker scheduling

- The secretary can schedule speakers for upcoming Speaker weeks by name (free-text input).
- Speakers can be scheduled weeks or months in advance.
- Speakers can be unscheduled or rescheduled.
- **Sticky banner**: If the next upcoming Speaker week does not have a speaker assigned, a persistent banner appears on the landing page: "⚠️ No speaker scheduled for [date] — schedule one now?"
- **Advance reminder**: When a Speaker week is approximately 1 month away and has no speaker assigned, show an in-app banner/alert. (Since there's no push notification system, this means: every time the user opens the app, if a Speaker week within ~30 days has no speaker, show the reminder.)

### Meeting cancellations

Meetings can occasionally be cancelled. The app should allow marking a week as "No Meeting" which skips it in the log without disrupting the format rotation or book-study sequence.

### Landing page ("Headline")

Shows **only the next upcoming meeting** with:
- Meeting date
- Format (Speaker / Topic / Book Study)
- Content: 
  - If **Topic** and not yet drawn → "Draw Topic" button
  - If **Topic** and already drawn → the topic name
  - If **Speaker** and scheduled → speaker name
  - If **Speaker** and not scheduled → "Schedule Speaker" link/prompt
  - If **Book Study** → the reading assignment (section title + page range)
- Any active banners (missing speaker warnings, reminders)

### Settings / Configuration

All of the following are editable through a Settings screen:

1. **Meeting schedule**: day of week, time, start date
2. **Format rotation**: ordered list of formats per cycle (e.g., [Speaker, Topic, Book, Topic, Book]), editable length
3. **Topic list**: add, remove, reorder topics. Show which topics remain in the current deck.
4. **Book reading plan**: 
   - Shows the ordered list of all available chapters from the TOC
   - Shows which chapters have been composed into "reading assignments" (groups of sequential chapters)
   - "Add Next Chapter" button appends the next unassigned chapter to the current reading assignment, showing: chapter title, page range, cumulative page count for this assignment
   - "Finalize Assignment" saves the current group as one reading session and moves to the next
   - The secretary can see all reading assignments and their page counts
5. **Speaker list**: optional — view past speakers, but no formal roster needed

### Onboarding

First-time setup flow:
1. Create account (username + password)
2. Set meeting day/time
3. Configure format rotation
4. Add topics (with ability to paste a list or add one-by-one)
5. Build initial book reading plan (add chapters to assignments)

### Export

- **CSV export** of the meeting log (date, format, content, speaker, topic, book section)
- **Printable template**: a clean, formatted HTML view of the log suitable for printing — something a future secretary could use with pen and paper. Include blank rows for upcoming weeks.

### Data model guidance

Design the schema with future multi-tenancy in mind. Every model should have a `group_id` foreign key even though the MVP only has one group. Key entities:

- **Group** (id, name, meeting_day, meeting_time, created_at)
- **User** (id, username, hashed_password, group_id)
- **FormatRotation** (id, group_id, position, format_type)
- **Topic** (id, group_id, name, is_active)
- **TopicDeckState** (id, group_id, topic_id, is_drawn, deck_cycle)
- **BookChapter** (id, group_id, order, start_page, end_page, title)
- **ReadingAssignment** (id, group_id, assignment_order, chapters → M2M or JSON)
- **MeetingLog** (id, group_id, meeting_date, format_type, content_summary, speaker_name, topic_id, reading_assignment_id, is_cancelled)

Use SQLite for the MVP. The schema should be created via SQLAlchemy models with Alembic migrations so it's easy to swap to PostgreSQL later.

## Output Format

Follow **Tracer Code methodology** across three phases:

### Phase 1: Wire the Skeleton (first pass)

Deliver a complete, runnable project with this structure:

```
recovery-dharma-log/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan
│   │   ├── config.py            # Settings via pydantic-settings
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # All SQLAlchemy ORM models
│   │   ├── schemas.py           # Pydantic request/response models
│   │   ├── auth.py              # JWT auth utilities
│   │   ├── routers/
│   │   │   ├── auth.py          # POST /auth/register, /auth/login
│   │   │   ├── meetings.py      # GET/POST /meetings (log + upcoming)
│   │   │   ├── topics.py        # CRUD /topics, POST /topics/draw
│   │   │   ├── book.py          # CRUD /book/chapters, /book/assignments
│   │   │   ├── speakers.py      # GET/POST/DELETE /speakers/schedule
│   │   │   ├── settings.py      # GET/PUT /settings (rotation, schedule)
│   │   │   └── export.py        # GET /export/csv, /export/printable
│   │   └── seed.py              # Seed script for TOC + default topics
│   ├── alembic/                 # Migrations
│   ├── requirements.txt
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/                 # API client functions
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/
│   │   │   ├── Landing.tsx      # "What's next" headline view
│   │   │   ├── Log.tsx          # Meeting history
│   │   │   ├── Settings.tsx     # All configuration
│   │   │   ├── Onboarding.tsx   # First-time setup wizard
│   │   │   └── Login.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   └── types/               # TypeScript interfaces
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── docker-compose.yml           # Optional, for easy local dev
└── README.md
```

**Phase 1 gate check**: Every API endpoint returns a valid stubbed response. The frontend renders every page with mock data. The app runs with `docker-compose up` or manual start commands. Auth flow works end-to-end (register → login → protected routes).

### Phase 2: Implement Features in Priority Order

Replace stubs with real logic in this order:

| Priority | Feature | Why |
|---|---|---|
| **P0** | Landing page with next-meeting logic | Core daily use case |
| **P0** | Format rotation engine (determines what format each week is) | Everything depends on this |
| **P0** | Topic deck draw (deck-of-cards random without replacement) | Used every Topic week |
| **P0** | Book study reading plan builder (add chapters, finalize assignments) | Used every Book week |
| **P1** | Speaker scheduling + banner warnings | Secretary's main planning tool |
| **P1** | Meeting log (auto-populated from draws/schedules, viewable history) | Record keeping |
| **P1** | Settings CRUD (rotation, topics, chapters) | Configurability |
| **P1** | Onboarding wizard | First-run experience |
| **P2** | Meeting cancellation ("No Meeting" toggle) | Edge case |
| **P2** | CSV export | Nice to have |
| **P2** | Printable log template | Nice to have |
| **P3** | Seed script with full TOC data | Developer convenience |

For each feature: write the backend logic → connect the frontend → verify it works → move on.

### Phase 3: Polish

- Mobile touch targets (minimum 44px)
- Loading states and error handling
- Confirm dialogs for destructive actions (removing topics, unscheduling speakers)
- Clean up any remaining TODOs in implemented code

## Examples

### Example: Landing page states

**State 1 — Topic week, not yet drawn:**
```
┌─────────────────────────────┐
│ ⚠️ No speaker for Mar 1st  │  ← sticky banner
├─────────────────────────────┤
│                             │
│   Sunday, Feb 22            │
│   FORMAT: Topic             │
│                             │
│   ┌─────────────────────┐   │
│   │   🎴 Draw Topic     │   │  ← big tappable button
│   └─────────────────────┘   │
│                             │
│   7 of 10 topics remain     │  ← deck status
│                             │
└─────────────────────────────┘
```

**State 2 — Topic week, already drawn:**
```
┌─────────────────────────────┐
│                             │
│   Sunday, Feb 22            │
│   FORMAT: Topic             │
│                             │
│   📖 Lovingkindness         │  ← drawn topic displayed
│                             │
│   6 of 10 topics remain     │
│                             │
└─────────────────────────────┘
```

**State 3 — Speaker week, scheduled:**
```
┌─────────────────────────────┐
│                             │
│   Sunday, Mar 1             │
│   FORMAT: Speaker           │
│                             │
│   🎤 Clare                  │
│                             │
└─────────────────────────────┘
```

**State 4 — Book Study week:**
```
┌─────────────────────────────┐
│                             │
│   Sunday, Mar 15            │
│   FORMAT: Book Study        │
│                             │
│   📚 5. Awakening: Buddha   │
│      Pages 1–7 (6 pages)    │
│                             │
└─────────────────────────────┘
```

### Example: Reading plan builder

```
┌─────────────────────────────────────────┐
│  📖 Book Reading Plan                   │
│                                         │
│  CURRENT ASSIGNMENT (Building #4):      │
│  ┌─────────────────────────────────┐    │
│  │ • The Fourth Noble Truth        │    │
│  │   pp. 16–17 (1 page)           │    │
│  │ • Wise Understanding            │    │
│  │   pp. 17–20 (3 pages)          │    │
│  │                                 │    │
│  │ Total: 4 pages                  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Next chapter: "Wise Intention"         │
│  pp. 20–27 (7 pages)                   │
│                                         │
│  [+ Add Next Chapter]  [✓ Finalize]    │
│                                         │
│  ─── Completed Assignments ───          │
│  #1: Preface + What is RD?  (4 pp)     │
│  #2: Where to Begin + Practice  (3 pp) │
│  #3: Awakening: Buddha + ...    (6 pp) │
└─────────────────────────────────────────┘
```

### Example: Topic deck settings

```
┌─────────────────────────────────────────┐
│  🎴 Topic Deck                          │
│                                         │
│  Deck cycle #2 — 7 of 10 remaining     │
│                                         │
│  IN DECK:                               │
│  ☐ Karma                                │
│  ☐ Lovingkindness                       │
│  ☐ Mindfulness of the Body (Elements)   │
│  ☐ Mindfulness of Feeling Tones         │
│  ☐ Mindfulness                          │
│  ☐ Spiritual Maturity                   │
│  ☐ Renunciation                         │
│                                         │
│  DRAWN THIS CYCLE:                      │
│  ✓ What We Mean When We Say Suffering   │
│  ✓ Mindfulness of the Body (Breath)     │
│  ✓ 5 Precepts                           │
│                                         │
│  [+ Add Topic]  [🗑 Remove Selected]    │
└─────────────────────────────────────────┘
```

### Example: Printable log export

```
═══════════════════════════════════════════════════════
  RECOVERY DHARMA — MEETING LOG
  [Meeting Name] | Sundays at 6:00 PM
═══════════════════════════════════════════════════════

  Date         Format     Content
  ──────────   ────────   ──────────────────────────
  2025-11-02   Speaker    Dave
  2025-11-09   Topic      Spiritual Maturity
  2025-11-16   Book       #3: Awakening: Buddha
  2025-11-23   Topic      Mindfulness (Breath)
  2025-11-30   Book       #4: The Truth: Dharma
  2025-12-07   Speaker    Clare
  2025-12-14   Topic      ______________________
  2025-12-21   Book       #5: The First Noble Truth
  2025-12-28   Topic      ______________________
  2026-01-04   Speaker    ______________________
  ...

  (Blank lines for future weeks with pen-and-paper use)
═══════════════════════════════════════════════════════
```

## Requirements

### Technical constraints
- **Database**: SQLite for MVP, but use SQLAlchemy ORM + Alembic migrations so PostgreSQL swap is trivial
- **Auth**: JWT tokens with `python-jose` or `PyJWT`. Simple username/password. Every endpoint except `/auth/register` and `/auth/login` requires auth.
- **All models include `group_id`** even though MVP has one group — this is the extensibility hook for multi-tenancy
- **Frontend state**: Use React hooks (`useState`, `useEffect`, `useContext`) — no Redux or heavy state management
- **Styling**: Use a lightweight CSS framework suited for mobile (e.g., Pico CSS, or Tailwind with sensible defaults). No component library needed.
- **Mobile-first**: Design for 375px viewport width. Touch targets ≥ 44px. Thumb-friendly navigation.

### Business logic constraints
- **Format rotation** is determined by: `week_number_since_start % cycle_length → position in rotation → format`. Cancelled weeks do NOT consume a rotation slot.
- **Topic draw** must be atomic: draw and persist in one transaction. No double-draws.
- **Book study** always advances linearly through reading assignments. When the last assignment is reached, the next Book Study week cycles back to assignment #1.
- **Speaker reminders**: check all Speaker weeks within the next 30 days that lack an assigned speaker. Show as in-app banners.
- **Deck reshuffles** automatically when all topics have been drawn. The new cycle begins with a full deck. The secretary can also manually reshuffle from settings.

### UX constraints
- The app must be usable **during a meeting** — quick, one-tap actions for drawing topics
- The app should also be usable **in advance** — scheduling speakers, building reading plans
- The printable export should be legible and useful for a secretary who prefers pen and paper
- Onboarding should feel guided but not tedious — reasonable defaults where possible

### What NOT to build
- No real-time features (WebSockets, live updates)
- No push notifications
- No offline/PWA support
- No file uploads
- No admin panel or role-based access — single user auth is fine
- Do not include Appendix sections (Meditations, Inquiry Questions, Glossary, Meeting Format, Dedication of Merit) in the book chapter seed data
