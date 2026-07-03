-- 068_connect_score_breakdown.sql
--
-- Cadi Connect Score becomes a real, recomputed metric instead of a static
-- field. Stores:
--   • connect_score_status — 'building' (< 5 jobs in window, neutral score)
--                            | 'scored'   (enough volume to compute)
--   • score_breakdown      — JSONB with per-metric values, points, copy
--                            for the sub-side breakdown view
--   • score_recomputed_at  — last cron run that updated this row
--
-- connect_score and connect_tier already exist on profiles (migration 053)
-- and stay as the headline values; the breakdown explains where they came
-- from so the sub knows what to improve.

alter table public.profiles
  add column if not exists connect_score_status text,
  add column if not exists score_breakdown      jsonb,
  add column if not exists score_recomputed_at  timestamptz;

create index if not exists idx_profiles_score_recomputed
  on public.profiles (score_recomputed_at)
  where score_recomputed_at is not null;
