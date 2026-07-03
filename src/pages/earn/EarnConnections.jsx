import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, MapPin, ShoppingBag, Loader2, Network, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getMyConnectProfile } from '../../lib/db/connectDb';
import {
  CONNECT_COLORS, CONNECT_RADII, ON_DARK,
  glassDark, navyCanvas, HOVER_LIFT,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const GREEN  = '#22c55e';
const AMBER  = '#fbbf24';

const SUBLABEL = {
  fontSize: 10, fontWeight: 800, color: ON_DARK.muted,
  letterSpacing: '0.20em', textTransform: 'uppercase',
};

async function listMyFmConnections() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const [profile, jobsRes, invoicesRes] = await Promise.all([
    getMyConnectProfile(),
    supabase
      .from('jobs')
      .select(`
        id, status, approval_status, fm_organisation_id, completion_marked_at, created_at,
        fm_organisation:fm_organisations ( id, name, region )
      `)
      .eq('sub_user_id', user.id),
    supabase
      .from('connect_invoices')
      .select('id, total_value, status, fm_organisation_id, fm_organisation:fm_organisations ( id, name, region )')
      .eq('sub_user_id', user.id),
  ]);

  const jobs     = jobsRes.data     ?? [];
  const invoices = invoicesRes.data ?? [];

  const byFm = new Map();
  function ensure(orgId, orgName, region) {
    if (!byFm.has(orgId)) {
      byFm.set(orgId, {
        id:            orgId,
        name:          orgName,
        region:        region || '',
        jobsTotal:     0,
        jobsDone:      0,
        totalEarned:   0,
        pendingPay:    0,
        firstActivity: null,
      });
    }
    return byFm.get(orgId);
  }

  if (profile?.connect_unlocked_by_fm_id) {
    ensure(profile.connect_unlocked_by_fm_id, '(awaiting first job)', '');
  }

  for (const j of jobs) {
    if (!j.fm_organisation_id) continue;
    const cur = ensure(j.fm_organisation_id, j.fm_organisation?.name || 'FM', j.fm_organisation?.region);
    cur.name   = j.fm_organisation?.name   || cur.name;
    cur.region = j.fm_organisation?.region || cur.region;
    cur.jobsTotal++;
    if (j.completion_marked_at && j.approval_status === 'approved') cur.jobsDone++;
    if (!cur.firstActivity || (j.created_at && j.created_at < cur.firstActivity)) {
      cur.firstActivity = j.created_at;
    }
  }

  for (const i of invoices) {
    if (!i.fm_organisation_id) continue;
    const cur = ensure(i.fm_organisation_id, i.fm_organisation?.name || 'FM', i.fm_organisation?.region);
    cur.name   = i.fm_organisation?.name   || cur.name;
    cur.region = i.fm_organisation?.region || cur.region;
    const total = Number(i.total_value ?? 0);
    if (['submitted','exported','paid'].includes(i.status)) cur.totalEarned += total;
    if (['submitted','exported'].includes(i.status))        cur.pendingPay  += total;
  }

  return Array.from(byFm.values()).sort((a, b) => b.totalEarned - a.totalEarned);
}

