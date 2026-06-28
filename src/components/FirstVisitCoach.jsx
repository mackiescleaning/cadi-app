// FirstVisitCoach — a reusable first-visit coaching panel for tabs that
// were stripped out of the new-user onboarding. When a user opens a tab
// for the first time, this surfaces a focused Cadi-narrated prompt to
// collect the bits we need (logo, biz structure, VAT, team, goals…).
// Once dismissed or completed, it never shows again on that tab.
//
// Completion is persisted as a boolean flag on business_settings.setup_data
// under a per-key path:
//   setup_data.tab_coaches_completed[storageKey] = true
//
// Usage:
//   <FirstVisitCoach
//     storageKey="invoice_logo"
//     title="Make your invoices yours"
//     subtitle="Add your logo so every invoice carries your branding."
//     primaryCta="Save"
//     skipCta="Maybe later"
//     onPrimary={async () => { /* persist the inputs */ }}
//     busy={saving}
//   >
//     {/* form children */}
//   </FirstVisitCoach>

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentUserId } from '../lib/db/authDb';

export default function FirstVisitCoach({
  storageKey,
  title,
  subtitle,
  primaryCta = 'Save',
  skipCta    = 'Skip for now',
  onPrimary,
  busy = false,
  children,
}) {
  const [phase, setPhase] = useState('boot'); // 'boot' | 'show' | 'hidden'
  const [err, setErr]     = useState(null);

  // On mount, check if this coach has already been completed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ownerId = await getCurrentUserId();
        if (!ownerId) { if (!cancelled) setPhase('hidden'); return; }
        const { data } = await supabase
          .from('business_settings')
          .select('setup_data')
          .eq('owner_id', ownerId)
          .maybeSingle();
        const done = data?.setup_data?.tab_coaches_completed?.[storageKey];
        if (cancelled) return;
        setPhase(done ? 'hidden' : 'show');
      } catch {
        if (!cancelled) setPhase('hidden');
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Mark this coach as completed (so future visits don't replay it).
  const markCompleted = async () => {
    try {
      const ownerId = await getCurrentUserId();
      if (!ownerId) return;
      const { data: row } = await supabase
        .from('business_settings')
        .select('setup_data')
        .eq('owner_id', ownerId)
        .maybeSingle();
      const setup = row?.setup_data ?? {};
      const next  = {
        ...setup,
        tab_coaches_completed: {
          ...(setup.tab_coaches_completed ?? {}),
          [storageKey]: true,
        },
      };
      await supabase.from('business_settings').upsert(
        { owner_id: ownerId, setup_data: next },
        { onConflict: 'owner_id' }
      );
    } catch { /* silent — owner can re-trigger if needed */ }
  };

  const dismiss = async () => {
    await markCompleted();
    setPhase('hidden');
  };

  const submit = async () => {
    try {
      if (onPrimary) await onPrimary();
      await markCompleted();
      setPhase('hidden');
    } catch (e) {
      setErr(e?.message ?? "Couldn't save.");
    }
  };

  if (phase !== 'show') return null;

  return (
    <div className="mb-6 rounded-2xl border border-[#1f48ff]/20 bg-white shadow-sm overflow-hidden">
      <div className="relative px-5 py-4 border-b border-[#1f48ff]/15 bg-gradient-to-br from-[#1f48ff]/5 to-white flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#1f48ff]/10 border border-[#1f48ff]/30 flex items-center justify-center shrink-0">
          <Sparkles size={16} className="text-[#1f48ff]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#1f48ff] mb-0.5">Cadi · First-time setup</p>
          <h3 className="text-base font-black text-[#010a4f] leading-tight">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-[#010a4f]/65 mt-0.5 leading-snug">{subtitle}</p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 w-7 h-7 rounded-lg text-[#010a4f]/45 hover:text-[#010a4f] hover:bg-[#f0f4ff] flex items-center justify-center transition-colors"
          title="Skip — you can do this later"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-3">
        {children}
        {err && (
          <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
        )}
      </div>

      <div className="px-5 py-3 border-t border-[#1f48ff]/10 bg-[#f0f4ff]/50 flex items-center justify-end gap-2">
        <button
          onClick={dismiss}
          disabled={busy}
          className="text-[12px] font-bold text-[#010a4f]/55 hover:text-[#010a4f] px-3 py-1.5 rounded-lg hover:bg-white transition-colors disabled:opacity-50"
        >
          {skipCta}
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="text-[12px] font-black text-white bg-[#1f48ff] hover:bg-[#3a5eff] px-4 py-1.5 rounded-lg shadow shadow-[#1f48ff]/20 transition-colors disabled:opacity-50"
        >
          {busy ? 'Saving…' : primaryCta}
        </button>
      </div>
    </div>
  );
}
