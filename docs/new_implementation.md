# ALTA Experience Center — Next.js Migration Plan

## Context

The ALTA Experience Center is a multi-surface ERP for ALTA School of Technology, currently a React 19 + Vite 7 SPA. It's expanding into a full LMS with timetable/scheduler, contests, and more modules. With 5 developers coming onboard, the current flat folder structure won't scale. The migration to Next.js solves: file-based routing (URL = file), module isolation for parallel dev, SSR for performance, and API route colocation.

**Zero functionality loss is non-negotiable.** Every cron, every integration, every feature must survive.

**Everything must work both locally (`npm run dev`) and deployed on Vercel.** No separate dev server needed — Next.js API routes serve both environments identically.

---

## Decision: Single Next.js App (No Monorepo)

One domain, one database, shared auth, shared components. Monorepo adds complexity for zero benefit at this scale. Route groups handle surface isolation. 5 devs don't conflict because each owns a module directory.

---

## Architecture

### Route Structure

```
app/
├── (public)/                      # No auth, SEO-optimized
│   ├── page.tsx                   # / (HomePage)
│   ├── practice/page.tsx          # /practice
│   ├── projects/page.tsx          # /projects
│   ├── [slug]/page.tsx            # /:slug (PublicProfile)
│   └── layout.tsx                 # Public nav + footer
│
├── (portal)/                      # Student auth required
│   ├── portal/page.tsx            # /portal (StudentPortal — move as-is, 'use client')
│   └── layout.tsx                 # Portal layout
│
├── (admin)/                       # Admin auth required (middleware-enforced)
│   ├── admin/
│   │   ├── layout.tsx             # AdminLayout (sidebar + topbar)
│   │   ├── page.tsx               # /admin (Dashboard)
│   │   ├── login/page.tsx         # /admin/login (OTP login)
│   │   ├── coding/               # Dev A owns this
│   │   │   ├── platforms/page.tsx
│   │   │   ├── students/page.tsx
│   │   │   ├── practice/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── amcat/page.tsx
│   │   │   └── _lib/queries.ts
│   │   ├── academics/            # Dev B owns this
│   │   │   ├── bos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [bosId]/page.tsx
│   │   │   ├── problems/page.tsx
│   │   │   ├── faculties/page.tsx
│   │   │   ├── timetable/page.tsx  # Future: from alta-scheduler
│   │   │   └── _lib/queries.ts
│   │   ├── attendance/page.tsx    # Dev C
│   │   ├── fees/page.tsx          # Dev D
│   │   ├── users/page.tsx         # Dev E
│   │   └── settings/page.tsx      # Dev E
│   └── layout.tsx                 # Admin auth check wrapper
│
├── api/                           # Route Handlers (replace /api/*.js)
│   ├── send-otp/route.ts
│   ├── verify-otp/route.ts
│   ├── extract-bos/route.ts
│   ├── sync-gsheet/route.ts
│   └── manage-admin/route.ts
│
└── layout.tsx                     # Root: fonts, GTM, QueryProvider
```

### Module Isolation (5 devs, no conflicts)

Each module directory is **self-contained**:
```
admin/coding/
├── page.tsx              # Route component
├── platforms/page.tsx    # Sub-route
├── _components/          # Module-only components (underscore = not a route)
│   ├── PlatformCard.tsx
│   └── LeaderboardTable.tsx
└── _lib/
    ├── queries.ts        # Supabase queries for this module ONLY
    ├── actions.ts        # Server actions for mutations
    ├── types.ts          # Module-specific types
    └── schema.ts         # Zod schemas for forms
```

**Shared code** lives outside modules:
```
lib/
├── supabase/
│   ├── server.ts         # Server Component client (@supabase/ssr)
│   ├── client.ts         # Browser client (@supabase/ssr)
│   └── admin.ts          # Service role client (API routes only)
├── types/
│   └── database.ts       # Auto-generated: supabase gen types typescript
├── utils.ts              # formatINR, formatPhone, etc.
└── navigation.ts         # Sidebar config (append-only, no conflicts)

components/
├── ui/                   # shadcn/ui: DataTable, Dialog, Select, Tabs, etc.
└── shared/               # FilterBar, MetricCard, PageSkeleton
```

