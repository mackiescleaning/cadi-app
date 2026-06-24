-- 053_connect_foundation.sql
--
-- Cadi Connect — schema foundation for the FM ↔ subcontractor marketplace.
--
-- Adds:
--   • profile columns for Connect access, score, tier, region, trades, capacity,
--     and the GPS consent flag used by check-in/out
--   • sites.geo_fence_radius_m (default 80)
--   • jobs.contract_id + jobs.listing_id (set when a job comes from a contract
--     allocation or from a marketplace award)
--   • new tables: contracts, visit_specs, marketplace_listings,
--     marketplace_bids, sub_invitations
--   • RLS policies for each new table (FM-org scoped + sub-scoped where
--     appropriate)
--
-- Deferred to later phases (intentionally not in this migration):
--   • fm_sub_reviews / sub_fm_reviews — Phase 3 (approval flow)
--   • accounts_exports + accounts_export_rows — Phase 3 (payments handoff)
--   • Connect-score recompute trigger — Phase 3
--
-- Naming: every Connect-specific column is prefixed `connect_` so an audit
-- can find the surface area in one grep.

-- ─── profiles · Connect columns ────────────────────────────────────────────
alter table public.profiles
  add column if not exists connect_unlocked_by_fm_id uuid references public.fm_organisations(id) on delete set null,
  add column if not exists connect_score numeric default 0 check (connect_score >= 0 and connect_score <= 100),
  add column if not exists connect_tier text default 'eligible' check (connect_tier in ('elite','verified','eligible')),
  add column if not exists connect_trades text[] default '{}',
  add column if not exists connect_region text,
  add column if not exists connect_capacity int default 5 check (connect_capacity >= 0),
  add column if not exists connect_consent_gps boolean default false;

create index if not exists idx_profiles_connect_unlocked_fm
  on public.profiles (connect_unlocked_by_fm_id)
  where connect_unlocked_by_fm_id is not null;

create index if not exists idx_profiles_connect_region
  on public.profiles (connect_region)
  where connect_region is not null;

-- ─── sites · geo-fence radius for check-in / check-out ─────────────────────
alter table public.sites
  add column if not exists geo_fence_radius_m int default 80 check (geo_fence_radius_m > 0);

