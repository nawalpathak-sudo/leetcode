# Rules
1. Do NOT provide summaries after completing work. Just write the code and stop. Only summarize if explicitly asked.
2. Code first, always. No explanations unless requested.
3. All serverless functions go in `/api/` (Vercel-compatible). Local dev uses `server.js` at project root.
4. Never touch `/src/components/StudentPortal.jsx`, `/src/components/PublicProfile.jsx`, `/src/components/HomePage.jsx`, or `/portal` routes. Admin work only.
5. Every new page/component must use the design system tokens defined below. No inline color hex values — use CSS variables or Tailwind theme.
6. Changelog (`CHANGELOG.md`) is updated ONLY when user explicitly says "checkpoint". Do not auto-update.

## Data Fetching Rules (NON-NEGOTIABLE)

7. **Page-wise fetching ONLY.** Each page/route fetches ONLY its own data on mount. No bulk loading, no preloading all data upfront, no global data stores.
8. **Every Supabase query MUST be filtered and paginated.** Always use `.eq()`, `.limit()`, `.range()`. Never bare `select('*')` without filters.
9. **Dropdowns/selects fetch minimal data** — only `id` + `name`/`label`. Never fetch full records with all relations just for a picker.
10. **Pagination on all lists** — default 25 rows per page. Server-side pagination via Supabase `.range(from, to)`.
11. **No global state stores** holding entire datasets. Each page owns its data via local state + `useEffect` on mount.
12. **Loading skeletons per page** — not a single global spinner. Each section shows its own skeleton while its data loads.
13. **Filters drive queries** — campus → batch → section cascade. Changing a filter re-fetches only what's needed, not everything.

---

# ALTA Experience Center — Tech Stack & Architecture

## What We're Building

A modern ERP / Experience Center for **ALTA School of Technology** — a tech school running multiple colleges, multiple batches, and multiple sections per batch.

### Core Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Dashboard** | `/admin` | Overview metrics, quick actions, alerts |
| **Coding** | `/admin/coding/*` | Platform dashboards (LeetCode, Codeforces, GitHub), Students & Data, Projects, AMCAT |
| **Academics** | `/admin/academics/*` | LeetCode Problems (moved from LeetCode Corner), BOS, Coding Curriculum, Faculties, Workshops/Seminars, Timetable |
| **Attendance** | `/admin/attendance/*` | Attendance tracking per campus × batch × section |
| **Fees** | `/admin/fees/*` | Fee management, payment tracking, due dates |

### Academics Sub-modules

- **BOS (Board of Studies)** — curriculum governance, syllabus management
- **Coding Curriculum** — structured coding tracks, module progress
- **Faculties** — faculty profiles, assignments per campus/batch
- **Workshops & Seminars** — event scheduling, attendance, feedback
- **Timetable** — per campus × batch × section scheduling (data model from alta-scheduler below)

### Timetable Data Model (from alta-scheduler / Select Scheduler)

Reference repo: `~/alta-scheduler` (also `~/Select-Scheduler`, identical)

**Entity relationships for scheduling:**

```
College (campus)
  └── Batch (year + program + department, unique per college)
       ├── lectureDuration, startTime, endTime, recessStart/End, workingDays
       ├── Sections (A, B, C... with capacity)
       └── Semesters (semesterNumber, startDate, endDate)
            └── Events (MID_SEM_EXAM, BOOTCAMP, HACKATHON, etc.)

Faculty (name, email, phone, department, designation)
  └── linked to Subjects (many-to-many) + SubjectFacultyAllocation (credits per faculty)

Subject (name, code, theoryCredits, practicalCredits, semester, college)
  └── SubjectType (e.g., "BOS Coding", "Non Coding")
  └── defaultFaculty

Schedule (the core join table):
  section + subject + faculty + classroom + timeSlot + codingTrack
  ├── Unique constraint: classroom × timeSlot (no double-booking rooms)
  ├── Unique constraint: faculty × timeSlot (no double-booking faculty)
  ├── effectiveFrom / effectiveTo for versioning
  └── isActive flag

TimeSlot: dayOfWeek + startTime + endTime + slotType (REGULAR/LAB/BREAK)
Classroom: name, building, capacity, roomType (LECTURE_HALL/LAB/SEMINAR_ROOM/AUDITORIUM), facilities[]
CodingTrack: named tracks assignable to schedule slots
```

