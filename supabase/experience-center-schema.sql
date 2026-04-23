-- ============================================================
-- Experience Center Schema: Attendance, Fees, Faculties
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. Extend students table with fields from Google Sheet
-- ============================================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS cplm_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS program_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS degree_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS campus_name TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS offering_type TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS active_status TEXT DEFAULT 'Active';
ALTER TABLE students ADD COLUMN IF NOT EXISTS rtc TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS marked_inactive_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS refund_req_on_crm TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS refund_asked_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT '';
ALTER TABLE students ADD COLUMN IF NOT EXISTS refund_date DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_students_campus ON students(campus_name);
CREATE INDEX IF NOT EXISTS idx_students_program ON students(program_name);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(active_status);
CREATE INDEX IF NOT EXISTS idx_students_cplm ON students(cplm_id);

-- ============================================================
-- 2. Student Attendance
--    One row per student. Updated on every sync.
--    Semester columns are nullable (student may not have reached that sem yet).
-- ============================================================
CREATE TABLE IF NOT EXISTS student_attendance (
  lead_id TEXT PRIMARY KEY REFERENCES students(lead_id) ON DELETE CASCADE,
  overall_pct NUMERIC(5,2),
  sem1_pct NUMERIC(5,2),
  sem2_pct NUMERIC(5,2),
  sem3_pct NUMERIC(5,2),
  sem4_pct NUMERIC(5,2),
  sem5_pct NUMERIC(5,2),
  sem6_pct NUMERIC(5,2),
  synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attendance_overall ON student_attendance(overall_pct);

ALTER TABLE student_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read attendance" ON student_attendance FOR SELECT USING (true);
CREATE POLICY "Service write attendance" ON student_attendance FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Student Fees
--    One row per student. All amounts in INR (stored as integer paise or numeric).
--    Bucket = text label from sheet (e.g., "0-30 days", "Paid", etc.)
--    Deadline bucket = text label from sheet
-- ============================================================
CREATE TABLE IF NOT EXISTS student_fees (
  lead_id TEXT PRIMARY KEY REFERENCES students(lead_id) ON DELETE CASCADE,

  -- Totals
  total_fee NUMERIC(12,2) DEFAULT 0,
  total_fee_paid NUMERIC(12,2) DEFAULT 0,
  total_fee_pending NUMERIC(12,2) DEFAULT 0,

  -- Till-date totals (fee due up to current date)
  total_fee_till_date NUMERIC(12,2) DEFAULT 0,
  total_fee_paid_till_date NUMERIC(12,2) DEFAULT 0,
  total_fee_pending_till_date NUMERIC(12,2) DEFAULT 0,

  -- Sem 1
  sem1_fee NUMERIC(12,2) DEFAULT 0,
  sem1_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem1_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem1_pending_bucket TEXT DEFAULT '',
  sem1_deadline_date DATE,
  sem1_deadline_bucket TEXT DEFAULT '',

  -- Sem 2
  sem2_fee NUMERIC(12,2) DEFAULT 0,
  sem2_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem2_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem2_pending_bucket TEXT DEFAULT '',
  sem2_deadline_date DATE,
  sem2_deadline_bucket TEXT DEFAULT '',

  -- Sem 3
  sem3_fee NUMERIC(12,2) DEFAULT 0,
  sem3_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem3_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem3_pending_bucket TEXT DEFAULT '',
  sem3_deadline_date DATE,
  sem3_deadline_bucket TEXT DEFAULT '',

  -- Sem 4
  sem4_fee NUMERIC(12,2) DEFAULT 0,
  sem4_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem4_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem4_pending_bucket TEXT DEFAULT '',
  sem4_deadline_date DATE,
  sem4_deadline_bucket TEXT DEFAULT '',

  -- Sem 5
  sem5_fee NUMERIC(12,2) DEFAULT 0,
  sem5_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem5_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem5_pending_bucket TEXT DEFAULT '',
  sem5_deadline_date DATE,
  sem5_deadline_bucket TEXT DEFAULT '',

  -- Sem 6
  sem6_fee NUMERIC(12,2) DEFAULT 0,
  sem6_fee_paid NUMERIC(12,2) DEFAULT 0,
  sem6_fee_pending NUMERIC(12,2) DEFAULT 0,
  sem6_pending_bucket TEXT DEFAULT '',
  sem6_deadline_date DATE,
  sem6_deadline_bucket TEXT DEFAULT '',

  synced_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE student_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read fees" ON student_fees FOR SELECT USING (true);
CREATE POLICY "Service write fees" ON student_fees FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. Faculties
--    Campus-aware. Can teach across batches/sections.
-- ============================================================
CREATE TABLE IF NOT EXISTS faculties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  department TEXT DEFAULT '',
  designation TEXT DEFAULT '',
  campus_name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faculties_campus ON faculties(campus_name);
CREATE INDEX IF NOT EXISTS idx_faculties_active ON faculties(active);

ALTER TABLE faculties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read faculties" ON faculties FOR SELECT USING (true);
CREATE POLICY "Service write faculties" ON faculties FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. Google Sheet Sync Log
--    Track every sync run for debugging/auditing.
-- ============================================================
CREATE TABLE IF NOT EXISTS gsheet_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL,               -- 'student_data', 'attendance', 'fees'
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  rows_fetched INT DEFAULT 0,
  rows_upserted INT DEFAULT 0,
  rows_failed INT DEFAULT 0,
  error_message TEXT,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sync_log_type ON gsheet_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_started ON gsheet_sync_log(started_at DESC);

ALTER TABLE gsheet_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read sync_log" ON gsheet_sync_log FOR SELECT USING (true);
CREATE POLICY "Service write sync_log" ON gsheet_sync_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. Helper: update updated_at on students when synced
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_faculties_updated_at
  BEFORE UPDATE ON faculties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
