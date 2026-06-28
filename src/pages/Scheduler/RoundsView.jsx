// src/pages/Scheduler/RoundsView.jsx
// Cadi rounds — build, schedule, rejig.
//   • Drag customers up/down within a round to reorder the visit sequence.
//   • Drag customers across to a different round to change membership.
//   • Each open round shows a mini Leaflet map plotting the postcodes in
//     visit order so the owner can spot bad route legs at a glance.
//   • Bulk-shift toolbar pushes every active customer in the round +/- N
//     days (Sunday auto-bumps to Monday).
//
// Map data: postcodes geocoded via postcodes.io with a localStorage cache
// (see lib/geocode.js). Map only renders when a round is expanded so we
// don't geocode every postcode on first paint.

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronRight, GripVertical, MapPin, ChevronsRight, ChevronsLeft,
  Pencil, Loader2, Wand2, X, AlertCircle, Check, Plus,
} from "lucide-react";
import {
  DndContext, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { listAllRounds, setRoundOrder, shiftRound, bulkAssignRound } from "../../lib/db/customerRoundsDb";
import { geocodePostcodes, normalisePostcode } from "../../lib/geocode";
import { fmtMoney } from "./helpers";

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

// Read-only sample rounds shown before the user imports anything. DnD and
// shift actions are disabled in this state — there's no DB row to mutate.
const DEMO_ROUNDS = [
  {
    roundName: "Monday AM — Kensington",
    schedule: "Weekly",
    customers: [
      { id: 'd1', name: "Kensington Block A", addressLine1: "1 Holland Park", postcode: "W8 4AA", pricePerVisit: 45, dueDate: "2026-06-29", accountStatus: "active" },
      { id: 'd2', name: "Kensington Block B", addressLine1: "5 Holland Park", postcode: "W8 4AB", pricePerVisit: 45, dueDate: "2026-06-29", accountStatus: "active" },
      { id: 'd3', name: "Hammond",            addressLine1: "12 Phillimore Gardens", postcode: "W8 4BD", pricePerVisit: 25, dueDate: "2026-06-29", accountStatus: "active" },
      { id: 'd4', name: "Clifton",            addressLine1: "8 Argyll Road", postcode: "W8 5AA", pricePerVisit: 25, dueDate: "2026-06-29", accountStatus: "suspended" },
      { id: 'd5', name: "Elsworth",           addressLine1: "20 Campden Street", postcode: "W8 5BB", pricePerVisit: 30, dueDate: "2026-06-29", accountStatus: "active" },
    ],
  },
  {
    roundName: "Wednesday — West Nine",
    schedule: "Fortnightly",
    customers: [
      { id: 'd6', name: "Phillips",        addressLine1: "22 Maida Vale", postcode: "W9 1AA", pricePerVisit: 25, dueDate: "2026-07-01", accountStatus: "active" },
      { id: 'd7', name: "Nash Apartments", addressLine1: "8 Clifton Gardens", postcode: "W9 1BB", pricePerVisit: 60, dueDate: "2026-07-01", accountStatus: "active" },
      { id: 'd8', name: "Dr. Khan",        addressLine1: "30 Sutherland Avenue", postcode: "W9 2CC", pricePerVisit: 25, dueDate: "2026-07-15", accountStatus: "active" },
      { id: 'd9', name: "Fletcher",        addressLine1: "44 Warwick Avenue", postcode: "W9 2DD", pricePerVisit: 95, dueDate: "2026-07-15", accountStatus: "active" },
    ],
  },
];

const ACCOUNT_STATUS_STYLES = {
  active:    "bg-emerald-100 text-emerald-700",
  suspended: "bg-amber-100 text-amber-700",
  cancelled: "bg-[#fbe9e5] text-[#8a2f1f]",
};

function ukDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─── Area derivation ───────────────────────────────────────────────────────
// CleanerPlanner imports often have one geographic area split across multiple
// rounds by frequency or sub-area, e.g.:
//   "apsley"
//   "Apsley One Every Six Weeks"
//   "Apsley Two Every Twelve Weeks"
//   "warners end"
//   "warners end (transferred)"
// All of those should sit under one "Apsley" / "Warners End" header so the
// owner sees a single area with its frequency splits as sub-rounds.
//
// Algorithm:
//   1. Lowercase, trim, drop any parenthesised trailing tag.
//   2. Cut everything from the first frequency keyword onwards
//      ("every", "weekly", "fortnightly", "monthly", "4-weekly", "N-weekly").
//   3. Drop trailing qualifier tokens ("one", "two", "three", "1", "2", "3")
//      so "Apsley One" → "apsley". Only at the tail, never mid-name.
//   4. Title-case for the display label; key stays lowercase for grouping.
const FREQ_BOUNDARY = /\b(every|weekly|fortnightly|monthly|yearly|biweekly|bi-weekly|\d+\s*-?\s*weekly|\d+\s*-?\s*weeks?)\b/i;
const QUALIFIER_TAIL = /\s+(one|two|three|four|five|six|1|2|3|4|5|6)\s*$/i;

// Recognises round names that are pure frequency labels left over from a
// CleanerPlanner-style import where the importer dropped the schedule
// column into round_name instead of an area. Used to surface a contextual
// "your rounds came in as frequencies — want to regroup by area?" banner.
const FREQUENCY_ROUND_NAME = /^\s*\d*\s*(weekly|fortnightly|monthly|yearly|biweekly|bi-weekly|week|weeks|month|months|year|years|day|days)\s*$/i;
export function looksLikeFrequencyLabel(roundName) {
  if (!roundName) return false;
  if (FREQUENCY_ROUND_NAME.test(roundName)) return true;
  // Also catch "every 6 weeks" / "4-weekly" / "every two months"
  return /^\s*(every|each)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(week|weeks|month|months|day|days)\s*$/i.test(roundName)
      || /^\s*\d+\s*-?\s*(weekly|monthly|daily)\s*$/i.test(roundName);
}

// Outcode = the first part of a UK postcode ("HP1 2AB" → "HP1"). We use it
// as the most reliable geographic grouping when a user wants to rebuild
// rounds from postcode. Returns null if no recognisable outcode.
export function postcodeOutcode(pc) {
  if (!pc) return null;
  const m = String(pc).toUpperCase().match(/^\s*([A-Z]{1,2}\d[A-Z\d]?)\s*\d?[A-Z]{0,2}/);
  return m ? m[1] : null;
}

export function deriveArea(roundName) {
  if (!roundName) return { key: 'unassigned', label: 'Unassigned' };
  let s = String(roundName).trim();
  s = s.replace(/\s*\([^)]*\)\s*$/, '');     // strip "(transferred)" etc
  const m = s.match(FREQ_BOUNDARY);
  if (m) s = s.slice(0, m.index).trim();
  // Strip a single qualifier tail token, repeatedly (covers "Apsley One Two")
  while (QUALIFIER_TAIL.test(s)) s = s.replace(QUALIFIER_TAIL, '');
  s = s.trim();
  if (!s) return { key: 'unassigned', label: 'Unassigned' };
  const key   = s.toLowerCase();
  const label = key.replace(/\b\w/g, c => c.toUpperCase());
  return { key, label };
}

