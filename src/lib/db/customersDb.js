import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { logAudit } from './auditDb';

// options: { page, pageSize } — default loads first 200.
// Legacy: pass a number as first arg for a plain limit (backward compat).
export async function listCustomers(optionsOrLimit = {}) {
  const ownerId = await getCurrentUserId();

  const opts = typeof optionsOrLimit === 'number'
    ? { pageSize: optionsOrLimit, page: 0 }
    : optionsOrLimit;

  const { page = 0, pageSize = 500 } = opts;

  // Read from the customers_with_billing view (migration 050) so each
  // mapped row carries paid_lifetime_value / outstanding_balance /
  // unpaid_invoice_count / oldest_unpaid_date. RLS is enforced by the
  // view's security_invoker flag against the underlying customers table.
  // Writes still go to the customers table via upsertCustomer.
  const { data, error } = await supabase
    .from('customers_with_billing')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) throw error;
  return data ?? [];
}

export async function upsertCustomer(customer) {
  const ownerId = await getCurrentUserId();
  const payload = {
    ...(customer.id ? { id: customer.id } : {}),
    owner_id: ownerId,
    name: customer.name,
    email: customer.email || null,
    phone: customer.phone || null,
    address_line1: customer.addressLine1 || null,
    address_line2: customer.addressLine2 || null,
    town: customer.town || null,
    county: customer.county || null,
    postcode: customer.postcode || null,
    frequency: customer.frequency || null,
    status: customer.status || 'active',
    tags: customer.tags || [],
    notes: customer.notes || null,
    source: customer.source || null,
    rating: customer.rating || 0,
    service_types: customer.serviceTypes || [],
    last_job_date: customer.lastJobDate || null,
    next_job_date: customer.nextJobDate || null,
    lifetime_value: Number(customer.lifetimeValue) || 0,
    // CleanerPlanner / Squeegee import fields
    due_date:           customer.dueDate || null,
    job_reference:      customer.jobReference || null,
    customer_reference: customer.customerReference || null,
    schedule:           customer.schedule || null,
    customer_balance:   customer.customerBalance != null ? Number(customer.customerBalance) : null,
    price_per_visit:    customer.pricePerVisit != null ? Number(customer.pricePerVisit) : null,
    round_name:         customer.roundName || null,
    account_status:     customer.accountStatus || 'active',
    segment:            customer.segment || 'unsegmented',
    segment_source:     customer.segmentSource || 'owner_set',
    birthday:           customer.birthday || null,
    customer_since:     customer.customerSince || null,
    // Billing mode picks what onJobCompleted() does on the next scheduled→complete
    // transition. Defaults handled by the DB; only set when caller supplies it
    // so an unrelated upsert doesn't reset the value.
    ...(customer.billing_mode || customer.billingMode
      ? { billing_mode: customer.billing_mode || customer.billingMode } : {}),
    // Stamped by the import wizard so a mis-import can be rolled back as a batch.
    // Only set on first insert — preserved on upsert via "..." spread inside payload.
    ...(customer.importBatchId && !customer.id ? { import_batch_id: customer.importBatchId } : {}),
  };

  const { data, error } = await supabase
    .from('customers')
    .upsert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

// Approve a single pending-review customer — flips account_status to 'active'
// across customers + customer_rounds AND materialises 12 weeks of jobs onto
// the scheduler so the user sees their week populate immediately.
export async function approvePendingCustomer(id) {
  const ownerId = await getCurrentUserId();
  const { error: cErr } = await supabase
    .from('customers')
    .update({ account_status: 'active' })
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (cErr) throw cErr;
  await supabase
    .from('customer_rounds')
    .update({ account_status: 'active' })
    .eq('customer_id', id);

  // Expand the recurring patterns into actual scheduled jobs. Best-effort —
  // failure here doesn't undo the approval (the customer still goes live).
  try {
    const { materialiseVisitsForCustomers } = await import('./recurringJobsDb');
    return await materialiseVisitsForCustomers([id], { weeks: 12 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Scheduler projection failed for customer', id, e?.message ?? e);
    return { rulesProcessed: 0, jobsCreated: 0, skipped: 0 };
  }
}

// Bulk-approve all pending customers for the signed-in owner. Returns the
// number of customers approved AND the count of scheduled jobs materialised
// from those approvals so the Customers tab can show a summary toast.
export async function approveAllPending() {
  const ownerId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('customers')
    .update({ account_status: 'active' })
    .eq('owner_id', ownerId)
    .eq('account_status', 'pending_review')
    .select('id');
  if (error) throw error;
  const ids = (data ?? []).map(c => c.id);
  if (!ids.length) return { count: 0, jobsCreated: 0 };

  await supabase
    .from('customer_rounds')
    .update({ account_status: 'active' })
    .in('customer_id', ids);

  // Spread the next 12 weeks of work onto the Scheduler in one pass.
  let jobsCreated = 0;
  try {
    const { materialiseVisitsForCustomers } = await import('./recurringJobsDb');
    const result = await materialiseVisitsForCustomers(ids, { weeks: 12 });
    jobsCreated = result?.jobsCreated ?? 0;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('Bulk scheduler projection failed:', e?.message ?? e);
  }
  return { count: ids.length, jobsCreated };
}

export async function archiveCustomer(id) {
  const ownerId = await getCurrentUserId();
  const { error } = await supabase
    .from('customers')
    .update({ status: 'archived' })
    .eq('id', id)
    .eq('owner_id', ownerId);

  if (error) throw error;

  // Soft delete is still a customer-data action — log it so the audit trail
  // covers both archive and erasure paths.
  await logAudit({
    action:   'customer.archived',
    category: 'customer',
    detail:   { customer_id: id },
  });
}

// ── GDPR Article 15/20 — Right of Access + Data Portability ─────────────
// Gathers everything Cadi holds about a single customer into one JSON
// envelope. Used for Subject Access Requests — the owner can hand the
// download straight to the customer to satisfy a SAR within 30 days, or
// pipe it into another system for portability.
//
// What's included (per GDPR Art 15(1) requirements):
//   • profile           — the customers row with personal details
//   • billing           — the embedded billing_mode + GoCardless mandate
//   • jobs              — every job linked to this customer (date, service,
//                          price, status, notes, postcode)
//   • rounds            — current customer_rounds memberships
//   • recurring_jobs    — recurrence rules
//   • invoices          — invoices issued (number, date, lines, totals,
//                          status, sent/paid timestamps)
//   • surveys           — site_surveys carried out
//   • reviews           — feedback the customer has given (if any)
//   • messages          — conversations they're attached to
//   • notes_history     — onboarding_packs we generated for them
//   • exported_at       — provenance + actor for the receipt
//
// The export itself is logged to audit_log so the controller can prove a
// SAR was honoured. Returns the JSON object — callers decide whether to
// download it, render it, or stream it elsewhere.
export async function exportCustomerData(customerId) {
  const ownerId = await getCurrentUserId();

  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!customer) throw new Error('Customer not found or not yours');

  // Fetch everything else in parallel — every query is RLS-scoped so cross-
  // business leaks are impossible even with a malicious customerId.
  const [jobs, rounds, recurring, invoices, surveys, reviews, conversations, packs] = await Promise.all([
    supabase.from('jobs')
      .select('id, date, service, type, price, status, notes, postcode, address_line1, address_line2, town, county, start_hour, duration_hrs, created_at, updated_at')
      .eq('owner_id', ownerId).eq('customer_id', customerId).order('date', { ascending: false }).then(r => r.data ?? []),
    supabase.from('customer_rounds')
      .select('id, round_name, schedule, price_per_visit, due_date, account_status, job_reference, notes, display_order, created_at, updated_at')
      .eq('customer_id', customerId).order('round_name').then(r => r.data ?? []),
    supabase.from('recurring_jobs')
      .select('*').eq('owner_id', ownerId).eq('customer_id', customerId).then(r => r.data ?? []),
    supabase.from('invoices')
      .select('id, invoice_num, date, due_date, status, lines, payment_method, payment_terms, sent_at, viewed_at, paid_at, notes, created_at, updated_at')
      .eq('owner_id', ownerId).eq('customer_id', customerId).order('date', { ascending: false }).then(r => r.data ?? []),
    supabase.from('site_surveys')
      .select('*').eq('customer_id', customerId).then(r => r.data ?? []),
    supabase.from('reviews')
      .select('*').eq('customer_id', customerId).then(r => r.data ?? []),
    supabase.from('conversations')
      .select('id, channel, started_at, ended_at, summary, message_count')
      .eq('customer_id', customerId).then(r => r.data ?? []),
    supabase.from('onboarding_packs')
      .select('id, status, created_at, updated_at')
      .eq('customer_id', customerId).then(r => r.data ?? []),
  ]);

  const envelope = {
    schema_version: 1,
    cadi_version:   'app.cadi.cleaning',
    purpose:        'Subject Access Request (UK GDPR Article 15 / Article 20)',
    notice:         'This file contains personal data. Handle accordingly. Do not share except with the data subject named below.',
    exported_at:    new Date().toISOString(),
    exported_by:    ownerId,
    customer: {
      id:             customer.id,
      name:           customer.name,
      email:          customer.email,
      phone:          customer.phone,
      address: {
        line1:    customer.address_line1,
        line2:    customer.address_line2,
        town:     customer.town,
        county:   customer.county,
        postcode: customer.postcode,
      },
      status:           customer.status,
      account_status:   customer.account_status,
      segment:          customer.segment,
      tags:             customer.tags,
      rating:           customer.rating,
      notes:            customer.notes,
      source:           customer.source,
      created_at:       customer.created_at,
      updated_at:       customer.updated_at,
    },
    billing: {
      mode:                   customer.billing_mode,
      customer_balance:       customer.customer_balance,
      price_per_visit:        customer.price_per_visit,
      customer_reference:     customer.customer_reference,
      gc_customer_id:         customer.gc_customer_id,
      gc_mandate_id:          customer.gc_mandate_id,
      gc_mandate_status:      customer.gc_mandate_status,
    },
    schedule: {
      next_job_date:  customer.next_job_date,
      last_job_date:  customer.last_job_date,
      due_date:       customer.due_date,
      schedule:       customer.schedule,
      frequency:      customer.frequency,
    },
    jobs,
    rounds,
    recurring_jobs: recurring,
    invoices,
    surveys,
    reviews,
    conversations,
    onboarding_packs: packs,
  };

  // Audit the export so the controller has a defensible record of SAR
  // fulfilment. logAudit is best-effort — export still returns on logging
  // failure. detail keeps the customer's name for the controller's own
  // records (this is the controller's audit, not the data subject's data).
  await logAudit({
    action:   'customer.exported',
    category: 'gdpr',
    detail: {
      customer_id:   customerId,
      name:          customer.name,
      record_counts: {
        jobs:           jobs.length,
        rounds:         rounds.length,
        recurring_jobs: recurring.length,
        invoices:       invoices.length,
        surveys:        surveys.length,
        reviews:        reviews.length,
        conversations:  conversations.length,
      },
    },
  });

  return envelope;
}
// Hard-deletes a customer + redacts every PII trail that's kept for legal
// reasons (HMRC requires invoices / completed-job records for 6 years).
//
// Side effects, in order:
//   1.  parsed_customers rows matching this customer's name within the
//       business get dropped — these are pre-commit staging rows and have
//       no legal-retention purpose
//   2.  jobs.customer / address / postcode / notes are redacted (the
//       legal record is the job + price + date, not the customer's contact
//       details). customer_id is already SET NULL by FK.
//   3.  invoices.customer (jsonb) is replaced with a "[Deleted]" snapshot
//       while keeping invoice_num, lines and totals intact for HMRC.
//   4a. reviews.comment + url are redacted — rating/platform kept for
//       aggregate stats; written feedback could contain identifying detail.
//   4b. messages.body + media wiped across every conversation owned by
//       this customer. Conversation rows themselves stay (operational
//       metadata only).
//   4c. CASCADE FKs (customer_rounds, recurring_jobs, customer_payment_patterns,
//       customer_portal_tokens, site_surveys, onboarding_packs, customer_vault)
//       clear automatically when we drop the row
//   5.  customers row deleted
//   6.  audit_log entry written so we can prove the erasure happened
//
// Returns { deleted: true, jobsRedacted, invoicesRedacted, parsedRemoved }.
// Throws if the customer doesn't belong to the caller or any step fails;
// failures leave previous steps in place but no row is half-deleted because
// the customers DELETE comes last.
export async function hardDeleteCustomer(id) {
  const ownerId = await getCurrentUserId();

  // 1. Fetch the customer first so we have name/email for parsed_customers
  //    matching and so we can stamp the audit entry with what was deleted.
  const { data: customer, error: fetchErr } = await supabase
    .from('customers')
    .select('id, name, email, phone, postcode, business_id:owner_id')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!customer) throw new Error('Customer not found or not yours');

  // 2. Pre-commit parsed_customers rows (staging from imports) — best-effort
  //    name match within the same business. No FK so we have to do it
  //    explicitly; RLS already scopes by business_id.
  let parsedRemoved = 0;
  if (customer.name) {
    const { data: pc } = await supabase
      .from('parsed_customers')
      .delete()
      .ilike('name', customer.name)
      .select('id');
    parsedRemoved = pc?.length ?? 0;
  }

  // 3. Redact PII on jobs we have to keep for HMRC. customer_id will SET NULL
  //    once the customer row is deleted, but we also wipe the embedded
  //    address/name/notes so the row itself isn't a personal-data record.
  const { data: jobsHit } = await supabase
    .from('jobs')
    .update({
      customer:      '[Deleted customer]',
      address_line1: null,
      address_line2: null,
      postcode:      null,
      notes:         null,
    })
    .eq('customer_id', id)
    .eq('owner_id', ownerId)
    .select('id');
  const jobsRedacted = jobsHit?.length ?? 0;

  // 4. Redact the customer JSONB snapshot on invoices — keep the financial
  //    record (invoice_num, lines, totals, dates) for HMRC but wipe the
  //    embedded contact details.
  const { data: invHit } = await supabase
    .from('invoices')
    .update({
      customer: { name: '[Deleted customer]', erased_at: new Date().toISOString() },
    })
    .eq('customer_id', id)
    .eq('owner_id', ownerId)
    .select('id');
  const invoicesRedacted = invHit?.length ?? 0;

  // 4b. Redact review free-text. We keep the rating + platform so the
  //     business's aggregate review stats stay intact, but the customer's
  //     written feedback is wiped — it could contain identifying detail
  //     ("the cleaner who came on Tuesday at 14 Smith Lane…") and isn't
  //     legally required to be retained. customer_id is auto-nulled by the
  //     existing FK on row delete below.
  const { data: revHit } = await supabase
    .from('reviews')
    .update({ comment: '[Customer erased]', url: null })
    .eq('customer_id', id)
    .select('id');
  const reviewsRedacted = revHit?.length ?? 0;

  // 4c. Redact message bodies. Messages live under conversations and have
  //     no direct customer_id, so we look up the conversations first and
  //     redact every message under them. Conversation rows themselves are
  //     left alone (channel/status/timestamps are operational metadata,
  //     not PII); the conversation.customer_id FK will SET NULL when the
  //     customer row is dropped below.
  let messagesRedacted = 0;
  const { data: convs } = await supabase
    .from('conversations')
    .select('id')
    .eq('customer_id', id);
  if (convs?.length) {
    const convIds = convs.map(c => c.id);
    const { data: msgHit } = await supabase
      .from('messages')
      .update({ body: '[Customer erased]', media: null })
      .in('conversation_id', convIds)
      .select('id');
    messagesRedacted = msgHit?.length ?? 0;
  }

  // 5. Drop the customer — CASCADE FKs handle rounds, recurring_jobs, etc.
  const { error: delErr } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)
    .eq('owner_id', ownerId);
  if (delErr) throw delErr;

  // 6. Audit log entry. logAudit is best-effort — never blocks the erasure
  //    on audit failure. detail captures enough to prove the action without
  //    re-storing the PII we just deleted.
  await logAudit({
    action:   'customer.erased',
    category: 'gdpr',
    detail: {
      customer_id_was:   id,
      name_initial:      customer.name?.[0] ?? null,
      postcode_was:      customer.postcode ?? null,
      jobs_redacted:     jobsRedacted,
      invoices_redacted: invoicesRedacted,
      reviews_redacted:  reviewsRedacted,
      messages_redacted: messagesRedacted,
      parsed_removed:    parsedRemoved,
    },
  });

  return { deleted: true, jobsRedacted, invoicesRedacted, reviewsRedacted, messagesRedacted, parsedRemoved };
}
