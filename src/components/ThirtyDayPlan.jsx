// ThirtyDayPlan.jsx — Persistent 30 Day Plan panel on the dashboard
// Shows Phase 1, 2, or 3 steps based on current_phase.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, ChevronDown, ChevronUp, Sparkles, ArrowRight } from 'lucide-react';
import {
  getPhase1State, syncPhase1Steps, checkAndCompletePhase1, getPhase1Stats,
  getPhase2State, syncPhase2Steps, getPhase2Stats,
  getPhase3State, syncPhase3Steps, getPhase3Stats,
} from '../lib/db/thirtyDayPlanDb';
import { supabase } from '../lib/supabase';
import { usePlan } from '../hooks/usePlan';

// ── Phase 1 step definitions ──────────────────────────────────────────────────

const PHASE1_STEPS = [
  {
    key: 'add_customers',
    title: 'Add your customers',
    incompleteSub: 'Bring your customer list into Cadi. Upload a CSV or add them one at a time.',
    completeSub: () => 'Customers in Cadi.',
    cta: 'Add customers',
    path: '/customers',
  },
  {
    key: 'first_job',
    title: 'Schedule your first job',
    incompleteSub: 'Put your first job in the schedule. Cadi takes it from here.',
    completeSub: (meta) => meta?.customer_name ? `First job scheduled — ${meta.customer_name}.` : 'First job scheduled.',
    cta: 'Open schedule',
    path: '/scheduler',
  },
  {
    key: 'invoice_template',
    title: 'Make your invoice yours',
    incompleteSub: 'Add your branding to every invoice Cadi sends. Takes two minutes.',
    completeSub: () => 'Invoice template ready to go.',
    cta: 'Customise invoice',
    path: '/settings/invoice',
  },
];

// ── Phase 2 step definitions ──────────────────────────────────────────────────

const PHASE2_STEPS = [
  {
    key: 'connect_open_banking',
    title: 'Connect your bank',
    incompleteSub: 'Read-only access through TrueLayer. Lets Cadi see what\'s flowing through your business.',
    inProgressSub: 'Cadi is analysing your transactions — give it a few minutes.',
    completeSub: (meta) => meta?.bank_name
      ? `Connected to ${meta.bank_name}.`
      : 'Bank connected.',
    cta: 'Connect my bank',
    path: '/banking/connect',
  },
  {
    key: 'financial_walkthrough',
    title: 'Run through your finances with Cadi',
    blockedSub: 'Connect your bank first — Cadi needs your numbers to do this properly.',
    incompleteSub: 'Sit down with Cadi for 10 minutes. Walk through what\'s coming in, what\'s going out, what to keep an eye on.',
    inProgressSub: (meta) => `Walkthrough saved at screen ${meta?.screen ?? 1}. Pick up where you left off.`,
    completeSub: (meta) => meta?.focus_area ? `Walkthrough done. Your focus: ${meta.focus_area}.` : 'Walkthrough done.',
    cta: 'Start walkthrough',
    ctaResume: 'Carry on',
    ctaDone: 'Run it again',
    path: '/walkthrough',
  },
  {
    key: 'first_weekly_report',
    title: 'Read your first weekly report',
    blockedSub: 'Complete the walkthrough first — it shapes what Cadi puts in your report.',
    waitingSub: 'Your first weekly report lands Monday morning. We\'re watching your week unfold.',
    readySub: 'Your first weekly report is ready. Have a read.',
    completeSub: (meta) => `Read it. Next one lands Monday.`,
    cta: 'Read my report',
    path: '/reports',
  },
];

// ── Phase 3 step definitions ──────────────────────────────────────────────────

