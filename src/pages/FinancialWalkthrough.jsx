/**
 * src/pages/FinancialWalkthrough.jsx
 * Cadi — Phase 2 Step 2: Financial Walkthrough
 *
 * Route: /walkthrough
 * Guided 5-screen tour through the business finances.
 * Reads from walkthrough_analysis (pre-computed), writes to walkthroughs.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { markStepComplete } from '../lib/db/thirtyDayPlanDb';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n) => `£${Math.round(Math.abs(n ?? 0)).toLocaleString('en-GB')}`;

// Covers BOTH the Money tab's user-facing ids (fuel, professional, phone, bankfees…)
// and the legacy / edge-function ids (professional_services, phone_internet, bank_charges…).
// If we don't enumerate both, Screen 3 shows raw keys like "bankfees".
const CAT_LABELS = {
  // Money tab ids (current)
  fuel: 'Fuel & travel',
  supplies: 'Supplies',
  equipment: 'Equipment',
  insurance: 'Insurance',
  marketing: 'Marketing',
  vehicle: 'Vehicle',
  staff: 'Staff costs',
  premises: 'Premises',
  professional: 'Professional fees',
  subscriptions: 'Subscriptions',
  phone: 'Phone & internet',
  training: 'Training',
  uniform: 'Uniform & PPE',
  bankfees: 'Bank & finance',
  other: 'Other',
  // Legacy / edge-function ids (kept for back-compat)
  phone_internet: 'Phone & internet',
  professional_services: 'Professional services',
  bank_charges: 'Bank & finance',
  tax_payment: 'Tax payments',
  food_drink: 'Food & drink',
  shopping: 'Shopping',
  income_customer: 'Customer income',
  income_other: 'Other income',
  uncategorised: 'Other',
};

function catLabel(k) {
  return CAT_LABELS[k] ?? k;
}

// ── Layout wrapper ────────────────────────────────────────────────────────────

const BG = 'min-h-screen bg-gradient-to-br from-[#050c1e] via-[#080f28] to-[#050c1e]';

function Layout({ children, screen, total, onSave }) {
  return (
    <div className={BG}>
      {/* Top progress + save */}
      <div className="sticky top-0 z-10 bg-[#050c1e]/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-[#4f78ff]">
            Walkthrough
          </span>
          {screen > 0 && total > 0 && (
            <span className="text-[10px] text-white/30">
              {screen} / {total}
            </span>
          )}
        </div>
        {onSave && (
          <button
            onClick={onSave}
            className="text-xs text-white/40 hover:text-white/60 transition-colors font-semibold"
          >
            Save &amp; pause
          </button>
        )}
      </div>

      {/* Progress bar */}
      {screen > 0 && total > 0 && (
        <div className="h-0.5 bg-white/5">
          <div
            className="h-full bg-[#4f78ff] transition-all duration-500"
            style={{ width: `${(screen / total) * 100}%` }}
          />
        </div>
      )}

      <div className="px-4 py-8 max-w-xl mx-auto">{children}</div>
    </div>
  );
}

// ── Hole card ─────────────────────────────────────────────────────────────────

