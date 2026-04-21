// src/components/StaffingTab.jsx
// Cadi — Staffing Tab
//
// Five sections — works as a guided flow for first-time employers,
// or jump straight to any section for experienced users.
//
//   01  Team overview   — staff cards, headcount, wage bill, quick stats
//   02  Onboarding      — UK compliance checklist, Right to Work, contract generator
//   03  Interview       — question bank, scoring rubric, red flags, offer letter
//   04  Training        — 4 templates + AI plan builder + 30/60/90 feedback framework
//   05  Pay & payroll   — custom rates synced to all tabs, payslip generator, holiday tracker
//
// Pay rates set here flow into:
//   PricingCalculator  — "who's cleaning" profit waterfall
//   BusinessLabTab     — hire a cleaner wage slider
//   MoneyTab           — total monthly wage bill
//   OrgChart           — role card costs
//
// Props:
//   onStaffUpdate(staff[]) — callback so other tabs receive updated rates
//   onNavigate(tab)        — deep-link to another tab

import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// ─── Demo staff data ───────────────────────────────────────────────────────────
const DEMO_STAFF = [
  {
    id: 1,
    name: "Jamie Turner",
    role: "cleaner",
    roleLabel: "Cleaner",
    status: "active",
    startDate: "2026-01-15",
    phone: "07700 900201",
    email: "jamie.turner@email.com",
    address: "14 Elm Street, London SW4 8QR",
    niNumber: "AB 12 34 56 C",
    payType: "hourly",
    hourlyRate: 13.00,
    hoursPerWeek: 30,
    payFrequency: "weekly",
    bankName: "Starling Bank",
    bankSortCode: "60-83-71",
    bankAccount: "12345678",
    holidayEntitlement: 16.8,
    holidayTaken: 3,
    onboardingComplete: { rtw: true, contract: true, paye: false, ni: false, insurance: false, dbs: true, emergency: true, pension: false, bankDetails: true, uniform: false, keys: false, photo: true },
    training: {
      templateId: "new-cleaner",
      weeks: [
        { id: 1, title: "Week 1 — Standards & safety",    status: "complete",     tasks: ["COSHH awareness","PPE use","Dilution ratios","Client communication","Uniform standards"] },
        { id: 2, title: "Week 2 — Shadow on jobs",         status: "in-progress",  tasks: ["3 accompanied jobs","Room-by-room checklist","Time management","Handling complaints"] },
        { id: 3, title: "Week 3 — Solo supervised",        status: "not-started",  tasks: ["First solo jobs","Check-in call protocol","Quality sign-off checklist","Problem escalation"] },
        { id: 4, title: "Week 4 — Review & sign-off",      status: "not-started",  tasks: ["30-day review","Quality audit","Confirm schedule","Set 90-day goals"] },
      ],
      taskCompletions: { "1-0":true, "1-1":true, "1-2":true, "1-3":true, "1-4":true, "2-0":true, "2-1":false, "2-2":false, "2-3":false },
      notes: {},
    },
    interviews: [],
    notes: "Reliable, good with clients. Prefers mornings. Has own transport.",
    emergencyContact: "Sarah Turner — 07700 900202",
    avatar: "JT",
    avatarBg: "bg-amber-100 text-amber-800",
  },
  {
    id: 2,
    name: "Sarah Mills",
    role: "lead",
    roleLabel: "Team Lead",
    status: "active",
    startDate: "2025-06-01",
    phone: "07700 900301",
    email: "sarah.mills@email.com",
    address: "22 Oak Avenue, London SW6 4AS",
    niNumber: "CD 98 76 54 E",
    payType: "hourly",
    hourlyRate: 15.50,
    hoursPerWeek: 40,
    payFrequency: "monthly",
    bankName: "Monzo",
    bankSortCode: "04-00-04",
    bankAccount: "87654321",
    holidayEntitlement: 22.4,
    holidayTaken: 5,
    onboardingComplete: { rtw: true, contract: true, paye: true, ni: true, insurance: true, dbs: true, emergency: true, pension: true, bankDetails: true, uniform: true, keys: true, photo: true },
    training: {
      templateId: "team-lead",
      weeks: [
        { id: 1, title: "Week 1 — Leadership foundations",  status: "complete",    tasks: ["Role expectations","Team communication","Schedule management","Quality standards"] },
        { id: 2, title: "Week 2 — Client relationships",    status: "complete",    tasks: ["Client retention","Complaint handling","Upsell opportunities","Reporting"] },
        { id: 3, title: "Week 3 — Team management",         status: "complete",    tasks: ["Briefing staff","Performance monitoring","Conflict resolution","Coverage planning"] },
        { id: 4, title: "Week 4 — Operations",              status: "complete",    tasks: ["Scheduling","Invoicing overview","Supply management","KPI tracking"] },
        { id: 5, title: "Week 5 — Review & autonomy",       status: "complete",    tasks: ["60-day review","Solo accountability","Handover process","90-day goals"] },
      ],
      taskCompletions: {},
      notes: {},
    },
    interviews: [],
    notes: "Excellent team player. Reliable cover supervisor. Has commercial cleaning experience.",
    emergencyContact: "Tom Mills — 07700 900302",
    avatar: "SM",
    avatarBg: "bg-emerald-100 text-emerald-800",
  },
];

// ─── Training templates ────────────────────────────────────────────────────────
const TRAINING_TEMPLATES = {
  "new-cleaner": {
    label: "New cleaner — 4-week induction",
    desc: "Residential cleaning, no prior experience required",
    weeks: [
      { title: "Week 1 — Standards & safety",  tasks: ["COSHH chemical awareness & safe handling","Correct product dilution ratios","PPE selection and use","Client communication basics","Uniform & presentation standards","Company values and expectations"] },
      { title: "Week 2 — Shadow on jobs",       tasks: ["3 accompanied jobs with senior cleaner","Room-by-room cleaning checklist walkthrough","Time management on site","Dealing with client requests politely","How to handle a complaint on-site"] },
      { title: "Week 3 — Solo supervised",      tasks: ["First solo jobs with check-in call","Quality self-check before leaving","Post-job client follow-up process","Problem escalation — who to call and when","Logging jobs in the app"] },
      { title: "Week 4 — Review & sign-off",    tasks: ["30-day review conversation with manager","Quality audit of one full job","Confirm ongoing schedule and route","Set 90-day personal goals","Introduction to pay and holiday process"] },
    ],
  },
  "team-lead": {
    label: "Team Lead — 5-week programme",
    desc: "Stepping up from cleaner to first management role",
    weeks: [
      { title: "Week 1 — Leadership foundations", tasks: ["Role expectations and scope of authority","Team communication standards","Understanding the weekly schedule","Quality standards and what to inspect","Escalation process"] },
      { title: "Week 2 — Client relationships",   tasks: ["Client retention — why it matters","Handling complaints at team lead level","Spotting upsell opportunities ethically","Client visit reporting and sign-off"] },
      { title: "Week 3 — Team management",        tasks: ["How to brief staff before a job","Monitoring performance without micromanaging","Conflict resolution — scripts and approach","Planning coverage for absences"] },
      { title: "Week 4 — Operations",             tasks: ["Schedule management basics","Understanding invoicing and pricing","Supply ordering and stock control","Weekly KPI review process"] },
      { title: "Week 5 — Review & autonomy",      tasks: ["60-day performance review","Solo decision-making accountability","Handover process when you're off","Setting team 90-day goals"] },
    ],
  },
  "commercial": {
    label: "Commercial specialist — 4-week programme",
    desc: "Office, retail, or industrial cleaning contracts",
    weeks: [
      { title: "Week 1 — Commercial standards",   tasks: ["BICS standards overview","Commercial vs residential differences","Site induction requirements","COSHH for commercial chemicals","PPE for commercial environments","Lone working safety protocols"] },
      { title: "Week 2 — Site procedures",         tasks: ["Access and security — keys, fobs, alarms","Out-of-hours working procedures","Commercial client communication","Signing in and out of sites","Completion sheets and sign-off documents"] },
      { title: "Week 3 — Specialist tasks",        tasks: ["Hard floor care and machinery","Carpet extraction equipment","Washroom hygiene standards","Waste segregation","Consumables restocking process"] },
      { title: "Week 4 — Contract management",     tasks: ["Understanding SLA requirements","Audit preparation","Reporting maintenance issues","Quality checks and photo evidence","30-day contract review"] },
    ],
  },
  "exterior": {
    label: "Exterior / window specialist — 3-week programme",
    desc: "Window rounds, gutters, pressure washing",
    weeks: [
      { title: "Week 1 — Equipment & safety",     tasks: ["Water-fed pole setup and maintenance","Ladder safety and hierarchy regulations","Working at height risk assessment","PASMA awareness (if scaffold needed)","Equipment daily checks and sign-off"] },
      { title: "Week 2 — Technique & standards",  tasks: ["Pure water window cleaning technique","Streak-free quality standard","Gutter vacuum system operation","Pressure washer settings by surface","Post-job quality check process"] },
      { title: "Week 3 — Rounds & routing",       tasks: ["Understanding window round cycles (6/8/12 weeks)","Efficient routing and time management","Client access — key safe protocols","Reporting damage or issues found","Upsell scripts — gutters, fascias, driveways"] },
    ],
  },
};

