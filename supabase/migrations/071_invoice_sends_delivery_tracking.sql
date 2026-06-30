-- 071_invoice_sends_delivery_tracking.sql
--
-- Extend invoice_sends so the Resend webhook can update real delivery
-- state. Today status='sent' just means "Resend's API accepted our POST".
-- We have no visibility into whether the recipient's mail server
-- delivered, bounced, or marked-as-spam — which is exactly what bit us
-- on the NHS / Gmail / commercial-domain sends.
--
-- Columns added:
--   resend_message_id — Resend's email id (re_...) returned from POST,
--                       used by the webhook to find the row to update
--   delivered_at      — recipient mail server accepted
--   bounced_at        — recipient mail server rejected (hard or soft)
--   bounce_reason     — text the recipient mail server returned
--   opened_at         — first open (best-effort, requires Resend tracking)
--   complaint_at      — recipient marked as spam
--   updated_at        — last event timestamp; touched by the webhook
--
-- Status enum extended: 'sent' (initial) | 'delivered' | 'bounced' |
-- 'complained'. 'opened' stays as a separate timestamp because it can
-- happen after 'delivered' without changing the terminal status.

alter table public.invoice_sends
  add column if not exists resend_message_id text,
  add column if not exists delivered_at      timestamptz,
  add column if not exists bounced_at        timestamptz,
  add column if not exists bounce_reason     text,
  add column if not exists opened_at         timestamptz,
  add column if not exists complaint_at      timestamptz,
  add column if not exists updated_at        timestamptz default now();

-- Index so the webhook can look up by Resend message id quickly.
create index if not exists idx_invoice_sends_resend_message_id
  on public.invoice_sends (resend_message_id)
  where resend_message_id is not null;

-- Extend the status enum. Was implicit text — explicitly listing valid
-- values so the webhook + UI agree on the vocabulary.
alter table public.invoice_sends drop constraint if exists invoice_sends_status_check;
alter table public.invoice_sends add constraint invoice_sends_status_check
  check (status = any (array['sent','delivered','bounced','complained']));
