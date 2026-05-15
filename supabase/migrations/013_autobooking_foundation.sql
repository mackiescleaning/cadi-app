-- Operations Manager foundation
-- Adds autobooking, team members, check-in, and payment pattern tables
-- Also extends the jobs table with completion confidence tracking

-- ─────────────────────────────────────────────
-- 1. Extend jobs table
-- ─────────────────────────────────────────────

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS completion_confidence numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS completion_method text,
  ADD COLUMN IF NOT EXISTS completion_marked_at timestamptz,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes integer;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_completion_method_check
  CHECK (completion_method IN (
    'staff_checkin','payment_matched','recurring_renewal',
    'review_received','no_exceptions','manual','auto_timeout'
  ));

-- Expand status CHECK to include pending_confirmation
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN (
    'scheduled','in_progress','completed','cancelled',
    'pending_confirmation','no_show','rescheduled'
  ));

-- ─────────────────────────────────────────────
-- 2. team_members
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_members (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  first_name              text NOT NULL,
  last_name               text,
  phone                   text,
  email                   text,
  role                    text NOT NULL DEFAULT 'cleaner'
                          CHECK (role IN ('cleaner','supervisor','manager')),
  is_active               boolean NOT NULL DEFAULT true,
  receives_daily_schedule boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_owner" ON public.team_members
  FOR ALL USING (business_id = auth.uid());

-- ─────────────────────────────────────────────
-- 3. autobooking_settings
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.autobooking_settings (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                     uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Master toggle
  enabled                         boolean NOT NULL DEFAULT false,

  -- Feature toggles
  customer_reminders_enabled      boolean NOT NULL DEFAULT true,
  team_schedules_enabled          boolean NOT NULL DEFAULT true,
  job_completion_enabled          boolean NOT NULL DEFAULT true,
  payment_matching_enabled        boolean NOT NULL DEFAULT false,

  -- Reminder config
  reminder_hours_before           integer NOT NULL DEFAULT 24,
  reminder_message_template       text,

  -- Team schedule config
  schedule_send_time              time NOT NULL DEFAULT '07:00',
  schedule_send_days_before       integer NOT NULL DEFAULT 1,

  -- Completion confidence thresholds
  confidence_threshold_auto       numeric NOT NULL DEFAULT 0.85,
  confidence_threshold_prompt     numeric NOT NULL DEFAULT 0.60,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autobooking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autobooking_settings_owner" ON public.autobooking_settings
  FOR ALL USING (business_id = auth.uid());

-- ─────────────────────────────────────────────
-- 4. autobooking_queue
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.autobooking_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id          uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  team_member_id  uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,

  message_type    text NOT NULL
                  CHECK (message_type IN (
                    'customer_reminder','team_schedule',
                    'completion_prompt','rebooking_ask','payment_chase'
                  )),
  channel         text NOT NULL DEFAULT 'sms'
                  CHECK (channel IN ('sms','email','whatsapp')),
  recipient_phone text,
  recipient_email text,
  message_body    text NOT NULL,

  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','delivered','failed','cancelled')),
  scheduled_for   timestamptz NOT NULL DEFAULT now(),
  sent_at         timestamptz,
  delivered_at    timestamptz,
  error_message   text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autobooking_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autobooking_queue_owner" ON public.autobooking_queue
  FOR ALL USING (business_id = auth.uid());

CREATE INDEX IF NOT EXISTS autobooking_queue_status_scheduled
  ON public.autobooking_queue (status, scheduled_for)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────
-- 5. autobooking_replies
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.autobooking_replies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  queue_item_id       uuid REFERENCES public.autobooking_queue(id) ON DELETE SET NULL,
  job_id              uuid REFERENCES public.jobs(id) ON DELETE SET NULL,

  from_phone          text,
  raw_body            text NOT NULL,
  parsed_intent       text
                      CHECK (parsed_intent IN (
                        'confirm','cancel','reschedule','question','unknown'
                      )),
  confidence          numeric DEFAULT 0.0,
  actioned            boolean NOT NULL DEFAULT false,
  actioned_at         timestamptz,
  agent_action_id     uuid REFERENCES public.agent_actions(id) ON DELETE SET NULL,

  received_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.autobooking_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autobooking_replies_owner" ON public.autobooking_replies
  FOR ALL USING (business_id = auth.uid());

-- ─────────────────────────────────────────────
-- 6. job_checkins
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.job_checkins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  job_id          uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  team_member_id  uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  checkin_token   text UNIQUE,

  action          text NOT NULL DEFAULT 'arrived'
                  CHECK (action IN ('arrived','left','note')),
  note            text,
  photo_url       text,
  lat             numeric,
  lng             numeric,

  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_checkins_owner" ON public.job_checkins
  FOR ALL USING (business_id = auth.uid());

-- Public read by token (for the /c/:token check-in page)
CREATE POLICY "job_checkins_public_token_read" ON public.job_checkins
  FOR SELECT USING (checkin_token IS NOT NULL);

-- ─────────────────────────────────────────────
-- 7. customer_payment_patterns
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_payment_patterns (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_id             uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,

  avg_days_to_pay         numeric,
  last_payment_at         timestamptz,
  total_payments          integer NOT NULL DEFAULT 0,
  late_payments           integer NOT NULL DEFAULT 0,
  payment_reliability     text NOT NULL DEFAULT 'unknown'
                          CHECK (payment_reliability IN (
                            'unknown','reliable','variable','slow','risk'
                          )),

  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id)
);

ALTER TABLE public.customer_payment_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_payment_patterns_owner" ON public.customer_payment_patterns
  FOR ALL USING (business_id = auth.uid());
