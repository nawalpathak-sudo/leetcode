-- ============================================================
-- Master Data: Campuses & Batches
-- Single source of truth for dropdowns across the app
-- ============================================================

CREATE TABLE IF NOT EXISTS master_campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  city TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE master_campuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read campuses" ON master_campuses;
DROP POLICY IF EXISTS "Service write campuses" ON master_campuses;
CREATE POLICY "Public read campuses" ON master_campuses FOR SELECT USING (true);
CREATE POLICY "Service write campuses" ON master_campuses FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS master_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES master_campuses(id) ON DELETE CASCADE,
  admission_year INT NOT NULL,
  program TEXT NOT NULL DEFAULT 'B.Tech',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(campus_id, admission_year, program)
);

CREATE INDEX IF NOT EXISTS idx_master_batches_campus ON master_batches(campus_id);

ALTER TABLE master_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read batches" ON master_batches;
DROP POLICY IF EXISTS "Service write batches" ON master_batches;
CREATE POLICY "Public read batches" ON master_batches FOR SELECT USING (true);
CREATE POLICY "Service write batches" ON master_batches FOR ALL USING (true) WITH CHECK (true);

-- Seed from existing student data
INSERT INTO master_campuses (name, code)
SELECT DISTINCT campus_name, campus_name
FROM students
WHERE campus_name IS NOT NULL AND campus_name != '' AND campus_name != 'Campus_Name'
ON CONFLICT (name) DO NOTHING;

INSERT INTO master_batches (campus_id, admission_year, program)
SELECT DISTINCT mc.id, s.batch::int, 'B.Tech'
FROM students s
JOIN master_campuses mc ON mc.name = s.campus_name
WHERE s.batch IS NOT NULL AND s.batch != '' AND s.batch ~ '^\d+$'
ON CONFLICT (campus_id, admission_year, program) DO NOTHING;
