// src/components/DashboardTab.jsx
// Cadi — Main Dashboard (B + C combo)
//
// The first screen opened every morning. Designed to be habit-forming.
//
// Architecture:
//   The screen has two modes that switch with a single toggle:
//     SOLO    — the default solo-trader morning check-in view
//     TEAM    — the dense command-centre layout for team meetings
//
//   Both modes share the same data and health score engine.
//   The toggle lives in the header — one tap switches the entire layout.
//
// What's in the component:
//
//   Header           — greeting (time-aware), date/week, live indicator, mode toggle
//
//   Health score     — animated 0–100 ring, 5-dimension breakdown bars, tier label,
//                      delta vs yesterday, "fix N alerts to hit next tier" prompt
//
//   KPI strip        — 6 live numbers: today's revenue, week revenue, month revenue,
//                      outstanding invoices, jobs today, tax reserve %
//
//   Priority actions — up to 4 alerts ordered by impact, each showing +pts gain,
//                      colour-coded red/amber/blue, deep-link into the relevant tab
//
//   Week grid        — Mon–Sun revenue bars + job count, today highlighted in navy,
//                      done days in emerald, future days muted
//
//   Team panel       — (team mode only) staff avatars, current job, active/idle status,
//                      unassigned jobs that need filling
//
//   Activity feed    — real-time log of events: payment received, invoice sent,
//                      job completed, alert triggered, mileage logged
//
//   Quick actions    — 4 primary actions: log payment, send reminder, open accounts,
//                      open route — all deep-link into the relevant tab
//
//   YTD target bar   — annual income progress with Q markers and monthly pace insight
//
// Health score algorithm (transparent — users can see exactly how it's calculated):
//   Revenue     (25pts) — week on target + month on target + YTD pacing
//   Operations  (25pts) — jobs logged + route planned + schedule full
//   Invoicing   (25pts) — all invoices sent same-day + no overdue + avg payment days
//   Compliance  (15pts) — MTD submissions filed + mileage log current + tax reserve %
//   Growth      (10pts) — new client this month + sprint active + YoY income up
//
// Props:
//   accountsData    — live from useAccountsData hook
//   schedulerData   — jobs array from SchedulerTab { weekJobs: [...] }
//   invoiceData     — invoices array from InvoiceTab
//   onNavigate(tab) — deep-link into any tab
//
// Usage:
//   import DashboardTab from './components/DashboardTab'
//   <DashboardTab accountsData={accountsData} onNavigate={setActiveTab} />

import { useState, useMemo, useEffect, useRef } from "react";
import { useCountUp } from "../hooks/useCountUp";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";
import { useCleanProData } from "../hooks/useCleanProData";
import { supabase } from "../lib/supabase";
import { createMoneyEntry } from "../lib/db/moneyDb";
import { listOpenMarketplaceListings } from "../lib/db/connectDb";
import { listLeaderboard, upsertMyEntry, deleteMyEntry } from "../lib/db/leaderboardDb";
import AskCadi from "../components/AskCadi";
import CadiWordmark from "../components/CadiWordmark";
import SpotlightTour from "../components/SpotlightTour";
import LeaderboardPanel, { LEADERBOARD_DEMO } from "../components/dashboard/LeaderboardPanel";
import ShareCardModal from "../components/dashboard/ShareCardModal";
import MobileDashboard from "../components/dashboard/MobileDashboard";
import Onboarding from "./Onboarding";
import ThirtyDayPlan from "../components/ThirtyDayPlan";
import { usePlan, PRO_TABS } from "../hooks/usePlan";
import { UpgradeModal, UpgradeSuccessModal } from "../components/UpgradePrompt";

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_ACCOUNTS = {
  vatRegistered:       false,
  taxRate:             0.20,
  annualTarget:        65000,
  ytdIncome:           41820,
  ytdExpenses:         8340,
  taxReserve:          4260,
  taxReserveTarget:    5118,
  monthlyTarget:       5000,
  ytdMileageLogged:    4820,
  ytdMileageClaimed:   4820,
  mtdStatus:           "due",   // "filed" | "due" | "overdue"
  mtdDaysLeft:         22,
  sprintActive:        false,
};

const DEMO_WEEK = [
  { day: "Mon", date: 6,  revenue: 380,  jobs: 4, done: true            },
  { day: "Tue", date: 7,  revenue: 460,  jobs: 3, done: false, isToday: true },
  { day: "Wed", date: 8,  revenue: 220,  jobs: 2, done: false            },
  { day: "Thu", date: 9,  revenue: 180,  jobs: 2, done: false            },
  { day: "Fri", date: 10, revenue: 0,    jobs: 0, done: false            },
  { day: "Sat", date: 11, revenue: 0,    jobs: 0, done: false            },
  { day: "Sun", date: 12, revenue: 0,    jobs: 0, done: false            },
];

const DEMO_JOBS_TODAY = [
  { id: 1, customer: "Johnson",           type: "residential", postcode: "SW4", service: "Regular clean",      time: "8:00am",  price: 60,  status: "complete",    assignee: "You"   },
  { id: 2, customer: "Greenfield Office", type: "commercial",  postcode: "SW6", service: "Weekly office clean", time: "9:30am",  price: 120, status: "in-progress", assignee: "You"   },
  { id: 3, customer: "Davies",            type: "residential", postcode: "SW2", service: "Deep clean",          time: "11:00am", price: 80,  status: "scheduled",   assignee: "You"   },
  { id: 4, customer: "Harrington",        type: "exterior",    postcode: "SW9", service: "Gutters & fascias",   time: "1:00pm",  price: 85,  status: "unassigned",  assignee: null    },
  { id: 5, customer: "Park View Flats",   type: "commercial",  postcode: "SE1", service: "Common areas",        time: "3:00pm",  price: 95,  status: "scheduled",   assignee: "You"   },
];

const DEMO_TEAM = [
  { id: "you",   initials: "SM", name: "Sarah (you)", job: "Greenfield Office · SW6", status: "active", color: "bg-brand-navy text-brand-skyblue" },
  { id: "jamie", initials: "JT", name: "Jamie",        job: "Window round · W8",       status: "active", color: "bg-emerald-100 text-emerald-800"   },
];

const DEMO_INVOICES = [
  { id: "i1", customer: "Harrington",      amount: 85,  daysOverdue: 3, status: "overdue"  },
  { id: "i2", customer: "Park View Flats", amount: 95,  daysOverdue: 0, status: "sent"     },
  { id: "i3", customer: "Wilson",          amount: 65,  daysOverdue: 0, status: "sent"     },
];

const DEMO_FEED = [
  { id: 1, icon: "✓",  bg: "bg-emerald-100",  title: "Johnson — regular clean complete",  sub: "£60 · SW4 · marked done",             time: "08:42" },
  { id: 2, icon: "📤", bg: "bg-blue-100",      title: "Invoice sent — Park View Flats",    sub: "£95 · due 13 Apr",                    time: "08:00" },
  { id: 3, icon: "💷", bg: "bg-emerald-100",   title: "Payment received — Miller",         sub: "£280 · bank transfer",                time: "07:15" },
  { id: 4, icon: "!",  bg: "bg-red-100",       title: "Harrington invoice overdue",        sub: "£85 · 3 days past due",               time: "Auto"  },
  { id: 5, icon: "🚐", bg: "bg-amber-100",     title: "Route logged — 18.4 miles",         sub: "£8.28 HMRC claim · 5 stops",          time: "Yest." },
];

// Deterministic demo money entries — 90 days of believable cleaner income so
// the Money Confidence hero looks alive in demo mode / screenshots.
const DEMO_MONEY_ENTRIES = (() => {
  const out = [];
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0) continue; // Sundays off
    const base = dow === 6 ? 140 : 280;
    const wobble = ((i * 37) % 120) - 60;
    const iso = d.toISOString().split('T')[0];
    out.push({ id: `demo-inc-${i}`, kind: 'income', amount: Math.max(80, base + wobble), date: iso });
    if (i % 4 === 0) out.push({ id: `demo-exp-${i}`, kind: 'expense', amount: 35 + ((i * 13) % 45), date: iso });
  }
  return out;
})();

// ─── Health score engine ──────────────────────────────────────────────────────
// Fully transparent — every point source is labelled
// Max: Revenue 25 + Operations 25 + Invoicing 25 + Compliance 15 + Growth 10 = 100

function calcHealthScore({ accounts, weekJobs, invoices, jobsToday }) {
  const overdueInvoices = invoices.filter(i => i.status === "overdue");
  const weekRevenue     = weekJobs.filter(d => d.done || d.isToday).reduce((s,d) => s+d.revenue, 0);
  const weekTarget      = weekJobs.reduce((s,d) => s+d.revenue, 0);
  const monthProgress   = accounts.ytdIncome > 0 ? Math.min((accounts.ytdIncome / accounts.annualTarget) * 12, 1) : 0;

  // ── Revenue (25pts) ──────────────────────────────────────────────────────
  const weekOnTrack  = weekTarget > 0 ? Math.min(weekRevenue / weekTarget, 1) : 0;
  const ytdOnTrack   = accounts.annualTarget > 0 ? Math.min(accounts.ytdIncome / (accounts.annualTarget * (4/12)), 1) : 0; // 4 months in
  const revScore     = Math.round((weekOnTrack * 12) + (ytdOnTrack * 13));

  // ── Operations (25pts) ───────────────────────────────────────────────────
  const jobsDone     = weekJobs.filter(d => d.done).length;
  const jobsTotal    = weekJobs.filter(d => d.done || d.isToday).length;
  // Empty-account guard: when the user has zero jobs scheduled, treat ops as 0 — NOT 1 (which
  // inflated empty-account scores to 61/100 "Solid"). Real ops score only when there's data.
  const jobsLogged   = jobsTotal > 0 ? (jobsDone / jobsTotal) : 0;
  const unassigned   = jobsToday.filter(j => j.status === "unassigned").length;
  const opsScore     = Math.round((jobsLogged * 18) + (unassigned === 0 ? 7 : Math.max(0, 7 - unassigned*2)));

  // ── Invoicing (25pts) ────────────────────────────────────────────────────
  const overdueCount    = overdueInvoices.length;
  const totalUnpaid     = invoices.filter(i => i.status !== "paid").length;
  const invoicingScore  = Math.max(0, 25 - (overdueCount * 12) - (totalUnpaid > 3 ? 5 : 0));

  // ── Compliance (15pts) ───────────────────────────────────────────────────
  const taxReservePct  = accounts.taxReserveTarget > 0 ? Math.min(1, accounts.taxReserve / accounts.taxReserveTarget) : 0;
  const mileageOk      = accounts.ytdMileageClaimed >= accounts.ytdMileageLogged * 0.9;
  const mtdOk          = accounts.mtdStatus === "filed";
  const complianceScore= Math.round((taxReservePct * 7) + (mileageOk ? 4 : 0) + (mtdOk ? 4 : 0));

  // ── Growth (10pts) ────────────────────────────────────────────────────────
  const growthScore    = Math.min(10, (accounts.sprintActive ? 4 : 0) + (monthProgress > 0.5 ? 6 : 3));

  const total = Math.min(100, revScore + opsScore + invoicingScore + complianceScore + growthScore);
  const dims  = [
    { label: "Revenue",    score: revScore,          max: 25, color: "bg-brand-blue"   },
    { label: "Operations", score: opsScore,           max: 25, color: "bg-emerald-500"  },
    { label: "Invoicing",  score: invoicingScore,     max: 25, color: overdueCount > 0 ? "bg-amber-400" : "bg-emerald-500" },
    { label: "Compliance", score: complianceScore,    max: 15, color: complianceScore < 10 ? "bg-amber-400" : "bg-emerald-500" },
    { label: "Growth",     score: growthScore,        max: 10, color: "bg-brand-blue"   },
  ];

  const tier     = total >= 90 ? "Elite" : total >= 75 ? "Firing" : total >= 60 ? "Solid" : total >= 40 ? "Building" : "Getting Started";
  const tierNext = total >= 90 ? null : total >= 75 ? 90 : total >= 60 ? 75 : total >= 40 ? 60 : 40;
  const tierColor = total >= 90 ? "text-violet-300" : total >= 75 ? "text-emerald-400" : total >= 60 ? "text-sky-300" : total >= 40 ? "text-amber-400" : "text-red-400";

  return { total, dims, tier, tierNext, tierColor, revScore, opsScore, invoicingScore, complianceScore, growthScore };
}

// ─── Priority actions engine ───────────────────────────────────────────────────
function buildActions({ accounts, invoices, jobsToday, score }) {
  const actions = [];
  const overdueInvs = invoices.filter(i => i.status === "overdue");

  overdueInvs.forEach(inv => actions.push({
    level:   "red",
    icon:    "🔴",
    title:   `Chase ${inv.customer} — £${inv.amount} overdue`,
    body:    `${inv.daysOverdue} day${inv.daysOverdue>1?"s":""} past due · customer hasn't paid`,
    pts:     12,
    tab:     "invoices",
    action:  "Send reminder →",
  }));

  if (accounts.taxReserve < accounts.taxReserveTarget) {
    const shortfall = accounts.taxReserveTarget - accounts.taxReserve;
    actions.push({
      level:  "amber",
      icon:   "🟡",
      title:  `Tax reserve £${Math.round(shortfall).toLocaleString()} short`,
      body:   `£${accounts.taxReserve.toLocaleString()} saved of £${accounts.taxReserveTarget.toLocaleString()} needed`,
      pts:    8,
      tab:    "money",
      action: "Top up →",
    });
  }

  if (accounts.mtdStatus !== "filed" && accounts.mtdDaysLeft <= 30) {
    actions.push({
      level:  "amber",
      icon:   "🟡",
      title:  `Q3 MTD submission due in ${accounts.mtdDaysLeft} days`,
      body:   "All income logged — ready to review and submit",
      pts:    10,
      tab:    "accounts",
      action: "Review →",
    });
  }

  const unassignedJobs = jobsToday.filter(j => j.status === "unassigned");
  if (unassignedJobs.length > 0) {
    actions.push({
      level:  "amber",
      icon:   "🟡",
      title:  `${unassignedJobs.length} job${unassignedJobs.length>1?"s":""} unassigned today`,
      body:   unassignedJobs.map(j => `${j.customer} · ${j.time}`).join(" · "),
      pts:    7,
      tab:    "scheduler",
      action: "Assign →",
    });
  }

  if (actions.length === 0) {
    actions.push({
      level:  "green",
      icon:   "🟢",
      title:  "All clear — business running smoothly",
      body:   "No urgent actions needed. Focus on today's jobs.",
      pts:    0,
      tab:    null,
      action: null,
    });
  }

  return actions.slice(0, 4);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const fmt2  = n => `£${Math.abs(+n).toFixed(2)}`;
const pct   = n => `${Math.round(+n)}%`;

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function getCurrentTaxYear() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${(year + 1).toString().slice(2)}`;
}

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function getTaxYearMonth() {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // Tax year starts April (month 3)
  return month >= 3 ? month - 3 + 1 : month + 9 + 1; // 1-indexed month of tax year
}

function getTaxYearMonthsLeft() {
  return 12 - getTaxYearMonth();
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) =>
  <div className={`bg-white border border-gray-200 rounded-sm ${className}`}>{children}</div>;

const SL = ({ children, className = "" }) =>
  <p className={`text-xs font-bold tracking-widest uppercase text-gray-400 ${className}`}>{children}</p>;

function Chip({ children, color = "blue" }) {
  const s = {
    blue:   "bg-blue-50 text-brand-blue border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn:   "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    navy:   "bg-brand-navy text-white border-brand-navy",
    sky:    "bg-brand-skyblue/20 text-brand-navy border-brand-skyblue",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${s[color]}`}>{children}</span>;
}

