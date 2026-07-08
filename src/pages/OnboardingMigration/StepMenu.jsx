// Step 4 — Service menu review.
// Cadi has drafted a clean service menu from the customers we just brought in.
// The owner reviews it, edits anything they don't like, then locks it in.
// Lock-in writes to the live `services` table and advances to the reveal.

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Sparkles,
  RotateCw,
  Trash2,
  Plus,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  PlusCircle,
} from 'lucide-react';
import {
  generateMenuDraft,
  saveMenuDraft,
  commitMenuToServices,
  updateStep,
} from '../../lib/db/onboardingDb';

const DIVISION_META = {
  residential: {
    label: 'Residential',
    accent: '#1f48ff',
    hint: 'Homes, holiday lets, end-of-tenancy.',
  },
  exterior: { label: 'Exterior', accent: '#10b981', hint: 'Windows, gutters, soft-wash.' },
  commercial: { label: 'Commercial', accent: '#f59e0b', hint: 'Offices, pubs, contracts.' },
  unknown: { label: 'Other', accent: '#99c5ff', hint: 'Anything Cadi couldn’t auto-classify.' },
};

export default function StepMenu({ session, onAdvance }) {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState(null);

  const load = async (regenerate = false) => {
    try {
      const m = await generateMenuDraft(session.id, { regenerate });
      setMenu(m);
    } catch (e) {
      setError(e?.message ?? "Couldn't draft your menu.");
    } finally {
      setLoading(false);
      setRegenerating(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save the in-memory edits back to the cached draft so a reload picks
  // them up. Throttled lightly via blur events on inputs.
  const persist = async (next) => {
    setMenu(next);
    try {
      await saveMenuDraft(session.id, next);
    } catch {
      /* silent */
    }
  };

  const totalServices = useMemo(() => {
    return (menu?.sections ?? []).reduce((sum, s) => sum + (s.services?.length ?? 0), 0);
  }, [menu]);

  const lockIn = async () => {
    if (committing || !menu) return;
    setCommitting(true);
    try {
      // Save any unsaved edits first.
      await saveMenuDraft(session.id, menu);
      const { inserted, updated } = await commitMenuToServices(session.id, menu);
      // Edge case: nothing landed (empty menu). Stay on this step and warn.
      if (inserted === 0 && updated === 0) {
        setError('Nothing to lock in — add at least one service.');
        setCommitting(false);
        return;
      }
      onAdvance({ ...session, step: 'reveal' });
    } catch (e) {
      setError(e?.message ?? "Couldn't lock in your menu.");
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-[#1f48ff]/8 border border-[#1f48ff]/15 flex items-center justify-center animate-pulse">
            <Sparkles size={20} className="text-[#1f48ff]" />
          </div>
          <p className="text-sm font-bold text-[#010a4f] mb-1">Drafting your menu…</p>
          <p className="text-[11px] text-[#010a4f]/60">
            Reading your customers' services and prices.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-8 sm:py-14">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={async () => {
              try {
                await updateStep(session.id, 'review');
                onAdvance({ ...session, step: 'review' });
              } catch (e) {
                setError(e?.message ?? "Couldn't go back.");
              }
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-[#1f48ff] hover:text-[#010a4f] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f0f4ff]"
          >
            <ArrowLeft size={14} /> Back to review
          </button>
          <span className="text-[10px] font-semibold tracking-wider uppercase text-[#010a4f]/45">
            Step 4 of 5
          </span>
        </div>

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-[#010a4f] mb-2 leading-tight">
            Your service menu.
          </h1>
          <p className="text-sm text-[#010a4f]/75 max-w-md mx-auto mb-3">
            Built from your real customers — the services you already deliver, at the prices you
            already charge.
          </p>
          {totalServices > 0 && (
            <p className="text-[11px] text-[#010a4f]/60">
              <span className="font-bold text-[#010a4f]">{totalServices}</span> service
              {totalServices === 1 ? '' : 's'}, ready to lock in
            </p>
          )}
        </div>

        {/* Regenerate button — small, top of cards. */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => {
              setRegenerating(true);
              load(true);
            }}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-[11px] font-bold text-[#1f48ff] hover:text-[#010a4f] px-2.5 py-1.5 rounded-lg hover:bg-[#f0f4ff] transition-colors disabled:opacity-50"
          >
            <RotateCw size={11} className={regenerating ? 'animate-spin' : ''} />
            {regenerating ? 'Redrafting…' : 'Redraft from scratch'}
          </button>
        </div>

        {(menu?.sections ?? []).length === 0 && (
          <div className="rounded-2xl border border-[#1f48ff]/15 bg-[#f0f4ff] p-6 text-center mb-6">
            <p className="text-sm text-[#010a4f]/75 mb-2">No services to draft yet.</p>
            <p className="text-[11px] text-[#010a4f]/60">
              Add at least one service per customer in Step 3, then come back.
            </p>
          </div>
        )}

        {(menu?.sections ?? []).map((section, sIdx) => {
          const meta =
            DIVISION_META[String(section.division ?? '').toLowerCase()] ?? DIVISION_META.unknown;
          return (
            <section key={`${section.division}-${sIdx}`} className="mb-8">
              <div className="flex items-center gap-3 mb-3 px-1">
                <div className="w-1.5 h-5 rounded-full" style={{ background: meta.accent }} />
                <h2 className="text-sm font-black text-[#010a4f]">{meta.label}</h2>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: `${meta.accent}50`,
                    color: meta.accent,
                    background: `${meta.accent}15`,
                  }}
                >
                  {section.services?.length ?? 0}
                </span>
                <p className="text-[11px] text-[#010a4f]/60 hidden sm:block">{meta.hint}</p>
              </div>

              {/* Template-driven gap insights — only surface when meaningful
                  (an empty top/bottom of the ladder, or 3+ adjacent empty
                  middle tiers). One nudge per service with a real gap. */}
              {(section.gap_insights ?? []).map((insight, gIdx) => (
                <div
                  key={`gap-${gIdx}`}
                  className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2"
                >
                  <AlertCircle size={12} className="text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-snug">
                    <span className="font-bold">{insight.service}:</span> {insight.message}
                  </p>
                </div>
              ))}

              {/* Cadi's question — only when there's something to clarify
                  (usually after tiered services so the user can confirm
                  what the tiers actually represent). */}
              {section.question && !section.question_answered && (
                <CadiQuestion
                  accent={meta.accent}
                  question={section.question}
                  onSkip={() => {
                    const next = structuredClone(menu);
                    next.sections[sIdx].question_answered = true;
                    persist(next);
                  }}
                  onAnswer={(answer) => {
                    const next = structuredClone(menu);
                    next.sections[sIdx].question_answered = true;
                    next.sections[sIdx].question_answer = answer;
                    persist(next);
                  }}
                />
              )}

              <div className="space-y-2.5">
                {(section.services ?? []).map((svc, svcIdx) => (
                  <ServiceCard
                    key={svcIdx}
                    service={svc}
                    accent={meta.accent}
                    onChange={(patch) => {
                      const next = structuredClone(menu);
                      next.sections[sIdx].services[svcIdx] = { ...svc, ...patch };
                      persist(next);
                    }}
                    onDelete={() => {
                      const next = structuredClone(menu);
                      next.sections[sIdx].services.splice(svcIdx, 1);
                      persist(next);
                    }}
                  />
                ))}

                <button
                  onClick={() => {
                    const next = structuredClone(menu);
                    next.sections[sIdx].services.push({
                      name: '',
                      description: '',
                      suggested_price: null,
                      price_low: null,
                      price_high: null,
                      customer_count: 0,
                      price_spread_flag: false,
                    });
                    persist(next);
                  }}
                  className="w-full py-2.5 rounded-xl border border-dashed border-[#1f48ff]/15 bg-[#f0f4ff] hover:bg-[#f0f4ff] hover:border-[#1f48ff]/30 text-xs font-bold text-[#1f48ff] flex items-center justify-center gap-1.5 transition-all"
                >
                  <Plus size={13} /> Add a service
                </button>
              </div>

              {/* Cadi's suggested add-ons — one tap to add to the menu. */}
              {(section.suggestions ?? []).length > 0 && (
                <SuggestionStrip
                  suggestions={section.suggestions}
                  accent={meta.accent}
                  divisionLabel={meta.label.toLowerCase()}
                  onAdd={(sug) => {
                    const next = structuredClone(menu);
                    next.sections[sIdx].services.push({
                      name: sug.name,
                      description: sug.why || '',
                      suggested_price: null,
                      price_low: null,
                      price_high: null,
                      customer_count: 0,
                      price_spread_flag: false,
                      tier_of: null,
                    });
                    // Pop the just-added suggestion off the suggestion list.
                    next.sections[sIdx].suggestions = (
                      next.sections[sIdx].suggestions ?? []
                    ).filter((s) => s.name !== sug.name);
                    persist(next);
                  }}
                  onDismiss={(sug) => {
                    const next = structuredClone(menu);
                    next.sections[sIdx].suggestions = (
                      next.sections[sIdx].suggestions ?? []
                    ).filter((s) => s.name !== sug.name);
                    persist(next);
                  }}
                />
              )}
            </section>
          );
        })}

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="h-28" />
      </div>

      {/* Sticky lock-in CTA. */}
      <div className="sticky bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-md border-t border-[#1f48ff]/15 w-full">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
          <button
            onClick={lockIn}
            disabled={committing || totalServices === 0}
            className={`w-full py-3.5 rounded-xl text-white text-sm font-black shadow-lg transition-all ${
              committing || totalServices === 0
                ? 'bg-[#f0f4ff] border border-[#1f48ff]/15 text-[#010a4f]/45 cursor-not-allowed shadow-none'
                : 'bg-[#1f48ff] hover:bg-[#3a5eff] shadow-[#1f48ff]/25'
            }`}
          >
            {committing
              ? 'Locking it in…'
              : totalServices === 0
                ? 'Add a service to lock in'
                : `Lock in ${totalServices} service${totalServices === 1 ? '' : 's'} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── One service card ────────────────────────────────────────────────────────

function ServiceCard({ service, accent, onChange, onDelete }) {
  const [draft, setDraft] = useState(service);
  const [showSources, setShowSources] = useState(false);
  useEffect(() => {
    setDraft(service);
  }, [service]);

  const v = (k, fallback = '') => draft[k] ?? fallback;
  const set = (k, val) => setDraft((prev) => ({ ...prev, [k]: val }));
  const commit = (k, val) => {
    set(k, val);
    onChange({ [k]: val });
  };
  const sourcePrices = Array.isArray(service.source_prices) ? service.source_prices : [];

  const isEstimated = Boolean(v('is_estimated'));

  return (
    <div
      className={`rounded-2xl border overflow-hidden bg-white ${
        isEstimated ? 'border-amber-500/40' : 'border-[#1f48ff]/15'
      }`}
    >
      <div className="relative pl-4 pr-3 pt-3 pb-3">
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: isEstimated ? '#f59e0b' : accent }}
        />

        <div className="flex items-start gap-2 mb-2">
          <input
            type="text"
            value={v('name')}
            onChange={(e) => set('name', e.target.value)}
            onBlur={() => onChange({ name: draft.name })}
            placeholder="Service name"
            className="flex-1 min-w-0 bg-transparent border-0 border-b border-transparent hover:border-[#1f48ff]/15 focus:border-[#1f48ff] focus:outline-none text-sm font-black text-[#010a4f] py-0.5 placeholder-[#010a4f]/35"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            {/* "From £X" toggle — mark the price as a starting/guide price so
                the menu and Front Desk quote it as "from £X" rather than a flat
                price. Handy for enquiry-only services where the final price
                depends on the site. */}
            <button
              type="button"
              onClick={() => commit('from_price', !v('from_price'))}
              title={
                v('from_price')
                  ? 'Shown as a “from” price — Front Desk quotes “from £X”. Tap to make it a flat price.'
                  : 'Mark as a “from” price — Front Desk will quote “from £X”.'
              }
              className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md border transition-colors ${
                v('from_price')
                  ? 'bg-emerald-50 border-emerald-500/40 text-emerald-600'
                  : 'bg-[#f0f4ff] border-[#1f48ff]/15 text-[#010a4f]/40 hover:text-[#1f48ff] hover:border-[#1f48ff]/30'
              }`}
            >
              from
            </button>
            {/* Estimated pill — template filled this slot by progression
                rather than observation. Owner edits to clear. */}
            {isEstimated && (
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-500/40 rounded-md px-1.5 py-0.5">
                Estimated
              </span>
            )}
            <span
              className={`text-[10px] font-bold ${isEstimated ? 'text-amber-700' : 'text-emerald-600'}`}
            >
              £
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={v('suggested_price', '')}
              onChange={(e) =>
                set('suggested_price', e.target.value === '' ? null : Number(e.target.value))
              }
              onBlur={() =>
                onChange({ suggested_price: draft.suggested_price, is_estimated: false })
              }
              placeholder="—"
              className={`w-16 text-right bg-transparent border-0 border-b border-transparent hover:border-[#1f48ff]/15 focus:border-[#1f48ff] focus:outline-none text-sm font-black py-0.5 tabular-nums placeholder-[#010a4f]/35 ${
                isEstimated ? 'text-amber-700' : 'text-emerald-600'
              }`}
            />
          </div>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0 bg-[#f0f4ff] border-[#1f48ff]/15 text-[#010a4f]/45 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
            title="Remove this service"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Booking-mode pill + custom/outlier badge. Mode pill is editable
            via the dropdown — but only DOWNGRADES are silent; upgrading
            toward instant requires confirm because it makes the service
            bookable by strangers without the owner. */}
        <BookingModePill
          value={v('booking_mode')}
          isOutlier={Boolean(v('is_outlier'))}
          onChange={(next) => commit('booking_mode', next)}
        />

        {/* Custom-priced outlier marker. */}
        {v('is_outlier') && (
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-1.5">
            Custom-priced exception
          </p>
        )}

        <textarea
          value={v('description')}
          onChange={(e) => set('description', e.target.value)}
          onBlur={() => onChange({ description: draft.description })}
          placeholder="One short description — what's included."
          rows={2}
          className="w-full bg-[#f0f4ff] border border-[#1f48ff]/15 rounded-lg px-2.5 py-1.5 text-[12px] text-[#010a4f]/75 placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff] focus:bg-[#f0f4ff] resize-none leading-snug"
        />

        <div className="mt-2 flex items-center gap-3 text-[11px] flex-wrap">
          {Number(v('customer_count', 0)) > 0 && (
            <span className="text-[#010a4f]/60">
              <span className="font-bold text-[#010a4f]">{v('customer_count')}</span> customer
              {v('customer_count') === 1 ? '' : 's'}
            </span>
          )}
          {v('price_low') != null &&
            v('price_high') != null &&
            Number(v('price_low')) !== Number(v('price_high')) && (
              <span className="text-[#010a4f]/60">
                Range £{Number(v('price_low'))}–£{Number(v('price_high'))}
              </span>
            )}
          {sourcePrices.length > 0 && (
            <button
              onClick={() => setShowSources((s) => !s)}
              className="text-[11px] font-bold text-[#1f48ff] hover:text-[#010a4f] transition-colors"
            >
              {showSources ? 'Hide source prices' : `Show source prices (${sourcePrices.length})`}
            </button>
          )}
        </div>

        {/* The actual prices that fed the suggestion — full transparency.
            Lets the owner spot quarterly/annual totals that should be
            divided down to a per-visit price. */}
        {showSources && sourcePrices.length > 0 && (
          <div className="mt-2 rounded-lg border border-[#1f48ff]/15 bg-[#f0f4ff] px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f48ff] mb-1.5">
              Prices that fed this suggestion
            </p>
            <div className="flex flex-wrap gap-1">
              {sourcePrices.map((p, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-white border border-[#1f48ff]/15 text-[#010a4f] tabular-nums"
                >
                  £{Number(p)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sonnet flagged this tier as likely cumulative (quarterly /
            annual) totals rather than per-visit prices. Owner edits the
            suggested_price down to what they'd put on a menu. */}
        {v('cumulative_hint') && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
            <AlertCircle size={12} className="text-amber-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-800 leading-snug">{v('cumulative_hint')}</p>
          </div>
        )}

        {v('price_spread_flag') && !v('cumulative_hint') && (
          <div className="mt-2 rounded-lg border border-[#1f48ff]/15 bg-[#1f48ff]/8 px-2.5 py-2 flex items-start gap-2">
            <TrendingUp size={12} className="text-[#1f48ff] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#010a4f]/75 leading-snug">
              You charge between <span className="font-bold">£{Number(v('price_low'))}</span> and
              <span className="font-bold"> £{Number(v('price_high'))}</span> for the same job —
              worth a look. Your Monday money report will keep an eye on this.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cadi asks ───────────────────────────────────────────────────────────────
// Conversational nudge shown above tiered services so the owner can confirm
// what the tiers actually represent. Optional answer — they can skip and
// just edit the tier names directly on the cards.

function CadiQuestion({ question, accent, onAnswer, onSkip }) {
  const [answer, setAnswer] = useState('');
  return (
    <div
      className="mb-3 rounded-2xl border p-3 sm:p-4"
      style={{ borderColor: `${accent}25`, background: `${accent}15` }}
    >
      <div className="flex items-start gap-2.5 mb-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}25` }}
        >
          <MessageSquare size={13} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-1"
            style={{ color: accent }}
          >
            Cadi's asking
          </p>
          <p className="text-sm text-[#010a4f] leading-snug">{question}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-9">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim()) onAnswer(answer.trim());
          }}
          placeholder="Type your answer, or just rename the tiers below…"
          className="flex-1 text-[12px] bg-[#f0f4ff] border border-[#1f48ff]/15 rounded-lg px-3 py-1.5 text-[#010a4f] placeholder-[#010a4f]/45 focus:outline-none focus:border-[#1f48ff]"
        />
        <button
          onClick={() => (answer.trim() ? onAnswer(answer.trim()) : onSkip())}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#f0f4ff] hover:bg-[#f0f4ff] text-[#1f48ff] hover:text-[#010a4f] transition-all"
        >
          {answer.trim() ? 'Save' : 'Skip'}
        </button>
      </div>
    </div>
  );
}

// ── Booking-mode pill ───────────────────────────────────────────────────────
// One of three modes — instant / quick_quote / enquiry. The spec's "enquiry
// is the floor" rule: downgrading is silent, upgrading toward instant
// confirms (a stranger could book this without you). Inferred deterministically
// in the edge function — the user changes it here when they know better.

const MODE_META = {
  instant: {
    label: 'Instant book',
    color: '#10b981',
    hint: 'Customers see a fixed price and book straight in.',
  },
  quick_quote: {
    label: 'Quick quote',
    color: '#1f48ff',
    hint: 'Customers pick a tier / unit, see their price, then book.',
  },
  enquiry: {
    label: 'Enquiry only',
    color: '#99c5ff',
    hint: 'Customers send an enquiry — you reply with a price.',
  },
};

function BookingModePill({ value, isOutlier, onChange }) {
  const current = MODE_META[value] ?? MODE_META.enquiry;
  const handleChange = (next) => {
    if (next === value) return;
    // Upgrading toward instant requires confirm — spec §6.5.
    const isUpgradeToInstant = next === 'instant' && value !== 'instant';
    if (isUpgradeToInstant) {
      const ok = window.confirm(
        'Lock as an instant-bookable price?\n\nCustomers will be able to book this service without you confirming. Only switch this on if the price is genuinely fixed for everyone.'
      );
      if (!ok) return;
    }
    onChange(next);
  };

  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#010a4f]/60">
        Booking
      </span>
      <select
        value={value || 'enquiry'}
        onChange={(e) => handleChange(e.target.value)}
        title={current.hint}
        disabled={isOutlier} /* outliers stay enquiry — can't auto-book a custom exception */
        className="text-[11px] font-bold rounded-md px-2 py-0.5 border focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/25 disabled:opacity-60"
        style={{
          borderColor: `${current.color}55`,
          background: `${current.color}15`,
          color: current.color,
        }}
      >
        <option value="enquiry">Enquiry only</option>
        <option value="quick_quote">Quick quote</option>
        <option value="instant">Instant book</option>
      </select>
      <span className="text-[10px] text-[#010a4f]/45 truncate hidden sm:inline">
        {current.hint}
      </span>
    </div>
  );
}

// ── Suggested add-ons ───────────────────────────────────────────────────────
// "Want to add these too?" — Sonnet-picked related services for the
// owner's division. One tap adds to the menu, × dismisses.

function SuggestionStrip({ suggestions, accent, divisionLabel, onAdd, onDismiss }) {
  if (!suggestions.length) return null;
  return (
    <div className="mt-4 rounded-2xl border border-[#1f48ff]/15 bg-white p-3 sm:p-4">
      <div className="flex items-start gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-[#f0f4ff]">
          <Sparkles size={13} className="text-[#1f48ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#010a4f] leading-snug">
            Whilst we're here — anything else?
          </p>
          <p className="text-[11px] text-[#010a4f]/60 mt-0.5">
            Common {divisionLabel} services that often pair with your menu. One tap to add.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 pl-9">
        {suggestions.map((s, i) => (
          <div
            key={`${s.name}-${i}`}
            className="flex items-start gap-2 rounded-xl border border-[#1f48ff]/15 bg-[#f0f4ff] p-2.5 hover:border-[#1f48ff]/25 transition-colors"
          >
            <button
              onClick={() => onAdd(s)}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={{ background: `${accent}25`, color: accent }}
              title={`Add ${s.name} to your menu`}
            >
              <PlusCircle size={13} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-[#010a4f] leading-snug">{s.name}</p>
              {s.why && (
                <p className="text-[11px] text-[#010a4f]/60 leading-snug mt-0.5">{s.why}</p>
              )}
            </div>
            <button
              onClick={() => onDismiss(s)}
              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[#010a4f]/45 hover:text-[#010a4f] hover:bg-white transition-all"
              title="Not for me"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
