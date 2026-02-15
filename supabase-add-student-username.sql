-- Run this in Supabase Dashboard > SQL Editor
-- Adds student_username column to both tables, generates slugs from student_name,
-- handles duplicates with _1, _2, etc.

-- ============================================================
-- 1. Helper function: generate slug from name
-- ============================================================
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(both '_' from
    regexp_replace(
      regexp_replace(
        lower(trim(name)),
        '[^a-z0-9]+', '_', 'g'   -- replace non-alphanumeric with _
      ),
      '_+', '_', 'g'              -- collapse multiple underscores
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Add column to both tables
-- ============================================================
ALTER TABLE leetcode_profiles
  ADD COLUMN IF NOT EXISTS student_username TEXT;

ALTER TABLE codeforces_profiles
  ADD COLUMN IF NOT EXISTS student_username TEXT;

-- ============================================================
-- 3. Populate student_username for leetcode_profiles
-- ============================================================
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INT;
BEGIN
  FOR r IN
    SELECT username, student_name
    FROM leetcode_profiles
    WHERE student_username IS NULL OR student_username = ''
    ORDER BY student_name, username
  LOOP
    base_slug := generate_slug(r.student_name);

    -- If name is empty, fall back to the platform username
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := generate_slug(r.username);
    END IF;

    -- Check for duplicates and increment
    final_slug := base_slug;
    counter := 1;
    WHILE EXISTS (
      SELECT 1 FROM leetcode_profiles
      WHERE student_username = final_slug AND username != r.username
    ) LOOP
      final_slug := base_slug || '_' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE leetcode_profiles
    SET student_username = final_slug
    WHERE username = r.username;
  END LOOP;
END $$;

-- ============================================================
-- 4. Populate student_username for codeforces_profiles
-- ============================================================
DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INT;
BEGIN
  FOR r IN
    SELECT username, student_name
    FROM codeforces_profiles
    WHERE student_username IS NULL OR student_username = ''
    ORDER BY student_name, username
  LOOP
    base_slug := generate_slug(r.student_name);

    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := generate_slug(r.username);
    END IF;

    -- Check duplication across BOTH tables so URLs are globally unique
    final_slug := base_slug;
    counter := 1;
    WHILE EXISTS (
      SELECT 1 FROM codeforces_profiles
      WHERE student_username = final_slug AND username != r.username
      UNION ALL
      SELECT 1 FROM leetcode_profiles
      WHERE student_username = final_slug
        AND NOT EXISTS (
          SELECT 1 FROM codeforces_profiles
          WHERE student_name = r.student_name
            AND college = (SELECT college FROM codeforces_profiles cf2 WHERE cf2.username = r.username)
            AND student_username = final_slug
        )
    ) LOOP
      final_slug := base_slug || '_' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE codeforces_profiles
    SET student_username = final_slug
    WHERE username = r.username;
  END LOOP;
END $$;

-- ============================================================
-- 5. Try to match same student across both tables (same name + college)
--    so they share the same student_username for a unified profile page
-- ============================================================
UPDATE codeforces_profiles cf
SET student_username = lc.student_username
FROM leetcode_profiles lc
WHERE lower(trim(cf.student_name)) = lower(trim(lc.student_name))
  AND lower(trim(cf.college)) = lower(trim(lc.college))
  AND cf.student_username != lc.student_username;

-- ============================================================
-- 6. Add unique constraints
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_lc_student_username
  ON leetcode_profiles (student_username);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cf_student_username
  ON codeforces_profiles (student_username);

-- ============================================================
-- 7. Verify - run this to see generated slugs
-- ============================================================
-- SELECT student_name, student_username, username FROM leetcode_profiles ORDER BY student_username LIMIT 20;
-- SELECT student_name, student_username, username FROM codeforces_profiles ORDER BY student_username LIMIT 20;
