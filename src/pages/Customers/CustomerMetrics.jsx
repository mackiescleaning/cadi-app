import { useMemo } from 'react';
import { JOB_TYPES } from './helpers';
import { GlassSurface } from './primitives';

// Per-customer deep view. Drives a "Metrics" tab on CustomerDetail.
// Pure presentation — receives the already-loaded jobs array via props
// rather than re-querying, so it stays in sync with the rest of the
// detail drawer and adds zero DB cost.
//
// Charts are inline SVG (no chart library dep) — kept deliberately
// chunky so a glance is enough; the surface is not a BI tool.

const DAY_MS = 86400000;
const MONTH_LABELS = [
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

function ymKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBack(n) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: ymKey(d), label: MONTH_LABELS[d.getMonth()], date: d });
  }
  return out;
}

function gbp(n) {
  if (!Number.isFinite(n)) return '£0';
  if (Math.abs(n) >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n)}`;
}

function nextBirthdayDays(iso) {
  if (!iso) return null;
  const b = new Date(iso);
  const now = new Date();
  const next = new Date(now.getFullYear(), b.getMonth(), b.getDate());
  if (next < now) next.setFullYear(now.getFullYear() + 1);
  return Math.ceil((next - now) / DAY_MS);
}

function yearsSince(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (DAY_MS * 365.25);
}

function frequencyExpectedDays(frequency) {
  switch (frequency) {
    case 'weekly':
      return 7;
    case 'fortnightly':
      return 14;
    case 'monthly':
      return 30;
    case '6-weekly':
      return 42;
    case 'quarterly':
      return 91;
    default:
      return null;
  }
}

function Section({ title, sub, children }) {
  return (
    <GlassSurface tone="light" depth="lift">
      <div className="px-4 py-2.5 border-b border-[#010a4f]/10 flex items-baseline justify-between">
        <p className="text-[11px] font-black tracking-wide uppercase text-[#010a4f]">{title}</p>
        {sub && <p className="text-[10px] text-[#010a4f]/55">{sub}</p>}
      </div>
      <div className="p-4">{children}</div>
    </GlassSurface>
  );
}

function MilestoneCard({ icon, label, value, accent = 'text-[#010a4f]' }) {
  return (
    <div className="flex-1 min-w-[110px]">
      <GlassSurface tone="light" depth="flat" className="px-3 py-2">
        <p className="text-[10px] font-bold tracking-wide uppercase text-[#010a4f]/55 mb-0.5">
          {label}
        </p>
        <p className={`text-sm font-black ${accent} flex items-center gap-1.5`}>
          {icon && <span className="text-base">{icon}</span>}
          {value}
        </p>
      </GlassSurface>
    </div>
  );
}

export default function CustomerMetrics({ customer, jobs, invoices }) {
  const completed = useMemo(
    () =>
      (jobs || []).filter(
        (j) => j.status === 'complete' || (j.date && j.date < new Date().toISOString().slice(0, 10))
      ),
    [jobs]
  );

  // Payment health — how promptly this customer pays. Derived from paid
  // invoices (issue date → paid_at). Feeds the Growth sales plan: a reliable
  // slow-payer is a Direct-Debit conversion target.
  const pay = useMemo(() => {
    const paid = (invoices || []).filter((i) => i.status === 'paid' && i.paid_at && i.date);
    const days = paid
      .map((i) =>
        Math.max(0, Math.round((new Date(i.paid_at) - new Date(i.date + 'T00:00:00')) / DAY_MS))
      )
      .filter((d) => Number.isFinite(d));
    const avg = days.length ? Math.round(days.reduce((s, d) => s + d, 0) / days.length) : null;
    return {
      count: paid.length,
      avg,
      prompt: days.filter((d) => d <= 7).length,
      normal: days.filter((d) => d > 7 && d <= 30).length,
      slow: days.filter((d) => d > 30).length,
      outstanding: Number(customer.outstandingBalance) || 0,
      unpaid: Number(customer.unpaidInvoiceCount) || 0,
    };
  }, [invoices, customer]);

  // Per-visit price trend — is the value of each visit growing? A distinct
  // upsell signal from the monthly spend total (which also moves with cadence).
  const visits = useMemo(() => {
    return [...completed]
      .filter((j) => j.date && (j.price || 0) > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .slice(-12)
      .map((j) => Number(j.price) || 0);
  }, [completed]);

  const data = useMemo(() => {
    const months = monthsBack(12);
    const buckets = new Map(months.map((m) => [m.key, { spend: 0, count: 0 }]));
    for (const j of completed) {
      if (!j.date) continue;
      const d = new Date(j.date);
      const key = ymKey(d);
      const b = buckets.get(key);
      if (b) {
        b.spend += j.price || 0;
        b.count += 1;
      }
    }
    const series = months.map((m) => ({ ...m, ...buckets.get(m.key) }));
    const maxSpend = Math.max(1, ...series.map((s) => s.spend));
    const maxCount = Math.max(1, ...series.map((s) => s.count));

    // Last-12-mo vs prior — relative-trend pill
    const now = Date.now();
    const last12 = completed.filter(
      (j) => j.date && now - new Date(j.date).getTime() <= 365 * DAY_MS
    );
    const prior12 = completed.filter((j) => {
      if (!j.date) return false;
      const t = new Date(j.date).getTime();
      return now - t > 365 * DAY_MS && now - t <= 730 * DAY_MS;
    });
    const last12Spend = last12.reduce((s, j) => s + (j.price || 0), 0);
    const prior12Spend = prior12.reduce((s, j) => s + (j.price || 0), 0);
    const delta =
      prior12Spend > 0 ? Math.round(((last12Spend - prior12Spend) / prior12Spend) * 100) : null;

    // Service mix
    const mix = new Map();
    for (const j of completed) {
      const t = j.type || 'other';
      mix.set(t, (mix.get(t) || 0) + (j.price || 0));
    }
    const mixTotal = [...mix.values()].reduce((s, v) => s + v, 0) || 1;
    const mixArr = [...mix.entries()]
      .map(([type, value]) => ({
        type,
        label: JOB_TYPES.find((t) => t.id === type)?.label || type,
        value,
        pct: value / mixTotal,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Days since last visit + predicted next due
    const lastJob = completed[0] || null;
    const daysSinceLast = customer.lastJobDate
      ? Math.floor((now - new Date(customer.lastJobDate).getTime()) / DAY_MS)
      : null;
    const expectedGap = frequencyExpectedDays(customer.frequency);
    let predicted = null;
    if (customer.nextJobDate) {
      predicted = { iso: customer.nextJobDate, source: 'scheduled' };
    } else if (customer.lastJobDate && expectedGap) {
      const due = new Date(new Date(customer.lastJobDate).getTime() + expectedGap * DAY_MS);
      predicted = { iso: due.toISOString().slice(0, 10), source: 'predicted' };
    }

    // Frequency tracking — is the gap on plan?
    const gapHealth = (() => {
      if (!expectedGap || daysSinceLast == null) return null;
      const ratio = daysSinceLast / expectedGap;
      if (ratio <= 1.1) return { label: 'On schedule', accent: 'text-emerald-600' };
      if (ratio <= 1.5) return { label: 'Running late', accent: 'text-amber-600' };
      return { label: 'Overdue', accent: 'text-red-600' };
    })();

    return {
      series,
      maxSpend,
      maxCount,
      last12Spend,
      prior12Spend,
      delta,
      last12Count: last12.length,
      prior12Count: prior12.length,
      mixArr,
      mixTotal,
      lastJob,
      daysSinceLast,
      predicted,
      gapHealth,
    };
  }, [completed, customer]);

  const since = customer.customerSince || customer.createdAt;
  const yrs = yearsSince(since);
  const tenureLabel = yrs >= 1 ? `${yrs.toFixed(1)}y` : `${Math.max(0, Math.round(yrs * 12))}mo`;
  const bdayDays = nextBirthdayDays(customer.birthday);

  // SVG dimensions for the bar chart
  const W = 320,
    H = 110,
    PAD_L = 4,
    PAD_R = 4,
    PAD_T = 8,
    PAD_B = 18;
  const innerW = W - PAD_L - PAD_R;
  const barW = (innerW / data.series.length) * 0.7;
  const gap = (innerW / data.series.length) * 0.3;

  return (
    <div className="space-y-4">
      {/* Milestone strip */}
      <div className="flex flex-wrap gap-2">
        <MilestoneCard
          icon="🤝"
          label="Customer since"
          value={tenureLabel}
          accent="text-[#99c5ff]"
        />
        <MilestoneCard
          icon="🎂"
          label="Next birthday"
          value={bdayDays == null ? '—' : bdayDays === 0 ? 'Today' : `${bdayDays}d`}
          accent={bdayDays != null && bdayDays <= 30 ? 'text-pink-600' : 'text-[#010a4f]'}
        />
        <MilestoneCard
          icon={data.delta == null ? '—' : data.delta >= 0 ? '↗' : '↘'}
          label="12mo vs prior"
          value={
            data.delta == null
              ? gbp(data.last12Spend)
              : `${data.delta > 0 ? '+' : ''}${data.delta}%`
          }
          accent={
            data.delta == null
              ? 'text-[#010a4f]'
              : data.delta >= 0
                ? 'text-emerald-600'
                : 'text-red-600'
          }
        />
        <MilestoneCard
          icon={data.gapHealth?.accent === 'text-emerald-600' ? '✓' : '⏱'}
          label="Visit cadence"
          value={
            data.gapHealth?.label ||
            (data.daysSinceLast != null ? `${data.daysSinceLast}d ago` : '—')
          }
          accent={data.gapHealth?.accent || 'text-[#010a4f]'}
        />
      </div>

      {/* Spend timeline */}
      <Section
        title="Spend — last 12 months"
        sub={`${gbp(data.last12Spend)} · ${data.last12Count} job${data.last12Count === 1 ? '' : 's'}`}
      >
        {data.last12Count === 0 ? (
          <p className="text-xs text-[#010a4f]/40 py-2">No completed jobs in the last 12 months.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[110px]" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spendBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#99c5ff" />
                <stop offset="100%" stopColor="#1f48ff" />
              </linearGradient>
            </defs>
            {data.series.map((s, i) => {
              const h = (s.spend / data.maxSpend) * (H - PAD_T - PAD_B);
              const x = PAD_L + i * (barW + gap) + gap / 2;
              const y = H - PAD_B - h;
              return (
                <g key={s.key}>
                  {h > 0 && (
                    <rect x={x} y={y} width={barW} height={h} fill="url(#spendBar)" rx="2" />
                  )}
                  {h === 0 && (
                    <rect
                      x={x}
                      y={H - PAD_B - 2}
                      width={barW}
                      height="2"
                      fill="rgba(153,197,255,0.15)"
                      rx="1"
                    />
                  )}
                  <text
                    x={x + barW / 2}
                    y={H - 4}
                    textAnchor="middle"
                    fontSize="9"
                    fill="rgba(153,197,255,0.4)"
                    fontFamily="system-ui"
                  >
                    {s.label[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </Section>

      {/* Payment health — how promptly they pay + what's outstanding */}
      <Section title="Payment health" sub={pay.count ? `${pay.count} paid` : ''}>
        {pay.count === 0 && pay.outstanding === 0 ? (
          <p className="text-xs text-[#010a4f]/40">No invoice history yet.</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold tracking-wide uppercase text-[#010a4f]/55 mb-0.5">
                  Avg time to pay
                </p>
                <p
                  className={`text-2xl font-black tabular-nums ${
                    pay.avg == null
                      ? 'text-[#010a4f]'
                      : pay.avg <= 7
                        ? 'text-emerald-600'
                        : pay.avg <= 21
                          ? 'text-amber-600'
                          : 'text-red-600'
                  }`}
                >
                  {pay.avg == null ? '—' : `${pay.avg}d`}
                </p>
              </div>
              {pay.outstanding > 0 && (
                <div className="text-right">
                  <p className="text-[10px] font-bold tracking-wide uppercase text-red-500/70 mb-0.5">
                    Outstanding
                  </p>
                  <p className="text-lg font-black text-red-600 tabular-nums">
                    {gbp(pay.outstanding)}
                  </p>
                  <p className="text-[10px] text-red-500">{pay.unpaid} unpaid</p>
                </div>
              )}
            </div>
            {pay.count > 0 && (
              <div className="mt-3">
                <div className="flex h-2 rounded-full overflow-hidden bg-[#010a4f]/10">
                  {pay.prompt > 0 && (
                    <div
                      style={{ width: `${(pay.prompt / pay.count) * 100}%` }}
                      className="bg-emerald-500"
                    />
                  )}
                  {pay.normal > 0 && (
                    <div
                      style={{ width: `${(pay.normal / pay.count) * 100}%` }}
                      className="bg-amber-400"
                    />
                  )}
                  {pay.slow > 0 && (
                    <div
                      style={{ width: `${(pay.slow / pay.count) * 100}%` }}
                      className="bg-red-500"
                    />
                  )}
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-[#010a4f]/60">
                  <span>≤7d · {pay.prompt}</span>
                  <span>8–30d · {pay.normal}</span>
                  <span>30d+ · {pay.slow}</span>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {/* Per-visit value trend — is each visit worth more over time? */}
      {visits.length >= 2 &&
        (() => {
          const w = 320,
            h = 56,
            pad = 4;
          const min = Math.min(...visits);
          const max = Math.max(...visits);
          const span = max - min || 1;
          const stepX = (w - pad * 2) / (visits.length - 1);
          const dLine = visits
            .map((v, i) => {
              const x = pad + i * stepX;
              const y = pad + (1 - (v - min) / span) * (h - pad * 2);
              return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(' ');
          const first = visits[0];
          const last = visits[visits.length - 1];
          const up = last >= first;
          return (
            <Section title="Per-visit value" sub={`last ${visits.length} visits`}>
              <div className="flex items-center gap-3">
                <svg
                  viewBox={`0 0 ${w} ${h}`}
                  className="flex-1 h-[56px]"
                  preserveAspectRatio="none"
                >
                  <path
                    d={dLine}
                    fill="none"
                    stroke={up ? '#059669' : '#dc2626'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black tabular-nums text-[#010a4f]">{gbp(last)}</p>
                  <p
                    className={`text-[10px] font-bold ${up ? 'text-emerald-600' : 'text-red-600'}`}
                  >
                    {up ? '↗' : '↘'} from {gbp(first)}
                  </p>
                </div>
              </div>
            </Section>
          );
        })()}

      {/* Service mix */}
      <Section
        title="Service mix"
        sub={`${data.mixArr.length} type${data.mixArr.length === 1 ? '' : 's'}`}
      >
        {data.mixArr.length === 0 ? (
          <p className="text-xs text-[#010a4f]/40">No completed work yet.</p>
        ) : (
          <div className="space-y-2">
            {data.mixArr.map((m, i) => {
              const colors = ['#1f48ff', '#99c5ff', '#5a8dff', '#3a5eff', '#7eb0ff'];
              return (
                <div key={m.type}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs text-[#010a4f] truncate">{m.label}</p>
                    <p className="text-[10px] text-[#010a4f]/60 tabular-nums shrink-0 ml-2">
                      {gbp(m.value)} · {Math.round(m.pct * 100)}%
                    </p>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${m.pct * 100}%`,
                        backgroundColor: colors[i % colors.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Cadence panel */}
      <div className="grid grid-cols-2 gap-3">
        <Section title="Last visit" sub={data.lastJob?.service || ''}>
          <p
            className={`text-2xl font-black tabular-nums ${data.daysSinceLast != null && data.daysSinceLast > 60 ? 'text-amber-600' : 'text-[#010a4f]'}`}
          >
            {data.daysSinceLast == null ? '—' : `${data.daysSinceLast}d`}
          </p>
          <p className="text-[10px] text-[#010a4f]/55 mt-0.5">
            {customer.lastJobDate
              ? new Date(customer.lastJobDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'no record'}
          </p>
        </Section>
        <Section
          title="Next due"
          sub={
            data.predicted?.source === 'scheduled' ? 'booked' : data.predicted ? 'predicted' : ''
          }
        >
          {data.predicted ? (
            <>
              <p className="text-2xl font-black text-[#010a4f] tabular-nums">
                {(() => {
                  const days = Math.ceil((new Date(data.predicted.iso) - Date.now()) / DAY_MS);
                  if (days < 0) return `${Math.abs(days)}d late`;
                  if (days === 0) return 'Today';
                  return `${days}d`;
                })()}
              </p>
              <p className="text-[10px] text-[#010a4f]/55 mt-0.5">
                {new Date(data.predicted.iso).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            </>
          ) : (
            <p className="text-xs text-[#010a4f]/40">Not scheduled — set a frequency to predict.</p>
          )}
        </Section>
      </div>

      {/* Acquisition + lifetime efficiency */}
      <Section
        title="Lifetime"
        sub={customer.source ? `via ${customer.source}` : 'no source recorded'}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-wide uppercase text-[#010a4f]/55 mb-0.5">
              Value
            </p>
            <p className="text-lg font-black text-emerald-600 tabular-nums">
              {gbp(customer.lifetimeValue || 0)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wide uppercase text-[#010a4f]/55 mb-0.5">
              Jobs
            </p>
            <p className="text-lg font-black text-[#010a4f] tabular-nums">{completed.length}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wide uppercase text-[#010a4f]/55 mb-0.5">
              Avg / job
            </p>
            <p className="text-lg font-black text-[#010a4f] tabular-nums">
              {completed.length ? gbp((customer.lifetimeValue || 0) / completed.length) : '—'}
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