// ─── Money Confidence hero ─────────────────────────────────────────────────────
// Front-of-stage. One glance answers: what came in, what went out, what I kept,
// and am I on pace — switchable between today / this week / this month.
const DASH_CARD_BG = 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)';

function isoOf(d) { return d.toISOString().split('T')[0]; }
function mondayOf(d) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  r.setHours(0, 0, 0, 0);
  return r;
}

function buildMoneyView(entries, period) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const income = {}; const expense = {};
  (entries || []).forEach(e => {
    const amt = Number(e.amount) || 0;
    if (!e.date) return;
    if (e.kind === 'income') income[e.date] = (income[e.date] || 0) + amt;
    else if (e.kind === 'expense') expense[e.date] = (expense[e.date] || 0) + amt;
  });
  const sumRange = (map, from, to) => {
    const f = isoOf(from), t = isoOf(to);
    let s = 0;
    for (const [d, v] of Object.entries(map)) if (d >= f && d <= t) s += v;
    return s;
  };

  if (period === 'day') {
    const bars = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      bars.push({
        label: d.toLocaleDateString('en-GB', { weekday: 'narrow' }),
        full: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        value: income[isoOf(d)] || 0,
        current: i === 0,
      });
    }
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    return {
      compareLabel: 'yesterday',
      chartLabel: 'Last 14 days',
      moneyIn: income[isoOf(today)] || 0,
      prevIn: income[isoOf(yesterday)] || 0,
      moneyOut: expense[isoOf(today)] || 0,
      bars,
    };
  }

  if (period === 'week') {
    const thisMon = mondayOf(today);
    const bars = [];
    for (let i = 7; i >= 0; i--) {
      const from = new Date(thisMon); from.setDate(from.getDate() - i * 7);
      const to = new Date(from); to.setDate(to.getDate() + 6);
      bars.push({
        label: `${from.getDate()}/${from.getMonth() + 1}`,
        full: `w/c ${from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        value: sumRange(income, from, to),
        current: i === 0,
      });
    }
    const prevMon = new Date(thisMon); prevMon.setDate(prevMon.getDate() - 7);
    const prevSun = new Date(thisMon); prevSun.setDate(prevSun.getDate() - 1);
    const weekEnd = new Date(thisMon); weekEnd.setDate(weekEnd.getDate() + 6);
    return {
      compareLabel: 'last week',
      chartLabel: 'Last 8 weeks',
      moneyIn: sumRange(income, thisMon, weekEnd),
      prevIn: sumRange(income, prevMon, prevSun),
      moneyOut: sumRange(expense, thisMon, weekEnd),
      bars,
    };
  }

  // month — every month of the current tax year so far (Apr → now)
  const nowY = today.getFullYear(); const nowM = today.getMonth();
  const taxY = nowM >= 3 ? nowY : nowY - 1;
  const bars = [];
  for (let y = taxY, m = 3; y < nowY || (y === nowY && m <= nowM); m++) {
    if (m > 11) { m = 0; y++; }
    const from = new Date(y, m, 1); const to = new Date(y, m + 1, 0);
    bars.push({
      label: from.toLocaleDateString('en-GB', { month: 'short' }),
      full: from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      value: sumRange(income, from, to),
      current: y === nowY && m === nowM,
    });
    if (y === nowY && m === nowM) break;
  }
  const cur = { from: new Date(nowY, nowM, 1), to: new Date(nowY, nowM + 1, 0) };
  const prv = { from: new Date(nowY, nowM - 1, 1), to: new Date(nowY, nowM, 0) };
  return {
    compareLabel: 'last month',
    chartLabel: 'This tax year',
    moneyIn: sumRange(income, cur.from, cur.to),
    prevIn: sumRange(income, prv.from, prv.to),
    moneyOut: sumRange(expense, cur.from, cur.to),
    bars,
  };
}

const MONEY_PERIODS = [
  { id: 'day',   label: 'Today' },
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
];

function MoneyConfidenceHero({ entries, accounts, invoices, onLogPayment, onNavigate, onSetTarget, isLive }) {
  const [period, setPeriod] = useState('week');
  const view = useMemo(() => buildMoneyView(entries, period), [entries, period]);
  const moneyInAnim = useCountUp(Math.round(view.moneyIn), 1400);
  const kept = view.moneyIn - view.moneyOut;
  const delta = view.prevIn > 0 ? Math.round(((view.moneyIn - view.prevIn) / view.prevIn) * 100) : null;

  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);

  // Period target derived from the annual target
  const target = period === 'month'
    ? accounts.monthlyTarget
    : period === 'week'
      ? (accounts.annualTarget || 0) / 52
      : (accounts.annualTarget || 0) / 365;
  const targetPct = target > 0 ? Math.min(100, Math.round((view.moneyIn / target) * 100)) : null;

  // Confidence strip
  const unpaid       = invoices.filter(i => i.status !== 'paid' && i.status !== 'draft');
  const outstanding  = unpaid.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const overdue      = invoices.filter(i => i.status === 'overdue');
  const overdueTotal = overdue.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const taxPct       = accounts.taxReserveTarget > 0 ? Math.round((accounts.taxReserve / accounts.taxReserveTarget) * 100) : null;

  // YTD pace — projected full-year income at the current run rate
  const now = new Date();
  const taxStart = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 6);
  const daysIn = Math.max(1, Math.round((now - taxStart) / 86400000));
  const projected = Math.round((accounts.ytdIncome / daysIn) * 365);
  const ytdPct = accounts.annualTarget > 0 ? Math.min(100, Math.round((accounts.ytdIncome / accounts.annualTarget) * 100)) : 0;
  const paceAhead = accounts.annualTarget > 0 ? projected >= accounts.annualTarget : null;

  const maxBar = Math.max(...view.bars.map(b => b.value), 1);
  const hasAny = (entries || []).length > 0;

  const chip = (tone) => ({
    good:  { text: 'text-emerald-300', dot: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]' },
    warn:  { text: 'text-amber-300',   dot: 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]'  },
    bad:   { text: 'text-red-300',     dot: 'bg-red-400 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]'     },
    idle:  { text: 'text-[rgba(153,197,255,0.6)]', dot: 'bg-[rgba(153,197,255,0.3)]' },
  }[tone]);

  const confidence = [
    {
      label: 'Outstanding',
      value: fmt(outstanding),
      sub: outstanding > 0 ? `${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}` : 'All collected',
      tone: outstanding > 0 ? 'warn' : 'good',
      tab: 'invoices',
    },
    {
      label: 'Overdue',
      value: overdue.length > 0 ? fmt(overdueTotal) : 'None',
      sub: overdue.length > 0 ? `${overdue.length} need${overdue.length === 1 ? 's' : ''} chasing` : 'Nothing past due',
      tone: overdue.length > 0 ? 'bad' : 'good',
      tab: 'invoices',
    },
    {
      label: 'Tax reserve',
      value: taxPct == null ? '—' : `${Math.min(999, taxPct)}%`,
      sub: taxPct == null ? 'No tax due yet' : taxPct >= 100 ? 'Fully covered' : `${fmt(Math.max(0, accounts.taxReserveTarget - accounts.taxReserve))} to go`,
      tone: taxPct == null ? 'idle' : taxPct >= 100 ? 'good' : taxPct >= 70 ? 'warn' : 'bad',
      tab: 'money',
    },
    {
      label: 'Year pace',
      value: fmt(projected),
      sub: accounts.annualTarget > 0
        ? (paceAhead ? `Ahead — target ${fmt(accounts.annualTarget)}` : `Target ${fmt(accounts.annualTarget)} · ${ytdPct}% in`)
        : 'Tap to set your target',
      tone: paceAhead == null ? 'idle' : paceAhead ? 'good' : 'warn',
      tab: 'money',
      onClick: accounts.annualTarget > 0 ? null : onSetTarget,
    },
  ];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-[rgba(52,211,153,0.22)] h-full flex flex-col"
      style={{ background: DASH_CARD_BG, boxShadow: '0 24px 60px -24px rgba(0,0,0,0.6)' }}
    >
      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(52,211,153,0.14) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(79,120,255,0.12) 0%, transparent 70%)' }} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-300">Money confidence</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5 gap-0.5">
            {MONEY_PERIODS.map(p => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 text-[11px] font-black rounded-[10px] transition-all ${
                  period === p.id
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40 shadow-[0_0_10px_rgba(52,211,153,0.25)]'
                    : 'text-[rgba(153,197,255,0.45)] hover:text-white border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => onNavigate?.('money')}
            className="text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors whitespace-nowrap"
          >
            Money Tracker →
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative px-5 py-5 grid grid-cols-1 md:grid-cols-5 gap-6 flex-1">
        {/* Left — the number */}
        <div className="md:col-span-2 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(153,197,255,0.45)] mb-1.5">
            Money in · {MONEY_PERIODS.find(p => p.id === period)?.label.toLowerCase() === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month'}
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            <p
              className="text-5xl font-black tabular-nums text-white leading-none"
              style={{ textShadow: '0 0 30px rgba(52,211,153,0.35)' }}
            >
              {fmt(moneyInAnim)}
            </p>
            {delta != null && (
              <span className={`mb-1 text-[11px] font-black px-2 py-1 rounded-full border ${
                delta >= 0
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-300 border-red-500/30'
              }`}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs {view.compareLabel}
              </span>
            )}
          </div>

          {/* In / out / kept */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[rgba(153,197,255,0.5)]">Money out</span>
              <span className="font-black tabular-nums text-amber-300">{view.moneyOut > 0 ? `−${fmt(view.moneyOut)}` : '£0'}</span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
              <span className="text-[rgba(153,197,255,0.5)]">Kept</span>
              <span className={`font-black tabular-nums ${kept >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>{kept < 0 ? `−${fmt(kept)}` : fmt(kept)}</span>
            </div>
          </div>

          {/* Truly yours — the Money Confidence number. Earned minus costs minus
              the tax that isn't really theirs. Hidden until there's income. */}
          {(accounts.ytdIncome ?? 0) > 0 && (() => {
            const trulyYours = Math.max(0, (accounts.ytdIncome ?? 0) - (accounts.ytdExpenses ?? 0) - (accounts.taxReserveTarget ?? 0));
            return (
              <div className="mt-4 px-3 py-2.5 rounded-xl border border-emerald-400/25" style={{ background: 'rgba(52,211,153,0.07)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-0.5">Truly yours · this tax year</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.5)] leading-snug">
                      {fmt(accounts.ytdIncome)} earned − {fmt(accounts.ytdExpenses ?? 0)} costs − {fmt(accounts.taxReserveTarget ?? 0)} for tax
                    </p>
                  </div>
                  <p className="text-2xl font-black tabular-nums text-emerald-300 shrink-0" style={{ textShadow: '0 0 20px rgba(52,211,153,0.4)' }}>
                    {fmt(trulyYours)}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Target progress — or the prompt to set one */}
          {targetPct != null ? (
            <div className="mt-4">
              <div className="flex justify-between text-[10px] font-bold mb-1.5">
                <span className="text-[rgba(153,197,255,0.4)] uppercase tracking-widest">
                  {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'} target
                </span>
                <span className={targetPct >= 100 ? 'text-emerald-300' : 'text-[rgba(153,197,255,0.6)]'}>
                  {targetPct}% of {fmt(target)}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: mounted ? `${Math.min(100, targetPct)}%` : 0,
                    transition: 'width 0.9s cubic-bezier(0.34,1.2,0.64,1) 0.2s',
                    background: 'linear-gradient(90deg, #34d399, #059669)',
                    boxShadow: '0 0 10px 2px rgba(52,211,153,0.4)',
                  }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={onSetTarget}
              className="mt-4 w-full text-left px-3 py-2.5 rounded-xl border border-dashed border-amber-400/40 transition-colors hover:bg-amber-400/10"
              style={{ background: 'rgba(251,191,36,0.06)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-0.5">🎯 No target set</p>
              <p className="text-[11px] font-bold text-white leading-snug">Set your monthly target — Cadi paces every day, week and month against it.</p>
            </button>
          )}

          {/* CTAs */}
          <div className="flex gap-2 mt-5 md:mt-auto md:pt-5">
            <button
              onClick={onLogPayment}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)', boxShadow: '0 8px 20px -6px rgba(4,120,87,0.55), inset 0 1px 0 rgba(255,255,255,0.2)' }}
            >
              💷 Log payment
            </button>
            <button
              onClick={() => onNavigate?.('money')}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-white/80 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
            >
              Open tracker
            </button>
          </div>
        </div>

        {/* Right — the chart */}
        <div className="md:col-span-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[rgba(153,197,255,0.4)]">{view.chartLabel}</p>
            {!hasAny && isLive && (
              <span className="text-[10px] font-bold text-amber-300">Log payments to light this up</span>
            )}
          </div>
          <div className="flex-1 flex items-end gap-1.5 min-h-[130px]">
            {view.bars.map((b, i) => {
              const h = b.value > 0 ? Math.max((b.value / maxBar) * 100, 5) : 0;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative" title={`${b.full} · ${fmt(b.value)}`}>
                  {/* Hover value */}
                  <div className="absolute -top-6 hidden group-hover:block whitespace-nowrap bg-white text-brand-navy text-[10px] font-black px-2 py-0.5 rounded-md shadow-xl z-10 pointer-events-none">
                    {fmt(b.value)}
                  </div>
                  <div className="w-full h-[110px] flex items-end justify-center">
                    {b.value > 0 ? (
                      <div
                        className="w-full max-w-[26px] rounded-t-md"
                        style={{
                          height: mounted ? `${h}%` : 0,
                          transition: `height 0.6s cubic-bezier(0.34,1.4,0.64,1) ${i * 0.05}s`,
                          background: b.current
                            ? 'linear-gradient(180deg, #6ee7b7 0%, #059669 100%)'
                            : 'linear-gradient(180deg, rgba(79,120,255,0.55) 0%, rgba(79,120,255,0.18) 100%)',
                          boxShadow: b.current ? '0 0 14px 2px rgba(52,211,153,0.45)' : 'none',
                        }}
                      />
                    ) : (
                      <div className="w-full max-w-[26px] h-1 rounded-full bg-white/5" />
                    )}
                  </div>
                  <span className={`text-[9px] font-bold ${b.current ? 'text-emerald-300' : 'text-[rgba(153,197,255,0.3)]'}`}>{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confidence strip */}
      <div className="relative grid grid-cols-2 md:grid-cols-4 border-t border-[rgba(79,120,255,0.12)] divide-x divide-[rgba(79,120,255,0.08)]">
        {confidence.map((c) => {
          const t = chip(c.tone);
          return (
            <button
              key={c.label}
              onClick={() => { if (c.onClick) { c.onClick(); } else if (c.tab) { onNavigate?.(c.tab); } }}
              className="px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                <p className="text-[9px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.4)]">{c.label}</p>
              </div>
              <p className={`text-base font-black tabular-nums leading-tight ${t.text}`}>{c.value}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5 truncate">{c.sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Health score ring ─────────────────────────────────────────────────────────
function ScoreRing({ score, size = 112 }) {
  const display     = useCountUp(score, 1800);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (!score) return;
    const t1 = setTimeout(() => setLanded(true), 1850);
    const t2 = setTimeout(() => setLanded(false), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [score]);

  const r           = (size / 2) - 10;
  const circ        = 2 * Math.PI * r;
  const dashOffset  = circ * (1 - display / 100);
  const strokeColor = display >= 90 ? "#a78bfa" : display >= 75 ? "#34d399" : display >= 60 ? "#38bdf8" : display >= 40 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {landed && (
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: `2px solid ${strokeColor}`, animation: 'scoreLand 0.9s ease-out forwards' }}
        />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={strokeColor} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{
            transition: "stroke-dashoffset 0.04s linear, stroke 0.25s ease",
            filter: `drop-shadow(0 0 ${landed ? '14px' : '7px'} ${strokeColor})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black tabular-nums text-white leading-none">{display}</span>
        <span className="text-[10px] font-bold mt-1 text-white/50 tracking-wider">/ 100</span>
      </div>
    </div>
  );
}

// ─── KPI strip ────────────────────────────────────────────────────────────────
function KPIStrip({ accounts, weekJobs, jobsTodayData, invoices }) {
  const todayRevenue  = weekJobs.find(d => d.isToday)?.revenue ?? 0;
  const weekRevenue   = weekJobs.filter(d => d.done || d.isToday).reduce((s,d)=>s+d.revenue, 0);
  const weekTotal     = weekJobs.reduce((s,d)=>s+d.revenue, 0);
  const monthIncome   = invoices
    .filter(i => i.status === "paid")
    .reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const jobsToday     = jobsTodayData.length;
  const jobsDone      = jobsTodayData.filter(j=>j.status==="complete").length;
  const unpaidTotal   = invoices.filter(i=>i.status!=="paid").reduce((s,i)=>s+(Number(i.amount)||0), 0);
  const taxPct        = accounts.taxReserveTarget > 0
    ? Math.round((accounts.taxReserve / accounts.taxReserveTarget) * 100) : 0;

  const todayRevAnim  = useCountUp(todayRevenue, 1600);
  const weekRevAnim   = useCountUp(weekRevenue,  1700);
  const monthIncAnim  = useCountUp(monthIncome,  1800);
  const unpaidAnim    = useCountUp(unpaidTotal,  1400);
  const taxAnim       = useCountUp(taxPct,       1200);

  const kpis = [
    { label: "Today's revenue",   val: fmt(todayRevAnim),                          accent: "text-brand-navy"  },
    { label: "Week revenue",       val: fmt(weekRevAnim),                           accent: "text-brand-navy",  sub: `${pct((weekRevAnim/Math.max(weekTotal,1))*100)} of ${fmt(weekTotal)}` },
    { label: "Month income",       val: fmt(monthIncAnim),                          accent: "text-brand-navy",  sub: accounts.monthlyTarget > 0 ? `${pct((monthIncAnim/accounts.monthlyTarget)*100)} of ${fmt(accounts.monthlyTarget)}` : 'Set a target →' },
    { label: "Outstanding",        val: fmt(unpaidAnim),                            accent: unpaidTotal>0?"text-amber-600":"text-emerald-600" },
    { label: "Jobs today",         val: `${jobsDone}/${jobsToday}`,                 accent: "text-brand-navy",  sub: "complete" },
    { label: "Tax reserve",        val: `${taxAnim}%`,                              accent: taxPct>=100?"text-emerald-600":taxPct>=70?"text-amber-600":"text-red-500" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-gray-200 border-b border-gray-200">
      {kpis.map(({ label, val, accent, sub }) => (
        <div key={label} className="bg-white px-3 py-3">
          <SL className="mb-0.5">{label}</SL>
          <p className={`text-lg font-bold tabular-nums leading-tight ${accent}`}>{val}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

// ─── Health score panel ────────────────────────────────────────────────────────
const SCORE_DIMENSIONS = [
  {
    label: "Revenue",
    max: 25,
    color: "bg-brand-blue",
    glow: { bar: "linear-gradient(90deg, #38bdf8, #1f48ff)", shadow: "0 0 10px 2px rgba(56,189,248,0.6)" },
    summary: "How close you are to your weekly and yearly income targets.",
    rules: [
      "Up to 12 pts for this week's earned revenue vs. the jobs on your calendar.",
      "Up to 13 pts for year-to-date income vs. 4 months of your annual target.",
    ],
  },
  {
    label: "Operations",
    max: 25,
    color: "bg-emerald-500",
    glow: { bar: "linear-gradient(90deg, #34d399, #059669)", shadow: "0 0 10px 2px rgba(52,211,153,0.6)" },
    summary: "Jobs marked complete and today's schedule fully staffed.",
    rules: [
      "Up to 18 pts for completing today/past jobs in the week.",
      "Up to 7 pts when no jobs today are unassigned (−2 pts per unassigned).",
    ],
  },
  {
    label: "Invoicing",
    max: 25,
    color: "bg-amber-400",
    glow: { bar: "linear-gradient(90deg, #fbbf24, #d97706)", shadow: "0 0 10px 2px rgba(251,191,36,0.6)" },
    summary: "Clean invoices — no overdue, no pile-up of unpaid.",
    rules: [
      "Starts at 25 pts.",
      "−12 pts per overdue invoice.",
      "−5 pts if you have more than 3 unpaid invoices stacking up.",
    ],
  },
  {
    label: "Compliance",
    max: 15,
    color: "bg-emerald-500",
    glow: { bar: "linear-gradient(90deg, #a78bfa, #7c3aed)", shadow: "0 0 10px 2px rgba(167,139,250,0.6)" },
    summary: "Tax reserve, mileage logged, and MTD filings on track.",
    rules: [
      "Up to 7 pts for saving toward your tax reserve target.",
      "4 pts when your claimed mileage is ≥90% of logged mileage.",
      "4 pts when your latest MTD quarter is filed.",
    ],
  },
  {
    label: "Growth",
    max: 10,
    color: "bg-brand-blue",
    glow: { bar: "linear-gradient(90deg, #f87171, #dc2626)", shadow: "0 0 10px 2px rgba(248,113,113,0.6)" },
    summary: "Running a sprint and making headway toward the annual target.",
    rules: [
      "4 pts when you have an active 90-day sprint.",
      "3 pts baseline, or 6 pts once you pass 50% of your monthly target.",
    ],
  },
];

function ScoreExplainerModal({ score, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-brand-skyblue/80">Cadi Score</p>
            <h3 className="text-lg font-black text-brand-navy">How this is calculated</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">✕</button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">
            Your score is out of <span className="font-bold text-brand-navy">100</span> across five dimensions. Each updates live from your real data — jobs, invoices, income logs, and settings.
          </p>
          <div className="space-y-4">
            {SCORE_DIMENSIONS.map(({ label, max, color, summary, rules }) => {
              const actual = score.dims?.find((d) => d.label === label)?.score ?? 0;
              return (
                <div key={label} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-brand-navy text-sm">{label}</p>
                    <span className="text-xs font-mono font-bold text-gray-600">{actual} / {max}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${(actual / max) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mb-2">{summary}</p>
                  <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                    {rules.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 leading-relaxed">
            <p className="font-bold text-gray-700 mb-1">Tier thresholds</p>
            <p>0–39 Getting Started · 40–59 Building · 60–74 Solid · 75–89 Firing · 90+ Elite</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const TIERS_ORDERED = ["Getting Started", "Building", "Solid", "Firing", "Elite"];

function HealthPanel({ score, scoreDelta = 0 }) {
  const { total, dims, tier, tierNext, tierColor } = score;
  const ptsToNext   = tierNext ? tierNext - total : 0;
  const tierIdx     = TIERS_ORDERED.indexOf(tier);
  const nextTier    = TIERS_ORDERED[tierIdx + 1];
  const [showExplainer, setShowExplainer] = useState(false);
  const [barsMounted, setBarsMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setBarsMounted(true), 200); return () => clearTimeout(t); }, []);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-5">
          <ScoreRing score={total} size={112} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-1.5 h-4 rounded-full bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]" />
              <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Cadi Score</p>
            </div>
            <p className={`text-2xl font-black leading-tight ${tierColor}`}>{tier}</p>
            <p className="text-xs text-white/50 mt-1.5 leading-relaxed">
              {scoreDelta !== 0 && (
                <span className={`font-bold ${scoreDelta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {scoreDelta > 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} pts
                </span>
              )}
              {scoreDelta !== 0 && " this session · "}
              {tierNext && <><span className="font-bold text-white">{ptsToNext} pts</span> to {nextTier}</>}
              {!tierNext && <span className="text-violet-300 font-bold">Peak performance</span>}
            </p>
            {/* Tier progress pills */}
            <div className="flex items-center gap-1.5 mt-3">
              {TIERS_ORDERED.map((t, i) => {
                const active = t === tier;
                const passed = tierIdx > i;
                return (
                  <div key={t} className={`rounded-full transition-all duration-300 ${
                    active ? "w-6 h-2 bg-brand-skyblue" :
                    passed ? "w-2 h-2 bg-emerald-400" :
                    "w-2 h-2 bg-white/15"
                  }`} />
                );
              })}
            </div>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {TIERS_ORDERED.map((t) => (
                <span key={t} className={`text-[10px] font-bold ${t === tier ? tierColor : "text-white/25"}`}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="px-5 py-4 border-t border-[rgba(79,120,255,0.12)]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest uppercase text-brand-skyblue/50">Score breakdown</p>
          <button onClick={() => setShowExplainer(true)} className="text-xs font-bold text-brand-skyblue hover:text-white transition-colors">
            How it works →
          </button>
        </div>
        <div className="space-y-3">
          {dims.map(({ label, score: s, max }, i) => {
            const pct  = (s / max) * 100;
            const glow = SCORE_DIMENSIONS.find(d => d.label === label)?.glow;
            return (
              <div key={label} className="flex items-center gap-3"
                style={{ animation: `fadeSlideIn 0.4s ease-out ${i * 0.1 + 0.25}s both` }}
              >
                <span className="text-xs text-white/40 w-24 shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: barsMounted ? `${pct}%` : 0,
                      transition: `width 0.65s cubic-bezier(0.34,1.2,0.64,1) ${i * 0.12 + 0.3}s`,
                      background: glow?.bar,
                      boxShadow: pct > 5 ? glow?.shadow : "none",
                    }}
                  />
                </div>
                <div className="flex items-center gap-0.5 w-12 shrink-0 justify-end">
                  <span className="text-xs font-mono font-bold text-white/70">{s}</span>
                  <span className="text-xs text-white/25">/{max}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showExplainer && (
        <ScoreExplainerModal score={score} onClose={() => setShowExplainer(false)} />
      )}
    </div>
  );
}

// ─── Module cards for the 6-panel grid ─────────────────────────────────────────
// Shared shell — every module speaks the same dark glow-card language.
function ModuleCard({ dot, title, headerRight, children, className = "", accentBorder }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden border h-full flex flex-col ${className}`}
      style={{ background: DASH_CARD_BG, borderColor: accentBorder || 'rgba(79,120,255,0.15)' }}
    >
      <div className="px-4 py-3.5 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-1.5 h-4 rounded-full shrink-0 ${dot}`} />
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#99c5ff] truncate">{title}</p>
        </div>
        {headerRight}
      </div>
      <div className="flex-1 flex flex-col min-h-0">{children}</div>
    </div>
  );
}

// PENDING PAYMENTS — who owes what, overdue first, one tap to chase.
function PendingPaymentsCard({ invoices, onNavigate }) {
  const unpaid = invoices
    .filter(i => i.status !== 'paid' && i.status !== 'draft')
    .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  const total = unpaid.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const overdueCount = unpaid.filter(i => i.status === 'overdue').length;

  return (
    <ModuleCard
      dot={overdueCount > 0 ? "bg-red-400 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" : "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]"}
      title="Pending payments"
      headerRight={
        <button onClick={() => onNavigate?.('invoices')} className="text-[11px] font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors whitespace-nowrap">All →</button>
      }
    >
      <div className="px-4 pt-3.5 pb-2">
        <p className="text-3xl font-black tabular-nums text-white leading-none" style={{ textShadow: total > 0 ? '0 0 24px rgba(251,191,36,0.3)' : undefined }}>
          {fmt(total)}
        </p>
        <p className="text-[11px] text-[rgba(153,197,255,0.45)] mt-1.5">
          {unpaid.length === 0
            ? 'Nothing owed — all collected 🎉'
            : <>{unpaid.length} invoice{unpaid.length === 1 ? '' : 's'} waiting{overdueCount > 0 && <span className="text-red-300 font-bold"> · {overdueCount} overdue</span>}</>}
        </p>
      </div>
      <div className="flex-1 divide-y divide-[rgba(79,120,255,0.08)] border-t border-[rgba(79,120,255,0.1)]">
        {unpaid.slice(0, 4).map(inv => (
          <button
            key={inv.id}
            onClick={() => onNavigate?.('invoices')}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
          >
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${inv.status === 'overdue' ? 'bg-red-400 shadow-[0_0_6px_1px_rgba(239,68,68,0.6)]' : 'bg-amber-400/60'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{inv.customer}</p>
              {inv.status === 'overdue' && (
                <p className="text-[10px] text-red-300/80">{inv.daysOverdue} day{inv.daysOverdue === 1 ? '' : 's'} overdue</p>
              )}
            </div>
            <span className="text-xs font-black tabular-nums text-white shrink-0">{fmt(inv.amount)}</span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${inv.status === 'overdue' ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-[rgba(153,197,255,0.5)]'}`}>
              {inv.status === 'overdue' ? 'Chase' : 'Sent'}
            </span>
          </button>
        ))}
        {unpaid.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-2xl mb-1" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.6))' }}>✓</p>
            <p className="text-xs text-[rgba(153,197,255,0.4)]">Invoices land here when they're sent.</p>
          </div>
        )}
      </div>
    </ModuleCard>
  );
}

// SCORE — compact Cadi Score with the single next move folded in.
function ScoreCard({ score, actions, onNavigate }) {
  const { total, tier, tierNext, tierColor } = score;
  const [showExplainer, setShowExplainer] = useState(false);
  const topAction = (actions || []).find(a => a.pts > 0);
  const tierIdx = TIERS_ORDERED.indexOf(tier);
  const nextTier = TIERS_ORDERED[tierIdx + 1];

  return (
    <ModuleCard
      dot="bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]"
      title="Cadi Score"
      headerRight={
        <button onClick={() => setShowExplainer(true)} className="text-[11px] font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors whitespace-nowrap">How? →</button>
      }
    >
      <div className="px-4 py-4 flex items-center gap-4">
        <ScoreRing score={total} size={88} />
        <div className="min-w-0">
          <p className={`text-lg font-black leading-tight ${tierColor}`}>{tier}</p>
          {tierNext
            ? <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-0.5"><span className="font-bold text-white">{tierNext - total} pts</span> to {nextTier}</p>
            : <p className="text-[11px] text-violet-300 font-bold mt-0.5">Peak performance</p>}
          <div className="flex items-center gap-1 mt-2">
            {TIERS_ORDERED.map((t, i) => (
              <div key={t} className={`rounded-full transition-all ${t === tier ? "w-5 h-1.5 bg-brand-skyblue" : tierIdx > i ? "w-1.5 h-1.5 bg-emerald-400" : "w-1.5 h-1.5 bg-white/15"}`} />
            ))}
          </div>
        </div>
      </div>
      {topAction && (
        <button
          onClick={() => topAction.tab && onNavigate?.(topAction.tab)}
          className="mt-auto mx-3 mb-3 px-3 py-2.5 rounded-xl text-left border transition-colors hover:bg-white/[0.05]"
          style={{ background: 'rgba(251,191,36,0.07)', borderColor: 'rgba(251,191,36,0.25)' }}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-300/80 mb-0.5">Next move · +{topAction.pts} pts</p>
          <p className="text-[11px] font-bold text-white leading-snug line-clamp-2">{topAction.title}</p>
        </button>
      )}
      {showExplainer && <ScoreExplainerModal score={score} onClose={() => setShowExplainer(false)} />}
    </ModuleCard>
  );
}

// SCHEDULE — today at a glance + the week's shape in miniature.
function ScheduleCard({ weekJobs, jobsToday, onNavigate }) {
  const done = jobsToday.filter(j => j.status === 'complete').length;
  const nextJob = jobsToday.find(j => j.status !== 'complete');
  const maxRev = Math.max(...weekJobs.map(d => d.revenue), 1);

  return (
    <ModuleCard
      dot="bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]"
      title="Schedule"
      headerRight={
        <button onClick={() => onNavigate?.('scheduler')} className="text-[11px] font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors whitespace-nowrap">Open →</button>
      }
    >
      <div className="px-4 pt-3.5">
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black tabular-nums text-white leading-none">{done}<span className="text-[rgba(153,197,255,0.35)]">/{jobsToday.length}</span></p>
          <p className="text-[11px] text-[rgba(153,197,255,0.45)]">jobs done today</p>
        </div>
        {nextJob ? (
          <div className="mt-3 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08]">
            <p className="text-[10px] font-black uppercase tracking-widest text-[rgba(153,197,255,0.4)] mb-0.5">Up next</p>
            <p className="text-xs font-bold text-white truncate">{nextJob.customer} · {fmt(nextJob.price)}</p>
            <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{nextJob.time}{nextJob.postcode ? ` · ${nextJob.postcode}` : ''} · {nextJob.service}</p>
          </div>
        ) : (
          <div className="mt-3 px-3 py-2 rounded-xl bg-emerald-500/[0.08] border border-emerald-500/20">
            <p className="text-xs font-bold text-emerald-300">{jobsToday.length > 0 ? 'Day wrapped 🎉' : 'Nothing booked today'}</p>
          </div>
        )}
      </div>
      {/* Mini week */}
      <div className="mt-auto px-4 pb-3.5 pt-3">
        <div className="flex items-end gap-1 h-9">
          {weekJobs.map(d => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day} · ${fmt(d.revenue)}`}>
              <div className="w-full flex items-end justify-center h-6">
                <div
                  className="w-2.5 rounded-t-sm"
                  style={{
                    height: d.revenue > 0 ? `${Math.max((d.revenue / maxRev) * 100, 12)}%` : '2px',
                    background: d.isToday
                      ? 'linear-gradient(180deg, #99c5ff, #4f78ff)'
                      : d.done ? 'linear-gradient(180deg, #6ee7b7, #059669)' : 'rgba(79,120,255,0.2)',
                    boxShadow: d.isToday ? '0 0 6px 1px rgba(99,179,255,0.4)' : 'none',
                  }}
                />
              </div>
              <span className={`text-[8px] font-bold ${d.isToday ? 'text-[#99c5ff]' : 'text-[rgba(153,197,255,0.3)]'}`}>{d.day[0]}</span>
            </div>
          ))}
        </div>
      </div>
    </ModuleCard>
  );
}

// MARKETPLACE — live Cadi Connect work near you. Connect-orange accent.
const DEMO_LISTINGS = [
  { id: 'd1', site: 'Stratstone JLR Nottingham', postcode: 'NG7', frequency: 'monthly', price: 200, status: 'bidding', fm: 'ARGO FM' },
  { id: 'd2', site: 'Vauxhall Bedford',          postcode: 'MK42', frequency: 'monthly', price: 45,  status: 'open',    fm: 'ARGO FM' },
  { id: 'd3', site: 'Park Retail Unit 4',        postcode: 'SW9',  frequency: 'weekly',  price: 85,  status: 'open',    fm: 'Britannia' },
];

function MarketplaceCard({ isLive, onNavigate }) {
  const [listings, setListings] = useState(null); // null = loading
  useEffect(() => {
    if (!isLive) { setListings(DEMO_LISTINGS); return; }
    let alive = true;
    listOpenMarketplaceListings()
      .then(rows => {
        if (!alive) return;
        setListings((rows || []).map(l => ({
          id: l.id,
          site: l.visit_spec?.site?.name ?? 'Site',
          postcode: (l.visit_spec?.site?.postcode || '').split(' ')[0],
          frequency: l.visit_spec?.frequency ?? '',
          price: l.target_price,
          status: l.status,
          fm: l.fm_organisation?.name ?? 'FM',
        })));
      })
      .catch(() => { if (alive) setListings([]); });
    return () => { alive = false; };
  }, [isLive]);

  const live = listings ?? [];

  return (
    <ModuleCard
      dot="bg-orange-400 shadow-[0_0_8px_2px_rgba(251,146,60,0.6)]"
      title="Marketplace · Cadi Connect"
      accentBorder="rgba(251,146,60,0.25)"
      headerRight={
        <div className="flex items-center gap-2.5">
          {live.length > 0 && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-300 border border-orange-500/30">
              {live.length} live
            </span>
          )}
          <button onClick={() => onNavigate?.('connect')} className="text-[11px] font-bold text-orange-300 hover:text-orange-200 transition-colors whitespace-nowrap">Open marketplace →</button>
        </div>
      }
    >
      {listings === null && (
        <div className="flex-1 flex items-center justify-center py-8">
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {listings !== null && live.length === 0 && (
        <div className="flex-1 flex flex-col items-center text-center gap-3 px-5 py-6">
          <div className="text-4xl" style={{ filter: 'drop-shadow(0 0 16px rgba(251,146,60,0.5))' }}>🏗️</div>
          <div>
            <p className="text-sm font-black text-white">Win commercial contracts near you</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1 leading-relaxed">FM companies post real cleaning work to Cadi Connect — browse open listings, bid, and get paid through Cadi.</p>
          </div>
          <button
            onClick={() => onNavigate?.('connect')}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(180deg, #d64510 0%, #C2410C 100%)', boxShadow: '0 8px 20px -6px rgba(194,65,12,0.55), inset 0 1px 0 rgba(255,255,255,0.2)' }}
          >
            Explore Connect
          </button>
        </div>
      )}
      {live.length > 0 && (
        <div className="flex-1 divide-y divide-[rgba(251,146,60,0.08)]">
          {live.slice(0, 3).map(l => (
            <button
              key={l.id}
              onClick={() => onNavigate?.('connect')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="w-1 self-stretch rounded-full shrink-0 min-h-[30px]" style={{ background: l.status === 'bidding' ? '#fb923c' : '#4f78ff', boxShadow: `0 0 6px 1px ${l.status === 'bidding' ? 'rgba(251,146,60,0.5)' : 'rgba(79,120,255,0.5)'}` }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{l.site}</p>
                <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{l.postcode} · {l.frequency} · {l.fm}</p>
              </div>
              <p className="text-sm font-black tabular-nums text-white shrink-0">{fmt(l.price)}</p>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
                l.status === 'bidding' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-[#4f78ff]/15 text-[#99c5ff] border border-[#4f78ff]/30'
              }`}>{l.status}</span>
            </button>
          ))}
        </div>
      )}
    </ModuleCard>
  );
}

// ─── Priority actions panel ────────────────────────────────────────────────────
function ActionsPanel({ actions, onNavigate }) {
  const needsAttention = actions.filter(a => a.pts > 0).length;

  const levelCfg = {
    red:   { glow: "rgba(239,68,68,0.15)",  border: "rgba(239,68,68,0.4)",   bar: "#ef4444", badge: "bg-red-500/20 text-red-300 border-red-500/30",   btn: "bg-red-500 hover:bg-red-400",   dot: "bg-red-400 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]" },
    amber: { glow: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.35)", bar: "#fbbf24", badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", btn: "bg-amber-500 hover:bg-amber-400", dot: "bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" },
    green: { glow: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.35)", bar: "#34d399", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", btn: "bg-emerald-600 hover:bg-emerald-500", dot: "bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" },
    blue:  { glow: "rgba(79,120,255,0.12)", border: "rgba(79,120,255,0.35)", bar: "#4f78ff", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",   btn: "bg-[#4f78ff] hover:bg-[#3d68ff]", dot: "bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.6)]" },
  };

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Priority actions</p>
        </div>
        {needsAttention > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30">
            {needsAttention} need attention
          </span>
        )}
      </div>

      {/* Action rows */}
      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {actions.map((a, i) => {
          const cfg = levelCfg[a.level] ?? levelCfg.blue;
          return (
            <div
              key={i}
              className="flex items-center gap-4 px-5 py-4 transition-colors duration-200 hover:bg-white/[0.03] cursor-default"
              style={{
                background: i === 0 && a.pts > 0 ? `linear-gradient(90deg, ${cfg.glow} 0%, transparent 60%)` : undefined,
                animation: `fadeSlideIn 0.4s ease-out ${i * 0.09}s both`,
              }}
            >
              {/* Severity dot */}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight">{a.title}</p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5 leading-relaxed">{a.body}</p>
              </div>

              {/* Right side */}
              <div className="shrink-0 flex items-center gap-2">
                {a.pts > 0 && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                    +{a.pts}pts
                  </span>
                )}
                {a.action && a.tab && (
                  <button
                    onClick={() => onNavigate?.(a.tab)}
                    className={`px-3.5 py-1.5 text-white text-xs font-black rounded-lg transition-colors whitespace-nowrap ${cfg.btn}`}
                  >
                    {a.action}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week day grid ────────────────────────────────────────────────────────────
function WeekGrid({ weekJobs }) {
  const maxRevenue = Math.max(...weekJobs.map(d => d.revenue), 1);
  const weekEarned = weekJobs.filter(d => d.done || d.isToday).reduce((s,d) => s+d.revenue, 0);
  const weekTotal  = weekJobs.reduce((s,d) => s+d.revenue, 0);
  const weekPct    = weekTotal > 0 ? Math.round((weekEarned / weekTotal) * 100) : 0;
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">This week</p>
        </div>
        <span className="text-xs font-bold text-emerald-400">{fmt(weekEarned)} earned · {weekPct}%</span>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-7 gap-px px-3 pt-4 pb-2">
        {weekJobs.map((d, index) => {
          const barH = d.revenue > 0 ? Math.max((d.revenue / maxRevenue) * 56, 6) : 0;
          return (
            <div key={d.day} className="flex flex-col items-center gap-1.5">
              {/* Day label */}
              <p className={`text-[10px] font-black uppercase tracking-widest ${
                d.isToday ? "text-[#99c5ff]" : d.done ? "text-emerald-400" : "text-[rgba(153,197,255,0.3)]"
              }`}>{d.day}</p>

              {/* Bar container */}
              <div className="w-full h-14 flex items-end justify-center">
                {d.revenue > 0 ? (
                  <div
                    className="w-5 rounded-t-md"
                    style={{
                      height: mounted ? `${barH}px` : 0,
                      transition: `height 0.55s cubic-bezier(0.34,1.56,0.64,1) ${index * 0.07}s`,
                      background: d.isToday
                        ? 'linear-gradient(180deg, #99c5ff 0%, #4f78ff 100%)'
                        : d.done
                        ? 'linear-gradient(180deg, #6ee7b7 0%, #059669 100%)'
                        : 'rgba(79,120,255,0.2)',
                      boxShadow: d.isToday
                        ? '0 0 10px 2px rgba(99,179,255,0.4)'
                        : d.done
                        ? '0 0 8px 1px rgba(52,211,153,0.3)'
                        : 'none',
                    }}
                  />
                ) : (
                  <div className="w-5 h-1 rounded-full bg-white/5" />
                )}
              </div>

              {/* Revenue */}
              <p className={`text-[11px] font-black tabular-nums leading-none ${
                d.isToday ? "text-white" : d.done ? "text-emerald-300" : d.revenue > 0 ? "text-[rgba(153,197,255,0.6)]" : "text-[rgba(153,197,255,0.2)]"
              }`}>{d.revenue > 0 ? fmt(d.revenue) : "—"}</p>

              {/* Sub label */}
              <p className={`text-[9px] font-bold ${
                d.isToday ? "text-[#4f78ff]" : d.done ? "text-emerald-500" : "text-[rgba(153,197,255,0.25)]"
              }`}>
                {d.isToday ? "today" : d.done ? "✓" : d.jobs > 0 ? `${d.jobs}j` : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Progress bar footer */}
      <div className="px-5 py-3 border-t border-[rgba(79,120,255,0.1)] mt-1">
        <div className="flex justify-between text-[10px] font-bold mb-1.5">
          <span className="text-[rgba(153,197,255,0.4)] uppercase tracking-widest">Week progress</span>
          <span className="text-[rgba(153,197,255,0.6)]">{fmt(weekEarned)} of {fmt(weekTotal)}</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${weekPct}%`,
              background: 'linear-gradient(90deg, #34d399, #059669)',
              boxShadow: '0 0 8px 2px rgba(52,211,153,0.4)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Today's jobs ──────────────────────────────────────────────────────────────
function TodaysJobs({ jobs, onNavigate }) {
  const TYPE_COLOR = {
    residential: { bar: '#34d399', glow: 'rgba(52,211,153,0.6)' },
    commercial:  { bar: '#4f78ff', glow: 'rgba(79,120,255,0.6)' },
    exterior:    { bar: '#f97316', glow: 'rgba(249,115,22,0.6)'  },
  };

  const STATUS_CFG = {
    complete:      { label: 'Done',        bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
    'in-progress': { label: 'In progress', bg: 'bg-[#4f78ff]/20',   text: 'text-[#99c5ff]',  border: 'border-[#4f78ff]/30'  },
    scheduled:     { label: 'Scheduled',   bg: 'bg-white/5',        text: 'text-[rgba(153,197,255,0.5)]', border: 'border-white/10' },
    unassigned:    { label: 'Assign',      bg: 'bg-red-500/20',     text: 'text-red-300',    border: 'border-red-500/30'    },
  };

  const doneCount = jobs.filter(j => j.status === 'complete').length;

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Today's jobs</p>
        </div>
        <div className="flex items-center gap-3">
          {jobs.length > 0 && (
            <span className="text-xs font-bold text-[rgba(153,197,255,0.5)]">{doneCount}/{jobs.length} done</span>
          )}
          <button
            onClick={() => onNavigate?.("scheduler")}
            className="text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors"
          >
            Full schedule →
          </button>
        </div>
      </div>

      {/* All-done celebration */}
      {jobs.length > 0 && doneCount === jobs.length && (
        <div
          className="px-5 py-4 border-b border-[rgba(52,211,153,0.2)]"
          style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.12) 0%, rgba(79,120,255,0.06) 100%)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl shrink-0" style={{ filter: 'drop-shadow(0 0 10px rgba(52,211,153,0.7))' }}>🎉</span>
            <div>
              <p className="text-sm font-black text-emerald-300">Day wrapped!</p>
              <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">All {jobs.length} job{jobs.length !== 1 ? 's' : ''} complete · great work today</p>
            </div>
          </div>
        </div>
      )}

      {jobs.length === 0 && (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-[rgba(153,197,255,0.4)]">No jobs yet for today.</p>
        </div>
      )}

      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {jobs.map(j => {
          const typeColor = TYPE_COLOR[j.type] ?? TYPE_COLOR.residential;
          const statusCfg = STATUS_CFG[j.status] ?? STATUS_CFG.scheduled;
          const isDone    = j.status === 'complete';

          return (
            <div
              key={j.id}
              className={`flex items-center gap-3.5 px-5 py-3.5 transition-all duration-200 hover:bg-white/[0.02] ${isDone ? 'opacity-50' : ''}`}
            >
              {/* Type bar */}
              <div
                className="w-1 self-stretch rounded-full shrink-0 min-h-[32px]"
                style={{ background: typeColor.bar, boxShadow: `0 0 6px 1px ${typeColor.glow}` }}
              />

              {/* Job info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate leading-tight">{j.customer}</p>
                <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5">{j.time} · {j.postcode} · {j.service}</p>
              </div>

              {/* Price */}
              <p className={`text-sm font-black tabular-nums shrink-0 ${isDone ? 'text-emerald-400' : 'text-white'}`}>
                {fmt(j.price)}
              </p>

              {/* Status chip */}
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}>
                {statusCfg.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Team panel ────────────────────────────────────────────────────────────────
function TeamPanel({ team, jobsToday, onNavigate }) {
  const unassigned = jobsToday.filter(j => j.status === "unassigned");
  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: DASH_CARD_BG }}
    >
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-[#4f78ff] shadow-[0_0_8px_2px_rgba(79,120,255,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Team today</p>
        </div>
        <button onClick={() => onNavigate?.("scheduler")} className="text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors">Manage →</button>
      </div>
      {team.length === 0 && unassigned.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white/70">No team members logged yet</p>
          <p className="text-xs text-[rgba(153,197,255,0.4)] mt-1">Add staff in the Scheduler to see their status here.</p>
          <button onClick={() => onNavigate?.("scheduler")} className="mt-3 px-4 py-2 text-xs font-bold text-white bg-[#4f78ff] rounded-lg hover:bg-[#3d68ff] transition-colors">
            Go to Scheduler →
          </button>
        </div>
      )}
      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {team.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[#4f78ff]/20 text-[#99c5ff] border border-[#4f78ff]/30">{m.initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{m.name}</p>
              <p className="text-xs text-[rgba(153,197,255,0.45)] truncate">{m.job}</p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
              m.status === "active"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                : "bg-white/5 text-[rgba(153,197,255,0.4)] border-white/10"
            }`}>{m.status === "active" ? "Active" : "Idle"}</span>
          </div>
        ))}
        {unassigned.map(j => (
          <div key={j.id} className="flex items-center gap-3 px-5 py-3" style={{ background: 'linear-gradient(90deg, rgba(251,191,36,0.08) 0%, transparent 70%)' }}>
            <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 text-xs font-bold shrink-0">?</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-200">{j.customer} · {j.time}</p>
              <p className="text-xs text-amber-300/60">Unassigned — needs covering</p>
            </div>
            <button onClick={() => onNavigate?.("scheduler")} className="px-2.5 py-1.5 bg-amber-500 text-white text-xs font-black rounded-lg hover:bg-amber-400 transition-colors">Assign</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Activity feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ feed }) {
  // Map legacy bg classes to dark-mode glass equivalents
  const iconCfg = (bg, icon) => {
    if (bg.includes('emerald')) return { ring: 'border-emerald-500/40', iconBg: 'bg-emerald-500/20', glow: 'rgba(52,211,153,0.5)', text: 'text-emerald-300' };
    if (bg.includes('red'))     return { ring: 'border-red-500/40',     iconBg: 'bg-red-500/20',     glow: 'rgba(239,68,68,0.5)',  text: 'text-red-300'     };
    if (bg.includes('blue'))    return { ring: 'border-[#4f78ff]/40',   iconBg: 'bg-[#4f78ff]/20',   glow: 'rgba(79,120,255,0.5)',  text: 'text-[#99c5ff]'  };
    if (bg.includes('amber'))   return { ring: 'border-amber-500/40',   iconBg: 'bg-amber-500/20',   glow: 'rgba(251,191,36,0.5)', text: 'text-amber-300'   };
    return { ring: 'border-white/20', iconBg: 'bg-white/10', glow: 'rgba(255,255,255,0.2)', text: 'text-white/70' };
  };

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.15)]"
      style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.12)]">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-4 rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(167,139,250,0.5)]" />
          <p className="text-xs font-black uppercase tracking-[0.15em] text-[#99c5ff]">Recent activity</p>
        </div>
      </div>

      {feed.length === 0 && (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[rgba(153,197,255,0.4)]">No activity yet</p>
          <p className="text-xs text-[rgba(153,197,255,0.25)] mt-1">Payments, invoices and completed jobs will appear here.</p>
        </div>
      )}

      <div className="divide-y divide-[rgba(79,120,255,0.08)]">
        {feed.map(item => {
          const cfg = iconCfg(item.bg, item.icon);
          return (
            <div key={item.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-white/[0.02] transition-all duration-200">
              {/* Icon bubble */}
              <div
                className={`w-8 h-8 rounded-xl border ${cfg.ring} ${cfg.iconBg} flex items-center justify-center text-sm shrink-0`}
                style={{ boxShadow: `0 0 10px 1px ${cfg.glow}` }}
              >
                {item.icon}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white leading-tight truncate">{item.title}</p>
                <p className="text-xs text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{item.sub}</p>
              </div>

              {/* Time */}
              <span className="text-[10px] font-bold text-[rgba(153,197,255,0.3)] shrink-0 tabular-nums">{item.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── YTD target bar ────────────────────────────────────────────────────────────

// ─── Demo tooltip wrapper ──────────────────────────────────────────────────────
function DemoHint({ label, children }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {show && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap bg-brand-navy text-white text-xs font-semibold px-3 py-2 rounded-lg shadow-xl border border-brand-blue/30 pointer-events-none">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-brand-navy" />
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Log payment modal ─────────────────────────────────────────────────────────
function LogPaymentModal({ onClose, onConfirm }) {
  const [customer, setCustomer] = useState("");
  const [amount,   setAmount]   = useState("");
  const [method,   setMethod]   = useState("bank");

  const inputCls = "w-full rounded-xl px-3 py-2.5 text-sm text-white bg-white/[0.07] border border-white/15 focus:outline-none focus:border-emerald-400/60 placeholder:text-white/25";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(1,3,20,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(52,211,153,0.25)]" style={{ background: DASH_CARD_BG, boxShadow: '0 40px 90px -30px rgba(0,0,0,0.8)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-4 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
            <p className="font-black text-sm text-white">Log payment received</p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Customer</label>
            <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Johnson" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Amount (£)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className="block text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className={`${inputCls} cursor-pointer`} style={{ colorScheme: 'dark' }}>
                {["bank","cash","card","cheque"].map(m => <option key={m} value={m} className="text-brand-navy">{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {parseFloat(amount) > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06] text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-[rgba(153,197,255,0.5)]">Amount received</span>
                <span className="font-bold text-emerald-300">£{parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-[rgba(153,197,255,0.5)]">Set aside for tax (25%)</span>
                <span className="font-bold text-amber-300">−£{(parseFloat(amount)*0.25).toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="font-bold text-white">Available to spend</span>
                <span className="font-black text-white">£{(parseFloat(amount)*0.75).toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              disabled={!customer || !parseFloat(amount)}
              onClick={() => { onConfirm({ customer, amount: parseFloat(amount), method }); onClose(); }}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${
                customer && parseFloat(amount)
                  ? "text-white hover:brightness-110"
                  : "bg-white/5 text-white/20 cursor-not-allowed"
              }`}
              style={customer && parseFloat(amount) ? { background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)', boxShadow: '0 8px 20px -6px rgba(4,120,87,0.55)' } : undefined}
            >
              ✓ Confirm payment
            </button>
            <button onClick={onClose} className="px-4 rounded-xl border border-white/15 text-[rgba(153,197,255,0.6)] text-xs font-bold hover:bg-white/5 transition-colors">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Set target modal ──────────────────────────────────────────────────────────
// Asks for a monthly figure (how owners actually think), saves the annual
// equivalent to business_settings so the whole app paces against it.
function SetTargetModal({ onClose, onSave }) {
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const m = parseFloat(monthly) || 0;

  const save = async () => {
    if (m <= 0) return;
    setBusy(true); setError(null);
    try {
      await onSave(m);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not save your target — try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(1,3,20,0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(251,191,36,0.3)]" style={{ background: DASH_CARD_BG, boxShadow: '0 40px 90px -30px rgba(0,0,0,0.8)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.6)]" />
            <p className="font-black text-sm text-white">Set your monthly target</p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-[rgba(153,197,255,0.5)] leading-relaxed">
            How much do you want the business bringing in each month? Cadi paces your days, weeks and year against it — you can change it any time in Settings.
          </p>
          <div>
            <label className="block text-[10px] font-black tracking-widest uppercase text-[rgba(153,197,255,0.45)] mb-1.5">Monthly target (£)</label>
            <input
              type="number" min="0" step="50" autoFocus
              value={monthly}
              onChange={e => setMonthly(e.target.value)}
              placeholder="e.g. 4000"
              className="w-full rounded-xl px-3 py-3 text-lg font-black tabular-nums text-white bg-white/[0.07] border border-white/15 focus:outline-none focus:border-amber-400/60 placeholder:text-white/25 placeholder:font-normal placeholder:text-sm"
            />
          </div>
          {m > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06] text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-[rgba(153,197,255,0.5)]">Per week</span>
                <span className="font-bold text-white tabular-nums">{fmt((m * 12) / 52)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-[rgba(153,197,255,0.5)]">Per year</span>
                <span className="font-black text-emerald-300 tabular-nums">{fmt(m * 12)}</span>
              </div>
            </div>
          )}
          {error && (
            <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300">{error}</div>
          )}
          <div className="flex gap-2">
            <button
              disabled={m <= 0 || busy}
              onClick={save}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-wide rounded-xl transition-all ${
                m > 0 && !busy ? "text-white hover:brightness-110" : "bg-white/5 text-white/20 cursor-not-allowed"
              }`}
              style={m > 0 && !busy ? { background: 'linear-gradient(180deg, #10b981 0%, #047857 100%)', boxShadow: '0 8px 20px -6px rgba(4,120,87,0.55)' } : undefined}
            >
              {busy ? 'Saving…' : '🎯 Set target'}
            </button>
            <button onClick={onClose} className="px-4 rounded-xl border border-white/15 text-[rgba(153,197,255,0.6)] text-xs font-bold hover:bg-white/5 transition-colors">Not now</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const ALL_BADGES = [
  {
    id: "first_login",
    emoji: "🚀",
    name: "Launched",
    desc: "Signed up and opened Cadi",
    color: "from-blue-500 to-brand-blue",
    border: "border-blue-300",
    check: () => true,
  },
  {
    id: "health_good",
    emoji: "💚",
    name: "Healthy Business",
    desc: "Health score reached Good (60+)",
    color: "from-emerald-400 to-emerald-600",
    border: "border-emerald-300",
    check: ({ score }) => score?.total >= 60,
  },
  {
    id: "health_great",
    emoji: "⭐",
    name: "Great Shape",
    desc: "Health score reached Great (75+)",
    color: "from-amber-400 to-orange-500",
    border: "border-amber-300",
    check: ({ score }) => score?.total >= 75,
  },
  {
    id: "health_perfect",
    emoji: "💯",
    name: "Perfect Score",
    desc: "Hit a health score of 90+",
    color: "from-purple-400 to-purple-600",
    border: "border-purple-300",
    check: ({ score }) => score?.total >= 90,
  },
  {
    id: "top_10",
    emoji: "🏆",
    name: "Top 10%",
    desc: "Ranked in the top 10% of Cadi businesses",
    color: "from-yellow-400 to-amber-500",
    border: "border-yellow-300",
    check: ({ rank, total }) => rank <= Math.ceil(total * 0.1),
  },
  {
    id: "top_25",
    emoji: "🥇",
    name: "Top 25%",
    desc: "Ranked in the top 25% of Cadi businesses",
    color: "from-amber-300 to-yellow-500",
    border: "border-amber-200",
    check: ({ rank, total }) => rank <= Math.ceil(total * 0.25),
  },
  {
    id: "invoices_clean",
    emoji: "⚡",
    name: "Speed Invoicer",
    desc: "No overdue invoices for a full week",
    color: "from-sky-400 to-blue-500",
    border: "border-sky-300",
    check: ({ invoices }) =>
      Array.isArray(invoices)
      && invoices.length > 0
      && invoices.every(i => i.status !== "overdue"),
  },
  {
    id: "schedule_full",
    emoji: "📅",
    name: "Fully Booked",
    desc: "Every day this week has at least one job",
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-300",
    check: ({ weekJobs }) =>
      Array.isArray(weekJobs)
      && weekJobs.length > 0
      && weekJobs.every(d => d.jobs > 0 || d.revenue > 0),
  },
  {
    id: "streak_7",
    emoji: "🔥",
    name: "7-Day Streak",
    desc: "Logged in 7 days in a row",
    color: "from-orange-400 to-red-500",
    border: "border-orange-300",
    check: ({ streak }) => streak >= 7,
  },
  {
    id: "streak_30",
    emoji: "🌟",
    name: "30-Day Streak",
    desc: "Logged in 30 days in a row — you're obsessed!",
    color: "from-pink-400 to-purple-500",
    border: "border-pink-300",
    check: ({ streak }) => streak >= 30,
  },
  {
    id: "founding_member",
    emoji: "👑",
    name: "Founding Member",
    desc: "One of the first 1,000 businesses on Cadi — part of the original crew",
    color: "from-yellow-300 via-amber-400 to-orange-400",
    border: "border-yellow-300",
    check: ({ foundingMember }) => foundingMember === true,
    founding: true,
  },
];

function computeBadges({ score, invoices, weekJobs, rank, totalUsers, streak, foundingMember }) {
  return ALL_BADGES.map(b => ({
    ...b,
    earned: b.check({ score, invoices, weekJobs, rank, total: totalUsers, streak, foundingMember }),
  }));
}

// ─── Badges shelf ──────────────────────────────────────────────────────────────
function BadgesShelf({ badges, onShare }) {
  const [showGuide, setShowGuide] = useState(false);
  const foundingBadge = badges.find(b => b.founding && b.earned);
  const earned  = badges.filter(b => b.earned && !b.founding);
  const locked  = badges.filter(b => !b.earned && !b.founding);

  return (
    <div className="relative overflow-hidden rounded-sm shadow-2xl shadow-brand-navy/40" style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Glow blobs */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-brand-blue/25 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-brand-skyblue/10 blur-3xl pointer-events-none" />
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/60 to-transparent" />

      <div className="relative">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-brand-skyblue/60 mb-0.5">Achievement badges</p>
            <p className="text-xs text-white/50">{badges.filter(b=>b.earned).length} of {badges.length} earned</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(v => !v)}
              className="text-[10px] font-bold text-white/40 hover:text-white/70 transition-colors border border-white/10 rounded-lg px-2 py-1"
            >
              {showGuide ? 'Hide ▲' : 'How to earn ▼'}
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-brand-blue to-[#1a3de0] text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity shadow-lg shadow-brand-blue/40"
            >
              ✨ Share
            </button>
          </div>
        </div>

        {/* How to earn guide */}
        {showGuide && (
          <div className="px-4 py-3 bg-white/5 border-b border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-skyblue mb-2">How badges work</p>
            <div className="space-y-1.5 text-xs text-white/50 leading-relaxed">
              <p>🏆 <span className="font-semibold text-white/80">Leaderboard badges</span> — reach the top 10% or 25% of Cadi businesses</p>
              <p>💚 <span className="font-semibold text-white/80">Health badges</span> — hit 60, 75 or 90 on your health score</p>
              <p>⚡ <span className="font-semibold text-white/80">Operations badges</span> — clean invoices, stay fully booked, log in daily</p>
              <p>🔥 <span className="font-semibold text-white/80">Streak badges</span> — log in 7 or 30 days in a row</p>
            </div>
          </div>
        )}

        {/* Founding member spotlight */}
        {foundingBadge && (
          <div className="mx-4 mt-4 mb-2 p-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/15 border border-yellow-400/30 flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${foundingBadge.color} flex items-center justify-center text-2xl shadow-lg border-2 border-white/20 shrink-0`}>
              {foundingBadge.emoji}
            </div>
            <div>
              <p className="text-xs font-black text-yellow-300">You're a Founding Member 👑</p>
              <p className="text-[10px] text-yellow-200/60 leading-snug mt-0.5">One of the first 1,000 businesses on Cadi — this badge is yours forever.</p>
            </div>
          </div>
        )}

        {/* Earned badges */}
        {earned.length > 0 && (
          <div className="px-4 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-skyblue/50 mb-3">Earned</p>
            <div className="flex flex-wrap gap-3">
              {earned.map(b => (
                <div key={b.id} title={b.desc} className="group relative flex flex-col items-center gap-1.5 cursor-default">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${b.color} flex items-center justify-center text-2xl shadow-xl border-2 border-white/20 transition-transform group-hover:-translate-y-1`}>
                    {b.emoji}
                  </div>
                  <span className="text-[10px] font-bold text-white/70 text-center leading-tight max-w-[56px]">{b.name}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap bg-white text-brand-navy text-[10px] font-semibold px-2 py-1.5 rounded-lg shadow-xl pointer-events-none">
                    {b.desc}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Locked badges */}
        {locked.length > 0 && (
          <div className="px-4 pb-4 border-t border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/20 mt-3 mb-3">Locked — keep going</p>
            <div className="flex flex-wrap gap-3">
              {locked.map(b => (
                <div key={b.id} title={b.desc} className="group relative flex flex-col items-center gap-1.5 cursor-default opacity-30">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/10 flex items-center justify-center text-2xl grayscale">
                    {b.emoji}
                  </div>
                  <span className="text-[10px] font-bold text-white/40 text-center leading-tight max-w-[56px]">{b.name}</span>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block whitespace-nowrap bg-white text-brand-navy text-[10px] font-semibold px-2 py-1.5 rounded-lg shadow-xl pointer-events-none">
                    🔒 {b.desc}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Elite celebration overlay ─────────────────────────────────────────────────
function EliteCelebration({ onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 7000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center"
      style={{ background: 'rgba(1,10,79,0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div className="text-center px-8 py-12 max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="relative inline-block mb-6">
          <div className="text-8xl" style={{ filter: 'drop-shadow(0 0 48px rgba(167,139,250,0.9))' }}>🏆</div>
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{ border: '2px solid rgba(167,139,250,0.5)', animation: 'scoreLand 1.2s ease-out forwards' }} />
        </div>
        <p className="text-xs font-black uppercase tracking-[0.35em] text-violet-400 mb-3">Cadi Score · 90+</p>
        <h2 className="text-4xl font-black text-white mb-3 leading-tight">Elite.</h2>
        <p className="text-sm text-white/50 leading-relaxed mb-8">
          You've hit the highest tier on Cadi. Your business is firing on all cylinders — keep it there.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-3 rounded-2xl text-sm font-black text-white shadow-2xl transition-all hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #4f78ff)', boxShadow: '0 0 32px rgba(124,58,237,0.5)' }}
        >
          ✨ Keep it there
        </button>
        <p className="text-xs text-white/20 mt-4">Tap anywhere to close</p>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardTab({ accountsData, schedulerData, invoiceData, teamData: incomingTeamData, feedData: incomingFeedData, onNavigate: onNavigateProp }) {
  const routerNavigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isPro } = usePlan();
  const [dashUpgradeReason, setDashUpgradeReason] = useState(null);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  const onNavigate = (tab) => {
    const path = `/${tab}`;
    if (!isPro && PRO_TABS.some(p => path.startsWith(p))) {
      setDashUpgradeReason(`Upgrade to Cadi Pro to access ${tab.charAt(0).toUpperCase() + tab.slice(1)}.`);
      return;
    }
    if (onNavigateProp) { onNavigateProp(tab); } else { routerNavigate(path); }
  };

  const { user, profile, updateProfile, refreshProfile } = useAuth();

  // Keep a ref so the polling closure always has the latest user id even if auth resolved after mount
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Detect return from Stripe checkout and show upgrade success modal
  useEffect(() => {
    if (!searchParams.get('upgraded')) return;
    setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('upgraded'); return p; }, { replace: true });

    let attempts = 0;
    const MAX = 12;

    function poll() {
      attempts += 1;
      const uid = userRef.current?.id;
      if (!uid || uid === 'demo-user') {
        // Auth not ready yet — wait and retry
        if (attempts < MAX) setTimeout(poll, 2000);
        return;
      }
      supabase.from('profiles').select('subscription_tier, plan').eq('id', uid).single()
        .then(({ data }) => {
          const t = data?.subscription_tier;
          if (t === 'pro' || t === 'max' || data?.plan === 'pro' || data?.plan === 'max') {
            refreshProfile(); // sync AuthContext so usePlan picks up the new tier
            setShowUpgradeSuccess(true);
          } else if (attempts < MAX) {
            setTimeout(poll, 2000);
          }
        });
    }
    // Small initial delay so auth has a chance to resolve before first poll
    setTimeout(poll, 500);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    accountsData: liveAccountsData,
    schedulerData: liveSchedulerData,
    invoiceData: liveInvoiceData,
    teamData: liveTeamData,
    feedData: liveFeedData,
    jobsToday: liveJobsToday,
    moneyEntries: liveMoneyEntries,
    isLoading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useCleanProData();
  // DataContext's job fetch runs independently of useCleanProData's own
  // settings/quotes/money fetch — on accounts with a large job history it can
  // still be in flight after dataLoading flips false, which previously let
  // the dashboard render "0 jobs today" for real jobs that just hadn't
  // arrived yet. Fold it into one combined loading flag everywhere below.
  const { jobsLoading } = useData();
  const isLive = Boolean(user) && user?.id !== 'demo-user';
  const dashboardLoading = dataLoading || jobsLoading;
  const displayName = useMemo(() => {
    const first = profile?.first_name?.trim();
    if (first) return first;

    const emailName = user?.email?.split("@")[0]?.trim();
    if (emailName) {
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }

    return "there";
  }, [profile?.first_name, user?.email]);
  const liveWeek = useMemo(() => DEMO_WEEK.map((d) => ({ ...d, revenue: 0, jobs: 0 })), []);
  const resolvedAccountsData = accountsData ?? liveAccountsData;
  const resolvedSchedulerData = schedulerData ?? liveSchedulerData;
  const resolvedInvoiceData = invoiceData ?? liveInvoiceData;
  const resolvedTeamData = incomingTeamData ?? liveTeamData;
  const resolvedFeedData = incomingFeedData ?? liveFeedData;
  // Only use demo accounts when not logged in. Live users get real data with safe zero defaults.
  const EMPTY_ACCOUNTS = {
    vatRegistered: false, taxRate: 0.20, annualTarget: 0, monthlyTarget: 0,
    ytdIncome: 0, ytdExpenses: 0, taxReserve: 0, taxReserveTarget: 0,
    // mtdStatus defaults to 'unknown' until first filing — was 'filed', which inflated empty
    // accounts' compliance score by 4 points for free.
    ytdMileageLogged: 0, ytdMileageClaimed: 0, mtdStatus: 'unknown', mtdDaysLeft: 0, sprintActive: false,
  };
  const accounts = isLive
    ? { ...EMPTY_ACCOUNTS, ...(resolvedAccountsData ?? {}) }
    : { ...DEMO_ACCOUNTS };
  const weekJobs  = resolvedSchedulerData?.weekJobs ? resolvedSchedulerData.weekJobs : (isLive ? liveWeek : DEMO_WEEK);
  const invoices  = resolvedInvoiceData ?? (isLive ? [] : DEMO_INVOICES);
  const jobsToday = liveJobsToday ?? (isLive ? [] : DEMO_JOBS_TODAY);
  const teamData = resolvedTeamData ?? (isLive ? [] : DEMO_TEAM);
  // Money Confidence hero feed — live tax-year entries, or demo pattern
  const heroEntries = isLive ? (liveMoneyEntries ?? []) : DEMO_MONEY_ENTRIES;

  const [mode,             setMode]             = useState("solo");
  const [feed,             setFeed]             = useState(isLive ? [] : DEMO_FEED);
  const [showPayModal,     setShowPayModal]     = useState(false);
  const [showTargetModal,  setShowTargetModal]  = useState(false);
  const [scoreDelta,       setScoreDelta]       = useState(0);
  const [recentPts,        setRecentPts]        = useState(null);
  // Welcome popup: show first 2 dashboard visits, then auto-dismiss
  const [dashVisitCount] = useState(() => {
    try {
      const count = parseInt(localStorage.getItem('cadi_dash_visits') || '0', 10) + 1;
      localStorage.setItem('cadi_dash_visits', String(count));
      return count;
    } catch { return 99; }
  });
  const hasJobs     = (weekJobs || []).some(d => d.jobs > 0) || (jobsToday || []).length > 0;
  const hasInvoices = (invoices || []).length > 0;
  const hasBusinessData = hasJobs || hasInvoices || (accounts?.ytdIncome ?? 0) > 0;
  const [showQuickWins,    setShowQuickWins]    = useState(true);
  const [demoMode,         setDemoMode]         = useState(false);
  const [showTour,         setShowTour]         = useState(false);
  const [showShareCard,    setShowShareCard]    = useState(false);
  const [showEliteModal,   setShowEliteModal]   = useState(false);
  const [milestone,        setMilestone]        = useState(null); // { emoji, title, body }
  const [readyBanner,      setReadyBanner]      = useState(null); // null | { services, hourlyRate, targetRevenue, sectors, structure }
  const [readyBannerDismissed, setReadyBannerDismissed] = useState(false);
  const [showMarketplaceBanner, setShowMarketplaceBanner] = useState(false);
  const [communityOptIn,   setCommunityOptIn]   = useState(() => {
    if (profile?.community_opt_in) return true;
    try { return localStorage.getItem('cadi_community_opt_in') === '1'; } catch { return false; }
  });
  // Keep the toggle in sync when it's changed elsewhere (e.g. Settings)
  useEffect(() => {
    if (profile?.community_opt_in === true) {
      setCommunityOptIn(true);
      try { localStorage.setItem('cadi_community_opt_in', '1'); } catch {}
    } else if (profile?.community_opt_in === false) {
      setCommunityOptIn(false);
      try { localStorage.removeItem('cadi_community_opt_in'); } catch {}
    }
  }, [profile?.community_opt_in]);
  const [liveBoard,        setLiveBoard]        = useState([]);
  const lastLbUpsertRef    = useRef(0);    // epoch ms of last leaderboard DB write
  const lastLbIdentityRef  = useRef(null); // identity (name|sector|region) at last write — bypass throttle when this changes

  const score   = useMemo(() => calcHealthScore({ accounts, weekJobs, invoices, jobsToday }), [accounts, weekJobs, invoices, jobsToday]);
  const actions = useMemo(() => buildActions({ accounts, invoices, jobsToday, score }), [accounts, invoices, jobsToday, score]);

  // Track login streak via localStorage
  const streak = useMemo(() => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const saved = JSON.parse(localStorage.getItem('cadi_streak') || '{}');
      if (saved.lastDate === today) return saved.count || 1;
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const newCount = saved.lastDate === yesterday ? (saved.count || 0) + 1 : 1;
      localStorage.setItem('cadi_streak', JSON.stringify({ lastDate: today, count: newCount }));
      return newCount;
    } catch { return 1; }
  }, []);

  // Track health score delta between sessions
  const healthDelta = useMemo(() => {
    try {
      const prev = parseInt(localStorage.getItem('cadi_prev_health_score') || '0', 10);
      return prev > 0 ? score.total - prev : 0;
    } catch { return 0; }
  }, [score.total]);

  // Save current score for next session comparison
  useEffect(() => {
    try { localStorage.setItem('cadi_prev_health_score', String(score.total)); } catch {}
  }, [score.total]);


  // Fetch live leaderboard on mount and when the user or opt-in status changes.
  // score.total is intentionally excluded — the user's own score is injected
  // client-side, so there's no need to re-hit the DB every time it recalculates.
  useEffect(() => {
    let cancelled = false;
    listLeaderboard(50)
      .then(rows => { if (!cancelled) setLiveBoard(rows); })
      .catch(err => {
        console.error('Failed to fetch leaderboard:', err);
        if (!cancelled) setLiveBoard([]);
      });
    return () => { cancelled = true; };
  }, [user?.id, communityOptIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync own entry to the public board when opted in (real users only).
  // Throttled to one DB write per 5 minutes — score.total is in the dep array
  // so the check runs when data refreshes, but the SELECT+UPSERT only fires
  // when the throttle window has elapsed or the user just opted in.
  useEffect(() => {
    if (!user || user.id === 'demo-user') return;
    if (!communityOptIn) {
      lastLbUpsertRef.current = 0; // reset so next opt-in writes immediately
      deleteMyEntry().catch(err => console.error('Failed to remove leaderboard entry:', err));
      return;
    }
    const FIVE_MIN = 5 * 60 * 1000;
    const now = Date.now();
    // Initialise from localStorage on first run so throttle survives page refresh
    if (!lastLbUpsertRef.current) {
      try { lastLbUpsertRef.current = parseInt(localStorage.getItem('cadi_lb_upsert') || '0', 10); } catch {}
    }
    // Bypass throttle when the identity columns (name, sector, region) have changed —
    // otherwise a rename can sit stale for up to 5 minutes.
    const identityKey = JSON.stringify([
      profile?.business_name || displayName,
      profile?.cleaner_type || 'residential',
      profile?.postcode || '',
    ]);
    const identityChanged = lastLbIdentityRef.current && lastLbIdentityRef.current !== identityKey;
    lastLbIdentityRef.current = identityKey;
    if (!identityChanged && now - lastLbUpsertRef.current < FIVE_MIN) return;
    lastLbUpsertRef.current = now;
    try { localStorage.setItem('cadi_lb_upsert', String(now)); } catch {}
    // No `score` passed — the server recomputes it from the authoritative
    // tables. Means the leaderboard number is canonical and the client can't
    // forge it. `score.total` stays in the dep list so we still re-sync when
    // the client-computed score moves (a hint that real data changed).
    upsertMyEntry({
      business_name: profile?.business_name || displayName,
      sector: profile?.cleaner_type || 'residential',
      region: (profile?.postcode || '').trim().split(' ')[0].replace(/\d.*$/, '') || null,
    }).catch(err => console.error('Failed to sync leaderboard entry:', err));
  }, [user?.id, communityOptIn, score.total, profile?.business_name, profile?.cleaner_type, profile?.postcode, displayName]);

  const isPreviewBoard = useMemo(() => (liveBoard || []).filter(r => r.owner_id !== user?.id).length < 2, [liveBoard, user?.id]);

  // Real users see ONLY real opted-in businesses — no seeded rows. Demo mode
  // keeps the padded board so the marketing/demo view always looks alive.
  const leaderboardEntries = useMemo(() => {
    const real = (liveBoard || [])
      .filter(r => r.owner_id !== user?.id)
      .map(r => ({
        id: r.owner_id,
        name: r.business_name,
        sector: r.sector,
        score: r.score,
        delta: 0,
        region: r.region || '—',
      }));
    if (isLive) return real;
    const padding = LEADERBOARD_DEMO.slice(0, Math.max(0, 20 - real.length));
    return [...real, ...padding];
  }, [liveBoard, user?.id, isLive]);

  // Build leaderboard with user injected + compute rank
  const allLeaderboard = useMemo(() => {
    const userEntry = {
      id: "me", name: profile?.business_name || displayName,
      sector: profile?.cleaner_type || "residential",
      score: score.total, delta: +3, region: "You", isMe: true,
    };
    return [...leaderboardEntries, userEntry]
      .sort((a, b) => b.score - a.score)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [score.total, profile?.business_name, profile?.cleaner_type, displayName, leaderboardEntries]);

  const userRank   = allLeaderboard.find(e => e.isMe)?.rank ?? allLeaderboard.length;
  const totalUsers = allLeaderboard.length;

  // Compute badges
  const badges = useMemo(() => computeBadges({
    score,
    invoices,
    weekJobs,
    rank: userRank,
    totalUsers,
    streak,
    foundingMember: profile?.founding_member === true,
  }), [score, invoices, weekJobs, userRank, totalUsers, streak, profile?.founding_member]);

  // Sync feed whenever real data changes (not just on login)
  useEffect(() => {
    if (isLive && resolvedFeedData && resolvedFeedData.length > 0) {
      setFeed(prev => {
        // Merge: keep any "Now" entries (locally added) at the top, then real data
        const localEntries = prev.filter(e => e.time === "Now");
        const merged = [...localEntries, ...resolvedFeedData];
        // Deduplicate by id and limit to 8
        const seen = new Set();
        return merged.filter(e => {
          if (seen.has(e.id)) return false;
          seen.add(e.id);
          return true;
        }).slice(0, 8);
      });
    }
  }, [isLive, resolvedFeedData]);

  const prevTierRef = useRef(null);
  useEffect(() => {
    if (prevTierRef.current && prevTierRef.current !== score.tier && score.tier !== "Getting Started") {
      if (score.tier === "Elite") {
        setShowEliteModal(true);
      } else {
        const msgs = {
          "Building": { emoji: "📈", title: "You're gaining momentum!", body: `Cadi Score reached ${score.total} — keep pushing!` },
          "Solid":    { emoji: "💪", title: "Solid! Business is on track.", body: `Cadi Score hit ${score.total} — your business is getting stronger.` },
          "Firing":   { emoji: "⭐", title: "Firing! You're flying!", body: `Cadi Score hit ${score.total} — you're in the top 25% of Cadi businesses.` },
        };
        const msg = msgs[score.tier];
        if (msg) {
          setMilestone(msg);
          setTimeout(() => setMilestone(null), 4000);
        }
      }
    }
    prevTierRef.current = score.tier;
  }, [score.tier, score.total]);

  // Load setup_data to power the "ready for you" first-login banner
  useEffect(() => {
    if (!user || !profile?.onboarding_complete) return;
    if (user.id === 'demo-user') return;
    (async () => {
      try {
        const { data } = await supabase
          .from('business_settings')
          .select('setup_data')
          .eq('owner_id', user.id)
          .single();
        const sd = data?.setup_data || {};
        if (sd.welcome_banner_dismissed) return;
        const services = sd.services || [];
        const hourlyRate = sd.hourly_rate;
        const targetRevenue = sd.target_revenue;
        const sectors = sd.cleaner_sectors || (profile?.cleaner_type ? [profile.cleaner_type] : []);
        const structure = profile?.biz_structure;
        const hasContent = services.length || hourlyRate || targetRevenue || sectors.length;
        if (hasContent) setReadyBanner({ services, hourlyRate, targetRevenue, sectors, structure });
      } catch { /* non-critical */ }
    })();
  }, [user, profile?.onboarding_complete, profile?.cleaner_type, profile?.biz_structure]);

  async function dismissReadyBanner() {
    setReadyBannerDismissed(true);
    if (!user || user.id === 'demo-user') return;
    try {
      const { data } = await supabase.from('business_settings').select('setup_data').eq('owner_id', user.id).maybeSingle();
      const existing = data?.setup_data || {};
      await supabase.from('business_settings').update({ setup_data: { ...existing, welcome_banner_dismissed: true } }).eq('owner_id', user.id);
    } catch { /* non-critical */ }
  }

  const handleDismissQuickWins = async () => {
    setShowQuickWins(false);
    setDemoMode(false);
    if (user) {
      try {
        await supabase.from('profiles').update({ dashboard_tour_complete: true }).eq('id', user.id);
      } catch {}
    }
  };

  const handleCommunityOptIn = async () => {
    setCommunityOptIn(true);
    try { localStorage.setItem('cadi_community_opt_in', '1'); } catch {}
    if (user) {
      try {
        await updateProfile({ community_opt_in: true });
      } catch {}
    }
  };

  // One-time marketplace interest prompt for existing users who completed onboarding without seeing the question
  useEffect(() => {
    if (!user || !isLive || !profile?.onboarding_complete) return;
    if (profile?.marketplace_interest !== undefined && profile?.marketplace_interest !== null) return;
    const key = 'cadi_mp_banner_dismissed';
    try { if (localStorage.getItem(key)) return; } catch {}
    setShowMarketplaceBanner(true);
  }, [user, isLive, profile?.onboarding_complete, profile?.marketplace_interest]);

  async function handleMarketplaceInterest(interested) {
    setShowMarketplaceBanner(false);
    try { localStorage.setItem('cadi_mp_banner_dismissed', '1'); } catch {}
    if (!user || user.id === 'demo-user') return;
    try {
      await supabase.from('profiles').update({
        marketplace_interest:    interested,
        marketplace_interest_at: interested ? new Date().toISOString() : null,
      }).eq('id', user.id);
    } catch {}
  }

  const [paymentError, setPaymentError] = useState(null);

  // Persist the monthly target as an annual figure — same row Business Lab
  // and the score engine read from — then bust the cache so it's live at once.
  const handleSaveTarget = async (monthlyTarget) => {
    if (!user || user.id === 'demo-user') return;
    const { error } = await supabase
      .from('business_settings')
      .upsert({ owner_id: user.id, annual_target: Math.round(monthlyTarget * 12) }, { onConflict: 'owner_id' });
    if (error) throw error;
    refreshData();
  };

  const handlePaymentLogged = async ({ customer, amount, method }) => {
    setPaymentError(null);
    // Save to Supabase
    try {
      await createMoneyEntry({
        client: customer,
        amount,
        date: new Date().toISOString().split('T')[0],
        method,
        kind: 'income',
      });

      // Only update feed on success. Prefix with 'local-' so locally-generated ids
      // can't collide with server ids in dedupe.
      const newEntry = {
        id:    `local-${Date.now()}`,
        icon:  "💷",
        bg:    "bg-emerald-100",
        title: `Payment received — ${customer}`,
        sub:   `£${amount.toFixed(2)} · ${method}`,
        time:  "Now",
      };
      setFeed(prev => [newEntry, ...prev.slice(0, 4)]);
      setRecentPts(3);
      setTimeout(() => setRecentPts(null), 3000);
    } catch (err) {
      console.error('Failed to save payment:', err);
      setPaymentError('Payment could not be saved. Please try again.');
      setTimeout(() => setPaymentError(null), 5000);
    }
  };

  // Today — live date
  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });
  const weekNum    = getWeekNumber();
  const taxYear    = getCurrentTaxYear();
  const taxMonth   = getTaxYearMonth();

  return (
    <>
      {/* ── Shared modals — render on all screen sizes ── */}
      {dashUpgradeReason && (
        <UpgradeModal reason={dashUpgradeReason} onClose={() => setDashUpgradeReason(null)} />
      )}
      {showUpgradeSuccess && (
        <UpgradeSuccessModal onClose={() => setShowUpgradeSuccess(false)} />
      )}
      {showPayModal && (
        <LogPaymentModal
          onConfirm={handlePaymentLogged}
          onClose={() => setShowPayModal(false)}
        />
      )}
      {showTargetModal && (
        <SetTargetModal
          onSave={handleSaveTarget}
          onClose={() => setShowTargetModal(false)}
        />
      )}
      {profile && !profile?.onboarding_complete && (
        <Onboarding isModal onComplete={() => updateProfile({ onboarding_complete: true })} />
      )}
      {showEliteModal && (
        <EliteCelebration onClose={() => setShowEliteModal(false)} />
      )}
      {showShareCard && (
        <ShareCardModal
          onClose={() => setShowShareCard(false)}
          businessName={profile?.business_name || displayName}
          sector={profile?.cleaner_type || "residential"}
          score={score}
          badges={badges}
          rank={userRank}
          totalUsers={totalUsers}
          streak={streak}
        />
      )}
      {milestone && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl bg-gradient-to-r from-brand-navy to-brand-blue border border-brand-skyblue/30 shadow-2xl flex items-center gap-4 animate-bounce">
          <span className="text-3xl">{milestone.emoji}</span>
          <div>
            <p className="text-white font-black text-sm">{milestone.title}</p>
            <p className="text-brand-skyblue/80 text-xs">{milestone.body}</p>
          </div>
          <button onClick={() => setMilestone(null)} className="text-white/40 hover:text-white text-sm ml-2">✕</button>
        </div>
      )}
      {paymentError && (
        <div className="fixed top-4 right-4 z-[400] px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <span>!</span> {paymentError}
        </div>
      )}

      {/* ── Mobile layout (< sm breakpoint) ── */}
      <div className="sm:hidden flex flex-col h-full">
        <MobileDashboard
          score={score}
          weekJobs={weekJobs}
          jobsToday={jobsToday}
          feed={feed}
          actions={actions}
          badges={badges}
          invoices={invoices}
          onNavigate={onNavigate}
          onLogPayment={() => setShowPayModal(true)}
          onShare={() => setShowShareCard(true)}
          displayName={displayName}
          isLive={isLive}
          dataLoading={dashboardLoading}
        />
      </div>

      {/* ── Desktop layout (≥ sm breakpoint) ── */}
    <div
      className="hidden sm:flex flex-col -mx-4 md:-mx-8 -mt-6 -mb-24 md:-mb-6"
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(70% 45% at 100% 0%, rgba(79,120,255,0.13) 0%, transparent 55%),
          radial-gradient(50% 40% at 0% 100%, rgba(52,211,153,0.08) 0%, transparent 60%),
          linear-gradient(180deg, #010314 0%, #030b28 55%, #01040f 100%)
        `,
      }}
    >

      {/* ── 30 Day Plan — full-width at top, visible until Phase 4 complete ── */}
      <ThirtyDayPlan onRefresh={() => {}} />

      {/* ── Header ── */}
      <div className="text-white px-4 sm:px-6 lg:px-8 pt-6 pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] uppercase text-[#99c5ff]/50 mb-1.5">
              {todayLabel} · Week {weekNum} · {taxYear} tax year
            </p>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight" style={{ textShadow: '0 0 40px rgba(79,120,255,0.3)' }}>
              {timeGreeting()}, {displayName} <span className="inline-block">👋</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Score flash */}
            {recentPts && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 rounded-sm animate-pulse">
                <span className="text-white text-xs font-bold">+{recentPts} pts</span>
              </div>
            )}
            {/* Streak badge */}
            {streak > 0 && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm cursor-default select-none ${streak >= 7 ? 'bg-orange-500/25' : 'bg-white/10'}`}
                title={`${streak}-day login streak${streak >= 30 ? ' 🌟' : streak >= 7 ? ' 🔥' : ''}`}
              >
                <span className={`text-sm leading-none ${streak >= 7 ? 'animate-pulse' : ''}`}>
                  {streak >= 30 ? '🌟' : streak >= 7 ? '🔥' : '📅'}
                </span>
                <span className={`text-xs font-bold tabular-nums ${streak >= 7 ? 'text-orange-300' : 'text-white/70'}`}>
                  {streak}d
                </span>
              </div>
            )}
            {/* Share card — badges + score share */}
            <button
              onClick={() => setShowShareCard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg, #4f78ff, #1a3de0)', boxShadow: '0 4px 14px -4px rgba(79,120,255,0.6)' }}
            >
              ✨ Share
            </button>
            {/* Live indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/10 rounded-sm">
              <span className={`w-2 h-2 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-gray-400"}`} />
              <span className="text-xs font-bold text-white">{isLive ? "Live" : "Demo"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Demo mode banner ── */}
      {demoMode && (
        <div className="bg-gradient-to-r from-brand-navy to-brand-blue/90 border-b border-brand-blue/30 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 bg-white/20 text-white rounded-sm">✨ GUIDED TOUR</span>
            <p className="text-xs font-semibold text-white/80">
              Hover over any section to find out what it does — then follow your 30 Day Plan at the top to get started.
            </p>
          </div>
          <button
            onClick={handleDismissQuickWins}
            className="text-xs text-white/50 hover:text-white font-semibold whitespace-nowrap transition-colors"
          >
            End tour ✕
          </button>
        </div>
      )}

      {/* ── Marketplace interest prompt (existing users) ── */}
      {showMarketplaceBanner && (
        <div className="mx-4 mt-4 rounded-2xl border p-4" style={{ borderColor: '#C2410C33', background: 'linear-gradient(135deg, #1a0800 0%, #05124a 100%)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: '#C2410C22' }}>🏗️</div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">We're building a marketplace for cleaners like you</p>
              <p className="text-xs text-[rgba(153,197,255,0.6)] mt-0.5 leading-relaxed">
                Cadi will connect you to FM aggregators across the UK who need reliable subcontractors. Would you be interested?
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={() => handleMarketplaceInterest(true)}
                  className="px-4 py-2 rounded-xl text-white text-xs font-bold transition-all hover:brightness-110"
                  style={{ backgroundColor: '#C2410C' }}>
                  Yes, I'm interested
                </button>
                <button onClick={() => handleMarketplaceInterest(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">
                  Not now
                </button>
              </div>
            </div>
            <button onClick={() => handleMarketplaceInterest(false)} className="text-[rgba(153,197,255,0.3)] hover:text-white text-lg leading-none shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* ── "What Cadi has ready for you" first-login banner ── */}
      {readyBanner && !readyBannerDismissed && (
        <div className="mx-4 mt-4 rounded-2xl border border-[rgba(31,72,255,0.3)] bg-gradient-to-br from-[#05124a] to-[#0a1860] p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1f48ff] text-xs font-extrabold text-white">C</div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[rgba(153,197,255,0.6)]">Cadi · Ready for you</span>
              </div>
              <p className="mt-2 text-[15px] font-bold text-white">
                Your account is pre-built, {profile?.first_name || 'there'} — here's what's already set up.
              </p>
            </div>
            <button onClick={dismissReadyBanner} className="mt-1 shrink-0 text-[rgba(153,197,255,0.4)] transition hover:text-white text-lg leading-none">✕</button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {readyBanner.sectors?.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.05)] px-3 py-2.5">
                <span className="mt-0.5 text-base">🧹</span>
                <div>
                  <div className="text-xs font-bold text-[#99c5ff]">App customised</div>
                  <div className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.55)]">
                    {readyBanner.sectors.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} edition — tools, filters and dashboard are set to your work
                  </div>
                </div>
              </div>
            )}
            {readyBanner.services?.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.05)] px-3 py-2.5">
                <span className="mt-0.5 text-base">✅</span>
                <div>
                  <div className="text-xs font-bold text-[#99c5ff]">Service menu built</div>
                  <div className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.55)]">
                    {readyBanner.services.length} services ready as quick-picks on every job card, quote and invoice
                  </div>
                </div>
              </div>
            )}
            {readyBanner.hourlyRate && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.05)] px-3 py-2.5">
                <span className="mt-0.5 text-base">💷</span>
                <div>
                  <div className="text-xs font-bold text-[#99c5ff]">Pricing pre-loaded</div>
                  <div className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.55)]">
                    £{readyBanner.hourlyRate}/hr flows into your pricing calculator, quote builder and job cards
                  </div>
                </div>
              </div>
            )}
            {readyBanner.targetRevenue && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.05)] px-3 py-2.5">
                <span className="mt-0.5 text-base">🎯</span>
                <div>
                  <div className="text-xs font-bold text-[#99c5ff]">Sprint target set</div>
                  <div className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.55)]">
                    £{Number(readyBanner.targetRevenue).toLocaleString()}/mo target is live — Cadi tracks every job against it
                  </div>
                </div>
              </div>
            )}
            {readyBanner.structure && (
              <div className="flex items-start gap-2.5 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.05)] px-3 py-2.5">
                <span className="mt-0.5 text-base">📋</span>
                <div>
                  <div className="text-xs font-bold text-[#99c5ff]">Tax & accounts configured</div>
                  <div className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.55)]">
                    {readyBanner.structure === 'sole_trader' ? 'Self Assessment SA103' : readyBanner.structure === 'limited' ? 'Corporation Tax & Companies House' : 'Accounts'} tools and defaults set
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] text-[rgba(153,197,255,0.4)]">
            All of this updates automatically as you work. You can change any setting in the Settings tab.
          </p>
        </div>
      )}


      {/* ── Loading state ── */}
      {isLive && dashboardLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-4 h-4 border-2 border-[#4f78ff] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-white/60">Loading your business data...</span>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {isLive && dataError && !dataLoading && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-400 text-lg">!</span>
            <div>
              <p className="text-sm font-semibold text-red-300">Couldn't load your data</p>
              <p className="text-xs text-red-300/60 mt-0.5">Check your connection and try again.</p>
            </div>
          </div>
          <button
            onClick={refreshData}
            className="px-4 py-2 text-xs font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Scrollable content — hidden while live data is still loading ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6" style={{ display: isLive && dashboardLoading ? 'none' : undefined }}>

          {/* ── THE 6-MODULE GRID — per the sketch ──
              Left column (wide):  Money (big) → Pending payments → Leaderboard
              Right column (rail): Score → Schedule → Marketplace (Connect) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

            {/* Left — main column */}
            <div className="lg:col-span-2 space-y-4">
              <div id="tour-money">
                {demoMode ? (
                  <DemoHint label="💷 Money Confidence — money in, out, kept, and your pace at a glance">
                    <MoneyConfidenceHero
                      entries={heroEntries}
                      accounts={accounts}
                      invoices={invoices}
                      onLogPayment={() => setShowPayModal(true)}
                      onNavigate={onNavigate}
                      onSetTarget={() => setShowTargetModal(true)}
                      isLive={isLive}
                    />
                  </DemoHint>
                ) : (
                  <MoneyConfidenceHero
                    entries={heroEntries}
                    accounts={accounts}
                    invoices={invoices}
                    onLogPayment={() => setShowPayModal(true)}
                    onNavigate={onNavigate}
                    onSetTarget={() => setShowTargetModal(true)}
                    isLive={isLive}
                  />
                )}
              </div>
              <div id="tour-pending">
                <PendingPaymentsCard invoices={invoices} onNavigate={onNavigate} />
              </div>
              <div id="tour-leaderboard">
                <LeaderboardPanel
                  userScore={score.total}
                  userBizName={profile?.business_name || displayName}
                  userSector={profile?.cleaner_type || "residential"}
                  communityOptIn={communityOptIn}
                  onOptIn={handleCommunityOptIn}
                  healthDelta={healthDelta}
                  entries={leaderboardEntries}
                  isPreview={isPreviewBoard}
                />
              </div>
            </div>

            {/* Right — rail */}
            <div className="space-y-4">
              <div id="tour-score">
                <ScoreCard score={score} actions={actions} onNavigate={onNavigate} />
              </div>
              <div id="tour-schedule">
                <ScheduleCard weekJobs={weekJobs} jobsToday={jobsToday} onNavigate={onNavigate} />
              </div>
              <div id="tour-marketplace">
                <MarketplaceCard isLive={isLive} onNavigate={onNavigate} />
              </div>
            </div>

          </div>


          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/[0.06]">
            <p className="text-xs text-[rgba(153,197,255,0.3)]">
              All figures live from your connected tabs — no manual updates needed.
            </p>
            <button onClick={() => onNavigate?.("accounts")} className="text-xs text-[#4f78ff] font-semibold hover:text-[#99c5ff] transition-colors">
              Open accounts →
            </button>
          </div>
        </div>
      </div>

      {/* ── Spotlight tour (desktop only) ── */}
      {showTour && (
        <SpotlightTour
          steps={[
            { selector: '#tour-money', emoji: '💷', title: 'Money Confidence', body: 'Your money at a glance — what came in today, this week or this month, what went out, what you kept, and whether you\'re on pace for your target. Every tile clicks through to the detail.' },
            { selector: '#tour-pending', emoji: '📨', title: 'Pending Payments', body: 'Who owes you what, overdue first. Tap any invoice to jump straight in and chase it.' },
            { selector: '#tour-leaderboard', emoji: '🏆', title: 'Community Leaderboard', body: 'See how your business ranks against other Cadi users. Your Cadi Score determines your position — climb by running a great business.' },
            { selector: '#tour-score', emoji: '📊', title: 'Cadi Score', body: 'One number for the health of your business, plus the single next move that earns you the most points.' },
            { selector: '#tour-schedule', emoji: '📆', title: 'Schedule', body: 'Today\'s progress, what\'s up next, and the shape of your week in miniature. Tap to open the full scheduler.' },
            { selector: '#tour-marketplace', emoji: '🏗️', title: 'Marketplace', body: 'Live commercial work posted by FM companies on Cadi Connect. Browse listings, bid, and win contracts near you.' },
          ]}
          onComplete={async () => {
            setShowTour(false);
            if (user && user.id !== 'demo-user') {
              await supabase.from('profiles').update({ dashboard_tour_complete: true }).eq('id', user.id);
            }
            await updateProfile({ dashboard_tour_complete: true });
          }}
        />
      )}
    </div>
    </>
  );
}
