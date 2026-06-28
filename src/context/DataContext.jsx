import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listCustomers, upsertCustomer, archiveCustomer, hardDeleteCustomer } from '../lib/db/customersDb';
import { createJob, listJobs, updateJob as updateJobDb, deleteJob as deleteJobDb } from '../lib/db/jobsDb';
import { onJobCompleted } from '../lib/billing';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';

function mapRow(r) {
  return {
    id: r.id,
    name: r.name || "Customer",
    postcode: r.postcode || "",
    phone: r.phone || "",
    email: r.email || "",
    frequency: r.frequency || "one-off",
    status: r.status || "active",
    rating: Number(r.rating) || 0,
    serviceTypes: Array.isArray(r.service_types) ? r.service_types : [],
    tags: Array.isArray(r.tags) ? r.tags : [],
    lastJobDate: r.last_job_date || null,
    nextJobDate: r.next_job_date || null,
    lifetimeValue: Number(r.lifetime_value) || 0,
    completedJobs: 0,
    services: [],
    notes: r.notes || "",
    source: r.source || "",
    gc_customer_id: r.gc_customer_id || null,
    gc_mandate_id: r.gc_mandate_id || null,
    gc_mandate_status: r.gc_mandate_status || null,
    billing_mode: r.billing_mode || 'invoice_per_job',
    // Billing-state aggregates from customers_with_billing view (mig 050).
    // paidLifetimeValue counts paid invoices; outstandingBalance counts
    // sent/overdue/viewed (anything non-draft, non-cancelled, not paid).
    paidLifetimeValue:   Number(r.paid_lifetime_value) || 0,
    outstandingBalance:  Number(r.outstanding_balance) || 0,
    unpaidInvoiceCount:  Number(r.unpaid_invoice_count) || 0,
    oldestUnpaidDate:    r.oldest_unpaid_date || null,
    // Catalogue-aware + import-aware fields. Used by the Customers tab to
    // surface what was just imported and to drive the pending-review flow.
    accountStatus:      r.account_status || 'active',
    importBatchId:      r.import_batch_id || null,
    pricePerVisit:      r.price_per_visit != null ? Number(r.price_per_visit) : null,
    schedule:           r.schedule || null,
    dueDate:            r.due_date || null,
    customerReference:  r.customer_reference || null,
    roundName:          r.round_name || null,
    addressLine1:       r.address_line1 || null,
    addressLine2:       r.address_line2 || null,
    town:               r.town || null,
    county:             r.county || null,
    category:           r.category || null,
    birthday:           r.birthday || null,
    customerSince:      r.customer_since || r.created_at?.slice(0, 10) || null,
    createdAt:          r.created_at || null,
  };
}

function isCompletedJob(j, today) {
  return j.status === 'complete' || (j.date && j.date < today);
}

function mapJobRow(r) {
  return {
    id: r.id,
    customer: r.customer || '',
    customerId: r.customer_id || null,
    addressLine1: r.address_line1 || null,
    addressLine2: r.address_line2 || null,
    town: r.town || null,
    county: r.county || null,
    postcode: r.postcode || '',
    date: r.date,
    startHour: Number(r.start_hour) || 9,
    durationHrs: Number(r.duration_hrs) || 2,
    displayOrder: Number(r.display_order) || 0,
    type: r.type || 'residential',
    service: r.service || '',
    price: Number(r.price) || 0,
    status: r.status || 'scheduled',
    assignee: r.assignee || null,
    assignees: r.assignees || [],
    assigneeIds: r.assignee_ids || [],
    recurrence: r.recurrence || 'one-off',
    notes: r.notes || '',
    seriesId: r.series_id || null,
    day: 0, // will be computed by consumers
  };
}

