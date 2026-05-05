// src/components/AskCadi.jsx
// Reusable Ask Cadi chat panel — used on Dashboard and all main tabs.
//
// Props:
//   tab   — 'dashboard' | 'money' | 'scheduler' | 'invoices' | 'staff' | 'review'
//   score — optional score object { total, tier, revScore, opsScore, invoicingScore,
//           complianceScore, growthScore, dims[] } — only meaningful on dashboard

import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ─── Route map for navigation intents ─────────────────────────────────────────
// tab  — used when onNavigate prop is provided (dashboard in-page switching)
// route — used for React Router navigation (all other tabs)
const NAV_INTENTS = [
  { pattern: /invoices?|billing|bills/,                    tab: 'invoices',   route: '/invoices',   label: 'Invoices'      },
  { pattern: /schedule|scheduler|jobs?|bookings?|calendar/, tab: 'scheduler',  route: '/scheduler',  label: 'Scheduler'     },
  { pattern: /staff|team|cleaners?|employees?/,             tab: 'staff',      route: '/staff',      label: 'Staff'         },
  { pattern: /money|payments?|accounts?|mileage|expenses?/, tab: 'money',      route: '/money',      label: 'Money'         },
  { pattern: /settings?/,                                   tab: 'settings',   route: '/settings',   label: 'Settings'      },
  { pattern: /mtd|tax return|hmrc/,                        tab: 'mtd',        route: '/settings',   label: 'MTD'           },
  { pattern: /annual review|sprint|review/,                tab: 'review',     route: '/review',     label: 'Annual Review' },
  { pattern: /dashboard|home/,                             tab: 'dashboard',  route: '/dashboard',  label: 'Dashboard'     },
];

// ─── Tab config — opening message + quick chips ────────────────────────────────
const TAB_CONFIG = {
  dashboard: {
    greeting: (score) => {
      const t = score?.total ?? 0;
      if (t >= 90) return `Cadi Score ${t} — Elite! You're running things seriously well. What can I help you with today?`;
      if (t >= 75) return `Cadi Score ${t} and Firing — you're close to Elite. What would you like help with?`;
      if (t >= 60) return `Cadi Score ${t} looking Solid. A few tweaks could push you higher. Ask me anything.`;
      if (t >= 40) return `Cadi Score ${t} — you're Building. Let's get it moving. Ask me anything about your business or how Cadi works.`;
      return `Hi! Your Cadi Score is ${t} right now. I'm here to help — ask about your score, invoices, tax, scheduling, or anything else.`;
    },
    chips: (score) => {
      const out = [];
      const lowest = [...(score?.dims ?? [])].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];
      if (lowest) out.push(`How do I improve ${lowest.label.toLowerCase()}?`);
      if ((score?.invoicingScore ?? 25) < 20) out.push('Help with overdue invoices');
      if ((score?.complianceScore ?? 15) < 12) out.push('Tax reserve tips');
      out.push('What is MTD?');
      out.push('How does the leaderboard work?');
      return out.slice(0, 4);
    },
  },
  money: {
    greeting: () => "I can help with income logging, expenses, mileage, and your tax reserve. What do you need?",
    chips: () => [
      'How do I log a payment?',
      'What expenses can I claim?',
      'Tax reserve tips',
      'How does mileage work?',
    ],
  },
  scheduler: {
    greeting: () => "Ask me anything about scheduling — creating jobs, recurring bookings, or assigning staff.",
    chips: () => [
      'How do I add a recurring job?',
      'Can I assign jobs to staff?',
      'How do jobs affect my score?',
      'Take me to invoices',
    ],
  },
  invoices: {
    greeting: () => "I can help with invoices, quotes, payment reminders, and chasing overdue payments. What would you like to know?",
    chips: () => [
      'How do I create an invoice?',
      'What happens with overdue invoices?',
      'Can I send payment reminders?',
      'How do quotes work?',
    ],
  },
  staff: {
    greeting: () => "Ask me about adding team members, payslips, compliance, or training. I'm here to help.",
    chips: () => [
      'How do I add a team member?',
      'How do payslips work?',
      "What's Right to Work?",
      'Take me to scheduler',
    ],
  },
  review: {
    greeting: () => "Let's look at your year. I can help with your annual review, sprint goals, and income targets.",
    chips: () => [
      'How do I set a sprint?',
      "What's in my annual review?",
      'How does the income target work?',
      'Growth tips',
    ],
  },
};

