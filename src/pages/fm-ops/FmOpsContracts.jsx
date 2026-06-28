import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, ChevronRight, Loader2 } from 'lucide-react';
import { listContracts, CONTRACT_STATUS } from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT = '#f1f5f9';

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

function StatusPill({ status }) {
  const m = CONTRACT_STATUS[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999,
      whiteSpace: 'nowrap',
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
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Contracts</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            One row per FM client contract. Each contains N sites and an allocated contractor network.
          </div>
        </div>
        <button
          onClick={() => navigate('/fm-ops/contracts/new')}
          style={{
            background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <Plus size={13} /> New contract
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
          padding: '6px 10px', flex: 1, maxWidth: 320,
        }}>
          <Search size={12} color={MUTE} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by contract or client…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, color: INK, background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 4 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                background: tab === t.id ? `${ACCENT}12` : 'transparent',
                color: tab === t.id ? ACCENT : SUB,
                border: 'none', cursor: 'pointer',
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading contracts…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
          Couldn't load contracts — {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <FileText size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>
            {contracts.length === 0 ? 'No contracts yet' : 'Nothing matches this filter'}
          </div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
            {contracts.length === 0
              ? 'Drop in the FM client\'s site list and Cadi spins up a contract — sites, specs, allocations, marketplace.'
              : 'Switch tabs to see contracts in other states.'}
          </div>
          {contracts.length === 0 && (
            <button
              onClick={() => navigate('/fm-ops/contracts/new')}
              style={{
                background: ACCENT, color: 'white', border: 'none',
                borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={13} /> New contract
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 40px',
            padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
            fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
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
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.4fr 1fr 1fr 40px',
                padding: '14px 16px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${LINE}` : 'none',
                alignItems: 'center', fontSize: 12, color: INK, cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 10, color: MUTE, marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {c.endClient && <span style={{ fontWeight: 700 }}>{c.endClient}</span>}
                  {c.startsOn && <span>· started {new Date(c.startsOn).toLocaleDateString()}</span>}
                  <StatusPill status={c.status} />
                </div>
              </div>
              <div style={{ color: SUB }}>{c.siteCount} site{c.siteCount === 1 ? '' : 's'}</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {c.frequencies.length === 0 && <span style={{ fontSize: 10, color: MUTE }}>—</span>}
                {c.frequencies.map(f => (
                  <span key={f} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: SOFT, color: SUB, fontWeight: 700 }}>
                    {FREQ_LABEL[f] ?? f}
                  </span>
                ))}
              </div>
              <div style={{ fontWeight: 800 }}>{c.perVisitAvg ? `£${c.perVisitAvg}` : '—'}</div>
              <div style={{ color: SUB }}>{c.subCount || '—'}</div>
              <ChevronRight size={14} color={MUTE} />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && contracts.length > 0 && (
        <button
          onClick={() => navigate('/fm-ops/contracts/new')}
          style={{
            marginTop: 14, width: '100%', padding: '14px',
            border: `1.5px dashed ${ACCENT}50`, background: `${ACCENT}06`,
            borderRadius: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: ACCENT, fontWeight: 800, fontSize: 13,
          }}
        >
          <Plus size={14} /> New contract — upload site list to begin
        </button>
      )}
    </div>
  );
}
