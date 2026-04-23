# Changelog — ALTA Experience Center

> Updated at manual checkpoints only.

---

## [Unreleased]

### 2026-04-01 — Project Kickoff

- Defined architecture for Experience Center (modern ERP for ALTA School of Technology)
- Created `CLAUDE.md` with tech stack, module structure, design language, and dev rules
- Created `CHANGELOG.md`
- Planned module structure: Dashboard, Coding, Academics, Attendance, Fees
- Admin section isolated under `src/admin/` — existing student/portal code untouched
- Page-wise URL routing via React Router nested routes under `/admin/*`
