// src/components/CustomerTab.jsx
// Cadi — Customer CRM
//
// Built to work perfectly with 10 customers and scale to thousands:
//   • Filter by job type (window cleaning, regular, deep, exterior etc.)
//   • AI-powered upsell + cross-sell suggestions per customer
//   • Smart reminders — one-off jobs that should recur
//   • Win-back messages / emails for lapsed customers
//   • Full customer profile with job history + lifetime value
//   • Search, sort, tag — all client-side for instant response
//   • Architecture: flat array + useMemo filtering = handles 10,000+ records
//
// Usage:
//   import CustomerTab from './components/CustomerTab'
//   <CustomerTab />

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { listCustomers, upsertCustomer } from "../lib/db/customersDb";
import { useData } from "../context/DataContext";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { usePlan, FREE_CUSTOMER_LIMIT } from "../hooks/usePlan";
import { UpgradeModal } from "../components/UpgradePrompt";

// ─── Job type taxonomy ────────────────────────────────────────────────────────
// Used for filtering, tagging, and AI suggestion logic.
// No emojis — clean text labels only.
const JOB_TYPES = [
  { id: "all",            label: "All customers",   color: "gray"    },
  { id: "regular",        label: "Regular clean",   color: "emerald" },
  { id: "deep",           label: "Deep clean",      color: "blue"    },
  { id: "end-of-tenancy", label: "End of tenancy",  color: "purple"  },
  { id: "commercial",     label: "Commercial",       color: "blue"    },
  { id: "windows",        label: "Window clean",    color: "sky"     },
  { id: "gutter",         label: "Gutter clean",    color: "orange"  },
  { id: "roof",           label: "Roof clean",      color: "orange"  },
  { id: "carpet",         label: "Carpet clean",    color: "amber"   },
  { id: "oven",           label: "Oven clean",      color: "red"     },
  { id: "exterior",       label: "Exterior / pressure wash", color: "orange" },
  { id: "one-off",        label: "One-off",         color: "gray"    },
];

// ─── AI suggestion engine ─────────────────────────────────────────────────────
// Rules-based suggestions (no API call needed for instant results).
// Each rule: { condition(customer) => bool, suggestion object }
// Production: augment with Claude API call for richer personalisation.

