import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { bulkCreateJobs } from './jobsDb';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createRecurringJob(rule) {
  const ownerId = await getCurrentUserId();
  const payload = ruleToRow(rule, ownerId);
  const { data, error } = await supabase
    .from('recurring_jobs')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return rowToRule(data);
}

export async function bulkCreateRecurringJobs(rules) {
  if (!rules.length) return [];
  const ownerId = await getCurrentUserId();
  const rows = rules.map(r => ruleToRow(r, ownerId));
  const { data, error } = await supabase
    .from('recurring_jobs')
    .insert(rows)
    .select('*');
  if (error) throw error;
  return (data ?? []).map(rowToRule);
}

export async function listRecurringJobs({ status = 'active', customerId } = {}) {
  const ownerId = await getCurrentUserId();
  let q = supabase
    .from('recurring_jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .order('anchor_date', { ascending: true });
  if (status) q = q.eq('status', status);
  if (customerId) q = q.eq('customer_id', customerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToRule);
}

export async function updateRecurringJob(id, updates) {
  const ownerId = await getCurrentUserId();
  const row = ruleToRow(updates, ownerId, { partial: true });
  const { data, error } = await supabase
    .from('recurring_jobs')
    .update(row)
    .eq('id', id)
    .eq('owner_id', ownerId)
    .select('*')
    .single();
  if (error) throw error;
  return rowToRule(data);
}

export async function cancelRecurringJob(id) {
  return updateRecurringJob(id, { status: 'cancelled' });
}

export async function deleteRecurringJob(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('recurring_jobs')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (error) throw error;
}

// Find every rule created in an import batch — for "Undo last import" rollback
export async function listRulesForBatch(importBatchId) {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('recurring_jobs')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('import_batch_id', importBatchId);
  if (error) throw error;
  return (data ?? []).map(rowToRule);
}

// ─── Visit generation ────────────────────────────────────────────────────────
// Pure function. Given a rule and a window, returns ISO dates (YYYY-MM-DD).
// Does NOT touch the database — call materialiseVisits to insert.

export function generateVisitDates(rule, { from, until } = {}) {
  const start = from ? new Date(from + 'T00:00:00') : new Date();
  start.setHours(0, 0, 0, 0);
  const end = until ? new Date(until + 'T00:00:00') : addMonths(start, 3);

  const anchor = new Date(rule.anchorDate + 'T00:00:00');
  const ruleEnd = rule.endDate ? new Date(rule.endDate + 'T00:00:00') : null;
  const stop = ruleEnd && ruleEnd < end ? ruleEnd : end;

  if (rule.freq === 'one-off') {
    if (anchor >= start && anchor <= stop) return [iso(anchor)];
    return [];
  }

  const stepDays = freqToDays(rule.freq, rule.freqInterval || 1);
  if (!stepDays) return [];

  // Advance anchor forward to the first visit on or after `start`
  const cur = new Date(anchor);
  if (cur < start) {
    const diffDays = Math.floor((start - cur) / 86400000);
    const skips = Math.ceil(diffDays / stepDays);
    cur.setDate(cur.getDate() + skips * stepDays);
  }

  const dates = [];
  while (cur <= stop) {
    // Shift Sunday → Monday — cleaning rounds rarely run on Sundays
    const shifted = cur.getDay() === 0 ? new Date(cur.getTime() + 86400000) : cur;
    dates.push(iso(shifted));
    cur.setDate(cur.getDate() + stepDays);
  }
  return dates;
}

// Materialise visits into the jobs table for a single rule.
// Returns the inserted job rows. Caller owns the date window.
export async function materialiseVisits(rule, customer, { from, until } = {}) {
  const dates = generateVisitDates(rule, { from, until });
  if (!dates.length) return [];

  const jobs = dates.map(date => ({
    customerId:   rule.customerId ?? customer?.id ?? null,
    customer:     customer?.name ?? '',
    addressLine1: customer?.address_line1 ?? null,
    addressLine2: customer?.address_line2 ?? null,
    town:         customer?.town ?? null,
    county:       customer?.county ?? null,
    postcode:     customer?.postcode ?? '',
    date,
    startHour:    rule.preferredHour ?? 9,
    durationHrs:  rule.durationHrs ?? 1,
    type:         rule.type ?? 'residential',
    service:      rule.service ?? '',
    price:        rule.price ?? 0,
    recurrence:   ruleToRecurrenceLabel(rule),
    isRecurring:  rule.freq !== 'one-off',
    notes:        rule.notes ?? '',
    seriesId:     rule.id,
  }));
  await bulkCreateJobs(jobs);
  return jobs;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function freqToDays(freq, interval) {
  if (freq === 'daily')   return interval;
  if (freq === 'weekly')  return 7 * interval;
  if (freq === 'monthly') return 30 * interval;  // approximate; calendar-correct monthly comes in v2
  return 0;
}

function ruleToRecurrenceLabel(rule) {
  const interval = rule.freqInterval || 1;
  if (rule.freq === 'one-off') return 'one-off';
  if (rule.freq === 'weekly' && interval === 1) return 'weekly';
  if (rule.freq === 'weekly' && interval === 2) return 'fortnightly';
  if (rule.freq === 'monthly' && interval === 1) return 'monthly';
  return `every ${interval} ${rule.freq === 'daily' ? 'day' : rule.freq.replace('ly','')}${interval > 1 ? 's' : ''}`;
}

function ruleToRow(r, ownerId, { partial = false } = {}) {
  const row = {};
  if (!partial) row.owner_id = ownerId;
  if ('customerId'      in r) row.customer_id      = r.customerId ?? null;
  if ('service'         in r) row.service          = r.service;
  if ('type'            in r) row.type             = r.type;
  if ('price'           in r) row.price            = r.price;
  if ('durationHrs'     in r) row.duration_hrs     = r.durationHrs;
  if ('assignees'       in r) row.assignees        = r.assignees;
  if ('assigneeIds'     in r) row.assignee_ids     = r.assigneeIds;
  if ('freq'            in r) row.freq             = r.freq;
  if ('freqInterval'    in r) row.freq_interval    = r.freqInterval;
  if ('anchorDate'      in r) row.anchor_date      = r.anchorDate;
  if ('preferredHour'   in r) row.preferred_hour   = r.preferredHour;
  if ('endDate'         in r) row.end_date         = r.endDate;
  if ('status'          in r) row.status           = r.status;
  if ('notes'           in r) row.notes            = r.notes;
  if ('source'          in r) row.source           = r.source;
  if ('importBatchId'   in r) row.import_batch_id  = r.importBatchId;
  return row;
}

function rowToRule(row) {
  return {
    id:             row.id,
    ownerId:        row.owner_id,
    customerId:     row.customer_id,
    service:        row.service,
    type:           row.type,
    price:          Number(row.price) || 0,
    durationHrs:    Number(row.duration_hrs) || 1,
    assignees:      row.assignees ?? [],
    assigneeIds:    row.assignee_ids ?? [],
    freq:           row.freq,
    freqInterval:   row.freq_interval ?? 1,
    anchorDate:     row.anchor_date,
    preferredHour:  Number(row.preferred_hour) || 9,
    endDate:        row.end_date,
    status:         row.status,
    notes:          row.notes ?? '',
    source:         row.source ?? 'manual',
    importBatchId:  row.import_batch_id ?? null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

// Format a Date as YYYY-MM-DD using LOCAL components — NEVER toISOString,
// which converts to UTC and shifts dates by ±1 in non-UTC timezones (BST
// being UTC+1 silently turned every Monday-shifted date back into Sunday
// when written to the jobs.date column). This caller wants the calendar
// date the user sees, not the UTC instant.
function iso(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addMonths(d, n) {
  const out = new Date(d);
  out.setMonth(out.getMonth() + n);
  return out;
}

// ─── Project visits onto the scheduler for a list of customers ────────────
// Idempotent. Used by the "Approve" actions on the Customers tab — when the
// user approves a freshly-imported customer (or bulk-approves all of them),
// their recurring_jobs rules get expanded into concrete `jobs` rows for the
// next 12 weeks so the Scheduler tab lights up immediately.
//
// Idempotency: we skip any rule that already has at least one job inside the
// horizon window with the matching series_id. Re-running is safe.
//
// Best-effort per customer: if one rule fails to materialise we log and
// continue rather than blocking the approval transaction.

export async function materialiseVisitsForCustomers(customerIds, { weeks = 12 } = {}) {
  if (!Array.isArray(customerIds) || !customerIds.length) {
    return { rulesProcessed: 0, jobsCreated: 0, skipped: 0 };
  }
  const ownerId = await getCurrentUserId();

  // Window
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + weeks * 7);
  const from  = iso(today);
  const until = iso(horizon);

  // Load all active rules + customers in one go
  const [{ data: rules, error: rErr }, { data: customers, error: cErr }] = await Promise.all([
    supabase
      .from('recurring_jobs')
      .select('id, customer_id, service, type, price, duration_hrs, freq, freq_interval, anchor_date, preferred_hour, notes, route_cluster, route_order')
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .in('customer_id', customerIds),
    supabase
      .from('customers')
      .select('id, name, address_line1, address_line2, town, county, postcode')
      .in('id', customerIds),
  ]);
  if (rErr) throw rErr;
  if (cErr) throw cErr;

  if (!rules?.length) return { rulesProcessed: 0, jobsCreated: 0, skipped: 0 };

  const customersById = new Map((customers ?? []).map(c => [c.id, c]));

  // Idempotency: find which series already have jobs inside the window so we
  // don't double-write.
  const ruleIds = rules.map(r => r.id);
  const { data: existing } = await supabase
    .from('jobs')
    .select('series_id')
    .in('series_id', ruleIds)
    .gte('date', from)
    .lt('date', until);
  const alreadyMaterialised = new Set((existing ?? []).map(j => j.series_id));

  let rulesProcessed = 0, jobsCreated = 0, skipped = 0;

  for (const row of rules) {
    rulesProcessed++;
    if (alreadyMaterialised.has(row.id)) { skipped++; continue; }
    const customer = customersById.get(row.customer_id);
    if (!customer) { skipped++; continue; }

    // Snake_case row → camelCase rule expected by generateVisitDates +
    // materialiseVisits.
    const rule = {
      id:            row.id,
      customerId:    row.customer_id,
      service:       row.service,
      type:          row.type,
      price:         Number(row.price) || 0,
      durationHrs:   row.duration_hrs ? Number(row.duration_hrs) : 1,
      preferredHour: row.preferred_hour ?? 9,
      freq:          row.freq,
      freqInterval:  row.freq_interval ?? 1,
      anchorDate:    row.anchor_date,
      notes:         row.notes,
    };
    try {
      const inserted = await materialiseVisits(rule, customer, { from, until });
      jobsCreated += inserted.length;
    } catch (e) {
      // Don't let one bad rule poison the whole batch — log + continue.
      // eslint-disable-next-line no-console
      console.warn(`Failed to materialise visits for rule ${row.id}:`, e?.message ?? e);
      skipped++;
    }
  }

  return { rulesProcessed, jobsCreated, skipped };
}
