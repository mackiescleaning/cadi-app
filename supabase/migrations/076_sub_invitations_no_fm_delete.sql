-- 076_sub_invitations_no_fm_delete.sql
--
-- Audit follow-up. The sub_invites_fm_all policy was FOR ALL, meaning
-- any FM org member (not just admins) could DELETE every sub invite in
-- their org. Legitimate "cancel this invite" flows already go through
-- UPDATE (status change to revoked/expired), so DELETE has no product
-- reason to be exposed to regular FM users.
--
-- Split into explicit SELECT / INSERT / UPDATE for FM org members, with
-- DELETE restricted to Cadi admins only (rare escalation path).

drop policy if exists sub_invites_fm_all on public.sub_invitations;

drop policy if exists sub_invites_fm_select on public.sub_invitations;
create policy sub_invites_fm_select on public.sub_invitations
  for select using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists sub_invites_fm_insert on public.sub_invitations;
create policy sub_invites_fm_insert on public.sub_invitations
  for insert with check (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists sub_invites_fm_update on public.sub_invitations;
create policy sub_invites_fm_update on public.sub_invitations
  for update using (
    fm_organisation_id = (
      select fm_organisation_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists sub_invites_admin_delete on public.sub_invitations;
create policy sub_invites_admin_delete on public.sub_invitations
  for delete using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_cadi_admin = true
    )
  );
