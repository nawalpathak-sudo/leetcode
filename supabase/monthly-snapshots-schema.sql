-- Monthly snapshots: track problems solved per student per month
-- new_problems = this month's total - last month's total
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  month TEXT NOT NULL,           -- '2026-03', '2026-04'
  cumulative_total INT DEFAULT 0,
  new_problems INT DEFAULT 0,
  easy INT DEFAULT 0,
  medium INT DEFAULT 0,
  hard INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(lead_id, platform, month)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_month ON monthly_snapshots(month);
CREATE INDEX IF NOT EXISTS idx_snapshots_lead ON monthly_snapshots(lead_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_platform ON monthly_snapshots(platform, month);

ALTER TABLE monthly_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pub_r_snap" ON monthly_snapshots;
DROP POLICY IF EXISTS "pub_w_snap" ON monthly_snapshots;
CREATE POLICY "pub_r_snap" ON monthly_snapshots FOR SELECT USING (true);
CREATE POLICY "pub_w_snap" ON monthly_snapshots FOR ALL USING (true) WITH CHECK (true);
