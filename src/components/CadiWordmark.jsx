import { useEffect } from 'react';

// Inject the pulse keyframe once into the document head
function injectPulseStyle() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cadi-wordmark-style')) return;
  const s = document.createElement('style');
  s.id = 'cadi-wordmark-style';
  s.textContent = `
    @keyframes cadiDotGlow {
      0%,100% { opacity:0.55; transform:translateX(-50%) scale(0.8); }
      50%      { opacity:1;    transform:translateX(-50%) scale(1.3); }
    }
    @keyframes cadiDotCore {
      0%,100% { opacity:0.8; transform:translateX(-50%) scale(0.85); }
      50%      { opacity:1;   transform:translateX(-50%) scale(1.15); }
    }
  `;
  document.head.appendChild(s);
}

/**
 * CadiWordmark — inline "Cadi" brand text with pulsing glowing dot above the i.
 *
 * Props:
 *   height    {number}  em-based font size in px. Default 28.
 *   dark      {boolean} Switch to dark-on-light palette. Default false (white on dark).
 *   className {string}  Extra Tailwind / CSS classes.
 */
export default function CadiWordmark({ height = 28, dark = false, className = '' }) {
  useEffect(() => {
    injectPulseStyle();
  }, []);

  const accentGrad = dark
    ? 'linear-gradient(180deg,#2040c0 0%,#4f78ff 55%,#1d38c4 100%)'
    : 'linear-gradient(180deg,#fff 0%,#a8c4ff 40%,#4f78ff 100%)';
  const dotOuter = dark ? '#4f78ff' : '#fff';

  return (
    <span
      className={`inline-flex items-baseline select-none ${className}`}
      style={{
        fontFamily: "'Plus Jakarta Sans','Inter',sans-serif",
        fontWeight: 600,
        fontSize: height,
        lineHeight: 1,
        letterSpacing: '-0.04em',
      }}
    >
      {/* C */}
      <span style={{ color: dark ? 'rgba(1,8,40,0.55)' : 'rgba(196,211,255,0.65)' }}>C</span>

      {/* a */}
      <span
        style={{
          background: accentGrad,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 5px rgba(79,120,255,0.4))',
        }}
      >
        a
      </span>

      {/* d */}
      <span
        style={{
          background: accentGrad,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 5px rgba(79,120,255,0.4))',
        }}
      >
        d
      </span>

      {/* i — custom dot replaces default tittle */}
      <span
        style={{ position: 'relative', color: dark ? 'rgba(1,8,40,0.3)' : 'rgba(255,255,255,0.3)' }}
      >
        {/* The letter i rendered without its tittle via font-variant hack — fallback just shows i */}
        <span>i</span>

        {/* Outer pulsing glow */}
        <span
          style={{
            position: 'absolute',
            top: '-0.18em',
            left: '50%',
            transform: 'translateX(-50%)',
            width: height * 0.38,
            height: height * 0.38,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${dotOuter} 0%, #a8c4ff 35%, #4f78ff 65%, rgba(29,56,196,0) 100%)`,
            filter: 'blur(1.5px)',
            pointerEvents: 'none',
            animation: 'cadiDotGlow 2.6s ease-in-out infinite',
          }}
        />

        {/* Solid bright centre */}
        <span
          style={{
            position: 'absolute',
            top: '-0.1em',
            left: '50%',
            transform: 'translateX(-50%)',
            width: height * 0.16,
            height: height * 0.16,
            borderRadius: '50%',
            background: dotOuter,
            pointerEvents: 'none',
            animation: 'cadiDotCore 2.6s ease-in-out infinite',
          }}
        />
      </span>
    </span>
  );
}
