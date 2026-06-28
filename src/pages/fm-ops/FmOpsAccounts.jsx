import { useEffect, useMemo, useState } from 'react';
import {
  Receipt, Download, CheckCircle2, AlertCircle, Loader2,
  ChevronRight, X, Calendar, Eye,
} from 'lucide-react';
import {
  listFmInvoices,
  previewAccountsExport,
  runAccountsExport,
  markInvoicesPaid,
  INVOICE_STATUS,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const TABS = [
  { id: 'submitted', label: 'With FM'    },
  { id: 'exported',  label: 'Exported'   },
  { id: 'paid',      label: 'Paid'       },
  { id: 'all',       label: 'All'        },
];

function StatusPill({ status }) {
  const m = INVOICE_STATUS[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Export drawer ───────────────────────────────────────────────────────────
function ExportDrawer({ onClose, onDone }) {
  // Default period: current calendar month
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [periodFrom, setPeriodFrom] = useState(firstOfMonth);
  const [periodTo, setPeriodTo]     = useState(today);
  const [periodLabel, setPeriodLabel] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const doPreview = async () => {
    setBusy(true); setError(null); setPreview(null);
    try {
      const { ok, data } = await previewAccountsExport({ periodFrom, periodTo });
      if (!ok) throw new Error(data?.error || 'Preview failed');
      setPreview(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true); setError(null);
    try {
      const { ok, data } = await runAccountsExport({
        periodFrom, periodTo,
        periodLabel: periodLabel.trim() || `${periodFrom} → ${periodTo}`,
      });
      if (!ok) throw new Error(data?.error || 'Export failed');
      downloadCsv(`cadi-connect-${periodFrom}_${periodTo}.csv`, data.csv);
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', background: PAPER,
        borderLeft: `1px solid ${LINE}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>Export to accounts</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              Pick a period, preview the CSV, then export — submitted invoices in range flip to "exported".
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>From</div>
            <input
              type="date" value={periodFrom}
              onChange={e => setPeriodFrom(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER, color: INK }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>To</div>
            <input
              type="date" value={periodTo}
              onChange={e => setPeriodTo(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER, color: INK }}
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Period label (optional)</div>
          <input
            value={periodLabel}
            onChange={e => setPeriodLabel(e.target.value)}
            placeholder="e.g. June 2026"
            style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER, color: INK, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={doPreview} disabled={busy} style={{
            flex: 1, background: PAPER, color: NAVY, border: `1px solid ${NAVY}30`,
            borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            {busy && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            <Eye size={12} /> Preview
          </button>
          <button
            onClick={doExport}
            disabled={busy || !preview || preview.row_count === 0}
            style={{
              flex: 1, background: busy || !preview || preview.row_count === 0 ? MUTE : ACCENT,
              color: 'white', border: 'none',
              borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 800,
              cursor: busy || !preview ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Download size={12} /> Export &amp; download
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#b91c1c' }}>{error}</div>
        )}

        {preview && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 14 }}>
              <Kpi label="Rows in period"  value={preview.row_count}                       accent={preview.row_count ? NAVY : MUTE} />
              <Kpi label="Total value"     value={`£${Number(preview.total_value).toFixed(2)}`} accent={preview.row_count ? INK : MUTE} />
            </div>
            {preview.row_count === 0 ? (
              <div style={{ padding: 14, background: SOFT, borderRadius: 10, fontSize: 12, color: SUB }}>
                No submitted invoices in this period. Subs need to submit drafts before they appear here.
              </div>
            ) : (
              <div style={{ background: SOFT, borderRadius: 10, padding: 12, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: '#334155', maxHeight: 220, overflow: 'auto', whiteSpace: 'pre' }}>
                {preview.csv.split('\n').slice(0, 12).join('\n')}
                {preview.csv.split('\n').length > 12 ? '\n…' : ''}
              </div>
            )}
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function FmOpsAccounts() {
  const [tab, setTab] = useState('submitted');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [exportOpen, setExportOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [counts, setCounts] = useState({});

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const filter = tab === 'all' ? null : tab;
      const rows = await listFmInvoices({ status: filter });
      setInvoices(rows);
      setSelected(new Set());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // counts via all-rows (one fetch on mount + after actions)
  const loadCounts = async () => {
    try {
      const all = await listFmInvoices({});
      const c = { submitted: 0, exported: 0, paid: 0, all: all.length };
      all.forEach(i => { if (c[i.status] != null) c[i.status]++; });
      setCounts(c);
    } catch {}
  };
  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { load(); }, [tab]);

  const totals = useMemo(() => ({
    count: invoices.length,
    total: invoices.reduce((a, i) => a + (Number(i.total_value) || 0), 0),
    selected: invoices.filter(i => selected.has(i.id)).reduce((a, i) => a + (Number(i.total_value) || 0), 0),
  }), [invoices, selected]);

  const toggleAll = () => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map(i => i.id)));
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleMarkPaid = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Mark ${selected.size} invoice${selected.size === 1 ? '' : 's'} as paid?`)) return;
    setMarking(true); setError(null);
    try {
      const { ok, data } = await markInvoicesPaid([...selected]);
      if (!ok) throw new Error(data?.error || 'Mark-paid failed');
      await Promise.all([load(), loadCounts()]);
    } catch (e) { setError(e.message); }
    finally { setMarking(false); }
  };

  const canMarkPaid = tab === 'submitted' || tab === 'exported' || tab === 'all';

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Accounts inbox</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Submitted sub invoices, exports to your accounts system, and bulk mark-as-paid.
          </div>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          style={{
            background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <Download size={13} /> Export to CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        <Kpi label="With FM (to action)" value={counts.submitted ?? 0} accent={counts.submitted ? ACCENT : MUTE} />
        <Kpi label="Exported"            value={counts.exported ?? 0}  accent={NAVY} />
        <Kpi label="Paid"                value={counts.paid ?? 0}      accent={GREEN} />
        <Kpi label="Value in view"       value={`£${totals.total.toFixed(0)}`} accent={INK} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 4 }}>
          {TABS.map(t => {
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                  background: tab === t.id ? `${ACCENT}12` : 'transparent',
                  color: tab === t.id ? ACCENT : SUB,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, background: tab === t.id ? ACCENT : SOFT, color: tab === t.id ? 'white' : SUB, padding: '1px 6px', borderRadius: 999 }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        {canMarkPaid && selected.size > 0 && (
          <button
            onClick={handleMarkPaid}
            disabled={marking}
            style={{
              background: GREEN, color: 'white', border: 'none',
              borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 800,
              cursor: marking ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {marking && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            <CheckCircle2 size={12} /> Mark {selected.size} paid · £{totals.selected.toFixed(0)}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading invoices…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Receipt size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>No invoices here yet</div>
          <div style={{ fontSize: 12, color: SUB, maxWidth: 400, margin: '0 auto' }}>
            Subs submit drafts after their work is approved — they show up in <strong>With FM</strong> ready for export.
          </div>
        </div>
      )}

      {!loading && !error && invoices.length > 0 && (
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '32px 1.4fr 1.4fr 1fr 1fr 1fr 1fr',
            padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
            fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
            alignItems: 'center',
          }}>
            <input
              type="checkbox"
              checked={invoices.length > 0 && selected.size === invoices.length}
              onChange={toggleAll}
              style={{ accentColor: ACCENT, cursor: 'pointer' }}
            />
            <div>Reference</div>
            <div>Sub · Site</div>
            <div>Service date</div>
            <div>Net £</div>
            <div>Total £</div>
            <div>Status</div>
          </div>
          {invoices.map((inv, i) => (
            <div
              key={inv.id}
              style={{
                display: 'grid', gridTemplateColumns: '32px 1.4fr 1.4fr 1fr 1fr 1fr 1fr',
                padding: '12px 16px', borderBottom: i < invoices.length - 1 ? `1px solid ${LINE}` : 'none',
                alignItems: 'center', fontSize: 12, color: INK,
                background: selected.has(inv.id) ? `${ACCENT}06` : PAPER,
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(inv.id)}
                onChange={() => toggleOne(inv.id)}
                disabled={inv.status === 'paid' || inv.status === 'draft'}
                style={{ accentColor: ACCENT, cursor: inv.status === 'paid' || inv.status === 'draft' ? 'not-allowed' : 'pointer' }}
              />
              <div style={{ fontWeight: 800, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: INK }}>{inv.reference ?? '—'}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.subName}</div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.siteName ?? '—'}{inv.sitePostcode ? ` · ${inv.sitePostcode}` : ''}
                </div>
              </div>
              <div style={{ color: SUB }}>{inv.service_date ? new Date(inv.service_date).toLocaleDateString() : '—'}</div>
              <div>£{Number(inv.net_value ?? 0).toFixed(2)}</div>
              <div style={{ fontWeight: 800 }}>£{Number(inv.total_value ?? 0).toFixed(2)}</div>
              <div><StatusPill status={inv.status} /></div>
            </div>
          ))}
        </div>
      )}

      {exportOpen && <ExportDrawer onClose={() => setExportOpen(false)} onDone={() => { load(); loadCounts(); }} />}
    </div>
  );
}
