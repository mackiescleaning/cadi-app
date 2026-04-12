// src/context/InvoiceContext.jsx
// Single source of truth for all invoice data across the app.
// Used by: InvoiceGenerator (CRUD), MoneyTracker (IncomeStream), AccountsTab (Invoice Records)

import { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthContext";

// ─── Canonical demo invoices (rich format) ────────────────────────────────────
// These are shared — InvoiceGenerator renders them, MoneyTracker shows unpaid ones,
// AccountsTab Invoice Records shows them organised by tax year.
export const SHARED_DEMO_INVOICES = [
  {
    id: "INV-1041", num: "INV-1041",
    customer: { name: "Harrington", email: "harrington@email.com", address: "22 Oak Ave, London SW9 3BT", phone: "07700 111 222" },
    type: "exterior", date: "2026-04-03", dueDate: "2026-04-06", status: "overdue",
    lines: [
      { id: 1, desc: "Gutter clearance & fascias",        qty: 1, rate: 120, vatRate: 0 },
      { id: 2, desc: "Exterior window clean (full house)", qty: 1, rate: 65,  vatRate: 0 },
    ],
    notes: "Access via side gate. Please call 30 mins before arrival.",
    sentAt: "2026-04-03T10:22:00Z", paidAt: null, viewedAt: "2026-04-03T14:05:00Z",
    reminders: ["2026-04-07T09:00:00Z"], paymentMethod: null,
  },
  {
    id: "INV-1040", num: "INV-1040",
    customer: { name: "Park View Flats", email: "manager@parkview.co.uk", address: "Park View Estate, London SE1 9XZ", phone: "0207 000 1234" },
    type: "commercial", date: "2026-04-06", dueDate: "2026-04-13", status: "sent",
    lines: [{ id: 1, desc: "Weekly common area clean", qty: 1, rate: 95, vatRate: 0 }],
    notes: "Invoice for week commencing 6 April 2026.",
    sentAt: "2026-04-06T08:00:00Z", paidAt: null, viewedAt: "2026-04-06T09:14:00Z",
    reminders: [], paymentMethod: null,
  },
  {
    id: "INV-1039", num: "INV-1039",
    customer: { name: "Wilson", email: "jwilson@gmail.com", address: "8 Cedar Close, London SW3 2PQ", phone: "07700 333 444" },
    type: "residential", date: "2026-04-05", dueDate: "2026-04-12", status: "sent",
    lines: [{ id: 1, desc: "Regular clean — 3-bed house", qty: 1, rate: 65, vatRate: 0 }],
    notes: "",
    sentAt: "2026-04-05T16:30:00Z", paidAt: null, viewedAt: null,
    reminders: [], paymentMethod: null,
  },
  {
    id: "INV-1038", num: "INV-1038",
    customer: { name: "Nexus HQ", email: "accounts@nexushq.com", address: "1 Silicon Way, London EC1 4AB", phone: "0207 555 9999" },
    type: "commercial", date: "2026-04-03", dueDate: "2026-04-10", status: "paid",
    lines: [{ id: 1, desc: "Deep commercial clean — full office", qty: 1, rate: 200, vatRate: 0 }],
    notes: "Monthly deep clean — April 2026.",
    sentAt: "2026-04-03T07:55:00Z", paidAt: "2026-04-08T11:20:00Z", viewedAt: "2026-04-03T08:40:00Z",
    reminders: [], paymentMethod: "bank",
  },
  {
    id: "INV-1037", num: "INV-1037",
    customer: { name: "Johnson", email: "j.johnson@gmail.com", address: "5 Birch Lane, London SW4 2RT", phone: "07700 555 666" },
    type: "residential", date: "2026-04-01", dueDate: "2026-04-08", status: "paid",
    lines: [{ id: 1, desc: "Regular clean", qty: 1, rate: 60, vatRate: 0 }],
    notes: "",
    sentAt: "2026-04-01T14:00:00Z", paidAt: "2026-04-04T09:15:00Z", viewedAt: "2026-04-01T14:45:00Z",
    reminders: [], paymentMethod: "bank",
  },
  {
    id: "INV-1036", num: "INV-1036",
    customer: { name: "Davies", email: "e.davies@outlook.com", address: "3 Maple Road, London SW2 8GH", phone: "07700 777 888" },
    type: "residential", date: "2026-03-28", dueDate: "2026-04-04", status: "paid",
    lines: [{ id: 1, desc: "Deep clean — 2-bed flat", qty: 1, rate: 80, vatRate: 0 }],
    notes: "",
    sentAt: "2026-03-28T17:00:00Z", paidAt: "2026-04-02T10:00:00Z", viewedAt: "2026-03-29T08:22:00Z",
    reminders: [], paymentMethod: "cash",
  },
  {
    id: "INV-1035", num: "INV-1035",
    customer: { name: "Miller", email: "miller@email.com", address: "12 Pine St, London SW1 8AB", phone: "07700 000 111" },
    type: "residential", date: "2026-03-25", dueDate: "2026-04-01", status: "paid",
    lines: [{ id: 1, desc: "Deep clean — 4-bed house", qty: 1, rate: 280, vatRate: 0 }],
    notes: "",
    sentAt: "2026-03-25T09:00:00Z", paidAt: "2026-03-30T14:00:00Z", viewedAt: "2026-03-25T10:30:00Z",
    reminders: [], paymentMethod: "bank",
  },
  {
    id: "INV-1034", num: "INV-1034",
    customer: { name: "Greenfield Office", email: "billing@greenfield.co.uk", address: "5 Commerce Park, London EC2 3XY", phone: "0207 111 2222" },
    type: "commercial", date: "2026-03-18", dueDate: "2026-04-01", status: "paid",
    lines: [{ id: 1, desc: "Fortnightly office clean", qty: 1, rate: 120, vatRate: 0 }],
    notes: "",
    sentAt: "2026-03-18T08:00:00Z", paidAt: "2026-03-28T11:00:00Z", viewedAt: "2026-03-18T09:00:00Z",
    reminders: [], paymentMethod: "bank",
  },
  {
    id: "INV-1033", num: "INV-1033",
    customer: { name: "Thompson", email: "thompson@gmail.com", address: "9 Beech Way, London SW6 4KL", phone: "07700 222 333" },
    type: "residential", date: "2026-03-10", dueDate: "2026-03-17", status: "paid",
    lines: [{ id: 1, desc: "Regular clean", qty: 2, rate: 65, vatRate: 0 }],
    notes: "",
    sentAt: "2026-03-10T10:00:00Z", paidAt: "2026-03-14T09:00:00Z", viewedAt: "2026-03-10T11:00:00Z",
    reminders: [], paymentMethod: "bank",
  },
  {
    id: "INV-1032", num: "INV-1032",
    customer: { name: "Horizon Care", email: "admin@horizoncare.org", address: "20 Riverside Dr, London SE11 5AZ", phone: "0207 666 7777" },
    type: "commercial", date: "2026-03-05", dueDate: "2026-03-19", status: "paid",
    lines: [{ id: 1, desc: "Care home deep clean", qty: 1, rate: 350, vatRate: 0 }],
    notes: "Monthly contract — March 2026.",
    sentAt: "2026-03-05T08:00:00Z", paidAt: "2026-03-17T14:30:00Z", viewedAt: "2026-03-05T09:15:00Z",
    reminders: [], paymentMethod: "bank",
  },
];

// ─── Module-level counter (resets on reload — fine for demo) ──────────────────
let _counter = 1042;

// ─── Exported helpers (used in AccountsTab & elsewhere) ──────────────────────
export const invTotal = (inv) =>
  (inv.lines ?? []).reduce((s, l) => s + (parseFloat(l.qty) || 1) * (parseFloat(l.rate) || 0), 0);

export const invCustomerName = (inv) =>
  typeof inv.customer === "object" ? (inv.customer?.name ?? "") : (inv.customer ?? "");

// ─── Context ──────────────────────────────────────────────────────────────────
const InvoiceContext = createContext(null);

export function InvoiceProvider({ children }) {
  const { user }  = useAuth();
  const isLive    = Boolean(user);
  const [invoices, setInvoices] = useState(isLive ? [] : SHARED_DEMO_INVOICES);

  // Upsert — add if new, replace if exists
  const addInvoice = (inv) =>
    setInvoices(prev => {
      const exists = prev.find(i => i.id === inv.id);
      return exists ? prev.map(i => i.id === inv.id ? inv : i) : [inv, ...prev];
    });

  // Full replace
  const updateInvoice = (upd) =>
    setInvoices(prev => prev.map(i => i.id === upd.id ? upd : i));

  // Partial patch — for simple status changes (e.g. marking paid from MoneyTracker)
  const patchInvoice = (id, patch) =>
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

  const nextNum = () => `INV-${_counter++}`;

  // ── Simplified format consumed by MoneyTracker's IncomeStream ────────────────
  // MoneyTracker only needs: id, customer (string), amount, sentDate, dueDate, status, type
  const simpleInvoices = invoices.map(inv => ({
    id:       inv.id,
    customer: invCustomerName(inv),
    amount:   invTotal(inv),
    sentDate: inv.sentAt ? inv.sentAt.slice(0, 10) : inv.date,
    dueDate:  inv.dueDate,
    status:   inv.status,
    type:     inv.type ?? "residential",
  }));

  return (
    <InvoiceContext.Provider value={{
      invoices,          // rich format — for InvoiceGenerator & AccountsTab
      simpleInvoices,    // simplified — for MoneyTracker IncomeStream
      addInvoice,
      updateInvoice,
      patchInvoice,
      nextNum,
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
