-- 040_jobs_display_order.sql
-- Add an explicit display_order column to jobs so drag-to-reorder
-- in the Scheduler DayView can persist sequence without mutating
-- start_hour (which corrupts VAT/MTD evidence and recurrence anchors).

alter table public.jobs
  add column if not exists display_order integer not null default 0;

create index if not exists jobs_owner_date_display_order
  on public.jobs (owner_id, date, display_order, start_hour);