function HoleCard({ hole, onAction }) {
  const [dismissed, setDismissed] = useState(null);

  if (dismissed) {
    return (
      <div className="p-4 rounded-xl bg-white/3 border border-white/6 text-sm text-white/30 italic">
        {dismissed === 'follow_up'
          ? '✓ Marked for follow-up'
          : dismissed === 'expected'
            ? 'Got it.'
            : 'Ignored.'}
      </div>
    );
  }

  // "Mark as paid" was a fake button — it only stashed a response, never updated the
  // invoice. Removed until we wire it up to invoiceDb. Users can still mark paid in
  // the Money/Accounts tab.
  const actions =
    hole.type === 'unpaid_invoice'
      ? [
          ['Draft a chase', 'chase'],
          ['Ignore', 'ignore'],
        ]
      : hole.type === 'subscription'
        ? [
            ['Mark for follow-up', 'follow_up'],
            ['Still using it', 'expected'],
            ['Ignore', 'ignore'],
          ]
        : [
            ['Mark for follow-up', 'follow_up'],
            ['Already on it', 'expected'],
            ['Ignore', 'ignore'],
          ];

  return (
    <div className="p-4 rounded-xl bg-white/4 border border-white/10 space-y-3">
      <div>
        <p className="text-sm font-bold text-white">{hole.title}</p>
        <p className="text-sm text-white/55 mt-1 leading-relaxed">{hole.body}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map(([label, value]) => (
          <button
            key={value}
            onClick={() => {
              setDismissed(value);
              onAction?.(hole, value);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              value === 'follow_up' || value === 'chase'
                ? 'bg-[#4f78ff]/20 border border-[#4f78ff]/40 text-[#99c5ff] hover:bg-[#4f78ff]/30'
                : 'bg-white/6 border border-white/10 text-white/50 hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Focus area card ───────────────────────────────────────────────────────────

function FocusCard({ area, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(area)}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected
          ? 'bg-[#4f78ff]/15 border-[#4f78ff]/50'
          : 'bg-white/4 border-white/10 hover:bg-white/6 hover:border-white/20'
      }`}
    >
      <p className={`text-sm font-bold ${selected ? 'text-[#99c5ff]' : 'text-white'}`}>
        {area.title}
      </p>
      <p className="text-xs text-white/50 mt-1 leading-relaxed">{area.body}</p>
      {area.estimated_saving > 0 && (
        <p className="text-xs text-emerald-400 mt-1.5 font-semibold">
          Could save ~{fmt(area.estimated_saving)}/month
        </p>
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancialWalkthrough() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [walkthrough, setWalkthrough] = useState(null);
  const [screen, setScreen] = useState(0); // 0=intro, 1-5=screens, 6=closing
  const [responses, setResponses] = useState({});
  const [focusArea, setFocusArea] = useState(null);
  const [customFocus, setCustomFocus] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Check for existing in-progress walkthrough
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', session.user.id)
        .single();
      if (!biz) return;

      const [{ data: walks }, { data: an }] = await Promise.all([
        supabase
          .from('walkthroughs')
          .select('*')
          .eq('business_id', biz.id)
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('walkthrough_analysis')
          .select('*')
          .eq('business_id', biz.id)
          .order('generated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setAnalysis(an);

      if (walks) {
        setWalkthrough(walks);
        setScreen(walks.current_screen ?? 0);
        setResponses(walks.user_responses ?? {});
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateAnalysis() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const { error } = await supabase.functions.invoke('walkthrough-analysis', {
        body: { action: 'generate' },
      });
      if (error) throw error;
      await load();
    } catch (e) {
      setGenerateError(
        e.message ?? 'Could not generate analysis. Check your bank is connected and try again.'
      );
    } finally {
      setGenerating(false);
    }
  }

  // Create or resume walkthrough record
  async function ensureWalkthrough() {
    if (walkthrough) return walkthrough;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data: biz } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_user_id', session.user.id)
      .single();
    const { data: w } = await supabase
      .from('walkthroughs')
      .insert({ business_id: biz.id, type: 'first_time', current_screen: 0 })
      .select()
      .single();
    setWalkthrough(w);
    return w;
  }

  async function goToScreen(n) {
    const w = await ensureWalkthrough();
    setScreen(n);
    await supabase
      .from('walkthroughs')
      .update({ current_screen: n, user_responses: responses })
      .eq('id', w.id);
  }

  async function saveAndPause() {
    setSaving(true);
    if (walkthrough) {
      await supabase
        .from('walkthroughs')
        .update({ current_screen: screen, user_responses: responses })
        .eq('id', walkthrough.id);
    }
    setSaving(false);
    navigate('/dashboard');
  }

  function addResponse(key, value) {
    setResponses((r) => ({ ...r, [key]: value }));
  }

  async function completeFocusArea() {
    const chosen =
      focusArea || (customFocus.trim() ? { title: customFocus.trim(), body: '' } : null);
    if (!chosen) return;

    const w = await ensureWalkthrough();
    await supabase
      .from('walkthroughs')
      .update({
        chosen_focus_area: chosen.title,
        chosen_focus_area_data: chosen,
        completed_at: new Date().toISOString(),
        current_screen: 6,
      })
      .eq('id', w.id);

    // Mark onboarding step complete
    try {
      await markStepComplete('financial_walkthrough', 2, { focus_area: chosen.title });
    } catch {
      /* non-fatal */
    }

    setScreen(6);
  }

  // ── Derived values ──────────────────────────────────────────────────────────

  const health = analysis?.health_data ?? {};
  const moneyIn = analysis?.money_in_data ?? {};
  const moneyOut = analysis?.money_out_data ?? {};
  const holes = analysis?.holes_data ?? [];
  const wins = analysis?.wins ?? [];
  const watchOuts = analysis?.watch_outs ?? [];
  const focusAreas = analysis?.suggested_focus_areas ?? [];
  const periodDays = moneyIn.periodDays ?? 60;

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={BG + ' flex items-center justify-center'}>
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#4f78ff]/20 border-t-[#4f78ff] animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading your walkthrough…</p>
        </div>
      </div>
    );
  }

  // ── No analysis yet ─────────────────────────────────────────────────────────

  if (!analysis) {
    return (
      <Layout screen={0} total={0}>
        <div className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-[#4f78ff]/10 border border-[#4f78ff]/30 flex items-center justify-center mx-auto mb-4">
            {generating ? (
              <div className="w-6 h-6 rounded-full border-2 border-[#4f78ff]/20 border-t-[#4f78ff] animate-spin" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#4f78ff]" />
            )}
          </div>
          <h2 className="text-white font-black text-xl mb-2">
            {generating ? 'Cadi is reading your transactions…' : "Let's get your numbers ready."}
          </h2>
          <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            {generating
              ? 'This usually takes under a minute.'
              : "I need to look through the last 60 days of your money before we walk through it together. Bank connected or money logged in Cadi — either works. Tap below when you're ready."}
          </p>
          {generateError && (
            <p className="text-rose-300 text-xs mb-4 max-w-sm mx-auto">{generateError}</p>
          )}
          <div className="space-y-2 max-w-xs mx-auto">
            <button
              onClick={generateAnalysis}
              disabled={generating}
              className="w-full px-6 py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-50 text-white font-bold text-sm transition-colors"
            >
              {generating ? 'Reading…' : 'Run it now'}
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              disabled={generating}
              className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors disabled:opacity-50"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Screen 0: Intro ─────────────────────────────────────────────────────────

  if (screen === 0) {
    return (
      <Layout screen={0} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#4f78ff] mb-2">
              Financial walkthrough
            </p>
            <h1 className="text-2xl font-black text-white leading-tight mb-3">
              Let's go through your finances together.
            </h1>
            <p className="text-white/60 text-sm leading-relaxed mb-4">
              I've had a look at the last {periodDays} days of your bank account. We're going to
              walk through three things:
            </p>
            <ul className="space-y-2 mb-4">
              {[
                "What's coming in",
                "What's going out",
                'A few things I spotted that might be worth a look',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-white/55">
                  <span className="text-[#4f78ff] shrink-0">→</span>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-white/50 text-sm leading-relaxed">
              It'll take about 10 minutes. You can pause any time — I'll save where we got to.
            </p>
            <p className="text-white/50 text-sm mt-2">Ready when you are.</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => goToScreen(1)}
              className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
            >
              Let's go
            </button>
            <button
              onClick={saveAndPause}
              className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors"
            >
              Come back later
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // ── Screen 1: The Picture ───────────────────────────────────────────────────

  if (screen === 1) {
    return (
      <Layout screen={1} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-4">Here's the picture.</h2>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">
              Over the last {periodDays} days:
            </p>
            <div className="space-y-2 mb-5">
              {[
                { label: 'came in', value: fmt(health.totalIn), positive: true },
                { label: 'went out', value: fmt(health.totalOut), positive: false },
                {
                  label: 'a month in profit',
                  value: fmt(health.monthlyProfit),
                  positive: (health.monthlyProfit ?? 0) >= 0,
                },
              ].map(({ label, value, positive }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/4 border border-white/8"
                >
                  <span className="text-white/50 text-sm">{label}</span>
                  <span
                    className={`font-black text-lg tabular-nums ${positive ? 'text-white' : 'text-white/70'}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {/* Win from pre-analysis */}
            {wins[0] && (
              <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20 mb-4">
                <p className="text-xs font-bold text-emerald-400 mb-1">✓ {wins[0].title}</p>
                <p className="text-sm text-white/60 leading-relaxed">{wins[0].body}</p>
              </div>
            )}

            <p className="text-sm text-white/50 leading-relaxed italic">
              "That's the headline. We'll dig in next — I'll show you where the money comes from,
              where it goes, and a few things I noticed that might be worth a look.
            </p>
            <p className="text-sm text-white/40 leading-relaxed italic mt-1">
              Nothing here is a judgement, by the way. I'm just here to help you see it clearly."
            </p>
          </div>

          {/* Inline optional question */}
          {!responses.picture_reaction && (
            <div className="p-4 rounded-xl bg-white/3 border border-white/8">
              <p className="text-sm text-white/60 mb-3">
                Does that profit figure look about right to you?
              </p>
              <div className="flex flex-wrap gap-2">
                {['Yes, sounds about right', 'Lower than I thought', 'Higher than I thought'].map(
                  (opt) => (
                    <button
                      key={opt}
                      onClick={() => addResponse('picture_reaction', opt)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/6 border border-white/10 text-white/60 hover:bg-white/10 transition-colors"
                    >
                      {opt}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
          {responses.picture_reaction && (
            <p className="text-xs text-white/30 italic">
              Got it — {responses.picture_reaction.toLowerCase()}.
            </p>
          )}

          <button
            onClick={() => goToScreen(2)}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
          >
            Show me money in →
          </button>
        </div>
      </Layout>
    );
  }

  // ── Screen 2: Money In ──────────────────────────────────────────────────────

  if (screen === 2) {
    const customers = moneyIn.topCustomers ?? [];
    const gaps = moneyIn.incomeGaps ?? [];
    const unreconciled = moneyIn.unreconciledCredits ?? [];

    return (
      <Layout screen={2} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Your money in.</h2>
            <p className="text-white/50 text-sm">
              Here's where your income came from over the last {periodDays} days.
            </p>
          </div>

          {customers.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-2">
                Your top customers
              </p>
              <div className="space-y-2">
                {customers.slice(0, 5).map((c, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/4 border border-white/8"
                  >
                    <span className="text-sm text-white/70 truncate flex-1">{c.name}</span>
                    <span className="text-sm font-black text-white tabular-nums ml-2">
                      {fmt(c.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Win */}
          {wins[0] && customers.length > 0 && (
            <div className="p-4 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
              <p className="text-sm text-white/60 leading-relaxed">{wins[0].body}</p>
            </div>
          )}

          {/* Income gaps */}
          {gaps.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/8 border border-amber-500/20">
              <p className="text-xs font-bold text-amber-400 mb-1">Worth a look</p>
              <p className="text-sm text-white/60 leading-relaxed">
                One thing I spotted — there was a gap in {gaps.map((g) => g.month).join(', ')} where
                revenue dropped. Was that planned, or worth a look?
              </p>
            </div>
          )}

          {/* Unreconciled credits */}
          {unreconciled.length > 0 && (
            <div className="p-4 rounded-xl bg-white/4 border border-white/10">
              <p className="text-xs font-bold text-white/50 mb-1">Unmatched payments</p>
              <p className="text-sm text-white/60 leading-relaxed mb-2">
                I see {fmt(unreconciled.reduce((s, t) => s + t.amount, 0))} came in that I couldn't
                match to invoices. Could be customers paying that I haven't connected yet.
              </p>
              <button className="text-xs text-[#4f78ff] font-semibold hover:text-[#99c5ff] transition-colors">
                Sort these later →
              </button>
            </div>
          )}

          {customers.length === 0 && (
            <div className="p-4 rounded-xl bg-white/4 border border-white/8">
              <p className="text-sm text-white/40 italic">
                Cadi doesn't have customer payment data yet — once invoices start flowing through,
                this'll get more interesting.
              </p>
            </div>
          )}

          <button
            onClick={() => goToScreen(3)}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
          >
            Show me money out →
          </button>
        </div>
      </Layout>
    );
  }

  // ── Screen 3: Money Out ─────────────────────────────────────────────────────

  if (screen === 3) {
    const categories = (moneyOut.categories ?? []).filter(
      (c) => !['income_customer', 'income_other', 'uncategorised'].includes(c.category)
    );

    return (
      <Layout screen={3} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-1">Your money out — where it goes.</h2>
            <p className="text-white/50 text-sm">
              Here's where your money went, biggest categories first.
            </p>
          </div>

          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.slice(0, 8).map((cat) => (
                <div
                  key={cat.category}
                  className="px-4 py-3 rounded-xl bg-white/4 border border-white/8"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-white">
                      {catLabel(cat.category)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">{cat.pct}%</span>
                      <span className="text-sm font-black text-white tabular-nums">
                        {fmt(cat.amount)}
                      </span>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="h-1 bg-white/8 rounded-full">
                    <div
                      className="h-full bg-[#4f78ff]/60 rounded-full"
                      style={{ width: `${Math.min(cat.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/4 border border-white/8">
              <p className="text-sm text-white/40 italic">
                Quiet on the spending front. Either you're running lean or there's another account
                in the mix.
              </p>
            </div>
          )}

          {/* Watch-outs */}
          {watchOuts.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-400/70 mb-2">
                Worth a look
              </p>
              <div className="space-y-2">
                {watchOuts.map((wo, i) => (
                  <div key={i} className="p-4 rounded-xl bg-amber-500/6 border border-amber-500/20">
                    <p className="text-sm font-bold text-amber-300 mb-1">{wo.title}</p>
                    <p className="text-sm text-white/55 leading-relaxed">{wo.body}</p>
                    <div className="flex gap-2 mt-2.5">
                      {['Mark for follow-up', "That's expected", 'Ignore'].map((label) => (
                        <button
                          key={label}
                          onClick={() => addResponse(`watchout_${i}`, label)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            responses[`watchout_${i}`] === label
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                              : 'bg-white/5 border border-white/10 text-white/40 hover:bg-white/10'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => goToScreen(4)}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
          >
            Show me the holes →
          </button>
        </div>
      </Layout>
    );
  }

  // ── Screen 4: Holes ─────────────────────────────────────────────────────────

  if (screen === 4) {
    return (
      <Layout screen={4} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-1">A few things worth a look.</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              These are things I noticed that you might want to do something about. Some might be
              totally fine — let me know which ones to ignore and which to follow up on.
            </p>
          </div>

          {holes.length > 0 ? (
            <div className="space-y-3">
              {holes.map((hole, i) => (
                <HoleCard
                  key={i}
                  hole={hole}
                  onAction={(h, action) => addResponse(`hole_${i}`, action)}
                />
              ))}
            </div>
          ) : (
            <div className="p-5 rounded-xl bg-emerald-500/8 border border-emerald-500/20 text-center">
              <p className="text-emerald-400 font-bold mb-1">Nothing flagged.</p>
              <p className="text-sm text-white/50">
                I didn't spot anything that worried me. That's a good sign.
              </p>
            </div>
          )}

          <button
            onClick={() => goToScreen(5)}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
          >
            Pick one thing to work on →
          </button>
        </div>
      </Layout>
    );
  }

  // ── Screen 5: Focus Area ────────────────────────────────────────────────────

  if (screen === 5) {
    const canContinue = focusArea !== null || customFocus.trim().length > 0;

    return (
      <Layout screen={5} total={5} onSave={saveAndPause}>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-black text-white mb-1 leading-tight">
              If we picked one thing to work on this month, here's what I'd suggest.
            </h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Based on what we just went through, these are the highest-impact options. Pick one —
              or write your own. I'll track it in your weekly reports.
            </p>
          </div>

          {focusAreas.length > 0 ? (
            <div className="space-y-2">
              {focusAreas.map((area, i) => (
                <FocusCard
                  key={i}
                  area={area}
                  selected={focusArea === area}
                  onSelect={setFocusArea}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {[
                {
                  title: 'Chase unpaid invoices',
                  body: 'Follow up on outstanding payments.',
                  estimated_saving: null,
                },
                {
                  title: 'Review subscriptions',
                  body: "Cancel anything that's not earning its keep.",
                  estimated_saving: null,
                },
                {
                  title: 'Move supplies to wholesale',
                  body: 'Costco, Bookers, B&M — typically 30-40% cheaper than retail.',
                  estimated_saving: null,
                },
              ].map((area, i) => (
                <FocusCard
                  key={i}
                  area={area}
                  selected={focusArea === area}
                  onSelect={setFocusArea}
                />
              ))}
            </div>
          )}

          <div>
            <p className="text-xs text-white/40 mb-2 font-semibold">Or focus on something else:</p>
            <input
              type="text"
              value={customFocus}
              onChange={(e) => {
                setCustomFocus(e.target.value);
                setFocusArea(null);
              }}
              placeholder="Type your own focus area…"
              className="w-full px-4 py-3 rounded-xl bg-white/4 border border-white/10 focus:border-[#4f78ff]/50 focus:outline-none text-white text-sm placeholder-white/25"
            />
          </div>

          <button
            onClick={completeFocusArea}
            disabled={!canContinue || saving}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-40 text-white font-black text-base transition-colors"
          >
            {saving ? 'Saving…' : 'Set this as my focus →'}
          </button>
        </div>
      </Layout>
    );
  }

  // ── Screen 6: Closing ───────────────────────────────────────────────────────

  const chosenFocus = walkthrough?.chosen_focus_area ?? focusArea?.title ?? customFocus;

  return (
    <Layout screen={0} total={0}>
      <div className="space-y-6 text-center">
        <div className="text-5xl">🎉</div>
        <div>
          <h2 className="text-2xl font-black text-white mb-2">That's it. Look what we just did.</h2>
          <p className="text-white/50 text-sm">
            You've gone through your finances, spotted what matters, and picked a focus.
          </p>
        </div>

        <div className="space-y-2 text-left">
          {[
            `Walked through ${periodDays} days of transactions`,
            holes.filter((h) => h.type === 'unpaid_invoice').length > 0
              ? `Found ${fmt(holes.filter((h) => h.type === 'unpaid_invoice').reduce((s, h) => s + (h.amount ?? 0), 0))} in invoices to chase`
              : null,
            moneyOut.subscriptions?.length > 0
              ? `Spotted ${moneyOut.subscriptions.length} subscription${moneyOut.subscriptions.length > 1 ? 's' : ''} worth reviewing`
              : null,
            chosenFocus ? `Picked your focus: ${chosenFocus}` : null,
          ]
            .filter(Boolean)
            .map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/4 border border-white/8"
              >
                <span className="text-emerald-400 shrink-0">✓</span>
                <p className="text-sm text-white/70">{item}</p>
              </div>
            ))}
        </div>

        <div className="p-4 rounded-xl bg-white/4 border border-white/8">
          <p className="text-sm text-white/60 leading-relaxed">
            "That's the whole picture. Your focus for the next 30 days is sorted — I'll check in on
            it every Monday in your weekly report. You can run this walkthrough again any time you
            want a fresh look."
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[rgba(79,120,255,0.08)] border border-[rgba(79,120,255,0.2)]">
          <p className="text-xs font-bold text-[#4f78ff] mb-1">🔒 Pro feature</p>
          <p className="text-xs text-white/40">
            On Pro, Cadi compares each month to the last so you can see your changes land.
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-base transition-colors"
          >
            Back to dashboard
          </button>
          <button
            onClick={() => {
              setScreen(0);
              setResponses({});
              setFocusArea(null);
              setCustomFocus('');
              setWalkthrough(null);
            }}
            className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 transition-colors"
          >
            Run walkthrough again later
          </button>
        </div>
      </div>
    </Layout>
  );
}
