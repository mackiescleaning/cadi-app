import { useEffect, useState } from 'react';
import {
  Receipt, FileText, CheckCircle2, AlertCircle, Building2, MapPin,
} from 'lucide-react';
import {
  listMyConnectInvoices,
  submitConnectInvoice,
} from '../../lib/db/connectDb';

const ORANGE = '#C2410C';
const GREEN  = '#16a34a';
const PURPLE = '#7c3aed';

const STATUS_CFG = {
  draft:     { label: 'Draft · ready to submit',      color: ORANGE },
  submitted: { label: 'Submitted · with FM',          color: PURPLE },
  exported:  { label: 'Exported to FM accounts',      color: '#3b82f6' },
  paid:      { label: 'Paid',                          color: GREEN  },
  disputed:  { label: 'Disputed',                      color: '#ef4444' },
  void:      { label: 'Void',                          color: '#94a3b8' },
};

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function InvoiceRow({ inv, onSubmit, busy }) {
  const status = STATUS_CFG[inv.status] || STATUS_CFG.draft;
  const [open, setOpen] = useState(false);
  const [netInput, setNetInput] = useState(String(inv.net_value ?? 0));
  const [vatInput, setVatInput] = useState(String(inv.vat_value ?? 0));
  const isDraft = inv.status === 'draft';

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderLeft: `4px solid ${status.color}`,
      borderRadius: 10, padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: status.color,
          background: `${status.color}15`, padding: '3px 8px', borderRadius: 999,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{status.label}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{inv.reference ?? '—'}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{inv.job?.site?.name ?? 'Site'}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Building2 size={9} /> {inv.fm_organisation?.name ?? '—'}
        <span style={{ color: '#cbd5e1' }}>·</span>
        <MapPin size={9} /> {inv.job?.site?.postcode ?? ''}
        <span style={{ color: '#cbd5e1' }}>·</span>
        Service {fmtDate(inv.service_date)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 10 }}>
        <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>£{Number(inv.net_value ?? 0).toFixed(2)}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>net</div>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>£{Number(inv.vat_value ?? 0).toFixed(2)}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>VAT</div>
        </div>
        <div style={{ background: `${ORANGE}10`, border: `1px solid ${ORANGE}25`, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: ORANGE }}>£{Number(inv.total_value ?? 0).toFixed(2)}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>total</div>
        </div>
      </div>

      {isDraft && (
        <>
          {open && (
            <div style={{ marginTop: 10, padding: 10, background: '#fafbff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                  Net (£)
                  <input value={netInput} onChange={e => setNetInput(e.target.value)} type="number" step="0.01" min="0"
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
                </label>
                <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                  VAT (£)
                  <input value={vatInput} onChange={e => setVatInput(e.target.value)} type="number" step="0.01" min="0"
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12 }} />
                </label>
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>
                Total will be £{(Number(netInput) + Number(vatInput)).toFixed(2)} after submit.
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button
              onClick={() => onSubmit(inv.id, Number(netInput), Number(vatInput))}
              disabled={busy === inv.id}
              style={{ flex: 1, fontSize: 12, fontWeight: 800, color: 'white', background: ORANGE, border: 'none', borderRadius: 7, padding: '8px 0', cursor: 'pointer', opacity: busy === inv.id ? 0.6 : 1 }}>
              {busy === inv.id ? 'Submitting…' : 'Submit invoice'}
            </button>
            <button
              onClick={() => setOpen(o => !o)}
              style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'none', border: '1px solid #cbd5e1', borderRadius: 7, padding: '8px 14px', cursor: 'pointer' }}>
              {open ? 'Hide edit' : 'Edit values'}
            </button>
          </div>
        </>
      )}

      {inv.status === 'paid' && (
        <div style={{ marginTop: 10, fontSize: 11, color: GREEN, fontWeight: 700 }}>
          ✓ Paid {fmtDate(inv.paid_at)}
        </div>
      )}
      {inv.status === 'exported' && (
        <div style={{ marginTop: 10, fontSize: 11, color: '#3b82f6' }}>
          With FM accounts since {fmtDate(inv.exported_at)} · payment expected on FM terms
        </div>
      )}
      {inv.status === 'submitted' && (
        <div style={{ marginTop: 10, fontSize: 11, color: PURPLE }}>
          Submitted {fmtDate(inv.submitted_at)} · waiting for FM accounts to pull into export
        </div>
      )}
    </div>
  );
}

export default function EarnInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter]     = useState('draft');
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [busyId, setBusyId]     = useState(null);

  async function reload() {
    setError('');
    try {
      const rows = await listMyConnectInvoices();
      setInvoices(rows);
    } catch (e) {
      setError(e.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  async function handleSubmit(id, net, vat) {
    setBusyId(id);
    try {
      const { ok, data } = await submitConnectInvoice({ invoiceId: id, netValue: net, vatValue: vat });
      if (!ok) {
        setError(data?.error || 'Submit failed');
      } else {
        await reload();
      }
    } catch (e) {
      setError(e.message || 'Submit failed');
    } finally {
      setBusyId(null);
    }
  }

  const tabs = [
    { id: 'draft',     label: 'Drafts' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'exported',  label: 'With FM' },
    { id: 'paid',      label: 'Paid' },
  ];
  const counts = invoices.reduce((acc, inv) => {
    const k = inv.status;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = invoices.filter(inv => {
    if (filter === 'draft')     return inv.status === 'draft';
    if (filter === 'submitted') return inv.status === 'submitted';
    if (filter === 'exported')  return inv.status === 'exported';
    if (filter === 'paid')      return inv.status === 'paid';
    return true;
  });

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={18} color={ORANGE} />
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>Invoicing</h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Auto-drafted the moment your FM approves a job. Edit if you need to, then submit.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: 4 }}>
        {tabs.map(t => {
          const isActive = filter === t.id;
          return (
            <button key={t.id} onClick={() => setFilter(t.id)} style={{
              fontSize: 11, fontWeight: isActive ? 800 : 600,
              padding: '6px 10px', borderRadius: 6,
              background: isActive ? `${ORANGE}12` : 'transparent',
              color: isActive ? ORANGE : '#64748b',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {t.label}
              <span style={{ fontSize: 9, color: isActive ? ORANGE : '#94a3b8', background: isActive ? `${ORANGE}15` : '#f1f5f9', padding: '1px 6px', borderRadius: 999, fontWeight: 800 }}>{counts[t.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'white', border: '1.5px dashed #e2e8f0', borderRadius: 12, color: '#64748b' }}>
          <FileText size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Nothing here</div>
          <div style={{ fontSize: 11, marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>
            Invoices appear here automatically the moment your FM approves a checked-out job.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(inv => (
            <InvoiceRow key={inv.id} inv={inv} onSubmit={handleSubmit} busy={busyId} />
          ))}
        </div>
      )}
    </div>
  );
}
