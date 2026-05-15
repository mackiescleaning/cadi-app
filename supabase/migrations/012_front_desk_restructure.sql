-- 012_front_desk_restructure.sql
-- Front Desk naming migration:
--   "Front Desk" agent (inquiry handler) → "Sales Manager"
--   "AI Inbox" concept → "Front Desk" (the hub)
--   "Reviews" agent display name → "Review Agent"
--   Add 'operations_manager' as a valid agent value
--
-- No table renames needed — agent_actions and agent_settings use a plain
-- text 'agent' column with no enum constraint, so this is just data updates.

-- 1. Rename 'front_desk' → 'sales_manager' in agent_actions
UPDATE public.agent_actions
  SET agent = 'sales_manager'
  WHERE agent = 'front_desk';

-- 2. Rename 'front_desk' → 'sales_manager' in agent_settings
-- (uses primary key business_id + agent, so we insert/delete)
INSERT INTO public.agent_settings (business_id, agent, mode, config)
  SELECT business_id, 'sales_manager', mode, config
  FROM public.agent_settings
  WHERE agent = 'front_desk'
ON CONFLICT (business_id, agent) DO UPDATE
  SET mode   = EXCLUDED.mode,
      config = EXCLUDED.config;

DELETE FROM public.agent_settings WHERE agent = 'front_desk';

-- 3. Update messages.source CHECK constraint to include new agent names
--    (removes old agent_front_desk, adds agent_sales_manager)
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_source_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_source_check
  CHECK (source IN (
    'owner', 'crew', 'customer',
    'agent_sales_manager',
    'agent_review_agent',
    'agent_operations_manager',
    'agent_quoter', 'agent_re_booker',
    'system',
    -- keep legacy values so old rows aren't invalidated
    'agent_front_desk', 'agent_reviews'
  ));

-- 4. Add 'updated_at' to agent_actions for future updates (if missing)
ALTER TABLE public.agent_actions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;
