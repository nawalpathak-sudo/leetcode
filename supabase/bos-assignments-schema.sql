-- ============================================================
-- BOS Assignments: link a BOS template to campus × batch
-- Current semester is set per assignment (admin controls it)
-- ============================================================

-- Update BOS table: remove campus-specific fields, make it a template
ALTER TABLE bos DROP CONSTRAINT IF EXISTS bos_campus_name_admission_year_program_department_key;
ALTER TABLE bos DROP COLUMN IF EXISTS campus_name;
ALTER TABLE bos DROP COLUMN IF EXISTS admission_year;
ALTER TABLE bos DROP COLUMN IF EXISTS department;

-- Add a display name for the template
ALTER TABLE bos ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled BOS';

-- New unique: just name + program
ALTER TABLE bos DROP CONSTRAINT IF EXISTS bos_name_program_key;
ALTER TABLE bos ADD CONSTRAINT bos_name_program_key UNIQUE(name, program);

-- Assignment table
CREATE TABLE IF NOT EXISTS bos_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bos_id UUID NOT NULL REFERENCES bos(id) ON DELETE CASCADE,
  campus_name TEXT NOT NULL,
  admission_year INT NOT NULL,
  current_semester INT NOT NULL DEFAULT 1 CHECK (current_semester >= 1 AND current_semester <= 8),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(bos_id, campus_name, admission_year)
);

CREATE INDEX IF NOT EXISTS idx_bos_assignments_bos ON bos_assignments(bos_id);
CREATE INDEX IF NOT EXISTS idx_bos_assignments_campus ON bos_assignments(campus_name);

ALTER TABLE bos_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read bos_assignments" ON bos_assignments;
DROP POLICY IF EXISTS "Service write bos_assignments" ON bos_assignments;
CREATE POLICY "Public read bos_assignments" ON bos_assignments FOR SELECT USING (true);
CREATE POLICY "Service write bos_assignments" ON bos_assignments FOR ALL USING (true) WITH CHECK (true);
