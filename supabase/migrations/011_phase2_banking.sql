-- 011_phase2_banking.sql
-- Phase 2: Open Banking (TrueLayer), Financial Walkthrough, Weekly Cadi Reports
--
-- Lifts TrueLayer tokens out of profiles.tl_* into a proper bank_connections table.
-- Adds transactions (richer than bank_transactions), walkthroughs, walkthrough_analysis,
-- and weekly_reports tables.
-- Seeds Phase 2 onboarding steps for businesses that have already completed Phase 1.

-- ── bank_connections ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bank_connections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  provider                text        NOT NULL DEFAULT 'truelayer',

  -- TrueLayer identifiers
  truelayer_connection_id text,
  truelayer_account_id    text,

  -- Display metadata (filled after first sync)
  bank_name               text,
  account_name            text,
  account_last_4          text,
  account_type            text        NOT NULL DEFAULT 'business',

  -- OAuth tokens (protected by RLS + no plaintext exposure outside service role)
  access_token            text,
  refresh_token           text,
  token_expires_at        timestamptz,

  -- Connection state
  is_active               boolean     NOT NULL DEFAULT true,
  connected_at            timestamptz NOT NULL DEFAULT now(),
  disconnected_at         timestamptz,
  last_sync_at            timestamptz,
  sync_error              text,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY bank_connections_owner_all ON public.bank_connections
  FOR ALL
  USING  (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE TRIGGER bank_connections_updated_at
  BEFORE UPDATE ON public.bank_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migrate existing profiles.tl_* data into bank_connections (if any)
INSERT INTO public.bank_connections (business_id, provider, access_token, refresh_token, connected_at, is_active)
SELECT
  b.id        AS business_id,
  'truelayer' AS provider,
  p.tl_access_token,
  p.tl_refresh_token,
  p.tl_connected_at,
  true
FROM public.profiles p
JOIN public.businesses b ON b.owner_user_id = p.id
WHERE p.tl_access_token IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_connections bc WHERE bc.business_id = b.id
  );

