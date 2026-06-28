import { useState, useMemo, useCallback, Fragment } from "react";
import { Plus, GripVertical, Calendar, Users } from "lucide-react";
import {
  DndContext, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, DragOverlay,
} from "@dnd-kit/core";

// ─── Helpers — pointer-centred overlay + pointer-first collision ───────────
// Without this the DragOverlay's left edge sticks to wherever the drag
// started inside the card (the grip handle), so the floating preview
// drifts off to the right of the cursor and feels like it's snapping into
// random columns. snapCenterToCursor pins the overlay's centre to the
// pointer; collisionDetection prefers whichever droppable the pointer is
// actually over, falling back to rect intersection for the empty columns.
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
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return rectIntersection(args);
}
import {
  SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useData } from "../../context/DataContext";
import { TYPE, STATUS_STYLES, STATUS_LABELS } from "../../lib/jobTheme";
import {
  DAYS_SHORT,
  fmtMoney, fmtTime, durLabel,
  getJobAssignees, weatherChip, getToday, isoDate, tintForCrew,
} from "./helpers";

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

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Cadi palette resolver ─────────────────────────────────────────────────
// Pure function so it can be reused by SortableJobCard and the DragOverlay.
function paletteFor({ isDone, isOverdue, isToday }) {
  if (isDone) return {
    cardStyle: { background: 'rgba(240,244,255,0.55)', borderColor: 'rgba(31,72,255,0.08)' },
    addrCls:   'text-[#010a4f]/30 line-through',
    bodyCls:   'text-[#010a4f]/25 line-through',
    priceCls:  'text-[#010a4f]/30 line-through',
  };
  if (isOverdue) return {
    cardStyle: { background: 'linear-gradient(160deg, rgba(255,228,225,0.85) 0%, rgba(255,240,235,0.7) 100%)', borderColor: 'rgba(217,98,77,0.25)' },
    addrCls:   'text-[#8a2f1f] font-bold',
    bodyCls:   'text-[#a14533]/85',
    priceCls:  'text-[#8a2f1f]',
  };
  if (isToday) return {
    cardStyle: { background: 'linear-gradient(160deg, #ffffff 0%, rgba(240,244,255,0.85) 100%)', borderColor: 'rgba(31,72,255,0.22)' },
    addrCls:   'text-[#010a4f]',
    bodyCls:   'text-[#010a4f]/55',
    priceCls:  'text-emerald-600',
  };
  return {
    cardStyle: { background: 'linear-gradient(160deg, rgba(255,255,255,0.92) 0%, rgba(240,244,255,0.6) 100%)', borderColor: 'rgba(31,72,255,0.1)' },
    addrCls:   'text-[#010a4f]',
    bodyCls:   'text-[#010a4f]/50',
    priceCls:  'text-emerald-600',
  };
}

