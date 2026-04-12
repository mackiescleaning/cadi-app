import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { listCustomers, upsertCustomer } from '../lib/db/customersDb';
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
    lastJobDate: r.last_job_date || new Date().toISOString().slice(0, 10),
    nextJobDate: r.next_job_date || null,
    lifetimeValue: Number(r.lifetime_value) || 0,
    services: [],
    notes: r.notes || "",
    source: r.source || "",
  };
}

const DataContext = createContext({});

export function DataProvider({ children }) {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [jobs, setJobs] = useState(null); // null = not initialised yet

  // Load customers from Supabase
  useEffect(() => {
    if (!user) { setCustomers([]); return; }
    listCustomers()
      .then(rows => setCustomers(rows.map(mapRow)))
      .catch(() => setCustomers([]));
  }, [user]);

  // Load jobs from localStorage
  useEffect(() => {
    if (!user) { setJobs([]); return; }
    try {
      const stored = localStorage.getItem(`cadi_jobs_${user.id}`);
      setJobs(stored ? JSON.parse(stored) : []);
    } catch {
      setJobs([]);
    }
  }, [user]);

  // Persist jobs to localStorage whenever they change
  useEffect(() => {
    if (!user || jobs === null) return;
    try { localStorage.setItem(`cadi_jobs_${user.id}`, JSON.stringify(jobs)); } catch {}
  }, [jobs, user]);

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

  // Called by Scheduler when a job is saved — syncs to matching customer
  const addJobAndSyncCustomer = useCallback((job) => {
    setJobs(prev => [...(prev ?? []), job]);
    if (!job.customer) return;
    setCustomers(prev => {
      const jobNameLower = job.customer.toLowerCase().trim();
      const match = prev.find(c => {
        const n = c.name.toLowerCase().trim();
        const first = n.split(' ')[0];
        return n === jobNameLower || first === jobNameLower || jobNameLower.startsWith(first);
      });
      if (!match) return prev;
      const newService = {
        type: job.type,
        label: job.service,
        date: job.date || new Date().toISOString().slice(0, 10),
        price: job.price,
        status: job.status || 'scheduled',
      };
      const updated = {
        ...match,
        services: [...(match.services || []), newService],
        lifetimeValue: (match.lifetimeValue || 0) + (job.price || 0),
        lastJobDate: job.date || match.lastJobDate,
      };
      upsertCustomer(updated).catch(() => {});
      return prev.map(c => c.id === match.id ? updated : c);
    });
  }, []);

  return (
    <DataContext.Provider value={{
      customers, setCustomers, addCustomer, updateCustomer,
      jobs, setJobs, addJobAndSyncCustomer,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export const useData = () => useContext(DataContext);
