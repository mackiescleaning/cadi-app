// thirtyDayPlanDb.js — 30 Day Plan progress and step management

import { supabase } from '../supabase';

const PHASE_1_STEPS = ['add_customers', 'first_job', 'invoice_template'];

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getProgress() {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('*')
    .single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
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

// ── Step completion ───────────────────────────────────────────────────────────

export async function markStepComplete(stepKey, metadata = {}) {
  const { data, error } = await supabase
    .from('onboarding_steps')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata,
    })
    .eq('phase', 1)
    .eq('step_key', stepKey)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markStepInProgress(stepKey) {
  const { error } = await supabase
    .from('onboarding_steps')
    .update({ status: 'in_progress' })
    .eq('phase', 1)
    .eq('step_key', stepKey)
    .neq('status', 'completed');
  if (error) throw error;
}

// ── Phase completion check + advancement ─────────────────────────────────────

export async function checkAndCompletePhase1() {
  const steps = await getSteps(1);
  const allComplete = PHASE_1_STEPS.every(key =>
    steps.find(s => s.step_key === key)?.status === 'completed'
  );
  if (!allComplete) return { completed: false };

  const progress = await getProgress();
  if (progress?.phase_1_completed_at) return { completed: true, alreadyDone: true };

  const { error } = await supabase
    .from('onboarding_progress')
    .update({
      phase_1_completed_at: new Date().toISOString(),
      current_phase: 2,
    })
    .eq('id', progress.id);
  if (error) throw error;

  return { completed: true, alreadyDone: false };
}

// ── Auto-complete steps based on live data ────────────────────────────────────
// Called on dashboard load to sync step status with actual DB state.

export async function syncPhase1Steps({ customerCount, jobCount, templateSaved }) {
  const steps = await getSteps(1);
  const updates = [];

  const shouldComplete = (key, condition) => {
    const step = steps.find(s => s.step_key === key);
    if (!step || step.status === 'completed') return false;
    return condition;
  };

  if (shouldComplete('add_customers', customerCount >= 1)) {
    updates.push(markStepComplete('add_customers'));
  }
  if (shouldComplete('first_job', jobCount >= 1)) {
    updates.push(markStepComplete('first_job'));
  }
  if (shouldComplete('invoice_template', templateSaved)) {
    updates.push(markStepComplete('invoice_template'));
  }

  if (updates.length) await Promise.all(updates);

  return checkAndCompletePhase1();
}

// ── Stats for celebration modal ───────────────────────────────────────────────

export async function getPhase1Stats() {
  const steps = await getSteps(1);
  const progress = await getProgress();

  const customersStep     = steps.find(s => s.step_key === 'add_customers');
  const firstJobStep      = steps.find(s => s.step_key === 'first_job');

  // Check for connected payment processor
  const { data: connections } = await supabase
    .from('payment_connections')
    .select('provider, is_connected, provider_account_name')
    .eq('is_connected', true)
    .limit(1)
    .maybeSingle();

  const started = progress?.phase_1_started_at ? new Date(progress.phase_1_started_at) : null;
  const completed = progress?.phase_1_completed_at ? new Date(progress.phase_1_completed_at) : null;
  let durationLabel = null;
  if (started && completed) {
    const mins = Math.round((completed - started) / 60000);
    if (mins < 60) durationLabel = `${mins} minutes`;
    else durationLabel = `${Math.round(mins / 60)} hours`;
  }

  let processorConnected = null;
  if (connections?.is_connected) {
    processorConnected = connections.provider === 'stripe' ? 'Stripe' : 'GoCardless';
    if (connections.provider_account_name) {
      processorConnected = connections.provider_account_name;
    }
  }

  return {
    customerCount: customersStep?.metadata?.count ?? null,
    firstJobDate: firstJobStep?.metadata?.date ?? null,
    firstJobCustomer: firstJobStep?.metadata?.customer_name ?? null,
    processorConnected,
    durationLabel,
  };
}
