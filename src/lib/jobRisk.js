// jobRisk.js — passive risk signals for a scheduled job.
// Pure function — no I/O, no React. Cross-checks four signals:
//   1. Weather (exterior jobs vs rain probability)
//   2. UK bank holiday on the job date
//   3. Schedule overlap with another job for the same crew
//   4. Customer notes — keywords that may block access ("dog", "code")
//
// Returns { severity, reasons, score } where severity is null when clear.
// Wire AI-powered note understanding (Haiku) as a follow-up.

const RAIN_THRESHOLD_AMBER = 60;  // ≥60% precip → amber on exterior jobs
const RAIN_THRESHOLD_RED   = 80;  // ≥80% precip + heavy/thunder → red

// English-and-Wales bank holidays (2026). Add others as needed.
// Update yearly or move to an API later — quiet cost saver vs hitting gov.uk.
const BANK_HOLIDAYS = new Set([
  '2026-01-01', // New Year's Day
  '2026-04-03', // Good Friday
  '2026-04-06', // Easter Monday
  '2026-05-04', // Early May
  '2026-05-25', // Spring
  '2026-08-31', // Summer
  '2026-12-25', // Christmas
  '2026-12-28', // Boxing (substitute)
]);

// Customer-note keywords that often mean access trouble.
// One match = info chip; two+ = amber.
const NOTE_FLAGS = [
  { rx: /\bdog(s)?\b/i,                   label: 'Dog on site'                    },
  { rx: /\bkey\s*safe|key under|code\b/i, label: 'Access code — verify with owner' },
  { rx: /\bno access|locked|cant get/i,    label: 'Previous access issue'          },
  { rx: /\balarm\b/i,                     label: 'Alarm — disarm on entry'         },
  { rx: /\bbuilders?|renovation/i,        label: 'Property under works'            },
  { rx: /\bdo not\b|don'?t /i,             label: 'Customer instruction — read notes' },
];

export function detectJobRisks(job, ctx = {}) {
  if (!job) return { severity: null, reasons: [], score: 0 };
  const reasons = [];
  let score = 0;

  // ── 1. Weather ─────────────────────────────────────────────────────────────
  const w = ctx.weatherByDate?.[job.date];
  if (w && (job.type === 'exterior' || /window|gutter|driveway|patio|render|roof|jet/i.test(job.service || ''))) {
    const rainPct  = w.rainPct ?? 0;
    const heavy    = /heavy rain|thunder|hail/i.test(w.condition || '');
    if (rainPct >= RAIN_THRESHOLD_RED || (heavy && rainPct >= 50)) {
      reasons.push({ kind: 'weather', severity: 'red',   label: `${rainPct}% rain — exterior job at risk` });
      score += 60;
    } else if (rainPct >= RAIN_THRESHOLD_AMBER) {
      reasons.push({ kind: 'weather', severity: 'amber', label: `${rainPct}% chance of rain` });
      score += 30;
    } else if ((w.windKmh ?? 0) >= 40 && /window|gutter|roof/i.test(job.service || '')) {
      reasons.push({ kind: 'weather', severity: 'amber', label: `${w.windKmh} km/h wind — high access not advised` });
      score += 25;
    }
  }

  // ── 2. Bank holiday ────────────────────────────────────────────────────────
  if (job.date && BANK_HOLIDAYS.has(job.date)) {
    reasons.push({ kind: 'holiday', severity: 'amber', label: 'UK bank holiday — confirm customer is in' });
    score += 25;
  }

  // ── 3. Crew overlap ────────────────────────────────────────────────────────
  if (ctx.allJobs?.length) {
    const myAssignees = jobAssignees(job);
    const myStart = numericHour(job.startHour);
    const myEnd   = myStart + Math.max(numericHour(job.durationHrs), 0);
    if (myAssignees.length > 0 && myEnd > myStart) {
      for (const other of ctx.allJobs) {
        if (other.id === job.id) continue;
        if (other.date !== job.date) continue;
        if (other.status === 'cancelled' || other.status === 'complete') continue;
        const otherAssignees = jobAssignees(other);
        const sharesCrew = myAssignees.some(a => otherAssignees.includes(a));
        if (!sharesCrew) continue;
        const oStart = numericHour(other.startHour);
        const oEnd   = oStart + Math.max(numericHour(other.durationHrs), 0);
        if (oStart < myEnd && oEnd > myStart) {
          const sharedCrew = myAssignees.find(a => otherAssignees.includes(a));
          reasons.push({
            kind: 'overlap',
            severity: 'red',
            label: `${sharedCrew} also has "${other.customer}" at ${fmtHour(other.startHour)}`,
          });
          score += 60;
          break; // one overlap reason is enough
        }
      }
    }
  }

  // ── 4. Customer notes ──────────────────────────────────────────────────────
  const combined = `${ctx.customer?.notes ?? ''} ${ctx.customer?.private_notes ?? ''} ${job.notes ?? ''}`;
  const noteHits = [];
  for (const { rx, label } of NOTE_FLAGS) {
    if (rx.test(combined)) noteHits.push(label);
  }
  if (noteHits.length === 1) {
    reasons.push({ kind: 'notes', severity: 'info', label: noteHits[0] });
    score += 8;
  } else if (noteHits.length >= 2) {
    reasons.push({
      kind: 'notes',
      severity: 'amber',
      label: `${noteHits.length} access notes to read`,
      detail: noteHits,
    });
    score += 20;
  }

  // ── Aggregate severity ─────────────────────────────────────────────────────
  let severity = null;
  if (reasons.some(r => r.severity === 'red'))   severity = 'red';
  else if (reasons.some(r => r.severity === 'amber')) severity = 'amber';
  else if (reasons.length > 0)                  severity = 'info';

  return { severity, reasons, score };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jobAssignees(j) {
  if (Array.isArray(j.assignees) && j.assignees.length) return j.assignees;
  if (Array.isArray(j.assigneeIds) && j.assigneeIds.length) return j.assigneeIds;
  return j.assignee ? [j.assignee] : [];
}

function numericHour(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
