// src/pages/SchedulerPreview.jsx
// Visual preview of the redesigned Scheduler — Day view.
// Inspired by Cleaner Planner (dense, compact blocks) + Zen Maid (white canvas, per-crew lanes).
// Static mock — no wiring to live data. Used to agree on look before we rewire Scheduler.jsx.

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Filter, Search } from "lucide-react";

// ─── Theme ────────────────────────────────────────────────────────────────────
// Job blocks live on a white canvas. Each type gets a pastel fill + saturated
// left bar + deep text. Never full-bleed colour — that's the old look.
const TYPE = {
  exterior: {
    label: "Exterior",
    bar:   "#F97316",                     // orange-500
    fill:  "#FFF4E6",                     // warm cream
    ink:   "#7C2D12",                     // orange-900
    chip:  "bg-orange-100 text-orange-800 border-orange-200",
    dot:   "bg-orange-500",
  },
  residential: {
    label: "Residential",
    bar:   "#10B981",                     // emerald-500
    fill:  "#ECFDF5",                     // emerald-50
    ink:   "#064E3B",                     // emerald-900
    chip:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    dot:   "bg-emerald-500",
  },
  commercial: {
    label: "Commercial",
    bar:   "#1F48FF",                     // brand-blue
    fill:  "#EEF2FF",                     // indigo-50
    ink:   "#1E3A8A",                     // blue-900
    chip:  "bg-blue-100 text-blue-800 border-blue-200",
    dot:   "bg-blue-600",
  },
};

// ─── Crews ────────────────────────────────────────────────────────────────────
const CREWS = [
  { id: "jamie", name: "Jamie",  role: "exterior",    tint: "#F97316", init: "J" },
  { id: "tom",   name: "Tom",    role: "exterior",    tint: "#EA580C", init: "T" },
  { id: "sarah", name: "Sarah",  role: "residential", tint: "#10B981", init: "S" },
  { id: "mia",   name: "Mia",    role: "residential", tint: "#059669", init: "M" },
  { id: "dave",  name: "Dave",   role: "commercial",  tint: "#1F48FF", init: "D" },
];

// ─── Grid config — 20-min granularity ─────────────────────────────────────────
const DAY_START   = 7;                    // 07:00
const DAY_END     = 18;                   // 18:00
const PX_PER_HR   = 96;                   // 96/hr → 32px per 20-min slot (readable)
const SLOT_MIN    = 20;                   // minimum time block (exterior)