---

## Tech Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Framework | **Next.js 15 (App Router)** | File-based routing, Server Components, API routes |
| Language | **TypeScript** (incremental, `allowJs: true`) | Type safety, auto-generated DB types |
| Styling | **Tailwind CSS 4 + shadcn/ui** | Keep existing Tailwind, add accessible component library |
| Data fetching | **Server Components + TanStack Query** | Server: initial load. Client: interactive tables/filters |
| Forms | **React Hook Form + Zod** | Replaces manual useState per field |
| Database | **Supabase direct** (no Prisma) | Keep existing schemas, RLS, triggers. Auto-gen types |
| Auth | **Custom OTP + HTTP-only cookies** | Keep TrustSignal WhatsApp flow, replace localStorage |
| Icons | **Lucide React** | Already using, no change |
| Charts | **Recharts** | Already using, no change |
| Font | **Be Vietnam Pro** via `next/font/google` | Already using, optimized loading |

---

## Auth Architecture (Unified)

**Current:** Two separate localStorage systems (student + admin). Hardcoded master credentials in client code.

**Target:**
1. Keep custom OTP flow (TrustSignal WhatsApp) — it works, users are used to it
2. Replace localStorage with **HTTP-only signed cookies** (set by `/api/verify-otp`)
3. Next.js `middleware.ts` reads cookie on every request → route protection
4. **Kill hardcoded master credentials** — move to `admin_users` table with role=master
5. Single role model: `student`, `faculty`, `admin`, `master`

**middleware.ts logic:**
```
/admin/*     → requires cookie with role in [admin, master, faculty]
/portal/*    → requires cookie with role = student
/api/admin/* → requires cookie with role in [admin, master]
/*           → public
```

---

## What Must Survive (Complete Checklist)

### API Endpoints (5)
- [ ] `/api/send-otp` — OTP generation + TrustSignal WhatsApp delivery + rate limiting
- [ ] `/api/verify-otp` — OTP validation + attempt tracking + cookie setting (NEW: set HTTP-only cookie)
- [ ] `/api/extract-bos` — Gemini 2.5 Flash PDF/CSV extraction (multipart upload)
- [ ] `/api/sync-gsheet` — Google Sheets sync (JWT auth, batch upserts, sync logging)
- [ ] `/api/manage-admin` — Admin user CRUD

### Cron Jobs (4)
- [ ] Vercel cron: sync-gsheet at 5 AM UTC daily
- [ ] Vercel cron: sync-gsheet at 12 PM UTC daily
- [ ] Supabase pg_cron: refresh-leetcode-profiles at 18:30 UTC (midnight IST)
- [ ] Supabase pg_cron: refresh-codeforces-profiles at 19:30 UTC (1 AM IST)

### External Integrations (6)
- [ ] Google Sheets API (service account JWT)
- [ ] Google Gemini 2.5 Flash
- [ ] LeetCode GraphQL (via Supabase edge function proxy)
- [ ] Codeforces API (direct)
- [ ] GitHub API (via Supabase edge function proxy)
- [ ] TrustSignal WhatsApp API

### Database (20+ tables, all RLS policies, all triggers)
- [ ] All tables in `/supabase/*.sql` preserved as-is
- [ ] All RLS policies intact
- [ ] All triggers: `compute_bos_subject_credits`, `update_bos_timestamp`, `update_updated_at`
- [ ] All indexes (performance-indexes.sql + per-table indexes)
- [ ] pg_cron + pg_net extensions enabled

### Environment Variables (15)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` (renamed from VITE_SUPABASE_URL)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` (renamed from VITE_SUPABASE_ANON_KEY)
- [ ] `NEXT_PUBLIC_AMCAT_SUPABASE_URL` (renamed from VITE_AMCAT_SUPABASE_URL)
- [ ] `NEXT_PUBLIC_AMCAT_SUPABASE_ANON_KEY` (renamed from VITE_AMCAT_SUPABASE_ANON_KEY)
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `TRUSTSIGNAL_API_KEY`
- [ ] `TRUSTSIGNAL_SENDER`
- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- [ ] `GOOGLE_PRIVATE_KEY`
- [ ] `GSHEET_ID`
- [ ] `GSHEET_GID`
- [ ] `SYNC_SECRET`
- [ ] `GEMINI_API_KEY`
- [ ] NEW: `JWT_SECRET` (for signing auth cookies)

