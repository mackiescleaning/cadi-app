-- 097_seed_business_accounts.sql
-- Accounts foundation (P1) — seed every business with the default tax profile, chart of
-- accounts, and Starling bank-category rules. Idempotent (on conflict do nothing) so the
-- new-business trigger and the one-time backfill are both safe. Defaults are derived from
-- the previous hardcoded EXPENSE_CATS + BANK_CATEGORY_MAP, so behaviour is identical on
-- day one — this migration is invisible to users. See ACCOUNTS_FOUNDATION_SPEC.md.

create or replace function public.seed_business_accounts(p_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Tax profile (default sole trader; onboarding/settings refine it)
  insert into public.business_tax_profile (business_id)
  values (p_business_id)
  on conflict (business_id) do nothing;

  -- 2. Chart of accounts
  insert into public.chart_of_accounts
    (business_id, key, label, emoji, color, lane, is_allowable, vat_treatment, sort_order, is_system)
  values
    (p_business_id, 'income_customer', 'Customer payment',  '💰', '#34d399', 'income',   null,  'standard',      10,  true),
    (p_business_id, 'income_other',    'Other income',       '💰', '#34d399', 'income',   null,  'standard',      20,  true),
    (p_business_id, 'directors_wages', 'Directors wages',    '💼', '#6366f1', 'expense',  true,  'outside_scope', 30,  true),
    (p_business_id, 'staff',           'Staff costs',        '👥', '#ec4899', 'expense',  true,  'outside_scope', 40,  true),
    (p_business_id, 'vehicle',         'Vehicle',            '🚐', '#06b6d4', 'expense',  true,  'standard',      50,  true),
    (p_business_id, 'fuel',            'Fuel & travel',      '⛽', '#f59e0b', 'expense',  true,  'standard',      60,  true),
    (p_business_id, 'equipment',       'Equipment',          '🔧', '#8b5cf6', 'expense',  true,  'standard',      70,  true),
    (p_business_id, 'supplies',        'Supplies',           '🧴', '#3b82f6', 'expense',  true,  'standard',      80,  true),
    (p_business_id, 'insurance',       'Insurance',          '🛡️', '#10b981', 'expense',  true,  'exempt',        90,  true),
    (p_business_id, 'marketing',       'Marketing',          '📣', '#f43f5e', 'expense',  true,  'standard',      100, true),
    (p_business_id, 'phone',           'Phone & internet',   '📱', '#0ea5e9', 'expense',  true,  'standard',      110, true),
    (p_business_id, 'premises',        'Premises',           '🏢', '#14b8a6', 'expense',  true,  'standard',      120, true),
    (p_business_id, 'professional',    'Professional fees',  '⚖️', '#7c3aed', 'expense',  true,  'standard',      130, true),
    (p_business_id, 'subscriptions',   'Subscriptions',      '💳', '#a855f7', 'expense',  true,  'standard',      140, true),
    (p_business_id, 'training',        'Training',           '🎓', '#22c55e', 'expense',  true,  'standard',      150, true),
    (p_business_id, 'uniform',         'Uniform & PPE',      '🧤', '#fb7185', 'expense',  true,  'standard',      160, true),
    (p_business_id, 'bankfees',        'Bank & finance',     '🏦', '#94a3b8', 'expense',  true,  'exempt',        170, true),
    (p_business_id, 'other',           'Other',              '📦', '#6b7280', 'expense',  true,  'standard',      180, true),
    (p_business_id, 'personal',        'Personal',           '🏠', '#f6b23c', 'personal', false, 'outside_scope', 900, true),
    (p_business_id, 'transfer',        'Transfer',           '↔', '#8695b4', 'transfer', null,  'outside_scope', 950, true)
  on conflict (business_id, key) do nothing;

  -- 3. Starling bank-category rules (income_customer is assigned by invoice matching, not here)
  insert into public.bank_category_rules (business_id, source, bank_category, chart_key)
  values
    (p_business_id, 'starling', 'REVENUE',                    'income_other'),
    (p_business_id, 'starling', 'TRANSFERS',                  'transfer'),
    (p_business_id, 'starling', 'PERSONAL',                   'personal'),
    (p_business_id, 'starling', 'DIRECTORS_WAGES',            'directors_wages'),
    (p_business_id, 'starling', 'STAFF',                      'staff'),
    (p_business_id, 'starling', 'VEHICLES',                   'vehicle'),
    (p_business_id, 'starling', 'TRAVEL',                     'fuel'),
    (p_business_id, 'starling', 'EQUIPMENT',                  'equipment'),
    (p_business_id, 'starling', 'REPAIRS_AND_MAINTENANCE',    'equipment'),
    (p_business_id, 'starling', 'PHONE_AND_INTERNET',         'phone'),
    (p_business_id, 'starling', 'WORKPLACE',                  'premises'),
    (p_business_id, 'starling', 'PROFESSIONAL_SERVICES',      'professional'),
    (p_business_id, 'starling', 'SOFTWARE_AND_SUBSCRIPTIONS', 'subscriptions'),
    (p_business_id, 'starling', 'PLATFORM_FEES',              'subscriptions'),
    (p_business_id, 'starling', 'MARKETING',                  'marketing'),
    (p_business_id, 'starling', 'FOOD_AND_DRINK',             'personal'),
    (p_business_id, 'starling', 'BUSINESS_ENTERTAINMENT',     'other'),
    (p_business_id, 'starling', 'EMPLOYEE_ENTERTAINING',      'staff'),
    (p_business_id, 'starling', 'ADMIN',                      'other'),
    (p_business_id, 'starling', 'LOAN_PRINCIPAL',             'other'),
    (p_business_id, 'starling', 'CLIENT_REFUNDS',             'other'),
    (p_business_id, 'starling', 'OTHER',                      'other')
  on conflict (business_id, source, bank_category) do nothing;
end;
$$;

-- New-business trigger: seed accounts whenever a businesses row is created.
create or replace function public.handle_new_business_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_business_accounts(new.id);
  return new;
end;
$$;

drop trigger if exists on_business_created_seed_accounts on public.businesses;
create trigger on_business_created_seed_accounts
  after insert on public.businesses
  for each row execute function public.handle_new_business_accounts();

-- One-time backfill for existing businesses.
do $$
declare b record;
begin
  for b in select id from public.businesses loop
    perform public.seed_business_accounts(b.id);
  end loop;
end $$;