// ─── Demo jobs — 25 exterior + 4 residential + 2 commercial ──────────────────
// Start/dur expressed in decimal hours. 20-min = 0.333, 40-min = 0.667.
const JOBS = [
  // Jamie — exterior window round, tight 20-min sequence (common ext pattern)
  { id:1,  crew:"jamie", type:"exterior",   customer:"Kensington Block A", service:"Windows",         postcode:"W8 4AA",  start:7.00, dur:0.33, price:45, status:"complete" },
  { id:2,  crew:"jamie", type:"exterior",   customer:"Kensington Block B", service:"Windows",         postcode:"W8 4AB",  start:7.33, dur:0.33, price:45, status:"complete" },
  { id:3,  crew:"jamie", type:"exterior",   customer:"Hammond",            service:"Windows",         postcode:"W8 4BD",  start:7.67, dur:0.33, price:25, status:"complete" },
  { id:4,  crew:"jamie", type:"exterior",   customer:"Clifton",            service:"Windows",         postcode:"W8 5AA",  start:8.00, dur:0.33, price:25, status:"complete" },
  { id:5,  crew:"jamie", type:"exterior",   customer:"Elsworth",           service:"Windows",         postcode:"W8 5BB",  start:8.33, dur:0.33, price:30, status:"complete" },
  { id:6,  crew:"jamie", type:"exterior",   customer:"Harrow Court",       service:"Windows + frames",postcode:"W8 5CC",  start:8.67, dur:0.67, price:65, status:"in-progress" },
  { id:7,  crew:"jamie", type:"exterior",   customer:"Phillips",           service:"Windows",         postcode:"W9 1AA",  start:9.33, dur:0.33, price:25, status:"scheduled" },
  { id:8,  crew:"jamie", type:"exterior",   customer:"Nash Apartments",    service:"Windows",         postcode:"W9 1BB",  start:9.67, dur:0.67, price:60, status:"scheduled" },
  { id:9,  crew:"jamie", type:"exterior",   customer:"Dr. Khan",           service:"Windows",         postcode:"W9 2CC",  start:10.33,dur:0.33, price:25, status:"scheduled" },
  { id:10, crew:"jamie", type:"exterior",   customer:"Fletcher",           service:"Gutters",         postcode:"W9 2DD",  start:10.67,dur:1.00, price:95, status:"scheduled" },
  { id:11, crew:"jamie", type:"exterior",   customer:"Bayswater Flats",    service:"Windows",         postcode:"W2 3EE",  start:12.00,dur:0.67, price:75, status:"scheduled" },
  { id:12, crew:"jamie", type:"exterior",   customer:"Rowan House",        service:"Windows + fascia",postcode:"W2 3FF",  start:12.67,dur:1.00, price:110,status:"scheduled" },
  { id:13, crew:"jamie", type:"exterior",   customer:"Marston",            service:"Windows",         postcode:"W2 4GG",  start:14.00,dur:0.33, price:25, status:"scheduled" },
  { id:14, crew:"jamie", type:"exterior",   customer:"Singh",              service:"Windows",         postcode:"W2 4HH",  start:14.33,dur:0.33, price:30, status:"scheduled" },
  { id:15, crew:"jamie", type:"exterior",   customer:"Holloway",           service:"Conservatory",    postcode:"W2 5JJ",  start:14.67,dur:0.67, price:55, status:"scheduled" },

  // Tom — exterior, driveway/softwash heavier jobs
  { id:16, crew:"tom",   type:"exterior",   customer:"Meadow House",       service:"Softwash render", postcode:"SW19 1AA",start:7.33, dur:1.67, price:220,status:"complete" },
  { id:17, crew:"tom",   type:"exterior",   customer:"Barnes",             service:"Driveway wash",   postcode:"SW19 2BB",start:9.00, dur:1.33, price:140,status:"in-progress" },
  { id:18, crew:"tom",   type:"exterior",   customer:"Okafor",             service:"Windows",         postcode:"SW19 3CC",start:10.67,dur:0.33, price:25, status:"scheduled" },
  { id:19, crew:"tom",   type:"exterior",   customer:"Tsang",              service:"Windows",         postcode:"SW19 3DD",start:11.00,dur:0.33, price:25, status:"scheduled" },
  { id:20, crew:"tom",   type:"exterior",   customer:"Laurel Lodge",       service:"Patio clean",     postcode:"SW19 4EE",start:11.33,dur:1.33, price:150,status:"scheduled" },
  { id:21, crew:"tom",   type:"exterior",   customer:"Avery",              service:"Windows",         postcode:"SW19 5FF",start:13.33,dur:0.33, price:25, status:"scheduled" },
  { id:22, crew:"tom",   type:"exterior",   customer:"Cedar Mews",         service:"Gutter clear",    postcode:"SW19 5GG",start:13.67,dur:1.00, price:110,status:"scheduled" },
  { id:23, crew:"tom",   type:"exterior",   customer:"Price",              service:"Windows",         postcode:"SW19 6HH",start:14.67,dur:0.33, price:30, status:"scheduled" },
  { id:24, crew:"tom",   type:"exterior",   customer:"Oakhill",            service:"Windows + frames",postcode:"SW19 6JJ",start:15.00,dur:0.67, price:70, status:"scheduled" },
  { id:25, crew:"tom",   type:"exterior",   customer:"Watts",              service:"Driveway wash",   postcode:"SW19 7KK",start:15.67,dur:1.33, price:160,status:"scheduled" },

  // Sarah — residential, longer deeper jobs
  { id:26, crew:"sarah", type:"residential",customer:"Davies",             service:"Deep clean",      postcode:"SW2 1AA", start:8.00, dur:2.50, price:140,status:"in-progress" },
  { id:27, crew:"sarah", type:"residential",customer:"Wilson",             service:"Regular clean",   postcode:"SW3 2BB", start:11.00,dur:2.00, price:65, status:"scheduled" },
  { id:28, crew:"sarah", type:"residential",customer:"Patel",              service:"End of tenancy",  postcode:"SE5 3CC", start:13.33,dur:3.33, price:280,status:"scheduled" },

  // Mia — residential
  { id:29, crew:"mia",   type:"residential",customer:"Adams",              service:"Deep clean",      postcode:"SW4 1DD", start:9.00, dur:3.00, price:175,status:"complete" },
  { id:30, crew:"mia",   type:"residential",customer:"Miller",             service:"Regular clean",   postcode:"SW8 2EE", start:12.67,dur:2.00, price:70, status:"scheduled" },

  // Dave — commercial
  { id:31, crew:"dave",  type:"commercial", customer:"Greenfield Office",  service:"Weekly office",   postcode:"SW6 3FF", start:7.00, dur:3.00, price:140,status:"complete" },
  { id:32, crew:"dave",  type:"commercial", customer:"Riverside Retail",   service:"Retail clean",    postcode:"SE1 4GG", start:13.00,dur:2.33, price:180,status:"scheduled" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(h) {
  const hr = Math.floor(h);
  const mins = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2,"0")}:${mins.toString().padStart(2,"0")}`;
}

function jobHeight(dur) { return dur * PX_PER_HR; }
function jobTop(start)  { return (start - DAY_START) * PX_PER_HR; }

// ─── Block ────────────────────────────────────────────────────────────────────
function JobBlock({ job }) {
  const t = TYPE[job.type];
  const top = jobTop(job.start);
  const h   = jobHeight(job.dur);
  const isComplete = job.status === "complete";
  const isTight = h < 48;                 // 20-40min → single-line layout

  return (
    <div
      className="absolute left-1 right-1 rounded-lg border border-white/70 shadow-sm shadow-slate-400/10 overflow-hidden group cursor-pointer transition-all hover:shadow-md hover:shadow-slate-400/20 hover:-translate-y-[1px] hover:z-10 backdrop-blur-[2px]"
      style={{
        top,
        height: h - 2,
        background: `linear-gradient(160deg, ${t.fill} 0%, rgba(255,255,255,0.4) 100%)`,
        borderLeft: `3px solid ${t.bar}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(15,23,42,0.06)`,
      }}
    >
      <div
        className="px-2 py-1 h-full flex flex-col justify-between"
        style={{ color: t.ink, opacity: isComplete ? 0.55 : 1 }}
      >
        {isTight ? (
          <div className="flex items-center gap-1.5 text-[11px] leading-tight font-medium min-w-0">
            <span className="tabular-nums shrink-0 opacity-70">{fmtTime(job.start)}</span>
            <span className={`truncate ${isComplete ? "line-through" : ""}`}>{job.customer}</span>
            <span className="ml-auto shrink-0 tabular-nums opacity-60 text-[10px]">{job.postcode}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] leading-tight font-semibold min-w-0">
              <span className="tabular-nums opacity-70">{fmtTime(job.start)}</span>
              <span className={`truncate ${isComplete ? "line-through" : ""}`}>{job.customer}</span>
            </div>
            <div className="flex items-center justify-between text-[10.5px] leading-tight opacity-80">
              <span className="truncate">{job.service}</span>
              <span className="tabular-nums shrink-0 ml-1">{job.postcode}</span>
            </div>
            {h >= 72 && (
              <div className="flex items-center justify-between text-[10px] font-medium">
                <span className="tabular-nums">£{job.price}</span>
                <StatusPill status={job.status} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const cfg = {
    complete:      { label: "Done",   cls: "bg-white/70 text-gray-500" },
    "in-progress": { label: "Now",    cls: "bg-amber-100 text-amber-800" },
    scheduled:     { label: "Booked", cls: "bg-white/80 text-gray-500 border border-gray-200" },
    unassigned:    { label: "Open",   cls: "bg-red-50 text-red-600" },
  }[status];
  return (
    <span className={`px-1.5 py-[1px] rounded text-[9.5px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Hour ruler ───────────────────────────────────────────────────────────────
function HourRuler() {
  const hours = [];
  for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
  return (
    <div className="relative shrink-0 w-14 border-r border-white/60 bg-white/20 backdrop-blur-sm">
      {hours.map((h, i) => (
        <div
          key={h}
          className="absolute left-0 right-0 text-right pr-2 text-[11px] font-medium text-gray-400 tabular-nums"
          style={{ top: i * PX_PER_HR - 6 }}
        >
          {h.toString().padStart(2,"0")}:00
        </div>
      ))}
    </div>
  );
}

// ─── Crew lane ────────────────────────────────────────────────────────────────
function CrewLane({ crew, jobs }) {
  const totalHeight = (DAY_END - DAY_START) * PX_PER_HR;
  // Horizontal grid lines every 20 min (faint) + every hour (darker)
  const slots = [];
  for (let h = DAY_START; h <= DAY_END; h += 1/3) {
    const isHour = Math.abs(h - Math.round(h)) < 0.01;
    slots.push({ top: (h - DAY_START) * PX_PER_HR, isHour });
  }

  return (
    <div className="relative flex-1 min-w-[180px] border-r border-white/60 last:border-r-0">
      {/* Grid lines */}
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
      {/* Jobs */}
      <div className="relative" style={{ height: totalHeight }}>
        {jobs.map((j) => <JobBlock key={j.id} job={j} />)}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SchedulerPreview() {
  const [typeFilter, setTypeFilter] = useState("all");
  const [crewFilter, setCrewFilter] = useState("all");

  const visibleJobs = useMemo(() => {
    return JOBS.filter((j) => {
      if (typeFilter !== "all" && j.type !== typeFilter) return false;
      if (crewFilter !== "all" && j.crew !== crewFilter) return false;
      return true;
    });
  }, [typeFilter, crewFilter]);

  const visibleCrews = useMemo(() => {
    if (crewFilter !== "all") return CREWS.filter((c) => c.id === crewFilter);
    if (typeFilter !== "all") return CREWS.filter((c) => c.role === typeFilter);
    return CREWS;
  }, [typeFilter, crewFilter]);

  // Day totals
  const totals = useMemo(() => {
    const rev   = visibleJobs.reduce((s, j) => s + j.price, 0);
    const done  = visibleJobs.filter((j) => j.status === "complete").length;
    const now   = visibleJobs.filter((j) => j.status === "in-progress").length;
    const open  = visibleJobs.filter((j) => j.status === "scheduled").length;
    return { count: visibleJobs.length, rev, done, now, open };
  }, [visibleJobs]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{
      background: "linear-gradient(135deg, #E7EEFB 0%, #DCE4FA 40%, #E8DEFB 75%, #FBE8DC 100%)"
    }}>
      {/* Ambient gradient orbs — give the backdrop-blur something to blur against */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-0">
        <div className="absolute top-[8%] left-[10%] w-[520px] h-[520px] rounded-full opacity-70"
             style={{ background: "radial-gradient(circle, #99c5ff 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div className="absolute top-[40%] right-[5%] w-[600px] h-[600px] rounded-full opacity-60"
             style={{ background: "radial-gradient(circle, #c7b8ff 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[500px] h-[500px] rounded-full opacity-55"
             style={{ background: "radial-gradient(circle, #ffd1a8 0%, transparent 70%)", filter: "blur(60px)" }} />
        <div className="absolute top-[20%] left-[55%] w-[360px] h-[360px] rounded-full opacity-50"
             style={{ background: "radial-gradient(circle, #a8f0d1 0%, transparent 70%)", filter: "blur(55px)" }} />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white/40 backdrop-blur-2xl border-b border-white/50 shadow-sm shadow-slate-300/20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronLeft size={18} />
              </button>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Today</div>
                <div className="text-lg font-bold text-gray-900 leading-tight">Thursday, 23 April</div>
              </div>
              <button className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                <ChevronRight size={18} />
              </button>
              <button className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700">
                Today
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  placeholder="Find customer…"
                  className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/20 w-48"
                />
              </div>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
                <button className="px-3 py-1.5 bg-gray-900 text-white">Day</button>
                <button className="px-3 py-1.5 text-gray-600 hover:bg-gray-50">Week</button>
                <button className="px-3 py-1.5 text-gray-600 hover:bg-gray-50">Month</button>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue hover:bg-[#1b3fd9] text-white text-xs font-semibold shadow-sm">
                <Plus size={14} /> New job
              </button>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-3 flex items-center gap-4 flex-wrap text-xs">
            <Stat label="Jobs"        value={totals.count} />
            <Stat label="Revenue"     value={`£${totals.rev.toLocaleString()}`} emphasis />
            <Stat label="Done"        value={totals.done} color="text-emerald-600" />
            <Stat label="In progress" value={totals.now}  color="text-amber-600"   />
            <Stat label="Upcoming"    value={totals.open} color="text-gray-600"    />
          </div>
        </div>

        {/* Filter bar */}
        <div className="border-t border-white/50 bg-white/30 backdrop-blur">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <Filter size={12} /> Type
            </div>
            <div className="flex gap-1.5">
              <FilterPill active={typeFilter==="all"}         onClick={() => setTypeFilter("all")}         label="All"         />
              <FilterPill active={typeFilter==="exterior"}    onClick={() => setTypeFilter("exterior")}    label="Exterior"    type="exterior"    />
              <FilterPill active={typeFilter==="residential"} onClick={() => setTypeFilter("residential")} label="Residential" type="residential" />
              <FilterPill active={typeFilter==="commercial"}  onClick={() => setTypeFilter("commercial")}  label="Commercial"  type="commercial"  />
            </div>

            <div className="w-px h-5 bg-gray-200 mx-2" />

            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Crew
            </div>
            <div className="flex gap-1.5">
              <FilterPill active={crewFilter==="all"} onClick={() => setCrewFilter("all")} label="All" />
              {CREWS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCrewFilter(crewFilter === c.id ? "all" : c.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    crewFilter === c.id
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
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
          </div>
        </div>
      </div>

      {/* ── Calendar body ──────────────────────────────────────────────── */}
      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 py-4">
        <div
          className="rounded-2xl border border-white/70 shadow-2xl shadow-slate-400/15 backdrop-blur-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.35) 100%)",
            boxShadow: "0 8px 32px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
          }}
        >
          {/* Crew header row */}
          <div className="flex border-b border-white/60 bg-white/40 backdrop-blur rounded-t-2xl">
            <div className="w-14 shrink-0 border-r border-gray-200 bg-gray-50/50" />
            {visibleCrews.map((c) => {
              const jobCount = visibleJobs.filter((j) => j.crew === c.id).length;
              const rev      = visibleJobs.filter((j) => j.crew === c.id).reduce((s, j) => s + j.price, 0);
              return (
                <div key={c.id} className="flex-1 min-w-[180px] border-r border-gray-200 last:border-r-0 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: c.tint }}
                    >{c.init}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 leading-tight truncate">{c.name}</div>
                      <div className="text-[10.5px] text-gray-500 leading-tight tabular-nums">
                        {jobCount} jobs · £{rev}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="flex">
            <HourRuler />
            {visibleCrews.map((c) => (
              <CrewLane
                key={c.id}
                crew={c}
                jobs={visibleJobs.filter((j) => j.crew === c.id)}
              />
            ))}
          </div>
        </div>

        {/* Legend + note */}
        <div className="mt-4 flex items-center justify-between flex-wrap gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <LegendSwatch type="exterior" />
            <LegendSwatch type="residential" />
            <LegendSwatch type="commercial" />
          </div>
          <div className="text-[11px]">
            20-min minimum block · {JOBS.length} jobs scheduled today · {CREWS.length} crews active
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-gray-900", emphasis }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`font-bold tabular-nums ${emphasis ? "text-base" : "text-sm"} ${color}`}>{value}</span>
      <span className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
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
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
      }`}
    >
      {t && <span className={`w-2 h-2 rounded-full ${t.dot}`} />}
      {label}
    </button>
  );
}

function LegendSwatch({ type }) {
  const t = TYPE[type];
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded"
        style={{ background: t.fill, borderLeft: `3px solid ${t.bar}` }}
      />
      <span>{t.label}</span>
    </div>
  );
}
