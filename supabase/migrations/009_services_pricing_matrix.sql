-- 009_services_pricing_matrix.sql
-- Add per_size pricing type with a JSONB matrix to services

alter table public.services
  drop constraint if exists services_pricing_type_check;

alter table public.services
  add constraint services_pricing_type_check
  check (pricing_type in ('hourly', 'fixed', 'per_size', 'per_sqm', 'per_room', 'custom'));

alter table public.services
  add column if not exists pricing_matrix jsonb;

comment on column public.services.pricing_matrix is
  'Array of {label, price} for per_size pricing. E.g. [{"label":"2 bed","price":80},{"label":"3 bed","price":100}]';
