// thirtyDayPlanDb.js — 30 Day Plan progress and step management

import { supabase } from '../supabase';

const PHASE_1_STEPS = ['services_menu', 'add_customers', 'activate_front_desk', 'first_job'];

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

  const firstJobStep = steps.find(s => s.step_key === 'first_job');
  const frontDeskSourced = firstJobStep?.metadata?.front_desk_sourced === true;

  return { completed: true, alreadyDone: false, frontDeskSourced };
}

// ── Auto-complete steps based on live data ────────────────────────────────────
// Called on dashboard load to sync step status with actual DB state.

export async function syncPhase1Steps({ serviceCount, customerCount, frontDeskActive, jobCount }) {
  const steps = await getSteps(1);
  const updates = [];

  const shouldComplete = (key, condition) => {
    const step = steps.find(s => s.step_key === key);
    if (!step || step.status === 'completed') return false;
    return condition;
  };

  if (shouldComplete('services_menu', serviceCount >= 1)) {
    updates.push(markStepComplete('services_menu'));
  }
  if (shouldComplete('add_customers', customerCount >= 1)) {
    updates.push(markStepComplete('add_customers'));
  }
  if (shouldComplete('activate_front_desk', frontDeskActive)) {
    updates.push(markStepComplete('activate_front_desk'));
  }
  if (shouldComplete('first_job', jobCount >= 1)) {
    updates.push(markStepComplete('first_job'));
  }

  if (updates.length) await Promise.all(updates);

  return checkAndCompletePhase1();
}

// ── Stats for celebration modal ───────────────────────────────────────────────

export async function getPhase1Stats() {
  const steps = await getSteps(1);
  const progress = await getProgress();

  const servicesStep = steps.find(s => s.step_key === 'services_menu');
  const customersStep = steps.find(s => s.step_key === 'add_customers');
  const frontDeskStep = steps.find(s => s.step_key === 'activate_front_desk');
  const firstJobStep  = steps.find(s => s.step_key === 'first_job');

  const started = progress?.phase_1_started_at ? new Date(progress.phase_1_started_at) : null;
  const completed = progress?.phase_1_completed_at ? new Date(progress.phase_1_completed_at) : null;
  let durationLabel = null;
  if (started && completed) {
    const mins = Math.round((completed - started) / 60000);
    if (mins < 60) durationLabel = `${mins} minutes`;
    else durationLabel = `${Math.round(mins / 60)} hours`;
  }

  return {
    serviceCount: servicesStep?.metadata?.count ?? null,
    customerCount: customersStep?.metadata?.count ?? null,
    frontDeskLive: frontDeskStep?.status === 'completed',
    firstJobDate: firstJobStep?.metadata?.date ?? null,
    firstJobCustomer: firstJobStep?.metadata?.customer_name ?? null,
    frontDeskSourced: firstJobStep?.metadata?.front_desk_sourced === true,
    durationLabel,
  };
}
