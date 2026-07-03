import { supabase } from '../supabase';

// customerCrmDb — the CRM layer behind the Customers tab (migration 080).
//
//   customer_services         — which services each customer uses
//   customer_service_calendar — planned occurrences incl. annual services
//   customer_sales_plans      — one active AI/manual plan per customer
//   customer_outreach         — upsell emails: draft → sent → converted
//   customer_crm_metrics      — per-customer analysis view
//
// All tables are RLS-scoped by business_id = my_business_id(), so queries
// here don't need owner filters — but inserts must stamp business_id.

let _businessId = null;
async function myBusinessId() {
  if (_businessId) return _businessId;
  const { data, error } = await supabase.rpc('my_business_id');
  if (error) throw error;
  _businessId = data;
  return data;
}

// ─── Service ledger ──────────────────────────────────────────────────────────

export async function listCustomerServices(customerId) {
  const { data, error } = await supabase
    .from('customer_services')
    .select('*')
    .eq('customer_id', customerId)
    .order('status', { ascending: true }) // active < lapsed < prospect
    .order('total_revenue', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// entry: { id?, customerId, label, status?, frequency?, price?, notes?, serviceId? }
export async function upsertCustomerService(entry) {
  const businessId = await myBusinessId();
  const payload = {
    ...(entry.id ? { id: entry.id } : {}),
    business_id: businessId,
    customer_id: entry.customerId,
    service_id:  entry.serviceId || null,
    label:       entry.label,
    status:      entry.status || 'active',
    frequency:   entry.frequency || null,
    price:       entry.price != null ? Number(entry.price) : null,
    notes:       entry.notes || null,
    source:      entry.source || 'manual',
  };
  const { data, error } = await supabase
    .from('customer_services')
    .upsert(payload, { onConflict: 'customer_id,label' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeCustomerService(id) {
  const { error } = await supabase.from('customer_services').delete().eq('id', id);
  if (error) throw error;
}

// ─── Annual service calendar ─────────────────────────────────────────────────

// Business-wide when customerId is omitted — feeds a "what's due this month
// across the whole book" view. from/to are 'YYYY-MM-DD' month anchors.
export async function listServiceCalendar({ customerId, from, to } = {}) {
  let q = supabase
    .from('customer_service_calendar')
    .select('*, customers(name)')
    .order('planned_month', { ascending: true });
  if (customerId) q = q.eq('customer_id', customerId);
  if (from) q = q.gte('planned_month', from);
  if (to) q = q.lte('planned_month', to);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

// entry: { id?, customerId, label, plannedMonth ('YYYY-MM-01'), plannedDate?,
//          recurrence?, priceEstimate?, notes?, customerServiceId? }
export async function upsertCalendarEntry(entry) {
  const businessId = await myBusinessId();
  const payload = {
    ...(entry.id ? { id: entry.id } : {}),
    business_id:         businessId,
    customer_id:         entry.customerId,
    customer_service_id: entry.customerServiceId || null,
    label:               entry.label,
    planned_month:       entry.plannedMonth,
    planned_date:        entry.plannedDate || null,
    recurrence:          entry.recurrence || 'annual',
    price_estimate:      entry.priceEstimate != null ? Number(entry.priceEstimate) : null,
    notes:               entry.notes || null,
  };
  const { data, error } = await supabase
    .from('customer_service_calendar')
    .upsert(payload)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// status: planned | offered | booked | done | skipped. Pass jobId when booking.
export async function setCalendarStatus(id, status, { jobId } = {}) {
  const patch = { status, ...(jobId ? { job_id: jobId } : {}) };
  const { data, error } = await supabase
    .from('customer_service_calendar')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeCalendarEntry(id) {
  const { error } = await supabase.from('customer_service_calendar').delete().eq('id', id);
  if (error) throw error;
}

// ─── Sales plans ─────────────────────────────────────────────────────────────

export async function getActiveSalesPlan(customerId) {
  const { data, error } = await supabase
    .from('customer_sales_plans')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Calls the crm-sales-plan edge function: generates the plan with Claude,
// archives the previous active plan, and creates draft outreach + calendar
// entries. Returns { plan, outreach_created, calendar_created }.
export async function generateSalesPlan(customerId) {
  const { data, error } = await supabase.functions.invoke('crm-sales-plan', {
    body: { customer_id: customerId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// ─── Outreach ────────────────────────────────────────────────────────────────

export async function listOutreach({ customerId, status } = {}) {
  let q = supabase
    .from('customer_outreach')
    .select('*, customers(name, email)')
    .order('created_at', { ascending: false });
  if (customerId) q = q.eq('customer_id', customerId);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function updateOutreachDraft(id, { subject, body }) {
  const { data, error } = await supabase
    .from('customer_outreach')
    .update({ subject, body })
    .eq('id', id)
    .in('status', ['draft', 'pending_approval', 'approved'])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// Sends via the crm-send-outreach edge function. Calling this as the owner
// IS the approval — the function accepts draft/pending_approval/approved.
export async function sendOutreach(id) {
  const { data, error } = await supabase.functions.invoke('crm-send-outreach', {
    body: { outreach_id: id },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function dismissOutreach(id) {
  const { error } = await supabase
    .from('customer_outreach')
    .update({ status: 'dismissed' })
    .eq('id', id);
  if (error) throw error;
}

// The moment that makes the whole loop measurable: tie a sent email to the
// job it won. value defaults to the job's price in the caller.
export async function markOutreachConverted(id, { jobId, value } = {}) {
  const { data, error } = await supabase
    .from('customer_outreach')
    .update({
      converted_at:     new Date().toISOString(),
      converted_job_id: jobId || null,
      converted_value:  value != null ? Number(value) : null,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

// ─── Metrics & funnel ────────────────────────────────────────────────────────

export async function getCrmMetrics(customerId) {
  const { data, error } = await supabase
    .from('customer_crm_metrics')
    .select('*')
    .eq('customer_id', customerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listCrmMetrics() {
  const { data, error } = await supabase.from('customer_crm_metrics').select('*');
  if (error) throw error;
  return data ?? [];
}

// Business-wide outreach funnel: { drafts, sent, converted, convertedValue,
// conversionRate }. Small row counts — reduce client-side.
export async function getOutreachFunnel() {
  const { data, error } = await supabase
    .from('customer_outreach')
    .select('status, converted_at, converted_value');
  if (error) throw error;
  const rows = data ?? [];
  const drafts    = rows.filter((r) => ['draft', 'pending_approval', 'approved'].includes(r.status)).length;
  const sent      = rows.filter((r) => r.status === 'sent').length;
  const converted = rows.filter((r) => r.converted_at != null).length;
  const convertedValue = rows.reduce((sum, r) => sum + (Number(r.converted_value) || 0), 0);
  return {
    drafts,
    sent,
    converted,
    convertedValue,
    conversionRate: sent > 0 ? converted / sent : 0,
  };
}

// ─── CRM settings (business_settings.crm_settings jsonb) ────────────────────

export async function getCrmSettings() {
  const { data, error } = await supabase
    .from('business_settings')
    .select('crm_settings')
    .maybeSingle();
  if (error) throw error;
  return data?.crm_settings ?? {};
}

// patch merges over the existing jsonb, e.g. { outreach_mode: 'auto' }
export async function updateCrmSettings(patch) {
  const current = await getCrmSettings();
  const next = { ...current, ...patch };
  const { error } = await supabase
    .from('business_settings')
    .update({ crm_settings: next })
    .not('owner_id', 'is', null); // RLS scopes to own row; predicate satisfies PostgREST
  if (error) throw error;
  return next;
}
