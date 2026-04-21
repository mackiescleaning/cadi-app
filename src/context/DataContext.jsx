import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listCustomers, upsertCustomer, archiveCustomer } from '../lib/db/customersDb';
import { createJob, listJobs, updateJob as updateJobDb, deleteJob as deleteJobDb } from '../lib/db/jobsDb';
import { useAuth } from './AuthContext';

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
    postcode: r.postcode || '',
    date: r.date,
    startHour: Number(r.start_hour) || 9,
    durationHrs: Number(r.duration_hrs) || 2,
    type: r.type || 'residential',
    service: r.service || '',
    price: Number(r.price) || 0,
    status: r.status || 'scheduled',
    assignee: r.assignee || null,
    assignees: r.assignees || [],
    recurrence: r.recurrence || 'one-off',
    notes: r.notes || '',
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
    listCustomers()
      .then(rows => setCustomers(rows.map(mapRow)))
      .catch(() => setCustomers([]));
  }, [user]);

  // Load jobs from Supabase
  useEffect(() => {
    if (!user) { setJobs([]); return; }
    setJobsLoading(true);

    // Try Supabase first
    listJobs()
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

  const addCustomer = useCallback(async (customer) => {
    try { await upsertCustomer(customer); } catch {}
    setCustomers(prev => [customer, ...prev.filter(c => c.id !== customer.id)]);
    return customer;
  }, []);

  const updateCustomer = useCallback(async (id, updates) => {
    setCustomers(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = { ...c, ...updates };
      upsertCustomer(updated).catch(() => {});
      return updated;
    }));
  }, []);

  // Called by Scheduler when a job is saved — saves to Supabase + syncs customer
  const addJobAndSyncCustomer = useCallback(async (job) => {
    // Save to Supabase
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

    // Sync to matching customer — only count toward lifetime/completed if the job is done
    if (!job.customer) return;
    setCustomers(prev => {
      const jobNameLower = job.customer.toLowerCase().trim();
      const match = prev.find(c => {
        const n = c.name.toLowerCase().trim();
        const first = n.split(' ')[0];
        return n === jobNameLower || first === jobNameLower || jobNameLower.startsWith(first);
      });
      if (!match) return prev;
      const today = new Date().toISOString().slice(0, 10);
      const isDone = isCompletedJob(savedJob, today);
      const newService = {
        type: savedJob.type,
        label: savedJob.service,
        date: savedJob.date || today,
        price: savedJob.price,
        status: savedJob.status || 'scheduled',
      };
      const updated = {
        ...match,
        services: [...(match.services || []), newService],
        lifetimeValue: (match.lifetimeValue || 0) + (isDone ? (savedJob.price || 0) : 0),
        completedJobs: (match.completedJobs || 0) + (isDone ? 1 : 0),
        lastJobDate: isDone && savedJob.date ? savedJob.date : match.lastJobDate,
        nextJobDate: (!isDone && savedJob.date && (!match.nextJobDate || savedJob.date < match.nextJobDate))
          ? savedJob.date
          : match.nextJobDate,
      };
      upsertCustomer(updated).catch(() => {});
      return prev.map(c => c.id === match.id ? updated : c);
    });
  }, []);

  const updateJob = useCallback(async (id, updates) => {
    // Update in Supabase
    try {
      await updateJobDb(id, updates);
    } catch (err) {
      console.error('Failed to update job:', err);
    }
    // Update locally
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
  }, []);

  const deleteJob = useCallback(async (id) => {
    try {
      await deleteJobDb(id);
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
    setJobs(prev => prev.filter(j => j.id !== id));
  }, []);

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
      customers, setCustomers, addCustomer, updateCustomer, deleteCustomer,
      resComCount, exteriorCount,
      jobs, setJobs, addJobAndSyncCustomer, updateJob, deleteJob, refreshJobs, jobsLoading,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
