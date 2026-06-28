import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Loader2, MapPin, Filter } from 'lucide-react';
import { listFmJobs, JOB_STATUS } from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

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

function StatusPill({ status }) {
  const m = JOB_STATUS[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
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
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Schedule</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Every job across every contract for the chosen week. Filter by sub or contract.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            style={{ background: PAPER, color: SUB, border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          ><ChevronLeft size={14} /></button>
          <button
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            style={{ background: PAPER, color: NAVY, border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >Today</button>
          <span style={{ fontSize: 13, fontWeight: 800, color: INK, padding: '0 6px', minWidth: 160, textAlign: 'center' }}>{weekLabel}</span>
          <button
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            style={{ background: PAPER, color: SUB, border: `1px solid ${LINE}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          ><ChevronRight size={14} /></button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="Jobs this week"   value={totals.jobs}                    accent={INK} />
        <Kpi label="Scheduled"        value={totals.scheduled}               accent={NAVY} />
        <Kpi label="In progress"      value={totals.inProgress}              accent={ACCENT} />
        <Kpi label="Value this week"  value={`£${totals.value.toFixed(0)}`}  accent={GREEN} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <Filter size={12} color={SUB} />
        <select
          value={subFilter}
          onChange={e => setSubFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${LINE}`, borderRadius: 6, background: PAPER, color: INK, cursor: 'pointer' }}
        >
          <option value="">All contractors</option>
          {subs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={contractFilter}
          onChange={e => setContractFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 12, border: `1px solid ${LINE}`, borderRadius: 6, background: PAPER, color: INK, cursor: 'pointer' }}
        >
          <option value="">All contracts</option>
          {contracts.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading schedule…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && totals.jobs === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Calendar size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>Nothing on the schedule this week</div>
          <div style={{ fontSize: 12, color: SUB, maxWidth: 400, margin: '0 auto' }}>
            Awarded marketplace listings + allocated visit specs land here as scheduled jobs.
          </div>
        </div>
      )}

      {!loading && !error && totals.jobs > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {days.map(day => {
            const today = fmtIsoDate(new Date()) === day.iso;
            return (
              <div key={day.iso} style={{
                background: PAPER, border: `1px solid ${today ? `${ACCENT}40` : LINE}`,
                borderLeft: `4px solid ${today ? ACCENT : day.jobs.length ? NAVY : LINE}`,
                borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px', background: today ? `${ACCENT}06` : SOFT,
                  borderBottom: day.jobs.length ? `1px solid ${LINE}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: today ? ACCENT : INK }}>
                      {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: SUB }}>
                      {day.date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </span>
                    {today && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Today</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SUB }}>
                    {day.jobs.length === 0 ? 'No jobs' : `${day.jobs.length} job${day.jobs.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                {day.jobs.map((j, i) => (
                  <div key={j.id} style={{
                    display: 'grid', gridTemplateColumns: '90px 2fr 1.4fr 1fr 1fr',
                    gap: 10, alignItems: 'center',
                    padding: '12px 16px',
                    borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                    fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 800, color: NAVY, fontFamily: 'ui-monospace,Menlo,monospace' }}>
                      {String(Math.floor(Number(j.start_hour) || 9)).padStart(2, '0')}:
                      {String(Math.round((Number(j.start_hour) || 9) % 1 * 60)).padStart(2, '0')}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.site?.name ?? j.service ?? 'Job'}
                      </div>
                      <div style={{ fontSize: 10, color: MUTE, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={10} /> {j.site?.postcode ?? ''}
                        {j.contract?.name && <span>· {j.contract.name}</span>}
                      </div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {j.subName ?? '— unassigned'}
                      </div>
                      <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
                        {j.source === 'marketplace' ? 'Marketplace' : j.source === 'direct' ? 'Direct' : j.source}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800 }}>£{j.price ?? 0}</div>
                    <div><StatusPill status={j.status} /></div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
