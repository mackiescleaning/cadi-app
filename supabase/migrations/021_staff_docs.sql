-- Migration 021: Staff document storage
--
-- Adds rtw_doc_path + dbs_doc_path to team_members (Supabase Storage paths).
-- Creates the private 'staff-docs' bucket and owner-scoped RLS policies.
-- Path structure: {owner_uid}/{staff_id}/rtw/{filename}
--                  {owner_uid}/{staff_id}/dbs/{filename}
-- Safe to re-run.

begin;

-- 1. Document path columns on team_members
alter table public.team_members
  add column if not exists rtw_doc_path text,
  add column if not exists dbs_doc_path text;

-- 2. Storage bucket (private, 10 MB limit, images + PDF only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-docs',
  'staff-docs',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do nothing;

-- 3. Storage RLS: owners can only access their own uid-prefixed folder
do $$ begin

  drop policy if exists "staff_docs_owner_select" on storage.objects;
  create policy "staff_docs_owner_select" on storage.objects
    for select using (
      bucket_id = 'staff-docs'
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  drop policy if exists "staff_docs_owner_insert" on storage.objects;
  create policy "staff_docs_owner_insert" on storage.objects
    for insert with check (
      bucket_id = 'staff-docs'
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  drop policy if exists "staff_docs_owner_update" on storage.objects;
  create policy "staff_docs_owner_update" on storage.objects
    for update using (
      bucket_id = 'staff-docs'
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  drop policy if exists "staff_docs_owner_delete" on storage.objects;
  create policy "staff_docs_owner_delete" on storage.objects
    for delete using (
      bucket_id = 'staff-docs'
      and auth.uid()::text = (storage.foldername(name))[1]
    );

end $$;

commit;
