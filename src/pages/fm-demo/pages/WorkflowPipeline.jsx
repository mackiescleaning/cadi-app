import { ChevronRight, ArrowRight } from 'lucide-react';

const CONTRACT_STEPS = [
  { id: 'win', label: 'Win Contract', pages: ['clients'], firstPage: 'clients' },
  { id: 'jobcards', label: 'Job Cards', pages: ['job-cards'], firstPage: 'job-cards' },
  { id: 'import', label: 'Import Staff', pages: ['staff-import'], firstPage: 'staff-import' },
  { id: 'hr', label: 'Staff & HR', pages: ['hr-staff'], firstPage: 'hr-staff' },
  { id: 'area', label: 'Area Manager', pages: ['dispatch-board'], firstPage: 'dispatch-board' },
  { id: 'rota', label: 'Staff Rota', pages: ['staff-rota'], firstPage: 'staff-rota' },
  { id: 'hours', label: 'Track Hours', pages: ['live'], firstPage: 'live' },
  { id: 'payroll', label: 'Payroll', pages: ['payroll'], firstPage: 'payroll' },
];

const EXTERIOR_STEPS = [
  { id: 'win', label: 'Win Contract', pages: ['ext-clients'], firstPage: 'ext-clients' },
  {
    id: 'jobcards',
    label: 'Job Cards',
    pages: ['ext-quotes', 'ext-deploy'],
    firstPage: 'ext-quotes',
  },
  { id: 'schedule', label: 'Schedule', pages: ['ext-scheduling'], firstPage: 'ext-scheduling' },
  { id: 'done', label: 'Work Done', pages: ['ext-live'], firstPage: 'ext-live' },
  { id: 'invoice', label: 'Invoice', pages: ['ext-accounts'], firstPage: 'ext-accounts' },
];

export default function WorkflowPipeline({ mode, page, onNavigate }) {
  const steps = mode === 'contract' ? CONTRACT_STEPS : EXTERIOR_STEPS;
  const accent = mode === 'contract' ? '#ea580c' : '#16a34a';
  const accentDark = mode === 'contract' ? '#9a3412' : '#14532d';
  const accentBg = mode === 'contract' ? 'rgba(234,88,12,0.08)' : 'rgba(22,163,74,0.08)';
  const accentGrad =
    mode === 'contract'
      ? 'linear-gradient(135deg, #ea580c, #c2410c)'
      : 'linear-gradient(135deg, #16a34a, #15803d)';

  const currentIdx = steps.findIndex((s) => s.pages.includes(page));
  const nextStep = currentIdx >= 0 && currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;

  return (
    <div
      style={{
        borderBottom: `1px solid ${mode === 'contract' ? 'rgba(234,88,12,0.1)' : 'rgba(22,163,74,0.1)'}`,
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(12px)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {/* Steps */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0 }}>
        {steps.map((step, idx) => {
          const isActive = idx === currentIdx;
          const isComplete = idx < currentIdx;

          return (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center' }}>
              <button
                onClick={() => onNavigate(step.firstPage)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: isActive
                    ? `1px solid ${mode === 'contract' ? 'rgba(234,88,12,0.3)' : 'rgba(22,163,74,0.3)'}`
                    : '1px solid transparent',
                  background: isActive ? accentBg : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {/* Number / checkmark */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 900,
                    flexShrink: 0,
                    background: isComplete
                      ? accentGrad
                      : isActive
                        ? accentGrad
                        : 'rgba(0,0,0,0.08)',
                    color: isComplete || isActive ? 'white' : 'rgba(0,0,0,0.3)',
                    boxShadow: isActive ? `0 2px 8px ${accent}50` : 'none',
                  }}
                >
                  {isComplete ? '✓' : idx + 1}
                </div>
                {/* Label */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isActive ? 800 : isComplete ? 700 : 500,
                    color: isActive ? accentDark : isComplete ? accent : 'rgba(0,0,0,0.3)',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.label}
                </span>
              </button>

              {/* Connector */}
              {idx < steps.length - 1 && (
                <ChevronRight
                  size={13}
                  style={{ color: 'rgba(0,0,0,0.15)', flexShrink: 0, margin: '0 2px' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next step CTA */}
      {nextStep && currentIdx >= 0 && (
        <button
          onClick={() => onNavigate(nextStep.firstPage)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: accentGrad,
            color: 'white',
            fontSize: 11,
            fontWeight: 800,
            border: 'none',
            cursor: 'pointer',
            boxShadow: `0 2px 12px ${accent}40`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            marginLeft: 16,
            letterSpacing: '-0.01em',
          }}
        >
          Next: {nextStep.label}
          <ArrowRight size={12} />
        </button>
      )}

      {/* All done */}
      {currentIdx === steps.length - 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 20,
            background: accentGrad,
            color: 'white',
            fontSize: 11,
            fontWeight: 800,
            marginLeft: 16,
            flexShrink: 0,
          }}
        >
          ✓ Journey complete
        </div>
      )}
    </div>
  );
}
