-- ============================================================
-- BOS (Board of Studies) Schema
-- Defines curriculum: campus × admission_year → semester → subjects (L-T-P)
-- Scheduling (hours/day, breaks, faculty, rooms) is handled separately
-- ============================================================

-- Subject categories as per AICTE
CREATE TABLE IF NOT EXISTS bos_subject_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO bos_subject_categories (code, name, description) VALUES
  ('HSS', 'Humanities & Social Sciences', 'Communication, ethics, management, professional skills'),
  ('BSC', 'Basic Science', 'Mathematics, Physics, Chemistry foundations'),
  ('ESC', 'Engineering Science', 'Introduction to engineering concepts'),
  ('PCC', 'Professional Core', 'Core discipline-specific subjects'),
  ('PEC', 'Professional Elective', 'Specialization electives within discipline'),
  ('OEC', 'Open Elective', 'Cross-branch/multidisciplinary electives'),
  ('PrSI', 'Project/Internship/Seminar', 'Capstone project, internship, seminar'),
  ('AUC', 'Audit Course', 'Non-credit mandatory courses')
ON CONFLICT (code) DO NOTHING;

-- Drop old column if exists from previous schema
ALTER TABLE IF EXISTS bos DROP COLUMN IF EXISTS total_credits;

-- BOS: one per campus × admission_year × program
-- This is ONLY curriculum definition. No scheduling config here.
CREATE TABLE IF NOT EXISTS bos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_name TEXT NOT NULL,
  admission_year INT NOT NULL,
  program TEXT NOT NULL DEFAULT 'B.Tech',
  department TEXT NOT NULL DEFAULT 'Computer Science Engineering',
  total_semesters INT DEFAULT 8,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'archived')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campus_name, admission_year, program, department)
);

CREATE INDEX IF NOT EXISTS idx_bos_campus ON bos(campus_name);
CREATE INDEX IF NOT EXISTS idx_bos_year ON bos(admission_year);

ALTER TABLE bos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bos" ON bos;
DROP POLICY IF EXISTS "Service write bos" ON bos;
CREATE POLICY "Public read bos" ON bos FOR SELECT USING (true);
CREATE POLICY "Service write bos" ON bos FOR ALL USING (true) WITH CHECK (true);

-- BOS Subjects: L-T-P per subject per semester
CREATE TABLE IF NOT EXISTS bos_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bos_id UUID NOT NULL REFERENCES bos(id) ON DELETE CASCADE,
  semester INT NOT NULL CHECK (semester >= 1 AND semester <= 8),
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  category_id UUID REFERENCES bos_subject_categories(id) ON DELETE SET NULL,

  -- L-T-P: this is the source of truth
  lecture_hours INT DEFAULT 0,         -- L: hours/week
  tutorial_hours INT DEFAULT 0,        -- T: hours/week
  practical_hours INT DEFAULT 0,       -- P: hours/week

  -- Derived (auto-computed by trigger)
  theory_credits INT DEFAULT 0,        -- L + T
  practical_credits INT DEFAULT 0,     -- P / 2
  total_credits INT DEFAULT 0,         -- theory + practical
  contact_hours INT DEFAULT 0,         -- L + T + P (hours/week this subject needs)

  is_elective BOOLEAN DEFAULT false,
  is_audit BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(bos_id, semester, subject_code)
);

CREATE INDEX IF NOT EXISTS idx_bos_subjects_bos ON bos_subjects(bos_id);
CREATE INDEX IF NOT EXISTS idx_bos_subjects_sem ON bos_subjects(bos_id, semester);

ALTER TABLE bos_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bos_subjects" ON bos_subjects;
DROP POLICY IF EXISTS "Service write bos_subjects" ON bos_subjects;
CREATE POLICY "Public read bos_subjects" ON bos_subjects FOR SELECT USING (true);
CREATE POLICY "Service write bos_subjects" ON bos_subjects FOR ALL USING (true) WITH CHECK (true);

-- Auto-compute credits from L-T-P
CREATE OR REPLACE FUNCTION compute_bos_subject_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- L-T-P are HOURS. Credits: L + T + P/2
  NEW.theory_credits := NEW.lecture_hours + NEW.tutorial_hours;
  NEW.practical_credits := NEW.practical_hours / 2;
  NEW.total_credits := NEW.theory_credits + NEW.practical_credits;
  NEW.contact_hours := NEW.lecture_hours + NEW.tutorial_hours + NEW.practical_hours;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_bos_credits ON bos_subjects;
CREATE TRIGGER trg_compute_bos_credits
  BEFORE INSERT OR UPDATE ON bos_subjects
  FOR EACH ROW
  EXECUTE FUNCTION compute_bos_subject_credits();

CREATE OR REPLACE FUNCTION update_bos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bos SET updated_at = now() WHERE id = COALESCE(NEW.bos_id, OLD.bos_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bos_subject_touch_bos ON bos_subjects;
CREATE TRIGGER trg_bos_subject_touch_bos
  AFTER INSERT OR UPDATE OR DELETE ON bos_subjects
  FOR EACH ROW
  EXECUTE FUNCTION update_bos_timestamp();
