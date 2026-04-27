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

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Filter, Search, X, Trash2 } from "lucide-react";

// ─── Theme — light glass ──────────────────────────────────────────────────────
const TYPE = {
  residential: {
    label: "Residential",
    bar:   "#10B981",
    fill:  "#ECFDF5",
    ink:   "#064E3B",
    chip:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot:   "bg-emerald-500",
  },
  commercial: {
    label: "Commercial",
    bar:   "#1F48FF",
    fill:  "#EEF2FF",
    ink:   "#1E3A8A",
    chip:  "bg-blue-100 text-blue-800 border-blue-200",
    dot:   "bg-blue-600",
  },
  exterior: {
    label: "Exterior",
    bar:   "#F97316",
    fill:  "#FFF4E6",
    ink:   "#7C2D12",
    chip:  "bg-orange-100 text-orange-800 border-orange-200",
    dot:   "bg-orange-500",
  },
};

const STATUS_STYLES = {
  complete:      "bg-emerald-100 text-emerald-700 border border-emerald-200",
  "in-progress": "bg-amber-100 text-amber-800 border border-amber-200",
  scheduled:     "bg-slate-100 text-slate-600 border border-slate-200",
  unassigned:    "bg-red-50 text-red-700 border border-red-200",
};

const STATUS_LABELS = {
  complete:      "Complete",
  "in-progress": "In progress",
  scheduled:     "Scheduled",
  unassigned:    "Unassigned",
};

// ─── Demo data ───────────────────────────────────────────────────────────────
function buildDemoJobs() {
  // dateFor(offset) returns a local-date string N days from TODAY (so today = dateFor(0)).
  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dateFor = (offset) => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + offset);
    return fmt(d);
  };
  return [
    // TODAY — hero day: dense exterior round + residential + commercial
    { id:1,  customer:"Kensington Block A", type:"exterior",   service:"Windows",         postcode:"W8 4AA",  startHour:7.00, durationHrs:0.33, price:45,  status:"complete",    assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:2,  customer:"Kensington Block B", type:"exterior",   service:"Windows",         postcode:"W8 4AB",  startHour:7.33, durationHrs:0.33, price:45,  status:"complete",    assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:3,  customer:"Hammond",            type:"exterior",   service:"Windows",         postcode:"W8 4BD",  startHour:7.67, durationHrs:0.33, price:25,  status:"complete",    assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:4,  customer:"Clifton",            type:"exterior",   service:"Windows",         postcode:"W8 5AA",  startHour:8.00, durationHrs:0.33, price:25,  status:"complete",    assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:5,  customer:"Elsworth",           type:"exterior",   service:"Windows",         postcode:"W8 5BB",  startHour:8.33, durationHrs:0.33, price:30,  status:"complete",    assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:6,  customer:"Harrow Court",       type:"exterior",   service:"Windows + frames",postcode:"W8 5CC",  startHour:8.67, durationHrs:0.67, price:65,  status:"in-progress", assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:7,  customer:"Phillips",           type:"exterior",   service:"Windows",         postcode:"W9 1AA",  startHour:9.33, durationHrs:0.33, price:25,  status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:8,  customer:"Nash Apartments",    type:"exterior",   service:"Windows",         postcode:"W9 1BB",  startHour:9.67, durationHrs:0.67, price:60,  status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:9,  customer:"Dr. Khan",           type:"exterior",   service:"Windows",         postcode:"W9 2CC",  startHour:10.33,durationHrs:0.33, price:25,  status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:10, customer:"Fletcher",           type:"exterior",   service:"Gutters",         postcode:"W9 2DD",  startHour:10.67,durationHrs:1.00, price:95,  status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(0) },
    { id:11, customer:"Meadow House",       type:"exterior",   service:"Softwash render", postcode:"SW19 1AA",startHour:7.33, durationHrs:1.67, price:220, status:"complete",    assignee:"Tom",   assignees:["Tom"],   date:dateFor(0) },
    { id:12, customer:"Barnes",             type:"exterior",   service:"Driveway wash",   postcode:"SW19 2BB",startHour:9.00, durationHrs:1.33, price:140, status:"in-progress", assignee:"Tom",   assignees:["Tom"],   date:dateFor(0) },
    { id:13, customer:"Laurel Lodge",       type:"exterior",   service:"Patio clean",     postcode:"SW19 4EE",startHour:11.33,durationHrs:1.33, price:150, status:"scheduled",   assignee:"Tom",   assignees:["Tom"],   date:dateFor(0) },
    { id:14, customer:"Davies",             type:"residential",service:"Deep clean",      postcode:"SW2 1AA", startHour:8.00, durationHrs:2.50, price:140, status:"in-progress", assignee:"Sarah", assignees:["Sarah"], date:dateFor(0) },
    { id:15, customer:"Wilson",             type:"residential",service:"Regular clean",   postcode:"SW3 2BB", startHour:11.00,durationHrs:2.00, price:65,  status:"scheduled",   assignee:"Sarah", assignees:["Sarah"], date:dateFor(0) },
    { id:16, customer:"Adams",              type:"residential",service:"Deep clean",      postcode:"SW4 1DD", startHour:9.00, durationHrs:3.00, price:175, status:"complete",    assignee:"Mia",   assignees:["Mia"],   date:dateFor(0) },
    { id:17, customer:"Miller",             type:"residential",service:"Regular clean",   postcode:"SW8 2EE", startHour:12.67,durationHrs:2.00, price:70,  status:"scheduled",   assignee:"Mia",   assignees:["Mia"],   date:dateFor(0) },
    { id:18, customer:"Greenfield Office",  type:"commercial", service:"Weekly office",   postcode:"SW6 3FF", startHour:7.00, durationHrs:3.00, price:140, status:"complete",    assignee:"Dave",  assignees:["Dave"],  date:dateFor(0) },
    { id:19, customer:"Riverside Retail",   type:"commercial", service:"Retail clean",    postcode:"SE1 4GG", startHour:13.00,durationHrs:2.33, price:180, status:"scheduled",   assignee:"Dave",  assignees:["Dave"],  date:dateFor(0) },
    { id:20, customer:"Patel",              type:"residential",service:"End of tenancy",  postcode:"SE5 3CC", startHour:13.33,durationHrs:3.33, price:280, status:"unassigned",  assignee:null,    assignees:[],        date:dateFor(0) },

    // Tomorrow + rest of week — sparser, for Week view
    { id:21, customer:"Nexus HQ",           type:"commercial", service:"Deep commercial", postcode:"EC1",     startHour:8,    durationHrs:4,    price:200, status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(1) },
    { id:22, customer:"Wilson",             type:"residential",service:"Regular clean",   postcode:"SW3",     startHour:10,   durationHrs:2,    price:65,  status:"scheduled",   assignee:"Sarah", assignees:["Sarah"], date:dateFor(1) },
    { id:23, customer:"Battersea Office",   type:"commercial", service:"Contract clean",  postcode:"SW11",    startHour:7,    durationHrs:3,    price:150, status:"scheduled",   assignee:"Dave",  assignees:["Dave"],  date:dateFor(2) },
    { id:24, customer:"Hughes",             type:"exterior",   service:"Driveway wash",   postcode:"SW19",    startHour:10,   durationHrs:2,    price:95,  status:"scheduled",   assignee:"Tom",   assignees:["Tom"],   date:dateFor(3) },
    { id:25, customer:"Fletcher Round",     type:"exterior",   service:"Windows",         postcode:"W9",      startHour:9,    durationHrs:3,    price:180, status:"scheduled",   assignee:"Jamie", assignees:["Jamie"], date:dateFor(-1) },
  ];
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS     = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const GRID_HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18];

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function LightCard({ children, className = "" }) {
  return (
    <div
      className={`rounded-2xl border border-white/70 shadow-xl shadow-slate-400/10 backdrop-blur-2xl ${className}`}
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.55) 100%)",
        boxShadow: "0 8px 32px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-slate-400">{children}</p>;
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function TypeBadge({ type }) {
  const s = TYPE[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${s.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
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

// Deterministic tint for a crew name — rotates through a brand-friendly palette.
const CREW_PALETTE = ["#F97316", "#EA580C", "#10B981", "#059669", "#1F48FF", "#7C3AED", "#EC4899", "#0891B2"];
function tintForCrew(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CREW_PALETTE[Math.abs(hash) % CREW_PALETTE.length];
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
  return { quarter: q + 1, year: now.getFullYear(), startMonth: q * 3 };
}

function fmtTime(h) {
  const hr = Math.floor(h);
  const mins = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2,"0")}:${mins.toString().padStart(2,"0")}`;
}

function fmtTime12(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const ampm = hours < 12 ? "am" : "pm";
  const display = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
  return `${display}:${mins.toString().padStart(2, '0')}${ampm}`;
}

// ─── Overlap layout engine (used in Week view) ────────────────────────────────
function layoutDayJobs(dayJobs) {
  const sorted = [...dayJobs].sort((a, b) => a.startHour - b.startHour);
  const placed  = [];
  const colEnds = [];
  for (const job of sorted) {
    const end = job.startHour + (job.durationHrs || 1);
    let col = colEnds.findIndex(t => t <= job.startHour);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    placed.push({ job, col });
  }
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
  return placed;
}

// ─── Stat strip ───────────────────────────────────────────────────────────────
function StatStrip({ jobs }) {
  const total       = jobs.length;
  const revenue     = jobs.reduce((s, j) => s + (j.price || 0), 0);
  const done        = jobs.filter(j => j.status === "complete").length;
  const inProgress  = jobs.filter(j => j.status === "in-progress").length;
  const upcoming    = jobs.filter(j => j.status === "scheduled").length;
  const unassigned  = jobs.filter(j => j.status === "unassigned").length;

  return (
    <div className="flex items-center gap-4 flex-wrap text-xs">
      <Stat label="Jobs"        value={total} />
      <Stat label="Revenue"     value={`£${revenue.toLocaleString()}`} emphasis color="text-slate-900" />
      <Stat label="Done"        value={done}       color="text-emerald-600" />
      <Stat label="In progress" value={inProgress} color="text-amber-600" />
      <Stat label="Upcoming"    value={upcoming}   color="text-slate-600" />
      {unassigned > 0 && <Stat label="Unassigned" value={unassigned} color="text-red-600" />}
    </div>
  );
}

function Stat({ label, value, color = "text-slate-900", emphasis }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-bold tabular-nums ${emphasis ? "text-base" : "text-sm"} ${color}`}>{value}</span>
      <span className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
    </div>
  );
}

