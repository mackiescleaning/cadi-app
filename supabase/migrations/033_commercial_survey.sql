-- 033_commercial_survey.sql
-- Commercial Site Survey → Quote/Plan → Onboarding Pack
-- All new tables: business_id-scoped → public.businesses.id
-- RLS policy pattern: business_id = my_business_id()

-- ─── profiles: add quick_wins_done flag array if not present ─────────────────
alter table public.profiles
  add column if not exists quick_wins_done text[] not null default '{}';

-- ─── 1. site_surveys ─────────────────────────────────────────────────────────
create table if not exists public.site_surveys (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  sector      text not null default 'commercial'
    check (sector in ('commercial','residential','exterior')),
  status      text not null default 'capturing'
    check (status in ('capturing','structured','quoted','accepted','archived')),
  raw_notes   text not null default '',
  visit_at    timestamptz,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.site_surveys enable row level security;

drop policy if exists "site_surveys_business_all" on public.site_surveys;
create policy "site_surveys_business_all" on public.site_surveys
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists site_surveys_updated_at on public.site_surveys;
create trigger site_surveys_updated_at
  before update on public.site_surveys
  for each row execute procedure public.set_updated_at();

create index if not exists site_surveys_business_customer on public.site_surveys(business_id, customer_id);
create index if not exists site_surveys_business_status   on public.site_surveys(business_id, status);

-- ─── 2. survey_media ─────────────────────────────────────────────────────────
create table if not exists public.survey_media (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  survey_id    uuid not null references public.site_surveys(id) on delete cascade,
  kind         text not null check (kind in ('photo','voice')),
  storage_path text not null,
  transcript   text,
  caption      text,
  geo          point,
  taken_at     timestamptz not null default now()
);

alter table public.survey_media enable row level security;

drop policy if exists "survey_media_business_all" on public.survey_media;
create policy "survey_media_business_all" on public.survey_media
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists survey_media_survey on public.survey_media(survey_id);

-- ─── 3. survey_structured ────────────────────────────────────────────────────
create table if not exists public.survey_structured (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  survey_id            uuid not null references public.site_surveys(id) on delete cascade unique,
  services             jsonb not null default '[]',
  site_variables       jsonb not null default '{}',
  hazards              jsonb not null default '{}',
  height               jsonb not null default '{}',
  open_questions       jsonb not null default '[]',
  confirmed            boolean not null default false,
  property_size_band   text,
  involves_height      boolean default false,
  service_tags         text[] default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.survey_structured enable row level security;

drop policy if exists "survey_structured_business_all" on public.survey_structured;
create policy "survey_structured_business_all" on public.survey_structured
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists survey_structured_updated_at on public.survey_structured;
create trigger survey_structured_updated_at
  before update on public.survey_structured
  for each row execute procedure public.set_updated_at();

-- ─── 4. survey_checklists ────────────────────────────────────────────────────
create table if not exists public.survey_checklists (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid references public.businesses(id) on delete cascade,
  service_key     text not null,
  label           text not null,
  unrecoverable   boolean not null default true,
  sort            int not null default 0,
  is_seed         boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.survey_checklists enable row level security;

-- Seed rows (business_id IS NULL) are world-readable to all authenticated users
drop policy if exists "survey_checklists_seed_select" on public.survey_checklists;
create policy "survey_checklists_seed_select" on public.survey_checklists
  for select using (business_id is null);

-- Tenant rows: full access scoped to their business
drop policy if exists "survey_checklists_business_all" on public.survey_checklists;
create policy "survey_checklists_business_all" on public.survey_checklists
  for all using (business_id is not null and business_id = my_business_id())
  with check (business_id is not null and business_id = my_business_id());

create index if not exists survey_checklists_service_key on public.survey_checklists(service_key);

-- ─── Seed checklist items (is_seed=true, business_id=null) ───────────────────
insert into public.survey_checklists (business_id, service_key, label, unrecoverable, sort, is_seed)
values
  -- jet_washing
  (null, 'jet_washing', 'Water supply — tap, riser, distance to supply, or bowser needed?', true, 10, true),
  (null, 'jet_washing', 'Power source — site supply available or generator required?', true, 20, true),
  (null, 'jet_washing', 'Waste-water run-off and drainage route confirmed?', true, 30, true),
  (null, 'jet_washing', 'Chemical restrictions on site (bio products, no bleach, drainage regulations)?', true, 40, true),
  -- working_at_height / gutters
  (null, 'working_at_height', 'Access and reach method confirmed (water-fed pole / MEWP / tower / ladders)?', true, 10, true),
  (null, 'working_at_height', 'Fragile surfaces (glass, polycarbonate, older glazing) noted?', true, 20, true),
  (null, 'working_at_height', 'Anchor points / tie-off locations identified or confirmed not applicable?', true, 30, true),
  (null, 'working_at_height', 'Overhead obstructions (cables, canopies, soffits) noted?', true, 40, true),
  (null, 'working_at_height', 'Exclusion zone feasible — can public/vehicles be excluded below?', true, 50, true),
  (null, 'gutters',            'Gutter run length and height estimated for quoting?', true, 10, true),
  (null, 'gutters',            'Downpipe blockage / outlet condition noted?', true, 20, true),
  -- commercial_any (applies to every commercial survey)
  (null, 'commercial_any', 'Access and keyholding arrangements confirmed (key, fob, code, supervised)?', true, 10, true),
  (null, 'commercial_any', 'In / out-of-hours scope confirmed (lone-working implications noted if OOH)?', true, 20, true),
  (null, 'commercial_any', 'Parking and welfare facilities for crew (nearest parking, toilet access)?', true, 30, true),
  (null, 'commercial_any', 'Site induction required? Who delivers it, and how long?', true, 40, true),
  (null, 'commercial_any', 'Sign-off contact confirmed (name + title of person who signs off each visit)?', true, 50, true)
on conflict do nothing;

-- ─── 5. onboarding_packs ─────────────────────────────────────────────────────
create table if not exists public.onboarding_packs (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  survey_id       uuid references public.site_surveys(id) on delete set null,
  quote_id        uuid references public.quotes(id) on delete set null,
  contract_type   text not null default 'one_off'
    check (contract_type in ('one_off','contract')),
  status          text not null default 'assembling'
    check (status in ('assembling','awaiting_signoff','issued','expired')),
  signed_off_by   uuid references auth.users(id),
  signed_off_at   timestamptz,
  pdf_path        text,
  issued_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.onboarding_packs enable row level security;

drop policy if exists "onboarding_packs_business_all" on public.onboarding_packs;
create policy "onboarding_packs_business_all" on public.onboarding_packs
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists onboarding_packs_updated_at on public.onboarding_packs;
create trigger onboarding_packs_updated_at
  before update on public.onboarding_packs
  for each row execute procedure public.set_updated_at();

create index if not exists onboarding_packs_customer on public.onboarding_packs(customer_id);
create index if not exists onboarding_packs_business_status on public.onboarding_packs(business_id, status);

-- ─── 6. pack_components ──────────────────────────────────────────────────────
create table if not exists public.pack_components (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  pack_id       uuid not null references public.onboarding_packs(id) on delete cascade,
  kind          text not null
    check (kind in ('credential','rams','coshh','welcome','method_statement')),
  source        text not null
    check (source in ('settings','generated','sds','staff_training')),
  title         text not null,
  content       jsonb default '{}',
  document_path text,
  expires_at    date,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.pack_components enable row level security;

drop policy if exists "pack_components_business_all" on public.pack_components;
create policy "pack_components_business_all" on public.pack_components
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists pack_components_pack on public.pack_components(pack_id, sort);

-- ─── 7. job_comparables ──────────────────────────────────────────────────────
create table if not exists public.job_comparables (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  service_tags        text[] default '{}',
  property_size_band  text,
  involves_height     boolean default false,
  final_price         numeric not null,
  frequency           text,
  source              text not null default 'logged_job'
    check (source in ('seed','logged_job')),
  created_at          timestamptz not null default now()
);

alter table public.job_comparables enable row level security;

drop policy if exists "job_comparables_business_all" on public.job_comparables;
create policy "job_comparables_business_all" on public.job_comparables
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists job_comparables_business on public.job_comparables(business_id);
create index if not exists job_comparables_tags on public.job_comparables using gin(service_tags);

-- ─── 8. Extend quotes ────────────────────────────────────────────────────────
-- quotes is owner_id-scoped; we add business_id + survey link + cleaning plan
-- without touching existing rows or breaking current queries.

alter table public.quotes
  add column if not exists business_id   uuid references public.businesses(id),
  add column if not exists survey_id     uuid references public.site_surveys(id) on delete set null,
  add column if not exists cleaning_plan jsonb default '{}',
  add column if not exists segment       text default 'residential'
    check (segment in ('residential','exterior','commercial'));

-- Backfill business_id for existing quotes via owner_id
update public.quotes q
set business_id = b.id
from public.businesses b
where b.owner_user_id = q.owner_id
  and q.business_id is null;

create index if not exists quotes_business_survey on public.quotes(business_id, survey_id)
  where survey_id is not null;
create index if not exists quotes_survey_id on public.quotes(survey_id)
  where survey_id is not null;