-- ─── contracts · FM client engagements (e.g. ACERTA programme) ─────────────
create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  end_client_id uuid references public.end_clients(id) on delete set null,
  name text not null,
  work_type text check (work_type in ('exterior','interior','specialist','mixed')),
  starts_on date,
  billing_terms text,
  status text not null default 'mobilising' check (status in ('mobilising','active','paused','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_contracts_fm on public.contracts (fm_organisation_id) where deleted_at is null;
create index if not exists idx_contracts_status on public.contracts (status) where deleted_at is null;

alter table public.contracts enable row level security;

create policy contracts_fm_select on public.contracts
  for select using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

create policy contracts_fm_modify on public.contracts
  for all using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- ─── visit_specs · the 1..N specs per site (frequency × scope × price) ─────
create table if not exists public.visit_specs (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  frequency text not null check (frequency in ('weekly','fortnightly','monthly','quarterly','annual','one_off')),
  scope text not null,
  access_notes text,
  duration_minutes int check (duration_minutes >= 0),
  price_per_visit numeric not null check (price_per_visit >= 0),
  assigned_sub_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'unassigned' check (status in ('unassigned','assigned','marketplace','active','closed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_visit_specs_contract on public.visit_specs (contract_id) where deleted_at is null;
create index if not exists idx_visit_specs_site on public.visit_specs (site_id) where deleted_at is null;
create index if not exists idx_visit_specs_fm on public.visit_specs (fm_organisation_id) where deleted_at is null;
create index if not exists idx_visit_specs_assigned_sub on public.visit_specs (assigned_sub_user_id) where assigned_sub_user_id is not null and deleted_at is null;
create index if not exists idx_visit_specs_status on public.visit_specs (status) where deleted_at is null;

alter table public.visit_specs enable row level security;

-- FM owners see + modify their visit specs
create policy visit_specs_fm_all on public.visit_specs
  for all using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- Assigned sub can see their own visit specs (read-only)
create policy visit_specs_sub_select on public.visit_specs
  for select using (
    assigned_sub_user_id = auth.uid()
  );

-- ─── marketplace_listings · open work the FM is offering ───────────────────
create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  visit_spec_id uuid not null references public.visit_specs(id) on delete cascade,
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  visibility text not null default 'verified' check (visibility in ('elite','verified','eligible','open')),
  format text not null default 'auction' check (format in ('auction','rate_card','cluster')),
  score_floor int default 70 check (score_floor between 0 and 100),
  target_price numeric not null check (target_price >= 0),
  floor_price numeric check (floor_price is null or floor_price >= 0),
  ceiling_price numeric check (ceiling_price is null or ceiling_price >= 0),
  bid_window_hours int default 72 check (bid_window_hours > 0),
  award_rule text not null default 'best_fit' check (award_rule in ('best_fit','lowest_price','manual')),
  status text not null default 'open' check (status in ('draft','open','bidding','awarded','closed','cancelled')),
  cadi_pick_user_id uuid references public.profiles(id) on delete set null,
  first_refusal_expires_at timestamptz,
  awarded_to_user_id uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create index if not exists idx_listings_fm on public.marketplace_listings (fm_organisation_id) where deleted_at is null;
create index if not exists idx_listings_status on public.marketplace_listings (status) where deleted_at is null;
create index if not exists idx_listings_visibility on public.marketplace_listings (visibility, status) where deleted_at is null;
create index if not exists idx_listings_cadi_pick on public.marketplace_listings (cadi_pick_user_id) where cadi_pick_user_id is not null;

alter table public.marketplace_listings enable row level security;

-- FM owners see + modify their listings
create policy listings_fm_all on public.marketplace_listings
  for all using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- Subs can see open listings that match their tier (gated client-side too)
create policy listings_sub_select on public.marketplace_listings
  for select using (
    status in ('open','bidding')
    and deleted_at is null
    and (
      -- Subs connected to this FM (via Connect-unlocked or active visit_spec)
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (
            p.connect_unlocked_by_fm_id = marketplace_listings.fm_organisation_id
            or exists (
              select 1 from public.visit_specs vs
              where vs.assigned_sub_user_id = auth.uid()
                and vs.fm_organisation_id = marketplace_listings.fm_organisation_id
            )
          )
          and coalesce(p.connect_score, 0) >= coalesce(marketplace_listings.score_floor, 0)
      )
    )
  );

-- ─── marketplace_bids ─────────────────────────────────────────────────────
create table if not exists public.marketplace_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  sub_user_id uuid not null references public.profiles(id) on delete cascade,
  bid_price numeric not null check (bid_price >= 0),
  fit_score int check (fit_score is null or fit_score between 0 and 100),
  match_breakdown jsonb default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('submitted','withdrawn','awarded','declined')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_bids_unique_per_sub on public.marketplace_bids (listing_id, sub_user_id) where status <> 'withdrawn';
create index if not exists idx_bids_listing on public.marketplace_bids (listing_id);
create index if not exists idx_bids_sub on public.marketplace_bids (sub_user_id);

alter table public.marketplace_bids enable row level security;

-- Bidder sees + writes their own bids
create policy bids_sub_select on public.marketplace_bids
  for select using (sub_user_id = auth.uid());

create policy bids_sub_insert on public.marketplace_bids
  for insert with check (sub_user_id = auth.uid());

create policy bids_sub_update on public.marketplace_bids
  for update using (sub_user_id = auth.uid()) with check (sub_user_id = auth.uid());

-- FM owners see all bids on their listings
create policy bids_fm_select on public.marketplace_bids
  for select using (
    exists (
      select 1 from public.marketplace_listings ml
      where ml.id = marketplace_bids.listing_id
        and ml.fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
    )
  );

-- FM owners can update bid status (award / decline)
create policy bids_fm_update on public.marketplace_bids
  for update using (
    exists (
      select 1 from public.marketplace_listings ml
      where ml.id = marketplace_bids.listing_id
        and ml.fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
    )
  );

-- ─── sub_invitations · FM bulk-uploads land here, sub claims via token ─────
create table if not exists public.sub_invitations (
  id uuid primary key default gen_random_uuid(),
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  invited_by_user_id uuid references public.profiles(id) on delete set null,
  company_name text,
  contact_name text,
  email text,
  phone text,
  region text,
  trades text[] default '{}',
  token text not null unique,
  status text not null default 'pending' check (status in ('pending','claimed','declined','expired')),
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz default (now() + interval '60 days'),
  created_at timestamptz default now()
);

create index if not exists idx_sub_invites_fm on public.sub_invitations (fm_organisation_id);
create index if not exists idx_sub_invites_status on public.sub_invitations (status);
create index if not exists idx_sub_invites_email on public.sub_invitations (lower(email)) where email is not null;

alter table public.sub_invitations enable row level security;

-- FM owners see + write their invites
create policy sub_invites_fm_all on public.sub_invitations
  for all using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- The claimant (newly signed-up sub) can see their own claimed row
create policy sub_invites_claimant_select on public.sub_invitations
  for select using (claimed_by_user_id = auth.uid());

-- Token-based public lookup is intentionally NOT an RLS policy —
-- the existing invite-lookup edge function uses the service role to
-- resolve a token without exposing the table publicly.

-- ─── jobs · link to contract + marketplace listing when applicable ─────────
alter table public.jobs
  add column if not exists contract_id uuid references public.contracts(id) on delete set null,
  add column if not exists listing_id uuid references public.marketplace_listings(id) on delete set null;

create index if not exists idx_jobs_contract on public.jobs (contract_id) where contract_id is not null;
create index if not exists idx_jobs_listing on public.jobs (listing_id) where listing_id is not null;

-- ─── updated_at triggers (Connect tables only) ─────────────────────────────
create or replace function public._tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'contracts_set_updated_at') then
    create trigger contracts_set_updated_at before update on public.contracts
      for each row execute function public._tg_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'visit_specs_set_updated_at') then
    create trigger visit_specs_set_updated_at before update on public.visit_specs
      for each row execute function public._tg_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'listings_set_updated_at') then
    create trigger listings_set_updated_at before update on public.marketplace_listings
      for each row execute function public._tg_set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bids_set_updated_at') then
    create trigger bids_set_updated_at before update on public.marketplace_bids
      for each row execute function public._tg_set_updated_at();
  end if;
end$$;
