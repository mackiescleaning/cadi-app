// src/components/SchedulerTab.jsx
// Cadi — Scheduler
//
// Combo of Option A (time-grid calendar) + Option B (list + route strip):
//   • DAY view    — Route strip at top + ordered job list (Option B)
//   • WEEK view   — 7-column time grid with coloured job blocks (Option A)
//   • MONTH view  — Calendar grid, dots + revenue per day, click to expand
//   • QUARTER view — 13-week revenue bar chart with job counts
//
// Stat bar always visible: total jobs · revenue · completed · unassigned
// Colour-coded throughout: residential (green) · commercial (blue) · exterior (orange)
//
// Props: none required. Accepts optional `onJobClick` callback.
//
// Usage:
//   import SchedulerTab from './components/SchedulerTab'
//   <SchedulerTab onJobClick={(job) => console.log(job)} />

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useSearchParams } from "react-router-dom";

// ─── Colour helpers ───────────────────────────────────────────────────────────
const TYPE_STYLES = {
  residential: {
    dot:    "bg-emerald-400",
    bg:     "bg-emerald-500/15",
    border: "border-emerald-500/30",
    text:   "text-emerald-300",
    badge:  "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    block:  "bg-emerald-500/25 border-l-[3px] border-emerald-400 shadow-sm shadow-emerald-500/20",
    stop:   "bg-emerald-500/20 text-emerald-300",
  },
  commercial: {
    dot:    "bg-[#99c5ff]",
    bg:     "bg-brand-blue/15",
    border: "border-brand-blue/30",
    text:   "text-[#99c5ff]",
    badge:  "bg-brand-blue/20 text-[#99c5ff] border-brand-blue/30",
    block:  "bg-[#1f48ff]/30 border-l-[3px] border-[#99c5ff] shadow-sm shadow-[#1f48ff]/20",
    stop:   "bg-brand-blue/20 text-[#99c5ff]",
  },
  exterior: {
    dot:    "bg-orange-400",
    bg:     "bg-orange-500/15",
    border: "border-orange-500/30",
    text:   "text-orange-300",
    badge:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
    block:  "bg-orange-500/25 border-l-[3px] border-orange-400 shadow-sm shadow-orange-500/20",
    stop:   "bg-orange-500/20 text-orange-300",
  },
};

const STATUS_STYLES = {
  complete:      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  "in-progress": "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  scheduled:     "bg-brand-blue/10 text-[#99c5ff] border border-brand-blue/20",
  unassigned:    "bg-white/5 text-[rgba(153,197,255,0.5)] border border-white/10",
};

const STATUS_LABELS = {
  complete:      "Complete",
  "in-progress": "In progress",
  scheduled:     "Scheduled",
  unassigned:    "Unassigned",
};

// ─── Demo data — dates computed relative to current Monday ───────────────────
function buildDemoJobs() {
  const mon = getMonday(new Date());
  const dateFor = (dayIdx) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + dayIdx);
    return d.toISOString().split('T')[0];
  };
  return [
    { id: 1,  customer: "Johnson",           type: "residential", service: "Regular clean",       postcode: "SW4", startHour: 8,    durationHrs: 2,   price: 60,  status: "complete",    assignee: "You",   date: dateFor(0) },
    { id: 2,  customer: "Greenfield Office", type: "commercial",  service: "Weekly office clean",  postcode: "SW6", startHour: 9.5,  durationHrs: 3,   price: 120, status: "complete",    assignee: "You",   date: dateFor(0) },
    { id: 3,  customer: "Davies",            type: "residential", service: "Deep clean",           postcode: "SW2", startHour: 10.5, durationHrs: 2.5, price: 80,  status: "in-progress", assignee: "You",   date: dateFor(0) },
    { id: 4,  customer: "Harrington",        type: "exterior",    service: "Gutters & fascias",    postcode: "SW9", startHour: 13,   durationHrs: 2,   price: 85,  status: "unassigned",  assignee: null,    date: dateFor(0) },
    { id: 5,  customer: "Park View Flats",   type: "commercial",  service: "Common areas",         postcode: "SE1", startHour: 15,   durationHrs: 2,   price: 95,  status: "scheduled",   assignee: "You",   date: dateFor(0) },
    { id: 6,  customer: "Miller",            type: "residential", service: "End of tenancy",       postcode: "SW8", startHour: 9,    durationHrs: 5,   price: 280, status: "complete",    assignee: "You",   date: dateFor(0) },
    { id: 7,  customer: "Nexus HQ",          type: "commercial",  service: "Deep commercial",      postcode: "EC1", startHour: 8,    durationHrs: 4,   price: 200, status: "complete",    assignee: "Jamie", date: dateFor(1) },
    { id: 8,  customer: "Wilson",            type: "residential", service: "Regular clean",        postcode: "SW3", startHour: 10,   durationHrs: 2,   price: 65,  status: "scheduled",   assignee: "You",   date: dateFor(1) },
    { id: 9,  customer: "Kensington Block",  type: "exterior",    service: "Window round",         postcode: "W8",  startHour: 8,    durationHrs: 3,   price: 180, status: "complete",    assignee: "Jamie", date: dateFor(2) },
    { id: 10, customer: "Fletcher",          type: "residential", service: "Regular clean",        postcode: "SW7", startHour: 11,   durationHrs: 2,   price: 60,  status: "scheduled",   assignee: "You",   date: dateFor(2) },
    { id: 11, customer: "Battersea Office",  type: "commercial",  service: "Contract clean",       postcode: "SW11",startHour: 7,    durationHrs: 3,   price: 150, status: "complete",    assignee: "Jamie", date: dateFor(3) },
    { id: 12, customer: "Adams",             type: "residential", service: "Deep clean",           postcode: "SW4", startHour: 9,    durationHrs: 3,   price: 90,  status: "scheduled",   assignee: "You",   date: dateFor(3) },
    { id: 13, customer: "Patel",             type: "residential", service: "Regular clean",        postcode: "SE5", startHour: 12,   durationHrs: 2,   price: 60,  status: "unassigned",  assignee: null,    date: dateFor(3) },
    { id: 14, customer: "Riverside Retail",  type: "commercial",  service: "Retail clean",         postcode: "SE1", startHour: 6,    durationHrs: 2,   price: 110, status: "complete",    assignee: "Jamie", date: dateFor(4) },
    { id: 15, customer: "Hughes",            type: "exterior",    service: "Driveway wash",        postcode: "SW19",startHour: 10,   durationHrs: 2,   price: 95,  status: "scheduled",   assignee: "You",   date: dateFor(4) },
  ];
}
const DEMO_JOBS = buildDemoJobs();


const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Hours shown in week/day grid
const GRID_HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18];

// ─── Shared UI ────────────────────────────────────────────────────────────────
function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] shadow-2xl shadow-brand-navy/50 ${className}`}
      style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/60 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">{children}</p>;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TypeBadge({ type }) {
  const s = TYPE_STYLES[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

function getJobAssignees(job) {
  if (Array.isArray(job.assignees) && job.assignees.length > 0) return job.assignees;
  if (job.assignee) return [job.assignee];
  return [];
}

function getJobAssigneeLabel(job) {
  const assignees = getJobAssignees(job);
  return assignees.length > 0 ? assignees.join(", ") : "Unassigned";
}

// ─── Stat bar ─────────────────────────────────────────────────────────────────
function StatBar({ jobs }) {
  const total      = jobs.length;
  const revenue    = jobs.reduce((s, j) => s + j.price, 0);
  const completed  = jobs.filter(j => j.status === "complete").length;
  const unassigned = jobs.filter(j => j.status === "unassigned").length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-4">
      {[
        { label: "Total jobs",  value: total,                             accent: "text-white" },
        { label: "Revenue",     value: `£${revenue.toLocaleString()}`,   accent: "text-emerald-400" },
        { label: "Completed",   value: `${completed} / ${total}`,        accent: "text-white" },
        { label: "Unassigned",  value: unassigned,                       accent: unassigned > 0 ? "text-amber-400" : "text-white" },
      ].map(({ label, value, accent }) => (
        <div
          key={label}
          className="relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] px-4 py-3"
          style={{ background: 'linear-gradient(135deg, #05124a 0%, #0d1e78 100%)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/40 to-transparent" />
          <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)] mb-1">{label}</p>
          <p className={`text-2xl font-black tabular-nums ${accent}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Date helpers ────────────────────────────────────────────────────────────