// ─── DnD helpers — same as Week/Day so behaviour is identical ──────────────
function getEventCoordinates(event) {
  if (event?.touches?.[0]) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  if (event?.clientX != null) return { x: event.clientX, y: event.clientY };
  return null;
}
function snapCenterToCursor({ activatorEvent, draggingNodeRect, transform }) {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const c = getEventCoordinates(activatorEvent);
  if (!c) return transform;
  const offsetX = c.x - draggingNodeRect.left;
  const offsetY = c.y - draggingNodeRect.top;
  return {
    ...transform,
    x: transform.x + offsetX - draggingNodeRect.width / 2,
    y: transform.y + offsetY - draggingNodeRect.height / 2,
  };
}
function pointerFirstCollision(args) {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
}

// ─── Sortable customer row ─────────────────────────────────────────────────
// Drag handle still owns the listeners. A separate checkbox toggles
// multi-select — used by the bulk-move action bar when reorganising large
// rounds without dragging one card at a time.
function SortableCustomerRow({ customer, idx, disabled, selected, onToggleSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: customer.id,
    data: { type: 'customer', roundName: customer.roundName },
    disabled,
  });

  const isCancelled = customer.accountStatus === 'cancelled';
  const isSuspended = customer.accountStatus === 'suspended';
  const address = customer.addressLine1 || customer.postcode || customer.name;
  const statusCls = ACCOUNT_STATUS_STYLES[customer.accountStatus] ?? ACCOUNT_STATUS_STYLES.active;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : (isCancelled ? 0.5 : 1),
    zIndex:  isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-stretch rounded-xl border overflow-hidden hover:shadow-md hover:shadow-[#1f48ff]/10 transition-shadow ${
        selected ? 'border-[#1f48ff] bg-[rgba(31,72,255,0.06)]' : 'border-[rgba(31,72,255,0.1)] bg-white/85'
      }`}
    >
      <div className="w-1 shrink-0" style={{ background: selected ? '#1f48ff' : 'rgba(31,72,255,0.3)' }} />
      {onToggleSelect && !disabled && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(customer.id); }}
          className="w-7 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)] hover:bg-[rgba(31,72,255,0.05)]"
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          <span className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
            selected ? 'bg-[#1f48ff] border-[#1f48ff]' : 'border-[#010a4f]/25 bg-white'
          }`}>
            {selected && <Check size={9} strokeWidth={3.5} className="text-white" />}
          </span>
        </button>
      )}
      <div
        {...(disabled ? {} : { ...attributes, ...listeners })}
        className={`w-6 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)] ${
          disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none'
        }`}
        title={disabled ? '' : 'Drag to reorder or move to another round'}
      >
        <GripVertical size={11} className="text-[#010a4f]/30" />
      </div>
      <div className="w-6 shrink-0 flex items-center justify-center text-[10px] font-black tabular-nums text-[#010a4f]/40">
        {idx + 1}
      </div>
      <div className="flex-1 min-w-0 px-2.5 py-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className={`text-[12.5px] font-bold truncate leading-tight text-[#010a4f] ${isCancelled ? 'line-through' : ''}`}>
            {address}
          </p>
          {customer.pricePerVisit != null && (
            <p className="text-[11.5px] font-black tabular-nums shrink-0 text-emerald-600">
              £{customer.pricePerVisit}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[10.5px] text-[#010a4f]/55 truncate">
            {customer.name}{customer.postcode ? ` · ${customer.postcode}` : ''}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {customer.dueDate && (
              <span className="text-[10px] text-[#010a4f]/45 tabular-nums">{ukDate(customer.dueDate)}</span>
            )}
            {(isCancelled || isSuspended) && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${statusCls}`}>
                {customer.accountStatus}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mini route map ────────────────────────────────────────────────────────
// Plots each customer as a numbered circle marker in visit order and draws
// a polyline through them. Lat/lng come from the geocode cache. If postcodes
// haven't resolved yet we render a soft placeholder rather than an empty box.
function RoundMap({ customers, geo, loading }) {
  // Resolve customers in order to {idx, latlng, name}
  const points = customers
    .map((c, i) => {
      const pc = normalisePostcode(c.postcode);
      const g  = geo[pc];
      if (!g) return null;
      return { i, latlng: [g.lat, g.lng], name: c.addressLine1 || c.name, postcode: c.postcode, price: c.pricePerVisit };
    })
    .filter(Boolean);

  if (loading && points.length === 0) {
    return (
      <div className="h-[280px] rounded-xl bg-[rgba(31,72,255,0.04)] border border-[rgba(31,72,255,0.1)] flex flex-col items-center justify-center gap-2 text-[#010a4f]/45">
        <Loader2 size={18} className="animate-spin" />
        <p className="text-[11px] font-semibold">Geocoding postcodes…</p>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="h-[280px] rounded-xl bg-[rgba(31,72,255,0.04)] border border-[rgba(31,72,255,0.1)] flex flex-col items-center justify-center gap-2 text-[#010a4f]/45">
        <MapPin size={18} />
        <p className="text-[11px] font-semibold">No postcodes to plot</p>
      </div>
    );
  }

  // Centre on the geometric mean of all points; let Leaflet pick a zoom that
  // covers them via fitBounds in the FitToPoints helper below.
  const centre = [
    points.reduce((s, p) => s + p.latlng[0], 0) / points.length,
    points.reduce((s, p) => s + p.latlng[1], 0) / points.length,
  ];

  return (
    <div className="h-[280px] rounded-xl overflow-hidden border border-[rgba(31,72,255,0.15)] relative">
      <MapContainer
        center={centre} zoom={12}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false} attributionControl={false}
        dragging={true} scrollWheelZoom={false} doubleClickZoom={true}
        bounds={points.length > 1 ? points.map(p => p.latlng) : undefined}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
        />
        {points.length > 1 && (
          <Polyline positions={points.map(p => p.latlng)} pathOptions={{ color: '#1f48ff', weight: 2.5, opacity: 0.55, dashArray: '4 4' }} />
        )}
        {points.map(p => (
          <CircleMarker
            key={p.i}
            center={p.latlng}
            radius={11}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#1f48ff', fillOpacity: 0.95 }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              <span style={{ fontWeight: 700 }}>#{p.i + 1} {p.name}</span>
              {p.price != null && <span> · £{p.price}</span>}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {points.length < customers.length && (
        <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-semibold text-[#010a4f]/65 border border-[rgba(31,72,255,0.15)]">
          {points.length} of {customers.length} plotted
        </div>
      )}
    </div>
  );
}

// ─── Round card ────────────────────────────────────────────────────────────
// Each round is its own droppable + SortableContext so cards can be dropped
// into other rounds. When open, runs geocoding for its postcodes and renders
// the route map + shift toolbar alongside the sortable customer list.
function RoundCard({
  round, isOpen, onToggle, onScheduleRound, onShift, onRename,
  isDemo, sensors, selectedIds, onToggleSelect, onSelectAll,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `round:${round.roundName}`,
    data: { type: 'round', roundName: round.roundName },
  });

  const [geo, setGeo]         = useState({});
  const [geoLoading, setGeoLoading] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(round.roundName);

  // Geocode lazily when the round opens. Skips work if cache already has all.
  useEffect(() => {
    if (!isOpen) return;
    const codes = round.customers.map(c => c.postcode).filter(Boolean);
    if (codes.length === 0) return;
    setGeoLoading(true);
    geocodePostcodes(codes)
      .then(setGeo)
      .finally(() => setGeoLoading(false));
  }, [isOpen, round.customers]);

  const activeCustomers = round.customers.filter(c => c.accountStatus !== 'cancelled');
  const totalValue = activeCustomers.reduce((s, c) => s + (c.pricePerVisit || 0), 0);
  const nextDue    = round.customers
    .filter(c => c.dueDate && c.accountStatus === 'active')
    .map(c => c.dueDate)
    .sort()[0];

  const doShift = async (days) => {
    if (isDemo) return;
    setShifting(true);
    try {
      await onShift(round.roundName, days);
    } finally {
      setShifting(false);
    }
  };

  return (
    <LightCard className={`overflow-hidden transition-all ${isOver ? 'ring-2 ring-[#1f48ff]/40 shadow-[#1f48ff]/15' : ''}`}>
      {/* Header */}
      <div
        ref={setNodeRef}
        className="w-full flex items-center gap-3 px-5 py-3 text-left"
        style={{
          background: isOpen
            ? 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)'
            : undefined,
          color: isOpen ? '#ffffff' : undefined,
        }}
      >
        <button
          onClick={() => onToggle(round.roundName)}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isOpen ? 'bg-white/15' : 'bg-[rgba(31,72,255,0.08)] border border-[rgba(31,72,255,0.18)]'
          }`}
        >
          <ChevronRight size={16} className={`transition-transform ${isOpen ? 'rotate-90 text-white' : 'text-[#1f48ff]'}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  if (draftName.trim() && draftName !== round.roundName) onRename(round.roundName, draftName.trim());
                  else setDraftName(round.roundName);
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraftName(round.roundName); setEditingName(false); } }}
                className={`text-sm font-black bg-transparent border-b border-current outline-none min-w-0 flex-1 ${isOpen ? 'text-white' : 'text-[#010a4f]'}`}
              />
            ) : (
              <p className={`text-sm font-black truncate ${isOpen ? 'text-white' : 'text-[#010a4f]'}`}>{round.roundName}</p>
            )}
            {!isDemo && !editingName && (
              <button
                onClick={() => setEditingName(true)}
                aria-label="Rename round"
                className={`p-0.5 rounded transition-colors ${isOpen ? 'text-white/60 hover:text-white' : 'text-[#010a4f]/40 hover:text-[#1f48ff]'}`}
              >
                <Pencil size={11} />
              </button>
            )}
            {round.schedule && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isOpen ? 'bg-white/20 text-white' : 'bg-[rgba(31,72,255,0.08)] text-[#1f48ff] border border-[rgba(31,72,255,0.18)]'
              }`}>
                {round.schedule}
              </span>
            )}
          </div>
          <div className={`flex items-center gap-3 mt-0.5 text-xs ${isOpen ? 'text-[#99c5ff]' : 'text-[#010a4f]/55'}`}>
            <span>{activeCustomers.length} active</span>
            {totalValue > 0 && <span className="font-semibold tabular-nums">£{totalValue}/visit</span>}
            {nextDue && <span className="tabular-nums">Next: {ukDate(nextDue)}</span>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onScheduleRound(round); }}
          title="Schedule a job for every active customer in this round"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap ${
            isOpen
              ? 'bg-white text-[#1f48ff] hover:bg-white/90'
              : 'bg-[#1f48ff] text-white hover:bg-[#3a6bff]'
          }`}
        >
          Schedule round
        </button>
      </div>

      {isOpen && (
        <div className="px-4 py-3 bg-white/40 border-t border-[rgba(31,72,255,0.08)] space-y-3">
          {/* Shift toolbar — disabled on demo data */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#010a4f]/45">
                Visit order — drag, or tick to bulk-move
              </p>
              {!isDemo && onSelectAll && round.customers.length > 0 && (() => {
                const allSelected = round.customers.every(c => selectedIds?.has(c.id));
                return (
                  <button
                    onClick={() => onSelectAll(round.roundName, !allSelected)}
                    className="text-[10px] font-bold text-[#1f48ff] hover:underline"
                  >
                    {allSelected ? 'Clear' : 'Select all'}
                  </button>
                );
              })()}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={isDemo || shifting}
                onClick={() => doShift(-1)}
                className="px-2 py-1 rounded-md border border-[rgba(31,72,255,0.18)] bg-white text-[11px] font-bold text-[#010a4f]/75 hover:bg-[rgba(31,72,255,0.05)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                title="Pull this round one day earlier"
              >
                <ChevronsLeft size={12} /> 1 day
              </button>
              <button
                disabled={isDemo || shifting}
                onClick={() => doShift(1)}
                className="px-2 py-1 rounded-md border border-[rgba(31,72,255,0.18)] bg-white text-[11px] font-bold text-[#010a4f]/75 hover:bg-[rgba(31,72,255,0.05)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                title="Push this round one day later (rain day)"
              >
                1 day <ChevronsRight size={12} />
              </button>
              <button
                disabled={isDemo || shifting}
                onClick={() => doShift(7)}
                className="px-2 py-1 rounded-md border border-[rgba(31,72,255,0.18)] bg-white text-[11px] font-bold text-[#010a4f]/75 hover:bg-[rgba(31,72,255,0.05)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                title="Push the whole round forward one week"
              >
                1 week <ChevronsRight size={12} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Customer list — sortable */}
            <SortableContext items={round.customers.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5 min-h-[80px]">
                {round.customers.map((c, i) => (
                  <SortableCustomerRow
                    key={c.id}
                    customer={{ ...c, roundName: round.roundName }}
                    idx={i}
                    disabled={isDemo}
                    selected={selectedIds?.has(c.id)}
                    onToggleSelect={onToggleSelect}
                  />
                ))}
                {round.customers.length === 0 && (
                  <div className="rounded-xl border border-dashed border-[rgba(31,72,255,0.2)] bg-[rgba(31,72,255,0.03)] text-[11px] text-[#010a4f]/45 italic px-3 py-4 text-center">
                    Drag a customer here
                  </div>
                )}
              </div>
            </SortableContext>

            {/* Map — lazily geocoded */}
            <RoundMap customers={round.customers} geo={geo} loading={geoLoading} />
          </div>
        </div>
      )}
    </LightCard>
  );
}

// ─── Rebuild rounds modal ──────────────────────────────────────────────────
// Two-step rebuild: pick how to group (postcode area / town), preview the
// proposed mapping, confirm. Bulk-updates every customer_rounds row in one
// shot so the user can recover from a bad import in seconds.
function RebuildModal({ rounds, onClose, onApply }) {
  // 'outcode' uses the first part of each customer's postcode ("HP1").
  // 'town' uses the customer's town field (less reliable — many imports
  // skip town).
  const [groupBy, setGroupBy] = useState('outcode');
  const [busy, setBusy] = useState(false);

  // Flatten every customer in every round into a working list with the
  // proposed new round name for each strategy.
  const customers = useMemo(() => {
    const out = [];
    for (const r of rounds) {
      for (const c of r.customers) {
        out.push({
          id:           c.id,
          name:         c.name,
          addressLine1: c.addressLine1,
          postcode:     c.postcode,
          town:         c.town || null,
        });
      }
    }
    return out;
  }, [rounds]);

  // Build the preview: group customers by the chosen strategy. Customers
  // with no recognisable value land in an "Unassigned" bucket so they're
  // still accounted for.
  const preview = useMemo(() => {
    const map = new Map();
    for (const c of customers) {
      let key;
      if (groupBy === 'outcode') {
        key = postcodeOutcode(c.postcode) || 'Unassigned';
      } else {
        key = (c.town || '').trim() || 'Unassigned';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    }
    return [...map.entries()]
      .map(([name, list]) => ({ name, count: list.length, ids: list.map(c => c.id) }))
      .sort((a, b) => {
        if (a.name === 'Unassigned') return 1;
        if (b.name === 'Unassigned') return -1;
        return b.count - a.count;
      });
  }, [customers, groupBy]);

  const totalReassign = preview.filter(p => p.name !== 'Unassigned').reduce((s, p) => s + p.count, 0);
  const unassigned    = preview.find(p => p.name === 'Unassigned')?.count ?? 0;

  const apply = async () => {
    setBusy(true);
    try {
      const updates = preview.flatMap(g => g.ids.map(id => ({ id, roundName: g.name })));
      await onApply(updates);
      onClose();
    } catch (err) {
      setBusy(false);
      window.alert(`Couldn't rebuild: ${err?.message ?? 'unknown error'}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-[rgba(31,72,255,0.15)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-[rgba(31,72,255,0.06)] hover:bg-[rgba(31,72,255,0.12)] flex items-center justify-center text-[#010a4f]/55"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div
          className="px-5 py-4 border-b border-[rgba(31,72,255,0.1)]"
          style={{ background: 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)', color: '#ffffff' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#99c5ff' }}>Rebuild rounds</p>
          <h2 className="text-lg font-black mt-0.5">Regroup your customers</h2>
          <p className="text-[11.5px] mt-1 text-white/75">
            Reassigns every customer to a new round based on the option below. Your existing rounds get replaced.
          </p>
        </div>

        {/* Strategy picker */}
        <div className="px-5 py-3 grid grid-cols-2 gap-2 border-b border-[rgba(31,72,255,0.08)]">
          {[
            { key: 'outcode', label: 'By postcode area', sub: 'HP1, HP2, TW10…' },
            { key: 'town',    label: 'By town',          sub: 'Hemel Hempstead…' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setGroupBy(opt.key)}
              className={`px-3 py-2.5 rounded-xl border text-left transition-all ${
                groupBy === opt.key
                  ? 'border-[#1f48ff] bg-[rgba(31,72,255,0.06)] shadow-sm'
                  : 'border-[rgba(31,72,255,0.15)] bg-white hover:border-[#1f48ff]/40'
              }`}
            >
              <p className="text-[12px] font-black text-[#010a4f]">{opt.label}</p>
              <p className="text-[10.5px] text-[#010a4f]/55 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="px-5 py-3 flex-1 overflow-y-auto">
          {/* Bail-early state — when literally nothing can be grouped, the
              rebuild won't help. Surface why and point at the real fix
              path so the user isn't left hammering Apply. */}
          {totalReassign === 0 && (
            <div className="mb-3 px-3 py-3 rounded-xl border border-amber-200 bg-amber-50 text-[11.5px] text-amber-900 leading-snug">
              <p className="font-black mb-1">No {groupBy === 'outcode' ? 'postcodes' : 'towns'} on your customers</p>
              <p>
                Your import didn't bring {groupBy === 'outcode' ? 'postcodes' : 'town names'} across — every customer would land in "Unassigned", so this rebuild won't help yet. Try:
              </p>
              <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
                <li>Re-importing a CleanerPlanner <em>Rounds export</em> (or any CSV with a postcode column)</li>
                <li>Switch to the other grouping above ({groupBy === 'outcode' ? 'town' : 'postcode area'})</li>
                <li>Cancel and use <strong>"+ New round"</strong> + select-and-move to organise manually</li>
              </ul>
            </div>
          )}

          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#010a4f]/45">
              Preview — {preview.length} new round{preview.length === 1 ? '' : 's'}
            </p>
            <p className="text-[11px] text-[#010a4f]/55 tabular-nums">
              {totalReassign} customer{totalReassign === 1 ? '' : 's'} reassigned
            </p>
          </div>
          {unassigned > 0 && totalReassign > 0 && (
            <div className="mb-2 flex items-start gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{unassigned} customer{unassigned === 1 ? '' : 's'} can't be grouped ({groupBy === 'outcode' ? 'missing/invalid postcode' : 'no town set'}) — they'll go to an "Unassigned" round so nothing is lost.</span>
            </div>
          )}
          <div className="space-y-1 max-h-[320px] overflow-y-auto">
            {preview.map(g => (
              <div
                key={g.name}
                className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md border ${
                  g.name === 'Unassigned'
                    ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                    : 'border-[rgba(31,72,255,0.1)] bg-white'
                }`}
              >
                <p className={`text-[12px] font-bold truncate ${g.name === 'Unassigned' ? '' : 'text-[#010a4f]'}`}>
                  {g.name}
                </p>
                <p className="text-[11px] tabular-nums shrink-0 text-[#010a4f]/65">
                  {g.count} {g.count === 1 ? 'customer' : 'customers'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[rgba(31,72,255,0.08)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded-lg text-[12px] font-bold text-[#010a4f]/65 hover:text-[#010a4f] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={busy || preview.length === 0 || totalReassign === 0}
            className="px-4 py-2 rounded-lg bg-[#1f48ff] hover:bg-[#3a6bff] text-white text-[12px] font-black shadow-lg shadow-[#1f48ff]/25 disabled:opacity-50 flex items-center gap-1.5"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            {busy ? 'Rebuilding…' : `Rebuild into ${preview.length} round${preview.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────
export default function RoundsView({ onScheduleRound }) {
  const [expanded, setExpanded] = useState(null);
  const [dbRounds, setDbRounds] = useState(null);
  const [activeId, setActiveId] = useState(null);
  // Local snapshot of rounds we mutate optimistically before the DB call
  // returns. Refresh refills it from the DB on success/failure.
  const [localRounds, setLocalRounds] = useState(null);
  const [showRebuild, setShowRebuild] = useState(false);
  // Multi-select state for bulk-move action bar.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  // User-created empty rounds live in component state until a customer is
  // dropped/moved in (at which point bulkAssignRound writes the new
  // round_name to the DB and the round materialises naturally).
  const [pendingRounds, setPendingRounds] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = useCallback(() => {
    listAllRounds()
      .then(rows => setDbRounds(rows))
      .catch(() => setDbRounds([]));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Build the grouped {roundName, schedule, customers[]} shape, sorted by
  // round name then display_order then due_date.
  const builtRounds = useMemo(() => {
    if (!dbRounds || dbRounds.length === 0) return null;
    const map = {};
    dbRounds.forEach(r => {
      const key = r.round_name || r.job_reference || 'Unassigned';
      if (!map[key]) map[key] = { roundName: key, schedule: r.schedule || '', customers: [] };
      map[key].customers.push({
        id:            r.id,
        customerId:    r.customer_id,
        name:          r.customers?.name || 'Unknown',
        addressLine1:  r.customers?.address_line1 || null,
        town:          r.customers?.town || null,
        postcode:      r.customers?.postcode || '',
        pricePerVisit: r.price_per_visit ? Number(r.price_per_visit) : null,
        schedule:      r.schedule || null,
        dueDate:       r.due_date,
        accountStatus: r.account_status || 'active',
        displayOrder:  r.display_order ?? 0,
      });
    });
    Object.values(map).forEach(rd => {
      rd.customers.sort((a, b) => {
        if ((a.displayOrder ?? 0) !== (b.displayOrder ?? 0)) return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
        return (a.dueDate || '').localeCompare(b.dueDate || '');
      });
    });
    return Object.values(map).sort((a, b) => a.roundName.localeCompare(b.roundName));
  }, [dbRounds]);

  // localRounds wins if present (optimistic UI), else use the freshly-built
  // DB rounds, else fall back to demo data.
  const rounds = useMemo(() => {
    if (localRounds) return localRounds;
    if (builtRounds) return builtRounds;
    return DEMO_ROUNDS;
  }, [localRounds, builtRounds]);

  // Splice in pending (empty) rounds the user just created. They show up
  // as droppable cards so customers can be dragged or bulk-moved into them.
  // Filtered to ones not already represented in `rounds` (e.g. after the
  // first save the DB has them and the pending entry is removed).
  const roundsWithPending = useMemo(() => {
    if (pendingRounds.length === 0) return rounds;
    const have = new Set(rounds.map(r => r.roundName));
    const extra = pendingRounds
      .filter(name => !have.has(name))
      .map(name => ({ roundName: name, schedule: '', customers: [] }));
    return [...rounds, ...extra];
  }, [rounds, pendingRounds]);

  // Reset local snapshot whenever the underlying DB list changes (e.g. after
  // refresh on a successful save).
  useEffect(() => { setLocalRounds(null); }, [builtRounds]);

  const isDemo = !builtRounds;

  const findRoundOf = (rs, id) => rs.find(r => r.customers.some(c => c.id === id));

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), []);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null);
    if (!over || isDemo) return;

    const overData = over.data?.current || {};
    const fromRound = findRoundOf(rounds, active.id);
    if (!fromRound) return;

    // Resolve destination round + insert index
    let toRoundName, toIndex;
    if (overData.type === 'round') {
      toRoundName = overData.roundName;
      const r = rounds.find(x => x.roundName === toRoundName);
      toIndex = r ? r.customers.length : 0;
    } else {
      const overRound = findRoundOf(rounds, over.id);
      if (!overRound) return;
      toRoundName = overRound.roundName;
      toIndex = overRound.customers.findIndex(c => c.id === over.id);
      if (toIndex < 0) toIndex = overRound.customers.length;
    }

    const sameRound = fromRound.roundName === toRoundName;
    const fromIndex = fromRound.customers.findIndex(c => c.id === active.id);
    if (sameRound && fromIndex === toIndex) return;

    // Build optimistic next state
    const next = rounds.map(r => ({ ...r, customers: [...r.customers] }));
    const nextFrom = next.find(r => r.roundName === fromRound.roundName);
    const nextTo   = next.find(r => r.roundName === toRoundName);

    if (sameRound) {
      nextTo.customers = arrayMove(nextTo.customers, fromIndex, toIndex);
    } else {
      const [moved] = nextFrom.customers.splice(fromIndex, 1);
      moved.accountStatus = moved.accountStatus; // no-op, just for clarity
      nextTo.customers.splice(Math.min(toIndex, nextTo.customers.length), 0, moved);
    }
    // Re-stamp display_order on each affected round
    nextTo.customers.forEach((c, i) => { c.displayOrder = i; });
    if (!sameRound) nextFrom.customers.forEach((c, i) => { c.displayOrder = i; });

    setLocalRounds(next);

    // Persist
    const writes = [];
    nextTo.customers.forEach((c, i) => {
      writes.push({ id: c.id, displayOrder: i, ...(c.id === active.id && !sameRound ? { roundName: toRoundName } : {}) });
    });
    if (!sameRound) {
      nextFrom.customers.forEach((c, i) => writes.push({ id: c.id, displayOrder: i }));
    }
    try {
      await setRoundOrder(writes);
      refresh();
    } catch {
      refresh(); // reload DB truth on failure
    }
  }, [rounds, isDemo, refresh]);

  const handleShift = useCallback(async (roundName, days) => {
    try {
      await shiftRound(roundName, days);
    } finally {
      refresh();
    }
  }, [refresh]);

  // Rename — updates every membership row in the round.
  const handleRename = useCallback(async (oldName, newName) => {
    const round = rounds.find(r => r.roundName === oldName);
    if (!round) return;
    // Optimistic
    setLocalRounds(rounds.map(r => r.roundName === oldName ? { ...r, roundName: newName } : r));
    try {
      await setRoundOrder(round.customers.map((c, i) => ({ id: c.id, displayOrder: i, roundName: newName })));
      if (expanded === oldName) setExpanded(newName);
      refresh();
    } catch {
      refresh();
    }
  }, [rounds, expanded, refresh]);

  // Rebuild handler — bulk-reassigns every customer to a new round per the
  // mapping the modal hands us, then refreshes from the DB.
  const handleRebuild = useCallback(async (updates) => {
    await bulkAssignRound(updates);
    refresh();
  }, [refresh]);

  // Selection — used by the bulk-move action bar.
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllInRound = useCallback((roundName, on) => {
    const round = rounds.find(r => r.roundName === roundName);
    if (!round) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const c of round.customers) {
        if (on) next.add(c.id); else next.delete(c.id);
      }
      return next;
    });
  }, [rounds]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Bulk move — reassigns every selected customer to `toRound` in one DB
  // batch. Used by the floating action bar at the bottom of the screen.
  const handleBulkMove = useCallback(async (toRound) => {
    if (!toRound || selectedIds.size === 0) return;
    const updates = [...selectedIds].map(id => ({ id, roundName: toRound }));
    await bulkAssignRound(updates);
    clearSelection();
    // If the destination was a pending (empty) round, drop it from the
    // local list since it's about to materialise from the DB refresh.
    setPendingRounds(prev => prev.filter(name => name !== toRound));
    refresh();
  }, [selectedIds, clearSelection, refresh]);

  // Create a new (empty) round. Customers are added by drag or bulk move.
  const handleCreateRound = useCallback(() => {
    const name = window.prompt('Name your new round (e.g. "Hemel Hempstead", "Boxmoor Tuesdays")');
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setPendingRounds(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setExpanded(trimmed);
  }, []);

  const activeCustomer = activeId
    ? rounds.flatMap(r => r.customers).find(c => c.id === activeId)
    : null;

  // Detect whether the current rounds look like they came in as frequency
  // labels (typical CleanerPlanner schedule-as-round-name import). If at
  // least half the rounds look frequency-shaped AND there's nothing area-y
  // among the lot, we surface the contextual banner with a one-tap fix.
  const looksFrequencyShaped = useMemo(() => {
    if (isDemo) return false;
    const total = rounds.length;
    if (total === 0) return false;
    const freqCount = rounds.filter(r => looksLikeFrequencyLabel(r.roundName)).length;
    return freqCount >= Math.ceil(total / 2);
  }, [rounds, isDemo]);

  // Group rounds by area. Each area keeps the rounds in their original
  // sort order; areas are themselves sorted alphabetically by label.
  // "Unassigned" sinks to the bottom so it doesn't disrupt the index.
  const areas = useMemo(() => {
    const byKey = new Map();
    for (const round of roundsWithPending) {
      const { key, label } = deriveArea(round.roundName);
      if (!byKey.has(key)) byKey.set(key, { key, label, rounds: [] });
      byKey.get(key).rounds.push(round);
    }
    return Array.from(byKey.values())
      .map(a => {
        const activeCustomers = a.rounds.flatMap(r => r.customers.filter(c => c.accountStatus !== 'cancelled'));
        const totalValue = activeCustomers.reduce((s, c) => s + (c.pricePerVisit || 0), 0);
        const nextDue = a.rounds.flatMap(r => r.customers)
          .filter(c => c.dueDate && c.accountStatus === 'active')
          .map(c => c.dueDate)
          .sort()[0];
        return { ...a, activeCount: activeCustomers.length, totalValue, nextDue };
      })
      .sort((x, y) => {
        if (x.key === 'unassigned') return 1;
        if (y.key === 'unassigned') return -1;
        return x.label.localeCompare(y.label);
      });
  }, [roundsWithPending]);

  const [collapsedAreas, setCollapsedAreas] = useState(() => new Set());
  const toggleArea = useCallback((key) => {
    setCollapsedAreas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="space-y-3">
      {/* Toolbar — always visible when there's DB data. Houses the
          Rebuild action; future actions (new round, export) can sit here. */}
      {!isDemo && (
        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#010a4f]/55">Your rounds</p>
            <p className="text-[11.5px] text-[#010a4f]/55 mt-0.5">
              {areas.length} area{areas.length === 1 ? '' : 's'} · {rounds.length} round{rounds.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateRound}
              className="px-3 py-1.5 rounded-lg border border-[rgba(31,72,255,0.2)] bg-white hover:bg-[rgba(31,72,255,0.05)] hover:border-[#1f48ff]/40 text-[#1f48ff] text-[12px] font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={13} strokeWidth={3} /> New round
            </button>
            <button
              onClick={() => setShowRebuild(true)}
              className="px-3 py-1.5 rounded-lg border border-[rgba(31,72,255,0.2)] bg-white hover:bg-[rgba(31,72,255,0.05)] hover:border-[#1f48ff]/40 text-[#1f48ff] text-[12px] font-black flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Wand2 size={13} /> Rebuild rounds
            </button>
          </div>
        </div>
      )}

      {/* Contextual banner — shows when the import landed schedule labels
          as round names. Explains what happened and offers the same
          rebuild action front and centre. */}
      {!isDemo && looksFrequencyShaped && (
        <div className="px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] font-black text-amber-900">
              Your rounds came in as frequencies, not areas
            </p>
            <p className="text-[11.5px] text-amber-800/85 mt-0.5 leading-snug">
              That's how CleanerPlanner stored them — "1 month", "12 weeks" etc are the schedule, not where the customers live. Cadi can regroup them by postcode area (HP1, HP2…) or town in one tap so the map and routing make sense.
            </p>
          </div>
          <button
            onClick={() => setShowRebuild(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-[12px] font-black flex items-center gap-1.5 shadow-sm"
          >
            <Wand2 size={12} /> Fix this
          </button>
        </div>
      )}

      {isDemo && (
        <div className="px-4 py-3 rounded-xl bg-[rgba(31,72,255,0.05)] border border-[rgba(31,72,255,0.18)] text-xs text-[#010a4f]/75 flex items-start gap-2">
          <span className="text-base leading-none">💡</span>
          <span>
            <strong className="text-[#010a4f]">Demo data shown.</strong> Drag, shift and rename actions unlock once you import customers — any with a "Round" column will appear here grouped by area (e.g. <em>Apsley</em>), with each frequency split shown as its own round beneath.
          </span>
        </div>
      )}

      {showRebuild && (
        <RebuildModal
          rounds={rounds}
          onClose={() => setShowRebuild(false)}
          onApply={handleRebuild}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={pointerFirstCollision}
        modifiers={[snapCenterToCursor]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {areas.map(area => {
          const isCollapsed = collapsedAreas.has(area.key);
          return (
            <div key={area.key} className="space-y-2">
              {/* Area header — section divider, not a card. Click to collapse
                  every round in this area at once. */}
              <button
                onClick={() => toggleArea(area.key)}
                className="w-full flex items-center gap-3 px-2 py-2 group"
              >
                <span className="w-7 h-7 rounded-lg bg-[rgba(31,72,255,0.08)] border border-[rgba(31,72,255,0.18)] flex items-center justify-center shrink-0 text-[#1f48ff]">
                  <ChevronRight size={13} className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </span>
                <div className="flex items-baseline gap-2 flex-1 min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#010a4f] truncate">
                    {area.label}
                  </p>
                  <span className="text-[10px] font-bold text-[#010a4f]/45 tabular-nums shrink-0">
                    {area.rounds.length} {area.rounds.length === 1 ? 'round' : 'rounds'} · {area.activeCount} active
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10.5px] shrink-0">
                  {area.totalValue > 0 && (
                    <span className="font-semibold text-emerald-600 tabular-nums">£{fmtMoney(area.totalValue)}/visit</span>
                  )}
                  {area.nextDue && (
                    <span className="text-[#010a4f]/45 tabular-nums">Next: {ukDate(area.nextDue)}</span>
                  )}
                </div>
                <div className="h-px flex-1 bg-[rgba(31,72,255,0.12)] ml-2 group-hover:bg-[rgba(31,72,255,0.25)] transition-colors" />
              </button>

              {/* Rounds in this area — drag-between-rounds still works
                  cross-area because every RoundCard registers its own
                  droppable on the shared DndContext. */}
              {!isCollapsed && (
                <div className="space-y-2 pl-2 border-l-2 border-[rgba(31,72,255,0.1)] ml-3.5">
                  {area.rounds.map(round => (
                    <RoundCard
                      key={round.roundName}
                      round={round}
                      isOpen={expanded === round.roundName}
                      onToggle={(name) => setExpanded(expanded === name ? null : name)}
                      onScheduleRound={onScheduleRound}
                      onShift={handleShift}
                      onRename={handleRename}
                      isDemo={isDemo}
                      sensors={sensors}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onSelectAll={selectAllInRound}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeCustomer ? (
            <div className="flex items-stretch rounded-xl border border-[rgba(31,72,255,0.25)] bg-white shadow-2xl shadow-[#1f48ff]/30 w-[260px] rotate-1">
              <div className="w-1 shrink-0 bg-[#1f48ff]" />
              <div className="w-6 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)]">
                <GripVertical size={11} className="text-[#010a4f]/30" />
              </div>
              <div className="flex-1 min-w-0 px-2.5 py-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[12.5px] font-bold truncate leading-tight text-[#010a4f]">
                    {activeCustomer.addressLine1 || activeCustomer.postcode || activeCustomer.name}
                  </p>
                  {activeCustomer.pricePerVisit != null && (
                    <p className="text-[11.5px] font-black tabular-nums shrink-0 text-emerald-600">
                      £{activeCustomer.pricePerVisit}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {rounds.length === 0 && (
        <LightCard className="px-6 py-10 text-center">
          <p className="text-2xl mb-2">🔄</p>
          <p className="text-sm font-bold text-[#010a4f]">No rounds yet</p>
          <p className="text-xs text-[#010a4f]/45 mt-1">Import from CleanerPlanner, Squeegee or QuickBooks — customers with a Round column will appear here.</p>
        </LightCard>
      )}

      {/* Floating bulk-move bar — appears when any customers are selected.
          The dropdown lists every existing round plus a "+ New round…" option
          so the user can both build new structure and reorganise existing
          customers without a single drag. */}
      {!isDemo && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          rounds={roundsWithPending}
          onMove={handleBulkMove}
          onNewRound={() => {
            const name = window.prompt('Move selected customers to a new round called…');
            const t = (name || '').trim();
            if (t) handleBulkMove(t);
          }}
          onClear={clearSelection}
        />
      )}
    </div>
  );
}

// ─── Floating action bar ───────────────────────────────────────────────────
// Sticks to the bottom-centre of the viewport while items are selected.
// Lets the user move N customers to any existing round or spin up a new one
// without dragging. Always paired with a Clear button so escape is obvious.
function BulkActionBar({ count, rounds, onMove, onNewRound, onClear }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)', color: '#ffffff' }}
      >
        <span className="text-[12px] font-black">{count} selected</span>
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="px-3 py-1.5 rounded-lg bg-white text-[#1f48ff] text-[12px] font-black flex items-center gap-1 shadow"
          >
            Move to <ChevronRight size={12} className="rotate-90" />
          </button>
          {open && (
            <div
              className="absolute bottom-full mb-2 right-0 w-64 max-h-64 overflow-y-auto rounded-xl border border-[rgba(31,72,255,0.2)] bg-white shadow-2xl p-1.5 space-y-0.5"
              onMouseLeave={() => setOpen(false)}
            >
              <button
                onClick={() => { setOpen(false); onNewRound(); }}
                className="w-full px-2.5 py-1.5 rounded-md text-left text-[12px] font-bold text-[#1f48ff] hover:bg-[rgba(31,72,255,0.06)] flex items-center gap-1.5"
              >
                <Plus size={12} strokeWidth={3} /> New round…
              </button>
              <div className="h-px bg-[rgba(31,72,255,0.08)] my-0.5" />
              {rounds.map(r => (
                <button
                  key={r.roundName}
                  onClick={() => { setOpen(false); onMove(r.roundName); }}
                  className="w-full px-2.5 py-1.5 rounded-md text-left text-[12px] text-[#010a4f] hover:bg-[rgba(31,72,255,0.06)] flex items-center justify-between gap-2"
                >
                  <span className="truncate">{r.roundName}</span>
                  <span className="text-[10px] text-[#010a4f]/45 tabular-nums shrink-0">{r.customers.length}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={onClear}
          className="text-[11px] font-bold text-white/65 hover:text-white px-2 py-1.5"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