const PHASE3_STEPS = [
  {
    key: 'hire_sales_manager',
    title: 'Hire your Sales Manager',
    incompleteSub: 'The agent who handles inbound inquiries while you\'re working.',
    completeSub: (meta) => meta?.inquiry_count
      ? `Sales Manager active. ${meta.inquiry_count} inquiries handled so far.`
      : 'Sales Manager active.',
    cta: 'Set up Sales Manager',
    path: '/front-desk/sales-manager',
    fromParam: 'phase3',
  },
  {
    key: 'hire_review_agent',
    title: 'Hire your Review Agent',
    incompleteSub: 'The agent who builds your reputation, one review at a time.',
    completeSub: (meta) => meta?.requests_sent
      ? `Review Agent active. ${meta.requests_sent} review requests sent.`
      : 'Review Agent active.',
    cta: 'Set up Review Agent',
    path: '/front-desk/review-agent',
    fromParam: 'phase3',
  },
  {
    key: 'hire_operations_manager',
    title: 'Hire your Operations Manager',
    incompleteSub: (isPro) => isPro
      ? 'The agent who runs your schedule, reminders, and payment matching.'
      : 'Operations Manager runs your schedule and matches payments. Pro feature.',
    completeSub: (meta) => meta?.acknowledged_free
      ? 'Ready when you upgrade.'
      : meta?.reminders_sent
      ? `Operations Manager active. ${meta.reminders_sent} reminders sent.`
      : 'Operations Manager active.',
    cta: (isPro) => isPro ? 'Hire Operations Manager' : 'See what Pro unlocks',
    path: '/front-desk/operations-manager',
    fromParam: 'phase3',
  },
];

const PHASE1_SUBHEADS = [
  "Let's get you operational. Three steps — takes about 15 minutes.",
  "Good start. Two more to go.",
  "One step away from Phase 1 complete.",
  "",
];

const PHASE2_SUBHEADS = [
  "Time to see what's really going on. Phase 2 starts with your bank.",
  "Bank connected. Ready for the walkthrough whenever you are.",
  "Walkthrough done. Your first weekly report lands Monday morning.",
  "",
];

const PHASE3_SUBHEADS = [
  "Time to hire some help. Three AI agents to bring on board.",
  "Sales Manager hired. Two more to go.",
  "Almost staffed up. One more agent to hire.",
  "",
];

// ── Step dot ──────────────────────────────────────────────────────────────────

function StepDot({ status }) {
  if (status === 'completed') return (
    <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
      <Check size={12} className="text-white" strokeWidth={3} />
    </div>
  );
  if (status === 'in_progress') return (
    <div className="w-6 h-6 rounded-full border-2 border-[#4f78ff] flex items-center justify-center shrink-0">
      <div className="w-2.5 h-2.5 rounded-full bg-[#4f78ff] animate-pulse" />
    </div>
  );
  if (status === 'locked' || status === 'waiting') return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
      <Lock size={10} className="text-gray-300" />
    </div>
  );
  return <div className="w-6 h-6 rounded-full border-2 border-[rgba(79,120,255,0.4)] shrink-0" />;
}

// ── Phase 1 celebration modal ─────────────────────────────────────────────────

function Phase1Celebration({ stats, onClose, onViewPhase2 }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.3)]"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">Phase 1 complete</p>
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">Phase 1 done. Cadi knows your business.</h2>
          <div className="grid grid-cols-2 gap-3 my-6">
            {stats.customerCount !== null && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-3xl font-black text-white">{stats.customerCount}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">customers in Cadi</p>
              </div>
            )}
            {stats.firstJobDate && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm font-black text-white">{stats.firstJobDate}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">first job scheduled</p>
              </div>
            )}
            <div className="rounded-xl bg-white/5 border border-white/10 p-4">
              <p className="text-lg font-black text-emerald-400">Ready</p>
              <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">invoice template</p>
            </div>
            {stats.processorConnected && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm font-black text-white">{stats.processorConnected}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">payment processor</p>
              </div>
            )}
          </div>
          {stats.durationLabel && (
            <p className="text-xs text-[rgba(153,197,255,0.5)] mb-4">
              You built this in <span className="text-[#99c5ff] font-bold">{stats.durationLabel}</span>. Most cleaners take months to get this organised.
            </p>
          )}
          <p className="text-sm text-[rgba(153,197,255,0.7)] mb-6">
            You can take a booking, schedule it, and send a professional invoice. Phase 2 is where Cadi starts paying attention to what's happening.
          </p>
          <div className="space-y-2">
            <button onClick={onViewPhase2 ?? onClose} className="w-full py-3.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors">
              See Phase 2
            </button>
            <button onClick={onClose} className="w-full py-2.5 text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold transition-colors">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase 2 celebration modal ─────────────────────────────────────────────────

