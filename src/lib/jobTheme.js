// src/lib/jobTheme.js
// Shared job-type theme — previously triplicated across Scheduler.jsx,
// SchedulerPreview.jsx and RoutePlanner.jsx. Single source of truth.
//
// Each type has:
//   bar  — saturated left-bar colour (hex)
//   fill — pastel block fill (hex)
//   ink  — deep text colour (hex)
//   chip — Tailwind chip classes
//   dot  — Tailwind dot bg class

export const TYPE = {
  residential: {
    label: 'Residential',
    bar: '#10B981',
    fill: '#ECFDF5',
    ink: '#064E3B',
    chip: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  commercial: {
    label: 'Commercial',
    bar: '#1F48FF',
    fill: '#EEF2FF',
    ink: '#1E3A8A',
    chip: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-600',
  },
  exterior: {
    label: 'Exterior',
    bar: '#F97316',
    fill: '#FFF4E6',
    ink: '#7C2D12',
    chip: 'bg-orange-100 text-orange-800 border-orange-200',
    dot: 'bg-orange-500',
  },
  site_visit: {
    label: 'Site Visit',
    bar: '#1D1B8E',
    fill: '#F0F1FF',
    ink: '#1D1B8E',
    chip: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    dot: 'bg-indigo-700',
  },
};

export const STATUS_STYLES = {
  complete: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'in-progress': 'bg-amber-100 text-amber-800 border border-amber-200',
  scheduled: 'bg-slate-100 text-slate-600 border border-slate-200',
  unassigned: 'bg-red-50 text-red-700 border border-red-200',
  // "Missed" — the DB value is no_show (matches the jobs_status_check
  // constraint). Introduced with the Run view's tick-off.
  no_show: 'bg-red-100 text-red-700 border border-red-200',
};

export const STATUS_LABELS = {
  complete: 'Complete',
  'in-progress': 'In progress',
  scheduled: 'Scheduled',
  unassigned: 'Unassigned',
  no_show: 'Missed',
};

// Convenience: dot-class lookup with safe fallback.
export const typeDot = (t) => TYPE[t]?.dot ?? 'bg-gray-400';
