/**
 * SurveyIntroModal.jsx
 * First-run intro + skippable 3-question primer for the commercial survey tool.
 *
 * Props:
 *   onComplete(defaults) — called when primer is finished OR skipped.
 *   existingDefaults     — pre-fill if user had previously set some values.
 */

import { useState } from 'react';

const HEIGHT_METHODS = [
  { value: 'water_fed_pole', label: 'Water-fed pole',      desc: 'Ground-level reach — no height equipment needed' },
  { value: 'mewp',          label: 'MEWP / cherry picker', desc: 'Collective protection, Reg 6 preferred tier' },
  { value: 'tower',         label: 'Tower scaffold',        desc: 'Collective protection, planned erection required' },
  { value: 'ladders',       label: 'Ladders',               desc: 'Last resort — requires short-duration justification' },
];

const ACCREDITATIONS = [
  { value: 'chas',             label: 'CHAS'             },
  { value: 'safecontractor',   label: 'SafeContractor'   },
  { value: 'constructionline', label: 'Constructionline' },
  { value: 'smas',             label: 'SMAS Worksafe'    },
];

const WORK_TYPES = [
  { value: 'recurring_contract', label: 'Recurring contracts',   desc: 'Ongoing scheduled cleans — commercial premises' },
  { value: 'one_off_exterior',   label: 'One-off exterior work', desc: 'Jet washing, gutters, windows — project jobs' },
  { value: 'mixed',              label: 'Mix of both',           desc: 'Both contract and one-off work' },
];

export default function SurveyIntroModal({ onComplete, existingDefaults = null }) {
  const [step, setStep] = useState('intro'); // intro | primer | done

  // Primer state
  const [heightMethod, setHeightMethod]   = useState(existingDefaults?.default_height_method ?? null);
  const [accreds, setAccreds]             = useState(existingDefaults?.accreditations ?? []);
  const [workType, setWorkType]           = useState(existingDefaults?.typical_commercial_work ?? null);

  const toggleAccred = (v) => {
    setAccreds(prev => prev.includes(v) ? prev.filter(a => a !== v) : [...prev, v]);
  };

  const handleSkip = () => {
    onComplete({ primer_completed: false });
  };

  const handlePrimerDone = () => {
    onComplete({
      default_height_method:     heightMethod,
      accreditations:            accreds,
      typical_commercial_work:   workType,
      primer_completed:          true,
    });
  };

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[#010a4f]/90 backdrop-blur-sm" />
        <div
          className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'linear-gradient(160deg, #0d1e78 0%, #05124a 60%, #010a4f 100%)' }}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
          <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#1f48ff]/15 blur-3xl pointer-events-none" />

          <div className="relative px-6 py-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1f48ff]/20 border border-[#1f48ff]/30 mb-5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-[#99c5ff] tracking-wide uppercase">Commercial surveys</span>
            </div>

            <h2 className="text-2xl font-black text-white leading-tight mb-3">
              This gets sharper every job you do.
            </h2>

            <p className="text-sm text-[rgba(153,197,255,0.8)] leading-relaxed mb-4">
              Cadi's commercial survey tool helps you win work and price it right — using data
              from your own jobs, not guesswork. Every survey you run teaches it your site conditions,
              your crew, your kit.
            </p>

            <p className="text-sm text-[rgba(153,197,255,0.65)] leading-relaxed mb-6">
              On site: capture raw notes, photos, voice. Cadi reads it back, asks only about
              the things you can't recover once you leave, and makes sure you haven't missed
              anything that'll bite you later. Back at the desk: structured quote, cleaning plan,
              and an onboarding pack for your customer — all in one flow.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('primer')}
                className="flex-1 h-11 rounded-xl bg-[#1f48ff] hover:bg-[#2a55ff] text-white text-sm font-bold transition-colors"
              >
                Set my defaults — takes 30 seconds
              </button>
              <button
                onClick={handleSkip}
                className="h-11 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-[rgba(153,197,255,0.6)] hover:text-[#99c5ff] text-sm font-medium transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-[#010a4f]/90 backdrop-blur-sm" onClick={handleSkip} />
      <div
        className="relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-auto"
        style={{ background: 'linear-gradient(160deg, #0d1e78 0%, #05124a 60%, #010a4f 100%)' }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />

        <div className="relative px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <p className="text-xs font-bold tracking-widest uppercase text-[rgba(153,197,255,0.5)]">
              Quick setup — 3 questions
            </p>
            <button
              onClick={handleSkip}
              className="text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.8)] text-xs transition-colors"
            >
              Skip for now
            </button>
          </div>

          {/* Q1: Default height method */}
          <div className="mb-6">
            <p className="text-sm font-bold text-white mb-3">
              1. When working at height, what's your first-choice method?
            </p>
            <div className="space-y-2">
              {HEIGHT_METHODS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setHeightMethod(m.value)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    heightMethod === m.value
                      ? 'bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white'
                      : 'bg-white/5 border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.25)]'
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    heightMethod === m.value ? 'border-[#99c5ff] bg-[#1f48ff]' : 'border-[rgba(153,197,255,0.3)]'
                  }`}>
                    {heightMethod === m.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{m.label}</p>
                    <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Q2: Accreditations */}
          <div className="mb-6">
            <p className="text-sm font-bold text-white mb-1">
              2. Which accreditations do you hold?
            </p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mb-3">Select all that apply. None yet is fine.</p>
            <div className="flex flex-wrap gap-2">
              {ACCREDITATIONS.map(a => (
                <button
                  key={a.value}
                  onClick={() => toggleAccred(a.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    accreds.includes(a.value)
                      ? 'bg-[#1f48ff]/20 border-[#1f48ff]/50 text-[#99c5ff]'
                      : 'bg-white/5 border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.25)]'
                  }`}
                >
                  {accreds.includes(a.value) ? '✓ ' : ''}{a.label}
                </button>
              ))}
              <button
                onClick={() => setAccreds([])}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  accreds.length === 0
                    ? 'bg-white/10 border-[rgba(153,197,255,0.3)] text-white'
                    : 'bg-white/5 border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.25)]'
                }`}
              >
                None yet
              </button>
            </div>
          </div>

          {/* Q3: Typical work */}
          <div className="mb-6">
            <p className="text-sm font-bold text-white mb-3">
              3. What's the majority of your commercial work?
            </p>
            <div className="space-y-2">
              {WORK_TYPES.map(w => (
                <button
                  key={w.value}
                  onClick={() => setWorkType(w.value)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                    workType === w.value
                      ? 'bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white'
                      : 'bg-white/5 border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.25)]'
                  }`}
                >
                  <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    workType === w.value ? 'border-[#99c5ff] bg-[#1f48ff]' : 'border-[rgba(153,197,255,0.3)]'
                  }`}>
                    {workType === w.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{w.label}</p>
                    <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{w.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handlePrimerDone}
            className="w-full h-11 rounded-xl bg-[#1f48ff] hover:bg-[#2a55ff] text-white text-sm font-bold transition-colors"
          >
            Save defaults and start
          </button>
        </div>
      </div>
    </div>
  );
}