// ─── Interview question banks ─────────────────────────────────────────────────
const INTERVIEW_QUESTIONS = {
  cleaner: [
    { category: "Reliability",   q: "Tell me about a time you had to manage your own schedule without supervision. How did you make sure everything got done?", why: "Cleaning is mostly unsupervised. You need to know they can self-manage.", maxScore: 5 },
    { category: "Attitude",      q: "What does a clean property mean to you? How do you know when a job is done properly?", why: "Reveals standards and pride in their work. Vague answers suggest low standards.", maxScore: 5 },
    { category: "Client-facing", q: "If a client came home while you were cleaning and said they weren't happy with something, what would you do?", why: "De-escalation matters more than cleaning skill here. A defensive response is a red flag.", maxScore: 5 },
    { category: "Honesty",       q: "Have you ever accidentally broken or damaged something at a client's property? What did you do?", why: "Everyone has. Looking for honesty and maturity, not perfection.", maxScore: 5 },
    { category: "Availability",  q: "What days and hours are you available, and is that consistent week to week? Do you have your own transport?", why: "Reliability and logistics. A cleaning round only works if someone turns up consistently.", maxScore: 5 },
    { category: "Compliance",    q: "Are you happy to provide a right to work document before your start date and consent to a basic DBS check?", why: "Legal requirement. Any hesitation is a significant red flag — this is non-negotiable.", maxScore: 5 },
  ],
  lead: [
    { category: "Leadership",    q: "Tell me about a time you had to give someone constructive feedback. How did you approach it?", why: "Team leads need to give feedback regularly. Looking for directness without aggression.", maxScore: 5 },
    { category: "Problem-solving",q: "If one of your team called in sick an hour before a job, what would you do?", why: "Operational thinking under pressure. There's no single right answer — looking for decisiveness.", maxScore: 5 },
    { category: "Standards",     q: "How would you spot if a team member's quality was slipping, and what would you do about it?", why: "Proactive quality management is the main value of a team lead.", maxScore: 5 },
    { category: "Clients",       q: "A client calls you directly to complain about a team member. How do you handle it?", why: "Tests loyalty to both client and staff. A good answer balances both fairly.", maxScore: 5 },
    { category: "Reliability",   q: "What does dependability mean to you as a team lead?", why: "Open question. Reveals whether they understand the responsibility of a supervisory role.", maxScore: 5 },
    { category: "Compliance",    q: "Are you happy to provide a right to work document and consent to an enhanced DBS check?", why: "Team leads may handle keys, have greater client access — enhanced DBS is appropriate.", maxScore: 5 },
  ],
};

const RED_FLAGS = [
  "Vague or dismissive answers about previous employers — 'we just didn't get on' with no detail",
  "Unexplained gaps in availability that don't add up or change between questions",
  "Any hesitation or deflection on Right to Work or DBS consent — this is non-negotiable",
  "Reluctance to provide references — 'I'd rather you didn't contact them'",
  "Over-promising on skills or experience with no specific examples to back it up",
  "Negative attitude toward previous clients or employers during the interview",
  "Inability to describe their own cleaning standards in concrete terms",
];

// ─── UK compliance checklist definition ───────────────────────────────────────
const CHECKLIST_ITEMS = [
  { id: "rtw",        label: "Right to Work check — document sighted and copied",         tier: "required",    detail: "Must see and copy original document (passport, BRP, or share code verification). Keep a copy on file. Legal requirement — failure is a criminal offence." },
  { id: "contract",   label: "Written statement of particulars signed",                    tier: "required",    detail: "Legally required from day one since April 2020. Must include: employer name, job title, start date, pay rate, working hours, holiday entitlement, notice period." },
  { id: "paye",       label: "Added to PAYE payroll — HMRC starter checklist complete",   tier: "required",    detail: "Register as an employer with HMRC if you haven't already. Complete a starter checklist (P46 equivalent) for each new employee before their first pay date." },
  { id: "ni",         label: "National Insurance number collected and recorded",           tier: "required",    detail: "Required for payroll submissions. If the employee doesn't have one, they must apply to HMRC. You can still pay them while they wait, but you need it on file." },
  { id: "insurance",  label: "Employer liability insurance policy updated",               tier: "required",    detail: "You must have employer liability insurance as soon as you have an employee. Minimum £5m cover. Update your policy to include the new hire's name and role." },
  { id: "pension",    label: "Auto-enrolment pension eligibility assessed",               tier: "recommended", detail: "If they're over 22 and earning over £10,000/yr (even across multiple jobs), you must auto-enrol them in a workplace pension. NEST is the free government option." },
  { id: "dbs",        label: "Basic DBS check applied for",                                tier: "recommended", detail: "Not legally required for domestic cleaning, but strongly recommended. Clients will ask. Apply via the DBS Update Service — £18 for basic check." },
  { id: "emergency",  label: "Emergency contact details collected",                        tier: "recommended", detail: "Name, relationship, phone number. Essential for lone working situations." },
  { id: "bankDetails",label: "Bank details collected for payroll",                         tier: "recommended", detail: "Sort code and account number. Store securely." },
  { id: "uniform",    label: "Uniform or PPE kit issued and logged",                       tier: "optional",    detail: "Log what was issued and when. Useful for disputes about return of equipment on leaving." },
  { id: "keys",       label: "Key / access fob issued and logged",                         tier: "optional",    detail: "Record which client keys they hold. Essential for security and liability." },
  { id: "photo",      label: "Photo for team dashboard uploaded",                          tier: "optional",    detail: "Makes the team dashboard more personal and easier to use on mobile." },
];

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmt  = n => `£${Math.round(Math.abs(+n)).toLocaleString()}`;
const fmt2 = n => `£${Math.abs(+n).toFixed(2)}`;
const fmtDate = d => d ? new Date(d).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) : "—";

