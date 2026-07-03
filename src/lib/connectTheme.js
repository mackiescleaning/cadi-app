// Design tokens for the Cadi Connect sub-side.
// Airbnb-Editions / Revolut-flavoured glassmorphism over navy + orange.
// Import helpers into any /connect page — every returned value is a plain
// React style object so it composes with Tailwind className.

export const CONNECT_COLORS = {
  orange:      '#C2410C',
  orangeSoft:  'rgba(194, 65, 12, 0.12)',
  orangeGlow:  'rgba(194, 65, 12, 0.28)',
  navy:        '#010a4f',
  navyDeep:    '#000527',
  navyMid:     '#0d1e78',
  navyLine:    'rgba(1, 10, 79, 0.08)',
  navyLineHi:  'rgba(1, 10, 79, 0.14)',
  white:       '#ffffff',
  ink:         '#010a4f',
  inkMuted:    '#5b6684',
  inkFaint:    '#8a92a8',
  success:     '#16a34a',
  successSoft: 'rgba(22, 163, 74, 0.12)',
  amber:       '#f59e0b',
  amberSoft:   '#fef3c7',
  danger:      '#dc2626',
  dangerSoft:  'rgba(220, 38, 38, 0.10)',
  purple:      '#7c3aed',
  purpleSoft:  'rgba(124, 58, 237, 0.12)',
  blue:        '#4f78ff',
  blueSoft:    'rgba(79, 120, 255, 0.12)',
};

export const CONNECT_RADII = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  pill: 999,
};

export const CONNECT_SHADOWS = {
  glass:   '0 1px 2px rgba(1,10,79,0.04), 0 8px 24px -12px rgba(1,10,79,0.14)',
  glassHi: '0 2px 4px rgba(1,10,79,0.06), 0 24px 48px -20px rgba(1,10,79,0.22)',
  hero:    '0 30px 80px -30px rgba(1,10,79,0.55), 0 10px 30px -12px rgba(0,0,0,0.35)',
  chip:    '0 1px 2px rgba(1,10,79,0.06)',
  glow:    '0 0 0 6px rgba(194,65,12,0.12), 0 10px 30px -8px rgba(194,65,12,0.35)',
};

// A frosted-glass surface for cards on the light page background.
export function glass({ radius = CONNECT_RADII.lg, padding, blur = 14 } = {}) {
  return {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: `blur(${blur}px) saturate(140%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(140%)`,
    border: `1px solid rgba(255, 255, 255, 0.6)`,
    boxShadow: CONNECT_SHADOWS.glass,
    borderRadius: radius,
    ...(padding != null ? { padding } : {}),
  };
}

