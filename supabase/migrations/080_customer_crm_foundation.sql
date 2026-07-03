-- 080_customer_crm_foundation.sql
-- Customer CRM layer: the backend for the Customers tab's "revenue engine"
-- and the future customer portal.
--
--   customer_services         — which services each customer uses (the ledger)
--   customer_service_calendar — planned occurrences, incl. annual services
--   customer_sales_plans      — one active AI/manual sales plan per customer
--   customer_outreach         — upsell/cross-sell emails: draft → sent → converted
--   customer_crm_metrics      — per-customer analysis view (security_invoker)
--
-- Scoping: business_id via my_business_id() RLS helper on every table,
-- matching every other business-scoped table in this codebase.

-- ─── 1 ▸ customer_services ──────────────────────────────────────────────────
-- One row per (customer, service). label is the display name and the natural
-- key — service_id links to the catalogue when a match exists, but imported
-- and historic job services are free text so label stands alone.

create table if not exists customer_services (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references businesses(id) on delete cascade,
  customer_id   uuid not null references customers(id) on delete cascade,
  service_id    uuid references services(id) on delete set null,
  label         text not null,
  status        text not null default 'active',
  frequency     text,                          -- weekly | fortnightly | monthly | annual | free text
  price         numeric,                       -- most recent price paid / quoted
  first_used_at date,
  last_used_at  date,
  times_used    integer not null default 0,
  total_revenue numeric not null default 0,
  source        text not null default 'manual',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint customer_services_status_ck
    check (status in ('active','lapsed','prospect')),
  constraint customer_services_source_ck
    check (source in ('manual','job_history','plan','import')),
  constraint customer_services_customer_label_uq unique (customer_id, label)
);

comment on table customer_services is
  'Per-customer service ledger. status=prospect marks a cross-sell target the customer does not use yet.';

alter table customer_services enable row level security;

create policy customer_services_select_own on customer_services
  for select using (business_id = my_business_id());
create policy customer_services_insert_own on customer_services
  for insert with check (business_id = my_business_id());
create policy customer_services_update_own on customer_services
  for update using (business_id = my_business_id())
  with check (business_id = my_business_id());
create policy customer_services_delete_own on customer_services
  for delete using (business_id = my_business_id());

create index if not exists customer_services_biz_idx      on customer_services (business_id);
create index if not exists customer_services_customer_idx on customer_services (customer_id);

drop trigger if exists customer_services_touch_trg on customer_services;
create trigger customer_services_touch_trg
  before update on customer_services
  for each row execute function touch_updated_at();

-- ─── 2 ▸ customer_service_calendar ──────────────────────────────────────────
-- Planned service occurrences — the "annual calendar". A row is a month a
-- service SHOULD happen for a customer (gutter clean every October, etc.).
-- When it turns into a real booking, job_id links it and status moves on.

create table if not exists customer_service_calendar (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references businesses(id) on delete cascade,
  customer_id         uuid not null references customers(id) on delete cascade,
  customer_service_id uuid references customer_services(id) on delete cascade,
  label               text not null,
  planned_month       date not null,           -- first-of-month anchor, e.g. 2026-10-01
  planned_date        date,                    -- optional exact date once agreed
  recurrence          text not null default 'annual',
  price_estimate      numeric,
  status              text not null default 'planned',
  job_id              uuid references jobs(id) on delete set null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint customer_service_calendar_recurrence_ck
    check (recurrence in ('annual','one_off')),
  constraint customer_service_calendar_status_ck
    check (status in ('planned','offered','booked','done','skipped'))
);

comment on table customer_service_calendar is
  'Annual/planned service occurrences per customer. planned → offered (outreach sent) → booked (job_id set) → done.';

alter table customer_service_calendar enable row level security;

create policy customer_service_calendar_select_own on customer_service_calendar
  for select using (business_id = my_business_id());
create policy customer_service_calendar_insert_own on customer_service_calendar
  for insert with check (business_id = my_business_id());
create policy customer_service_calendar_update_own on customer_service_calendar
  for update using (business_id = my_business_id())
  with check (business_id = my_business_id());
create policy customer_service_calendar_delete_own on customer_service_calendar
  for delete using (business_id = my_business_id());

create index if not exists customer_service_calendar_biz_month_idx
  on customer_service_calendar (business_id, planned_month);
create index if not exists customer_service_calendar_customer_idx
  on customer_service_calendar (customer_id);

