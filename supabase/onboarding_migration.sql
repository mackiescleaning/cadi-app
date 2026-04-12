-- ─── Onboarding migration ────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor AFTER the main schema.sql has been applied.
-- Safe to run multiple times (all statements are idempotent).

-- Extend profiles with onboarding tracking and extra business fields
alter table public.profiles
  add column if not exists last_name            text,
  add column if not exists postcode             text,
  add column if not exists cleaner_type         text,
  add column if not exists biz_structure        text,
  add column if not exists team_structure       text,
  add column if not exists onboarding_complete  boolean not null default false,
  add column if not exists onboarding_step      int     not null default 1;

-- Mark all pre-existing users as already onboarded so they are not forced
-- through the wizard.  New signups default to onboarding_complete = false.
update public.profiles
set    onboarding_complete = true
where  onboarding_complete = false
  and  created_at < now() - interval '5 minutes';

-- Extend business_settings with a flexible setup_data bag for misc fields
-- collected during onboarding (services, goals, compliance, connections, etc.)
alter table public.business_settings
  add column if not exists setup_data jsonb not null default '{}'::jsonb;
