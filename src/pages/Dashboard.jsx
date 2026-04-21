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
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCleanProData } from "../hooks/useCleanProData";
import { supabase } from "../lib/supabase";
import { createMoneyEntry } from "../lib/db/moneyDb";
import { listLeaderboard, upsertMyEntry, deleteMyEntry } from "../lib/db/leaderboardDb";
import SetupWizard from "../components/SetupWizard";
import CadiWordmark from "../components/CadiWordmark";
import SpotlightTour from "../components/SpotlightTour";
import Onboarding from "./Onboarding";

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
  const jobsLogged   = jobsTotal > 0 ? (jobsDone / jobsTotal) : 1;
  const unassigned   = jobsToday.filter(j => j.status === "unassigned").length;
  const opsScore     = Math.round((jobsLogged * 18) + (unassigned === 0 ? 7 : Math.max(0, 7 - unassigned*2)));

  // ── Invoicing (25pts) ────────────────────────────────────────────────────
  const overdueCount    = overdueInvoices.length;
  const totalUnpaid     = invoices.filter(i => i.status !== "paid").length;
  const invoicingScore  = Math.max(0, 25 - (overdueCount * 12) - (totalUnpaid > 3 ? 5 : 0));

  // ── Compliance (15pts) ───────────────────────────────────────────────────
  const taxReservePct  = accounts.taxReserveTarget > 0 ? accounts.taxReserve / accounts.taxReserveTarget : 0;
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

  const tier     = total >= 90 ? "Excellent" : total >= 75 ? "Great" : total >= 60 ? "Good" : total >= 40 ? "OK" : "Needs work";
  const tierNext = total >= 90 ? null : total >= 75 ? 90 : total >= 60 ? 75 : total >= 40 ? 60 : 40;
  const tierColor = total >= 75 ? "text-emerald-600" : total >= 50 ? "text-amber-600" : "text-red-500";

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

