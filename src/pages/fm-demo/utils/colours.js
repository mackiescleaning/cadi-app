// ── Service type colours ─────────────────────────────────────────────────────
// Each entry: bg (chip background), border (chip border), text (chip text), hex (solid colour)

export const SERVICE_COLOURS = {
  // Job services
  'Morning Clean':            { bg: 'rgba(79,120,255,0.18)',   border: 'rgba(79,120,255,0.42)',   text: '#7da4ff', hex: '#4f78ff' },
  'School Morning Clean':     { bg: 'rgba(16,185,129,0.18)',   border: 'rgba(16,185,129,0.42)',   text: '#34d399', hex: '#10b981' },
  'Secondary School Clean':   { bg: 'rgba(5,150,105,0.18)',    border: 'rgba(5,150,105,0.42)',    text: '#2dd4a0', hex: '#059669' },
  'Annex Morning Clean':      { bg: 'rgba(99,102,241,0.18)',   border: 'rgba(99,102,241,0.42)',   text: '#a5b4fc', hex: '#6366f1' },
  'Daily Hospital Clean':     { bg: 'rgba(244,63,94,0.18)',    border: 'rgba(244,63,94,0.42)',    text: '#fb7185', hex: '#f43f5e' },
  'Outpatients Clean':        { bg: 'rgba(220,38,38,0.18)',    border: 'rgba(220,38,38,0.42)',    text: '#fca5a5', hex: '#dc2626' },
  'Laboratory Clean':         { bg: 'rgba(168,85,247,0.18)',   border: 'rgba(168,85,247,0.42)',   text: '#d8b4fe', hex: '#a855f7' },
  'Laboratory Deep Clean':    { bg: 'rgba(139,92,246,0.18)',   border: 'rgba(139,92,246,0.42)',   text: '#c4b5fd', hex: '#8b5cf6' },
  'Lab Monthly Deep Clean':   { bg: 'rgba(124,58,237,0.18)',   border: 'rgba(124,58,237,0.42)',   text: '#a78bfa', hex: '#7c3aed' },
  'Office Clean':             { bg: 'rgba(6,182,212,0.18)',    border: 'rgba(6,182,212,0.42)',    text: '#22d3ee', hex: '#06b6d4' },
  'Warehouse Clean':          { bg: 'rgba(163,230,53,0.18)',   border: 'rgba(163,230,53,0.42)',   text: '#bef264', hex: '#a3e635' },
  'Nursery Daily Clean':      { bg: 'rgba(251,191,36,0.18)',   border: 'rgba(251,191,36,0.42)',   text: '#fde68a', hex: '#fbbf24' },
  'Retail Floor Clean':       { bg: 'rgba(236,72,153,0.18)',   border: 'rgba(236,72,153,0.42)',   text: '#f9a8d4', hex: '#ec4899' },
  'Hotel Room Changeover':    { bg: 'rgba(245,158,11,0.18)',   border: 'rgba(245,158,11,0.42)',   text: '#fcd34d', hex: '#f59e0b' },
  'Civic Centre Clean':       { bg: 'rgba(20,184,166,0.18)',   border: 'rgba(20,184,166,0.42)',   text: '#5eead4', hex: '#14b8a6' },
  'Civic Centre Deep Clean':  { bg: 'rgba(13,148,136,0.18)',   border: 'rgba(13,148,136,0.42)',   text: '#2dd4bf', hex: '#0d9488' },
  'Library Clean':            { bg: 'rgba(234,179,8,0.18)',    border: 'rgba(234,179,8,0.42)',    text: '#fef08a', hex: '#eab308' },
  // Cleaner service tags
  'Regular Clean':            { bg: 'rgba(79,120,255,0.18)',   border: 'rgba(79,120,255,0.42)',   text: '#7da4ff', hex: '#4f78ff' },
  'Deep Clean':               { bg: 'rgba(139,92,246,0.18)',   border: 'rgba(139,92,246,0.42)',   text: '#c4b5fd', hex: '#8b5cf6' },
  'End of Tenancy':           { bg: 'rgba(245,158,11,0.18)',   border: 'rgba(245,158,11,0.42)',   text: '#fcd34d', hex: '#f59e0b' },
  'School Clean':             { bg: 'rgba(16,185,129,0.18)',   border: 'rgba(16,185,129,0.42)',   text: '#34d399', hex: '#10b981' },
  'Healthcare Clean':         { bg: 'rgba(244,63,94,0.18)',    border: 'rgba(244,63,94,0.42)',    text: '#fb7185', hex: '#f43f5e' },
  'Retail Clean':             { bg: 'rgba(236,72,153,0.18)',   border: 'rgba(236,72,153,0.42)',   text: '#f9a8d4', hex: '#ec4899' },
  'Window Cleaning':          { bg: 'rgba(6,182,212,0.18)',    border: 'rgba(6,182,212,0.42)',    text: '#22d3ee', hex: '#06b6d4' },
  'Carpet Clean':             { bg: 'rgba(20,184,166,0.18)',   border: 'rgba(20,184,166,0.42)',   text: '#5eead4', hex: '#14b8a6' },
  'Jet Wash':                 { bg: 'rgba(14,165,233,0.18)',   border: 'rgba(14,165,233,0.42)',   text: '#7dd3fc', hex: '#0ea5e9' },
  'Industrial':               { bg: 'rgba(163,230,53,0.18)',   border: 'rgba(163,230,53,0.42)',   text: '#bef264', hex: '#a3e635' },
  'Warehouse':                { bg: 'rgba(132,204,22,0.18)',   border: 'rgba(132,204,22,0.42)',   text: '#bef264', hex: '#84cc16' },
  'Post-Construction':        { bg: 'rgba(251,146,60,0.18)',   border: 'rgba(251,146,60,0.42)',   text: '#fdba74', hex: '#fb923c' },
  'Nursery':                  { bg: 'rgba(251,191,36,0.18)',   border: 'rgba(251,191,36,0.42)',   text: '#fde68a', hex: '#fbbf24' },
  'Holiday Let':              { bg: 'rgba(232,121,249,0.18)',  border: 'rgba(232,121,249,0.42)',  text: '#f0abfc', hex: '#e879f9' },
  'Gutter Clearing':          { bg: 'rgba(107,114,128,0.18)',  border: 'rgba(107,114,128,0.42)',  text: '#d1d5db', hex: '#6b7280' },
  'Render Wash':              { bg: 'rgba(75,85,99,0.18)',     border: 'rgba(75,85,99,0.42)',     text: '#9ca3af', hex: '#4b5563' },
};

