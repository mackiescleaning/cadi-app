-- 007_cadi_foundations.sql
-- Cadi Phase 1 foundations — additive migration
-- Adds all new tables required by the AI scheduler platform.
-- Does NOT alter existing tables that power HMRC, money tracker, invoices.

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Extend profiles for new tier system + business config fields
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists subscription_tier text not null default 'lite'
    check (subscription_tier in ('lite', 'pro', 'max')),
  add column if not exists timezone text not null default 'Europe/London',
  add column if not exists country text not null default 'GB',
  add column if not exists currency text not null default 'GBP',
  add column if not exists service_postcodes text[] not null default '{}',
  add column if not exists business_hours jsonb,
  add column if not exists brand_voice jsonb,
  add column if not exists trust_level text not null default 'cautious'
    check (trust_level in ('cautious', 'balanced', 'autonomous')),
  add column if not exists google_review_url text,
  add column if not exists trustpilot_url text,
  add column if not exists facebook_review_url text,
  add column if not exists preferred_review_platform text default 'google'
    check (preferred_review_platform in ('google', 'trustpilot', 'facebook', 'checkatrade'));

-- Sync subscription_tier from existing plan column for any current users
update public.profiles
set subscription_tier = case
  when plan = 'pro' then 'pro'
  else 'lite'
end
where subscription_tier = 'lite' and plan = 'pro';

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: businesses — 1-to-1 companion to profiles, primary FK for new tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  name          text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.businesses enable row level security;

drop policy if exists "businesses_owner_all" on public.businesses;
create policy "businesses_owner_all" on public.businesses
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

-- Trigger: auto-create a businesses row when a profile row is created
create or replace function public.handle_new_business()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.businesses (owner_user_id, name)
  values (new.id, coalesce(new.business_name, ''))
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created_make_business on public.profiles;
create trigger on_profile_created_make_business
  after insert on public.profiles
  for each row execute procedure public.handle_new_business();

-- Backfill for existing profiles
insert into public.businesses (owner_user_id, name)
select id, coalesce(business_name, '') from public.profiles
on conflict (owner_user_id) do nothing;

-- Helper function: returns the business id for the authenticated user
create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.businesses where owner_user_id = auth.uid() limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: Extend customers with new fields (keep owner_id, add business_id)
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.customers
  add column if not exists business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists address_line_1 text,
  add column if not exists address_line_2 text,
  add column if not exists town text,
  add column if not exists country text default 'GB',
  add column if not exists whatsapp_opt_in bool not null default false,
  add column if not exists segment text default 'unsegmented'
    check (segment in ('residential', 'exterior', 'commercial', 'unsegmented')),
  add column if not exists segment_confidence float default 0.0,
  add column if not exists segment_source text default 'ai_suggested'
    check (segment_source in ('ai_suggested', 'owner_confirmed', 'owner_set')),
  add column if not exists preferred_contact_channel text default 'email'
    check (preferred_contact_channel in ('email', 'sms', 'whatsapp', 'phone')),
  add column if not exists preferred_cleaner_user_id uuid references auth.users(id),
  add column if not exists total_jobs_completed int not null default 0,
  add column if not exists ai_notes jsonb not null default '{}'::jsonb;