// ─── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(score, tab) {
  const { total = 0, tier = 'Building', revScore = 0, opsScore = 0, invoicingScore = 0, complianceScore = 0, growthScore = 0 } = score ?? {};
  return `You are Cadi — a knowledgeable business co-pilot for UK cleaning business owners. You have deep expertise in running a cleaning business: pricing, compliance, insurance, employment, marketing, client retention, cash flow, tax, and operations. You also know the Cadi app inside-out. Your job is to be the one place owners come for any business question — never send them away.

Current user's Cadi Score: ${total}/100 (Tier: ${tier})
Score breakdown: Revenue ${revScore}/25 · Operations ${opsScore}/25 · Invoicing ${invoicingScore}/25 · Compliance ${complianceScore}/15 · Growth ${growthScore}/10
User is currently in the ${tab} section of the app.

CLEANING BUSINESS EXPERTISE — answer questions across all of these areas:

COMPLIANCE & LEGAL
- ICO registration: Required if you store client personal data (names, addresses, payment info). Register at ico.org.uk, costs £40–£60/year for most small businesses. Takes 10 minutes online.
- Public Liability Insurance (PLI): Covers damage or injury caused during a clean. Most clients require at least £1m cover. Get quotes from Protectivity, Hiscox, or Simply Business.
- DBS checks: Enhanced DBS needed if working in homes with vulnerable adults or children. Apply via gov.uk or a registered umbrella body. Takes 2–8 weeks, costs ~£38.
- COSHH (Control of Substances Hazardous to Health): You must have data sheets (SDS) for all cleaning chemicals. Train staff on safe handling, storage, and PPE. Free training at COSHH Essentials online.
- GDPR: As a data controller you must have a privacy policy, only keep data you need, and have a process for data deletion requests.
- Contracts: Always use a written service agreement covering scope, frequency, price, notice period, and cancellation terms.
- Employment law: National Living Wage (£11.44/hr for 21+, 2024), holiday pay (5.6 weeks/yr), payslips required, pension auto-enrolment for staff earning over £10,000/yr.

PRICING & MONEY
- Hourly rates: Domestic cleaning typically £15–£25/hr depending on region. Commercial cleaning £12–£20/hr. End of tenancy £200–£400 per property.
- Setting rates: Calculate your costs (fuel, products, insurance, time) and add a profit margin. A common mistake is undercharging — aim for at least 30% margin.
- Price increases: Annual increases are expected. Give 4 weeks notice, frame it as a cost-of-living adjustment, rarely lose clients if you do good work.
- Late payments: Charge statutory interest (8% + Bank of England base rate) on overdue invoices. Always use written payment terms — 14 or 30 days is standard.
- Tax: Most sole traders pay 20–45% income tax + Class 4 NI (9% on profits £12,570–£50,270). Set aside 25–30% of profit monthly. Self Assessment deadline is 31 January.
- VAT: Register when turnover exceeds £85,000/yr (2024 threshold). Flat Rate Scheme can be simpler for small businesses.
- Mileage: Claim 45p/mile for the first 10,000 business miles, 25p/mile after. Log every journey.
- Expenses: Cleaning products, equipment, uniform, insurance, software (like Cadi), phone, training, fuel are all claimable.

MARKETING & GROWTH
- Getting clients: Door-to-door leafleting in target streets still works well. Facebook local groups, Nextdoor, Google Business Profile (free, gets you on Maps). Word-of-mouth is strongest — ask happy clients for referrals.
- Google Business Profile: Claim and verify your listing at business.google.com. Add photos, get reviews, and respond to them all. Free and hugely effective for local search.
- Reviews: Ask every satisfied client after the first clean. Send a direct Google review link. Aim for 10+ reviews before spending on ads.
- Social media: Before/after photos on Facebook and Instagram work well. Show the transformation, not just the product.
- Retaining clients: Regular communication, remembering details, occasional small gestures (a note, a freebie clean). Churn costs far more than retention.
- Upselling: Offer add-ons like oven cleaning, fridge clean, window interior, or end-of-tenancy deep clean to existing clients.

OPERATIONS & STAFF
- Taking on staff: Register as an employer with HMRC before first pay day. Run payroll via RTI. Keep records of hours, pay, and holidays.
- Subcontractors: CIS (Construction Industry Scheme) doesn't apply to cleaning. But verify employment status — regular subcontractors may legally be employees.
- Scheduling: Group jobs geographically to cut drive time and fuel costs.
- Quality control: Do spot checks, use a checklist per property, collect client feedback regularly.
- Equipment: Invest in a decent vacuum (Miele, Henry, Dyson), microfibre cloths (colour-coded by area), and COSHH-compliant products.

THE CADI APP — sections and features:

Dashboard — Cadi Score overview, KPI strip (today's revenue, week revenue, month income, outstanding invoices, jobs today, tax reserve %), priority actions, community leaderboard, and this AI chat.

Scheduler — Create and manage cleaning jobs. One-off or recurring bookings. Assign staff. Mark jobs complete. Completing jobs earns up to 18 Operations score points. Unassigned jobs lose 2 pts each.

Invoices — Create invoices and quotes. Track payment status (unpaid/paid/overdue). Send payment reminders to clients. Invoice emails send automatically via Cadi — no email setup needed. Each overdue invoice costs 12 Cadi Score points.

Staff — Add team members who each get their own login to see their schedule and clock jobs. Track hours, set pay rates, generate payslips.

Money — Log income payments and expenses. Mileage log (claiming ≥90% of logged mileage earns 4 compliance pts). Set monthly and annual income targets. Tax reserve pot tracks how much you've set aside.

MTD (Making Tax Digital) — Connect HMRC account via OAuth. Submit quarterly income tax returns directly from Cadi. Filing on time earns 4 compliance points.

Annual Review — Set annual income target. Create 90-day sprint goals. Track year-to-date income vs target.

Settings — Business profile, logo, compliance records (PLI, DBS, ICO, COSHH), bank details, integrations. Compliance tab in Settings lets you log your certificates and renewal dates.

CADI SCORE (0–100):
Revenue (25 pts) · Operations (25 pts) · Invoicing (25 pts, loses 12 per overdue) · Compliance (15 pts) · Growth (10 pts)
Tiers: Getting Started (0–39) · Building (40–59) · Solid (60–74) · Firing (75–89) · Elite (90+)

NAVIGATION: You CAN navigate the app for users. If someone says "take me to invoices", "I'm not in invoices", "go to scheduler" etc — reply warmly confirming you're taking them there. Supported sections: Dashboard, Scheduler, Invoices, Staff, Money, Settings, MTD, Annual Review.

PRICING: Cadi is £29/month, no contract. Free plan with limited features.

HOW TO RESPOND:
- Answer cleaning business questions fully and confidently — this is your area of expertise.
- Be warm, direct, and practical — like a knowledgeable friend who runs a business, not a call centre.
- Use their Cadi Score data when relevant to give personalised advice.
- Keep replies concise — 2–5 sentences. This is a chat, not a help article.
- Write in plain conversational English. No markdown, no bullet points, no headers.
- When relevant, mention how Cadi can help with what they're asking (e.g. log compliance in Settings, track mileage in Money).
- Only decline if something is genuinely outside your knowledge (specific legal disputes, medical questions). For those, recommend a professional.
- Never make up Cadi features that don't exist. If unsure about app functionality, say so and point to support@cadi.cleaning.`;
}