// ─── View switcher ───────────────────────────────────────────────────────────
function ViewTabs({ view, setView, setDayOffset }) {
  const views = ["Day", "Week", "Month", "Quarter"];
  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold bg-white/60">
      {views.map(v => (
        <button
          key={v}
          onClick={() => { setView(v); setDayOffset(0); }}
          className={`px-3 py-1.5 transition-all ${view === v ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function DateNav({ view, dayOffset, setDayOffset }) {
  let dateLabel = "";
  if (view === "Day") {
    const d = getViewDate(dayOffset, "Day");
    dateLabel = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  } else if (view === "Week") {
    const dates = getWeekDates(dayOffset);
    dateLabel = `${dates[0].getDate()} ${MONTHS[dates[0].getMonth()]} – ${dates[6].getDate()} ${MONTHS[dates[6].getMonth()]}`;
  } else if (view === "Month") {
    const d = getViewDate(dayOffset, "Month");
    dateLabel = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  } else {
    const q = getCurrentQuarter();
    const qMonths = [MONTHS[q.startMonth], MONTHS[q.startMonth + 1], MONTHS[q.startMonth + 2]];
    dateLabel = `Q${q.quarter} ${q.year} — ${qMonths[0]} to ${qMonths[2]}`;
  }

  return (
    <div className="flex items-center gap-2">
      {view !== "Quarter" && (
        <>
          <button onClick={() => setDayOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-600 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-[200px] text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {dayOffset === 0 ? "Today" : view}
            </div>
            <div className="text-sm font-bold text-slate-900 leading-tight">{dateLabel}</div>
          </div>
          <button onClick={() => setDayOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-white/60 text-slate-600 transition-colors">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setDayOffset(0)}
            className="ml-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white/60 hover:bg-white text-slate-700"
          >
            Today
          </button>
        </>
      )}
      {view === "Quarter" && (
        <div className="text-sm font-bold text-slate-900">{dateLabel}</div>
      )}
    </div>
  );
}

// ─── Filter pills ────────────────────────────────────────────────────────────
function FilterBar({ typeFilter, setTypeFilter, crews, crewFilter, setCrewFilter }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        <Filter size={12} /> Type
      </div>
      <div className="flex gap-1.5">
        <FilterPill active={typeFilter==="all"}         onClick={() => setTypeFilter("all")}         label="All" />
        <FilterPill active={typeFilter==="exterior"}    onClick={() => setTypeFilter("exterior")}    label="Exterior"    type="exterior" />
        <FilterPill active={typeFilter==="residential"} onClick={() => setTypeFilter("residential")} label="Residential" type="residential" />
        <FilterPill active={typeFilter==="commercial"}  onClick={() => setTypeFilter("commercial")}  label="Commercial"  type="commercial" />
      </div>

      {crews.length > 0 && (
        <>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Crew</div>
          <div className="flex gap-1.5 flex-wrap">
            <FilterPill active={crewFilter==="all"} onClick={() => setCrewFilter("all")} label="All" />
            {crews.map((c) => (
              <button
                key={c.id}
                onClick={() => setCrewFilter(crewFilter === c.id ? "all" : c.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                  crewFilter === c.id
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white/70 text-slate-700 border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                  style={{ background: c.tint }}
                >{c.init}</span>
                {c.name}
              </button>
            ))}
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
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white/70 text-slate-700 border-slate-200 hover:border-slate-300"
      }`}
    >
      {t && <span className={`w-2 h-2 rounded-full ${t.dot}`} />}
      {label}
    </button>
  );
}

// ─── DAY VIEW — per-crew lanes on a 20-min grid ──────────────────────────────
const DAY_START  = 6;
const DAY_END    = 19;
const PX_PER_HR  = 96;

function deriveCrews(jobs) {
  const map = new Map();
  jobs.forEach(j => {
    const assignees = getJobAssignees(j);
    const list = assignees.length > 0 ? assignees : ["__unassigned__"];
    list.forEach(name => {
      const existing = map.get(name) || { id: name, name: name === "__unassigned__" ? "Unassigned" : name, jobs: [], types: {} };
      existing.jobs.push(j);
      existing.types[j.type] = (existing.types[j.type] || 0) + 1;
      map.set(name, existing);
    });
  });
  const crews = Array.from(map.values()).map(c => {
    const primaryType = Object.entries(c.types).sort((a,b) => b[1] - a[1])[0]?.[0] || "residential";
    return {
      ...c,
      primaryType,
      tint: c.id === "__unassigned__" ? "#94A3B8" : tintForCrew(c.name),
      init: c.id === "__unassigned__" ? "?" : c.name.charAt(0).toUpperCase(),
    };
  });
  return crews.sort((a, b) => {
    if (a.id === "__unassigned__") return 1;
    if (b.id === "__unassigned__") return -1;
    return b.jobs.length - a.jobs.length;
  });
}

function JobBlock({ job, onClick }) {
  const t = TYPE[job.type];
  const top = (job.startHour - DAY_START) * PX_PER_HR;
  const h   = Math.max(job.durationHrs * PX_PER_HR, 24);
  const isComplete = job.status === "complete";
  const isUnassigned = job.status === "unassigned";
  const isTight = h < 48;

  return (
    <button
      onClick={() => onClick(job)}
      className="absolute left-1 right-1 rounded-lg border border-white/70 shadow-sm shadow-slate-400/10 overflow-hidden cursor-pointer transition-all hover:shadow-md hover:shadow-slate-400/20 hover:-translate-y-[1px] hover:z-10 text-left"
      style={{
        top,
        height: h - 2,
        background: `linear-gradient(160deg, ${t.fill} 0%, rgba(255,255,255,0.5) 100%)`,
        borderLeft: `3px solid ${t.bar}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.06)`,
      }}
    >
      <div className="px-2 py-1 h-full flex flex-col justify-between" style={{ color: t.ink, opacity: isComplete ? 0.55 : 1 }}>
        {isTight ? (
          <div className="flex items-center gap-1.5 text-[11px] leading-tight font-medium min-w-0">
            <span className="tabular-nums shrink-0 opacity-70">{fmtTime(job.startHour)}</span>
            <span className={`truncate ${isComplete ? "line-through" : ""}`}>{job.customer}</span>
            {job.postcode && <span className="ml-auto shrink-0 tabular-nums opacity-60 text-[10px]">{job.postcode}</span>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] leading-tight font-semibold min-w-0">
              <span className="tabular-nums opacity-70">{fmtTime(job.startHour)}</span>
              <span className={`truncate ${isComplete ? "line-through" : ""}`}>{job.customer}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] leading-tight opacity-80">
              <span className="truncate">{job.service}</span>
              {job.postcode && <span className="tabular-nums shrink-0 ml-1">{job.postcode}</span>}
            </div>
            {h >= 72 && (
              <div className="flex items-center justify-between text-[10px] font-medium">
                <span className="tabular-nums">£{job.price}</span>
                <StatusChip status={job.status} />
              </div>
            )}
          </>
        )}
        {isUnassigned && !isTight && (
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
        )}
      </div>
    </button>
  );
}

function StatusChip({ status }) {
  const cfg = {
    complete:      { label: "Done",    cls: "bg-white/70 text-slate-500" },
    "in-progress": { label: "Now",     cls: "bg-amber-100 text-amber-800" },
    scheduled:     { label: "Booked",  cls: "bg-white/80 text-slate-500 border border-slate-200" },
    unassigned:    { label: "Open",    cls: "bg-red-50 text-red-700" },
  }[status];
  return (
    <span className={`px-1.5 py-[1px] rounded text-[9.5px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function HourRuler() {
  const hours = [];
  for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
  return (
    <div className="relative shrink-0 w-14 border-r border-white/60 bg-white/20 backdrop-blur-sm">
      {hours.map((h, i) => (
        <div
          key={h}
          className="absolute left-0 right-0 text-right pr-2 text-[11px] font-medium text-slate-400 tabular-nums"
          style={{ top: i * PX_PER_HR - 6 }}
        >
          {h.toString().padStart(2,"0")}:00
        </div>
      ))}
    </div>
  );
}

function CrewLane({ jobs, onJobClick }) {
  const totalHeight = (DAY_END - DAY_START) * PX_PER_HR;
  const slots = [];
  for (let h = DAY_START; h <= DAY_END; h += 1/3) {
    const isHour = Math.abs(h - Math.round(h)) < 0.01;
    slots.push({ top: (h - DAY_START) * PX_PER_HR, isHour });
  }

  return (
    <div className="relative flex-1 min-w-[180px] border-r border-white/60 last:border-r-0">
      {slots.map((s, i) => (
        <div
          key={i}
          className="absolute left-0 right-0"
          style={{
            top: s.top,
            height: 1,
            background: s.isHour ? "rgba(148, 163, 184, 0.25)" : "rgba(148, 163, 184, 0.10)",
          }}
        />
      ))}
      <div className="relative" style={{ height: totalHeight }}>
        {jobs.map((j) => <JobBlock key={j.id} job={j} onClick={onJobClick} />)}
      </div>
    </div>
  );
}

function DayView({ jobs, onJobClick, typeFilter, crewFilter }) {
  const filteredJobs = jobs.filter(j => {
    if (typeFilter !== "all" && j.type !== typeFilter) return false;
    if (crewFilter !== "all") {
      const assignees = getJobAssignees(j);
      if (crewFilter === "__unassigned__") return assignees.length === 0;
      if (!assignees.includes(crewFilter)) return false;
    }
    return true;
  });

  const crews = useMemo(() => deriveCrews(filteredJobs), [filteredJobs]);

  if (crews.length === 0) {
    return (
      <LightCard>
        <div className="px-6 py-12 text-center text-slate-500">
          <p className="text-sm">No jobs scheduled for this day.</p>
          <p className="text-xs mt-1 text-slate-400">Use the “+ New job” button to add one.</p>
        </div>
      </LightCard>
    );
  }

  return (
    <LightCard>
      {/* Crew header row */}
      <div className="flex border-b border-white/60 bg-white/40 backdrop-blur rounded-t-2xl">
        <div className="w-14 shrink-0 border-r border-white/60" />
        {crews.map((c) => {
          const rev = c.jobs.reduce((s, j) => s + (j.price || 0), 0);
          return (
            <div key={c.id} className="flex-1 min-w-[180px] border-r border-white/60 last:border-r-0 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                  style={{ background: c.tint }}
                >{c.init}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 leading-tight truncate">{c.name}</div>
                  <div className="text-[10.5px] text-slate-500 leading-tight tabular-nums">
                    {c.jobs.length} {c.jobs.length === 1 ? "job" : "jobs"} · £{rev}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex overflow-x-auto">
        <HourRuler />
        {crews.map((c) => (
          <CrewLane key={c.id} jobs={c.jobs} onJobClick={onJobClick} />
        ))}
      </div>
    </LightCard>
  );
}

// ─── WEEK VIEW — 7-col time grid (re-themed) ──────────────────────────────────
function WeekView({ jobs, onJobClick }) {
  const WEEK_PX_PER_HR = 56;
  const LABEL_W = 48;
  const [expandedDay, setExpandedDay] = useState(0);

  const jobHeight = (hrs) => Math.max(hrs * WEEK_PX_PER_HR, 24);
  const jobTop    = (h)   => (h - GRID_HOURS[0]) * WEEK_PX_PER_HR;

  return (
    <>
      {/* Mobile: day-by-day cards */}
      <div className="sm:hidden space-y-2">
        {DAYS_SHORT.map((day, dayIdx) => {
          const dayJobs = jobs.filter(j => j.day === dayIdx).sort((a,b) => a.startHour - b.startHour);
          const dayRevenue = dayJobs.reduce((s,j) => s + j.price, 0);
          const isOpen = expandedDay === dayIdx;

          return (
            <LightCard key={day}>
              <button
                onClick={() => setExpandedDay(isOpen ? -1 : dayIdx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 bg-slate-900 text-white">
                  <span className="text-[10px] font-bold uppercase leading-none">{day}</span>
                  <span className="text-sm font-black leading-tight">{6 + dayIdx}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-bold text-slate-900">
                    {dayJobs.length} {dayJobs.length === 1 ? "job" : "jobs"}
                  </span>
                  {dayJobs.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      {dayJobs.map(j => (
                        <div key={j.id} className={`w-1.5 h-1.5 rounded-full ${TYPE[j.type].dot}`} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-black tabular-nums ${dayRevenue > 0 ? "text-emerald-600" : "text-slate-300"}`}>
                    £{dayRevenue}
                  </p>
                </div>
              </button>

              {isOpen && dayJobs.length > 0 && (
                <div className="border-t border-slate-100">
                  {dayJobs.map(job => (
                    <button
                      key={job.id}
                      onClick={() => onJobClick(job)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                    >
                      <div className="w-1 self-stretch rounded-full" style={{ background: TYPE[job.type].bar }} />
                      <div className="w-12 shrink-0">
                        <p className="text-xs font-mono text-slate-500">{fmtTime(job.startHour)}</p>
                        <p className="text-xs text-slate-400">{job.durationHrs}hr</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{job.customer}</p>
                        <p className="text-xs text-slate-500 truncate">{job.service} · {job.postcode}</p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-black tabular-nums text-emerald-600">£{job.price}</p>
                        <StatusBadge status={job.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </LightCard>
          );
        })}
      </div>

      {/* Desktop: full time grid */}
      <LightCard className="hidden sm:block">
        <div className="flex border-b border-white/60 bg-white/40 backdrop-blur rounded-t-2xl">
          <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0" />
          {DAYS_SHORT.map((d, i) => {
            const dayJobs = jobs.filter(j => j.day === i);
            const rev = dayJobs.reduce((s, j) => s + j.price, 0);
            return (
              <div
                key={d}
                className={`flex-1 text-center py-2 border-l border-white/60 min-w-[100px] ${i === 0 ? "bg-blue-50/50" : ""}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{d}</p>
                <p className="text-sm font-bold text-slate-900">{6 + i}</p>
                <p className="text-xs text-emerald-600 font-semibold tabular-nums">£{rev}</p>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
          <div className="flex" style={{ minHeight: GRID_HOURS.length * WEEK_PX_PER_HR, minWidth: LABEL_W + 7 * 100 }}>
            <div style={{ width: LABEL_W, minWidth: LABEL_W }} className="shrink-0 border-r border-white/60">
              {GRID_HOURS.map(h => (
                <div key={h} style={{ height: WEEK_PX_PER_HR }} className="flex items-start pt-1 pr-2 justify-end">
                  <span className="text-xs text-slate-400 tabular-nums">{fmtTime12(h)}</span>
                </div>
              ))}
            </div>

            {DAYS_SHORT.map((_, dayIdx) => {
              const dayJobs = jobs.filter(j => j.day === dayIdx);
              return (
                <div
                  key={dayIdx}
                  className={`flex-1 border-l border-white/60 relative min-w-[100px] ${dayIdx === 0 ? "bg-blue-50/30" : ""}`}
                  style={{ minHeight: GRID_HOURS.length * WEEK_PX_PER_HR }}
                >
                  {GRID_HOURS.map(h => (
                    <div key={h} style={{ height: WEEK_PX_PER_HR, borderTop: "1px solid rgba(148,163,184,0.15)" }} />
                  ))}

                  {layoutDayJobs(dayJobs).map(({ job, col, colCount }) => {
                    const t      = TYPE[job.type];
                    const top    = jobTop(job.startHour);
                    const height = jobHeight(job.durationHrs);
                    const pct    = 100 / colCount;
                    return (
                      <button
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className="absolute rounded-md px-1.5 py-1 text-left hover:-translate-y-[1px] hover:shadow-md hover:z-20 transition-all overflow-hidden border border-white/70"
                        style={{
                          top,
                          height,
                          left:  `calc(${col * pct}% + 2px)`,
                          width: `calc(${pct}% - 4px)`,
                          zIndex: col + 1,
                          background: `linear-gradient(160deg, ${t.fill} 0%, rgba(255,255,255,0.5) 100%)`,
                          borderLeft: `3px solid ${t.bar}`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7)`,
                        }}
                      >
                        <p className="text-[11px] font-bold truncate leading-tight" style={{ color: t.ink }}>
                          {job.customer}
                        </p>
                        {height > 36 && (
                          <p className="text-[10px] truncate opacity-80 leading-tight" style={{ color: t.ink }}>
                            {job.service}
                          </p>
                        )}
                        {height > 56 && (
                          <p className="text-[10px] font-semibold tabular-nums mt-0.5" style={{ color: t.ink }}>
                            £{job.price}
                          </p>
                        )}
                        {job.status === "unassigned" && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </LightCard>
    </>
  );
}

// ─── MONTH VIEW (re-themed) ──────────────────────────────────────────────────
function MonthView({ jobs, onJobClick, viewDate }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const todayStr = isoDate(getToday());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayJS = new Date(year, month, 1).getDay();
  const firstDOW = firstDayJS === 0 ? 6 : firstDayJS - 1;

  const cells = [];
  for (let i = 0; i < firstDOW; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayJobs = jobs.filter(j => j.date === dateStr);
    cells.push({
      day: d,
      dateStr,
      jobCount: dayJobs.length,
      revenue: dayJobs.reduce((s,j)=>s+(j.price||0),0),
      isToday: dateStr === todayStr,
      hasUnassigned: dayJobs.some(j=>j.status==="unassigned"),
      jobs: dayJobs,
    });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const expandedDay = selectedDay !== null ? cells.find(c => c.day === selectedDay) : null;
  const monthLabel = viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="space-y-3">
      <LightCard>
        <div className="grid grid-cols-7 border-b border-white/60 bg-white/40 rounded-t-2xl">
          {DAYS_SHORT.map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-bold tracking-widest uppercase text-slate-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((cell, i) => (
            <button
              key={i}
              onClick={() => cell.day && setSelectedDay(cell.day === selectedDay ? null : cell.day)}
              className={`border-r border-b border-white/50 last:border-r-0 p-2 min-h-[72px] text-left transition-all ${
                !cell.day           ? "cursor-default bg-white/20" :
                cell.isToday        ? "bg-blue-50/80 hover:bg-blue-100/60" :
                cell.day === selectedDay ? "bg-slate-100/60" :
                "hover:bg-white/60"
              }`}
              disabled={!cell.day}
            >
              {cell.day && (
                <>
                  <p className={`text-xs font-bold mb-1 ${cell.isToday ? "text-blue-700" : "text-slate-700"}`}>
                    {cell.day}
                  </p>
                  {cell.jobCount > 0 && (
                    <>
                      <div className="flex gap-0.5 flex-wrap mb-1">
                        {cell.jobs?.slice(0,6).map((j,idx) => (
                          <div key={idx} className={`w-2 h-2 rounded-full ${TYPE[j.type].dot}`} />
                        ))}
                        {cell.jobCount > 6 && <span className="text-[10px] text-slate-500 font-bold">+{cell.jobCount-6}</span>}
                      </div>
                      <p className="text-[11px] font-bold text-emerald-600 tabular-nums">£{cell.revenue}</p>
                      {cell.hasUnassigned && <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-0.5" />}
                    </>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </LightCard>

      {expandedDay && expandedDay.jobs?.length > 0 && (
        <LightCard>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/60">
            <SectionLabel>
              {expandedDay.day} {monthLabel} — {expandedDay.jobCount} jobs · £{expandedDay.revenue}
            </SectionLabel>
            <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="divide-y divide-white/50">
            {expandedDay.jobs.map(job => (
              <button
                key={job.id}
                onClick={() => onJobClick(job)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/60 text-left transition-all"
              >
                <div className="w-1 h-8 rounded-full" style={{ background: TYPE[job.type].bar }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{job.customer}</p>
                  <p className="text-xs text-slate-500">{job.service} · {job.postcode}</p>
                </div>
                <StatusBadge status={job.status} />
                <span className="text-sm font-black text-emerald-600 ml-2 tabular-nums">£{job.price}</span>
              </button>
            ))}
          </div>
        </LightCard>
      )}
    </div>
  );
}

// ─── QUARTER VIEW (re-themed) ─────────────────────────────────────────────────
function QuarterView({ jobs }) {
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
    return {
      week: i + 1,
      revenue: weekJobs.reduce((s, j) => s + (j.price || 0), 0),
      jobs: weekJobs.length,
      complete: weekJobs.filter(j => j.status === 'complete').length,
      isCurrent: todayStr >= weekStartStr && todayStr <= weekEndStr,
    };
  });

  const maxRev    = Math.max(...quarterWeeks.map(w => w.revenue), 1);
  const total     = quarterWeeks.reduce((s,w) => s + w.revenue, 0);
  const avgRev    = Math.round(total / 13);
  const totalJobs = quarterWeeks.reduce((s,w) => s + w.jobs, 0);
  const qMonths   = [MONTHS[q.startMonth], MONTHS[q.startMonth + 1], MONTHS[q.startMonth + 2]];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Q${q.quarter} revenue`, value: `£${total.toLocaleString()}`, accent: "text-emerald-600" },
          { label: "Total jobs",            value: totalJobs },
          { label: "Weekly avg",            value: `£${avgRev.toLocaleString()}` },
          { label: "Best week",             value: `£${maxRev.toLocaleString()}`, accent: "text-blue-600" },
        ].map(({ label, value, accent = "text-slate-900" }) => (
          <LightCard key={label} className="px-4 py-3">
            <p className="text-[10px] font-bold tracking-widest uppercase text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
          </LightCard>
        ))}
      </div>

      <LightCard className="p-4">
        <div className="flex items-center justify-between mb-4">
          <SectionLabel>Weekly revenue — Q{q.quarter} {q.year}</SectionLabel>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs text-slate-500">Current week</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              <span className="text-xs text-slate-500">Other weeks</span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1.5 h-48">
          {quarterWeeks.map(w => {
            const pct = (w.revenue / maxRev) * 100;
            return (
              <div key={w.week} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                <div className="relative flex flex-col items-center w-full">
                  <div className="hidden group-hover:flex absolute bottom-full mb-1 flex-col items-center z-10">
                    <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap shadow-xl">
                      W{w.week}: £{w.revenue} · {w.jobs} jobs
                    </div>
                  </div>
                  <div
                    className={`w-full rounded-t-lg transition-all ${w.isCurrent ? "bg-blue-600" : "bg-slate-300 group-hover:bg-slate-400"}`}
                    style={{ height: `${Math.max(pct * 1.7, 4)}px` }}
                  />
                </div>
                <span className={`text-xs ${w.isCurrent ? "text-blue-700 font-bold" : "text-slate-400"}`}>{w.week}</span>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between mt-2">
          <span className="text-xs text-slate-400">Wk 1</span>
          <span className="text-xs text-slate-600 font-semibold">{qMonths[0]}</span>
          <span className="text-xs text-slate-600 font-semibold">{qMonths[1]}</span>
          <span className="text-xs text-slate-600 font-semibold">{qMonths[2]}</span>
          <span className="text-xs text-slate-400">Wk 13</span>
        </div>
      </LightCard>

      <LightCard>
        <div className="px-4 py-3 border-b border-white/60">
          <SectionLabel>Week breakdown</SectionLabel>
        </div>
        <div className="divide-y divide-white/50 max-h-64 overflow-y-auto">
          {quarterWeeks.map(w => {
            const completePct = Math.round((w.complete / Math.max(w.jobs,1)) * 100);
            return (
              <div key={w.week} className={`flex items-center gap-3 px-4 py-2.5 transition-all ${w.isCurrent ? "bg-blue-50/60" : "hover:bg-white/60"}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${w.isCurrent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {w.week}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-semibold text-slate-900">
                      Week {w.week} {w.isCurrent ? "← current" : ""}
                    </span>
                    <span className="font-black tabular-nums text-emerald-600">£{w.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${w.isCurrent ? "bg-blue-600" : "bg-slate-400"}`}
                        style={{ width: `${completePct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 tabular-nums">{w.complete}/{w.jobs} jobs</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </LightCard>
    </div>
  );
}

// ─── Job drawer ───────────────────────────────────────────────────────────────
function JobDrawer({ job, onClose, onUpdateJob, onDeleteJob }) {
  const [status, setStatus] = useState(job.status);
  const [notes, setNotes] = useState(job.notes || '');
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState(null);

  const hasChanges = status !== job.status || notes !== (job.notes || '');

  const handleSave = async () => {
    setSaving(true);
    setDrawerError(null);
    try {
      await onUpdateJob?.(job.id, { status, notes });
      setSaving(false);
      onClose();
    } catch {
      setDrawerError('Could not save changes. Please try again.');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this job? This cannot be undone.')) {
      try {
        await onDeleteJob?.(job.id);
        onClose();
      } catch {
        setDrawerError('Could not delete job. Please try again.');
      }
    }
  };

  const t = TYPE[job.type];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-white shadow-2xl overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100" style={{ background: t.fill }}>
          <div>
            <p className="font-black text-base text-slate-900">{job.customer}</p>
            <p className="text-xs text-slate-600 mt-0.5">{job.service}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <StatusBadge status={status} />
            <TypeBadge type={job.type} />
          </div>

          <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
            {[
              ["Date",      job.date ? new Date(job.date + 'T00:00:00').toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "—"],
              ["Address",   [job.address_line1, job.address_line2, job.town, job.postcode].filter(Boolean).join(', ') || job.postcode || "—"],
              ["Time",      `${fmtTime(job.startHour)} — ${fmtTime(job.startHour + job.durationHrs)}`],
              ["Duration",  `${job.durationHrs} hrs`],
              ["Price",     `£${job.price}`],
              ["Assignee",  getJobAssigneeLabel(job)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                <span className="text-slate-500 font-medium">{label}</span>
                <span className={`font-semibold ${label === "Price" ? "text-emerald-600" : label === "Assignee" && getJobAssignees(job).length === 0 ? "text-red-600" : "text-slate-900"}`}>
                  {val}
                </span>
              </div>
            ))}
          </div>

          <div>
            <SectionLabel>Update status</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {["scheduled","in-progress","complete","unassigned"].map(st => (
                <button
                  key={st}
                  onClick={() => setStatus(st)}
                  className={`py-2 text-xs font-bold uppercase tracking-wide rounded-lg border transition-all ${
                    status === st
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {STATUS_LABELS[st]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Notes</SectionLabel>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="mt-2 w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Add job notes, access codes, client preferences…"
            />
          </div>

          {drawerError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{drawerError}</div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide rounded-xl transition-all ${
                hasChanges && !saving
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New job modal ───────────────────────────────────────────────────────────
const DEFAULT_STAFF_OPTIONS = [
  { id: "you",        label: "You" },
  { id: "unassigned", label: "Unassigned" },
];

const SERVICE_OPTIONS = {
  residential: ["Regular clean","Deep clean","End of tenancy","One-off clean","Carpet clean","Oven clean","Spring clean","Post-renovation clean"],
  commercial:  ["Regular office clean","Deep commercial clean","Contract clean","Washroom sanitise","Kitchen sanitise","Event clean","Builder's clean","Carpet extraction"],
  exterior:    ["Window clean","Gutter clean","Roof moss treatment","Driveway pressure wash","Fascias & soffits","Render wash","Conservatory roof","Solar panel clean","Patio jet wash"],
};

const RECURRENCE_OPTIONS = [
  { id: "none",        label: "One-off",        group: "all" },
  { id: "daily",       label: "Daily",          group: "res-com" },
  { id: "weekly",      label: "Weekly",         group: "res-com" },
  { id: "fortnightly", label: "Fortnightly",    group: "res-com" },
  { id: "monthly",     label: "Monthly",        group: "res-com" },
  { id: "quarterly",   label: "Quarterly",      group: "res-com" },
  { id: "6weekly",     label: "Every 6 weeks",  group: "exterior" },
  { id: "8weekly",     label: "Every 8 weeks",  group: "exterior" },
  { id: "12weekly",    label: "Every 12 weeks", group: "exterior" },
];

function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" });
}

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
  if (!saved.length && !custom) return null;
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

  const [staffOptions, setStaffOptions] = useState(DEFAULT_STAFF_OPTIONS);
  useEffect(() => {
    import('../lib/supabase').then(({ supabase }) => {
      supabase.from('staff_members').select('id, name').eq('active', true)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const dbStaff = data.map(s => ({ id: s.id, label: s.name }));
            setStaffOptions([{ id: "you", label: "You" }, ...dbStaff, { id: "unassigned", label: "Unassigned" }]);
          }
        }).catch(() => {});
    }).catch(() => {});
  }, []);

  const [customer,     setCustomer]     = useState(preCustomer);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [town,         setTown]         = useState("");
  const [postcode,     setPostcode]     = useState("");
  const [date,         setDate]         = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime,    setStartTime]    = useState("09:00");
  const [jobType,      setJobType]      = useState("residential");
  const [service,      setService]      = useState("");
  const [durationHrs,  setDuration]     = useState("2");
  const [price,        setPrice]        = useState("");
  const [assignees,    setAssignees]    = useState(["you"]);
  const [recurrence,   setRecurrence]   = useState("fortnightly");
  const [notes,        setNotes]        = useState("");
  const [customService,setCustomService]= useState("");
  const [serviceMode,  setServiceMode]  = useState("quick");

  const handleTypeChange = (t) => {
    setJobType(t);
    setService("");
    if (t === "exterior")        setRecurrence("8weekly");
    else if (t === "commercial") setRecurrence("weekly");
    else                         setRecurrence("fortnightly");
    // Default duration 20 min for exterior (minimum slot), 2 hr otherwise
    if (t === "exterior") setDuration("0.33");
    else setDuration("2");
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
    if (id === "unassigned") { setAssignees(["unassigned"]); return; }
    setAssignees(prev => {
      const withoutUnassigned = prev.filter(v => v !== "unassigned");
      if (withoutUnassigned.includes(id)) {
        const next = withoutUnassigned.filter(v => v !== id);
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
      customer, addressLine1, addressLine2, town, postcode, startHour,
      durationHrs: parseFloat(durationHrs) || 2,
      type: jobType, service,
      price: parseFloat(price),
      assignees: selectedStaff,
      assignee: selectedStaff.length > 0 ? selectedStaff.join(", ") : null,
      recurrence, notes,
      status: selectedStaff.length === 0 ? "unassigned" : "scheduled",
    };

    onSave?.({ ...baseJob, id: Date.now(), date });

    if (recurrence !== "none") {
      const dayMap = { daily: 1, weekly: 7, fortnightly: 14, monthly: 30, quarterly: 91, "6weekly": 42, "8weekly": 56, "12weekly": 84 };
      const interval = dayMap[recurrence];
      if (interval) {
        let nextDate = new Date(date);
        for (let i = 0; i < 11; i++) {
          nextDate = new Date(nextDate);
          nextDate.setDate(nextDate.getDate() + interval);
          onSave?.({ ...baseJob, id: Date.now() + i + 1, date: nextDate.toISOString().split('T')[0] });
        }
      }
    }

    onClose();
  };

  const FL = ({ children }) => (
    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-slate-500 mb-1.5">{children}</label>
  );
  const inp = "w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors";
  const chip = (active) =>
    `px-2.5 py-1.5 text-xs font-bold border rounded-lg transition-all ${
      active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"
    }`;

  // Duration options — include 20-min increments for exterior
  const durationOpts = jobType === "exterior"
    ? ["0.33","0.67","1","1.5","2","3","4"]
    : ["0.5","1","1.5","2","2.5","3","4","5","6"];
  const durLabel = (h) => {
    if (h === "0.33") return "20m";
    if (h === "0.67") return "40m";
    if (h === "0.5")  return "30m";
    return `${h}h`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="relative overflow-hidden w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl rounded-t-2xl sm:rounded-2xl bg-white border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 shrink-0 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div>
            <p className="font-black text-sm text-slate-900">Add New Job</p>
            {recurrence !== "none" && selectedRec && (
              <p className="text-xs text-slate-500 mt-0.5">{selectedRec.label} · recurring</p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div>
            <FL>Job type</FL>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "residential", label: "Residential" },
                { id: "commercial",  label: "Commercial" },
                { id: "exterior",    label: "Exterior" },
              ].map(({ id, label }) => (
                <button key={id} onClick={() => handleTypeChange(id)} className={chip(jobType === id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FL>Service</FL>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-2">
              {['quick','custom'].map(mode => (
                <button key={mode}
                  onClick={() => { setServiceMode(mode); setService(''); setCustomService(''); }}
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                    serviceMode === mode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}>
                  {mode === 'quick' ? (usingProfile ? '✓ Your Services' : 'Quick Pick') : '+ Custom'}
                </button>
              ))}
            </div>
            {serviceMode === 'quick' ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map(s => (
                  <button key={s} onClick={() => setService(s)} className={chip(service === s)}>{s}</button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={customService}
                onChange={e => { setCustomService(e.target.value); setService(e.target.value); }}
                placeholder="Type your service name…"
                className={inp}
              />
            )}
          </div>

          <div>
            <FL>Customer name</FL>
            <div className="relative">
              <input type="text" value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="e.g. Mrs Davies" className={inp} />
              {customer.length > 0 && customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xl">
                  {customers.filter(c => c.name.toLowerCase().includes(customer.toLowerCase())).slice(0, 5).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setCustomer(c.name);
                        setAddressLine1(c.address_line1 || "");
                        setAddressLine2(c.address_line2 || "");
                        setTown(c.town || "");
                        setPostcode(c.postcode || "");
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-slate-900 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0">
                      <span className="font-semibold">{c.name}</span>
                      {(c.address_line1 || c.postcode) && <span className="ml-2 text-slate-500 text-xs">{[c.address_line1, c.town, c.postcode].filter(Boolean).join(', ')}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <FL>Address</FL>
            <input type="text" value={addressLine1} onChange={e=>setAddressLine1(e.target.value)}
              placeholder="12 High Street" className={`${inp} mb-2`} />
            <input type="text" value={addressLine2} onChange={e=>setAddressLine2(e.target.value)}
              placeholder="Flat / building (optional)" className={`${inp} mb-2`} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={town} onChange={e=>setTown(e.target.value)}
                placeholder="Town / City" className={inp} />
              <input type="text" value={postcode} onChange={e=>setPostcode(e.target.value.toUpperCase())}
                placeholder="Postcode" className={inp} />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FL>Duration</FL>
              <div className="flex flex-wrap gap-1.5">
                {durationOpts.map(h => (
                  <button key={h} onClick={() => setDuration(h)} className={chip(durationHrs === h)}>
                    {durLabel(h)}
                  </button>
                ))}
              </div>
              {jobType === "exterior" && (
                <p className="text-[10.5px] text-slate-500 mt-1.5">Exterior jobs support 20-min minimum blocks.</p>
              )}
            </div>
            <div>
              <FL>Price (£)</FL>
              <input type="number" min="0" step="5" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 65" className={inp} />
              {parseFloat(price)>0 && parseFloat(durationHrs)>0 && (
                <p className="text-xs text-slate-500 mt-1">£{(parseFloat(price)/parseFloat(durationHrs)).toFixed(0)}/hr</p>
              )}
            </div>
          </div>

          <div>
            <FL>Assign to</FL>
            <div className="grid grid-cols-4 gap-2">
              {staffOptions.map(s => (
                <button key={s.id} onClick={() => toggleAssignee(s.id)} className={chip(assignees.includes(s.id))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FL>Schedule / recurrence</FL>
            <div className="flex flex-wrap gap-1.5">
              {recurrenceOpts.map(r => (
                <button key={r.id} onClick={() => setRecurrence(r.id)} className={chip(recurrence === r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
            {recurrence !== "none" && (
              <div className="mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-semibold text-slate-900">{selectedRec?.label} · next job auto-scheduled</p>
                {nextDateStr() && (
                  <p className="text-xs text-slate-500 mt-0.5">Next occurrence: {nextDateStr()}</p>
                )}
              </div>
            )}
          </div>

          <div>
            <FL>Notes / access details</FL>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2}
              placeholder="Key code, parking, pets, access instructions…"
              className={`${inp} resize-none`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex gap-2 shrink-0">
          <button onClick={handleSave} disabled={!valid}
            className={`flex-1 py-3 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${
              valid
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}>
            {recurrence === "none" ? "Save job" : "Save & schedule recurring"}
          </button>
          <button onClick={onClose}
            className="px-5 py-3 border border-slate-200 text-slate-700 text-xs font-bold uppercase hover:bg-white rounded-xl transition-all">
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
  const isDemoUser = user?.id === 'demo-user';
  const isLive = Boolean(user) && !isDemoUser;
  const { jobs: contextJobs, addJobAndSyncCustomer, updateJob, deleteJob, customers } = useData();
  const DEMO_JOBS = useMemo(() => buildDemoJobs(), []);
  const allJobs = isLive ? (contextJobs || []) : DEMO_JOBS;

  const [searchParams, setSearchParams] = useSearchParams();
  const [view,         setView]         = useState("Day");
  const [dayOffset,    setDayOffset]    = useState(0);
  const [activeJob,    setActiveJob]    = useState(null);
  const [showNewJob,   setShowNewJob]   = useState(false);
  const [preCustomer,  setPreCustomer]  = useState("");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [crewFilter,   setCrewFilter]   = useState("all");
  const [search,       setSearch]       = useState("");

  useEffect(() => {
    const pc = searchParams.get('customer');
    if (pc) {
      setPreCustomer(pc);
      setShowNewJob(true);
      setSearchParams({});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJobClick   = (job) => { setActiveJob(job); externalJobClick?.(job); };
  const handleSaveJob    = (newJob) => { addJobAndSyncCustomer(newJob); };
  const handleUpdateJob  = async (id, updates) => {
    await updateJob?.(id, updates);
    setActiveJob(prev => prev?.id === id ? { ...prev, ...updates } : prev);
  };
  const handleDeleteJob  = async (id) => { await deleteJob?.(id); };

  const viewDate      = getViewDate(dayOffset, view);
  const todayStr      = isoDate(viewDate);
  const weekDates     = getWeekDates(dayOffset);
  const weekStartStr  = isoDate(weekDates[0]);
  const weekEndStr    = isoDate(weekDates[6]);

  const searchMatch = (j) => !search || j.customer?.toLowerCase().includes(search.toLowerCase()) || j.postcode?.toLowerCase().includes(search.toLowerCase());

  const todayJobs = allJobs.filter(j => j.date === todayStr && j.status !== 'cancelled' && searchMatch(j));
  const weekJobs  = allJobs.filter(j => j.date >= weekStartStr && j.date <= weekEndStr && j.status !== 'cancelled' && searchMatch(j));
  const weekJobsWithDay = weekJobs.map(j => {
    const jobDate = new Date(j.date + 'T00:00:00');
    const dayOfWeek = jobDate.getDay();
    return { ...j, day: dayOfWeek === 0 ? 6 : dayOfWeek - 1 };
  });

  // Crews derived from currently-visible day jobs (for the filter bar)
  const dayCrews = useMemo(() => deriveCrews(todayJobs), [todayJobs]);

  const headerJobs = view === "Day" ? todayJobs : weekJobs;

  return (
    <div className="relative flex flex-col min-h-full overflow-hidden" style={{
      background: "linear-gradient(135deg, #E7EEFB 0%, #DCE4FA 40%, #E8DEFB 75%, #FBE8DC 100%)"
    }}>
      {/* Ambient gradient orbs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute top-[8%] left-[10%] w-[520px] h-[520px] rounded-full opacity-70"
             style={{ background: "radial-gradient(circle, #99c5ff 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div className="absolute top-[40%] right-[5%] w-[600px] h-[600px] rounded-full opacity-60"
             style={{ background: "radial-gradient(circle, #c7b8ff 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full opacity-55"
             style={{ background: "radial-gradient(circle, #ffd1a8 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 bg-white/40 backdrop-blur-2xl border-b border-white/50 shadow-sm shadow-slate-300/20">
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-blue-700 mb-0.5">Cadi</p>
                <h2 className="text-xl font-black text-slate-900 leading-tight">Scheduler</h2>
              </div>
              <div className="h-10 w-px bg-slate-200 mx-1 hidden sm:block" />
              <DateNav view={view} dayOffset={dayOffset} setDayOffset={setDayOffset} />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Find customer…"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
                />
              </div>
              <ViewTabs view={view} setView={setView} setDayOffset={setDayOffset} />
              <button
                onClick={() => setShowNewJob(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm"
              >
                <Plus size={14} /> New job
              </button>
            </div>
          </div>

          <div className="mt-3">
            <StatStrip jobs={headerJobs} />
          </div>
        </div>

        {view === "Day" && (
          <div className="border-t border-white/50 bg-white/30 backdrop-blur">
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
        <div className="max-w-[1600px] mx-auto">
          {view === "Day"     && <DayView     jobs={todayJobs} onJobClick={handleJobClick} typeFilter={typeFilter} crewFilter={crewFilter} />}
          {view === "Week"    && <WeekView    jobs={weekJobsWithDay} onJobClick={handleJobClick} />}
          {view === "Month"   && <MonthView   jobs={allJobs.filter(j => j.status !== 'cancelled')} onJobClick={handleJobClick} viewDate={viewDate} />}
          {view === "Quarter" && <QuarterView jobs={allJobs.filter(j => j.status !== 'cancelled')} />}
        </div>
      </div>

      {/* Job drawer */}
      {activeJob && (
        <JobDrawer
          job={activeJob}
          onClose={() => setActiveJob(null)}
          onUpdateJob={handleUpdateJob}
          onDeleteJob={handleDeleteJob}
        />
      )}

      {/* New job modal */}
      {showNewJob && (
        <NewJobModal
          onClose={() => { setShowNewJob(false); setPreCustomer(""); }}
          onSave={handleSaveJob}
          preCustomer={preCustomer}
          customers={customers}
        />
      )}
    </div>
  );
}
