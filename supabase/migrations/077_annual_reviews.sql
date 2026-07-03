-- 077_annual_reviews.sql
-- Locked snapshots of the Annual Review + interim "as-at" snapshots.
--
-- Each row is one filing — never overwritten. Re-filing the same tax year
-- creates a NEW row; year-on-year compare reads the most recent filed row
-- for the prior tax year. The `hash` is SHA256 of the stable-stringified
-- snapshot, used for the public verify URL.
--
-- Scoping: business_id via my_business_id() RLS helper, matching every
-- other new business-scoped table in this codebase.

create table if not exists annual_reviews (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references businesses(id) on delete cascade,
  tax_year                 text not null,                                    -- '2025/26'
  filed_at                 timestamptz not null default now(),
  is_interim               boolean not null default false,
  interim_label            text,                                             -- e.g. 'Funding pack — Aug 2026'
  snapshot_jsonb           jsonb not null,                                   -- aggregator output at file time
  overrides_jsonb          jsonb not null default '{}'::jsonb,               -- per-field user overrides
  exec_summary_override    text,
  ratings_jsonb            jsonb,                                            -- self-review star ratings
  plan_jsonb               jsonb,                                            -- §10 "next 12 months" content
  tone_mode                text not null default 'internal',                 -- internal | funding | tender
  hash                     text not null,                                    -- sha256 of snapshot for verify URL
  created_at               timestamptz not null default now(),
  constraint annual_reviews_tone_mode_ck
    check (tone_mode in ('internal','funding','tender'))
);

comment on table annual_reviews is
  'Locked snapshots of the Cadi Annual Review. Insert-only per filing; never mutate the snapshot.';

alter table annual_reviews enable row level security;

create policy annual_reviews_select_own on annual_reviews
  for select using (business_id = my_business_id());

create policy annual_reviews_insert_own on annual_reviews
  for insert with check (business_id = my_business_id());

-- Updates allowed for overrides / ratings / plan / exec_summary_override
-- only. The snapshot_jsonb itself is immutable at the app layer; enforcing
-- that here would need a trigger — deferred.
create policy annual_reviews_update_own on annual_reviews
  for update using (business_id = my_business_id());

-- Public verify URL (cadi.cleaning/verify/ar/<hash>) is deferred to a
-- later slice — it will be implemented as a security-definer RPC that
-- projects only (id, tax_year, filed_at, hash, is_interim, tone_mode).
-- RLS cannot project columns, so a permissive anon SELECT policy would
-- leak the full snapshot. Do NOT add one; use an RPC instead.

create index if not exists annual_reviews_biz_year_idx
  on annual_reviews (business_id, tax_year, filed_at desc);

create index if not exists annual_reviews_hash_idx
  on annual_reviews (hash);

-- Enforce snapshot / identity immutability at the DB layer. Overrides,
-- ratings, plan, exec_summary_override, tone_mode all remain editable so
-- the user can polish the narrative after filing without losing the
-- snapshot's audit value.
create or replace function annual_reviews_lock_snapshot()
returns trigger
language plpgsql
as $$
begin
  if new.snapshot_jsonb is distinct from old.snapshot_jsonb then
    raise exception 'annual_reviews.snapshot_jsonb is immutable';
  end if;
  if new.business_id is distinct from old.business_id then
    raise exception 'annual_reviews.business_id is immutable';
  end if;
  if new.tax_year is distinct from old.tax_year then
    raise exception 'annual_reviews.tax_year is immutable';
  end if;
  if new.hash is distinct from old.hash then
    raise exception 'annual_reviews.hash is immutable';
  end if;
  if new.filed_at is distinct from old.filed_at then
    raise exception 'annual_reviews.filed_at is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists annual_reviews_lock_snapshot_trg on annual_reviews;
create trigger annual_reviews_lock_snapshot_trg
  before update on annual_reviews
  for each row execute function annual_reviews_lock_snapshot();
