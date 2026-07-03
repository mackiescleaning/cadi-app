import { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, MapPin, Building2, Calendar, AlertCircle, ChevronRight, X, Navigation,
  CalendarPlus, CheckCircle2, Clock, Loader2, CalendarOff, Plus, Trash2,
} from 'lucide-react';
import {
  listMyAssignedVisitSpecs,
  getMyVisitSpecJobHistory,
  scheduleConnectVisit,
  nextDueDate,
  listMyAvailability,
  addAvailabilityBlock,
  deleteAvailabilityBlock,
  isDateInBlocks,
} from '../../lib/db/connectDb';
import {
  CONNECT_COLORS, CONNECT_RADII, ON_DARK,
  glassDark, orangeCanvas, HOVER_LIFT,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const GREEN  = '#22c55e';
const BLUE   = '#7ea3ff';
const PURPLE = '#c084fc';

/* ─── Formatting helpers ──────────────────────────────────────────────────── */
function fmtHuman(dateIso) {
  if (!dateIso) return '—';
  const d = new Date(dateIso);
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === today.toDateString())    return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function quickPickDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const nextMon = new Date(today);
  const offset = ((8 - nextMon.getDay()) % 7) || 7;
  nextMon.setDate(nextMon.getDate() + offset);
  return [
    { label: 'Today',    date: today.toISOString().slice(0, 10) },
    { label: 'Tomorrow', date: tomorrow.toISOString().slice(0, 10) },
    { label: 'Next Mon', date: nextMon.toISOString().slice(0, 10) },
  ];
}

function fmtFreq(f) {
  return { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
           quarterly: 'Quarterly', annual: 'Annual', one_off: 'One-off' }[f] ?? f;
}

const STATUS_CFG = {
  unassigned: { label: 'Unassigned',  color: '#a3a3a3' },
  assigned:   { label: 'Assigned',    color: BLUE      },
  marketplace:{ label: 'Marketplace', color: PURPLE    },
  active:     { label: 'Active',      color: GREEN     },
  closed:     { label: 'Closed',      color: '#a3a3a3' },
};

function fmtRange(startIso, endIso) {
  if (!startIso) return '—';
  const s = new Date(startIso);
  const e = endIso ? new Date(endIso) : null;
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  if (!e || startIso === endIso) return s.toLocaleDateString('en-GB', opts);
  const sameYear = s.getFullYear() === e.getFullYear();
  return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', sameYear ? opts : opts)}`;
}

/* ─── Dark input helpers ──────────────────────────────────────────────────── */
const DARK_INPUT_STYLE = {
  padding: '9px 12px', border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.05)', borderRadius: 10,
  fontSize: 13, color: '#ffffff', outline: 'none', fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const SUBLABEL = {
  fontSize: 10, fontWeight: 800, color: ON_DARK.muted,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};

