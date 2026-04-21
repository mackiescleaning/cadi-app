// src/context/InvoiceContext.jsx
// Single source of truth for all invoice data across the app.
// Used by: InvoiceGenerator (CRUD), MoneyTracker (IncomeStream), AccountsTab (Invoice Records)

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import {
  listInvoices as fetchInvoices,
  createInvoice as dbCreateInvoice,
  updateInvoice as dbUpdateInvoice,
  deleteInvoice as dbDeleteInvoice,
  getNextInvoiceNum,
} from "../lib/db/invoiceDb";

// ─── Demo invoices (only for non-logged-in users) ────────────────────────────
export const SHARED_DEMO_INVOICES = [
  {
    id: "INV-1041", num: "INV-1041",
    customer: { name: "Harrington", email: "harrington@email.com", address: "22 Oak Ave, London SW9 3BT", phone: "07700 111 222" },
    type: "exterior", date: "2026-04-03", dueDate: "2026-04-06", status: "overdue",
    lines: [
      { id: 1, desc: "Gutter clearance & fascias", qty: 1, rate: 120, vatRate: 0 },
      { id: 2, desc: "Exterior window clean (full house)", qty: 1, rate: 65, vatRate: 0 },
    ],
    notes: "Access via side gate.", sentAt: "2026-04-03T10:22:00Z", paidAt: null,
    viewedAt: "2026-04-03T14:05:00Z", reminders: ["2026-04-07T09:00:00Z"], paymentMethod: null,
  },
  {
    id: "INV-1040", num: "INV-1040",
    customer: { name: "Park View Flats", email: "manager@parkview.co.uk", address: "Park View Estate, London SE1 9XZ" },
    type: "commercial", date: "2026-04-06", dueDate: "2026-04-13", status: "sent",
    lines: [{ id: 1, desc: "Weekly common area clean", qty: 1, rate: 95, vatRate: 0 }],
    notes: "", sentAt: "2026-04-06T08:00:00Z", paidAt: null, viewedAt: null, reminders: [], paymentMethod: null,
  },
];

// ─── Exported helpers ────────────────────────────────────────────────────────
export const invTotal = (inv) =>
  (inv.lines ?? []).reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.rate) || 0), 0);

export const invCustomerName = (inv) =>
  typeof inv.customer === "object" ? (inv.customer?.name ?? "") : (inv.customer ?? "");

// Map DB row to component shape
function mapInvoiceRow(row) {
  return {
    id: row.id,
    num: row.invoice_num,
    customer: row.customer || {},
    customerId: row.customer_id,
    lines: row.lines || [],
    date: row.date,
    dueDate: row.due_date,
    type: row.type || 'residential',
    status: row.status || 'draft',
    notes: row.notes || '',
    paymentTerms: row.payment_terms || 14,
    sentAt: row.sent_at,
    viewedAt: row.viewed_at,
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    reminders: row.reminders || [],
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────
const InvoiceContext = createContext(null);

export function InvoiceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const isLive = Boolean(user);
  const isDemoUser = user?.id === 'demo-user';
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load invoices from Supabase (or demo data for non-authenticated)
  useEffect(() => {
    // Still waiting for auth to resolve
    if (authLoading) return;

    // Not logged in — show demo data
    if (!user) {
      setInvoices(SHARED_DEMO_INVOICES);
      setLoading(false);
      return;
    }

    // Demo user — show demo data (no real DB session)
    if (isDemoUser) {
      setInvoices(SHARED_DEMO_INVOICES);
      setLoading(false);
      return;
    }

    // Real user — fetch from Supabase
    setLoading(true);
    fetchInvoices()
      .then(rows => {
        const mapped = rows.map(mapInvoiceRow);
        const today = new Date().toISOString().split('T')[0];
        setInvoices(mapped.map(inv => {
          if (inv.status === 'sent' && inv.dueDate && inv.dueDate < today) {
            return { ...inv, status: 'overdue' };
          }
          return inv;
        }));
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [user, authLoading, isDemoUser]);

  // Add or update invoice — persists to Supabase
  const addInvoice = useCallback(async (inv) => {
    if (isLive) {
      try {
        const existing = invoices.find(i => i.id === inv.id);
        if (existing) {
          await dbUpdateInvoice(inv.id, inv);
          setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...inv } : i));
        } else {
          const saved = await dbCreateInvoice({
            invoiceNum: inv.num,
            customerId: inv.customerId || null,
            customer: inv.customer,
            lines: inv.lines,
            date: inv.date,
            dueDate: inv.dueDate,
            type: inv.type,
            status: inv.status,
            notes: inv.notes,
            paymentTerms: inv.paymentTerms,
            sentAt: inv.sentAt,
            paidAt: inv.paidAt,
            paymentMethod: inv.paymentMethod,
            reminders: inv.reminders,
          });
          setInvoices(prev => [mapInvoiceRow(saved), ...prev]);
        }
      } catch (err) {
        console.error('Failed to save invoice:', err);
        // Still update locally
        setInvoices(prev => {
          const exists = prev.find(i => i.id === inv.id);
          return exists ? prev.map(i => i.id === inv.id ? inv : i) : [inv, ...prev];
        });
      }
    } else {
      setInvoices(prev => {
        const exists = prev.find(i => i.id === inv.id);
        return exists ? prev.map(i => i.id === inv.id ? inv : i) : [inv, ...prev];
      });
    }
  }, [isLive, invoices]);

  // Full replace
  const updateInvoice = useCallback(async (upd) => {
    setInvoices(prev => prev.map(i => i.id === upd.id ? upd : i));
    if (isLive) {
      try { await dbUpdateInvoice(upd.id, upd); } catch (err) { console.error('Failed to update invoice:', err); }
    }
  }, [isLive]);

  // Partial patch
  const patchInvoice = useCallback(async (id, patch) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    if (isLive) {
      try { await dbUpdateInvoice(id, patch); } catch (err) { console.error('Failed to patch invoice:', err); }
    }
  }, [isLive]);

  // Delete
  const removeInvoice = useCallback(async (id) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    if (isLive) {
      try { await dbDeleteInvoice(id); } catch (err) { console.error('Failed to delete invoice:', err); }
    }
  }, [isLive]);

  // Next invoice number from DB
  const nextNum = useCallback(async () => {
    if (isLive) {
      try { return await getNextInvoiceNum(); } catch { return `INV-${Date.now().toString().slice(-4)}`; }
    }
    return `INV-${1000 + invoices.length + 1}`;
  }, [isLive, invoices.length]);

  // Simplified format for MoneyTracker
  const simpleInvoices = invoices.map(inv => ({
    id: inv.id,
    customer: invCustomerName(inv),
    amount: invTotal(inv),
    sentDate: inv.sentAt ? inv.sentAt.slice(0, 10) : inv.date,
    dueDate: inv.dueDate,
    status: inv.status,
    type: inv.type ?? "residential",
  }));

  return (
    <InvoiceContext.Provider value={{
      invoices,
      simpleInvoices,
      addInvoice,
      updateInvoice,
      patchInvoice,
      removeInvoice,
      nextNum,
      loading,
    }}>
      {children}
    </InvoiceContext.Provider>
  );
}

export const useInvoices = () => {
  const ctx = useContext(InvoiceContext);
  if (!ctx) throw new Error("useInvoices must be used within <InvoiceProvider>");
  return ctx;
};
