// billing.js — branches off the customer's billing_mode when a job is
// marked complete and produces the right invoice action.
//
//   invoice_per_job  → fresh draft invoice for every completed job
//   invoice_monthly  → one accumulator invoice per (customer, current month);
//                       new jobs append a line to the existing draft instead
//                       of creating a new one
//   gocardless       → invoice draft tagged `payment_method = 'gocardless_pending'`
//                       so a later webhook / cron picks it up for direct-debit
//                       collection against the saved mandate
//   stripe           → invoice draft tagged `payment_method = 'stripe_pending'`
//                       so the next send-invoice run emails a Stripe payment link
//
// All paths persist a draft invoice — nothing is auto-sent or auto-charged
// here. The provider integrations (send-invoice edge fn, GoCardless mandate
// flow, Stripe webhook) pick the draft up downstream. That keeps the trigger
// safe to call on every status-change without surprise side effects.

import { supabase } from './supabase';
import { getCurrentUserId } from './db/authDb';
import { createInvoice, updateInvoice } from './db/invoiceDb';

function ymKey(date) {
  // date is 'YYYY-MM-DD' or a Date. Returns the first of that month as ISO date.
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function lineFor(job) {
  // Each completed job becomes one invoice line. Description is intentionally
  // human-readable so the customer recognises it on the invoice.
  return {
    job_id: job.id,
    description: [job.service, job.customer, job.date].filter(Boolean).join(' · '),
    date: job.date,
    quantity: 1,
    unit_price: Number(job.price) || 0,
    total: Number(job.price) || 0,
  };
}

async function nextInvoiceNumber() {
  // Cheap, owner-scoped invoice numbering. Pulls the highest INV-#### the
  // user already has and increments. Race conditions across rapid completions
  // would only produce duplicate numbers in the unlikely event of two
  // concurrent saves — we accept that for v1 and tighten with a DB sequence
  // if it ever shows up in support.
  const ownerId = await getCurrentUserId();
  const { data } = await supabase
    .from('invoices')
    .select('invoice_num')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1);
  const last = data?.[0]?.invoice_num ?? 'INV-0000';
  const n = parseInt(String(last).replace(/\D+/g, ''), 10) || 0;
  return `INV-${String(n + 1).padStart(4, '0')}`;
}

function customerSnapshot(customer) {
  // Embedded into invoices.customer (jsonb) so deleting the customer record
  // later doesn't blank the invoice. This is what the InvoiceGenerator already
  // expects in its rendering code.
  if (!customer) return {};
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email ?? null,
    phone: customer.phone ?? null,
    addressLine1: customer.addressLine1 ?? customer.address_line1 ?? null,
    addressLine2: customer.addressLine2 ?? customer.address_line2 ?? null,
    town: customer.town ?? null,
    postcode: customer.postcode ?? null,
  };
}

function paymentTermsFor(mode) {
  // 0 for auto-collect modes — the invoice is for the customer's records, the
  // money is already on its way. 14 days for everything else (UK norm).
  return mode === 'gocardless' || mode === 'stripe' ? 0 : 14;
}

// ── Per-mode handlers ──────────────────────────────────────────────────────

async function createPerJobInvoice(job, customer, paymentMethod) {
  const num = await nextInvoiceNumber();
  return createInvoice({
    invoiceNum: num,
    customerId: customer?.id ?? null,
    customer: customerSnapshot(customer),
    lines: [lineFor(job)],
    date: job.date ?? new Date().toISOString().slice(0, 10),
    dueDate: null,
    type: job.type ?? 'residential',
    status: 'draft',
    paymentTerms: paymentTermsFor(customer?.billingMode || customer?.billing_mode),
    paymentMethod: paymentMethod ?? null,
    notes: '',
  });
}

async function appendToMonthlyInvoice(job, customer) {
  const ownerId = await getCurrentUserId();
  const monthStart = ymKey(job.date ?? new Date());

  // Find an existing draft accumulator for this customer + month.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, lines')
    .eq('owner_id', ownerId)
    .eq('customer_id', customer?.id ?? null)
    .eq('status', 'draft')
    .eq('date', monthStart)
    .limit(1);

  const newLine = lineFor(job);

  if (existing?.[0]) {
    // Skip if this job already has a line in the invoice (re-completion).
    const lines = Array.isArray(existing[0].lines) ? existing[0].lines : [];
    if (lines.some((l) => l.job_id === job.id)) return existing[0];
    return updateInvoice(existing[0].id, { lines: [...lines, newLine] });
  }

  // First completed job of the month for this customer — create the
  // accumulator. The owner can rename it later if they want.
  const num = await nextInvoiceNumber();
  return createInvoice({
    invoiceNum: num,
    customerId: customer?.id ?? null,
    customer: customerSnapshot(customer),
    lines: [newLine],
    date: monthStart,
    type: job.type ?? 'residential',
    status: 'draft',
    paymentTerms: paymentTermsFor('invoice_monthly'),
    notes: `Monthly bundle for ${new Date(monthStart + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
  });
}

// ── Public entry point ─────────────────────────────────────────────────────

// Called when a job transitions to status='complete'. Returns the resulting
// invoice on success, or null if there was nothing to do (no customer link,
// no price). Never throws — billing must not block the status update; if
// invoicing fails the owner still has the completed job and can re-trigger
// from the Money tab.
export async function onJobCompleted(job, customer) {
  if (!job || !job.price || Number(job.price) <= 0) return null;
  if (!customer) return null;

  const mode = customer.billingMode || customer.billing_mode || 'invoice_per_job';

  try {
    switch (mode) {
      case 'invoice_monthly':
        return await appendToMonthlyInvoice(job, customer);
      case 'gocardless':
        return await createPerJobInvoice(job, customer, 'gocardless_pending');
      case 'stripe':
        return await createPerJobInvoice(job, customer, 'stripe_pending');
      case 'bacs':
        return await createPerJobInvoice(job, customer, 'bacs');
      case 'cash':
        return await createPerJobInvoice(job, customer, 'cash');
      case 'invoice_per_job':
      default:
        return await createPerJobInvoice(job, customer, null);
    }
  } catch (err) {
    // Surfaced via console for now; the Money tab will show the invoice once
    // the user fixes the underlying issue (e.g. missing price/customer).
    console.warn('onJobCompleted: invoice draft failed', err);
    return null;
  }
}

// Allowed values for UI selects.
export const BILLING_MODES = [
  {
    key: 'invoice_per_job',
    label: 'Invoice per job',
    hint: 'A fresh draft invoice is created each time a job is marked done.',
  },
  {
    key: 'invoice_monthly',
    label: 'Monthly bundle',
    hint: 'Completed jobs accumulate into one draft invoice per month.',
  },
  {
    key: 'gocardless',
    label: 'GoCardless (direct debit)',
    hint: 'Invoice is drafted and queued for automatic collection against the saved mandate.',
  },
  {
    key: 'stripe',
    label: 'Stripe (card)',
    hint: 'Invoice is drafted and emailed with a Stripe payment link.',
  },
  {
    key: 'bacs',
    label: 'BACS (bank transfer)',
    hint: 'Invoice is drafted with your bank details. Mark paid when the transfer lands.',
  },
  {
    key: 'cash',
    label: 'Cash on the day',
    hint: 'A receipt is drafted for your records. Mark paid when you collect.',
  },
];
