# Rules
1. Do NOT provide summaries after completing work. Just write the code and stop. Only summarize if explicitly asked.
2. Code first, always. No explanations unless requested.

# ALTA Website - Brand Guidelines

## Brand Colors

| Color Name    | Hex Code  | Usage                                      |
|---------------|-----------|---------------------------------------------|
| White         | `#FFFFFF` | Backgrounds, text on dark surfaces          |
| Primary       | `#0D1E56` | Headings, primary text, buttons, accents    |
| Ambient       | `#3BC3E2` | Highlights, hover states, secondary accents |
| Dark Ambient  | `#22ACD1` | Logo color, active states, links            |

## Color Rules

- **ONLY** use these 4 colors across the entire website
- No other colors should be introduced
- Primary (`#0D1E56`) for main text and headings
- Ambient (`#3BC3E2`) for highlights and interactive elements
- Dark Ambient (`#22ACD1`) for logo and active/selected states
- White (`#FFFFFF`) for backgrounds and contrast text

## Font

- **Be Vietnam Pro** (Google Font) - all weights: 300, 400, 500, 700, 900

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
