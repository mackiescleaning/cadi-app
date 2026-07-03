// Shared design tokens for the Front Desk family (Inbox, Sales Manager,
// Widget Setup Wizard, Front Desk Settings) — keeps them pixel-consistent
// with the Dashboard / Leaderboard dark-glass language, with Front Desk's
// own attention colour: the same gold used for the Leaderboard's Elite tier
// and the sidebar's pending-action badge.

// The exact card gradient used by Dashboard.jsx (DASH_CARD_BG) and
// LeaderboardPanel.jsx — reused verbatim so cards read as one family.
export const FD_CARD_BG = 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)';

export const FD_GOLD        = '#fbbf24'; // text-yellow-400 equivalent
export const FD_GOLD_SOFT   = 'rgba(251,191,36,0.15)';
export const FD_GOLD_BORDER = 'rgba(251,191,36,0.35)';
export const FD_GOLD_GLOW   = 'rgba(251,191,36,0.55)';

// Front Desk's identity blue — matches the sidebar nav accent (#4f78ff).
export const FD_BLUE = '#4f78ff';
export const FD_SKY  = '#99c5ff';

export const ON_DARK = {
  primary:   '#ffffff',
  secondary: 'rgba(255,255,255,0.72)',
  muted:     'rgba(153,197,255,0.50)',
  faint:     'rgba(153,197,255,0.30)',
  line:      'rgba(79,120,255,0.12)',
  lineHi:    'rgba(79,120,255,0.20)',
};

// The full-bleed page canvas — deep navy with a gold glow top-right (Front
// Desk's attention colour) and a blue glow bottom-left (its identity colour).
export function fdCanvas() {
  return {
    background: `
      radial-gradient(65% 45% at 100% 0%, rgba(251,191,36,0.10) 0%, transparent 55%),
      radial-gradient(55% 45% at 0% 100%, rgba(79,120,255,0.14) 0%, transparent 60%),
      linear-gradient(180deg, #010314 0%, #030b28 55%, #01040f 100%)
    `,
    minHeight: '100vh',
  };
}

// Standard dark-glass card — border/shadow only, pair with FD_CARD_BG.
export function fdCard({ radius = 18, gold = false } = {}) {
  return {
    background: FD_CARD_BG,
    borderRadius: radius,
    border: `1px solid ${gold ? FD_GOLD_BORDER : ON_DARK.line}`,
    boxShadow: gold
      ? `0 0 0 1px rgba(251,191,36,0.10), 0 0 22px -4px ${FD_GOLD_GLOW}, 0 24px 60px -24px rgba(0,0,0,0.6)`
      : '0 24px 60px -24px rgba(0,0,0,0.6)',
  };
}

// Small pill for status/agent tags on dark cards.
export function fdChip(hex) {
  return {
    background: `${hex}22`,
    color: hex,
    border: `1px solid ${hex}44`,
  };
}
