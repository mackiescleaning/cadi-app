import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2, MapPin, Filter } from 'lucide-react';
import { listFmJobs, JOB_STATUS } from '../../lib/db/fmOpsDb';
import {
  blueCanvas, glassDark, ghostButton, ON_DARK, FM_POP as POP,
} from '../../lib/connectTheme';

function fmtIsoDate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) {
  const r = new Date(d);
  const day = r.getDay(); // 0=Sun
  const offset = (day + 6) % 7; // Monday-first
  r.setDate(r.getDate() - offset);
  r.setHours(0,0,0,0);
  return r;
}

// JOB_STATUS db colours are for light surfaces — brighten for navy.
const STATUS_POP = {
  scheduled:   POP.blue,
  in_progress: POP.orange,
  complete:    POP.green,
  cancelled:   'rgba(255,255,255,0.40)',
  missed:      POP.red,
};

function StatusPill({ status }) {
  const m = JOB_STATUS[status] || { label: status };
  const c = STATUS_POP[status] || 'rgba(255,255,255,0.55)';
  const hex = c.startsWith('#');
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: c,
      background: hex ? `${c}1f` : 'rgba(255,255,255,0.08)',
      border: `1px solid ${hex ? `${c}42` : 'rgba(255,255,255,0.16)'}`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Kpi({ label, value, pop }) {
  return (
    <div style={{ ...glassDark({ radius: 14, padding: '13px 15px' }) }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || ON_DARK.primary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

const selectStyle = {
  padding: '7px 11px', fontSize: 12, fontWeight: 600,
  border: `1px solid ${ON_DARK.lineHi}`, borderRadius: 10,
  background: 'rgba(255,255,255,0.08)', color: ON_DARK.primary,
  cursor: 'pointer', outline: 'none', colorScheme: 'dark',
};

export default function FmOpsSchedule() {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subFilter, setSubFilter] = useState('');
  const [contractFilter, setContractFilter] = useState('');

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await listFmJobs({ from: fmtIsoDate(weekStart), to: fmtIsoDate(weekEnd) });
      setJobs(rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [weekStart.getTime()]);

  const subs = useMemo(() => {
    const set = new Map();
    jobs.forEach(j => { if (j.subName) set.set(j.subName, true); });
    return Array.from(set.keys()).sort();
  }, [jobs]);

  const contracts = useMemo(() => {
    const set = new Map();
    jobs.forEach(j => { if (j.contract?.name) set.set(j.contract.name, true); });
    return Array.from(set.keys()).sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j =>
      (!subFilter || j.subName === subFilter) &&
      (!contractFilter || j.contract?.name === contractFilter),
    );
  }, [jobs, subFilter, contractFilter]);

  const days = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const iso = fmtIsoDate(d);
      out.push({
        iso, date: d,
        jobs: filteredJobs.filter(j => j.date === iso).sort((a, b) =>
          (Number(a.start_hour) || 9) - (Number(b.start_hour) || 9),
        ),
      });
    }
    return out;
  }, [weekStart, filteredJobs]);

  const totals = useMemo(() => ({
    jobs:        filteredJobs.length,
    value:       filteredJobs.reduce((a, j) => a + (Number(j.price) || 0), 0),
    scheduled:   filteredJobs.filter(j => j.status === 'scheduled').length,
    complete:    filteredJobs.filter(j => j.status === 'complete').length,
    inProgress:  filteredJobs.filter(j => j.status === 'in_progress').length,
  }), [filteredJobs]);

  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${weekEnd.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

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
              }}><Calendar size={17} /></div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: ON_DARK.muted }}>
                FM Operations · Schedule
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: ON_DARK.primary, margin: 0 }}>
              The week's <span style={{ color: POP.blue }}>board</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6 }}>
              Every job across every contract for the chosen week. Filter by sub or contract.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              style={{ ...ghostButton({ size: 'sm', onDark: true }), display: 'flex', alignItems: 'center', padding: '8px 10px' }}
            ><ChevronLeft size={14} /></button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              style={{ ...ghostButton({ size: 'sm', onDark: true }), fontSize: 12 }}
            >Today</button>
            <span style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary, padding: '0 6px', minWidth: 160, textAlign: 'center' }}>{weekLabel}</span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              style={{ ...ghostButton({ size: 'sm', onDark: true }), display: 'flex', alignItems: 'center', padding: '8px 10px' }}
            ><ChevronRight size={14} /></button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <Kpi label="Jobs this week"   value={totals.jobs} />
          <Kpi label="Scheduled"        value={totals.scheduled}               pop={POP.blue} />
          <Kpi label="In progress"      value={totals.inProgress}              pop={totals.inProgress ? POP.orange : ON_DARK.faint} />
          <Kpi label="Value this week"  value={`£${totals.value.toFixed(0)}`}  pop={POP.green} />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <Filter size={12} color={ON_DARK.muted} />
          <select
            value={subFilter}
            onChange={e => setSubFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ color: '#010a4f' }}>All contractors</option>
            {subs.map(s => <option key={s} value={s} style={{ color: '#010a4f' }}>{s}</option>)}
          </select>
          <select
            value={contractFilter}
            onChange={e => setContractFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="" style={{ color: '#010a4f' }}>All contracts</option>
            {contracts.map(c => <option key={c} value={c} style={{ color: '#010a4f' }}>{c}</option>)}
          </select>
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
            <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading schedule…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>{error}</div>
        )}

        {!loading && !error && totals.jobs === 0 && (
          <div style={{ padding: '44px 24px', borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.16)', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(79,120,255,0.18)', color: POP.blue, border: '1px solid rgba(79,120,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <Calendar size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>Nothing on the schedule this week</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
              Awarded marketplace listings + allocated visit specs land here as scheduled jobs.
            </div>
          </div>
        )}

        {!loading && !error && totals.jobs > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {days.map(day => {
              const today = fmtIsoDate(new Date()) === day.iso;
              return (
                <div key={day.iso} style={{
                  ...glassDark({ radius: 16, strong: today }),
                  border: `1px solid ${today ? 'rgba(251,146,60,0.40)' : ON_DARK.line}`,
                  borderLeft: `4px solid ${today ? POP.orange : day.jobs.length ? POP.blue : 'rgba(255,255,255,0.14)'}`,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px',
                    background: today ? 'rgba(251,146,60,0.08)' : 'rgba(255,255,255,0.04)',
                    borderBottom: day.jobs.length ? `1px solid ${ON_DARK.line}` : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: today ? POP.orange : ON_DARK.primary }}>
                        {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: ON_DARK.muted }}>
                        {day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                      {today && (
                        <span style={{ fontSize: 9, fontWeight: 800, color: POP.orange, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Today</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: ON_DARK.muted }}>
                      {day.jobs.length === 0 ? 'No jobs' : `${day.jobs.length} job${day.jobs.length === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  {day.jobs.map((j, i) => (
                    <div key={j.id} style={{
                      display: 'grid', gridTemplateColumns: '90px 2fr 1.4fr 1fr 1fr',
                      gap: 10, alignItems: 'center',
                      padding: '12px 16px',
                      borderTop: i > 0 ? `1px solid ${ON_DARK.line}` : 'none',
                      fontSize: 12,
                    }}>
                      <div style={{ fontWeight: 800, color: POP.blue, fontFamily: 'ui-monospace,Menlo,monospace' }}>
                        {String(Math.floor(Number(j.start_hour) || 9)).padStart(2, '0')}:
                        {String(Math.round((Number(j.start_hour) || 9) % 1 * 60)).padStart(2, '0')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.site?.name ?? j.service ?? 'Job'}
                        </div>
                        <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={10} /> {j.site?.postcode ?? ''}
                          {j.contract?.name && <span>· {j.contract.name}</span>}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {j.subName ?? '— unassigned'}
                        </div>
                        <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                          {j.source === 'marketplace' ? 'Marketplace' : j.source === 'direct' ? 'Direct' : j.source}
                        </div>
                      </div>
                      <div style={{ fontWeight: 800, color: ON_DARK.primary }}>£{j.price ?? 0}</div>
                      <div><StatusPill status={j.status} /></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
