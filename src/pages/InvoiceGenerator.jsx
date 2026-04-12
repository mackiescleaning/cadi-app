// src/pages/InvoiceGenerator.jsx
// Cadi — Invoicing (glassmorphism redesign)
// All logic / data / screens unchanged — UI upgraded to dark navy glassmorphism
// NOTE: the invoice document preview stays clean white — it's customer-facing

import { useState, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useInvoices } from "../context/InvoiceContext";

// ─── Default accounts ─────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = {
  vatRegistered: false, frsRate: 12, isLimitedCostTrader: false,
  taxRate: 0.20, ytdIncome: 41820, annualTarget: 65000,
};

// ─── Business settings ────────────────────────────────────────────────────────
const BUSINESS = {
  name: "Cadi Services", ownerName: "Sarah Mitchell",
  email: "sarah@cadi.co.uk", phone: "07700 900 123",
  address: "14 Elm Street, London SW4 8AS",
  vatNumber: "", companyNum: "",
  bankName: "Starling Bank", sortCode: "60-83-71", accountNum: "12345678",
  paymentRef: "INV-", defaultTerms: 14,
  defaultNotes: "Thank you for your business. Please make payment within the agreed terms.",
};

// Demo invoice data lives in InvoiceContext — shared across all tabs.

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt       = (n) => `£${Math.round(n).toLocaleString()}`;
const fmt2      = (n) => `£${(+n).toFixed(2)}`;
const fmtDate   = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const fmtShort  = (s) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const today     = "2026-04-07";
const addDays   = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split("T")[0]; };

function calcInvoice(lines, vatRegistered, frsRate) {
  const subtotal  = lines.reduce((s,l) => s + (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0), 0);
  const vatAmount = vatRegistered ? subtotal * 0.20 : 0;
  const total     = subtotal + vatAmount;
  const vatToHMRC = vatRegistered ? (subtotal + vatAmount) * ((frsRate||12)/100) : 0;
  const net       = total - vatToHMRC;
  return { subtotal, vatAmount, total, vatToHMRC, net };
}

function daysOverdue(dueDate) {
  return Math.max(0, Math.round((new Date(today) - new Date(dueDate)) / 86400000));
}

