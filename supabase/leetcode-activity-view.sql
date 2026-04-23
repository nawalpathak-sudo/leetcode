-- View: leetcode_activity_view
-- Computes 7d and 30d problem counts from daily_snapshots
-- Uses closest available snapshot dates (tolerant of missing days)

CREATE OR REPLACE VIEW leetcode_activity_view AS
SELECT
  ds_latest.lead_id,
  ds_latest.cumulative_total as current_total,
  ds_latest.easy as current_easy,
  ds_latest.medium as current_medium,
  ds_latest.hard as current_hard,
  COALESCE(ds_latest.cumulative_total - ds_7d.cumulative_total, 0) as problems_7d,
  COALESCE(ds_latest.cumulative_total - ds_30d.cumulative_total, 0) as problems_30d
FROM daily_snapshots ds_latest
LEFT JOIN LATERAL (
  SELECT cumulative_total
  FROM daily_snapshots
  WHERE lead_id = ds_latest.lead_id
    AND platform = 'leetcode'
    AND snapshot_date <= ds_latest.snapshot_date - 7
  ORDER BY snapshot_date DESC
  LIMIT 1
) ds_7d ON true
LEFT JOIN LATERAL (
  SELECT cumulative_total
  FROM daily_snapshots
  WHERE lead_id = ds_latest.lead_id
    AND platform = 'leetcode'
    AND snapshot_date <= ds_latest.snapshot_date - 30
  ORDER BY snapshot_date DESC
  LIMIT 1
) ds_30d ON true
WHERE ds_latest.platform = 'leetcode'
AND ds_latest.snapshot_date = (
  SELECT MAX(snapshot_date)
  FROM daily_snapshots
  WHERE platform = 'leetcode'
);
