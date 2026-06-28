-- 057_fm_ops_write_policies.sql
--
-- The FM Ops Portal needs to insert/update end_clients + sites client-side
-- when an FM creates a new contract (Upload step writes an end_client +
-- one site per uploaded row). Until now both tables only had SELECT policies
-- for FM-org members; writes silently failed under RLS.
--
-- This adds INSERT/UPDATE policies scoped the same way as the existing
-- SELECT policies. Soft-delete via deleted_at; no DELETE policy.
--
-- Cross-checked against 053_connect_foundation.sql which already grants
-- ALL on contracts / visit_specs / marketplace_listings / marketplace_bids
-- for FM-org members, so this brings end_clients + sites in line.

-- ─── end_clients ─────────────────────────────────────────────────────────
drop policy if exists end_clients_fm_insert on public.end_clients;
create policy end_clients_fm_insert on public.end_clients
  for insert with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

drop policy if exists end_clients_fm_update on public.end_clients;
create policy end_clients_fm_update on public.end_clients
  for update using (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  ) with check (
    fm_organisation_id = (select fm_organisation_id from public.profiles where id = auth.uid())
  );

-- ─── sites ───────────────────────────────────────────────────────────────
-- Sites are scoped through end_clients.fm_organisation_id (sites itself has
-- no fm_organisation_id column).
drop policy if exists sites_fm_insert on public.sites;
create policy sites_fm_insert on public.sites
  for insert with check (
    end_client_id in (
      select ec.id
      from public.end_clients ec
      join public.profiles p on p.fm_organisation_id = ec.fm_organisation_id
      where p.id = auth.uid()
    )
  );

drop policy if exists sites_fm_update on public.sites;
create policy sites_fm_update on public.sites
  for update using (
    end_client_id in (
      select ec.id
      from public.end_clients ec
      join public.profiles p on p.fm_organisation_id = ec.fm_organisation_id
      where p.id = auth.uid()
    )
  ) with check (
    end_client_id in (
      select ec.id
      from public.end_clients ec
      join public.profiles p on p.fm_organisation_id = ec.fm_organisation_id
      where p.id = auth.uid()
    )
  );