function fmtMoney(n) {
  return `£${Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
function fmtSince(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function EarnConnections() {
  const [fms, setFms]       = useState([]);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(null);
  const [expanded, setExp]  = useState({});

  useEffect(() => {
    listMyFmConnections()
      .then(rows => {
        setFms(rows);
        if (rows.length > 0) setExp({ [rows[0].id]: true });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoad(false));
  }, []);

  const totalEarnedAll = fms.reduce((s, f) => s + f.totalEarned, 0);
  const totalPending   = fms.reduce((s, f) => s + f.pendingPay,  0);

  return (
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={navyCanvas()}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">

        {/* ─── HERO ──────────────────────────────────────────────── */}
        <div className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(194, 65, 12, 0.28) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(79, 120, 255, 0.20) 0%, transparent 60%),
              rgba(255,255,255,0.04)
            `,
          }}>
          <div className="relative px-6 md:px-9 py-7 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: ORANGE, boxShadow: '0 8px 20px -6px rgba(194,65,12,0.6)' }}>
                  <Network size={13} color="#ffffff" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/60 uppercase">FM Connections</span>
              </div>
              <h1 className="text-white mb-2"
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Every FM,{' '}
                <span style={{ color: '#ffb08a' }}>every relationship.</span>
              </h1>
              <p className="text-white/60 text-[14px] leading-relaxed max-w-2xl">
                FMs you've worked with, with totals across every job they've awarded you.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 shrink-0" style={{ minWidth: 300 }}>
              {[
                { label: 'FMs',      count: fms.length,           color: GREEN  },
                { label: 'Earned',   count: fmtMoney(totalEarnedAll), color: '#ffffff' },
                { label: 'Pending',  count: fmtMoney(totalPending),   color: AMBER  },
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  ...glassDark({ padding: 12, radius: 12, strong: true }),
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{count}</div>
                  <div style={{ ...SUBLABEL, marginTop: 5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ ...glassDark({ padding: 40, radius: CONNECT_RADII.lg }), textAlign: 'center', color: ON_DARK.muted, fontSize: 12 }}>
            <Loader2 size={18} className="mx-auto mb-2"
              style={{ animation: 'connectSpin 0.8s linear infinite' }} />
            Loading your FMs…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: '12px 14px', borderRadius: CONNECT_RADII.md,
            background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#fca5a5', fontSize: 13,
          }}>{error}</div>
        )}

        {!loading && !error && fms.length === 0 && (
          <div style={{
            ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
            textAlign: 'center',
          }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, #ff6a30 0%, ${ORANGE} 100%)`,
                boxShadow: '0 12px 30px -12px rgba(194,65,12,0.55)',
              }}>
              <Building2 size={22} color="#ffffff" strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>No FM connections yet</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 8, maxWidth: 420, margin: '8px auto 24px', lineHeight: 1.5 }}>
              Once an FM invites you or awards you a marketplace bid, they'll appear here with all your job + payment history.
            </div>
            <Link to="/connect/marketplace"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 22px', borderRadius: 12,
                background: `linear-gradient(180deg, #d64510 0%, ${ORANGE} 100%)`,
                color: '#ffffff', fontWeight: 900, fontSize: 13,
                textDecoration: 'none',
                boxShadow: '0 12px 30px -12px rgba(194,65,12,0.55)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}>
              <ShoppingBag size={14} /> Browse marketplace
            </Link>
          </div>
        )}

        {!loading && fms.map(fm => {
          const isOpen = expanded[fm.id];
          return (
            <div key={fm.id} className={HOVER_LIFT}
              style={{ ...glassDark({ radius: CONNECT_RADII.lg, strong: true }), overflow: 'hidden' }}>
              <button
                onClick={() => setExp(p => ({ ...p, [fm.id]: !p[fm.id] }))}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', cursor: 'pointer',
                  padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg, #7ea3ff, #010a4f)',
                  color: '#ffffff', fontWeight: 900, fontSize: 18, letterSpacing: '-0.02em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: '0 12px 30px -12px rgba(79,120,255,0.55)',
                }}>
                  {(fm.name?.[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>{fm.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 900,
                      background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)',
                      color: GREEN,
                      padding: '3px 9px', borderRadius: 999,
                      letterSpacing: '0.10em', textTransform: 'uppercase',
                    }}>
                      Connected
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {fm.region && (<><MapPin size={10} /> {fm.region}</>)}
                    {fm.region && fm.firstActivity && <span style={{ opacity: 0.5 }}>·</span>}
                    {fm.firstActivity && <span>since {fmtSince(fm.firstActivity)}</span>}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(fm.totalEarned)}</div>
                  <div style={{ ...SUBLABEL, marginTop: 3, textAlign: 'right' }}>total earned</div>
                </div>
                <ChevronDown size={16}
                  style={{
                    color: ON_DARK.muted, flexShrink: 0,
                    transition: 'transform 200ms ease',
                    transform: isOpen ? 'rotate(180deg)' : 'none',
                  }} />
              </button>

              {isOpen && (
                <div style={{
                  padding: '4px 20px 20px',
                  borderTop: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginTop: 16 }} className="md:!grid-cols-4">
                    {[
                      { label: 'Jobs awarded',  value: fm.jobsTotal,         color: '#ffffff' },
                      { label: 'Jobs approved', value: fm.jobsDone,          color: GREEN     },
                      { label: 'Total earned',  value: fmtMoney(fm.totalEarned), color: '#ffffff' },
                      { label: 'Pending pay',   value: fmtMoney(fm.pendingPay),  color: AMBER    },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12,
                        padding: '10px 12px',
                      }}>
                        <div style={{ ...SUBLABEL }}>{label}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color, marginTop: 6, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                    <Link to="/connect/pipeline"
                      style={{
                        padding: '10px 18px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.06)', color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.20)',
                        fontSize: 12, fontWeight: 800,
                        textDecoration: 'none',
                      }}>
                      View jobs
                    </Link>
                    <Link to="/connect/earnings"
                      style={{
                        padding: '10px 18px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.06)', color: '#ffffff',
                        border: '1px solid rgba(255,255,255,0.20)',
                        fontSize: 12, fontWeight: 800,
                        textDecoration: 'none',
                      }}>
                      Payment history
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
