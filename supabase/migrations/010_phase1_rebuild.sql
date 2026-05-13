-- 010_phase1_rebuild.sql
-- Phase 1 rebuild: new invoice_templates + payment_connections tables,
-- migration of onboarding step keys from old 4-step to new 3-step structure.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: invoice_templates — one row per business, branding + numbering
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.invoice_templates (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null unique references public.businesses(id) on delete cascade,

  -- Branding
  brand_colour          text not null default '#010a4f',
  logo_position         text not null default 'top_left'
    check (logo_position in ('top_left', 'top_centre', 'top_right')),

  -- Content
  payment_terms_note    text,
  bank_details          text,
  footer_message        text,

  -- Numbering
  invoice_number_format text not null default 'INV-{seq}',
  next_invoice_number   integer not null default 1,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.invoice_templates enable row level security;

drop policy if exists "invoice_templates_business_all" on public.invoice_templates;
create policy "invoice_templates_business_all" on public.invoice_templates
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists invoice_templates_updated_at on public.invoice_templates;
create trigger invoice_templates_updated_at
  before update on public.invoice_templates
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: payment_connections — OAuth tokens for Stripe Connect + GoCardless
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.payment_connections (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses(id) on delete cascade,
  provider                text not null check (provider in ('stripe', 'gocardless')),

  -- Connection state
  is_connected            boolean not null default false,
  connected_at            timestamptz,
  disconnected_at         timestamptz,

  -- OAuth credentials (store access_token encrypted via pgcrypto if available;
  -- Supabase Vault recommended for production — these columns store the raw tokens
  -- for now; rotate to Vault once provisioned)
  access_token            text,
  refresh_token           text,
  token_expires_at        timestamptz,

  -- Provider-specific identifiers
  provider_account_id     text,
  provider_account_name   text,
  provider_account_email  text,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  unique (business_id, provider)
);

alter table public.payment_connections enable row level security;

drop policy if exists "payment_connections_business_all" on public.payment_connections;
create policy "payment_connections_business_all" on public.payment_connections
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

drop trigger if exists payment_connections_updated_at on public.payment_connections;
create trigger payment_connections_updated_at
  before update on public.payment_connections
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: migrate onboarding step keys to new Phase 1 structure
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: delete old Phase 1 step records that no longer apply
delete from public.onboarding_steps
where phase = 1
  and step_key in ('services_menu', 'activate_front_desk');

-- Step 2: insert invoice_template step for all existing businesses
insert into public.onboarding_steps (business_id, phase, step_key, status)
select
  op.business_id,
  1,
  'invoice_template',
  case
    when exists (
      select 1 from public.invoice_templates t where t.business_id = op.business_id
    ) then 'completed'
    else 'available'
  end
from public.onboarding_progress op
where not exists (
  select 1 from public.onboarding_steps s
  where s.business_id = op.business_id
    and s.phase = 1
    and s.step_key = 'invoice_template'
);

-- Step 3: regress any users who had completed old Phase 1 but haven't
-- completed the new invoice_template step, so they see the new step.
update public.onboarding_progress
set phase_1_completed_at = null,
    current_phase = 1
where phase_1_completed_at is not null
  and not exists (
    select 1 from public.onboarding_steps s
    where s.business_id = onboarding_progress.business_id
      and s.phase = 1
      and s.step_key = 'invoice_template'
      and s.status = 'completed'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: update initialise_phase1_plan to use new step keys
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.initialise_phase1_plan(p_business_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.onboarding_progress (business_id, current_phase, phase_1_started_at)
  values (p_business_id, 1, now())
  on conflict (business_id) do nothing;

  insert into public.onboarding_steps (business_id, phase, step_key, status)
  values
    (p_business_id, 1, 'add_customers',    'available'),
    (p_business_id, 1, 'first_job',        'available'),
    (p_business_id, 1, 'invoice_template', 'available')
  on conflict (business_id, phase, step_key) do nothing;
end;
$$;
