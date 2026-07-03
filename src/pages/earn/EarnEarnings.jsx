import { useEffect, useMemo, useState } from 'react';
import {
  PoundSterling, AlertCircle, Building2, Loader2,
} from 'lucide-react';
import { listMyConnectInvoices } from '../../lib/db/connectDb';
import {
  CONNECT_COLORS, CONNECT_RADII, ON_DARK,
  glassDark, navyCanvas, HOVER_LIFT,
} from '../../lib/connectTheme';

const ORANGE = '#ffb08a';  // softened orange for accent on navy
const GREEN  = '#22c55e';
const PURPLE = '#c084fc';
const BLUE   = '#7ea3ff';
const AMBER  = '#fbbf24';

function fmtDate(s) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function fmtMoney(n) {
  return `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

const SUBLABEL = {
  fontSize: 10, fontWeight: 800, color: ON_DARK.muted,
  letterSpacing: '0.20em', textTransform: 'uppercase',
};

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

      if (inv.status === 'paid' && inv.paid_at)              recent.push({ e: `Marked paid · ${fmtMoney(total)} · ${inv.reference ?? inv.id.slice(0,8)}`, d: inv.paid_at, c: GREEN });
      else if (inv.status === 'exported' && inv.exported_at) recent.push({ e: `Exported to FM accounts · ${fmtMoney(total)}`,                              d: inv.exported_at, c: BLUE });
      else if (inv.status === 'submitted' && inv.submitted_at) recent.push({ e: `Submitted invoice · ${fmtMoney(total)}`,                                  d: inv.submitted_at, c: PURPLE });
      else if (inv.status === 'draft')                        recent.push({ e: `Approved · invoice draft ready · ${fmtMoney(total)}`,                     d: inv.created_at, c: ORANGE });
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
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={navyCanvas()}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">

        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(194, 65, 12, 0.28) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(79, 120, 255, 0.20) 0%, transparent 60%),
              rgba(255,255,255,0.04)
            `,
          }}>
          <div className="relative px-6 md:px-9 py-7 md:py-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: CONNECT_COLORS.orange, boxShadow: '0 8px 20px -6px rgba(194,65,12,0.6)' }}>
                <PoundSterling size={13} color="#ffffff" strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black tracking-[0.28em] text-white/60 uppercase">Earnings</span>
            </div>
            <h1 className="text-white mb-2"
              style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              Every pound,{' '}
              <span style={{ color: '#ffb08a' }}>tracked to source.</span>
            </h1>
            <p className="text-white/60 text-[14px] leading-relaxed max-w-2xl">
              Status mirrors what FM accounts mark in their export file — draft, submitted, exported, paid.
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: CONNECT_RADII.md,
            background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ ...glassDark({ padding: 40, radius: CONNECT_RADII.lg }), textAlign: 'center', color: ON_DARK.muted, fontSize: 12 }}>
            <Loader2 size={18} className="mx-auto mb-2"
              style={{ animation: 'connectSpin 0.8s linear infinite' }} />
            Loading…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {/* ─── KPI STRIP ──────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }} className="md:!grid-cols-4">
              {[
                { label: 'Earned · this month', value: fmtMoney(totals.earnedMonth), color: GREEN  },
                { label: 'Pending payment',      value: fmtMoney(totals.pending),      color: AMBER  },
                { label: 'Paid · this month',    value: fmtMoney(totals.paidThisMonth), color: '#ffffff' },
                { label: 'Earned · YTD',         value: fmtMoney(totals.earnedYtd),    color: PURPLE },
              ].map(({ label, value, color }) => (
                <div key={label} className={HOVER_LIFT}
                  style={{ ...glassDark({ padding: 16, radius: CONNECT_RADII.lg, strong: true }) }}>
                  <div style={{ ...SUBLABEL, marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── PER-FM BREAKDOWN ──────────────────────────────── */}
            <div style={{ ...glassDark({ padding: 20, radius: CONNECT_RADII.xl, strong: true }) }}>
              <div style={{ ...SUBLABEL, marginBottom: 14 }}>Per-FM breakdown</div>
              {totals.perFm.length === 0 ? (
                <div style={{ fontSize: 12, color: ON_DARK.muted, textAlign: 'center', padding: 24 }}>
                  Earnings show here as soon as a job is approved.
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                    padding: '0 0 10px', ...SUBLABEL,
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <span>FM</span>
                    <span>Earned · 30d</span>
                    <span>Pending</span>
                    <span>Paid · 30d</span>
                  </div>
                  {totals.perFm.map((f, i) => (
                    <div key={f.id} style={{
                      display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
                      padding: '14px 0',
                      borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      alignItems: 'center',
                    }}>
                      <span style={{
                        color: '#ffffff', fontWeight: 900, fontSize: 13,
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}>
                        <Building2 size={12} color={ON_DARK.muted} /> {f.name}
                      </span>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(f.earned)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: AMBER, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(f.pending)}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: GREEN, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtMoney(f.paid)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ─── ACTIVITY TIMELINE ─────────────────────────────── */}
            <div style={{ ...glassDark({ padding: 20, radius: CONNECT_RADII.xl, strong: true }) }}>
              <div style={{ ...SUBLABEL, marginBottom: 14 }}>Recent payment activity</div>
              {totals.recent.length === 0 ? (
                <div style={{ fontSize: 12, color: ON_DARK.muted, textAlign: 'center', padding: 24 }}>
                  No activity yet.
                </div>
              ) : (
                totals.recent.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 0',
                    borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    fontSize: 12,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: a.c, boxShadow: `0 0 0 4px ${a.c}22`,
                      flexShrink: 0,
                    }} />
                    <span style={{ color: '#ffffff', fontWeight: 700, flex: 1 }}>{a.e}</span>
                    <span style={{ color: ON_DARK.faint, fontSize: 11, minWidth: 60, textAlign: 'right' }}>
                      {fmtDate(a.d)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