drop trigger if exists customer_service_calendar_touch_trg on customer_service_calendar;
create trigger customer_service_calendar_touch_trg
  before update on customer_service_calendar
  for each row execute function touch_updated_at();

-- ─── 3 ▸ customer_sales_plans ───────────────────────────────────────────────
-- One ACTIVE plan per customer (partial unique index). Regenerating archives
-- the old plan rather than mutating it, so conversion numbers stay auditable.

create table if not exists customer_sales_plans (
  id                     uuid primary key default gen_random_uuid(),
  business_id            uuid not null references businesses(id) on delete cascade,
  customer_id            uuid not null references customers(id) on delete cascade,
  status                 text not null default 'active',
  generated_by           text not null default 'ai',
  model                  text,
  summary                text,
  opportunities          jsonb not null default '[]'::jsonb,
  potential_annual_value numeric,
  generated_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint customer_sales_plans_status_ck
    check (status in ('draft','active','archived')),
  constraint customer_sales_plans_generated_by_ck
    check (generated_by in ('ai','manual'))
);

comment on table customer_sales_plans is
  'Per-customer upsell/cross-sell plan. opportunities jsonb: [{key,label,type,rationale,suggested_month,price_estimate,email_subject,email_body}].';

create unique index if not exists customer_sales_plans_one_active_uq
  on customer_sales_plans (customer_id) where status = 'active';

alter table customer_sales_plans enable row level security;

create policy customer_sales_plans_select_own on customer_sales_plans
  for select using (business_id = my_business_id());
create policy customer_sales_plans_insert_own on customer_sales_plans
  for insert with check (business_id = my_business_id());
create policy customer_sales_plans_update_own on customer_sales_plans
  for update using (business_id = my_business_id())
  with check (business_id = my_business_id());
create policy customer_sales_plans_delete_own on customer_sales_plans
  for delete using (business_id = my_business_id());

create index if not exists customer_sales_plans_biz_idx      on customer_sales_plans (business_id);
create index if not exists customer_sales_plans_customer_idx on customer_sales_plans (customer_id);

drop trigger if exists customer_sales_plans_touch_trg on customer_sales_plans;
create trigger customer_sales_plans_touch_trg
  before update on customer_sales_plans
  for each row execute function touch_updated_at();

-- ─── 4 ▸ customer_outreach ──────────────────────────────────────────────────
-- Every upsell/cross-sell email lives here through its whole life:
-- draft → pending_approval/approved → sent → (opened/clicked) → converted.
-- converted_job_id + converted_value are what make conversion tracking real.

create table if not exists customer_outreach (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references businesses(id) on delete cascade,
  customer_id       uuid not null references customers(id) on delete cascade,
  plan_id           uuid references customer_sales_plans(id) on delete set null,
  opportunity_key   text,
  calendar_id       uuid references customer_service_calendar(id) on delete set null,
  channel           text not null default 'email',
  subject           text,
  body              text,
  status            text not null default 'draft',
  resend_message_id text,
  error             text,
  sent_at           timestamptz,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  converted_at      timestamptz,
  converted_job_id  uuid references jobs(id) on delete set null,
  converted_value   numeric,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint customer_outreach_channel_ck
    check (channel in ('email')),
  constraint customer_outreach_status_ck
    check (status in ('draft','pending_approval','approved','sent','failed','dismissed'))
);

comment on table customer_outreach is
  'Upsell/cross-sell outreach log. Conversion = converted_at set, ideally with converted_job_id + converted_value.';

alter table customer_outreach enable row level security;

create policy customer_outreach_select_own on customer_outreach
  for select using (business_id = my_business_id());
create policy customer_outreach_insert_own on customer_outreach
  for insert with check (business_id = my_business_id());
create policy customer_outreach_update_own on customer_outreach
  for update using (business_id = my_business_id())
  with check (business_id = my_business_id());
create policy customer_outreach_delete_own on customer_outreach
  for delete using (business_id = my_business_id());

create index if not exists customer_outreach_biz_status_idx on customer_outreach (business_id, status);
create index if not exists customer_outreach_customer_idx   on customer_outreach (customer_id);
create index if not exists customer_outreach_plan_idx       on customer_outreach (plan_id);

drop trigger if exists customer_outreach_touch_trg on customer_outreach;
create trigger customer_outreach_touch_trg
  before update on customer_outreach
  for each row execute function touch_updated_at();