### Features (by surface)
- [ ] Public: HomePage, PublicProfile (/:slug), PracticePage, ProjectHub
- [ ] Portal: StudentPortal with OTP login, coding dashboard, leaderboards, heatmap, profile editing
- [ ] Admin Dashboard: metrics, alerts, quick actions
- [ ] Admin Coding: platforms dashboard, students list, practice problems, projects, AMCAT
- [ ] Admin Academics: BOS CRUD + PDF extraction + assignments, faculties, LeetCode problems
- [ ] Admin Attendance: campus-wise dashboard, batch comparison, at-risk students
- [ ] Admin Fees: collection overview, overdue tracking, campus comparison
- [ ] Admin Users: create/update admin & faculty users
- [ ] Admin Settings: master campuses & batches CRUD

### Dev Experience
- [ ] No more duplicate API logic (kill vite.config.js middleware — Next.js API routes work locally AND on Vercel)
- [ ] `npm run dev` just works (Next.js dev server handles everything)
- [ ] GTM via `@next/third-parties` (no double-fire)

---

## Migration Phases

### Phase 0: Foundation (3-4 days, 1 developer)

1. Init Next.js 15 in new branch (`next-migration`)
2. Configure: TypeScript (`allowJs: true`), Tailwind 4, shadcn/ui, Be Vietnam Pro font, GTM
3. Set up Supabase clients: `/lib/supabase/server.ts`, `/lib/supabase/client.ts`, `/lib/supabase/admin.ts`
4. Auto-generate types: `supabase gen types typescript`
5. Port all 5 API endpoints to `app/api/*/route.ts` (straightforward, same logic, different export format)
6. Set up auth: cookie-based sessions in verify-otp, `middleware.ts` for route protection
7. Port AdminLayout to `app/(admin)/admin/layout.tsx`
8. Verify: crons work, OTP works, sync works — both locally and on Vercel preview

### Phase 1: Admin Surface (1 week, 5 developers in parallel)

Each dev takes a module. Migration per page:
1. Create `page.tsx` in correct route
2. Extract queries into `_lib/queries.ts` (from `db.js`, `adminDb.js`, `bosDb.js`, `masterDb.js`)
3. Break monolithic components into focused pieces in `_components/`
4. Replace manual state caching with TanStack Query
5. Add types + Zod schemas for forms

- **Dev A**: Coding (5 pages) — extract from AdminPanel.jsx (1774 lines)
- **Dev B**: Academics (4 pages) — BOS, Faculties, Problems, Timetable stub
- **Dev C**: Attendance (1 page) — extract from AttendancePage.jsx
- **Dev D**: Fees (1 page) — extract from FeesPage.jsx
- **Dev E**: Dashboard, Users, Settings (3 pages)

### Phase 2: Public + Portal Surfaces (3-4 days, 1-2 developers)

- HomePage → Server Component (SSR for SEO)
- PublicProfile → Server Component with dynamic `[slug]` route
- PracticePage, ProjectHub → simple ports
- **StudentPortal: Move as-is with `'use client'`** (per constraint: do not rewrite)

### Phase 3: Cleanup + Cutover (2-3 days)

- Delete: `vite.config.js`, `src/main.jsx`, `index.html`, old `src/App.jsx`
- Update `vercel.json`: remove SPA rewrite, keep crons
- Test all crons, all APIs, all surfaces on Vercel preview deployment
- Merge to `main` → Vercel auto-deploys

---

## Performance Guarantees

1. **No bulk data loading** — enforced by structure (each page owns its queries, no shared state stores)
2. **Every query filtered + paginated** — TanStack Query + `.range()` on all lists
3. **Server Components for initial render** — dashboard stats, attendance overview fetched server-side (no loading spinner)
4. **Automatic code splitting** — Next.js splits per route, heavy libs (recharts, papaparse) only load where used
5. **Edge runtime** for OTP endpoints — no cold start
6. **No duplicate API logic** — Next.js API routes work in dev AND prod identically
7. **Auto-generated types** — Supabase types from schema, catches query errors at build time

