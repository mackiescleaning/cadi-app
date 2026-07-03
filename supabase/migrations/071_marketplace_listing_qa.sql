-- 071_marketplace_listing_qa.sql
--
-- Public Q&A thread on every marketplace listing. Bidders (subs) post
-- questions, the FM answers, and every other bidder benefits. Same UX
-- pattern as job_messages but scoped to marketplace_listings.
--
-- author_role — sub | fm — drives display (subs render anonymously to
-- peers; FM sees the author's name).
--
-- Insert rules aren't fully enforceable at RLS level because we need to
-- check the parent listing's status (must be open|bidding). That check
-- lives in the connect-listing-question edge function; RLS here handles
-- read visibility + prevents cross-role posting.

create table if not exists public.marketplace_listing_qa (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.marketplace_listings(id) on delete cascade,
  author_id     uuid not null references auth.users(id) on delete cascade,
  author_role   text not null check (author_role in ('sub','fm')),
  body          text not null check (length(body) between 1 and 2000),
  parent_id     uuid references public.marketplace_listing_qa(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create index if not exists idx_listing_qa_listing_created
  on public.marketplace_listing_qa (listing_id, created_at);

alter table public.marketplace_listing_qa enable row level security;

-- Read: anyone who can SEE the parent listing can read its Q&A. The
-- marketplace_listings SELECT policy already handles tier / connect
-- unlock checks, so we defer to it via an EXISTS.
drop policy if exists listing_qa_select on public.marketplace_listing_qa;
create policy listing_qa_select on public.marketplace_listing_qa
  for select using (
    exists (
      select 1 from public.marketplace_listings ml
      where ml.id = marketplace_listing_qa.listing_id
    )
  );

-- Sub insert: authored by self, role='sub', and (defensively) the caller
-- isn't the FM org that owns the listing. Listing-status gate is server-
-- side (edge function).
drop policy if exists listing_qa_sub_insert on public.marketplace_listing_qa;
create policy listing_qa_sub_insert on public.marketplace_listing_qa
  for insert with check (
    author_id = auth.uid()
    and author_role = 'sub'
    and not exists (
      select 1
      from public.marketplace_listings ml
      join public.profiles p on p.fm_organisation_id = ml.fm_organisation_id
      where ml.id = marketplace_listing_qa.listing_id
        and p.id = auth.uid()
    )
  );

-- FM insert: authored by self, role='fm', and the caller belongs to the
-- listing's FM org.
drop policy if exists listing_qa_fm_insert on public.marketplace_listing_qa;
create policy listing_qa_fm_insert on public.marketplace_listing_qa
  for insert with check (
    author_id = auth.uid()
    and author_role = 'fm'
    and exists (
      select 1
      from public.marketplace_listings ml
      join public.profiles p on p.fm_organisation_id = ml.fm_organisation_id
      where ml.id = marketplace_listing_qa.listing_id
        and p.id = auth.uid()
    )
  );