function statusMeta(inv) {
  const overdueDays = daysOverdue(inv.dueDate);
  const map = {
    draft:   { label: "Draft",   cls: "bg-[rgba(153,197,255,0.08)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)]" },
    sent:    { label: inv.viewedAt ? "Viewed" : "Sent", cls: "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]" },
    viewed:  { label: "Viewed",  cls: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" },
    overdue: { label: overdueDays > 0 ? `${overdueDays}d overdue` : "Overdue", cls: "bg-red-500/10 border-red-500/20 text-red-400" },
    paid:    { label: "Paid",    cls: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" },
  };
  return map[inv.status] ?? map.draft;
}

// ─── Design system ────────────────────────────────────────────────────────────
function GCard({ children, className = "" }) {
  return (
    <div className={`relative rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.04)] overflow-hidden ${className}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
      {children}
    </div>
  );
}

function SL({ children, className = "" }) {
  return <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.45)] ${className}`}>{children}</p>;
}

function GInput({ className = "", ...props }) {
  return (
    <input {...props} className={`w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[rgba(153,197,255,0.4)] transition-colors ${className}`} />
  );
}

function GSelect({ className = "", children, ...props }) {
  return (
    <select {...props} className={`w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(153,197,255,0.4)] transition-colors ${className}`}>
      {children}
    </select>
  );
}

function GTextarea({ className = "", ...props }) {
  return (
    <textarea {...props} className={`w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-[rgba(153,197,255,0.8)] placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[rgba(153,197,255,0.4)] transition-colors resize-none ${className}`} />
  );
}

function GAlert({ type = "blue", children }) {
  const styles = {
    warn:  "bg-amber-500/8 border-amber-500/25 text-amber-300",
    green: "bg-emerald-500/8 border-emerald-500/25 text-emerald-300",
    blue:  "bg-[#1f48ff]/8 border-[#1f48ff]/25 text-[#99c5ff]",
    gold:  "bg-amber-400/8 border-amber-400/25 text-amber-300",
  };
  const icons = { warn: "⚠️", green: "✅", blue: "ℹ️", gold: "💡" };
  return (
    <div className={`flex gap-3 p-3.5 border rounded-xl text-xs leading-relaxed ${styles[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span><div>{children}</div>
    </div>
  );
}

function StatusBadge({ inv }) {
  const { label, cls } = statusMeta(inv);
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${cls}`}>{label}</span>;
}

function TypeBadge({ type }) {
  const map = {
    residential: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    commercial:  "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
    exterior:    "bg-amber-500/10 border-amber-500/20 text-amber-400",
  };
  const labels = { residential: "Residential", commercial: "Commercial", exterior: "Exterior" };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${map[type] ?? "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)]"}`}>
      {labels[type] ?? type}
    </span>
  );
}

// Type stripe dot for list rows
const TYPE_DOT = { residential: "#10b981", commercial: "#1f48ff", exterior: "#f59e0b" };

// ─── Email send modal ─────────────────────────────────────────────────────────
function EmailModal({ invoice, business, onSent, onClose }) {
  const calc = calcInvoice(invoice.lines, false, 12);
  const [to,      setTo]      = useState(invoice.customer.email);
  const [subject, setSubject] = useState(`Invoice ${invoice.num} from ${business.name}`);
  const [body,    setBody]    = useState(
    `Hi ${invoice.customer.name.split(" ")[0]},\n\nPlease find attached invoice ${invoice.num} for ${fmt2(calc.total)}.\n\nPayment is due by ${fmtDate(invoice.dueDate)}.\n\nBank details:\n${business.bankName}\nSort code: ${business.sortCode}\nAccount: ${business.accountNum}\nReference: ${invoice.num}\n\n${business.defaultNotes}\n\nMany thanks,\n${business.ownerName}\n${business.name}`
  );
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSend = async () => {
    setSending(true);
    await new Promise(r => setTimeout(r, 1400));
    setSending(false); setSent(true);
    setTimeout(() => { onSent(); onClose(); }, 1800);
  };

  if (sent) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] p-8 text-center shadow-2xl">
        <p className="text-5xl mb-4">✅</p>
        <p className="text-lg font-black text-white mb-1">Invoice sent</p>
        <p className="text-sm text-[rgba(153,197,255,0.5)]">Delivered to {to}</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-white">📤 Send invoice</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{invoice.num} · {fmt2(calc.total)}</p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div><SL className="mb-1.5">To</SL><GInput type="email" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><SL className="mb-1.5">Subject</SL><GInput type="text" value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div><SL className="mb-1.5">Message</SL><GTextarea value={body} onChange={e => setBody(e.target.value)} rows={9} className="font-mono text-xs leading-relaxed" /></div>
          <GAlert type="blue">The invoice PDF will be attached automatically. Bank details are included in the message body.</GAlert>
          <div className="flex gap-2">
            <button onClick={handleSend} disabled={sending || !to}
              className={`flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${sending || !to ? "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed" : "bg-[#1f48ff] text-white hover:bg-[#3a5eff]"}`}>
              {sending ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending…</> : "📤 Send invoice"}
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mark paid modal ──────────────────────────────────────────────────────────
function MarkPaidModal({ invoice, onConfirm, onClose }) {
  const [method, setMethod] = useState("bank");
  const [date,   setDate]   = useState(today);
  const calc = calcInvoice(invoice.lines, false, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] overflow-hidden shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-center justify-between">
          <p className="text-sm font-black text-white">Mark as paid — {invoice.num}</p>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-[rgba(153,197,255,0.1)] divide-y divide-[rgba(153,197,255,0.06)]">
            {[
              { l: "Customer",          v: invoice.customer.name,  c: "text-white"       },
              { l: "Amount",            v: fmt2(calc.total),        c: "text-emerald-400" },
              { l: "Tax to set aside",  v: fmt2(calc.total * 0.25), c: "text-amber-400"   },
            ].map(({ l, v, c }) => (
              <div key={l} className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-[rgba(153,197,255,0.45)]">{l}</span>
                <span className={`text-xs font-black ${c}`}>{v}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><SL className="mb-1.5">Payment method</SL>
              <GSelect value={method} onChange={e => setMethod(e.target.value)}>
                {["bank","cash","card","cheque"].map(m => <option key={m} value={m} className="bg-[#010a4f]">{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </GSelect>
            </div>
            <div><SL className="mb-1.5">Date received</SL><GInput type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <GAlert type="green">
            Marking as paid will log <strong className="text-white">{fmt2(calc.total)}</strong> as income in your <strong className="text-white">Accounts tab</strong> and update your Money dashboard instantly.
          </GAlert>
          <div className="flex gap-2">
            <button onClick={() => onConfirm({ method, date })}
              className="flex-1 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black hover:bg-emerald-500/30 transition-colors">
              ✓ Confirm payment received
            </button>
            <button onClick={onClose} className="px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white transition-all">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Invoice list ─────────────────────────────────────────────────────
function InvoiceList({ invoices, accounts, onSelect, onCreate }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const FILTERS = [
    { id: "all",     label: "All"     },
    { id: "overdue", label: "Overdue" },
    { id: "sent",    label: "Sent"    },
    { id: "paid",    label: "Paid"    },
    { id: "draft",   label: "Draft"   },
  ];

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchFilter = filter === "all" || inv.status === filter || (filter === "sent" && inv.status === "viewed");
    const matchSearch = !search || inv.customer.name.toLowerCase().includes(search.toLowerCase()) || inv.num.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }), [invoices, filter, search]);

  const outstanding  = invoices.filter(i => i.status !== "paid" && i.status !== "draft").reduce((s,i) => s + calcInvoice(i.lines,false,12).total, 0);
  const overdue      = invoices.filter(i => i.status === "overdue").reduce((s,i) => s + calcInvoice(i.lines,false,12).total, 0);
  const paidMonth    = invoices.filter(i => i.status === "paid" && i.paidAt?.startsWith("2026-04")).reduce((s,i) => s + calcInvoice(i.lines,false,12).total, 0);
  const ytdTotal     = invoices.reduce((s,i) => s + calcInvoice(i.lines,false,12).total, 0);
  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Outstanding",        val: fmt(outstanding), color: outstanding > 0 ? "text-amber-400"   : "text-white" },
          { label: "Overdue",            val: fmt(overdue),     color: overdue > 0     ? "text-red-400"     : "text-white" },
          { label: "Paid this month",    val: fmt(paidMonth),   color: "text-emerald-400" },
          { label: "Total invoiced YTD", val: fmt(ytdTotal),    color: "text-white"       },
        ].map(({ label, val, color }) => (
          <GCard key={label} className="px-4 py-3">
            <SL className="mb-0.5">{label}</SL>
            <p className={`text-xl font-black tabular-nums ${color}`}>{val}</p>
          </GCard>
        ))}
      </div>

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/25">
          <span className="text-sm shrink-0">🔴</span>
          <p className="text-xs text-red-300 flex-1">
            <strong className="text-white">{overdueCount} invoice{overdueCount>1?"s":""} overdue</strong> — {fmt(overdue)} outstanding past due date.{" "}
            <button onClick={() => setFilter("overdue")} className="font-black underline underline-offset-2 hover:no-underline">View overdue →</button>
          </p>
        </div>
      )}

      {/* Search + filters */}
      <div className="space-y-2">
        <GInput type="text" placeholder="Search customer or invoice number…" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map(f => {
            const count = f.id === "all" ? null : invoices.filter(i => f.id === "sent" ? (i.status==="sent"||i.status==="viewed") : i.status===f.id).length;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${
                  filter === f.id ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"
                }`}>
                {f.label}
                {count !== null && count > 0 && (
                  <span className={`px-1 rounded-full text-[9px] font-black ${filter===f.id ? "bg-white/20 text-white" : "bg-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)]"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Invoice rows */}
      {filtered.length === 0 ? (
        <GCard className="py-16 text-center">
          <p className="text-4xl mb-3">📄</p>
          <p className="text-sm font-black text-[rgba(153,197,255,0.5)]">No invoices match — try a different filter.</p>
        </GCard>
      ) : (
        <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
          {filtered.map(inv => {
            const calc = calcInvoice(inv.lines, accounts.vatRegistered, accounts.frsRate);
            return (
              <button key={inv.id} onClick={() => onSelect(inv)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[rgba(153,197,255,0.04)] text-left group transition-colors">
                {/* Type stripe */}
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: TYPE_DOT[inv.type] ?? "#6b7280" }} />

                {/* Invoice num + date */}
                <div className="w-20 shrink-0">
                  <p className="text-xs font-mono font-black text-[#99c5ff]">{inv.num}</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">{fmtShort(inv.date)}</p>
                </div>

                {/* Customer */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white group-hover:text-[#99c5ff] truncate transition-colors">{inv.customer.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <TypeBadge type={inv.type} />
                    {inv.lines.length > 0 && (
                      <span className="text-[10px] text-[rgba(153,197,255,0.35)] truncate">
                        {inv.lines[0].desc}{inv.lines.length > 1 ? ` +${inv.lines.length-1}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* Due */}
                <div className="hidden sm:block text-right shrink-0 w-20">
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)]">Due</p>
                  <p className={`text-xs font-bold ${inv.status==="overdue" ? "text-red-400" : "text-[rgba(153,197,255,0.55)]"}`}>{fmtShort(inv.dueDate)}</p>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-black tabular-nums text-white">{fmt2(calc.total)}</p>
                  {accounts.vatRegistered && <p className="text-[10px] text-[rgba(153,197,255,0.35)]">inc. VAT</p>}
                </div>

                {/* Status */}
                <StatusBadge inv={inv} />

                <span className="text-[rgba(153,197,255,0.2)] group-hover:text-[rgba(153,197,255,0.5)] transition-colors shrink-0">›</span>
              </button>
            );
          })}
        </GCard>
      )}
    </div>
  );
}

