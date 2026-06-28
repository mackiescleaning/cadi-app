// Step 5 — The Reveal.
// The payoff screen. Cadi shows what just got built: real customers, real
// services, real recurring revenue, link to the polished menu, tease for the
// first monthly report. Then a "Take me to my week" CTA that drops the
// owner into their now-populated scheduler.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Sparkles, FileText, Banknote, Users, Wrench, ArrowRight, Share2, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { updateStep, completeSession } from '../../lib/db/onboardingDb';

const DIVISION_COLOR = {
  residential: '#1f48ff',
  exterior:    '#10b981',
  commercial:  '#f59e0b',
};

export default function StepReveal({ session, onAdvance }) {
  const navigate = useNavigate();
  const [stats, setStats]   = useState(null);
  const [phase, setPhase]   = useState('boot');
  const [error, setError]   = useState(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setPhase('connecting');
    const minDelay = new Promise(res => setTimeout(res, 1400));
    Promise.all([minDelay, loadStats(session)])
      .then(([_, s]) => { setStats(s); setPhase('ready'); })
      .catch(e => { setError(e?.message ?? 'Couldn’t load your stats.'); setPhase('ready'); });
  }, [session]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await completeSession(session.id);
      navigate('/scheduler');
    } catch (e) {
      setError(e?.message ?? "Couldn't wrap up — try again.");
      setFinishing(false);
    }
  };

  if (phase === 'boot' || phase === 'connecting') {
    return <ConnectingState />;
  }

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-2xl">

        <div className="flex items-center justify-between mb-3">
          <button
            onClick={async () => {
              try {
                await updateStep(session.id, 'menu_review');
                onAdvance({ ...session, step: 'menu_review' });
              } catch (e) { setError(e?.message ?? "Couldn't go back."); }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1f48ff] hover:text-[#010a4f] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f0f4ff]"
          >
            <ArrowLeft size={14} /> Back to menu
          </button>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#010a4f]/40">
            Step 5 of 5
          </span>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <Sparkles size={22} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#010a4f] mb-2 leading-tight">
            Here's what you just built.
          </h1>
          <p className="text-sm text-[#010a4f]/65 max-w-md mx-auto">
            Your customers, your services, your week — all in one place, ready to run.
          </p>
        </div>

        <RevenueHero monthly={stats?.monthlyRecurring ?? 0} />

        <div className="grid grid-cols-3 gap-2 mb-6">
          <StatCard icon={Users}    label="Customers in"   value={stats?.customers ?? 0}    accent="#1f48ff" />
          <StatCard icon={Calendar} label="Jobs next 7 days" value={stats?.jobsThisWeek ?? 0} accent="#10b981" />
          <StatCard
            icon={Wrench}
            label={(stats?.pricePoints ?? 0) > (stats?.services ?? 0) ? `Services · ${stats?.pricePoints ?? 0} price points` : 'Services live'}
            value={stats?.services ?? 0}
            accent="#f59e0b"
          />
        </div>

        {Array.isArray(stats?.divisions) && stats.divisions.length > 0 && (
          <div className="rounded-2xl border border-[#1f48ff]/15 bg-white shadow-sm p-4 mb-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f48ff] mb-3">
              Where the money lives
            </p>
            <div className="space-y-2">
              {stats.divisions.map(d => (
                <DivisionRow key={d.key} division={d.key} monthly={d.monthly} customers={d.customers} total={stats.monthlyRecurring} />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/services/catalogue')}
          className="w-full rounded-2xl border border-[#1f48ff]/15 bg-white hover:bg-[#f0f4ff] hover:border-[#1f48ff]/40 transition-all p-4 text-left flex items-center gap-3 mb-3 shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-[#1f48ff]/10 border border-[#1f48ff]/30 flex items-center justify-center shrink-0">
            <Share2 size={16} className="text-[#1f48ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-[#010a4f] mb-0.5">See your catalogue</p>
            <p className="text-[11px] text-[#010a4f]/65 leading-snug">
              The tiered menu Cadi built — review prices, edit estimates, ready to share.
            </p>
          </div>
          <ChevronRight size={16} className="text-[#010a4f]/45 shrink-0" />
        </button>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full rounded-2xl border border-[#1f48ff]/15 bg-white hover:bg-[#f0f4ff] hover:border-[#1f48ff]/40 transition-all p-4 text-left flex items-center gap-3 mb-8 shadow-sm"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-[#010a4f] mb-0.5">Your first Cadi report lands on the 1st</p>
            <p className="text-[11px] text-[#010a4f]/65 leading-snug">
              Monday money report — what you earned, what's drifting, what to chase. Built from your real numbers.
            </p>
          </div>
          <ChevronRight size={16} className="text-[#010a4f]/45 shrink-0" />
        </button>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={finish}
          disabled={finishing}
          className={`w-full py-3.5 rounded-xl text-sm font-black shadow-lg transition-all flex items-center justify-center gap-2 ${
            finishing
              ? 'bg-[#f0f4ff] border border-[#1f48ff]/15 text-[#010a4f]/45 cursor-not-allowed shadow-none'
              : 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-[#1f48ff]/25'
          }`}
        >
          {finishing ? 'Wrapping up…' : (<>Take me to my week <ArrowRight size={15} /></>)}
        </button>
        <p className="text-[10px] text-center text-[#010a4f]/40 mt-2">
          You can come back to onboarding any time from the dashboard.
        </p>
      </div>
    </div>
  );
}

function ConnectingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-14">
      <div className="relative w-20 h-20 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-[#1f48ff]/30 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-[#4f78ff]/40 animate-pulse" />
        <div className="absolute inset-5 rounded-full bg-[#1f48ff]/80 flex items-center justify-center">
          <Sparkles size={18} className="text-white animate-pulse" />
        </div>
      </div>
      <p className="text-sm font-black text-[#010a4f]">Connecting everything…</p>
      <p className="text-[11px] text-[#010a4f]/55 mt-1">Customers · services · your week</p>
    </div>
  );
}

function RevenueHero({ monthly }) {
  const formatted = Number(monthly).toLocaleString('en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6 mb-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Banknote size={14} className="text-emerald-600" />
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
          Your recurring work
        </p>
      </div>
      <p className="text-3xl sm:text-4xl font-black text-[#010a4f] tabular-nums leading-none">
        £{formatted}<span className="text-base sm:text-lg font-bold text-emerald-600 ml-1">/month</span>
      </p>
      <p className="text-[11px] text-[#010a4f]/60 mt-1.5">
        Based on the prices and frequencies you brought in.
      </p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="rounded-2xl border bg-white shadow-sm p-3"
      style={{ borderColor: `${accent}30` }}
    >
      <Icon size={13} style={{ color: accent }} />
      <p className="text-xl font-black text-[#010a4f] tabular-nums mt-1.5 leading-none">
        {Number(value).toLocaleString('en-GB')}
      </p>
      <p className="text-[10px] font-bold text-[#010a4f]/65 mt-1 leading-tight">
        {label}
      </p>
    </div>
  );
}

function DivisionRow({ division, monthly, customers, total }) {
  const accent = DIVISION_COLOR[division] ?? '#1f48ff';
  const pct    = total > 0 ? Math.min(100, Math.round((monthly / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="font-bold text-[#010a4f] capitalize">{division}</span>
        <span className="text-[#010a4f]/65 tabular-nums">
          £{Math.round(monthly).toLocaleString('en-GB')}/mo · {customers} customer{customers === 1 ? '' : 's'}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[#f0f4ff] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
      </div>
    </div>
  );
}

async function loadStats(session) {
  const { data: imports } = await supabase
    .from('customer_imports')
    .select('id')
    .eq('session_id', session.id);
  const importIds = (imports ?? []).map(i => i.id);
  if (!importIds.length) {
    return { monthlyRecurring: 0, customers: 0, jobsThisWeek: 0, services: 0, pricePoints: 0, divisions: [] };
  }

  const [{ data: customers }, { data: services }, { data: tiers }] = await Promise.all([
    supabase.from('customers').select('id, category').in('import_id', importIds),
    supabase.from('services').select('id').eq('status', 'live'),
    supabase.from('service_tiers').select('id'),
  ]);

  const customerIds = (customers ?? []).map(c => c.id);
  const { data: recurring } = customerIds.length
    ? await supabase
        .from('recurring_jobs')
        .select('customer_id, price, freq, freq_interval, anchor_date, category, rrule')
        .in('customer_id', customerIds)
        .eq('status', 'active')
    : { data: [] };

  const monthlyPerJob = (j) => {
    const price = Number(j.price) || 0;
    const interval = Math.max(1, Number(j.freq_interval) || 1);
    const freq = String(j.freq || '').toLowerCase();
    if (freq.includes('week') || /freq=weekly/i.test(j.rrule || ''))
      return (price * 52) / 12 / interval;
    if (freq.includes('month') || /freq=monthly/i.test(j.rrule || ''))
      return price / interval;
    if (freq.includes('year') || /freq=yearly/i.test(j.rrule || ''))
      return price / (12 * interval);
    if (freq.includes('day') || /freq=daily/i.test(j.rrule || ''))
      return (price * 365) / 12 / interval;
    return 0;
  };

  let monthlyRecurring = 0;
  const monthlyByDivision = new Map();
  const customersByDivision = new Map();
  const catByCustomer = new Map((customers ?? []).map(c => [c.id, c.category]));

  for (const j of recurring ?? []) {
    const m = monthlyPerJob(j);
    monthlyRecurring += m;
    const div = (j.category ?? catByCustomer.get(j.customer_id) ?? 'unknown').toLowerCase();
    monthlyByDivision.set(div, (monthlyByDivision.get(div) ?? 0) + m);
  }

  for (const c of customers ?? []) {
    const div = (c.category ?? 'unknown').toLowerCase();
    customersByDivision.set(div, (customersByDivision.get(div) ?? 0) + 1);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const horizon = new Date(today); horizon.setDate(horizon.getDate() + 7);
  const jobsThisWeek = (recurring ?? []).filter(j => {
    if (!j.anchor_date) return false;
    const anchor = new Date(j.anchor_date + 'T00:00:00');
    if (Number.isNaN(anchor.getTime())) return false;
    const next = rollForward(anchor, j, today);
    return next >= today && next < horizon;
  }).length;

  const divisions = Array.from(new Set([
    ...Array.from(monthlyByDivision.keys()),
    ...Array.from(customersByDivision.keys()),
  ]))
    .filter(k => k !== 'unknown' || (monthlyByDivision.get(k) || 0) > 0)
    .map(k => ({
      key:       k,
      monthly:   monthlyByDivision.get(k)   ?? 0,
      customers: customersByDivision.get(k) ?? 0,
    }))
    .sort((a, b) => b.monthly - a.monthly);

  // Tiered services account for multiple price points (e.g. 1-bed/2-bed/…)
  // — surface this so the owner sees the full reach of their menu, not just
  // the count of parent services.
  const serviceCount = (services ?? []).length;
  const tierCount    = (tiers ?? []).length;
  const pricePoints  = Math.max(serviceCount, tierCount);

  return {
    monthlyRecurring: Math.round(monthlyRecurring),
    customers:        (customers ?? []).length,
    jobsThisWeek,
    services:         serviceCount,
    pricePoints,
    divisions,
  };
}

function rollForward(anchor, j, from) {
  if (anchor >= from) return anchor;
  const interval = Math.max(1, Number(j.freq_interval) || 1);
  const freq = String(j.freq || '').toLowerCase();
  let stepMs;
  if (freq.includes('week') || /freq=weekly/i.test(j.rrule || ''))   stepMs = 7 * interval * 86400000;
  else if (freq.includes('month') || /freq=monthly/i.test(j.rrule || '')) stepMs = 30.44 * interval * 86400000;
  else if (freq.includes('day') || /freq=daily/i.test(j.rrule || ''))     stepMs = interval * 86400000;
  else if (freq.includes('year') || /freq=yearly/i.test(j.rrule || ''))   stepMs = 365.25 * interval * 86400000;
  else return anchor;
  const cycles = Math.ceil((from - anchor) / stepMs);
  return new Date(anchor.getTime() + cycles * stepMs);
}
