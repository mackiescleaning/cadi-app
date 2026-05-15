/**
 * Cadi Agent Framework
 * Shared utilities for all AI agents (Sales Manager, Review Agent, Operations Manager, Scheduler).
 * Pure functions where possible — no side effects except the Supabase calls.
 */

import { supabase } from './supabase';

// ─── Trust levels ─────────────────────────────────────────────────────────────

export const TRUST_LEVELS = {
  cautious:   { label: 'Cautious',   desc: 'Every action needs your approval before Cadi sends anything.' },
  balanced:   { label: 'Balanced',   desc: 'Low-risk actions (quotes, review requests) send automatically. High-risk needs approval.' },
  autonomous: { label: 'Autonomous', desc: 'Cadi acts independently. You can review what was sent in the Inbox.' },
};

// Risk tier per action type — used to decide auto-approve vs. require approval
const ACTION_RISK = {
  send_quote:            'low',
  send_review_request:   'low',
  send_followup:         'low',
  send_invoice:          'medium',
  book_job:              'medium',
  cancel_job:            'high',
  issue_refund:          'high',
  send_complaint_reply:  'high',
};

/**
 * Returns true if this action should auto-approve given the current trust level.
 */
export function shouldAutoApprove(trustLevel, actionType) {
  if (trustLevel === 'autonomous') return true;
  if (trustLevel === 'cautious')   return false;
  // balanced: auto-approve low-risk only
  const risk = ACTION_RISK[actionType] ?? 'medium';
  return risk === 'low';
}

// ─── Agent modes ──────────────────────────────────────────────────────────────

export const AGENT_MODES = {
  off:        { label: 'Off',        desc: 'Agent is disabled.' },
  manual:     { label: 'Manual',     desc: 'Agent drafts actions but never sends. You send manually.' },
  approval:   { label: 'Needs approval', desc: 'Agent proposes actions. You approve before anything is sent.' },
  autonomous: { label: 'Autonomous', desc: 'Agent acts without approval. Review in Inbox.' },
};

export const AGENTS = {
  sales_manager:       { label: 'Sales Manager',       desc: 'Handles inbound enquiries and quotes.' },
  review_agent:        { label: 'Review Agent',         desc: 'Sends review requests after completed jobs.' },
  operations_manager:  { label: 'Operations Manager',   desc: 'Runs the schedule, reminders, and payment matching.' },
  scheduler:           { label: 'Scheduler',            desc: 'Suggests job bookings and reschedules.' },
  // Legacy keys kept for backwards compatibility with existing rows
  front_desk:          { label: 'Sales Manager',        desc: 'Handles inbound enquiries and quotes.' },
  reviews:             { label: 'Review Agent',          desc: 'Sends review requests after completed jobs.' },
};

// ─── Brand voice ──────────────────────────────────────────────────────────────

export const TONE_OPTIONS = [
  { value: 'warm',         label: 'Warm & friendly',   example: 'Hi Sarah! Just checking in — hope the house is looking great 😊' },
  { value: 'professional', label: 'Professional',       example: 'Dear Sarah, I hope you are well. I wanted to follow up regarding your recent booking.' },
  { value: 'casual',       label: 'Casual & direct',   example: 'Hey Sarah, quick message — just wanted to check everything was spot on!' },
];

/**
 * Returns a system prompt addition that injects brand voice into any agent message.
 */
export function buildBrandVoicePrompt(brandVoice) {
  if (!brandVoice) return '';
  const { tone, business_name, sign_off_name } = brandVoice;
  const toneDesc = TONE_OPTIONS.find(t => t.value === tone)?.label ?? tone ?? 'friendly';
  return [
    `\n\n## Brand voice`,
    `Tone: ${toneDesc}`,
    business_name ? `Business name: ${business_name}` : null,
    sign_off_name ? `Sign off as: ${sign_off_name}` : null,
    `Always write in this style. Keep messages short and natural.`,
  ].filter(Boolean).join('\n');
}

// ─── Recording actions ────────────────────────────────────────────────────────

/**
 * Inserts a row into agent_actions.
 * Returns the created row id, or null on error.
 *
 * @param {string}  businessId
 * @param {string}  agent         - 'sales_manager' | 'review_agent' | 'operations_manager' | 'scheduler'
 * @param {string}  actionType    - e.g. 'send_quote', 'send_review_request'
 * @param {object}  payload       - the proposed message/content
 * @param {object}  options
 * @param {string}  [options.trustLevel]   - business trust level (drives auto-approve)
 * @param {string}  [options.reasoning]    - why the agent chose this action
 * @param {string}  [options.customerId]
 * @param {string}  [options.jobId]
 * @param {string}  [options.sourceEventId]
 * @param {number}  [options.expiresInHours]
 */
export async function recordAgentAction(businessId, agent, actionType, payload, options = {}) {
  const {
    trustLevel = 'cautious',
    reasoning,
    customerId,
    jobId,
    sourceEventId,
    expiresInHours,
  } = options;

  const autoApprove = shouldAutoApprove(trustLevel, actionType);
  const status      = autoApprove ? 'auto_sent' : 'pending_approval';
  const now         = new Date();

  const row = {
    business_id:      businessId,
    agent,
    action_type:      actionType,
    status,
    proposed_payload: payload,
    reasoning:        reasoning ?? null,
    customer_id:      customerId ?? null,
    job_id:           jobId ?? null,
    source_event_id:  sourceEventId ?? null,
    sent_at:          autoApprove ? now.toISOString() : null,
    expires_at:       expiresInHours
      ? new Date(now.getTime() + expiresInHours * 3_600_000).toISOString()
      : null,
  };

  const { data, error } = await supabase
    .from('agent_actions')
    .insert(row)
    .select('id')
    .single();

  if (error) { console.error('recordAgentAction:', error); return null; }
  return data?.id ?? null;
}

// ─── Approving / rejecting ────────────────────────────────────────────────────

export async function approveAgentAction(actionId, userId) {
  const { error } = await supabase
    .from('agent_actions')
    .update({
      status:              'approved',
      approved_by_user_id: userId,
      approved_at:         new Date().toISOString(),
    })
    .eq('id', actionId);
  return !error;
}

export async function rejectAgentAction(actionId, userId) {
  const { error } = await supabase
    .from('agent_actions')
    .update({
      status:              'rejected',
      approved_by_user_id: userId,
      approved_at:         new Date().toISOString(),
    })
    .eq('id', actionId);
  return !error;
}

// ─── Dispatching job events ───────────────────────────────────────────────────

/**
 * Inserts a job_events row. The event-dispatcher Edge Function picks these up.
 */
export async function dispatchJobEvent(businessId, jobId, eventType, payload = {}) {
  const { error } = await supabase
    .from('job_events')
    .insert({ business_id: businessId, job_id: jobId, event_type: eventType, payload });
  if (error) console.error('dispatchJobEvent:', error);
  return !error;
}

// ─── Loading agent settings ───────────────────────────────────────────────────

export async function loadAgentSettings(businessId, agentName) {
  const { data } = await supabase
    .from('agent_settings')
    .select('mode, config')
    .eq('business_id', businessId)
    .eq('agent', agentName)
    .maybeSingle();
  return data ?? { mode: 'approval', config: {} };
}

export async function upsertAgentSettings(businessId, agentName, mode, config = {}) {
  const { error } = await supabase
    .from('agent_settings')
    .upsert({ business_id: businessId, agent: agentName, mode, config });
  return !error;
}