// ─── SCREEN: Create / edit invoice ────────────────────────────────────────────
function CreateInvoice({ accounts, draftInvoice, invNum, onSave, onPreview, onBack }) {
  const isEdit = !!draftInvoice;
  const [customer, setCustomer] = useState(draftInvoice?.customer ?? { name: "", email: "", address: "", phone: "" });
  const [type,     setType]     = useState(draftInvoice?.type     ?? "residential");
  const [date,     setDate]     = useState(draftInvoice?.date     ?? today);
  const [terms,    setTerms]    = useState(draftInvoice?.terms    ?? BUSINESS.defaultTerms);
  const [lines,    setLines]    = useState(draftInvoice?.lines    ?? [{ id: 1, desc: "", qty: 1, rate: "", vatRate: 0 }]);
  const [notes,    setNotes]    = useState(draftInvoice?.notes    ?? BUSINESS.defaultNotes);

  // Pin the invoice number on mount — prevents it incrementing on every re-render
  const stableNum = useRef(draftInvoice?.num ?? invNum);

  const dueDate = addDays(date, terms);
  const calc    = calcInvoice(lines, accounts.vatRegistered, accounts.frsRate);
  const valid   = customer.name && customer.email && lines.some(l => l.desc && parseFloat(l.rate) > 0);

  const addLine    = () => setLines(prev => [...prev, { id: Date.now(), desc: "", qty: 1, rate: "", vatRate: 0 }]);
  const removeLine = (id) => setLines(prev => prev.filter(l => l.id !== id));
  const updateLine = (id, field, val) => setLines(prev => prev.map(l => l.id===id ? { ...l, [field]: val } : l));
  const setC       = (field, val) => setCustomer(prev => ({ ...prev, [field]: val }));

  const QUICK_DESCS = {
    residential: ["Regular clean", "Deep clean", "End of tenancy clean", "Oven clean", "Carpet clean", "Spring clean"],
    commercial:  ["Office clean", "Deep commercial clean", "Contract clean", "Washroom sanitise", "Builder's clean"],
    exterior:    ["Window clean", "Gutter clearance", "Driveway pressure wash", "Fascias & soffits", "Render wash"],
  };

  const draft = { customer, type, date, dueDate, terms, lines, notes, num: stableNum.current };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[rgba(153,197,255,0.4)] hover:text-white transition-colors text-sm">← Back</button>
        <p className="flex-1 text-sm font-black text-white">{isEdit ? `Edit ${draftInvoice.num}` : "New invoice"}</p>
        <button onClick={() => onSave(draft, "draft")}
          className="px-4 py-2 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
          Save draft
        </button>
        <button onClick={() => valid && onPreview(draft)} disabled={!valid}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${valid ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]" : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"}`}>
          Preview & send →
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT */}
        <div className="space-y-4">
          {/* Customer */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Customer</SL></div>
            <div className="p-4 space-y-3">
              {[
                { label: "Name",    field: "name",    type: "text",  ph: "e.g. Mrs Johnson"            },
                { label: "Email",   field: "email",   type: "email", ph: "client@email.com"             },
                { label: "Phone",   field: "phone",   type: "tel",   ph: "07700 000 000"                },
                { label: "Address", field: "address", type: "text",  ph: "1 High Street, London SW1"    },
              ].map(({ label, field, type: t, ph }) => (
                <div key={field}><SL className="mb-1.5">{label}</SL><GInput type={t} value={customer[field]} onChange={e => setC(field, e.target.value)} placeholder={ph} /></div>
              ))}
            </div>
          </GCard>

          {/* Details */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Details</SL></div>
            <div className="p-4 space-y-3">
              <div><SL className="mb-1.5">Invoice date</SL><GInput type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              <div>
                <SL className="mb-1.5">Payment terms</SL>
                <div className="flex gap-1.5">
                  {[7,14,21,30].map(t => (
                    <button key={t} onClick={() => setTerms(t)}
                      className={`flex-1 py-2 text-xs font-black rounded-xl border transition-all ${terms===t ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white hover:border-[rgba(153,197,255,0.3)]"}`}>
                      {t}d
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-1.5">Due: <strong className="text-[rgba(153,197,255,0.6)]">{fmtDate(dueDate)}</strong></p>
              </div>
              <div>
                <SL className="mb-1.5">Service type</SL>
                <div className="grid grid-cols-3 gap-1.5">
                  {["residential","commercial","exterior"].map(t => (
                    <button key={t} onClick={() => setType(t)}
                      className={`py-2 text-xs font-black rounded-xl border transition-all ${type===t ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.45)] hover:text-white"}`}>
                      {t.slice(0,3).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GCard>

          {/* Notes */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Notes / terms</SL></div>
            <div className="p-4">
              <GTextarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Payment terms, access details, special instructions…" />
            </div>
          </GCard>
        </div>

        {/* MIDDLE + RIGHT */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick add */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
              <SL>Quick add — {type}</SL>
            </div>
            <div className="flex flex-wrap gap-1.5 p-3">
              {QUICK_DESCS[type].map(desc => (
                <button key={desc}
                  onClick={() => setLines(prev => [...prev, { id: Date.now(), desc, qty: 1, rate: "", vatRate: 0 }])}
                  className="px-2.5 py-1 text-xs font-black border border-[rgba(153,197,255,0.12)] rounded-xl text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.35)] hover:text-white hover:bg-[rgba(153,197,255,0.05)] transition-all">
                  + {desc}
                </button>
              ))}
            </div>
          </GCard>

          {/* Line items */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <SL>Line items</SL>
              <button onClick={addLine}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-xl bg-[#1f48ff]/15 border border-[#1f48ff]/30 text-[#99c5ff] hover:bg-[#1f48ff]/25 transition-colors">
                + Add line
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-[rgba(153,197,255,0.06)] bg-[rgba(153,197,255,0.02)]">
              {["Description","Qty","Rate (£)","Total",""].map((h, i) => (
                <span key={i} className={`text-[9px] font-black tracking-[0.12em] uppercase text-[rgba(153,197,255,0.3)] ${i===0?"col-span-5":i===1?"col-span-2 text-center":i===2?"col-span-2 text-right":i===3?"col-span-2 text-right":"col-span-1"}`}>{h}</span>
              ))}
            </div>

            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {lines.map(line => {
                const lineTotal = (parseFloat(line.qty)||0) * (parseFloat(line.rate)||0);
                return (
                  <div key={line.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                    <input value={line.desc} onChange={e => updateLine(line.id,"desc",e.target.value)}
                      placeholder="Service description"
                      className="col-span-5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none focus:border-[rgba(153,197,255,0.35)]" />
                    <input type="number" min="0.5" step="0.5" value={line.qty} onChange={e => updateLine(line.id,"qty",e.target.value)}
                      className="col-span-2 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] rounded-lg px-2 py-1.5 text-xs text-center font-mono text-white focus:outline-none focus:border-[rgba(153,197,255,0.35)]" />
                    <input type="number" min="0" step="5" value={line.rate} onChange={e => updateLine(line.id,"rate",e.target.value)}
                      placeholder="0.00"
                      className="col-span-2 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] rounded-lg px-2 py-1.5 text-xs text-right font-mono text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none focus:border-[rgba(153,197,255,0.35)]" />
                    <span className={`col-span-2 text-right text-xs font-mono font-black ${lineTotal > 0 ? "text-white" : "text-[rgba(153,197,255,0.2)]"}`}>
                      {lineTotal > 0 ? fmt2(lineTotal) : "—"}
                    </span>
                    <button onClick={() => removeLine(line.id)} className="col-span-1 flex justify-end text-[rgba(153,197,255,0.2)] hover:text-red-400 transition-colors">✕</button>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="border-t border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)]">
              <div className="divide-y divide-[rgba(153,197,255,0.05)]">
                <div className="flex justify-between px-5 py-2.5 text-sm">
                  <span className="text-[rgba(153,197,255,0.45)]">Subtotal</span>
                  <span className="font-mono font-black text-[rgba(153,197,255,0.7)]">{fmt2(calc.subtotal)}</span>
                </div>
                {accounts.vatRegistered && (
                  <>
                    <div className="flex justify-between px-5 py-2.5 text-sm">
                      <span className="text-[rgba(153,197,255,0.45)]">VAT (20%)</span>
                      <span className="font-mono font-black text-[rgba(153,197,255,0.7)]">{fmt2(calc.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between px-5 py-2.5 text-sm">
                      <span className="text-[rgba(153,197,255,0.45)] flex items-center gap-1.5">VAT to HMRC <span className="text-amber-400">(FRS {accounts.frsRate}%)</span></span>
                      <span className="font-mono font-black text-amber-400">−{fmt2(calc.vatToHMRC)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between px-5 py-3 bg-[rgba(153,197,255,0.04)]">
                  <span className="font-black text-white text-sm">Total{accounts.vatRegistered ? " inc. VAT" : ""}</span>
                  <span className="text-xl font-black tabular-nums text-white">{fmt2(calc.total)}</span>
                </div>
                {accounts.vatRegistered && (
                  <div className="flex justify-between px-5 py-2.5">
                    <span className="text-xs text-[rgba(153,197,255,0.45)]">Your take (after FRS VAT)</span>
                    <span className="text-xs font-black text-emerald-400">{fmt2(calc.net)}</span>
                  </div>
                )}
              </div>
            </div>
          </GCard>

          {/* Bank details */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Bank details on invoice</SL></div>
            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {[["Bank", BUSINESS.bankName],["Sort code", BUSINESS.sortCode],["Account no.", BUSINESS.accountNum],["Reference", draft.num]].map(([l,v]) => (
                <div key={l} className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-[rgba(153,197,255,0.4)]">{l}</span>
                  <span className="text-xs font-mono font-black text-[rgba(153,197,255,0.7)]">{v}</span>
                </div>
              ))}
            </div>
          </GCard>

          <GAlert type="gold">
            When this invoice is marked paid, <strong className="text-white">{fmt2(calc.total)}</strong> will be logged automatically to your <strong className="text-white">Accounts tab</strong> — updating your YTD total, tax reserve and MTD figures.
          </GAlert>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN: Invoice preview ──────────────────────────────────────────────────
// The document itself stays clean white — it's customer-facing
function InvoicePreview({ draft, accounts, business, onEdit, onSaveAndSend, onBack }) {
  const calc = calcInvoice(draft.lines, accounts.vatRegistered, accounts.frsRate);
  const [showEmail, setShowEmail] = useState(false);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-[rgba(153,197,255,0.4)] hover:text-white transition-colors text-sm">← Edit</button>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Preview — {draft.num}</p>
          <p className="text-xs text-[rgba(153,197,255,0.35)]">This is how it looks to your customer</p>
        </div>
        <button onClick={onEdit}
          className="px-4 py-2 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
          ✏️ Edit
        </button>
        <button onClick={() => setShowEmail(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
          📤 Send invoice
        </button>
      </div>

      {/* Clean white invoice document */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl shadow-black/40">
          {/* Header */}
          <div className="bg-[#010a4f] px-8 py-6 flex justify-between items-start">
            <div>
              <p className="text-2xl font-bold text-white">{business.name}</p>
              <p className="text-sm text-[#99c5ff] mt-1 leading-relaxed">
                {business.address}<br />{business.phone} · {business.email}
              </p>
              {accounts.vatRegistered && business.vatNumber && (
                <p className="text-xs text-[#99c5ff]/70 mt-1">VAT reg: {business.vatNumber}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-white">INVOICE</p>
              <p className="text-xl font-mono text-[#99c5ff] mt-1">{draft.num}</p>
            </div>
          </div>

          {/* Billing + dates */}
          <div className="grid grid-cols-2 gap-6 px-8 py-6 border-b border-gray-100">
            <div>
              <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-2">Bill to</p>
              <p className="font-semibold text-gray-900">{draft.customer.name}</p>
              <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{draft.customer.address}<br />{draft.customer.email}</p>
            </div>
            <div className="text-right">
              <div className="inline-block text-left">
                {[["Invoice date", fmtDate(draft.date)],["Due date", fmtDate(draft.dueDate)],["Terms", `${draft.terms} days`]].map(([label, val]) => (
                  <div key={label} className="flex gap-8 mb-1.5">
                    <span className="text-xs text-gray-400 w-24">{label}</span>
                    <span className="text-sm font-semibold text-gray-700">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="px-8 py-4">
            <div className="grid grid-cols-12 pb-2 mb-1 border-b-2 border-[#010a4f] text-xs font-bold tracking-widest uppercase text-gray-400">
              <span className="col-span-6">Description</span>
              <span className="col-span-2 text-center">Qty</span>
              <span className="col-span-2 text-right">Unit price</span>
              <span className="col-span-2 text-right">Amount</span>
            </div>
            <div className="divide-y divide-gray-100">
              {draft.lines.filter(l => l.desc && parseFloat(l.rate) > 0).map(line => {
                const lt = (parseFloat(line.qty)||0)*(parseFloat(line.rate)||0);
                return (
                  <div key={line.id} className="grid grid-cols-12 py-3 text-sm">
                    <span className="col-span-6 text-gray-800 font-medium">{line.desc}</span>
                    <span className="col-span-2 text-center text-gray-500">{line.qty}</span>
                    <span className="col-span-2 text-right font-mono text-gray-600">{fmt2(parseFloat(line.rate)||0)}</span>
                    <span className="col-span-2 text-right font-mono font-semibold text-gray-800">{fmt2(lt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t-2 border-[#010a4f] mt-2 pt-3 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span className="font-mono">{fmt2(calc.subtotal)}</span>
              </div>
              {accounts.vatRegistered && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>VAT (20%)</span><span className="font-mono">{fmt2(calc.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-[#010a4f] pt-1 border-t border-gray-200">
                <span>Total due</span><span className="font-mono text-lg">{fmt2(calc.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
          <div className="mx-8 my-4 bg-[#010a4f]/5 border border-[#010a4f]/10 rounded-xl p-4">
            <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-2">Payment details</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[["Bank", business.bankName],["Sort code", business.sortCode],["Account", business.accountNum],["Reference", draft.num]].map(([l,v]) => (
                <div key={l} className="flex gap-2 text-sm">
                  <span className="text-gray-400 w-20 shrink-0">{l}</span>
                  <span className="font-mono font-semibold text-gray-800">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {draft.notes && (
            <div className="px-8 pb-6">
              <p className="text-xs text-gray-400 italic leading-relaxed">{draft.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="bg-[#010a4f] px-8 py-3 text-center">
            <p className="text-xs text-[#99c5ff]/70">
              {business.name} · {business.email} · {business.phone}
              {accounts.vatRegistered && business.vatNumber ? ` · VAT ${business.vatNumber}` : ""}
            </p>
          </div>
        </div>
      </div>

      {showEmail && (
        <EmailModal invoice={{ ...draft }} business={business} onSent={() => onSaveAndSend(draft)} onClose={() => setShowEmail(false)} />
      )}
    </div>
  );
}

// ─── SCREEN: Invoice detail ───────────────────────────────────────────────────
function InvoiceDetail({ invoice, accounts, business, onUpdate, onBack }) {
  const [showEmail, setShowEmail] = useState(false);
  const [showPaid,  setShowPaid]  = useState(false);
  const calc = calcInvoice(invoice.lines, accounts.vatRegistered, accounts.frsRate);

  const timeline = [
    { icon: "📄", label: "Invoice created",   time: invoice.sentAt ? new Date(invoice.sentAt).toLocaleDateString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : fmtDate(invoice.date) },
    ...(invoice.sentAt   ? [{ icon: "📤", label: "Invoice sent",     time: new Date(invoice.sentAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) }] : []),
    ...(invoice.viewedAt ? [{ icon: "👁️", label: "Viewed by client", time: new Date(invoice.viewedAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) }] : []),
    ...(invoice.reminders??[]).map(r => ({ icon: "🔔", label: "Reminder sent", time: new Date(r).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) })),
    ...(invoice.paidAt   ? [{ icon: "✅", label: `Payment received (${invoice.paymentMethod})`, time: new Date(invoice.paidAt).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) }] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="text-[rgba(153,197,255,0.4)] hover:text-white transition-colors text-sm mt-0.5">← Invoices</button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-lg font-black text-white">{invoice.num}</p>
            <StatusBadge inv={invoice} />
            <TypeBadge type={invoice.type} />
          </div>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">{invoice.customer.name} · {fmtDate(invoice.date)} · Due {fmtDate(invoice.dueDate)}</p>
        </div>
        {invoice.status !== "paid" && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setShowEmail(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] text-xs font-black hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all">
              📤 {invoice.sentAt ? "Re-send" : "Send"}
            </button>
            <button onClick={() => setShowPaid(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black hover:bg-emerald-500/30 transition-colors">
              ✓ Mark paid
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Customer */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Customer</SL></div>
            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {[["Name", invoice.customer.name],["Email", invoice.customer.email],["Phone", invoice.customer.phone],["Address", invoice.customer.address]].filter(([,v]) => v).map(([l,v]) => (
                <div key={l} className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-[rgba(153,197,255,0.4)]">{l}</span>
                  <span className="text-xs font-bold text-white text-right ml-4">{v}</span>
                </div>
              ))}
            </div>
          </GCard>

          {/* Line items */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Line items</SL></div>
            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {invoice.lines.map(line => {
                const lt = (parseFloat(line.qty)||0)*(parseFloat(line.rate)||0);
                return (
                  <div key={line.id} className="grid grid-cols-12 px-4 py-3 text-sm">
                    <span className="col-span-7 text-white font-bold">{line.desc}</span>
                    <span className="col-span-2 text-center text-[rgba(153,197,255,0.4)]">×{line.qty}</span>
                    <span className="col-span-3 text-right font-mono font-black text-[rgba(153,197,255,0.7)]">{fmt2(lt)}</span>
                  </div>
                );
              })}
            </div>
            <div className="bg-[rgba(153,197,255,0.03)] border-t border-[rgba(153,197,255,0.08)] divide-y divide-[rgba(153,197,255,0.05)]">
              {accounts.vatRegistered && (
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-[rgba(153,197,255,0.45)]">VAT (20%)</span>
                  <span className="text-xs font-mono text-[rgba(153,197,255,0.6)]">{fmt2(calc.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between px-4 py-3">
                <span className="font-black text-white">Total</span>
                <span className="text-xl font-black tabular-nums text-white">{fmt2(calc.total)}</span>
              </div>
            </div>
          </GCard>

          {invoice.notes && (
            <GCard className="p-4">
              <SL className="mb-2">Notes</SL>
              <p className="text-sm text-[rgba(153,197,255,0.6)] leading-relaxed">{invoice.notes}</p>
            </GCard>
          )}

          {/* Accounts impact */}
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.02)]">
              <SL>Accounts impact</SL>
            </div>
            <div className="divide-y divide-[rgba(153,197,255,0.05)]">
              {[
                { label: "Invoice total",             val: fmt2(calc.total),                              color: "text-white"        },
                { label: "Income tax (est.)",          val: `−${fmt2(calc.total * accounts.taxRate)}`,    color: "text-red-400"      },
                { label: "Class 4 NI (est.)",          val: `−${fmt2(calc.total * 0.09)}`,                color: "text-red-400"      },
                { label: "Your take-home (est.)",      val: fmt2(calc.total * (1 - accounts.taxRate - 0.09)), color: "text-emerald-400"},
                ...(accounts.vatRegistered ? [{ label: `VAT to HMRC (FRS ${accounts.frsRate}%)`, val: `−${fmt2(calc.vatToHMRC)}`, color: "text-amber-400" }] : []),
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between px-4 py-2.5">
                  <span className="text-xs text-[rgba(153,197,255,0.45)]">{label}</span>
                  <span className={`text-xs font-mono font-black ${color}`}>{val}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 border-t border-[#1f48ff]/15 bg-[#1f48ff]/5">
              <p className="text-[10px] text-[#99c5ff]"><span className="font-black">↗ Live from accounts</span> — rates update automatically with your tax position.</p>
            </div>
          </GCard>
        </div>

        {/* Timeline + summary */}
        <div className="space-y-4">
          <GCard className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Timeline</SL></div>
            <div className="relative pl-8 pr-4 py-4">
              <div className="absolute left-[27px] top-4 bottom-4 w-px bg-[rgba(153,197,255,0.08)]" />
              {timeline.map((event, i) => (
                <div key={i} className="relative flex gap-3 mb-4 last:mb-0">
                  <div className="absolute -left-[21px] w-6 h-6 rounded-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] flex items-center justify-center text-xs shrink-0 z-10" style={{fontSize:11}}>
                    {event.icon}
                  </div>
                  <div className="min-w-0 ml-2">
                    <p className="text-xs font-bold text-white">{event.label}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">{event.time}</p>
                  </div>
                </div>
              ))}
              {invoice.status !== "paid" && (
                <div className="relative flex gap-3">
                  <div className="absolute -left-[21px] w-6 h-6 rounded-full border-2 border-dashed border-[rgba(153,197,255,0.15)] flex items-center justify-center text-xs shrink-0 z-10" style={{fontSize:11}}>💰</div>
                  <div className="ml-2">
                    <p className="text-xs text-[rgba(153,197,255,0.35)] italic">Payment pending…</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.25)]">Due {fmtDate(invoice.dueDate)}</p>
                  </div>
                </div>
              )}
            </div>
          </GCard>

          <GCard className="overflow-hidden divide-y divide-[rgba(153,197,255,0.05)]">
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]"><SL>Summary</SL></div>
            {[
              { label: "Invoice total", val: fmt2(calc.total),    color: "text-white"        },
              { label: "Sent",          val: invoice.sentAt ? fmtShort(invoice.sentAt) : "Not sent", color: "text-[rgba(153,197,255,0.6)]" },
              { label: "Viewed",        val: invoice.viewedAt ? "Yes" : "Not yet", color: invoice.viewedAt ? "text-emerald-400" : "text-[rgba(153,197,255,0.35)]" },
              { label: "Days until due",val: invoice.status==="paid" ? "Paid" : `${Math.max(0,-daysOverdue(invoice.dueDate))} days`, color: invoice.status==="paid" ? "text-emerald-400" : daysOverdue(invoice.dueDate)>0 ? "text-red-400" : "text-[rgba(153,197,255,0.6)]" },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-[rgba(153,197,255,0.4)]">{label}</span>
                <span className={`text-xs font-black ${color}`}>{val}</span>
              </div>
            ))}
          </GCard>
        </div>
      </div>

      {showEmail && (
        <EmailModal invoice={invoice} business={business}
          onSent={() => { onUpdate({ ...invoice, sentAt: new Date().toISOString(), reminders: [...(invoice.reminders??[]), new Date().toISOString()] }); setShowEmail(false); }}
          onClose={() => setShowEmail(false)} />
      )}
      {showPaid && (
        <MarkPaidModal invoice={invoice}
          onConfirm={({ method, date }) => { onUpdate({ ...invoice, status: "paid", paidAt: new Date(date).toISOString(), paymentMethod: method }); setShowPaid(false); }}
          onClose={() => setShowPaid(false)} />
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function InvoiceTab({ accountsData, onInvoicePaid, onNavigate }) {
  const { user }  = useAuth();
  const isLive    = Boolean(user);
  const accounts  = { ...DEFAULT_ACCOUNTS, ...(accountsData ?? {}) };

  // ── Shared invoice state — syncs with MoneyTracker & AccountsTab ─────────────
  const { invoices, addInvoice, updateInvoice, nextNum } = useInvoices();

  const [screen,       setScreen]       = useState("list");
  const [activeInv,    setActiveInv]    = useState(null);
  const [draftInv,     setDraftInv]     = useState(null);
  const [previewDraft, setPreviewDraft] = useState(null);
  // Generated once when opening the Create screen — prevents counter drift
  const [pendingNum,   setPendingNum]   = useState(null);

  const openCreate = () => {
    setDraftInv(null);
    setPendingNum(nextNum());
    setScreen("create");
  };

  const handleSelect = (inv) => { setActiveInv(inv); setScreen("detail"); };

  const handleSaveDraft = (draft, status = "draft") => {
    addInvoice({ ...draft, id: draft.num, status });
    setDraftInv(null); setScreen("list");
  };

  const handlePreview = (draft) => { setPreviewDraft(draft); setScreen("preview"); };

  const handleSaveAndSend = (draft) => {
    const withSent = { ...draft, id: draft.num, status: "sent", sentAt: new Date().toISOString() };
    addInvoice(withSent);
    setPreviewDraft(null); setActiveInv(withSent); setScreen("detail");
  };

  const handleUpdate = (updated) => {
    updateInvoice(updated);
    setActiveInv(updated);
    if (updated.status === "paid" && onInvoicePaid) {
      onInvoicePaid({ invoice: updated, amount: calcInvoice(updated.lines, accounts.vatRegistered, accounts.frsRate).total });
    }
  };

  const goBack = () => { setScreen("list"); setActiveInv(null); setDraftInv(null); setPreviewDraft(null); };

  const overdueCount = invoices.filter(i => i.status === "overdue").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] relative">
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: "linear-gradient(rgba(153,197,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.5) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative max-w-4xl mx-auto px-4 py-6 space-y-4">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {screen !== "list" && (
              <button onClick={goBack} className="w-8 h-8 rounded-xl bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.12)] flex items-center justify-center text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all text-sm">
                ←
              </button>
            )}
            <div>
              <SL className="mb-0.5">Invoicing</SL>
              <div className="flex items-center gap-2 flex-wrap">
                {screen === "list" && overdueCount > 0 && (
                  <span className="text-xs font-black text-red-400">🔴 {overdueCount} overdue</span>
                )}
                <span className="flex items-center gap-1.5 text-[10px] text-[rgba(153,197,255,0.4)]">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-[rgba(153,197,255,0.3)]"}`} />
                  {isLive ? "Live" : "Demo"} · {accounts.vatRegistered ? `VAT FRS ${accounts.frsRate}%` : "No VAT"} · {(accounts.taxRate*100).toFixed(0)}% tax
                </span>
              </div>
            </div>
          </div>

          {screen === "list" && (
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors">
              + New invoice
            </button>
          )}
        </div>

        {/* Screen router */}
        {screen === "list"    && <InvoiceList invoices={invoices} accounts={accounts} onSelect={handleSelect} onCreate={openCreate} />}
        {screen === "create"  && <CreateInvoice accounts={accounts} draftInvoice={draftInv} invNum={pendingNum} onSave={handleSaveDraft} onPreview={handlePreview} onBack={goBack} />}
        {screen === "preview" && previewDraft && <InvoicePreview draft={previewDraft} accounts={accounts} business={BUSINESS} onEdit={() => { setPendingNum(previewDraft.num); setDraftInv(previewDraft); setScreen("create"); }} onSaveAndSend={handleSaveAndSend} onBack={() => setScreen("create")} />}
        {screen === "detail"  && activeInv && <InvoiceDetail invoice={activeInv} accounts={accounts} business={BUSINESS} onUpdate={handleUpdate} onBack={goBack} />}
      </div>
    </div>
  );
}
