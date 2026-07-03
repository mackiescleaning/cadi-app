-- 075_fm_applications_no_direct_insert.sql
--
-- Audit follow-up. The anon INSERT policy on fm_applications was
-- rate-limitless and easily spammable. Route all inserts through the
-- new fm-application-submit edge function which handles per-IP rate
-- limiting, honeypot detection, size caps and validation.

drop policy if exists fm_apps_public_insert on public.fm_applications;
