import { useEffect, useState } from 'react';
import {
  ClipboardList, MapPin, Building2, Calendar, AlertCircle, ChevronRight,
} from 'lucide-react';
import { listMyAssignedVisitSpecs } from '../../lib/db/connectDb';

const ORANGE = '#C2410C';

function fmtFreq(f) {
  return {
    weekly:      'Weekly',
    fortnightly: 'Fortnightly',
    monthly:     'Monthly',
    quarterly:   'Quarterly',
    annual:      'Annual',
    one_off:     'One-off',
  }[f] ?? f;
}

const STATUS_CFG = {
  unassigned: { label: 'Unassigned',  color: '#94a3b8' },
  assigned:   { label: 'Assigned',    color: '#3b82f6' },
  marketplace:{ label: 'Marketplace', color: '#a78bfa' },
  active:     { label: 'Active',      color: '#16a34a' },
  closed:     { label: 'Closed',      color: '#64748b' },
};

function VisitSpecRow({ spec }) {
  const status = STATUS_CFG[spec.status] || STATUS_CFG.assigned;
  const site = spec.site;
  const fm   = spec.fm_organisation;

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
        <span style={{ fontSize: 10, color: '#64748b' }}>{fm?.name ?? '—'}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{site?.name ?? 'Site'}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MapPin size={9} />
        {site?.postcode ?? ''} · {fmtFreq(spec.frequency)} · {spec.scope}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>£{spec.price_per_visit}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>per visit</span>
        {spec.duration_minutes && (
          <>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>{spec.duration_minutes} min on site</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button style={{
          fontSize: 11, fontWeight: 800, color: ORANGE,
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          View job card <ChevronRight size={11} />
        </button>
      </div>
      {spec.access_notes && (
        <div style={{ marginTop: 10, padding: '8px 10px', background: '#fafbff', borderRadius: 6, fontSize: 11, color: '#475569' }}>
          <strong style={{ color: '#0f172a' }}>Access:</strong> {spec.access_notes}
        </div>
      )}
    </div>
  );
}

export default function EarnPipeline() {
  const [specs, setSpecs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    let alive = true;
    listMyAssignedVisitSpecs()
      .then(rows => { if (alive) setSpecs(rows); })
      .catch(e => { if (alive) setError(e.message || 'Failed to load jobs'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // Group by FM
  const byFm = specs.reduce((acc, s) => {
    const key = s.fm_organisation?.id ?? 'unknown';
    if (!acc[key]) acc[key] = { name: s.fm_organisation?.name ?? 'Unknown FM', specs: [] };
    acc[key].specs.push(s);
    return acc;
  }, {});

  const totalActive = specs.filter(s => ['assigned', 'active'].includes(s.status)).length;
  const totalValue  = specs
    .filter(s => ['assigned', 'active'].includes(s.status))
    .reduce((sum, s) => sum + (parseFloat(s.price_per_visit) || 0), 0);

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} color={ORANGE} />
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>My Jobs</h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Recurring work assigned to you across every connected FM
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{totalActive}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Active recurring jobs</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>£{totalValue.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Per-visit value (active)</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{Object.keys(byFm).length}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 4 }}>Connected FMs</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading your jobs…</div>
      ) : specs.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'white', border: '1.5px dashed #e2e8f0', borderRadius: 12,
          color: '#64748b',
        }}>
          <ClipboardList size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>No jobs assigned yet</div>
          <div style={{ fontSize: 11, marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>
            Once you win a marketplace listing — or the FM allocates a site directly to you — the job appears here.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(byFm).map(([fmId, group]) => (
            <div key={fmId}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Building2 size={13} color="#64748b" />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{group.name}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>· {group.specs.length} job{group.specs.length === 1 ? '' : 's'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.specs.map(s => <VisitSpecRow key={s.id} spec={s} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
