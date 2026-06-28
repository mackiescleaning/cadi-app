import { useState, useEffect, useMemo, useCallback } from "react";
import {
  DndContext, pointerWithin, rectIntersection, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, GripVertical } from "lucide-react";
import { TYPE } from "../../lib/jobTheme";
import { useData } from "../../context/DataContext";
import { useCountUp } from "../../hooks/useCountUp";
import { fmtMoney, getJobAssignees } from "./helpers";
import { detectJobRisks } from "../../lib/jobRisk";
import RiskChip from "./RiskChip";

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

// ─── DnD helpers — ported from WeekView so both views feel identical ───────
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
  return pointerHits.length > 0 ? pointerHits : rectIntersection(args);
}

// ─── Cadi palette resolver — shared with the overlay ───────────────────────
function paletteFor({ isDone }) {
  if (isDone) return {
    cardStyle: { background: 'rgba(240,244,255,0.55)', borderColor: 'rgba(31,72,255,0.08)' },
    addrCls:   'text-[#010a4f]/30 line-through',
    bodyCls:   'text-[#010a4f]/25 line-through',
    priceCls:  'text-[#010a4f]/30 line-through',
  };
  return {
    cardStyle: { background: 'linear-gradient(160deg, #ffffff 0%, rgba(240,244,255,0.85) 100%)', borderColor: 'rgba(31,72,255,0.18)' },
    addrCls:   'text-[#010a4f]',
    bodyCls:   'text-[#010a4f]/55',
    priceCls:  'text-emerald-600',
  };
}

function SortableJobCard({ job, idx, onJobClick, updateJob, custById, risk, onError }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: job.id });

  const isDone = job.status === 'complete';
  const t      = TYPE[job.type] || TYPE.residential;
  const cust   = job.customerId ? custById.get(job.customerId) : null;
  const address  = cust?.addressLine1 || job.addressLine1 || '';
  const postcode = cust?.postcode    || job.postcode    || '';
  const customer = job.customer || cust?.name || '';
  const subtitle = [job.service, postcode].filter(Boolean).join(' · ');

  const { cardStyle, addrCls, bodyCls, priceCls } = paletteFor({ isDone });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex:  isDragging ? 10 : 'auto',
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

      {/* Drag handle / done index */}
      <div
        {...(isDone ? {} : { ...attributes, ...listeners })}
        className={`w-8 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)] ${
          isDone ? 'cursor-default' : 'cursor-grab active:cursor-grabbing touch-none'
        }`}
        title={isDone ? '' : 'Drag to reorder'}
      >
        {isDone
          ? <span className="text-xs font-black text-[#010a4f]/25 tabular-nums">{idx + 1}</span>
          : <GripVertical size={14} className="text-[#010a4f]/35" />
        }
      </div>

      {/* Click area — opens drawer */}
      <button
        type="button"
        onClick={() => onJobClick(job)}
        className="flex-1 min-w-0 px-3 py-2.5 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[14px] font-bold leading-tight truncate ${addrCls}`}>
            {address || customer || 'Untitled job'}
          </p>
          <p className={`text-[13px] font-black tabular-nums shrink-0 ${priceCls}`}>
            £{fmtMoney(job.price)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className={`text-[11.5px] truncate leading-tight ${bodyCls}`}>
            {customer && address ? customer : subtitle || customer}
            {customer && address && subtitle ? ` · ${subtitle}` : ''}
          </p>
          {!isDone && risk && <RiskChip risk={risk} compact />}
        </div>
      </button>

      {/* Done toggle */}
      <button
        onClick={() => {
          updateJob(job.id, { status: isDone ? 'scheduled' : 'complete' })
            .catch(err => {
              // Surface the underlying Postgres / Supabase error so we can
              // diagnose recurring "couldn't update" reports. The user-facing
              // toast stays human-friendly but the console gives us a real
              // signal.
              console.error('[job-status-update]', {
                job_id: job.id,
                attempted_status: isDone ? 'scheduled' : 'complete',
                error: err,
                message: err?.message,
                code: err?.code,
                details: err?.details,
                hint: err?.hint,
              });
              onError?.(err?.message?.includes('row-level')
                ? "You don't have permission to update that job."
                : `Couldn't update the job status. ${err?.message || 'Try again.'}`);
            });
        }}
        className={`shrink-0 w-14 flex flex-col items-center justify-center gap-0.5 border-l border-[rgba(31,72,255,0.06)] transition-all active:scale-95 select-none ${
          isDone
            ? 'bg-white hover:bg-[rgba(31,72,255,0.04)] text-[#010a4f]/40'
            : 'bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-600'
        }`}
        title={isDone ? 'Mark as not done' : 'Mark as done'}
      >
        <Check size={18} strokeWidth={2.5} />
        <span className="text-[9px] font-bold uppercase tracking-wider">
          {isDone ? 'Undo' : 'Done'}
        </span>
      </button>
    </div>
  );
}