const SERVICE_COLOUR_DEFAULT = {
  bg: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.25)', text: 'rgba(255,255,255,0.6)', hex: '#ffffff',
};

export function getServiceColour(service) {
  return SERVICE_COLOURS[service] || SERVICE_COLOUR_DEFAULT;
}

// ── Cadi score tiers ─────────────────────────────────────────────────────────

export const SCORE_TIERS = [
  { min: 90, label: 'Elite',    color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.35)',  glow: 'rgba(245,158,11,0.25)'  },
  { min: 80, label: 'Advanced', color: '#10b981', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.35)', glow: 'rgba(16,185,129,0.2)'  },
  { min: 70, label: 'Solid',    color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.35)', glow: 'rgba(59,130,246,0.2)'  },
  { min: 60, label: 'Building', color: '#f97316', bg: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', glow: 'rgba(249,115,22,0.2)'  },
  { min: 0,  label: 'New',      color: '#ef4444', bg: 'rgba(239,68,68,0.15)',  border: 'rgba(239,68,68,0.35)',  glow: 'rgba(239,68,68,0.2)'   },
];

export function getScoreTier(score) {
  return SCORE_TIERS.find(t => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

export function getScoreColor(score) {
  return getScoreTier(score).color;
}

// ── Job status colours ────────────────────────────────────────────────────────

export const JOB_STATUS_COLOURS = {
  'open':        { color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  label: 'Open'        },
  'assigned':    { color: '#a78bfa', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  label: 'Assigned'    },
  'in-progress': { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'In Progress' },
  'completed':   { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', label: 'Completed'   },
  'awaiting-qa': { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  label: 'Awaiting QA' },
  'disputed':    { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   label: 'Disputed'    },
  'sla-risk':    { color: '#f87171', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   label: 'SLA Risk'    },
};

export function getJobStatusColour(status) {
  return JOB_STATUS_COLOURS[status] || JOB_STATUS_COLOURS['open'];
}
