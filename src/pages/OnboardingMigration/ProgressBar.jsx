// Thin progress bar across the top of the onboarding flow.
// Step labels sit below the bar. Mobile-first: labels truncate on small screens.

const STEPS = [
  { key: 'divisions',       label: 'Your business' },
  { key: 'upload',          label: 'Your customers' },
  { key: 'parsing',         label: 'Cadi reading' },
  { key: 'review',          label: 'Review' },
  { key: 'menu_review',     label: 'Service menu' },
  { key: 'reveal',          label: 'Done' },
];

export default function ProgressBar({ step }) {
  const idx = Math.max(0, STEPS.findIndex(s => s.key === step));
  const pct = ((idx + 0.5) / STEPS.length) * 100;

  return (
    <div className="bg-white/85 backdrop-blur-md border-b border-[#1f48ff]/10">
      <div className="h-0.5 bg-[#1f48ff]/10 relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#1f48ff] to-[#4f78ff] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between px-4 md:px-8 py-2">
        {STEPS.map((s, i) => {
          const done    = i < idx;
          const current = i === idx;
          return (
            <div
              key={s.key}
              className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${
                current ? 'text-[#010a4f]'
                : done  ? 'text-[#1f48ff]'
                        : 'text-[#010a4f]/30'
              }`}
            >
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
