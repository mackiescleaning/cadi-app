// thirtyDayPlanDb.js — 30 Day Plan progress and step management (Phases 1–3)

import { supabase } from '../supabase';

const PHASE_1_STEPS = ['add_customers', 'first_job', 'invoice_template'];
const PHASE_2_STEPS = ['connect_open_banking', 'financial_walkthrough', 'first_weekly_report'];
const PHASE_3_STEPS = ['hire_sales_manager', 'hire_review_agent', 'hire_operations_manager'];

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getProgress() {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function getSteps(phase = 1) {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .select('*')
    .eq('phase', phase)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getPhase1State() {
  const [progress, steps] = await Promise.all([getProgress(), getSteps(1)]);
  return { progress, steps };
}

export async function getPhase2State() {
  const [progress, steps] = await Promise.all([getProgress(), getSteps(2)]);
  return { progress, steps };
}

export async function getPhase3State() {
  const [progress, steps] = await Promise.all([getProgress(), getSteps(3)]);
  return { progress, steps };
}

// ── Step completion ───────────────────────────────────────────────────────────

export async function markStepComplete(stepKey, phase = 1, metadata = {}) {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      metadata,
    })
    .eq('phase', phase)
    .eq('step_key', stepKey)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function markStepInProgress(stepKey, phase = 1) {
  const { error } = await supabase
    .from('onboarding_steps')
    .update({ status: 'in_progress' })
    .eq('phase', phase)
    .eq('step_key', stepKey)
    .neq('status', 'completed');
  if (error) throw error;
}

// ── Phase 1: completion check ─────────────────────────────────────────────────

export async function checkAndCompletePhase1() {
  const steps = await getSteps(1);
  const allComplete = PHASE_1_STEPS.every(key =>
    steps.find(s => s.step_key === key)?.status === 'completed',
  );
  if (!allComplete) return { completed: false };

  const progress = await getProgress();
  if (progress?.phase_1_completed_at) return { completed: true, alreadyDone: true };

  const { error } = await supabase
    .from('onboarding_progress')
    .update({
      phase_1_completed_at: new Date().toISOString(),
      current_phase:        2,
    })
    .eq('id', progress.id);
  if (error) throw error;

  // Seed Phase 2 steps
  try {
    const { data: biz } = await supabase.from('businesses').select('id').maybeSingle();
    if (biz) {
      await supabase.rpc('initialise_phase2_plan', { p_business_id: biz.id });
    }
  } catch { /* non-fatal — migration handles seeding for existing businesses */ }

  return { completed: true, alreadyDone: false };
}

// ── Phase 2: sync step statuses from live data ────────────────────────────────

export async function syncPhase2Steps({ bankConnected, walkthroughDone, reportViewed }) {
  const steps = await getSteps(2);
  const updates = [];

  const shouldComplete = (key, condition) => {
    const step = steps.find(s => s.step_key === key);
    if (!step || step.status === 'completed') return false;
    return condition;
  };

  if (shouldComplete('connect_open_banking', bankConnected)) {
    updates.push(markStepComplete('connect_open_banking', 2));
  }
  if (shouldComplete('financial_walkthrough', walkthroughDone)) {
    updates.push(markStepComplete('financial_walkthrough', 2));
  }
  if (shouldComplete('first_weekly_report', reportViewed)) {
    updates.push(markStepComplete('first_weekly_report', 2));
  }

  if (updates.length) await Promise.all(updates);

  return checkAndCompletePhase2();
}

export async function checkAndCompletePhase2() {
  const steps = await getSteps(2);

  // Only run if all 3 Phase 2 steps exist
  if (steps.length < 3) return { completed: false };

  const allComplete = PHASE_2_STEPS.every(key =>
    steps.find(s => s.step_key === key)?.status === 'completed',
  );
  if (!allComplete) return { completed: false };

  const progress = await getProgress();
  if (progress?.phase_2_completed_at) return { completed: true, alreadyDone: true };

  const { error } = await supabase
    .from('onboarding_progress')
    .update({
      phase_2_completed_at: new Date().toISOString(),
      current_phase:        3,
    })
    .eq('id', progress.id);
  if (error) throw error;

  return { completed: true, alreadyDone: false };
}

// ── Phase 1: auto-complete from live data ─────────────────────────────────────

export async function syncPhase1Steps({ customerCount, jobCount, templateSaved }) {
  const steps = await getSteps(1);
  const updates = [];

  const shouldComplete = (key, condition) => {
    const step = steps.find(s => s.step_key === key);
    if (!step || step.status === 'completed') return false;
    return condition;
  };

  if (shouldComplete('add_customers', customerCount >= 1)) {
    updates.push(markStepComplete('add_customers', 1));
  }
  if (shouldComplete('first_job', jobCount >= 1)) {
    updates.push(markStepComplete('first_job', 1));
  }
  if (shouldComplete('invoice_template', templateSaved)) {
    updates.push(markStepComplete('invoice_template', 1));
  }

  if (updates.length) await Promise.all(updates);

  return checkAndCompletePhase1();
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

export async function getPhase1Stats() {
  const [steps, progress] = await Promise.all([getSteps(1), getProgress()]);

  const customersStep = steps.find(s => s.step_key === 'add_customers');
  const firstJobStep  = steps.find(s => s.step_key === 'first_job');

  const { data: connections } = await supabase
    .from('payment_connections')
    .select('provider, is_connected, provider_account_name')
    .eq('is_connected', true)
    .limit(1)
    .maybeSingle();

  const started   = progress?.phase_1_started_at  ? new Date(progress.phase_1_started_at)  : null;
  const completed = progress?.phase_1_completed_at ? new Date(progress.phase_1_completed_at) : null;
  let durationLabel = null;
  if (started && completed) {
    const mins = Math.round((completed - started) / 60000);
    durationLabel = mins < 60 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`;
  }

  let processorConnected = null;
  if (connections?.is_connected) {
    processorConnected = connections.provider === 'stripe' ? 'Stripe' : 'GoCardless';
    if (connections.provider_account_name) processorConnected = connections.provider_account_name;
  }

  return {
    customerCount:  customersStep?.metadata?.count ?? null,
    firstJobDate:   firstJobStep?.metadata?.date   ?? null,
    firstJobCustomer: firstJobStep?.metadata?.customer_name ?? null,
    processorConnected,
    durationLabel,
  };
}

export async function getPhase2Stats() {
  const [steps, progress] = await Promise.all([getSteps(2), getProgress()]);

  const bankStep      = steps.find(s => s.step_key === 'connect_open_banking');
  const walkStep      = steps.find(s => s.step_key === 'financial_walkthrough');
  const reportStep    = steps.find(s => s.step_key === 'first_weekly_report');

  // Reconciliation stats from transactions
  const { count: reconCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .not('matched_invoice_id', 'is', null);

  // Unpaid invoices surfaced
  const { data: unpaidRows } = await supabase
    .from('invoices')
    .select('lines')
    .in('status', ['sent', 'viewed', 'overdue']);
  const unpaidTotal = (unpaidRows ?? []).reduce((sum, inv) =>
    sum + (inv.lines ?? []).reduce((s, l) => s + (l.rate ?? 0) * (l.qty ?? 1), 0), 0);

  const focusArea = walkStep?.metadata?.focus_area ?? null;

  // Days analysed
  const { data: conn } = await supabase
    .from('bank_connections')
    .select('last_sync_at, connected_at')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const daysAnalysed = conn?.connected_at
    ? Math.round((Date.now() - new Date(conn.connected_at).getTime()) / 86400000)
    : null;

  const started   = progress?.phase_2_started_at  ? new Date(progress.phase_2_started_at)  : null;
  const completed = progress?.phase_2_completed_at ? new Date(progress.phase_2_completed_at) : null;
  let durationLabel = null;
  if (started && completed) {
    const mins = Math.round((completed - started) / 60000);
    durationLabel = mins < 60 ? `${mins} minutes` : `${Math.round(mins / 60)} hours`;
  }

  return {
    daysAnalysed,
    reconCount:   reconCount ?? 0,
    unpaidTotal,
    focusArea,
    durationLabel,
  };
}

// ── Phase 3: sync step statuses from agent activation state ───────────────────

export async function syncPhase3Steps({ smActive, raActive, omActive, omSkippedByFree }) {
  const steps = await getSteps(3);
  const updates = [];

  const shouldComplete = (key, condition) => {
    const step = steps.find(s => s.step_key === key);
    if (!step || step.status === 'completed') return false;
    return condition;
  };

  if (shouldComplete('hire_sales_manager', smActive)) {
    updates.push(markStepComplete('hire_sales_manager', 3));
  }
  if (shouldComplete('hire_review_agent', raActive)) {
    updates.push(markStepComplete('hire_review_agent', 3));
  }
  if (shouldComplete('hire_operations_manager', omActive || omSkippedByFree)) {
    const meta = omSkippedByFree && !omActive ? { acknowledged_free: true } : {};
    updates.push(markStepComplete('hire_operations_manager', 3, meta));
  }

  if (updates.length) await Promise.all(updates);

  return checkAndCompletePhase3();
}

export async function checkAndCompletePhase3() {
  const steps = await getSteps(3);
  if (steps.length < 3) return { completed: false };

  const allComplete = PHASE_3_STEPS.every(key =>
    steps.find(s => s.step_key === key)?.status === 'completed',
  );
  if (!allComplete) return { completed: false };

  const progress = await getProgress();
  if (progress?.phase_3_completed_at) return { completed: true, alreadyDone: true };

  const { error } = await supabase
    .from('onboarding_progress')
    .update({
      phase_3_completed_at: new Date().toISOString(),
      current_phase:        4,
    })
    .eq('id', progress.id);
  if (error) throw error;

  return { completed: true, alreadyDone: false };
}

export async function getPhase3Stats() {
  const [steps, progress] = await Promise.all([getSteps(3), getProgress()]);

  // Sales Manager stats
  const { count: inquiryCount } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'web_chat');

  // Review Agent stats
  const { count: reviewRequestsSent } = await supabase
    .from('agent_actions')
    .select('*', { count: 'exact', head: true })
    .in('agent', ['review_agent', 'reviews'])
    .eq('action_type', 'send_review_request')
    .neq('status', 'pending_approval');

  const { count: reviewsReceived } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .not('rating', 'is', null);

  // Operations Manager stats
  const { count: remindersCount } = await supabase
    .from('autobooking_queue')
    .select('*', { count: 'exact', head: true })
    .eq('message_type', 'customer_reminder')
    .eq('status', 'sent');

  const { count: autoCompletedCount } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .not('completion_method', 'is', null)
    .neq('completion_method', 'manual');

  const { count: paymentsMatchedCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .not('matched_invoice_id', 'is', null);

  const omStep = steps.find(s => s.step_key === 'hire_operations_manager');
  const omSkippedByFree = !!(omStep?.metadata?.acknowledged_free);

  return {
    inquiryCount:       inquiryCount ?? 0,
    reviewRequestsSent: reviewRequestsSent ?? 0,
    reviewsReceived:    reviewsReceived ?? 0,
    remindersCount:     remindersCount ?? 0,
    autoCompletedCount: autoCompletedCount ?? 0,
    paymentsMatchedCount: paymentsMatchedCount ?? 0,
    omSkippedByFree,
  };
}