// ─── Shared UI ─────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }) =>
  <div className={`bg-white border border-gray-200 rounded-sm ${className}`}>{children}</div>;

const SL = ({ children, className = "" }) =>
  <p className={`text-xs font-bold tracking-widest uppercase text-gray-400 ${className}`}>{children}</p>;

function Chip({ children, color = "gray" }) {
  const s = {
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    blue:   "bg-blue-50 text-brand-blue border-blue-200",
    green:  "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    navy:   "bg-brand-navy text-white border-brand-navy",
    sky:    "bg-brand-skyblue/20 text-brand-navy border-brand-skyblue",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-bold border ${s[color]||s.gray}`}>{children}</span>;
}

function Alert({ type = "blue", children }) {
  const s = { warn:"bg-amber-50 border-amber-200 text-amber-800", green:"bg-emerald-50 border-emerald-200 text-emerald-800", blue:"bg-blue-50 border-blue-200 text-blue-800", red:"bg-red-50 border-red-200 text-red-800" };
  const icons = { warn:"!", green:"✓", blue:"i", red:"!" };
  return (
    <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-sm ${s[type]}`}>
      <span className="shrink-0 mt-0.5 text-xs font-bold w-4 text-center">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

// Progress ring SVG
function ProgressRing({ pct, size = 36, strokeWidth = 3 }) {
  const r    = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct / 100);
  const col  = pct === 100 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#94a3b8";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  );
}

// Onboarding progress %
function onboardPct(staff) {
  const vals = Object.values(staff.onboardingComplete);
  return Math.round((vals.filter(Boolean).length / vals.length) * 100);
}

// Training progress %
function trainingPct(staff) {
  const completions = Object.values(staff.training.taskCompletions || {});
  const totalTasks  = staff.training.weeks.reduce((s, w) => s + w.tasks.length, 0);
  return totalTasks > 0 ? Math.round((completions.filter(Boolean).length / totalTasks) * 100) : 0;
}

// Monthly cost
function monthlyCost(s) {
  return (s.hourlyRate * s.hoursPerWeek * 52) / 12;
}

// ─── AI training plan via Claude API ─────────────────────────────────────────
async function generateTrainingPlan(roleDesc, weeks) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `You are an expert cleaning business trainer in the UK. Generate a ${weeks}-week training plan for: "${roleDesc}".

Respond ONLY with valid JSON (no markdown):
{
  "weeks": [
    {
      "title": "Week N — Theme",
      "tasks": ["task 1", "task 2", "task 3", "task 4", "task 5"]
    }
  ]
}

Each week must have 4–6 specific, practical tasks. Week ${weeks} must include a review conversation and goal-setting.`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = await r.json();
  return JSON.parse((d.content?.[0]?.text ?? "").replace(/```json|```/g, "").trim());
}

// ─── AI offer / rejection letter ─────────────────────────────────────────────
async function generateLetter(type, staff, role, rate, startDate, hours) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: type === "offer"
          ? `Write a concise UK employment offer letter for a cleaning business. Candidate: ${staff}. Role: ${role}. Rate: £${rate}/hr. Hours: ${hours} per week. Start date: ${startDate}. Include: job title, start date, pay rate, hours, notice period (1 week), holiday entitlement (5.6 weeks). End with a signature line. Professional but warm. No subject line, no placeholders.`
          : `Write a brief, professional, legally safe rejection letter for a cleaning job applicant in the UK. Candidate name: ${staff}. No specific reason — just thank them for their time, say the role has been filled, wish them well. Three sentences maximum. No subject line.`,
      }],
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = await r.json();
  return d.content?.[0]?.text ?? "";
}

