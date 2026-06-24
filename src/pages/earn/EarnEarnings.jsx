import { useEffect, useMemo, useState } from 'react';
import {
  PoundSterling, TrendingUp, Clock, CheckCircle2, AlertCircle, Building2,
} from 'lucide-react';
import { listMyConnectInvoices } from '../../lib/db/connectDb';

const ORANGE = '#C2410C';
const GREEN  = '#16a34a';
const PURPLE = '#7c3aed';
const NAVY   = '#010a4f';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtMoney(n) {
  return `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function EarnEarnings() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    let alive = true;
    listMyConnectInvoices()
      .then(rows => { if (alive) setInvoices(rows); })
      .catch(e => { if (alive) setError(e.message || 'Failed to load earnings'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const totals = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart  = new Date(now.getFullYear(), 0, 1);

    let paidThisMonth = 0;
    let pending       = 0;
    let earnedYtd     = 0;
    let earnedMonth   = 0;
    const perFm = new Map();
    const recent = [];

    for (const inv of invoices) {
      const total = Number(inv.total_value ?? 0);
      const dt = inv.created_at ? new Date(inv.created_at) : null;
      const isMonth = dt && dt >= monthStart;
      const isYear  = dt && dt >= yearStart;

      // Earned counts approved+ (drafts also count as earned but not paid)
      if (['draft','submitted','exported','paid'].includes(inv.status)) {
        if (isYear)  earnedYtd   += total;
        if (isMonth) earnedMonth += total;
      }

      if (inv.status === 'paid') {
        const paidDt = inv.paid_at ? new Date(inv.paid_at) : null;
        if (paidDt && paidDt >= monthStart) paidThisMonth += total;
      }

      if (['draft','submitted','exported'].includes(inv.status)) {
        pending += total;
      }

      const fmId   = inv.fm_organisation?.id ?? 'unknown';
      const fmName = inv.fm_organisation?.name ?? 'Unknown FM';
      const cur = perFm.get(fmId) ?? { name: fmName, earned: 0, pending: 0, paid: 0 };
      if (['draft','submitted','exported','paid'].includes(inv.status) && isMonth) cur.earned += total;
      if (['draft','submitted','exported'].includes(inv.status))                  cur.pending += total;
      if (inv.status === 'paid' && inv.paid_at && new Date(inv.paid_at) >= monthStart) cur.paid += total;
      perFm.set(fmId, cur);

      // Activity timeline — last 10 events
      if (inv.status === 'paid' && inv.paid_at)            recent.push({ e: `Marked paid · ${fmtMoney(total)} · ${inv.reference ?? inv.id.slice(0,8)}`, d: inv.paid_at, c: GREEN });
      else if (inv.status === 'exported' && inv.exported_at) recent.push({ e: `Exported to FM accounts · ${fmtMoney(total)}`, d: inv.exported_at, c: '#3b82f6' });
      else if (inv.status === 'submitted' && inv.submitted_at) recent.push({ e: `Submitted invoice · ${fmtMoney(total)}`, d: inv.submitted_at, c: PURPLE });
      else if (inv.status === 'draft')                       recent.push({ e: `Approved · invoice draft ready · ${fmtMoney(total)}`, d: inv.created_at, c: NAVY });
    }

    recent.sort((a, b) => new Date(b.d) - new Date(a.d));

    return {
      paidThisMonth,
      pending,
      earnedYtd,
      earnedMonth,
      perFm: Array.from(perFm.entries()).map(([id, v]) => ({ id, ...v })),
      recent: recent.slice(0, 10),
    };
  }, [invoices]);

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PoundSterling size={18} color={ORANGE} />
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>Earnings</h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Status mirrors what FM accounts mark in their export file.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading…</div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: GREEN, lineHeight: 1 }}>{fmtMoney(totals.earnedMonth)}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Earned · this month</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: ORANGE, lineHeight: 1 }}>{fmtMoney(totals.pending)}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Pending payment</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: NAVY, lineHeight: 1 }}>{fmtMoney(totals.paidThisMonth)}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Paid · this month</div>
            </div>
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: PURPLE, lineHeight: 1 }}>{fmtMoney(totals.earnedYtd)}</div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Earned · YTD</div>
            </div>
          </div>

          {/* Per-FM breakdown */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Per-FM breakdown</div>
            {totals.perFm.length === 0 ? (
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                Earnings show here as soon as a job is approved.
              </div>
            ) : (
              totals.perFm.map((f, i) => (
                <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '10px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building2 size={11} color="#64748b" /> {f.name}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{fmtMoney(f.earned)}</div>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>earned · 30d</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: ORANGE }}>{fmtMoney(f.pending)}</div>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>pending</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: GREEN }}>{fmtMoney(f.paid)}</div>
                    <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>paid · 30d</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Activity timeline */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Recent payment activity</div>
            {totals.recent.length === 0 ? (
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: 20 }}>
                No activity yet.
              </div>
            ) : (
              totals.recent.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid #f1f5f9' : 'none', fontSize: 11 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.c }} />
                  <span style={{ color: '#0f172a', fontWeight: 700, flex: 1 }}>{a.e}</span>
                  <span style={{ color: '#94a3b8', fontSize: 10, minWidth: 60, textAlign: 'right' }}>{fmtDate(a.d)}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