-- ── transactions ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactions (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  bank_connection_id          uuid        REFERENCES public.bank_connections(id) ON DELETE SET NULL,

  truelayer_transaction_id    text,

  transaction_date            date        NOT NULL,
  amount                      numeric     NOT NULL,  -- positive = credit, negative = debit
  currency                    text        NOT NULL DEFAULT 'GBP',
  description                 text,
  merchant_name               text,

  -- Cadi categorisation
  category                    text,
  subcategory                 text,
  categorisation_confidence   numeric,
  categorised_by              text,       -- 'truelayer' | 'cadi_ai' | 'user'

  -- Reconciliation against invoices
  matched_invoice_id          uuid        REFERENCES public.invoices(id) ON DELETE SET NULL,
  matched_customer_id         uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  reconciliation_confidence   numeric,

  -- User flags
  is_business                 boolean,
  user_note                   text,
  is_hidden                   boolean     NOT NULL DEFAULT false,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (truelayer_transaction_id) -- globally unique per TrueLayer
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY transactions_owner_all ON public.transactions
  FOR ALL
  USING  (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX transactions_business_date_idx     ON public.transactions (business_id, transaction_date DESC);
CREATE INDEX transactions_business_category_idx ON public.transactions (business_id, category);

-- ── walkthroughs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.walkthroughs (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  type                    text        NOT NULL DEFAULT 'first_time', -- 'first_time' | 'monthly_repeat'

  started_at              timestamptz NOT NULL DEFAULT now(),
  completed_at            timestamptz,
  current_screen          integer     NOT NULL DEFAULT 0,  -- 0 = intro, 1-5 = screens, 6 = closing

  user_responses          jsonb       NOT NULL DEFAULT '{}',
  chosen_focus_area       text,
  chosen_focus_area_data  jsonb,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.walkthroughs ENABLE ROW LEVEL SECURITY;

CREATE POLICY walkthroughs_owner_all ON public.walkthroughs
  FOR ALL
  USING  (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE TRIGGER walkthroughs_updated_at
  BEFORE UPDATE ON public.walkthroughs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── walkthrough_analysis ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.walkthrough_analysis (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  walkthrough_id          uuid        REFERENCES public.walkthroughs(id) ON DELETE SET NULL,

  period_start_date       date        NOT NULL,
  period_end_date         date        NOT NULL,

  -- Pre-computed JSON per screen
  money_in_data           jsonb,
  money_out_data          jsonb,
  holes_data              jsonb,
  health_data             jsonb,

  -- Cadi-generated interpretive content
  wins                    jsonb,           -- [{ title, body, category }]
  watch_outs              jsonb,           -- [{ title, body, severity, category }]
  suggested_focus_areas   jsonb,           -- [{ title, body, estimated_saving }]

  generated_at            timestamptz NOT NULL DEFAULT now(),

  -- Only one pending analysis per business at a time
  UNIQUE (business_id, period_end_date)
);

ALTER TABLE public.walkthrough_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY walkthrough_analysis_owner_all ON public.walkthrough_analysis
  FOR ALL
  USING  (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

-- ── weekly_reports ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,

  week_starting           date        NOT NULL,
  week_ending             date        NOT NULL,
  generated_at            timestamptz NOT NULL DEFAULT now(),

  metrics_snapshot        jsonb,
  previous_week_metrics   jsonb,
  focus_area_at_time      text,

  -- Generated sections
  headline                text,
  numbers_section         text,
  focus_section           text,
  notes_section           text,
  suggestion_section      text,

  -- Delivery state
  delivered_in_app        boolean     NOT NULL DEFAULT false,
  delivered_in_app_at     timestamptz,
  delivered_email         boolean     NOT NULL DEFAULT false,
  delivered_email_at      timestamptz,
  email_opened            boolean     NOT NULL DEFAULT false,
  email_opened_at         timestamptz,

  -- User interaction
  viewed_at               timestamptz,
  user_reaction           text,         -- 'helpful' | 'not_relevant'
  user_note               text,

  created_at              timestamptz NOT NULL DEFAULT now(),

  UNIQUE (business_id, week_starting)
);

ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY weekly_reports_owner_all ON public.weekly_reports
  FOR ALL
  USING  (business_id = my_business_id())
  WITH CHECK (business_id = my_business_id());

CREATE INDEX weekly_reports_business_week_idx ON public.weekly_reports (business_id, week_starting DESC);

-- ── initialise_phase2_plan() ──────────────────────────────────────────────────
-- Called when Phase 1 completes (or manually to seed existing businesses).

CREATE OR REPLACE FUNCTION public.initialise_phase2_plan(p_business_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.onboarding_steps (business_id, phase, step_key, status)
  VALUES
    (p_business_id, 2, 'connect_open_banking',  'available'),
    (p_business_id, 2, 'financial_walkthrough',  'available'),
    (p_business_id, 2, 'first_weekly_report',    'available')
  ON CONFLICT (business_id, phase, step_key) DO NOTHING;
END;
$$;

-- ── Seed Phase 2 steps for businesses that have already completed Phase 1 ─────

SELECT public.initialise_phase2_plan(op.business_id)
FROM public.onboarding_progress op
WHERE op.phase_1_completed_at IS NOT NULL;

-- Mark connect_open_banking completed for anyone already connected
UPDATE public.onboarding_steps
SET status       = 'completed',
    completed_at = bc.connected_at
FROM public.bank_connections bc
WHERE onboarding_steps.business_id = bc.business_id
  AND onboarding_steps.phase       = 2
  AND onboarding_steps.step_key    = 'connect_open_banking'
  AND bc.is_active                 = true
  AND bc.last_sync_at              IS NOT NULL
  AND onboarding_steps.status     <> 'completed';