/* ─── Availability panel ──────────────────────────────────────────────────── */
function AvailabilityPanel({ blocks, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [start,    setStart]    = useState('');
  const [end,      setEnd]      = useState('');
  const [reason,   setReason]   = useState('');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [deleting, setDeleting] = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!start || !end) { setError('Pick start + end dates.'); return; }
    if (end < start)   { setError('End date must be on or after start.'); return; }
    setBusy(true);
    try {
      await addAvailabilityBlock({ startDate: start, endDate: end, reason });
      setStart(''); setEnd(''); setReason(''); setExpanded(false);
      await onChanged();
    } catch (err) {
      setError(err.message || 'Could not add block');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    setDeleting(id);
    try {
      await deleteAvailabilityBlock(id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div style={{ ...glassDark({ padding: 16, radius: CONNECT_RADII.lg, strong: true }) }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: blocks.length > 0 || expanded ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CalendarOff size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>My availability</div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
              {blocks.length === 0
                ? "Block out dates you can't work — FMs see this on your profile."
                : `${blocks.length} block${blocks.length === 1 ? '' : 's'} on file`}
            </div>
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            fontSize: 11, fontWeight: 800, color: '#ffffff',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: 10, padding: '7px 12px', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
          {expanded ? <><X size={11} /> Cancel</> : <><Plus size={11} /> Add block</>}
        </button>
      </div>

      {expanded && (
        <form onSubmit={handleAdd} style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12, padding: 14, marginBottom: 12,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={SUBLABEL}>From</span>
              <input type="date" value={start} min={today} onChange={e => setStart(e.target.value)}
                style={{ ...DARK_INPUT_STYLE, display: 'block', width: '100%', marginTop: 5 }} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={SUBLABEL}>To</span>
              <input type="date" value={end} min={start || today} onChange={e => setEnd(e.target.value)}
                style={{ ...DARK_INPUT_STYLE, display: 'block', width: '100%', marginTop: 5 }} />
            </label>
          </div>
          <input type="text" value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Reason (optional) — e.g. Family holiday, van in for MOT"
            style={{ ...DARK_INPUT_STYLE, width: '100%', marginBottom: 10 }} />
          {error && (
            <div style={{
              padding: 8, marginBottom: 10, borderRadius: 8, fontSize: 11, color: '#fca5a5',
              background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.30)',
            }}>{error}</div>
          )}
          <button type="submit" disabled={busy || !start || !end}
            style={{
              background: (busy || !start || !end) ? 'rgba(255,255,255,0.10)' : '#ffffff',
              color: (busy || !start || !end) ? ON_DARK.muted : CONNECT_COLORS.navy,
              border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10,
              padding: '10px 16px', fontSize: 12, fontWeight: 900,
              cursor: (busy || !start || !end) ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            {busy ? <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} /> : <CheckCircle2 size={12} />}
            {busy ? 'Saving…' : 'Save block'}
          </button>
        </form>
      )}

      {blocks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {blocks.map(b => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.32)',
              borderRadius: 10,
            }}>
              <CalendarOff size={13} color="#fbbf24" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#fef3c7' }}>
                  {fmtRange(b.start_date, b.end_date)}
                </div>
                {b.reason && (
                  <div style={{ fontSize: 11, color: '#fcd34d', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.reason}
                  </div>
                )}
              </div>
              <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                style={{
                  background: 'transparent', border: 'none',
                  cursor: deleting === b.id ? 'not-allowed' : 'pointer',
                  color: '#fbbf24', padding: 4,
                }}>
                {deleting === b.id
                  ? <Loader2 size={13} style={{ animation: 'connectSpin 0.8s linear infinite' }} />
                  : <Trash2 size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── Visit spec row ──────────────────────────────────────────────────────── */
function VisitSpecRow({ spec, history, onOpen }) {
  const status = STATUS_CFG[spec.status] || STATUS_CFG.assigned;
  const site = spec.site;
  const fm   = spec.fm_organisation;

  const hist         = history || {};
  const lastDate     = hist.last?.date;
  const nextBooked   = hist.nextScheduled?.date;
  const isRecurring  = spec.frequency && spec.frequency !== 'one_off';
  const nextDue      = isRecurring ? nextDueDate(spec.frequency, lastDate) : null;
  const scheduleState =
    nextBooked       ? { tone: 'ok',  text: `Next visit: ${fmtHuman(nextBooked)}` } :
    !isRecurring     ? null                                                          :
    nextDue          ? { tone: 'due', text: `Due around ${fmtHuman(nextDue)} — schedule it` } :
                       { tone: 'new', text: 'Ready to schedule your first visit' };

  const stateStyle = {
    ok:  { bg: 'rgba(34,197,94,0.14)', bd: 'rgba(34,197,94,0.32)', fg: '#86efac' },
    due: { bg: 'rgba(251,191,36,0.14)', bd: 'rgba(251,191,36,0.32)', fg: '#fcd34d' },
    new: { bg: 'rgba(126,163,255,0.14)', bd: 'rgba(126,163,255,0.30)', fg: '#c7d7ff' },
  };

  return (
    <div
      className={HOVER_LIFT}
      style={{
        ...glassDark({ padding: 16, radius: CONNECT_RADII.lg }),
        borderLeft: `3px solid ${status.color}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 9, fontWeight: 800, color: status.color,
          background: `${status.color}22`, border: `1px solid ${status.color}44`,
          padding: '3px 9px', borderRadius: 999,
          letterSpacing: '0.10em', textTransform: 'uppercase',
        }}>{status.label}</span>
        <span style={{ fontSize: 10, color: ON_DARK.muted }}>{fm?.name ?? '—'}</span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>{site?.name ?? 'Site'}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <MapPin size={10} />
        {site?.postcode ?? ''}
        <span style={{ opacity: 0.5 }}>·</span>
        {fmtFreq(spec.frequency)}
        <span style={{ opacity: 0.5 }}>·</span>
        {spec.scope}
      </div>

      {scheduleState && (() => {
        const s = stateStyle[scheduleState.tone];
        return (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 10,
            background: s.bg, border: `1px solid ${s.bd}`, color: s.fg,
            fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {scheduleState.tone === 'ok' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            {scheduleState.text}
          </div>
        );
      })()}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>£{spec.price_per_visit}</span>
        <span style={{ fontSize: 10, color: ON_DARK.muted }}>per visit</span>
        {spec.duration_minutes && (
          <>
            <span style={{ color: ON_DARK.faint }}>·</span>
            <span style={{ fontSize: 10, color: ON_DARK.muted }}>{spec.duration_minutes} min on site</span>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => onOpen(spec)}
          style={{
            fontSize: 11, fontWeight: 900, color: '#ffd7bf',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          {scheduleState?.tone === 'ok' ? 'View job card' : 'Schedule visit'} <ChevronRight size={11} />
        </button>
      </div>
      {spec.access_notes && (
        <div style={{
          marginTop: 12, padding: '9px 12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, fontSize: 11, color: ON_DARK.muted,
        }}>
          <strong style={{ color: '#ffffff' }}>Access:</strong> {spec.access_notes}
        </div>
      )}
    </div>
  );
}

/* ─── Job card drawer ─────────────────────────────────────────────────────── */
function JobCardDrawer({ spec, history, blocks = [], onClose, onScheduled }) {
  const [date,     setDate]     = useState('');
  const [hour,     setHour]     = useState('9');
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState(null);
  const [success,  setSuccess]  = useState(null);

  const activeBlockFor = (iso) => (iso ? isDateInBlocks(iso, blocks) : null);
  const enteredBlock   = activeBlockFor(date);

  useEffect(() => {
    if (!spec) return;
    setDate(''); setHour('9'); setError(null); setSuccess(null);
  }, [spec?.id]);

  if (!spec) return null;
  const site   = spec.site;
  const fm     = spec.fm_organisation;
  const status = STATUS_CFG[spec.status] || STATUS_CFG.assigned;
  const postcode = site?.postcode ?? '';
  const directionsUrl = postcode
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(postcode)}`
    : null;

  const hist        = history || {};
  const lastDate    = hist.last?.date;
  const nextBooked  = hist.nextScheduled?.date;
  const isRecurring = spec.frequency && spec.frequency !== 'one_off';
  const nextDue     = isRecurring ? nextDueDate(spec.frequency, lastDate) : null;
  const suggested   = nextBooked || nextDue || new Date().toISOString().slice(0, 10);
  const quickPicks  = quickPickDates();

  async function submitSchedule(pickDate) {
    const chosen = pickDate || date;
    if (!chosen) { setError('Pick a date first.'); return; }
    setBusy(true); setError(null); setSuccess(null);
    try {
      const startHour = Number(hour);
      const { ok, data } = await scheduleConnectVisit({
        visitSpecId: spec.id,
        date:        chosen,
        startHour:   Number.isFinite(startHour) ? startHour : 9,
      });
      if (!ok) throw new Error(data?.error || 'Could not schedule visit');
      setSuccess(`Scheduled for ${fmtHuman(chosen)} — the FM will see it on their schedule.`);
      onScheduled?.();
    } catch (e) {
      setError(e.message || 'Could not schedule visit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20, 5, 0, 0.65)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 50,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 500, maxWidth: '94vw',
          background: 'linear-gradient(180deg, #3d0f04 0%, #1a0400 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.14)',
          padding: '24px 26px 40px', overflowY: 'auto',
          boxShadow: '-30px 0 80px -20px rgba(0,0,0,0.55)',
          color: '#ffffff',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                fontSize: 9, fontWeight: 800, color: status.color,
                background: `${status.color}22`, border: `1px solid ${status.color}44`,
                padding: '3px 9px', borderRadius: 999,
                letterSpacing: '0.10em', textTransform: 'uppercase',
              }}>{status.label}</span>
              <span style={{ fontSize: 11, color: ON_DARK.muted, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={10} /> {fm?.name ?? '—'}
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', lineHeight: 1.2, letterSpacing: '-0.02em' }}>{site?.name ?? 'Site'}</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <MapPin size={11} />
              {postcode}{site?.address ? ` · ${site.address}` : ''}
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#ffffff', cursor: 'pointer', padding: 8, borderRadius: 10 }}>
            <X size={16} />
          </button>
        </div>

        {/* Price + cadence grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{ ...glassDark({ padding: 14, radius: 12, strong: true }) }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1, letterSpacing: '-0.02em' }}>£{spec.price_per_visit}</div>
            <div style={{ ...SUBLABEL, marginTop: 8 }}>Per visit</div>
          </div>
          <div style={{ ...glassDark({ padding: 14, radius: 12, strong: true }) }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>{fmtFreq(spec.frequency)}</div>
            {spec.duration_minutes && (
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 4 }}>{spec.duration_minutes} min on site</div>
            )}
            <div style={{ ...SUBLABEL, marginTop: 8 }}>Cadence</div>
          </div>
        </div>

        {/* Schedule next visit */}
        {isRecurring && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...SUBLABEL, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarPlus size={12} /> Schedule next visit
            </div>

            {nextBooked && (
              <div style={{
                marginBottom: 12, padding: '11px 14px',
                background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)',
                borderRadius: 12, fontSize: 12, color: '#dcfce7',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <CheckCircle2 size={14} />
                <span>Already booked for <strong style={{ color: '#ffffff' }}>{fmtHuman(nextBooked)}</strong>. Head to Work Completion to check in.</span>
              </div>
            )}

            {!nextBooked && (
              <div style={{ ...glassDark({ padding: 16, radius: 12, strong: true }) }}>
                {lastDate ? (
                  <div style={{ fontSize: 11, color: ON_DARK.muted, marginBottom: 12 }}>
                    Last visit: <strong style={{ color: '#ffffff' }}>{fmtHuman(lastDate)}</strong>
                    {nextDue && <> · <span style={{ color: '#fcd34d', fontWeight: 700 }}>due around {fmtHuman(nextDue)}</span></>}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: ON_DARK.muted, marginBottom: 12 }}>
                    First visit — pick the start date that works for you.
                  </div>
                )}

                {/* Quick picks */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {quickPicks.map(q => {
                    const clash = activeBlockFor(q.date);
                    return (
                      <button
                        key={q.date}
                        onClick={() => submitSchedule(q.date)}
                        disabled={busy}
                        title={clash ? `Blocked: ${clash.reason || 'unavailable'}` : undefined}
                        style={{
                          fontSize: 11, fontWeight: 900,
                          background: clash ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.06)',
                          color:      clash ? '#fcd34d' : '#ffffff',
                          border: `1px solid ${clash ? 'rgba(251,191,36,0.35)' : 'rgba(255,255,255,0.20)'}`,
                          borderRadius: 10, padding: '8px 14px',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          opacity: busy ? 0.6 : 1,
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {clash && <CalendarOff size={10} />}
                        {q.label}
                      </button>
                    );
                  })}
                  {nextDue && !quickPicks.some(q => q.date === nextDue) && (
                    <button
                      onClick={() => submitSchedule(nextDue)}
                      disabled={busy}
                      style={{
                        fontSize: 11, fontWeight: 900,
                        background: 'rgba(251,191,36,0.14)', color: '#fcd34d',
                        border: '1px solid rgba(251,191,36,0.35)',
                        borderRadius: 10, padding: '8px 14px',
                        cursor: busy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {fmtHuman(nextDue)} (due)
                    </button>
                  )}
                </div>

                {/* Custom date + hour */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 8, alignItems: 'stretch' }}>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    placeholder={suggested}
                    style={DARK_INPUT_STYLE}
                  />
                  <select
                    value={hour}
                    onChange={e => setHour(e.target.value)}
                    style={{ ...DARK_INPUT_STYLE, background: 'rgba(30, 8, 4, 0.9)' }}
                  >
                    {Array.from({ length: 20 }, (_, i) => i + 5).map(h => (
                      <option key={h} value={h} style={{ color: '#0f172a', background: '#ffffff' }}>
                        {String(h).padStart(2, '0')}:00
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => submitSchedule()}
                    disabled={busy || !date}
                    style={{
                      background: (busy || !date) ? 'rgba(255,255,255,0.10)' : '#ffffff',
                      color: (busy || !date) ? ON_DARK.muted : CONNECT_COLORS.navy,
                      border: '1px solid rgba(255,255,255,0.4)', borderRadius: 10,
                      padding: '0 16px', fontSize: 12, fontWeight: 900,
                      cursor: (busy || !date) ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    {busy
                      ? <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />
                      : <><CalendarPlus size={12} /> Book</>}
                  </button>
                </div>

                {enteredBlock && (
                  <div style={{
                    marginTop: 12, padding: 10, borderRadius: 10,
                    background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.35)',
                    fontSize: 11, color: '#fcd34d',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CalendarOff size={12} /> This date falls inside your blocked period ({fmtRange(enteredBlock.start_date, enteredBlock.end_date)}). You can still schedule if you've changed your mind.
                  </div>
                )}

                {error && (
                  <div style={{
                    marginTop: 12, padding: 10, borderRadius: 10,
                    background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.30)',
                    fontSize: 11, color: '#fca5a5',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <AlertCircle size={12} /> {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    marginTop: 12, padding: 10, borderRadius: 10,
                    background: 'rgba(34,197,94,0.14)', border: '1px solid rgba(34,197,94,0.32)',
                    fontSize: 11, color: '#dcfce7',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <CheckCircle2 size={12} /> {success}
                  </div>
                )}
              </div>
            )}
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Scope */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ ...SUBLABEL, marginBottom: 10 }}>Specification</div>
          <div style={{
            ...glassDark({ padding: 16, radius: 12, strong: true }),
            fontSize: 13, color: '#ffffff', lineHeight: 1.6, whiteSpace: 'pre-wrap',
          }}>
            {spec.scope}
          </div>
        </div>

        {/* Access notes */}
        {spec.access_notes && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...SUBLABEL, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={11} color="#fcd34d" /> Access
            </div>
            <div style={{
              background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
              borderRadius: 12, padding: 16,
              fontSize: 13, color: '#fef3c7', lineHeight: 1.6, whiteSpace: 'pre-wrap',
            }}>
              {spec.access_notes}
            </div>
          </div>
        )}

        {/* Directions */}
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '13px', marginBottom: 16,
              background: '#ffffff', color: CONNECT_COLORS.navy,
              fontWeight: 900, fontSize: 13, letterSpacing: '0.01em',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 12px 30px -12px rgba(255,255,255,0.4)',
              borderRadius: 12, textDecoration: 'none',
            }}
          >
            <Navigation size={14} /> Get directions
          </a>
        )}

        {/* Footer note re: check-in */}
        <div style={{
          marginTop: 8, padding: 14, borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 11, color: ON_DARK.muted, lineHeight: 1.5,
        }}>
          <Calendar size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />
          When you're on site, check in via <strong style={{ color: '#ffffff' }}>Connect → Work Completion</strong> to start the GPS-verified time clock.
        </div>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnPipeline() {
  const [specs, setSpecs]         = useState([]);
  const [history, setHistory]     = useState({});
  const [blocks, setBlocks]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [openSpecId, setOpenSpecId] = useState(null);

  async function reload() {
    setError('');
    try {
      const [rows, hist, av] = await Promise.all([
        listMyAssignedVisitSpecs(),
        getMyVisitSpecJobHistory().catch(() => ({})),
        listMyAvailability().catch(() => []),
      ]);
      setSpecs(rows); setHistory(hist); setBlocks(av);
    } catch (e) {
      setError(e.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  async function reloadAvailability() {
    try { setBlocks(await listMyAvailability()); } catch {}
  }

  useEffect(() => { reload(); }, []);

  const openSpec = useMemo(
    () => (openSpecId ? specs.find(s => s.id === openSpecId) : null),
    [openSpecId, specs],
  );

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
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={orangeCanvas()}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">

        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(255, 176, 90, 0.28) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(1, 10, 79, 0.30) 0%, transparent 60%),
              rgba(255,255,255,0.05)
            `,
          }}>
          <div className="relative px-6 md:px-9 py-7 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#ffffff', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.4)' }}>
                  <ClipboardList size={13} color={CONNECT_COLORS.navy} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">Current Work</span>
              </div>
              <h1 className="text-white mb-2"
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Every site,{' '}
                <span style={{ color: '#ffd7bf' }}>always in view.</span>
              </h1>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
                Recurring work assigned to you across every connected FM. Schedule visits, block dates you can't work, keep the FM in the loop.
              </p>
            </div>

            {/* KPI strip in hero */}
            <div className="grid grid-cols-3 gap-2 shrink-0" style={{ minWidth: 300 }}>
              {[
                { label: 'Active', count: totalActive, color: '#ffd7bf' },
                { label: 'Value',  count: `£${totalValue.toFixed(0)}`, color: '#ffffff', sub: 'per visit' },
                { label: 'FMs',    count: Object.keys(byFm).length, color: '#fbbf24' },
              ].map(({ label, count, color, sub }) => (
                <div key={label} style={{
                  ...glassDark({ padding: 12, radius: 12, strong: true }),
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{count}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 5 }}>
                    {label}{sub ? ` · ${sub}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── AVAILABILITY ──────────────────────────────────────────── */}
        <AvailabilityPanel blocks={blocks} onChanged={reloadAvailability} />

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
            Loading your jobs…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : specs.length === 0 ? (
          <div style={{
            ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
            textAlign: 'center',
          }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, #ffffff 0%, #ffd7bf 100%)`,
                boxShadow: '0 12px 30px -12px rgba(255,255,255,0.35)',
              }}>
              <ClipboardList size={22} color={CONNECT_COLORS.orange} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>No jobs assigned yet</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 8, maxWidth: 380, margin: '8px auto 0', lineHeight: 1.5 }}>
              Once you win a marketplace listing — or the FM allocates a site directly to you — the job appears here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {Object.entries(byFm).map(([fmId, group]) => (
              <div key={fmId}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginLeft: 4 }}>
                  <Building2 size={13} color={ON_DARK.muted} />
                  <span style={{ ...SUBLABEL }}>{group.name}</span>
                  <span style={{ fontSize: 10, color: ON_DARK.faint }}>· {group.specs.length} job{group.specs.length === 1 ? '' : 's'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {group.specs.map(s => (
                    <VisitSpecRow
                      key={s.id}
                      spec={s}
                      history={history[s.id]}
                      onOpen={() => setOpenSpecId(s.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <JobCardDrawer
          spec={openSpec}
          history={openSpec ? history[openSpec.id] : null}
          blocks={blocks}
          onClose={() => setOpenSpecId(null)}
          onScheduled={reload}
        />
      </div>
    </div>
  );
}
