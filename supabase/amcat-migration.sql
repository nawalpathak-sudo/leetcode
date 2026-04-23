-- ============================================================
-- AMCAT Migration: Create tables in main Supabase
-- Mirrors the AMCAT Supabase schema exactly
-- ============================================================

-- 1. Assessments
CREATE TABLE IF NOT EXISTS amcat_assessments (
  id SERIAL PRIMARY KEY,
  assessment_name TEXT NOT NULL,
  campus_id INT,
  batch_id INT,
  category_id INT,
  test_date DATE,
  is_done BOOLEAN DEFAULT false,
  is_historical BOOLEAN DEFAULT false,
  indicative_date DATE,
  category_ids INT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amcat_assessments_campus ON amcat_assessments(campus_id);
CREATE INDEX IF NOT EXISTS idx_amcat_assessments_date ON amcat_assessments(test_date DESC);

ALTER TABLE amcat_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read amcat_assessments" ON amcat_assessments;
DROP POLICY IF EXISTS "Service write amcat_assessments" ON amcat_assessments;
CREATE POLICY "Public read amcat_assessments" ON amcat_assessments FOR SELECT USING (true);
CREATE POLICY "Service write amcat_assessments" ON amcat_assessments FOR ALL USING (true) WITH CHECK (true);

-- 2. AMCAT Results
CREATE TABLE IF NOT EXISTS amcat_results (
  id SERIAL PRIMARY KEY,
  assessment_id INT REFERENCES amcat_assessments(id) ON DELETE CASCADE,
  project_name TEXT DEFAULT '',
  amcat_id TEXT,
  name_invited TEXT DEFAULT '',
  email_invited TEXT DEFAULT '',
  participant_status TEXT DEFAULT '',
  schedule_date TEXT DEFAULT '',
  actual_start_datetime TEXT DEFAULT '',
  actual_completion_datetime TEXT DEFAULT '',
  tag1 TEXT DEFAULT '',          -- campus
  tag2 TEXT DEFAULT '',          -- program
  tag3 TEXT DEFAULT '',          -- lead_id (links to students.lead_id)
  tag4 TEXT DEFAULT '',          -- graduation year
  off_focus_count INT DEFAULT 0,
  email TEXT DEFAULT '',
  mobile_number TEXT DEFAULT '',
  full_name TEXT DEFAULT '',

  -- Quantitative
  quantitative_score NUMERIC(6,2),
  quant_number_theory NUMERIC(6,2),
  quant_basic_numbers NUMERIC(6,2),
  quant_applied_math NUMERIC(6,2),

  -- English
  english_score NUMERIC(6,2),
  english_vocabulary NUMERIC(6,2),
  english_grammar NUMERIC(6,2),
  english_comprehension NUMERIC(6,2),
  english_cefr_level TEXT DEFAULT '',

  -- Logical
  logical_score NUMERIC(6,2),
  logical_inductive NUMERIC(6,2),
  logical_deductive NUMERIC(6,2),

  -- Automata
  automata_score NUMERIC(6,2),
  automata_programming_ability NUMERIC(6,2),
  automata_programming_practices NUMERIC(6,2),
  automata_functional_correctness NUMERIC(6,2),
  automata_runtime_complexity NUMERIC(6,2),
  automata_plagiarism_score NUMERIC(6,2),

  -- Data Structures
  ds_score NUMERIC(6,2),
  ds_basics_linked_lists NUMERIC(6,2),
  ds_sorting_searching NUMERIC(6,2),
  ds_stacks_queues NUMERIC(6,2),
  ds_trees_graphs NUMERIC(6,2),

  report_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_amcat_results_assessment ON amcat_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_amcat_results_tag3 ON amcat_results(tag3);
CREATE INDEX IF NOT EXISTS idx_amcat_results_email ON amcat_results(email);

ALTER TABLE amcat_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read amcat_results" ON amcat_results;
DROP POLICY IF EXISTS "Service write amcat_results" ON amcat_results;
CREATE POLICY "Public read amcat_results" ON amcat_results FOR SELECT USING (true);
CREATE POLICY "Service write amcat_results" ON amcat_results FOR ALL USING (true) WITH CHECK (true);

-- 3. SVAR Results
CREATE TABLE IF NOT EXISTS svar_results (
  id SERIAL PRIMARY KEY,
  assessment_id INT REFERENCES amcat_assessments(id) ON DELETE CASCADE,
  project_name TEXT DEFAULT '',
  amcat_id TEXT,
  name_invited TEXT DEFAULT '',
  email_invited TEXT DEFAULT '',
  participant_status TEXT DEFAULT '',
  schedule_date TEXT DEFAULT '',
  actual_start_datetime TEXT DEFAULT '',
  actual_completion_datetime TEXT DEFAULT '',
  tag1 TEXT DEFAULT '',
  tag2 TEXT DEFAULT '',
  tag3 TEXT DEFAULT '',
  tag4 TEXT DEFAULT '',
  off_focus_count INT DEFAULT 0,
  email TEXT DEFAULT '',
  mobile_number TEXT DEFAULT '',
  full_name TEXT DEFAULT '',

  -- SVAR scores
  svar_spoken_english_score NUMERIC(6,2),
  svar_spoken_english_cefr_level TEXT DEFAULT '',
  svar_understanding NUMERIC(6,2),
  svar_vocabulary NUMERIC(6,2),
  svar_articulation NUMERIC(6,2),
  svar_grammar NUMERIC(6,2),
  svar_pronunciation NUMERIC(6,2),
  svar_fluency NUMERIC(6,2),
  svar_active_listening NUMERIC(6,2),

  report_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_svar_results_assessment ON svar_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_svar_results_tag3 ON svar_results(tag3);
CREATE INDEX IF NOT EXISTS idx_svar_results_email ON svar_results(email);

ALTER TABLE svar_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read svar_results" ON svar_results;
DROP POLICY IF EXISTS "Service write svar_results" ON svar_results;
CREATE POLICY "Public read svar_results" ON svar_results FOR SELECT USING (true);
CREATE POLICY "Service write svar_results" ON svar_results FOR ALL USING (true) WITH CHECK (true);
