import { useEffect, useState } from 'react';
import {
  MapPin, CheckCircle2, AlertCircle, Clock,
} from 'lucide-react';
import {
  listMyConnectJobs,
  connectCheckIn,
  connectCheckOut,
  getCurrentPosition,
} from '../../lib/db/connectDb';

const ORANGE = '#C2410C';
const GREEN  = '#16a34a';

const STATUS_CFG = {
  scheduled:            { label: 'Upcoming',           color: '#3b82f6' },
  pending_confirmation: { label: 'Awaiting confirm',   color: '#a78bfa' },
  in_progress:          { label: 'Checked in',         color: ORANGE    },
  complete:             { label: 'Checked out',        color: GREEN     },
  unassigned:           { label: 'Unassigned',         color: '#94a3b8' },
};

function fmtTime(date, startHour) {
  if (!date) return '—';
  const h = Math.floor(startHour ?? 0);
  const m = Math.round(((startHour ?? 0) - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const d  = new Date(date);
  const today = new Date(); today.setHours(0,0,0,0);
  const dCopy = new Date(d); dCopy.setHours(0,0,0,0);
  const days = Math.round((dCopy - today) / (1000*60*60*24));
  const dayLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${dayLabel} · ${hh}:${mm}`;
}

function FenceFeedback({ result }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: `${GREEN}10`, border: `1px solid ${GREEN}30`, fontSize: 11, color: GREEN, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CheckCircle2 size={13} /> Geo-fence ✓ — {result.distance_m}m from site centre.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: '#fee2e2', border: '1px solid #fca5a5', fontSize: 11, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
      <AlertCircle size={13} /> {result.message || result.error}
    </div>
  );
}

function JobCard({ job, onUpdated }) {
  const [busy, setBusy] = useState(null);
  const [fenceResult, setFenceResult] = useState(null);

  const status = STATUS_CFG[job.status] || STATUS_CFG.scheduled;
  const canCheckIn  = ['scheduled','unassigned','pending_confirmation'].includes(job.status);
  const canCheckOut = job.status === 'in_progress';

  async function handleCheckIn() {
    setBusy('checkin');
    setFenceResult(null);
    try {
      const pos = await getCurrentPosition();
      const { ok, data } = await connectCheckIn({ jobId: job.id, lat: pos.lat, lng: pos.lng, accuracyM: pos.accuracyM });
      if (!ok) {
        setFenceResult({ ok: false, distance_m: data?.distance_m, message: data?.error || 'Check-in rejected.' });
      } else {
        setFenceResult({ ok: true, distance_m: data?.distance_m });
        onUpdated?.();
      }
    } catch (e) {
      setFenceResult({ ok: false, message: e.message });
    } finally {
      setBusy(null);
    }
  }

  async function handleCheckOut() {
    setBusy('checkout');
    setFenceResult(null);
    try {
      const pos = await getCurrentPosition();
      const { ok, data } = await connectCheckOut({ jobId: job.id, lat: pos.lat, lng: pos.lng });
      if (!ok) {
        setFenceResult({ ok: false, distance_m: data?.distance_m, message: data?.error || 'Check-out rejected.' });
      } else {
        setFenceResult({ ok: true, distance_m: data?.distance_m });
        onUpdated?.();
      }
    } catch (e) {
      setFenceResult({ ok: false, message: e.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderLeft: `4px solid ${status.color}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: status.color, background: `${status.color}15`, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{status.label}</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{job.fm_organisation?.name ?? '—'}</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{job.site?.name ?? 'Site'}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
        <MapPin size={9} /> {job.site?.postcode ?? ''} · <Clock size={9} /> {fmtTime(job.date, job.start_hour)}
      </div>

      {job.status === 'complete' && job.actual_duration_minutes != null && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b' }}>
          Time on site: <strong style={{ color: '#0f172a' }}>{job.actual_duration_minutes} min</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {canCheckIn && (
          <button onClick={handleCheckIn} disabled={busy !== null}
            style={{
              flex: 1, fontSize: 12, fontWeight: 800, color: 'white', background: ORANGE,
              border: 'none', borderRadius: 7, padding: '9px 0', cursor: 'pointer',
              opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <MapPin size={12} />
            {busy === 'checkin' ? 'Reading GPS…' : 'Check in'}
          </button>
        )}
        {canCheckOut && (
          <button onClick={handleCheckOut} disabled={busy !== null}
            style={{
              flex: 1, fontSize: 12, fontWeight: 800, color: 'white', background: GREEN,
              border: 'none', borderRadius: 7, padding: '9px 0', cursor: 'pointer',
              opacity: busy ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <CheckCircle2 size={12} />
            {busy === 'checkout' ? 'Reading GPS…' : 'Check out'}
          </button>
        )}
        {job.status === 'complete' && (
          <button disabled style={{
            flex: 1, fontSize: 12, fontWeight: 800, color: GREEN, background: `${GREEN}10`,
            border: `1px solid ${GREEN}30`, borderRadius: 7, padding: '9px 0',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            <CheckCircle2 size={12} /> Submitted to FM
          </button>
        )}
      </div>

      <FenceFeedback result={fenceResult} />
    </div>
  );
}

export default function EarnCompletion() {
  const [jobs, setJobs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  async function reload() {
    setError('');
    try {
      const rows = await listMyConnectJobs();
      setJobs(rows);
    } catch (e) {
      setError(e.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const upcoming = jobs.filter(j => ['scheduled','unassigned','pending_confirmation'].includes(j.status));
  const onSite   = jobs.filter(j => j.status === 'in_progress');
  const recent   = jobs.filter(j => j.status === 'complete').slice(0, 5);

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={18} color={ORANGE} />
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>Work completion</h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Check in when you arrive · check out when you finish. Both verify you're inside the site fence (default 80m).
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading your jobs…</div>
      ) : jobs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: 'white', border: '1.5px dashed #e2e8f0', borderRadius: 12, color: '#64748b' }}>
          <MapPin size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>No scheduled jobs yet</div>
          <div style={{ fontSize: 11, marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>
            Once an FM dispatches you a visit, it'll appear here ready to check in.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {onSite.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>On site now</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {onSite.map(j => <JobCard key={j.id} job={j} onUpdated={reload} />)}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Upcoming</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map(j => <JobCard key={j.id} job={j} onUpdated={reload} />)}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Recently completed</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recent.map(j => <JobCard key={j.id} job={j} onUpdated={reload} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
