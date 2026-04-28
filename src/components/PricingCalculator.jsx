// src/components/PricingCalculator.jsx
// Cadi — Pricing Calculator (rebuilt)
//
// Three purpose-built calculators, each reflecting how that sector is actually priced:
//
//   Residential  — room-by-room builder with qty counters, per-room price override,
//                  AI suggestion chips, clean type multiplier, custom add-on rows
//
//   Commercial   — cost-build calculator: sector/job details, insert-row sections for
//                  man-hours / products / equipment / overheads, margin slider showing
//                  cost → break-even → target → quote price, tax efficiency panel
//
//   Exterior     — property-type preset populates surface toggles, per-surface price
//                  override with AI reference, access difficulty premium, equipment costs
//
// Shared across all three:
//   PhotoCapture     — AI photo analysis, works via file upload on Mac + camera on mobile
//   ProfitWaterfall  — live breakdown: price → VAT → labour/equipment → gross → tax → net
//   AddOnSection     — editable add-on rows: preset quick-add chips + custom blank rows
//   QuoteSummary     — customer name, notes, save, preview, send
//
// No emojis anywhere in the UI.
// Mobile-first: sticky profit bar on small screens, full panel on desktop.
//
// Props:
//   accountsData — live from useAccountsData hook
//   onNavigate   — switch to another tab
//
// Usage:
//   import PricingCalculator from './components/PricingCalculator'
//   <PricingCalculator accountsData={accountsData} />

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../context/DataContext";

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_ACCOUNTS = {
  vatRegistered: false, frsRate: 12, isLimitedCostTrader: false,
  taxRate: 0.20, annualProfit: 0, annualTarget: 0, ytdIncome: 0,
};

// ─── Staff / labour rates ─────────────────────────────────────────────────────
const STAFF = {
  you:           { id: "you",           label: "You",             sub: "Your time — no labour cost",      hourlyRate: 0     },
  staff_junior:  { id: "staff_junior",  label: "Junior staff",    sub: "Part-time, under 1yr",            hourlyRate: 12.50 },
  staff_senior:  { id: "staff_senior",  label: "Senior staff",    sub: "Experienced, quality lead",       hourlyRate: 15.00 },
  subcontractor: { id: "subcontractor", label: "Subcontractor",   sub: "Self-employed, invoices you",     hourlyRate: 18.00 },
};

// ─── Room definitions ─────────────────────────────────────────────────────────
const ROOM_TYPES = [
  { id:"bedroom",      label:"Bedroom",        mins:45, basePrice:12 },
  { id:"bathroom",     label:"Bathroom",       mins:45, basePrice:15 },
  { id:"ensuite",      label:"En-suite",       mins:25, basePrice:10 },
  { id:"kitchen",      label:"Kitchen",         mins:60, basePrice:20 },
  { id:"lounge",       label:"Lounge",          mins:35, basePrice:12 },
  { id:"dining",       label:"Dining room",     mins:20, basePrice:10 },
  { id:"hallway",      label:"Hallway",         mins:15, basePrice:8  },
  { id:"study",        label:"Study / office",  mins:25, basePrice:10 },
  { id:"conservatory", label:"Conservatory",    mins:30, basePrice:14 },
  { id:"utility",      label:"Utility room",    mins:20, basePrice:8  },
];

const ROOM_CONDITIONS = [
  { id:"light",   label:"Light",   addMins:-10, desc:"Recently cleaned" },
  { id:"normal",  label:"Normal",  addMins:0,   desc:"Standard condition" },
  { id:"heavy",   label:"Heavy",   addMins:15,  desc:"Needs extra attention" },
  { id:"severe",  label:"Severe",  addMins:30,  desc:"Heavy soiling" },
];

const CLEAN_TYPES = [
  { id:"regular",  label:"Regular clean",    mult:1.0, desc:"Ongoing maintenance" },
  { id:"deep",     label:"Deep clean",       mult:2.0, desc:"Thorough top-to-bottom" },
  { id:"tenancy",  label:"End of tenancy",   mult:3.0, desc:"Full landlord-standard" },
  { id:"oneoff",   label:"One-off",          mult:1.5, desc:"Single visit, no contract" },
];

// ─── Property sizes for Quick Quote ──────────────────────────────────────────
// Hours are based on UK national average clean times; market ranges reflect
// typical prices charged across the UK (April 2026).
const PROPERTY_SIZES = [
  { id:"1bed",  label:"1 bed",   beds:1, regHrs:1.5,  deepHrs:3.5,  eotHrs:5.0,  oneoffHrs:2.0,  mkMin:30,  mkMax:55  },
  { id:"2bed",  label:"2 bed",   beds:2, regHrs:2.0,  deepHrs:4.5,  eotHrs:7.0,  oneoffHrs:2.5,  mkMin:45,  mkMax:75  },
  { id:"3bed",  label:"3 bed",   beds:3, regHrs:2.75, deepHrs:5.5,  eotHrs:8.5,  oneoffHrs:3.5,  mkMin:60,  mkMax:95  },
  { id:"4bed",  label:"4 bed",   beds:4, regHrs:3.5,  deepHrs:7.0,  eotHrs:11.0, oneoffHrs:4.5,  mkMin:80,  mkMax:130 },
  { id:"5bed",  label:"5 bed+",  beds:5, regHrs:5.0,  deepHrs:10.0, eotHrs:14.0, oneoffHrs:6.0,  mkMin:100, mkMax:165 },
];

const CLEAN_TYPE_HRS = { regular:"regHrs", deep:"deepHrs", tenancy:"eotHrs", oneoff:"oneoffHrs" };

// ─── Residential add-on presets ───────────────────────────────────────────────
const RES_ADDON_PRESETS = [
  { label:"Oven clean",               price:85,  hrs:2.5  },
  { label:"Fridge clean",             price:30,  hrs:0.5  },
  { label:"Ironing (per hour)",       price:20,  hrs:1.0  },
  { label:"Carpet clean (per room)",  price:55,  hrs:0.75 },
  { label:"Upholstery / sofa",        price:75,  hrs:1.0  },
  { label:"Laundry & folding",        price:25,  hrs:0.5  },
  { label:"Internal windows",         price:45,  hrs:0.75 },
  { label:"Garage tidy",              price:60,  hrs:1.5  },
];

// ─── Commercial sector configs ────────────────────────────────────────────────
const COMMERCIAL_SECTORS = [
  { id: "office",     label: "Office",             suggestedRate: 18, suggestedHrs: 4  },
  { id: "retail",     label: "Retail",             suggestedRate: 16, suggestedHrs: 3  },
  { id: "restaurant", label: "Restaurant / café",  suggestedRate: 22, suggestedHrs: 5  },
  { id: "medical",    label: "Medical / clinic",   suggestedRate: 24, suggestedHrs: 4  },
  { id: "gym",        label: "Gym / leisure",      suggestedRate: 18, suggestedHrs: 5  },
  { id: "school",     label: "School / education", suggestedRate: 16, suggestedHrs: 6  },
  { id: "warehouse",  label: "Warehouse",           suggestedRate: 16, suggestedHrs: 8  },
  { id: "hotel",      label: "Hotel",               suggestedRate: 20, suggestedHrs: 6  },
  { id: "carehome",   label: "Care home",           suggestedRate: 22, suggestedHrs: 5  },
];

const COMMERCIAL_JOB_TYPES = [
  { id: "regular",    label: "Regular contract",    multiplier: 1.00 },
  { id: "deep",       label: "Deep clean",          multiplier: 1.40 },
  { id: "postconstruction", label: "Post-construction", multiplier: 1.80 },
  { id: "event",      label: "Event clean",         multiplier: 1.20 },
  { id: "periodic",   label: "Periodic",            multiplier: 1.30 },
];

const COMMERCIAL_FREQUENCIES = [
  { id: "oneoff",      label: "One-off",          multiplier: 1,   unit: null },
  { id: "daily5",      label: "Daily (Mon–Fri)",  multiplier: 260, unit: null },
  { id: "daily7",      label: "Daily (7 days)",   multiplier: 365, unit: null },
  { id: "weekly",      label: "Weekly",           multiplier: 52,  unit: "week" },
  { id: "fortnightly", label: "Fortnightly",      multiplier: 26,  unit: "fortnight" },
  { id: "monthly",     label: "Monthly",          multiplier: 12,  unit: null },
  { id: "custom",      label: "Custom weeks/year", multiplier: 0,  unit: "custom" },
];

// ─── Commercial add-on presets ────────────────────────────────────────────────
const COM_ADDON_PRESETS = [
  { label: "Washroom deep clean",   price: 85,  hrs: 1.5  },
  { label: "Kitchen sanitise",      price: 75,  hrs: 1.25 },
  { label: "Carpet extraction",     price: 55,  hrs: 1.0  },
  { label: "Waste removal",         price: 45,  hrs: 0.5  },
  { label: "Sanitisation / fogging",price: 120, hrs: 1.0  },
  { label: "Internal windows",      price: 60,  hrs: 1.0  },
];