function generateSuggestions(customer) {
  const suggestions = [];
  const services = customer.services.map(s => s.type);
  const hasLastJob = Boolean(customer.lastJobDate);
  const daysSinceLastJob = hasLastJob
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const totalSpend = customer.services.reduce((s, j) => s + j.price, 0);

  // Upsells — same category, higher value
  if (services.includes("regular") && !services.includes("deep")) {
    suggestions.push({
      type: "upsell",
      title: "Deep clean upgrade",
      body: `${customer.name.split(" ")[0]} has had ${customer.services.filter(s=>s.type==="regular").length} regular cleans. A quarterly deep clean would add ~£80–£120 per visit.`,
      action: "Suggest deep clean",
      value: 100,
      priority: "high",
    });
  }

  if (services.includes("regular") && !services.includes("oven")) {
    suggestions.push({
      type: "upsell",
      title: "Add oven clean",
      body: "Regular clean customers rarely book oven cleans separately — a quick offer at the next visit converts well. Most customers say yes when asked in person.",
      action: "Offer oven clean",
      value: 65,
      priority: "medium",
    });
  }

  if ((services.includes("windows") || services.includes("exterior")) && !services.includes("gutter")) {
    suggestions.push({
      type: "upsell",
      title: "Add gutter clean",
      body: "Already visiting for exterior work — gutters are a natural upsell. Most customers don't think to ask but immediately say yes when prompted.",
      action: "Offer gutter clean",
      value: 100,
      priority: "medium",
    });
  }

  if (services.includes("gutter") && !services.includes("roof")) {
    const daysSinceGutter = Math.floor((Date.now() - new Date(customer.services.find(s=>s.type==="gutter")?.date ?? customer.lastJobDate)) / 86400000);
    if (daysSinceGutter > 180) {
      suggestions.push({
        type: "upsell",
        title: "Roof moss treatment due",
        body: "If gutters are filling fast, roof moss is likely the cause. A treatment now prevents the problem recurring — and is a significant upsell.",
        action: "Suggest roof treatment",
        value: 250,
        priority: "high",
      });
    }
  }


  if (services.includes("regular") && !services.includes("carpet")) {
    suggestions.push({
      type: "upsell",
      title: "Add carpet cleaning",
      body: "Regular domestic customers rarely think to ask — a well-timed \"shall we do the carpets while we're there?\" converts at ~40%.",
      action: "Offer carpet add-on",
      value: 40,
      priority: "medium",
    });
  }

  if (services.includes("windows") && !services.includes("exterior")) {
    suggestions.push({
      type: "crosssell",
      title: "Cross-sell exterior services",
      body: `Already visiting for windows — driveway or patio pressure wash is a natural add-on. Saves them a separate booking and adds £80–£150.`,
      action: "Add exterior services",
      value: 110,
      priority: "high",
    });
  }

  if (services.includes("end-of-tenancy") && !services.includes("regular")) {
    suggestions.push({
      type: "crosssell",
      title: "Convert to regular customer",
      body: "End of tenancy customers often move to a new property. Reach out about ongoing regular cleans — capture them before a competitor does.",
      action: "Send regular clean offer",
      value: 65,
      priority: "high",
    });
  }

  if (services.includes("commercial") && !services.includes("windows")) {
    suggestions.push({
      type: "crosssell",
      title: "Add window contract",
      body: "Commercial clients booking regular office cleans are prime candidates for a monthly window contract. Often overlooked by other cleaners.",
      action: "Propose window contract",
      value: 120,
      priority: "medium",
    });
  }

  if (totalSpend > 500 && !customer.tags.includes("vip")) {
    suggestions.push({
      type: "relationship",
      title: "Mark as VIP — loyalty reward",
      body: `£${totalSpend.toLocaleString()} lifetime spend. A small loyalty gesture (priority booking, anniversary discount) builds long-term retention.`,
      action: "Send loyalty message",
      value: 0,
      priority: "medium",
    });
  }

  // One-off job reminder
  if (hasLastJob && customer.frequency === "one-off" && daysSinceLastJob > 30) {
    suggestions.push({
      type: "reminder",
      title: "Follow up on one-off job",
      body: `Last job was ${daysSinceLastJob} days ago. One-off customers who don't hear back within 6 weeks are 3× more likely to use someone else next time.`,
      action: "Send follow-up",
      value: 65,
      priority: "high",
    });
  }

  // Win-back
  if (hasLastJob && daysSinceLastJob > 90) {
    suggestions.push({
      type: "winback",
      title: `Lapsed — ${daysSinceLastJob} days since last job`,
      body: "Win-back messages sent within 90–180 days have a ~35% success rate. Beyond 180 days it drops sharply. Act now.",
      action: "Send win-back",
      value: 65,
      priority: daysSinceLastJob > 180 ? "urgent" : "high",
    });
  }

  return suggestions.sort((a, b) => {
    const order = { urgent: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

// ─── Win-back / message templates ────────────────────────────────────────────
function generateMessage(customer, messageType) {
  const first = customer.name.split(" ")[0];
  const lastService = customer.services[0];
  const daysSince = customer.lastJobDate
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;

  const templates = {
    winback: {
      subject: `We miss you, ${first} — book your next clean`,
      body: `Hi ${first},\n\nIt's been a while since your last clean with us${lastService ? ` (${lastService.label} back in ${new Date(customer.lastJobDate).toLocaleDateString("en-GB", { month: "long", year: "numeric" })})` : ""} and we wanted to reach out.\n\nWe have availability coming up and would love to get you booked in. As a returning customer you'll always get priority scheduling.\n\nReply to this message or call us to book — it's great to have you back.\n\nKind regards`,
    },
    reminder: {
      subject: `Time for your next clean, ${first}?`,
      body: `Hi ${first},\n\nJust a friendly reminder that it's been ${daysSince} days since your last ${lastService?.label ?? "clean"} with us.\n\nWould you like to book in? We have slots available and can usually fit around your schedule.\n\nLet me know what works for you.\n\nThanks`,
    },
    upsell_deep: {
      subject: `${first} — have you considered a deep clean?`,
      body: `Hi ${first},\n\nYou've been a loyal regular clean customer and I wanted to suggest something that many of our customers find really worthwhile — a quarterly deep clean.\n\nIt takes care of all the areas a regular clean doesn't quite reach: oven, inside cupboards, behind appliances, skirting boards and more. Most customers notice the difference immediately.\n\nI could fit it in during your next regular visit or book a separate session — whichever suits. From £${Math.round(lastService?.price ?? 80) + 40}.\n\nWorth considering?`,
    },
    upsell_carpet: {
      subject: `${first} — quick question about your carpets`,
      body: `Hi ${first},\n\nI noticed we haven't done the carpets yet — would you like me to include a carpet clean next time I'm in?\n\nI can do it at the same visit which saves you time, and it makes a real difference alongside a regular clean. From £40 per room.\n\nJust let me know and I'll bring the equipment along.`,
    },
    crosssell_exterior: {
      subject: `${first} — while we're there...`,
      body: `Hi ${first},\n\nI'm coming to you for the windows soon and wanted to mention — we also do driveway and patio pressure washing while we're visiting.\n\nIt's a great time of year to get the exterior looking sharp and saves you arranging a separate visit. From £80 for a standard driveway.\n\nShall I quote you while I'm there?`,
    },
    crosssell_regular: {
      subject: `${first} — regular cleaning from next month?`,
      body: `Hi ${first},\n\nGreat to help with your recent clean — I hope you're happy with how it turned out.\n\nI wanted to mention that many customers find it easier to set up a regular slot — fortnightly or monthly — so the house stays on top of itself. It also means you get priority scheduling and I can often fit you in at the same time each visit.\n\nWould that be of interest? Happy to discuss what would work for you.`,
    },
  };

  return templates[messageType] ?? templates.reminder;
}

// Demo customer data removed — live users load from Supabase via DataContext.
/* DEMO_CUSTOMERS REMOVED — was {
    id: 1, name: "Margaret Johnson", postcode: "SW4 8AS", phone: "07700 900001", email: "m.johnson@email.com",
    frequency: "fortnightly", status: "active", tags: ["vip", "regular"],
    lastJobDate: "2026-03-28", nextJobDate: "2026-04-11", lifetimeValue: 1440,
    services: [
      { type: "regular",  label: "Regular clean",    date: "2026-03-28", price: 60, status: "complete" },
      { type: "regular",  label: "Regular clean",    date: "2026-03-14", price: 60, status: "complete" },
      { type: "deep",     label: "Deep clean",       date: "2026-01-10", price: 120, status: "complete" },
      { type: "carpet",   label: "Carpet clean",     date: "2025-10-05", price: 85, status: "complete" },
    ],
    notes: "Prefers eco products. Key under mat. Dog called Rufus — friendly.",
    source: "Referral — Mrs Davies",
  },
  {
    id: 2, name: "Greenfield Business Park", postcode: "SW6 2PQ", phone: "02079 000002", email: "facilities@greenfield.co.uk",
    frequency: "weekly", status: "active", tags: ["commercial", "contract"],
    lastJobDate: "2026-04-06", nextJobDate: "2026-04-13", lifetimeValue: 6240,
    services: [
      { type: "commercial", label: "Office clean", date: "2026-04-06", price: 120, status: "complete" },
      { type: "commercial", label: "Office clean", date: "2026-03-30", price: 120, status: "complete" },
      { type: "commercial", label: "Office clean", date: "2026-03-23", price: 120, status: "complete" },
    ],
    notes: "Contact: Sarah Mills (Facilities). Access fob needed — code 4419. Invoice by email, 30-day terms.",
    source: "Cold approach",
  },
  {
    id: 3, name: "David Harrington", postcode: "SW9 4EW", phone: "07700 900003", email: "d.harrington@email.com",
    frequency: "monthly", status: "active", tags: ["exterior"],
    lastJobDate: "2026-03-15", nextJobDate: "2026-04-15", lifetimeValue: 850,
    services: [
      { type: "windows",  label: "Window clean",          date: "2026-03-15", price: 65,  status: "complete" },
      { type: "exterior", label: "Driveway pressure wash", date: "2026-02-10", price: 95,  status: "complete" },
      { type: "gutter",   label: "Gutter clean",           date: "2025-11-20", price: 120, status: "complete" },
    ],
    notes: "Prefers Saturday morning. Rottweiler — keep gate closed.",
    source: "Google search",
  },
  {
    id: 4, name: "Sarah Davies", postcode: "SW2 7RT", phone: "07700 900004", email: "s.davies@email.com",
    frequency: "fortnightly", status: "active", tags: ["regular"],
    lastJobDate: "2026-04-01", nextJobDate: "2026-04-15", lifetimeValue: 780,
    services: [
      { type: "regular", label: "Regular clean", date: "2026-04-01", price: 65, status: "complete" },
      { type: "regular", label: "Regular clean", date: "2026-03-18", price: 65, status: "complete" },
      { type: "deep",    label: "Spring deep clean", date: "2026-03-01", price: 130, status: "complete" },
    ],
    notes: "Works from home on Tuesdays — prefers Mon/Wed. Very detail-oriented. Always asks about ironing.",
    source: "Facebook group",
  },
  {
    id: 5, name: "Park View Management", postcode: "SE1 9GH", phone: "02079 000005", email: "pm@parkview.co.uk",
    frequency: "weekly", status: "active", tags: ["commercial", "contract"],
    lastJobDate: "2026-04-06", nextJobDate: "2026-04-13", lifetimeValue: 4680,
    services: [
      { type: "commercial", label: "Common areas",  date: "2026-04-06", price: 95, status: "complete" },
      { type: "commercial", label: "Common areas",  date: "2026-03-30", price: 95, status: "complete" },
    ],
    notes: "4 blocks. Needs completion sheet signed each visit. Contact: Tom Reed.",
    source: "Referral — Greenfield",
  },
  {
    id: 6, name: "James Fletcher", postcode: "SW7 3NP", phone: "07700 900006", email: "j.fletcher@email.com",
    frequency: "one-off", status: "lapsed", tags: ["end-of-tenancy"],
    lastJobDate: "2026-01-15", nextJobDate: null, lifetimeValue: 320,
    services: [
      { type: "end-of-tenancy", label: "End of tenancy clean", date: "2026-01-15", price: 320, status: "complete" },
    ],
    notes: "Moved to Clapham — new property SW11. Mentioned needing ongoing cleaner.",
    source: "Checkatrade",
  },
  {
    id: 7, name: "Kensington Apartments Ltd", postcode: "W8 4PT", phone: "02079 000007", email: "ops@kensingtonapts.com",
    frequency: "fortnightly", status: "active", tags: ["commercial", "windows"],
    lastJobDate: "2026-03-22", nextJobDate: "2026-04-05", lifetimeValue: 2160,
    services: [
      { type: "windows",    label: "External window round", date: "2026-03-22", price: 180, status: "complete" },
      { type: "windows",    label: "External window round", date: "2026-03-08", price: 180, status: "complete" },
    ],
    notes: "20 units. Access via main concierge — buzz on arrival. Cheque payment only.",
    source: "Direct approach",
  },
  {
    id: 8, name: "Rebecca Patel", postcode: "SE5 8JK", phone: "07700 900008", email: "r.patel@email.com",
    frequency: "one-off", status: "at-risk", tags: ["deep", "one-off"],
    lastJobDate: "2026-02-20", nextJobDate: null, lifetimeValue: 145,
    services: [
      { type: "deep", label: "One-off deep clean", date: "2026-02-20", price: 145, status: "complete" },
    ],
    notes: "New build, very clean already. Said she might want regular cleans once settled.",
    source: "Instagram",
  },
  {
    id: 9, name: "Nexus Creative HQ", postcode: "EC1A 2BB", phone: "02079 000009", email: "studio@nexuscreative.com",
    frequency: "weekly", status: "active", tags: ["commercial"],
    lastJobDate: "2026-04-05", nextJobDate: "2026-04-12", lifetimeValue: 3200,
    services: [
      { type: "commercial", label: "Studio clean",   date: "2026-04-05", price: 200, status: "complete" },
      { type: "commercial", label: "Deep studio",    date: "2026-03-01", price: 320, status: "complete" },
    ],
    notes: "Creative agency — lots of kit, be careful around equipment. Pay via bank transfer.",
    source: "Referral — Fletcher",
  },
  {
    id: 10, name: "Thomas Wilson", postcode: "SW3 4LM", phone: "07700 900010", email: "t.wilson@email.com",
    frequency: "one-off", status: "lapsed", tags: ["windows", "exterior"],
    lastJobDate: "2025-10-12", nextJobDate: null, lifetimeValue: 245,
    services: [
      { type: "windows",  label: "Window clean",          date: "2025-10-12", price: 65,  status: "complete" },
      { type: "exterior", label: "Driveway pressure wash", date: "2025-10-12", price: 95,  status: "complete" },
      { type: "gutter",   label: "Gutter clean",           date: "2025-09-01", price: 85,  status: "complete" },
    ],
    notes: "Big house, lots of windows. Said windows needed doing every 6 weeks.",
    source: "Google search",
  },
  {
    id: 11, name: "Adams Family", postcode: "SW4 9QR", phone: "07700 900011", email: "c.adams@email.com",
    frequency: "monthly", status: "active", tags: ["regular", "carpet"],
    lastJobDate: "2026-03-20", nextJobDate: "2026-04-20", lifetimeValue: 660,
    services: [
      { type: "regular", label: "Regular clean",    date: "2026-03-20", price: 70, status: "complete" },
      { type: "carpet",  label: "Carpet clean",     date: "2026-02-20", price: 120, status: "complete" },
      { type: "oven",    label: "Oven clean",       date: "2026-02-20", price: 65, status: "complete" },
      { type: "regular", label: "Regular clean",    date: "2026-02-20", price: 70, status: "complete" },
    ],
    notes: "3 kids — busy house. Flexible on timing. Always pay on day.",
    source: "Facebook group",
  },
  {
    id: 12, name: "Riverside Retail Ltd", postcode: "SE1 2UP", phone: "02079 000012", email: "manager@riverside-retail.com",
    frequency: "one-off", status: "lapsed", tags: ["commercial", "one-off"],
    lastJobDate: "2025-12-20", nextJobDate: null, lifetimeValue: 380,
    services: [
      { type: "commercial", label: "Pre-Christmas deep clean", date: "2025-12-20", price: 380, status: "complete" },
    ],
    notes: "Retail unit on SE1. Mentioned wanting quarterly deep cleans going forward. Follow up!",
    source: "Checkatrade",
  },
  {
    id: 13, name: "Brian Okello", postcode: "SW16 5TH", phone: "07700 900013", email: "b.okello@email.com",
    frequency: "one-off", status: "active", tags: ["roof", "gutter"],
    lastJobDate: "2026-04-01", nextJobDate: null, lifetimeValue: 420,
    services: [
      { type: "roof",    label: "Roof moss treatment",  date: "2026-04-01", price: 280, status: "complete" },
      { type: "gutter",  label: "Gutter clean",          date: "2026-04-01", price: 140, status: "complete" },
    ],
    notes: "Large detached — significant moss build-up on north-facing roof. Happy with work. Mentioned wanting annual treatment.",
    source: "Checkatrade",
  },
]; END DEMO_CUSTOMERS REMOVED */

// ─── AI message generation via Claude API ─────────────────────────────────────
async function generateAIMessage(customer, suggestionType, customInstructions = "") {
  const daysSince = customer.lastJobDate
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const prompt = `You are writing a short, warm, professional message from a UK cleaning business owner to a customer.

Customer: ${customer.name}
Last job: ${customer.services[0]?.label ?? "general clean"} on ${new Date(customer.lastJobDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
Days since last job: ${daysSince}
Customer notes: ${customer.notes}
Services they've had: ${[...new Set(customer.services.map(s => s.label))].join(", ")}
Message purpose: ${suggestionType}
${customInstructions ? `Additional instructions: ${customInstructions}` : ""}

Write a concise, friendly, personal message (3-4 short paragraphs max). No subject line. Start with "Hi ${customer.name.split(" ")[0]}," — do not use formal language or corporate speak. Sound like a real person who knows this customer. End with "Kind regards" only — no name placeholder needed.`;

  const { data, error } = await supabase.functions.invoke("ai-generate", {
    body: { messages: [{ role: "user", content: prompt }], max_tokens: 400 },
  });
  if (error) throw error;
  return data?.content?.[0]?.text ?? "";
}

// ─── Design system components ─────────────────────────────────────────────────

function GlassCard({ children, className = "" }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] ${className}`}
      style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

const SL = ({ children }) => (
  <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-2">{children}</p>
);

function Chip({ children, color = "gray" }) {
  const s = {
    gray:    "bg-white/5 text-[rgba(153,197,255,0.6)] border-[rgba(153,197,255,0.12)]",
    blue:    "bg-[#1f48ff]/15 text-[#99c5ff] border-[#1f48ff]/25",
    green:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    orange:  "bg-orange-500/15 text-orange-300 border-orange-500/25",
    amber:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
    red:     "bg-red-500/15 text-red-300 border-red-500/25",
    purple:  "bg-purple-500/15 text-purple-300 border-purple-500/25",
    sky:     "bg-sky-500/15 text-sky-300 border-sky-500/25",
    navy:    "bg-[#1f48ff]/30 text-white border-[#1f48ff]/40",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${s[color] ?? s.gray}`}>
      {children}
    </span>
  );
}

function Alert({ type = "blue", children }) {
  const s = {
    warn:  "bg-amber-500/10 border-amber-500/20 text-amber-300",
    green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
    blue:  "bg-[#1f48ff]/10 border-[#1f48ff]/20 text-[#99c5ff]",
    gold:  "bg-amber-500/10 border-amber-500/20 text-amber-300",
    red:   "bg-red-500/10 border-red-500/20 text-red-300",
  };
  const icons = { warn: "⚠", green: "✓", blue: "ℹ", gold: "→", red: "!" };
  return (
    <div className={`flex gap-3 p-3 border text-sm leading-relaxed rounded-xl ${s[type]}`}>
      <span className="shrink-0 mt-0.5 font-bold text-xs w-4 text-center">{icons[type]}</span>
      <div>{children}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = {
    active:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    lapsed:   "bg-red-500/15 text-red-300 border-red-500/25",
    "at-risk":"bg-amber-500/15 text-amber-300 border-amber-500/25",
  };
  const l = { active: "● Active", lapsed: "◌ Lapsed", "at-risk": "⚠ At risk" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold border ${s[status] ?? s.active}`}>
      {l[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const s = {
    urgent: "bg-red-500/15 text-red-300 border-red-500/25",
    high:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
    medium: "bg-[#1f48ff]/15 text-[#99c5ff] border-[#1f48ff]/25",
    low:    "bg-white/5 text-[rgba(153,197,255,0.5)] border-white/10",
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-lg text-xs font-bold border ${s[priority]}`}>
      {priority}
    </span>
  );
}

// ─── Star rating component ────────────────────────────────────────────────────
function StarRating({ value = 0, onChange, size = "sm" }) {
  const sz = size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange?.(star === value ? 0 : star)}
          className={`${sz} transition-all ${star <= value ? "text-amber-400" : "text-[rgba(153,197,255,0.2)]"} ${onChange ? "hover:text-amber-300 cursor-pointer" : "cursor-default"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// ─── Customer card (list row) ─────────────────────────────────────────────────
function CustomerRow({ customer, onClick, selected }) {
  const suggestions    = useMemo(() => generateSuggestions(customer), [customer]);
  const daysSince      = customer.lastJobDate
    ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000)
    : null;
  const urgent         = suggestions.some(s => s.priority === "urgent" || s.priority === "high");
  const topSuggestion  = suggestions[0];

  const initials = customer.name.split(" ").map(n => n[0]).slice(0, 2).join("");

  const avatarRing = customer.status === "active"
    ? "ring-emerald-500/40"
    : customer.status === "lapsed"
    ? "ring-red-500/40"
    : "ring-amber-500/40";

  const avatarBg = customer.status === "active"
    ? "bg-emerald-500/20 text-emerald-300"
    : customer.status === "lapsed"
    ? "bg-red-500/20 text-red-300"
    : "bg-amber-500/20 text-amber-300";

  return (
    <button
      onClick={() => onClick(customer)}
      className={`w-full text-left p-3 transition-all group ${selected ? "opacity-100" : "opacity-90 hover:opacity-100"}`}
    >
      <div
        className={`relative overflow-hidden rounded-xl border transition-all ${
          selected
            ? "border-[#1f48ff]/60 shadow-lg shadow-[#1f48ff]/20"
            : "border-[rgba(153,197,255,0.10)] hover:border-[rgba(153,197,255,0.25)]"
        }`}
        style={{
          background: selected
            ? "linear-gradient(145deg, #0d1e78 0%, #1a2fa0 100%)"
            : "linear-gradient(145deg, #05124a 0%, #0a1860 100%)",
        }}
      >
        {/* Top shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />
        {/* Urgent pulse glow */}
        {urgent && <div className="absolute inset-0 rounded-xl bg-amber-500/5 pointer-events-none" />}

        <div className="relative p-3">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ring-2 ${avatarRing} ${avatarBg}`}>
              {initials}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-white truncate">{customer.name}</p>
                {urgent && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-[11px] text-[rgba(153,197,255,0.5)]">{customer.postcode}</span>
                <span className="text-[rgba(153,197,255,0.2)]">·</span>
                <span className="text-[11px] text-[rgba(153,197,255,0.5)] capitalize">{customer.frequency}</span>
              </div>
              {topSuggestion && (
                <p className="text-[11px] text-amber-400 font-semibold truncate">💡 {topSuggestion.title}</p>
              )}
            </div>

            {/* Right */}
            <div className="text-right shrink-0">
              <p className="text-sm font-black text-emerald-400 tabular-nums mb-1">£{customer.lifetimeValue.toLocaleString()}</p>
              <StatusBadge status={customer.status} />
              {customer.rating > 0 && (
                <div className="flex justify-end mt-1">
                  <StarRating value={customer.rating} size="sm" />
                </div>
              )}
            </div>
          </div>

          {/* Tags + portal row */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(153,197,255,0.06)]">
            <div className="flex items-center gap-1.5">
              {customer.tags.slice(0, 2).map(tag => <Chip key={tag} color="sky">{tag}</Chip>)}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[rgba(153,197,255,0.3)] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[rgba(153,197,255,0.2)]" />
              Portal ready
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Message composer modal ───────────────────────────────────────────────────
function MessageComposer({ customer, suggestion, onClose }) {
  const [tab,          setTab]          = useState("template");
  const [messageType,  setMessageType]  = useState(
    suggestion?.type === "winback"  ? "winback"  :
    suggestion?.type === "reminder" ? "reminder" : "reminder"
  );
  const [customInstr,  setCustomInstr]  = useState("");
  const [body,         setBody]         = useState(() => {
    const tpl = generateMessage(customer, messageType);
    return tpl.body;
  });
  const [subject,      setSubject]      = useState(() => {
    const tpl = generateMessage(customer, messageType);
    return tpl.subject;
  });
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState(null);
  const [copied,       setCopied]       = useState(false);

  const MESSAGE_TYPES = [
    { id: "reminder",          label: "Job reminder"     },
    { id: "winback",           label: "Win-back"         },
    { id: "upsell_deep",       label: "Deep clean offer" },
    { id: "upsell_carpet",     label: "Carpet add-on"    },
    { id: "crosssell_exterior",label: "Exterior add-on"  },
    { id: "crosssell_regular", label: "Regular clean"    },
  ];

  const handleTypeChange = (type) => {
    setMessageType(type);
    const tpl = generateMessage(customer, type);
    setBody(tpl.body);
    setSubject(tpl.subject);
  };

  const handleAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const text = await generateAIMessage(customer, messageType, customInstr);
      setBody(text);
      setTab("ai");
    } catch {
      setAiError("Couldn't generate message — check your connection.");
    } finally {
      setAiLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Top shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />

        {/* Header */}
        <div
          className="relative flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: "linear-gradient(135deg, #0d1e78 0%, #05124a 100%)" }}
        >
          <div>
            <p className="font-black text-sm text-white">Message — {customer.name.split(" ")[0]}</p>
            <p className="text-xs text-[#99c5ff] mt-0.5">{suggestion?.title ?? "Custom message"}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 relative">
          <div className="p-5 space-y-4">
            {/* Message type */}
            <div>
              <SL>Message type</SL>
              <div className="flex flex-wrap gap-1.5">
                {MESSAGE_TYPES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTypeChange(t.id)}
                    className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      messageType === t.id
                        ? "bg-[#1f48ff] text-white border-[#1f48ff]/60"
                        : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <SL>Subject line</SL>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <SL>Message body</SL>
                <div className="flex gap-2">
                  <button
                    onClick={handleAI}
                    disabled={aiLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      aiLoading
                        ? "bg-white/5 text-[rgba(153,197,255,0.3)] border-[rgba(153,197,255,0.08)] cursor-not-allowed"
                        : "bg-[rgba(153,197,255,0.08)] border-[rgba(153,197,255,0.15)] text-[#99c5ff] hover:bg-[rgba(153,197,255,0.15)]"
                    }`}
                  >
                    {aiLoading ? (
                      <>
                        <span className="w-3 h-3 border-2 border-[#99c5ff] border-t-transparent rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : (
                      "AI personalise"
                    )}
                  </button>
                  <button
                    onClick={copy}
                    className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-colors ${
                      copied
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/25"
                        : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                    }`}
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
              </div>
              {aiError && <div className="mb-2"><Alert type="warn">{aiError}</Alert></div>}
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                className="w-full bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors resize-none leading-relaxed font-mono"
              />
            </div>

            {/* Custom instructions for AI */}
            <div>
              <SL>AI instructions (optional)</SL>
              <input
                value={customInstr}
                onChange={e => setCustomInstr(e.target.value)}
                placeholder="e.g. mention the bank holiday, keep it under 3 sentences..."
                className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="relative px-5 py-4 border-t border-[rgba(153,197,255,0.08)] bg-[#010a4f]/90 flex gap-2 shrink-0">
          <a
            href={`mailto:${customer.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
            className={`flex-1 py-2.5 text-center text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25 ${
              customer.email
                ? "bg-[#1f48ff] hover:bg-[#3a5eff] text-white"
                : "bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.3)] cursor-not-allowed pointer-events-none"
            }`}
          >
            {customer.email ? "Send email" : "No email on file"}
          </a>
          <button
            onClick={copy}
            className="flex-1 py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
          >
            {copied ? "Copied" : "Copy text"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[rgba(153,197,255,0.4)] hover:text-white text-xs font-bold uppercase transition-colors rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Secure Vault ────────────────────────────────────────────────────���────────
// Stores sensitive access info (key codes, alarm codes etc.) behind a staff PIN.
// Any valid staff PIN unlocks it. Auto-locks after 30 seconds.
// Every access is logged with staff name + timestamp — visible to the manager.

const VAULT_STAFF = [
  { id: 1, name: "Emma Clarke",  role: "Lead Cleaner", pin: "1234" },
  { id: 2, name: "Tom Hughes",   role: "Cleaner",      pin: "5678" },
  // Manager override PIN — change in Settings (hardcoded default: 0000)
  { id: 0, name: "Manager",      role: "Manager",      pin: "0000" },
];

const AUTO_LOCK_SECS = 30;

function SecureVault({ customer, ownerId }) {
  const vaultDataKey = `cadi_vault_${ownerId}_${customer.id}`;
  const logKey       = `cadi_vault_log_${ownerId}`;

  const [lockState, setLockState] = useState("locked"); // "locked" | "unlocked" | "editing"
  const [pin,       setPin]       = useState("");
  const [shake,     setShake]     = useState(false);
  const [pinError,  setPinError]  = useState("");
  const [countdown, setCountdown] = useState(AUTO_LOCK_SECS);
  const timerRef = useRef(null);

  const [vaultData, setVaultData] = useState(() => {
    try { return JSON.parse(localStorage.getItem(vaultDataKey)) || { keyCode: "", alarmCode: "", gateCode: "", accessNotes: "" }; }
    catch { return { keyCode: "", alarmCode: "", gateCode: "", accessNotes: "" }; }
  });
  const [editForm, setEditForm] = useState(vaultData);

  const [accessLog, setAccessLog] = useState(() => {
    try {
      const all = JSON.parse(localStorage.getItem(logKey) || "[]");
      return all.filter(e => e.customerId === customer.id);
    } catch { return []; }
  });

  // Auto-lock countdown
  useEffect(() => {
    if (lockState !== "unlocked") { clearInterval(timerRef.current); return; }
    setCountdown(AUTO_LOCK_SECS);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); setLockState("locked"); setPin(""); return AUTO_LOCK_SECS; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [lockState]);

  const addDigit = (d) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setPinError("");
    if (next.length === 4) setTimeout(() => verifyPin(next), 150);
  };

  const delDigit = () => setPin(p => p.slice(0, -1));

  const verifyPin = (entered) => {
    const match = VAULT_STAFF.find(m => m.pin === entered);
    if (match) {
      // Log the access
      const entry = {
        customerId:   customer.id,
        customerName: customer.name,
        staffName:    match.name,
        staffRole:    match.role,
        ts:           new Date().toISOString(),
      };
      const all = (() => { try { return JSON.parse(localStorage.getItem(logKey) || "[]"); } catch { return []; } })();
      const updated = [...all, entry];
      localStorage.setItem(logKey, JSON.stringify(updated));
      setAccessLog(updated.filter(e => e.customerId === customer.id));
      setLockState("unlocked");
      setPin("");
    } else {
      setShake(true);
      setPinError("Incorrect PIN — try again");
      setPin("");
      setTimeout(() => setShake(false), 500);
    }
  };

  const saveVault = () => {
    localStorage.setItem(vaultDataKey, JSON.stringify(editForm));
    setVaultData(editForm);
    setLockState("unlocked");
  };

  const hasContent = vaultData.keyCode || vaultData.alarmCode || vaultData.gateCode || vaultData.accessNotes;
  const KEYS = ["1","2","3","4","5","6","7","8","9","","0","del"];

  // ── LOCKED ────────────────────────────────────────────────────────────────────
  if (lockState === "locked") {
    return (
      <div className="space-y-4">
        <div
          className="relative overflow-hidden rounded-2xl border border-[rgba(153,197,255,0.15)]"
          style={{ background: "linear-gradient(145deg, #05124a 0%, #0a1860 100%)" }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />

          {/* Header */}
          <div className="px-5 pt-6 pb-4 text-center border-b border-[rgba(153,197,255,0.08)]">
            <div className="w-16 h-16 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] flex items-center justify-center mx-auto mb-3 shadow-inner">
              <span className="text-3xl">🔒</span>
            </div>
            <p className="font-black text-white text-base">Secure Access Info</p>
            <p className="text-xs text-[rgba(153,197,255,0.45)] mt-1">Key codes · Alarm · Gate · Entry notes</p>
            <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-2 font-semibold uppercase tracking-wide">Enter your staff PIN to view</p>
          </div>

          {/* PIN dots */}
          <div className={`flex justify-center gap-5 py-5 ${shake ? "animate-bounce" : ""}`}>
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < pin.length
                  ? "bg-[#99c5ff] border-[#99c5ff] shadow-lg shadow-[#99c5ff]/30"
                  : "border-[rgba(153,197,255,0.25)]"
              }`} />
            ))}
          </div>
          {pinError && <p className="text-center text-xs text-red-400 font-semibold -mt-2 mb-3 px-4">{pinError}</p>}

          {/* Numpad */}
          <div className="grid grid-cols-3 border-t border-[rgba(153,197,255,0.08)]">
            {KEYS.map((k, i) => (
              <button
                key={i}
                type="button"
                onClick={() => k === "del" ? delDigit() : k !== "" ? addDigit(k) : undefined}
                disabled={k === ""}
                className={`py-4 text-center border-[rgba(153,197,255,0.07)] transition-all select-none
                  ${i % 3 !== 2 ? "border-r" : ""}
                  ${i < 9 ? "border-b" : ""}
                  ${k === "" ? "cursor-default" : "hover:bg-[rgba(153,197,255,0.05)] active:bg-[rgba(153,197,255,0.12)]"}
                  ${k === "del" ? "text-[rgba(153,197,255,0.45)] hover:text-white text-lg" : "text-white font-bold text-xl"}
                `}
              >
                {k === "del" ? "⌫" : k}
              </button>
            ))}
          </div>
        </div>

        {/* Recent access summary — visible without PIN (shows WHO viewed, not WHAT) */}
        {accessLog.length > 0 && (
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <SL>Recent access</SL>
              <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                {accessLog.length} view{accessLog.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2.5">
              {[...accessLog].reverse().slice(0, 3).map((e, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                    e.staffRole === "Manager" ? "bg-[#1f48ff]/15 border border-[#1f48ff]/25" : "bg-amber-500/12 border border-amber-500/20"
                  }`}>
                    {e.staffRole === "Manager" ? "👑" : "👤"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{e.staffName}</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)]">{e.staffRole}</p>
                  </div>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)] tabular-nums shrink-0">
                    {new Date(e.ts).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    );
  }

  // ── EDITING ───────────────────────────────────────────────────────────────────
  if (lockState === "editing") {
    const inp = "w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors";
    const lbl = "block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] mb-1.5";
    return (
      <div className="space-y-4">
        <GlassCard className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Secure Vault</p>
              <p className="text-sm font-black text-white">Edit access info</p>
            </div>
            <button onClick={() => setLockState("unlocked")}
              className="text-xs text-[rgba(153,197,255,0.4)] hover:text-white px-3 py-1.5 rounded-lg border border-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.25)] transition-all">
              Cancel
            </button>
          </div>
          {[
            { key: "keyCode",   label: "Key / lockbox code", placeholder: "e.g. 4521 or key under mat" },
            { key: "alarmCode", label: "Alarm code",         placeholder: "e.g. 1234  (disarm on entry)" },
            { key: "gateCode",  label: "Gate / entry code",  placeholder: "e.g. *0042#" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={lbl}>{label}</label>
              <input type="text" value={editForm[key]}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className={inp} />
            </div>
          ))}
          <div>
            <label className={lbl}>Access notes</label>
            <textarea value={editForm.accessNotes}
              onChange={e => setEditForm(f => ({ ...f, accessNotes: e.target.value }))}
              placeholder="Parking spot, pet name, entry instructions, anything else…"
              rows={3} className={`${inp} resize-none`} />
          </div>
          <button onClick={saveVault}
            className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-[#1f48ff]/25">
            Save secure info
          </button>
        </GlassCard>
      </div>
    );
  }

  // ── UNLOCKED ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Unlock bar with countdown */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
        <div className="flex items-center gap-2">
          <span className="text-base">🔓</span>
          <span className="text-xs font-bold text-emerald-400">Unlocked</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Countdown bar */}
          <div className="flex items-center gap-1.5">
            <div className="w-20 h-1.5 bg-[rgba(153,197,255,0.08)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(countdown / AUTO_LOCK_SECS) * 100}%`,
                  background: countdown > 10 ? "#34d399" : "#f87171",
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-[rgba(153,197,255,0.45)] w-6">{countdown}s</span>
          </div>
          <button
            onClick={() => { clearInterval(timerRef.current); setLockState("locked"); setPin(""); }}
            className="text-[10px] font-bold text-[rgba(153,197,255,0.45)] hover:text-white px-2.5 py-1 rounded-lg border border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.3)] transition-all"
          >
            Lock
          </button>
        </div>
      </div>

      {/* Vault content */}
      {hasContent ? (
        <GlassCard className="divide-y divide-[rgba(153,197,255,0.08)]">
          {[
            { emoji: "🗝", label: "Key / lockbox", value: vaultData.keyCode   },
            { emoji: "🚨", label: "Alarm code",    value: vaultData.alarmCode },
            { emoji: "🚪", label: "Gate code",     value: vaultData.gateCode  },
          ].filter(r => r.value).map(r => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-base shrink-0">{r.emoji}</span>
              <span className="text-xs text-[rgba(153,197,255,0.45)] w-24 shrink-0 font-semibold uppercase tracking-wide">{r.label}</span>
              <span className="font-black text-base text-white tracking-[0.2em] select-all">{r.value}</span>
            </div>
          ))}
          {vaultData.accessNotes && (
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">📋 Access notes</p>
              <p className="text-sm text-[rgba(153,197,255,0.85)] leading-relaxed">{vaultData.accessNotes}</p>
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-8 text-center">
          <span className="text-4xl mb-3 block">🗝</span>
          <p className="text-sm font-semibold text-[rgba(153,197,255,0.5)]">Nothing saved yet</p>
          <p className="text-xs text-[rgba(153,197,255,0.3)] mt-1">Add key codes, alarm codes and access instructions</p>
        </GlassCard>
      )}

      {/* Edit */}
      <button
        onClick={() => { setEditForm(vaultData); setLockState("editing"); }}
        className="w-full py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.04)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white text-xs font-bold transition-all"
      >
        ✏ Edit secure info
      </button>

      {/* Full access log */}
      {accessLog.length > 0 && (
        <GlassCard className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <SL>Access log</SL>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.5)]">
              {accessLog.length} total
            </span>
          </div>
          <div className="space-y-2.5">
            {[...accessLog].reverse().map((e, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                  e.staffRole === "Manager" ? "bg-[#1f48ff]/15 border border-[#1f48ff]/25" : "bg-amber-500/10 border border-amber-500/20"
                }`}>
                  {e.staffRole === "Manager" ? "👑" : "👤"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">
                    {e.staffName}
                    <span className="ml-1 font-normal text-[rgba(153,197,255,0.4)]">viewed access info</span>
                  </p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.35)]">{e.staffRole}</p>
                </div>
                <p className="text-[10px] text-[rgba(153,197,255,0.35)] tabular-nums shrink-0">
                  {new Date(e.ts).toLocaleString("en-GB", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" })}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─── Customer detail panel ────────────────────────────────────────────────────
function CustomerDetail({ customer, onMessage, onClose, onBookJob, onUpdateCustomer, onDeleteCustomer, ownerId }) {
  const suggestions  = useMemo(() => generateSuggestions(customer), [customer]);
  const hasLastJob   = Boolean(customer.lastJobDate);
  const daysSince    = hasLastJob ? Math.floor((Date.now() - new Date(customer.lastJobDate)) / 86400000) : null;
  const totalJobs    = customer.completedJobs ?? 0;
  const lastJobLabel = hasLastJob && daysSince >= 0
    ? `${daysSince}d ago`
    : customer.nextJobDate
      ? `in ${Math.max(0, Math.ceil((new Date(customer.nextJobDate) - Date.now()) / 86400000))}d`
      : "—";
  const lastJobAccent = hasLastJob && daysSince > 60 ? "text-amber-400" : "text-white";
  const uniqueTypes  = [...new Set(customer.services.map(s => s.type))];

  const [activeTab, setActiveTab] = useState("overview");

  const TABS = ["overview", "history", "suggestions", "messages", "secure"];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#010a4f]">
      {/* Header */}
      <div
        className="relative overflow-hidden shrink-0"
        style={{ background: "linear-gradient(135deg, #0d1e78 0%, #05124a 60%, #010a4f 100%)" }}
      >
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[rgba(31,72,255,0.15)] blur-2xl pointer-events-none" />

        <div className="relative px-5 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">Customer Profile</p>
              <p className="font-black text-xl text-white">{customer.name}</p>
              <p className="text-xs text-[#99c5ff] mt-0.5">{customer.postcode} · {customer.frequency}</p>
              <div className="mt-1.5">
                <StarRating value={customer.rating || 0} onChange={(r) => onUpdateCustomer?.(customer.id, { rating: r })} size="sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={customer.status} />
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-all text-sm"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick stats — 3 glass pills */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Lifetime value",  value: `£${customer.lifetimeValue.toLocaleString()}`, accent: "text-emerald-400" },
              { label: "Total jobs",      value: totalJobs, accent: "text-white" },
              { label: hasLastJob && daysSince >= 0 ? "Last job" : "Next job", value: lastJobLabel, accent: lastJobAccent },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-white/[0.08] backdrop-blur-sm rounded-xl px-2 py-2 text-center border border-white/10">
                <p className="text-[10px] text-[rgba(153,197,255,0.5)] mb-0.5">{label}</p>
                <p className={`text-base font-black ${accent}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Portal invite */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.10)]">
            <span className="text-sm">🔗</span>
            <p className="text-xs text-[rgba(153,197,255,0.6)] flex-1">
              Customer portal — invite {customer.name.split(" ")[0]} to manage bookings &amp; messages
            </p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[rgba(153,197,255,0.1)] text-[rgba(153,197,255,0.5)] border border-[rgba(153,197,255,0.1)]">
              Coming soon
            </span>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-[rgba(153,197,255,0.08)] bg-[#010a4f] shrink-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
              t === "secure"
                ? activeTab === t
                  ? "border-amber-400 text-amber-300"
                  : "border-transparent text-[rgba(153,197,255,0.35)] hover:text-amber-400"
                : activeTab === t
                  ? "border-[#99c5ff] text-white"
                  : "border-transparent text-[rgba(153,197,255,0.35)] hover:text-[rgba(153,197,255,0.7)]"
            }`}
          >
            {t === "secure" ? "🔒" : t}
            {t === "suggestions" && suggestions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded-lg text-[10px] border border-amber-500/25">
                {suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto bg-[#010a4f] p-4 space-y-4">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            {/* Status + tags */}
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={customer.status} />
              {customer.tags.map(tag => <Chip key={tag} color="sky">{tag}</Chip>)}
            </div>

            {/* Contact */}
            <GlassCard>
              {[
                ["Phone",    customer.phone],
                ["Email",    customer.email],
                ["Postcode", customer.postcode],
                ["Next job", customer.nextJobDate ? new Date(customer.nextJobDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Not booked"],
                ["Source",   customer.source],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(153,197,255,0.06)] last:border-b-0">
                  <span className="text-[rgba(153,197,255,0.4)] w-16 shrink-0 text-[10px] font-bold tracking-wide uppercase">{label}</span>
                  <span className={`font-semibold text-sm ${label === "Next job" && !customer.nextJobDate ? "text-amber-400" : "text-white"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </GlassCard>

            {/* Notes */}
            <GlassCard className="p-4">
              <SL>Notes</SL>
              <p className="text-sm text-[rgba(153,197,255,0.8)] leading-relaxed">{customer.notes}</p>
            </GlassCard>

            {/* Services */}
            <GlassCard className="p-4">
              <SL>Services</SL>
              <div className="flex flex-wrap gap-1.5">
                {uniqueTypes.map(type => {
                  const jt = JOB_TYPES.find(j => j.id === type);
                  return jt ? <Chip key={type} color={jt.color}>{jt.label}</Chip> : null;
                })}
              </div>
            </GlassCard>

            {/* Editable service types */}
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <SL>Services offered</SL>
                <span className="text-[10px] text-[rgba(153,197,255,0.4)]">Tap to toggle</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {JOB_TYPES.filter(jt => jt.id !== 'all').map(jt => {
                  const active = (customer.serviceTypes || []).includes(jt.id);
                  return (
                    <button key={jt.id} type="button"
                      onClick={() => {
                        const current = customer.serviceTypes || [];
                        const next = active ? current.filter(s => s !== jt.id) : [...current, jt.id];
                        onUpdateCustomer?.(customer.id, { serviceTypes: next });
                      }}
                      className={`px-2.5 py-1 text-xs font-bold border rounded-lg transition-all ${
                        active
                          ? "bg-[#1f48ff]/20 text-[#99c5ff] border-[#1f48ff]/40"
                          : "bg-[rgba(153,197,255,0.04)] text-[rgba(153,197,255,0.35)] border-[rgba(153,197,255,0.08)] hover:border-[rgba(153,197,255,0.2)]"
                      }`}
                    >{jt.label}</button>
                  );
                })}
              </div>
            </GlassCard>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onMessage(customer, null)}
                className="py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25"
              >
                Send message
              </button>
              <button
                onClick={() => onBookJob?.(customer)}
                className="py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl"
              >
                Book job
              </button>
              <button className="py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl">
                Call
              </button>
              <button className="py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl">
                Add note
              </button>
            </div>
          </>
        )}

        {/* HISTORY */}
        {activeTab === "history" && (
          <>
            <div className="flex items-center justify-between">
              <SL>Job history</SL>
              <span className="text-xs text-emerald-400 font-semibold">£{customer.lifetimeValue.toLocaleString()} lifetime</span>
            </div>
            <div className="space-y-2">
              {customer.services.map((job, i) => {
                const jt = JOB_TYPES.find(j => j.id === job.type);
                return (
                  <GlassCard key={i} className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-[#99c5ff] shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">{job.label}</p>
                        <p className="text-xs text-[rgba(153,197,255,0.4)]">
                          {new Date(job.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">£{job.price}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-emerald-500/15 text-emerald-300 rounded-lg border border-emerald-500/25 font-bold">
                          ✓ {job.status}
                        </span>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>

            {/* Frequency insight */}
            <Alert type="blue">
              {customer.frequency === "one-off"
                ? "One-off customer — no recurring booking. Consider a follow-up message to convert."
                : `${customer.frequency.charAt(0).toUpperCase() + customer.frequency.slice(1)} customer since first job. Average job value: £${Math.round(customer.lifetimeValue / customer.services.length)}.`}
            </Alert>
          </>
        )}

        {/* SUGGESTIONS */}
        {activeTab === "suggestions" && (
          <>
            <div className="flex items-center justify-between">
              <SL>AI opportunities</SL>
              <Chip color="amber">{suggestions.length} suggestions</Chip>
            </div>

            {suggestions.length === 0 ? (
              <Alert type="green">No urgent opportunities right now — this customer is well engaged.</Alert>
            ) : (
              suggestions.map((s, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] ${
                    s.priority === "urgent"
                      ? "border-l-[3px] border-l-red-400"
                      : s.priority === "high"
                      ? "border-l-[3px] border-l-amber-400"
                      : "border-l-[3px] border-l-[#99c5ff]"
                  }`}
                  style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
                  <div className="relative p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-white">{s.title}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <PriorityBadge priority={s.priority} />
                        {s.value > 0 && <Chip color="green">+£{s.value}</Chip>}
                      </div>
                    </div>
                    <p className="text-xs text-[rgba(153,197,255,0.7)] leading-relaxed mb-3">{s.body}</p>
                    <button
                      onClick={() => onMessage(customer, s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-bold uppercase tracking-wide transition-all rounded-xl shadow-lg shadow-[#1f48ff]/25"
                    >
                      {s.action}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* MESSAGES */}
        {activeTab === "messages" && (
          <>
            <div>
              <SL>Quick message</SL>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Win-back",          type: "winback"           },
                  { label: "Job reminder",       type: "reminder"          },
                  { label: "Deep clean offer",   type: "upsell_deep"       },
                  { label: "Exterior add-on",    type: "crosssell_exterior"},
                ].map(({ label, type }) => (
                  <button
                    key={type}
                    onClick={() => onMessage(customer, { type, title: label })}
                    className="flex items-center gap-2 px-3 py-2.5 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white rounded-xl text-sm font-semibold transition-all text-left"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message log placeholder */}
            <GlassCard className="p-4">
              <SL>Message history</SL>
              <p className="text-xs text-[rgba(153,197,255,0.4)]">
                No messages logged yet. Send your first message above — it will appear here.
              </p>
            </GlassCard>
          </>
        )}

        {/* SECURE VAULT */}
        {activeTab === "secure" && (
          <SecureVault customer={customer} ownerId={ownerId} />
        )}

        {/* Danger zone — archive customer */}
        <div className="px-5 py-4 border-t border-[rgba(153,197,255,0.08)]">
          <button
            onClick={() => {
              if (window.confirm(`Archive ${customer.name}? They'll be hidden from your customer list but data will be kept.`)) {
                onDeleteCustomer?.(customer.id);
              }
            }}
            className="w-full py-2.5 text-xs font-bold uppercase tracking-wide text-red-400/70 border border-red-500/20 rounded-xl hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all"
          >
            Archive customer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Customer Modal ────────────────────────────────────────────────────────
function AddCustomerModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    town: "",
    county: "",
    postcode: "",
    frequency: "one-off",
    status: "active",
    notes: "",
    source: "",
    rating: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const newCustomer = {
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        town: form.town.trim(),
        county: form.county.trim(),
        postcode: form.postcode.trim().toUpperCase(),
        frequency: form.frequency,
        status: form.status,
        rating: form.rating || 0,
        serviceTypes: [],
        tags: [],
        notes: form.notes.trim(),
        source: form.source.trim(),
        lastJobDate: new Date().toISOString().slice(0, 10),
        nextJobDate: null,
        lifetimeValue: 0,
        services: [],
      };
      onSave(newCustomer);
    } catch (err) {
      setError(err.message || "Couldn't save customer.");
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors";
  const labelCls = "block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] mb-1";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)] w-full max-w-md flex flex-col"
        style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
      >
        {/* Shimmer */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
        {/* Grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Customers</p>
            <h3 className="text-lg font-black text-white">Add new customer</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.10)] text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.25)] transition-all text-sm"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="relative overflow-y-auto px-5 py-4 space-y-4 max-h-[70vh]">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <span>⚠</span> {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className={labelCls}>Full name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Jane Smith"
              required
              className={inputCls}
            />
          </div>

          {/* Email + Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                placeholder="jane@example.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                placeholder="07700 900000" className={inputCls} />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className={labelCls}>Address Line 1</label>
            <input type="text" value={form.addressLine1} onChange={e => set("addressLine1", e.target.value)}
              placeholder="12 High Street" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Address Line 2 <span className="normal-case font-normal opacity-60">(optional)</span></label>
            <input type="text" value={form.addressLine2} onChange={e => set("addressLine2", e.target.value)}
              placeholder="Flat 3" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Town / City</label>
              <input type="text" value={form.town} onChange={e => set("town", e.target.value)}
                placeholder="London" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Postcode</label>
              <input type="text" value={form.postcode} onChange={e => set("postcode", e.target.value.toUpperCase())}
                placeholder="SW1A 1AA" className={inputCls} />
            </div>
          </div>

          {/* Frequency row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Frequency</label>
              <select value={form.frequency} onChange={e => set("frequency", e.target.value)}
                className={inputCls}>
                <option value="one-off">One-off</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="6-weekly">6-weekly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          {/* Status + Source row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className={inputCls}>
                <option value="active">Active</option>
                <option value="at-risk">At risk</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <input type="text" value={form.source} onChange={e => set("source", e.target.value)}
                placeholder="Referral, leaflet…" className={inputCls} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Access codes, preferences, allergies…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Rating */}
          <div>
            <label className={labelCls}>Rating</label>
            <StarRating value={form.rating || 0} onChange={r => set('rating', r)} size="sm" />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-bold hover:border-[rgba(153,197,255,0.3)] hover:text-white transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black transition-all shadow-lg shadow-[#1f48ff]/25 disabled:opacity-50">
              {saving ? "Saving…" : "Save customer →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function CustomerTab() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useData();
  const { user } = useAuth();
  const { isPro, customerLimit } = usePlan();
  const navigate = useNavigate();
  const ownerId = user?.id || "demo";
  const [search,        setSearch]       = useState("");
  const [jobTypeFilter, setJobTypeFilter]= useState("all");
  const [statusFilter,  setStatusFilter] = useState("all");
  const [sortBy,        setSortBy]       = useState("name");
  const [selected,      setSelected]     = useState(null);
  const [composing,     setComposing]    = useState(null);
  const [showDetail,    setShowDetail]   = useState(false);
  const [showAddModal,  setShowAddModal] = useState(false);
  const [showUpgrade,   setShowUpgrade]  = useState(false);

  const activeCustomers = useMemo(() => customers.filter(c => c.status !== 'archived'), [customers]);
  const atLimit = !isPro && activeCustomers.length >= customerLimit;

  // ── Filtering + sorting — O(n) — handles thousands of records ───────────────
  const filtered = useMemo(() => {
    let list = customers;

    // Job type filter
    if (jobTypeFilter !== "all") {
      list = list.filter(c => c.services.some(s => s.type === jobTypeFilter));
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(c => c.status === statusFilter);
    }

    // Search — name, postcode, email, notes
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.postcode.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === "name")   return a.name.localeCompare(b.name);
      if (sortBy === "value")  return b.lifetimeValue - a.lifetimeValue;
      if (sortBy === "recent") return new Date(b.lastJobDate) - new Date(a.lastJobDate);
      if (sortBy === "urgent") {
        const urgencyScore = c => {
          const days = Math.floor((Date.now() - new Date(c.lastJobDate)) / 86400000);
          const sugPriority = generateSuggestions(c)[0]?.priority;
          const base = sugPriority === "urgent" ? 1000 : sugPriority === "high" ? 100 : 0;
          return base + days;
        };
        return urgencyScore(b) - urgencyScore(a);
      }
      return 0;
    });

    return list;
  }, [customers, search, jobTypeFilter, statusFilter, sortBy]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total   = customers.length;
    const active  = customers.filter(c => c.status === "active").length;
    const lapsed  = customers.filter(c => c.status === "lapsed").length;
    const atRisk  = customers.filter(c => c.status === "at-risk").length;
    const revenue = customers.reduce((s, c) => s + c.lifetimeValue, 0);
    const urgent  = customers.filter(c => generateSuggestions(c).some(s => s.priority === "urgent" || s.priority === "high")).length;
    return { total, active, lapsed, atRisk, revenue, urgent };
  }, [customers]);

  const handleMessage = useCallback((customer, suggestion) => {
    setComposing({ customer, suggestion });
  }, []);

  const handleAddSave = useCallback(async (newCustomer) => {
    if (atLimit) { setShowUpgrade(true); return; }
    await addCustomer(newCustomer);
    setShowAddModal(false);
  }, [addCustomer, atLimit]);

  const handleBookJob = (customer) => navigate(`/scheduler?customer=${encodeURIComponent(customer.name)}`);

  const handleSelectCustomer = (customer) => {
    setSelected(customer);
    setShowDetail(true);
  };

  return (
    <div className="relative flex h-full bg-[#010a4f] overflow-hidden">
      {showUpgrade && (
        <UpgradeModal
          reason={`You've reached ${FREE_CUSTOMER_LIMIT} customers on the free plan. Upgrade to Pro for unlimited customers.`}
          onClose={() => setShowUpgrade(false)}
        />
      )}
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed -top-40 -right-20 w-[400px] h-[400px] rounded-full bg-[rgba(31,72,255,0.10)] blur-[90px]" />
      <div className="pointer-events-none fixed -bottom-32 -left-16 w-[300px] h-[300px] rounded-full bg-[rgba(153,197,255,0.05)] blur-[70px]" />

      {/* ── Left panel: list ── */}
      <div className={`relative flex flex-col min-w-0 ${showDetail ? "hidden lg:flex lg:w-[400px]" : "flex-1"} border-r border-[rgba(153,197,255,0.08)] bg-[#010a4f]`}>

        {/* Header */}
        <div className="relative bg-[#010a4f]/80 backdrop-blur-sm border-b border-[rgba(153,197,255,0.1)] px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Cadi</p>
              <h2 className="text-2xl font-black text-white">Customers</h2>
            </div>
            <button
              onClick={() => atLimit ? setShowUpgrade(true) : setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold transition-all rounded-xl shadow-lg shadow-[#1f48ff]/30 active:scale-95">
              <span className="text-lg leading-none">{atLimit ? '🔒' : '+'}</span>
              {atLimit ? `${activeCustomers.length}/${FREE_CUSTOMER_LIMIT}` : 'Add'}
            </button>
          </div>
          {/* Status filter chips — below header on all screens */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {[
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Lapsed", value: "lapsed" },
              { label: "At risk", value: "at-risk" },
            ].map(({ label, value }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === value
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.5)] border-[rgba(153,197,255,0.12)]"
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 py-3 border-b border-[rgba(153,197,255,0.08)]">
          {[
            { label: "Total",  value: stats.total,  accent: "text-white" },
            { label: "Active", value: stats.active, accent: "text-emerald-400" },
            { label: "Lapsed", value: stats.lapsed, accent: "text-red-400" },
            { label: "Alerts", value: stats.urgent, accent: stats.urgent > 0 ? "text-amber-400" : "text-[rgba(153,197,255,0.4)]" },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="relative overflow-hidden rounded-xl border border-[rgba(153,197,255,0.10)] px-3 py-2.5 text-center"
              style={{ background: "linear-gradient(135deg, #05124a 0%, #0a1860 100%)" }}
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/30 to-transparent" />
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] font-bold tracking-wide uppercase mb-0.5">{label}</p>
              <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[rgba(153,197,255,0.4)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, postcode, notes…"
              className="w-full pl-8 pr-8 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(153,197,255,0.4)] hover:text-white text-xs font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Job type filter — horizontal scroll */}
        <div className="px-4 pb-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {JOB_TYPES.map(jt => (
              <button
                key={jt.id}
                onClick={() => setJobTypeFilter(jt.id)}
                className={`px-2.5 py-1 text-xs font-bold border rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                  jobTypeFilter === jt.id
                    ? "bg-[#1f48ff] text-white border-[#1f48ff]/60"
                    : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                }`}
              >
                {jt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort + status selects */}
        <div className="flex items-center gap-2 px-4 pb-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-xs text-[rgba(153,197,255,0.8)] focus:outline-none focus:border-[#99c5ff] transition-colors"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="lapsed">Lapsed</option>
            <option value="at-risk">At risk</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-xs text-[rgba(153,197,255,0.8)] focus:outline-none focus:border-[#99c5ff] transition-colors"
          >
            <option value="name">Sort: Name</option>
            <option value="value">Sort: Value</option>
            <option value="recent">Sort: Recent</option>
            <option value="urgent">Sort: Urgent first</option>
          </select>
          <span className="text-xs text-[rgba(153,197,255,0.4)] ml-auto">{filtered.length} customers</span>
        </div>

        {/* Customer list */}
        <div className="bg-transparent overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] flex items-center justify-center mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-1">No customers found</p>
              <button
                onClick={() => { setSearch(""); setJobTypeFilter("all"); setStatusFilter("all"); }}
                className="mt-1 text-xs text-[#99c5ff] hover:text-white font-semibold transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            filtered.map(customer => (
              <CustomerRow
                key={customer.id}
                customer={customer}
                onClick={handleSelectCustomer}
                selected={selected?.id === customer.id}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: detail ── */}
      {showDetail && selected ? (
        <div className="flex-1 overflow-hidden">
          <CustomerDetail
            customer={selected}
            onMessage={handleMessage}
            onClose={() => { setShowDetail(false); setSelected(null); }}
            onBookJob={handleBookJob}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={(id) => { deleteCustomer(id); setShowDetail(false); setSelected(null); }}
            ownerId={ownerId}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#010a4f]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👤</span>
            </div>
            <p className="text-sm font-bold text-[rgba(153,197,255,0.5)] mb-1">Select a customer</p>
            <p className="text-xs text-[rgba(153,197,255,0.3)]">View profile, job history, and AI opportunities</p>
          </div>
        </div>
      )}

      {/* ── Floating Add button — visible on mobile even in detail view ── */}
      <button
        onClick={() => setShowAddModal(true)}
        className="lg:hidden fixed bottom-20 right-5 z-40 w-14 h-14 rounded-2xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-2xl font-bold shadow-2xl shadow-[#1f48ff]/40 flex items-center justify-center transition-all active:scale-95"
        aria-label="Add customer"
      >
        +
      </button>

      {/* ── Message composer modal ── */}
      {composing && (
        <MessageComposer
          customer={composing.customer}
          suggestion={composing.suggestion}
          onClose={() => setComposing(null)}
        />
      )}

      {/* ── Add customer modal ── */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
        />
      )}
    </div>
  );
}