// ─── SECTION: Team Overview ───────────────────────────────────────────────────
function TeamOverview({ staff, onSelectStaff, onAddStaff }) {
  const totalWage  = staff.reduce((s, p) => s + monthlyCost(p), 0);
  const totalHours = staff.reduce((s, p) => s + p.hoursPerWeek, 0);
  const active     = staff.filter(p => p.status === "active").length;
  const onboarding = staff.filter(p => p.status === "onboarding").length;

  const STATUS_STYLE = {
    active:     "bg-emerald-500",
    onboarding: "bg-amber-400",
    "on-leave": "bg-blue-400",
    inactive:   "bg-gray-300",
  };
  const STATUS_LABEL = {
    active:     "Active",
    onboarding: "Onboarding",
    "on-leave": "On leave",
    inactive:   "Inactive",
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-sm overflow-hidden">
        {[
          { label: "Team members",   value: staff.length,           accent: "text-brand-navy" },
          { label: "Monthly wages",  value: fmt(totalWage),         accent: "text-red-500"   },
          { label: "Total hrs/wk",   value: `${totalHours}hrs`,     accent: "text-brand-navy" },
          { label: "Onboarding",     value: onboarding,             accent: onboarding > 0 ? "text-amber-600" : "text-brand-navy" },
        ].map(({ label, value, accent }) => (
          <div key={label} className="bg-white px-4 py-3">
            <SL className="mb-0.5">{label}</SL>
            <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Staff cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {staff.map(p => {
          const oPct = onboardPct(p);
          const tPct = trainingPct(p);
          return (
            <button
              key={p.id}
              onClick={() => onSelectStaff(p)}
              className="text-left border border-gray-200 rounded-sm bg-white hover:border-brand-blue hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${p.avatarBg}`}>
                  {p.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_STYLE[p.status] || "bg-gray-300"}`} />
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{p.roleLabel} · {STATUS_LABEL[p.status]}</p>
                  <p className="text-sm font-bold text-brand-navy tabular-nums">
                    {fmt2(p.hourlyRate)}/hr · {p.hoursPerWeek}h/wk
                  </p>
                </div>
              </div>
              {/* Progress indicators */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400">Onboarding</p>
                    <p className={`text-xs font-bold ${oPct === 100 ? "text-emerald-600" : oPct >= 50 ? "text-amber-600" : "text-red-500"}`}>{oPct}%</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${oPct===100?"bg-emerald-500":oPct>=50?"bg-amber-400":"bg-red-400"}`} style={{width:`${oPct}%`}} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-400">Training</p>
                    <p className={`text-xs font-bold ${tPct===100?"text-emerald-600":tPct>=50?"text-amber-600":"text-gray-400"}`}>{tPct}%</p>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${tPct===100?"bg-emerald-500":tPct>=50?"bg-amber-400":"bg-gray-200"}`} style={{width:`${tPct}%`}} />
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Started {fmtDate(p.startDate)}</p>
            </button>
          );
        })}

        {/* Add staff */}
        <button
          onClick={onAddStaff}
          className="border-2 border-dashed border-gray-200 rounded-sm flex flex-col items-center justify-center gap-2 p-8 hover:border-brand-blue hover:text-brand-blue text-gray-300 transition-colors"
        >
          <span className="text-2xl leading-none font-light">+</span>
          <span className="text-xs font-bold uppercase tracking-widest">Add staff member</span>
        </button>
      </div>
    </div>
  );
}

// ─── SECTION: Onboarding ──────────────────────────────────────────────────────
function OnboardingSection({ person, onUpdate }) {
  const [expandedItem, setExpandedItem] = useState(null);
  const completed = Object.values(person.onboardingComplete).filter(Boolean).length;
  const total     = Object.values(person.onboardingComplete).length;
  const pct       = Math.round((completed / total) * 100);

  const toggle = (id) => {
    onUpdate({
      ...person,
      onboardingComplete: {
        ...person.onboardingComplete,
        [id]: !person.onboardingComplete[id],
      },
    });
  };

  const tiers = ["required", "recommended", "optional"];
  const tierConfig = {
    required:    { label: "Legally required — must complete before first day", border: "border-l-red-500",   bg: "bg-red-50/40",    badge: "bg-red-50 text-red-700 border border-red-200" },
    recommended: { label: "Strongly recommended",                               border: "border-l-amber-400", bg: "bg-amber-50/30",  badge: "bg-amber-50 text-amber-700 border border-amber-200" },
    optional:    { label: "Optional but good practice",                         border: "border-l-gray-300",  bg: "bg-gray-50/30",   badge: "bg-gray-100 text-gray-500 border border-gray-200" },
  };

  return (
    <div className="space-y-4">
      {/* Progress hero */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-5 p-5 bg-brand-navy text-white">
          <ProgressRing pct={pct} size={56} strokeWidth={4} />
          <div>
            <p className="text-xs font-bold uppercase tracking-widests text-brand-skyblue mb-1">Onboarding checklist</p>
            <p className="text-xl font-bold">{completed} of {total} complete</p>
            <p className="text-xs text-brand-skyblue/70 mt-0.5">
              {pct === 100 ? "Fully onboarded — all checks complete" : `${total - completed} item${total-completed!==1?"s":""} still needed`}
            </p>
          </div>
        </div>
      </Card>

      {tiers.map(tier => {
        const items = CHECKLIST_ITEMS.filter(i => i.tier === tier);
        const cfg   = tierConfig[tier];
        return (
          <Card key={tier} className="overflow-hidden">
            <div className={`px-4 py-2.5 border-b border-gray-100 border-l-4 ${cfg.border}`}>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">{cfg.label}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map(item => {
                const done = person.onboardingComplete[item.id];
                const expanded = expandedItem === item.id;
                return (
                  <div key={item.id} className={`${cfg.bg}`}>
                    <div
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer"
                      onClick={() => setExpandedItem(expanded ? null : item.id)}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={e => { e.stopPropagation(); toggle(item.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-brand-blue"
                        }`}
                      >
                        {done && <span className="text-xs font-bold leading-none">✓</span>}
                      </button>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${done ? "line-through text-gray-400" : "text-gray-800"}`}>
                          {item.label}
                        </p>
                        {expanded && (
                          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.detail}</p>
                        )}
                      </div>

                      {/* Badge + expand */}
                      <div className="flex items-center gap-2 shrink-0">
                        {done
                          ? <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm">Done</span>
                          : <span className={`text-xs font-bold px-2 py-0.5 rounded-sm ${cfg.badge}`}>{tier === "required" ? "Required" : tier === "recommended" ? "Due" : "Optional"}</span>
                        }
                        <span className="text-gray-400 text-xs">{expanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Alert type="blue">
        <strong>Written statement of particulars:</strong> Cadi generates a compliant template pre-filled with {person.name}'s details. Print, sign, and give them a copy on day one. This is a legal right since April 2020 — not optional.
        <br /><br />
        <strong>Right to Work:</strong> You must see and keep a copy of the original document, not just note that you saw it. Cadi stores an encrypted copy here when you photograph it.
      </Alert>
    </div>
  );
}

// ─── SECTION: Interview ───────────────────────────────────────────────────────
function InterviewSection({ person, onUpdate }) {
  const [scores,       setScores]       = useState({});
  const [notes,        setNotes]        = useState({});
  const [showRedFlags, setShowRedFlags] = useState(false);
  const [letterType,   setLetterType]   = useState(null);
  const [letterText,   setLetterText]   = useState("");
  const [letterLoading,setLetterLoading]= useState(false);
  const [copied,       setCopied]       = useState(false);
  const [candidateName,setCandName]     = useState("");
  const [startDate,    setStartDate]    = useState("");
  const [offerHours,   setOfferHours]   = useState("30");
  const [offerRate,    setOfferRate]    = useState(person.hourlyRate.toFixed(2));

  const questions = INTERVIEW_QUESTIONS[person.role === "lead" ? "lead" : "cleaner"];
  const maxTotal  = questions.reduce((s, q) => s + q.maxScore, 0);
  const total     = Object.values(scores).reduce((s, v) => s + (v || 0), 0);
  const pct       = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  const threshold = 60;

  const handleLetter = async (type) => {
    setLetterType(type);
    setLetterText("");
    setLetterLoading(true);
    try {
      const text = await generateLetter(type, candidateName || person.name, person.roleLabel, offerRate, startDate || "to be confirmed", offerHours);
      setLetterText(text);
    } catch { setLetterText("Could not generate letter. Please try again."); }
    setLetterLoading(false);
  };

  const copyLetter = () => {
    navigator.clipboard?.writeText(letterText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Score hero */}
      {Object.keys(scores).length > 0 && (
        <Card className={`overflow-hidden border-t-2 ${pct>=threshold?"border-t-emerald-500":pct>=40?"border-t-amber-400":"border-t-red-500"}`}>
          <div className="px-5 py-4">
            <SL className="mb-1">Interview score</SL>
            <div className="flex items-baseline gap-3">
              <p className={`text-4xl font-bold tabular-nums ${pct>=threshold?"text-emerald-600":pct>=40?"text-amber-600":"text-red-500"}`}>{pct}%</p>
              <p className="text-sm text-gray-400">{total} of {maxTotal} points · threshold {threshold}%</p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
              <div className={`h-full rounded-full ${pct>=threshold?"bg-emerald-500":pct>=40?"bg-amber-400":"bg-red-400"}`} style={{width:`${pct}%`}} />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {pct >= threshold ? "Above threshold — proceed with reference check" : pct >= 40 ? "Below recommended threshold — proceed with caution" : "Significantly below threshold — not recommended"}
            </p>
          </div>
        </Card>
      )}

      {/* Questions */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SL>Question bank — {person.roleLabel.toLowerCase()} hire</SL>
          <Chip color="blue">{questions.length} questions</Chip>
        </div>
        <div className="divide-y divide-gray-100">
          {questions.map((q, i) => (
            <div key={i} className="px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i+1}</div>
                <div className="flex-1">
                  <p className="text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">{q.category}</p>
                  <p className="text-sm font-semibold text-gray-800 mb-1 leading-snug">"{q.q}"</p>
                  <p className="text-xs text-gray-400 italic mb-3">{q.why}</p>
                  {/* Score buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Score:</span>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setScores(prev => ({...prev, [i]: n}))}
                        className={`w-8 h-8 rounded-sm border text-xs font-bold transition-colors ${
                          scores[i] === n
                            ? n <= 2 ? "bg-red-500 text-white border-red-500"
                              : n === 3 ? "bg-amber-400 text-white border-amber-400"
                              : "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-gray-400 border-gray-200 hover:border-brand-blue hover:text-brand-blue"
                        }`}>
                        {n}
                      </button>
                    ))}
                    {scores[i] && (
                      <span className={`text-xs font-bold ml-2 ${scores[i]<=2?"text-red-500":scores[i]===3?"text-amber-600":"text-emerald-600"}`}>
                        {scores[i]<=2?"Concern":scores[i]===3?"Adequate":scores[i]===4?"Good":"Excellent"}
                      </span>
                    )}
                  </div>
                  {/* Notes */}
                  <textarea
                    value={notes[i] || ""}
                    onChange={e => setNotes(prev => ({...prev, [i]: e.target.value}))}
                    rows={2}
                    placeholder="Notes from this answer…"
                    className="w-full mt-2 border border-gray-200 rounded-sm px-3 py-2 text-xs text-gray-600 focus:outline-none focus:border-brand-blue resize-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Red flags */}
      <Card className="overflow-hidden">
        <button
          onClick={() => setShowRedFlags(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-gray-100"
        >
          <SL>Red flag checklist</SL>
          <span className="text-xs text-gray-400">{showRedFlags ? "▲" : "▼"}</span>
        </button>
        {showRedFlags && (
          <div className="divide-y divide-gray-100">
            {RED_FLAGS.map((flag, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3 text-sm">
                <span className="text-red-400 font-bold shrink-0 mt-0.5">!</span>
                <p className="text-gray-600 leading-relaxed">{flag}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Offer / rejection letter */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Generate letter</SL></div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Candidate name</label>
              <input type="text" value={candidateName} onChange={e => setCandName(e.target.value)} placeholder={person.name}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Start date</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hourly rate (£)</label>
              <input type="number" step="0.50" value={offerRate} onChange={e => setOfferRate(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hours per week</label>
              <input type="number" value={offerHours} onChange={e => setOfferHours(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleLetter("offer")} className="flex-1 py-2.5 bg-brand-navy text-white text-xs font-bold uppercase tracking-wide hover:bg-brand-blue transition-colors rounded-sm">
              Generate offer letter
            </button>
            <button onClick={() => handleLetter("reject")} className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-xs font-bold uppercase tracking-wide hover:border-gray-400 transition-colors rounded-sm">
              Generate rejection
            </button>
          </div>
          {letterLoading && (
            <div className="flex items-center gap-3 p-3 bg-brand-navy/5 border border-brand-navy/10 rounded-sm">
              <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-xs text-brand-navy font-semibold">Generating letter…</p>
            </div>
          )}
          {letterText && !letterLoading && (
            <div className="border border-gray-200 rounded-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-bold text-gray-600">{letterType === "offer" ? "Offer letter" : "Rejection letter"}</p>
                <button onClick={copyLetter} className={`px-3 py-1 text-xs font-bold border rounded-sm transition-colors ${copied?"bg-emerald-50 text-emerald-700 border-emerald-200":"bg-white text-gray-600 border-gray-200 hover:border-brand-blue hover:text-brand-blue"}`}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap font-sans">{letterText}</pre>
            </div>
          )}
          <Alert type="blue">
            Offer letters generated here are templates, not legally reviewed contracts. For a fully compliant written statement, use the ACAS template or consult an employment solicitor before the employee's first day.
          </Alert>
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Training ────────────────────────────────────────────────────────
function TrainingSection({ person, onUpdate }) {
  const [activeWeek,  setActiveWeek]  = useState(null);
  const [aiPrompt,    setAiPrompt]    = useState("");
  const [aiWeeks,     setAiWeeks]     = useState(4);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState(null);
  const [activeReview,setActiveReview]= useState(null);
  const [feedbackView,setFeedbackView]= useState("30day");

  const weeks    = person.training.weeks;
  const tPct     = trainingPct(person);
  const completions = person.training.taskCompletions || {};
  const weekNotes   = person.training.notes || {};

  const toggleTask = (weekId, taskIdx) => {
    const key = `${weekId}-${taskIdx}`;
    onUpdate({
      ...person,
      training: {
        ...person.training,
        taskCompletions: { ...completions, [key]: !completions[key] },
      },
    });
  };

  const updateWeekNote = (weekId, text) => {
    onUpdate({
      ...person,
      training: { ...person.training, notes: { ...weekNotes, [weekId]: text } },
    });
  };

  const loadTemplate = (id) => {
    const tmpl = TRAINING_TEMPLATES[id];
    if (!tmpl) return;
    onUpdate({
      ...person,
      training: {
        ...person.training,
        templateId: id,
        weeks: tmpl.weeks.map((w, i) => ({ id: i+1, title: w.title, status: "not-started", tasks: w.tasks })),
        taskCompletions: {},
        notes: {},
      },
    });
  };

  const generateAIPlan = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiError(null);
    try {
      const plan = await generateTrainingPlan(aiPrompt, aiWeeks);
      onUpdate({
        ...person,
        training: {
          ...person.training,
          templateId: "custom",
          weeks: plan.weeks.map((w, i) => ({ id: i+1, title: w.title, status: "not-started", tasks: w.tasks })),
          taskCompletions: {},
          notes: {},
        },
      });
    } catch { setAiError("Could not generate plan. Check your connection and try again."); }
    setAiLoading(false);
  };

  const FEEDBACK_SCRIPTS = {
    "30day": {
      title: "30-day review",
      opener: "You've been with us for 30 days now and I wanted to take 20 minutes to check in properly.",
      questions: [
        "How are you finding the work so far — what's going well?",
        "Is there anything that's felt unclear or that you'd like more guidance on?",
        "How are you finding the clients you're working with?",
        "Is there anything about the schedule or route that we should adjust?",
        "What's one thing you'd like to get better at over the next 60 days?",
      ],
      toDocument: "Rate on quality (1–5), reliability (1–5), client feedback. Note any areas for development. Sign and date.",
    },
    "60day": {
      title: "60-day review",
      opener: "Two months in — you know the routine well now. This is a good moment to take stock.",
      questions: [
        "Looking back at your 30-day goals, how did they go?",
        "Have there been any situations that felt challenging to handle? How did you manage?",
        "How confident are you on the quality checklist? Any rooms or tasks that you find harder?",
        "Is there a service we don't currently offer that clients have asked you about?",
        "Where do you see yourself with us in 6 months?",
      ],
      toDocument: "Quality score, reliability score, any issues addressed. Note 90-day goals agreed together. Sign and date.",
    },
    "90day": {
      title: "90-day review",
      opener: "Ninety days is a real milestone — you now know the business as well as anyone. Let's talk properly.",
      questions: [
        "What's the best part of the job for you right now?",
        "What would make your working week easier or better?",
        "Are there any clients you find particularly rewarding or particularly difficult?",
        "Is there anything about how the business runs that you'd change if you could?",
        "Let's set some goals together for the next quarter — what do you want to achieve?",
      ],
      toDocument: "Full performance summary. Pay review consideration. Any change to hours, role, or responsibility. Both sign and date.",
    },
    "difficult": {
      title: "Difficult conversation guide",
      opener: "I wanted to have a quick chat — nothing to worry about, but there's something I'd like to address while it's still small.",
      questions: [
        "For lateness: 'I've noticed you've arrived late a couple of times recently. Is everything okay? Is there something we can do to make the start time work better for you?'",
        "For quality: 'I had some feedback from [client] that I wanted to share. They mentioned [specific issue]. Can you tell me what happened from your side?'",
        "For client complaint: 'A client got in touch — I want to hear your version of events first before I say anything. Can you walk me through the visit?'",
        "Closing: 'I want to be clear — I'm raising this because I want you to stay and do well, not because I want to make it difficult. What do you need from me to make this better?'",
      ],
      toDocument: "Log the date, what was discussed, what was agreed, and any follow-up date. If the issue continues, this record becomes the basis of a formal PIP.",
    },
  };

  const feedbackScript = FEEDBACK_SCRIPTS[feedbackView];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-4 bg-brand-navy text-white">
          <ProgressRing pct={tPct} size={52} strokeWidth={4} />
          <div>
            <SL className="text-brand-skyblue mb-0.5">Training progress</SL>
            <p className="text-lg font-bold">{tPct}% complete</p>
            <p className="text-xs text-brand-skyblue/70">
              {Object.values(completions).filter(Boolean).length} tasks done · {weeks.length} weeks
            </p>
          </div>
        </div>
      </Card>

      {/* Templates */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Training templates</SL></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
          {Object.entries(TRAINING_TEMPLATES).map(([id, t]) => (
            <button key={id} onClick={() => loadTemplate(id)}
              className={`text-left p-3 transition-colors ${person.training.templateId===id?"bg-brand-navy text-white":"bg-white hover:bg-gray-50"}`}>
              <p className={`text-xs font-bold mb-0.5 ${person.training.templateId===id?"text-white":"text-gray-800"}`}>{t.label.split(" — ")[0]}</p>
              <p className={`text-xs leading-tight ${person.training.templateId===id?"text-brand-skyblue":"text-gray-400"}`}>{t.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* AI plan builder */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <SL>AI plan builder</SL>
          <Chip color="sky">Claude</Chip>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Describe the role and any specific requirements</label>
            <textarea
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              rows={3}
              placeholder="e.g. Part-time commercial cleaner, office blocks in the City, no previous cleaning experience but good work ethic. Needs to learn COSHH, lone working, and commercial client communication."
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-brand-blue resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Number of weeks</label>
              <select value={aiWeeks} onChange={e => setAiWeeks(+e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue">
                {[2,3,4,5,6,8].map(n => <option key={n} value={n}>{n} weeks</option>)}
              </select>
            </div>
            <button
              onClick={generateAIPlan}
              disabled={!aiPrompt.trim() || aiLoading}
              className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wide rounded-sm transition-colors mt-5 ${aiPrompt.trim() && !aiLoading ? "bg-brand-navy text-white hover:bg-brand-blue" : "bg-gray-100 text-gray-300 cursor-not-allowed"}`}
            >
              {aiLoading ? "Generating…" : "Generate custom plan"}
            </button>
          </div>
          {aiError && <Alert type="warn">{aiError}</Alert>}
        </div>
      </Card>

      {/* Week plan */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Week-by-week plan</SL></div>
        <div className="divide-y divide-gray-100">
          {weeks.map(week => {
            const weekDone  = week.tasks.every((_, i) => completions[`${week.id}-${i}`]);
            const weekStart = week.tasks.some((_, i) => completions[`${week.id}-${i}`]);
            const expanded  = activeWeek === week.id;
            const weekStatus = weekDone ? "complete" : weekStart ? "in-progress" : "not-started";

            return (
              <div key={week.id}>
                <button
                  onClick={() => setActiveWeek(expanded ? null : week.id)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                >
                  {/* Status dot */}
                  <div className={`w-3 h-3 rounded-full shrink-0 ${weekDone ? "bg-emerald-500" : weekStart ? "bg-amber-400" : "bg-gray-200"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${weekDone ? "text-emerald-700" : "text-gray-800"}`}>{week.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {week.tasks.filter((_, i) => completions[`${week.id}-${i}`]).length} of {week.tasks.length} tasks · {weekStatus === "complete" ? "Complete" : weekStatus === "in-progress" ? "In progress" : "Not started"}
                    </p>
                  </div>
                  <span className="text-gray-400 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 bg-gray-50/50">
                    <div className="space-y-1.5 mb-3">
                      {week.tasks.map((task, ti) => {
                        const key  = `${week.id}-${ti}`;
                        const done = completions[key];
                        return (
                          <button key={ti} onClick={() => toggleTask(week.id, ti)}
                            className="w-full flex items-center gap-2.5 text-left">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${done ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 hover:border-brand-blue"}`}>
                              {done && <span className="text-xs font-bold leading-none" style={{fontSize:9}}>✓</span>}
                            </div>
                            <span className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-700"}`}>{task}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div>
                      <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Session notes</label>
                      <textarea
                        value={weekNotes[week.id] || ""}
                        onChange={e => updateWeekNote(week.id, e.target.value)}
                        rows={2}
                        placeholder="What happened in this week's training? Any issues or highlights to note…"
                        className="w-full border border-gray-200 rounded-sm px-3 py-2 text-xs text-gray-600 focus:outline-none focus:border-brand-blue resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Feedback framework */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Feedback framework — 30 / 60 / 90 day reviews</SL></div>
        <div className="flex gap-0 border-b border-gray-100 overflow-x-auto">
          {[{id:"30day",label:"30 day"},{id:"60day",label:"60 day"},{id:"90day",label:"90 day"},{id:"difficult",label:"Difficult conversation"}].map(t => (
            <button key={t.id} onClick={() => setFeedbackView(t.id)}
              className={`flex-shrink-0 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px ${feedbackView===t.id?"border-brand-blue text-brand-blue":"border-transparent text-gray-500 hover:text-gray-800"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 space-y-4">
          <div>
            <SL className="mb-2">Opening line</SL>
            <p className="text-sm text-gray-700 italic leading-relaxed bg-brand-navy/5 border border-brand-navy/10 rounded-sm px-4 py-3">
              "{feedbackScript.opener}"
            </p>
          </div>
          <div>
            <SL className="mb-2">Questions to cover</SL>
            <div className="space-y-2">
              {feedbackScript.questions.map((q, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-brand-skyblue/20 text-brand-navy flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i+1}</div>
                  <p className="text-gray-700 leading-relaxed">{q}</p>
                </div>
              ))}
            </div>
          </div>
          <Alert type="blue">
            <strong>What to document after:</strong> {feedbackScript.toDocument}
          </Alert>
        </div>
      </Card>
    </div>
  );
}

// ─── SECTION: Pay & Payroll ───────────────────────────────────────────────────
function PaySection({ person, onUpdate, onStaffUpdate, allStaff }) {
  const [rateChanged, setRateChanged] = useState(false);
  const [showPayslip,  setShowPayslip]  = useState(false);
  const [payslipMonth, setPayslipMonth] = useState(new Date().toISOString().slice(0,7));

  const gross       = (person.hourlyRate * person.hoursPerWeek * 52) / 12;
  const taxPA       = 12570;
  const annualGross = gross * 12;
  const taxable     = Math.max(0, annualGross - taxPA);
  const annualTax   = Math.min(taxable, 37700) * 0.20 + Math.max(0, taxable - 37700) * 0.40;
  const annualNI    = Math.max(0, (annualGross - 12570) * 0.08); // employee NI
  const pension     = annualGross >= 10000 ? annualGross * 0.05 : 0; // auto-enrolment
  const annualNet   = annualGross - annualTax - annualNI - pension;
  const monthlyNet  = annualNet / 12;
  const empNI       = Math.max(0, (annualGross - 9100) * 0.138) / 12;
  const holidayRemaining = person.holidayEntitlement - person.holidayTaken;

  const updateRate = (val) => {
    const updated = { ...person, hourlyRate: val };
    onUpdate(updated);
    onStaffUpdate?.(allStaff.map(s => s.id === person.id ? updated : s));
    setRateChanged(true);
    setTimeout(() => setRateChanged(false), 2500);
  };

  const updateHours = (val) => {
    const updated = { ...person, hoursPerWeek: val };
    onUpdate(updated);
    onStaffUpdate?.(allStaff.map(s => s.id === person.id ? updated : s));
  };

  return (
    <div className="space-y-4">
      {/* Rate hero */}
      <Card className={`overflow-hidden border-t-2 ${rateChanged ? "border-t-emerald-500" : "border-t-brand-navy"}`}>
        <div className="p-5">
          <SL className="mb-2">Current pay rate</SL>
          <p className="text-4xl font-bold tabular-nums text-brand-navy">{fmt2(person.hourlyRate)}/hr</p>
          <p className="text-sm text-gray-400 mt-1">{fmt(gross)}/month estimated · {person.hoursPerWeek}hrs/wk</p>
          {rateChanged && <p className="text-xs text-emerald-600 font-semibold mt-1">Rate updated — synced to Pricing, Business Lab and Money tab</p>}
        </div>
      </Card>

      {/* Edit rate */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Edit pay</SL></div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hourly rate (£)</label>
            <div className="flex items-center gap-3">
              <input
                type="number" step="0.50" min="12.21" max="50"
                value={person.hourlyRate}
                onChange={e => updateRate(parseFloat(e.target.value) || 12.21)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-lg font-bold font-mono focus:outline-none focus:border-brand-blue"
              />
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-400">Monthly</p>
                <p className="text-sm font-bold text-brand-navy">{fmt(gross)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-1">NLW 2026: £12.21/hr minimum</p>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hours per week</label>
            <input type="number" step="1" min="1" max="48" value={person.hoursPerWeek}
              onChange={e => updateHours(parseInt(e.target.value)||1)}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Pay frequency</label>
            <select value={person.payFrequency}
              onChange={e => onUpdate({...person, payFrequency: e.target.value})}
              className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue">
              {["weekly","fortnightly","monthly","4-weekly"].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Payslip preview */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <SL>Payslip calculator</SL>
          <input type="month" value={payslipMonth} onChange={e => setPayslipMonth(e.target.value)}
            className="border border-gray-200 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-brand-blue" />
        </div>
        <div className="divide-y divide-gray-100">
          {[
            { label:"Gross pay",    value: fmt2(gross),      accent:"text-brand-navy",  bold:false },
            { label:"Income tax",   value:`-${fmt2(annualTax/12)}`, accent:"text-red-500", bold:false, hint:`~${Math.round(annualTax/annualGross*100)}% effective rate` },
            { label:"Employee NI",  value:`-${fmt2(annualNI/12)}`,  accent:"text-red-500", bold:false },
            ...(annualGross >= 10000 ? [{ label:"Pension (5%)", value:`-${fmt2(pension/12)}`, accent:"text-amber-600", bold:false }] : []),
            { label:"Net pay",      value: fmt2(monthlyNet),  accent:"text-emerald-600", bold:true  },
          ].map(({ label, value, accent, bold, hint }) => (
            <div key={label} className={`flex justify-between items-center px-4 py-3 ${bold ? "bg-gray-50" : ""}`}>
              <div>
                <p className={`text-sm ${bold ? "font-bold text-gray-800" : "text-gray-500"}`}>{label}</p>
                {hint && <p className="text-xs text-gray-400">{hint}</p>}
              </div>
              <p className={`text-sm font-mono font-bold tabular-nums ${accent}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-brand-navy/5 border-t border-brand-navy/10">
          <p className="text-xs text-gray-500">
            Your cost: <span className="font-bold text-red-500">{fmt2(gross + empNI)}/mo</span> (gross + employer NI {fmt2(empNI)})
          </p>
          <p className="text-xs text-gray-400 mt-1">RTI submission due on or before pay date — use HMRC Basic PAYE Tools (free)</p>
        </div>
      </Card>

      {/* Holiday tracker */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100"><SL>Holiday entitlement</SL></div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label:"Annual entitlement", value:`${person.holidayEntitlement} days`, accent:"text-brand-navy" },
              { label:"Days taken",          value:`${person.holidayTaken} days`,       accent:"text-amber-600" },
              { label:"Days remaining",      value:`${holidayRemaining.toFixed(1)} days`, accent:holidayRemaining<5?"text-red-500":"text-emerald-600" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-gray-50 border border-gray-100 rounded-sm p-3">
                <SL className="mb-1">{label}</SL>
                <p className={`text-lg font-bold tabular-nums ${accent}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-amber-400 rounded-full" style={{width:`${Math.min((person.holidayTaken/person.holidayEntitlement)*100,100)}%`}} />
          </div>
          <p className="text-xs text-gray-400">
            5.6 weeks statutory entitlement · {person.hoursPerWeek}h/wk = {person.holidayEntitlement} days/yr · Holiday year resets on start date anniversary
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onUpdate({...person, holidayTaken: Math.min(person.holidayTaken + 1, person.holidayEntitlement)})}
              className="flex-1 py-2 text-xs font-bold border border-gray-200 rounded-sm hover:border-brand-blue hover:text-brand-blue text-gray-600 transition-colors"
            >
              + 1 day taken
            </button>
            <button
              onClick={() => onUpdate({...person, holidayTaken: Math.max(person.holidayTaken - 1, 0)})}
              className="flex-1 py-2 text-xs font-bold border border-gray-200 rounded-sm hover:border-gray-400 text-gray-600 transition-colors"
            >
              − 1 day
            </button>
          </div>
        </div>
      </Card>

      <Alert type="gold">
        Cadi calculates payslip figures but does not submit to HMRC directly. Submit RTI via <strong>HMRC Basic PAYE Tools</strong> (free) or your accountant. All figures are estimates — actual tax code and NI category may differ.
      </Alert>
    </div>
  );
}

// ─── Add staff modal ──────────────────────────────────────────────────────────
function AddStaffModal({ onClose, onAdd }) {
  const [name,     setName]     = useState("");
  const [role,     setRole]     = useState("cleaner");
  const [rate,     setRate]     = useState("13.00");
  const [hours,    setHours]    = useState("30");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [start,    setStart]    = useState(new Date().toISOString().split("T")[0]);
  const [freq,     setFreq]     = useState("weekly");

  const ROLES = [
    { id:"cleaner",  label:"Cleaner",            avatarBg:"bg-amber-100 text-amber-800" },
    { id:"lead",     label:"Team Lead",           avatarBg:"bg-emerald-100 text-emerald-800" },
    { id:"manager",  label:"Operations Manager",  avatarBg:"bg-blue-100 text-brand-blue" },
    { id:"exterior", label:"Exterior Specialist", avatarBg:"bg-orange-100 text-orange-800" },
    { id:"commercial",label:"Commercial Specialist",avatarBg:"bg-purple-100 text-purple-700" },
  ];

  const roleObj  = ROLES.find(r => r.id === role);
  const initials = name.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() || "?";
  const valid    = name.trim() && parseFloat(rate) >= 12.21 && parseInt(hours) > 0;

  const handleAdd = () => {
    if (!valid) return;
    const hoursNum = parseInt(hours);
    onAdd({
      id: Date.now(),
      name: name.trim(),
      role,
      roleLabel: roleObj?.label ?? "Cleaner",
      status: "onboarding",
      startDate: start,
      phone, email,
      address: "",
      niNumber: "",
      payType: "hourly",
      hourlyRate: parseFloat(rate),
      hoursPerWeek: hoursNum,
      payFrequency: freq,
      bankName: "", bankSortCode: "", bankAccount: "",
      holidayEntitlement: Math.round(hoursNum * 5.6 * 10) / 10,
      holidayTaken: 0,
      onboardingComplete: { rtw:false, contract:false, paye:false, ni:false, insurance:false, dbs:false, emergency:false, pension:false, bankDetails:false, uniform:false, keys:false, photo:false },
      training: {
        templateId: role === "lead" ? "team-lead" : role === "exterior" ? "exterior" : role === "commercial" ? "commercial" : "new-cleaner",
        weeks: TRAINING_TEMPLATES[role === "lead" ? "team-lead" : role === "exterior" ? "exterior" : role === "commercial" ? "commercial" : "new-cleaner"].weeks.map((w,i) => ({ id:i+1, title:w.title, status:"not-started", tasks:w.tasks })),
        taskCompletions: {}, notes: {},
      },
      interviews: [],
      notes: "",
      emergencyContact: "",
      avatar: initials,
      avatarBg: roleObj?.avatarBg ?? "bg-gray-100 text-gray-500",
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-brand-navy/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <Card className="w-full max-w-md max-h-[95vh] flex flex-col sm:rounded-sm rounded-t-xl">
        <div className="flex items-center justify-between px-5 py-4 bg-brand-navy text-white shrink-0">
          <p className="font-bold text-sm">Add new staff member</p>
          <button onClick={onClose} className="text-brand-skyblue hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Preview card */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-100 rounded-sm">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${roleObj?.avatarBg || "bg-gray-100 text-gray-500"}`}>{initials}</div>
            <div>
              <p className="text-sm font-bold text-gray-800">{name || "Name…"}</p>
              <p className="text-xs text-gray-400">{roleObj?.label} · {fmt2(parseFloat(rate)||0)}/hr · {hours}h/wk</p>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-2">Role</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ROLES.map(r => (
                <button key={r.id} onClick={() => setRole(r.id)}
                  className={`py-2 px-3 text-xs font-bold border rounded-sm transition-colors text-left ${role===r.id?"bg-brand-navy text-white border-brand-navy":"bg-white text-gray-500 border-gray-200 hover:border-brand-blue hover:text-brand-blue"}`}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {[
            { label:"Full name",      val:name,  set:setName,  type:"text",   placeholder:"e.g. Jamie Turner" },
            { label:"Email",          val:email, set:setEmail, type:"email",  placeholder:"jamie@email.com" },
            { label:"Phone",          val:phone, set:setPhone, type:"tel",    placeholder:"07700 900000" },
          ].map(({ label, val, set, type, placeholder }) => (
            <div key={label}>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">{label}</label>
              <input type={type} value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hourly rate (£)</label>
              <input type="number" step="0.50" min="12.21" value={rate} onChange={e => setRate(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Hours per week</label>
              <input type="number" step="1" min="1" max="48" value={hours} onChange={e => setHours(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Start date</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widests uppercase text-gray-400 mb-1">Pay frequency</label>
              <select value={freq} onChange={e => setFreq(e.target.value)}
                className="w-full border border-gray-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-brand-blue">
                {["weekly","fortnightly","monthly","4-weekly"].map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {parseFloat(rate) < 12.21 && parseFloat(rate) > 0 && (
            <Alert type="warn">Rate is below the National Living Wage (£12.21/hr for 2026). Adjust before proceeding.</Alert>
          )}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex gap-2 shrink-0">
          <button onClick={handleAdd} disabled={!valid}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wide rounded-sm transition-colors ${valid?"bg-brand-navy text-white hover:bg-brand-blue":"bg-gray-100 text-gray-300 cursor-not-allowed"}`}>
            Add to team
          </button>
          <button onClick={onClose} className="px-5 py-3 border border-gray-200 text-gray-500 text-xs font-bold uppercase hover:border-gray-300 rounded-sm transition-colors">
            Cancel
          </button>
        </div>
      </Card>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function StaffingTab({ onStaffUpdate, onNavigate: onNavigateProp }) {
  const routerNavigate = useNavigate();
  const onNavigate = onNavigateProp || ((tab) => routerNavigate(`/${tab}`));
  const { user } = useAuth();
  const isLive = Boolean(user);
  const [staff,        setStaff]        = useState(isLive ? [] : DEMO_STAFF);
  const [selectedId,   setSelectedId]   = useState(null);
  const [activeSection,setActiveSection]= useState("overview");
  const [showAddModal, setShowAddModal] = useState(false);

  const selectedPerson = staff.find(s => s.id === selectedId);

  const updatePerson = useCallback((updated) => {
    setStaff(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  const addStaffMember = (newPerson) => {
    setStaff(prev => [...prev, newPerson]);
    setSelectedId(newPerson.id);
    setActiveSection("onboarding");
  };

  const selectStaff = (person) => {
    setSelectedId(person.id);
    setActiveSection("onboarding");
  };

  const SECTIONS = [
    { id:"overview",   label:"Team",       shortLabel:"Team"       },
    { id:"onboarding", label:"Onboarding", shortLabel:"Onboard"    },
    { id:"interview",  label:"Interview",  shortLabel:"Interview"  },
    { id:"training",   label:"Training",   shortLabel:"Training"   },
    { id:"pay",        label:"Pay",        shortLabel:"Pay"        },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold tracking-widests uppercase text-brand-blue mb-0.5">Cadi</p>
          <h2 className="text-2xl font-bold text-brand-navy">Staffing</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {staff.length} team member{staff.length!==1?"s":""} · {staff.filter(s=>s.status==="onboarding").length} onboarding
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-navy text-white text-xs font-bold uppercase tracking-wide hover:bg-brand-blue transition-colors rounded-sm"
        >
          <span className="text-base leading-none">+</span> Add staff
        </button>
      </div>

      {/* Person selector — when not on overview */}
      {activeSection !== "overview" && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {staff.map(p => (
              <button key={p.id} onClick={() => setSelectedId(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border text-sm transition-all ${selectedId===p.id?"bg-brand-navy text-white border-brand-navy":"bg-white text-gray-600 border-gray-200 hover:border-brand-blue"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${selectedId===p.id?"bg-white/20 text-white":p.avatarBg}`}>{p.avatar}</div>
                <span className="font-semibold">{p.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section nav */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => { setActiveSection(s.id); if(s.id !== "overview" && !selectedId && staff.length > 0) setSelectedId(staff[0].id); }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px whitespace-nowrap ${activeSection===s.id?"border-brand-blue text-brand-blue":"border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"}`}>
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{s.shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {activeSection === "overview" && (
          <TeamOverview staff={staff} onSelectStaff={selectStaff} onAddStaff={() => setShowAddModal(true)} />
        )}
        {activeSection !== "overview" && !selectedPerson && (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-sm text-gray-400 mb-3">No staff member selected</p>
            <button onClick={() => setActiveSection("overview")} className="text-xs text-brand-blue font-semibold hover:underline">Back to team overview →</button>
          </div>
        )}
        {activeSection === "onboarding" && selectedPerson && (
          <OnboardingSection person={selectedPerson} onUpdate={updatePerson} />
        )}
        {activeSection === "interview" && selectedPerson && (
          <InterviewSection person={selectedPerson} onUpdate={updatePerson} />
        )}
        {activeSection === "training" && selectedPerson && (
          <TrainingSection person={selectedPerson} onUpdate={updatePerson} />
        )}
        {activeSection === "pay" && selectedPerson && (
          <PaySection person={selectedPerson} onUpdate={updatePerson} onStaffUpdate={onStaffUpdate} allStaff={staff} />
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-gray-100 px-6 py-2.5 flex items-center justify-between">
        <p className="text-xs text-gray-400">UK employment law guidance only — not legal advice. Consult an employment solicitor for complex situations.</p>
        <button onClick={() => onNavigate?.("scaling")} className="text-xs text-brand-blue font-semibold hover:underline">Business Lab →</button>
      </div>

      {/* Add staff modal */}
      {showAddModal && (
        <AddStaffModal onClose={() => setShowAddModal(false)} onAdd={addStaffMember} />
      )}
    </div>
  );
}