const DataContext = createContext({});

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Load customers from Supabase
  useEffect(() => {
    if (!user) { setCustomers([]); return; }
    listCustomers({ pageSize: 2000 })
      .then(rows => setCustomers(rows.map(mapRow)))
      .catch(() => setCustomers([]));
  }, [user]);

  const refreshCustomers = useCallback(() => {
    if (!user) return;
    listCustomers({ pageSize: 2000 })
      .then(rows => setCustomers(rows.map(mapRow)))
      .catch(() => {});
  }, [user]);

  // Load jobs from Supabase — scoped to ±6 months so the query stays fast as history grows
  useEffect(() => {
    if (!user) { setJobs([]); return; }
    setJobsLoading(true);

    const now  = new Date();
    const from = new Date(now); from.setMonth(from.getMonth() - 6);
    const to   = new Date(now); to.setMonth(to.getMonth() + 4);
    const dateFrom = from.toISOString().slice(0, 10);
    const dateTo   = to.toISOString().slice(0, 10);

    // Try Supabase first
    listJobs({ from: dateFrom, to: dateTo, pageSize: 2000 })
      .then(rows => {
        if (rows.length > 0) {
          setJobs(rows.map(mapJobRow));
        } else {
          // Migrate any legacy localStorage jobs
          try {
            const stored = localStorage.getItem(`cadi_jobs_${user.id}`);
            if (stored) {
              const legacyJobs = JSON.parse(stored);
              if (Array.isArray(legacyJobs) && legacyJobs.length > 0) {
                // Save each to Supabase, then clear localStorage
                Promise.all(legacyJobs.map(j => createJob(j).catch(() => null)))
                  .then(() => {
                    localStorage.removeItem(`cadi_jobs_${user.id}`);
                    return listJobs();
                  })
                  .then(fresh => setJobs(fresh.map(mapJobRow)))
                  .catch(() => setJobs(legacyJobs)); // fallback to legacy if migration fails
              }
            }
          } catch {
            // localStorage unavailable or corrupt — fine, start empty
          }
        }
      })
      .catch(() => {
        // Supabase failed — try localStorage as readonly fallback
        try {
          const stored = localStorage.getItem(`cadi_jobs_${user.id}`);
          setJobs(stored ? JSON.parse(stored) : []);
        } catch {
          setJobs([]);
        }
      })
      .finally(() => setJobsLoading(false));
  }, [user]);

  // Realtime: keep the scheduler live when staff update job statuses
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`jobs-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `owner_id=eq.${user.id}` },
        (payload) => {
          setJobs(prev => prev.map(j => j.id === payload.new.id ? mapJobRow(payload.new) : j));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Hydrate customer services from jobs table (runs after both load)
  // Split completed vs scheduled so lifetime value / totals don't include future jobs
  useEffect(() => {
    if (!jobs.length || !customers.length) return;
    const today = new Date().toISOString().slice(0, 10);
    setCustomers(prev => prev.map(c => {
      const customerJobs = jobs.filter(j =>
        j.customerId === c.id ||
        (j.customer && c.name && j.customer.toLowerCase().trim() === c.name.toLowerCase().trim())
      );
      if (customerJobs.length === 0) return c;
      const completed = customerJobs.filter(j => isCompletedJob(j, today));
      const scheduled = customerJobs.filter(j => !isCompletedJob(j, today));
      return {
        ...c,
        services: customerJobs.map(j => ({
          type: j.type || 'residential',
          label: j.service || 'Clean',
          date: j.date || '',
          price: j.price || 0,
          status: j.status || 'scheduled',
        })),
        lifetimeValue: completed.reduce((s, j) => s + (j.price || 0), 0),
        completedJobs: completed.length,
        lastJobDate: completed.reduce((latest, j) => (j.date && j.date > latest) ? j.date : latest, '') || null,
        nextJobDate: scheduled.reduce((earliest, j) => (!earliest || (j.date && j.date < earliest)) ? j.date : earliest, null),
      };
    }));
  }, [jobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCustomer = useCallback(async (id) => {
    try {
      await archiveCustomer(id);
    } catch (err) {
      console.error('Failed to archive customer:', err);
    }
    setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  // GDPR erasure — surfaced separately from `deleteCustomer` so we don't
  // accidentally hard-delete on a code path that meant archive. Re-throws
  // so the caller can show progress / a receipt rather than silently
  // dropping rows on RLS failure.
  const eraseCustomer = useCallback(async (id) => {
    const result = await hardDeleteCustomer(id);
    setCustomers(prev => prev.filter(c => c.id !== id));
    return result;
  }, []);

  const isDemo = user?.id === 'demo-user';

  const addCustomer = useCallback(async (customer) => {
    if (!isDemo) {
      try {
        await upsertCustomer(customer);
      } catch (err) {
        console.error('Failed to save customer to Supabase:', err);
        throw err;
      }
    }
    setCustomers(prev => [customer, ...prev.filter(c => c.id !== customer.id)]);
    return customer;
  }, [isDemo]);

  const updateCustomer = useCallback(async (id, updates) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updates };
      if (!isDemo) {
        upsertCustomer(updated).catch(err => {
          console.error('Failed to update customer in Supabase:', err);
        });
      }
      return updated;
    }));
  }, [isDemo]);

  // ── Customer-totals sync ───────────────────────────────────────────────
  // Every job mutation (add / update / delete) potentially shifts the
  // owning customer's lifetimeValue, completedJobs, lastJobDate and
  // nextJobDate. Doing this in one shared helper keeps the four totals in
  // sync regardless of which path triggers the change.
  //
  // Resolution order for the customer link:
  //   1. job.customerId — set on every job created since the NewJobModal
  //      capture fix (task #3). Authoritative.
  //   2. fuzzy name match — fallback for legacy jobs created before that
  //      fix. Best-effort: first-word match, exact match, or startsWith.
  const findCustomerForJob = useCallback((job) => {
    if (!job) return null;
    if (job.customerId) {
      const hit = customers.find(c => c.id === job.customerId);
      if (hit) return hit;
    }
    if (job.customer) {
      const jn = String(job.customer).toLowerCase().trim();
      return customers.find(c => {
        const n = (c.name || '').toLowerCase().trim();
        if (!n) return false;
        const first = n.split(' ')[0];
        return n === jn || first === jn || jn.startsWith(first);
      }) ?? null;
    }
    return null;
  }, [customers]);

  // Same completion semantics across all three paths: explicit 'complete'
  // status, or a scheduled job whose date has passed. Cancelled/unassigned
  // don't count toward lifetime or completed totals.
  const isJobCompleted = useCallback((job, today) => {
    if (!job) return false;
    if (job.status === 'complete') return true;
    if (job.status === 'cancelled' || job.status === 'unassigned') return false;
    return Boolean(job.date && job.date <= today);
  }, []);

  // Compute the updated customer record for a job transition. Either `prior`
  // or `next` may be null (add → prior=null, delete → next=null, update →
  // both set). Returns null when there's no matching customer to update.
  const computeCustomerSync = useCallback((prior, next) => {
    const job = next || prior;
    const customer = findCustomerForJob(job);
    if (!customer) return null;

    const today = new Date().toISOString().slice(0, 10);
    const priorIncome = isJobCompleted(prior, today) ? (Number(prior?.price) || 0) : 0;
    const nextIncome  = isJobCompleted(next,  today) ? (Number(next?.price)  || 0) : 0;
    const lifetimeDelta  = nextIncome - priorIncome;
    const completedDelta = (isJobCompleted(next, today) ? 1 : 0) - (isJobCompleted(prior, today) ? 1 : 0);

    // Recompute last/next dates across the customer's other jobs plus the
    // post-mutation state of this one. Avoids drift from cumulative deltas.
    const others = jobs.filter(j => j.id !== job.id).filter(j => (
      (j.customerId && j.customerId === customer.id) ||
      (!j.customerId && j.customer && customer.name &&
       String(j.customer).toLowerCase().trim() === customer.name.toLowerCase().trim())
    ));
    const all = next ? [...others, next] : others;
    const completedDates = all.filter(j => isJobCompleted(j, today)).map(j => j.date).filter(Boolean).sort();
    const upcomingDates  = all.filter(j => !isJobCompleted(j, today) && j.date && j.date >= today).map(j => j.date).filter(Boolean).sort();

    return {
      customer,
      patch: {
        lifetimeValue: Math.max(0, (customer.lifetimeValue || 0) + lifetimeDelta),
        completedJobs: Math.max(0, (customer.completedJobs || 0) + completedDelta),
        lastJobDate:   completedDates[completedDates.length - 1] ?? null,
        nextJobDate:   upcomingDates[0] ?? null,
      },
    };
  }, [findCustomerForJob, isJobCompleted, jobs]);

  // Applies the patch returned by computeCustomerSync to both local state
  // and Supabase. Best-effort on the DB write — local state is the
  // authoritative view for this session and refreshCustomers reconciles.
  const persistCustomerSync = useCallback((sync) => {
    if (!sync) return;
    const updated = { ...sync.customer, ...sync.patch };
    setCustomers(prev => prev.map(c => c.id === sync.customer.id ? updated : c));
    if (!isDemo) {
      upsertCustomer(updated).catch(err => {
        // eslint-disable-next-line no-console
        console.warn('customer totals sync failed', err?.message ?? err);
      });
    }
  }, [isDemo]);

  // Called by Scheduler when a job is saved — saves to Supabase + syncs customer
  // totals via the shared helper. customerId-first (task #3) so we don't
  // mis-credit when two customers share a first name.
  const addJobAndSyncCustomer = useCallback(async (job) => {
    let savedJob = job;
    try {
      const result = await createJob(job);
      savedJob = mapJobRow(result);
    } catch (err) {
      console.error('Failed to save job to Supabase:', err);
      // Still add locally so UI updates
      savedJob = { ...job, id: job.id || Date.now() };
    }

    setJobs(prev => [...prev, savedJob]);

    // Sync customer totals — new job = prior null, next = savedJob.
    const sync = computeCustomerSync(null, savedJob);
    if (sync) {
      // Also append a service entry so the customer profile's "Services"
      // chips reflect what they're now booked for. This was the only piece
      // of the old name-match path the helper doesn't cover.
      const today = new Date().toISOString().slice(0, 10);
      const services = [
        ...(sync.customer.services || []),
        {
          type:   savedJob.type,
          label:  savedJob.service,
          date:   savedJob.date || today,
          price:  savedJob.price,
          status: savedJob.status || 'scheduled',
        },
      ];
      persistCustomerSync({
        customer: sync.customer,
        patch:    { ...sync.patch, services },
      });
    }
  }, [computeCustomerSync, persistCustomerSync]);

  // Persist first, then update local state — and re-throw so callers can
  // react (toast, revert optimistic UI, etc). Previously this swallowed
  // errors AND updated local state regardless, hiding any RLS / network
  // failure from the user. That meant the Scheduler's drag-and-drop would
  // appear to succeed while silently failing to save.
  const updateJob = useCallback(async (id, updates) => {
    // Capture the prior status before the DB write so we can detect a
    // transition into 'complete' afterwards and trigger billing only once.
    const prior = jobs.find(j => j.id === id);
    const wasComplete = prior?.status === 'complete';

    await updateJobDb(id, updates);
    // Normalise DB column names (snake_case) → local state names (camelCase)
    const local = { ...updates };
    if ('start_hour'   in local) { local.startHour   = local.start_hour;   delete local.start_hour; }
    if ('duration_hrs' in local) { local.durationHrs = local.duration_hrs; delete local.duration_hrs; }
    if ('display_order' in local) { local.displayOrder = local.display_order; delete local.display_order; }
    if ('customer_id'  in local) { local.customerId  = local.customer_id;  delete local.customer_id; }
    if ('assignee_ids' in local) { local.assigneeIds = local.assignee_ids; delete local.assignee_ids; }
    if ('address_line1' in local) { local.addressLine1 = local.address_line1; delete local.address_line1; }
    if ('address_line2' in local) { local.addressLine2 = local.address_line2; delete local.address_line2; }
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...local } : j));

    // Sync customer totals on every job change — lifetimeValue / completedJobs
    // / lastJobDate / nextJobDate all shift with status, date, or price.
    // The previous implementation only ran sync on creation, which left
    // the customer record stale after every later Done toggle or delete.
    const nextJob = { ...(prior || {}), ...local, id };
    persistCustomerSync(computeCustomerSync(prior, nextJob));

    // Billing trigger — only fires on the scheduled → complete transition so
    // we don't redraft on every later field tweak. `onJobCompleted` is
    // intentionally async-and-forget: invoicing failures must not roll back
    // the status change. The user will see the resulting invoice (or absence
    // of one) in the Money tab.
    if (updates.status === 'complete' && !wasComplete) {
      const customer = findCustomerForJob(nextJob);
      onJobCompleted(nextJob, customer).catch(() => {});
    }
  }, [jobs, computeCustomerSync, persistCustomerSync, findCustomerForJob]);

  const deleteJob = useCallback(async (id) => {
    const prior = jobs.find(j => j.id === id);
    await deleteJobDb(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    // Decrement customer totals — deleting a completed job means the
    // lifetime value and completedJobs count should both drop by that
    // job's contribution. computeCustomerSync handles signs and floors.
    if (prior) persistCustomerSync(computeCustomerSync(prior, null));
  }, [jobs, computeCustomerSync, persistCustomerSync]);

  const refreshJobs = useCallback(async () => {
    try {
      const rows = await listJobs();
      setJobs(rows.map(mapJobRow));
    } catch {}
  }, []);

  // Customer counts for plan limit enforcement
  const resComCount = customers.filter(c => {
    const types = c.serviceTypes || [];
    return !types.includes('exterior') || types.length > 1 || types.length === 0;
  }).length;
  const exteriorCount = customers.filter(c => {
    const types = c.serviceTypes || [];
    return types.length === 1 && types.includes('exterior');
  }).length;

  return (
    <DataContext.Provider value={{
      customers, setCustomers, addCustomer, updateCustomer, deleteCustomer, eraseCustomer, refreshCustomers,
      resComCount, exteriorCount,
      jobs, setJobs, addJobAndSyncCustomer, updateJob, deleteJob, refreshJobs, jobsLoading,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
