// src/pages/RoutePlanner.jsx
// Cadi — Route Planner · glassmorphism redesign
//
// Features:
//   • Drag-to-reorder daily stops with live mileage recalculation
//   • Postcode-based haversine distance estimation (no API required)
//   • HMRC 45p/mile mileage claim with 10,000-mile threshold tracker
//   • "Open in Google Maps" multi-stop directions URL
//   • Save & name routes → auto-logs to mileage log
//   • Day summary: revenue, hours, drive time, claim vs fuel
//   • Saved routes library — load a recurring round in one tap
//   • Mileage log tab — HMRC-compliant record of every journey

import { useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";

// ─── Constants ────────────────────────────────────────────────────────────────
const HMRC_RATE            = 0.45;
const HMRC_RATE_HIGH       = 0.25;
const ANNUAL_MILEAGE_BASE  = 4820; // demo: already logged this year
const HOME_POSTCODE        = "SW12";

// ─── Postcode distance estimation ────────────────────────────────────────────
const POSTCODE_COORDS = {
  "SW1": [51.499,-0.135],"SW2": [51.454,-0.117],"SW3": [51.487,-0.169],
  "SW4": [51.459,-0.141],"SW5": [51.491,-0.189],"SW6": [51.476,-0.200],
  "SW7": [51.496,-0.178],"SW8": [51.476,-0.130],"SW9": [51.464,-0.113],
  "SW10":[51.483,-0.183],"SW11":[51.463,-0.162],"SW12":[51.450,-0.152],
  "SW13":[51.475,-0.244],"SW14":[51.468,-0.265],"SW15":[51.461,-0.222],
  "SW16":[51.417,-0.125],"SW17":[51.428,-0.169],"SW18":[51.454,-0.189],
  "SW19":[51.423,-0.188],"SW20":[51.411,-0.213],
  "SE1": [51.501,-0.090],"SE5": [51.469,-0.088],"SE10":[51.482, 0.009],
  "SE11":[51.492,-0.108],"SE15":[51.471,-0.064],"SE21":[51.441,-0.085],
  "SE22":[51.452,-0.073],"SE23":[51.445,-0.050],
  "W1":  [51.514,-0.143],"W4":  [51.494,-0.261],"W6":  [51.492,-0.222],
  "W8":  [51.501,-0.194],"W14": [51.492,-0.210],
  "EC1": [51.522,-0.100],"EC2": [51.518,-0.089],"EC4": [51.514,-0.103],
  "WC1": [51.521,-0.122],"WC2": [51.513,-0.122],
  "N1":  [51.536,-0.101],"NW1": [51.535,-0.143],"NW3": [51.554,-0.164],
  "NW6": [51.543,-0.191],"NW10":[51.535,-0.237],
  "E1":  [51.515,-0.064],"E2":  [51.527,-0.058],"E14": [51.506,-0.018],
};

function getCoords(postcode) {
  const area = postcode?.trim().toUpperCase().replace(/[0-9 ]/g, "").slice(0, 4) ?? "";
  for (let len = 4; len >= 1; len--) {
    const key = area.slice(0, len);
    if (POSTCODE_COORDS[key]) return POSTCODE_COORDS[key];
  }
  return [51.505, -0.09];
}

function haversineDistance([lat1, lon1], [lat2, lon2]) {
  const R  = 3958.8;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dG = ((lon2 - lon1) * Math.PI) / 180;
  const a  = Math.sin(dL/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dG/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateMiles(from, to) {
  const dist = haversineDistance(getCoords(from), getCoords(to));
  return Math.max(0.5, Math.round(dist * 1.25 * 10) / 10);
}

function buildGoogleMapsUrl(stops, home) {
  const enc = s => encodeURIComponent(s + ", UK");
  const origin = enc(home);
  const dest   = enc(home);
  const wps    = stops.map(s => enc(s.postcode)).join("|");
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${wps}&travelmode=driving`;
}

function calcRouteStats(stops, homePostcode) {
  if (stops.length === 0) return { totalMiles: 0, claimValue: 0, fuelCost: 0, legs: [] };
  const allPosts = [homePostcode, ...stops.map(s => s.postcode), homePostcode];
  const legs = [];
  let totalMiles = 0;
  for (let i = 0; i < allPosts.length - 1; i++) {
    const miles = estimateMiles(allPosts[i], allPosts[i + 1]);
    legs.push({ from: allPosts[i], to: allPosts[i + 1], miles });
    totalMiles += miles;
  }
  totalMiles = Math.round(totalMiles * 10) / 10;
  const at45       = Math.min(totalMiles, Math.max(0, 10000 - ANNUAL_MILEAGE_BASE));
  const at25       = Math.max(0, totalMiles - at45);
  const claimValue = Math.round((at45 * HMRC_RATE + at25 * HMRC_RATE_HIGH) * 100) / 100;
  const fuelCost   = Math.round(totalMiles * 0.195 * 100) / 100;
  return { totalMiles, claimValue, fuelCost, legs };
}

// ─── Demo data ────────────────────────────────────────────────────────────────
const TODAY_STOPS_DEMO = [
  { id:"d1", customer:"Johnson",           postcode:"SW4", service:"Regular clean",       price:60,  durationHrs:2,   type:"residential" },
  { id:"d2", customer:"Greenfield Office", postcode:"SW6", service:"Weekly office clean",  price:120, durationHrs:3,   type:"commercial"  },
  { id:"d3", customer:"Davies",            postcode:"SW2", service:"Deep clean",           price:80,  durationHrs:2.5, type:"residential" },
  { id:"d4", customer:"Harrington",        postcode:"SW9", service:"Gutters & fascias",    price:85,  durationHrs:2,   type:"exterior"    },
  { id:"d5", customer:"Park View Flats",   postcode:"SE1", service:"Common areas",         price:95,  durationHrs:2,   type:"commercial"  },
];

const SAVED_ROUTES_DEMO = [
  {
    id:"r1", name:"Thursday window round", type:"exterior", frequency:"Weekly", lastRun:"2026-03-27",
    stops:[
      { id:"s1", customer:"Kensington Block", postcode:"W8",   service:"Window round",       price:180, durationHrs:3   },
      { id:"s2", customer:"Harrison",          postcode:"SW7",  service:"Window clean",       price:65,  durationHrs:1   },
      { id:"s3", customer:"Park View Flats",   postcode:"SE1",  service:"Commercial windows", price:95,  durationHrs:1.5 },
      { id:"s4", customer:"Battersea Block",   postcode:"SW11", service:"Window round",       price:120, durationHrs:2   },
    ],
  },
  {
    id:"r2", name:"Tuesday residential run", type:"residential", frequency:"Weekly", lastRun:"2026-04-01",
    stops:[
      { id:"s5", customer:"Johnson",    postcode:"SW4",  service:"Regular clean", price:60,  durationHrs:2   },
      { id:"s6", customer:"Davies",     postcode:"SW2",  service:"Deep clean",    price:80,  durationHrs:2.5 },
      { id:"s7", customer:"Pemberton",  postcode:"SW12", service:"Regular clean", price:55,  durationHrs:1.5 },
    ],
  },
];

const MILEAGE_LOG_DEMO = [
  { date:"2026-04-06", route:"Today's route (5 stops)",   miles:18.4, claim:8.28  },
  { date:"2026-04-03", route:"Thursday window round",      miles:22.1, claim:9.95  },
  { date:"2026-04-01", route:"Tuesday residential run",    miles:14.6, claim:6.57  },
  { date:"2026-03-31", route:"Monday residential",         miles:11.2, claim:5.04  },
  { date:"2026-03-27", route:"Thursday window round",      miles:22.1, claim:9.95  },
  { date:"2026-03-25", route:"Wednesday commercial",       miles:16.8, claim:7.56  },
];

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt2   = n  => `£${(+n).toFixed(2)}`;
const fmtMi  = n  => `${(+n).toFixed(1)} mi`;
const fmtDate = s => new Date(s).toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });

// ─── Glass design system ──────────────────────────────────────────────────────
function GCard({ children, className = "" }) {
  return (
    <div className={`relative bg-[rgba(255,255,255,0.04)] border border-[rgba(153,197,255,0.12)] rounded-2xl overflow-hidden ${className}`}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />
      {children}
    </div>
  );
}

const SL = ({ children, className = "" }) =>
  <p className={`text-[10px] font-black tracking-[0.15em] uppercase text-[rgba(153,197,255,0.45)] ${className}`}>{children}</p>;

function GChip({ children, color = "blue" }) {
  const s = {
    blue:   "bg-[#1f48ff]/15 border-[#1f48ff]/30 text-[#99c5ff]",
    green:  "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    amber:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
    red:    "bg-red-500/10 border-red-500/20 text-red-400",
    ghost:  "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)]",
    orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
    navy:   "bg-[#1f48ff]/20 border-[#1f48ff]/40 text-white",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-black border ${s[color]}`}>{children}</span>;
}

function GAlert({ type = "blue", children }) {
  const s = {
    blue:  "bg-[#1f48ff]/08 border-[#1f48ff]/20 text-[#99c5ff]",
    green: "bg-emerald-500/08 border-emerald-500/20 text-emerald-300",
    amber: "bg-amber-500/08 border-amber-500/20 text-amber-300",
    gold:  "bg-yellow-500/08 border-yellow-500/20 text-yellow-200",
  };
  const icons = { blue:"ℹ️", green:"✅", amber:"⚠️", gold:"💡" };
  return (
    <div className={`flex gap-3 p-3.5 rounded-xl border text-xs leading-relaxed ${s[type]}`}>
      <span className="shrink-0 mt-0.5">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// Type colours for dots
const TYPE_DOT = {
  residential: "bg-emerald-500",
  commercial:  "bg-[#1f48ff]",
  exterior:    "bg-amber-500",
};
const TYPE_CHIP = {
  residential: "green",
  commercial:  "blue",
  exterior:    "amber",
};

// ─── Stop List (drag-to-reorder) ──────────────────────────────────────────────
function StopList({ stops, setStops, homePostcode, stats, onAddStop, onRemoveStop }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = (e, idx) => { setDragging(idx); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver  = (e, idx) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(idx); };
  const handleDragEnd   = ()       => { setDragging(null); setDragOver(null); };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragging === null || dragging === idx) return;
    const next = [...stops];
    const [moved] = next.splice(dragging, 1);
    next.splice(idx, 0, moved);
    setStops(next);
    setDragging(null);
    setDragOver(null);
  };

  return (
    <div>
      {/* Home start */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(153,197,255,0.06)] bg-[rgba(153,197,255,0.03)]">
        <div className="w-8 h-8 rounded-full bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center text-sm shrink-0">🏠</div>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Home · {homePostcode}</p>
          <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Start point</p>
        </div>
        <span className="text-[10px] text-[rgba(153,197,255,0.3)]">Depart</span>
      </div>

      {stops.map((stop, idx) => {
        const legMiles    = stats.legs[idx + 1]?.miles ?? 0;
        const isDragTarget = dragOver === idx && dragging !== idx;

        return (
          <div key={stop.id}>
            {/* Leg connector */}
            <div className="flex items-center gap-3 px-4 py-1 border-b border-[rgba(153,197,255,0.04)] bg-[rgba(153,197,255,0.01)]">
              <div className="w-8 flex justify-center shrink-0">
                <div className="w-px h-3 bg-[rgba(153,197,255,0.15)]" />
              </div>
              <span className="text-[10px] text-[rgba(153,197,255,0.3)]">↓</span>
              <span className="text-[10px] text-[rgba(153,197,255,0.4)] font-mono">{fmtMi(legMiles)}</span>
              <span className="text-[10px] text-[rgba(153,197,255,0.25)]">· ~{Math.ceil(legMiles / 20 * 60)} min</span>
            </div>

            {/* Stop row */}
            <div
              draggable
              onDragStart={e => handleDragStart(e, idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={e => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-3 px-4 py-3 border-b border-[rgba(153,197,255,0.06)] cursor-grab active:cursor-grabbing transition-all ${
                dragging === idx
                  ? "opacity-30"
                  : isDragTarget
                  ? "bg-[#1f48ff]/08 border-[#1f48ff]/20"
                  : "hover:bg-[rgba(153,197,255,0.03)]"
              }`}
            >
              {/* Number + drag handle */}
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className="w-7 h-7 rounded-full bg-[rgba(153,197,255,0.1)] border border-[rgba(153,197,255,0.2)] flex items-center justify-center text-xs font-black text-white">{idx + 1}</div>
                <span className="text-[rgba(153,197,255,0.2)] text-xs select-none leading-none">⠿</span>
              </div>

              {/* Stop info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[stop.type] ?? "bg-gray-500"}`} />
                  <p className="text-sm font-black text-white truncate">{stop.customer}</p>
                </div>
                <p className="text-[11px] text-[rgba(153,197,255,0.4)] truncate">
                  {stop.service} · <span className="font-mono">{stop.postcode}</span>
                </p>
              </div>

              {/* Duration + price */}
              <div className="text-right shrink-0">
                <p className="text-sm font-black tabular-nums text-emerald-400">{fmt2(stop.price)}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{stop.durationHrs}hr</p>
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemoveStop(stop.id)}
                className="shrink-0 w-6 h-6 flex items-center justify-center text-[rgba(153,197,255,0.25)] hover:text-red-400 transition-colors text-xs"
              >✕</button>
            </div>
          </div>
        );
      })}

      {/* Return leg connector */}
      {stops.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1 border-b border-[rgba(153,197,255,0.04)] bg-[rgba(153,197,255,0.01)]">
          <div className="w-8 flex justify-center shrink-0">
            <div className="w-px h-3 bg-[rgba(153,197,255,0.15)]" />
          </div>
          <span className="text-[10px] text-[rgba(153,197,255,0.3)]">↓</span>
          <span className="text-[10px] text-[rgba(153,197,255,0.4)] font-mono">{fmtMi(stats.legs[stats.legs.length - 1]?.miles ?? 0)}</span>
          <span className="text-[10px] text-[rgba(153,197,255,0.25)]">· return</span>
        </div>
      )}

      {/* Home end */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(153,197,255,0.06)] bg-[rgba(153,197,255,0.03)]">
        <div className="w-8 h-8 rounded-full bg-[#1f48ff]/20 border border-[#1f48ff]/30 flex items-center justify-center text-sm shrink-0">🏠</div>
        <div className="flex-1">
          <p className="text-sm font-black text-white">Home · {homePostcode}</p>
          <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Return</p>
        </div>
        <span className="text-[10px] text-[rgba(153,197,255,0.3)]">Arrive</span>
      </div>

      {/* Add stop */}
      <div className="px-4 py-3">
        <button
          onClick={onAddStop}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[rgba(153,197,255,0.15)] text-[11px] font-black text-[rgba(153,197,255,0.4)] hover:border-[#1f48ff]/50 hover:text-[#99c5ff] transition-colors rounded-xl"
        >
          + Add stop
        </button>
      </div>

      {stops.length > 1 && (
        <p className="text-[10px] text-[rgba(153,197,255,0.3)] text-center pb-3">
          Drag stops to reorder · distances update automatically
        </p>
      )}
    </div>
  );
}

// ─── Add stop modal ───────────────────────────────────────────────────────────
function AddStopModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ customer:"", postcode:"", service:"", price:"", durationHrs:"2", type:"residential" });
  const set   = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const valid = form.customer && form.postcode && form.service && parseFloat(form.price) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-[rgba(10,15,30,0.95)] border border-[rgba(153,197,255,0.15)] rounded-2xl w-full max-w-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <SL className="mb-0">Add stop</SL>
            <p className="text-sm font-black text-white">New stop</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(153,197,255,0.4)] hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-3.5">
          {[
            { label:"Customer",       key:"customer",    type:"text",   placeholder:"e.g. Mrs Johnson"  },
            { label:"Postcode",       key:"postcode",    type:"text",   placeholder:"e.g. SW4"          },
            { label:"Service",        key:"service",     type:"text",   placeholder:"e.g. Regular clean"},
            { label:"Price (£)",      key:"price",       type:"number", placeholder:"0.00"              },
            { label:"Duration (hrs)", key:"durationHrs", type:"number", placeholder:"2"                 },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <SL className="mb-1.5">{label}</SL>
              <input
                type={type}
                value={form[key]}
                onChange={e => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2.5 text-sm text-white bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl focus:outline-none focus:border-[rgba(153,197,255,0.4)] placeholder-[rgba(153,197,255,0.25)]"
              />
            </div>
          ))}

          <div>
            <SL className="mb-1.5">Job type</SL>
            <div className="grid grid-cols-3 gap-2">
              {["residential","commercial","exterior"].map(t => (
                <button
                  key={t}
                  onClick={() => set("type", t)}
                  className={`py-2 text-xs font-black border rounded-xl transition-colors ${
                    form.type === t
                      ? "bg-[#1f48ff]/20 border-[#1f48ff]/40 text-white"
                      : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.3)]"
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!valid}
            onClick={() => {
              onAdd({ ...form, id:`s${Date.now()}`, price:parseFloat(form.price), durationHrs:parseFloat(form.durationHrs)||2 });
              onClose();
            }}
            className={`w-full py-3 text-xs font-black rounded-xl transition-colors ${
              valid
                ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]"
                : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"
            }`}
          >
            Add to route →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Save route modal ─────────────────────────────────────────────────────────
function SaveRouteModal({ stats, stops, onSave, onClose }) {
  const [name,       setName]       = useState("");
  const [frequency,  setFrequency]  = useState("One-off");
  const [logMileage, setLogMileage] = useState(true);
  const FREQS = ["One-off","Weekly","Fortnightly","Monthly"];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative bg-[rgba(10,15,30,0.95)] border border-[rgba(153,197,255,0.15)] rounded-2xl w-full max-w-md overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <SL className="mb-0">Save route</SL>
            <p className="text-sm font-black text-white">{stops.length} stops · {fmtMi(stats.totalMiles)} · {fmt2(stats.claimValue)} claim</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(153,197,255,0.4)] hover:text-white transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <SL className="mb-1.5">Route name</SL>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Thursday window round"
              className="w-full px-3 py-2.5 text-sm text-white bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl focus:outline-none focus:border-[rgba(153,197,255,0.4)] placeholder-[rgba(153,197,255,0.25)]"
            />
          </div>

          <div>
            <SL className="mb-2">How often do you run this?</SL>
            <div className="flex gap-2 flex-wrap">
              {FREQS.map(f => (
                <button
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={`px-3 py-1.5 text-xs font-black border rounded-xl transition-colors ${
                    frequency === f
                      ? "bg-[#1f48ff]/20 border-[#1f48ff]/40 text-white"
                      : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.3)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Mileage log toggle */}
          <div className={`border rounded-xl overflow-hidden ${logMileage ? "border-[#1f48ff]/25" : "border-[rgba(153,197,255,0.08)]"}`}>
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[rgba(153,197,255,0.02)] transition-colors">
              <input
                type="checkbox"
                checked={logMileage}
                onChange={e => setLogMileage(e.target.checked)}
                className="w-4 h-4 accent-[#1f48ff]"
              />
              <div>
                <p className="text-sm font-black text-white">Log mileage to accounts</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Add {fmtMi(stats.totalMiles)} ({fmt2(stats.claimValue)} HMRC claim) to your mileage log</p>
              </div>
            </label>
            {logMileage && (
              <div className="border-t border-[rgba(153,197,255,0.06)] divide-y divide-[rgba(153,197,255,0.04)]">
                {[
                  ["Mileage logged",    fmtMi(stats.totalMiles),  "text-white"      ],
                  ["HMRC claim (45p/mi)", fmt2(stats.claimValue), "text-emerald-400"],
                  ["SA103 field",        "Motor expenses",         "text-[#99c5ff]"  ],
                ].map(([l, v, c]) => (
                  <div key={l} className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-[rgba(153,197,255,0.4)]">{l}</span>
                    <span className={`font-black ${c}`}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              disabled={!name}
              onClick={() => onSave({ name, frequency, logMileage, stats, stops })}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-colors ${
                name
                  ? "bg-[#1f48ff] text-white hover:bg-[#3a5eff]"
                  : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.25)] cursor-not-allowed"
              }`}
            >
              ✓ Save route
            </button>
            <button
              onClick={onClose}
              className="px-5 py-3 border border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] text-xs font-black rounded-xl hover:border-[rgba(153,197,255,0.25)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Route summary bar ────────────────────────────────────────────────────────
function RouteSummaryBar({ stops, stats }) {
  const totalRevenue = stops.reduce((s, j) => s + (j.price    || 0), 0);
  const totalHours   = stops.reduce((s, j) => s + (j.durationHrs || 0), 0);
  const driveMin     = Math.ceil(stats.totalMiles / 20 * 60);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {[
        { label:"Stops",       val:stops.length,          color:"text-white"       },
        { label:"Revenue",     val:fmt2(totalRevenue),     color:"text-emerald-400" },
        { label:"Total miles", val:fmtMi(stats.totalMiles),color:"text-white"       },
        { label:"Drive time",  val:`~${driveMin} min`,     color:"text-[#99c5ff]"   },
      ].map(({ label, val, color }) => (
        <GCard key={label} className="px-4 py-3">
          <SL className="mb-0.5">{label}</SL>
          <p className={`text-xl font-black tabular-nums ${color}`}>{val}</p>
        </GCard>
      ))}
    </div>
  );
}

// ─── Mileage claim card ───────────────────────────────────────────────────────
function MileageClaimCard({ stats, ytdMileage }) {
  if (stats.totalMiles === 0) return null;

  const pct10k       = Math.min((ytdMileage / 10000) * 100, 100);
  const remaining10k = Math.max(0, 10000 - ytdMileage);
  const taxSaved     = Math.round(stats.claimValue * 0.20 * 100) / 100;
  const benefit      = Math.round((stats.claimValue - stats.fuelCost) * 100) / 100;

  return (
    <GCard>
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)] flex items-center justify-between">
        <SL>HMRC mileage claim</SL>
        <GChip color="blue">45p / mile</GChip>
      </div>

      {/* 3-stat grid */}
      <div className="grid grid-cols-3 divide-x divide-[rgba(153,197,255,0.06)] border-b border-[rgba(153,197,255,0.06)]">
        {[
          { label:"This route",  val:fmtMi(stats.totalMiles), color:"text-white"       },
          { label:"HMRC claim",  val:fmt2(stats.claimValue),   color:"text-emerald-400" },
          { label:"Tax saved",   val:fmt2(taxSaved),           color:"text-[#99c5ff]"   },
        ].map(({ label, val, color }) => (
          <div key={label} className="px-3 py-3 text-center">
            <SL className="mb-1">{label}</SL>
            <p className={`text-base font-black tabular-nums ${color}`}>{val}</p>
          </div>
        ))}
      </div>

      {/* Claim vs fuel comparison */}
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)] grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/08 border border-emerald-500/15 rounded-xl p-3 text-center">
          <p className="text-[10px] font-black text-emerald-400 mb-0.5">HMRC mileage claim</p>
          <p className="text-lg font-black tabular-nums text-emerald-400">{fmt2(stats.claimValue)}</p>
          <p className="text-[10px] text-emerald-400/60">fuel + wear + insurance</p>
        </div>
        <div className="bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-xl p-3 text-center">
          <p className="text-[10px] font-black text-[rgba(153,197,255,0.5)] mb-0.5">Est. fuel only</p>
          <p className="text-lg font-black tabular-nums text-[rgba(153,197,255,0.6)]">{fmt2(stats.fuelCost)}</p>
          <p className="text-[10px] text-[rgba(153,197,255,0.3)]">~19.5p/mile · petrol</p>
        </div>
      </div>

      {benefit > 0 && (
        <p className="text-center text-[11px] text-emerald-400 font-black px-4 py-2 border-b border-[rgba(153,197,255,0.06)]">
          Claiming HMRC rate puts {fmt2(benefit)} more in your pocket
        </p>
      )}

      {/* 10k threshold bar */}
      <div className="px-4 py-3">
        <div className="flex justify-between text-[10px] mb-2">
          <span className="text-[rgba(153,197,255,0.45)]">Annual mileage · 10,000-mile threshold</span>
          <span className="font-black text-white">{ytdMileage.toLocaleString()} / 10,000</span>
        </div>
        <div className="h-1.5 bg-[rgba(153,197,255,0.08)] rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#1f48ff] to-emerald-500 transition-all duration-500"
            style={{ width:`${pct10k}%` }}
          />
        </div>
        <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
          {remaining10k > 0
            ? <><span className="font-black text-white">{remaining10k.toLocaleString()} miles</span> remaining at 45p · drops to 25p after 10,000</>
            : <span className="text-amber-400 font-black">Past 10,000 miles — rate now 25p/mile</span>
          }
        </p>
      </div>
    </GCard>
  );
}

// ─── Day summary card ─────────────────────────────────────────────────────────
function DaySummaryCard({ stops, stats }) {
  if (stops.length === 0) return null;
  const totalRevenue = stops.reduce((s, j) => s + (j.price || 0), 0);
  const totalHours   = stops.reduce((s, j) => s + (j.durationHrs || 0), 0);

  const rows = [
    { label:"Total revenue",      val:fmt2(totalRevenue),                           color:"text-emerald-400" },
    { label:"Working hours",       val:`${totalHours.toFixed(1)} hrs`,               color:"text-white"       },
    { label:"Drive time",          val:`~${Math.ceil(stats.totalMiles/20*60)} min`,  color:"text-[#99c5ff]"   },
    { label:"Mileage claim",       val:fmt2(stats.claimValue),                       color:"text-[#99c5ff]"   },
    { label:"Est. fuel cost",      val:fmt2(stats.fuelCost),                         color:"text-[rgba(153,197,255,0.5)]" },
    { label:"Net mileage benefit", val:fmt2(Math.max(0,stats.claimValue-stats.fuelCost)), color:"text-emerald-400" },
  ];

  return (
    <GCard>
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
        <SL>Day summary</SL>
      </div>
      <div className="divide-y divide-[rgba(153,197,255,0.05)]">
        {rows.map(({ label, val, color }) => (
          <div key={label} className="flex justify-between px-4 py-2.5 text-xs">
            <span className="text-[rgba(153,197,255,0.45)]">{label}</span>
            <span className={`font-black font-mono tabular-nums ${color}`}>{val}</span>
          </div>
        ))}
      </div>
    </GCard>
  );
}

// ─── Saved routes panel ───────────────────────────────────────────────────────
function SavedRoutesPanel({ routes, onLoad }) {
  if (routes.length === 0) return null;

  return (
    <GCard>
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
        <SL className="mb-0">Saved routes</SL>
        <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">Tap to load into today's route</p>
      </div>
      <div className="divide-y divide-[rgba(153,197,255,0.05)]">
        {routes.map(r => {
          const rs = calcRouteStats(r.stops, HOME_POSTCODE);
          const revenue = r.stops.reduce((s, j) => s + (j.price || 0), 0);
          return (
            <button
              key={r.id}
              onClick={() => onLoad(r)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-[rgba(153,197,255,0.03)] text-left transition-colors group"
            >
              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_DOT[r.type] ?? "bg-gray-400"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="text-sm font-black text-white group-hover:text-[#99c5ff] transition-colors">{r.name}</p>
                  <GChip color="ghost">{r.frequency}</GChip>
                </div>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)]">
                  {r.stops.length} stops · {fmtMi(rs.totalMiles)} · last run {fmtDate(r.lastRun)}
                </p>
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {r.stops.slice(0, 4).map(s => (
                    <span key={s.id} className="text-[10px] text-[rgba(153,197,255,0.5)] bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] px-1.5 py-0.5 rounded font-mono">{s.postcode}</span>
                  ))}
                  {r.stops.length > 4 && <span className="text-[10px] text-[rgba(153,197,255,0.3)]">+{r.stops.length - 4}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black tabular-nums text-emerald-400">{fmt2(revenue)}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">{fmt2(rs.claimValue)} claim</p>
              </div>
            </button>
          );
        })}
      </div>
    </GCard>
  );
}

// ─── Mileage log ──────────────────────────────────────────────────────────────
function MileageLogPanel({ log }) {
  const ytdMiles = log.reduce((s, r) => s + r.miles, 0);
  const ytdClaim = log.reduce((s, r) => s + r.claim, 0);

  return (
    <GCard>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
        <SL>Mileage log · 2025/26</SL>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[rgba(153,197,255,0.4)]">{ytdMiles.toFixed(1)} mi ·</span>
          <GChip color="green">{fmt2(ytdClaim)} YTD claim</GChip>
        </div>
      </div>

      {log.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-[rgba(153,197,255,0.3)] text-sm">No mileage logged yet</p>
          <p className="text-[rgba(153,197,255,0.2)] text-xs mt-1">Save a route and tick "log mileage" to record it here</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[rgba(153,197,255,0.04)]">
            {log.map((row, i) => (
              <div key={i} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-[rgba(153,197,255,0.02)] transition-colors">
                <span className="col-span-3 text-[10px] text-[rgba(153,197,255,0.4)] font-mono">{fmtDate(row.date)}</span>
                <span className="col-span-5 text-xs text-white font-black truncate">{row.route}</span>
                <span className="col-span-2 text-right text-[11px] font-mono text-[rgba(153,197,255,0.5)]">{row.miles.toFixed(1)} mi</span>
                <span className="col-span-2 text-right text-[11px] font-mono font-black text-emerald-400">{fmt2(row.claim)}</span>
              </div>
            ))}
          </div>

          {/* YTD footer */}
          <div className="px-4 py-3 border-t border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.02)] flex justify-between text-xs font-black">
            <span className="text-white">YTD total</span>
            <div className="flex gap-6">
              <span className="font-mono text-[rgba(153,197,255,0.6)]">{ytdMiles.toFixed(1)} mi</span>
              <span className="font-mono text-emerald-400">{fmt2(ytdClaim)}</span>
            </div>
          </div>
        </>
      )}
    </GCard>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function RoutePlannerTab({ accountsData, schedulerJobs, onMileageLogged }) {
  const { user } = useAuth();
  const isLive = Boolean(user);

  const [stops,       setStops]       = useState(isLive ? [] : TODAY_STOPS_DEMO);
  const [savedRoutes, setSavedRoutes] = useState(isLive ? [] : SAVED_ROUTES_DEMO);
  const [mileageLog,  setMileageLog]  = useState(isLive ? [] : MILEAGE_LOG_DEMO);
  const [showAddStop, setShowAddStop] = useState(false);
  const [showSave,    setShowSave]    = useState(false);
  const [routeSaved,  setRouteSaved]  = useState(false);
  const [activeTab,   setActiveTab]   = useState("planner");

  const stats         = useMemo(() => calcRouteStats(stops, HOME_POSTCODE), [stops]);
  const ytdMileage    = (isLive ? 0 : ANNUAL_MILEAGE_BASE) + mileageLog.reduce((s, r) => s + r.miles, 0);
  const googleMapsUrl = buildGoogleMapsUrl(stops, HOME_POSTCODE);
  const totalRevenue  = stops.reduce((s, j) => s + (j.price || 0), 0);

  const handleRemoveStop = id  => setStops(prev => prev.filter(s => s.id !== id));
  const handleAddStop    = stop => setStops(prev => [...prev, stop]);
  const handleLoadRoute  = r   => setStops([...r.stops]);

  const handleSaveRoute = ({ name, frequency, logMileage, stats, stops }) => {
    const newRoute = {
      id:       `r${Date.now()}`,
      name, type: stops[0]?.type ?? "residential",
      stops,  frequency,
      lastRun: new Date().toISOString().slice(0, 10),
    };
    setSavedRoutes(prev => [newRoute, ...prev]);

    if (logMileage) {
      const entry = { date:new Date().toISOString().slice(0,10), route:name, miles:stats.totalMiles, claim:stats.claimValue };
      setMileageLog(prev => [entry, ...prev]);
      onMileageLogged?.({ miles:stats.totalMiles, claimValue:stats.claimValue, route:name });
    }

    setShowSave(false);
    setRouteSaved(true);
    setTimeout(() => setRouteSaved(false), 3000);
  };

  const TABS = [
    { id:"planner", label:"Route planner", icon:"🗺️" },
    { id:"log",     label:"Mileage log",   icon:"📋" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <SL className="mb-0.5">Daily route · mileage tracker</SL>
            <h2 className="text-2xl font-black text-white">Route Planner</h2>
            <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">Drag to reorder · HMRC 45p/mile auto-calculated</p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {routeSaved && <GChip color="green">✓ Route saved</GChip>}
            {stops.length > 0 && (
              <>
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-white text-xs font-black rounded-xl hover:border-[rgba(153,197,255,0.35)] transition-colors"
                >
                  🗺️ Open in Maps
                </a>
                <button
                  onClick={() => setShowSave(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#1f48ff] text-white text-xs font-black rounded-xl hover:bg-[#3a5eff] transition-colors"
                >
                  ✓ Save &amp; log mileage
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Pill tabs ──────────────────────────────────────────────────── */}
        <div className="flex gap-1.5 p-1 bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] rounded-2xl w-fit">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                activeTab === id
                  ? "bg-[#1f48ff] text-white shadow-lg"
                  : "text-[rgba(153,197,255,0.5)] hover:text-white"
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ══ ROUTE PLANNER TAB ════════════════════════════════════════════ */}
        {activeTab === "planner" && (
          <>
            {/* Summary stats */}
            {stops.length > 0 && <RouteSummaryBar stops={stops} stats={stats} />}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* LEFT: stop list (2/3) */}
              <div className="lg:col-span-2 space-y-4">

                {schedulerJobs && (
                  <GAlert type="blue">
                    <strong>Today's jobs from scheduler</strong> — route loaded from your schedule. Drag to reorder for the most efficient sequence.
                  </GAlert>
                )}

                <GCard>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(153,197,255,0.06)]">
                    <div>
                      <SL className="mb-0">Today's route</SL>
                      <p className="text-xs font-black text-white mt-0.5">
                        {new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {stops.length > 0 && (
                        <span className="text-[10px] text-[rgba(153,197,255,0.4)] font-black">{fmt2(totalRevenue)} revenue</span>
                      )}
                      {stops.length > 1 && (
                        <button
                          onClick={() => alert("Route optimisation uses Google Maps API in production.")}
                          className="text-[10px] font-black text-[#99c5ff] hover:text-white transition-colors"
                        >
                          ✨ Optimise
                        </button>
                      )}
                    </div>
                  </div>

                  {stops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                      <span className="text-4xl mb-3">🗺️</span>
                      <p className="text-sm font-black text-white mb-1">No stops yet</p>
                      <p className="text-xs text-[rgba(153,197,255,0.4)] mb-4">Add stops manually or load a saved route below.</p>
                      <button
                        onClick={() => setShowAddStop(true)}
                        className="px-5 py-2.5 bg-[#1f48ff] text-white text-xs font-black rounded-xl hover:bg-[#3a5eff] transition-colors"
                      >
                        + Add first stop
                      </button>
                    </div>
                  ) : (
                    <StopList
                      stops={stops}
                      setStops={setStops}
                      homePostcode={HOME_POSTCODE}
                      stats={stats}
                      onAddStop={() => setShowAddStop(true)}
                      onRemoveStop={handleRemoveStop}
                    />
                  )}
                </GCard>

                <SavedRoutesPanel routes={savedRoutes} onLoad={handleLoadRoute} />
              </div>

              {/* RIGHT: mileage + summary (1/3) */}
              <div className="space-y-4">
                <MileageClaimCard stats={stats} ytdMileage={ytdMileage} />

                {/* Open in Maps card */}
                {stops.length > 0 && (
                  <GCard className="p-4">
                    <SL className="mb-2">Navigate</SL>
                    <p className="text-[11px] text-[rgba(153,197,255,0.4)] mb-3 leading-relaxed">
                      Opens Google Maps with all {stops.length} stops in order, starting and ending at home ({HOME_POSTCODE}).
                    </p>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-3 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] text-white text-xs font-black rounded-xl hover:border-[rgba(153,197,255,0.3)] transition-colors"
                    >
                      🗺️ Open route in Google Maps
                    </a>
                  </GCard>
                )}

                <DaySummaryCard stops={stops} stats={stats} />

                <GAlert type="gold">
                  <strong>HMRC tip</strong> — the 45p/mile rate covers fuel, wear, and insurance. You can't also claim actual vehicle costs if you use the mileage rate. Cadi alerts you when you approach the 10,000-mile threshold.
                </GAlert>
              </div>
            </div>
          </>
        )}

        {/* ══ MILEAGE LOG TAB ════════════════════════════════════════════ */}
        {activeTab === "log" && (
          <div className="space-y-4">
            <GAlert type="blue">
              Every saved route logs automatically here. This is your HMRC-compliant mileage record — date, journey, and claim value. Feeds the mileage log in your <strong>Accounts tab</strong>.
            </GAlert>
            <MileageLogPanel log={mileageLog} />
          </div>
        )}

      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAddStop && <AddStopModal onAdd={handleAddStop} onClose={() => setShowAddStop(false)} />}
      {showSave    && <SaveRouteModal stats={stats} stops={stops} onSave={handleSaveRoute} onClose={() => setShowSave(false)} />}
    </div>
  );
}