-- ─── 5 ▸ business_settings.crm_settings ─────────────────────────────────────
-- { outreach_mode: 'approve' | 'auto' } — approve is the default; auto lets
-- crm-send-outreach fire without the owner clicking approve first.

alter table business_settings
  add column if not exists crm_settings jsonb not null default '{}'::jsonb;

-- ─── 6 ▸ Backfill the service ledger from job history ───────────────────────
-- Every existing customer gets their services list populated from jobs, so
-- the CRM is useful on day one. Active = a visit in the last 6 months or one
-- scheduled in the future. Price = most recent job price for that service.

insert into customer_services
  (business_id, customer_id, label, status, price,
   first_used_at, last_used_at, times_used, total_revenue, source)
select
  j.business_id,
  j.customer_id,
  coalesce(nullif(trim(j.service), ''), 'General clean')          as label,
  case when max(j.date) >= current_date - interval '6 months'
       then 'active' else 'lapsed' end                            as status,
  (array_agg(j.price order by j.date desc))[1]                    as price,
  min(j.date)                                                     as first_used_at,
  max(j.date) filter (where j.date <= current_date)               as last_used_at,
  count(*)    filter (where j.date <= current_date)               as times_used,
  coalesce(sum(j.price) filter (where j.date <= current_date), 0) as total_revenue,
  'job_history'
from jobs j
where j.customer_id is not null
  and j.business_id is not null
  and j.deleted_at is null
group by j.business_id, j.customer_id, coalesce(nullif(trim(j.service), ''), 'General clean')
on conflict (customer_id, label) do nothing;

-- Pull frequency from the recurring pattern where one matches the same label.
update customer_services cs
set frequency = rj.freq
from recurring_jobs rj
where rj.customer_id = cs.customer_id
  and coalesce(nullif(trim(rj.service), ''), 'General clean') = cs.label
  and cs.frequency is null
  and (rj.status is null or rj.status = 'active');

-- ─── 7 ▸ customer_crm_metrics view ──────────────────────────────────────────
-- One row per customer with the numbers the CRM drawer needs. security_invoker
-- so RLS on the underlying tables does the tenancy work (same as
-- customers_with_billing, migration 050).

create or replace view customer_crm_metrics
with (security_invoker = true) as
select
  c.id          as customer_id,
  c.business_id,
  c.owner_id,
  jm.visits_past,
  jm.visits_upcoming,
  jm.revenue_12m,
  jm.avg_visit_value,
  jm.last_visit_date,
  jm.next_visit_date,
  jm.distinct_services,
  sm.active_services,
  sm.prospect_services,
  sm.tracked_service_revenue,
  om.outreach_open,
  om.outreach_sent,
  om.outreach_converted,
  om.outreach_converted_value
from customers c
left join lateral (
  select
    count(*) filter (where j.date <= current_date)                        as visits_past,
    count(*) filter (where j.date >  current_date)                        as visits_upcoming,
    coalesce(sum(j.price) filter (
      where j.date <= current_date
        and j.date >= current_date - interval '12 months'), 0)            as revenue_12m,
    round(avg(j.price) filter (where j.date <= current_date), 2)          as avg_visit_value,
    max(j.date) filter (where j.date <= current_date)                     as last_visit_date,
    min(j.date) filter (where j.date >  current_date)                     as next_visit_date,
    count(distinct coalesce(nullif(trim(j.service), ''), 'General clean')) as distinct_services
  from jobs j
  where j.customer_id = c.id and j.deleted_at is null
) jm on true
left join lateral (
  select
    count(*) filter (where cs.status = 'active')   as active_services,
    count(*) filter (where cs.status = 'prospect') as prospect_services,
    coalesce(sum(cs.total_revenue), 0)             as tracked_service_revenue
  from customer_services cs
  where cs.customer_id = c.id
) sm on true
left join lateral (
  select
    count(*) filter (where o.status in ('draft','pending_approval','approved')) as outreach_open,
    count(*) filter (where o.status = 'sent')                                   as outreach_sent,
    count(*) filter (where o.converted_at is not null)                          as outreach_converted,
    coalesce(sum(o.converted_value), 0)                                         as outreach_converted_value
  from customer_outreach o
  where o.customer_id = c.id
) om on true;

comment on view customer_crm_metrics is
  'Per-customer CRM analysis: visit/revenue stats from jobs, service-ledger counts, outreach funnel. RLS via security_invoker.';
