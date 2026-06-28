import { useState, useMemo } from "react";
import { generateSuggestions } from "./helpers";
import { Chip, StatusBadge, StarRating, GlassSurface } from "./primitives";

export default function CustomerRow({ customer, onClick, selected, onArchive, onApprove, density = 'large' }) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [hover, setHover] = useState(false);
  const suggestions   = useMemo(() => generateSuggestions(customer), [customer]);
  const urgent        = suggestions.some(s => s.priority === "urgent" || s.priority === "high");
  const topSuggestion = suggestions[0];
  const initials      = customer.name.split(" ").map(n => n[0]).slice(0, 2).join("");
  const isPending     = customer.accountStatus === 'pending_review';

  // Status palette tuned for the light card: vivid gradient avatar with a
  // dark legible initial. Dark-tone variants kept on the dot/glow so the
  // card still pops against the navy backdrop.
  const statusColor = customer.status === "active"
    ? { ring: "ring-emerald-500/60", bg: "from-emerald-400 to-emerald-600 text-white", dot: "bg-emerald-500", glow: "shadow-emerald-500/35" }
    : customer.status === "lapsed"
    ? { ring: "ring-red-500/60",     bg: "from-red-400 to-red-600 text-white",         dot: "bg-red-500",     glow: "shadow-red-500/35"     }
    : { ring: "ring-amber-500/60",   bg: "from-amber-400 to-amber-600 text-white",     dot: "bg-amber-500",   glow: "shadow-amber-500/35"   };

  const tone = selected ? "accent" : isPending ? "amber" : "light";
  // Only the hovered/selected row gets backdrop-blur to keep long-list
  // scrolling smooth — see GlassSurface notes in primitives.jsx.
  const blur = hover || selected;

  if (density === 'compact') {
    return (
      <button
        onClick={() => onClick(customer)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`w-full text-left px-3 py-1.5 transition-all group relative ${selected ? "opacity-100" : "opacity-85 hover:opacity-100"}`}
      >
        <GlassSurface tone={tone} depth="lift" blur={blur} glow={selected} className="px-2.5 py-2">
          <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ring-1 ${statusColor.ring} bg-gradient-to-br ${statusColor.bg} shadow-md ${statusColor.glow}`}>
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-[#010a4f] truncate leading-tight">{customer.name}</p>
              {urgent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />}
            </div>
            <p className="text-[10px] text-[#010a4f]/55 truncate leading-tight">
              {customer.postcode}{customer.frequency ? ` · ${customer.frequency}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pending-review imports get an explicit Edit + Approve pair.
                Edit opens the detail drawer (same as tapping the row) so the
                user can double-check day/frequency/postcode before approving.
                Both buttons stop propagation so the wrapping row click
                doesn't also fire. */}
            {isPending && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onClick(customer); }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.18] text-[#99c5ff] hover:text-white border border-[rgba(153,197,255,0.2)] active:scale-95"
                  title="Open to check + edit"
                >
                  Edit
                </button>
                {onApprove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onApprove(customer.id); }}
                    className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-[#010a4f] active:scale-95"
                    title="Approve this customer"
                  >
                    Approve
                  </button>
                )}
              </>
            )}
            <p className="text-xs font-black text-emerald-600 tabular-nums">£{customer.pricePerVisit ?? customer.lifetimeValue.toLocaleString()}</p>
            <span className={`w-2 h-2 rounded-full shrink-0 ${isPending ? 'bg-amber-500 animate-pulse' : statusColor.dot}`} />
          </div>
          </div>
        </GlassSurface>

        {onArchive && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {confirmArchive ? (
              <div className="flex items-center gap-1 bg-[#010a4f] border border-red-500/30 rounded-lg px-2 py-1">
                <span className="text-[10px] text-red-400 font-bold">Remove?</span>
                <button onClick={() => { onArchive(customer.id); setConfirmArchive(false); }} className="text-[10px] font-black text-red-400 hover:text-red-300 px-1">Yes</button>
                <button onClick={() => setConfirmArchive(false)} className="text-[10px] font-black text-[rgba(153,197,255,0.5)] hover:text-white px-1">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmArchive(true)} className="w-7 h-7 rounded-full bg-[rgba(255,80,80,0.15)] hover:bg-[rgba(255,80,80,0.3)] border border-red-500/20 flex items-center justify-center text-red-400/70 hover:text-red-400 transition-all text-xs font-bold" title="Remove">×</button>
            )}
          </div>
        )}
      </button>
    );
  }

  if (density === 'medium') {
    return (
      <button
        onClick={() => onClick(customer)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={`w-full text-left px-3 py-1.5 transition-all group relative ${selected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
      >
        <GlassSurface tone={tone} depth="lift" blur={blur} glow={selected}>
          {urgent && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
          <div className="flex items-center gap-2.5 p-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ring-2 ${statusColor.ring} bg-gradient-to-br ${statusColor.bg} shadow-md ${statusColor.glow}`}>
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-bold text-[#010a4f] truncate">{customer.name}</p>
                {urgent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[#010a4f]/55">{customer.postcode}</span>
                {customer.frequency && <>
                  <span className="text-[#010a4f]/25">·</span>
                  <span className="text-[11px] text-[#010a4f]/55 capitalize">{customer.frequency}</span>
                </>}
                {urgent && topSuggestion && (
                  <>
                    <span className="text-[#010a4f]/25">·</span>
                    <span className="text-[11px] text-amber-600 font-semibold truncate">
                      💡 {topSuggestion.title}
                      {topSuggestion.value > 0 && <span className="ml-1 text-amber-700/80 tabular-nums">+£{topSuggestion.value}</span>}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <p className="text-sm font-black text-emerald-600 tabular-nums">
                £{customer.pricePerVisit ?? customer.lifetimeValue.toLocaleString()}
                {customer.pricePerVisit != null && <span className="text-[10px] text-emerald-700/70 font-bold">/visit</span>}
              </p>
              {isPending ? (
                <div className="flex items-center gap-1.5">
                  {/* Edit opens the same detail drawer as tapping the row,
                      but as an explicit button so the user can spot it. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onClick(customer); }}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/[0.08] hover:bg-white/[0.18] text-[#99c5ff] hover:text-white border border-[rgba(153,197,255,0.2)] active:scale-95"
                    title="Open to check + edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onApprove?.(customer.id); }}
                    className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-400 hover:bg-amber-300 text-[#010a4f] active:scale-95"
                    title="Approve this customer"
                  >
                    Approve
                  </button>
                </div>
              ) : (
                <StatusBadge status={customer.status} />
              )}
            </div>
          </div>
        </GlassSurface>

        {onArchive && (
          <div className="absolute top-2 right-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {confirmArchive ? (
              <div className="flex items-center gap-1 bg-[#010a4f] border border-red-500/30 rounded-lg px-2 py-1">
                <span className="text-[10px] text-red-400 font-bold">Remove?</span>
                <button onClick={() => { onArchive(customer.id); setConfirmArchive(false); }} className="text-[10px] font-black text-red-400 hover:text-red-300 px-1">Yes</button>
                <button onClick={() => setConfirmArchive(false)} className="text-[10px] font-black text-[rgba(153,197,255,0.5)] hover:text-white px-1">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmArchive(true)} className="w-8 h-8 rounded-full bg-[rgba(255,80,80,0.15)] hover:bg-[rgba(255,80,80,0.3)] border border-red-500/20 hover:border-red-500/50 flex items-center justify-center text-red-400/70 hover:text-red-400 transition-all text-sm font-bold" title="Remove customer">×</button>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => onClick(customer)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`w-full text-left p-3 transition-all group ${selected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
    >
      <GlassSurface tone={tone} depth="lift" blur={blur} glow={selected}>
        {urgent && <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />}
        <div className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ring-2 ${statusColor.ring} bg-gradient-to-br ${statusColor.bg} shadow-md ${statusColor.glow}`}>
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-[#010a4f] truncate">{customer.name}</p>
                {urgent && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-[11px] text-[#010a4f]/55">{customer.postcode}</span>
                <span className="text-[#010a4f]/25">·</span>
                <span className="text-[11px] text-[#010a4f]/55 capitalize">{customer.frequency}</span>
              </div>
              {topSuggestion && (
                <p className="text-[11px] text-amber-600 font-semibold truncate">
                  💡 {topSuggestion.title}
                  {topSuggestion.value > 0 && <span className="ml-1 text-amber-700/80 tabular-nums">+£{topSuggestion.value}</span>}
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-black text-emerald-600 tabular-nums mb-1">£{customer.lifetimeValue.toLocaleString()}</p>
              <StatusBadge status={customer.status} />
              {customer.rating > 0 && (
                <div className="flex justify-end mt-1">
                  <StarRating value={customer.rating} size="sm" />
                </div>
              )}
            </div>
          </div>

          {customer.tags.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-[rgba(153,197,255,0.06)]">
              {customer.tags.slice(0, 2).map(tag => <Chip key={tag} color="sky">{tag}</Chip>)}
            </div>
          )}
        </div>
      </GlassSurface>

      {onArchive && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {confirmArchive ? (
            <div className="flex items-center gap-1 bg-[#010a4f] border border-red-500/30 rounded-lg px-2 py-1">
              <span className="text-[10px] text-red-400 font-bold">Remove?</span>
              <button onClick={() => { onArchive(customer.id); setConfirmArchive(false); }} className="text-[10px] font-black text-red-400 hover:text-red-300 px-1">Yes</button>
              <button onClick={() => setConfirmArchive(false)} className="text-[10px] font-black text-[rgba(153,197,255,0.5)] hover:text-white px-1">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmArchive(true)} className="w-6 h-6 rounded-full bg-[rgba(255,80,80,0.15)] hover:bg-[rgba(255,80,80,0.3)] border border-red-500/20 hover:border-red-500/50 flex items-center justify-center text-red-400/70 hover:text-red-400 transition-all text-xs font-bold" title="Remove customer">×</button>
          )}
        </div>
      )}
    </button>
  );
}
