-- Admin users table
-- role: 'admin' (full access) or 'faculty' (campus-scoped)
-- faculty users are tied to a specific campus (college)

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'faculty')),
  campus TEXT,  -- required for faculty, NULL for admin
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure faculty always has a campus
ALTER TABLE admin_users ADD CONSTRAINT faculty_must_have_campus
  CHECK (role != 'faculty' OR campus IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_admin_users_phone ON admin_users(phone);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow anon to read (needed for login check on client)
CREATE POLICY "Allow anon read admin_users"
  ON admin_users FOR SELECT
  USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "Service role full access admin_users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role');
