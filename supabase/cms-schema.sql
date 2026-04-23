-- ============================================================
-- CMS Schema: Homepage sections, Clubs, Events, Gallery
-- Run in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Homepage CMS sections
CREATE TABLE IF NOT EXISTS cms_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT DEFAULT '',
  subtitle TEXT DEFAULT '',
  content JSONB DEFAULT '{}',
  image_url TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cms_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read cms_sections" ON cms_sections;
DROP POLICY IF EXISTS "Service write cms_sections" ON cms_sections;
CREATE POLICY "Public read cms_sections" ON cms_sections FOR SELECT USING (true);
CREATE POLICY "Service write cms_sections" ON cms_sections FOR ALL USING (true) WITH CHECK (true);

-- Seed default sections
INSERT INTO cms_sections (section_key, title, subtitle, sort_order) VALUES
  ('hero', 'Welcome to ALTA School of Technology', 'Building the next generation of tech leaders', 1),
  ('stats', 'Our Impact', '', 2),
  ('featured_clubs', 'Student Clubs', 'Join a community that matches your passion', 3),
  ('upcoming_events', 'Upcoming Events', 'Don''t miss what''s happening on campus', 4),
  ('testimonials', 'Student Stories', 'Hear from our students', 5)
ON CONFLICT (section_key) DO NOTHING;

-- 2. Clubs (campus-specific)
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  campus_name TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  category TEXT DEFAULT 'tech' CHECK (category IN ('coding','cultural','sports','tech','social')),
  instagram_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, campus_name)
);

CREATE INDEX IF NOT EXISTS idx_clubs_campus ON clubs(campus_name);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON clubs(category);
CREATE INDEX IF NOT EXISTS idx_clubs_active ON clubs(active);

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read clubs" ON clubs;
DROP POLICY IF EXISTS "Service write clubs" ON clubs;
CREATE POLICY "Public read clubs" ON clubs FOR SELECT USING (true);
CREATE POLICY "Service write clubs" ON clubs FOR ALL USING (true) WITH CHECK (true);

-- 3. Club members
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  lead_id TEXT NOT NULL REFERENCES students(lead_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead','co_lead','member')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_club ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_lead ON club_members(lead_id);

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read club_members" ON club_members;
DROP POLICY IF EXISTS "Service write club_members" ON club_members;
CREATE POLICY "Public read club_members" ON club_members FOR SELECT USING (true);
CREATE POLICY "Service write club_members" ON club_members FOR ALL USING (true) WITH CHECK (true);

-- 4. Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  campus_name TEXT NOT NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE SET NULL,
  image_url TEXT DEFAULT '',
  registration_url TEXT DEFAULT '',
  conducted_by TEXT DEFAULT '',
  event_date DATE,
  event_time TEXT DEFAULT '',
  location TEXT DEFAULT '',
  event_type TEXT DEFAULT 'other' CHECK (event_type IN ('workshop','hackathon','seminar','competition','cultural','other')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_campus ON events(campus_name);
CREATE INDEX IF NOT EXISTS idx_events_club ON events(club_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read events" ON events;
DROP POLICY IF EXISTS "Service write events" ON events;
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Service write events" ON events FOR ALL USING (true) WITH CHECK (true);

-- 5. Event gallery
CREATE TABLE IF NOT EXISTS event_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT DEFAULT '',
  sort_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_event_gallery_event ON event_gallery(event_id);

ALTER TABLE event_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read event_gallery" ON event_gallery;
DROP POLICY IF EXISTS "Service write event_gallery" ON event_gallery;
CREATE POLICY "Public read event_gallery" ON event_gallery FOR SELECT USING (true);
CREATE POLICY "Service write event_gallery" ON event_gallery FOR ALL USING (true) WITH CHECK (true);

-- 6. Triggers for updated_at
CREATE TRIGGER trg_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_cms_sections_updated_at
  BEFORE UPDATE ON cms_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
