// ServiceTemplatePicker.jsx — pick a sub-industry pack, preview the services,
// then apply. Surfaced from the Services empty state and "Quick start" button.

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { SERVICE_TEMPLATE_PACKS, packsByCategory } from '../lib/serviceTemplates';
import { bulkCreateServices } from '../lib/db/servicesDb';
import ModalShell from './ui/ModalShell';

const CATEGORY_LABEL = { residential: 'Residential', exterior: 'Exterior', commercial: 'Commercial' };

function formatPriceLine(s) {
  if (s.pricing_type === 'hourly' && s.price_hourly_rate)  return `£${s.price_hourly_rate}/hr`;
  if (s.pricing_type === 'fixed'  && s.price_fixed_basic)  {
    const tiers = [s.price_fixed_basic, s.price_fixed_standard, s.price_fixed_premium].filter(Boolean);
    return tiers.length > 1 ? `£${Math.min(...tiers)}–£${Math.max(...tiers)}` : `£${tiers[0]}`;
  }
  if (s.pricing_type === 'per_sqm'  && s.price_per_sqm)    return `£${s.price_per_sqm}/m²`;
  if (s.pricing_type === 'per_room' && s.price_per_room)   return `£${s.price_per_room}/room`;
  if (s.pricing_type === 'per_size' && s.pricing_matrix?.length) {
    const prices = s.pricing_matrix.map(r => r.price);
    return `£${Math.min(...prices)}–£${Math.max(...prices)}`;
  }
  return 'Custom quote';
}

export default function ServiceTemplatePicker({ category = null, onClose, onApplied }) {
  const [activeCategory, setActiveCategory] = useState(category || 'residential');
  const [activePackId,   setActivePackId]   = useState(null);
  const [applying,       setApplying]       = useState(false);
  const [error,          setError]          = useState(null);

  const packs = useMemo(() => packsByCategory(activeCategory), [activeCategory]);
  const activePack = useMemo(
    () => SERVICE_TEMPLATE_PACKS.find(p => p.id === activePackId) ?? packs[0],
    [activePackId, packs]
  );

  const handleApply = async () => {
    if (!activePack) return;
    setApplying(true);
    setError(null);
    try {
      const created = await bulkCreateServices(activePack.services);
      onApplied?.({ pack: activePack, count: created.length });
      onClose?.();
    } catch (err) {
      setError(err?.message ?? 'Could not apply the template.');
      setApplying(false);
    }
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Start from a template"
      subtitle="A starter menu you can rename and reprice in seconds."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <button onClick={onClose} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!activePack || applying}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-black shadow-sm flex items-center gap-2"
          >
            {applying ? 'Applying…' : <><Check size={14} /> Add {activePack?.services.length ?? 0} services</>}
          </button>
        </div>
      }
    >
        {/* Category tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50">
          {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
            <button
              key={key}
              onClick={() => { setActiveCategory(key); setActivePackId(null); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                activeCategory === key
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto grid sm:grid-cols-[14rem_1fr]">
          {/* Pack list */}
          <div className="border-r border-slate-100 bg-slate-50/50">
            {packs.length === 0 ? (
              <p className="p-4 text-xs text-slate-400">No packs in this category yet.</p>
            ) : packs.map(pack => {
              const picked = activePack?.id === pack.id;
              return (
                <button
                  key={pack.id}
                  onClick={() => setActivePackId(pack.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                    picked ? 'bg-white border-l-2 border-l-blue-600' : 'hover:bg-slate-100/60'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg shrink-0">{pack.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${picked ? 'text-blue-700' : 'text-slate-800'} truncate`}>{pack.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{pack.blurb}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview */}
          <div className="p-4">
            {!activePack ? (
              <p className="text-xs text-slate-400">Pick a pack to preview the services.</p>
            ) : (
              <>
                <div className="mb-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">{activePack.services.length} services</p>
                  <p className="text-sm font-semibold text-slate-700">{activePack.blurb}</p>
                </div>
                <ul className="space-y-2">
                  {activePack.services.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:border-blue-200 transition-colors">
                      <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center text-[11px] font-black shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900">{s.name}</p>
                        {s.description_included && (
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{s.description_included}</p>
                        )}
                      </div>
                      <span className="text-xs font-black text-emerald-600 tabular-nums shrink-0">{formatPriceLine(s)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-slate-400 mt-3">
                  Prices are sensible UK 2026 defaults — edit any of them after applying.
                </p>
              </>
            )}
          </div>
        </div>

        {error && <p className="px-5 py-2 text-xs font-semibold text-red-600 bg-red-50 border-t border-red-200">{error}</p>}
    </ModalShell>
  );
}
