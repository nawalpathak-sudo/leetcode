-- Run this in Supabase Dashboard > SQL Editor
-- WARNING: This drops all existing tables and creates fresh schema

-- ============================================================
-- 0. Clean up everything
-- ============================================================
DROP TABLE IF EXISTS coding_profiles CASCADE;
DROP TABLE IF EXISTS platforms CASCADE;
DROP TABLE IF EXISTS leetcode_profiles CASCADE;
DROP TABLE IF EXISTS codeforces_profiles CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP FUNCTION IF EXISTS generate_slug(TEXT) CASCADE;
DROP FUNCTION IF EXISTS set_student_username() CASCADE;

-- ============================================================
-- 1. Students table (never changes)
-- ============================================================
CREATE TABLE students (
  lead_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  college TEXT DEFAULT '',
  batch TEXT DEFAULT '',
  student_username TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Platforms table (add a row = add a platform, no schema change)
-- ============================================================
CREATE TABLE platforms (
  slug TEXT PRIMARY KEY,                -- 'leetcode', 'codeforces', 'hackerrank'
  display_name TEXT NOT NULL,           -- 'LeetCode', 'Codeforces', 'HackerRank'
  base_url TEXT DEFAULT '',             -- 'https://leetcode.com', etc.
  icon_url TEXT DEFAULT '',             -- optional platform icon
  score_max INT DEFAULT 1000,           -- max possible score
  active BOOLEAN DEFAULT true,          -- toggle platform on/off without deleting
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the two current platforms
INSERT INTO platforms (slug, display_name, base_url) VALUES
  ('leetcode', 'LeetCode', 'https://leetcode.com'),
  ('codeforces', 'Codeforces', 'https://codeforces.com'),
  ('hackerrank', 'HackerRank', 'https://hackerrank.com'),
  ('codechef', 'CodeChef', 'https://codechef.com'),
  ('github', 'GitHub', 'https://github.com');

-- ============================================================
-- 3. Coding profiles (one row per student per platform)
-- ============================================================
CREATE TABLE coding_profiles (
  lead_id TEXT REFERENCES students(lead_id) ON DELETE CASCADE,
  platform TEXT REFERENCES platforms(slug) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INT DEFAULT 0,
  stats JSONB DEFAULT '{}',
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (lead_id, platform)
);

CREATE UNIQUE INDEX idx_cp_platform_username ON coding_profiles(platform, username);

-- ============================================================
-- 4. Slug generator for student_username
-- ============================================================
CREATE OR REPLACE FUNCTION generate_slug(name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN trim(both '_' from
    regexp_replace(
      regexp_replace(
        lower(trim(name)),
        '[^a-z0-9]+', '_', 'g'
      ),
      '_+', '_', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. Auto-generate student_username on insert (trigger)
-- ============================================================
CREATE OR REPLACE FUNCTION set_student_username()
RETURNS TRIGGER AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT;
BEGIN
  IF NEW.student_username IS NOT NULL AND NEW.student_username != '' THEN
    RETURN NEW;
  END IF;

  base_slug := generate_slug(NEW.student_name);
  IF base_slug = '' OR base_slug IS NULL THEN
    base_slug := generate_slug(NEW.lead_id);
  END IF;

  final_slug := base_slug;
  counter := 1;
  WHILE EXISTS (SELECT 1 FROM students WHERE student_username = final_slug AND lead_id != NEW.lead_id) LOOP
    final_slug := base_slug || '_' || counter;
    counter := counter + 1;
  END LOOP;

  NEW.student_username := final_slug;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_student_username
  BEFORE INSERT OR UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_student_username();

-- ============================================================
-- 6. Indexes
-- ============================================================
CREATE INDEX idx_students_college ON students(college);
CREATE INDEX idx_students_batch ON students(batch);
CREATE INDEX idx_cp_platform ON coding_profiles(platform);
CREATE INDEX idx_cp_score ON coding_profiles(score DESC);

-- ============================================================
-- 7. Row Level Security
-- ============================================================
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read students" ON students FOR SELECT USING (true);
CREATE POLICY "Public write students" ON students FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read platforms" ON platforms FOR SELECT USING (true);
CREATE POLICY "Public write platforms" ON platforms FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read profiles" ON coding_profiles FOR SELECT USING (true);
CREATE POLICY "Public write profiles" ON coding_profiles FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 8. Example: adding a new platform later is just one INSERT
-- ============================================================
-- INSERT INTO platforms (slug, display_name, base_url) VALUES
--   ('hackerrank', 'HackerRank', 'https://hackerrank.com');
--
-- Then students can have coding_profiles rows with platform = 'hackerrank'
-- No table changes needed.

-- ============================================================
-- 9. Verify
-- ============================================================
-- SELECT * FROM platforms;
-- SELECT * FROM students LIMIT 5;
-- SELECT * FROM coding_profiles LIMIT 5;
