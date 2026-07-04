-- 088_deletion_fk_set_null.sql
-- Security audit (Tier 1.2 — account deletion / erasure).
--
-- Five FKs to auth.users used ON DELETE NO ACTION. For a solo owner the
-- referencing rows cascade away via other paths (business_id / owner_id), so
-- deletion works. But for a Connect/FM user referenced from ANOTHER business's
-- rows (e.g. named as the cleaner on someone else's review, or approver of an
-- agent action in another org), NO ACTION would raise an FK violation and make
-- auth.admin.deleteUser() fail — the user could not exercise their right to
-- erasure. These are "who did X" actor references, so SET NULL (anonymise the
-- reference) is the correct action and matches the pattern already used on
-- jobs.sub_user_id, account_members.member_user_id, etc.

alter table public.agent_actions
  drop constraint agent_actions_approved_by_user_id_fkey,
  add  constraint agent_actions_approved_by_user_id_fkey
    foreign key (approved_by_user_id) references auth.users(id) on delete set null;

alter table public.customers
  drop constraint customers_preferred_cleaner_user_id_fkey,
  add  constraint customers_preferred_cleaner_user_id_fkey
    foreign key (preferred_cleaner_user_id) references auth.users(id) on delete set null;

alter table public.reviews
  drop constraint reviews_cleaner_named_user_id_fkey,
  add  constraint reviews_cleaner_named_user_id_fkey
    foreign key (cleaner_named_user_id) references auth.users(id) on delete set null;

alter table public.site_surveys
  drop constraint site_surveys_created_by_fkey,
  add  constraint site_surveys_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table public.onboarding_packs
  drop constraint onboarding_packs_signed_off_by_fkey,
  add  constraint onboarding_packs_signed_off_by_fkey
    foreign key (signed_off_by) references auth.users(id) on delete set null;
