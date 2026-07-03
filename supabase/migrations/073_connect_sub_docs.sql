-- 073_connect_sub_docs.sql
--
-- Cadi Connect compliance documents. Cleaning subs upload their
-- insurance certs, DBS check, company registration etc. FMs can see
-- what's on file + expiry status before awarding work.
--
-- Storage bucket 'connect-sub-docs' holds the files. RLS: sub RW their
-- own; FM reads for any sub connected to their org (via jobs history or
-- profile.connect_unlocked_by_fm_id).

create table if not exists public.connect_sub_docs (
  id            uuid primary key default gen_random_uuid(),
  sub_user_id   uuid not null references public.profiles(id) on delete cascade,
  doc_type      text not null,
  file_path     text not null,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  issued_date   date,
  expiry_date   date,
  provider      text,
  policy_number text,
  notes         text,
  verified_by_cadi boolean not null default false,
  verified_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint connect_sub_docs_type_check check (doc_type in (
    'public_liability',
    'employers_liability',
    'dbs_basic',
    'dbs_enhanced',
    'company_reg',
    'vat_reg',
    'ico_reg',
    'hs_policy',
    'method_statement',
    'other'
  )),
  -- One row per (sub, doc_type). New upload replaces the previous file
  -- for that type; history lives in audit_log.
  unique (sub_user_id, doc_type)
);

create index if not exists idx_sub_docs_sub on public.connect_sub_docs (sub_user_id);
create index if not exists idx_sub_docs_expiry on public.connect_sub_docs (expiry_date) where expiry_date is not null;

alter table public.connect_sub_docs enable row level security;

-- Sub RW their own docs
drop policy if exists sub_docs_sub_select on public.connect_sub_docs;
create policy sub_docs_sub_select on public.connect_sub_docs
  for select using (sub_user_id = auth.uid());

drop policy if exists sub_docs_sub_insert on public.connect_sub_docs;
create policy sub_docs_sub_insert on public.connect_sub_docs
  for insert with check (sub_user_id = auth.uid());

drop policy if exists sub_docs_sub_update on public.connect_sub_docs;
create policy sub_docs_sub_update on public.connect_sub_docs
  for update using (sub_user_id = auth.uid());

drop policy if exists sub_docs_sub_delete on public.connect_sub_docs;
create policy sub_docs_sub_delete on public.connect_sub_docs
  for delete using (sub_user_id = auth.uid());

-- FM can read docs of subs connected to their org — either via job history
-- or their initial connect_unlocked_by_fm_id assignment. This mirrors how
-- the FM already sees profile basics through the marketplace.
drop policy if exists sub_docs_fm_select on public.connect_sub_docs;
create policy sub_docs_fm_select on public.connect_sub_docs
  for select using (
    exists (
      select 1
      from public.profiles caller
      where caller.id = auth.uid()
        and caller.fm_organisation_id is not null
        and (
          -- sub is unlocked to the caller's FM directly
          exists (
            select 1 from public.profiles sub
            where sub.id = connect_sub_docs.sub_user_id
              and sub.connect_unlocked_by_fm_id = caller.fm_organisation_id
          )
          -- OR the caller's FM has awarded them jobs
          or exists (
            select 1 from public.jobs j
            where j.sub_user_id = connect_sub_docs.sub_user_id
              and j.fm_organisation_id = caller.fm_organisation_id
              and j.deleted_at is null
          )
          -- OR they have an active visit_spec together
          or exists (
            select 1 from public.visit_specs vs
            where vs.assigned_sub_user_id = connect_sub_docs.sub_user_id
              and vs.fm_organisation_id = caller.fm_organisation_id
              and vs.deleted_at is null
          )
        )
    )
  );

-- ── Storage bucket ──────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('connect-sub-docs', 'connect-sub-docs', false, 10485760)  -- 10MB
on conflict (id) do nothing;

-- Bucket policies: file paths are {sub_user_id}/{doc_type}-{ts}.{ext}
-- so split_part on '/' extracts the owner.
drop policy if exists connect_sub_docs_sub_read on storage.objects;
create policy connect_sub_docs_sub_read on storage.objects
  for select using (
    bucket_id = 'connect-sub-docs'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

drop policy if exists connect_sub_docs_sub_upload on storage.objects;
create policy connect_sub_docs_sub_upload on storage.objects
  for insert with check (
    bucket_id = 'connect-sub-docs'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

drop policy if exists connect_sub_docs_sub_delete on storage.objects;
create policy connect_sub_docs_sub_delete on storage.objects
  for delete using (
    bucket_id = 'connect-sub-docs'
    and (split_part(name, '/', 1))::uuid = auth.uid()
  );

drop policy if exists connect_sub_docs_fm_read on storage.objects;
create policy connect_sub_docs_fm_read on storage.objects
  for select using (
    bucket_id = 'connect-sub-docs'
    and exists (
      select 1
      from public.profiles caller
      where caller.id = auth.uid()
        and caller.fm_organisation_id is not null
        and (
          exists (
            select 1 from public.profiles sub
            where sub.id = (split_part(storage.objects.name, '/', 1))::uuid
              and sub.connect_unlocked_by_fm_id = caller.fm_organisation_id
          )
          or exists (
            select 1 from public.jobs j
            where j.sub_user_id = (split_part(storage.objects.name, '/', 1))::uuid
              and j.fm_organisation_id = caller.fm_organisation_id
              and j.deleted_at is null
          )
          or exists (
            select 1 from public.visit_specs vs
            where vs.assigned_sub_user_id = (split_part(storage.objects.name, '/', 1))::uuid
              and vs.fm_organisation_id = caller.fm_organisation_id
              and vs.deleted_at is null
          )
        )
    )
  );
