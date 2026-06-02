import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { listMoneyEntries } from '../lib/db/moneyDb';
import { listQuotes } from '../lib/db/quotesDb';
import { getBusinessSettings } from '../lib/db/settingsDb';

// ─── Module-level TTL cache ───────────────────────────────────────────────────
// Survives component unmount (tab navigation) so re-visiting the dashboard
// within the TTL window fires zero DB queries. Keyed by user ID.
const DB_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const _dbCache = {}; // { [userId]: { ts, settings, quotes, moneyEntries, profile } }

function isoToday() {
  return new Date().toISOString().split('T')[0];
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// UK self-employed tax (2025/26 rates) — mirrors MoneyTracker.jsx calcSelfEmployedTax
function calcSelfEmployedTax(profit) {
  const PA = 12570; const BRT = 50270; const BR = 0.20; const HR = 0.40;
  const NI_LOW = 0.06; const NI_HIGH = 0.02;
  const taxable = Math.max(profit - PA, 0);
  const incomeTax = taxable <= (BRT - PA)
    ? taxable * BR
    : (BRT - PA) * BR + (taxable - (BRT - PA)) * HR;
  const niBase = taxable;
  const ni = niBase <= (BRT - PA)
    ? niBase * NI_LOW
    : (BRT - PA) * NI_LOW + (niBase - (BRT - PA)) * NI_HIGH;
  return Math.round(incomeTax + ni);
}

// UK corporation tax (FY2023+ rates with marginal relief £50k–£250k)
function calcCorpTax(profit) {
  if (profit <= 0)      return 0;
  if (profit <= 50000)  return Math.round(profit * 0.19);
  if (profit >= 250000) return Math.round(profit * 0.25);
  return Math.round(profit * 0.265 - 3750); // marginal relief band
}

function startOfTaxYear() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(`${year}-04-06T00:00:00`);
}

function formatIsoDate(date) {
  return date.toISOString().split('T')[0];
}

function dayLabel(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'short' });
}

function parseAmount(value) {
  return Number.parseFloat(value || 0) || 0;
}

function inferInvoiceStatus(quote) {
  const status = (quote.status || '').toLowerCase();
  if (status === 'paid') return 'paid';
  if (status === 'draft') return 'draft';

  // Only flag overdue when payment was actually expected (sent/accepted/invoiced states)
  const paymentExpected = status === 'accepted' || status === 'sent' || status === 'invoiced' || status === '';

  if (paymentExpected) {
    // Prefer an explicit due_date stored in the jsonb payload; fall back to
    // 30 days from created_at (UK standard net-30 terms) rather than 14.
    const payload = quote.payload || {};
    const dueDateStr = payload.due_date || null;
    const termsGrace = (payload.payment_terms > 0 ? payload.payment_terms : 30) * 86400000;
    const refDate = dueDateStr
      ? new Date(dueDateStr).getTime()
      : (quote.created_at ? new Date(quote.created_at).getTime() + termsGrace : null);

    if (refDate && Date.now() > refDate) return 'overdue';
  }

  return 'sent';
}

function getQuoteCustomerName(quote, customersById) {
  if (quote.customer_id && customersById[quote.customer_id]?.name) return customersById[quote.customer_id].name;
  if (quote.payload?.customer) return quote.payload.customer;
  if (quote.job_label) return quote.job_label;
  return 'Customer';
}

