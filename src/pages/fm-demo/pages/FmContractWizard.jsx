import { useState } from 'react';
import { CheckCircle2, ChevronRight, Lightbulb } from 'lucide-react';
import FmScopeDecomposition from './FmScopeDecomposition';
import FmWorkforceRouting   from './FmWorkforceRouting';
import FmJobCards           from './FmJobCards';
import FmDispatchBoard      from './FmDispatchBoard';

const STEPS = [
  {
    id: 'scope',
    label: 'Scope',
    sublabel: 'Decompose contract',
    hint: "Break the L&D Hospital contract into sites, areas and work types. Every node you create becomes a job card — so be specific. The system auto-flags DBS and certification requirements for Healthcare contracts.",
  },
  {
    id: 'routing',
    label: 'Routing',
    sublabel: 'Assign workforce',
    hint: "For each work area, decide: employed staff or Cadi Connect contractor. The traffic-light coverage map updates live. You can cover a contract before you've even hired — Connect fills the gaps instantly.",
  },
  {
    id: 'cards',
    label: 'Job Cards',
    sublabel: 'Review & bundle',
    hint: "Job cards are auto-generated from your scope + routing decisions. Bundle cards together for one cleaner covering multiple areas on the same shift. Every card carries the full spec — nothing for the cleaner to guess.",
  },
  {
    id: 'dispatch',
    label: 'Dispatch',
    sublabel: 'Deploy & confirm',
    hint: "Employed cards drop straight to staff rotas. Connect cards go live in the marketplace. Once all cards are confirmed, send a coverage report directly to the client portal — proof of delivery before day one.",
  },
];

const PAGE_COMPONENTS = {
  scope:    FmScopeDecomposition,
  routing:  FmWorkforceRouting,
  cards:    FmJobCards,
  dispatch: FmDispatchBoard,
};

export default function FmContractWizard({ onNavigateMain }) {
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];
  const ActivePage = PAGE_COMPONENTS[step.id];

  function goTo(id) {
    const idx = STEPS.findIndex(s => s.id === id);
    if (idx !== -1) setStepIdx(idx);
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: page content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Step progress bar */}
        <div className="sticky top-0 z-10 px-6 py-4 flex items-center gap-0"
          style={{ background: 'rgba(1,8,40,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {STEPS.map((s, i) => {
            const done   = i < stepIdx;
            const active = i === stepIdx;
            const isLast = i === STEPS.length - 1;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => setStepIdx(i)}
                  className="flex items-center gap-2 shrink-0"
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all shrink-0"
                    style={done ? {
                      background: '#34d399', color: 'white',
                    } : active ? {
                      background: 'linear-gradient(135deg, #4f78ff, #6366f1)', color: 'white',
                      boxShadow: '0 0 12px rgba(79,120,255,0.5)',
                    } : {
                      background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                    {done ? <CheckCircle2 size={13} /> : i + 1}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-black leading-none"
                      style={{ color: active ? 'white' : done ? '#34d399' : 'rgba(255,255,255,0.3)' }}>
                      {s.label}
                    </div>
                    <div className="text-[10px] mt-0.5"
                      style={{ color: active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)' }}>
                      {s.sublabel}
                    </div>
                  </div>
                </button>
                {!isLast && (
                  <div className="flex-1 h-px mx-3"
                    style={{ background: done ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.08)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Active page — passes onNavigate so "Next →" buttons advance the wizard */}
        <ActivePage onNavigate={goTo} onNavigateMain={onNavigateMain} />
      </div>

      {/* ── Right: context panel ── */}
      <div className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.06)', background: 'rgba(1,5,28,0.6)' }}>

        {/* Contract context */}
        <div className="px-4 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-2">Active contract</div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0"
              style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399' }}>
              LD
            </div>
            <div>
              <div className="text-white text-xs font-black leading-tight">Luton & Dunstable NHS FT</div>
              <div className="text-white/30 text-[10px]">£13,000/mo · Healthcare</div>
            </div>
          </div>
          <div className="space-y-1 text-[10px]">
            {[
              ['Sites', '2'],
              ['Contract start', '1 Jun 2026'],
              ['DBS required', 'Enhanced'],
              ['SLA', '99%'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-white/25">{k}</span>
                <span className="text-white/60 font-bold">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step hint */}
        <div className="px-4 py-4 flex-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={12} style={{ color: '#fbbf24' }} />
            <span className="text-[9px] font-black uppercase tracking-widest text-white/25">Step guide</span>
          </div>
          <p className="text-[11px] text-white/40 leading-relaxed">{step.hint}</p>
        </div>

        {/* Step nav */}
        <div className="px-4 py-4 space-y-1">
          <div className="text-[9px] font-black uppercase tracking-widest text-white/25 mb-2">Jump to step</div>
          {STEPS.map((s, i) => {
            const done   = i < stepIdx;
            const active = i === stepIdx;
            return (
              <button key={s.id} onClick={() => setStepIdx(i)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left"
                style={active ? {
                  background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: 'white',
                } : {
                  color: done ? 'rgba(52,211,153,0.7)' : 'rgba(255,255,255,0.25)',
                  border: '1px solid transparent',
                }}>
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                  style={{ background: done ? '#34d399' : active ? '#4f78ff' : 'rgba(255,255,255,0.08)', color: 'white' }}>
                  {done ? '✓' : i + 1}
                </div>
                {s.label}
                {active && <ChevronRight size={11} className="ml-auto" style={{ color: '#4f78ff' }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