// A denser glass — heavier tint, stronger border. For headline cards.
export function glassStrong({ radius = CONNECT_RADII.lg, padding, blur = 18 } = {}) {
  return {
    background: 'rgba(255, 255, 255, 0.86)',
    backdropFilter: `blur(${blur}px) saturate(160%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
    border: `1px solid ${CONNECT_COLORS.navyLine}`,
    boxShadow: CONNECT_SHADOWS.glassHi,
    borderRadius: radius,
    ...(padding != null ? { padding } : {}),
  };
}

// Dark glass — the primary card surface when sitting on the navy canvas.
// Semi-transparent white tint keeps content readable and gives depth.
export function glassDark({ radius = CONNECT_RADII.lg, padding, blur = 14, strong = false } = {}) {
  return {
    background: strong ? 'rgba(255, 255, 255, 0.10)' : 'rgba(255, 255, 255, 0.06)',
    backdropFilter: `blur(${blur}px) saturate(140%)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(140%)`,
    border: `1px solid rgba(255, 255, 255, ${strong ? 0.18 : 0.12})`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.15), 0 20px 40px -20px rgba(0,0,0,0.35)',
    borderRadius: radius,
    ...(padding != null ? { padding } : {}),
  };
}

// The whole-page navy canvas — bleeds through AppLayout's px padding.
// Apply as a wrapper around the entire dashboard content.
export function navyCanvas() {
  return {
    background: `
      radial-gradient(80% 50% at 100% 0%, rgba(194, 65, 12, 0.28) 0%, transparent 55%),
      radial-gradient(70% 60% at 0% 100%, rgba(79, 120, 255, 0.18) 0%, transparent 60%),
      radial-gradient(90% 60% at 50% 40%, rgba(13, 30, 120, 0.35) 0%, transparent 70%),
      linear-gradient(180deg, #010a4f 0%, #000527 60%, #01041f 100%)
    `,
    minHeight: '100vh',
  };
}

// The whole-page forest-green canvas — for the GROW tabs.
// Deep evergreen → navy → near-black, layered green + navy radial glows.
export function greenCanvas() {
  return {
    background: `
      radial-gradient(70% 50% at 100% 0%, rgba(52, 211, 153, 0.30) 0%, transparent 55%),
      radial-gradient(60% 50% at 0% 100%, rgba(1, 10, 79, 0.35) 0%, transparent 65%),
      radial-gradient(80% 60% at 50% 30%, rgba(4, 120, 87, 0.55) 0%, transparent 75%),
      linear-gradient(180deg, #064e3b 0%, #032a1f 55%, #01120b 100%)
    `,
    minHeight: '100vh',
  };
}

// Primary CTA — green variant paired with greenCanvas. Same shape as
// primaryButton but reads as the semantic "grow / progress" colour.
export function greenButton({ size = 'md' } = {}) {
  const pad = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 22px' : '11px 18px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return {
    background: `linear-gradient(180deg, #10b981 0%, #047857 100%)`,
    color: '#ffffff',
    padding: pad,
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: '0.01em',
    borderRadius: CONNECT_RADII.md,
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 8px 20px -6px rgba(4,120,87,0.55), inset 0 1px 0 rgba(255,255,255,0.20)',
    cursor: 'pointer',
    transition: 'transform 120ms ease, box-shadow 200ms ease, filter 150ms ease',
  };
}

// The whole-page enterprise-blue canvas — for the FM-Ops side.
// Cool steel-blue glows only (no orange) so it reads unmistakably
// different from the sub-side's warm navy/orange.
export function blueCanvas() {
  return {
    background: `
      radial-gradient(70% 50% at 100% 0%, rgba(79, 120, 255, 0.30) 0%, transparent 55%),
      radial-gradient(50% 40% at 0% 0%, rgba(194, 65, 12, 0.14) 0%, transparent 60%),
      radial-gradient(55% 45% at 0% 100%, rgba(126, 163, 255, 0.14) 0%, transparent 65%),
      radial-gradient(90% 60% at 50% 35%, rgba(13, 30, 120, 0.50) 0%, transparent 75%),
      linear-gradient(180deg, #030b3e 0%, #01062a 55%, #010313 100%)
    `,
    minHeight: '100vh',
  };
}

// Bright semantic accents tuned for the FM-Ops dark canvas — shared by
// every /fm-ops page so the palette can't drift between tabs.
export const FM_POP = {
  blue:   '#7ea3ff',
  green:  '#34d399',
  amber:  '#fbbf24',
  orange: '#fb923c',
  red:    '#f87171',
};

// Primary CTA — Cadi brand blue, paired with blueCanvas on the FM side.
export function blueButton({ size = 'md' } = {}) {
  const pad = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 22px' : '11px 18px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return {
    background: `linear-gradient(180deg, #5b82ff 0%, #3a5fe0 100%)`,
    color: '#ffffff',
    padding: pad,
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: '0.01em',
    borderRadius: CONNECT_RADII.md,
    border: '1px solid rgba(255,255,255,0.18)',
    boxShadow: '0 8px 20px -6px rgba(79,120,255,0.55), inset 0 1px 0 rgba(255,255,255,0.22)',
    cursor: 'pointer',
    transition: 'transform 120ms ease, box-shadow 200ms ease, filter 150ms ease',
  };
}

// The whole-page burnt-orange canvas — warmer sibling of navyCanvas.
// Used for action-oriented pages (Work Completion, live-work surfaces).
export function orangeCanvas() {
  return {
    background: `
      radial-gradient(70% 50% at 100% 0%, rgba(255, 176, 90, 0.30) 0%, transparent 55%),
      radial-gradient(60% 50% at 0% 100%, rgba(1, 10, 79, 0.35) 0%, transparent 65%),
      radial-gradient(80% 60% at 50% 30%, rgba(194, 65, 12, 0.55) 0%, transparent 75%),
      linear-gradient(180deg, #7c1d0c 0%, #3d0a02 60%, #1a0400 100%)
    `,
    minHeight: '100vh',
  };
}

// Text tokens for the on-navy surface.
export const ON_DARK = {
  primary:  '#ffffff',
  secondary:'rgba(255,255,255,0.72)',
  muted:    'rgba(255,255,255,0.52)',
  faint:    'rgba(255,255,255,0.38)',
  line:     'rgba(255,255,255,0.10)',
  lineHi:   'rgba(255,255,255,0.18)',
  // Softened accent colors that read well against navy.
  success:  '#22c55e',
  amber:    '#fbbf24',
  orangeSoft:'#ffb08a',
  bluePop:  '#7ea3ff',
};

// Hero background — layered navy gradient with orange glow.
// Apply the returned style object to a positioned container.
export function heroGradient() {
  return {
    background: `
      radial-gradient(120% 80% at 100% 0%, rgba(194, 65, 12, 0.35) 0%, rgba(194, 65, 12, 0) 55%),
      radial-gradient(80% 60% at 0% 100%, rgba(79, 120, 255, 0.25) 0%, rgba(79, 120, 255, 0) 60%),
      linear-gradient(135deg, #010a4f 0%, #000527 60%, #1a0a00 100%)
    `,
    boxShadow: CONNECT_SHADOWS.hero,
  };
}

// A subtle ambient page wash to sit behind the whole /connect view.
// Renders as a fixed decorative div — pass the returned style to it.
export function ambientWash() {
  return {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 0,
    background: `
      radial-gradient(60% 40% at 90% -10%, rgba(194, 65, 12, 0.10) 0%, transparent 70%),
      radial-gradient(50% 50% at -10% 20%, rgba(79, 120, 255, 0.10) 0%, transparent 70%)
    `,
  };
}

// Primary CTA — orange, high contrast, subtle glow on hover via className.
export function primaryButton({ size = 'md' } = {}) {
  const pad = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 22px' : '11px 18px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return {
    background: `linear-gradient(180deg, #d64510 0%, ${CONNECT_COLORS.orange} 100%)`,
    color: '#ffffff',
    padding: pad,
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: '0.01em',
    borderRadius: CONNECT_RADII.md,
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 6px 16px -6px rgba(194,65,12,0.55), inset 0 1px 0 rgba(255,255,255,0.20)',
    cursor: 'pointer',
    transition: 'transform 120ms ease, box-shadow 200ms ease, filter 150ms ease',
  };
}

// Solid white — the paired secondary on a navy canvas. Crisp.
export function whiteButton({ size = 'md' } = {}) {
  const pad = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 22px' : '11px 18px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return {
    background: '#ffffff',
    color: CONNECT_COLORS.navy,
    padding: pad,
    fontSize: fs,
    fontWeight: 800,
    letterSpacing: '0.01em',
    borderRadius: CONNECT_RADII.md,
    border: '1px solid rgba(255,255,255,0.9)',
    boxShadow: '0 4px 12px -4px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,1)',
    cursor: 'pointer',
    transition: 'transform 120ms ease, box-shadow 200ms ease, background 150ms ease',
  };
}

// Ghost / secondary — glass over anything.
export function ghostButton({ size = 'md', onDark = false } = {}) {
  const pad = size === 'sm' ? '8px 14px' : size === 'lg' ? '14px 22px' : '11px 18px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 14 : 13;
  return onDark
    ? {
        background: 'rgba(255,255,255,0.10)',
        color: '#ffffff',
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        borderRadius: CONNECT_RADII.md,
        border: '1px solid rgba(255,255,255,0.20)',
        backdropFilter: 'blur(10px)',
        cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease',
      }
    : {
        background: 'rgba(255,255,255,0.6)',
        color: CONNECT_COLORS.navy,
        padding: pad,
        fontSize: fs,
        fontWeight: 700,
        borderRadius: CONNECT_RADII.md,
        border: `1px solid ${CONNECT_COLORS.navyLineHi}`,
        cursor: 'pointer',
        transition: 'background 150ms ease, border-color 150ms ease',
      };
}

// Small pill / chip — used for meta tags, tier badges, statuses.
export function chip({ tone = 'neutral' } = {}) {
  const map = {
    neutral: { bg: 'rgba(255,255,255,0.7)',           fg: CONNECT_COLORS.ink,     bd: CONNECT_COLORS.navyLineHi },
    orange:  { bg: CONNECT_COLORS.orangeSoft,          fg: CONNECT_COLORS.orange,  bd: 'rgba(194,65,12,0.20)' },
    green:   { bg: CONNECT_COLORS.successSoft,         fg: CONNECT_COLORS.success, bd: 'rgba(22,163,74,0.20)' },
    amber:   { bg: CONNECT_COLORS.amberSoft,           fg: '#92400e',              bd: 'rgba(245,158,11,0.30)' },
    red:     { bg: CONNECT_COLORS.dangerSoft,          fg: CONNECT_COLORS.danger,  bd: 'rgba(220,38,38,0.25)' },
    purple:  { bg: CONNECT_COLORS.purpleSoft,          fg: CONNECT_COLORS.purple,  bd: 'rgba(124,58,237,0.20)' },
    blue:    { bg: CONNECT_COLORS.blueSoft,            fg: CONNECT_COLORS.blue,    bd: 'rgba(79,120,255,0.20)' },
    onDark:  { bg: 'rgba(255,255,255,0.12)',           fg: '#ffffff',              bd: 'rgba(255,255,255,0.18)' },
  };
  const t = map[tone] || map.neutral;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    borderRadius: CONNECT_RADII.pill,
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.bd}`,
    boxShadow: CONNECT_SHADOWS.chip,
    whiteSpace: 'nowrap',
  };
}

// Typography helpers — keep the visual language consistent.
export const TYPE = {
  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: CONNECT_COLORS.inkMuted,
  },
  h1: {
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    color: '#ffffff',
  },
  h2: {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: '-0.01em',
    color: CONNECT_COLORS.ink,
  },
  body: {
    fontSize: 14,
    lineHeight: 1.55,
    color: CONNECT_COLORS.inkMuted,
  },
  meta: {
    fontSize: 12,
    color: CONNECT_COLORS.inkFaint,
  },
};

// Tier → visual — matches score-tier semantics already in the codebase.
export const TIER_STYLE = {
  elite:   { color: CONNECT_COLORS.purple,   glow: 'rgba(124,58,237,0.45)', label: 'Elite'   },
  trusted: { color: CONNECT_COLORS.success,  glow: 'rgba(22,163,74,0.45)',  label: 'Trusted' },
  active:  { color: CONNECT_COLORS.blue,     glow: 'rgba(79,120,255,0.45)', label: 'Active'  },
  new:     { color: CONNECT_COLORS.amber,    glow: 'rgba(245,158,11,0.45)', label: 'New'     },
  building:{ color: CONNECT_COLORS.inkFaint, glow: 'rgba(138,146,168,0.35)',label: 'Building'},
};

// Shared hover class fragment for lift effects — apply via className.
// Kept minimal so components can freely combine with Tailwind utility classes.
export const HOVER_LIFT = 'transition-all duration-200 hover:-translate-y-0.5';