function mapAccountsData({ profile, settings, moneyEntries }) {
  // moneyEntries is already filtered to the current tax year at the DB level
  const ytdEntries = moneyEntries || [];

  const ytdIncome = ytdEntries
    .filter(entry => entry.kind === 'income')
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0);

  const ytdExpenses = ytdEntries
    .filter(entry => entry.kind === 'expense')
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0);

  const annualTarget   = parseAmount(settings?.annual_target) || 65000;
  const monthlyTarget  = annualTarget / 12;
  const taxRate        = settings?.tax_rate ?? (settings?.vat_registered ? 0.2 : 0.25);
  const taxReserve     = parseAmount(settings?.setup_data?.tax_reserve_saved);
  const ytdProfit      = Math.max(ytdIncome - ytdExpenses, 0);
  const entityType     = settings?.entity_type ?? 'sole_trader';
  const dirSalary      = parseAmount(settings?.director_salary_annual ?? 9100);
  // Tax reserve target branches on entity type
  const taxReserveTarget = entityType === 'limited_company'
    ? calcCorpTax(Math.max(0, ytdProfit - dirSalary))
    : calcSelfEmployedTax(ytdProfit);

  return {
    vatRegistered: Boolean(settings?.vat_registered),
    vatScheme: settings?.vat_registered ? settings?.setup_data?.vat_scheme || null : null,
    taxRate,
    annualTarget,
    monthlyTarget,
    ytdIncome,
    ytdExpenses,
    taxReserve,
    taxReserveTarget,
    entityType,
    accountingYearEndMonth: settings?.accounting_year_end_month ?? 3,
    directorSalaryAnnual:   dirSalary,
    ytdMileageLogged: parseAmount(settings?.setup_data?.ytd_mileage_logged),
    ytdMileageClaimed: parseAmount(settings?.setup_data?.ytd_mileage_claimed),
    mtdStatus: settings?.setup_data?.mtd_status || 'filed',
    mtdDaysLeft: Number(settings?.setup_data?.mtd_days_left || 0),
    sprintActive: Boolean(settings?.setup_data?.sprint_active),
    businessStructure: profile?.biz_structure || 'sole_trader',
    teamStructure: profile?.team_structure || 'solo',
    edition: profile?.cleaner_type || 'residential',
  };
}

function mapSchedulerData(userJobs, moneyEntries) {
  const monday = startOfWeek();
  const today = isoToday();

  // Build a revenue map from money_entries (income) by date
  const revenueByDate = {};
  (moneyEntries || []).forEach(entry => {
    if (entry.kind === 'income' && entry.date) {
      revenueByDate[entry.date] = (revenueByDate[entry.date] || 0) + parseAmount(entry.amount);
    }
  });

  // Build a jobs-per-date map from user jobs
  const jobsByDate = {};
  (userJobs || []).forEach(job => {
    if (job.date) {
      if (!jobsByDate[job.date]) jobsByDate[job.date] = [];
      jobsByDate[job.date].push(job);
    }
  });

  const weekJobs = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    const isoDate = formatIsoDate(date);
    const dateJobs = jobsByDate[isoDate] || [];
    const jobRevenue = dateJobs.reduce((sum, j) => sum + parseAmount(j.price), 0);
    const entryRevenue = revenueByDate[isoDate] || 0;
    const revenue = jobRevenue > 0 ? jobRevenue : entryRevenue;
    const isPast = isoDate < today;

    return {
      day: dayLabel(date),
      date: date.getDate(),
      isoDate,
      revenue,
      jobs: dateJobs.length,
      done: isPast && dateJobs.length > 0,
      isToday: isoDate === today,
    };
  });

  // Today's jobs — full detail for the Dashboard
  const todayJobs = (jobsByDate[today] || []).map(job => ({
    id: job.id,
    customer: job.customer || 'Customer',
    type: job.type || 'residential',
    postcode: job.postcode || '',
    service: job.service || 'Clean',
    time: job.startHour != null
      ? `${Math.floor(job.startHour) % 12 || 12}:${job.startHour % 1 === 0 ? '00' : '30'}${job.startHour < 12 ? 'am' : 'pm'}`
      : '',
    price: parseAmount(job.price),
    status: job.status || 'scheduled',
    assignee: job.assignee || 'You',
  }));

  return { weekJobs, todayJobs };
}

function mapInvoiceData(quotes, customersById) {
  return (quotes || []).map(quote => {
    const status = inferInvoiceStatus(quote);
    const createdAt = quote.created_at ? new Date(quote.created_at) : null;
    const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0;
    return {
      id: quote.id,
      customer: getQuoteCustomerName(quote, customersById),
      amount: parseAmount(quote.price),
      daysOverdue: status === 'overdue' ? Math.max(0, ageDays - 14) : 0,
      status,
    };
  });
}

