// src/pages/Scheduler/helpers.js
// Pure utilities extracted from Scheduler.jsx — no JSX, no React.

import { weatherEmoji, isRainy } from '../../hooks/useWeather';

export function weatherChip(day) {
  if (!day) return null;
  const rainy = isRainy(day);
  const bits = [day.condition];
  if (day.tempMaxC != null) bits.push(`${Math.round(day.tempMaxC)}°`);
  if (day.rainPct != null) bits.push(`${day.rainPct}% rain`);
  if (day.windKmh != null) bits.push(`${day.windKmh} km/h wind`);
  return {
    emoji: weatherEmoji(day.condition),
    tempMaxC: day.tempMaxC,
    rainy,
    title: bits.filter(Boolean).join(' · '),
  };
}

// ─── Demo data ───────────────────────────────────────────────────────────────
export function buildDemoJobs() {
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateFor = (offset) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    return fmt(d);
  };
  return [
    {
      id: 1,
      customer: 'Kensington Block A',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W8 4AA',
      startHour: 7.0,
      durationHrs: 0.33,
      price: 45,
      status: 'complete',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 2,
      customer: 'Kensington Block B',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W8 4AB',
      startHour: 7.33,
      durationHrs: 0.33,
      price: 45,
      status: 'complete',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 3,
      customer: 'Hammond',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W8 4BD',
      startHour: 7.67,
      durationHrs: 0.33,
      price: 25,
      status: 'complete',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 4,
      customer: 'Clifton',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W8 5AA',
      startHour: 8.0,
      durationHrs: 0.33,
      price: 25,
      status: 'complete',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 5,
      customer: 'Elsworth',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W8 5BB',
      startHour: 8.33,
      durationHrs: 0.33,
      price: 30,
      status: 'complete',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 6,
      customer: 'Harrow Court',
      type: 'exterior',
      service: 'Windows + frames',
      postcode: 'W8 5CC',
      startHour: 8.67,
      durationHrs: 0.67,
      price: 65,
      status: 'in-progress',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 7,
      customer: 'Phillips',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W9 1AA',
      startHour: 9.33,
      durationHrs: 0.33,
      price: 25,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 8,
      customer: 'Nash Apartments',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W9 1BB',
      startHour: 9.67,
      durationHrs: 0.67,
      price: 60,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 9,
      customer: 'Dr. Khan',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W9 2CC',
      startHour: 10.33,
      durationHrs: 0.33,
      price: 25,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 10,
      customer: 'Fletcher',
      type: 'exterior',
      service: 'Gutters',
      postcode: 'W9 2DD',
      startHour: 10.67,
      durationHrs: 1.0,
      price: 95,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(0),
    },
    {
      id: 11,
      customer: 'Meadow House',
      type: 'exterior',
      service: 'Softwash render',
      postcode: 'SW19 1AA',
      startHour: 7.33,
      durationHrs: 1.67,
      price: 220,
      status: 'complete',
      assignee: 'Tom',
      assignees: ['Tom'],
      date: dateFor(0),
    },
    {
      id: 12,
      customer: 'Barnes',
      type: 'exterior',
      service: 'Driveway wash',
      postcode: 'SW19 2BB',
      startHour: 9.0,
      durationHrs: 1.33,
      price: 140,
      status: 'in-progress',
      assignee: 'Tom',
      assignees: ['Tom'],
      date: dateFor(0),
    },
    {
      id: 13,
      customer: 'Laurel Lodge',
      type: 'exterior',
      service: 'Patio clean',
      postcode: 'SW19 4EE',
      startHour: 11.33,
      durationHrs: 1.33,
      price: 150,
      status: 'scheduled',
      assignee: 'Tom',
      assignees: ['Tom'],
      date: dateFor(0),
    },
    {
      id: 14,
      customer: 'Davies',
      type: 'residential',
      service: 'Deep clean',
      postcode: 'SW2 1AA',
      startHour: 8.0,
      durationHrs: 2.5,
      price: 140,
      status: 'in-progress',
      assignee: 'Sarah',
      assignees: ['Sarah'],
      date: dateFor(0),
    },
    {
      id: 15,
      customer: 'Wilson',
      type: 'residential',
      service: 'Regular clean',
      postcode: 'SW3 2BB',
      startHour: 11.0,
      durationHrs: 2.0,
      price: 65,
      status: 'scheduled',
      assignee: 'Sarah',
      assignees: ['Sarah'],
      date: dateFor(0),
    },
    {
      id: 16,
      customer: 'Adams',
      type: 'residential',
      service: 'Deep clean',
      postcode: 'SW4 1DD',
      startHour: 9.0,
      durationHrs: 3.0,
      price: 175,
      status: 'complete',
      assignee: 'Mia',
      assignees: ['Mia'],
      date: dateFor(0),
    },
    {
      id: 17,
      customer: 'Miller',
      type: 'residential',
      service: 'Regular clean',
      postcode: 'SW8 2EE',
      startHour: 12.67,
      durationHrs: 2.0,
      price: 70,
      status: 'scheduled',
      assignee: 'Mia',
      assignees: ['Mia'],
      date: dateFor(0),
    },
    {
      id: 18,
      customer: 'Greenfield Office',
      type: 'commercial',
      service: 'Weekly office',
      postcode: 'SW6 3FF',
      startHour: 7.0,
      durationHrs: 3.0,
      price: 140,
      status: 'complete',
      assignee: 'Dave',
      assignees: ['Dave'],
      date: dateFor(0),
    },
    {
      id: 19,
      customer: 'Riverside Retail',
      type: 'commercial',
      service: 'Retail clean',
      postcode: 'SE1 4GG',
      startHour: 13.0,
      durationHrs: 2.33,
      price: 180,
      status: 'scheduled',
      assignee: 'Dave',
      assignees: ['Dave'],
      date: dateFor(0),
    },
    {
      id: 20,
      customer: 'Patel',
      type: 'residential',
      service: 'End of tenancy',
      postcode: 'SE5 3CC',
      startHour: 13.33,
      durationHrs: 3.33,
      price: 280,
      status: 'unassigned',
      assignee: null,
      assignees: [],
      date: dateFor(0),
    },
    {
      id: 21,
      customer: 'Nexus HQ',
      type: 'commercial',
      service: 'Deep commercial',
      postcode: 'EC1',
      startHour: 8,
      durationHrs: 4,
      price: 200,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(1),
    },
    {
      id: 22,
      customer: 'Wilson',
      type: 'residential',
      service: 'Regular clean',
      postcode: 'SW3',
      startHour: 10,
      durationHrs: 2,
      price: 65,
      status: 'scheduled',
      assignee: 'Sarah',
      assignees: ['Sarah'],
      date: dateFor(1),
    },
    {
      id: 23,
      customer: 'Battersea Office',
      type: 'commercial',
      service: 'Contract clean',
      postcode: 'SW11',
      startHour: 7,
      durationHrs: 3,
      price: 150,
      status: 'scheduled',
      assignee: 'Dave',
      assignees: ['Dave'],
      date: dateFor(2),
    },
    {
      id: 24,
      customer: 'Hughes',
      type: 'exterior',
      service: 'Driveway wash',
      postcode: 'SW19',
      startHour: 10,
      durationHrs: 2,
      price: 95,
      status: 'scheduled',
      assignee: 'Tom',
      assignees: ['Tom'],
      date: dateFor(3),
    },
    {
      id: 25,
      customer: 'Fletcher Round',
      type: 'exterior',
      service: 'Windows',
      postcode: 'W9',
      startHour: 9,
      durationHrs: 3,
      price: 180,
      status: 'scheduled',
      assignee: 'Jamie',
      assignees: ['Jamie'],
      date: dateFor(-1),
    },
  ];
}

