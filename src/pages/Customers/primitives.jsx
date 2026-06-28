// GlassSurface — liquid-glass shell used across the Customers tab.
// Variants:
//   tone   - 'navy' (default) | 'amber' (pending) | 'accent' (selected)
//   depth  - 'flat' | 'lift' (hover translate + glow) | 'static' (no transitions)
//   blur   - true on the hovered/selected row only; static cards leave it off
//            for perf so scrolling a long list stays smooth.
// Composition: gradient base → optional backdrop-blur → grid texture →
// top-edge highlight line → optional accent glow → children. Order matters:
// blur reads the layer beneath, so it goes after the background gradient.
// GlassSurface — liquid-glass shell used across the Customers tab.
// Tones:
//   navy   - dark navy glass (default; matches dark side panels)
//   amber  - pending-review tint
//   accent - active/selected (deep blue gradient + glow)
//   light  - schedule-style white translucent card with elevated shadow.
//            Use this for customer rows that sit over the navy backdrop —
//            it gives the "elevated above the page" feel.
export function GlassSurface({ children, className = "", tone = "navy", depth = "lift", blur = false, glow = false }) {
  const isLight = tone === "light" || (tone === "accent" && !blur); // accent now reads as elevated light too
  const isAccent = tone === "accent";
  const bg = tone === "amber"
    ? "linear-gradient(145deg, rgba(120,72,0,0.50) 0%, rgba(80,48,0,0.65) 100%)"
    : isAccent
      ? "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(208,224,255,0.85) 50%, rgba(180,205,255,0.80) 100%)"
      : tone === "light"
        ? "linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(240,247,255,0.72) 50%, rgba(228,238,255,0.78) 100%)"
        : "linear-gradient(145deg, rgba(5,18,74,0.85) 0%, rgba(10,24,96,0.92) 100%)";
  const border = tone === "amber"
    ? "border-amber-400/40"
    : isAccent
      ? "border-[#1f48ff]/50"
      : tone === "light"
        ? "border-white/60"
        : "border-[rgba(153,197,255,0.12)]";
  const hover = depth === "lift"
    ? tone === "amber"
      ? "hover:border-amber-300/65 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-amber-500/20"
      : isAccent
        ? ""
        : tone === "light"
          ? "hover:-translate-y-0.5 hover:border-white/90 hover:scale-[1.005]"
          : "hover:border-[rgba(153,197,255,0.30)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#1f48ff]/15"
    : "";
  // Layered shadow stack — outer drop, ambient haze, inset top highlight
  // (the "thickness" of the glass), inset bottom darken (catches light at
  // the lower edge), and an ultra-tight inner ring that reads as the
  // refractive edge. Tuned by tone.
  const shadow = isLight
    ? isAccent
      ? "0 20px 50px rgba(31,72,255,0.30), 0 8px 20px rgba(31,72,255,0.15), 0 1px 2px rgba(31,72,255,0.10), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(31,72,255,0.10), inset 0 0 0 1px rgba(255,255,255,0.5)"
      : "0 16px 40px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -1px 0 rgba(31,72,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.4)"
    : undefined;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${border} ${hover} ${className}`}
      style={{
        background: bg,
        boxShadow: shadow,
        // Backdrop-blur with saturation boost is what makes the colours
        // beneath the glass pop through with a real liquid quality.
        backdropFilter: isLight ? "blur(20px) saturate(180%)" : blur ? "blur(14px)" : undefined,
        WebkitBackdropFilter: isLight ? "blur(20px) saturate(180%)" : blur ? "blur(14px)" : undefined,
      }}
    >
      {/* ── Specular highlight — diagonal sweep that catches the eye, like a
            real piece of glass under raked light. Only on light tones. ── */}
      {isLight && (
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background: "linear-gradient(115deg, transparent 0%, transparent 35%, rgba(255,255,255,0.45) 48%, rgba(255,255,255,0.15) 55%, transparent 65%, transparent 100%)",
            mixBlendMode: "overlay",
          }}
        />
      )}
      {/* ── Top-edge highlight (thickness illusion) ── */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px ${isLight ? "bg-gradient-to-r from-transparent via-white to-transparent" : "bg-gradient-to-r from-transparent via-[#99c5ff]/55 to-transparent"}`} />
      {/* ── Bottom-edge soft refraction — only on light glass ── */}
      {isLight && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#1f48ff]/30 to-transparent" />
      )}
      {/* ── Inner radial glow (top-left light source) ── */}
      {!isLight && (
        <div className="pointer-events-none absolute -top-1/2 -left-1/4 w-3/4 h-full rounded-full bg-[radial-gradient(circle_at_top_left,rgba(153,197,255,0.10),transparent_60%)]" />
      )}
      {/* ── Grid texture (dark only) ── */}
      {tone === "navy" && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
      )}
      {glow && (
        <div className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#1f48ff]/0 via-[#1f48ff]/25 to-[#1f48ff]/0 blur-2xl" />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

export function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] ${className}`}
      style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

export const SL = ({ children }) => (
  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-2">{children}</p>
);

export function Chip({ children, color = "gray" }) {
  const s = {
    gray:    "bg-white/5 text-[rgba(153,197,255,0.6)] border-[rgba(153,197,255,0.12)]",
    blue:    "bg-[#1f48ff]/15 text-[#99c5ff] border-[#1f48ff]/25",
    green:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    orange:  "bg-orange-500/15 text-orange-300 border-orange-500/25",
    amber:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
    red:     "bg-red-500/15 text-red-300 border-red-500/25",
    purple:  "bg-purple-500/15 text-purple-300 border-purple-500/25",
    sky:     "bg-sky-500/15 text-sky-300 border-sky-500/25",
    navy:    "bg-[#1f48ff]/30 text-white border-[#1f48ff]/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${s[color] ?? s.gray}`}>
      {children}
    </span>
  );
}

export function Alert({ type = "blue", children }) {
  const s = {
    warn:  "bg-amber-500/10 border-amber-500/20 text-amber-300",
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    blue:  "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
    gold:  "bg-amber-500/10 border-amber-500/20 text-amber-300",
    red:   "bg-red-500/10 border-red-500/20 text-red-300",
  };
  const icons = { warn: "⚠", green: "✓", blue: "ℹ", gold: "→", red: "!" };
  return (
    <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-xl ${s[type]}`}>
      <span className="shrink-0 mt-0.5 font-bold text-xs w-4 text-center">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = {
    active:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    lapsed:   "bg-red-500/15 text-red-300 border-red-500/25",
    "at-risk":"bg-amber-500/15 text-amber-300 border-amber-500/25",
  };
  const l = { active: "● Active", lapsed: "◌ Lapsed", "at-risk": "⚠ At risk" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${s[status] ?? s.active}`}>
      {l[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const s = {
    urgent: "bg-red-500/15 text-red-300 border-red-500/25",
    high:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
    medium: "bg-[#1f48ff]/15 text-[#99c5ff] border-[#1f48ff]/25",
    low:    "bg-white/5 text-[rgba(153,197,255,0.5)] border-white/10",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs font-bold border ${s[priority]}`}>
      {priority}
    </span>
  );
}

export function StarRating({ value = 0, onChange, size = "sm" }) {
  const sz = size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star === value ? 0 : star)}
          className={`${sz} transition-all ${star <= value ? "text-amber-400" : "text-[rgba(153,197,255,0.2)]"} ${onChange ? "hover:text-amber-300 cursor-pointer" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
