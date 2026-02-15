-- Run this SQL in Supabase Dashboard > SQL Editor
-- Go to: https://supabase.com/dashboard > Your Project > SQL Editor > New Query

-- 1. LeetCode Profiles Table
CREATE TABLE IF NOT EXISTS leetcode_profiles (
  username TEXT PRIMARY KEY,
  student_name TEXT DEFAULT '',
  college TEXT DEFAULT '',
  batch TEXT DEFAULT '',
  easy INTEGER DEFAULT 0,
  medium INTEGER DEFAULT 0,
  hard INTEGER DEFAULT 0,
  total_solved INTEGER DEFAULT 0,
  contest_rating REAL DEFAULT 0,
  contests_attended INTEGER DEFAULT 0,
  global_ranking INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Codeforces Profiles Table
CREATE TABLE IF NOT EXISTS codeforces_profiles (
  username TEXT PRIMARY KEY,
  student_name TEXT DEFAULT '',
  college TEXT DEFAULT '',
  batch TEXT DEFAULT '',
  rating INTEGER DEFAULT 0,
  max_rating INTEGER DEFAULT 0,
  rank TEXT DEFAULT '',
  problems_solved INTEGER DEFAULT 0,
  contests_attended INTEGER DEFAULT 0,
  avg_problem_rating INTEGER DEFAULT 0,
  score REAL DEFAULT 0,
  raw_json JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable Row Level Security (but allow all operations with anon key)
ALTER TABLE leetcode_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE codeforces_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Create permissive policies (allow all CRUD for anon users)
CREATE POLICY "Allow all access to leetcode_profiles"
  ON leetcode_profiles FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all access to codeforces_profiles"
  ON codeforces_profiles FOR ALL
  USING (true)
  WITH CHECK (true);
