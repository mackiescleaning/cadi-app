-- 066_job_checkins_business_id_nullable.sql
--
-- Connect subs have no business_id (the sub IS the business in the
-- Connect model), but job_checkins.business_id predates the Connect
-- side and was declared NOT NULL. connect-checkin passes null, the
-- insert errors, and the generic try/catch returns 500 with no useful
-- detail in the gateway logs.
--
-- Resolution: drop NOT NULL. The constraint was correct for the
-- original residential / staff-PIN flow but doesn't apply to Connect.

alter table public.job_checkins
  alter column business_id drop not null;
