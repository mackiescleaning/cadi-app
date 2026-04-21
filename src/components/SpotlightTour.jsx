import { useState, useEffect, useRef } from 'react';

// Spotlight tour — highlights one element at a time with a tooltip explanation
// Usage: <SpotlightTour steps={[{ selector: '#health-score', title: '...', body: '...' }]} onComplete={...} />

export default function SpotlightTour({ steps = [], onComplete }) {
  const [current, setCurrent] = useState(0);
  const [rect, setRect] = useState(null);
  const tooltipRef = useRef(null);

  const step = steps[current];
  const isLast = current === steps.length - 1;
  const progress = `${current + 1} / ${steps.length}`;

  // Find and highlight the target element
  useEffect(() => {
    if (!step?.selector) { setRect(null); return; }

    const el = document.querySelector(step.selector);
    if (!el) { setRect(null); return; }

    const updateRect = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };

    updateRect();
    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Update after scroll
    const timer = setTimeout(updateRect, 400);

    window.addEventListener('resize', updateRect);
    return () => { window.removeEventListener('resize', updateRect); clearTimeout(timer); };
  }, [current, step?.selector]);

  if (!step || steps.length === 0) return null;

  const handleNext = () => {
    if (isLast) {
      onComplete?.();
    } else {
      setCurrent(c => c + 1);
    }
  };

  const handleSkip = () => {
    onComplete?.();
  };

  // Position tooltip below or above the highlighted element
  const padding = 12;
  const tooltipStyle = rect ? {
    position: 'fixed',
    top: rect.top + rect.height + padding + 8,
    left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
    zIndex: 10001,
  } : {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 10001,
  };

  // If tooltip would go below viewport, show it above
  if (rect && rect.top + rect.height + 200 > window.innerHeight) {
    tooltipStyle.top = Math.max(16, rect.top - 180);
  }

  return (
    <>
      {/* Overlay with cutout */}
      <div className="fixed inset-0 z-[10000] pointer-events-auto" onClick={handleNext}>
        {/* Dark overlay */}
        <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - padding}
                  y={rect.top - padding}
                  width={rect.width + padding * 2}
                  height={rect.height + padding * 2}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%" height="100%"
            fill="rgba(0,0,0,0.7)"
            mask="url(#spotlight-mask)"
          />
        </svg>

        {/* Highlight border around target */}
        {rect && (
          <div
            className="absolute border-2 border-[#1f48ff] rounded-xl pointer-events-none"
            style={{
              top: rect.top - padding,
              left: rect.left - padding,
              width: rect.width + padding * 2,
              height: rect.height + padding * 2,
              boxShadow: '0 0 0 4px rgba(31,72,255,0.2), 0 0 20px rgba(31,72,255,0.3)',
              zIndex: 10001,
            }}
          />
        )}
      </div>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="w-80 rounded-2xl border border-[rgba(153,197,255,0.2)] shadow-2xl shadow-black/50 overflow-hidden pointer-events-auto"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ background: 'linear-gradient(145deg, #010a4f, #0d1e78)' }}>
          {/* Header */}
          <div className="px-5 pt-4 pb-2 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#99c5ff]/50">{progress}</span>
              <h3 className="text-sm font-black text-white mt-0.5">{step.title}</h3>
            </div>
            {step.emoji && <span className="text-2xl">{step.emoji}</span>}
          </div>

          {/* Body */}
          <div className="px-5 pb-4">
            <p className="text-xs text-[rgba(153,197,255,0.7)] leading-relaxed">{step.body}</p>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-[rgba(153,197,255,0.06)]">
            <div
              className="h-full bg-[#1f48ff] transition-all duration-300"
              style={{ width: `${((current + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex items-center justify-between bg-[rgba(0,0,0,0.2)]">
            <button
              onClick={handleSkip}
              className="text-[10px] text-[rgba(153,197,255,0.4)] hover:text-white font-semibold transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-[#1f48ff]/30"
            >
              {isLast ? 'Finish tour' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
