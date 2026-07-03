-- 084_leaderboard_authenticated_read.sql
-- Security audit (Tier 0, item 0.2): the leaderboard SELECT policy was
-- `using (true)` for role `public`, so the anon key (shipped in the client
-- bundle) could enumerate every business's name, region, sector and score.
-- Cross-tenant visibility is intentional for a leaderboard, but only for
-- signed-in users. Restrict the open read to the `authenticated` role.

drop policy if exists leaderboard_select_all on public.leaderboard_entries;

create policy leaderboard_select_all
  on public.leaderboard_entries
  for select
  to authenticated
  using (true);
