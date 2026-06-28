// src/pages/Scheduler/RiskChip.jsx
// Small severity pill rendered on a job card or in the drawer header.
// Hover (desktop) or focus (keyboard) reveals all reasons.

const SEVERITY_STYLES = {
  red:   { dot: 'bg-red-500',     chip: 'bg-red-50 text-red-700 border-red-200',         icon: '⚠️' },
  amber: { dot: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 border-amber-200',   icon: '⚠' },
  info:  { dot: 'bg-blue-400',    chip: 'bg-blue-50 text-blue-700 border-blue-200',      icon: 'ℹ' },
};

export default function RiskChip({ risk, compact = false }) {
  if (!risk?.severity) return null;
  const s = SEVERITY_STYLES[risk.severity] ?? SEVERITY_STYLES.info;

  // Compact: just the dot. Used inside dense job cards.
  if (compact) {
    return (
      <span
        className="relative group inline-flex items-center"
        tabIndex={0}
        aria-label={`${risk.reasons.length} risk${risk.reasons.length === 1 ? '' : 's'}: ${risk.reasons.map(r => r.label).join('; ')}`}
      >
        <span className={`w-2 h-2 rounded-full ${s.dot} animate-pulse`} />
        <RiskTooltip risk={risk} />
      </span>
    );
  }

  // Full chip: shows top reason inline + tooltip with the rest.
  const top = risk.reasons[0];
  return (
    <span
      className={`relative group inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10.5px] font-bold ${s.chip}`}
      tabIndex={0}
      aria-label={`${risk.reasons.length} risk${risk.reasons.length === 1 ? '' : 's'}`}
    >
      <span>{s.icon}</span>
      <span className="truncate max-w-[10rem]">{top.label}</span>
      {risk.reasons.length > 1 && (
        <span className="px-1 rounded bg-white/60 text-[9.5px]">+{risk.reasons.length - 1}</span>
      )}
      <RiskTooltip risk={risk} />
    </span>
  );
}

function RiskTooltip({ risk }) {
  return (
    <span
      role="tooltip"
      className="absolute left-0 top-full mt-1 z-30 hidden group-hover:block group-focus:block w-64 rounded-lg bg-slate-900 text-white text-[11px] shadow-xl border border-slate-700 p-2 space-y-1"
    >
      {risk.reasons.map((r, i) => (
        <span key={i} className="flex items-start gap-1.5">
          <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${(SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.info).dot}`} />
          <span className="flex-1">{r.label}</span>
        </span>
      ))}
    </span>
  );
}