**Key design decisions to carry forward:**
- Schedule is a normalized join table, not denormalized per-cell storage
- Conflict prevention via unique constraints (faculty can't be in 2 places, room can't be double-booked)
- Batch defines its own timing rules (lecture duration, start/end, recess, working days)
- Sections are auto-created when scheduling if they don't exist
- TimeSlots are reusable across sections (created once, referenced many times)
- SubjectFacultyAllocation tracks how many credits each faculty handles per subject

### Entity Hierarchy

```
Organization (ALTA School of Technology)
  └── Campus (college/location)
       └── Batch (year/cohort, e.g., 2024-28)
            └── Section (A, B, C...)
```

Every data-bearing module respects this hierarchy. Filters: campus → batch → section.

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 19 + Vite 7 | SPA with client-side routing |
| **Routing** | React Router DOM 7 | Nested routes under `/admin/*` for page-wise URLs |
| **Styling** | Tailwind CSS 4 | Utility-first, theme tokens via CSS variables |
| **Icons** | Lucide React | Consistent icon set |
| **Charts** | Recharts | Data visualization |
| **Backend** | Supabase (PostgreSQL) | Auth, DB, real-time |
| **Serverless** | Vercel Functions (`/api/`) | OTP, admin APIs |
| **Local Dev** | `server.js` (Express/Node) | Mirrors Vercel functions locally |
| **Deployment** | Vercel | Auto-deploy from `main` branch |

---

## Admin Section Architecture

```
src/
├── admin/                          # All admin code lives here
│   ├── layouts/
│   │   └── AdminLayout.jsx         # Sidebar + topbar + content area
│   ├── pages/
│   │   ├── Dashboard.jsx           # /admin
│   │   ├── coding/                 # /admin/coding/*
│   │   │   ├── CodingHome.jsx      # Overview / current AdminPanel features
│   │   │   ├── Profiles.jsx        # Student coding profiles
│   │   │   ├── Leaderboard.jsx     # Platform leaderboards
│   │   │   ├── Practice.jsx        # LeetCode problem management
│   │   │   ├── Projects.jsx        # Student projects
│   │   │   └── AMCAT.jsx           # AMCAT assessments
│   │   ├── academics/              # /admin/academics/*
│   │   │   ├── AcademicsHome.jsx
│   │   │   ├── BOS.jsx
│   │   │   ├── Curriculum.jsx
│   │   │   ├── Faculties.jsx
│   │   │   ├── Workshops.jsx
│   │   │   └── Timetable.jsx
│   │   ├── attendance/             # /admin/attendance/*
│   │   │   └── AttendanceHome.jsx
│   │   └── fees/                   # /admin/fees/*
│   │       └── FeesHome.jsx
│   ├── components/                 # Shared admin components
│   │   ├── Sidebar.jsx
│   │   ├── Topbar.jsx
│   │   ├── DataTable.jsx
│   │   ├── StatCard.jsx
│   │   ├── FilterBar.jsx           # Campus > Batch > Section filter
│   │   └── Modal.jsx
│   └── routes.jsx                  # Admin route definitions
├── components/                     # Existing (DO NOT TOUCH)
│   ├── StudentPortal.jsx
│   ├── HomePage.jsx
│   ├── PublicProfile.jsx
│   └── ...
├── lib/                            # Shared utilities
│   ├── db.js
│   ├── api.js
│   ├── supabase.js
│   └── ...
```

---

## Design Language

### Brand Colors (CSS Variables)

```css
:root {
  --color-primary: #0D1E56;
  --color-ambient: #3BC3E2;
  --color-dark-ambient: #22ACD1;
  --color-white: #FFFFFF;

  /* Derived */
  --color-bg: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text-primary: #0D1E56;
  --color-text-secondary: #64748B;
  --color-hover: #F1F5F9;
  --color-active-bg: rgba(59, 195, 226, 0.08);
  --color-success: #22ACD1;
  --color-danger: #EF4444;
}
```