function mapFeedData({ quotes, moneyEntries, customersById }) {
  const quoteFeed = (quotes || []).slice(0, 5).map(quote => ({
    id: `quote-${quote.id}`,
    icon: inferInvoiceStatus(quote) === 'paid' ? '💷' : '📤',
    bg: inferInvoiceStatus(quote) === 'paid' ? 'bg-emerald-100' : 'bg-blue-100',
    title: `${inferInvoiceStatus(quote) === 'paid' ? 'Payment received' : 'Quote updated'} — ${getQuoteCustomerName(quote, customersById)}`,
    sub: `£${parseAmount(quote.price).toFixed(0)} · ${quote.type || 'service'} · ${quote.status || 'draft'}`,
    time: quote.updated_at
      ? new Date(quote.updated_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
      : '—',
    _sort: new Date(quote.updated_at || quote.created_at || 0).getTime(),
  }));

  const moneyFeed = (moneyEntries || []).slice(0, 5).map(entry => ({
    id: `money-${entry.id}`,
    icon: entry.kind === 'income' ? '💷' : '🧾',
    bg: entry.kind === 'income' ? 'bg-emerald-100' : 'bg-amber-100',
    title: `${entry.kind === 'income' ? 'Income logged' : 'Expense logged'} — ${entry.client || 'Business'}`,
    sub: `£${parseAmount(entry.amount).toFixed(0)} · ${entry.method || entry.kind}`,
    time: entry.date
      ? new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : '—',
    _sort: new Date(entry.date || 0).getTime(),
  }));

  return [...quoteFeed, ...moneyFeed]
    .sort((a, b) => b._sort - a._sort)
    .slice(0, 8)
    .map(({ _sort, ...item }) => item);
}

export function useCleanProData() {
  const { user, profile } = useAuth();
  const { jobs: userJobs, customers: liveCustomers } = useData();
  const isDemo = user?.id === 'demo-user';
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(user) && !isDemo);
  const [error, setError] = useState(null);

  // Capture the specific profile scalars that affect data mapping so that
  // minor profile writes (e.g. dashboard_tour_complete) don't trigger a refetch.
  const profileBizStructure  = profile?.biz_structure;
  const profileCleanerType   = profile?.cleaner_type;
  const profileTeamStructure = profile?.team_structure;

  const fetch = useCallback(async ({ bust = false } = {}) => {
    if (!user || user.id === 'demo-user') {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const cacheKey = user.id;
    const cached = _dbCache[cacheKey];
    const cacheValid = !bust && cached && (Date.now() - cached.ts) < DB_CACHE_TTL;

    if (cacheValid) {
      // Re-derive scheduler and jobsToday from live DataContext jobs so the
      // dashboard stays current when jobs are added — zero extra DB queries.
      const customersById = Object.fromEntries((liveCustomers || []).map(c => [c.id, c]));
      const schedulerResult = mapSchedulerData(userJobs, cached.moneyEntries);
      setData({
        accounts: mapAccountsData({ profile, settings: cached.settings, moneyEntries: cached.moneyEntries }),
        scheduler: { weekJobs: schedulerResult.weekJobs },
        invoiceData: mapInvoiceData(cached.quotes, customersById),
        jobsToday: schedulerResult.todayJobs,
        teamData: [],
        feedData: mapFeedData({ quotes: cached.quotes, moneyEntries: cached.moneyEntries, customersById }),
        customerCount: (liveCustomers || []).length,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const taxYearFrom = formatIsoDate(startOfTaxYear());
      const [settings, quotes, moneyEntries] = await Promise.all([
        getBusinessSettings(),
        listQuotes(250),
        listMoneyEntries({ from: taxYearFrom, pageSize: 500 }),
      ]);

      // Store raw DB results in the module cache
      _dbCache[cacheKey] = { ts: Date.now(), settings, quotes, moneyEntries };

      // Use already-loaded context customers (up to 1000) — avoids a duplicate fetch
      const customersById = Object.fromEntries((liveCustomers || []).map(c => [c.id, c]));
      const schedulerResult = mapSchedulerData(userJobs, moneyEntries);

      setData({
        accounts: mapAccountsData({ profile, settings, moneyEntries }),
        scheduler: { weekJobs: schedulerResult.weekJobs },
        invoiceData: mapInvoiceData(quotes, customersById),
        jobsToday: schedulerResult.todayJobs,
        teamData: [],
        feedData: mapFeedData({ quotes, moneyEntries, customersById }),
        customerCount: (liveCustomers || []).length,
      });
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profileBizStructure, profileCleanerType, profileTeamStructure, userJobs]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Exposed refresh busts the cache so the retry button and manual refreshes
  // always get a fresh read from the DB.
  const refresh = useCallback(() => {
    if (user?.id) delete _dbCache[user.id];
    fetch({ bust: true });
  }, [user?.id, fetch]);

  return {
    accountsData: data?.accounts ?? null,
    schedulerData: data?.scheduler ?? null,
    invoiceData: data?.invoiceData ?? null,
    teamData: data?.teamData ?? null,
    feedData: data?.feedData ?? null,
    jobsToday: data?.jobsToday ?? null,
    customerCount: liveCustomers?.length ?? 0,
    isLoading,
    error,
    refresh,
  };
}