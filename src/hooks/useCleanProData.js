import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { listCustomers } from '../lib/db/customersDb';
import { listMoneyEntries } from '../lib/db/moneyDb';
import { listQuotes } from '../lib/db/quotesDb';
import { getBusinessSettings } from '../lib/db/settingsDb';

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
  if (status === 'accepted') return 'sent';

  const createdAt = quote.created_at ? new Date(quote.created_at) : null;
  if (createdAt) {
    const ageDays = Math.floor((Date.now() - createdAt.getTime()) / 86400000);
    if (ageDays > 14) return 'overdue';
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
  const taxYearStart = startOfTaxYear();
  const ytdEntries = (moneyEntries || []).filter(entry => {
    if (!entry.date) return false;
    return new Date(`${entry.date}T00:00:00`) >= taxYearStart;
  });

  const ytdIncome = ytdEntries
    .filter(entry => entry.kind === 'income')
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0);

  const ytdExpenses = ytdEntries
    .filter(entry => entry.kind === 'expense')
    .reduce((sum, entry) => sum + parseAmount(entry.amount), 0);

  const annualTarget = parseAmount(settings?.annual_target) || 65000;
  const monthlyTarget = annualTarget / 12;
  const taxRate = settings?.tax_rate ?? (settings?.vat_registered ? 0.2 : 0.25);
  const taxReserve = parseAmount(settings?.setup_data?.tax_reserve_saved);
  const taxReserveTarget = ytdIncome * taxRate;

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
  const { jobs: userJobs } = useData();
  const isDemo = user?.id === 'demo-user';
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(user) && !isDemo);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!user || user.id === 'demo-user') {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [settings, quotes, moneyEntries, customers] = await Promise.all([
        getBusinessSettings(),
        listQuotes(250),
        listMoneyEntries(1000),
        listCustomers(250),
      ]);

      const customersById = Object.fromEntries((customers || []).map(customer => [customer.id, customer]));
      const schedulerResult = mapSchedulerData(userJobs, moneyEntries);

      setData({
        accounts: mapAccountsData({ profile, settings, moneyEntries }),
        scheduler: { weekJobs: schedulerResult.weekJobs },
        invoiceData: mapInvoiceData(quotes, customersById),
        jobsToday: schedulerResult.todayJobs,
        teamData: [],
        feedData: mapFeedData({ quotes, moneyEntries, customersById }),
        customerCount: (customers || []).length,
      });
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [profile, user, userJobs]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    accountsData: data?.accounts ?? null,
    schedulerData: data?.scheduler ?? null,
    invoiceData: data?.invoiceData ?? null,
    teamData: data?.teamData ?? null,
    feedData: data?.feedData ?? null,
    jobsToday: data?.jobsToday ?? null,
    customerCount: data?.customerCount ?? 0,
    isLoading,
    error,
    refresh: fetch,
  };
}