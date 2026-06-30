-- 043_weather_cache.sql
-- Cache Met Office responses so we don't hammer the API or burn quota.
-- Cadi-org-wide cache, not per-user — same postcode → same forecast.
-- TTL enforced in the edge function (1 hour).

create table if not exists public.weather_cache (
  postcode    text primary key,
  forecast    jsonb not null,
  fetched_at  timestamptz not null default now()
);

create index if not exists weather_cache_fetched_at
  on public.weather_cache (fetched_at);

alter table public.weather_cache enable row level security;

-- Readable by any signed-in user (forecasts aren't sensitive).
drop policy if exists "weather_cache_read" on public.weather_cache;
create policy "weather_cache_read" on public.weather_cache
  for select using (auth.uid() is not null);

-- Writes only from the edge function (service role bypasses RLS).
-- No write policy for end users.
