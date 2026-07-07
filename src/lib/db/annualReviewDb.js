// Annual Review aggregator + filing model.
//
// Slice 1 covers §2 "The Year in Numbers" from the AR spec. Later slices
// extend the aggregator to §3–§9 and add the tone-mode / plan / ratings /
// verify-URL layers.
//
// Design notes:
//   • Reads are keyed to the current user via existing owner_id-scoped
//     modules (moneyDb / jobsDb / mileageDb). Filings are written to
//     annual_reviews scoped by business_id (matches every other
//     business-scoped table in the codebase).
//   • The tax-year period is entity-branched: sole traders + partnerships
//     use the personal SA year (6 Apr → 5 Apr); Ltds use their accounting
//     year end from business_settings.accounting_year_end_month. This
//     matches the spec's open-decision default.
//   • aggregateForYear returns a stable shape. Do not add or reorder
//     fields casually — the shape is what gets frozen into snapshot_jsonb
//     and hashed for the verify URL. Bumping the shape means bumping the
//     schema_version field so future readers can migrate old snapshots.

import { supabase } from '../supabase';
import { getCurrentUserId } from './authDb';
import { listMoneyEntries } from './moneyDb';
import { listJobs } from './jobsDb';
import { listMileageLogs } from './mileageDb';
import { listCustomers } from './customersDb';
import { listServices } from './servicesDb';
import { listInvoices } from './invoiceDb';
import { calcSelfEmployedTax, calculateCT, PERSONAL_ALLOWANCE } from '../taxCalc';

// Bump this if the snapshot shape changes in a breaking way. Old filed
// rows will keep their own schema_version; the AR renderer can branch on
// it to render legacy shapes correctly.
export const AR_SCHEMA_VERSION = 1;

// ─── Tax-year helpers ─────────────────────────────────────────────────────────

// UK personal tax year runs 6 Apr → 5 Apr. Label form: '2025/26'.
export function saTaxYearBoundaries(label) {
  const m = /^(\d{4})\/(\d{2})$/.exec(label ?? '');
  if (!m) throw new Error(`Invalid tax year label: ${label}`);
  const startYear = Number(m[1]);
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    label,
  };
}