---

## Existing Functionality Inventory (Must Not Regress)

### Supabase Tables (20+)
1. students (with extended fields from gsheet sync)
2. coding_profiles (lead_id + platform composite PK)
3. practice_problems
4. platforms
5. otp_codes (with auto-cleanup function)
6. otp_rate_limits (phone + IP based)
7. admin_users (roles: admin, faculty)
8. gsheet_sync_log (audit trail)
9. student_attendance (semester-wise percentages)
10. student_fees (semester-wise fees + buckets + deadlines)
11. faculties (campus-wise)
12. bos (curriculum templates)
13. bos_subjects (L-T-P + auto-computed credits via trigger)
14. bos_subject_categories (AICTE: HSS, BSC, ESC, PCC, PEC, OEC, PrSI, AUC)
15. bos_assignments (link BOS → campus × admission_year)
16. master_campuses
17. master_batches
18. projects
19. project_members
20. profile_snapshots (monthly progression)

### Database Triggers
- `compute_bos_subject_credits` — auto-compute credits from L-T-P on bos_subjects
- `update_bos_timestamp` — touch parent bos.updated_at when subjects change
- `update_updated_at` — auto-update timestamp on students, faculties
- `cleanup_expired_otps` — auto-delete OTPs older than 10 minutes

### Supabase Edge Functions (external, not in this repo)
- `quick-function` — LeetCode & GitHub API proxy (CORS bypass)
- `refresh-profiles` — Called by pg_cron to refresh coding profiles nightly

### Supabase pg_cron Jobs
- `refresh-leetcode-profiles` — 18:30 UTC daily → POST /functions/v1/refresh-profiles {"platform":"leetcode"}
- `refresh-codeforces-profiles` — 19:30 UTC daily → POST /functions/v1/refresh-profiles {"platform":"codeforces"}

### Rate Limiting (OTP)
- Max 3 OTPs per phone per 10-min window
- Max 10 OTPs per IP per 10-min window
- 30-second cooldown between OTPs to same phone
- Max 5 verification attempts per OTP

### Security Fixes During Migration
- Kill hardcoded master admin (phone: 918770857928, OTP: 060226) — move to DB
- Remove hardcoded service role keys from .mjs scripts
- AMCAT uses separate Supabase project (separate credentials must be preserved)

---

## Alta-Scheduler Learnings (for Timetable module)

### Data Model to Carry Forward
- Schedule = normalized join table (section × subject × faculty × classroom × timeSlot)
- Conflict prevention via DB unique constraints: [classroomId, timeSlotId] and [facultyId, timeSlotId]
- Batch defines timing: lectureDuration, startTime, endTime, recessStart/End, workingDays
- TimeSlots are reusable (created once, referenced many times)
- SubjectFacultyAllocation tracks credits per faculty per subject
- effectiveFrom/effectiveTo + isActive for versioning

### What to Fix from v1
- No bulk data loading (v1 loaded everything on mount — 2738 line monolith)
- Add application-level validation before insert (don't rely only on DB constraint errors)
- Paginate all queries
- Auto-generate time slots from batch timing config
- Validate schedules respect batch working hours
- Add Zod input validation
- Proper error handling for P2002 (conflict) errors with user-friendly messages
- Use Supabase directly instead of Prisma (no cold start, no connection pool issues)

---

## Verification Plan

After each phase:
1. Hit every page — verify data loads, filters work, CRUD works
2. Test OTP flow end-to-end (send + verify + session + logout)
3. Trigger `/api/sync-gsheet` manually — verify students, attendance, fees sync
4. Upload a BOS PDF — verify Gemini extraction works
5. Check Vercel cron dashboard — both schedules present
6. Verify Supabase pg_cron jobs still running (LeetCode + Codeforces refresh)
7. Check all env vars set in Vercel dashboard
8. Run Lighthouse on public pages — verify SSR benefits (FCP < 1.5s)
9. Verify no functionality regression by checking every route against the feature checklist above
10. Test locally (`npm run dev`) AND on Vercel preview — both must work identically