-- Backfill business_id for existing customers via owner_id → businesses
update public.customers c
set business_id = b.id
from public.businesses b
where b.owner_user_id = c.owner_id
  and c.business_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: jobs
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.jobs (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses(id) on delete cascade,
  customer_id             uuid references public.customers(id) on delete set null,
  assigned_user_id        uuid references auth.users(id) on delete set null,
  type                    text not null check (type in ('residential', 'exterior', 'commercial', 'site_visit')),
  service                 text not null,
  status                  text not null default 'enquiry'
    check (status in ('enquiry','quoted','booked','en_route','in_progress','completed','cancelled','invoiced','reviewed')),
  scheduled_start         timestamptz,
  scheduled_end           timestamptz,
  actual_start            timestamptz,
  actual_end              timestamptz,
  price                   numeric,
  deposit_paid            numeric,
  deposit_paid_at         timestamptz,
  labour_cost             numeric,
  margin                  numeric,
  is_recurring            bool not null default false,
  recurrence_pattern      jsonb,
  parent_recurring_job_id uuid references public.jobs(id) on delete set null,
  -- Pricing provenance (spec section 9)
  pricing_rule_id         uuid,
  pricing_rule_version    int,
  pricing_breakdown       jsonb,
  pricing_confidence      text check (pricing_confidence in ('high','medium','low','route_to_human')),
  addons_selected         jsonb,
  notes                   text,
  photos                  jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.jobs enable row level security;

drop policy if exists "jobs_business_all" on public.jobs;
create policy "jobs_business_all" on public.jobs
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: job_events — the event bus
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.job_events (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id      uuid references public.jobs(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  event_type  text not null,
  source      text not null check (source in ('owner','crew','customer','agent_front_desk','agent_reviews','agent_quoter','agent_re_booker','system')),
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.job_events enable row level security;

drop policy if exists "job_events_business_all" on public.job_events;
create policy "job_events_business_all" on public.job_events
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists job_events_business_created on public.job_events(business_id, created_at desc);
create index if not exists job_events_type on public.job_events(event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: leads — web chat enquiries
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses(id) on delete cascade,
  name                     text,
  phone                    text,
  email                    text,
  postcode                 text,
  property_details         jsonb default '{}'::jsonb,
  service_requested        text,
  frequency_requested      text,
  enquiry_source           text not null default 'web_chat',
  status                   text not null default 'new'
    check (status in ('new','qualifying','quoted','quoted_pending_approval','booked','converted','lost','unresponsive')),
  qualified_for_service_area bool,
  matched_customer_id      uuid references public.customers(id) on delete set null,
  conversation_id          uuid,
  abandoned_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.leads enable row level security;

drop policy if exists "leads_business_all" on public.leads;
create policy "leads_business_all" on public.leads
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 7: agent_actions — the approval queue
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_actions (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses(id) on delete cascade,
  agent               text not null,
  action_type         text not null,
  customer_id         uuid references public.customers(id) on delete set null,
  job_id              uuid references public.jobs(id) on delete set null,
  status              text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','sent','failed','auto_sent','superseded')),
  proposed_payload    jsonb not null default '{}'::jsonb,
  reasoning           text,
  approved_by_user_id uuid references auth.users(id),
  approved_at         timestamptz,
  sent_at             timestamptz,
  result              jsonb,
  expires_at          timestamptz,
  source_event_id     uuid,
  created_at          timestamptz not null default now()
);

alter table public.agent_actions enable row level security;

drop policy if exists "agent_actions_business_all" on public.agent_actions;
create policy "agent_actions_business_all" on public.agent_actions
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create index if not exists agent_actions_pending on public.agent_actions(business_id, status)
  where status = 'pending_approval';

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 8: agent_settings — per-agent config per business
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_settings (
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent       text not null,
  mode        text not null default 'approval'
    check (mode in ('off','manual','approval','autonomous')),
  config      jsonb not null default '{}'::jsonb,
  primary key (business_id, agent)
);

alter table public.agent_settings enable row level security;

drop policy if exists "agent_settings_business_all" on public.agent_settings;
create policy "agent_settings_business_all" on public.agent_settings
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 9: agent_costs — cost transparency
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_costs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent       text not null,
  action_id   uuid,
  tokens_in   int not null default 0,
  tokens_out  int not null default 0,
  cost_usd    numeric(10, 6) not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.agent_costs enable row level security;

drop policy if exists "agent_costs_business_select" on public.agent_costs;
create policy "agent_costs_business_select" on public.agent_costs
  for select using (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 10: conversations + messages
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  customer_id     uuid references public.customers(id) on delete set null,
  lead_id         uuid references public.leads(id) on delete set null,
  channel         text not null default 'web_chat'
    check (channel in ('web_chat','email','sms','whatsapp','facebook','instagram')),
  status          text not null default 'open'
    check (status in ('open','awaiting_owner','awaiting_customer','closed','converted')),
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.conversations enable row level security;

drop policy if exists "conversations_business_all" on public.conversations;
create policy "conversations_business_all" on public.conversations
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  direction        text not null check (direction in ('inbound','outbound')),
  channel          text not null,
  sender           text not null check (sender in ('customer','agent','owner','crew')),
  body             text,
  media            jsonb,
  agent_action_id  uuid references public.agent_actions(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table public.messages enable row level security;

drop policy if exists "messages_business_all" on public.messages;
create policy "messages_business_all" on public.messages
  for all using (
    conversation_id in (
      select id from public.conversations where business_id = my_business_id()
    )
  ) with check (
    conversation_id in (
      select id from public.conversations where business_id = my_business_id()
    )
  );

-- Add FK from leads.conversation_id now that conversations exists
alter table public.leads
  add constraint if not exists leads_conversation_id_fk
  foreign key (conversation_id) references public.conversations(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 11: reviews
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.reviews (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references public.businesses(id) on delete cascade,
  customer_id            uuid references public.customers(id) on delete set null,
  job_id                 uuid references public.jobs(id) on delete set null,
  platform               text not null default 'private'
    check (platform in ('google','trustpilot','facebook','checkatrade','private')),
  rating                 int check (rating between 1 and 5),
  comment                text,
  cleaner_named_user_id  uuid references auth.users(id),
  url                    text,
  status                 text not null default 'requested'
    check (status in ('requested','viewed','submitted','private_feedback','unresponsive')),
  request_token          uuid not null default gen_random_uuid(),
  requested_at           timestamptz not null default now(),
  opened_at              timestamptz,
  submitted_at           timestamptz,
  created_at             timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews_business_all" on public.reviews;
create policy "reviews_business_all" on public.reviews
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- Public read for the smiley/frowny gate (by request_token, no auth needed)
drop policy if exists "reviews_public_token_select" on public.reviews;
create policy "reviews_public_token_select" on public.reviews
  for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 12: pricing_rules — new shape (drop old if exists, no data to preserve)
-- ─────────────────────────────────────────────────────────────────────────────

drop table if exists public.pricing_rules cascade;

create table public.pricing_rules (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  service               text not null,
  category              text not null check (category in ('residential','exterior','commercial')),
  status                text not null default 'active'
    check (status in ('active','draft','archived')),
  pricing_method        text not null
    check (pricing_method in (
      'per_bedroom','per_bedroom_bathroom','per_sqm','per_hour',
      'flat_rate_by_size','flat_rate_fixed','site_visit_required'
    )),
  base_amounts          jsonb not null default '{}'::jsonb,
  frequency_modifiers   jsonb not null default '{}'::jsonb,
  frequency_is_absolute bool not null default false,
  postcode_tiers        jsonb,
  minimum_price         numeric,
  duration_estimates    jsonb,
  version               int not null default 1,
  effective_from        timestamptz not null default now(),
  superseded_by_rule_id uuid references public.pricing_rules(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.pricing_rules enable row level security;

drop policy if exists "pricing_rules_business_all" on public.pricing_rules;
create policy "pricing_rules_business_all" on public.pricing_rules
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- Add FK from jobs.pricing_rule_id now that pricing_rules exists
alter table public.jobs
  add constraint if not exists jobs_pricing_rule_id_fk
  foreign key (pricing_rule_id) references public.pricing_rules(id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 13: pricing_addons
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pricing_addons (
  id                    uuid primary key default gen_random_uuid(),
  business_id           uuid not null references public.businesses(id) on delete cascade,
  service               text not null,
  name                  text not null,
  price                 numeric not null,
  duration_minutes_added int,
  display_mode          text not null default 'common'
    check (display_mode in ('common','on_request')),
  active                bool not null default true,
  display_order         int not null default 0,
  created_at            timestamptz not null default now()
);

alter table public.pricing_addons enable row level security;

drop policy if exists "pricing_addons_business_all" on public.pricing_addons;
create policy "pricing_addons_business_all" on public.pricing_addons
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 14: availability_slots
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.availability_slots (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  day_of_week   int not null check (day_of_week between 0 and 6),
  start_time    time not null,
  end_time      time not null,
  service_types text[] not null default '{}',
  active        bool not null default true
);

alter table public.availability_slots enable row level security;

drop policy if exists "availability_slots_business_all" on public.availability_slots;
create policy "availability_slots_business_all" on public.availability_slots
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 15: site_visit_slots — commercial enquiry scheduling
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.site_visit_slots (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  day_of_week          int not null check (day_of_week between 0 and 6),
  start_time           time not null,
  end_time             time not null,
  slot_duration_minutes int not null default 60,
  buffer_minutes       int not null default 30,
  active               bool not null default true
);

alter table public.site_visit_slots enable row level security;

drop policy if exists "site_visit_slots_business_all" on public.site_visit_slots;
create policy "site_visit_slots_business_all" on public.site_visit_slots
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 16: webhook_events — audit + idempotency
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_type   text not null,
  external_id  text not null,
  payload      jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (provider, external_id)
);

-- No RLS — service role only, no user access needed

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 17: customer_portal_tokens — for smiley/frowny gate + Phase 2 portal
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.customer_portal_tokens (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  purpose     text not null default 'review_gate'
    check (purpose in ('review_gate','portal_access')),
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.customer_portal_tokens enable row level security;

drop policy if exists "portal_tokens_business_all" on public.customer_portal_tokens;
create policy "portal_tokens_business_all" on public.customer_portal_tokens
  for all using (business_id = my_business_id()) with check (business_id = my_business_id());

-- Public select by token for gate pages (unauthenticated)
drop policy if exists "portal_tokens_public_token_select" on public.customer_portal_tokens;
create policy "portal_tokens_public_token_select" on public.customer_portal_tokens
  for select using (true);
