-- ============================================================
-- AMCAT Remaining Tables: credentials, seating_plans, attendance, faculty
-- ============================================================

-- Credentials
CREATE TABLE IF NOT EXISTS amcat_credentials (
  id SERIAL PRIMARY KEY,
  assessment_id INT REFERENCES amcat_assessments(id) ON DELETE CASCADE,
  email TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  last_name TEXT DEFAULT '',
  password TEXT DEFAULT '',
  is_assigned BOOLEAN DEFAULT false,
  assigned_to_student_id INT,
  assigned_mobile TEXT DEFAULT '',
  assigned_at TIMESTAMPTZ,
  lead_id TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_amcat_cred_assessment ON amcat_credentials(assessment_id);
CREATE INDEX IF NOT EXISTS idx_amcat_cred_email ON amcat_credentials(email);
CREATE INDEX IF NOT EXISTS idx_amcat_cred_lead ON amcat_credentials(lead_id);

ALTER TABLE amcat_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pub_r_acred" ON amcat_credentials;
DROP POLICY IF EXISTS "pub_w_acred" ON amcat_credentials;
CREATE POLICY "pub_r_acred" ON amcat_credentials FOR SELECT USING (true);
CREATE POLICY "pub_w_acred" ON amcat_credentials FOR ALL USING (true) WITH CHECK (true);

-- Seating Plans
CREATE TABLE IF NOT EXISTS amcat_seating_plans (
  id SERIAL PRIMARY KEY,
  assessment_id INT REFERENCES amcat_assessments(id) ON DELETE CASCADE,
  room_number TEXT DEFAULT '',
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  student_email TEXT DEFAULT '',
  student_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  lead_id TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_amcat_seat_assessment ON amcat_seating_plans(assessment_id);

ALTER TABLE amcat_seating_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pub_r_aseat" ON amcat_seating_plans;
DROP POLICY IF EXISTS "pub_w_aseat" ON amcat_seating_plans;
CREATE POLICY "pub_r_aseat" ON amcat_seating_plans FOR SELECT USING (true);
CREATE POLICY "pub_w_aseat" ON amcat_seating_plans FOR ALL USING (true) WITH CHECK (true);

-- Attendance
CREATE TABLE IF NOT EXISTS amcat_attendance (
  id SERIAL PRIMARY KEY,
  student_id INT,
  assessment_id INT REFERENCES amcat_assessments(id) ON DELETE CASCADE,
  credential_id INT,
  marked_by_faculty TEXT DEFAULT '',
  status TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  lead_id TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_amcat_att_assessment ON amcat_attendance(assessment_id);
CREATE INDEX IF NOT EXISTS idx_amcat_att_lead ON amcat_attendance(lead_id);

ALTER TABLE amcat_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pub_r_aatt" ON amcat_attendance;
DROP POLICY IF EXISTS "pub_w_aatt" ON amcat_attendance;
CREATE POLICY "pub_r_aatt" ON amcat_attendance FOR SELECT USING (true);
CREATE POLICY "pub_w_aatt" ON amcat_attendance FOR ALL USING (true) WITH CHECK (true);

-- Faculty
CREATE TABLE IF NOT EXISTS amcat_faculty (
  id SERIAL PRIMARY KEY,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  password_hash TEXT DEFAULT '',
  campus TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  mobile TEXT DEFAULT ''
);

ALTER TABLE amcat_faculty ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pub_r_afac" ON amcat_faculty;
DROP POLICY IF EXISTS "pub_w_afac" ON amcat_faculty;
CREATE POLICY "pub_r_afac" ON amcat_faculty FOR SELECT USING (true);
CREATE POLICY "pub_w_afac" ON amcat_faculty FOR ALL USING (true) WITH CHECK (true);
