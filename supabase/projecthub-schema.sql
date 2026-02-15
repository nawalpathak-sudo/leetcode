-- ============================================================
-- ProjectHub Schema
-- ============================================================

-- 1. Projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  deploy_url TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  lead_id TEXT NOT NULL REFERENCES students(lead_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Project members (group tagging + who did what)
CREATE TABLE project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES students(lead_id) ON DELETE CASCADE,
  role TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, lead_id)
);

-- 3. Indexes
CREATE INDEX idx_projects_lead ON projects(lead_id);
CREATE INDEX idx_projects_created ON projects(created_at DESC);
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_lead ON project_members(lead_id);

-- 4. Auto-update updated_at on projects
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_project_updated
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_project_timestamp();

-- 5. Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read projects" ON projects FOR SELECT USING (true);
CREATE POLICY "Public write projects" ON projects FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read project_members" ON project_members FOR SELECT USING (true);
CREATE POLICY "Public write project_members" ON project_members FOR ALL USING (true) WITH CHECK (true);