function getToday() { return new Date(); }

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d) { return d.toISOString().split('T')[0]; }

function getViewDate(dayOffset, view) {
  const today = getToday();
  if (view === "Day") {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    return d;
  } else if (view === "Week") {
    const mon = getMonday(today);
    mon.setDate(mon.getDate() + dayOffset * 7);
    return mon;
  } else if (view === "Month") {
    const d = new Date(today);
    d.setMonth(d.getMonth() + dayOffset);
    d.setDate(1);
    return d;
  }
  return today;
}

function getWeekDates(dayOffset) {
  const mon = getMonday(getToday());
  mon.setDate(mon.getDate() + dayOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getCurrentQuarter() {
  const now = getToday();
  const q = Math.floor(now.getMonth() / 3);
  const startMonth = q * 3;
  return { quarter: q + 1, year: now.getFullYear(), startMonth };
}

function fmtTime(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const ampm = hours < 12 ? "am" : "pm";
  const display = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${display}:${mins.toString().padStart(2, '0')}${ampm}`;
}

// ─── View switcher + date nav ─────────────────────────────────────────────────
function ViewBar({ view, setView, dayOffset, setDayOffset }) {
  const views = ["Day", "Week", "Month", "Quarter"];

  let dateLabel = "";
  if (view === "Day") {
    const d = getViewDate(dayOffset, "Day");
    dateLabel = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  } else if (view === "Week") {
    const dates = getWeekDates(dayOffset);
    const mon = dates[0]; const sun = dates[6];
    dateLabel = `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
  } else if (view === "Month") {
    const d = getViewDate(dayOffset, "Month");
    dateLabel = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } else {
    const q = getCurrentQuarter();
    const qMonths = [MONTHS[q.startMonth], MONTHS[q.startMonth + 1], MONTHS[q.startMonth + 2]];
    dateLabel = `Q${q.quarter} ${q.year} — ${qMonths[0]} to ${qMonths[2]}`;
  }

  return (
    <div className="bg-[#010a4f]/60 backdrop-blur-sm border-b border-[rgba(153,197,255,0.1)] px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* View tabs */}
      <div className="flex gap-0">
        {views.map(v => (
          <button
            key={v}
            onClick={() => { setView(v); setDayOffset(0); }}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
              view === v
                ? "border-[#99c5ff] text-white font-black"
                : "border-transparent text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.8)]"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-2">
        {view !== "Quarter" && (
          <>
            <button
              onClick={() => setDayOffset(o => o - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] hover:border-[#99c5ff] hover:text-white text-sm transition-all bg-transparent"
            >‹</button>
            <span className="text-xs font-semibold text-[#99c5ff] min-w-[180px] text-center">{dateLabel}</span>
            <button
              onClick={() => setDayOffset(o => o + 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] hover:border-[#99c5ff] hover:text-white text-sm transition-all bg-transparent"
            >›</button>
            <button
              onClick={() => setDayOffset(0)}
              className="px-2.5 py-1 text-xs font-bold rounded-lg transition-all bg-[rgba(153,197,255,0.08)] text-[#99c5ff] border border-[rgba(153,197,255,0.15)] hover:bg-[rgba(153,197,255,0.15)]"
            >
              Today
            </button>
          </>
        )}
        {view === "Quarter" && (
          <span className="text-xs font-semibold text-[#99c5ff]">{dateLabel}</span>
        )}
      </div>
    </div>
  );
}

// ─── Job detail drawer (slide-in panel) ──────────────────────────────────────
function JobDrawer({ job, onClose, onUpdateJob, onDeleteJob }) {
  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState(job.notes || '');
  const [saving, setSaving] = useState(false);
  if (!job) return null;

  const hasChanges = status !== job.status || notes !== (job.notes || '');

  const handleSave = async () => {
    setSaving(true);
    await onUpdateJob?.(job.id, { status, notes });
    setSaving(false);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Delete this job? This cannot be undone.')) {
      onDeleteJob?.(job.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full border-l border-[rgba(153,197,255,0.12)] overflow-y-auto shadow-2xl"
        style={{ background: 'linear-gradient(to bottom, #010a4f, #05124a)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.12)]"
          style={{ background: 'linear-gradient(to right, #1f48ff80, #0d1e78)' }}
        >
          <div>
            <p className="font-black text-base text-white">{job.customer}</p>
            <p className="text-xs text-[#99c5ff] mt-0.5">{job.service}</p>
          </div>
          <button onClick={onClose} className="text-[#99c5ff] hover:text-white text-lg leading-none px-2 transition-all">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status + type */}
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={status} />
            <TypeBadge type={job.type} />
          </div>

          {/* Details grid */}
          <GlassCard className="divide-y divide-[rgba(153,197,255,0.08)]">
            {[
              ["Date",      job.date ? new Date(job.date + 'T00:00:00').toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—"],
              ["Postcode",  job.postcode || "—"],
              ["Time",      `${fmtTime(job.startHour)} — ${fmtTime(job.startHour + job.durationHrs)}`],
              ["Duration",  `${job.durationHrs} hrs`],
              ["Price",     `£${job.price}`],
              ["Assignee",  getJobAssigneeLabel(job)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-[rgba(153,197,255,0.5)] font-medium">{label}</span>
                <span className={`font-semibold ${label === "Price" ? "text-emerald-400" : label === "Assignee" && getJobAssignees(job).length === 0 ? "text-amber-400" : "text-white"}`}>
                  {val}
                </span>
              </div>
            ))}
          </GlassCard>

          {/* Status actions */}
          <div>
            <SectionLabel>Update status</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {["scheduled","in-progress","complete","unassigned"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 text-xs font-bold uppercase tracking-wide rounded-lg border transition-all ${
                    status === st
                      ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                      : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                  }`}
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-2 w-full bg-[#0d1e78]/60 border border-[rgba(153,197,255,0.15)] text-white placeholder-[rgba(153,197,255,0.3)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#99c5ff] resize-none transition-colors"
              rows={3}
              placeholder="Add job notes, access codes, client preferences…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide transition-all rounded-xl ${
                hasChanges && !saving
                  ? "bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-lg shadow-[#1f48ff]/30"
                  : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.3)] cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2.5 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wide hover:border-red-500 hover:bg-red-500/10 transition-all rounded-xl"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DAY VIEW — Route strip + job list ───────────────────────────────────────
function DayView({ jobs, onJobClick }) {
  const ordered   = [...jobs].sort((a, b) => a.startHour - b.startHour);
  const routeJobs = ordered.filter(j => j.status !== "unassigned");
  const unassigned = ordered.filter(j => j.status === "unassigned");

  return (
    <div className="space-y-4">

      {/* ── Route strip ── */}
      <GlassCard>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SectionLabel>Today's route</SectionLabel>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-[rgba(153,197,255,0.5)]">{routeJobs.length} stops · est. <span className="text-emerald-400 font-semibold">£{routeJobs.reduce((s,j)=>s+j.price,0)}</span></span>
          </div>
        </div>

        {/* Horizontal scroll on mobile */}
        <div className="overflow-x-auto">
          <div className="flex items-stretch min-w-max">
            {routeJobs.map((job, i) => {
              const s = TYPE_STYLES[job.type];
              return (
                <div key={job.id} className="flex items-center">
                  <button
                    onClick={() => onJobClick(job)}
                    className="flex flex-col items-center px-4 py-3 hover:bg-[rgba(153,197,255,0.04)] transition-all min-w-[100px] group"
                  >
                    {/* Stop number */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 border ${s.stop} border-current/20`}>
                      {i + 1}
                    </div>
                    {/* Customer */}
                    <p className="text-xs font-semibold text-white text-center leading-tight group-hover:text-[#99c5ff] transition-all">
                      {job.customer.split(" ")[0]}
                    </p>
                    <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">{job.postcode}</p>
                    {/* Time + value */}
                    <p className="text-xs font-mono text-[rgba(153,197,255,0.5)] mt-1">{fmtTime(job.startHour)}</p>
                    <p className="text-xs font-bold text-emerald-400">£{job.price}</p>
                    {/* Status dot */}
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${
                      job.status === "complete"    ? "bg-emerald-400" :
                      job.status === "in-progress" ? "bg-amber-400"   :
                      "bg-[#99c5ff]"
                    }`} />
                  </button>
                  {/* Connector */}
                  {i < routeJobs.length - 1 && (
                    <div className="flex flex-col items-center px-1">
                      <div className="w-8 h-px bg-[rgba(153,197,255,0.12)]" />
                      <span className="text-xs text-[rgba(153,197,255,0.2)] mt-0.5">›</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2.5 border-t border-[rgba(153,197,255,0.08)]">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[rgba(153,197,255,0.5)]">
              {jobs.filter(j=>j.status==="complete").length} of {jobs.length} complete
            </span>
            <span className="font-semibold text-emerald-400">
              £{jobs.filter(j=>j.status==="complete").reduce((s,j)=>s+j.price,0)} collected
            </span>
          </div>
          <div className="h-1.5 bg-[rgba(153,197,255,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${(jobs.filter(j=>j.status==="complete").length / Math.max(jobs.length,1)) * 100}%` }}
            />
          </div>
        </div>
      </GlassCard>

      {/* ── Job list ── */}
      <GlassCard>
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SectionLabel>All jobs — ordered by time</SectionLabel>
        </div>

        <div className="divide-y divide-[rgba(153,197,255,0.08)]">
          {ordered.map(job => {
            const s = TYPE_STYLES[job.type];
            return (
              <button
                key={job.id}
                onClick={() => onJobClick(job)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.04)] text-left transition-all group"
              >
                {/* Type bar */}
                <div className={`w-1 self-stretch rounded-full ${s.dot}`} />

                {/* Time */}
                <div className="w-12 shrink-0">
                  <p className="text-xs font-mono text-[rgba(153,197,255,0.5)]">{fmtTime(job.startHour)}</p>
                  <p className="text-xs text-[rgba(153,197,255,0.3)]">{job.durationHrs}hr</p>
                </div>

                {/* Customer + service */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white group-hover:text-[#99c5ff] transition-all truncate">
                    {job.customer}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-[rgba(153,197,255,0.6)]">{job.service}</span>
                    <span className="text-[rgba(153,197,255,0.2)]">·</span>
                    <span className="text-xs text-[rgba(153,197,255,0.4)]">{job.postcode}</span>
                  </div>
                </div>

                {/* Status + price */}
                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-black tabular-nums text-emerald-400">£{job.price}</p>
                  <StatusBadge status={job.status} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Unassigned alert */}
        {unassigned.length > 0 && (
          <div className="px-4 py-3 bg-amber-500/10 border-t border-amber-500/20 flex items-center gap-2">
            <span className="text-amber-400 text-sm shrink-0">⚠</span>
            <p className="text-xs text-amber-400">
              <span className="font-bold">{unassigned.length} unassigned {unassigned.length === 1 ? "job" : "jobs"}</span>
              {" "}— tap to assign a team member or reschedule.
            </p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Overlap layout engine ───────────────────────────────────────────────────
// For each day's jobs, assigns a `col` (0-based) and `colCount` so overlapping
// jobs sit side-by-side instead of stacking on top of each other.
function layoutDayJobs(dayJobs) {
  const sorted = [...dayJobs].sort((a, b) => a.startHour - b.startHour);
  const placed  = [];   // { job, col }
  const colEnds = [];   // end-time of the last job placed in each sub-column

  for (const job of sorted) {
    const end = job.startHour + (job.durationHrs || 1);
    // Find the first sub-column that has finished before this job starts
    let col = colEnds.findIndex(t => t <= job.startHour);
    if (col === -1) col = colEnds.length; // need a new sub-column
    colEnds[col] = end;
    placed.push({ job, col });
  }

  // colCount for each job = widest concurrent overlap group it belongs to
  for (let i = 0; i < placed.length; i++) {
    const { job } = placed[i];
    const end = job.startHour + (job.durationHrs || 1);
    let maxCol = placed[i].col;
    for (let j = 0; j < placed.length; j++) {
      const o    = placed[j].job;
      const oEnd = o.startHour + (o.durationHrs || 1);
      if (o.startHour < end && oEnd > job.startHour) {
        maxCol = Math.max(maxCol, placed[j].col);
      }
    }
    placed[i].colCount = maxCol + 1;
  }

  return placed; // [{ job, col, colCount }, ...]
}

// ─── WEEK VIEW — mobile card stack + desktop time grid ──────────────────────
function WeekView({ jobs, onJobClick }) {
  const PX_PER_HR = 52;
  const LABEL_W   = 44;
  const [expandedDay, setExpandedDay] = useState(0); // mobile: which day is expanded

  const jobHeight = (hrs) => Math.max(hrs * PX_PER_HR, 24);
  const jobTop    = (h)   => (h - GRID_HOURS[0]) * PX_PER_HR;

  const fmt12 = (h) => {
    const hh = Math.floor(h) % 12 || 12;
    return `${hh}${h % 1 === 0 ? "" : ":30"}${h < 12 ? "am" : "pm"}`;
  };

  const fmtTime = (h) => {
    const hh = Math.floor(h) % 12 || 12;
    const mm = h % 1 === 0 ? ":00" : ":30";
    return `${hh}${mm}${h < 12 ? "am" : "pm"}`;
  };

  return (
    <>
      {/* ── MOBILE: compact day-by-day cards ── */}
      <div className="sm:hidden space-y-2">
        {DAYS_SHORT.map((day, dayIdx) => {
          const dayJobs = jobs.filter(j => j.day === dayIdx).sort((a,b) => a.startHour - b.startHour);
          const dayRevenue = dayJobs.reduce((s,j) => s + j.price, 0);
          const isToday = dayIdx === 0;
          const isOpen = expandedDay === dayIdx;

          return (
            <GlassCard key={day} className={isToday ? "ring-1 ring-[#1f48ff]/40" : ""}>
              {/* Day header — always visible, tap to expand */}
              <button
                onClick={() => setExpandedDay(isOpen ? -1 : dayIdx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Day badge */}
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  isToday ? "bg-[#1f48ff] text-white" : "bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.6)]"
                }`}>
                  <span className="text-[10px] font-bold uppercase leading-none">{day}</span>
                  <span className="text-sm font-black leading-tight">{6 + dayIdx}</span>
                </div>

                {/* Summary */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {dayJobs.length} {dayJobs.length === 1 ? "job" : "jobs"}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1f48ff]/30 text-[#99c5ff]">Today</span>
                    )}
                  </div>
                  {/* Job type dots */}
                  {dayJobs.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {dayJobs.map(j => (
                        <div key={j.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_STYLES[j.type].dot}`} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Revenue */}
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black tabular-nums ${dayRevenue > 0 ? "text-emerald-400" : "text-[rgba(153,197,255,0.3)]"}`}>
                    £{dayRevenue}
                  </p>
                </div>

                {/* Expand chevron */}
                <svg
                  className={`w-4 h-4 text-[rgba(153,197,255,0.4)] transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Expanded job list */}
              {isOpen && dayJobs.length > 0 && (
                <div className="border-t border-[rgba(153,197,255,0.08)]">
                  {dayJobs.map(job => {
                    const s = TYPE_STYLES[job.type];
                    return (
                      <button
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[rgba(153,197,255,0.04)] transition-colors"
                      >
                        <div className={`w-1 self-stretch rounded-full ${s.dot}`} />
                        <div className="w-12 shrink-0">
                          <p className="text-xs font-mono text-[rgba(153,197,255,0.5)]">{fmtTime(job.startHour)}</p>
                          <p className="text-xs text-[rgba(153,197,255,0.3)]">{job.durationHrs}hr</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{job.customer}</p>
                          <p className="text-xs text-[rgba(153,197,255,0.5)] truncate">{job.service} · {job.postcode}</p>
                        </div>
                        <div className="text-right shrink-0 space-y-1">
                          <p className="text-sm font-black tabular-nums text-emerald-400">£{job.price}</p>
                          <StatusBadge status={job.status} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {isOpen && dayJobs.length === 0 && (
                <div className="border-t border-[rgba(153,197,255,0.08)] px-4 py-4 text-center">
                  <p className="text-xs text-[rgba(153,197,255,0.3)]">No jobs scheduled</p>
                </div>
              )}
            </GlassCard>
          );
        })}

        {/* Mobile legend */}
        <div className="flex items-center justify-center gap-4 py-2 flex-wrap">
          {[
            { type: "residential", label: "Residential" },
            { type: "commercial",  label: "Commercial"  },
            { type: "exterior",    label: "Exterior"    },
          ].map(({ type, label }) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${TYPE_STYLES[type].dot}`} />
              <span className="text-xs text-[rgba(153,197,255,0.5)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DESKTOP: full time grid ── */}
      <GlassCard className="hidden sm:block">
        {/* Day header */}
        <div className="flex border-b border-[rgba(153,197,255,0.08)] sticky top-0 z-10 bg-[#010a4f]/95 backdrop-blur-sm">
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0" />
          {DAYS_SHORT.map((d, i) => (
            <div
              key={d}
              className={`flex-1 text-center py-2 border-l border-[rgba(153,197,255,0.06)] min-w-[80px] ${i === 0 ? "bg-[rgba(31,72,255,0.05)]" : "bg-[rgba(153,197,255,0.04)]"}`}
            >
              <p className={`text-xs font-bold uppercase tracking-widest ${i === 0 ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.5)]"}`}>{d}</p>
              <p className={`text-sm font-bold ${i === 0 ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.7)]"}`}>{6 + i}</p>
              <p className="text-xs text-emerald-400 font-semibold">
                £{jobs.filter(j=>j.day===i).reduce((s,j)=>s+j.price,0)}
              </p>
            </div>
          ))}
        </div>

        {/* Grid body */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <div className="flex" style={{ minHeight: GRID_HOURS.length * PX_PER_HR, minWidth: LABEL_W + 7 * 80 }}>
            {/* Hour labels */}
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-[rgba(153,197,255,0.06)]">
              {GRID_HOURS.map(h => (
                <div key={h} style={{ height: PX_PER_HR }} className="flex items-start pt-1 pr-2 justify-end">
                  <span className="text-xs text-[rgba(153,197,255,0.3)] tabular-nums">{fmt12(h)}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS_SHORT.map((_, dayIdx) => {
              const dayJobs = jobs.filter(j => j.day === dayIdx);
              return (
                <div
                  key={dayIdx}
                  className={`flex-1 border-l border-[rgba(153,197,255,0.06)] relative min-w-[80px] ${dayIdx === 0 ? "bg-[rgba(31,72,255,0.05)]" : ""}`}
                  style={{ minHeight: GRID_HOURS.length * PX_PER_HR }}
                >
                  {/* Hour lines */}
                  {GRID_HOURS.map(h => (
                    <div key={h} style={{ height: PX_PER_HR }} className="border-t border-[rgba(153,197,255,0.06)]" />
                  ))}

                  {/* Current time indicator (day 0 only) */}
                  {dayIdx === 0 && (
                    <div
                      className="absolute left-0 right-0 z-10"
                      style={{ top: jobTop(10.75) }}
                    >
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-[#99c5ff] shrink-0" />
                        <div className="flex-1 h-px bg-[#99c5ff]" />
                      </div>
                    </div>
                  )}

                  {/* Job blocks — collision-aware layout */}
                  {layoutDayJobs(dayJobs).map(({ job, col, colCount }) => {
                    const s      = TYPE_STYLES[job.type];
                    const top    = jobTop(job.startHour);
                    const height = jobHeight(job.durationHrs);
                    const GAP    = 2;
                    const pct    = 100 / colCount;
                    const leftPct  = col * pct;
                    const widthPct = pct;
                    return (
                      <button
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={`absolute rounded-lg px-1.5 py-1 text-left hover:brightness-125 hover:scale-[1.02] hover:z-20 transition-all overflow-hidden ${s.block}`}
                        style={{
                          top,
                          height,
                          left:  `calc(${leftPct}% + ${col === 0 ? GAP : GAP / 2}px)`,
                          width: `calc(${widthPct}% - ${col === 0 || col === colCount - 1 ? GAP * 1.5 : GAP}px)`,
                          zIndex: col + 1,
                        }}
                      >
                        <p className={`text-xs font-black truncate ${s.text}`}>{job.customer}</p>
                        {height > 36 && (
                          <p className={`text-xs truncate opacity-90 ${s.text}`}>{job.service}</p>
                        )}
                        {height > 52 && (
                          <p className={`text-xs font-mono font-bold ${s.text} mt-0.5`}>£{job.price}</p>
                        )}
                        {job.status === "unassigned" && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-[rgba(153,197,255,0.08)] flex-wrap">
          {[
            { type: "residential", label: "Residential" },
            { type: "commercial",  label: "Commercial"  },
            { type: "exterior",    label: "Exterior"    },
          ].map(({ type, label }) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${TYPE_STYLES[type].dot}`} />
              <span className="text-xs text-[rgba(153,197,255,0.5)]">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-xs text-[rgba(153,197,255,0.5)]">Unassigned</span>
          </div>
        </div>
      </GlassCard>
    </>
  );
}

// ─── MONTH VIEW — calendar grid ───────────────────────────────────────────────
function MonthView({ jobs, onJobClick, viewDate }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = isoDate(getToday());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // 0=Mon convention: JS getDay() returns 0=Sun, convert
  const firstDayJS = new Date(year, month, 1).getDay();
  const firstDOW = firstDayJS === 0 ? 6 : firstDayJS - 1; // 0=Mon

  const cells = [];
  for (let i = 0; i < firstDOW; i++) cells.push({ day: null, jobCount: 0, revenue: 0, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayJobs = jobs.filter(j => j.date === dateStr);
    cells.push({
      day: d,
      dateStr,
      jobCount: dayJobs.length,
      revenue: dayJobs.reduce((s,j)=>s+j.price,0),
      isToday: dateStr === todayStr,
      hasUnassigned: dayJobs.some(j=>j.status==="unassigned"),
      jobs: dayJobs,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, jobCount: 0, revenue: 0, isToday: false });

  const expandedDay = selectedDay !== null ? cells.find(c => c.day === selectedDay) : null;
  const monthLabel = viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <GlassCard>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.04)]">
          {DAYS_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-xs font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)] border-r border-[rgba(153,197,255,0.06)] last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <button
              key={i}
              onClick={() => cell.day && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
              className={`border-r border-b border-[rgba(153,197,255,0.08)] last:border-r-0 p-1.5 min-h-[52px] sm:min-h-[72px] text-left transition-all ${
                !cell.day         ? "cursor-default" :
                cell.isToday      ? "bg-[rgba(31,72,255,0.12)] hover:bg-[rgba(31,72,255,0.18)]" :
                cell.day === selectedDay ? "bg-[rgba(153,197,255,0.06)]" :
                "hover:bg-[rgba(153,197,255,0.04)]"
              }`}
              disabled={!cell.day}
            >
              {cell.day && (
                <>
                  <p className={`text-xs font-bold mb-1 ${
                    cell.isToday          ? "text-[#99c5ff]" :
                    cell.day === selectedDay ? "text-white"    :
                    "text-white"
                  }`}>
                    {cell.day}
                  </p>
                  {cell.jobCount > 0 && (
                    <>
                      {/* Type dots */}
                      <div className="flex gap-0.5 flex-wrap mb-1">
                        {cell.jobs?.slice(0,4).map((j,idx) => (
                          <div key={idx} className={`w-2 h-2 rounded-full shadow-sm ${TYPE_STYLES[j.type].dot}`} />
                        ))}
                        {cell.jobCount > 4 && <span className="text-[10px] text-[rgba(153,197,255,0.5)] font-bold">+{cell.jobCount-4}</span>}
                      </div>
                      {/* Revenue */}
                      <p className="text-[11px] font-bold text-emerald-400">£{cell.revenue}</p>
                      {/* Unassigned warning */}
                      {cell.hasUnassigned && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-0.5" />}
                    </>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Expanded day panel */}
      {expandedDay && expandedDay.jobs?.length > 0 && (
        <GlassCard>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
            <SectionLabel>
              {expandedDay.day} {monthLabel} — {expandedDay.jobCount} jobs · £{expandedDay.revenue}
            </SectionLabel>
            <button onClick={() => setSelectedDay(null)} className="text-[rgba(153,197,255,0.4)] hover:text-white text-sm transition-all">✕</button>
          </div>
          <div className="divide-y divide-[rgba(153,197,255,0.08)]">
            {expandedDay.jobs.map(job => (
              <button
                key={job.id}
                onClick={() => onJobClick(job)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(153,197,255,0.04)] text-left transition-all"
              >
                <div className={`w-1 h-8 rounded-full ${TYPE_STYLES[job.type].dot}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{job.customer}</p>
                  <p className="text-xs text-[rgba(153,197,255,0.6)]">{job.service} · {job.postcode}</p>
                </div>
                <StatusBadge status={job.status} />
                <span className="text-sm font-black text-emerald-400 ml-2">£{job.price}</span>
              </button>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Monthly summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Month revenue", value: `£${jobs.reduce((s,j)=>s+j.price,0) * 3}` },
          { label: "Total jobs",    value: jobs.length * 3 },
          { label: "Avg per job",   value: `£${Math.round(jobs.reduce((s,j)=>s+j.price,0) / Math.max(jobs.length,1))}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #05124a 0%, #0d1e78 100%)' }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/40 to-transparent" />
            <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)] mb-1">{label}</p>
            <p className="text-lg font-black tabular-nums text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── QUARTER VIEW — 13-week bar chart + summary ───────────────────────────────
function QuarterView({ onJobClick, jobs }) {
  // Build 13 weeks of real data from jobs
  const q = getCurrentQuarter();
  const quarterStart = new Date(q.year, q.startMonth, 1);
  const qMonday = getMonday(quarterStart);

  const quarterWeeks = Array.from({ length: 13 }, (_, i) => {
    const weekStart = new Date(qMonday);
    weekStart.setDate(weekStart.getDate() + i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = isoDate(weekStart);
    const weekEndStr = isoDate(weekEnd);
    const weekJobs = (jobs || []).filter(j => j.date >= weekStartStr && j.date <= weekEndStr);

    const todayStr = isoDate(getToday());
    const isCurrent = todayStr >= weekStartStr && todayStr <= weekEndStr;

    return {
      week: i + 1,
      revenue: weekJobs.reduce((s, j) => s + (j.price || 0), 0),
      jobs: weekJobs.length,
      complete: weekJobs.filter(j => j.status === 'complete').length,
      isCurrent,
    };
  });

  const maxRev    = Math.max(...quarterWeeks.map(w => w.revenue), 1);
  const total     = quarterWeeks.reduce((s,w) => s + w.revenue, 0);
  const avgRev    = Math.round(total / 13);
  const totalJobs = quarterWeeks.reduce((s,w) => s + w.jobs, 0);
  const qMonths   = [MONTHS[q.startMonth], MONTHS[q.startMonth + 1], MONTHS[q.startMonth + 2]];

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Q${q.quarter} revenue`,  value: `£${total.toLocaleString()}`, accent: "text-emerald-400" },
          { label: "Total jobs",  value: totalJobs,                     accent: "text-white"        },
          { label: "Weekly avg",  value: `£${avgRev.toLocaleString()}`, accent: "text-white"        },
          { label: "Best week",   value: `£${maxRev.toLocaleString()}`, accent: "text-[#99c5ff]"   },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] px-4 py-3"
            style={{ background: 'linear-gradient(135deg, #05124a 0%, #0d1e78 100%)' }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/40 to-transparent" />
            <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)] mb-1">{label}</p>
            <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Weekly revenue — Q{q.quarter} {q.year}</SectionLabel>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#1f48ff]" />
              <span className="text-xs text-[rgba(153,197,255,0.5)]">Current week</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[rgba(153,197,255,0.2)]" />
              <span className="text-xs text-[rgba(153,197,255,0.5)]">Other weeks</span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-40 sm:h-48">
          {quarterWeeks.map(w => {
            const pct       = (w.revenue / maxRev) * 100;
            const isCurrent = w.isCurrent;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                {/* Tooltip on hover */}
                <div className="relative flex flex-col items-center w-full">
                  <div className="hidden group-hover:flex absolute bottom-full mb-1 flex-col items-center z-10">
                    <div className="bg-[#0d1e78] border border-[rgba(153,197,255,0.15)] text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">
                      W{w.week}: £{w.revenue} · {w.jobs} jobs
                    </div>
                    <div className="w-1.5 h-1.5 bg-[#0d1e78] rotate-45 -mt-0.5" />
                  </div>
                  <div
                    className={`w-full rounded-lg transition-all ${isCurrent ? "bg-[#1f48ff]" : "bg-[rgba(153,197,255,0.2)] group-hover:bg-[rgba(153,197,255,0.35)]"}`}
                    style={{ height: `${Math.max(pct * 1.7, 4)}px` }}
                  />
                </div>
                <span className={`text-xs ${isCurrent ? "text-[#99c5ff] font-bold" : "text-[rgba(153,197,255,0.3)]"}`}>
                  {w.week}
                </span>
              </div>
            );
          })}
        </div>

        {/* Revenue axis labels */}
        <div className="flex justify-between mt-2">
          <span className="text-xs text-[rgba(153,197,255,0.3)]">Wk 1</span>
          <span className="text-xs text-[rgba(153,197,255,0.5)] font-semibold">{qMonths[0]}</span>
          <span className="text-xs text-[rgba(153,197,255,0.5)] font-semibold">{qMonths[1]}</span>
          <span className="text-xs text-[rgba(153,197,255,0.5)] font-semibold">{qMonths[2]}</span>
          <span className="text-xs text-[rgba(153,197,255,0.3)]">Wk 13</span>
        </div>
      </GlassCard>

      {/* Week table */}
      <GlassCard>
        <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          <SectionLabel>Week breakdown</SectionLabel>
        </div>
        <div className="divide-y divide-[rgba(153,197,255,0.08)] max-h-64 overflow-y-auto">
          {quarterWeeks.map(w => {
            const isCurrent   = w.isCurrent;
            const completePct = Math.round((w.complete / Math.max(w.jobs,1)) * 100);
            return (
              <div key={w.week} className={`flex items-center gap-3 px-4 py-2.5 transition-all ${isCurrent ? "bg-[rgba(31,72,255,0.12)]" : "hover:bg-[rgba(153,197,255,0.04)]"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isCurrent ? "bg-[#1f48ff] text-white" : "bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.5)]"}`}>
                  {w.week}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className={`font-semibold ${isCurrent ? "text-white" : "text-[rgba(153,197,255,0.7)]"}`}>
                      Week {w.week} {isCurrent ? "← current" : ""}
                    </span>
                    <span className="font-black tabular-nums text-emerald-400">£{w.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-[rgba(153,197,255,0.08)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isCurrent ? "bg-[#1f48ff]" : "bg-[rgba(153,197,255,0.3)]"}`}
                        style={{ width: `${completePct}%` }}
                      />
                    </div>
                    <span className="text-xs text-[rgba(153,197,255,0.4)] shrink-0">{w.complete}/{w.jobs} jobs</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

// ─── NEW JOB modal ────────────────────────────────────────────────────────────
// Default staff — will be overridden by DB staff in NewJobModal
const DEFAULT_STAFF_OPTIONS = [
  { id: "you",        label: "You"        },
  { id: "unassigned", label: "Unassigned" },
];

const SERVICE_OPTIONS = {
  residential: [
    "Regular clean","Deep clean","End of tenancy","One-off clean",
    "Carpet clean","Oven clean","Spring clean","Post-renovation clean",
  ],
  commercial: [
    "Regular office clean","Deep commercial clean","Contract clean","Washroom sanitise",
    "Kitchen sanitise","Event clean","Builder's clean","Carpet extraction",
  ],
  exterior: [
    "Window clean","Gutter clean","Roof moss treatment","Driveway pressure wash",
    "Fascias & soffits","Render wash","Conservatory roof","Solar panel clean","Patio jet wash",
  ],
};

const RECURRENCE_OPTIONS = [
  { id: "none",        label: "One-off",        group: "all"      },
  { id: "daily",       label: "Daily",          group: "res-com"  },
  { id: "weekly",      label: "Weekly",         group: "res-com"  },
  { id: "fortnightly", label: "Fortnightly",    group: "res-com"  },
  { id: "monthly",     label: "Monthly",        group: "res-com"  },
  { id: "quarterly",   label: "Quarterly",      group: "res-com"  },
  { id: "6weekly",     label: "Every 6 weeks",  group: "exterior" },
  { id: "8weekly",     label: "Every 8 weeks",  group: "exterior" },
  { id: "12weekly",    label: "Every 12 weeks", group: "exterior" },
];

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

// Map onboarding SERVICE_GROUPS keys to scheduler job types
const ONBOARDING_TYPE_MAP = { residential: "residential", commercial: "commercial", exterior: "exterior" };

// All onboarding services grouped by scheduler type (mirrors Onboarding.jsx SERVICE_GROUPS)
const ONBOARDING_SERVICE_GROUPS = {
  residential: [
    ['Weekly Clean','Fortnightly Clean','Monthly Clean'],
    ['Deep Clean','End of Tenancy','Move In / Move Out','Spring Clean','After Party Clean'],
    ['Airbnb Turnover','Holiday Let Changeover'],
    ['Oven Clean','Carpet Clean','Inside Windows','Ironing Service'],
  ],
  commercial: [
    ['Daily Office Clean','Weekly Office Clean','Retail Clean'],
    ['School / College','Nursery / Childcare','Medical Practice','Care Home'],
    ['Restaurant / Cafe','Hotel','Pub / Bar','Event Venue'],
    ['Post-Construction Clean','Periodic Deep Clean','Industrial / Warehouse'],
  ],
  exterior: [
    ['Residential Windows','Commercial Windows','Conservatory Glass'],
    ['Gutter Clearing','Fascia & Soffit Clean','Roof Moss Removal'],
    ['Driveway Jet Wash','Patio / Decking','Path & Steps'],
    ['Render Wash','UPVC Restoration','Solar Panel Clean'],
  ],
};

function buildProfileServiceOptions(profile) {
  const saved  = profile?.setup_data?.services || [];
  const custom = profile?.setup_data?.custom_service || '';
  const opts   = { residential: [], commercial: [], exterior: [] };
  if (!saved.length && !custom) return null; // fall back to static
  for (const [type, groups] of Object.entries(ONBOARDING_SERVICE_GROUPS)) {
    for (const items of groups) {
      for (const item of items) {
        if (saved.includes(item)) opts[type].push(item);
      }
    }
  }
  if (custom) {
    const extras = custom.split(',').map(s => s.trim()).filter(Boolean);
    opts.residential.push(...extras);
  }
  return opts;
}

function NewJobModal({ onClose, onSave, preCustomer = "", customers = [] }) {
  const { profile } = useAuth();
  const profileServices = buildProfileServiceOptions(profile);

  // Load staff from DB
  const [staffOptions, setStaffOptions] = useState(DEFAULT_STAFF_OPTIONS);
  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('staff_members').select('id, name').eq('active', true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const dbStaff = data.map(s => ({ id: s.id, label: s.name }));
            setStaffOptions([{ id: "you", label: "You" }, ...dbStaff, { id: "unassigned", label: "Unassigned" }]);
          }
        });
    });
  }, []);

  const [customer,    setCustomer]   = useState(preCustomer);
  const [postcode,    setPostcode]   = useState("");
  const [date,        setDate]       = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime,   setStartTime]  = useState("09:00");
  const [jobType,     setJobType]    = useState("residential");
  const [service,     setService]    = useState("");
  const [durationHrs, setDuration]   = useState("2");
  const [price,       setPrice]      = useState("");
  const [assignees,   setAssignees]  = useState(["you"]);
  const [recurrence,  setRecurrence] = useState("fortnightly");
  const [notes,       setNotes]      = useState("");
  const [customService, setCustomService] = useState("");
  const [serviceMode, setServiceMode] = useState("quick");

  const handleTypeChange = (t) => {
    setJobType(t);
    setService("");
    if (t === "exterior")        setRecurrence("8weekly");
    else if (t === "commercial") setRecurrence("weekly");
    else                         setRecurrence("fortnightly");
  };

  const recurrenceOpts = RECURRENCE_OPTIONS.filter(r =>
    r.group === "all" ||
    (r.group === "exterior" && jobType === "exterior") ||
    (r.group === "res-com"  && jobType !== "exterior") ||
    (jobType === "exterior" && ["weekly", "fortnightly", "monthly"].includes(r.id))
  );

  const selectedRec  = RECURRENCE_OPTIONS.find(r => r.id === recurrence);
  const profileList  = profileServices?.[jobType];
  const services     = (profileList && profileList.length > 0) ? profileList : (SERVICE_OPTIONS[jobType] ?? []);
  const usingProfile = !!(profileList && profileList.length > 0);
  const valid        = customer && date && startTime && service && parseFloat(price) > 0;

  const toggleAssignee = (id) => {
    if (id === "unassigned") {
      setAssignees(["unassigned"]);
      return;
    }
    setAssignees(prev => {
      const withoutUnassigned = prev.filter(value => value !== "unassigned");
      if (withoutUnassigned.includes(id)) {
        const next = withoutUnassigned.filter(value => value !== id);
        return next.length > 0 ? next : ["unassigned"];
      }
      return [...withoutUnassigned, id];
    });
  };

  const nextDateStr = () => {
    const map = { "6weekly":42, "8weekly":56, "12weekly":84, weekly:7, fortnightly:14, monthly:30, quarterly:91, daily:1 };
    const days = map[recurrence];
    return days ? addDaysToDate(date, days) : null;
  };

  const handleSave = () => {
    if (!valid) return;
    const [h, m] = startTime.split(":").map(Number);
    const startHour = h + m / 60;
    const selectedStaff = staffOptions
      .filter(s => assignees.includes(s.id) && s.id !== "unassigned")
      .map(s => s.label);

    const baseJob = {
      customer, postcode, startHour,
      durationHrs: parseFloat(durationHrs) || 2,
      type: jobType, service,
      price: parseFloat(price),
      assignees: selectedStaff,
      assignee: selectedStaff.length > 0 ? selectedStaff.join(", ") : null,
      recurrence, notes,
      status: selectedStaff.length === 0 ? "unassigned" : "scheduled",
    };

    // Save first job
    onSave?.({ ...baseJob, id: Date.now(), date });

    // Generate recurring jobs (up to 12 occurrences)
    if (recurrence !== "none") {
      const dayMap = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 91, "6weekly": 42, "8weekly": 56, "12weekly": 84 };
      const interval = dayMap[recurrence];
      if (interval) {
        let nextDate = new Date(date);
        for (let i = 0; i < 11; i++) {
          nextDate = new Date(nextDate);
          nextDate.setDate(nextDate.getDate() + interval);
          const nextDateStr = nextDate.toISOString().split('T')[0];
          onSave?.({ ...baseJob, id: Date.now() + i + 1, date: nextDateStr });
        }
      }
    }

    onClose();
  };

  const FL  = ({ children }) => (
    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1.5">{children}</label>
  );
  const inp = "w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-lg px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors";

  const jobTypeBtns = [
    { id: "residential", label: "Residential", active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
    { id: "commercial",  label: "Commercial",  active: "bg-brand-blue/20 text-[#99c5ff] border-brand-blue/40"     },
    { id: "exterior",    label: "Exterior",    active: "bg-orange-500/20 text-orange-400 border-orange-500/40"    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="relative overflow-hidden w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)]"
        style={{ background: 'linear-gradient(to bottom, #05124a, #010a4f)' }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Top shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/60 to-transparent" />

        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 py-4 shrink-0 border-b border-[rgba(153,197,255,0.12)]"
          style={{ background: 'linear-gradient(to right, rgba(31,72,255,0.8), #0d1e78)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="relative">
            <p className="font-black text-sm text-white">Add New Job</p>
            {recurrence !== "none" && selectedRec && (
              <p className="text-xs text-[#99c5ff] mt-0.5">{selectedRec.label} · recurring</p>
            )}
          </div>
          <button onClick={onClose} className="relative text-[#99c5ff] hover:text-white text-lg leading-none px-1 transition-all">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="relative overflow-y-auto flex-1 p-5 space-y-4">

          {/* Job type */}
          <div>
            <FL>Job type</FL>
            <div className="grid grid-cols-3 gap-2">
              {jobTypeBtns.map(({ id, label, active }) => (
                <button key={id} onClick={() => handleTypeChange(id)}
                  className={`py-2 text-xs font-bold border rounded-lg transition-all ${jobType===id ? active : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Service — with custom tab */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FL>Service</FL>
            </div>
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-[rgba(153,197,255,0.15)] overflow-hidden mb-2">
              {['quick','custom'].map(mode => (
                <button key={mode}
                  onClick={() => { setServiceMode(mode); setService(''); setCustomService(''); }}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${serviceMode===mode ? 'bg-[#1f48ff] text-white' : 'text-[rgba(153,197,255,0.5)] hover:text-white bg-transparent'}`}>
                  {mode === 'quick' ? (usingProfile ? '✓ Your Services' : 'Quick Pick') : '+ Custom'}
                </button>
              ))}
            </div>
            {serviceMode === 'quick' ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map(s => (
                  <button key={s} onClick={() => setService(s)}
                    className={`px-2.5 py-1 text-xs font-semibold border rounded-lg transition-all ${
                      service===s
                        ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                        : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                    }`}>{s}</button>
                ))}
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={customService}
                  onChange={e => { setCustomService(e.target.value); setService(e.target.value); }}
                  placeholder="Type your service name…"
                  className={inp}
                />
                <p className="text-[11px] text-[rgba(153,197,255,0.4)] mt-1">e.g. Swimming pool clean, clinical clean, specialist deep clean</p>
              </div>
            )}
          </div>

          {/* Customer + postcode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Customer name</FL>
              <div className="relative">
                <input type="text" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="e.g. Mrs Davies" className={inp} />
                {/* Autocomplete dropdown */}
                {customer.length > 0 && customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-[rgba(153,197,255,0.2)] bg-[#05124a] overflow-hidden shadow-xl">
                    {customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).slice(0, 5).map(c => (
                      <button key={c.id} type="button"
                        onClick={() => { setCustomer(c.name); setPostcode(c.postcode || postcode); }}
                        className="w-full text-left px-3 py-2 text-sm text-white hover:bg-[rgba(153,197,255,0.08)] transition-colors border-b border-[rgba(153,197,255,0.06)] last:border-b-0">
                        <span className="font-semibold">{c.name}</span>
                        {c.postcode && <span className="ml-2 text-[rgba(153,197,255,0.5)] text-xs">{c.postcode}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <FL>Postcode</FL>
              <input type="text" value={postcode} onChange={e=>setPostcode(e.target.value.toUpperCase())} placeholder="e.g. SW4" className={inp} />
            </div>
          </div>

          {/* Date + time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Date</FL>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={inp} />
            </div>
            <div>
              <FL>Start time</FL>
              <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Duration + price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Duration</FL>
              <div className="flex flex-wrap gap-1.5">
                {["0.5","1","1.5","2","2.5","3","4","5","6"].map(h => (
                  <button key={h} onClick={() => setDuration(h)}
                    className={`px-2 py-1.5 text-xs font-bold border rounded-lg transition-all ${durationHrs===h ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"}`}>
                    {h === "0.5" ? "30m" : `${h}h`}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FL>Price (£)</FL>
              <input type="number" min="0" step="5" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 65" className={inp} />
              {parseFloat(price)>0 && parseFloat(durationHrs)>0 && (
                <p className="text-xs text-[rgba(153,197,255,0.4)] mt-1">£{(parseFloat(price)/parseFloat(durationHrs)).toFixed(0)}/hr</p>
              )}
            </div>
          </div>

          {/* Assign to */}
          <div>
            <FL>Assign to</FL>
            <div className="grid grid-cols-4 gap-2">
              {staffOptions.map(s => (
                <button key={s.id} onClick={() => toggleAssignee(s.id)}
                  className={`py-2 text-xs font-bold border rounded-lg transition-all ${assignees.includes(s.id) ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"}`}>
                  {s.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-[rgba(153,197,255,0.4)] mt-2">
              Select one or more team members. Choosing Unassigned clears the others.
            </p>
          </div>

          {/* Recurrence */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <FL>Schedule / recurrence</FL>
              {jobType === "exterior" && (
                <span className="text-xs text-orange-400 font-semibold">Window round cycles included</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recurrenceOpts.map(r => (
                <button key={r.id} onClick={() => setRecurrence(r.id)}
                  className={`px-2.5 py-1.5 text-xs font-bold border rounded-lg transition-all ${recurrence===r.id ? "bg-[#1f48ff] text-white border-[#1f48ff]" : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {recurrence !== "none" && (
              <div className="mt-2 px-3 py-2 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] rounded-lg">
                <p className="text-xs font-semibold text-white">{selectedRec?.label} · next job auto-scheduled</p>
                {nextDateStr() && (
                  <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Next occurrence: {nextDateStr()}</p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <FL>Notes / access details</FL>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Key code, parking, pets, access instructions…"
              className={`${inp} resize-none`} />
          </div>

          {/* Confirmation summary */}
          {valid && (
            <div className="bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-xl divide-y divide-[rgba(153,197,255,0.08)] text-xs">
              {[
                ["Customer", customer],
                ["Service",  service],
                ["Date",     new Date(date).toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"})],
                ["Time",     startTime+" · "+durationHrs+"hrs"],
                ["Assigned", assignees.includes("unassigned") ? "Unassigned" : staffOptions.filter(s=>assignees.includes(s.id) && s.id !== "unassigned").map(s=>s.label).join(", ")],
                ["Repeats",  selectedRec?.label],
                ["Price",    "£"+parseFloat(price).toFixed(2)],
              ].map(([l,v]) => (
                <div key={l} className="flex justify-between px-3 py-2">
                  <span className="text-[rgba(153,197,255,0.5)]">{l}</span>
                  <span className="font-semibold text-white text-right">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="relative px-5 py-4 border-t border-[rgba(153,197,255,0.1)] bg-[#010a4f]/80 flex gap-2 shrink-0">
          <button onClick={handleSave} disabled={!valid}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${valid ? "bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-lg shadow-[#1f48ff]/30" : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.3)] cursor-not-allowed border border-[rgba(153,197,255,0.08)]"}`}>
            {recurrence === "none" ? "Save job" : "Save & schedule recurring"}
          </button>
          <button onClick={onClose}
            className="px-5 py-3 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] text-xs font-bold uppercase hover:border-[rgba(153,197,255,0.35)] hover:text-white rounded-xl transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function SchedulerTab({ onJobClick: externalJobClick }) {
  const { user } = useAuth();
  const isLive = Boolean(user);
  const { jobs: contextJobs, addJobAndSyncCustomer, updateJob, deleteJob, customers } = useData();
  // Only show demo jobs when not logged in
  const allJobs = isLive ? (contextJobs || []) : DEMO_JOBS;
  const [searchParams, setSearchParams] = useSearchParams();
  const [view,       setView]       = useState("Day");
  const [dayOffset,  setDayOffset]  = useState(0);
  const [activeJob,  setActiveJob]  = useState(null);
  const [showNewJob, setShowNewJob] = useState(false);
  const [preCustomer, setPreCustomer] = useState("");

  useEffect(() => {
    const pc = searchParams.get('customer');
    if (pc) {
      setPreCustomer(pc);
      setShowNewJob(true);
      setSearchParams({});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJobClick = (job) => {
    setActiveJob(job);
    externalJobClick?.(job);
  };

  const handleSaveJob = (newJob) => {
    addJobAndSyncCustomer(newJob);
  };

  const handleUpdateJob = async (id, updates) => {
    await updateJob?.(id, updates);
    // Refresh activeJob so drawer shows updated state
    setActiveJob(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  };

  const handleDeleteJob = async (id) => {
    await deleteJob?.(id);
  };

  // Filter jobs by date for each view
  const viewDate = getViewDate(dayOffset, view);
  const todayStr = isoDate(viewDate);

  const todayJobs = allJobs
    .filter(j => j.date === todayStr && j.status !== 'cancelled');

  const weekDates = getWeekDates(dayOffset);
  const weekStartStr = isoDate(weekDates[0]);
  const weekEndStr = isoDate(weekDates[6]);
  const weekJobs = allJobs
    .filter(j => j.date >= weekStartStr && j.date <= weekEndStr && j.status !== 'cancelled');

  // For views that need the `day` index (0-6 for Mon-Sun within the viewed week)
  const weekJobsWithDay = weekJobs.map(j => {
    const jobDate = new Date(j.date + 'T00:00:00');
    const dayOfWeek = jobDate.getDay();
    const dayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 0=Mon
    return { ...j, day: dayIdx };
  });

  return (
    <div className="relative flex flex-col min-h-full bg-[#010a4f] overflow-x-hidden">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-[rgba(31,72,255,0.12)] blur-[100px]" />
      <div className="pointer-events-none fixed -bottom-40 -left-20 w-[350px] h-[350px] rounded-full bg-[rgba(153,197,255,0.06)] blur-[80px]" />

      {/* Header */}
      <div className="relative bg-[#010a4f]/80 backdrop-blur-sm border-b border-[rgba(153,197,255,0.1)] px-4 sm:px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Cadi</p>
          <h2 className="text-2xl font-black text-white">Scheduler</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Type filter chips — hidden on mobile */}
          <div className="hidden sm:flex gap-1.5">
            {[
              { label: "Residential", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
              { label: "Commercial",  cls: "bg-brand-blue/10 text-[#99c5ff] border-brand-blue/20"    },
              { label: "Exterior",    cls: "bg-orange-500/10 text-orange-400 border-orange-500/20"   },
            ].map(({ label, cls }) => (
              <button key={label} className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-all ${cls}`}>{label}</button>
            ))}
          </div>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold transition-all rounded-lg shadow-lg shadow-[#1f48ff]/30"
          >
            <span className="text-base leading-none">+</span> Add job
          </button>
        </div>
      </div>

      {/* Stat bar */}
      <StatBar jobs={view === "Day" ? todayJobs : weekJobs} />

      {/* View bar + date nav */}
      <ViewBar
        view={view}
        setView={setView}
        dayOffset={dayOffset}
        setDayOffset={setDayOffset}
      />

      {/* Main content */}
      <div className="relative flex-1 overflow-y-auto p-4 lg:p-6">
        {view === "Day"     && <DayView     jobs={todayJobs} onJobClick={handleJobClick} />}
        {view === "Week"    && <WeekView    jobs={weekJobsWithDay}  onJobClick={handleJobClick} />}
        {view === "Month"   && <MonthView   jobs={allJobs.filter(j => j.status !== 'cancelled')} onJobClick={handleJobClick} viewDate={viewDate} />}
        {view === "Quarter" && <QuarterView jobs={allJobs.filter(j => j.status !== 'cancelled')} onJobClick={handleJobClick} />}
      </div>

      {/* Job detail drawer */}
      {activeJob && (
        <JobDrawer
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
        />
      )}

      {/* New job modal */}
      {showNewJob && <NewJobModal onClose={() => { setShowNewJob(false); setPreCustomer(""); }} onSave={handleSaveJob} preCustomer={preCustomer} customers={customers} />}
    </div>
  );
}
