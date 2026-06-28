// Step 1 — "What does your business do?"
// Multi-select cards. Glow border on selection. Mobile-first.

import { useState } from 'react';
import { SECTORS } from '../Services';
import { updateDivisions, updateStep } from '../../lib/db/onboardingDb';

const DIVISIONS = [
  { key: 'residential', label: 'Residential', blurb: 'Home cleans, deep cleans, end-of-tenancy.' },
  { key: 'exterior',    label: 'Exterior',    blurb: 'Windows, gutters, jet washing, render.' },
  { key: 'commercial',  label: 'Commercial',  blurb: 'Offices, retail, contracts, hospitality.' },
];

export default function StepDivisions({ session, onAdvance }) {
  const [picked, setPicked] = useState(new Set(session?.divisions ?? []));
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const toggle = (key) => {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const next = async () => {
    if (picked.size === 0) { setError('Pick at least one. You can change this later.'); return; }
    setSaving(true);
    setError(null);
    try {
      await updateDivisions(session.id, [...picked]);
      await updateStep(session.id, 'upload');
      onAdvance({ ...session, divisions: [...picked], step: 'upload' });
    } catch (e) {
      setError(e?.message ?? 'Something went wrong saving that. Try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-8 sm:py-14">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1f48ff] mb-3">Step 1 of 5</p>
          <h1 className="text-2xl sm:text-3xl font-black text-[#010a4f] mb-2 leading-tight">
            What does your business do?
          </h1>
          <p className="text-sm text-[#010a4f]/60 max-w-md mx-auto">
            Pick all that apply. I'll sort everything else.
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {DIVISIONS.map(d => {
            const sector = SECTORS[d.key];
            const isPicked = picked.has(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggle(d.key)}
                aria-pressed={isPicked}
                className={`group w-full text-left rounded-2xl border transition-all p-4 sm:p-5 ${
                  isPicked
                    ? 'border-transparent shadow-2xl'
                    : 'bg-white border-[#1f48ff]/15 hover:border-[#1f48ff]/30'
                }`}
                style={
                  isPicked
                    ? {
                        background: `linear-gradient(135deg, ${sector.accent}25 0%, ${sector.accent}10 100%)`,
                        boxShadow:  `0 0 0 1px ${sector.accent}, 0 12px 32px -8px ${sector.accent}55`,
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{
                      background:  `${sector.accent}22`,
                      border:      `1px solid ${sector.accent}44`,
                    }}
                  >
                    {sector.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base sm:text-lg font-black leading-tight ${isPicked ? 'text-[#010a4f]' : 'text-[#010a4f]'}`}>
                      {d.label}
                    </p>
                    <p className={`text-xs sm:text-sm leading-snug mt-0.5 ${isPicked ? 'text-[#010a4f]/75' : 'text-[#010a4f]/60'}`}>
                      {d.blurb}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                      isPicked ? 'border-white bg-white' : 'border-[#1f48ff]/30'
                    }`}
                    style={isPicked ? { color: sector.accent } : {}}
                  >
                    {isPicked && <span className="text-sm font-black leading-none">✓</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={next}
          disabled={saving || picked.size === 0}
          className="w-full py-3.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black shadow-lg shadow-[#1f48ff]/25 transition-all"
        >
          {saving ? 'Saving…' : `Continue with ${picked.size || 'nothing yet'} →`}
        </button>
      </div>
    </div>
  );
}