// ─── Demo fallback (no JWT) ────────────────────────────────────────────────────
function demoReply(input, score) {
  const q = input.toLowerCase();
  if (/score|improve|boost|points?|pts/.test(q)) {
    const lowest = [...(score?.dims ?? [])].sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];
    return lowest
      ? `Your lowest area is ${lowest.label} at ${lowest.score}/${lowest.max} pts. Sign up for a real account to get full AI advice tailored to your business.`
      : "Check the score breakdown on the dashboard to see where points are being lost.";
  }
  if (/invoices?|overdue/.test(q)) return "Head to the Invoices tab to create and manage invoices. Overdue invoices cost 12 score points each — chasing them is the quickest win.";
  if (/mtd|hmrc|tax return/.test(q)) return "MTD (Making Tax Digital) lets you file quarterly income tax directly from Cadi. Connect your HMRC account in Settings.";
  if (/tax reserve|set aside/.test(q)) return "Your tax reserve tracks money set aside for your tax bill. Set a target in Settings → Money — hitting it earns up to 7 compliance points.";
  if (/staff|team|cleaner/.test(q)) return "Add team members in the Staff tab. Each gets their own login to view their schedule and clock jobs.";
  if (/jobs?|schedule|booking/.test(q)) return "Manage all your cleaning jobs in the Scheduler tab — one-off or recurring, with staff assignment and job completion tracking.";
  if (/mileage/.test(q)) return "Log your business miles in the Money tab. Claiming at least 90% of your logged mileage earns 4 compliance score points.";
  if (/expense/.test(q)) return "Log expenses in the Money tab by category — fuel, supplies, equipment, insurance, marketing, and more.";
  if (/leaderboard|rank/.test(q)) return "The leaderboard shows your Cadi Score ranked against other cleaning businesses by sector. Find it on the Dashboard.";
  if (/sprint|review/.test(q)) return "Set 90-day sprint goals in the Annual Review tab. Having an active sprint earns 4 growth points.";
  if (/^(hi|hello|hey|thanks|cheers|ok|great)[!.\s]*$/.test(q)) return "Happy to help! What else would you like to know?";
  return "This is a demo — sign up for a free account to get full AI answers powered by Claude, personalised to your real business data.";
}

