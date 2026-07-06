-- 090_staff_pin_per_member.sql
-- Scale the staff PIN login: validate against ONE identified member instead of
-- matching the PIN against every staff member of the business.
--
-- Why: with the old validate_staff_pin(token, pin), a submitted PIN was checked
-- against ALL active staff. At enterprise scale (e.g. 1500 staff, 10k 4-digit
-- PIN space) a random guess likely matches someone (birthday problem), and the
-- lockout lived on business_settings — so 5 wrong PINs locked out the WHOLE
-- business. This adds validate_staff_pin(token, member_id, pin): the caller
-- (staff-auth, after the staff picks their name) validates the PIN against that
-- single member, with PER-MEMBER lockout using the team_members.pin_failed_*
-- columns. The old 2-arg overload is left in place until staff-auth is
-- redeployed, then can be dropped.

-- Fast roster fetch / search for large teams.
create index if not exists idx_team_members_roster
  on public.team_members (business_id, is_active);

create or replace function public.validate_staff_pin(p_token text, p_member_id uuid, p_pin text)
returns table (
  id uuid, name text, role text, hourly_rate numeric,
  owner_id uuid, locked boolean, locked_until timestamptz
)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_owner   uuid;
  v_member  team_members%rowtype;
  v_now     timestamptz := now();
  v_thresh  int         := 5;
  v_window  interval    := interval '15 minutes';
begin
  -- token → business owner
  select bs.owner_id into v_owner
    from business_settings bs
   where bs.staff_login_token = p_token;
  if v_owner is null then
    return;  -- invalid token → empty (caller treats as "invalid")
  end if;

  -- resolve the ONE member, scoped to this business + active
  select * into v_member
    from team_members tm
   where tm.id = p_member_id
     and tm.business_id = v_owner
     and tm.is_active = true;
  if not found then
    return;  -- unknown/foreign member → empty (don't distinguish from wrong PIN)
  end if;

  -- per-member lockout
  if v_member.pin_locked_until is not null and v_member.pin_locked_until > v_now then
    locked := true;
    locked_until := v_member.pin_locked_until;
    return next;
    return;
  end if;

  -- validate PIN against THIS member only
  if v_member.pin_hash_bcrypt is null
     or extensions.crypt(p_pin, v_member.pin_hash_bcrypt) <> v_member.pin_hash_bcrypt
  then
    update team_members tm
       set pin_failed_attempts = coalesce(tm.pin_failed_attempts, 0) + 1,
           pin_locked_until = case
             when coalesce(tm.pin_failed_attempts, 0) + 1 >= v_thresh
             then v_now + v_window
             else tm.pin_locked_until
           end
     where tm.id = v_member.id;
    return;  -- wrong PIN → empty
  end if;

  -- success: reset the per-member counters
  update team_members tm
     set pin_failed_attempts = 0, pin_locked_until = null
   where tm.id = v_member.id;

  id           := v_member.id;
  name         := coalesce(nullif(trim(coalesce(v_member.first_name,'') || ' ' || coalesce(v_member.last_name,'')), ''), 'Unnamed');
  role         := v_member.role;
  hourly_rate  := v_member.hourly_rate;
  owner_id     := v_owner;
  locked       := false;
  locked_until := null;
  return next;
end;
$function$;

revoke execute on function public.validate_staff_pin(text, uuid, text) from public, anon, authenticated;
