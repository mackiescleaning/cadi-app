-- Add prev_score and score_snapped_at to leaderboard_entries
-- prev_score is populated on the first upsert after 7 days, enabling
-- client-side rank delta calculation without a cron job.

ALTER TABLE leaderboard_entries
  ADD COLUMN IF NOT EXISTS prev_score       INTEGER   DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_snapped_at TIMESTAMPTZ;
