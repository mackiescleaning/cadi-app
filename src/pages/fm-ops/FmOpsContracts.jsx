import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, ChevronRight, Loader2 } from 'lucide-react';
import { listContracts, CONTRACT_STATUS } from '../../lib/db/fmOpsDb';
import {
  blueCanvas, glassDark, primaryButton, ON_DARK, HOVER_LIFT, FM_POP as POP,
} from '../../lib/connectTheme';

const FREQ_LABEL = {
  weekly: 'Weekly', fortnightly: '2-wk', monthly: 'Mthly',
  quarterly: 'Qtrly', annual: 'Annual', one_off: 'One-off',
};

const TABS = [
  { id: 'active',     label: 'Active'     },
  { id: 'mobilising', label: 'Mobilising' },
  { id: 'paused',     label: 'Paused'     },
  { id: 'all',        label: 'All'        },
];

// CONTRACT_STATUS colours are tuned for light surfaces — brighten for navy.
const STATUS_POP = {
  mobilising: POP.amber,
  active:     POP.green,
  paused:     'rgba(255,255,255,0.55)',
  closed:     'rgba(255,255,255,0.40)',
};

function StatusPill({ status }) {
  const m = CONTRACT_STATUS[status] || { label: status };
  const c = STATUS_POP[status] || 'rgba(255,255,255,0.55)';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: c,
      background: c.startsWith('#') ? `${c}1f` : 'rgba(255,255,255,0.08)',
      border: `1px solid ${c.startsWith('#') ? `${c}42` : 'rgba(255,255,255,0.16)'}`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

export default function FmOpsContracts() {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('active');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const rows = await listContracts();
        if (alive) setContracts(rows);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    let r = contracts;
    if (tab !== 'all') r = r.filter(c => c.status === tab);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter(c =>
        c.name?.toLowerCase().includes(needle) ||
        c.endClient?.toLowerCase().includes(needle),
      );
    }
    return r;
  }, [contracts, tab, q]);

  return (
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'rgba(79,120,255,0.22)', color: POP.blue,
                border: '1px solid rgba(79,120,255,0.40)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><FileText size={17} /></div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: ON_DARK.muted }}>
                FM Operations · Contracts
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: ON_DARK.primary, margin: 0 }}>
              Your contract <span style={{ color: POP.blue }}>portfolio</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6, maxWidth: 520 }}>
              One row per FM client contract. Each contains N sites and an allocated contractor network.
            </div>
          </div>
          <button
            onClick={() => navigate('/fm-ops/contracts/new')}
            className={HOVER_LIFT}
            style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Plus size={14} /> New contract
          </button>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{
            ...glassDark({ radius: 12 }),
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', flex: 1, maxWidth: 340, minWidth: 220,
          }}>
            <Search size={13} color={ON_DARK.faint} />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search by contract or client…"
              style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, color: ON_DARK.primary, background: 'transparent' }}
            />
          </div>
          <div style={{ ...glassDark({ radius: 12 }), display: 'flex', gap: 4, padding: 4 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '6px 12px', borderRadius: 9,
                  background: tab === t.id ? 'rgba(79,120,255,0.28)' : 'transparent',
                  color: tab === t.id ? '#fff' : ON_DARK.muted,
                  border: tab === t.id ? '1px solid rgba(79,120,255,0.40)' : '1px solid transparent',
                  cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease',
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
            <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading contracts…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>
            Couldn't load contracts — {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: '44px 24px', borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.16)', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(79,120,255,0.18)', color: POP.blue, border: '1px solid rgba(79,120,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <FileText size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>
              {contracts.length === 0 ? 'No contracts yet' : 'Nothing matches this filter'}
            </div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, maxWidth: 400, margin: '0 auto 18px', lineHeight: 1.6 }}>
              {contracts.length === 0
                ? 'Drop in the FM client\'s site list and Cadi spins up a contract — sites, specs, allocations, marketplace.'
                : 'Switch tabs to see contracts in other states.'}
            </div>
            {contracts.length === 0 && (
              <button
                onClick={() => navigate('/fm-ops/contracts/new')}
                className={HOVER_LIFT}
                style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Plus size={14} /> New contract
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ ...glassDark({ radius: 18 }), overflow: 'hidden' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 40px',
              padding: '11px 18px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${ON_DARK.line}`,
              fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              <div>Contract</div>
              <div>Sites</div>
              <div>Frequency mix</div>
              <div>Per-visit avg</div>
              <div>Active subs</div>
              <div></div>
            </div>
            {filtered.map((c, i) => (
              <div
                key={c.id}
                onClick={() => navigate(`/fm-ops/contracts/${c.id}`)}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 40px',
                  padding: '14px 18px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                  alignItems: 'center', fontSize: 12, color: ON_DARK.primary, cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 3, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {c.endClient && <span style={{ fontWeight: 700, color: ON_DARK.secondary }}>{c.endClient}</span>}
                    {c.startsOn && <span>· started {new Date(c.startsOn).toLocaleDateString()}</span>}
                    <StatusPill status={c.status} />
                  </div>
                </div>
                <div style={{ color: ON_DARK.secondary }}>{c.siteCount} site{c.siteCount === 1 ? '' : 's'}</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {c.frequencies.length === 0 && <span style={{ fontSize: 10, color: ON_DARK.faint }}>—</span>}
                  {c.frequencies.map(f => (
                    <span key={f} style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 999,
                      background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`,
                      color: ON_DARK.secondary, fontWeight: 700,
                    }}>
                      {FREQ_LABEL[f] ?? f}
                    </span>
                  ))}
                </div>
                <div style={{ fontWeight: 800 }}>{c.perVisitAvg ? `£${c.perVisitAvg}` : '—'}</div>
                <div style={{ color: ON_DARK.secondary }}>{c.subCount || '—'}</div>
                <ChevronRight size={14} color={ON_DARK.faint} />
              </div>
            ))}
          </div>
        )}

        {!loading && !error && contracts.length > 0 && (
          <button
            onClick={() => navigate('/fm-ops/contracts/new')}
            style={{
              marginTop: 14, width: '100%', padding: '14px',
              border: '1.5px dashed rgba(251,146,60,0.40)', background: 'rgba(251,146,60,0.07)',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              color: POP.orange, fontWeight: 800, fontSize: 13,
            }}
          >
            <Plus size={14} /> New contract — upload site list to begin
          </button>
        )}
      </div>
    </div>
  );
}