// ─── Sortable job card ─────────────────────────────────────────────────────
// Layout matches the static card (so cross-column drops look continuous), but
// with a grip handle on the left edge that owns drag listeners. The card
// itself stays click-to-open so dragging never fires onJobClick.
function SortableJobCard({ job, dateStr, todayIso, custById, onJobClick }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: job.id,
    data: { type: 'job', date: dateStr },
  });

  const t        = TYPE[job.type] || TYPE.residential;
  const cust     = job.customerId ? custById.get(job.customerId) : null;
  const address  = cust?.addressLine1 || job.addressLine1 || job.postcode || '';
  const customer = job.customer || cust?.name || '';
  const isDone   = job.status === 'complete';
  const isOverdue = !isDone && dateStr && dateStr < todayIso;
  const isToday  = dateStr === todayIso;
  const { cardStyle, addrCls, bodyCls, priceCls } = paletteFor({ isDone, isOverdue, isToday });

  const [dd, mm] = dateStr ? dateStr.slice(5).split('-').reverse() : ['', ''];
  const dueLabel = dateStr ? `${dd}/${mm}` : '';

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : 'auto',
    ...cardStyle,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-stretch rounded-xl border overflow-hidden transition-shadow hover:shadow-md hover:shadow-[#1f48ff]/10"
    >
      {/* Job-type accent bar */}
      <div className="w-1 shrink-0" style={{ background: isDone ? 'rgba(31,72,255,0.15)' : t.bar }} />

      {/* Drag handle — owns the pointer/touch/keyboard listeners */}
      <div
        {...(isDone ? {} : { ...attributes, ...listeners })}
        className={`w-4 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)] ${
          isDone ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none'
        }`}
        title={isDone ? '' : 'Drag to reschedule'}
      >
        {!isDone && <GripVertical size={11} className="text-[#010a4f]/25" />}
      </div>

      {/* Click area — opens the drawer */}
      <button
        type="button"
        onClick={() => onJobClick(job)}
        className="flex-1 min-w-0 px-2.5 py-1.5 text-left"
        title={`${customer || address} — £${job.price}`}
      >
        <div className="flex items-baseline justify-between gap-1.5">
          <p className={`text-[12px] font-bold truncate leading-tight ${addrCls}`}>
            {address || customer || 'Untitled job'}
          </p>
          <p className={`text-[11px] font-black tabular-nums shrink-0 ${priceCls}`}>
            {isDone ? 'DONE' : `£${fmtMoney(job.price)}`}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-1.5 mt-0.5">
          <p className={`text-[10.5px] truncate leading-tight ${bodyCls}`}>
            {customer || job.service || job.postcode || ''}
          </p>
          {dueLabel && !isDone && (
            <p className={`text-[10px] tabular-nums shrink-0 ${bodyCls}`}>{dueLabel}</p>
          )}
        </div>
      </button>
    </div>
  );
}