// ─── Exterior property types ──────────────────────────────────────────────────
const PROPERTY_TYPES = [
  {
    id: "flat",       label: "Flat / apartment",
    defaults: { windows_ext: { on:true, size:"medium", condition:"fair" }, windows_int:{on:false}, gutters:{on:false}, fascias:{on:false}, driveway:{on:false}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 1.5,
  },
  {
    id: "terraced",   label: "Terraced house",
    defaults: { windows_ext:{on:true,size:"medium",condition:"fair"}, windows_int:{on:false}, gutters:{on:true,size:"small",condition:"fair"}, fascias:{on:true,size:"small",condition:"fair"}, driveway:{on:false}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 2.5,
  },
  {
    id: "semi",       label: "Semi-detached",
    defaults: { windows_ext:{on:true,size:"medium",condition:"fair"}, windows_int:{on:false}, gutters:{on:true,size:"medium",condition:"fair"}, fascias:{on:true,size:"medium",condition:"fair"}, driveway:{on:true,size:"small",condition:"fair"}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 3.0,
  },
  {
    id: "detached_s", label: "Detached (small)",
    defaults: { windows_ext:{on:true,size:"large",condition:"fair"}, windows_int:{on:false}, gutters:{on:true,size:"medium",condition:"fair"}, fascias:{on:true,size:"medium",condition:"fair"}, driveway:{on:true,size:"medium",condition:"fair"}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:true,size:"small",condition:"fair"}, moss:{on:false} },
    suggestedHrs: 4.0,
  },
  {
    id: "detached_l", label: "Detached (large)",
    defaults: { windows_ext:{on:true,size:"large",condition:"poor"}, windows_int:{on:false}, gutters:{on:true,size:"large",condition:"fair"}, fascias:{on:true,size:"large",condition:"fair"}, driveway:{on:true,size:"large",condition:"fair"}, render:{on:false}, conservatory:{on:true,size:"medium",condition:"fair"}, solar:{on:false}, garage:{on:true,size:"medium",condition:"fair"}, moss:{on:true,size:"medium",condition:"poor"} },
    suggestedHrs: 6.0,
  },
  {
    id: "bungalow",   label: "Bungalow",
    defaults: { windows_ext:{on:true,size:"medium",condition:"fair"}, windows_int:{on:false}, gutters:{on:true,size:"medium",condition:"fair"}, fascias:{on:true,size:"medium",condition:"fair"}, driveway:{on:true,size:"small",condition:"fair"}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 2.5,
  },
  {
    id: "commercial", label: "Commercial unit",
    defaults: { windows_ext:{on:true,size:"large",condition:"fair"}, windows_int:{on:true,size:"large",condition:"fair"}, gutters:{on:true,size:"medium",condition:"fair"}, fascias:{on:true,size:"medium",condition:"fair"}, driveway:{on:false}, render:{on:false}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 4.0,
  },
  {
    id: "block",      label: "Block of flats",
    defaults: { windows_ext:{on:true,size:"large",condition:"fair"}, windows_int:{on:false}, gutters:{on:true,size:"large",condition:"fair"}, fascias:{on:true,size:"large",condition:"fair"}, driveway:{on:false}, render:{on:true,size:"large",condition:"fair"}, conservatory:{on:false}, solar:{on:false}, garage:{on:false}, moss:{on:false} },
    suggestedHrs: 8.0,
  },
];

const SURFACE_DEFS = [
  { id:"windows_ext",  label:"Windows — exterior",    basePrices:{small:45,medium:65,large:95},   baseHrs:{small:1,medium:1.5,large:2.5} },
  { id:"windows_int",  label:"Windows — interior",    basePrices:{small:35,medium:50,large:75},   baseHrs:{small:0.75,medium:1.25,large:2} },
  { id:"gutters",      label:"Gutters & downpipes",    basePrices:{small:55,medium:85,large:130},  baseHrs:{small:1,medium:1.75,large:3} },
  { id:"fascias",      label:"Fascias & soffits",      basePrices:{small:55,medium:80,large:120},  baseHrs:{small:1,medium:1.5,large:2.5} },
  { id:"driveway",     label:"Driveway / patio",       basePrices:{small:80,medium:120,large:180}, baseHrs:{small:1.5,medium:2.5,large:4} },
  { id:"render",       label:"Render / cladding",      basePrices:{small:100,medium:160,large:250},baseHrs:{small:2,medium:3,large:5} },
  { id:"conservatory", label:"Conservatory roof",      basePrices:{small:75,medium:95,large:130},  baseHrs:{small:1.5,medium:2,large:3} },
  { id:"solar",        label:"Solar panels",           basePrices:{small:90,medium:130,large:180}, baseHrs:{small:1.5,medium:2,large:3} },
  { id:"garage",       label:"Garage doors",           basePrices:{small:35,medium:50,large:70},   baseHrs:{small:0.5,medium:0.75,large:1} },
  { id:"moss",         label:"Roof moss treatment",    basePrices:{small:120,medium:180,large:260},baseHrs:{small:2,medium:3,large:5} },
];

const SURFACE_CONDITIONS = [
  { id:"good",  label:"Good",  multiplier:0.85 },
  { id:"fair",  label:"Fair",  multiplier:1.00 },
  { id:"poor",  label:"Poor",  multiplier:1.25 },
];

const ACCESS_LEVELS = [
  { id:"ground",    label:"Ground level",             premium: 0   },
  { id:"ladder",    label:"Single ladder",            premium: 10  },
  { id:"double",    label:"Double ladder / scaffold", premium: 30  },
  { id:"highreach", label:"High-reach / MEWP",        premium: 80  },
];

const EXTERIOR_EQUIPMENT = [
  { id:"wfp",    label:"Water-fed pole",    costPerDay: 15 },
  { id:"pw",     label:"Pressure washer",   costPerDay: 25 },
  { id:"doff",   label:"DOFF system",       costPerDay: 60 },
  { id:"cherry", label:"Cherry picker / MEWP", costPerDay: 180 },
];

// ─── Exterior add-on presets ──────────────────────────────────────────────────
const EXT_ADDON_PRESETS = [
  { label: "Moss inhibitor treatment", price: 45,  hrs: 0.5  },
  { label: "Graffiti removal",         price: 120, hrs: 2.0  },
  { label: "Pathway jet wash",         price: 60,  hrs: 1.0  },
  { label: "External lighting clean",  price: 35,  hrs: 0.5  },
  { label: "Sign cleaning",            price: 40,  hrs: 0.5  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt2 = n => `£${Math.abs(+n).toFixed(2)}`;
const fmt  = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const pct  = n => `${Math.round(+n)}%`;
let _uid   = 0;
const uid  = () => ++_uid;

// ─── Core profit calculation ───────────────────────────────────────────────────
function calcProfit({ price, hrs, staffId, extraCosts = 0, accounts }) {
  const { vatRegistered, frsRate = 12, taxRate = 0.20 } = accounts;
  const staff       = STAFF[staffId] ?? STAFF.you;
  const labourCost  = staff.hourlyRate * hrs;
  const totalCosts  = labourCost + extraCosts;
  const vatCharged  = vatRegistered ? price * 0.20 : 0;
  const clientPays  = price + vatCharged;
  const vatToHMRC   = vatRegistered ? clientPays * (frsRate / 100) : 0;
  const grossProfit = price - totalCosts - vatToHMRC;
  const incomeTax   = Math.max(0, grossProfit * taxRate);
  const class4NI    = Math.max(0, grossProfit * 0.09);
  const netProfit   = grossProfit - incomeTax - class4NI;
  const margin      = price > 0 ? (netProfit / price) * 100 : 0;
  return { price, hrs, labourCost, totalCosts, vatCharged, clientPays, vatToHMRC, grossProfit, incomeTax, class4NI, netProfit, margin, staffLabel: staff.label };
}

// Price needed to hit a target margin
function priceForMargin({ targetMarginPct, hrs, staffId, extraCosts = 0, accounts }) {
  const { vatRegistered, frsRate = 12, taxRate = 0.20 } = accounts;
  const staff      = STAFF[staffId] ?? STAFF.you;
  const labour     = staff.hourlyRate * hrs + extraCosts;
  const taxNi      = taxRate + 0.09;
  const vatFactor  = vatRegistered ? (frsRate / 100) : 0;
  // price * (1 - vatFactor) - labour = price * (1 - targetMarginPct/100) * (1 - taxNi)
  // Solve for price (simplified — iterate 3 steps)
  let p = labour / Math.max(1 - targetMarginPct / 100, 0.01);
  for (let i = 0; i < 5; i++) {
    const calc = calcProfit({ price: p, hrs, staffId, extraCosts, accounts });
    const diff = (targetMarginPct / 100) * p - calc.netProfit;
    p += diff * 0.8;
  }
  return Math.max(0, Math.round(p));
}

// ─── AI photo analysis ─────────────────────────────────────────────────────────
// AI photo analysis — disabled until API key is configured server-side
// To enable: deploy an edge function that proxies to Anthropic API with the key
async function analysePhoto(/* base64, mediaType, mode */) {
  throw new Error("AI photo analysis coming soon — this feature is not yet available.");
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) =>
  <div className={`bg-white border border-gray-200 rounded-sm ${className}`}>{children}</div>;

const SL = ({ children, className = "" }) =>
  <p className={`text-xs font-bold tracking-widest uppercase text-gray-400 ${className}`}>{children}</p>;

function Chip({ children, color = "blue" }) {
  const s = {
    blue:   "bg-blue-50 text-brand-blue border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn:   "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    navy:   "bg-brand-navy text-white border-brand-navy",
    sky:    "bg-brand-skyblue/20 text-brand-navy border-brand-skyblue",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${s[color]}`}>{children}</span>;
}

function Alert({ type = "blue", children }) {
  const s = { warn:"bg-amber-50 border-amber-200 text-amber-800", green:"bg-emerald-50 border-emerald-200 text-emerald-800", blue:"bg-blue-50 border-blue-200 text-blue-800", gold:"bg-yellow-50 border-yellow-200 text-yellow-800" };
  const icons = { warn:"⚠️", green:"✅", blue:"ℹ️", gold:"💡" };
  return <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-sm ${s[type]}`}><span className="shrink-0 mt-0.5">{icons[type]}</span><div>{children}</div></div>;
}

// Pill selector (horizontal scroll on mobile)
function PillRow({ options, value, onChange, getLabel = o => o.label, getValue = o => o.id }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
      {options.map(opt => {
        const v = getValue(opt);
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold border rounded-sm transition-colors ${
              active ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
            }`}
          >
            {getLabel(opt)}
          </button>
        );
      })}
    </div>
  );
}

// ─── Photo capture (works on Mac via file upload, camera on mobile) ─────────────
function PhotoCapture({ mode, onResult }) {
  const [status,  setStatus]  = useState("idle");
  const [preview, setPreview] = useState(null);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const ref = useRef(null);

  const isMobile = typeof window !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);

  const handle = useCallback(async (file) => {
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStatus("analysing"); setError(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const res = await analysePhoto(e.target.result.split(",")[1], file.type, mode);
        setResult(res); setStatus("done"); onResult?.(res);
      } catch { setError("Couldn't analyse the photo. Try again or upload a clearer image."); setStatus("error"); }
    };
    reader.readAsDataURL(file);
  }, [mode, onResult]);

  const clear = () => { setPreview(null); setResult(null); setStatus("idle"); setError(null); if (ref.current) ref.current.value = ""; };

  const confColor = r => r?.confidence === "high" ? "green" : r?.confidence === "medium" ? "warn" : "gray";
  const confLabel = r => r?.confidence === "high" ? "High confidence" : r?.confidence === "medium" ? "Medium confidence" : "Low confidence";

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <SL>AI photo pricing</SL>
        <Chip color="sky">Anthropic Claude</Chip>
      </div>
      <div className="p-4 space-y-3">
        {!preview ? (
          <div
            onClick={() => ref.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-brand-blue rounded-sm cursor-pointer transition-colors"
          >
            <div className="flex flex-col items-center py-6 px-4 text-center">
              <p className="text-sm font-semibold text-gray-700 mb-1">
                {isMobile ? "Photograph the job for AI pricing" : "Upload a photo for AI pricing"}
              </p>
              <p className="text-xs text-gray-400 mb-4">AI analyses the space and suggests a price range</p>
              <div className="flex gap-2">
                {isMobile && (
                  <span className="px-4 py-2 bg-brand-navy text-white text-xs font-bold rounded-sm">Take photo</span>
                )}
                <span className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-sm">Upload photo</span>
              </div>
            </div>
            {/* Accept all images — camera on mobile, file picker on desktop */}
            <input
              ref={ref}
              type="file"
              accept="image/*"
              {...(isMobile ? { capture: "environment" } : {})}
              className="hidden"
              onChange={e => handle(e.target.files?.[0])}
            />
          </div>
        ) : (
          <div className="relative">
            <img src={preview} alt="Job" className="w-full max-h-48 object-cover rounded-sm" />
            <button onClick={clear} className="absolute top-2 right-2 w-6 h-6 bg-white border border-gray-200 rounded-sm text-xs text-gray-500 hover:text-red-500 flex items-center justify-center">✕</button>
          </div>
        )}

        {status === "analysing" && (
          <div className="flex items-center gap-3 p-3 bg-brand-navy/5 border border-brand-navy/10 rounded-sm">
            <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin shrink-0" />
            <p className="text-xs text-brand-navy font-semibold">Analysing photo…</p>
          </div>
        )}

        {error && <Alert type="warn">{error}</Alert>}

        {result && status === "done" && (
          <div className="border border-brand-blue/20 bg-blue-50/30 rounded-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-brand-navy text-white">
              <p className="text-xs font-bold uppercase tracking-widest">AI Suggestion</p>
              <Chip color={confColor(result)}>{confLabel(result)}</Chip>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-gray-100 rounded-sm p-3">
                  <SL className="mb-1">Property / size</SL>
                  <p className="text-sm font-semibold text-brand-navy">{result.propertyType}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{result.estimatedSize}</p>
                </div>
                <div className="bg-white border border-gray-100 rounded-sm p-3">
                  <SL className="mb-1">Condition</SL>
                  <p className={`text-sm font-semibold ${
                    result.complexity === "light"  ? "text-emerald-600" :
                    result.complexity === "normal" ? "text-brand-blue" :
                    result.complexity === "heavy"  ? "text-amber-600" : "text-red-600"
                  }`}>{result.complexity?.charAt(0).toUpperCase() + result.complexity?.slice(1)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{result.complexityReason}</p>
                </div>
              </div>
              <div className="bg-white border border-brand-blue/20 rounded-sm p-3">
                <SL className="mb-1">Suggested price</SL>
                <div className="flex items-baseline gap-3">
                  <p className="text-2xl font-bold tabular-nums text-brand-navy">{fmt(result.suggestedPrice)}</p>
                  <p className="text-xs text-gray-400">{fmt(result.priceRangeMin)} – {fmt(result.priceRangeMax)} range</p>
                </div>
                <p className="text-xs text-gray-400 mt-1">Est. {result.estimatedHours} hours</p>
              </div>
              {result.observations?.length > 0 && (
                <div className="space-y-1">
                  {result.observations.map((o, i) => (
                    <p key={i} className="text-xs text-gray-600 flex gap-1.5"><span className="text-brand-blue shrink-0 font-bold">→</span>{o}</p>
                  ))}
                </div>
              )}
              <button onClick={onResult ? () => onResult(result) : undefined} className="w-full py-2 bg-brand-navy text-white text-xs font-bold uppercase tracking-wide hover:bg-brand-blue transition-colors rounded-sm">
                Apply AI prices to quote
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Profit waterfall ─────────────────────────────────────────────────────────
function ProfitWaterfall({ price, hrs, staffId, extraCosts = 0, accounts, targetMargin, onTargetMarginChange, onPriceChange }) {
  if (!price || price <= 0) return null;
  const p  = calcProfit({ price, hrs, staffId, extraCosts, accounts });
  const mc = p.margin >= 40 ? "text-emerald-600" : p.margin >= 20 ? "text-amber-600" : "text-red-500";
  const mb = p.margin >= 40 ? "bg-emerald-500" : p.margin >= 20 ? "bg-amber-400" : "bg-red-400";

  const rows = [
    { label: "Quote price",       val: fmt2(p.price),       color: "bg-brand-blue",   textC: "text-brand-navy"  },
    { label: "Client pays",       val: fmt2(p.clientPays),  color: "bg-brand-blue",   textC: "text-brand-navy", indent: false },
    ...(accounts.vatRegistered ? [
      { label: "VAT charged",     val: fmt2(p.vatCharged),  color: "bg-gray-200",     textC: "text-gray-500", indent:true  },
      { label: "VAT to HMRC",     val:`-${fmt2(p.vatToHMRC)}`, color:"bg-red-300",   textC: "text-red-600", indent:true  },
    ] : []),
    ...(p.labourCost > 0 ? [
      { label: `Labour (${p.staffLabel})`, val:`-${fmt2(p.labourCost)}`, color:"bg-amber-300", textC:"text-amber-700", indent:true },
    ] : []),
    ...(extraCosts > 0 ? [
      { label: "Equipment / other", val:`-${fmt2(extraCosts)}`, color:"bg-amber-300", textC:"text-amber-700", indent:true },
    ] : []),
    { label: "Gross profit",      val: fmt2(p.grossProfit), color: p.grossProfit>=0?"bg-emerald-400":"bg-red-400", textC: p.grossProfit>=0?"text-emerald-700":"text-red-600" },
    { label: `Income tax (~${pct(accounts.taxRate*100)})`, val:`-${fmt2(p.incomeTax)}`, color:"bg-red-300", textC:"text-red-500", indent:true },
    { label: "Class 4 NI (~9%)",  val:`-${fmt2(p.class4NI)}`, color:"bg-red-300",   textC: "text-red-500", indent:true },
    { label: "Net profit",        val: fmt2(p.netProfit),   color: mb,               textC: mc, bold:true },
  ];

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 bg-brand-navy text-white flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest">Profit breakdown</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold tabular-nums ${mc.replace("text-","text-")}`} style={{color: p.margin>=40?"#10b981":p.margin>=20?"#d97706":"#ef4444"}}>
            {pct(p.margin)} margin
          </span>
          <Chip color={p.margin>=40?"green":p.margin>=20?"warn":"red"}>{p.margin>=40?"Strong":p.margin>=20?"OK":"Low"}</Chip>
        </div>
      </div>

      {/* Margin bar */}
      <div className="h-2 bg-gray-100">
        <div className={`h-full ${mb} transition-all duration-500`} style={{ width:`${Math.min(Math.max(p.margin,0),100)}%` }} />
      </div>

      {/* Margin slider */}
      {onTargetMarginChange && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-500 font-semibold">Target margin</label>
            <span className="text-sm font-bold tabular-nums text-brand-navy">{targetMargin}%</span>
          </div>
          <input
            type="range" min={5} max={80} step={1}
            value={targetMargin}
            onChange={e => {
              const m = +e.target.value;
              onTargetMarginChange(m);
              onPriceChange?.(priceForMargin({ targetMarginPct: m, hrs, staffId, extraCosts, accounts }));
            }}
            className="w-full accent-brand-blue"
          />
          <p className="text-xs text-gray-400">Drag to set target → quote price adjusts automatically</p>
        </div>
      )}

      {/* Waterfall rows */}
      <div className="divide-y divide-gray-100">
        {rows.map(({ label, val, color, textC, indent, bold }) => (
          <div key={label} className={`flex items-center gap-3 px-4 py-2.5 ${indent?"pl-8":""} ${bold?"bg-gray-50":""}`}>
            <span className={`text-xs flex-1 ${bold?"font-semibold text-gray-800":"text-gray-500"}`}>{label}</span>
            <div className="flex-1 h-2.5 bg-gray-100 rounded-sm overflow-hidden hidden sm:block">
              <div className={`h-full ${color} rounded-sm`} style={{ width:`${Math.min(Math.abs(p.price>0?parseFloat(val.replace(/[^0-9.]/g,""))/p.price*100:0),100)}%` }} />
            </div>
            <span className={`text-xs font-mono w-20 text-right shrink-0 ${bold?"text-sm font-bold":""} ${textC}`}>{val}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Add-on section (shared, editable rows) ────────────────────────────────────
function AddOnSection({ addons, setAddons, presets, label = "Add-ons" }) {
  const total    = addons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const totalHrs = addons.reduce((s, a) => s + (parseFloat(a.hrs)   || 0), 0);

  const addPreset = (preset) => {
    if (addons.find(a => a.label === preset.label)) return; // no dupe
    setAddons(prev => [...prev, { id: uid(), label: preset.label, price: preset.price, hrs: preset.hrs, custom: false }]);
  };

  const addCustom = () => {
    setAddons(prev => [...prev, { id: uid(), label: "", price: "", hrs: "", custom: true }]);
  };

  const remove = (id) => setAddons(prev => prev.filter(a => a.id !== id));

  const update = (id, field, val) =>
    setAddons(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));

  const activePresets = new Set(addons.map(a => a.label));

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <SL className="mb-0">{label}</SL>
          {addons.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{addons.length} added · {fmt(total)} · {totalHrs.toFixed(1)}hrs</p>
          )}
        </div>
        <button onClick={addCustom} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-brand-blue bg-blue-50 border border-blue-200 rounded-sm hover:bg-blue-100 transition-colors">
          + Custom row
        </button>
      </div>

      {/* Preset chips */}
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-xs text-gray-400 mb-2">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => {
            const active = activePresets.has(p.label);
            return (
              <button
                key={p.label}
                onClick={() => active ? remove(addons.find(a=>a.label===p.label)?.id) : addPreset(p)}
                className={`px-2.5 py-1 text-xs font-semibold border rounded-sm transition-colors ${
                  active
                    ? "bg-brand-navy text-white border-brand-navy"
                    : "bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
                }`}
              >
                {active ? "✓ " : "+ "}{p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active add-on rows */}
      {addons.length > 0 ? (
        <>
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold tracking-widest uppercase text-gray-400">
            <span className="col-span-5">Service</span>
            <span className="col-span-3 text-right">Price (£)</span>
            <span className="col-span-2 text-right">Hrs</span>
            <span className="col-span-2" />
          </div>
          <div className="divide-y divide-gray-100">
            {addons.map(a => (
              <div key={a.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center">
                {a.custom ? (
                  <input
                    value={a.label}
                    onChange={e => update(a.id, "label", e.target.value)}
                    placeholder="Service name"
                    className="col-span-5 border border-gray-200 rounded-sm px-2 py-1.5 text-sm focus:outline-none focus:border-brand-blue"
                  />
                ) : (
                  <span className="col-span-5 text-sm text-gray-800">{a.label}</span>
                )}
                <input
                  type="number" min="0" step="1"
                  value={a.price}
                  onChange={e => update(a.id, "price", e.target.value)}
                  className="col-span-3 border border-gray-200 rounded-sm px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:border-brand-blue"
                />
                <input
                  type="number" min="0" step="0.25"
                  value={a.hrs}
                  onChange={e => update(a.id, "hrs", e.target.value)}
                  className="col-span-2 border border-gray-200 rounded-sm px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:border-brand-blue"
                />
                <button onClick={() => remove(a.id)} className="col-span-1 flex justify-end text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
              </div>
            ))}
          </div>
          {/* Add-ons subtotal */}
          <div className="flex justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-sm font-semibold">
            <span className="text-gray-600">Add-ons total</span>
            <span className="font-mono text-brand-navy">{fmt2(total)}</span>
          </div>
        </>
      ) : (
        <div className="px-4 py-4 text-xs text-gray-400 text-center">
          No add-ons yet — tap a quick-add chip above or add a custom row
        </div>
      )}
    </Card>
  );
}

// ─── Who's cleaning selector ───────────────────────────────────────────────────
function StaffSelector({ staffId, setStaffId }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><SL>Who's cleaning</SL></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
        {Object.values(STAFF).map(s => (
          <button
            key={s.id}
            onClick={() => setStaffId(s.id)}
            className={`p-3 text-left transition-colors ${staffId === s.id ? "bg-brand-navy text-white" : "bg-white hover:bg-gray-50"}`}
          >
            <p className={`text-sm font-bold ${staffId === s.id ? "text-white" : "text-gray-800"}`}>{s.label}</p>
            <p className={`text-xs mt-0.5 ${staffId === s.id ? "text-brand-skyblue" : "text-gray-400"}`}>
              {s.hourlyRate > 0 ? `£${s.hourlyRate.toFixed(2)}/hr` : "No cost to you"}
            </p>
            <p className={`text-xs mt-0.5 ${staffId === s.id ? "text-brand-skyblue/70" : "text-gray-400"}`}>{s.sub}</p>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Saved quotes list with accept/reject actions ─────────────────────────────
function SavedQuotesList({ quotes, onAccept }) {
  const [busyId, setBusyId] = useState(null);
  if (!quotes || quotes.length === 0) return null;

  const handleAccept = async (q) => {
    if (!onAccept || busyId) return;
    setBusyId(q.id || q.savedAt);
    try { await onAccept(q); } finally { setBusyId(null); }
  };

  return (
    <GCard>
      <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
        <p className="text-sm font-black text-white">Saved quotes</p>
        <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5">Drafts don't count as income. Mark one accepted to log it to your accounts.</p>
      </div>
      <div className="divide-y divide-[rgba(153,197,255,0.06)]">
        {quotes.slice(0, 8).map((q) => {
          const isAccepted = q.status === 'accepted' || q.status === 'paid';
          const rowKey = q.id || q.savedAt;
          const busy = busyId === rowKey;
          return (
            <div key={rowKey} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{q.customer}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] truncate">
                  {q.savedAt ? new Date(q.savedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Draft"}
                  {q.type ? ` · ${q.type}` : ""}
                </p>
              </div>
              <p className="text-sm font-black text-emerald-400 tabular-nums shrink-0">{fmt2(q.price)}</p>
              {isAccepted ? (
                <span className="shrink-0 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-1">ACCEPTED</span>
              ) : onAccept ? (
                <button
                  onClick={() => handleAccept(q)}
                  disabled={busy}
                  className="shrink-0 text-[10px] font-bold text-white bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-50 rounded-full px-3 py-1.5 transition-all">
                  {busy ? "…" : "Mark accepted"}
                </button>
              ) : (
                <span className="shrink-0 text-[10px] font-black text-[rgba(153,197,255,0.5)] bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.1)] rounded-full px-2 py-1">DRAFT</span>
              )}
            </div>
          );
        })}
      </div>
    </GCard>
  );
}

// ─── Quote summary + save ─────────────────────────────────────────────────────
function QuoteSummary({ totalPrice, totalHrs, type, onSave, customers = [] }) {
  const [customer, setCustomer] = useState("");
  const [notes,    setNotes]    = useState("");
  const [status,   setStatus]   = useState("idle"); // idle | saving | saved | error
  const [showSuggestions, setShowSuggestions] = useState(false);

  const custMatches = customer.length > 1
    ? customers.filter(c => c.name?.toLowerCase().includes(customer.toLowerCase())).slice(0, 5)
    : [];

  const handle = async () => {
    setStatus("saving");
    try {
      await onSave?.({ customer, notes, price: totalPrice, hrs: totalHrs, type, savedAt: new Date().toISOString() });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 5000);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><SL>Quote details</SL></div>
      <div className="p-4 space-y-3">
        <div className="relative">
          <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Customer name</label>
          <input type="text" value={customer}
            onChange={e => { setCustomer(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="e.g. Mrs Johnson"
            className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
          {showSuggestions && custMatches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {custMatches.map(c => (
                <button key={c.id} type="button"
                  onMouseDown={() => { setCustomer(c.name); setShowSuggestions(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-blue/5 transition-colors">
                  <span className="font-semibold text-gray-800">{c.name}</span>
                  {c.postcode && <span className="text-gray-400 ml-2">{c.postcode}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Notes / access details</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Key safe code, parking, any special instructions…"
            className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-brand-blue resize-none" />
        </div>
        {totalPrice > 0 && (
          <div className="bg-brand-navy/5 border border-brand-navy/10 rounded-sm p-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Quote total</span>
              <span className="font-bold text-brand-navy text-lg tabular-nums">{fmt2(totalPrice)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>Estimated {totalHrs.toFixed(1)} hours</span>
              <span>{fmt2(totalPrice / Math.max(totalHrs, 0.5))}/hr effective rate</span>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-sm">
            <span className="text-red-500 text-sm">!</span>
            <p className="text-xs text-red-600 font-semibold">Quote couldn't be saved. Check your connection and try again.</p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={handle}
            disabled={!customer || totalPrice <= 0 || status === "saving"}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide rounded-sm transition-colors ${
              status === "saved" ? "bg-emerald-600 text-white" :
              status === "error" ? "bg-red-600 text-white hover:bg-red-700" :
              customer && totalPrice > 0 && status !== "saving" ? "bg-brand-navy text-white hover:bg-brand-blue" :
              "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
          >
            {status === "saving" ? "Saving..." : status === "saved" ? "✓ Quote saved" : status === "error" ? "Retry save" : "Save quote →"}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ─── TAB: Residential ─────────────────────────────────────────────────────────
//
// Two modes work together:
//
//   Quick Quote — pick property size + clean type → price in one tap.
//                 Derived from: hours × hourlyRate.
//                 Shows UK market benchmark so user knows where they stand.
//
//   Room builder — build room-by-room for precise quotes.
//                  Formula: (roomMins × cleanTypeMultiplier / 60) × hourlyRate
//                  Condition adjusts time (not price directly).

function ResidentialTab({ accounts, userHourlyRate, onSaveQuote, onAcceptQuote, customers = [], initialQuotes = [] }) {
  const defaultRate  = userHourlyRate ?? accounts.staffHourlyRate ?? 20;
  const rateFromSync = !!(userHourlyRate ?? accounts.staffHourlyRate);

  const [hourlyRate,   setHourlyRate]   = useState(defaultRate);
  const [rateInput,    setRateInput]    = useState(String(defaultRate));
  const [cleanType,    setCleanType]    = useState("regular");
  const [propSize,     setPropSize]     = useState("2bed");
  const [mode,         setMode]         = useState("quick");
  const [rooms,        setRooms]        = useState([]);
  const [addons,       setAddons]       = useState([]);
  const [staffId,      setStaffId]      = useState("you");
  const [targetMargin, setTargetMargin] = useState(45);
  const [savedQuotes,  setSavedQuotes]  = useState(initialQuotes);

  useEffect(() => {
    const newRate = userHourlyRate ?? accounts.staffHourlyRate;
    if (newRate) { setHourlyRate(newRate); setRateInput(String(newRate)); }
  }, [userHourlyRate, accounts.staffHourlyRate]);

  const cleanTypeObj = CLEAN_TYPES.find(c => c.id === cleanType) ?? CLEAN_TYPES[0];
  const propSizeObj  = PROPERTY_SIZES.find(p => p.id === propSize) ?? PROPERTY_SIZES[1];
  const hrsKey       = CLEAN_TYPE_HRS[cleanType] ?? "regHrs";

  // Quick quote
  const quickHrs      = propSizeObj[hrsKey];
  const quickPrice    = Math.round(quickHrs * hourlyRate);
  const addonTotal    = addons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const addonHrs      = addons.reduce((s, a) => s + (parseFloat(a.hrs)   || 0), 0);
  const quickTotalHrs = quickHrs + addonHrs;

  const mktMid    = Math.round((propSizeObj.mkMin + propSizeObj.mkMax) / 2);
  const mktDiff   = quickPrice - mktMid;
  const mktStatus = mktDiff > propSizeObj.mkMax * 0.15
    ? { label: "Above market — great if clients love you", color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20"  }
    : mktDiff < -(propSizeObj.mkMax * 0.15)
    ? { label: "Below market — consider raising your rate", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20"      }
    : { label: "In line with UK market rates",             color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };

  // Room builder
  const roomPrice = useCallback((roomId, condId, qty = 1) => {
    const def  = ROOM_TYPES.find(r => r.id === roomId);
    const cond = ROOM_CONDITIONS.find(c => c.id === condId);
    if (!def || !cond) return 0;
    return Math.round(((def.mins + cond.addMins) * cleanTypeObj.mult / 60) * hourlyRate) * qty;
  }, [hourlyRate, cleanTypeObj]);

  const roomHrs = useCallback((roomId, condId, qty = 1) => {
    const def  = ROOM_TYPES.find(r => r.id === roomId);
    const cond = ROOM_CONDITIONS.find(c => c.id === condId);
    if (!def || !cond) return 0;
    return ((def.mins + cond.addMins) * cleanTypeObj.mult / 60) * qty;
  }, [cleanTypeObj]);

  const addRoom = (roomId) => {
    const existing = rooms.find(r => r.roomId === roomId);
    if (existing) {
      setRooms(prev => prev.map(r => r.roomId === roomId ? { ...r, qty: r.qty + 1 } : r));
    } else {
      setRooms(prev => [...prev, { id: Date.now(), roomId, qty: 1, condition: "normal", userPrice: null, customised: false }]);
    }
  };

  const removeRoom = (id) => setRooms(prev => prev.filter(r => r.id !== id));
  const updateRoom = (id, field, val) =>
    setRooms(prev => prev.map(r => {
      if (r.id !== id) return r;
      const u = { ...r, [field]: val };
      if (field === "userPrice") u.customised = val !== null;
      return u;
    }));

  const handleRateChange = (rate) => {
    setHourlyRate(rate);
    setRateInput(String(rate));
    setRooms(prev => prev.map(r => r.customised ? r : { ...r, userPrice: null }));
  };

  const handleCleanTypeChange = (ct) => {
    setCleanType(ct);
    setRooms(prev => prev.map(r => r.customised ? r : { ...r, userPrice: null }));
  };

  const roomsTotal    = rooms.reduce((s, r) => s + (r.customised && r.userPrice !== null ? r.userPrice * r.qty : roomPrice(r.roomId, r.condition, r.qty)), 0);
  const roomsTotalHrs = rooms.reduce((s, r) => s + roomHrs(r.roomId, r.condition, r.qty), 0);
  const totalPrice    = (mode === "quick" ? quickPrice : roomsTotal) + addonTotal;
  const totalHrs      = (mode === "quick" ? quickHrs   : roomsTotalHrs) + addonHrs;

  const handleAI = (result) => {
    if (result.suggestedPrice && mode === "rooms" && rooms.length > 0) {
      const perRoom = Math.round(result.suggestedPrice / rooms.length);
      setRooms(prev => prev.map(r => ({ ...r, userPrice: perRoom, customised: true })));
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-[#010a4f] min-h-full space-y-4">
      <div>
        <p className="text-xl font-black text-white">Residential Pricing</p>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Quick quote or build room-by-room — prices update as you type</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

        {/* ── LEFT ── */}
        <div className="space-y-4">

          {/* Hourly rate */}
          <GCard>
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Your hourly rate</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">Every price derives from this — change it and all quotes update instantly</p>
              </div>
              {rateFromSync && (
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl shrink-0">
                  ✓ Synced
                </span>
              )}
            </div>
            <div className="p-4">
              {/* Big rate input */}
              <div className="flex items-center gap-3 bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.15)] rounded-xl px-4 py-3 mb-3">
                <span className="text-2xl font-black text-[rgba(153,197,255,0.5)]">£</span>
                <input
                  type="text" inputMode="decimal"
                  value={rateInput}
                  onChange={e => {
                    setRateInput(e.target.value);
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v > 0) { setHourlyRate(v); setRooms(prev => prev.map(r => r.customised ? r : { ...r, userPrice: null })); }
                  }}
                  onBlur={e => {
                    const v = parseFloat(e.target.value);
                    const safe = isNaN(v) || v < 12 ? 12 : v;
                    setHourlyRate(safe); setRateInput(String(safe));
                    setRooms(prev => prev.map(r => r.customised ? r : { ...r, userPrice: null }));
                  }}
                  className="flex-1 bg-transparent text-3xl font-black text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none w-0 min-w-0 font-mono"
                />
                <span className="text-sm font-bold text-[rgba(153,197,255,0.4)] shrink-0">/hr</span>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)]">NLW min</p>
                  <p className="text-[10px] font-bold text-[rgba(153,197,255,0.5)]">£12.21</p>
                </div>
              </div>
              {/* Quick-set buttons */}
              <div className="flex gap-1.5 flex-wrap">
                {[16, 18, 20, 22, 25, 28].map(r => (
                  <button key={r} onClick={() => handleRateChange(r)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      hourlyRate === r
                        ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                        : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white"
                    }`}>
                    £{r}
                  </button>
                ))}
              </div>
            </div>
          </GCard>

          {/* Clean type */}
          <GCard>
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
              <p className="text-sm font-black text-white">Clean type</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">{cleanTypeObj.desc} · ×{cleanTypeObj.mult} time multiplier</p>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CLEAN_TYPES.map(ct => {
                const on = cleanType === ct.id;
                return (
                  <button key={ct.id} onClick={() => handleCleanTypeChange(ct.id)}
                    className={`rounded-xl py-3 px-2 text-center border transition-all ${
                      on
                        ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 shadow-lg shadow-[#1f48ff]/10"
                        : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.10)] hover:border-[rgba(153,197,255,0.25)]"
                    }`}>
                    <p className={`text-xs font-black ${on ? "text-white" : "text-[rgba(153,197,255,0.7)]"}`}>{ct.label}</p>
                    <p className={`text-[10px] font-mono mt-1 font-bold ${on ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.35)]"}`}>×{ct.mult}</p>
                  </button>
                );
              })}
            </div>
          </GCard>

          {/* Mode toggle */}
          <div className="flex gap-1 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] p-1 rounded-xl">
            {[{ id: "quick", label: "Quick Quote" }, { id: "rooms", label: "Room Builder" }].map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className={`flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${
                  mode === m.id
                    ? "bg-[#1f48ff] text-white shadow-lg shadow-[#1f48ff]/25"
                    : "text-[rgba(153,197,255,0.5)] hover:text-white"
                }`}>
                {m.label}
              </button>
            ))}
          </div>

          {/* ── QUICK QUOTE ── */}
          {mode === "quick" && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-sm font-black text-white">Property size</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">Select bedrooms — price calculates instantly</p>
              </div>
              <div className="p-3 grid grid-cols-5 gap-2">
                {PROPERTY_SIZES.map(ps => {
                  const price = Math.round(ps[hrsKey] * hourlyRate);
                  const on    = propSize === ps.id;
                  return (
                    <button key={ps.id} onClick={() => setPropSize(ps.id)}
                      className={`flex flex-col items-center rounded-xl py-3.5 px-1 border transition-all ${
                        on
                          ? "bg-[#1f48ff] border-[#1f48ff] shadow-lg shadow-[#1f48ff]/25"
                          : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.10)] hover:border-[rgba(153,197,255,0.3)]"
                      }`}>
                      <p className={`text-xs font-black leading-tight text-center ${on ? "text-white" : "text-[rgba(153,197,255,0.7)]"}`}>{ps.label}</p>
                      <p className={`text-sm font-black tabular-nums mt-1 ${on ? "text-[#99c5ff]" : "text-emerald-400"}`}>{fmt(price)}</p>
                      <p className={`text-[10px] mt-0.5 ${on ? "text-[rgba(255,255,255,0.5)]" : "text-[rgba(153,197,255,0.35)]"}`}>{ps[hrsKey]}h</p>
                    </button>
                  );
                })}
              </div>
              {/* Market benchmark */}
              <div className={`mx-3 mb-3 px-3 py-2.5 rounded-xl border ${mktStatus.bg}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-[rgba(153,197,255,0.45)]">UK market range · {propSizeObj.label} {cleanTypeObj.label.toLowerCase()}</p>
                    <p className="text-xs font-bold text-white mt-0.5">{fmt(propSizeObj.mkMin)} – {fmt(propSizeObj.mkMax)}</p>
                  </div>
                  <p className={`text-xs font-bold text-right ${mktStatus.color}`}>{mktStatus.label}</p>
                </div>
              </div>
            </GCard>
          )}

          {/* ── ROOM BUILDER ── */}
          {mode === "rooms" && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
                <p className="text-sm font-black text-white">Room builder</p>
                <span className="text-[10px] font-bold text-emerald-400">
                  {rooms.reduce((s, r) => s + r.qty, 0)} rooms · {fmt2(roomsTotal)}
                </span>
              </div>

              {/* Add room chips */}
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.4)] mb-2">Tap to add a room</p>
                <div className="flex flex-wrap gap-1.5">
                  {ROOM_TYPES.map(rt => (
                    <button key={rt.id} onClick={() => addRoom(rt.id)}
                      className="px-3 py-1.5 text-xs font-bold bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] rounded-xl hover:bg-[#1f48ff]/20 hover:border-[#1f48ff]/40 hover:text-white transition-all">
                      + {rt.label}
                    </button>
                  ))}
                </div>
              </div>

              {rooms.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-[rgba(153,197,255,0.3)] font-semibold">Tap a room above to start building</p>
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div className="grid gap-2 px-4 py-2 bg-[rgba(153,197,255,0.03)] border-b border-[rgba(153,197,255,0.06)]"
                    style={{ gridTemplateColumns: "2fr 60px 2fr 80px 28px" }}>
                    {["Room", "Qty", "Condition", "Price £", ""].map(h => (
                      <span key={h} className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.35)]">{h}</span>
                    ))}
                  </div>

                  <div className="divide-y divide-[rgba(153,197,255,0.06)]">
                    {rooms.map(r => {
                      const def       = ROOM_TYPES.find(rt => rt.id === r.roomId);
                      const cond      = ROOM_CONDITIONS.find(c => c.id === r.condition);
                      const estMins   = Math.round((def.mins + cond.addMins) * cleanTypeObj.mult);
                      const autoPrice = roomPrice(r.roomId, r.condition, 1);
                      const dispPrice = r.customised && r.userPrice !== null ? r.userPrice : autoPrice;

                      return (
                        <div key={r.id} className="grid gap-2 px-4 py-3 items-center"
                          style={{ gridTemplateColumns: "2fr 60px 2fr 80px 28px" }}>

                          {/* Room label */}
                          <div>
                            <p className="text-xs font-black text-white leading-tight">{def?.label}</p>
                            <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{roomHrs(r.roomId, r.condition, r.qty).toFixed(1)}h · {estMins}min</p>
                          </div>

                          {/* Qty stepper */}
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => r.qty > 1 ? updateRoom(r.id, "qty", r.qty - 1) : removeRoom(r.id)}
                              className="w-5 h-5 flex items-center justify-center rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:text-red-400 text-xs transition-colors">−</button>
                            <span className="text-xs font-black text-white w-4 text-center">{r.qty}</span>
                            <button onClick={() => updateRoom(r.id, "qty", r.qty + 1)}
                              className="w-5 h-5 flex items-center justify-center rounded-lg bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] text-xs transition-colors">+</button>
                          </div>

                          {/* Condition pills */}
                          <div>
                            <div className="flex gap-1 flex-wrap">
                              {ROOM_CONDITIONS.map(c => (
                                <button key={c.id} onClick={() => updateRoom(r.id, "condition", c.id)}
                                  className={`px-1.5 py-0.5 text-[10px] font-bold rounded-lg border transition-all ${
                                    r.condition === c.id
                                      ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                                      : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.3)]"
                                  }`}>
                                  {c.label}
                                </button>
                              ))}
                            </div>
                            {r.customised && <p className="text-[10px] text-amber-400 font-bold mt-0.5">Custom ✎</p>}
                          </div>

                          {/* Price input */}
                          <div>
                            <input
                              type="number" min="0" step="1"
                              value={dispPrice}
                              onChange={e => updateRoom(r.id, "userPrice", +e.target.value)}
                              onFocus={() => { if (!r.customised) updateRoom(r.id, "userPrice", autoPrice); }}
                              className={`w-full rounded-xl px-2 py-1.5 text-sm text-right font-mono focus:outline-none transition-colors ${
                                r.customised
                                  ? "bg-amber-500/10 border border-amber-500/30 text-amber-300 focus:border-amber-400"
                                  : "bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-white focus:border-[#99c5ff]"
                              }`}
                            />
                            {r.qty > 1 && (
                              <p className="text-[10px] text-[rgba(153,197,255,0.35)] text-right mt-0.5">{fmt2(dispPrice * r.qty)} total</p>
                            )}
                          </div>

                          {/* Remove */}
                          <button onClick={() => removeRoom(r.id)}
                            className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors flex justify-end">✕</button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between px-4 py-2.5 border-t border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)]">
                    <span className="text-sm font-black text-white">Rooms subtotal</span>
                    <span className="text-sm font-black text-emerald-400 tabular-nums">{fmt2(roomsTotal)}</span>
                  </div>
                </>
              )}
            </GCard>
          )}

          {/* Add-ons */}
          <AddOnSection addons={addons} setAddons={setAddons} presets={RES_ADDON_PRESETS} label="Add-on services" />

          {/* Who's cleaning */}
          <StaffSelector staffId={staffId} setStaffId={setStaffId} />

          {/* Photo */}
          <PhotoCapture mode="rooms" onResult={handleAI} />
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-4 xl:sticky xl:top-4 self-start">

          {totalPrice > 0 ? (
            <ProfitWaterfall
              price={totalPrice}
              hrs={totalHrs}
              staffId={staffId}
              accounts={accounts}
              targetMargin={targetMargin}
              onTargetMarginChange={setTargetMargin}
              onPriceChange={() => {}}
            />
          ) : (
            <GCard className="p-8 text-center">
              <span className="text-4xl block mb-3">🏠</span>
              <p className="text-sm font-bold text-[rgba(153,197,255,0.5)]">Select a size or add rooms</p>
              <p className="text-xs text-[rgba(153,197,255,0.3)] mt-1">Profit breakdown appears here</p>
            </GCard>
          )}

          {/* Quick-mode price breakdown */}
          {mode === "quick" && totalPrice > 0 && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-sm font-black text-white">Price breakdown</p>
              </div>
              <div className="divide-y divide-[rgba(153,197,255,0.06)]">
                {[
                  { label: "Clean time",  val: `${quickHrs}hrs`,   note: cleanTypeObj.label },
                  { label: "Hourly rate", val: `£${hourlyRate}/hr`, note: "your rate" },
                  { label: "Base price",  val: fmt2(quickPrice),    note: "time × rate" },
                  ...(addonTotal > 0 ? [{ label: "Add-ons", val: fmt2(addonTotal), note: `${addonHrs}hrs extra` }] : []),
                  { label: "Total quote", val: fmt2(totalPrice),    note: "what you charge", bold: true },
                ].map(({ label, val, note, bold }) => (
                  <div key={label} className={`flex items-center justify-between px-4 py-2.5 ${bold ? "bg-[rgba(153,197,255,0.04)]" : ""}`}>
                    <div>
                      <p className={`text-xs font-semibold ${bold ? "text-white font-black" : "text-[rgba(153,197,255,0.7)]"}`}>{label}</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{note}</p>
                    </div>
                    <p className={`font-mono tabular-nums ${bold ? "text-base font-black text-emerald-400" : "text-sm text-white"}`}>{val}</p>
                  </div>
                ))}
              </div>
            </GCard>
          )}

          {/* Quote summary */}
          <QuoteSummary totalPrice={totalPrice} totalHrs={totalHrs} type="residential" customers={customers}
            onSave={async q => { setSavedQuotes(prev => [q, ...prev]); await onSaveQuote?.(q); }} />

          {/* Saved quotes */}
          {savedQuotes.length > 0 && (
            <SavedQuotesList quotes={savedQuotes} onAccept={onAcceptQuote} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Commercial ──────────────────────────────────────────────────────────

// Glassmorphism input — shared within commercial tab
const GInput = ({ className = "", type, ...props }) => (
  <input
    type={type}
    {...(type === "number" ? { min: "0", onBlur: e => { if (parseFloat(e.target.value) < 0) e.target.value = "0"; } } : {})}
    {...props}
    className={`bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-xs text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors font-mono ${className}`}
  />
);

// Section header row inside a GCard cost builder
const GSection = ({ label, subtotal, addLabel, onAdd }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.03)]">
    <div>
      <p className="text-xs font-black text-white">{label}</p>
      {subtotal > 0 && <p className="text-[10px] text-[rgba(153,197,255,0.45)]">{fmt2(subtotal)} subtotal</p>}
    </div>
    <button onClick={onAdd}
      className="px-3 py-1.5 text-xs font-bold text-white bg-[#1f48ff]/20 border border-[#1f48ff]/40 rounded-xl hover:bg-[#1f48ff]/35 transition-colors">
      + {addLabel}
    </button>
  </div>
);

// Column header row
const GColHeader = ({ cols }) => (
  <div className={`grid gap-2 px-4 py-2`} style={{ gridTemplateColumns: cols.map(c => c.w ?? "1fr").join(" ") }}>
    {cols.map(c => (
      <span key={c.label} className={`text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.35)] ${c.right ? "text-right" : ""}`}>{c.label}</span>
    ))}
    <span />
  </div>
);

function CommercialTab({ accounts, userHourlyRate, onSaveQuote, onAcceptQuote, customers = [], initialQuotes = [] }) {
  const defaultManRate = userHourlyRate ?? 18;
  const rateFromSync   = !!userHourlyRate;

  const [sector,       setSector]       = useState("office");
  const [jobType,      setJobType]      = useState("regular");
  const [frequency,    setFrequency]    = useState("oneoff");
  const [customWeeks,  setCustomWeeks]  = useState(39);
  const [sqft,         setSqft]         = useState("");
  const [accessNotes,  setAccessNotes]  = useState("");
  const [manHours,     setManHours]     = useState([{ id: uid(), role: "Cleaner", rate: defaultManRate, hrs: 4 }]);
  const [products,     setProducts]     = useState([]);
  const [equipment,    setEquipment]    = useState([]);
  const [oneTimeEquip, setOneTimeEquip] = useState([]);
  const [contractWeeks, setContractWeeks] = useState(26);
  const [overheads,    setOverheads]    = useState([]);
  const [addons,       setAddons]       = useState([]);
  const [manualPrice,  setManualPrice]  = useState(null);
  const [targetMargin, setTargetMargin] = useState(35);
  const [savedQuotes,  setSavedQuotes]  = useState(initialQuotes);

  const freqObjRaw = COMMERCIAL_FREQUENCIES.find(f => f.id === frequency) ?? COMMERCIAL_FREQUENCIES[0];
  // For custom frequency, use the user's custom weeks as the multiplier
  const freqObj = freqObjRaw.unit === "custom"
    ? { ...freqObjRaw, multiplier: Math.max(1, customWeeks), label: `${customWeeks} weeks/year` }
    : freqObjRaw;

  // Insert-row helpers
  const addRow    = (setter, defaults) => setter(prev => [...prev, { id: uid(), ...defaults }]);
  const removeRow = (setter, id)       => setter(prev => prev.filter(r => r.id !== id));
  const updateRow = (setter, id, field, val) => setter(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));

  // Cost totals
  const manHoursCost  = manHours.reduce((s, r) => s + (parseFloat(r.rate) || 0) * (parseFloat(r.hrs) || 0), 0);
  const productsCost  = products.reduce((s, r) => s + (parseFloat(r.unitCost) || 0) * (parseFloat(r.qty) || 0), 0);
  const equipmentCost = equipment.reduce((s, r) => s + (parseFloat(r.costPerUse) || 0) * (parseFloat(r.qty) || 0), 0);
  const oneTimeEquipTotal = oneTimeEquip.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
  const oneTimePerVisit   = contractWeeks > 0 ? oneTimeEquipTotal / contractWeeks : 0;
  const overheadsCost = overheads.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
  const addonsCost    = addons.reduce((s, a) => s + (parseFloat(a.price) || 0), 0);
  const totalCost     = manHoursCost + productsCost + equipmentCost + oneTimePerVisit + overheadsCost + addonsCost;
  const totalHrs      = manHours.reduce((s, r) => s + (parseFloat(r.hrs) || 0), 0)
                      + addons.reduce((s, a) => s + (parseFloat(a.hrs) || 0), 0);

  // Price points
  const suggestedPrice = useMemo(() =>
    manualPrice ?? priceForMargin({ targetMarginPct: targetMargin, hrs: 0, staffId: "you", extraCosts: totalCost, accounts }),
    [manualPrice, targetMargin, totalCost, accounts]
  );
  const price       = Math.max(0, suggestedPrice);
  const breakEven   = Math.ceil(totalCost * 1.05);
  const atTarget    = Math.ceil(priceForMargin({ targetMarginPct: targetMargin, hrs: 0, staffId: "you", extraCosts: totalCost, accounts }));
  const rounded     = Math.ceil(atTarget / 5) * 5;
  const annualValue  = price * freqObj.multiplier;
  const monthlyValue = annualValue / 12;

  const handleAI = (result) => {
    setManualPrice(result.suggestedPrice);
    if (manHours.length > 0) {
      setManHours(prev => prev.map((r, i) => i === 0 ? { ...r, hrs: result.estimatedHours ?? 4 } : r));
    }
  };

  // Pill selector used for sector + job type
  const GPill = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              on
                ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white"
            }`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="p-4 lg:p-6 bg-[#010a4f] min-h-full space-y-4">

      <div>
        <p className="text-xl font-black text-white">Commercial Pricing</p>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Cost-build calculator — build up from costs, add margin on top</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

        {/* ── LEFT ── */}
        <div className="space-y-4">

          {/* Job details */}
          <GCard>
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
              <p className="text-sm font-black text-white">Job details</p>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Sector</p>
                <GPill options={COMMERCIAL_SECTORS} value={sector} onChange={setSector} />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Job type</p>
                <GPill options={COMMERCIAL_JOB_TYPES} value={jobType} onChange={setJobType} />
              </div>
              <div className={`grid gap-3 ${frequency === "custom" ? "grid-cols-3" : "grid-cols-2"}`}>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Frequency</p>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)}
                    className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#99c5ff] transition-colors">
                    {COMMERCIAL_FREQUENCIES.map(f => <option key={f.id} value={f.id} className="bg-[#010a4f]">{f.label}</option>)}
                  </select>
                </div>
                {frequency === "custom" && (
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Weeks per year</p>
                    <GInput
                      type="number"
                      value={customWeeks}
                      onChange={e => setCustomWeeks(Math.max(1, Math.min(52, parseInt(e.target.value) || 1)))}
                      placeholder="e.g. 39"
                      className="w-full text-sm"
                      min="1"
                      max="52"
                    />
                    <p className="text-[9px] text-[rgba(153,197,255,0.35)] mt-1">e.g. schools = 38–39 weeks</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Approx size (sq ft)</p>
                  <GInput type="number" value={sqft} onChange={e => setSqft(e.target.value)} placeholder="e.g. 2000" className="w-full text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Contract length</p>
                  <div className="flex items-center gap-2">
                    <GInput
                      type="number"
                      value={contractWeeks}
                      onChange={e => setContractWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="26"
                      className="w-full text-sm"
                      min="1"
                    />
                    <span className="text-xs text-[rgba(153,197,255,0.4)] shrink-0">weeks</span>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Contract duration</p>
                    <p className="text-xs font-bold text-white">{contractWeeks} weeks · {Math.round(contractWeeks / 4.33)} months</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Access / notes</p>
                <input type="text" value={accessNotes} onChange={e => setAccessNotes(e.target.value)}
                  placeholder="Keyholder, alarm code, parking, site induction…"
                  className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors" />
              </div>
            </div>
          </GCard>

          {/* Cost builder */}
          <GCard>
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-white">Cost builder</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5">
                  Total cost: <span className="font-black text-emerald-400">{fmt2(totalCost)}</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/25 text-[10px] font-bold text-amber-300">
                Build cost · add margin
              </span>
            </div>

            {/* ── Man hours ── */}
            <GSection label="Man hours"
              subtotal={manHoursCost}
              addLabel="Add cleaner"
              onAdd={() => addRow(setManHours, { role: "Cleaner", rate: defaultManRate, hrs: 2 })} />
            {rateFromSync && (
              <p className="px-4 pt-2 text-[10px] text-emerald-400 font-semibold">✓ Rate synced from your Settings</p>
            )}
            {manHours.length > 0 && (
              <>
                <GColHeader cols={[
                  { label: "Role",      w: "2fr" },
                  { label: "Rate £/hr", w: "1fr" },
                  { label: "Hours",     w: "1fr" },
                  { label: "Total",     w: "1fr", right: true },
                ]} />
                {manHours.map(r => (
                  <div key={r.id} className="grid gap-2 px-4 py-2 border-t border-[rgba(153,197,255,0.06)] items-center"
                    style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr auto" }}>
                    <GInput value={r.role} onChange={e => updateRow(setManHours, r.id, "role", e.target.value)} placeholder="Role" className="text-xs font-sans" />
                    <GInput type="number" value={r.rate} onChange={e => updateRow(setManHours, r.id, "rate", e.target.value)} />
                    <GInput type="number" value={r.hrs} onChange={e => updateRow(setManHours, r.id, "hrs", e.target.value)} step="0.5" />
                    <span className="text-xs font-mono font-black text-emerald-400 text-right tabular-nums">
                      {fmt2((parseFloat(r.rate) || 0) * (parseFloat(r.hrs) || 0))}
                    </span>
                    <button onClick={() => removeRow(setManHours, r.id)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                ))}
              </>
            )}

            {/* ── Products ── */}
            <GSection label="Products & consumables"
              subtotal={productsCost}
              addLabel="Add product"
              onAdd={() => addRow(setProducts, { name: "", unitCost: "", qty: "1" })} />
            {products.length > 0 && (
              <>
                <GColHeader cols={[
                  { label: "Product / chemical", w: "3fr" },
                  { label: "Cost £",  w: "1fr" },
                  { label: "Qty",     w: "1fr" },
                  { label: "Total",   w: "1fr", right: true },
                ]} />
                {products.map(r => (
                  <div key={r.id} className="grid gap-2 px-4 py-2 border-t border-[rgba(153,197,255,0.06)] items-center"
                    style={{ gridTemplateColumns: "3fr 1fr 1fr 1fr auto" }}>
                    <GInput value={r.name} onChange={e => updateRow(setProducts, r.id, "name", e.target.value)} placeholder="e.g. Floor cleaner" className="text-xs font-sans" />
                    <GInput type="number" value={r.unitCost} onChange={e => updateRow(setProducts, r.id, "unitCost", e.target.value)} placeholder="0.00" />
                    <GInput type="number" value={r.qty} onChange={e => updateRow(setProducts, r.id, "qty", e.target.value)} placeholder="1" />
                    <span className="text-xs font-mono font-black text-emerald-400 text-right tabular-nums">
                      {fmt2((parseFloat(r.unitCost) || 0) * (parseFloat(r.qty) || 0))}
                    </span>
                    <button onClick={() => removeRow(setProducts, r.id)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                ))}
              </>
            )}

            {/* ── Equipment ── */}
            <GSection label="Equipment"
              subtotal={equipmentCost}
              addLabel="Add equipment"
              onAdd={() => addRow(setEquipment, { name: "", costPerUse: "", qty: "1" })} />
            {equipment.length > 0 && (
              <>
                <GColHeader cols={[
                  { label: "Equipment",  w: "3fr" },
                  { label: "Cost/use £", w: "1fr" },
                  { label: "Uses",       w: "1fr" },
                  { label: "Total",      w: "1fr", right: true },
                ]} />
                {equipment.map(r => (
                  <div key={r.id} className="grid gap-2 px-4 py-2 border-t border-[rgba(153,197,255,0.06)] items-center"
                    style={{ gridTemplateColumns: "3fr 1fr 1fr 1fr auto" }}>
                    <GInput value={r.name} onChange={e => updateRow(setEquipment, r.id, "name", e.target.value)} placeholder="e.g. Scrubber dryer" className="text-xs font-sans" />
                    <GInput type="number" value={r.costPerUse} onChange={e => updateRow(setEquipment, r.id, "costPerUse", e.target.value)} placeholder="0.00" />
                    <GInput type="number" value={r.qty} onChange={e => updateRow(setEquipment, r.id, "qty", e.target.value)} placeholder="1" />
                    <span className="text-xs font-mono font-black text-emerald-400 text-right tabular-nums">
                      {fmt2((parseFloat(r.costPerUse) || 0) * (parseFloat(r.qty) || 0))}
                    </span>
                    <button onClick={() => removeRow(setEquipment, r.id)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                ))}
              </>
            )}

            {/* ── One-time Equipment (amortised over contract) ── */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(153,197,255,0.08)]">
              <div>
                <p className="text-xs font-black text-white">One-time equipment</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.45)]">
                  {oneTimeEquipTotal > 0
                    ? `£${oneTimeEquipTotal.toFixed(2)} total ÷ ${contractWeeks} weeks = £${oneTimePerVisit.toFixed(2)}/visit`
                    : "Buy once, cost spread across contract length"}
                </p>
              </div>
              <button
                onClick={() => addRow(setOneTimeEquip, { name: "", cost: "" })}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[rgba(153,197,255,0.15)] text-[10px] font-bold text-[rgba(153,197,255,0.6)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-colors bg-transparent"
              >
                + Add item
              </button>
            </div>
            {oneTimeEquip.length > 0 && (
              <>
                {/* Contract length input */}
                <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[rgba(153,197,255,0.06)] bg-[rgba(153,197,255,0.03)]">
                  <span className="text-[10px] font-bold text-[rgba(153,197,255,0.5)]">Contract length</span>
                  <GInput
                    type="number"
                    value={contractWeeks}
                    onChange={e => setContractWeeks(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 text-center"
                    min="1"
                  />
                  <span className="text-[10px] text-[rgba(153,197,255,0.4)]">weeks</span>
                </div>
                <GColHeader cols={[
                  { label: "Equipment item",  w: "3fr" },
                  { label: "Cost £",          w: "1fr" },
                  { label: "Per visit",        w: "1fr", right: true },
                ]} />
                {oneTimeEquip.map(r => {
                  const perVisit = contractWeeks > 0 ? (parseFloat(r.cost) || 0) / contractWeeks : 0;
                  return (
                    <div key={r.id} className="grid gap-2 px-4 py-2 border-t border-[rgba(153,197,255,0.06)] items-center"
                      style={{ gridTemplateColumns: "3fr 1fr 1fr auto" }}>
                      <GInput value={r.name} onChange={e => updateRow(setOneTimeEquip, r.id, "name", e.target.value)} placeholder="e.g. Henry hoover" className="text-xs font-sans" />
                      <GInput type="number" value={r.cost} onChange={e => updateRow(setOneTimeEquip, r.id, "cost", e.target.value)} placeholder="0.00" />
                      <span className="text-xs font-mono font-black text-[#99c5ff] text-right tabular-nums">
                        {fmt2(perVisit)}
                      </span>
                      <button onClick={() => removeRow(setOneTimeEquip, r.id)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors">✕</button>
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Overheads ── */}
            <GSection label="Overheads & other"
              subtotal={overheadsCost}
              addLabel="Add overhead"
              onAdd={() => addRow(setOverheads, { label: "", cost: "" })} />
            {overheads.length > 0 && (
              <>
                <GColHeader cols={[
                  { label: "Description", w: "3fr" },
                  { label: "Cost £",      w: "1fr" },
                ]} />
                {overheads.map(r => (
                  <div key={r.id} className="grid gap-2 px-4 py-2 border-t border-[rgba(153,197,255,0.06)] items-center"
                    style={{ gridTemplateColumns: "3fr 1fr auto" }}>
                    <GInput value={r.label} onChange={e => updateRow(setOverheads, r.id, "label", e.target.value)} placeholder="Travel, PPE, waste disposal…" className="text-xs font-sans" />
                    <GInput type="number" value={r.cost} onChange={e => updateRow(setOverheads, r.id, "cost", e.target.value)} placeholder="0.00" />
                    <button onClick={() => removeRow(setOverheads, r.id)} className="text-[rgba(153,197,255,0.25)] hover:text-red-400 text-sm transition-colors">✕</button>
                  </div>
                ))}
              </>
            )}

            {/* Cost summary footer */}
            {totalCost > 0 && (
              <div className="px-4 py-3 border-t border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)] space-y-1.5">
                {[
                  ["Man hours",  manHoursCost],
                  ["Products",   productsCost],
                  ["Equipment",  equipmentCost],
                  ["Equipment (amortised)", oneTimePerVisit],
                  ["Overheads",  overheadsCost],
                ].filter(([, v]) => v > 0).map(([l, v]) => (
                  <div key={l} className="flex justify-between text-xs">
                    <span className="text-[rgba(153,197,255,0.45)]">{l}</span>
                    <span className="font-mono text-[rgba(153,197,255,0.6)]">{fmt2(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1.5 border-t border-[rgba(153,197,255,0.08)]">
                  <span className="text-sm font-black text-white">Total cost</span>
                  <span className="text-sm font-black text-emerald-400 tabular-nums">{fmt2(totalCost)}</span>
                </div>
              </div>
            )}
          </GCard>

          {/* Add-ons */}
          <AddOnSection addons={addons} setAddons={setAddons} presets={COM_ADDON_PRESETS} label="Additional services" />

          {/* Photo */}
          <PhotoCapture mode="commercial" onResult={handleAI} />
        </div>

        {/* ── RIGHT ── */}
        <div className="space-y-4 xl:sticky xl:top-4 self-start">

          {/* Quote price builder */}
          {totalCost > 0 ? (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-sm font-black text-white">Quote price builder</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5">Cost: {fmt2(totalCost)} · {totalHrs.toFixed(1)} hrs</p>
              </div>
              <div className="p-4 space-y-4">

                {/* Margin slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)]">Target margin</p>
                    <span className="text-sm font-black text-white">{targetMargin}%</span>
                  </div>
                  <input type="range" min={10} max={70} step={1} value={targetMargin}
                    onChange={e => { setTargetMargin(+e.target.value); setManualPrice(null); }}
                    className="w-full accent-[#1f48ff]" />
                  <div className="flex justify-between text-[10px] text-[rgba(153,197,255,0.3)] mt-1">
                    <span>10%</span><span>70%</span>
                  </div>
                </div>

                {/* Price point buttons */}
                <div className="space-y-2">
                  {[
                    { label: "Your cost",            val: fmt2(totalCost), sub: "Break-even — below this you lose money", border: "border-red-500/30",   bg: "bg-red-500/10",    text: "text-red-400",     pick: totalCost  },
                    { label: "Break-even +5%",        val: fmt2(breakEven), sub: "Barely covers costs — too low to quote", border: "border-amber-500/30", bg: "bg-amber-500/10",  text: "text-amber-400",   pick: breakEven  },
                    { label: `At ${targetMargin}% margin`, val: fmt2(atTarget), sub: "Your target — adjust slider above", border: "border-[rgba(153,197,255,0.2)]", bg: "bg-[rgba(153,197,255,0.05)]", text: "text-white", pick: atTarget },
                    { label: "Suggested quote",       val: fmt2(rounded),   sub: "Rounded to nearest £5 — recommended",   border: "border-emerald-500/40", bg: "bg-emerald-500/10", text: "text-emerald-400", pick: rounded, star: true },
                  ].map(({ label, val, sub, border, bg, text, pick, star }) => {
                    const isActive = manualPrice === pick;
                    return (
                      <button key={label} onClick={() => setManualPrice(pick)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${bg} ${isActive ? `${border} ring-1 ring-[#1f48ff]/50` : border} hover:brightness-110`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-[rgba(153,197,255,0.55)]">{label}{star ? " ★" : ""}</p>
                            <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">{sub}</p>
                          </div>
                          <p className={`text-base font-black tabular-nums shrink-0 ${text}`}>{val}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom price input */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Or enter your own price</p>
                  <div className="flex items-center gap-2 bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5">
                    <span className="text-lg font-black text-[rgba(153,197,255,0.5)]">£</span>
                    <input type="number" min="0" step="5"
                      value={manualPrice ?? ""}
                      onChange={e => setManualPrice(+e.target.value || null)}
                      placeholder={String(atTarget)}
                      className="flex-1 bg-transparent text-xl font-black text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none w-0 min-w-0 font-mono" />
                    {manualPrice && (
                      <button onClick={() => setManualPrice(null)} className="text-[10px] text-[rgba(153,197,255,0.35)] hover:text-white shrink-0">reset</button>
                    )}
                  </div>
                </div>

                {/* Contract value */}
                {freqObj.id !== "oneoff" && price > 0 && (
                  <div className="px-3 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
                    <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Contract value — {freqObj.label}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-[rgba(153,197,255,0.5)]">Monthly</span>
                      <span className="font-black text-white tabular-nums">{fmt2(monthlyValue)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[rgba(153,197,255,0.5)]">Annual</span>
                      <span className="font-black text-emerald-400 tabular-nums">{fmt(annualValue)}</span>
                    </div>
                  </div>
                )}
              </div>
            </GCard>
          ) : (
            <GCard className="p-8 text-center">
              <span className="text-4xl block mb-3">🏗</span>
              <p className="text-sm font-bold text-[rgba(153,197,255,0.5)]">Add costs to start</p>
              <p className="text-xs text-[rgba(153,197,255,0.3)] mt-1">Build up man hours, products and overheads</p>
            </GCard>
          )}

          {/* Profit waterfall */}
          {price > 0 && (
            <ProfitWaterfall price={price} hrs={totalHrs} staffId="you" extraCosts={totalCost} accounts={accounts} />
          )}

          {/* Quote summary */}
          <QuoteSummary totalPrice={price} totalHrs={totalHrs} type="commercial" customers={customers} onSave={async q => {
            setSavedQuotes(prev => [q, ...prev]);
            await onSaveQuote?.(q);
          }} />

          {/* Saved quotes */}
          {savedQuotes.length > 0 && (
            <SavedQuotesList quotes={savedQuotes} onAccept={onAcceptQuote} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TAB: Exterior ────────────────────────────────────────────────────────────
//
// Architecture (based on how exterior cleaners actually work):
//
//   Tab 1 — Property pricer (opens here by default)
//     Price a single property in under 30 seconds.
//     Property type → storeys → access difficulty → frequency → extras.
//     Large price display. Add to round button. AI photo button.
//
//   Tab 2 — One-off jobs
//     Standalone gutter clean, driveway, roof moss, render, fascias.
//     Size + condition drives the price. Custom rows.
//
//   Tab 3 — Round summary
//     Lightweight running total. Count + value + monthly/annual income.
//     Van load check: can I fill a day at this rate?
//
//   Tab 4 — AI photo
//     Photograph the property. Claude identifies type, surfaces, access.
//     Populates the property pricer automatically.

// ─── Exterior pricing data ────────────────────────────────────────────────────

const EXT_PROPERTY_TYPES = [
  { id:"flat",       label:"Flat / apartment",  basePrice:35,  storeyMult:[1.0, 1.0, 1.15], avgMins:25 },
  { id:"terrace",    label:"Terraced house",    basePrice:45,  storeyMult:[1.0, 1.05,1.18], avgMins:32 },
  { id:"semi",       label:"Semi-detached",     basePrice:55,  storeyMult:[1.0, 1.0, 1.15], avgMins:40 },
  { id:"detached_s", label:"Detached (small)",  basePrice:70,  storeyMult:[1.0, 1.0, 1.12], avgMins:50 },
  { id:"detached_l", label:"Detached (large)",  basePrice:95,  storeyMult:[1.0, 1.0, 1.12], avgMins:70 },
  { id:"bungalow",   label:"Bungalow",           basePrice:50,  storeyMult:[1.0, 1.0, 1.0 ], avgMins:35 },
  { id:"commercial", label:"Commercial unit",    basePrice:90,  storeyMult:[1.0, 1.08,1.20], avgMins:60 },
  { id:"block",      label:"Block of flats",    basePrice:180, storeyMult:[1.0, 1.0, 1.0 ], avgMins:90 },
];

const EXT_FREQUENCIES = [
  { id:"4",  label:"4-weekly",  visitsPerYear:13   },
  { id:"6",  label:"6-weekly",  visitsPerYear:8.67 },
  { id:"8",  label:"8-weekly",  visitsPerYear:6.5  },
  { id:"12", label:"12-weekly", visitsPerYear:4.33 },
  { id:"one-off", label:"One-off", visitsPerYear:1 },
];

const ACCESS_PREMIUMS = [
  { id:"easy",   label:"Easy access",       premium:0  },
  { id:"ladder", label:"Ladder needed",     premium:8  },
  { id:"tricky", label:"Restricted access", premium:15 },
  { id:"high",   label:"High-reach / MEWP", premium:40 },
];

const WINDOW_EXTRAS = [
  { id:"conserv",  label:"Conservatory roof",  price:110, hrs:1.5  },
  { id:"fascias",  label:"Fascias & soffits",  price:85,  hrs:1.25 },
  { id:"int_win",  label:"Interior windows",   price:35,  hrs:0.75 },
  { id:"solar",    label:"Solar panels",       price:140, hrs:2.0  },
];

// One-off job definitions — size → price mapping
const ONE_OFF_JOBS = [
  {
    id:"gutters", label:"Gutter clean",
    sizes:[
      { id:"terrace",   label:"Terraced house",    price:75,  hrs:1.25 },
      { id:"semi",      label:"Semi-detached",     price:95,  hrs:1.5  },
      { id:"detached",  label:"Detached house",    price:125, hrs:2.0  },
      { id:"large",     label:"Large / detached+", price:160, hrs:2.5  },
      { id:"commercial",label:"Commercial unit",   price:140, hrs:2.0  },
    ],
    conditions:[
      { id:"clear",  label:"Clear — light debris",    surcharge:0   },
      { id:"full",   label:"Full — significant build-up", surcharge:20  },
      { id:"blocked",label:"Blocked — standing water",  surcharge:40  },
    ],
  },
  {
    id:"driveway", label:"Driveway / patio pressure wash",
    sizes:[
      { id:"small",  label:"Small (up to 30m²)",    price:80,  hrs:1.5  },
      { id:"medium", label:"Medium (30–60m²)",      price:120, hrs:2.5  },
      { id:"large",  label:"Large (60–100m²)",      price:175, hrs:3.5  },
      { id:"xlarge", label:"Extra large (100m²+)",  price:240, hrs:5.0  },
    ],
    conditions:[
      { id:"good",  label:"Good condition",          surcharge:0   },
      { id:"fair",  label:"Algae / light staining",  surcharge:20  },
      { id:"heavy", label:"Heavy staining / weeds",  surcharge:45  },
    ],
  },
  {
    id:"roof_moss", label:"Roof moss treatment",
    sizes:[
      { id:"terrace",  label:"Terraced / small",     price:150, hrs:2.0  },
      { id:"semi",     label:"Semi-detached",        price:220, hrs:3.0  },
      { id:"detached", label:"Detached",              price:320, hrs:4.5  },
      { id:"large",    label:"Large detached / barn", price:420, hrs:6.0  },
    ],
    conditions:[
      { id:"light",  label:"Light coverage",         surcharge:0   },
      { id:"medium", label:"Medium coverage",        surcharge:30  },
      { id:"heavy",  label:"Heavy / thick moss",     surcharge:80  },
    ],
  },
  {
    id:"fascias", label:"Fascias & soffits",
    sizes:[
      { id:"small",  label:"Terraced / small",       price:65,  hrs:1.0  },
      { id:"medium", label:"Semi / medium",          price:90,  hrs:1.5  },
      { id:"large",  label:"Detached / large",       price:130, hrs:2.0  },
      { id:"xlarge", label:"Large detached",         price:170, hrs:2.75 },
    ],
    conditions:[
      { id:"good",  label:"Good — light soiling",    surcharge:0   },
      { id:"fair",  label:"Fair — algae present",    surcharge:15  },
      { id:"heavy", label:"Heavy — significant grime",surcharge:30 },
    ],
  },
  {
    id:"render", label:"Render / cladding wash",
    sizes:[
      { id:"small",  label:"Small area (<30m²)",     price:120, hrs:2.0  },
      { id:"medium", label:"Medium (30–60m²)",       price:180, hrs:3.0  },
      { id:"large",  label:"Large (60–100m²)",       price:280, hrs:4.5  },
      { id:"full",   label:"Full house render",      price:380, hrs:6.0  },
    ],
    conditions:[
      { id:"good",  label:"Good — surface soiling",  surcharge:0   },
      { id:"algae", label:"Algae / green staining",  surcharge:40  },
      { id:"heavy", label:"Heavy ingrained dirt",    surcharge:90  },
    ],
  },
];

// ─── Exterior Pricing Data (v2) ──────────────────────────────────────────────

const EXT_SERVICES = [
  { id: "windows",  label: "Window cleaning",   emoji: "🪟", desc: "Recurring schedule" },
  { id: "gutters",  label: "Gutter cleaning",   emoji: "🏠", desc: "Per-visit price" },
  { id: "roof",     label: "Roof cleaning",     emoji: "🏡", desc: "Guide price only" },
  { id: "fascia",   label: "Fascia & soffit",   emoji: "🔧", desc: "One-off visit" },
  { id: "render",   label: "Render cleaning",   emoji: "🏗", desc: "Price on request" },
  { id: "pressure", label: "Pressure washing",  emoji: "💧", desc: "Area-based quote" },
];

// Unified property sizes — drives all service pricing
const EXT_SIZES = [
  { id: "2bed",   label: "2 bed"              },
  { id: "23bed",  label: "2/3 bed"            },
  { id: "34semi", label: "3/4 bed semi"       },
  { id: "3det",   label: "3 bed detached"     },
  { id: "4det",   label: "4 bed detached"     },
  { id: "5plus",  label: "5 bed+"             },
];

// Market average prices (reference only — user enters their own)
const GUTTER_PRICES = { "2bed": 110, "23bed": 130, "34semi": 160, "3det": 160, "4det": 160, "5plus": 180 };
const WINDOW_PRICES  = {
  "2bed":   { s6: 22, s8: 24, s12: 26 },
  "23bed":  { s6: 22, s8: 24, s12: 26 },
  "34semi": { s6: 25, s8: 27, s12: 30 },
  "3det":   { s6: 26, s8: 29, s12: 32 },
  "4det":   { s6: 30, s8: 33, s12: 35 },
  "5plus":  { s6: 38, s8: 42, s12: 46 },
};
const FASCIA_PRICES = { "2bed": 80, "23bed": 80, "34semi": 130, "3det": 130, "4det": 130, "5plus": 150 };
const ROOF_PRICES   = {
  "2bed":   { min: 900,  max: 1500 },
  "23bed":  { min: 900,  max: 1500 },
  "34semi": { min: 1100, max: 2000 },
  "3det":   { min: 1100, max: 2000 },
  "4det":   { min: 1100, max: 2000 },
  "5plus":  { min: 1800, max: 3200 },
};

// Window schedule options
const WIN_SCHEDULES = [
  { id: "s6",  label: "Every 6 weeks",  visitsPerYear: 8.7, shortLabel: "6-weekly"  },
  { id: "s8",  label: "Every 8 weeks",  visitsPerYear: 6.5, shortLabel: "8-weekly"  },
  { id: "s12", label: "Every 12 weeks", visitsPerYear: 4.3, shortLabel: "12-weekly" },
];

// Window access premiums
const WIN_ACCESS = [
  { id: "none",      label: "No access issues",           premium: 0  },
  { id: "ext",       label: "Extension / conservatory",   premium: 10 },
  { id: "difficult", label: "Difficult access",           premium: 15 },
  { id: "restrict",  label: "Very restricted / scaffold", premium: 25 },
];

// Gutter cleaning frequency options
const GUTTER_FREQ = [
  { id: "1x", label: "Once a year",   visitsPerYear: 1 },
  { id: "2x", label: "Twice a year",  visitsPerYear: 2 },
  { id: "3x", label: "3× per year",   visitsPerYear: 3 },
];

// Conservatory add-on prices
const CONSERV_GUTTER = 45;
const CONSERV_FASCIA  = 35;

// Interactive equipment options per service
const EQUIP_OPTS = {
  windows: [
    { id: "winMethod", label: "Cleaning method", opts: [
      { id: "wfp",  label: "Water-fed pole" },
      { id: "trad", label: "Traditional (squeegee)" },
      { id: "both", label: "Both methods" },
    ]},
    { id: "winLadder", label: "Ladder / access", opts: [
      { id: "none",   label: "No ladder needed" },
      { id: "ext",    label: "Extension ladder" },
      { id: "loft",   label: "Loft ladder" },
      { id: "triple", label: "Triple / combination" },
    ]},
  ],
  gutters: [
    { id: "gutMethod", label: "Cleaning method", opts: [
      { id: "vac",  label: "Gutter vac system" },
      { id: "hand", label: "Hand tools & scoop" },
      { id: "both", label: "Vac + hand tools" },
    ]},
    { id: "gutAccess", label: "Access equipment", opts: [
      { id: "ladder", label: "Extension ladder" },
      { id: "tower",  label: "Scaffold tower" },
      { id: "steps",  label: "Step ladders only" },
    ]},
    { id: "gutGen", label: "Generator", opts: [
      { id: "no",  label: "No generator needed" },
      { id: "yes", label: "Generator required" },
    ]},
  ],
  fascia: [
    { id: "fasMethod", label: "Cleaning method", opts: [
      { id: "wfp",  label: "Water-fed pole" },
      { id: "hand", label: "Hand clean / brush" },
    ]},
    { id: "fasLadder", label: "Ladder type", opts: [
      { id: "ext",   label: "Extension ladder" },
      { id: "tower", label: "Scaffold tower" },
    ]},
  ],
  roof: [
    { id: "roofAccess", label: "Access equipment", opts: [
      { id: "tower",   label: "Scaffold tower" },
      { id: "harness", label: "Harness & ladder" },
      { id: "picker",  label: "Cherry picker" },
    ]},
    { id: "roofMethod", label: "Cleaning method", opts: [
      { id: "steam",    label: "Steam cleaned" },
      { id: "hand",     label: "Hand cleaned" },
      { id: "softwash", label: "Soft-wash chemical" },
    ]},
    { id: "roofScraper", label: "Scraper profile", opts: [
      { id: "no",  label: "No scraping needed" },
      { id: "yes", label: "Profile scraping needed" },
    ]},
  ],
};

// Pressure washing
const PW_SURFACES = [
  { id: "driveway", label: "Driveway / patio", rateMin: 3.0, rateMax: 5.0 },
  { id: "decking",  label: "Decking",          rateMin: 3.0, rateMax: 4.0 },
  { id: "block",    label: "Block paving",     rateMin: 4.0, rateMax: 6.0 },
  { id: "path",     label: "Paths / steps",    rateMin: 3.0, rateMax: 4.0 },
  { id: "yard",     label: "Commercial yard",  rateMin: 2.5, rateMax: 4.0 },
  { id: "other",    label: "Other surface",    rateMin: 3.0, rateMax: 5.0 },
];

const PW_EXTRAS = [
  { id: "oil",     label: "Oil / rust stain treatment", addPerSqm: 1.0 },
  { id: "sand",    label: "Re-sanding after",           addPerSqm: 1.5 },
  { id: "nowater", label: "No water on site",           addPerSqm: 0.5 },
];

const PW_MIN = 50; // minimum pressure wash price

// Local glassmorphism card for ExteriorTab
const GCard = ({ children, className = "" }) => (
  <div className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] bg-gradient-to-br from-[#010a4f] via-[#05124a] to-[#0d1e78] ${className}`}>
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
    <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "linear-gradient(#99c5ff 1px, transparent 1px), linear-gradient(90deg, #99c5ff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
    <div className="relative">{children}</div>
  </div>
);

// ── small helper to render an option-group row inside a service card ──────────
function EquipGroup({ group, value, onChange }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">{group.label}</p>
      <div className="flex flex-wrap gap-1.5">
        {group.opts.map(opt => {
          const on = value === opt.id;
          return (
            <button key={opt.id} onClick={() => onChange(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                on
                  ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                  : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white"
              }`}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── small helper: prominent price input with market-avg hint ─────────────────
function PriceInput({ label, value, onChange, avgPrice, hint }) {
  return (
    <div className="px-4 py-3 bg-[rgba(153,197,255,0.05)] rounded-xl border border-[rgba(153,197,255,0.12)]">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-lg font-black text-[rgba(153,197,255,0.6)]">£</span>
        <input
          type="number" min="0" step="0.50"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={avgPrice ? String(avgPrice) : "0"}
          className="flex-1 bg-transparent text-2xl font-black text-white placeholder-[rgba(153,197,255,0.2)] focus:outline-none w-0 min-w-0"
        />
        {value && (
          <button onClick={() => onChange("")} className="text-[10px] text-[rgba(153,197,255,0.35)] hover:text-white shrink-0">reset</button>
        )}
      </div>
      {avgPrice && (
        <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-1">
          {value ? `Market avg for this size: £${avgPrice}` : `Market avg: £${avgPrice} — enter your own above`}
        </p>
      )}
      {hint && <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5">{hint}</p>}
    </div>
  );
}

function ExteriorTab({ accounts, onSaveQuote, onAcceptQuote, customers = [], initialQuotes = [] }) {
  const navigate = useNavigate();
  const { addJobAndSyncCustomer } = useData();

  const [services,         setServices]         = useState([]);
  const [propSize,         setPropSize]         = useState("");
  const [winSchedule,      setWinSchedule]      = useState("s6");
  const [winAccess,        setWinAccess]        = useState("none");
  const [winAccessCustom,  setWinAccessCustom]  = useState("");
  const [pwSurface,        setPwSurface]        = useState("driveway");
  const [pwArea,           setPwArea]           = useState("");
  const [pwExtras,         setPwExtras]         = useState([]);
  const [customer,         setCustomer]         = useState("");
  const [custSearch,       setCustSearch]       = useState("");
  const [showCustDrop,     setShowCustDrop]     = useState(false);
  const [notes,            setNotes]            = useState("");
  const [savedQuotes,      setSavedQuotes]      = useState([]);
  const [saved,            setSaved]            = useState(false);
  const [lastQuote,        setLastQuote]        = useState(null);
  // Your own prices — starts blank so user is prompted immediately
  const [winCustom,     setWinCustom]     = useState("");
  const [gutterCustom,  setGutterCustom]  = useState("");
  const [fasciaCustom,  setFasciaCustom]  = useState("");
  // Gutter options
  const [gutterFreq,    setGutterFreq]    = useState("1x");
  const [gutterConserv, setGutterConserv] = useState(false);
  // Fascia options
  const [fasciaConserv, setFasciaConserv] = useState(false);
  // Equipment selections: { groupId: optionId }
  const [equip, setEquip] = useState({});
  const setEquipVal = (groupId, optId) => setEquip(prev => ({ ...prev, [groupId]: optId }));

  // ── Price calculations ──────────────────────────────────────────────────────
  const sizeKey = propSize || "23bed";

  // Windows — user price first, market avg as fallback
  const winAvg        = WINDOW_PRICES[sizeKey]?.[winSchedule] ?? 0;
  const winBase       = winCustom !== "" ? parseFloat(winCustom) || 0 : winAvg;
  const winAccessSugg = WIN_ACCESS.find(a => a.id === winAccess)?.premium ?? 0;
  const winAccPrem    = winAccessCustom !== "" ? parseFloat(winAccessCustom) || 0 : winAccessSugg;
  const winPrice   = winBase + winAccPrem;
  const winSched   = WIN_SCHEDULES.find(s => s.id === winSchedule);
  const winAnnual  = Math.round(winPrice * (winSched?.visitsPerYear ?? 8.7));
  const winMonthly = Math.round(winAnnual / 12);

  // Gutters
  const gutterAvg      = GUTTER_PRICES[sizeKey] ?? 0;
  const gutterBase     = gutterCustom !== "" ? parseFloat(gutterCustom) || 0 : gutterAvg;
  const gutterConvAmt  = gutterConserv ? CONSERV_GUTTER : 0;
  const gutterPrice    = gutterBase + gutterConvAmt;
  const gutterFreqObj  = GUTTER_FREQ.find(f => f.id === gutterFreq) ?? GUTTER_FREQ[0];
  const gutterAnnual   = gutterPrice * gutterFreqObj.visitsPerYear;

  // Fascia
  const fasciaAvg     = FASCIA_PRICES[sizeKey] ?? 0;
  const fasciaBase    = fasciaCustom !== "" ? parseFloat(fasciaCustom) || 0 : fasciaAvg;
  const fasciaConvAmt = fasciaConserv ? CONSERV_FASCIA : 0;
  const fasciaPrice   = fasciaBase + fasciaConvAmt;

  // Roof
  const roofRange = ROOF_PRICES[sizeKey] ?? { min: 900, max: 1500 };

  // Pressure washing
  const pwSurfObj   = PW_SURFACES.find(s => s.id === pwSurface) ?? PW_SURFACES[0];
  const sqm         = parseFloat(pwArea) || 0;
  const pwExtraRate = pwExtras.reduce((s, id) => s + (PW_EXTRAS.find(e => e.id === id)?.addPerSqm ?? 0), 0);
  const pwRateMin   = pwSurfObj.rateMin + pwExtraRate;
  const pwRateMax   = pwSurfObj.rateMax + pwExtraRate;
  const pwPriceMin  = Math.max(PW_MIN, Math.round(sqm * pwRateMin));
  const pwPriceMax  = Math.max(PW_MIN, Math.round(sqm * pwRateMax));

  // Total
  const totalMin = (services.includes("windows")  ? winPrice    : 0)
                 + (services.includes("gutters")  ? gutterPrice : 0)
                 + (services.includes("fascia")   ? fasciaPrice : 0)
                 + (services.includes("pressure") && sqm > 0 ? pwPriceMin : 0);
  const totalMax = (services.includes("windows")  ? winPrice    : 0)
                 + (services.includes("gutters")  ? gutterPrice : 0)
                 + (services.includes("fascia")   ? fasciaPrice : 0)
                 + (services.includes("pressure") && sqm > 0 ? pwPriceMax : 0)
                 + (services.includes("roof")     ? roofRange.max : 0);

  const toggleService = (id) => {
    setServices(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  // Customer autocomplete
  const custMatches = custSearch.length > 1
    ? customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0, 5)
    : [];

  const pickCustomer = (c) => {
    setCustomer(c.name);
    setCustSearch(c.name);
    setShowCustDrop(false);
  };

  // Build a human-readable equipment summary for the quote notes
  const equipSummary = services.flatMap(svcId => {
    const groups = EQUIP_OPTS[svcId] ?? [];
    return groups.map(g => {
      const chosenOpt = g.opts.find(o => o.id === (equip[g.id] ?? g.opts[0].id));
      return `${g.label}: ${chosenOpt?.label ?? "—"}`;
    });
  }).join(" | ");

  const saveQuote = () => {
    if (!customer) return;
    const typeLabel = services.map(s => EXT_SERVICES.find(x => x.id === s)?.label).join(", ");
    const today = new Date().toISOString().slice(0, 10);
    const quote = {
      customer,
      jobLabel:  customer,
      price:     totalMin,
      type:      typeLabel,
      freq:      services.includes("windows") ? winSched?.shortLabel ?? "one-off" : "one-off",
      savedAt:   new Date().toISOString(),
      hrs:       0,
      notes:     [notes, equipSummary].filter(Boolean).join("\n\nEquipment: "),
      equipment: equip,
    };
    setSavedQuotes(prev => [quote, ...prev]);
    setLastQuote(quote);
    onSaveQuote?.(quote);
    // Sync to DataContext so customer history + scheduler both see it
    addJobAndSyncCustomer?.({
      id:          `ext-${Date.now()}`,
      customer,
      date:        today,
      startHour:   9,
      durationHrs: Math.max(1, Math.round(totalMin / 30)),
      service:     typeLabel,
      price:       totalMin,
      status:      "quoted",
      notes:       quote.notes,
      color:       "#1f48ff",
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-4 lg:p-6 bg-[#010a4f] min-h-full space-y-4">
      {/* Page header */}
      <div>
        <p className="text-xl font-black text-white">Exterior Pricing</p>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Enter your own prices — market averages shown as a guide</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">

        {/* ── Left — questions ── */}
        <div className="space-y-4">

          {/* 1. Service selector */}
          <GCard>
            <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Step 1</p>
              <p className="text-sm font-black text-white mt-0.5">Which services are you quoting?</p>
              <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">Select all that apply</p>
            </div>
            <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EXT_SERVICES.map(svc => {
                const on = services.includes(svc.id);
                return (
                  <button key={svc.id} onClick={() => toggleService(svc.id)}
                    className={`relative rounded-xl p-3 text-left border transition-all ${
                      on
                        ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 shadow-lg shadow-[#1f48ff]/15"
                        : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.10)] hover:border-[rgba(153,197,255,0.25)]"
                    }`}>
                    <span className="text-xl block mb-1">{svc.emoji}</span>
                    <p className={`text-xs font-black leading-tight ${on ? "text-white" : "text-[rgba(153,197,255,0.7)]"}`}>{svc.label}</p>
                    <p className={`text-[10px] mt-0.5 ${on ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.35)]"}`}>{svc.desc}</p>
                    {on && <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#1f48ff] flex items-center justify-center text-white text-[9px] font-black">✓</div>}
                  </button>
                );
              })}
            </div>
          </GCard>

          {/* 2. Property size */}
          {services.some(s => ["windows","gutters","fascia","roof"].includes(s)) && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Step 2</p>
                <p className="text-sm font-black text-white mt-0.5">Property size</p>
                <p className="text-xs text-[rgba(153,197,255,0.4)] mt-0.5">Used to show market average reference prices</p>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EXT_SIZES.map(sz => (
                  <button key={sz.id} onClick={() => setPropSize(sz.id)}
                    className={`rounded-xl px-3 py-2.5 text-sm font-bold border transition-all ${
                      propSize === sz.id
                        ? "bg-[#1f48ff] text-white border-[#1f48ff] shadow-lg shadow-[#1f48ff]/25"
                        : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.10)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white"
                    }`}>
                    {sz.label}
                  </button>
                ))}
              </div>
            </GCard>
          )}

          {/* 3. Window cleaning */}
          {services.includes("windows") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">🪟</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">Window cleaning</p>
                  {winPrice > 0 && <p className="text-xs text-emerald-400 font-bold">£{winPrice}/visit · £{winAnnual}/yr</p>}
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Your price — PROMINENT */}
                <PriceInput
                  label="Your price per visit"
                  value={winCustom}
                  onChange={setWinCustom}
                  avgPrice={propSize ? winAvg : null}
                  hint={!propSize ? "Select property size to see market average" : null}
                />
                {/* Schedule */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Cleaning schedule</p>
                  <div className="flex gap-2">
                    {WIN_SCHEDULES.map(sc => (
                      <button key={sc.id} onClick={() => setWinSchedule(sc.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          winSchedule === sc.id
                            ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                            : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)]"
                        }`}>
                        {sc.label}
                        {propSize && (
                          <span className={`block text-[10px] mt-0.5 font-black ${winSchedule === sc.id ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.4)]"}`}>
                            avg £{WINDOW_PRICES[sizeKey]?.[sc.id]}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Access */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Access & difficulty</p>
                  <div className="space-y-1.5">
                    {WIN_ACCESS.map(a => (
                      <button key={a.id}
                        onClick={() => {
                          setWinAccess(a.id);
                          // pre-fill the input with the suggestion so user can edit it
                          setWinAccessCustom(a.premium > 0 ? String(a.premium) : "");
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                          winAccess === a.id
                            ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white"
                            : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.55)] hover:border-[rgba(153,197,255,0.2)]"
                        }`}>
                        <span>{a.label}</span>
                        <span className={`font-mono text-[10px] ${a.premium > 0 ? "text-[rgba(153,197,255,0.4)]" : "text-[rgba(153,197,255,0.25)]"}`}>
                          {a.premium > 0 ? `suggested +£${a.premium}` : "no add"}
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Custom access add-on input */}
                  {winAccess !== "none" && (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.12)]">
                      <span className="text-xs text-[rgba(153,197,255,0.5)] font-bold shrink-0">Your add-on £</span>
                      <input
                        type="number" min="0" step="0.50"
                        value={winAccessCustom}
                        onChange={e => setWinAccessCustom(e.target.value)}
                        placeholder={String(winAccessSugg)}
                        className="flex-1 bg-transparent text-sm font-black text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none w-0 min-w-0"
                      />
                      {winAccessCustom && parseFloat(winAccessCustom) !== winAccessSugg && (
                        <button onClick={() => setWinAccessCustom(String(winAccessSugg))}
                          className="text-[10px] text-[rgba(153,197,255,0.35)] hover:text-white shrink-0">reset</button>
                      )}
                    </div>
                  )}
                  {winAccess !== "none" && (
                    <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-1 px-1">
                      {winAccessCustom && parseFloat(winAccessCustom) !== winAccessSugg
                        ? `Using your add-on: +£${winAccessCustom} (suggested: £${winAccessSugg})`
                        : `Using suggested add-on: +£${winAccessSugg}`}
                    </p>
                  )}
                </div>
                {/* Equipment */}
                <div className="pt-1 border-t border-[rgba(153,197,255,0.08)] space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)]">🧰 Equipment for this job</p>
                  {(EQUIP_OPTS.windows ?? []).map(g => (
                    <EquipGroup key={g.id} group={g} value={equip[g.id] ?? g.opts[0].id} onChange={v => setEquipVal(g.id, v)} />
                  ))}
                </div>
                {/* Annual value */}
                {winPrice > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex-1">
                      <p className="text-xs text-emerald-300 font-semibold">Annual contract value</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{winSched?.visitsPerYear} visits/yr · £{winPrice}/visit</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-emerald-400 tabular-nums">£{winAnnual}</p>
                      <p className="text-[10px] text-emerald-400">£{winMonthly}/mo</p>
                    </div>
                  </div>
                )}
              </div>
            </GCard>
          )}

          {/* 4. Gutter cleaning */}
          {services.includes("gutters") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">🏠</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">Gutter cleaning</p>
                  {gutterPrice > 0 && <p className="text-xs text-emerald-400 font-bold">£{gutterPrice}/visit · £{gutterAnnual}/yr</p>}
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Your price — PROMINENT */}
                <PriceInput
                  label="Your price per visit"
                  value={gutterCustom}
                  onChange={setGutterCustom}
                  avgPrice={propSize ? gutterAvg : null}
                  hint={!propSize ? "Select property size to see market average" : null}
                />
                {/* Frequency */}
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Cleaning frequency</p>
                  <div className="flex gap-2">
                    {GUTTER_FREQ.map(f => (
                      <button key={f.id} onClick={() => setGutterFreq(f.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                          gutterFreq === f.id
                            ? "bg-[#1f48ff] text-white border-[#1f48ff]"
                            : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)]"
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Conservatory */}
                <button onClick={() => setGutterConserv(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    gutterConserv
                      ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white"
                      : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.55)] hover:border-[rgba(153,197,255,0.2)]"
                  }`}>
                  <span>Includes conservatory gutters</span>
                  <span className={`font-mono font-bold ${gutterConserv ? "text-amber-400" : "text-[rgba(153,197,255,0.35)]"}`}>
                    {gutterConserv ? `+£${CONSERV_GUTTER} added` : `+£${CONSERV_GUTTER}`}
                  </span>
                </button>
                {/* Equipment */}
                <div className="pt-1 border-t border-[rgba(153,197,255,0.08)] space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)]">🧰 Equipment for this job</p>
                  {(EQUIP_OPTS.gutters ?? []).map(g => (
                    <EquipGroup key={g.id} group={g} value={equip[g.id] ?? g.opts[0].id} onChange={v => setEquipVal(g.id, v)} />
                  ))}
                </div>
                {/* Annual value */}
                {gutterPrice > 0 && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="flex-1">
                      <p className="text-xs text-emerald-300 font-semibold">Annual gutter value</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{gutterFreqObj.visitsPerYear}× per year · £{gutterPrice}/visit</p>
                    </div>
                    <p className="text-xl font-black text-emerald-400 tabular-nums">£{gutterAnnual}</p>
                  </div>
                )}
              </div>
            </GCard>
          )}

          {/* 5. Roof cleaning */}
          {services.includes("roof") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">🏡</span>
                <p className="text-sm font-black text-white">Roof cleaning — guide pricing</p>
              </div>
              <div className="p-4 space-y-4">
                {propSize && (
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)]">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold tracking-wide uppercase text-[rgba(153,197,255,0.45)] mb-0.5">Market guide range</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Includes gutter clean + biocide treatment</p>
                    </div>
                    <p className="text-lg font-black text-white">£{roofRange.min.toLocaleString()}–£{roofRange.max.toLocaleString()}</p>
                  </div>
                )}
                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <span className="text-amber-400 font-black text-sm shrink-0 mt-px">⚠</span>
                  <div>
                    <p className="text-xs font-bold text-amber-300">Visual quote required</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.5)] leading-relaxed mt-0.5">
                      Prices vary significantly by pitch, condition, moss coverage and access. Always visit before quoting.
                    </p>
                  </div>
                </div>
                {!propSize && <p className="text-xs text-amber-400 font-semibold">Select property size above to see guide range.</p>}
                {/* Equipment */}
                <div className="pt-1 border-t border-[rgba(153,197,255,0.08)] space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)]">🧰 Equipment for this job</p>
                  {(EQUIP_OPTS.roof ?? []).map(g => (
                    <EquipGroup key={g.id} group={g} value={equip[g.id] ?? g.opts[0].id} onChange={v => setEquipVal(g.id, v)} />
                  ))}
                </div>
              </div>
            </GCard>
          )}

          {/* 6. Fascia & soffit */}
          {services.includes("fascia") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">🔧</span>
                <div className="flex-1">
                  <p className="text-sm font-black text-white">Fascia & soffit cleaning</p>
                  {fasciaPrice > 0 && <p className="text-xs text-emerald-400 font-bold">£{fasciaPrice}</p>}
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Your price — PROMINENT */}
                <PriceInput
                  label="Your price"
                  value={fasciaCustom}
                  onChange={setFasciaCustom}
                  avgPrice={propSize ? fasciaAvg : null}
                  hint={!propSize ? "Select property size to see market average" : "Includes fascias, soffits and bargeboards"}
                />
                {/* Conservatory */}
                <button onClick={() => setFasciaConserv(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                    fasciaConserv
                      ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white"
                      : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.55)] hover:border-[rgba(153,197,255,0.2)]"
                  }`}>
                  <span>Includes conservatory fascia & soffit</span>
                  <span className={`font-mono font-bold ${fasciaConserv ? "text-amber-400" : "text-[rgba(153,197,255,0.35)]"}`}>
                    {fasciaConserv ? `+£${CONSERV_FASCIA} added` : `+£${CONSERV_FASCIA}`}
                  </span>
                </button>
                {/* Equipment */}
                <div className="pt-1 border-t border-[rgba(153,197,255,0.08)] space-y-3">
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)]">🧰 Equipment for this job</p>
                  {(EQUIP_OPTS.fascia ?? []).map(g => (
                    <EquipGroup key={g.id} group={g} value={equip[g.id] ?? g.opts[0].id} onChange={v => setEquipVal(g.id, v)} />
                  ))}
                </div>
              </div>
            </GCard>
          )}

          {/* 7. Render cleaning */}
          {services.includes("render") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">🏗</span>
                <p className="text-sm font-black text-white">Render cleaning</p>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)]">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold tracking-wide uppercase text-[rgba(153,197,255,0.45)] mb-0.5">Starting from</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Price upon request</p>
                  </div>
                  <p className="text-xl font-black text-white">£420</p>
                </div>
                <p className="text-xs text-[rgba(153,197,255,0.55)] leading-relaxed">
                  Render prices depend on area, render type, staining and access. Use the site notes to capture details for your follow-up quote.
                </p>
              </div>
            </GCard>
          )}

          {/* 8. Pressure washing */}
          {services.includes("pressure") && (
            <GCard>
              <div className="px-4 py-3 border-b border-[rgba(153,197,255,0.08)] flex items-center gap-2">
                <span className="text-lg">💧</span>
                <p className="text-sm font-black text-white">Pressure washing</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Surface type</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {PW_SURFACES.map(s => (
                      <button key={s.id} onClick={() => setPwSurface(s.id)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-left ${
                          pwSurface === s.id
                            ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white"
                            : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.55)] hover:border-[rgba(153,197,255,0.2)]"
                        }`}>
                        <span className="block">{s.label}</span>
                        <span className={`text-[10px] font-mono mt-0.5 block ${pwSurface === s.id ? "text-[#99c5ff]" : "text-[rgba(153,197,255,0.3)]"}`}>
                          avg £{s.rateMin}–£{s.rateMax}/m²
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Area (m²)</p>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" value={pwArea} onChange={e => setPwArea(e.target.value)}
                      placeholder="e.g. 45"
                      className="flex-1 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors" />
                    <span className="text-sm text-[rgba(153,197,255,0.4)] font-semibold">m²</span>
                  </div>
                  <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-1">Minimum charge £{PW_MIN}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Additional requirements</p>
                  <div className="space-y-1.5">
                    {PW_EXTRAS.map(ex => {
                      const on = pwExtras.includes(ex.id);
                      return (
                        <button key={ex.id} onClick={() => setPwExtras(prev => on ? prev.filter(x => x !== ex.id) : [...prev, ex.id])}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                            on
                              ? "bg-[#1f48ff]/15 border-[#1f48ff]/40 text-white"
                              : "bg-[rgba(153,197,255,0.03)] border-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.55)] hover:border-[rgba(153,197,255,0.2)]"
                          }`}>
                          <span>{ex.label}</span>
                          <span className={`font-mono ${on ? "text-amber-400" : "text-[rgba(153,197,255,0.3)]"}`}>+£{ex.addPerSqm}/m²</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {sqm > 0 && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div>
                      <p className="text-xs font-bold text-emerald-300">Pressure wash estimate</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{sqm}m² × £{pwRateMin.toFixed(1)}–£{pwRateMax.toFixed(1)}/m²</p>
                    </div>
                    <p className="text-lg font-black text-emerald-400">£{pwPriceMin}–£{pwPriceMax}</p>
                  </div>
                )}
              </div>
            </GCard>
          )}

          {/* Customer name + notes */}
          {services.length > 0 && (
            <GCard className="p-4 space-y-3">
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Quote details</p>
              {/* Customer autocomplete */}
              <div>
                <label className="block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Customer name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={custSearch || customer}
                    onChange={e => {
                      const v = e.target.value;
                      setCustSearch(v);
                      setCustomer(v);
                      setShowCustDrop(true);
                    }}
                    onFocus={() => setShowCustDrop(true)}
                    onBlur={() => setTimeout(() => setShowCustDrop(false), 150)}
                    placeholder="Search existing or type new name…"
                    className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
                  />
                  {showCustDrop && custMatches.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0d1e78] border border-[rgba(153,197,255,0.18)] rounded-xl overflow-hidden shadow-2xl">
                      {custMatches.map(c => (
                        <button key={c.id} onMouseDown={() => pickCustomer(c)}
                          className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-[#1f48ff]/30 transition-colors flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-[#1f48ff]/40 flex items-center justify-center text-[10px] font-black shrink-0">
                            {c.name[0]?.toUpperCase()}
                          </span>
                          <span className="flex-1 font-semibold">{c.name}</span>
                          <span className="text-[rgba(153,197,255,0.4)] text-[10px]">{c.postcode}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {customer && customers.find(c => c.name.toLowerCase() === customer.toLowerCase()) && (
                  <p className="text-[10px] text-emerald-400 mt-1 font-semibold">✓ Existing customer — quote will link to their profile</p>
                )}
                {customer && !customers.find(c => c.name.toLowerCase() === customer.toLowerCase()) && (
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-1">New name — will be created when job is booked</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Site notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  placeholder="Access, parking, dog, render type, gate codes…"
                  className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors resize-none" />
              </div>
            </GCard>
          )}
        </div>

        {/* ── Right — Quote panel ── */}
        <div className="xl:sticky xl:top-4 space-y-4 self-start">
          {services.length === 0 ? (
            <GCard className="p-8 text-center">
              <span className="text-4xl block mb-3">🧮</span>
              <p className="text-sm font-bold text-[rgba(153,197,255,0.5)]">Select services to start</p>
              <p className="text-xs text-[rgba(153,197,255,0.3)] mt-1">Enter your own prices for an instant quote</p>
            </GCard>
          ) : (
            <GCard>
              {/* Header */}
              <div className="px-4 py-4 border-b border-[rgba(153,197,255,0.08)]">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">Your quote</p>
                {totalMin > 0 ? (
                  <p className="text-4xl font-black text-white tabular-nums">
                    £{totalMin}{totalMin !== totalMax && services.includes("pressure") && sqm > 0 ? `–${totalMax}` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-[rgba(153,197,255,0.4)]">Enter your prices on the left</p>
                )}
                {services.includes("roof") && (
                  <p className="text-xs text-amber-400 font-semibold mt-1">+ roof: guide £{roofRange.min.toLocaleString()}–£{roofRange.max.toLocaleString()}</p>
                )}
                {services.includes("render") && (
                  <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">+ render: price on request from £420</p>
                )}
              </div>

              {/* Line items */}
              <div className="divide-y divide-[rgba(153,197,255,0.06)]">
                {services.includes("windows") && winPrice > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">🪟</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Window cleaning</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{winSched?.shortLabel} · {winSched?.visitsPerYear} visits/yr</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white tabular-nums">£{winPrice}/visit</p>
                      <p className="text-[10px] text-emerald-400 font-bold">£{winAnnual}/yr</p>
                    </div>
                  </div>
                )}
                {services.includes("gutters") && gutterPrice > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">🏠</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Gutter cleaning</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{gutterFreqObj.label}{gutterConserv ? " · incl. conservatory" : ""}</p>
                      <p className="text-[10px] text-emerald-400 font-bold">£{gutterAnnual}/yr</p>
                    </div>
                    <p className="text-sm font-black text-white tabular-nums">£{gutterPrice}</p>
                  </div>
                )}
                {services.includes("fascia") && fasciaPrice > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">🔧</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Fascia & soffit</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">One-off{fasciaConserv ? " · incl. conservatory" : ""}</p>
                    </div>
                    <p className="text-sm font-black text-white tabular-nums">£{fasciaPrice}</p>
                  </div>
                )}
                {services.includes("roof") && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">🏡</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Roof cleaning</p>
                      <p className="text-[10px] text-amber-400 font-semibold">Guide — visit to quote</p>
                    </div>
                    {propSize && <p className="text-sm font-black text-white tabular-nums">£{roofRange.min.toLocaleString()}–{roofRange.max.toLocaleString()}</p>}
                  </div>
                )}
                {services.includes("render") && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">🏗</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Render cleaning</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Price on request</p>
                    </div>
                    <p className="text-sm font-black text-[rgba(153,197,255,0.5)] tabular-nums">from £420</p>
                  </div>
                )}
                {services.includes("pressure") && sqm > 0 && (
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-base">💧</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-white">Pressure washing</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{sqm}m² · {pwSurfObj.label}</p>
                    </div>
                    <p className="text-sm font-black text-white tabular-nums">£{pwPriceMin}–£{pwPriceMax}</p>
                  </div>
                )}
              </div>

              {/* Window annual callout */}
              {services.includes("windows") && winPrice > 0 && (
                <div className="mx-3 mb-3 mt-1 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide mb-0.5">Window contract value</p>
                  <div className="flex justify-between">
                    <span className="text-xs text-[rgba(153,197,255,0.5)]">Monthly income</span>
                    <span className="text-xs font-black text-emerald-400">£{winMonthly}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[rgba(153,197,255,0.5)]">Annual value</span>
                    <span className="text-xs font-black text-emerald-400">£{winAnnual}/yr</span>
                  </div>
                </div>
              )}

              {/* Equipment summary */}
              {equipSummary && (
                <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.08)]">
                  <p className="text-[10px] font-bold text-[rgba(153,197,255,0.5)] uppercase tracking-wide mb-1">🧰 Equipment plan</p>
                  {equipSummary.split(" | ").map((item, i) => (
                    <p key={i} className="text-[10px] text-[rgba(153,197,255,0.6)] leading-relaxed">• {item}</p>
                  ))}
                </div>
              )}

              {/* Save & log to accounts */}
              <div className="p-3 space-y-2">
                <button onClick={saveQuote} disabled={!customer || totalMin === 0}
                  className={`w-full py-3 text-sm font-black rounded-xl transition-all ${
                    customer && totalMin > 0
                      ? "bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-lg shadow-[#1f48ff]/25"
                      : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.25)] cursor-not-allowed border border-[rgba(153,197,255,0.08)]"
                  }`}>
                  {saved ? "✓ Saved & logged to accounts" : customer && totalMin > 0 ? "Save quote + log to accounts →" : !customer ? "Add customer name to save" : "Enter your prices to save"}
                </button>
                {customer && totalMin > 0 && !lastQuote && (
                  <p className="text-[10px] text-center text-[rgba(153,197,255,0.35)]">Logs income to Accounts · syncs to Customer history</p>
                )}

                {/* Post-save action buttons */}
                {lastQuote && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-emerald-400 font-black text-sm">✓</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-300">Quote saved</p>
                        <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Logged to accounts · linked to customer</p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/scheduler?customer=${encodeURIComponent(lastQuote.customer)}`)}
                      className="w-full py-2.5 rounded-xl text-xs font-black border border-[rgba(153,197,255,0.2)] bg-[rgba(153,197,255,0.06)] text-white hover:bg-[#1f48ff]/20 hover:border-[#1f48ff]/50 transition-all flex items-center justify-center gap-2">
                      <span>📅</span> Book as job in Scheduler →
                    </button>
                    <button
                      onClick={() => navigate("/customers")}
                      className="w-full py-2.5 rounded-xl text-xs font-bold border border-[rgba(153,197,255,0.12)] bg-transparent text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.3)] transition-all flex items-center justify-center gap-2">
                      <span>👤</span> View in Customers →
                    </button>
                  </div>
                )}
              </div>
            </GCard>
          )}

          {/* Saved quotes */}
          {savedQuotes.length > 0 && (
            <SavedQuotesList quotes={savedQuotes} onAccept={onAcceptQuote} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Walkthrough Mode ────────────────────────────────────────────────────────
const WALK_CONDITIONS = [
  { id:"quick",    label:"Quick",    mult:0.7,  desc:"Light — recently cleaned" },
  { id:"standard", label:"Standard", mult:1.0,  desc:"Normal condition"         },
  { id:"dirty",    label:"Attention",mult:1.3,  desc:"Needs extra time"         },
  { id:"deep",     label:"Deep",     mult:1.8,  desc:"Heavy soiling"            },
];

const ROOM_ADDONS = {
  kitchen:      ["Oven clean", "Fridge clean", "Hob descale", "Dishwasher clean"],
  bathroom:     ["Shower screen descale", "Limescale treatment", "Mould treatment", "Grout clean"],
  ensuite:      ["Shower screen descale", "Limescale treatment", "Mould treatment"],
  bedroom:      ["Carpet clean", "Wardrobe inside", "Ironing"],
  lounge:       ["Carpet clean", "Sofa clean", "Blinds clean"],
  dining:       ["Carpet clean", "Chair upholstery"],
  hallway:      ["Stairs carpet", "Skirting boards"],
  study:        ["Carpet clean"],
  conservatory: ["Interior windows", "Roof panels"],
  utility:      ["Appliance deep clean"],
};

const PROP_ROOM_STACK = {
  "1bed": ["hallway","lounge","kitchen","bathroom","bedroom"],
  "2bed": ["hallway","lounge","kitchen","bathroom","bedroom","bedroom"],
  "3bed": ["hallway","lounge","dining","kitchen","bathroom","bedroom","bedroom","bedroom"],
  "4bed": ["hallway","lounge","dining","kitchen","bathroom","ensuite","bedroom","bedroom","bedroom","bedroom"],
  "5bed": ["hallway","lounge","dining","kitchen","bathroom","ensuite","ensuite","bedroom","bedroom","bedroom","bedroom","bedroom"],
};

const COND_STYLES = {
  quick:    { active:"bg-emerald-500 text-white border-emerald-500",  inactive:"bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50" },
  standard: { active:"bg-brand-blue text-white border-brand-blue",    inactive:"bg-white text-brand-blue border-blue-200 hover:bg-blue-50"        },
  dirty:    { active:"bg-amber-500 text-white border-amber-500",       inactive:"bg-white text-amber-700 border-amber-200 hover:bg-amber-50"        },
  deep:     { active:"bg-red-500 text-white border-red-500",           inactive:"bg-white text-red-700 border-red-200 hover:bg-red-50"              },
};

function WalkthroughTab({ accounts, onSaveQuote, customers = [] }) {
  const navigate = useNavigate();
  const { addJobAndSyncCustomer } = useData();

  const [step,         setStep]         = useState('setup');
  const [propSize,     setPropSize]     = useState('');
  const [cleanType,    setCleanType]    = useState('regular');
  const [rooms,        setRooms]        = useState([]);
  const [showAddRoom,  setShowAddRoom]  = useState(false);
  const [customer,     setCustomer]     = useState('');
  const [custSearch,   setCustSearch]   = useState('');
  const [showCustDrop, setShowCustDrop] = useState(false);
  const [notes,        setNotes]        = useState('');
  const [lastQuote,    setLastQuote]    = useState(null);

  const cleanMult = CLEAN_TYPES.find(c => c.id === cleanType)?.mult ?? 1.0;

  const roomPrice = useCallback((room) => {
    const type     = ROOM_TYPES.find(r => r.id === room.typeId);
    const condMult = WALK_CONDITIONS.find(c => c.id === room.condition)?.mult ?? 1.0;
    const base     = Math.round((type?.basePrice ?? 0) * condMult * cleanMult);
    const addonsTotal = room.addons.reduce((sum, a) => sum + (parseFloat(a.price) || 0), 0);
    return base + addonsTotal;
  }, [cleanMult]);

  const totalPrice = rooms.reduce((s, r) => s + roomPrice(r), 0);
  const totalHrs   = rooms.reduce((s, room) => {
    const type = ROOM_TYPES.find(r => r.id === room.typeId);
    const cond = WALK_CONDITIONS.find(c => c.id === room.condition);
    return s + ((type?.mins ?? 30) * (cond?.mult ?? 1.0) * cleanMult) / 60;
  }, 0);

  const startWalkthrough = () => {
    const stack = PROP_ROOM_STACK[propSize] ?? [];
    setRooms(stack.map(typeId => ({ uid:uid(), typeId, condition:'standard', addons:[], note:'' })));
    setStep('rooms');
  };

  const updateRoom  = (id, upd)   => setRooms(prev => prev.map(r => r.uid === id ? { ...r, ...upd } : r));
  const removeRoom  = (id)        => setRooms(prev => prev.filter(r => r.uid !== id));
  const addRoom     = (typeId)    => { setRooms(prev => [...prev, { uid:uid(), typeId, condition:'standard', addons:[], note:'' }]); setShowAddRoom(false); };
  const toggleAddon = (roomId, label) => setRooms(prev => prev.map(r => {
    if (r.uid !== roomId) return r;
    const has = r.addons.some(a => a.label === label);
    return { ...r, addons: has ? r.addons.filter(a => a.label !== label) : [...r.addons, { label, price: '' }] };
  }));
  const updateAddonPrice = (roomId, label, price) => setRooms(prev => prev.map(r => {
    if (r.uid !== roomId) return r;
    return { ...r, addons: r.addons.map(a => a.label === label ? { ...a, price } : a) };
  }));
  const addCustomAddon = (roomId) => setRooms(prev => prev.map(r => {
    if (r.uid !== roomId) return r;
    return { ...r, addons: [...r.addons, { label: '', price: '', custom: true, uid: uid() }] };
  }));
  const updateCustomAddon = (roomId, addonUid, upd) => setRooms(prev => prev.map(r => {
    if (r.uid !== roomId) return r;
    return { ...r, addons: r.addons.map(a => a.uid === addonUid ? { ...a, ...upd } : a) };
  }));
  const removeAddon = (roomId, addonUid, label) => setRooms(prev => prev.map(r => {
    if (r.uid !== roomId) return r;
    return { ...r, addons: r.addons.filter(a => (a.uid ?? a.label) !== (addonUid ?? label)) };
  }));

  const custMatches = custSearch.length > 1
    ? customers.filter(c => c.name.toLowerCase().includes(custSearch.toLowerCase())).slice(0, 5)
    : [];

  const pickCustomer = (c) => { setCustomer(c.name); setCustSearch(c.name); setShowCustDrop(false); };

  const saveQuote = async () => {
    if (!customer) return;
    const cleanLabel = CLEAN_TYPES.find(c => c.id === cleanType)?.label ?? '';
    const roomLines  = rooms.map(r => {
      const type = ROOM_TYPES.find(t => t.id === r.typeId);
      const cond = WALK_CONDITIONS.find(c => c.id === r.condition);
      return `${type?.label ?? r.typeId} — ${cond?.label ?? r.condition}${r.addons.length ? ' + ' + r.addons.filter(a => a.label).map(a => `${a.label}${a.price ? ' £'+a.price : ''}`).join(', ') : ''}${r.note ? ' (' + r.note + ')' : ''}`;
    });
    const today = new Date().toISOString().slice(0, 10);
    const quoteObj = {
      customer,
      jobLabel: customer,
      price:    totalPrice,
      hrs:      Math.round(totalHrs * 10) / 10,
      type:     'walkthrough',
      freq:     cleanType === 'regular' ? 'weekly' : 'one-off',
      savedAt:  new Date().toISOString(),
      notes:    [`${cleanLabel} clean`, ...roomLines, notes].filter(Boolean).join('\n'),
    };
    await onSaveQuote?.(quoteObj);
    addJobAndSyncCustomer?.({
      id:          `wt-${Date.now()}`,
      customer,
      date:        today,
      startHour:   9,
      durationHrs: Math.max(1, Math.round(totalHrs)),
      service:     `Walkthrough — ${cleanLabel}`,
      price:       totalPrice,
      status:      'quoted',
      notes:       quoteObj.notes,
      color:       '#1f48ff',
    });
    setLastQuote(quoteObj);
  };

  const resetAll = () => { setStep('setup'); setPropSize(''); setRooms([]); setCustomer(''); setCustSearch(''); setNotes(''); setLastQuote(null); };

  // ── Step 1: Setup ────────────────────────────────────────────────────────────
  if (step === 'setup') {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
        <div className="text-center pb-1">
          <p className="text-xs font-bold tracking-widest uppercase text-brand-blue mb-1">Walkthrough mode</p>
          <h3 className="text-xl font-bold text-brand-navy">Walk the property, build the quote</h3>
          <p className="text-sm text-gray-500 mt-1">Choose property type to pre-load the room list, then scope each room as you walk around.</p>
        </div>

        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-gray-100"><SL>Property size</SL></div>
          <div className="p-4">
            <div className="grid grid-cols-5 gap-2">
              {PROPERTY_SIZES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPropSize(p.id)}
                  className={`flex flex-col items-center py-3 rounded-sm text-xs font-bold border transition-colors ${
                    propSize === p.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue'
                  }`}
                >
                  <span className="text-lg font-black">{p.beds}</span>
                  <span className="text-[10px] mt-0.5">{p.beds === 5 ? 'bed+' : 'bed'}</span>
                </button>
              ))}
            </div>
            {propSize && (
              <p className="mt-2 text-xs text-gray-400 text-center">
                {(PROP_ROOM_STACK[propSize] ?? []).length} rooms pre-loaded · you can add more during the walkthrough
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-gray-100"><SL>Type of clean</SL></div>
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2">
              {CLEAN_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setCleanType(ct.id)}
                  className={`flex flex-col items-start p-3 rounded-sm text-left border transition-colors ${
                    cleanType === ct.id ? 'bg-brand-navy text-white border-brand-navy' : 'bg-white text-gray-700 border-gray-200 hover:border-brand-blue'
                  }`}
                >
                  <span className="text-xs font-bold">{ct.label}</span>
                  <span className={`text-[10px] mt-0.5 ${cleanType === ct.id ? 'text-white/60' : 'text-gray-400'}`}>{ct.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>

        <button
          onClick={startWalkthrough}
          disabled={!propSize}
          className="w-full py-4 bg-brand-navy text-white font-black text-sm rounded-sm hover:bg-brand-blue transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start walkthrough →
        </button>
      </div>
    );
  }

  // ── Step 2: Room-by-room walkthrough ──────────────────────────────────────────
  if (step === 'rooms') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-4 py-4 space-y-3">

            <div className="flex items-center gap-3">
              <button onClick={() => setStep('setup')} className="text-xs text-gray-400 hover:text-gray-700 shrink-0">← Back</button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-navy truncate">
                  {PROPERTY_SIZES.find(p => p.id === propSize)?.label} · {CLEAN_TYPES.find(c => c.id === cleanType)?.label}
                </p>
                <p className="text-xs text-gray-400">{rooms.length} rooms · scope each as you walk through</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-black text-brand-navy">£{totalPrice}</p>
                <p className="text-[10px] text-gray-400">{Math.round(totalHrs * 10) / 10} hrs</p>
              </div>
            </div>

            {rooms.map((room) => {
              const type   = ROOM_TYPES.find(r => r.id === room.typeId);
              const addons = ROOM_ADDONS[room.typeId] ?? [];
              const price  = roomPrice(room);
              return (
                <Card key={room.uid}>
                  <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
                    <div>
                      <p className="text-sm font-bold text-brand-navy">{type?.label ?? room.typeId}</p>
                      <p className="text-xs text-gray-400">{type?.mins ?? 30} min base · £{type?.basePrice ?? 0} base price</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-base font-black text-brand-navy">£{price}</p>
                      <button onClick={() => removeRoom(room.uid)} className="text-gray-300 hover:text-red-400 transition-colors text-sm leading-none">✕</button>
                    </div>
                  </div>
                  <div className="p-3 space-y-2.5">
                    <div className="flex gap-1.5">
                      {WALK_CONDITIONS.map(cond => {
                        const s      = COND_STYLES[cond.id];
                        const active = room.condition === cond.id;
                        return (
                          <button
                            key={cond.id}
                            onClick={() => updateRoom(room.uid, { condition: cond.id })}
                            title={cond.desc}
                            className={`flex-1 py-1.5 text-xs font-bold border rounded-sm transition-colors ${active ? s.active : s.inactive}`}
                          >
                            {cond.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Suggestion chips — tap to add, no fixed price */}
                    {addons.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {addons.map(label => {
                          const on = room.addons.some(a => a.label === label);
                          return (
                            <button
                              key={label}
                              onClick={() => toggleAddon(room.uid, label)}
                              className={`px-2.5 py-1 text-xs font-bold border rounded-sm transition-colors ${
                                on
                                  ? 'bg-brand-blue text-white border-brand-blue'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue'
                              }`}
                            >
                              {on ? `✓ ${label}` : `+ ${label}`}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => addCustomAddon(room.uid)}
                          className="px-2.5 py-1 text-xs font-bold border border-dashed border-gray-300 text-gray-400 rounded-sm hover:border-brand-blue hover:text-brand-blue transition-colors"
                        >
                          + Custom
                        </button>
                      </div>
                    )}
                    {/* Selected add-ons with price inputs */}
                    {room.addons.length > 0 && (
                      <div className="space-y-1.5 pt-0.5">
                        {room.addons.map(addon => (
                          <div key={addon.uid ?? addon.label} className="flex items-center gap-2">
                            {addon.custom ? (
                              <input
                                type="text"
                                value={addon.label}
                                onChange={e => updateCustomAddon(room.uid, addon.uid, { label: e.target.value })}
                                placeholder="Extra description…"
                                className="flex-1 text-xs border border-gray-200 rounded-sm px-2 py-1.5 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-brand-blue"
                              />
                            ) : (
                              <span className="flex-1 text-xs text-gray-700 font-medium">{addon.label}</span>
                            )}
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-xs text-gray-400">£</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={addon.price}
                                onChange={e => addon.custom
                                  ? updateCustomAddon(room.uid, addon.uid, { price: e.target.value })
                                  : updateAddonPrice(room.uid, addon.label, e.target.value)
                                }
                                placeholder="0"
                                className="w-16 text-xs border border-gray-200 rounded-sm px-2 py-1.5 text-gray-700 focus:outline-none focus:border-brand-blue text-right"
                              />
                            </div>
                            <button
                              onClick={() => removeAddon(room.uid, addon.uid, addon.label)}
                              className="text-gray-300 hover:text-red-400 transition-colors text-xs shrink-0"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      value={room.note}
                      onChange={e => updateRoom(room.uid, { note: e.target.value })}
                      placeholder="Note (e.g. heavy limescale, pet hair, stained carpet)…"
                      className="w-full text-xs border border-gray-200 rounded-sm px-3 py-2 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </Card>
              );
            })}

            {showAddRoom ? (
              <Card>
                <div className="p-3">
                  <p className="text-xs font-bold text-gray-500 mb-2">Choose room to add</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ROOM_TYPES.map(rt => (
                      <button
                        key={rt.id}
                        onClick={() => addRoom(rt.id)}
                        className="px-3 py-2 text-xs font-bold text-left border border-gray-200 rounded-sm hover:border-brand-blue hover:text-brand-blue transition-colors"
                      >
                        {rt.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowAddRoom(false)} className="mt-2 w-full py-1.5 text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </Card>
            ) : (
              <button
                onClick={() => setShowAddRoom(true)}
                className="w-full py-3 border-2 border-dashed border-gray-200 hover:border-brand-blue text-sm font-bold text-gray-400 hover:text-brand-blue rounded-sm transition-colors"
              >
                + Add room
              </button>
            )}

            <div className="h-20" />
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-4 py-3 shrink-0">
          <div className="max-w-xl mx-auto flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400">{rooms.length} rooms · {Math.round(totalHrs * 10) / 10} hrs est.</p>
              <p className="text-xl font-black text-brand-navy">£{totalPrice}</p>
            </div>
            <button
              onClick={() => setStep('quote')}
              disabled={rooms.length === 0}
              className="px-6 py-3 bg-brand-navy text-white font-black text-sm rounded-sm hover:bg-brand-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get quote →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 3: Quote summary + save ──────────────────────────────────────────────
  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep('rooms')} className="text-xs text-gray-400 hover:text-gray-700">← Back to walkthrough</button>
      </div>

      {/* Your price summary (internal only) */}
      <div className="px-4 py-3 rounded-sm bg-brand-navy/5 border border-brand-navy/10">
        <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">Your breakdown (not shown to customer)</p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black text-brand-navy">£{totalPrice}</p>
          {accounts?.vatRegistered && (
            <p className="text-xs text-gray-500">+ VAT → client pays £{Math.round(totalPrice * 1.2)}</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{rooms.length} rooms · {Math.round(totalHrs * 10) / 10} hrs · {CLEAN_TYPES.find(c => c.id === cleanType)?.label}</p>
        <div className="mt-2 space-y-0.5">
          {rooms.map(room => {
            const type  = ROOM_TYPES.find(r => r.id === room.typeId);
            const cond  = WALK_CONDITIONS.find(c => c.id === room.condition);
            const price = roomPrice(room);
            return (
              <div key={room.uid} className="flex justify-between text-xs text-gray-600">
                <span>{type?.label ?? room.typeId} <span className="text-gray-400">({cond?.label})</span></span>
                <span className="font-semibold">£{price}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* What the customer sees */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <SL>Scope of work</SL>
        </div>
        <div className="divide-y divide-gray-50">
          {rooms.map(room => {
            const type  = ROOM_TYPES.find(r => r.id === room.typeId);
            const cond  = WALK_CONDITIONS.find(c => c.id === room.condition);
            const addonLabels = room.addons.filter(a => a.label).map(a => a.label);
            return (
              <div key={room.uid} className="px-4 py-2.5">
                <p className="text-sm font-semibold text-brand-navy">{type?.label ?? room.typeId}</p>
                <p className="text-xs text-gray-400">
                  {cond?.label} clean
                  {addonLabels.length > 0 && ` · ${addonLabels.join(', ')}`}
                  {room.note && ` · ${room.note}`}
                </p>
              </div>
            );
          })}
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-brand-navy">Total</p>
          <p className="text-xl font-black text-brand-navy">£{totalPrice}{accounts?.vatRegistered ? ' + VAT' : ''}</p>
        </div>
      </Card>

      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-gray-100"><SL>Customer</SL></div>
        <div className="p-4 space-y-3 relative">
          <div className="relative">
            <input
              type="text"
              value={custSearch}
              onChange={e => { setCustSearch(e.target.value); setCustomer(e.target.value); setShowCustDrop(true); }}
              onFocus={() => setShowCustDrop(true)}
              onBlur={() => setTimeout(() => setShowCustDrop(false), 150)}
              placeholder="Customer name…"
              className="w-full text-sm border border-gray-200 rounded-sm px-3 py-2.5 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-brand-blue"
            />
            {showCustDrop && custMatches.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-sm shadow-lg z-20">
                {custMatches.map(c => (
                  <button key={c.id} onClick={() => pickCustomer(c)} className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0">
                    <p className="text-sm font-semibold text-gray-800">{c.name}</p>
                    {c.address_line1 && <p className="text-xs text-gray-400">{c.address_line1}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Additional notes for the customer…"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-sm px-3 py-2 text-gray-700 placeholder-gray-300 focus:outline-none focus:border-brand-blue resize-none"
          />
        </div>
      </Card>

      {lastQuote ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-sm bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-600 font-black">✓</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-emerald-700">Quote saved for {lastQuote.customer}</p>
              <p className="text-xs text-emerald-600">£{lastQuote.price} · logged to accounts · linked to customer</p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/scheduler?customer=${encodeURIComponent(lastQuote.customer)}`)}
            className="w-full py-3 border border-brand-navy text-brand-navy font-bold text-sm rounded-sm hover:bg-brand-navy hover:text-white transition-colors"
          >
            Book as job in Scheduler →
          </button>
          <button
            onClick={resetAll}
            className="w-full py-3 border border-gray-200 text-gray-500 font-bold text-sm rounded-sm hover:bg-gray-50 transition-colors"
          >
            Start new walkthrough
          </button>
        </div>
      ) : (
        <button
          onClick={saveQuote}
          disabled={!customer}
          className="w-full py-4 bg-brand-navy text-white font-black text-sm rounded-sm hover:bg-brand-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save quote — £{totalPrice}
        </button>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function PricingCalculator({ accountsData, userHourlyRate, sectorHint, onNavigate, onSaveDraft, onAcceptQuote, onAcceptedQuote }) {
  const { customers = [] } = useData();
  const accounts = { ...DEFAULT_ACCOUNTS, ...(accountsData ?? {}) };

  // Load saved quotes from Supabase on mount
  const [dbQuotes, setDbQuotes] = useState([]);
  const reloadQuotes = async () => {
    const { listQuotes } = await import('../lib/db/quotesDb');
    try {
      const rows = await listQuotes(50);
      setDbQuotes(rows.map(q => ({
        id: q.id,
        customer: q.job_label || q.payload?.customer || 'Quote',
        price: Number(q.price) || 0,
        hrs: Number(q.hrs) || 0,
        type: q.type || 'residential',
        notes: q.notes || '',
        status: q.status || 'draft',
        savedAt: q.created_at,
      })));
    } catch {}
  };
  useEffect(() => {
    let mounted = true;
    import('../lib/db/quotesDb').then(({ listQuotes }) => {
      listQuotes(50).then(rows => {
        if (mounted) {
          setDbQuotes(rows.map(q => ({
            id: q.id,
            customer: q.job_label || q.payload?.customer || 'Quote',
            price: Number(q.price) || 0,
            hrs: Number(q.hrs) || 0,
            type: q.type || 'residential',
            notes: q.notes || '',
            status: q.status || 'draft',
            savedAt: q.created_at,
          })));
        }
      }).catch(() => {});
    });
    return () => { mounted = false; };
  }, []);

  // Unified save handler: saves draft to Supabase, then reloads list
  const handleSaveQuote = async (quote) => {
    if (onSaveDraft) {
      try {
        const saved = await onSaveDraft(quote);
        await reloadQuotes();
        return saved;
      } catch (err) {
        console.error('Failed to save quote:', err);
      }
    } else if (onAcceptedQuote) {
      // Legacy fallback
      await onAcceptedQuote(quote);
    }
  };

  const handleAcceptQuote = async (savedQuote) => {
    if (!onAcceptQuote) return;
    try {
      await onAcceptQuote(savedQuote);
      await reloadQuotes();
    } catch (err) {
      console.error('Failed to accept quote:', err);
    }
  };

  // Open the tab that matches the user's sector (from onboarding)
  const sectorToTab = { residential: "residential", commercial: "commercial", exterior: "exterior" };
  const defaultTab  = sectorToTab[sectorHint] ?? "residential";
  const [activeTab, setActiveTab] = useState(defaultTab);

  const TABS = [
    { id: "residential",  label: "Residential",  sub: "Quick quote + room builder"   },
    { id: "commercial",   label: "Commercial",   sub: "Cost-build calculator"         },
    { id: "exterior",     label: "Exterior",     sub: "Property & one-off jobs"       },
    { id: "walkthrough",  label: "Walkthrough",  sub: "Room-by-room on-site quote"    },
  ];

  const ACCENT = { residential: "text-emerald-600", commercial: "text-brand-blue", exterior: "text-orange-600", walkthrough: "text-violet-600" };

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold tracking-widest uppercase text-brand-blue mb-0.5">Pricing</p>
          <h2 className="text-2xl font-bold text-brand-navy">Quote builder</h2>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-sm hidden sm:flex ${
          userHourlyRate ? "bg-brand-navy/5 border border-brand-navy/10" : "bg-amber-50 border border-amber-200"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${userHourlyRate ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
          <div>
            <p className={`text-xs font-bold ${userHourlyRate ? "text-brand-navy" : "text-amber-700"}`}>
              {userHourlyRate ? `£${userHourlyRate}/hr · synced from settings` : "⚠ No hourly rate set — using estimates"}
            </p>
            <p className="text-xs text-gray-400">
              {userHourlyRate
                ? `${accounts.vatRegistered ? `VAT · FRS ${accounts.frsRate}%` : "No VAT"} · ${Math.round(accounts.taxRate*100)}% tax`
                : "Set your rate in Settings to get accurate quotes"
              }
            </p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {TABS.map(({ id, label, sub }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 px-4 py-3 border-b-2 transition-all -mb-px text-left ${
                activeTab === id
                  ? `border-brand-blue ${ACCENT[id]}`
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
              }`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-gray-400 hidden sm:inline">{sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "residential"  && <ResidentialTab  accounts={accounts} userHourlyRate={userHourlyRate} onSaveQuote={handleSaveQuote} onAcceptQuote={handleAcceptQuote} customers={customers} initialQuotes={dbQuotes.filter(q => q.type === 'residential')} />}
        {activeTab === "commercial"   && <CommercialTab   accounts={accounts} userHourlyRate={userHourlyRate} onSaveQuote={handleSaveQuote} onAcceptQuote={handleAcceptQuote} customers={customers} initialQuotes={dbQuotes.filter(q => q.type === 'commercial')} />}
        {activeTab === "exterior"     && <ExteriorTab     accounts={accounts}                                 onSaveQuote={handleSaveQuote} onAcceptQuote={handleAcceptQuote} customers={customers} initialQuotes={dbQuotes.filter(q => !['residential','commercial'].includes(q.type))} />}
        {activeTab === "walkthrough"  && <WalkthroughTab  accounts={accounts}                                 onSaveQuote={handleSaveQuote} customers={customers} />}
      </div>
    </div>
  );
}