// ─── Health score ring ─────────────────────────────────────────────────────────
function ScoreRing({ score, tier, tierColor, size = 96 }) {
  const r          = (size / 2) - 8;
  const circ       = 2 * Math.PI * r;
  const dashOffset = circ * (1 - score / 100);
  const strokeColor = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={strokeColor} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-brand-navy leading-none">{score}</span>
        <span className={`text-xs font-bold mt-0.5 ${tierColor}`}>{tier}</span>
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

  const kpis = [
    { label: "Today's revenue",   val: fmt(todayRevenue),                   accent: "text-brand-navy"  },
    { label: "Week revenue",       val: fmt(weekRevenue),                    accent: "text-brand-navy",  sub: `${pct((weekRevenue/Math.max(weekTotal,1))*100)} of ${fmt(weekTotal)}` },
    { label: "Month income",       val: fmt(monthIncome),                   accent: "text-brand-navy",  sub: `${pct((monthIncome/accounts.monthlyTarget)*100)} of ${fmt(accounts.monthlyTarget)}` },
    { label: "Outstanding",        val: fmt(unpaidTotal),                   accent: unpaidTotal>0?"text-amber-600":"text-emerald-600" },
    { label: "Jobs today",         val: `${jobsDone}/${jobsToday}`,         accent: "text-brand-navy",  sub: "complete" },
    { label: "Tax reserve",        val: `${taxPct}%`,                       accent: taxPct>=100?"text-emerald-600":taxPct>=70?"text-amber-600":"text-red-500" },
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
function HealthPanel({ score, onNavigate, scoreDelta = 0 }) {
  const { total, dims, tier, tierNext, tierColor } = score;
  const ptsToNext  = tierNext ? tierNext - total : 0;

  return (
    <Card className="overflow-hidden">
      {/* Score hero */}
      <div className="flex items-start gap-5 p-5 border-b border-gray-100">
        <ScoreRing score={total} tier={tier} tierColor={tierColor} size={96} />
        <div className="flex-1 min-w-0">
          <SL className="mb-1">Business health score</SL>
          <p className={`text-2xl font-bold ${tierColor}`}>{tier}</p>
          <p className="text-xs text-gray-400 mt-1">
            {scoreDelta !== 0 && (
              <span className={`font-semibold ${scoreDelta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                {scoreDelta > 0 ? "↑" : "↓"} {Math.abs(scoreDelta)} pts
              </span>
            )}
            {scoreDelta !== 0 && " since last session"}
            {scoreDelta === 0 && <span className="text-gray-400">No change since last session</span>}
            {tierNext && <span className="ml-2">· <span className="font-semibold text-brand-navy">{ptsToNext} pts</span> to {tierNext === 90 ? "Excellent" : tierNext === 75 ? "Great" : "Good"}</span>}
          </p>
          {/* Tier ladder */}
          <div className="flex items-center gap-1 mt-3">
            {["Needs work","OK","Good","Great","Excellent"].map((t, i) => {
              const active = t === tier;
              const passed = ["Needs work","OK","Good","Great","Excellent"].indexOf(tier) > i;
              return (
                <div key={t} className="flex items-center gap-1">
                  <div className={`h-1.5 rounded-full transition-all ${
                    active ? "w-10 bg-brand-blue" :
                    passed ? "w-6 bg-emerald-400" :
                    "w-6 bg-gray-200"
                  }`} />
                  {i === 4 ? null : null}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {["Needs work","OK","Good","Great","Excellent"].map((t,i) => {
              const active = t === tier;
              return <span key={t} className={`text-xs ${active ? `font-bold ${tierColor}` : "text-gray-300"}`}>{t}</span>;
            })}
          </div>
        </div>
      </div>

      {/* Dimension bars */}
      <div className="px-5 py-4">
        <SL className="mb-3">What's driving your score</SL>
        <div className="space-y-2.5">
          {dims.map(({ label, score: s, max, color }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 shrink-0">{label}</span>
              <div className="flex-1 h-3 bg-gray-100 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${color} rounded-sm transition-all duration-700`}
                  style={{ width: `${(s / max) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-1 w-14 shrink-0 justify-end">
                <span className="text-xs font-mono font-bold text-gray-700">{s}</span>
                <span className="text-xs text-gray-300">/{max}</span>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => onNavigate?.("accounts")}
          className="mt-3 text-xs font-bold text-brand-blue hover:underline"
        >
          How is this calculated? →
        </button>
      </div>
    </Card>
  );
}

// ─── Priority actions panel ────────────────────────────────────────────────────
function ActionsPanel({ actions, onNavigate }) {
  const borderColor = { red: "border-l-red-500", amber: "border-l-amber-400", green: "border-l-emerald-500", blue: "border-l-brand-blue" };
  const bgColor     = { red: "hover:bg-red-50/50", amber: "hover:bg-amber-50/50", green: "hover:bg-emerald-50/50", blue: "hover:bg-blue-50/50" };
  const btnColor    = { red: "bg-red-600 hover:bg-red-700", amber: "bg-amber-500 hover:bg-amber-600", green: "bg-emerald-600 hover:bg-emerald-700", blue: "bg-brand-blue hover:bg-brand-navy" };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <SL>Priority actions</SL>
        <span className="text-xs text-gray-400">{actions.filter(a=>a.pts>0).length} things need attention</span>
      </div>
      <div className="divide-y divide-gray-100">
        {actions.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 px-4 py-3.5 border-l-2 ${borderColor[a.level] ?? "border-l-gray-200"} ${bgColor[a.level]} transition-colors`}
          >
            <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{a.title}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{a.body}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              {a.pts > 0 && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm">
                  +{a.pts}pts
                </span>
              )}
              {a.action && a.tab && (
                <button
                  onClick={() => onNavigate?.(a.tab)}
                  className={`px-3 py-1 text-white text-xs font-bold rounded-sm transition-colors whitespace-nowrap ${btnColor[a.level]}`}
                >
                  {a.action}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Week day grid ────────────────────────────────────────────────────────────
function WeekGrid({ weekJobs }) {
  const maxRevenue = Math.max(...weekJobs.map(d => d.revenue), 1);
  const weekEarned = weekJobs.filter(d => d.done || d.isToday).reduce((s,d) => s+d.revenue, 0);
  const weekTotal  = weekJobs.reduce((s,d) => s+d.revenue, 0);
  const weekPct    = weekTotal > 0 ? Math.round((weekEarned / weekTotal) * 100) : 0;

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <SL>This week — day by day</SL>
        <span className="text-xs text-gray-400">{fmt(weekEarned)} earned · {weekPct}% of target</span>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100">
        {weekJobs.map(d => (
          <div key={d.day} className={`flex flex-col items-center py-3 ${
            d.isToday ? "bg-brand-navy" : d.done ? "bg-emerald-50" : d.revenue > 0 ? "bg-white" : "bg-gray-50/50"
          }`}>
            <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${
              d.isToday ? "text-brand-skyblue" : d.done ? "text-emerald-600" : "text-gray-400"
            }`}>{d.day}</p>
            <div className="w-full h-14 flex items-end justify-center mb-2">
              {d.revenue > 0
                ? <div
                    className={`w-4 rounded-sm ${d.isToday ? "bg-brand-skyblue" : d.done ? "bg-emerald-400" : "bg-brand-blue/30"}`}
                    style={{ height: `${Math.max((d.revenue / maxRevenue) * 52, 5)}px` }}
                  />
                : <div className="w-4 h-1.5 bg-gray-200 rounded-sm" />
              }
            </div>
            <p className={`text-sm font-bold tabular-nums ${
              d.isToday ? "text-white" : d.done ? "text-emerald-700" : d.revenue > 0 ? "text-brand-navy" : "text-gray-300"
            }`}>{d.revenue > 0 ? fmt(d.revenue) : "—"}</p>
            <p className={`text-xs mt-0.5 ${d.isToday ? "text-brand-skyblue" : "text-gray-400"}`}>
              {d.isToday ? "today" : d.done ? "✓" : d.jobs > 0 ? `${d.jobs}j` : "—"}
            </p>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Week progress</span>
          <span className="font-semibold text-brand-navy">{fmt(weekEarned)} of {fmt(weekTotal)} scheduled</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${weekPct}%` }} />
        </div>
      </div>
    </Card>
  );
}

// ─── Today's jobs ──────────────────────────────────────────────────────────────
function TodaysJobs({ jobs, onNavigate }) {
  const TYPE_DOT = { residential: "bg-emerald-500", commercial: "bg-brand-blue", exterior: "bg-orange-500" };
  const STATUS_CHIP = {
    complete:     <Chip color="green">Done</Chip>,
    "in-progress":<Chip color="blue">In progress</Chip>,
    scheduled:    <Chip color="gray">Scheduled</Chip>,
    unassigned:   <Chip color="warn">Assign</Chip>,
  };

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <SL>Today's jobs</SL>
        <button onClick={() => onNavigate?.("scheduler")} className="text-xs font-bold text-brand-blue hover:underline">Full schedule →</button>
      </div>
      {jobs.length === 0 && (
        <div className="px-4 py-6 text-sm text-gray-400">No jobs yet for today.</div>
      )}
      <div className="divide-y divide-gray-100">
        {jobs.map(j => (
          <div key={j.id} className={`flex items-center gap-3 px-4 py-3 ${j.status==="complete"?"opacity-60":""}`}>
            <div className={`w-1.5 self-stretch rounded-full shrink-0 ${TYPE_DOT[j.type] ?? "bg-gray-300"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{j.customer}</p>
              <p className="text-xs text-gray-400">{j.time} · {j.postcode} · {j.service}</p>
            </div>
            <p className={`text-sm font-bold tabular-nums shrink-0 ${j.status==="complete"?"text-emerald-600":"text-brand-navy"}`}>{fmt(j.price)}</p>
            {STATUS_CHIP[j.status]}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Team panel ────────────────────────────────────────────────────────────────
function TeamPanel({ team, jobsToday, onNavigate }) {
  const unassigned = jobsToday.filter(j => j.status === "unassigned");
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <SL>Team today</SL>
        <button onClick={() => onNavigate?.("scheduler")} className="text-xs font-bold text-brand-blue hover:underline">Manage →</button>
      </div>
      <div className="divide-y divide-gray-100">
        {team.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-4 py-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.color}`}>{m.initials}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800">{m.name}</p>
              <p className="text-xs text-gray-400 truncate">{m.job}</p>
            </div>
            <Chip color={m.status === "active" ? "green" : "gray"}>{m.status === "active" ? "Active" : "Idle"}</Chip>
          </div>
        ))}
        {unassigned.map(j => (
          <div key={j.id} className="flex items-center gap-3 px-4 py-3 bg-amber-50/40">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">?</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">{j.customer} · {j.time}</p>
              <p className="text-xs text-amber-600">Unassigned — needs covering</p>
            </div>
            <button onClick={() => onNavigate?.("scheduler")} className="px-2.5 py-1 bg-amber-500 text-white text-xs font-bold rounded-sm hover:bg-amber-600 transition-colors">Assign</button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Activity feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ feed }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <SL>Recent activity</SL>
      </div>
      {feed.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-gray-400">No activity yet</p>
          <p className="text-xs text-gray-300 mt-1">Payments, invoices and completed jobs will appear here.</p>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {feed.map(item => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3">
            <div className={`w-7 h-7 rounded-full ${item.bg} flex items-center justify-center text-xs font-bold shrink-0 mt-0.5`}>
              {item.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 leading-tight">{item.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0 mt-0.5">{item.time}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── YTD target bar ────────────────────────────────────────────────────────────
function YTDBar({ accounts, onNavigate, taxYear, taxMonth }) {
  // If user hasn't set an annual target, show a setup prompt
  if (!accounts.annualTarget || accounts.annualTarget <= 0) {
    return (
      <Card className="p-5 text-center">
        <SL className="mb-2">Annual target</SL>
        <p className="text-sm text-gray-500 mb-3">Set your annual income target to track progress.</p>
        <button onClick={() => onNavigate?.("settings")} className="px-4 py-2 text-xs font-bold text-white bg-brand-blue rounded-lg hover:bg-brand-navy transition-colors">
          Set target in Settings →
        </button>
      </Card>
    );
  }

  const pct        = Math.round((accounts.ytdIncome / accounts.annualTarget) * 100);
  const remaining  = Math.max(0, accounts.annualTarget - accounts.ytdIncome);
  const monthsLeft = Math.max(1, 12 - (taxMonth || 1));
  const monthlyNeed = Math.round(remaining / monthsLeft);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <SL className="mb-1">Annual target — {taxYear || getCurrentTaxYear()}</SL>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold tabular-nums text-brand-navy">{fmt(accounts.ytdIncome)}</p>
            <p className="text-sm text-gray-400">of {fmt(accounts.annualTarget)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-brand-blue">{pct}%</p>
          <p className="text-xs text-gray-400">complete</p>
        </div>
      </div>
      <div className="relative mb-2">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${pct >= 100 ? "bg-emerald-500" : "bg-brand-blue"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        {[25, 50, 75].map(q => (
          <div key={q} className="absolute top-0 w-px h-3 bg-white/80" style={{ left: `${q}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-3">
        <span>Apr {taxYear ? taxYear.split('/')[0] : new Date().getFullYear()}</span>
        <span className="text-brand-blue font-semibold">Month {taxMonth || 1} of 12</span>
        <span>Mar {taxYear ? `20${taxYear.split('/')[1]}` : new Date().getFullYear() + 1}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-sm p-3">
          <p className="text-xs text-gray-400 mb-0.5">Still to earn</p>
          <p className="text-lg font-bold tabular-nums text-brand-navy">{fmt(remaining)}</p>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-sm p-3">
          <p className="text-xs text-gray-400 mb-0.5">Needed per month</p>
          <p className={`text-lg font-bold tabular-nums ${monthlyNeed > 6000 ? "text-amber-600" : "text-brand-navy"}`}>{fmt(monthlyNeed)}</p>
        </div>
      </div>
      <button onClick={() => onNavigate?.("money")} className="mt-3 text-xs font-bold text-brand-blue hover:underline w-full text-center">Full money dashboard →</button>
    </Card>
  );
}

// ─── Quick wins panel ─────────────────────────────────────────────────────────
const QUICK_WINS = [
  { id: "schedule", emoji: "📅", title: "Fill in a week of scheduling", sub: "Get your jobs on the calendar for the week ahead", tab: "scheduler" },
  { id: "customers", emoji: "👤", title: "Add your first customers", sub: "Log names, addresses, notes and star ratings", tab: "customers" },
  { id: "kit", emoji: "🧴", title: "Build your cleaning kit", sub: "Track your products, costs and restocking dates", tab: "inventory" },
  { id: "price", emoji: "💷", title: "Price your first job", sub: "Use the calculator to build an accurate quote", tab: "calculator" },
  { id: "sprint", emoji: "🏃", title: "Create a 90-day sprint goal", sub: "Set a target and build momentum from day one", tab: "review" },
];

function QuickWinsPanel({ onNavigate, onDismiss, savedProgress = [], onProgressChange }) {
  const [ticked, setTicked] = useState(savedProgress);
  const allDone = ticked.length === QUICK_WINS.length;

  const toggle = (id) => {
    const next = ticked.includes(id) ? ticked.filter(x => x !== id) : [...ticked, id];
    setTicked(next);
    onProgressChange?.(next);
  };

  return (
    <Card className="overflow-hidden border-brand-blue/30">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-brand-navy to-brand-blue flex items-center justify-between">
        <div>
          <SL className="text-brand-skyblue mb-0.5">Day 1 — Quick Wins</SL>
          <p className="text-sm font-bold text-white">Get started in the next 30 minutes</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-brand-skyblue">{ticked.length}/{QUICK_WINS.length}</span>
          {allDone && (
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-bold rounded-sm hover:bg-emerald-600 transition-colors"
            >
              🎉 Done!
            </button>
          )}
          {!allDone && (
            <button
              onClick={onDismiss}
              className="text-xs text-brand-skyblue/60 hover:text-brand-skyblue font-semibold"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(ticked.length / QUICK_WINS.length) * 100}%` }}
        />
      </div>
      <div className="divide-y divide-gray-100">
        {QUICK_WINS.map(win => {
          const done = ticked.includes(win.id);
          return (
            <div key={win.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${done ? "bg-emerald-50/40" : "hover:bg-gray-50"}`}>
              <button
                onClick={() => toggle(win.id)}
                className={`w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-brand-blue"
                }`}
              >
                {done && <span className="text-[10px] font-bold">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-tight ${done ? "line-through text-gray-400" : "text-gray-800"}`}>
                  {win.emoji} {win.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{win.sub}</p>
              </div>
              {!done && (
                <button
                  onClick={() => onNavigate?.(win.tab)}
                  className="shrink-0 px-3 py-1 text-xs font-bold text-brand-blue bg-blue-50 border border-blue-200 rounded-sm hover:bg-blue-100 transition-colors whitespace-nowrap"
                >
                  Go →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

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

// ─── Quick actions ─────────────────────────────────────────────────────────────
function QuickActions({ onNavigate }) {
  const ACTIONS = [
    { label: "+ Log payment",     onClick: () => onNavigate?.("money"),     color: "border-brand-blue text-brand-blue bg-blue-50 hover:bg-blue-100" },
    { label: "📤 Send reminder",  onClick: () => onNavigate?.("invoices"),  color: "border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100" },
    { label: "📊 Accounts",       onClick: () => onNavigate?.("accounts"),  color: "border-gray-200 text-gray-700 hover:bg-gray-50"                 },
    { label: "🗺️ Route planner",  onClick: () => onNavigate?.("routes"),    color: "border-gray-200 text-gray-700 hover:bg-gray-50"                 },
    { label: "📈 Business Lab",  onClick: () => onNavigate?.("scaling"),   color: "border-gray-200 text-gray-700 hover:bg-gray-50"                 },
    { label: "🏃 Sprint",         onClick: () => onNavigate?.("review"),    color: "border-gray-200 text-gray-700 hover:bg-gray-50"                 },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100"><SL>Quick actions</SL></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
        {ACTIONS.map(({ label, onClick, color }) => (
          <button
            key={label}
            onClick={onClick}
            className={`py-2.5 px-3 text-xs font-bold border rounded-sm transition-colors text-left ${color}`}
          >
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ─── Log payment modal ─────────────────────────────────────────────────────────
function LogPaymentModal({ onClose, onConfirm }) {
  const [customer, setCustomer] = useState("");
  const [amount,   setAmount]   = useState("");
  const [method,   setMethod]   = useState("bank");

  return (
    <div className="fixed inset-0 bg-brand-navy/70 z-50 flex items-end sm:items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-navy text-white">
          <p className="font-bold text-sm">Log payment received</p>
          <button onClick={onClose} className="text-brand-skyblue hover:text-white text-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Customer</label>
            <input type="text" value={customer} onChange={e => setCustomer(e.target.value)} placeholder="e.g. Johnson"
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Amount (£)</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" step="0.01"
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">Method</label>
              <select value={method} onChange={e => setMethod(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue">
                {["bank","cash","card","cheque"].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </select>
            </div>
          </div>
          {parseFloat(amount) > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-sm divide-y divide-gray-100 text-sm">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-gray-500">Amount received</span>
                <span className="font-semibold text-emerald-600">£{parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-gray-500">Set aside for tax (25%)</span>
                <span className="font-semibold text-amber-600">−£{(parseFloat(amount)*0.25).toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="font-semibold text-gray-800">Available to spend</span>
                <span className="font-bold text-brand-navy">£{(parseFloat(amount)*0.75).toFixed(2)}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              disabled={!customer || !parseFloat(amount)}
              onClick={() => { onConfirm({ customer, amount: parseFloat(amount), method }); onClose(); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide rounded-sm transition-colors ${customer && parseFloat(amount) ? "bg-brand-navy text-white hover:bg-brand-blue" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
            >
              ✓ Confirm payment
            </button>
            <button onClick={onClose} className="px-4 border border-gray-200 text-gray-500 text-xs font-bold rounded-sm hover:border-gray-300">Cancel</button>
          </div>
        </div>
      </Card>
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
    check: ({ invoices }) => invoices?.filter(i => i.status === "overdue").length === 0,
  },
  {
    id: "schedule_full",
    emoji: "📅",
    name: "Fully Booked",
    desc: "Every day this week has at least one job",
    color: "from-emerald-400 to-teal-500",
    border: "border-emerald-300",
    check: ({ weekJobs }) => weekJobs?.every(d => d.jobs > 0 || d.revenue > 0),
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
    check: () => true, // All early users earn this automatically
    founding: true,
  },
];

function computeBadges({ score, invoices, weekJobs, rank, totalUsers, streak }) {
  return ALL_BADGES.map(b => ({
    ...b,
    earned: b.check({ score, invoices, weekJobs, rank, total: totalUsers, streak }),
  }));
}

// ─── Leaderboard demo data ─────────────────────────────────────────────────────
const LEADERBOARD_DEMO = [
  { id: "l1",  name: "Sparkle & Shine",  sector: "residential", score: 97, delta: +4,  region: "SW" },
  { id: "l2",  name: "CleanPro SW",      sector: "commercial",  score: 94, delta: +1,  region: "SE" },
  { id: "l3",  name: "Crystal Clear",    sector: "exterior",    score: 91, delta: -1,  region: "NW" },
  { id: "l4",  name: "Prestige Clean",   sector: "commercial",  score: 88, delta: +6,  region: "M"  },
  { id: "l5",  name: "Gleam Team",       sector: "residential", score: 86, delta: +2,  region: "E"  },
  { id: "l6",  name: "FreshStart Svcs",  sector: "residential", score: 83, delta: -3,  region: "W"  },
  { id: "l7",  name: "AceClean Ltd",     sector: "commercial",  score: 81, delta: +5,  region: "NE" },
  { id: "l8",  name: "BrightSide Co",    sector: "exterior",    score: 79, delta: 0,   region: "SW" },
  { id: "l9",  name: "Spotless & Co",    sector: "residential", score: 77, delta: +3,  region: "SE" },
  { id: "l10", name: "ProShine NW",      sector: "exterior",    score: 74, delta: -2,  region: "NW" },
  { id: "l11", name: "Diamond Clean",    sector: "commercial",  score: 72, delta: +1,  region: "M"  },
  { id: "l12", name: "TopGloss Ltd",     sector: "residential", score: 69, delta: +4,  region: "E"  },
  { id: "l13", name: "SwiftClean Co",    sector: "exterior",    score: 66, delta: -1,  region: "SW" },
  { id: "l14", name: "Immaculate Svcs",  sector: "commercial",  score: 63, delta: +2,  region: "SE" },
  { id: "l15", name: "CleanSweep Pro",   sector: "residential", score: 60, delta: 0,   region: "W"  },
  { id: "l16", name: "PureClean UK",     sector: "exterior",    score: 57, delta: +3,  region: "NE" },
  { id: "l17", name: "GoldDust Clean",   sector: "residential", score: 53, delta: -4,  region: "NW" },
  { id: "l18", name: "MintFresh Ltd",    sector: "commercial",  score: 49, delta: +1,  region: "M"  },
  { id: "l19", name: "AllBright Svcs",   sector: "exterior",    score: 44, delta: 0,   region: "SE" },
  { id: "l20", name: "BestClean Co",     sector: "residential", score: 38, delta: +2,  region: "E"  },
];

const SECTOR_COLORS = {
  residential: { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500", label: "Residential" },
  commercial:  { bg: "bg-blue-100",    text: "text-brand-blue",  dot: "bg-brand-blue",  label: "Commercial"  },
  exterior:    { bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500",  label: "Exterior"    },
};

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

// ─── AI Boost Panel ────────────────────────────────────────────────────────────
function AiBoostPanel({ score, onNavigate }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const { total, tier, tierNext } = score;
  const ptsToNext = tierNext ? tierNext - total : 0;

  const tasks = [];
  if (score.invoicingScore < 20) tasks.push({ emoji: "⚡", text: "Chase overdue invoices — earn up to +12 pts", tab: "invoices" });
  if (score.complianceScore < 12) tasks.push({ emoji: "🛡️", text: "Top up your tax reserve to hit your target", tab: "money" });
  if (score.opsScore < 20) tasks.push({ emoji: "📅", text: "Fill gaps in this week's schedule", tab: "scheduler" });
  if (score.revScore < 20) tasks.push({ emoji: "💷", text: "Log any payments received today", tab: "money" });
  if (score.growthScore < 8) tasks.push({ emoji: "🏃", text: "Create a 90-day sprint goal in Annual Review", tab: "review" });
  if (tasks.length === 0) tasks.push({ emoji: "🎯", text: "Business running smoothly — keep it up!", tab: null });

  return (
    <Card className="overflow-hidden border-t-2 border-t-brand-blue">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <SL className="mb-0.5">🤖 Cadi AI — boost your score</SL>
          {tierNext && <p className="text-xs text-gray-400">{ptsToNext} pts to unlock <span className="font-semibold text-brand-navy">{tierNext === 90 ? "Excellent" : tierNext === 75 ? "Great" : "Good"}</span> tier</p>}
        </div>
        <button onClick={() => setDismissed(true)} className="text-xs text-gray-300 hover:text-gray-500">✕</button>
      </div>
      <div className="px-4 py-3 space-y-2">
        {tasks.slice(0, 4).map((t, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${t.tab ? 'border-brand-blue/20 bg-brand-blue/[0.03] hover:bg-brand-blue/[0.06] cursor-pointer' : 'border-emerald-200 bg-emerald-50/50'}`}
            onClick={() => t.tab && onNavigate?.(t.tab)}
          >
            <span className="text-base shrink-0">{t.emoji}</span>
            <p className="text-xs font-semibold text-gray-700 flex-1">{t.text}</p>
            {t.tab && <span className="text-xs font-bold text-brand-blue shrink-0">Go →</span>}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Onboarding scorecard — shown to new users until they've used the core tabs ──
function OnboardingScorecard({ steps, onNavigate, onPreview }) {
  const done = steps.filter(s => s.done).length;
  const total = steps.length;
  const pts = steps.filter(s => s.done).reduce((sum, s) => sum + s.pts, 0);
  const totalPts = steps.reduce((sum, s) => sum + s.pts, 0);
  const pct = Math.round((done / total) * 100);

  return (
    <div className="relative overflow-hidden rounded-sm shadow-2xl shadow-brand-navy/50" style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-blue/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-brand-skyblue/10 blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/60 to-transparent" />

      <div className="relative p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-brand-skyblue/70 mb-1">Welcome to Cadi 🌱</p>
            <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">Let's warm up your score</h2>
            <p className="text-xs sm:text-sm text-brand-skyblue/60 mt-1">Complete these steps to unlock the community leaderboard and get an accurate health score.</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl sm:text-4xl font-black text-white tabular-nums">{pts}<span className="text-base text-brand-skyblue/50">/{totalPts}</span></p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-skyblue/50">pts earned</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
            <span className="text-brand-skyblue/70">{done} of {total} complete</span>
            <span className="text-brand-skyblue">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-skyblue to-emerald-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map(step => (
            <button
              key={step.id}
              onClick={() => step.done ? null : onNavigate?.(step.tab)}
              disabled={step.done}
              className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-all ${
                step.done
                  ? "bg-emerald-500/10 border-emerald-400/30 cursor-default"
                  : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-brand-skyblue/30 active:scale-[0.99]"
              }`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base ${
                step.done ? "bg-emerald-500/20" : "bg-white/5"
              }`}>
                {step.done ? <span className="text-emerald-400 font-black">✓</span> : step.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${step.done ? "text-emerald-300 line-through" : "text-white"}`}>{step.title}</p>
                <p className="text-[11px] text-brand-skyblue/50 truncate">{step.body}</p>
              </div>
              <span className={`shrink-0 text-xs font-black tabular-nums ${step.done ? "text-emerald-400" : "text-brand-skyblue/70"}`}>+{step.pts}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-[11px] text-brand-skyblue/50">
            🔒 Leaderboard unlocks at <strong className="text-white">3 of {total}</strong> steps
          </p>
          {onPreview && (
            <button onClick={onPreview} className="text-xs font-bold text-brand-skyblue hover:text-white transition-colors">
              Preview leaderboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Leaderboard panel ────────────────────────────────────────────────────────
function LeaderboardPanel({ userScore, userBizName, userSector, communityOptIn, onOptIn, healthDelta = 0, entries }) {
  const [filter, setFilter] = useState("all");
  const [showExplainer, setShowExplainer] = useState(() => {
    try { return !localStorage.getItem('cadi_lb_explained'); } catch { return true; }
  });

  const dismissExplainer = () => {
    setShowExplainer(false);
    try { localStorage.setItem('cadi_lb_explained', '1'); } catch {}
  };

  const userEntry = {
    id: "me",
    name: communityOptIn ? (userBizName || "Your Business") : "Your Business",
    sector: userSector || "residential",
    score: userScore ?? 42,
    delta: +3,
    region: "You",
    isMe: true,
  };

  const boardSource = entries && entries.length > 0 ? entries : LEADERBOARD_DEMO;

  // Insert user into correct ranked position
  const allEntries = [...boardSource, userEntry]
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  const filtered = filter === "all"
    ? allEntries
    : allEntries.filter(e => e.sector === filter || e.isMe);

  const userRank   = allEntries.find(e => e.isMe)?.rank ?? allEntries.length;
  const totalCount = allEntries.length;
  const topPct     = Math.round((userRank / totalCount) * 100);

  const podium = allEntries.slice(0, 3);

  // Tier labels based on rank percentile
  const tierLabel = topPct <= 10 ? "Elite" : topPct <= 25 ? "Pro" : topPct <= 50 ? "Rising" : "Starter";
  const tierColor = topPct <= 10 ? "text-yellow-600" : topPct <= 25 ? "text-emerald-600" : topPct <= 50 ? "text-brand-blue" : "text-gray-500";
  const tierBg    = topPct <= 10 ? "bg-yellow-50 border-yellow-200" : topPct <= 25 ? "bg-emerald-50 border-emerald-200" : topPct <= 50 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200";

  return (
    <div className="relative overflow-hidden rounded-sm shadow-2xl shadow-brand-navy/50" style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}>
      {/* Grid texture */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Glow blobs */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-blue/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-brand-skyblue/10 blur-3xl pointer-events-none" />
      {/* Top shine */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue/60 to-transparent" />

      <div className="relative">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-brand-skyblue/60 mb-0.5">Cadi community leaderboard</p>
            <p className="text-xs text-white/40">Ranked by health score · updated weekly · preview leaderboard</p>
          </div>
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
            topPct <= 10 ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-300"
            : topPct <= 25 ? "bg-emerald-400/20 border-emerald-400/40 text-emerald-300"
            : topPct <= 50 ? "bg-brand-blue/30 border-brand-skyblue/30 text-brand-skyblue"
            : "bg-white/10 border-white/20 text-white/60"
          }`}>{tierLabel}</span>
        </div>

        {/* First-time explainer */}
        {showExplainer && (
          <div className="mx-4 mt-4 p-3 rounded-xl bg-white/5 border border-white/10 relative">
            <button onClick={dismissExplainer} className="absolute top-2 right-2 text-white/20 hover:text-white/50 text-xs">✕</button>
            <p className="text-xs font-black text-white mb-1.5">🏆 Welcome to the Cadi community</p>
            <div className="space-y-1 text-[11px] text-white/50 leading-relaxed">
              <p>• Your rank is based on your <span className="font-semibold text-white/80">Business Health Score</span> — optimise to climb</p>
              <p>• All business names are <span className="font-semibold text-white/80">anonymous</span> unless you opt in to the community</p>
              <p>• Reach <span className="font-semibold text-yellow-400">Elite tier (top 10%)</span> to unlock exclusive badges and the share card</p>
            </div>
          </div>
        )}

        {/* Community opt-in CTA */}
        {!communityOptIn && (
          <div className="mx-4 mt-4 mb-2 p-4 rounded-xl bg-gradient-to-r from-brand-blue/20 to-brand-skyblue/10 border border-brand-skyblue/25">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🏆</span>
              <div className="flex-1">
                <p className="text-sm font-black text-white mb-0.5">Join the Cadi community</p>
                <p className="text-xs text-white/50 leading-relaxed mb-3">Show your real business name, compete nationwide and get featured when you hit Elite tier.</p>
                <button
                  onClick={onOptIn}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-skyblue text-brand-navy text-xs font-black rounded-lg hover:bg-white transition-colors shadow-lg"
                >
                  Join the community →
                </button>
                <p className="text-[10px] text-white/30 mt-1.5">Your business name will appear on the leaderboard</p>
              </div>
            </div>
          </div>
        )}

        {/* Your rank hero */}
        <div className="px-4 py-4 border-y border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-skyblue/60 mb-1">Your ranking</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-white">#{userRank}</span>
              <span className="text-sm text-white/40">of {totalCount} businesses</span>
            </div>
            <p className="text-xs text-brand-skyblue/70 mt-1">
              Top <span className="font-bold text-white">{topPct}%</span> · <span className={`font-black ${topPct <= 10 ? "text-yellow-400" : topPct <= 25 ? "text-emerald-400" : topPct <= 50 ? "text-brand-skyblue" : "text-white/40"}`}>{tierLabel} tier</span>
            </p>
          </div>
          <div className="text-right">
            {healthDelta !== 0 && (
              <>
                <div className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl ${
                  healthDelta > 0 ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-red-500/20 border border-red-500/30"
                }`}>
                  <span className={`text-sm font-black ${healthDelta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {healthDelta > 0 ? `↑ +${healthDelta}` : `↓ ${healthDelta}`}
                  </span>
                  <span className={`text-[10px] ${healthDelta > 0 ? "text-emerald-400/70" : "text-red-400/70"}`}>pts</span>
                </div>
                <p className="text-[10px] text-white/25 mt-1.5">since last session</p>
              </>
            )}
          </div>
        </div>

        {/* Podium */}
        <div className="px-4 py-4 border-b border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-skyblue/50 mb-3">This week's podium</p>
          <div className="flex items-end justify-center gap-2">
            {[podium[1], podium[0], podium[2]].map((entry, i) => {
              const heights   = ["h-16", "h-24", "h-14"];
              const medals    = ["🥈", "🥇", "🥉"];
              const bgColors  = [
                "bg-gradient-to-b from-white/20 to-white/10",
                "bg-gradient-to-b from-yellow-400/60 to-amber-500/50",
                "bg-gradient-to-b from-orange-400/40 to-orange-500/30",
              ];
              if (!entry) return null;
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-lg">{medals[i]}</span>
                  <p className="text-[10px] font-bold text-white/70 text-center truncate w-full px-1">{entry.name}</p>
                  <div className={`flex items-end justify-center w-full ${heights[i]} ${bgColors[i]} rounded-t-lg border border-white/10`}>
                    <span className="text-sm font-black text-white pb-2">{entry.score}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector filter */}
        <div className="px-4 pt-3 flex gap-1.5 flex-wrap">
          {[
            { key: "all",         label: "All sectors" },
            { key: "residential", label: "🏠 Residential" },
            { key: "commercial",  label: "🏢 Commercial" },
            { key: "exterior",    label: "🪟 Exterior" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-full border transition-colors ${
                filter === f.key
                  ? "bg-brand-skyblue text-brand-navy border-brand-skyblue"
                  : "text-white/40 border-white/15 hover:border-white/30 hover:text-white/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Rankings list */}
        <div className="divide-y divide-white/5 mt-2 max-h-60 overflow-y-auto">
          {filtered.slice(0, 10).map(entry => {
            const sc = SECTOR_COLORS[entry.sector] ?? SECTOR_COLORS.residential;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${entry.isMe ? "bg-brand-skyblue/10 border-l-2 border-brand-skyblue" : "hover:bg-white/5"}`}
              >
                <span className={`text-xs font-black w-6 text-center shrink-0 ${entry.isMe ? "text-brand-skyblue" : "text-white/30"}`}>
                  #{entry.rank}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                <p className={`flex-1 text-xs font-semibold truncate ${entry.isMe ? "text-white font-black" : "text-white/60"}`}>
                  {entry.name} {entry.isMe && <span className="text-brand-skyblue font-bold">(you)</span>}
                </p>
                <span className={`text-xs font-bold tabular-nums ${entry.isMe ? "text-white" : "text-white/50"}`}>{entry.score}</span>
                {entry.delta !== 0 && (
                  <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${entry.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {entry.delta > 0 ? `↑${entry.delta}` : `↓${Math.abs(entry.delta)}`}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2.5 border-t border-white/10">
          <p className="text-[10px] text-white/25 text-center">
            {communityOptIn ? "Your business name is visible to the Cadi community" : "Join the community to show your real business name on the leaderboard"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Share card modal ─────────────────────────────────────────────────────────
function ShareCardModal({ onClose, businessName, sector, score, badges, rank, totalUsers, streak }) {
  const [copied, setCopied] = useState(false);
  const earnedBadges  = badges.filter(b => b.earned).slice(0, 4);
  const sc            = SECTOR_COLORS[sector] ?? SECTOR_COLORS.residential;
  const topPct        = Math.round(((rank ?? totalUsers) / (totalUsers ?? 1)) * 100);
  const tierColor     = score?.total >= 90 ? "#10b981" : score?.total >= 75 ? "#f59e0b" : score?.total >= 60 ? "#3b82f6" : "#9ca3af";
  const tier          = score?.tier ?? "Good";
  const r             = 38;
  const circ          = 2 * Math.PI * r;
  const dashOffset    = circ * (1 - (score?.total ?? 0) / 100);

  const handleCopy = () => {
    navigator.clipboard?.writeText("Check out my Cadi Business Health Score! 🚀 getcadi.co.uk").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-sm">

        {/* Instructions */}
        <div className="text-center mb-3">
          <p className="text-white/70 text-xs font-semibold">Screenshot this card and share it 📸</p>
        </div>

        {/* THE CARD — this is what gets screenshotted */}
        <div
          className="relative overflow-hidden rounded-3xl shadow-2xl"
          style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 40%, #091660 70%, #0d1e78 100%)', aspectRatio: '9/16', maxHeight: '75vh' }}
        >
          {/* Grid texture */}
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
          {/* Glow blobs */}
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-brand-blue/30 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-brand-skyblue/15 blur-3xl" />
          {/* Top stripe */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue to-transparent opacity-80" />

          <div className="relative h-full flex flex-col px-7 py-8 justify-between">

            {/* Top: Logo + sector */}
            <div className="flex items-center justify-between">
              <CadiWordmark height={20} />
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${sc.bg} ${sc.text} bg-opacity-20 border-current/30`}>
                {sc.label}
              </span>
            </div>

            {/* Middle: Business name + score ring */}
            <div className="flex flex-col items-center text-center gap-4">
              <div>
                <p className="text-brand-skyblue/70 text-xs font-bold uppercase tracking-widest mb-1">Business Health Score</p>
                <h2 className="text-white font-black text-2xl leading-tight tracking-tight">{businessName || "My Business"}</h2>
              </div>

              {/* Score ring — large */}
              <div className="relative" style={{ width: 140, height: 140 }}>
                <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
                  <circle cx="70" cy="70" r={r * 1.85} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                  <circle
                    cx="70" cy="70" r={r * 1.85} fill="none"
                    stroke={tierColor} strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circ * 1.85}
                    strokeDashoffset={circ * 1.85 * (1 - (score?.total ?? 0) / 100)}
                    style={{ filter: `drop-shadow(0 0 8px ${tierColor})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-white tabular-nums leading-none">{score?.total ?? 0}</span>
                  <span className="text-xs font-bold mt-1" style={{ color: tierColor }}>{tier}</span>
                </div>
              </div>

              {/* Rank badge */}
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                  <span className="text-white font-black text-lg leading-none">#{rank ?? "?"}</span>
                  <span className="text-brand-skyblue/60 text-[10px] mt-0.5">Leaderboard</span>
                </div>
                <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                  <span className="text-white font-black text-lg leading-none">Top {topPct}%</span>
                  <span className="text-brand-skyblue/60 text-[10px] mt-0.5">All businesses</span>
                </div>
                {streak > 0 && (
                  <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-white/10 border border-white/10">
                    <span className="text-white font-black text-lg leading-none">🔥 {streak}</span>
                    <span className="text-brand-skyblue/60 text-[10px] mt-0.5">Day streak</span>
                  </div>
                )}
              </div>
            </div>

            {/* Badges */}
            {earnedBadges.length > 0 && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-brand-skyblue/50 text-[10px] font-bold uppercase tracking-widest">Achievements</p>
                <div className="flex gap-3 justify-center">
                  {earnedBadges.map(b => (
                    <div key={b.id} className="flex flex-col items-center gap-1">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center text-lg shadow-lg`}>
                        {b.emoji}
                      </div>
                      <span className="text-[9px] text-white/50 font-semibold max-w-[40px] text-center leading-tight">{b.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom: Cadi branding */}
            <div className="flex flex-col items-center gap-1">
              <div className="w-16 h-px bg-white/20" />
              <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">Powered by Cadi</p>
              <p className="text-brand-skyblue/40 text-[10px]">getcadi.co.uk · Your Cleaning Business OS</p>
            </div>
          </div>
        </div>

        {/* Buttons below card */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleCopy}
            className="flex-1 py-3 bg-white text-brand-navy text-xs font-black rounded-xl hover:bg-gray-100 transition-colors"
          >
            {copied ? "✓ Copied!" : "📋 Copy link"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-white/10 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
          >
            Close
          </button>
        </div>
        <p className="text-center text-white/30 text-[10px] mt-2">Take a screenshot to share on social media</p>
      </div>
    </div>
  );
}

// ─── Welcome modal (first login only) ─────────────────────────────────────────
function WelcomeModal({ businessName, firstName, onClose }) {

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-brand-navy/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #05124a 0%, #010a4f 60%, #091660 100%)' }}>

        {/* Top glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue to-transparent opacity-60" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-brand-blue/20 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative px-6 pt-8 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/20 border border-brand-blue/30 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-brand-skyblue tracking-wide uppercase">Welcome to Cadi</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                Hey! 👋{' '}
                <span className="text-brand-skyblue">
                  {businessName || firstName || 'there'}
                </span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 mt-1 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          {/* Community welcome pill */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-300">Welcome to the Cadi community of cleaning professionals</span>
          </div>

          {/* Intro copy */}
          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[rgba(153,197,255,0.8)]">
            Allow me to introduce you to your Cadi Command Centre — this is the most powerful thing that's ever happened to your cleaning business. <span className="text-white font-semibold">Check it every morning, every evening, obsessively</span> — you're about to become <span className="text-brand-skyblue font-semibold">completely addicted to business growth.</span>
          </p>

          {/* Founding member callout */}
          <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-500/15 to-amber-500/10 border border-yellow-400/20">
            <span className="text-2xl shrink-0">👑</span>
            <div>
              <p className="text-xs font-black text-yellow-300">You're a Founding Member</p>
              <p className="text-[11px] text-yellow-200/60 leading-snug">You're one of the first 1,000 businesses on Cadi. Your Founding Member badge is already waiting on your dashboard.</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10" />

        {/* What Cadi does for you */}
        <div className="px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-skyblue/70 mb-1">What Cadi does for you</p>
          <p className="text-sm text-white font-semibold mb-4">Everything you need to build a profitable cleaning business, in one place.</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { emoji: "💰", title: "Know your money", body: "See exactly what you've earned, what's reserved for tax, and what's yours to spend — updated live." },
              { emoji: "📈", title: "Grow your score", body: "Your Business Health Score tracks revenue, ops, invoicing and growth. The higher it climbs, the stronger your business." },
              { emoji: "🏆", title: "Compete + celebrate", body: "Join the Cadi leaderboard and see how your business ranks — screenshot your milestones and share them." },
              { emoji: "🤖", title: "AI-powered pricing", body: "Generate accurate quotes in seconds. Cadi knows the UK market rates and prices every job to protect your margins." },
              { emoji: "🗓️", title: "Run smooth days", body: "Scheduler, route planner, customer records — your entire operation visible at a glance, every morning." },
              { emoji: "📊", title: "File with confidence", body: "Mileage logs, tax reserves, and MTD submissions all tracked automatically. No more stress at year end." },
            ].map(({ emoji, title, body }) => (
              <div key={title} className="flex gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-lg shrink-0">{emoji}</span>
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{title}</p>
                  <p className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.6)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-white/10" />

        {/* Dashboard info */}
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-3 p-4 rounded-xl bg-brand-blue/15 border border-brand-blue/25">
            <span className="text-xl shrink-0">📊</span>
            <div>
              <p className="text-sm font-bold text-white mb-1">Your live dashboard</p>
              <p className="text-xs leading-relaxed text-[rgba(153,197,255,0.7)]">
                Everything here updates in real time — your money, customers, and schedule all feed in automatically. The more you use Cadi, the smarter your dashboard gets.
              </p>
            </div>
          </div>

          <div className="flex gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-xl shrink-0">🏆</span>
            <div>
              <p className="text-sm font-bold text-white mb-1">Your business health score</p>
              <p className="text-xs leading-relaxed text-[rgba(153,197,255,0.7)]">
                The more you input into Cadi, the more it syncs to give you a true picture of your business. <span className="text-white font-semibold">Don't worry about the score just yet</span> — we'll come back to this once you're up and running. 😊
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-7 pt-1">
          <button
            onClick={onClose}
            className="w-full py-4 bg-brand-blue hover:bg-[#1a3de0] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-brand-blue/40 hover:shadow-brand-blue/60 hover:-translate-y-0.5 active:translate-y-0"
          >
            Let's go — show me around 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function DashboardTab({ accountsData, schedulerData, invoiceData, teamData: incomingTeamData, feedData: incomingFeedData, onNavigate: onNavigateProp }) {
  const routerNavigate = useNavigate();
  const onNavigate = onNavigateProp || ((tab) => routerNavigate(`/${tab}`));
  const { user, profile, updateProfile } = useAuth();
  const {
    accountsData: liveAccountsData,
    schedulerData: liveSchedulerData,
    invoiceData: liveInvoiceData,
    teamData: liveTeamData,
    feedData: liveFeedData,
    jobsToday: liveJobsToday,
    customerCount: liveCustomerCount,
    isLoading: dataLoading,
    error: dataError,
    refresh: refreshData,
  } = useCleanProData();
  const isLive = Boolean(user) && user?.id !== 'demo-user';
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
    ytdMileageLogged: 0, ytdMileageClaimed: 0, mtdStatus: 'filed', mtdDaysLeft: 0, sprintActive: false,
  };
  const accounts = isLive
    ? { ...EMPTY_ACCOUNTS, ...(resolvedAccountsData ?? {}) }
    : { ...DEMO_ACCOUNTS };
  const weekJobs  = resolvedSchedulerData?.weekJobs ? resolvedSchedulerData.weekJobs : (isLive ? liveWeek : DEMO_WEEK);
  const invoices  = resolvedInvoiceData ?? (isLive ? [] : DEMO_INVOICES);
  const jobsToday = liveJobsToday ?? (isLive ? [] : DEMO_JOBS_TODAY);
  const teamData = resolvedTeamData ?? (isLive ? [] : DEMO_TEAM);

  const [mode,             setMode]             = useState("solo");
  const [feed,             setFeed]             = useState(isLive ? [] : DEMO_FEED);
  const [showPayModal,     setShowPayModal]     = useState(false);
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
  const isNewUser = dashVisitCount <= 3 && !profile?.dashboard_tour_complete;
  const [showQuickWins,    setShowQuickWins]    = useState(true);
  const [demoMode,         setDemoMode]         = useState(false);
  const [showWelcome,      setShowWelcome]      = useState(dashVisitCount <= 2 && !profile?.dashboard_tour_complete);
  const [showTour,         setShowTour]         = useState(false);
  const [showShareCard,    setShowShareCard]    = useState(false);
  const [milestone,        setMilestone]        = useState(null); // { emoji, title, body }
  const [communityOptIn,   setCommunityOptIn]   = useState(() => {
    if (profile?.community_opt_in) return true;
    try { return localStorage.getItem('cadi_community_opt_in') === '1'; } catch { return false; }
  });
  const [liveBoard,        setLiveBoard]        = useState([]);

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

  // Onboarding scorecard — show for new users until they've used core tabs
  const onboardingSteps = useMemo(() => {
    const jobsAny = (weekJobs || []).some(d => d.jobs > 0) || (jobsToday || []).length > 0;
    const invoicesAny = (invoices || []).length > 0;
    const revenueAny = (accounts?.ytdIncome ?? 0) > 0;
    const customersAny = (liveCustomerCount ?? 0) > 0;
    return [
      { id: "profile",   emoji: "👋", title: "Complete your profile",     body: "Name, business, type — set in signup & onboarding", pts: 10, tab: "settings",  done: Boolean(profile?.onboarding_complete) },
      { id: "customer",  emoji: "👤", title: "Add your first customer",   body: "Log names, addresses and contact info",              pts: 10, tab: "customers", done: customersAny },
      { id: "job",       emoji: "🧹", title: "Log your first job",        body: "Schedule a clean — customer, date, price",           pts: 10, tab: "scheduler", done: jobsAny },
      { id: "invoice",   emoji: "📄", title: "Create your first invoice", body: "Turn a completed job into an invoice",               pts: 10, tab: "invoices",  done: invoicesAny },
      { id: "payment",   emoji: "💷", title: "Receive your first payment",body: "Log income in the Money tab",                        pts: 10, tab: "money",     done: revenueAny },
    ];
  }, [profile?.onboarding_complete, liveCustomerCount, weekJobs, jobsToday, invoices, accounts?.ytdIncome]);

  const leaderboardUnlocked = useMemo(() => {
    const doneCount = onboardingSteps.filter(s => s.done).length;
    try {
      if (localStorage.getItem('cadi_lb_preview') === '1') return true;
    } catch {}
    return doneCount >= 3;
  }, [onboardingSteps]);

  const previewLeaderboard = () => {
    try { localStorage.setItem('cadi_lb_preview', '1'); } catch {}
    window.location.reload();
  };

  // Fetch live leaderboard on mount + whenever the user's own score changes
  useEffect(() => {
    let cancelled = false;
    listLeaderboard(50)
      .then(rows => { if (!cancelled) setLiveBoard(rows); })
      .catch(err => {
        console.error('Failed to fetch leaderboard:', err);
        if (!cancelled) setLiveBoard([]);
      });
    return () => { cancelled = true; };
  }, [user?.id, communityOptIn, score.total]);

  // Sync own entry to the public board when opted in (real users only)
  useEffect(() => {
    if (!user || user.id === 'demo-user') return;
    if (!communityOptIn) {
      deleteMyEntry().catch(err => console.error('Failed to remove leaderboard entry:', err));
      return;
    }
    upsertMyEntry({
      business_name: profile?.business_name || displayName,
      sector: profile?.cleaner_type || 'residential',
      score: score.total,
      region: (profile?.postcode || '').trim().split(' ')[0].replace(/\d.*$/, '') || null,
    }).catch(err => console.error('Failed to sync leaderboard entry:', err));
  }, [user?.id, communityOptIn, score.total, profile?.business_name, profile?.cleaner_type, profile?.postcode, displayName]);

  // Merge live entries with demo padding so the board never looks empty
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
    const padding = LEADERBOARD_DEMO.slice(0, Math.max(0, 20 - real.length));
    return [...real, ...padding];
  }, [liveBoard, user?.id]);

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
  }), [score, invoices, weekJobs, userRank, totalUsers, streak]);

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
    if (prevTierRef.current && prevTierRef.current !== score.tier && score.tier !== "Needs work") {
      const msgs = {
        "OK":        { emoji: "📈", title: "You're gaining momentum!", body: `Health score reached ${score.total} — keep pushing!` },
        "Good":      { emoji: "💚", title: "Good tier unlocked!", body: `Health score hit ${score.total} — your business is getting stronger.` },
        "Great":     { emoji: "⭐", title: "Great tier! You're flying!", body: `Health score hit ${score.total} — you're in the top 25% of Cadi businesses.` },
        "Excellent": { emoji: "🏆", title: "EXCELLENT! Elite status!", body: `Health score hit ${score.total} — screenshot this and share it! 📸` },
      };
      const msg = msgs[score.tier];
      if (msg) {
        setMilestone(msg);
        setTimeout(() => setMilestone(null), 4000);
      }
    }
    prevTierRef.current = score.tier;
  }, [score.tier, score.total]);

  const handleDismissWelcome = () => {
    setShowWelcome(false);
    // Start the spotlight tour after first welcome
    if (dashVisitCount === 1) {
      setTimeout(() => setShowTour(true), 500);
    }
  };

  const handleDismissQuickWins = async () => {
    setShowQuickWins(false);
    setDemoMode(false);
    if (user) {
      await supabase.from('profiles').update({ dashboard_tour_complete: true }).eq('id', user.id);
    }
  };

  const handleCommunityOptIn = async () => {
    setCommunityOptIn(true);
    try { localStorage.setItem('cadi_community_opt_in', '1'); } catch {}
    // Also persist to profile in Supabase
    if (user) {
      try {
        await supabase.from('profiles').update({ community_opt_in: true }).eq('id', user.id);
      } catch {}
    }
  };

  const [paymentError, setPaymentError] = useState(null);

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

      // Only update feed on success
      const newEntry = {
        id:    Date.now(),
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
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* ── Header ── */}
      <div className="bg-brand-navy text-white px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-brand-skyblue mb-0.5">
              {timeGreeting()}, {displayName} 👋
            </p>
            <h2 className="text-lg sm:text-xl font-bold">{todayLabel}</h2>
            <p className="text-xs text-brand-skyblue/70 mt-0.5">Week {weekNum} · {taxYear} tax year</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Score flash */}
            {recentPts && (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 rounded-sm animate-pulse">
                <span className="text-white text-xs font-bold">+{recentPts} pts</span>
              </div>
            )}
            {/* Mode toggle */}
            <div className="flex bg-white/10 rounded-sm p-0.5 gap-0.5">
              {[{id:"solo",label:"Solo"},{id:"team",label:"Team"}].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-colors ${
                    mode === m.id ? "bg-white text-brand-navy" : "text-white/70 hover:text-white"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
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
              Hover over any section to find out what it does — then work through your Setup Guide below to get started.
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

      {/* ── Loading state ── */}
      {isLive && dataLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-600">Loading your business data...</span>
          </div>
        </div>
      )}

      {/* ── Error state ── */}
      {isLive && dataError && !dataLoading && (
        <div className="mx-4 mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-red-500 text-lg">!</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Couldn't load your data</p>
              <p className="text-xs text-red-600 mt-0.5">Check your connection and try again.</p>
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

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-6">

          {/* ── SOLO MODE ── */}
          {mode === "solo" && (
            <div className="space-y-4">

              {/* ── LEADERBOARD HERO — front and centre (or onboarding scorecard for new users) ── */}
              <div id="tour-leaderboard" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {!isLive || leaderboardUnlocked ? (
                    demoMode ? (
                      <DemoHint label="🏆 Cadi Leaderboard — see how your business ranks nationally">
                        <LeaderboardPanel
                          userScore={score.total}
                          userBizName={profile?.business_name || displayName}
                          userSector={profile?.cleaner_type || "residential"}
                          communityOptIn={communityOptIn}
                          onOptIn={handleCommunityOptIn}
                          entries={leaderboardEntries}
                        />
                      </DemoHint>
                    ) : (
                      <LeaderboardPanel
                        userScore={score.total}
                        userBizName={profile?.business_name || displayName}
                        userSector={profile?.cleaner_type || "residential"}
                        communityOptIn={communityOptIn}
                        onOptIn={handleCommunityOptIn}
                        healthDelta={healthDelta}
                        entries={leaderboardEntries}
                      />
                    )
                  ) : (
                    <OnboardingScorecard steps={onboardingSteps} onNavigate={onNavigate} onPreview={previewLeaderboard} />
                  )}
                </div>

                {/* Right column: Score + AI boost */}
                <div className="space-y-4">
                  {/* Health score */}
                  {profile?.dashboard_tour_complete ? (
                    demoMode ? (
                      <DemoHint label="📊 Business health score — tracks 5 dimensions of your business">
                        <HealthPanel score={score} onNavigate={onNavigate} scoreDelta={healthDelta} />
                      </DemoHint>
                    ) : (
                      <HealthPanel score={score} onNavigate={onNavigate} scoreDelta={healthDelta} />
                    )
                  ) : (
                    <Card className="overflow-hidden flex items-center justify-center min-h-[180px] border-dashed">
                      <div className="text-center px-6 py-8">
                        <div className="text-3xl mb-3">📊</div>
                        <p className="text-sm font-bold text-gray-700 mb-1">Business Health Score</p>
                        <p className="text-xs text-gray-400 mb-4">Complete your setup guide to unlock your live health score.</p>
                      </div>
                    </Card>
                  )}

                  {/* AI Boost */}
                  {demoMode ? (
                    <DemoHint label="🤖 Cadi AI — personalised tasks to boost your score">
                      <AiBoostPanel score={score} onNavigate={onNavigate} />
                    </DemoHint>
                  ) : (
                    <AiBoostPanel score={score} onNavigate={onNavigate} />
                  )}
                </div>
              </div>

              {/* ── Badges + actions ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div id="tour-badges">
                  <BadgesShelf badges={badges} onShare={() => setShowShareCard(true)} />
                </div>
                <div id="tour-actions">
                  <ActionsPanel actions={actions} onNavigate={onNavigate} />
                </div>
              </div>

              {/* ── Week + Today's jobs ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div id="tour-week"><WeekGrid weekJobs={weekJobs} /></div>
                <div id="tour-jobs"><TodaysJobs jobs={jobsToday} onNavigate={onNavigate} /></div>
              </div>

              {/* ── Activity feed ── */}
              <div id="tour-activity">
                <ActivityFeed feed={feed} />
              </div>

            </div>
          )}

          {/* ── TEAM MODE ── */}
          {mode === "team" && (
            <div className="space-y-4">

              {/* ── LEADERBOARD HERO — front and centre (or onboarding scorecard for new users) ── */}
              <div id="tour-leaderboard" className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {!isLive || leaderboardUnlocked ? (
                    demoMode ? (
                      <DemoHint label="🏆 Cadi Leaderboard — see how your business ranks nationally">
                        <LeaderboardPanel
                          userScore={score.total}
                          userBizName={profile?.business_name || displayName}
                          userSector={profile?.cleaner_type || "residential"}
                          communityOptIn={communityOptIn}
                          onOptIn={handleCommunityOptIn}
                          entries={leaderboardEntries}
                        />
                      </DemoHint>
                    ) : (
                      <LeaderboardPanel
                        userScore={score.total}
                        userBizName={profile?.business_name || displayName}
                        userSector={profile?.cleaner_type || "residential"}
                        communityOptIn={communityOptIn}
                        onOptIn={handleCommunityOptIn}
                        healthDelta={healthDelta}
                        entries={leaderboardEntries}
                      />
                    )
                  ) : (
                    <OnboardingScorecard steps={onboardingSteps} onNavigate={onNavigate} onPreview={previewLeaderboard} />
                  )}
                </div>

                {/* Right column: Score + AI boost */}
                <div className="space-y-4">
                  {profile?.dashboard_tour_complete ? (
                    demoMode ? (
                      <DemoHint label="📊 Business health score — tracks 5 dimensions of your business">
                        <HealthPanel score={score} onNavigate={onNavigate} scoreDelta={healthDelta} />
                      </DemoHint>
                    ) : (
                      <HealthPanel score={score} onNavigate={onNavigate} scoreDelta={healthDelta} />
                    )
                  ) : (
                    <Card className="overflow-hidden flex items-center justify-center min-h-[180px] border-dashed">
                      <div className="text-center px-6 py-8">
                        <div className="text-3xl mb-3">📊</div>
                        <p className="text-sm font-bold text-gray-700 mb-1">Business Health Score</p>
                        <p className="text-xs text-gray-400 mb-4">Complete your setup guide to unlock your live health score.</p>
                      </div>
                    </Card>
                  )}

                  {demoMode ? (
                    <DemoHint label="🤖 Cadi AI — personalised tasks to boost your score">
                      <AiBoostPanel score={score} onNavigate={onNavigate} />
                    </DemoHint>
                  ) : (
                    <AiBoostPanel score={score} onNavigate={onNavigate} />
                  )}
                </div>
              </div>

              {/* ── Team + Actions ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <TeamPanel team={teamData} jobsToday={jobsToday} onNavigate={onNavigate} />
                <div id="tour-actions">
                  <ActionsPanel actions={actions} onNavigate={onNavigate} />
                </div>
              </div>

              {/* ── Badges ── */}
              <div id="tour-badges">
                <BadgesShelf badges={badges} onShare={() => setShowShareCard(true)} />
              </div>

              {/* ── Week + Today's jobs ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div id="tour-week"><WeekGrid weekJobs={weekJobs} /></div>
                <div id="tour-jobs"><TodaysJobs jobs={jobsToday} onNavigate={onNavigate} /></div>
              </div>

              {/* ── Activity feed ── */}
              <div id="tour-activity">
                <ActivityFeed feed={feed} />
              </div>

            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              All figures live from your connected tabs — no manual updates needed.
            </p>
            <button onClick={() => onNavigate?.("accounts")} className="text-xs text-brand-blue font-semibold hover:underline">
              Open accounts →
            </button>
          </div>
        </div>
      </div>

      {/* ── Error toast ── */}
      {paymentError && (
        <div className="fixed top-4 right-4 z-[400] px-5 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <span>!</span> {paymentError}
        </div>
      )}

      {/* ── Log payment modal ── */}
      {showPayModal && (
        <LogPaymentModal
          onConfirm={handlePaymentLogged}
          onClose={() => setShowPayModal(false)}
        />
      )}

      {/* ── Welcome modal (first login only) ── */}
      {showWelcome && (
        <WelcomeModal
          businessName={profile?.business_name}
          firstName={displayName}
          onClose={handleDismissWelcome}
        />
      )}

      {/* ── Spotlight tour (after welcome dismissed on first visit) ── */}
      {showTour && (
        <SpotlightTour
          steps={[
            { selector: '#tour-leaderboard', emoji: '🏆', title: 'Community Leaderboard', body: 'See how your business ranks against other Cadi users. Your health score determines your position. Climb the ranks by running a great business.' },
            { selector: '#tour-badges', emoji: '🎖️', title: 'Achievement Badges', body: 'Earn badges for hitting milestones — health score targets, login streaks, fully booked weeks, and more. Share your achievements on social media.' },
            { selector: '#tour-actions', emoji: '⚡', title: 'Priority Actions', body: 'Your most urgent tasks, colour-coded by impact. Each one shows how many health score points you\'ll gain by completing it. Tap to jump straight to the right tab.' },
            { selector: '#tour-week', emoji: '📆', title: 'This Week at a Glance', body: 'Revenue bars and job count for each day. Today is highlighted. Green days are done. Tap any day to see its jobs in the Scheduler.' },
            { selector: '#tour-jobs', emoji: '🧹', title: 'Today\'s Jobs', body: 'Every job scheduled for today — customer, time, price, and status. Complete, in-progress, scheduled, or unassigned. Tap "Full schedule" to manage them.' },
            { selector: '#tour-activity', emoji: '🔔', title: 'Activity Feed', body: 'A live log of everything happening in your business — payments received, invoices sent, jobs completed. Updates automatically as you work.' },
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

      {/* ── Onboarding sequence (first-time users, after welcome modal) ── */}
      {!showWelcome && profile && !profile?.onboarding_complete && (
        <Onboarding isModal onComplete={() => updateProfile({ onboarding_complete: true })} />
      )}

      {/* ── Share card modal ── */}
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

      {/* ── Milestone celebration ── */}
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
    </div>
  );
}
