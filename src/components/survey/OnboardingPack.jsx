/**
 * OnboardingPack.jsx
 * Pack assembly + sign-off UI for the commercial onboarding pack.
 *
 * Props:
 *   survey   — site_surveys row
 *   quote    — quotes row
 *   pack     — onboarding_packs row (with pack_components)
 *   onPackCreated  — (pack) => void  (if pack is null, creates it first)
 *   onSigned       — (pack) => void
 */

import { useState } from 'react';
import { createPack, getPack, signOffPack } from '../../lib/db/surveyDb';
import { supabase } from '../../lib/supabase';

const KIND_ICONS = {
  credential: '🏅',
  rams: '⚠',
  coshh: '🧪',
  welcome: '✉',
  method_statement: '📋',
};

const SOURCE_LABELS = {
  settings: 'From settings',
  generated: 'AI-generated — review before signing',
  sds: 'SDS upload required',
  staff_training: 'Staff training records',
};

function ComponentRow({ component }) {
  const [open, setOpen] = useState(false);
  const text = component.content?.text;
  const awaitingUpload = component.content?.status === 'awaiting_upload';

  return (
    <div className="border-b border-[rgba(153,197,255,0.06)] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-base mt-0.5 shrink-0">{KIND_ICONS[component.kind] ?? '📄'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{component.title}</p>
          <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">
            {SOURCE_LABELS[component.source] ?? component.source}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {awaitingUpload && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Upload needed
            </span>
          )}
          {text && !awaitingUpload && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              Ready
            </span>
          )}
          <span
            className={`text-xs text-[rgba(153,197,255,0.4)] transition-transform ${open ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {text ? (
            <pre className="whitespace-pre-wrap text-xs text-[rgba(153,197,255,0.7)] bg-[rgba(0,0,0,0.2)] rounded-lg p-3 max-h-64 overflow-y-auto leading-relaxed font-mono">
              {text}
            </pre>
          ) : awaitingUpload ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
              <span className="text-amber-400 text-xs">
                Upload the document in Settings → Compliance documents to include in this pack.
              </span>
            </div>
          ) : (
            <p className="text-xs text-[rgba(153,197,255,0.4)]">No content yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function OnboardingPack({
  survey,
  quote,
  pack: initialPack,
  onPackCreated,
  onSigned,
}) {
  const [pack, setPack] = useState(initialPack);
  const [assembling, setAssembling] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleAssemble = async () => {
    setAssembling(true);
    try {
      let currentPack = pack;

      // Create pack if not yet created
      if (!currentPack) {
        const plan = quote?.cleaning_plan ?? {};
        const contractType = plan.type === 'one_off' ? 'one_off' : 'contract';
        currentPack = await createPack({
          customerId: survey.customer_id,
          surveyId: survey.id,
          quoteId: quote?.id ?? null,
          contractType,
        });
        setPack(currentPack);
        onPackCreated?.(currentPack);
      }

      // Call pack-assembly edge function
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('pack-assembly', {
        body: { pack_id: currentPack.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw new Error(res.error.message ?? 'Assembly failed');

      // Reload pack with components
      const fresh = await getPack(currentPack.id);
      setPack(fresh);
    } catch (err) {
      alert(`Assembly failed: ${err.message}`);
    } finally {
      setAssembling(false);
    }
  };

  const handleSignOff = async () => {
    if (!pack) return;
    setSigning(true);
    try {
      const updated = await signOffPack(pack.id);
      setPack((prev) => ({ ...prev, ...updated }));
      onSigned?.(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setSigning(false);
    }
  };

  const components = pack?.pack_components ?? [];
  const readyCount = components.filter(
    (c) => c.content?.text || c.content?.status !== 'awaiting_upload'
  ).length;

  if (!pack || pack.status === 'assembling') {
    return (
      <div className="flex flex-col gap-4">
        <div className="p-5 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.03)] text-center">
          <p className="text-2xl mb-3">📋</p>
          <p className="text-white font-bold mb-1">Onboarding pack</p>
          <p className="text-xs text-[rgba(153,197,255,0.55)] mb-4 max-w-xs mx-auto">
            Cadi will assemble RAMS, welcome letter, and credential slots from your survey data and
            business settings.
          </p>
          <button
            onClick={handleAssemble}
            disabled={assembling}
            className="h-11 px-6 rounded-xl bg-[#1f48ff] hover:bg-[#2a55ff] disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
          >
            {assembling ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Assembling…
              </>
            ) : (
              'Assemble pack'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Status header */}
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.03)]">
        <div>
          <p className="text-xs font-bold text-[rgba(153,197,255,0.5)]">Onboarding pack</p>
          <p className="text-sm text-white mt-0.5 capitalize">{pack.status.replace('_', ' ')}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Components</p>
          <p className="text-sm font-bold text-white">
            {readyCount}/{components.length} ready
          </p>
        </div>
      </div>

      {/* Components */}
      {components.length > 0 && (
        <div className="rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.03)] overflow-hidden">
          {components
            .sort((a, b) => a.sort - b.sort)
            .map((c) => (
              <ComponentRow key={c.id} component={c} />
            ))}
        </div>
      )}

      {/* Crew cert warnings — shown via agent_actions; placeholder for now */}
      <div className="px-4 py-3 rounded-xl bg-amber-500/8 border border-amber-500/15">
        <p className="text-xs font-bold text-amber-400 mb-1">Crew certification</p>
        <p className="text-xs text-amber-300/70">
          Check Operations Manager for any certification expiry alerts on proposed crew before
          signing off.
        </p>
      </div>

      {/* Sign-off */}
      {pack.status === 'awaiting_signoff' && (
        <div className="p-4 rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(255,255,255,0.03)]">
          <p className="text-sm font-bold text-white mb-1">Competent person sign-off</p>
          <p className="text-xs text-[rgba(153,197,255,0.55)] mb-4">
            By signing off this pack you confirm, as the competent person, that the RAMS is
            accurate, the hazards are complete, and all credentials are current. You are responsible
            for this assessment.
          </p>
          <button
            onClick={handleSignOff}
            disabled={signing}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {signing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing off…
              </>
            ) : (
              'I confirm — sign off and issue pack'
            )}
          </button>
        </div>
      )}

      {pack.status === 'issued' && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="text-emerald-400 text-lg shrink-0">✓</span>
          <div>
            <p className="text-sm font-bold text-emerald-300">Pack issued</p>
            {pack.signed_off_at && (
              <p className="text-xs text-emerald-400/70">
                Signed off{' '}
                {new Date(pack.signed_off_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Re-assemble */}
      {pack.status !== 'issued' && (
        <button
          onClick={handleAssemble}
          disabled={assembling}
          className="text-xs text-[rgba(153,197,255,0.4)] hover:text-[#99c5ff] transition-colors text-center disabled:opacity-40"
        >
          {assembling ? 'Reassembling…' : 'Regenerate pack'}
        </button>
      )}
    </div>
  );
}