// ─── Sub-components ────────────────────────────────────────────────────────────
const CHAT_BG = { background: 'linear-gradient(160deg, #010a4f 0%, #05124a 60%, #091660 100%)' };

function ChatHeader({ isPro }) {
  return (
    <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0 ${isPro ? 'bg-brand-blue' : 'bg-white/20'}`}>C</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-white leading-none">Ask Cadi</p>
        <p className="text-[10px] text-brand-skyblue/60 mt-0.5">Your cleaning business co-pilot</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {isPro ? (
          <><div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span className="text-[10px] text-emerald-400 font-bold">Online</span></>
        ) : (
          <span className="text-[10px] text-white/30 font-bold px-2 py-0.5 rounded-full border border-white/15">Pro</span>
        )}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function AskCadi({ tab = 'dashboard', score, onNavigate }) {
  const { isPro, user } = useAuth();
  const isDemo          = user?.id === 'demo-user';
  const navigate        = useNavigate();
  const initialized     = useRef(false);
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [thinking, setThinking] = useState(false);

  const config = TAB_CONFIG[tab] ?? TAB_CONFIG.dashboard;

  // Opening greeting
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setMessages([{ id: 0, from: 'cadi', text: config.greeting(score) }]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const chips = useMemo(() => config.chips(score), [config, score]);

  const send = async (text) => {
    const t = (text ?? input).trim();
    if (!t || thinking) return;
    setMessages(m => [...m, { id: Date.now(), from: 'user', text: t }]);
    setInput('');
    setThinking(true);

    // Navigation intent — fast, no API call needed
    const q = t.toLowerCase();
    const navTrigger = /\b(take me to|go to|open|show me|navigate to|get to|switch to|i'm not in|im not in|not in the|i need to go|i want to go|bring me to|get me to|how do i get to)\b/.test(q);
    if (navTrigger) {
      const match = NAV_INTENTS.find(({ pattern }) => pattern.test(q));
      if (match) {
        setMessages(m => [...m, { id: Date.now() + 1, from: 'cadi', text: `Taking you to ${match.label} now!` }]);
        setThinking(false);
        setTimeout(() => onNavigate ? onNavigate(match.tab) : navigate(match.route), 400);
        return;
      }
    }

    // Demo users — rule-based reply (no JWT for Edge Function)
    if (isDemo) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      setMessages(m => [...m, { id: Date.now() + 1, from: 'cadi', text: demoReply(t, score) }]);
      setThinking(false);
      return;
    }

    // Real Pro users — call Claude via Edge Function
    try {
      const history = messages.map(m => ({ role: m.from === 'user' ? 'user' : 'assistant', content: m.text }));
      history.push({ role: 'user', content: t });

      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: { messages: history, system: buildSystemPrompt(score, tab), max_tokens: 350 },
      });

      if (error || !data?.content?.[0]?.text) throw new Error(error?.message ?? 'Empty response');
      setMessages(m => [...m, { id: Date.now() + 1, from: 'cadi', text: data.content[0].text }]);
    } catch {
      setMessages(m => [...m, { id: Date.now() + 1, from: 'cadi', text: "I'm having a moment — please try again or email support@cadi.cleaning if it keeps happening." }]);
    } finally {
      setThinking(false);
    }
  };

  // ── Free user gate ──────────────────────────────────────────────────────────
  if (!isPro) {
    return (
      <div className="rounded-2xl overflow-hidden border border-white/10" style={CHAT_BG}>
        <ChatHeader isPro={false} />
        <div className="px-3 py-4 space-y-3 pointer-events-none select-none">
          <div className="flex items-end gap-2 opacity-50">
            <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center text-white text-[10px] font-black shrink-0">C</div>
            <div className="bg-white/10 text-white px-3 py-2 rounded-2xl rounded-bl-sm text-xs max-w-[82%]">
              Hi! Ask me anything — your score, invoices, tax, scheduling, MTD...
            </div>
          </div>
          <div className="flex justify-end opacity-50">
            <div className="bg-brand-blue text-white px-3 py-2 rounded-2xl rounded-br-sm text-xs">
              How do I improve my invoicing score?
            </div>
          </div>
          <div className="flex items-end gap-2 opacity-25 blur-[2px]">
            <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center text-white text-[10px] font-black shrink-0">C</div>
            <div className="bg-white/10 text-white px-3 py-2 rounded-2xl rounded-bl-sm text-xs max-w-[82%]">
              Your invoicing score is being pulled down by overdue invoices — each one costs 12 points. The quickest win is...
            </div>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="rounded-xl border border-brand-skyblue/25 bg-white/5 p-4">
            <p className="text-white font-bold text-sm mb-1">Ask Cadi is a Pro feature</p>
            <p className="text-white/50 text-xs mb-3">Real AI answers to any question about your business, powered by Claude. £29/mo, no contract.</p>
            <button
              onClick={() => navigate('/settings?tab=billing')}
              className="w-full py-2.5 bg-brand-blue hover:bg-[#1a3de0] text-white font-bold text-sm rounded-xl transition-colors shadow-lg shadow-brand-blue/30"
            >
              Upgrade to Pro →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pro user: full chat ─────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10" style={CHAT_BG}>
      <ChatHeader isPro={true} />

      <div className="px-3 py-3 space-y-3 max-h-64 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.from === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.from === 'cadi' && (
              <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center text-white text-[10px] font-black shrink-0 mb-0.5">C</div>
            )}
            <div className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.from === 'cadi' ? 'bg-white/10 text-white rounded-bl-sm' : 'bg-brand-blue text-white rounded-br-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-end gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center text-white text-[10px] font-black shrink-0">C</div>
            <div className="bg-white/10 px-3 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
              {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length < 2 && (
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {chips.map(c => (
            <button key={c} onClick={() => send(c)}
              className="px-2.5 py-1 text-[10px] font-bold bg-white/10 text-white/70 rounded-full border border-white/15 hover:bg-white/20 hover:text-white transition-colors">
              {c}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 pb-3 pt-1">
        <div className="flex items-center gap-2 bg-white/10 rounded-xl border border-white/15 px-3 py-2 focus-within:border-brand-skyblue/50 transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask me anything..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
          />
          <button onClick={() => send()} disabled={!input.trim() || thinking}
            className="w-6 h-6 rounded-full bg-brand-blue flex items-center justify-center text-white disabled:opacity-30 hover:bg-[#1a3de0] transition-colors shrink-0">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 9L9 5L1 1V4.3L7 5L1 5.7V9Z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