export default function DayView({ jobs, onJobClick, typeFilter, crewFilter, updateJob, onAddJob, onOpenRounds, onImport, weather, onError }) {
  const { customers } = useData();

  const filteredJobs = jobs.filter(j => {
    if (typeFilter !== "all" && j.type !== typeFilter) return false;
    if (crewFilter !== "all") {
      const assignees = getJobAssignees(j);
      if (crewFilter === "__unassigned__") return assignees.length === 0;
      if (!assignees.includes(crewFilter)) return false;
    }
    return true;
  });

  const initialOrder = useMemo(() => {
    return [...filteredJobs]
      .sort((a, b) => {
        const aDone = a.status === 'complete';
        const bDone = b.status === 'complete';
        if (aDone !== bDone) return aDone ? 1 : -1;
        const aOrd = a.displayOrder ?? 0;
        const bOrd = b.displayOrder ?? 0;
        if (aOrd !== bOrd) return aOrd - bOrd;
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return (a.customer || '').localeCompare(b.customer || '');
      })
      .map(j => j.id);
  }, [filteredJobs.map(j => j.id + j.status + (j.displayOrder ?? 0)).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const [order, setOrder] = useState(initialOrder);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => { setOrder(initialOrder); }, [initialOrder.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const byId = new Map(filteredJobs.map(j => [j.id, j]));
    const incomplete = order.filter(id => byId.get(id) && byId.get(id).status !== 'complete');
    const complete   = order.filter(id => byId.get(id) && byId.get(id).status === 'complete');
    return [...incomplete, ...complete].map(id => byId.get(id)).filter(Boolean);
  }, [order, filteredJobs]);

  const total  = filteredJobs.length;
  const done   = filteredJobs.filter(j => j.status === 'complete').length;
  const earned = filteredJobs.filter(j => j.status === 'complete').reduce((s, j) => s + (j.price || 0), 0);
  const toGo   = filteredJobs.filter(j => j.status !== 'complete').reduce((s, j) => s + (j.price || 0), 0);
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const earnedAnim = useCountUp(earned, 600);

  const routePostcodes = sorted
    .filter(j => j.status !== 'complete' && j.postcode)
    .map(j => j.postcode.trim())
    .filter(Boolean);

  function handleRoute() {
    if (routePostcodes.length === 0) return;
    const url = `https://www.google.com/maps/dir/${routePostcodes.map(p => encodeURIComponent(p)).join('/')}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const custById = useMemo(() => {
    const m = new Map();
    customers.forEach(c => m.set(c.id, c));
    return m;
  }, [customers]);

  const riskByJobId = useMemo(() => {
    const map = new Map();
    for (const job of filteredJobs) {
      const customer = job.customerId ? custById.get(job.customerId) : null;
      const r = detectJobRisks(job, {
        allJobs: filteredJobs,
        weatherByDate: weather?.byDate ?? null,
        customer,
      });
      if (r.severity) map.set(job.id, r);
    }
    return map;
  }, [filteredJobs, weather, custById]);

  const sensors = useSensors(
    useSensor(PointerSensor,  { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(({ active }) => setActiveId(active.id), []);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(active.id);
    const newIdx = order.indexOf(over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const prevOrder = order;
    const nextOrder = arrayMove(order, oldIdx, newIdx);
    setOrder(nextOrder);
    const byId = new Map(filteredJobs.map(j => [j.id, j]));
    try {
      const writes = nextOrder.map((id, i) => {
        const job = byId.get(id);
        if (job && job.status !== 'complete' && (job.displayOrder ?? 0) !== i) {
          return updateJob(id, { display_order: i });
        }
        return null;
      }).filter(Boolean);
      await Promise.all(writes);
    } catch (err) {
      setOrder(prevOrder);
      onError?.(err?.message?.includes('row-level') ? "You don't have permission to reorder these jobs." : "Couldn't save the new order. Try again.");
    }
  }, [order, filteredJobs, updateJob, onError]);

  const activeJob = activeId ? filteredJobs.find(j => j.id === activeId) : null;

  if (total === 0) {
    return (
      <LightCard>
        <div className="px-6 py-12 text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(31,72,255,0.06)] border border-[rgba(31,72,255,0.15)] flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">☕</span>
          </div>
          <p className="text-base font-black text-[#010a4f] mb-1">Nothing booked today.</p>
          <p className="text-sm text-[#010a4f]/55 mb-5 leading-relaxed">
            A clear day, or three clicks away from a full one. Pick a start:
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {onAddJob && (
              <button
                onClick={onAddJob}
                className="px-4 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a6bff] text-white text-sm font-black shadow-lg shadow-[#1f48ff]/25 transition-all"
              >
                + One-off job
              </button>
            )}
            {onOpenRounds && (
              <button
                onClick={onOpenRounds}
                className="px-4 py-2.5 rounded-xl bg-white border border-[rgba(31,72,255,0.15)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] text-[#010a4f]/75 text-sm font-semibold transition-colors"
              >
                🔄 Schedule a round
              </button>
            )}
            {onImport && (
              <button
                onClick={onImport}
                className="px-4 py-2.5 rounded-xl bg-white border border-[rgba(31,72,255,0.15)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] text-[#010a4f]/75 text-sm font-semibold transition-colors"
              >
                📥 Import customers
              </button>
            )}
          </div>
        </div>
      </LightCard>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl mx-auto">

      {/* Summary card — Cadi-tinted */}
      <LightCard>
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-base font-black text-[#010a4f]">
                {done === total && total > 0 ? "🎉 All done!" : `${done} of ${total} complete`}
              </p>
              <p className="text-xs text-[#010a4f]/55 mt-0.5">
                {done > 0 && (
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    £{fmtMoney(earnedAnim)} earned
                  </span>
                )}
                {done > 0 && toGo > 0 && " · "}
                {toGo > 0 && (
                  <span className="tabular-nums">£{fmtMoney(toGo)} to go</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {routePostcodes.length > 0 && (
                <button
                  onClick={handleRoute}
                  title="Open today's remaining jobs in Google Maps"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-[rgba(31,72,255,0.15)] bg-white/70 text-[#010a4f]/75 hover:bg-[rgba(31,72,255,0.06)] hover:border-[#1f48ff]/40 hover:text-[#1f48ff] transition-all"
                >
                  🗺️ Route
                </button>
              )}
              <div className="text-right">
                <p className="text-2xl font-black text-[#010a4f] tabular-nums">{total}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#010a4f]/45">jobs</p>
              </div>
            </div>
          </div>
          <div className="h-2 bg-[rgba(31,72,255,0.08)] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
              }}
            />
          </div>
        </div>
      </LightCard>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerFirstCollision}
        modifiers={[snapCenterToCursor]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <SortableContext items={sorted.map(j => j.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sorted.map((job, idx) => (
              <SortableJobCard
                key={job.id}
                job={job}
                idx={idx}
                onJobClick={onJobClick}
                updateJob={updateJob}
                custById={custById}
                risk={riskByJobId.get(job.id) ?? null}
                onError={onError}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={{ duration: 180 }}>
          {activeJob ? (() => {
            const cust = activeJob.customerId ? custById.get(activeJob.customerId) : null;
            const address  = cust?.addressLine1 || activeJob.addressLine1 || activeJob.postcode || '';
            const customer = activeJob.customer || cust?.name || '';
            const t = TYPE[activeJob.type] || TYPE.residential;
            const isDone = activeJob.status === 'complete';
            const { cardStyle, addrCls, priceCls } = paletteFor({ isDone });
            return (
              <div
                className="flex items-stretch rounded-xl border overflow-hidden shadow-2xl shadow-[#1f48ff]/30 w-[280px] rotate-1"
                style={cardStyle}
              >
                <div className="w-1 shrink-0" style={{ background: t.bar }} />
                <div className="w-8 shrink-0 flex items-center justify-center border-r border-[rgba(31,72,255,0.06)]">
                  <GripVertical size={14} className="text-[#010a4f]/35" />
                </div>
                <div className="flex-1 min-w-0 px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`text-[14px] font-bold truncate leading-tight ${addrCls}`}>
                      {address || customer || 'Untitled job'}
                    </p>
                    <p className={`text-[13px] font-black tabular-nums shrink-0 ${priceCls}`}>
                      £{fmtMoney(activeJob.price)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })() : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
