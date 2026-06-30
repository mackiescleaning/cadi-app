-- 062_profiles_fm_can_read_connect_subs.sql
--
-- Problem: profiles RLS only allows users to read their own row
-- (`id = auth.uid()`). The FM Ops Portal needs to display subs'
-- profile details — name, region, tier, score, trades — in:
--   • /fm-ops/contractors (listFmContractors)
--   • /fm-ops/contracts/new Step 2 — the allocation picker (listFmActiveSubs)
--   • /fm-ops/marketplace listing detail — bidder names & fit scores
--
-- Without an additional SELECT policy, every cross-profile query for an
-- FM caller returns zero rows even when sub_invitations links them.
--
-- The new policy is narrowly scoped: an FM-org user can SELECT a profile
-- only when that profile's connect_unlocked_by_fm_id matches the FM
-- org of the caller. This is the same FM-to-sub link set when a sub
-- accepts an invitation, so it's the right signal for "this sub is in
-- our network".
--
-- Privacy note: RLS is row-level, not column-level. The FM gets all
-- columns of the visible profile rows including stripe_customer_id,
-- hmrc tokens, NINO etc. The client-side code only requests the
-- Connect-relevant subset, but a sophisticated FM could query more
-- via the REST API. Follow-up: replace with a security-definer RPC
-- that returns only the safe columns. Tracked as a hardening item.

create policy profiles_fm_can_read_connect_subs on public.profiles
  for select
  using (
    connect_unlocked_by_fm_id = (
      select fm_organisation_id from public.profiles
      where id = auth.uid()
    )
  );
