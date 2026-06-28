-- 058_fm_applications_and_invitations.sql
--
-- FM-side onboarding flow:
--   1. Prospective FM submits a public application form  →  fm_applications.
--   2. Cadi admin reviews, approves or rejects.
--   3. On approval, an fm_organisations row is created + an fm_invitations row
--      is created with a token; admin email is sent the /invite/:token?source=fm-ops
--      link.
--   4. Recipient claims the invite, profiles.fm_organisation_id is set, they
--      land in /fm-ops.
--
-- Also adds: profiles.is_cadi_admin flag for the review queue, and
-- INSERT/UPDATE policies on fm_organisations so the approve edge function
-- (running as service-role) creates orgs cleanly (no auth gymnastics needed
-- but kept tidy).

-- ─── profiles · is_cadi_admin flag ───────────────────────────────────────
alter table public.profiles
  add column if not exists is_cadi_admin boolean default false;

create index if not exists idx_profiles_cadi_admin on public.profiles (id) where is_cadi_admin = true;

-- ─── fm_applications · intake from prospective FMs ───────────────────────
create table if not exists public.fm_applications (
  id uuid primary key default gen_random_uuid(),

  -- Company info
  company_name      text not null,
  company_website   text,
  company_size      text check (company_size in ('1-10','11-50','51-200','201-500','500+')),
  business_model    text,        -- free text: who they serve / how they work

  -- Scale + scope
  regions_covered   text[] default '{}',
  sites_managed     int,
  current_subs      int,
  current_software  text,        -- e.g. 'Pinnacle', 'Squeegee', 'spreadsheets'

  -- Contact (the person filling in the form — becomes first FM admin on approval)
  contact_name      text not null,
  contact_role      text,
  contact_email     text not null,
  contact_phone     text,

  -- Pitch
  why_cadi          text,

  -- Review state
  status            text not null default 'pending'
                    check (status in ('pending','reviewing','approved','rejected')),
  reviewed_by_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  rejection_reason  text,

  -- Set when approved → the org + invite created from this application
  fm_organisation_id uuid references public.fm_organisations(id) on delete set null,
  invitation_id     uuid,   -- FK added below after fm_invitations exists

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_fm_apps_status on public.fm_applications (status, created_at desc);
create index if not exists idx_fm_apps_email on public.fm_applications (lower(contact_email));

alter table public.fm_applications enable row level security;

-- Public can INSERT (the application form is public, no auth)
drop policy if exists fm_apps_public_insert on public.fm_applications;
create policy fm_apps_public_insert on public.fm_applications
  for insert to anon, authenticated
  with check (status = 'pending');  -- new rows must start pending

-- Cadi admins can SELECT + UPDATE everything
drop policy if exists fm_apps_admin_select on public.fm_applications;
create policy fm_apps_admin_select on public.fm_applications
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  );

drop policy if exists fm_apps_admin_update on public.fm_applications;
create policy fm_apps_admin_update on public.fm_applications
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  );

-- ─── fm_invitations · token-based join links for an existing org ─────────
create table if not exists public.fm_invitations (
  id uuid primary key default gen_random_uuid(),
  fm_organisation_id uuid not null references public.fm_organisations(id) on delete cascade,
  invited_by_user_id uuid references public.profiles(id) on delete set null,

  -- Recipient
  email text not null,
  contact_name text,
  role text not null default 'member'
       check (role in ('admin','member')),

  token text not null unique,
  status text not null default 'pending'
         check (status in ('pending','claimed','declined','expired')),
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz default (now() + interval '60 days'),

  -- If this invitation came from an approved fm_applications row, link back
  source_application_id uuid references public.fm_applications(id) on delete set null,

  created_at timestamptz default now()
);

create index if not exists idx_fm_invites_fm on public.fm_invitations (fm_organisation_id);
create index if not exists idx_fm_invites_email on public.fm_invitations (lower(email));
create index if not exists idx_fm_invites_status on public.fm_invitations (status);

alter table public.fm_invitations enable row level security;

-- FM-org members see + write their own org's invites (admin role for write;
-- both roles for read so members can see who else is invited).
drop policy if exists fm_invites_org_select on public.fm_invitations;
create policy fm_invites_org_select on public.fm_invitations
  for select using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

drop policy if exists fm_invites_org_insert on public.fm_invitations;
create policy fm_invites_org_insert on public.fm_invitations
  for insert with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- Cadi admins can do everything (for the application-approve flow)
drop policy if exists fm_invites_admin_all on public.fm_invitations;
create policy fm_invites_admin_all on public.fm_invitations
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  );

-- Claimant can see their own claimed row (after sign-up)
drop policy if exists fm_invites_claimant_select on public.fm_invitations;
create policy fm_invites_claimant_select on public.fm_invitations
  for select using (claimed_by_user_id = auth.uid());

-- Now wire the FK from fm_applications.invitation_id → fm_invitations.id
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fm_applications_invitation_id_fkey'
  ) then
    alter table public.fm_applications
      add constraint fm_applications_invitation_id_fkey
      foreign key (invitation_id) references public.fm_invitations(id) on delete set null;
  end if;
end$$;

-- ─── fm_organisations · let cadi-admins INSERT/UPDATE ─────────────────────
-- Existing policy fm_org_members_select lets members see their own. Add admin
-- write so the approve flow can create new orgs (service-role bypasses RLS
-- anyway, but the policy makes the API tidy for any future direct-write path).

drop policy if exists fm_orgs_admin_insert on public.fm_organisations;
create policy fm_orgs_admin_insert on public.fm_organisations
  for insert with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  );

drop policy if exists fm_orgs_admin_update on public.fm_organisations;
create policy fm_orgs_admin_update on public.fm_organisations
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_cadi_admin = true)
  );

-- ─── Updated-at trigger on the new tables ────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'fm_applications_set_updated_at') then
    create trigger fm_applications_set_updated_at before update on public.fm_applications
      for each row execute function public._tg_set_updated_at();
  end if;
end$$;