// ─── Droppable day column ──────────────────────────────────────────────────
// useDroppable on the column body so an empty day can still receive drops.
// The SortableContext wraps the column's job ids so reordering within the
// column works through dnd-kit's sortable strategy.
function DayColumn({
  dayIdx, dayShort, dateObj, dateStr, isToday, weather,
  dayJobs, jobIds, onJobClick, onAddJob, custById, todayIso,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dateStr ? `col:${dateStr}` : `col:idx${dayIdx}`,
    data: { type: 'column', date: dateStr },
  });

  const rev       = dayJobs.reduce((s, j) => s + j.price, 0);
  const totalMins = dayJobs.reduce((s, j) => s + (j.durationHrs ?? 0) * 60, 0);
  const wxDay     = dateStr && weather?.byDate?.[dateStr];
  const w         = wxDay ? weatherChip(wxDay) : null;

  return (
    <div
      className={`flex-1 min-w-[170px] border-r border-[rgba(31,72,255,0.08)] last:border-r-0 flex flex-col ${
        isToday ? 'bg-[rgba(31,72,255,0.04)]' : ''
      }`}
    >
      {/* Sticky column header — Cadi brand gradient */}
      <div
        className="sticky top-0 z-10 px-3 py-2.5 border-b border-[rgba(153,197,255,0.18)]"
        style={{
          background: isToday
            ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
            : 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)',
          color: '#ffffff',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: isToday ? '#ffffff' : '#99c5ff' }}>
            {dayShort} <span className="text-white">{dateObj?.getDate() ?? ''}</span>
          </p>
          {w && (
            <span className="text-[10px] font-semibold flex items-center gap-0.5 opacity-90" title={w.title}>
              <span>{w.emoji}</span>
              {w.tempMaxC != null && <span className="tabular-nums">{Math.round(w.tempMaxC)}°</span>}
            </span>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className={`px-3 py-1.5 text-[11px] font-semibold border-b flex items-center gap-2 ${
        isToday ? 'bg-[rgba(31,72,255,0.08)] border-[rgba(31,72,255,0.12)]' : 'bg-white/60 border-[rgba(31,72,255,0.08)]'
      }`}>
        {dayJobs.length === 0 ? (
          <span className="text-[#010a4f]/35 font-normal italic">Nothing booked</span>
        ) : (
          <>
            <span className="text-[#010a4f]/75">{dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}</span>
            <span className="text-emerald-600 tabular-nums">£{fmtMoney(rev)}</span>
            {totalMins > 0 && (
              <span className="text-[#010a4f]/45 tabular-nums">
                {totalMins >= 60 ? `${Math.floor(totalMins/60)}h${totalMins%60 ? ` ${totalMins%60}m` : ''}` : `${totalMins}m`}
              </span>
            )}
          </>
        )}
      </div>

      {/* Add job */}
      {onAddJob && dateStr && (
        <button
          onClick={() => onAddJob(dateStr)}
          className="mx-2 my-1.5 px-2 py-1.5 rounded-lg border border-dashed border-[rgba(31,72,255,0.25)] bg-[rgba(31,72,255,0.04)] hover:bg-[rgba(31,72,255,0.1)] hover:border-[#1f48ff] text-[#1f48ff] text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
        >
          <Plus size={11} strokeWidth={3} /> Add Job
        </button>
      )}

      {/* Droppable list — highlights when a foreign card hovers over */}
      <div
        ref={setNodeRef}
        className={`px-1.5 pb-2 space-y-1.5 flex-1 min-h-[80px] rounded-md transition-colors ${
          isOver ? 'bg-[rgba(31,72,255,0.08)] ring-1 ring-[#1f48ff]/30' : ''
        }`}
      >
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          {dayJobs.map(job => (
            <SortableJobCard
              key={job.id}
              job={job}
              dateStr={dateStr}
              todayIso={todayIso}
              custById={custById}
              onJobClick={onJobClick}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

// ─── Staff-rows × day-columns grid ─────────────────────────────────────────
// Pivots the same week of jobs to a staff-first view. Each row is one
// staff member's whole week; cells contain compact mini-cards (address +
// price + type bar). Click any card to open the same JobDrawer as the
// day view. Drag is intentionally not wired here for v1 — reassigning a
// job by drag would need a UI for picking the new staff member which is
// outside the current scope.
function StaffMiniCard({ job, custById, isToday, isOverdue, onJobClick }) {
  const t = TYPE[job.type] || TYPE.residential;
  const cust = job.customerId ? custById.get(job.customerId) : null;
  const address  = cust?.addressLine1 || job.addressLine1 || job.postcode || job.customer || 'Job';
  const isDone   = job.status === 'complete';

  let bg = 'bg-white/85', addrCls = 'text-[#010a4f]', priceCls = 'text-emerald-600';
  if (isDone) {
    bg = 'bg-[rgba(31,72,255,0.04)]'; addrCls = 'text-[#010a4f]/30 line-through'; priceCls = 'text-[#010a4f]/30 line-through';
  } else if (isOverdue) {
    bg = 'bg-[rgba(255,228,225,0.7)]'; addrCls = 'text-[#8a2f1f] font-bold'; priceCls = 'text-[#8a2f1f]';
  } else if (isToday) {
    bg = 'bg-white'; addrCls = 'text-[#010a4f]';
  }

  return (
    <button
      onClick={() => onJobClick(job)}
      className={`w-full flex items-stretch rounded-md border border-[rgba(31,72,255,0.1)] overflow-hidden text-left transition-shadow hover:shadow-md hover:shadow-[#1f48ff]/10 ${bg}`}
      title={`${address} — £${job.price}`}
    >
      <div className="w-[3px] shrink-0" style={{ background: isDone ? 'rgba(31,72,255,0.15)' : t.bar }} />
      <div className="flex-1 min-w-0 flex items-baseline gap-1 px-1.5 py-0.5">
        <p className={`text-[10.5px] font-bold truncate leading-tight ${addrCls}`}>{address}</p>
        <p className={`text-[10px] font-black tabular-nums shrink-0 ml-auto ${priceCls}`}>£{fmtMoney(job.price)}</p>
      </div>
    </button>
  );
}

function StaffGrid({ staffRows, weekDates, todayIso, custById, onJobClick }) {
  if (staffRows.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-[#010a4f]/45">
        <Users size={24} className="mx-auto mb-3 text-[#010a4f]/30" />
        <p className="text-sm font-bold">No jobs to show</p>
        <p className="text-[11px] mt-1">Once jobs are assigned to staff they'll show here.</p>
      </div>
    );
  }

  const COL_WIDTH = 150;
  const ROW_HEADER = 170;

  return (
    <div className="overflow-x-auto">
      <div className="grid" style={{ gridTemplateColumns: `${ROW_HEADER}px repeat(7, minmax(${COL_WIDTH}px, 1fr))`, minWidth: ROW_HEADER + 7 * COL_WIDTH }}>
        {/* Top-left corner + 7 day header cells */}
        <div
          className="sticky left-0 z-10 px-3 py-2 border-b border-r"
          style={{
            background: 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)',
            borderColor: 'rgba(153,197,255,0.18)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: '#99c5ff' }}>Staff</p>
        </div>
        {DAYS_SHORT.map((d, i) => {
          const dateObj = weekDates[i];
          const dateStr = dateObj ? isoDate(dateObj) : null;
          const isToday = dateStr === todayIso;
          return (
            <div
              key={d}
              className="px-2 py-2 border-b border-r last:border-r-0 flex items-baseline justify-between gap-1"
              style={{
                background: isToday
                  ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)'
                  : 'linear-gradient(135deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)',
                color: '#ffffff',
                borderColor: 'rgba(153,197,255,0.18)',
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: isToday ? '#ffffff' : '#99c5ff' }}>
                {d}
              </p>
              <p className="text-[11px] font-black tabular-nums">{dateObj?.getDate() ?? ''}</p>
            </div>
          );
        })}

        {/* Staff rows */}
        {staffRows.map(row => (
          <Fragment key={row.name}>
            {/* Row header — name + week totals + tint dot */}
            <div className="sticky left-0 z-10 px-3 py-2.5 border-b border-r flex items-center gap-2 bg-white/85 backdrop-blur" style={{ borderColor: 'rgba(31,72,255,0.08)' }}>
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
                style={{ background: row.tint }}
              >
                {row.name === '__unassigned__' ? '?' : row.label.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-black text-[#010a4f] truncate">{row.label}</p>
                <p className="text-[10px] text-[#010a4f]/55 tabular-nums">
                  {row.totalJobs} job{row.totalJobs === 1 ? '' : 's'} · £{fmtMoney(row.totalRev)}
                </p>
              </div>
            </div>
            {/* 7 day cells */}
            {row.byDay.map((cellJobs, i) => {
              const dateObj = weekDates[i];
              const dateStr = dateObj ? isoDate(dateObj) : null;
              const isToday = dateStr === todayIso;
              const isPast  = dateStr && dateStr < todayIso;
              return (
                <div
                  key={i}
                  className={`px-1.5 py-1.5 border-b border-r last:border-r-0 space-y-1 min-h-[60px] ${
                    isToday ? 'bg-[rgba(31,72,255,0.04)]' : ''
                  }`}
                  style={{ borderColor: 'rgba(31,72,255,0.06)' }}
                >
                  {cellJobs.map(job => (
                    <StaffMiniCard
                      key={job.id}
                      job={job}
                      custById={custById}
                      isToday={isToday}
                      isOverdue={isPast && job.status !== 'complete'}
                      onJobClick={onJobClick}
                    />
                  ))}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────
export default function WeekView({ jobs, onJobClick, weekDates = [], typeFilter = "all", crewFilter = "all", weather = null, onAddJob, updateJob, onError }) {
  const { customers = [] } = useData();
  const [expandedDay, setExpandedDay] = useState(0);
  const [activeId, setActiveId] = useState(null);
  // Layout toggle — 'day' keeps the existing 7-day column grid; 'staff'
  // pivots to a staff-rows × day-columns grid so the owner can see one
  // person's week at a glance.
  const [layout, setLayout] = useState('day');
  // Optimistic per-job overrides so the UI updates instantly while the
  // updateJob call round-trips. Keyed by job id → { date, displayOrder }.
  const [overrides, setOverrides] = useState({});

  const custById = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const todayIso = isoDate(getToday());

  const filteredJobs = useMemo(() => jobs.filter(j => {
    if (typeFilter !== "all" && j.type !== typeFilter) return false;
    if (crewFilter !== "all") {
      const assignees = getJobAssignees(j);
      if (crewFilter === "__unassigned__") return assignees.length === 0;
      if (!assignees.includes(crewFilter)) return false;
    }
    return true;
  }), [jobs, typeFilter, crewFilter]);

  // Apply optimistic overrides on top of the live jobs.
  const effectiveJobs = useMemo(() => filteredJobs.map(j => {
    const o = overrides[j.id];
    if (!o) return j;
    return { ...j, ...(o.date ? { date: o.date } : {}), ...(o.displayOrder != null ? { displayOrder: o.displayOrder } : {}) };
  }), [filteredJobs, overrides]);

  // Bucket into the 7 visible day columns. Jobs whose date is outside the
  // displayed week (after a cross-day drop just out of view) are dropped
  // from the grid — the next data refresh will reconcile.
  const jobsByDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => []);
    const weekDateStrs = weekDates.map(d => d ? isoDate(d) : null);
    for (const j of effectiveJobs) {
      if (!j.date) continue;
      const col = weekDateStrs.indexOf(j.date);
      if (col < 0) continue;
      map[col].push(j);
    }
    for (const arr of map) {
      arr.sort((a, b) => {
        const ao = a.displayOrder ?? 999;
        const bo = b.displayOrder ?? 999;
        if (ao !== bo) return ao - bo;
        return (a.startHour ?? 0) - (b.startHour ?? 0);
      });
    }
    return map;
  }, [effectiveJobs, weekDates]);

  // For the staff layout: bucket each job by (staffName, dayIdx). A job
  // assigned to N staff appears in each of their rows. Jobs with no
  // assignee land in the "__unassigned__" row at the bottom.
  const staffRows = useMemo(() => {
    const byStaff = new Map();
    const weekDateStrs = weekDates.map(d => d ? isoDate(d) : null);
    for (const j of effectiveJobs) {
      if (!j.date) continue;
      const col = weekDateStrs.indexOf(j.date);
      if (col < 0) continue;
      const assignees = getJobAssignees(j);
      const list = assignees.length > 0 ? assignees : ['__unassigned__'];
      for (const name of list) {
        if (!byStaff.has(name)) {
          byStaff.set(name, {
            name,
            label: name === '__unassigned__' ? 'Unassigned' : name,
            tint:  name === '__unassigned__' ? '#94A3B8' : tintForCrew(name),
            byDay: Array.from({ length: 7 }, () => []),
            totalJobs: 0,
            totalRev:  0,
          });
        }
        const row = byStaff.get(name);
        row.byDay[col].push(j);
        row.totalJobs += 1;
        row.totalRev  += (Number(j.price) || 0);
      }
    }
    // Sort each cell by display order, then unassigned to the bottom and
    // busiest staff to the top.
    for (const row of byStaff.values()) {
      for (const arr of row.byDay) {
        arr.sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || (a.startHour ?? 0) - (b.startHour ?? 0));
      }
    }
    return [...byStaff.values()].sort((a, b) => {
      if (a.name === '__unassigned__') return 1;
      if (b.name === '__unassigned__') return -1;
      return b.totalJobs - a.totalJobs;
    });
  }, [effectiveJobs, weekDates]);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), []);

  // Drop resolves to either another job (sortable) or a column (droppable).
  // Three cases:
  //   1. dropped on a job in the same day → reorder within that day
  //   2. dropped on a job in another day  → move to that day at that index
  //   3. dropped on the empty column area → move to that day at the end
  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null);
    if (!over || !updateJob) return;

    const activeJob = effectiveJobs.find(j => j.id === active.id);
    if (!activeJob) return;
    const fromDate = activeJob.date;

    // Resolve drop target → target date + target index within that day
    const overData = over.data?.current || {};
    let toDate, toIndex;
    if (overData.type === 'column') {
      toDate  = overData.date;
      toIndex = jobsByDay[Math.max(0, weekDates.findIndex(d => d && isoDate(d) === toDate))]?.length ?? 0;
    } else {
      // Dropped on another job — figure out which day it's in
      const overJob = effectiveJobs.find(j => j.id === over.id);
      if (!overJob) return;
      toDate = overJob.date;
      const colIdx = weekDates.findIndex(d => d && isoDate(d) === toDate);
      const col    = jobsByDay[colIdx] || [];
      toIndex = col.findIndex(j => j.id === over.id);
      if (toIndex < 0) toIndex = col.length;
    }

    if (!toDate) return;

    const sameDay = fromDate === toDate;
    const fromColIdx = weekDates.findIndex(d => d && isoDate(d) === fromDate);
    const toColIdx   = weekDates.findIndex(d => d && isoDate(d) === toDate);
    const fromCol    = jobsByDay[fromColIdx] || [];
    const toCol      = jobsByDay[toColIdx]   || [];
    const fromIndex  = fromCol.findIndex(j => j.id === active.id);

    if (sameDay && fromIndex === toIndex) return;

    // Build the new ordering for the destination day after the move
    let newOrder;
    if (sameDay) {
      newOrder = arrayMove(toCol.map(j => j.id), fromIndex, toIndex);
    } else {
      const ids = toCol.filter(j => j.id !== active.id).map(j => j.id);
      ids.splice(Math.min(toIndex, ids.length), 0, active.id);
      newOrder = ids;
    }

    // Snapshot prior overrides so we can revert if the DB save fails.
    const prevOverrides = overrides;

    // Optimistic overrides — instantly reflect new date + display order
    setOverrides(prev => {
      const next = { ...prev };
      next[active.id] = { date: toDate, displayOrder: newOrder.indexOf(active.id) };
      newOrder.forEach((id, i) => {
        if (id === active.id) return;
        const existingDate = next[id]?.date ?? toCol.find(j => j.id === id)?.date ?? toDate;
        next[id] = { date: existingDate, displayOrder: i };
      });
      return next;
    });

    // Persist — only emit updates for jobs whose final order/date actually
    // changed. If any write fails, revert the optimistic UI and toast the user.
    try {
      const writes = [];
      writes.push(
        sameDay
          ? updateJob(active.id, { display_order: newOrder.indexOf(active.id) })
          : updateJob(active.id, { date: toDate, display_order: newOrder.indexOf(active.id) })
      );
      newOrder.forEach((id, i) => {
        if (id === active.id) return;
        const orig = toCol.find(j => j.id === id);
        if (!orig) return;
        if ((orig.displayOrder ?? 999) !== i && orig.status !== 'complete') {
          writes.push(updateJob(id, { display_order: i }));
        }
      });
      await Promise.all(writes);
    } catch (err) {
      setOverrides(prevOverrides);
      onError?.(err?.message?.includes('row-level') ? "You don't have permission to move that job." : "Couldn't save the move. Try again.");
    }
  }, [effectiveJobs, jobsByDay, weekDates, updateJob, overrides, onError]);

  const activeJob = activeId ? effectiveJobs.find(j => j.id === activeId) : null;

  return (
    <>
      {/* Mobile: day-by-day cards (unchanged, DnD desktop-only) */}
      <div className="sm:hidden space-y-2">
        {DAYS_SHORT.map((day, dayIdx) => {
          const dayJobs = jobsByDay[dayIdx];
          const dayRevenue = dayJobs.reduce((s,j) => s + j.price, 0);
          const isOpen = expandedDay === dayIdx;

          return (
            <LightCard key={day}>
              <button
                onClick={() => setExpandedDay(isOpen ? -1 : dayIdx)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-white ${
                  weekDates[dayIdx] && isoDate(weekDates[dayIdx]) === isoDate(getToday()) ? 'bg-blue-600' : 'bg-slate-900'
                }`}>
                  <span className="text-[10px] font-bold uppercase leading-none">{day}</span>
                  <span className="text-sm font-black leading-tight">{weekDates[dayIdx]?.getDate() ?? 6 + dayIdx}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">
                      {dayJobs.length} {dayJobs.length === 1 ? "job" : "jobs"}
                    </span>
                    {(() => {
                      const dateStr = weekDates[dayIdx] ? isoDate(weekDates[dayIdx]) : null;
                      const day = dateStr && weather?.byDate?.[dateStr];
                      const w = day ? weatherChip(day) : null;
                      if (!w) return null;
                      return (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${w.rainy ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`} title={w.title}>
                          {w.emoji}{w.tempMaxC != null ? ` ${Math.round(w.tempMaxC)}°` : ''}
                        </span>
                      );
                    })()}
                  </div>
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
                    £{fmtMoney(dayRevenue)}
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
                      <div className="w-1 self-stretch rounded-full" style={{ background: (TYPE[job.type] || TYPE.residential).bar }} />
                      <div className="w-12 shrink-0">
                        <p className="text-xs font-mono text-slate-500">{fmtTime(job.startHour)}</p>
                        <p className="text-xs text-slate-400">{durLabel(job.durationHrs)}</p>
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

      {/* Desktop: drag-and-drop bulk view with day/staff layout toggle */}
      <LightCard className="hidden sm:block overflow-hidden">
        {/* Layout toggle — segmented control above the grid. Sticky so
            it stays visible as the user scrolls long lists. */}
        <div
          className="sticky top-0 z-20 px-3 py-2 flex items-center justify-end gap-1.5 border-b"
          style={{ background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(31,72,255,0.08)', backdropFilter: 'blur(8px)' }}
        >
          <div className="flex rounded-lg border border-[rgba(31,72,255,0.18)] bg-white overflow-hidden text-[11px] font-bold">
            {[
              { key: 'day',   label: 'By day',   Icon: Calendar },
              { key: 'staff', label: 'By staff', Icon: Users    },
            ].map(({ key, label, Icon }) => {
              const active = layout === key;
              return (
                <button
                  key={key}
                  onClick={() => setLayout(key)}
                  className="px-2.5 py-1.5 flex items-center gap-1.5 transition-all"
                  style={{
                    background: active ? 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)' : 'transparent',
                    color:      active ? '#ffffff' : '#010a4f',
                  }}
                >
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={pointerFirstCollision}
          modifiers={[snapCenterToCursor]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {layout === 'day' ? (
          <div className="overflow-x-auto">
            <div className="flex" style={{ minWidth: 7 * 170 }}>
              {DAYS_SHORT.map((dayShort, dayIdx) => {
                const dayJobs = jobsByDay[dayIdx];
                const dateObj = weekDates[dayIdx];
                const dateStr = dateObj ? isoDate(dateObj) : null;
                const isToday = dateStr === todayIso;
                return (
                  <DayColumn
                    key={dayShort}
                    dayIdx={dayIdx}
                    dayShort={dayShort}
                    dateObj={dateObj}
                    dateStr={dateStr}
                    isToday={isToday}
                    weather={weather}
                    dayJobs={dayJobs}
                    jobIds={dayJobs.map(j => j.id)}
                    onJobClick={onJobClick}
                    onAddJob={onAddJob}
                    custById={custById}
                    todayIso={todayIso}
                  />
                );
              })}
            </div>
          </div>
          ) : (
          <StaffGrid
            staffRows={staffRows}
            weekDates={weekDates}
            todayIso={todayIso}
            custById={custById}
            onJobClick={onJobClick}
          />
          )}

          <DragOverlay dropAnimation={{ duration: 180 }}>
            {activeJob ? (() => {
              const cust = activeJob.customerId ? custById.get(activeJob.customerId) : null;
              const address  = cust?.addressLine1 || activeJob.addressLine1 || activeJob.postcode || '';
              const customer = activeJob.customer || cust?.name || '';
              const t = TYPE[activeJob.type] || TYPE.residential;
              const isDone = activeJob.status === 'complete';
              const { cardStyle, addrCls, priceCls } = paletteFor({ isDone, isOverdue: false, isToday: false });
              return (
                <div
                  className="flex items-stretch rounded-xl border overflow-hidden shadow-2xl shadow-[#1f48ff]/30 w-[160px] rotate-1"
                  style={cardStyle}
                >
                  <div className="w-1 shrink-0" style={{ background: t.bar }} />
                  <div className="w-4 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)]">
                    <GripVertical size={11} className="text-[#010a4f]/25" />
                  </div>
                  <div className="flex-1 min-w-0 px-2.5 py-1.5">
                    <div className="flex items-baseline justify-between gap-1.5">
                      <p className={`text-[12px] font-bold truncate leading-tight ${addrCls}`}>
                        {address || customer || 'Untitled job'}
                      </p>
                      <p className={`text-[11px] font-black tabular-nums shrink-0 ${priceCls}`}>
                        £{fmtMoney(activeJob.price)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })() : null}
          </DragOverlay>
        </DndContext>
      </LightCard>
    </>
  );
}