export const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
export const GRID_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

// Round to pence before displaying to avoid floating-point garbage.
export function fmtMoney(v) {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function durLabel(h) {
  if (h === '0.33' || h === 0.33) return '20m';
  if (h === '0.67' || h === 0.67) return '40m';
  if (h === '0.5' || h === 0.5) return '30m';
  return `${h}h`;
}

export function getJobAssignees(job) {
  if (Array.isArray(job.assignees) && job.assignees.length > 0) return job.assignees;
  if (job.assignee) return [job.assignee];
  return [];
}

export function getJobAssigneeLabel(job) {
  const assignees = getJobAssignees(job);
  return assignees.length > 0 ? assignees.join(', ') : 'Unassigned';
}

// Deterministic tint for a crew name — rotates through a brand-friendly palette.
export const CREW_PALETTE = [
  '#F97316',
  '#EA580C',
  '#10B981',
  '#059669',
  '#1F48FF',
  '#7C3AED',
  '#EC4899',
  '#0891B2',
];
export function tintForCrew(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return CREW_PALETTE[Math.abs(hash) % CREW_PALETTE.length];
}

export function deriveCrews(jobs) {
  const map = new Map();
  jobs.forEach((j) => {
    const assignees = getJobAssignees(j);
    const list = assignees.length > 0 ? assignees : ['__unassigned__'];
    list.forEach((name) => {
      const existing = map.get(name) || {
        id: name,
        name: name === '__unassigned__' ? 'Unassigned' : name,
        jobs: [],
        types: {},
      };
      existing.jobs.push(j);
      existing.types[j.type] = (existing.types[j.type] || 0) + 1;
      map.set(name, existing);
    });
  });
  const crews = Array.from(map.values()).map((c) => {
    const primaryType =
      Object.entries(c.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'residential';
    return {
      ...c,
      primaryType,
      tint: c.id === '__unassigned__' ? '#94A3B8' : tintForCrew(c.name),
      init: c.id === '__unassigned__' ? '?' : c.name.charAt(0).toUpperCase(),
    };
  });
  return crews.sort((a, b) => {
    if (a.id === '__unassigned__') return 1;
    if (b.id === '__unassigned__') return -1;
    return b.jobs.length - a.jobs.length;
  });
}

// ─── Date helpers ────────────────────────────────────────────────────────────
export function getToday() {
  return new Date();
}

export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getViewDate(dayOffset, view) {
  const today = getToday();
  if (view === 'Day' || view === 'Run') {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    return d;
  } else if (view === 'Week') {
    const mon = getMonday(today);
    mon.setDate(mon.getDate() + dayOffset * 7);
    return mon;
  } else if (view === 'Month') {
    const d = new Date(today);
    d.setDate(1);
    d.setMonth(d.getMonth() + dayOffset);
    return d;
  }
  return today;
}

export function getWeekDates(dayOffset) {
  const mon = getMonday(getToday());
  mon.setDate(mon.getDate() + dayOffset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function getCurrentQuarter() {
  const now = getToday();
  const q = Math.floor(now.getMonth() / 3);
  return { quarter: q + 1, year: now.getFullYear(), startMonth: q * 3 };
}

export function fmtTime(h) {
  const hr = Math.floor(h);
  const mins = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function fmtTime12(h) {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  const ampm = hours < 12 ? 'am' : 'pm';
  const display = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${display}:${mins.toString().padStart(2, '0')}${ampm}`;
}

// ─── Overlap layout engine (used in Week view) ────────────────────────────────
export function layoutDayJobs(dayJobs) {
  const sorted = [...dayJobs].sort((a, b) => a.startHour - b.startHour);
  const placed = [];
  const colEnds = [];
  for (const job of sorted) {
    const end = job.startHour + (job.durationHrs || 1);
    let col = colEnds.findIndex((t) => t <= job.startHour);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    placed.push({ job, col });
  }
  for (let i = 0; i < placed.length; i++) {
    const { job } = placed[i];
    const end = job.startHour + (job.durationHrs || 1);
    let maxCol = placed[i].col;
    for (let j = 0; j < placed.length; j++) {
      const o = placed[j].job;
      const oEnd = o.startHour + (o.durationHrs || 1);
      if (o.startHour < end && oEnd > job.startHour) {
        maxCol = Math.max(maxCol, placed[j].col);
      }
    }
    placed[i].colCount = maxCol + 1;
  }
  return placed;
}

// ─── View switcher math ─────────────────────────────────────────────────────
export function computeOffsetForView(fromView, toView, currentOffset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const viewedDate = getViewDate(currentOffset, fromView);

  if (toView === 'Day' || toView === 'Run') {
    return Math.round((viewedDate.getTime() - today.getTime()) / 86400000);
  }
  if (toView === 'Week') {
    const curMon = getMonday(today);
    const viewMon = getMonday(viewedDate);
    return Math.round((viewMon.getTime() - curMon.getTime()) / (7 * 86400000));
  }
  if (toView === 'Month') {
    return (
      (viewedDate.getFullYear() - today.getFullYear()) * 12 +
      (viewedDate.getMonth() - today.getMonth())
    );
  }
  return 0;
}

// ─── NewJobModal helpers ─────────────────────────────────────────────────────
export function addDaysToDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ONBOARDING_SERVICE_GROUPS = {
  residential: [
    ['Weekly Clean', 'Fortnightly Clean', 'Monthly Clean'],
    ['Deep Clean', 'End of Tenancy', 'Move In / Move Out', 'Spring Clean', 'After Party Clean'],
    ['Airbnb Turnover', 'Holiday Let Changeover'],
    ['Oven Clean', 'Carpet Clean', 'Inside Windows', 'Ironing Service'],
  ],
  commercial: [
    ['Daily Office Clean', 'Weekly Office Clean', 'Retail Clean'],
    ['School / College', 'Nursery / Childcare', 'Medical Practice', 'Care Home'],
    ['Restaurant / Cafe', 'Hotel', 'Pub / Bar', 'Event Venue'],
    ['Post-Construction Clean', 'Periodic Deep Clean', 'Industrial / Warehouse'],
  ],
  exterior: [
    ['Residential Windows', 'Commercial Windows', 'Conservatory Glass'],
    ['Gutter Clearing', 'Fascia & Soffit Clean', 'Roof Moss Removal'],
    ['Driveway Jet Wash', 'Patio / Decking', 'Path & Steps'],
    ['Render Wash', 'UPVC Restoration', 'Solar Panel Clean'],
  ],
};

export function buildProfileServiceOptions(profile) {
  const saved = profile?.setup_data?.services || [];
  const custom = profile?.setup_data?.custom_service || '';
  const opts = { residential: [], commercial: [], exterior: [] };
  if (!saved.length && !custom) return null;
  for (const [type, groups] of Object.entries(ONBOARDING_SERVICE_GROUPS)) {
    for (const items of groups) {
      for (const item of items) {
        if (saved.includes(item)) opts[type].push(item);
      }
    }
  }
  if (custom) {
    const extras = custom
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    opts.residential.push(...extras);
  }
  return opts;
}
