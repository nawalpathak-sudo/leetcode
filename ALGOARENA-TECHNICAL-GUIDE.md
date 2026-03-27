# AlgoArena — Technical Architecture & Scoring Guide

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Pipeline — How It Works](#data-pipeline--how-it-works)
3. [LeetCode Integration](#leetcode-integration)
4. [Codeforces Integration](#codeforces-integration)
5. [GitHub Integration](#github-integration)
6. [Scoring System](#scoring-system)
7. [Activity Tracking](#activity-tracking)
8. [Monthly Snapshots & Progression](#monthly-snapshots--progression)
9. [Leaderboard & Homepage](#leaderboard--homepage)
10. [Automated Refresh (Cron Jobs)](#automated-refresh-cron-jobs)
11. [Admin Panel](#admin-panel)
12. [Database Schema](#database-schema)

---

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  LeetCode   │     │   Codeforces     │     │     GitHub       │
│  GraphQL    │     │   REST API       │     │   GraphQL + REST │
└──────┬──────┘     └────────┬─────────┘     └────────┬────────┘
       │                     │                        │
       └─────────┬───────────┴────────────┬───────────┘
                 │                        │
        ┌────────▼────────┐     ┌─────────▼─────────┐
        │  Supabase Edge  │     │  Frontend (React)  │
        │  Function       │     │  Direct API Calls  │
        │  (Batch Refresh)│     │  (Single Profile)  │
        └────────┬────────┘     └─────────┬─────────┘
                 │                        │
                 └──────────┬─────────────┘
                            │
                   ┌────────▼────────┐
                   │    Supabase     │
                   │   PostgreSQL    │
                   │                 │
                   │ coding_profiles │
                   │ students        │
                   │ profile_snaps   │
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │   Frontend      │
                   │   React + Vite  │
                   │                 │
                   │ Homepage        │
                   │ Admin Panel     │
                   │ Student Portal  │
                   └─────────────────┘
```

**Tech Stack:**
- **Frontend:** React 19 + Vite + Tailwind CSS v4
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth)
- **APIs:** LeetCode GraphQL, Codeforces REST, GitHub GraphQL
- **Scheduling:** pg_cron (PostgreSQL extension)

---

## Data Pipeline — How It Works

### Step 1: Student Enrollment
- Admin uploads student list (CSV) with: `lead_id`, `student_name`, `email`, `college`, `batch`
- Stored in `students` table

### Step 2: Profile Linking
- Students or admins link platform usernames (e.g., LeetCode: `john_doe`, Codeforces: `john_cf`)
- Creates a row in `coding_profiles` with `score: 0, stats: {}, fetched_at: null`

### Step 3: Data Fetching
- **Automated:** pg_cron triggers Edge Function at midnight IST daily
- **Manual:** Admin clicks "Refresh All" in admin panel
- Edge Function fetches raw API data from each platform

### Step 4: Processing
- Raw API response is parsed → `stats` extracted → `score` calculated
- Everything stored in `coding_profiles`: `raw_json`, `stats`, `score`, `fetched_at`
- Monthly snapshot saved in `profile_snapshots`

### Step 5: Display
- Frontend reads from `coding_profiles` table
- Computes activity metrics client-side from `raw_json`
- Renders leaderboards, dashboards, charts

---

## LeetCode Integration

### API Used
**LeetCode GraphQL API** — `https://leetcode.com/graphql`

No API key needed. Public endpoint with rate limiting.

### Data Fetched (Single GraphQL Query)

| Field | What It Contains |
|-------|-----------------|
| `matchedUser.profile` | Ranking, reputation, star rating, country, avatar |
| `matchedUser.submitStats.acSubmissionNum` | Solved count per difficulty: Easy, Medium, Hard |
| `matchedUser.submissionCalendar` | Full year of daily submission counts (JSON: `{unix_ts: count}`) |
| `matchedUser.badges` | All earned badges with dates |
| `userContestRanking` | Contest rating, contests attended, global ranking, top % |
| `userContestRankingHistory` | Every contest: rating change, rank, contest name |
| `recentSubmissionList` | Last 20 submissions (any verdict) with language |
| `recentAcSubmissionList` | Last 100 accepted submissions with timestamps |

### Stats Extracted

```
{
  easy: 45,                    // Easy problems solved
  medium: 32,                  // Medium problems solved
  hard: 8,                     // Hard problems solved
  total_solved: 85,            // Sum of all
  contest_rating: 1547.23,     // Current contest rating
  contests_attended: 12,       // Number of contests participated
  global_ranking: 87432,       // Global rank on LeetCode
  solved_slugs: [...]          // List of solved problem IDs (for Practice page tracking)
}
```

### LeetCode Score Calculation (Max: 1000)

```
Total Score = Problem Score + Contest Score + Consistency Score + Ranking Bonus
```

| Component | Formula | Max Points |
|-----------|---------|-----------|
| **Problem Score** | `(Easy×1 + Medium×3 + Hard×5) / 10` | 400 |
| **Contest Score** | `contest_rating / 10` | 300 |
| **Consistency Score** | `contests_attended × 2` | 200 |
| **Ranking Bonus** | Based on global rank tier | 100 |

**Ranking Bonus Tiers:**

| Global Rank | Points |
|------------|--------|
| Top 1,000 | 100 |
| Top 10,000 | 80 |
| Top 50,000 | 60 |
| Top 100,000 | 40 |
| Below 100,000 | 20 |

**Example Calculation:**
```
Student with 50 Easy, 30 Medium, 10 Hard, Rating 1500, 15 Contests, Rank 45000

Problem Score  = (50×1 + 30×3 + 10×5) / 10 = 190/10 = 19.0 → min(19, 400) = 19
Contest Score  = 1500 / 10 = 150 → min(150, 300) = 150
Consistency    = 15 × 2 = 30 → min(30, 200) = 30
Ranking Bonus  = 60 (rank 45000 → top 50K tier)

Total = 19 + 150 + 30 + 60 = 259 / 1000
```

---

## Codeforces Integration

### APIs Used
**Codeforces REST API** — 3 separate calls per user:

| Endpoint | Purpose |
|----------|---------|
| `codeforces.com/api/user.info?handles={username}` | Profile: rating, rank, max rating, contribution, hacks |
| `codeforces.com/api/user.rating?handle={username}` | Full contest history with rating changes |
| `codeforces.com/api/user.status?handle={username}` | All submissions ever made (verdict, problem, language) |

No API key needed. Public API with rate limiting.

### Stats Extracted

```
{
  rating: 1423,                  // Current rating
  max_rating: 1567,              // Peak rating ever achieved
  rank: "specialist",            // Current rank title
  rating_color: "specialist",    // Color tier for UI display
  problems_solved: 142,          // Unique problems with AC verdict
  contests_attended: 28,         // Total rated contests
  avg_problem_rating: 1250,      // Average difficulty of solved problems
  contribution: 3,               // CF community contribution score
  successful_hacks: 5,           // Successful hacks in contests
  unsuccessful_hacks: 2,         // Failed hack attempts
  best_contest_rank: 234,        // Best rank in any single contest
  rating_trend: "improving",     // Based on last 5 contests (improving/stable/declining)
  contest_types: {               // Breakdown by contest division
    div2: 15,
    div3: 8,
    div4: 3,
    educational: 2
  },
  languages: [                   // Top 5 programming languages used
    { name: "GNU C++17", count: 280 },
    { name: "Python 3", count: 45 }
  ]
}
```

### Codeforces-Specific Metrics (Not in LeetCode)

| Metric | What It Means |
|--------|--------------|
| **Rating Color** | Visual rank: Newbie (gray) → Pupil (green) → Specialist (cyan) → Expert (blue) → Master (violet) → Grandmaster (orange) → Legendary GM (red) |
| **Hacks** | In CF contests, you can "hack" others' solutions by finding counter-test cases. Shows competitive depth. |
| **Contribution** | Points earned by creating problems, writing editorials, reporting bugs. Shows community engagement. |
| **Contest Types** | CF has Div 1 (hard), Div 2 (medium), Div 3 (easier), Div 4 (beginner), Educational, Global rounds |
| **Rating Trend** | Compares rating from 5th-last contest to current. Delta > 50 = improving, < -50 = declining |
| **Problem Ratings** | Each CF problem has a difficulty rating (800-3500). Average shows what level the student solves at. |

### Rating Color Tiers

| Rating Range | Color | Rank Title |
|-------------|-------|-----------|
| 3000+ | Red/Gold | Legendary Grandmaster |
| 2400-2999 | Red | International Grandmaster |
| 2100-2399 | Orange | Grandmaster |
| 1900-2099 | Violet | Master |
| 1600-1899 | Blue | Expert |
| 1400-1599 | Cyan | Specialist |
| 1200-1399 | Green | Pupil |
| Below 1200 | Gray | Newbie |

### Codeforces Score Calculation (Max: 1000)

```
Total Score = Rating Score + Contest Score + Problem Score + Rank Bonus
```

| Component | Formula | Max Points |
|-----------|---------|-----------|
| **Rating Score** | `max_rating / 7.5` | 400 |
| **Contest Score** | `contests_attended × 3` | 300 |
| **Problem Score** | `unique_problems_solved × 2` | 200 |
| **Rank Bonus** | Based on rank title | 100 |

**Rank Bonus Table:**

| Rank | Points |
|------|--------|
| Legendary Grandmaster | 100 |
| International Grandmaster | 95 |
| Grandmaster | 90 |
| International Master | 80 |
| Master | 70 |
| Candidate Master | 60 |
| Expert | 50 |
| Specialist | 40 |
| Pupil | 30 |
| Newbie | 20 |

**Example Calculation:**
```
Student with Max Rating 1567, 28 Contests, 142 Problems Solved, Specialist

Rating Score  = 1567 / 7.5 = 208.9 → min(208.9, 400) = 208.9
Contest Score = 28 × 3 = 84 → min(84, 300) = 84
Problem Score = 142 × 2 = 284 → min(284, 200) = 200
Rank Bonus   = 40 (Specialist)

Total = 208.9 + 84 + 200 + 40 = 532.9 / 1000
```

---

## GitHub Integration

### APIs Used
**GitHub GraphQL API** — single query for everything (requires `GITHUB_TOKEN`):

| Data | What It Contains |
|------|-----------------|
| `user` | Profile: bio, avatar, followers, following, account age |
| `repositories` | Top 100 repos: name, language, stars, forks, fork status |
| `contributionsCollection` | Year's commit count, PR count, issue count, contribution calendar |
| `contributionCalendar` | Daily contribution counts for the entire year (heatmap data) |

### Stats Extracted

```
{
  public_repos: 24,              // Total public repos
  own_repos: 18,                 // Non-forked repos (original work)
  followers: 12,
  following: 45,
  total_stars: 8,                // Stars received across all repos
  total_forks: 3,                // Forks of user's repos
  languages: [                   // Language breakdown from repos
    { name: "JavaScript", count: 8 },
    { name: "Python", count: 5 }
  ],
  top_repos: [...],              // Top 6 repos with details
  total_commits: 342,            // Total commits this year
  total_prs: 15,                 // Pull requests opened
  total_issues: 8,               // Issues opened
  total_contributions_year: 456, // Total contributions this year
  current_streak: 7,             // Current consecutive days with commits
  longest_streak: 23,            // Best streak ever
  bio: "Full stack developer",
  avatar_url: "https://...",
  created_at: "2023-01-15"
}
```

### Streak Calculation

```
Streaks are computed from the contribution calendar:

1. Get all dates with contribution counts
2. Sort chronologically
3. Walk through dates counting consecutive days with count > 0
4. Track longest streak seen
5. For current streak: start from today (or yesterday if today has 0)
   and count backwards while contributions > 0
```

**Note:** GitHub does not have a scoring system in AlgoArena currently. It is tracked for profile enrichment and activity monitoring only.

---

## Activity Tracking

Activity is computed **client-side** from the raw API data stored in the database.

### LeetCode Activity
**Primary Source:** `submissionCalendar` — a JSON object mapping Unix timestamps to submission counts for the entire year. No cap on data.

**Fallback:** `recentAcSubmissionList` (last 100 accepted submissions) — used only if calendar is unavailable.

### Codeforces Activity
**Source:** Full submission history from `user.status` API. All submissions with `verdict: "OK"` are counted. Deduplicated by `contestId-index` (unique problem key) per time window.

### GitHub Activity
**Source:** `contributionCalendar` from GraphQL — daily contribution counts for the year.

### Time Windows

| Window | What It Counts |
|--------|---------------|
| **Yesterday** | Submissions/contributions made on the previous calendar day (UTC) |
| **Last 7 Days** | Unique problems solved in the past 7 days |
| **Last 30 Days** | Unique problems solved in the past 30 days |

### Deduplication
- **LeetCode:** Same problem solved twice in a window counts as 1 (deduplicated by `titleSlug`)
- **Codeforces:** Same problem solved twice counts as 1 (deduplicated by `contestId-index`)
- **GitHub:** Raw contribution count (no deduplication — commits are already unique)

---

## Monthly Snapshots & Progression

Every time profiles are refreshed, a snapshot is saved for the current month.

### What Gets Saved

```
{
  lead_id: "STU001",
  platform: "leetcode",
  month: "2026-03",            // YYYY-MM format
  score: 259,                   // Score at time of snapshot
  cumulative_total: 85,         // Total problems ever solved
  new_problems: 12,             // Problems solved THIS month
  easy: 45,                     // Easy count (LeetCode only)
  medium: 32,                   // Medium count (LeetCode only)
  hard: 8                       // Hard count (LeetCode only)
}
```

### How `new_problems` is Counted

**LeetCode:** Counts unique `titleSlug` values from `recentAcSubmissionList` where the timestamp falls within the current month's boundaries.

**Codeforces:** Counts unique `contestId-index` pairs from submissions where `creationTimeSeconds` falls within the current month.

### Monthly Progression Charts
- Admin dashboard shows bar charts of `new_problems` per month
- Grouped by Campus and Batch
- Shows growth trends: "Are students solving more problems each month?"

---

## Leaderboard & Homepage

### Combined Leaderboard

The homepage merges LeetCode and Codeforces data into a unified ranking:

```
For each student:
  total_score = lc_score + cf_score

Sorted by total_score descending
```

### Filtering
- **By Platform:** Show LeetCode-only, Codeforces-only, or Combined score
- **By Batch:** Filter to specific enrollment batch (2024, 2025, etc.)

### Data Quality Filters
- Profiles with `fetched_at = null` (never fetched) are excluded
- Students with `total_score = 0` are excluded from the leaderboard
- Averages are calculated only from students who have data on that platform

### Weekly Activity Leaderboard
- Shows top 20 most active students in the last 7 days
- Combines LeetCode + Codeforces activity

### Refresh Mechanism
- Data auto-refreshes when user switches back to the tab (visibility change listener)
- Background refresh every 5 minutes while page is open
- In-memory cache with 5-minute TTL to avoid hammering the database

---

## Automated Refresh (Cron Jobs)

### Schedule (IST)

| Platform | Time | Cron Expression (UTC) |
|----------|------|----------------------|
| LeetCode | 12:00 AM IST (midnight) | `30 18 * * *` |
| Codeforces | 1:00 AM IST | `30 19 * * *` |

### How It Works

```
pg_cron (PostgreSQL)
    │
    ▼ HTTP POST at scheduled time
Supabase Edge Function: refresh-profiles
    │
    ├── Load all profiles for platform (e.g., 200 LeetCode users)
    ├── Process batch of 50 profiles
    │   ├── Fetch from API (3 concurrent)
    │   ├── Extract stats
    │   ├── Calculate score
    │   ├── Save to coding_profiles
    │   └── Save monthly snapshot
    │
    ├── If more profiles remain:
    │   └── Auto-chain: call itself with offset=50
    │       └── Next batch processes 50 more
    │           └── Chains until all done
    │
    └── Time budget: 50 seconds per function call
```

### Auto-Chaining
The edge function processes profiles in batches of 50. After each batch, if more profiles remain, it triggers **itself** with the next offset. This cascades until all profiles are refreshed — a single cron trigger handles everything.

### Rate Limiting
- **Concurrency:** 3 profiles fetched simultaneously per batch
- **Time Budget:** 50 seconds per edge function invocation (Supabase limit)
- **Between Platforms:** 1 hour gap (LC at midnight, CF at 1 AM) to avoid API pressure

---

## Admin Panel

### Sections

| Section | Purpose |
|---------|---------|
| **Dashboard** | Batch analytics: charts, activity tables, monthly progression |
| **Students & Data** | Upload CSVs, link profiles, manual refresh, manage students |
| **LeetCode Corner** | Manage practice problem lists |
| **Projects** | Student project showcase management |
| **Manage Users** | Create/edit admin and faculty accounts |

### Manual Refresh
- **Test 10:** Refreshes first 10 profiles (for testing)
- **Refresh All:** Refreshes all profiles sequentially with 2-second delays
- Shows real-time progress with ETA

### Faculty Access
- Faculty users see only their campus's data
- Cannot manage other campuses or admin settings

---

## Database Schema

### Core Tables

**`students`**
| Column | Type | Purpose |
|--------|------|---------|
| lead_id | text (PK) | Unique student identifier |
| student_name | text | Full name |
| email | text | Email address |
| phone | text | Phone (for OTP login) |
| college | text | Campus name (ADYPU, SSU, SAGE, etc.) |
| batch | text | Enrollment year (2024, 2025) |
| student_username | text | Chosen display username |

**`coding_profiles`**
| Column | Type | Purpose |
|--------|------|---------|
| lead_id | text (FK → students) | Links to student |
| platform | text | "leetcode", "codeforces", "github" |
| username | text | Platform username |
| score | numeric | Calculated score (0-1000) |
| stats | jsonb | Extracted metrics (see platform sections above) |
| raw_json | jsonb | Full API response (for activity computation) |
| fetched_at | timestamp | When data was last fetched |

**`profile_snapshots`**
| Column | Type | Purpose |
|--------|------|---------|
| lead_id | text (FK) | Student |
| platform | text | Platform |
| month | text | "2026-03" format |
| new_problems | integer | Problems solved that month |
| cumulative_total | integer | Total problems ever |
| score | numeric | Score at snapshot time |
| easy/medium/hard | integer | Difficulty breakdown (LC only) |

---

## Score Comparison: LeetCode vs Codeforces

| Aspect | LeetCode Score | Codeforces Score |
|--------|---------------|-----------------|
| **Max Score** | 1000 | 1000 |
| **Problem Solving Weight** | 40% (Easy/Med/Hard weighted) | 20% (count × 2) |
| **Rating Weight** | 30% (contest rating) | 40% (max rating) |
| **Consistency Weight** | 20% (contests × 2) | 30% (contests × 3) |
| **Rank/Bonus Weight** | 10% (global rank tier) | 10% (rank title) |
| **Philosophy** | Rewards difficulty variety | Rewards peak performance |

### Combined Score on Homepage
```
Combined = LeetCode Score + Codeforces Score
Max possible = 2000
```

Students active on both platforms have an advantage, encouraging cross-platform practice.
