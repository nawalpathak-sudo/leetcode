-- ============================================================
-- Performance Indexes Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- Safe to run multiple times (IF NOT EXISTS on all)
-- ============================================================

-- ============================================================
-- 1. coding_profiles — Leaderboard query (heaviest query in the app)
--    loadAllProfiles() does: WHERE platform = X ORDER BY score DESC
--    Current: separate idx_cp_platform and idx_cp_score indexes
--    Fix: composite index so Postgres does a single index scan
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cp_platform_score
ON coding_profiles(platform, score DESC);

-- Can drop the old single-column ones after this (optional):
-- DROP INDEX IF EXISTS idx_cp_platform;
-- DROP INDEX IF EXISTS idx_cp_score;

-- ============================================================
-- 2. coding_profiles — Student profile lookup
--    getStudentProfiles() does: WHERE lead_id = X
--    Already covered by PRIMARY KEY (lead_id, platform) but
--    adding explicit index for lead_id-only lookups
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cp_lead_id
ON coding_profiles(lead_id);

-- ============================================================
-- 3. students — Email lookup (login via email)
--    getStudentByEmail() does: WHERE email = X
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_email
ON students(email);

-- ============================================================
-- 4. students — Phone lookup (WhatsApp OTP login)
--    getStudentByPhone() does: WHERE phone = X
--    May already exist from add-phone-column.sql, IF NOT EXISTS is safe
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_phone
ON students(phone);

-- ============================================================
-- 5. students — Name ordering (loadAllStudents)
--    loadAllStudents() does: ORDER BY student_name
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_name
ON students(student_name);

-- ============================================================
-- 6. otp_codes — Verify lookup (verify-otp endpoint)
--    Does: WHERE phone = X AND verified = false AND expires_at > now()
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_otp_verify
ON otp_codes(phone, verified, expires_at);

-- ============================================================
-- 7. practice_problems — Practice page load
--    loadPracticeProblems() does: ORDER BY topic, order_index, created_at
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_practice_topic_order
ON practice_problems(topic, order_index, created_at);

-- ============================================================
-- 8. coding_profiles — Username search (searchProfiles)
--    Does: WHERE platform = X AND username ILIKE '%query%'
--    pg_trgm extension enables fast ILIKE/LIKE searches
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_cp_username_trgm
ON coding_profiles USING gin(username gin_trgm_ops);

-- ============================================================
-- 9. students — Name search (searchProfiles by student name)
--    Does: WHERE student_name ILIKE '%query%'
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_name_trgm
ON students USING gin(student_name gin_trgm_ops);

-- ============================================================
-- 10. ANALYZE — Update query planner statistics after new indexes
-- ============================================================
ANALYZE students;
ANALYZE coding_profiles;
ANALYZE otp_codes;
ANALYZE practice_problems;