### Design Principles

1. **Clean & Spacious** — generous whitespace, no clutter
2. **Card-based layout** — content grouped in elevated cards with subtle shadows
3. **Left sidebar navigation** — collapsible, icon + label, grouped by module
4. **Consistent spacing** — 4px grid system (p-1 = 4px, p-2 = 8px, etc.)
5. **Typography hierarchy** — headings in Primary (#0D1E56), body in text-secondary, links in Dark Ambient
6. **Subtle interactions** — hover states use ambient color at low opacity, transitions 150ms ease
7. **Data tables** — clean rows, alternating subtle backgrounds, inline actions
8. **Responsive** — desktop-first (admin is primarily desktop), but sidebar collapses on tablet

### Component Style Guide

- **Buttons**: Primary = `bg-[#0D1E56] text-white`, Secondary = `border border-[#0D1E56] text-[#0D1E56]`, Accent = `bg-[#3BC3E2] text-white`
- **Cards**: `bg-white rounded-xl shadow-sm border border-gray-100 p-6`
- **Sidebar active item**: `bg-[rgba(59,195,226,0.08)] text-[#22ACD1] border-l-3 border-[#22ACD1]`
- **Section headers**: `text-lg font-semibold text-[#0D1E56]`
- **Stat cards**: Icon + number + label, colored top border using ambient

### Font

- **Be Vietnam Pro** (Google Font) — weights: 300, 400, 500, 600, 700

---

## ALTA Website - Brand Guidelines

### Brand Colors

| Color Name    | Hex Code  | Usage                                      |
|---------------|-----------|---------------------------------------------|
| White         | `#FFFFFF` | Backgrounds, text on dark surfaces          |
| Primary       | `#0D1E56` | Headings, primary text, buttons, accents    |
| Ambient       | `#3BC3E2` | Highlights, hover states, secondary accents |
| Dark Ambient  | `#22ACD1` | Logo color, active states, links            |

---

## Interview Structure

### 30 Minute Standard Interview Format

| # | Module | Duration | Type | Timed |
|---|--------|----------|------|-------|
| 1 | Introduction about Interviewer | 2 min | introduction | No |
| 2 | Introduction of Student | 2 min | introduction | No |
| 3 | About ALTA School Of Technology | 2 min | presentation | No |
| 4 | Maths Questions | 5 min | quiz | Yes |
| 5 | Logical Reasoning Questions | 5 min | quiz | Yes |
| 6 | AI Knowhow - ChatGPT Prompt | 5 min | quiz | Yes |
| 7 | Q&A Session | 5 min | qa | No |

**Total Duration: 30 minutes**

### Module Types

- `introduction` - Non-timed, conversational
- `presentation` - Information sharing
- `quiz` - Timed questions from question bank
- `qa` - Open discussion
- `custom` - Flexible module

### Rules

1. Modules are stored in `interview_modules` table with `duration_seconds`
2. Each module has a `sequence_order` for positioning
3. Quiz modules can link to `quiz_sessions` via `quiz_session_id`
4. `is_timed` determines if candidate sees countdown timer
5. Interview templates are reusable - create once, use for multiple candidates
6. Progress tracked per module in `interview_module_progress`

### Question Categories

**Aptitude & Maths**
- Percentage
- Work & Time
- Ratio & Mixture
- Speed & Distance
- Permutation
- Number Series
- Averages
- Number Theory
- Clocks
- Logarithms

**Logical Reasoning**
- Seating Arrangement
- Syllogism
- Puzzles
- Scheduling
- Blood Relations
- Conditional Reasoning
- Problem Solving
- Combinatorics
- Parity

---

## Database

All SQL schemas stored in `/supabase/` folder:
- `schema.sql` - Core tables (questions, sessions, candidates)
- `interview-structure.sql` - Interview templates and modules
- `seed-questions.sql` - Aptitude questions
- `seed-logical-reasoning.sql` - Logical reasoning questions
