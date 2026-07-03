-- 087_fix_customer_limit_lite_30.sql
-- Security audit (Tier 0, item 0.10 — plan caps enforced server-side).
--
-- enforce_free_customer_limit had three problems:
--   1. Enforced 50, not the intended Lite cap of 30.
--   2. Checked `plan is distinct from 'pro'`, so Max users (plan = 'max')
--      were wrongly capped at 50 — Max is meant to be unlimited.
--   3. Read the legacy `plan` column instead of canonical `subscription_tier`.
--
-- Fix: treat pro AND max as unlimited, read subscription_tier (falling back to
-- legacy plan for safety), and cap Lite at 30. subscription_tier is written only
-- by the signature-verified Stripe webhook and is tamper-protected by
-- enforce_profile_protected_columns, so it is a trustworthy server-side source.
-- Keep the 30 in sync with FREE_CUSTOMER_LIMIT / LITE_LIMITS on the client.

create or replace function public.enforce_free_customer_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tier        text;
  v_plan        text;
  v_paid        boolean;
  active_count  int;
begin
  -- Only enforce for active/at-risk customers (archived don't count).
  if NEW.status = 'archived' then
    return NEW;
  end if;

  select subscription_tier, plan
    into v_tier, v_plan
    from public.profiles
   where id = NEW.owner_id;

  v_paid := (v_tier in ('pro', 'max')) or (v_plan in ('pro', 'max'));

  if not v_paid then
    select count(*)
      into active_count
      from public.customers
     where owner_id = NEW.owner_id
       and status <> 'archived';

    if active_count >= 30 then
      raise exception 'Lite plan is limited to 30 active customers. Upgrade to Pro to add more.';
    end if;
  end if;

  return NEW;
end;
$function$;