function Phase2Celebration({ stats, onClose }) {
  const fmt = (n) => `£${Math.round(Math.abs(n ?? 0)).toLocaleString('en-GB')}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.3)]"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">Phase 2 complete</p>
          <h2 className="text-2xl font-black text-white mb-2 leading-tight">Phase 2 done. Cadi knows your business now.</h2>
          <div className="grid grid-cols-2 gap-3 my-6">
            {stats.daysAnalysed && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-3xl font-black text-white">{stats.daysAnalysed}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">days of transactions analysed</p>
              </div>
            )}
            {stats.reconCount > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-2xl font-black text-emerald-400">{stats.reconCount}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">invoices Cadi reconciled</p>
              </div>
            )}
            {stats.unpaidTotal > 0 && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xl font-black text-amber-400">{fmt(stats.unpaidTotal)}</p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-1">in unpaid invoices found</p>
              </div>
            )}
            {stats.focusArea && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 col-span-2">
                <p className="text-sm font-black text-[#4f78ff]">Focus this month</p>
                <p className="text-xs text-white/60 mt-1">{stats.focusArea}</p>
              </div>
            )}
          </div>
          <p className="text-sm text-[rgba(153,197,255,0.7)] mb-6">
            "You've connected your money to Cadi, walked through what's actually happening, and read your first report. That's a different kind of business owner than you were 30 minutes ago. You know your numbers.
            <br /><br />
            Phase 3 is where Cadi starts running things for you."
          </p>
          <div className="space-y-2">
            <button onClick={onClose} className="w-full py-3.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors">
              See Phase 3
            </button>
            <button onClick={onClose} className="w-full py-2.5 text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold transition-colors">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Phase 3 celebration modal ─────────────────────────────────────────────────

function Phase3Celebration({ stats, onClose, onViewFrontDesk }) {
  const omSkipped = stats?.omSkippedByFree;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-[rgba(79,120,255,0.3)] my-4"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">
              {omSkipped ? 'Phase 3 — almost complete' : 'Phase 3 complete'}
            </p>
            <h2 className="text-2xl font-black text-white mb-2 leading-tight">
              Look who's running your business now.
            </h2>
          </div>

          {/* Agent cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-6">
            <div className="rounded-xl bg-white/5 border border-[#4f78ff]/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-[#4f78ff]" />
                <p className="text-xs font-black text-[#99c5ff]">Sales Manager</p>
              </div>
              <p className="text-[10px] text-emerald-400 font-bold mb-2">Active</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                {stats?.inquiryCount > 0
                  ? `${stats.inquiryCount} inquiries handled`
                  : 'Ready to take inquiries'}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-emerald-500/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="text-xs font-black text-emerald-300">Review Agent</p>
              </div>
              <p className="text-[10px] text-emerald-400 font-bold mb-2">Active</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                {stats?.reviewRequestsSent > 0
                  ? `${stats.reviewRequestsSent} requests sent`
                  : 'Watching for completed jobs'}
              </p>
            </div>
            <div className={`rounded-xl bg-white/5 p-4 ${omSkipped ? 'border border-amber-500/20 opacity-70' : 'border border-amber-500/30'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-2 h-2 rounded-full ${omSkipped ? 'bg-amber-500/40' : 'bg-amber-500'}`} />
                <p className={`text-xs font-black ${omSkipped ? 'text-amber-300/60' : 'text-amber-300'}`}>Operations Manager</p>
              </div>
              <p className={`text-[10px] font-bold mb-2 ${omSkipped ? 'text-amber-400/50' : 'text-emerald-400'}`}>
                {omSkipped ? 'Ready when you upgrade' : 'Active'}
              </p>
              <p className="text-[10px] text-[rgba(153,197,255,0.5)]">
                {omSkipped
                  ? 'Available with Pro'
                  : stats?.remindersCount > 0
                  ? `${stats.remindersCount} reminders sent`
                  : 'Watching your schedule'}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-6">
            <p className="text-xs font-bold text-[rgba(153,197,255,0.7)] mb-3">Over 30 days with Cadi, you've:</p>
            <ul className="space-y-1.5">
              {[
                'Built your business inside Cadi',
                'Walked through your finances and chosen a focus',
                'Staffed your Front Desk with AI agents',
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-xs text-[rgba(153,197,255,0.6)]">
                  <Check size={11} className="text-emerald-400 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-base font-black text-white mb-6 leading-snug">
            {omSkipped
              ? "Your Cadi 30 Day Plan is complete. When you're ready, upgrading to Pro brings your Operations Manager online."
              : 'Your Cadi 30 Day Plan is complete. Now we run.'}
          </p>

          <div className="space-y-2">
            <button
              onClick={onViewFrontDesk ?? onClose}
              className="w-full py-3.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors"
            >
              See my Front Desk
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Regressed user banner ─────────────────────────────────────────────────────

function NewStepBanner() {
  return (
    <div className="mx-5 sm:mx-6 mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-[rgba(79,120,255,0.1)] border border-[rgba(79,120,255,0.25)]">
      <Sparkles size={14} className="text-[#4f78ff] shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-[#99c5ff]">We've updated Phase 1 — one new step to finish</p>
        <p className="text-[10px] text-[rgba(153,197,255,0.5)] mt-0.5">Customise your invoice template to complete Phase 1 and unlock Phase 2.</p>
      </div>
    </div>
  );
}

// ── Days until next Monday ────────────────────────────────────────────────────

function daysUntilNextMonday() {
  const now  = new Date();
  const day  = now.getDay(); // 0=Sun, 1=Mon
  const diff = day === 1 ? 7 : (1 - day + 7) % 7 || 7;
  return diff;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ThirtyDayPlan({ onRefresh }) {
  const navigate = useNavigate();
  const { isPro, canUseOperationsManager } = usePlan();
  const [loading, setLoading]               = useState(true);
  const [progress, setProgress]             = useState(null);
  const [p1Steps, setP1Steps]               = useState([]);
  const [p2Steps, setP2Steps]               = useState([]);
  const [p3Steps, setP3Steps]               = useState([]);
  const [collapsed, setCollapsed]           = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPhase, setCelebrationPhase] = useState(1);
  const [celebrationStats, setCelebrationStats] = useState(null);
  const [wasRegressed, setWasRegressed]     = useState(false);
  // Phase 2 extra state
  const [bankStatus, setBankStatus]         = useState(null);
  const [latestReport, setLatestReport]     = useState(null);
  const [walkInProgress, setWalkInProgress] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // ── Phase 1 data ────────────────────────────────────────────────────────
      const [{ count: customerCount }, { count: jobCount }, { data: templateData }] = await Promise.all([
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('jobs').select('*', { count: 'exact', head: true }),
        supabase.from('invoice_templates').select('id').maybeSingle(),
      ]);

      const p1Result = await syncPhase1Steps({
        customerCount, jobCount, templateSaved: !!templateData,
      });

      if (p1Result?.completed && !p1Result?.alreadyDone) {
        const stats = await getPhase1Stats();
        setCelebrationStats(stats);
        setCelebrationPhase(1);
        setShowCelebration(true);
      }

      const { progress: prog, steps: p1 } = await getPhase1State();
      setProgress(prog);
      setP1Steps(p1);

      // Regressed users
      const invoiceStep = p1.find(s => s.step_key === 'invoice_template');
      const othersDone  = ['add_customers', 'first_job'].every(k =>
        p1.find(s => s.step_key === k)?.status === 'completed',
      );
      if (othersDone && invoiceStep?.status !== 'completed' && !prog?.phase_1_completed_at) {
        setWasRegressed(true);
      }

      // ── Phase 2 data (only if Phase 1 done) ────────────────────────────────
      if (prog?.phase_1_completed_at) {
        const { data: biz } = await supabase
          .from('businesses').select('id').eq('owner_id', session.user.id).single();

        const [bankConn, walkRow, reportRow] = await Promise.all([
          supabase.from('bank_connections')
            .select('id, bank_name, account_last_4, last_sync_at, is_active')
            .eq('is_active', true).order('connected_at', { ascending: false }).limit(1).maybeSingle()
            .then(r => r.data),
          supabase.from('walkthroughs')
            .select('id, completed_at, current_screen, chosen_focus_area')
            .eq('business_id', biz?.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
            .then(r => r.data),
          supabase.from('weekly_reports')
            .select('id, viewed_at, delivered_in_app_at, week_starting')
            .eq('business_id', biz?.id)
            .order('week_starting', { ascending: false }).limit(1).maybeSingle()
            .then(r => r.data),
        ]);

        setBankStatus(bankConn);
        setLatestReport(reportRow);
        if (walkRow && !walkRow.completed_at) setWalkInProgress(walkRow);

        const bankConnected  = !!(bankConn?.last_sync_at);
        const walkthroughDone = !!(walkRow?.completed_at);
        const reportViewed    = !!(reportRow?.viewed_at);

        const p2Result = await syncPhase2Steps({ bankConnected, walkthroughDone, reportViewed });
        if (p2Result?.completed && !p2Result?.alreadyDone) {
          const stats = await getPhase2Stats();
          setCelebrationStats(stats);
          setCelebrationPhase(2);
          setShowCelebration(true);
        }

        const { steps: p2, progress: freshProg2 } = await getPhase2State();
        setP2Steps(p2);

        // ── Phase 3 data (only if Phase 2 done) ────────────────────────────
        const phase2Done = !!(freshProg2?.phase_2_completed_at || prog?.phase_2_completed_at);
        if (phase2Done) {
          // Read agent activation status
          const { data: agentRows } = await supabase
            .from('agent_settings')
            .select('agent, mode')
            .eq('business_id', biz?.id)
            .in('agent', ['sales_manager', 'front_desk', 'review_agent', 'reviews', 'operations_manager']);

          const agentMode = (key) => {
            const alts = { sales_manager: ['sales_manager', 'front_desk'], review_agent: ['review_agent', 'reviews'] };
            const keys = alts[key] ?? [key];
            return (agentRows ?? []).find(r => keys.includes(r.agent))?.mode;
          };

          const smActive = !!(agentMode('sales_manager') && agentMode('sales_manager') !== 'off');
          const raActive = !!(agentMode('review_agent') && agentMode('review_agent') !== 'off');
          const omActive = !!(agentMode('operations_manager') && agentMode('operations_manager') !== 'off');

          const p3Result = await syncPhase3Steps({ smActive, raActive, omActive, omSkippedByFree: false });
          if (p3Result?.completed && !p3Result?.alreadyDone) {
            const stats = await getPhase3Stats();
            setCelebrationStats(stats);
            setCelebrationPhase(3);
            setShowCelebration(true);
          }

          const { steps: p3 } = await getPhase3State();
          setP3Steps(p3);
        }
      }
    } catch (e) {
      console.error('ThirtyDayPlan load error', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const phase1Done   = !!progress?.phase_1_completed_at;
  const phase2Done   = !!progress?.phase_2_completed_at;
  const phase3Done   = !!progress?.phase_3_completed_at;
  const currentPhase = progress?.current_phase ?? 1;

  const p1Required = ['add_customers', 'first_job', 'invoice_template'];
  const p1Done     = p1Steps.filter(s => p1Required.includes(s.step_key) && s.status === 'completed').length;

  const p2Required = ['connect_open_banking', 'financial_walkthrough', 'first_weekly_report'];
  const p2Done     = p2Steps.filter(s => p2Required.includes(s.step_key) && s.status === 'completed').length;

  const p3Required = ['hire_sales_manager', 'hire_review_agent', 'hire_operations_manager'];
  const p3Done     = p3Steps.filter(s => p3Required.includes(s.step_key) && s.status === 'completed').length;

  const getStepObj = (steps, key) => steps.find(s => s.step_key === key);

  // Derive Phase 2 step sub-text and CTA
  function phase2StepSub(def, stepRow) {
    const status = stepRow?.status ?? 'available';
    if (status === 'completed') return def.completeSub(stepRow?.metadata);

    if (def.key === 'connect_open_banking') {
      if (bankStatus?.is_active && !bankStatus?.last_sync_at) return def.inProgressSub;
      return def.incompleteSub;
    }

    if (def.key === 'financial_walkthrough') {
      const bankStep = getStepObj(p2Steps, 'connect_open_banking');
      if (!bankStep || bankStep.status !== 'completed') return def.blockedSub;
      if (walkInProgress) return typeof def.inProgressSub === 'function'
        ? def.inProgressSub({ screen: walkInProgress.current_screen })
        : def.inProgressSub;
      return def.incompleteSub;
    }

    if (def.key === 'first_weekly_report') {
      const walkStep = getStepObj(p2Steps, 'financial_walkthrough');
      if (!walkStep || walkStep.status !== 'completed') return def.blockedSub;
      if (latestReport?.delivered_in_app_at && !latestReport?.viewed_at) return def.readySub;
      return def.waitingSub;
    }

    return def.incompleteSub;
  }

  function phase2StepCta(def, stepRow) {
    const status = stepRow?.status ?? 'available';
    if (status === 'completed') return def.ctaDone ?? 'View';
    if (def.key === 'financial_walkthrough' && walkInProgress) return def.ctaResume ?? def.cta;
    if (def.key === 'first_weekly_report') {
      if (latestReport?.delivered_in_app_at && !latestReport?.viewed_at) return def.cta;
      const days = daysUntilNextMonday();
      return `Lands in ${days} day${days !== 1 ? 's' : ''}`;
    }
    return def.cta;
  }

  function phase2StepPath(def) {
    if (def.key === 'first_weekly_report' && latestReport?.id) return `/reports/${latestReport.id}`;
    return def.path;
  }

  function phase2StepDisabled(def, stepRow) {
    const status = stepRow?.status ?? 'available';
    if (def.key === 'first_weekly_report') {
      if (status === 'completed') return false;
      // Disable if walkthrough not done OR no report ready
      const walkStep = getStepObj(p2Steps, 'financial_walkthrough');
      if (!walkStep || walkStep.status !== 'completed') return true;
      return !(latestReport?.delivered_in_app_at);
    }
    return false;
  }

  if (loading) return null;

  // Plan complete — small persistent badge only
  if (phase3Done && collapsed) {
    return (
      <div className="bg-[#040810] border-b border-[rgba(79,120,255,0.2)] px-5 py-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Check size={12} /> Plan complete ✓
        </button>
      </div>
    );
  }

  // Collapsed badge (mid-plan)
  if (phase1Done && currentPhase > 1 && collapsed) {
    return (
      <div className="bg-[#040810] border-b border-[rgba(79,120,255,0.2)] px-5 py-2 flex items-center justify-between">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors"
        >
          <Sparkles size={12} /> 30 Day Plan — Phase {Math.min(currentPhase, 3)} of 3
        </button>
      </div>
    );
  }

  // Auto-collapse to badge when plan is fully done and user has seen it
  if (phase3Done && !showCelebration) {
    return (
      <div className="bg-[#040810] border-b border-[rgba(79,120,255,0.2)] px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check size={12} className="text-emerald-400" />
          <span className="text-xs font-bold text-emerald-400">Plan complete</span>
          <span className="text-xs text-[rgba(153,197,255,0.3)]">·</span>
          <span className="text-xs text-[rgba(153,197,255,0.4)]">Your Front Desk staff are running things</span>
        </div>
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs text-[rgba(153,197,255,0.3)] hover:text-[#99c5ff] transition-colors"
        >
          Review journey
        </button>
      </div>
    );
  }

  // ── Determine what to render ──────────────────────────────────────────────

  const showPhase3 = phase2Done && currentPhase >= 3;
  const showPhase2 = phase1Done && currentPhase >= 2 && !showPhase3;
  const activeStepDefs  = showPhase3 ? PHASE3_STEPS : showPhase2 ? PHASE2_STEPS : PHASE1_STEPS;
  const activeStepRows  = showPhase3 ? p3Steps      : showPhase2 ? p2Steps      : p1Steps;
  const activeDone      = showPhase3 ? p3Done        : showPhase2 ? p2Done       : p1Done;
  const subheadArr      = showPhase3 ? PHASE3_SUBHEADS : showPhase2 ? PHASE2_SUBHEADS : PHASE1_SUBHEADS;
  const subhead         = subheadArr[Math.min(activeDone, 3)];

  return (
    <>
      <div
        className="border-b border-[rgba(79,120,255,0.15)]"
        style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
      >
        {/* Panel header */}
        <div className="px-5 sm:px-6 pt-5 pb-3 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-1">Your Cadi 30 Day Plan</p>
            <h3 className="text-base font-black text-white leading-tight">
              {showPhase3
                ? 'Phase 3 of 3 — Staff your Front Desk'
                : showPhase2
                ? "Phase 2 of 3 — Let Cadi show you what you've been missing"
                : 'Phase 1 of 3 — Make Cadi yours'
              }
            </h3>
            {subhead && <p className="text-xs text-[rgba(153,197,255,0.55)] mt-1">{subhead}</p>}
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors mt-0.5"
          >
            {collapsed
              ? <ChevronDown size={14} className="text-[#99c5ff]" />
              : <ChevronUp size={14} className="text-[#99c5ff]" />
            }
          </button>
        </div>

        {!collapsed && (
          <>
            {/* Phase progress bar */}
            <div className="px-5 sm:px-6 mb-4">
              <div className="flex gap-1.5 mb-2">
                {[1, 2, 3].map(ph => (
                  <div key={ph} className="flex-1 flex flex-col gap-1">
                    <div className={`h-1 rounded-full transition-all ${
                      ph < currentPhase ? 'bg-emerald-500' :
                      ph === currentPhase ? 'bg-[#4f78ff]' :
                      'bg-[rgba(153,197,255,0.1)]'
                    }`} />
                    <p className={`text-[9px] font-bold text-center hidden sm:block ${
                      ph === currentPhase ? 'text-[#4f78ff]' : ph < currentPhase ? 'text-emerald-500' : 'text-[rgba(153,197,255,0.2)]'
                    }`}>
                      {ph < currentPhase ? '✓' : ph === currentPhase ? `Phase ${ph}` : <Lock size={8} />}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Regressed user notice (Phase 1 only) */}
            {wasRegressed && !phase1Done && <NewStepBanner />}

            {/* Steps */}
            <div className="px-5 sm:px-6 pb-5 space-y-2">
              {activeStepDefs.map((def) => {
                const stepRow = getStepObj(activeStepRows, def.key);
                const status  = stepRow?.status ?? 'available';
                const done    = status === 'completed';
                const disabled = !done && (showPhase2 ? phase2StepDisabled(def, stepRow) : false);

                let subText, ctaLabel, path;
                if (showPhase3) {
                  subText  = done
                    ? def.completeSub(stepRow?.metadata)
                    : typeof def.incompleteSub === 'function'
                    ? def.incompleteSub(canUseOperationsManager)
                    : def.incompleteSub;
                  ctaLabel = typeof def.cta === 'function' ? def.cta(canUseOperationsManager) : def.cta;
                  path     = def.fromParam ? `${def.path}?from=${def.fromParam}` : def.path;
                } else if (showPhase2) {
                  subText  = phase2StepSub(def, stepRow);
                  ctaLabel = phase2StepCta(def, stepRow);
                  path     = phase2StepPath(def);
                } else {
                  subText  = done ? def.completeSub(stepRow?.metadata) : def.incompleteSub;
                  ctaLabel = def.cta;
                  path     = def.path;
                }

                return (
                  <div
                    key={def.key}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                      done
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : disabled
                        ? 'bg-white/2 border border-white/5 opacity-50'
                        : 'bg-white/4 border border-[rgba(153,197,255,0.1)] hover:bg-white/8 hover:border-[rgba(79,120,255,0.3)] cursor-pointer'
                    }`}
                    onClick={() => !done && !disabled && navigate(path)}
                  >
                    <StepDot status={disabled ? 'locked' : status} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-tight ${
                        done ? 'line-through text-[rgba(153,197,255,0.4)]' : 'text-white'
                      }`}>{def.title}</p>
                      <p className={`text-xs mt-0.5 ${
                        done ? 'text-[rgba(153,197,255,0.3)]' : 'text-[rgba(153,197,255,0.5)]'
                      }`}>{subText}</p>
                    </div>
                    {!done && !disabled && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(path); }}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap bg-[#4f78ff] hover:bg-[#3d68ff] text-white"
                      >
                        {ctaLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pro teases */}
            {!showPhase2 && !showPhase3 && (
              <div className="px-5 sm:px-6 pb-4 flex flex-wrap gap-2">
                {['🔒 Recurring invoices — coming with Pro', '🔒 Automated reminders'].map(t => (
                  <span key={t} className="text-[10px] text-[rgba(153,197,255,0.25)] bg-white/3 border border-[rgba(153,197,255,0.06)] rounded-lg px-2.5 py-1.5">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {showPhase2 && !phase2Done && (
              <div className="px-5 sm:px-6 pb-4 flex flex-wrap gap-2">
                {[
                  '🔒 Monthly walkthrough comparisons — Pro',
                  '🔒 Weekly report email delivery — Pro',
                ].map(t => (
                  <span key={t} className="text-[10px] text-[rgba(153,197,255,0.25)] bg-white/3 border border-[rgba(153,197,255,0.06)] rounded-lg px-2.5 py-1.5">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {showPhase3 && !phase3Done && !canUseOperationsManager && (
              <div className="px-5 sm:px-6 pb-4 flex flex-wrap gap-2">
                <span className="text-[10px] text-[rgba(153,197,255,0.25)] bg-white/3 border border-[rgba(153,197,255,0.06)] rounded-lg px-2.5 py-1.5">
                  🔒 Operations Manager — Pro feature
                </span>
              </div>
            )}

            {/* Next phase preview */}
            {!showPhase2 && !showPhase3 && (
              phase1Done ? (
                <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <ArrowRight size={12} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-400">Phase 2 unlocked</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">See what's really going on inside your business.</p>
                  </div>
                </div>
              ) : (
                <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                  <Lock size={12} className="text-[rgba(153,197,255,0.2)] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[rgba(153,197,255,0.3)]">Phase 2 unlocks when all 3 steps are done</p>
                    <p className="text-[10px] text-[rgba(153,197,255,0.2)] mt-0.5">Add customers, schedule a job, and customise your invoice.</p>
                  </div>
                </div>
              )
            )}
            {showPhase2 && !phase2Done && (
              <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)]">
                <Lock size={12} className="text-[rgba(153,197,255,0.2)] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[rgba(153,197,255,0.3)]">Phase 3 unlocks when you complete Phase 2</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.2)] mt-0.5">Staff your Front Desk with three AI agents.</p>
                </div>
              </div>
            )}
            {showPhase2 && phase2Done && !showPhase3 && (
              <div className="mx-5 sm:mx-6 mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <ArrowRight size={12} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-emerald-400">Phase 3 unlocked</p>
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">Staff your Front Desk with three AI agents.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Celebration modals */}
      {showCelebration && celebrationStats && celebrationPhase === 1 && (
        <Phase1Celebration
          stats={celebrationStats}
          onClose={() => { setShowCelebration(false); onRefresh?.(); }}
          onViewPhase2={() => { setShowCelebration(false); onRefresh?.(); }}
        />
      )}
      {showCelebration && celebrationStats && celebrationPhase === 2 && (
        <Phase2Celebration
          stats={celebrationStats}
          onClose={() => { setShowCelebration(false); onRefresh?.(); }}
        />
      )}
      {showCelebration && celebrationStats && celebrationPhase === 3 && (
        <Phase3Celebration
          stats={celebrationStats}
          onClose={() => { setShowCelebration(false); onRefresh?.(); }}
          onViewFrontDesk={() => { setShowCelebration(false); onRefresh?.(); navigate('/front-desk'); }}
        />
      )}
    </>
  );
}
