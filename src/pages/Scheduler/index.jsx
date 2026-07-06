// src/pages/Scheduler.jsx
// Cadi — Scheduler (glass-white redesign)
//
// Views:
//   • DAY     — per-crew lanes on a 20-min grid (hero view)
//   • WEEK    — 7-col time grid with light pastel job blocks
//   • MONTH   — calendar grid with type dots + revenue
//   • QUARTER — 13-week revenue bar chart
//
// Stat strip always visible: total jobs · revenue · done · in progress · upcoming
// Colour-coded: residential (emerald) · commercial (blue) · exterior (orange)
//
// Data: useData() provides live jobs + CRUD. DEMO_JOBS used when logged out.

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Filter, Search, X, Undo2 } from 'lucide-react';
import AskCadi from '../../components/AskCadi';
import RoundBatchModal from '../../components/RoundBatchModal';
import NewJobModal from './NewJobModal';
import JobDrawer from './JobDrawer';
import RoundsView from './RoundsView';
import MonthView from './MonthView';
import QuarterView from './QuarterView';
import WeekView from './WeekView';
import DayView from './DayView';
import { useWeather } from '../../hooks/useWeather';
import { TYPE } from '../../lib/jobTheme';
import { detectJobRisks } from '../../lib/jobRisk';
import {
  buildDemoJobs,
  DAYS_SHORT,
  MONTHS,
  fmtMoney,
  deriveCrews,
  getToday,
  getMonday,
  isoDate,
  getViewDate,
  getWeekDates,
  getCurrentQuarter,
  computeOffsetForView,
} from './helpers';

// ─── Stat strip ───────────────────────────────────────────────────────────────
function StatStrip({ jobs }) {
  const total = jobs.length;
  const revenue = jobs.reduce((s, j) => s + (j.price || 0), 0);
  const done = jobs.filter((j) => j.status === 'complete').length;
  const inProgress = jobs.filter((j) => j.status === 'in-progress').length;
  const upcoming = jobs.filter((j) => j.status === 'scheduled').length;
  const unassigned = jobs.filter((j) => j.status === 'unassigned').length;

  return (
    <div className="flex items-center gap-4 flex-wrap text-xs">
      <Stat label="Jobs" value={total} />
      <Stat label="Revenue" value={`£${fmtMoney(revenue)}`} emphasis color="text-white" />
      <Stat label="Done" value={done} color="text-emerald-300" />
      <Stat label="In progress" value={inProgress} color="text-amber-300" />
      <Stat label="Upcoming" value={upcoming} color="text-white/75" />
      {unassigned > 0 && <Stat label="Unassigned" value={unassigned} color="text-[#ff9a8a]" />}
    </div>
  );
}