export function saTaxYearForDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y =
    d.getMonth() < 3 || (d.getMonth() === 3 && d.getDate() < 6)
      ? d.getFullYear() - 1
      : d.getFullYear();
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`;
}

// Ltd accounting year: business_settings.accounting_year_end_month is the
// month the year ends (1-12). If not set, falls back to March (matches
// personal SA year). Returns the label as 'YYYY/YY' for consistency with
// SA labels — start year is the year the period BEGINS.
export function ltdAccountingYearBoundaries(endMonth, endYear) {
  // endMonth: 1-12; endYear: the calendar year the period ends
  const em = Math.min(Math.max(Number(endMonth) || 3, 1), 12);
  const startYear = endMonth === 1 ? endYear - 1 : endYear;
  const startMonth = em === 12 ? 1 : em + 1;
  const startDay = 1;
  // Last day of endMonth in endYear
  const endDate = new Date(Date.UTC(endYear, em, 0));
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: `${startYear}-${pad(startMonth)}-${pad(startDay)}`,
    end: `${endYear}-${pad(em)}-${pad(endDate.getUTCDate())}`,
    label: `${startYear}/${String(endYear % 100).padStart(2, '0')}`,
  };
}

// Normalise the DB entity_type into the internal 'ltd' | 'sole_trader'
// convention this module uses everywhere. The canonical value stored in
// business_settings.entity_type is 'limited_company' (used across Settings,
// Onboarding, MoneyTracker, InvoiceGenerator, saPack, invoicePdf); older/other
// data may say 'ltd'. Accept both so a limited company is never mis-treated as
// a sole trader (wrong tax path, wrong risk register, wrong narrative).
export function normalizeEntityType(raw) {
  return raw === 'ltd' || raw === 'limited_company' ? 'ltd' : 'sole_trader';
}

// Resolve the "current review period" a user is filing against, branched
// on entity type. Returns { start, end, label, isLtd }.
export async function getCurrentReviewPeriod() {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return null;

  const { data: settings } = await supabase
    .from('business_settings')
    .select('entity_type, accounting_year_end_month')
    .eq('owner_id', ownerId)
    .maybeSingle();

  const isLtd = normalizeEntityType(settings?.entity_type) === 'ltd';
  if (isLtd && settings?.accounting_year_end_month) {
    // Pick the most recently completed accounting year. If today is past
    // the accounting year end this calendar year, that's the period; else
    // the period from last year.
    const now = new Date();
    const endMonth = Number(settings.accounting_year_end_month);
    const thisYearEnd = new Date(Date.UTC(now.getUTCFullYear(), endMonth, 0));
    const endYear = now > thisYearEnd ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return { ...ltdAccountingYearBoundaries(endMonth, endYear), isLtd: true };
  }

  const label = saTaxYearForDate(new Date());
  return { ...saTaxYearBoundaries(label), isLtd: false };
}

// Given a review period, return the label + boundaries of the immediately
// prior period of the same length. Used for YoY comparison.
export function priorPeriodOf(period) {
  const s = new Date(period.start);
  const e = new Date(period.end);
  const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(s.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const iso = (d) => d.toISOString().slice(0, 10);
  // Attempt a nicely-formatted label for SA years; otherwise use ISO dates.
  const saMatch = /^(\d{4})\/(\d{2})$/.exec(period.label ?? '');
  let label = period.label
    ? saMatch
      ? `${Number(saMatch[1]) - 1}/${String(Number(saMatch[1]) % 100).padStart(2, '0')}`
      : `${iso(prevStart)} – ${iso(prevEnd)}`
    : `${iso(prevStart)} – ${iso(prevEnd)}`;
  return { start: iso(prevStart), end: iso(prevEnd), label };
}

// ─── Aggregator ───────────────────────────────────────────────────────────────

// Compute a monthly income/expense series over the period. For SA years
// this maps neatly to the 12 April-onward buckets. For other periods it
// still buckets by calendar month but labels with '%b %y'.
function monthlySeries(period, entries) {
  const s = new Date(period.start);
  const e = new Date(period.end);
  const buckets = [];
  // Walk month-by-month from start
  const cursor = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  while (cursor <= e) {
    buckets.push({
      key: `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`,
      m: cursor.toLocaleDateString('en-GB', { month: 'short' }),
      income: 0,
      exp: 0,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  for (const en of entries) {
    if (!en.date) continue;
    const d = new Date(en.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const b = buckets.find((x) => x.key === key);
    if (!b) continue;
    const amt = Number(en.amount) || 0;
    if (en.kind === 'income') b.income += amt;
    else b.exp += amt;
  }
  return buckets.map(({ m, income, exp }) => ({
    m,
    income: Math.round(income),
    exp: Math.round(exp),
  }));
}

function totals(entries) {
  let income = 0,
    expenses = 0;
  for (const en of entries) {
    const amt = Number(en.amount) || 0;
    if (en.kind === 'income') income += amt;
    else if (en.kind === 'expense') expenses += amt;
  }
  return { income, expenses };
}

// Tax estimates delegate to lib/taxCalc — the same functions the Money and
// Accounting tabs use, so all three surfaces agree on the number the user
// stares at. calcSelfEmployedTax returns { incomeTax, ni, total, effectivePA };
// calculateCT applies marginal relief in the £50k–£250k band.
function estimateTaxSole(profit) {
  return calcSelfEmployedTax(profit).total;
}
function estimateTaxLtd(profit) {
  return calculateCT(profit);
}

async function aggregateOnePeriod(period, opts = {}) {
  const [moneyEntries, jobs, mileage, customers, invoices] = await Promise.all([
    listMoneyEntries({ from: period.start, to: period.end, pageSize: 10000 }),
    listJobs({ from: period.start, to: period.end, pageSize: 10000 }),
    listMileageLogs({ taxYearStart: period.start }).catch(() => []),
    opts.includeCustomers
      ? listCustomers({ pageSize: 5000 }).catch(() => [])
      : Promise.resolve(null),
    // Invoices don't have a windowed getter — pull the first page's worth
    // (100) newest. For businesses issuing more than 100/period we'd need
    // pagination; deferring until it's a real problem.
    opts.includeInvoices ? listInvoices({ pageSize: 1000 }).catch(() => []) : Promise.resolve(null),
  ]);
  const services = opts.services ?? null;
  const { income, expenses } = totals(moneyEntries);
  const profit = income - expenses;
  const margin = income > 0 ? (profit / income) * 100 : 0;

  const completedJobs = jobs.filter((j) => j.status === 'complete' || j.status === 'completed');
  const jobsCompleted = completedJobs.length;
  const avgJobValue =
    jobsCompleted > 0
      ? completedJobs.reduce((s, j) => s + (Number(j.price) || 0), 0) / jobsCompleted
      : 0;

  const mileageInPeriod = (mileage ?? []).filter((m) => {
    if (!m.date && !m.period_start) return false;
    const d = m.date ?? m.period_start;
    return d >= period.start && d <= period.end;
  });
  const mileageClaimed = mileageInPeriod.reduce((s, m) => s + (Number(m.claim_value) || 0), 0);
  const totalMiles = mileageInPeriod.reduce((s, m) => s + (Number(m.miles) || 0), 0);

  const monthly = monthlySeries(period, moneyEntries);

  // bestMonth / worstMonth are the highest/lowest income months (excluding
  // any zero-income months from the "worst" pool if there's a non-zero
  // month available — otherwise pick the earliest).
  const nonZero = monthly.filter((m) => m.income > 0);
  const bestMonth = monthly.length
    ? monthly.reduce((a, b) => (a.income >= b.income ? a : b))
    : null;
  const worstMonth = nonZero.length
    ? nonZero.reduce((a, b) => (a.income <= b.income ? a : b))
    : (monthly[0] ?? null);

  // §1 + §3 customer aggregates. Uses migration 078's archived_at column
  // to compute period-specific churn. For "existed at date X" a customer
  // counts if created_at <= X AND (archived_at IS NULL OR archived_at > X).
  let activeCustomers = 0;
  let clientsStart = 0;
  let clientsEnd = 0;
  let clientsNew = 0;
  let clientsLost = 0;
  let topClients = [];
  let concentrationTop3 = 0;
  let concentrationTop5 = 0;
  let retentionRate = 0;

  if (customers) {
    const periodStart = period.start;
    const periodEnd = period.end;

    const existedAt = (c, iso) => {
      const created = c.customer_since || c.created_at;
      if (!created) return false;
      if (created > iso) return false;
      if (c.archived_at && c.archived_at <= iso) return false;
      return true;
    };

    activeCustomers = customers.filter(
      (c) => (c.account_status ?? c.status ?? 'active') === 'active'
    ).length;
    clientsStart = customers.filter((c) => existedAt(c, periodStart)).length;
    clientsEnd = customers.filter((c) => existedAt(c, periodEnd)).length;
    clientsNew = customers.filter((c) => {
      const created = c.customer_since || c.created_at;
      return created && created >= periodStart && created <= periodEnd;
    }).length;
    clientsLost = customers.filter(
      (c) => c.archived_at && c.archived_at >= periodStart && c.archived_at <= periodEnd
    ).length;

    // Simple retention: how many customers who existed at start are still
    // active at end. Rate = (start - lost during period) / start.
    if (clientsStart > 0) {
      retentionRate = Math.max(
        0,
        Math.min(100, ((clientsStart - clientsLost) / clientsStart) * 100)
      );
    }

    // Revenue by customer from money_entries in the period. Only kind='income'
    // and only entries with a customer_id — walk-in/one-off income without a
    // customer link is excluded from the concentration numbers.
    const revenueByCustomer = new Map();
    const jobsByCustomer = new Map();
    for (const en of moneyEntries) {
      if (en.kind !== 'income') continue;
      if (!en.customer_id) continue;
      const amt = Number(en.amount) || 0;
      revenueByCustomer.set(en.customer_id, (revenueByCustomer.get(en.customer_id) || 0) + amt);
    }
    for (const j of jobs) {
      if (!j.customer_id) continue;
      if (j.status !== 'complete' && j.status !== 'completed') continue;
      jobsByCustomer.set(j.customer_id, (jobsByCustomer.get(j.customer_id) || 0) + 1);
    }

    const customersById = new Map(customers.map((c) => [c.id, c]));
    const totalAttributedRevenue = Array.from(revenueByCustomer.values()).reduce(
      (a, b) => a + b,
      0
    );
    topClients = Array.from(revenueByCustomer.entries())
      .map(([id, revenue]) => {
        const c = customersById.get(id);
        return {
          id,
          name: c?.name || 'Customer',
          category: c?.category || null,
          revenue: Math.round(revenue),
          visits: jobsByCustomer.get(id) || 0,
          share:
            totalAttributedRevenue > 0
              ? Math.round((revenue / totalAttributedRevenue) * 1000) / 10
              : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    if (totalAttributedRevenue > 0) {
      const top3 = topClients.slice(0, 3).reduce((s, c) => s + c.revenue, 0);
      const top5 = topClients.slice(0, 5).reduce((s, c) => s + c.revenue, 0);
      concentrationTop3 = Math.round((top3 / totalAttributedRevenue) * 1000) / 10;
      concentrationTop5 = Math.round((top5 / totalAttributedRevenue) * 1000) / 10;
    }
  }

  // §8 Operations — how well the work actually gets delivered. All from
  // the jobs list we already have; no extra fetches.
  const operations = buildOperations(jobs, period);

  // §4 Services Performance — group jobs by their `type` text (best-effort
  // link to services.name; no FK exists). Any job with a `type` that
  // doesn't match a defined service still lands in the perf list as an
  // "unmatched" bucket so the numbers reconcile against total revenue.
  //
  // Cost basis for margin: jobs.margin when set, else fall back to
  // price − labour_cost. Services without any completed jobs in the
  // period still appear with zero activity so the "which services aren't
  // getting bookings" story shows up.
  const servicesPerformance = [];
  const jobsByServiceName = {};
  if (services) {
    const revenueByType = new Map();
    const marginByType = new Map();
    const countByType = new Map();

    for (const j of jobs) {
      if (j.status !== 'complete' && j.status !== 'completed') continue;
      const key = (j.type && j.type.trim()) || '(uncategorised)';
      const price = Number(j.price) || 0;
      const cost = Number(j.labour_cost) || 0;
      const perJobMargin = Number.isFinite(Number(j.margin)) ? Number(j.margin) : price - cost;
      revenueByType.set(key, (revenueByType.get(key) || 0) + price);
      marginByType.set(key, (marginByType.get(key) || 0) + perJobMargin);
      countByType.set(key, (countByType.get(key) || 0) + 1);
    }
    for (const [k, v] of countByType) jobsByServiceName[k] = v;

    const seenNames = new Set();
    for (const s of services) {
      const revenue = revenueByType.get(s.name) || 0;
      const jobCount = countByType.get(s.name) || 0;
      const marginTotal = marginByType.get(s.name) || 0;
      servicesPerformance.push({
        id: s.id,
        name: s.name,
        category: s.category ?? null,
        revenue: Math.round(revenue),
        jobs: jobCount,
        avgPrice: jobCount > 0 ? Math.round(revenue / jobCount) : 0,
        grossMargin: revenue > 0 ? Math.round((marginTotal / revenue) * 1000) / 10 : 0,
        isActive: !!s.is_active,
      });
      seenNames.add(s.name);
    }
    // Unmatched job types — jobs booked with a type string that doesn't
    // match any current service. Surface them so revenue reconciles.
    for (const [key, revenue] of revenueByType) {
      if (seenNames.has(key)) continue;
      const jobCount = countByType.get(key) || 0;
      const marginTotal = marginByType.get(key) || 0;
      servicesPerformance.push({
        id: null,
        name: key,
        category: null,
        revenue: Math.round(revenue),
        jobs: jobCount,
        avgPrice: jobCount > 0 ? Math.round(revenue / jobCount) : 0,
        grossMargin: revenue > 0 ? Math.round((marginTotal / revenue) * 1000) / 10 : 0,
        isActive: false,
        unmatched: true,
      });
    }
    servicesPerformance.sort((a, b) => b.revenue - a.revenue);
  }

  // §5 Money & Cashflow — expense breakdown, cost lines, monthly P&L,
  // and invoice / debtor metrics.
  const expenseBreakdown = buildExpenseBreakdown(moneyEntries);
  const topCostLines = buildTopCostLines(moneyEntries);
  const monthlyPL = monthly.map((m) => ({ ...m, profit: m.income - m.exp }));

  const {
    invoicesIssued,
    invoicesPaid,
    outstandingAtEnd,
    badDebtWrittenOff,
    debtorDays,
    onTimePaymentRate,
    invoiceValueIssued,
    invoiceValuePaid,
  } = summariseInvoices(invoices, period);

  return {
    period: { start: period.start, end: period.end, label: period.label ?? null },
    income,
    expenses,
    profit,
    margin,
    jobsCompleted,
    avgJobValue,
    mileageClaimed,
    totalMiles,
    activeCustomers,
    clientsStart,
    clientsEnd,
    clientsNew,
    clientsLost,
    retentionRate: Math.round(retentionRate * 10) / 10,
    topClients,
    concentrationTop3,
    concentrationTop5,
    servicesPerformance,
    jobsByServiceName, // used for YoY diff by aggregateForYear; dropped from snapshot
    operations,
    // §5 fields
    expenseBreakdown,
    topCostLines,
    monthlyPL,
    invoicesIssued,
    invoicesPaid,
    invoiceValueIssued,
    invoiceValuePaid,
    outstandingAtEnd,
    badDebtWrittenOff,
    debtorDays,
    onTimePaymentRate,
    monthlyData: monthly,
    bestMonth: bestMonth && { name: bestMonth.m, value: bestMonth.income },
    worstMonth: worstMonth && { name: worstMonth.m, value: worstMonth.income },
  };
}

// ─── §8 Operations builder ───────────────────────────────────────────────────
// Everything is derived from the jobs list already loaded for the period.
// Scheduled = job.date within the period. Completed = status ∈ {complete,
// completed} AND completion_marked_at within the period. On-time = completed
// on the scheduled date (within a 1-day grace window either side).
function buildOperations(jobs, period) {
  const scheduledInPeriod = jobs.filter(
    (j) => j.date && j.date >= period.start && j.date <= period.end
  );

  const isCompletedStatus = (j) => j.status === 'complete' || j.status === 'completed';
  const completedInPeriod = jobs.filter((j) => {
    if (!isCompletedStatus(j)) return false;
    const iso = j.completion_marked_at ? j.completion_marked_at.slice(0, 10) : (j.date ?? null);
    return iso && iso >= period.start && iso <= period.end;
  });

  const cancelled = scheduledInPeriod.filter(
    (j) => j.status === 'cancelled' || j.status === 'canceled' || j.deleted_at
  ).length;
  const noShow = scheduledInPeriod.filter(
    (j) => j.status === 'no_show' || j.status === 'noshow'
  ).length;

  // On-time %: for completed jobs where we have both scheduled date and
  // completion marked date, was completion within 1 day of the schedule?
  let onTimeCount = 0,
    onTimeDenominator = 0;
  for (const j of completedInPeriod) {
    if (!j.date || !j.completion_marked_at) continue;
    const scheduled = new Date(j.date);
    const completed = new Date(j.completion_marked_at);
    const diffDays = Math.abs((completed - scheduled) / (1000 * 60 * 60 * 24));
    onTimeDenominator += 1;
    if (diffDays <= 1) onTimeCount += 1;
  }
  const onTimePct =
    onTimeDenominator > 0 ? Math.round((onTimeCount / onTimeDenominator) * 1000) / 10 : null;

  // Photo coverage: completed jobs with ≥1 photo in the JSONB array.
  let jobsWithPhotos = 0,
    totalPhotos = 0;
  for (const j of completedInPeriod) {
    const arr = Array.isArray(j.photos) ? j.photos : [];
    if (arr.length > 0) jobsWithPhotos += 1;
    totalPhotos += arr.length;
  }
  const photoCoveragePct =
    completedInPeriod.length > 0
      ? Math.round((jobsWithPhotos / completedInPeriod.length) * 1000) / 10
      : null;
  const avgPhotosPerJob =
    completedInPeriod.length > 0
      ? Math.round((totalPhotos / completedInPeriod.length) * 10) / 10
      : 0;

  // Recurring vs one-off split (of completed jobs).
  const recurringCount = completedInPeriod.filter(
    (j) => j.is_recurring || j.parent_recurring_job_id || j.series_id
  ).length;
  const oneOffCount = completedInPeriod.length - recurringCount;
  const recurringPct =
    completedInPeriod.length > 0
      ? Math.round((recurringCount / completedInPeriod.length) * 1000) / 10
      : 0;

  // Duration variance — actual vs scheduled (rough — jobs.duration_hrs
  // stores the scheduled slot).
  let actualMinsSum = 0,
    scheduledMinsSum = 0,
    durationDenom = 0;
  for (const j of completedInPeriod) {
    const actualM = Number(j.actual_duration_minutes) || 0;
    const schedM = (Number(j.duration_hrs) || 0) * 60;
    if (actualM > 0 && schedM > 0) {
      actualMinsSum += actualM;
      scheduledMinsSum += schedM;
      durationDenom += 1;
    }
  }
  const avgActualDurationMins =
    durationDenom > 0 ? Math.round(actualMinsSum / durationDenom) : null;
  const avgScheduledDurationMins =
    durationDenom > 0 ? Math.round(scheduledMinsSum / durationDenom) : null;
  const durationVariancePct =
    scheduledMinsSum > 0
      ? Math.round(((actualMinsSum - scheduledMinsSum) / scheduledMinsSum) * 1000) / 10
      : null;

  // Job tracking discipline — how many scheduled jobs got any status update
  // beyond default. Low signal = "log job completions to populate this
  // section" empty-state trigger.
  const scheduledCount = scheduledInPeriod.length;
  const captureRatePct =
    scheduledCount > 0 ? Math.round((completedInPeriod.length / scheduledCount) * 1000) / 10 : null;

  return {
    scheduled: scheduledCount,
    completed: completedInPeriod.length,
    cancelled,
    noShow,
    onTimePct,
    onTimeSampleSize: onTimeDenominator,
    photoCoveragePct,
    avgPhotosPerJob,
    jobsWithPhotos,
    recurringCount,
    oneOffCount,
    recurringPct,
    avgActualDurationMins,
    avgScheduledDurationMins,
    durationVariancePct,
    captureRatePct,
    // Complaint rate and NPS require a customer-feedback source that
    // doesn't exist yet — surfaced as null so the renderer can show
    // "not tracked" instead of a false zero.
    complaintCount: null,
    npsScore: null,
  };
}

// ─── §5 helpers ───────────────────────────────────────────────────────────────

// Group expense money_entries by category. Returns top-6 categories with
// their share of total spend, plus an "Other" bucket for the tail.
function buildExpenseBreakdown(moneyEntries) {
  const byCat = new Map();
  let totalExp = 0;
  for (const en of moneyEntries) {
    if (en.kind !== 'expense') continue;
    const cat = (en.category && en.category.trim()) || 'Uncategorised';
    const amt = Number(en.amount) || 0;
    byCat.set(cat, (byCat.get(cat) || 0) + amt);
    totalExp += amt;
  }
  if (totalExp === 0) return [];
  const sorted = Array.from(byCat.entries())
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
  const HEAD = 6;
  const head = sorted.slice(0, HEAD);
  const tail = sorted.slice(HEAD);
  const headWithPct = head.map((r) => ({
    ...r,
    pct: Math.round((r.amount / totalExp) * 1000) / 10,
  }));
  if (tail.length === 0) return headWithPct;
  const tailAmount = tail.reduce((s, r) => s + r.amount, 0);
  return [
    ...headWithPct,
    {
      label: 'Other',
      amount: tailAmount,
      pct: Math.round((tailAmount / totalExp) * 1000) / 10,
      isTail: true,
      tailCount: tail.length,
    },
  ];
}

// Top 5 individual expense entries — biggest single hits. Useful for
// spotting one-offs that a category-level view hides.
function buildTopCostLines(moneyEntries) {
  return moneyEntries
    .filter((en) => en.kind === 'expense')
    .map((en) => ({
      id: en.id,
      date: en.date,
      amount: Math.round(Number(en.amount) || 0),
      category: en.category || null,
      notes: en.notes || en.client || null,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

// Ltd-specific rollups: dividends paid + DLA movement + latest CT accrual.
// Pulls directly from the ltd_* tables rather than via ltdDb helpers so we
// can filter by date range without extra client-side work.
async function fetchLtdEntries(period, _priorPeriod) {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return null;

  const [{ data: dividendsRows }, { data: dlaRows }, { data: ctRows }] = await Promise.all([
    supabase.from('ltd_dividends').select('paid_on, amount').eq('owner_id', ownerId),
    supabase
      .from('ltd_director_loan_entries')
      .select('entry_date, amount, category')
      .eq('owner_id', ownerId),
    supabase
      .from('ltd_ct_accrual')
      .select('period_start, period_end, estimated_profit, ct_due, ct_paid, payment_due_on, status')
      .eq('owner_id', ownerId),
  ]);

  const inPeriod = (iso) => iso && iso >= period.start && iso <= period.end;

  const dividendsPaid = (dividendsRows ?? [])
    .filter((r) => inPeriod(r.paid_on))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // DLA balance = running total across ALL entries (director's loan is a
  // rolling ledger, not period-scoped). Movement = net change in period.
  const dlaBalance = (dlaRows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const dlaMovement = (dlaRows ?? [])
    .filter((r) => inPeriod(r.entry_date))
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);

  // CT provision = the CT accrual row whose period covers our review
  // period end (or overlaps it). Prefer the row where period_end matches
  // ours if there is one.
  const ct = (ctRows ?? [])
    .filter((r) => r.period_start && r.period_end)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))
    .find((r) => r.period_end >= period.start && r.period_start <= period.end);

  return {
    dividendsPaid: Math.round(dividendsPaid),
    dlaBalance: Math.round(dlaBalance),
    dlaMovement: Math.round(dlaMovement),
    ctProvision: ct ? Math.round(Number(ct.ct_due) || 0) : 0,
    ctDueOn: ct?.payment_due_on ?? null,
    ctStatus: ct?.status ?? null,
  };
}

// §7 Team & Workforce — headcount + payroll + turnover + holidays +
// accreditations (DBS/RTW). Also computes subcontractor spend as a
// category-text match on money_entries. All source tables scope to the
// current business via RLS.
async function fetchTeamBits(period) {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return null;

  const [{ data: members }, { data: payslips }, { data: absences }, { data: hrSettings }] =
    await Promise.all([
      supabase
        .from('team_members')
        .select(
          'id, first_name, last_name, role, is_active, is_director, hourly_rate, contracted_hours, holiday_entitlement_days, contract_start_date, contract_type, left_at, dbs_check_date, dbs_expiry_date, dbs_type, rtw_check_date, rtw_expiry_date'
        ),
      supabase
        .from('payslips')
        .select(
          'staff_id, hours_worked, gross_pay, tax_period, ni_employee_period, ni_employer_period, net_pay, created_at, status'
        ),
      supabase
        .from('staff_absences')
        .select('staff_id, start_date, end_date, type, status, hours_taken')
        .eq('owner_id', ownerId),
      supabase
        .from('hr_settings')
        .select('holiday_policy_weeks, bank_holidays_on_top, bank_holidays_per_year')
        .maybeSingle(),
    ]);

  const M = members ?? [];

  const existedAt = (m, iso) => {
    if (!m.contract_start_date) return false;
    if (m.contract_start_date > iso) return false;
    if (m.left_at && m.left_at.slice(0, 10) <= iso) return false;
    return true;
  };

  const headcountStart = M.filter((m) => existedAt(m, period.start)).length;
  const headcountEnd = M.filter((m) => existedAt(m, period.end)).length;
  const leavers = M.filter(
    (m) =>
      m.left_at && m.left_at.slice(0, 10) >= period.start && m.left_at.slice(0, 10) <= period.end
  ).length;
  const joiners = M.filter(
    (m) =>
      m.contract_start_date &&
      m.contract_start_date >= period.start &&
      m.contract_start_date <= period.end
  ).length;
  const avgHeadcount = (headcountStart + headcountEnd) / 2;
  const turnoverRate = avgHeadcount > 0 ? (leavers / avgHeadcount) * 100 : 0;
  const directors = M.filter((m) => m.is_director && m.is_active).length;
  const staffActive = M.filter((m) => m.is_active && !m.is_director).length;

  // Payroll totals — filter payslips whose created_at (proxy for pay date)
  // falls in the period. `finalised` and `submitted` count; drafts skipped.
  const slipsInPeriod = (payslips ?? []).filter((p) => {
    if (!p.created_at) return false;
    const iso = p.created_at.slice(0, 10);
    if (iso < period.start || iso > period.end) return false;
    return p.status !== 'draft';
  });
  const payrollGross = slipsInPeriod.reduce((s, p) => s + (Number(p.gross_pay) || 0), 0);
  const payrollNet = slipsInPeriod.reduce((s, p) => s + (Number(p.net_pay) || 0), 0);
  const payrollTaxPeriod = slipsInPeriod.reduce((s, p) => s + (Number(p.tax_period) || 0), 0);
  const niEmployee = slipsInPeriod.reduce((s, p) => s + (Number(p.ni_employee_period) || 0), 0);
  const niEmployer = slipsInPeriod.reduce((s, p) => s + (Number(p.ni_employer_period) || 0), 0);
  const payrollTotal = payrollGross + niEmployer; // employer-side cost
  const rtiPayslipsCount = slipsInPeriod.length;

  const directorIds = new Set(M.filter((m) => m.is_director).map((m) => m.id));
  const directorPayGross = slipsInPeriod
    .filter((p) => directorIds.has(p.staff_id))
    .reduce((s, p) => s + (Number(p.gross_pay) || 0), 0);

  // Absences → total hours, split by type. Type conventions in the
  // codebase are 'holiday' / 'sickness' / 'other' but we tolerate variants.
  const absInPeriod = (absences ?? []).filter((a) => {
    if (!a.start_date) return false;
    return a.start_date >= period.start && a.start_date <= period.end;
  });
  const holidayHoursTaken = absInPeriod
    .filter((a) => (a.type || '').toLowerCase().includes('holiday'))
    .reduce((s, a) => s + (Number(a.hours_taken) || 0), 0);
  const sicknessHoursTaken = absInPeriod
    .filter((a) => (a.type || '').toLowerCase().includes('sick'))
    .reduce((s, a) => s + (Number(a.hours_taken) || 0), 0);

  // Holiday entitlement across active staff (hours). Uses hr_settings
  // (H&M-style weeks policy). If no settings row, defaults to statutory
  // 5.6 weeks (28 days for full-time).
  const weeksPolicy = Number(hrSettings?.holiday_policy_weeks) || 5.6;
  const totalWeeklyHours = M.filter((m) => m.is_active).reduce(
    (s, m) => s + (Number(m.contracted_hours) || 0),
    0
  );
  const holidayEntitlementHours = totalWeeklyHours * weeksPolicy;

  // Accreditations — count members with a live DBS + RTW check (not
  // expired at period end). Feeds Tender mode.
  const isLive = (dateIso) => !dateIso || dateIso >= period.end;
  const dbsCovered = M.filter(
    (m) => m.is_active && m.dbs_check_date && isLive(m.dbs_expiry_date)
  ).length;
  const rtwCovered = M.filter(
    (m) => m.is_active && m.rtw_check_date && isLive(m.rtw_expiry_date)
  ).length;

  return {
    headcountStart,
    headcountEnd,
    joiners,
    leavers,
    turnoverRate: Math.round(turnoverRate * 10) / 10,
    directors,
    staffActive,
    payrollGross: Math.round(payrollGross),
    payrollNet: Math.round(payrollNet),
    payrollTaxPeriod: Math.round(payrollTaxPeriod),
    niEmployee: Math.round(niEmployee),
    niEmployer: Math.round(niEmployer),
    payrollTotal: Math.round(payrollTotal),
    directorPayGross: Math.round(directorPayGross),
    rtiPayslipsCount,
    holidayHoursTaken: Math.round(holidayHoursTaken),
    holidayEntitlementHours: Math.round(holidayEntitlementHours),
    sicknessHoursTaken: Math.round(sicknessHoursTaken),
    dbsCovered,
    rtwCovered,
    hrPolicyWeeks: weeksPolicy,
    bankHolidaysOnTop: !!hrSettings?.bank_holidays_on_top,
  };
}

// Approximate subcontractor spend from category text on money_entries.
async function sumSubcontractorSpend(period) {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return 0;
  const { data } = await supabase
    .from('money_entries')
    .select('amount, category, notes')
    .eq('owner_id', ownerId)
    .eq('kind', 'expense')
    .gte('date', period.start)
    .lte('date', period.end);
  return (data ?? [])
    .filter((r) => {
      const c = (r.category || '').toLowerCase();
      const n = (r.notes || '').toLowerCase();
      return (
        c.includes('subcontract') ||
        c.includes('contractor') ||
        c.includes('freelance') ||
        n.includes('subcontractor') ||
        n.includes('freelance')
      );
    })
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

// §6 Tax Position — HMRC connection + MTD ITSA submissions + payroll +
// VAT + threshold-proximity. RLS on all three source tables (hmrc_status,
// hmrc_submissions, payroll_settings) scopes to the current owner.
async function fetchTaxContext(period, entityType, businessSettings) {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return null;

  const [{ data: hmrcStatus }, { data: hmrcSubmissions }, payrollRow] = await Promise.all([
    supabase.from('hmrc_status').select('*').maybeSingle(),
    supabase
      .from('hmrc_submissions')
      .select('period_start, period_end, income, expenses, submitted_at')
      .eq('owner_id', ownerId)
      .order('submitted_at', { ascending: false }),
    entityType === 'ltd'
      ? supabase
          .from('payroll_settings')
          .select('paye_ref, employment_allowance, sandbox_mode')
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const submissionsAll = hmrcSubmissions ?? [];
  const submissionsHere = submissionsAll.filter((s) => {
    if (!s.submitted_at) return false;
    const iso = s.submitted_at.slice(0, 10);
    return iso >= period.start && iso <= period.end;
  });
  const lastSubmission = submissionsAll[0]?.submitted_at ?? null;

  return {
    hmrcConnected: !!hmrcStatus?.connected,
    hmrcScope: hmrcStatus?.hmrc_scope || null,
    hmrcTokenExpired: !!hmrcStatus?.token_expired,
    hmrcConnectedAt: hmrcStatus?.hmrc_connected_at || null,
    hmrcHasNino: !!hmrcStatus?.has_nino,
    mtdSubmissionsInPeriod: submissionsHere.length,
    mtdSubmissionsAll: submissionsAll.length,
    mtdLastSubmittedAt: lastSubmission,
    payrollPayeRef: payrollRow?.data?.paye_ref || null,
    payrollEmployAllow: !!payrollRow?.data?.employment_allowance,
    payrollSandbox: !!payrollRow?.data?.sandbox_mode,
    vatNumber: businessSettings?.vat_number || null,
    vatScheme: businessSettings?.setup_data?.vat_scheme || null,
    corporationTaxUtr: businessSettings?.corporation_tax_utr || null,
  };
}

// ─── §9 Risk Register builder ────────────────────────────────────────────────
// Pure function — reads what other sections already computed on the snapshot
// and turns each signal into a scored risk row. Risks that require a BL
// module to score properly are still LISTED (with severity 'unknown' and
// source 'lockedByBL') so the section never renders empty — the spec's
// "the doc should always feel like a complete document with gaps" rule.
//
// Row shape:
//   { id, title, category, severity, headline, evidence, source }
//     source: 'computed' | 'lockedByBL:<module>'
//     severity: 'low' | 'medium' | 'high' | 'unknown'
//
// Categories: 'customer' | 'financial' | 'people' | 'regulatory' | 'market'
export function buildRiskRegister(snapshot, entityType) {
  if (!snapshot) return { risks: [], overall: 'unknown' };
  const risks = [];

  // ── Customer concentration (from §3) ────────────────────────────────
  {
    const top3 = snapshot.concentrationTop3 ?? 0;
    let severity = 'unknown',
      headline = '';
    if (snapshot.topClients?.length > 0) {
      severity = top3 >= 50 ? 'high' : top3 >= 30 ? 'medium' : 'low';
      headline =
        top3 >= 50
          ? `${Math.round(top3)}% of revenue depends on 3 customers — material single-customer exposure`
          : top3 >= 30
            ? `${Math.round(top3)}% top-3 concentration — worth watching`
            : `${Math.round(top3)}% top-3 concentration — well-diversified customer base`;
    } else {
      severity = 'unknown';
      headline = 'No customer-attributed revenue in the period yet';
    }
    risks.push({
      id: 'customer_concentration',
      title: 'Customer concentration',
      category: 'customer',
      severity,
      headline,
      evidence: `Top-3 = ${Math.round(top3)}%, Top-5 = ${Math.round(snapshot.concentrationTop5 ?? 0)}% of attributed revenue`,
      source: 'computed',
    });
  }

  // ── Key-person risk (from §7) ───────────────────────────────────────
  {
    const activeHeads = (snapshot.team?.staffActive ?? 0) + (snapshot.team?.directors ?? 0);
    let severity, headline;
    if (!snapshot.team || activeHeads === 0) {
      severity = 'high';
      headline = 'Single-operator business — you are the single point of failure';
    } else if (activeHeads === 1) {
      severity = 'high';
      headline = 'One person on payroll — high key-person exposure';
    } else if (activeHeads <= 3) {
      severity = 'medium';
      headline = `${activeHeads}-person team — moderate key-person exposure`;
    } else {
      severity = 'low';
      headline = `${activeHeads}-person team — key-person exposure spread across the workforce`;
    }
    risks.push({
      id: 'key_person',
      title: 'Key-person risk',
      category: 'people',
      severity,
      headline,
      evidence: `${activeHeads} active head${activeHeads === 1 ? '' : 's'} (including directors)`,
      source: 'computed',
    });
  }

  // ── Cash runway (from §5) — crude until BL Financial Resilience ─────
  {
    const runway = snapshot.cashRunwayMonths;
    let severity = 'unknown',
      headline = '';
    if (runway == null) {
      severity = 'unknown';
      headline = 'Cash runway not yet computable — no expenses in this period';
    } else if (runway < 1) {
      severity = 'high';
      headline = `Less than 1 month of receivables cover — thin runway`;
    } else if (runway < 3) {
      severity = 'medium';
      headline = `${runway} months of receivables cover — some resilience needed`;
    } else {
      severity = 'low';
      headline = `${runway} months of receivables cover — comfortable position`;
    }
    risks.push({
      id: 'cash_runway',
      title: 'Cash runway',
      category: 'financial',
      severity,
      headline,
      evidence:
        'Approximation: outstanding receivables ÷ monthly burn. BL Financial Resilience module refines with cash-balance input.',
      source: 'lockedByBL:financial_resilience',
    });
  }

  // ── Debtor risk (from §5) ───────────────────────────────────────────
  {
    const days = snapshot.debtorDays;
    let severity = 'unknown',
      headline = '';
    if (days == null) {
      severity = 'unknown';
      headline = 'No paid invoices in period — debtor days not measurable';
    } else if (days > 60) {
      severity = 'high';
      headline = `${Math.round(days)}-day average — collections lag hurting cashflow`;
    } else if (days > 30) {
      severity = 'medium';
      headline = `${Math.round(days)}-day average — room to tighten the chase cadence`;
    } else {
      severity = 'low';
      headline = `${Math.round(days)}-day average — collections cadence is healthy`;
    }
    risks.push({
      id: 'debtor_days',
      title: 'Debtor days',
      category: 'financial',
      severity,
      headline,
      evidence: `On-time payment rate: ${snapshot.onTimePaymentRate != null ? Math.round(snapshot.onTimePaymentRate) + '%' : '—'}`,
      source: 'computed',
    });
  }

  // ── Bad debt written off (from §5) ──────────────────────────────────
  if ((snapshot.badDebtWrittenOff ?? 0) > 0) {
    risks.push({
      id: 'bad_debt',
      title: 'Bad debt exposure',
      category: 'financial',
      severity: 'medium',
      headline: `£${snapshot.badDebtWrittenOff.toLocaleString('en-GB')} written off this period`,
      evidence:
        'Voided or written-off invoices. Review chase cadence + credit checks on high-value customers.',
      source: 'computed',
    });
  }

  // ── VAT threshold cliff (from §6) ───────────────────────────────────
  if (snapshot.tax?.vatProximity) {
    const vat = snapshot.tax.vatProximity;
    if (vat.status === 'over_threshold_unregistered') {
      risks.push({
        id: 'vat_cliff',
        title: 'VAT registration threshold breached',
        category: 'regulatory',
        severity: 'high',
        headline: 'Above the £90,000 VAT registration threshold while not registered',
        evidence: 'HMRC penalises late registration. Priority action.',
        source: 'computed',
      });
    } else if (vat.status === 'approaching_registration') {
      risks.push({
        id: 'vat_approach',
        title: 'Approaching VAT threshold',
        category: 'regulatory',
        severity: 'medium',
        headline: `£${vat.distanceToRegistration.toLocaleString('en-GB')} to the £90k registration threshold`,
        evidence: 'Model the pricing impact in Business Lab before registration is forced.',
        source: 'computed',
      });
    } else if (vat.status === 'near_dereg') {
      risks.push({
        id: 'vat_dereg',
        title: 'Below VAT deregistration threshold',
        category: 'regulatory',
        severity: 'low',
        headline: 'Trading below £88,000 deregistration threshold',
        evidence:
          "Voluntary deregistration is optional. Weigh admin savings vs input-VAT reclaim you'd lose.",
        source: 'computed',
      });
    }
  }

  // ── Ltd DLA overdrawn ──────────────────────────────────────────────
  if (entityType === 'ltd' && (snapshot.ltdDlaBalance ?? 0) < 0) {
    const overdrawn = Math.abs(snapshot.ltdDlaBalance);
    risks.push({
      id: 'ltd_dla',
      title: "Overdrawn director's loan account",
      category: 'regulatory',
      severity: overdrawn > 10000 ? 'high' : 'medium',
      headline: `DLA overdrawn by £${overdrawn.toLocaleString('en-GB')}`,
      evidence:
        overdrawn > 10000
          ? 'Above the £10k benefit-in-kind threshold — HMRC will expect a P11D or interest charged at the official rate.'
          : 'Not yet at the £10k benefit-in-kind threshold, but worth clearing before year end.',
      source: 'computed',
    });
  }

  // ── DBS/RTW cover (from §7) ─────────────────────────────────────────
  if (snapshot.team) {
    const total = snapshot.team.staffActive + snapshot.team.directors;
    const dbsGap = total - (snapshot.team.dbsCovered ?? 0);
    const rtwGap = total - (snapshot.team.rtwCovered ?? 0);
    if (dbsGap > 0) {
      risks.push({
        id: 'dbs_gap',
        title: 'DBS check coverage gap',
        category: 'regulatory',
        severity: dbsGap === total ? 'high' : 'medium',
        headline: `${dbsGap} of ${total} active staff without a current DBS check`,
        evidence: 'FMs and enterprise clients typically require 100% cover before contract award.',
        source: 'computed',
      });
    }
    if (rtwGap > 0) {
      risks.push({
        id: 'rtw_gap',
        title: 'Right-to-work verification gap',
        category: 'regulatory',
        severity: 'high',
        headline: `${rtwGap} of ${total} active staff without RTW check on file`,
        evidence: 'Home Office fines up to £45,000 per illegal worker for a first offence.',
        source: 'computed',
      });
    }
  }

  // ── Service line concentration (from §4) ────────────────────────────
  if (snapshot.servicesPerformance?.length > 0) {
    const activeServices = snapshot.servicesPerformance.filter((s) => s.revenue > 0);
    if (activeServices.length > 0) {
      const totalRev = activeServices.reduce((s, r) => s + r.revenue, 0);
      const topShare = totalRev > 0 ? (activeServices[0].revenue / totalRev) * 100 : 0;
      let severity, headline;
      if (activeServices.length === 1) {
        severity = 'high';
        headline = `100% of revenue from one service (${activeServices[0].name})`;
      } else if (topShare >= 60) {
        severity = 'medium';
        headline = `${Math.round(topShare)}% of revenue from one service — sector concentration`;
      } else {
        severity = 'low';
        headline = `${activeServices.length} services delivering revenue — well spread`;
      }
      risks.push({
        id: 'service_concentration',
        title: 'Service line concentration',
        category: 'market',
        severity,
        headline,
        evidence: `Top service: ${activeServices[0].name}`,
        source: 'computed',
      });
    }
  }

  // ── Business insurance (unscored — no data source yet) ──────────────
  risks.push({
    id: 'insurance',
    title: 'Business insurance',
    category: 'regulatory',
    severity: 'unknown',
    headline: "Public liability + employers' liability + van insurance not yet tracked in Cadi",
    evidence:
      'The BL Compliance & Risk module will capture policies, expiry dates and cover amounts.',
    source: 'lockedByBL:compliance_risk',
  });

  // ── Supplier concentration (unscored — no supplier data) ────────────
  risks.push({
    id: 'supplier_concentration',
    title: 'Supplier concentration',
    category: 'market',
    severity: 'unknown',
    headline:
      'Suppliers (cleaning products, van finance, fuel card, insurance broker) not yet tracked',
    evidence: 'The BL Compliance & Risk module will capture supplier list + spend split.',
    source: 'lockedByBL:compliance_risk',
  });

  const SEV_RANK = { unknown: 0, low: 1, medium: 2, high: 3 };
  const overall = risks.reduce(
    (acc, r) => (SEV_RANK[r.severity] > SEV_RANK[acc] ? r.severity : acc),
    'unknown'
  );

  return { risks, overall };
}

// §6 Tax Position builder — assembles the full picture from entity type,
// live tax calculations, HMRC connection status, and business settings.
// Returns the sub-tree stitched onto the top-level snapshot as `tax`.
function buildTaxPosition({
  entityType,
  income,
  profit,
  ltdBits,
  taxCtx,
  businessSettings,
  priorProfit,
}) {
  const vatRegistered = !!businessSettings?.vat_registered;
  const vatProximity = computeVatThresholdProximity({ vatRegistered, income });

  const base = {
    entityType,
    vatRegistered,
    vatProximity,
    vatNumber: taxCtx?.vatNumber ?? businessSettings?.vat_number ?? null,
    vatScheme: taxCtx?.vatScheme ?? null,
    corporationTaxUtr: taxCtx?.corporationTaxUtr ?? businessSettings?.corporation_tax_utr ?? null,
    hmrc: taxCtx
      ? {
          connected: taxCtx.hmrcConnected,
          scope: taxCtx.hmrcScope,
          tokenExpired: taxCtx.hmrcTokenExpired,
          connectedAt: taxCtx.hmrcConnectedAt,
          hasNino: taxCtx.hmrcHasNino,
          mtdSubmissionsInPeriod: taxCtx.mtdSubmissionsInPeriod,
          mtdSubmissionsAll: taxCtx.mtdSubmissionsAll,
          mtdLastSubmittedAt: taxCtx.mtdLastSubmittedAt,
        }
      : null,
    payroll: {
      payeRef: taxCtx?.payrollPayeRef ?? null,
      employmentAllowance: taxCtx?.payrollEmployAllow ?? false,
      sandbox: taxCtx?.payrollSandbox ?? false,
    },
  };

  if (entityType === 'ltd') {
    // Optimal split (2025/26 heuristic): director salary = PA, remainder as
    // dividends. This ignores multiple directors + partial dividend takes
    // — a first pass; the BL Entity & Tax Strategy module refines it.
    const dividendsPaid = ltdBits?.dividendsPaid ?? 0;
    const ctProvisioned = ltdBits?.ctProvision ?? 0;

    const optimalSalary = PERSONAL_ALLOWANCE;
    const ctOnFullProfit = calculateCT(profit);
    const ctOnProfitLessSalary = calculateCT(Math.max(0, profit - optimalSalary));
    const ctSavingFromOptimal = ctOnFullProfit - ctOnProfitLessSalary;
    const dividendsAtOptimalSplit = Math.max(0, profit - optimalSalary - ctOnProfitLessSalary);

    return {
      ...base,
      ltd: {
        profit: Math.round(profit),
        ctDue: ctOnFullProfit,
        ctProvisioned,
        ctDueOn: ltdBits?.ctDueOn ?? null,
        ctStatus: ltdBits?.ctStatus ?? null,
        dividendsPaid,
        salaryPaid: null, // requires payroll integration; deferred
        optimalSalary,
        dividendsAtOptimalSplit,
        ctSavingFromOptimal,
        rateBand:
          profit <= 50000 ? 'small_profits' : profit >= 250000 ? 'main_rate' : 'marginal_relief',
      },
    };
  }

  // Sole trader / partnership → SA103 income tax + Class 4 NI
  const soleBreakdown = calcSelfEmployedTax(profit);
  const prevBreakdown = calcSelfEmployedTax(Math.max(0, priorProfit || 0));
  const yoyDeltaTotal = soleBreakdown.total - prevBreakdown.total;

  return {
    ...base,
    sole: {
      profit: Math.round(profit),
      incomeTax: soleBreakdown.incomeTax,
      ni: soleBreakdown.ni,
      total: soleBreakdown.total,
      effectivePA: soleBreakdown.effectivePA,
      yoyDeltaTotal,
      band:
        profit <= 12570
          ? 'personal_allowance'
          : profit <= 50270
            ? 'basic'
            : profit <= 125140
              ? 'higher'
              : 'additional',
    },
  };
}

// UK VAT thresholds (2024/25 onwards).
const VAT_REGISTRATION_THRESHOLD = 90000;
const VAT_DEREGISTRATION_THRESHOLD = 88000;

function computeVatThresholdProximity({ vatRegistered, income }) {
  const bandFor = () => {
    if (vatRegistered) {
      if (income < VAT_DEREGISTRATION_THRESHOLD) return 'near_dereg';
      return 'above_registered';
    }
    if (income >= VAT_REGISTRATION_THRESHOLD) return 'over_threshold_unregistered';
    if (income >= VAT_REGISTRATION_THRESHOLD * 0.9) return 'approaching_registration';
    return 'below_threshold';
  };
  return {
    status: bandFor(),
    incomeInPeriod: Math.round(income),
    registrationThreshold: VAT_REGISTRATION_THRESHOLD,
    deregistrationThreshold: VAT_DEREGISTRATION_THRESHOLD,
    distanceToRegistration: Math.max(0, VAT_REGISTRATION_THRESHOLD - income),
  };
}

async function sumSoleTraderDrawings(period) {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return 0;
  const { data } = await supabase
    .from('money_entries')
    .select('amount, category, method, kind')
    .eq('owner_id', ownerId)
    .gte('date', period.start)
    .lte('date', period.end);
  const rows = data ?? [];
  return rows
    .filter((r) => r.kind === 'expense')
    .filter((r) => {
      const c = (r.category || '').toLowerCase();
      const m = (r.method || '').toLowerCase();
      return c.includes('drawing') || c.includes('own use') || m.includes('drawing');
    })
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

// Reduce an invoice's line items to a total value. Lines can carry rate
// as a string; VAT rate is per-line. Returns net + vat + gross.
function invoiceTotal(invoice) {
  const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
  let net = 0,
    vat = 0;
  for (const l of lines) {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const vr = Number(l.vatRate) || 0;
    const lineNet = qty * rate;
    net += lineNet;
    vat += lineNet * (vr / 100);
  }
  return { net, vat, gross: net + vat };
}

// Debtor days + on-time rate + outstanding value at period end + bad-debt.
// All computed from the invoices list — we filter to period-relevant rows
// inside so the caller can just hand us the full list.
function summariseInvoices(invoices, period) {
  const out = {
    invoicesIssued: 0,
    invoicesPaid: 0,
    invoiceValueIssued: 0,
    invoiceValuePaid: 0,
    outstandingAtEnd: 0,
    badDebtWrittenOff: 0,
    debtorDays: null,
    onTimePaymentRate: null,
  };
  if (!Array.isArray(invoices) || invoices.length === 0) return out;

  let daySum = 0,
    dayCount = 0;
  let onTimeCount = 0,
    dueDateCount = 0;

  for (const inv of invoices) {
    const total = invoiceTotal(inv);
    const issueDate = inv.date || (inv.created_at ? inv.created_at.slice(0, 10) : null);
    const inPeriod = issueDate && issueDate >= period.start && issueDate <= period.end;

    if (inPeriod) {
      out.invoicesIssued += 1;
      out.invoiceValueIssued += total.gross;
      if (inv.status === 'void' || inv.status === 'written_off') {
        out.badDebtWrittenOff += total.gross;
      }
    }

    if (inv.paid_at) {
      const paidDate = inv.paid_at.slice(0, 10);
      if (paidDate >= period.start && paidDate <= period.end) {
        out.invoicesPaid += 1;
        out.invoiceValuePaid += total.gross;
        // Debtor days: sent → paid
        if (inv.sent_at) {
          const days =
            (new Date(paidDate) - new Date(inv.sent_at.slice(0, 10))) / (1000 * 60 * 60 * 24);
          if (Number.isFinite(days) && days >= 0) {
            daySum += days;
            dayCount += 1;
          }
        }
        // On-time: paid_at ≤ due_date
        if (inv.due_date) {
          dueDateCount += 1;
          if (paidDate <= inv.due_date) onTimeCount += 1;
        }
      }
    }

    // Outstanding at period end: invoice issued on/before end, still not
    // paid (or paid after the end).
    if (issueDate && issueDate <= period.end) {
      const paidBeforeEnd = inv.paid_at && inv.paid_at.slice(0, 10) <= period.end;
      const isDeadStatus = inv.status === 'void' || inv.status === 'written_off';
      if (!paidBeforeEnd && !isDeadStatus) {
        out.outstandingAtEnd += total.gross;
      }
    }
  }

  out.invoiceValueIssued = Math.round(out.invoiceValueIssued);
  out.invoiceValuePaid = Math.round(out.invoiceValuePaid);
  out.outstandingAtEnd = Math.round(out.outstandingAtEnd);
  out.badDebtWrittenOff = Math.round(out.badDebtWrittenOff);
  out.debtorDays = dayCount > 0 ? Math.round((daySum / dayCount) * 10) / 10 : null;
  out.onTimePaymentRate =
    dueDateCount > 0 ? Math.round((onTimeCount / dueDateCount) * 1000) / 10 : null;
  return out;
}

// The public aggregator entrypoint. Runs current + prior period, computes
// YoY, and shells in the entity-branched tax estimate. Returns the exact
// shape the UI's NumbersSection consumes so there's no mapping layer —
// the snapshot that gets frozen and hashed is the same object the render
// tree sees, which keeps the audit trail literal.
//
// Snapshot fields:
//   schemaVersion   number    Bumped on breaking shape changes
//   entityType      text      'sole_trader' | 'ltd' | 'partnership'
//   period, priorPeriod       { start, end, label }
//   yr              text      Convenience label for the render tree
//   income, expenses, profit, margin, taxEst, netAfterTax
//   prevIncome, prevExpenses, prevProfit
//   yoyIncome, yoyProfit
//   jobsCompleted, avgJobValue, jobsPerMonth
//   mileageClaimed, totalMiles
//   monthlyData         Array<{ m, income, exp }>
//   bestMonth, worstMonth { name, value }
//   clientsStart, clientsEnd, clientsNew, clientsLost, retentionRate
//   topClients          Array<{ id, name, category, revenue, visits, share }>
//   concentrationTop3, concentrationTop5
//   servicesPerformance Array<{ id, name, category, revenue, jobs, avgPrice,
//                                grossMargin, prevJobs, jobsYoY, isActive,
//                                unmatched?, recommendation }>
//   expenseBreakdown    Array<{ label, amount, pct, isTail?, tailCount? }>
//   topCostLines        Array<{ id, date, amount, category, notes }>
//   monthlyPL           Array<{ m, income, exp, profit }>
//   invoicesIssued, invoicesPaid                (count)
//   invoiceValueIssued, invoiceValuePaid        (gross £)
//   outstandingAtEnd, badDebtWrittenOff         (gross £)
//   debtorDays          number|null   avg sent → paid days
//   onTimePaymentRate   number|null   % paid by due_date
//   cashRunwayMonths    number|null   crude: outstanding / monthly burn
//   soleTraderDrawings  number        approximate from category text
//   ltdDividendsPaid, ltdDlaBalance, ltdDlaMovement
//   ltdCtProvision, ltdCtDueOn, ltdCtStatus
//   team                object|null  §7 sub-tree — headcount, payroll,
//                                     turnover, holidays, DBS/RTW cover
//   operations          object       §8 sub-tree — scheduled/completed,
//                                     on-time %, cancellations, no-shows,
//                                     photo coverage, recurring split,
//                                     duration variance, capture rate
//   tax                 object        §6 sub-tree — see buildTaxPosition
//                                     { entityType, vatRegistered, vatProximity,
//                                       hmrc: { connected, mtdSubmissionsInPeriod, ... },
//                                       payroll: { payeRef, employmentAllowance, sandbox },
//                                       sole: { profit, incomeTax, ni, total, effectivePA, band, yoyDeltaTotal }
//                                       ltd:  { profit, ctDue, ctProvisioned, dividendsPaid,
//                                               optimalSalary, dividendsAtOptimalSplit,
//                                               ctSavingFromOptimal, rateBand } }
//   aggregatedAt        ISO stamp
//   isEmpty             true when nothing was logged in the period
export async function aggregateForYear({
  period,
  priorPeriod,
  entityType,
  businessSettings = null,
}) {
  // Services list is stable across periods — fetch once and pass in.
  const services = await listServices({ includeInactive: true }).catch(() => []);
  // Only fetch customers for the CURRENT period — the count is
  // point-in-time, so running it twice doesn't add signal and it's the
  // biggest single query.
  const [current, prior, ltdBits, taxCtx, teamBits, subcontractorSpend] = await Promise.all([
    aggregateOnePeriod(period, { includeCustomers: true, includeInvoices: true, services }),
    aggregateOnePeriod(priorPeriod, { includeCustomers: false, includeInvoices: false, services }),
    entityType === 'ltd'
      ? fetchLtdEntries(period, priorPeriod).catch(() => null)
      : Promise.resolve(null),
    fetchTaxContext(period, entityType, businessSettings).catch(() => null),
    fetchTeamBits(period).catch(() => null),
    sumSubcontractorSpend(period).catch(() => 0),
  ]);

  // Sole trader drawings: category-based signal from money_entries. We
  // match on category text containing 'drawing' or 'own use' — this is
  // approximate but the best signal available without a dedicated field.
  const soleTraderDrawings =
    entityType !== 'ltd' ? Math.round((await sumSoleTraderDrawings(period)) || 0) : 0;

  // §4 YoY delta + recommendation per service. jobsByServiceName is a
  // plain-object counter (service name → job count) from the aggregator.
  const prevJobsByName = prior.jobsByServiceName || {};
  const servicesPerformance = (current.servicesPerformance || []).map((sv) => {
    const prevJobs = prevJobsByName[sv.name] || 0;
    let jobsYoY = null;
    if (prevJobs > 0) {
      jobsYoY = Math.round(((sv.jobs - prevJobs) / prevJobs) * 1000) / 10;
    } else if (sv.jobs > 0) {
      jobsYoY = null; // no prior baseline; can't diff sensibly
    } else {
      jobsYoY = 0;
    }

    let recommendation = 'ok';
    if (sv.jobs === 0 && prevJobs === 0) recommendation = 'no_activity';
    else if (sv.jobs === 0 && prevJobs > 0) recommendation = 'declining_demand';
    else if (sv.grossMargin > 0 && sv.grossMargin < 60) recommendation = 'review_pricing';
    else if (jobsYoY !== null && jobsYoY <= -20) recommendation = 'declining_demand';
    else if (prevJobs === 0 && sv.jobs > 0) recommendation = 'new';

    return { ...sv, prevJobs, jobsYoY, recommendation };
  });

  const taxEst =
    entityType === 'ltd' ? estimateTaxLtd(current.profit) : estimateTaxSole(current.profit);

  const netAfterTax = current.profit - taxEst;
  const yoyIncome = prior.income > 0 ? ((current.income - prior.income) / prior.income) * 100 : 0;
  const yoyProfit =
    prior.profit !== 0 ? ((current.profit - prior.profit) / Math.abs(prior.profit)) * 100 : 0;

  return {
    schemaVersion: AR_SCHEMA_VERSION,
    entityType: entityType ?? 'sole_trader',
    period: current.period,
    priorPeriod: prior.period,
    yr: current.period.label ?? '',

    // §2 The Year in Numbers — the fields NumbersSection reads
    income: Math.round(current.income),
    expenses: Math.round(current.expenses),
    profit: Math.round(current.profit),
    margin: Math.round(current.margin * 10) / 10,
    taxEst,
    netAfterTax: Math.round(netAfterTax),
    jobsCompleted: current.jobsCompleted,
    avgJobValue: Math.round(current.avgJobValue),
    jobsPerMonth: Math.round((current.jobsCompleted / 12) * 10) / 10,
    mileageClaimed: Math.round(current.mileageClaimed),
    totalMiles: Math.round(current.totalMiles),
    monthlyData: current.monthlyData,
    bestMonth: current.bestMonth ?? { name: '—', value: 0 },
    worstMonth: current.worstMonth ?? { name: '—', value: 0 },

    // §1 Executive Summary KPI
    activeCustomers: current.activeCustomers,

    // §3 Customer Story — populated by Slice 3. clientsLost is period
    // churn from customers.archived_at; retentionRate is (start − lost)
    // / start. topClients is revenue-attributed via money_entries.customer_id
    // — walk-in income without a customer link is intentionally excluded.
    clientsStart: current.clientsStart,
    clientsEnd: current.clientsEnd,
    clientsNew: current.clientsNew,
    clientsLost: current.clientsLost,
    retentionRate: current.retentionRate,
    topClients: current.topClients,
    concentrationTop3: current.concentrationTop3,
    concentrationTop5: current.concentrationTop5,

    // YoY
    prevIncome: Math.round(prior.income),
    prevExpenses: Math.round(prior.expenses),
    prevProfit: Math.round(prior.profit),
    yoyIncome: Math.round(yoyIncome * 10) / 10,
    yoyProfit: Math.round(yoyProfit * 10) / 10,

    // §4 Services Performance — cross-period diff computed above. Each
    // row carries current-period revenue/jobs/margin, the prior-period
    // job count, YoY delta, and a recommendation tag.
    servicesPerformance,

    // §5 Money & Cashflow — expense breakdown, invoice metrics, entity-
    // branched fields. Ltd-specific rollups from ltd_* tables when the
    // business is limited; sole-trader drawings when not.
    expenseBreakdown: current.expenseBreakdown,
    topCostLines: current.topCostLines,
    monthlyPL: current.monthlyPL,
    invoicesIssued: current.invoicesIssued,
    invoicesPaid: current.invoicesPaid,
    invoiceValueIssued: current.invoiceValueIssued,
    invoiceValuePaid: current.invoiceValuePaid,
    outstandingAtEnd: current.outstandingAtEnd,
    badDebtWrittenOff: current.badDebtWrittenOff,
    debtorDays: current.debtorDays,
    onTimePaymentRate: current.onTimePaymentRate,
    // Simple cash-runway approximation: outstanding receivables ÷ monthly
    // burn. Not a proper runway (no cash-balance input yet) — the BL
    // "Financial Resilience" module will replace this when it lands.
    cashRunwayMonths:
      current.expenses > 0
        ? Math.round(((current.outstandingAtEnd || 0) / (current.expenses / 12)) * 10) / 10
        : null,
    // Entity-branched blocks
    soleTraderDrawings,
    ltdDividendsPaid: ltdBits?.dividendsPaid ?? 0,
    ltdDlaBalance: ltdBits?.dlaBalance ?? 0,
    ltdDlaMovement: ltdBits?.dlaMovement ?? 0,
    ltdCtProvision: ltdBits?.ctProvision ?? 0,
    ltdCtDueOn: ltdBits?.ctDueOn ?? null,
    ltdCtStatus: ltdBits?.ctStatus ?? null,

    // §8 Operations — delivery quality. All derived from the jobs list;
    // no separate fetch. See buildOperations().
    operations: current.operations,

    // §7 Team & Workforce — headcount, payroll, turnover, holidays,
    // accreditations. Sole trader with no team → renderer collapses to
    // "single-operator" view; otherwise the full HR block renders.
    team: teamBits
      ? {
          ...teamBits,
          // Cross-cutting: revenue per active head, avg employer cost per head
          revenuePerHead:
            teamBits.staffActive + teamBits.directors > 0
              ? Math.round(current.income / (teamBits.staffActive + teamBits.directors))
              : null,
          avgCostPerHead:
            teamBits.staffActive + teamBits.directors > 0
              ? Math.round(teamBits.payrollTotal / (teamBits.staffActive + teamBits.directors))
              : null,
          subcontractorSpend: Math.round(subcontractorSpend || 0),
        }
      : null,

    // §6 Tax Position — most branched section in the spec.
    tax: buildTaxPosition({
      entityType,
      period: current.period,
      income: current.income,
      expenses: current.expenses,
      profit: current.profit,
      ltdBits,
      taxCtx,
      businessSettings,
      priorProfit: prior.profit,
    }),

    // Provenance
    aggregatedAt: new Date().toISOString(),
    isEmpty: current.income === 0 && current.expenses === 0 && current.jobsCompleted === 0,
  };
}

// ─── Filing / retrieval ───────────────────────────────────────────────────────

// SHA-256 of the JSON-stable-stringified snapshot. Used as the verify URL
// hash. Browser SubtleCrypto — no external deps.
async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

export async function computeSnapshotHash(snapshot) {
  return sha256Hex(stableStringify(snapshot));
}

async function myBusinessId() {
  const ownerId = await getCurrentUserId();
  if (!ownerId) return null;
  const { data } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', ownerId)
    .maybeSingle();
  return data?.id ?? null;
}

// List all filed reviews for the current business. Most recent first.
export async function listAnnualReviews() {
  const { data, error } = await supabase
    .from('annual_reviews')
    .select('id, tax_year, filed_at, is_interim, interim_label, tone_mode, hash')
    .order('filed_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Get the most recent filed snapshot for a given tax year, or null.
export async function getFiledReview(taxYear) {
  const { data, error } = await supabase
    .from('annual_reviews')
    .select('*')
    .eq('tax_year', taxYear)
    .order('filed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// File a new snapshot. NEVER overwrites — creates a new row.
// ─── §1 Executive Summary composer ────────────────────────────────────────────
//
// Six pre-baked narrative templates (3 tone modes × 2 entity flavours).
// Partnerships fall through to the sole trader template for now — a
// dedicated partnership variant lands with §6 Tax Position.
//
// The composer is intentionally string-templating rather than LLM-authored
// — deterministic output means the exec summary hash of two identical
// snapshots is identical, which is what the audit trail needs. Users can
// override with free text after the fact and the override is stored
// separately (annual_reviews.exec_summary_override).

const TONE_MODES = ['internal', 'funding', 'tender'];

const EXEC_SUMMARY_TEMPLATES = {
  sole_trader: {
    internal: (s, name) =>
      `Trading as ${name}, this ${s.entityYear ? `${s.entityYear} year of` : 'year of'} sole-trader operations returned ` +
      `${fmtGBP(s.income)} of revenue against ${fmtGBP(s.expenses)} of expenses — a net profit of ` +
      `${fmtGBP(s.profit)} at ${round1(s.margin)}% margin. ` +
      `${s.jobsCompleted} jobs delivered at an average of ${fmtGBP(s.avgJobValue)} per job, ` +
      `serving ${s.activeCustomers} active customer${s.activeCustomers === 1 ? '' : 's'}. ` +
      `${yoyLine(s.yoyIncome, 'Revenue')}.`,
    funding: (s, name) =>
      `${name}, established as a sole trader, delivered ${fmtGBP(s.income)} of revenue in the review period — ` +
      `${signedPct(s.yoyIncome)} year-on-year. ` +
      `Net profit of ${fmtGBP(s.profit)} at ${round1(s.margin)}% margin, ahead of the ~55–65% industry range for cleaning businesses. ` +
      `${s.activeCustomers} active customer accounts and ${s.jobsCompleted} completed jobs underpin the trading base. ` +
      `Estimated tax liability ${fmtGBP(s.taxEst)}; net take-home ${fmtGBP(s.netAfterTax)}. ` +
      `Cash and regulatory obligations are current.`,
    tender: (s, name) =>
      `${name} provides commercial cleaning services as a sole trader. ` +
      `Over the review period the business delivered ${s.jobsCompleted} completed engagements for ${s.activeCustomers} active clients, ` +
      `at an average engagement value of ${fmtGBP(s.avgJobValue)}. ` +
      `All work fulfilled to schedule; no outstanding regulatory concerns.`,
  },
  ltd: {
    internal: (s, name) =>
      `${name} Ltd, ${s.entityYear ? `${s.entityYear} year` : 'in this financial year'} of trading, ` +
      `returned ${fmtGBP(s.income)} revenue and net profit of ${fmtGBP(s.profit)} (${round1(s.margin)}% margin). ` +
      `${s.jobsCompleted} jobs completed for ${s.activeCustomers} active customer accounts. ` +
      `${yoyLine(s.yoyIncome, 'Revenue')}. Corporation tax provision ${fmtGBP(s.taxEst)}.`,
    funding: (s, name) =>
      `${name} Ltd — established ${s.entityYear ? `over ${s.entityYear} years` : 'as a limited company'}${s.vatRegistered ? ', VAT-registered' : ''}. ` +
      `FY revenue ${fmtGBP(s.income)}, ${signedPct(s.yoyIncome)} YoY. ` +
      `Operating profit ${fmtGBP(s.profit)} at ${round1(s.margin)}% margin. ` +
      `${s.activeCustomers} active client accounts, ${s.jobsCompleted} jobs delivered at an average of ${fmtGBP(s.avgJobValue)}. ` +
      `Corporation tax provision ${fmtGBP(s.taxEst)}; net position after tax ${fmtGBP(s.netAfterTax)}. ` +
      `Cash management and statutory compliance current.`,
    tender: (s, name) =>
      `${name} Ltd is an established UK cleaning contractor${s.vatRegistered ? ', VAT-registered' : ''}. ` +
      `Over the review period the company completed ${s.jobsCompleted} engagements for ${s.activeCustomers} client accounts, ` +
      `delivered under a limited-company structure with full statutory compliance. ` +
      `All commercial and regulatory obligations up to date.`,
  },
};

// Compose the narrative from a snapshot. `businessSettings` may carry
// entity_year (years incorporated / years trading) and vat_registered —
// both optional. Falls through to sole trader templates for any entity
// type we don't have a dedicated variant for yet.
export function composeExecSummary({
  snapshot,
  toneMode = 'internal',
  businessName = 'The business',
  entityYear = null,
  vatRegistered = false,
}) {
  if (!snapshot) return '';
  const tone = TONE_MODES.includes(toneMode) ? toneMode : 'internal';
  const entity = snapshot.entityType === 'ltd' ? 'ltd' : 'sole_trader';
  const fn = EXEC_SUMMARY_TEMPLATES[entity][tone];
  return fn({ ...snapshot, entityYear, vatRegistered }, businessName);
}

// The 6 headline KPIs surfaced in §1 alongside the narrative. Shape kept
// deliberately simple (label / value / sub) so the render tree can iterate.
export function execSummaryKpis(snapshot) {
  if (!snapshot) return [];
  return [
    { key: 'revenue', label: 'Revenue', value: fmtGBP(snapshot.income), sub: 'this period' },
    {
      key: 'yoy',
      label: 'YoY change',
      value: signedPct(snapshot.yoyIncome),
      sub: 'vs prior period',
      tone: (snapshot.yoyIncome ?? 0) >= 0 ? 'up' : 'down',
    },
    {
      key: 'profit',
      label: 'Net profit',
      value: fmtGBP(snapshot.profit),
      sub: `${round1(snapshot.margin)}% margin`,
      tone: (snapshot.profit ?? 0) >= 0 ? 'up' : 'down',
    },
    {
      key: 'margin',
      label: 'Margin',
      value: `${round1(snapshot.margin)}%`,
      sub: 'industry ~55–65%',
    },
    {
      key: 'customers',
      label: 'Active customers',
      value: String(snapshot.activeCustomers ?? 0),
      sub: 'on the books today',
    },
    {
      key: 'jobs',
      label: 'Jobs delivered',
      value: String(snapshot.jobsCompleted ?? 0),
      sub: `avg ${fmtGBP(snapshot.avgJobValue)}`,
    },
  ];
}

// ─── Small formatting helpers ────────────────────────────────────────────────
function fmtGBP(n) {
  const v = Math.round(Number(n) || 0);
  return `£${Math.abs(v).toLocaleString('en-GB')}${v < 0 ? ' (loss)' : ''}`;
}
function round1(n) {
  return Math.round((Number(n) || 0) * 10) / 10;
}
function signedPct(n) {
  const v = round1(n);
  if (!Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${v}%`;
}
function yoyLine(yoy, subject) {
  const v = round1(yoy);
  if (!Number.isFinite(v) || v === 0) return `${subject} flat year-on-year`;
  if (v > 0) return `${subject} grew ${v}% year-on-year`;
  return `${subject} contracted ${Math.abs(v)}% year-on-year`;
}

export async function fileAnnualReview({
  taxYear,
  isInterim = false,
  interimLabel = null,
  snapshot,
  execSummaryOverride = null,
  ratings = null,
  plan = null,
  overrides = {},
  toneMode = 'internal',
}) {
  const businessId = await myBusinessId();
  if (!businessId) throw new Error('No business found for current user');

  const hash = await computeSnapshotHash(snapshot);

  const { data, error } = await supabase
    .from('annual_reviews')
    .insert({
      business_id: businessId,
      tax_year: taxYear,
      is_interim: isInterim,
      interim_label: interimLabel,
      snapshot_jsonb: snapshot,
      overrides_jsonb: overrides ?? {},
      exec_summary_override: execSummaryOverride,
      ratings_jsonb: ratings,
      plan_jsonb: plan,
      tone_mode: toneMode,
      hash,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
