// src/pages/Scheduler/JobDrawer.jsx
// Right-side drawer for viewing/editing a single job.
// Extracted verbatim from Scheduler.jsx. Note: this is a slide-in drawer,
// not a centred modal, so it does NOT use ModalShell.

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Pencil, Trash2, CheckCircle2, FileText, Send } from "lucide-react";
import { TYPE, STATUS_STYLES, STATUS_LABELS } from "../../lib/jobTheme";
import { useData } from "../../context/DataContext";
import { supabase } from "../../lib/supabase";
import { updateInvoice } from "../../lib/db/invoiceDb";
import { BILLING_MODES } from "../../lib/billing";
import {
  fmtTime,
  durLabel,
  fmtMoney,
  getJobAssignees,
  getJobAssigneeLabel,
  tintForCrew,
} from "./helpers";
import RiskChip from "./RiskChip";

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400">{children}</p>;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TypeBadge({ type }) {
  const s = TYPE[type] ?? { label: type, chip: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Payment section ───────────────────────────────────────────────────────
// Shows the customer's billing_mode (so the owner can see what will happen
// when they mark the job Done), surfaces any invoice that already includes
// this job's line, and gives one-click "Mark paid" / "Open invoice" actions.
// Fully read-only when no customer is linked — keeps older non-linked jobs
// working without crashing.
function PaymentSection({ job, customer, onClose }) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const billingMode = customer?.billing_mode || customer?.billingMode || 'invoice_per_job';
  const modeLabel = BILLING_MODES.find(m => m.key === billingMode)?.label ?? 'Invoice per job';

  // Look for any invoice that already contains a line referencing this job.
  // We narrow to drafts + recent invoices first to keep this cheap. lines is
  // a jsonb array of {job_id, ...}, so we use a containment filter.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from('invoices')
          .select('id, invoice_num, status, date, lines, paid_at, sent_at, payment_method')
          .filter('lines', 'cs', JSON.stringify([{ job_id: job.id }]))
          .order('created_at', { ascending: false })
          .limit(1);
        if (cancelled) return;
        setInvoice(data?.[0] ?? null);
      } catch {
        if (!cancelled) setInvoice(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [job.id]);

  const markPaid = async () => {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateInvoice(invoice.id, {
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      setInvoice(prev => ({ ...prev, ...updated }));
    } catch {
      setError("Couldn't mark this paid. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const openInvoice = () => {
    if (!invoice) return;
    onClose?.();
    navigate(`/invoices/${invoice.id}`);
  };

  const isComplete = job.status === 'complete';
  const isPaid     = invoice?.status === 'paid' || !!invoice?.paid_at;
  const isSent     = !!invoice?.sent_at;

  // Visual state — pill colour + headline
  let stateLabel, stateCls;
  if (isPaid) {
    stateLabel = 'Paid';
    stateCls   = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  } else if (invoice) {
    stateLabel = isSent ? 'Sent — awaiting payment' : `${invoice.status?.[0]?.toUpperCase()}${invoice.status?.slice(1) || 'Draft'}`;
    stateCls   = isSent ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200';
  } else if (isComplete) {
    stateLabel = 'No invoice yet';
    stateCls   = 'bg-amber-50 text-amber-700 border-amber-200';
  } else {
    stateLabel = 'Will draft on completion';
    stateCls   = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  return (
    <div>
      <SectionLabel>Payment</SectionLabel>
      <div className="mt-2 rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Billing mode + status header */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 font-medium">Billing mode</p>
            <p className="text-sm font-bold text-slate-900 truncate">{modeLabel}</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md border shrink-0 ${stateCls}`}>
            {stateLabel}
          </span>
        </div>

        {/* Invoice row — only shown when one exists */}
        {invoice && (
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
              <FileText size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{invoice.invoice_num}</p>
              <p className="text-[11px] text-slate-500">
                {invoice.date ? new Date(invoice.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                {invoice.lines && invoice.lines.length > 1 ? ` · ${invoice.lines.length} lines` : ''}
              </p>
            </div>
            <p className="text-sm font-black tabular-nums text-emerald-600">
              £{fmtMoney((invoice.lines || []).reduce((s, l) => s + (Number(l.total ?? l.unit_price ?? 0) || 0), 0))}
            </p>
          </div>
        )}

        {/* Loading row */}
        {loading && !invoice && (
          <div className="px-4 py-2.5 text-[11px] text-slate-400 italic">Checking invoices…</div>
        )}

        {/* Actions */}
        <div className="px-3 py-2 flex items-center gap-1.5 flex-wrap">
          {invoice && !isPaid && (
            <button
              onClick={markPaid}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={12} /> {busy ? 'Saving…' : 'Mark paid'}
            </button>
          )}
          {invoice && !isSent && !isPaid && billingMode !== 'gocardless' && (
            <button
              onClick={openInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-700 transition-colors"
            >
              <Send size={12} /> Send invoice
            </button>
          )}
          {invoice && (
            <button
              onClick={openInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-700 text-slate-700 transition-colors"
            >
              <FileText size={12} /> Open invoice
            </button>
          )}
          {!invoice && customer?.id && (
            <button
              onClick={() => { onClose?.(); navigate(`/customers/${customer.id}`); }}
              className="text-[11px] font-semibold text-slate-500 hover:text-blue-700 transition-colors"
            >
              Change billing mode →
            </button>
          )}
        </div>

        {error && (
          <div className="px-4 py-2 text-[11px] text-red-700 bg-red-50 border-t border-red-100">{error}</div>
        )}
      </div>
    </div>
  );
}

export default function JobDrawer({ job, onClose, onUpdateJob, onDeleteJob, onEditJob, risk = null }) {
  const { customers } = useData();
  // Resolve the customer for this job. Falls back to a name match so older
  // jobs without a customerId still get a billing-mode read.
  const linkedCustomer = useMemo(() => {
    if (!customers) return null;
    if (job.customerId) return customers.find(c => c.id === job.customerId) ?? null;
    if (job.customer) return customers.find(c => (c.name || '').toLowerCase() === String(job.customer).toLowerCase()) ?? null;
    return null;
  }, [customers, job.customerId, job.customer]);

  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState(job.notes || '');
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hasChanges = status !== job.status || notes !== (job.notes || '');

  const handleSave = async () => {
    setSaving(true);
    setDrawerError(null);
    try {
      await onUpdateJob?.(job.id, { status, notes });
      setSaving(false);
      onClose();
    } catch {
      setDrawerError('Could not save changes. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await onDeleteJob?.(job.id);
      onClose();
    } catch {
      setDrawerError('Could not delete job. Please try again.');
      setConfirmDelete(false);
    }
  };

  const t = TYPE[job.type] || TYPE.residential;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100" style={{ background: t.fill }}>
          <div>
            <p className="font-black text-base text-slate-900">{job.customer}</p>
            <p className="text-xs text-slate-600 mt-0.5">{job.service}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEditJob?.(job)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <Pencil size={12} />
              Edit
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <StatusBadge status={status} />
            <TypeBadge type={job.type} />
            {risk && <RiskChip risk={risk} />}
          </div>
          {risk?.reasons?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Things to check</p>
              {risk.reasons.map((r, i) => (
                <p key={i} className="text-xs text-amber-900 flex items-start gap-1.5">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500" />
                  <span>{r.label}</span>
                </p>
              ))}
            </div>
          )}

          {getJobAssignees(job).length > 1 && (
            <div>
              <SectionLabel>Team on this job</SectionLabel>
              <div className="flex gap-2 mt-2 flex-wrap">
                {getJobAssignees(job).map(name => (
                  <div key={name} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-full">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                      style={{ background: tintForCrew(name) }}
                    >{name.charAt(0).toUpperCase()}</span>
                    <span className="text-xs font-semibold text-slate-700">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {[
              ["Date",      job.date ? new Date(job.date + 'T00:00:00').toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—"],
              ["Address",   [job.addressLine1, job.addressLine2, job.postcode].filter(Boolean).join(', ') || job.postcode || "—"],
              ["Frequency", job.recurrence && job.recurrence !== 'one-off' ? job.recurrence.charAt(0).toUpperCase() + job.recurrence.slice(1) : "One-off"],
              ["Time",      `${fmtTime(job.startHour)} — ${fmtTime(job.startHour + job.durationHrs)}`],
              ["Duration",  durLabel(job.durationHrs)],
              ["Price",     `£${job.price}`],
              ["Assignee",  getJobAssigneeLabel(job)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className={`font-semibold ${label === "Price" ? "text-emerald-600" : label === "Assignee" && getJobAssignees(job).length === 0 ? "text-red-600" : "text-slate-900"}`}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          <div>
            <SectionLabel>Update status</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {["scheduled","in-progress","complete","unassigned"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 text-xs font-bold uppercase tracking-wide rounded-lg border transition-all ${
                    status === st
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          {/* Payment — only when there's a linked customer to drive billing.
              Without a link the section would be confusing rather than useful. */}
          {linkedCustomer && <PaymentSection job={job} customer={linkedCustomer} onClose={onClose} />}

          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-2 w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Add job notes, access codes, client preferences…"
            />
          </div>

          {drawerError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{drawerError}</div>
          )}
          {confirmDelete ? (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-red-700">Delete this job? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide rounded-xl transition-all ${
                  hasChanges && !saving
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