function Stat({ label, value, color = 'text-white', emphasis }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-bold tabular-nums ${emphasis ? 'text-base' : 'text-sm'} ${color}`}>
        {value}
      </span>
      <span
        className="text-[11px] uppercase tracking-wider font-medium"
        style={{ color: 'rgba(153,197,255,0.7)' }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── View switcher ───────────────────────────────────────────────────────────
function ViewTabs({ view, setView, dayOffset, setDayOffset }) {
  // Rounds view hidden pre-launch — the round-organisation flow needs
  // more work to be usable. Re-add "Rounds" here when ready. The
  // RoundsView component, DB helpers and migration are all still in tree.
  const views = ['Day', 'Week', 'Month', 'Quarter'];
  return (
    <div
      className="flex rounded-lg border overflow-hidden text-xs font-semibold"
      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(153,197,255,0.18)' }}
    >
      {views.map((v) => {
        const active = view === v;
        return (
          <button
            key={v}
            onClick={() => {
              if (active) return;
              setView(v);
              setDayOffset(computeOffsetForView(view, v, dayOffset));
            }}
            className="px-3 py-1.5 transition-all text-white"
            style={{
              background: active
                ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                : 'transparent',
              color: active ? '#ffffff' : 'rgba(255,255,255,0.7)',
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}

function DateNav({ view, dayOffset, setDayOffset }) {
  let dateLabel = '';
  if (view === 'Day') {
    const d = getViewDate(dayOffset, 'Day');
    dateLabel = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  } else if (view === 'Week') {
    const dates = getWeekDates(dayOffset);
    dateLabel = `${dates[0].getDate()} ${MONTHS[dates[0].getMonth()]} – ${dates[6].getDate()} ${MONTHS[dates[6].getMonth()]}`;
  } else if (view === 'Month') {
    const d = getViewDate(dayOffset, 'Month');
    dateLabel = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } else {
    const q = getCurrentQuarter();
    const qMonths = [MONTHS[q.startMonth], MONTHS[q.startMonth + 1], MONTHS[q.startMonth + 2]];
    dateLabel = `Q${q.quarter} ${q.year} — ${qMonths[0]} to ${qMonths[2]}`;
  }

  return (
    <div className="flex items-center gap-2">
      {view !== 'Quarter' && view !== 'Rounds' && (
        <>
          <button
            onClick={() => setDayOffset((o) => o - 1)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(153,197,255,0.85)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[200px] text-center">
            <div
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(153,197,255,0.7)' }}
            >
              {dayOffset === 0 ? 'Today' : view}
            </div>
            <div className="text-sm font-bold leading-tight text-white">{dateLabel}</div>
          </div>
          <button
            onClick={() => setDayOffset((o) => o + 1)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'rgba(153,197,255,0.85)' }}
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setDayOffset(0)}
            className="ml-1 px-3 py-1.5 text-xs font-semibold rounded-lg border text-white hover:bg-white/15 transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(153,197,255,0.18)' }}
          >
            Today
          </button>
        </>
      )}
      {(view === 'Quarter' || view === 'Rounds') && (
        <div className="text-sm font-bold text-white">
          {view === 'Rounds' ? 'All rounds' : dateLabel}
        </div>
      )}
    </div>
  );
}

// ─── Filter pills ────────────────────────────────────────────────────────────
function FilterBar({ typeFilter, setTypeFilter, crews, crewFilter, setCrewFilter }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'rgba(153,197,255,0.7)' }}
      >
        <Filter size={12} /> Type
      </div>
      <div className="flex gap-1.5">
        <FilterPill
          active={typeFilter === 'all'}
          onClick={() => setTypeFilter('all')}
          label="All"
        />
        <FilterPill
          active={typeFilter === 'exterior'}
          onClick={() => setTypeFilter('exterior')}
          label="Exterior"
          type="exterior"
        />
        <FilterPill
          active={typeFilter === 'residential'}
          onClick={() => setTypeFilter('residential')}
          label="Residential"
          type="residential"
        />
        <FilterPill
          active={typeFilter === 'commercial'}
          onClick={() => setTypeFilter('commercial')}
          label="Commercial"
          type="commercial"
        />
        <FilterPill
          active={typeFilter === 'site_visit'}
          onClick={() => setTypeFilter('site_visit')}
          label="Site Visits"
          type="site_visit"
        />
      </div>

      {crews.length > 0 && (
        <>
          <div className="w-px h-5 mx-1" style={{ background: 'rgba(153,197,255,0.18)' }} />
          <div
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'rgba(153,197,255,0.7)' }}
          >
            Crew
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <FilterPill
              active={crewFilter === 'all'}
              onClick={() => setCrewFilter('all')}
              label="All"
            />
            {crews.map((c) => {
              const isActive = crewFilter === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCrewFilter(isActive ? 'all' : c.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all text-white"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                      : 'rgba(255,255,255,0.08)',
                    borderColor: isActive ? 'rgba(31,72,255,0.6)' : 'rgba(153,197,255,0.18)',
                  }}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: c.tint }}
                  >
                    {c.init}
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, type }) {
  const t = type ? TYPE[type] : null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all text-white"
      style={{
        background: active
          ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
          : 'rgba(255,255,255,0.08)',
        borderColor: active ? 'rgba(31,72,255,0.6)' : 'rgba(153,197,255,0.18)',
        boxShadow: active ? '0 4px 12px rgba(31,72,255,0.25)' : 'none',
      }}
    >
      {t && <span className={`w-2 h-2 rounded-full ${t.dot}`} />}
      {label}
    </button>
  );
}

// ─── Mobile day-strip — quick-jump to any day of the current week ─────────────
function MobileDayStrip({ weekDates, currentDateStr, setDayOffset, allJobs }) {
  const todayStr = isoDate(getToday());
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  return (
    <div className="sm:hidden flex gap-1 overflow-x-auto py-1 -mx-1 px-1">
      {weekDates.map((d, i) => {
        const ds = isoDate(d);
        const isActive = ds === currentDateStr;
        const isToday = ds === todayStr;
        const dayJobs = allJobs.filter((j) => j.date === ds && j.status !== 'cancelled');
        const dotTypes = [...new Set(dayJobs.map((j) => j.type))].slice(0, 3);
        const diff = Math.round((d.getTime() - today0.getTime()) / 86400000);
        return (
          <button
            key={i}
            onClick={() => setDayOffset(diff)}
            className="flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl flex-shrink-0 min-w-[44px] transition-all border"
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                : isToday
                  ? 'rgba(31,72,255,0.12)'
                  : 'rgba(255,255,255,0.05)',
              borderColor: isActive
                ? 'rgba(31,72,255,0.6)'
                : isToday
                  ? 'rgba(31,72,255,0.35)'
                  : 'rgba(153,197,255,0.12)',
              boxShadow: isActive ? '0 4px 14px rgba(31,72,255,0.35)' : 'none',
            }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wide leading-none"
              style={{ color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(153,197,255,0.7)' }}
            >
              {DAYS_SHORT[i]}
            </span>
            <span
              className="text-sm font-black leading-tight"
              style={{ color: isActive ? '#ffffff' : isToday ? '#99c5ff' : '#ffffff' }}
            >
              {d.getDate()}
            </span>
            <div className="flex gap-0.5 h-1.5 items-center justify-center mt-0.5">
              {dotTypes.length > 0 ? (
                dotTypes.map((type) => (
                  <div
                    key={type}
                    className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white/70' : TYPE[type]?.dot || 'bg-[#99c5ff]/40'}`}
                  />
                ))
              ) : (
                <div className="w-1.5 h-1.5" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function SchedulerTab({ onJobClick: externalJobClick }) {
  const { user, profile } = useAuth();
  const isDemoUser = user?.id === 'demo-user';
  const isLive = Boolean(user) && !isDemoUser;
  const {
    jobs: contextJobs,
    addJobAndSyncCustomer,
    updateJob,
    deleteJob,
    customers,
    refreshJobs,
  } = useData();
  const homePostcode = isLive ? profile?.home_postcode || profile?.postcode || null : null;
  const weather = useWeather(homePostcode);
  const DEMO_JOBS = useMemo(() => buildDemoJobs(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- fresh array each render is intentional; downstream memos re-run cheaply
  const allJobs = isLive ? contextJobs || [] : DEMO_JOBS;

  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState('Day');
  const [dayOffset, setDayOffset] = useState(0);
  const [activeJob, setActiveJob] = useState(null);
  const [editingJob, setEditingJob] = useState(null);
  const [showNewJob, setShowNewJob] = useState(false);
  const [preCustomer, setPreCustomer] = useState('');
  const [batchRound, setBatchRound] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [crewFilter, setCrewFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  // Lightweight toast for transient errors (DnD save failures, etc).
  // null = nothing showing. Setting a string auto-dismisses after 4s.
  const [toast, setToast] = useState(null);
  const showError = useCallback((msg) => {
    setToast({ kind: 'error', message: msg });
    setTimeout(() => setToast((t) => (t && t.message === msg ? null : t)), 4200);
  }, []);
  const showInfo = useCallback((msg) => {
    setToast({ kind: 'info', message: msg });
    setTimeout(() => setToast((t) => (t && t.message === msg ? null : t)), 3000);
  }, []);

  useEffect(() => {
    const pc = location.state?.customerName;
    if (pc) {
      setPreCustomer(pc);
      setShowNewJob(true);
      // Strip the one-shot state so a back/refresh doesn't re-open the modal
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJobClick = (job) => {
    setActiveJob(job);
    externalJobClick?.(job);
  };
  const handleSaveJob = (newJob) => {
    addJobAndSyncCustomer(newJob);
    // If in Week view and the saved job is outside the displayed week, jump to its week
    if (view === 'Week' && newJob.date) {
      if (newJob.date < weekStartStr || newJob.date > weekEndStr) {
        const jobMon = getMonday(new Date(newJob.date + 'T00:00:00'));
        const curMon = getMonday(getToday());
        setDayOffset(Math.round((jobMon.getTime() - curMon.getTime()) / (7 * 86400000)));
      }
    }
  };
  const handleScheduleRound = (round) => {
    // Opens the batch-schedule modal: every active customer in the round
    // becomes one job on the chosen date, optionally staggered by duration.
    setBatchRound(round);
  };
  // ── Undo stack ─────────────────────────────────────────────────────────
  // Tracks the last N reversible job mutations made through the Scheduler.
  // Each entry records the inverse operation (and a short label so the
  // toast can say "Moved Mrs Davies back to Tuesday"). Capped at 20 so a
  // long session doesn't bloat memory. Cleared on refresh — undo is
  // session-only, not durable.
  const UNDO_LIMIT = 20;
  const [undoStack, setUndoStack] = useState([]);

  // Snapshot only the fields that are about to change. Saves memory and
  // makes "what was it before?" obvious in the entry. Skip fields that
  // weren't supplied so the inverse only touches what was touched.
  const snapshotPrior = (job, updates) => {
    const prior = {};
    Object.keys(updates).forEach((k) => {
      // Normalise snake → camel so the inverse round-trips cleanly through
      // the same updateJob path.
      const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (camel in job) prior[k] = job[camel];
    });
    return prior;
  };

  const labelForJob = (job) => {
    if (!job) return 'job';
    return job.customer || job.addressLine1 || job.service || 'job';
  };

  const pushUndo = useCallback((entry) => {
    setUndoStack((prev) => [...prev.slice(-(UNDO_LIMIT - 1)), entry]);
  }, []);

  const handleUpdateJob = async (id, updates) => {
    const prior = (contextJobs || []).find((j) => j.id === id);
    try {
      await updateJob?.(id, updates);
      setActiveJob((prev) => (prev?.id === id ? { ...prev, ...updates } : prev));
      if (prior) {
        const inverse = snapshotPrior(prior, updates);
        let label = `Updated ${labelForJob(prior)}`;
        if ('date' in updates) label = `Moved ${labelForJob(prior)}`;
        if ('status' in updates)
          label =
            updates.status === 'complete'
              ? `Marked ${labelForJob(prior)} done`
              : `Changed ${labelForJob(prior)} status`;
        pushUndo({ kind: 'update', id, inverse, label });
      }
    } catch (err) {
      showError(
        err?.message?.includes('row-level')
          ? "You don't have permission to update that job."
          : "Couldn't save the job. Try again."
      );
      throw err;
    }
  };
  const handleDeleteJob = async (id) => {
    const prior = (contextJobs || []).find((j) => j.id === id);
    try {
      await deleteJob?.(id);
      if (prior) pushUndo({ kind: 'delete', job: prior, label: `Deleted ${labelForJob(prior)}` });
    } catch (err) {
      showError(
        err?.message?.includes('row-level')
          ? "You don't have permission to delete that job."
          : "Couldn't delete the job. Try again."
      );
      throw err;
    }
  };

  // Reverse the most recent recorded action. Uses the bare DataContext
  // mutators so the undo itself doesn't push to the stack (no infinite
  // loops). Toast confirms what we just put back.
  const canUndo = undoStack.length > 0;
  const undo = useCallback(async () => {
    setUndoStack((prev) => {
      const next = [...prev];
      const entry = next.pop();
      if (!entry) return prev;
      (async () => {
        try {
          if (entry.kind === 'update') {
            await updateJob?.(entry.id, entry.inverse);
          } else if (entry.kind === 'delete') {
            await addJobAndSyncCustomer?.(entry.job);
          }
          showInfo(`Undid: ${entry.label}`);
        } catch {
          showError("Couldn't undo that. The job may have already changed.");
        }
      })();
      return next;
    });
  }, [updateJob, addJobAndSyncCustomer, showInfo, showError]);

  // Wrappers exposed to child views — they push to the undo stack so the
  // user can reverse any drag, status flip or completion.
  const undoableUpdateJob = useCallback(
    (id, updates) => handleUpdateJob(id, updates),
    [contextJobs]
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const _undoableDeleteJob = useCallback((id) => handleDeleteJob(id), [contextJobs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ⌘Z / Ctrl+Z keyboard shortcut for undo. Skips when the user is typing
  // in an input/textarea so we don't hijack native browser undo there.
  useEffect(() => {
    const onKey = (e) => {
      const isUndo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey;
      if (!isUndo) return;
      const tag = (e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      e.preventDefault();
      if (canUndo) undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, undo]);

  const viewDate = getViewDate(dayOffset, view);
  const todayStr = isoDate(viewDate);
  const weekDates = getWeekDates(dayOffset);
  const weekStartStr = isoDate(weekDates[0]);
  const weekEndStr = isoDate(weekDates[6]);

  const searchLower = search.toLowerCase();
  const todayJobs = useMemo(
    () =>
      allJobs.filter(
        (j) =>
          j.date === todayStr &&
          j.status !== 'cancelled' &&
          (!search ||
            j.customer?.toLowerCase().includes(searchLower) ||
            j.postcode?.toLowerCase().includes(searchLower))
      ),
    [allJobs, todayStr, search]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const weekJobs = useMemo(
    () =>
      allJobs.filter(
        (j) =>
          j.date >= weekStartStr &&
          j.date <= weekEndStr &&
          j.status !== 'cancelled' &&
          (!search ||
            j.customer?.toLowerCase().includes(searchLower) ||
            j.postcode?.toLowerCase().includes(searchLower))
      ),
    [allJobs, weekStartStr, weekEndStr, search]
  ); // eslint-disable-line react-hooks/exhaustive-deps

  const nonCancelledJobs = useMemo(
    () => allJobs.filter((j) => j.status !== 'cancelled'),
    [allJobs]
  );

  const monthJobs = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return allJobs.filter(
      (j) =>
        j.date >= monthStart &&
        j.date <= monthEnd &&
        j.status !== 'cancelled' &&
        (!search ||
          j.customer?.toLowerCase().includes(searchLower) ||
          j.postcode?.toLowerCase().includes(searchLower))
    );
  }, [allJobs, viewDate, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const quarterJobs = useMemo(() => {
    const q = getCurrentQuarter();
    const qStartStr = isoDate(new Date(q.year, q.startMonth, 1));
    const qEndStr = isoDate(new Date(q.year, q.startMonth + 3, 0));
    return allJobs.filter(
      (j) => j.date >= qStartStr && j.date <= qEndStr && j.status !== 'cancelled'
    );
  }, [allJobs]);

  // Crews derived from currently-visible day jobs (for the filter bar)
  const dayCrews = useMemo(() => deriveCrews(todayJobs), [todayJobs]);

  const headerJobs =
    view === 'Day'
      ? todayJobs
      : view === 'Month'
        ? monthJobs
        : view === 'Quarter'
          ? quarterJobs
          : weekJobs;

  return (
    <div
      className="relative flex flex-col min-h-full overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #010a4f 0%, #05124a 45%, #0d1e78 100%)',
        color: '#ffffff',
      }}
    >
      {/* Ambient gradient orbs — brand-blue tints over navy */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div
          className="absolute top-[8%] left-[10%] w-[520px] h-[520px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, #1f48ff 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute top-[40%] right-[5%] w-[600px] h-[600px] rounded-full opacity-40"
          style={{
            background: 'radial-gradient(circle, #3a6bff 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full opacity-35"
          style={{
            background: 'radial-gradient(circle, #99c5ff 0%, transparent 70%)',
            filter: 'blur(70px)',
          }}
        />
      </div>

      {/* Top bar — navy glass over the page gradient */}
      <div
        className="relative z-10 backdrop-blur-2xl border-b"
        style={{
          background: 'linear-gradient(180deg, rgba(1,10,79,0.55) 0%, rgba(1,10,79,0.35) 100%)',
          borderColor: 'rgba(153,197,255,0.15)',
          boxShadow: '0 4px 24px rgba(1,10,79,0.25), inset 0 1px 0 rgba(153,197,255,0.1)',
        }}
      >
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.15em] uppercase mb-0.5"
                  style={{ color: '#99c5ff' }}
                >
                  Cadi
                </p>
                <h2 className="text-xl font-black leading-tight text-white">Scheduler</h2>
              </div>
              <div
                className="h-10 w-px hidden sm:block"
                style={{ background: 'rgba(153,197,255,0.18)' }}
              />
              <DateNav view={view} dayOffset={dayOffset} setDayOffset={setDayOffset} />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(153,197,255,0.55)' }}
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Find customer…"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30 w-48 placeholder:text-[#99c5ff]/50 text-white"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    borderColor: 'rgba(153,197,255,0.18)',
                  }}
                />
              </div>
              <button
                onClick={() => setMobileSearchOpen((o) => !o)}
                aria-label="Search"
                aria-expanded={mobileSearchOpen}
                className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg border transition-colors text-white"
                style={{
                  background:
                    search || mobileSearchOpen ? 'rgba(31,72,255,0.25)' : 'rgba(255,255,255,0.08)',
                  borderColor:
                    search || mobileSearchOpen ? 'rgba(31,72,255,0.55)' : 'rgba(153,197,255,0.18)',
                }}
              >
                <Search size={14} />
              </button>
              <ViewTabs
                view={view}
                setView={setView}
                dayOffset={dayOffset}
                setDayOffset={setDayOffset}
              />
              {/* Undo — pops the most recent recorded mutation. Disabled
                  when the stack is empty so it doesn't tease the user. */}
              <button
                onClick={undo}
                disabled={!canUndo}
                title={
                  canUndo
                    ? `Undo: ${undoStack[undoStack.length - 1]?.label} (⌘Z)`
                    : 'Nothing to undo'
                }
                aria-label="Undo last change"
                className="flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-white disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: canUndo ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  borderColor: canUndo ? 'rgba(153,197,255,0.25)' : 'rgba(153,197,255,0.1)',
                }}
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={() => setShowNewJob(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold shadow-lg shadow-[#1f48ff]/30 transition-all"
                style={{ background: 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)' }}
              >
                <Plus size={14} /> <span className="hidden sm:inline">New job</span>
              </button>
            </div>
          </div>
          {mobileSearchOpen && (
            <div className="md:hidden mt-2 relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color: 'rgba(153,197,255,0.55)' }}
              />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find customer or postcode…"
                className="pl-7 pr-9 py-2 w-full text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/30 placeholder:text-[#99c5ff]/50 text-white"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderColor: 'rgba(153,197,255,0.18)',
                }}
              />
              {(search || mobileSearchOpen) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setMobileSearchOpen(false);
                  }}
                  aria-label="Close search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[#99c5ff]/70 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            <StatStrip jobs={headerJobs} />
          </div>
        </div>

        {view === 'Day' && (
          <div
            className="border-t backdrop-blur"
            style={{ borderColor: 'rgba(153,197,255,0.12)', background: 'rgba(1,10,79,0.35)' }}
          >
            {/* Mobile: day-strip for quick navigation */}
            <div className="px-4 pt-2 pb-1">
              <MobileDayStrip
                weekDates={(() => {
                  const viewed = getViewDate(dayOffset, 'Day');
                  const mon = getMonday(viewed);
                  return Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(mon);
                    d.setDate(d.getDate() + i);
                    return d;
                  });
                })()}
                currentDateStr={todayStr}
                setDayOffset={setDayOffset}
                allJobs={allJobs}
              />
            </div>
            <div className="px-4 sm:px-6 py-2.5">
              <FilterBar
                typeFilter={typeFilter}
                setTypeFilter={setTypeFilter}
                crews={dayCrews}
                crewFilter={crewFilter}
                setCrewFilter={setCrewFilter}
              />
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="relative z-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-[1600px] mx-auto space-y-4">
          {view === 'Day' && (
            <DayView
              jobs={todayJobs}
              onJobClick={handleJobClick}
              typeFilter={typeFilter}
              crewFilter={crewFilter}
              updateJob={undoableUpdateJob}
              onAddJob={() => setShowNewJob(true)}
              onImport={() => navigate('/onboarding/customers')}
              weather={weather}
              onError={showError}
            />
          )}
          {view === 'Week' && (
            <WeekView
              jobs={weekJobs}
              onJobClick={handleJobClick}
              weekDates={weekDates}
              typeFilter={typeFilter}
              crewFilter={crewFilter}
              weather={weather}
              onAddJob={() => setShowNewJob(true)}
              updateJob={undoableUpdateJob}
              onError={showError}
            />
          )}
          {view === 'Month' && (
            <MonthView jobs={nonCancelledJobs} onJobClick={handleJobClick} viewDate={viewDate} />
          )}
          {view === 'Quarter' && <QuarterView jobs={nonCancelledJobs} />}
          {view === 'Rounds' && <RoundsView onScheduleRound={handleScheduleRound} />}
          <AskCadi tab="scheduler" />
        </div>
      </div>

      {/* Job drawer */}
      {activeJob && (
        <JobDrawer
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
          onEditJob={(job) => {
            setActiveJob(null);
            setEditingJob(job);
          }}
          risk={detectJobRisks(activeJob, {
            allJobs: allJobs.filter((j) => j.date === activeJob.date),
            weatherByDate: weather?.byDate ?? null,
            customer: activeJob.customerId
              ? customers.find((c) => c.id === activeJob.customerId)
              : null,
          })}
        />
      )}

      {/* New job modal */}
      {showNewJob && (
        <NewJobModal
          onClose={() => {
            setShowNewJob(false);
            setPreCustomer('');
          }}
          onSave={handleSaveJob}
          preCustomer={preCustomer}
          customers={customers}
          defaultDate={todayStr}
        />
      )}

      {/* Batch-schedule a whole round */}
      {batchRound && (
        <RoundBatchModal
          round={batchRound}
          onClose={() => setBatchRound(null)}
          onCreated={() => {
            refreshJobs?.();
          }}
        />
      )}

      {/* Edit job modal */}
      {editingJob && (
        <NewJobModal
          editJob={editingJob}
          onClose={() => setEditingJob(null)}
          onUpdate={handleUpdateJob}
          customers={customers}
          onError={showError}
        />
      )}

      {/* Transient toast — DnD errors and undo confirmations both surface
          here. Coral for errors, Cadi navy for info messages like
          "Undid: Moved Mrs Davies". */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div
            className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl text-[12.5px] font-bold"
            style={{
              background:
                toast.kind === 'info'
                  ? 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)'
                  : 'linear-gradient(135deg, rgba(217,98,77,0.95) 0%, rgba(198,74,53,0.95) 100%)',
              color: '#ffffff',
              boxShadow:
                toast.kind === 'info'
                  ? '0 12px 32px rgba(31,72,255,0.35)'
                  : '0 12px 32px rgba(217,98,77,0.35)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}
            role={toast.kind === 'info' ? 'status' : 'alert'}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="text-white/80 hover:text-white p-0.5"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
