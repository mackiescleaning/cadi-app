import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { calculateQuote } from '../lib/pricingEngine';
import { Play, Check, Edit2, AlertTriangle, ChevronDown, Clock, Info } from 'lucide-react';

const ALL_SERVICES = [
  { key: 'regular_clean',         label: 'Regular home clean',         cat: 'residential' },
  { key: 'deep_clean',            label: 'Deep clean',                  cat: 'residential' },
  { key: 'end_of_tenancy_clean',  label: 'End of tenancy clean',        cat: 'residential' },
  { key: 'spring_clean',          label: 'Spring clean',                cat: 'residential' },
  { key: 'post_renovation_clean', label: 'Post-renovation clean',       cat: 'residential' },
  { key: 'one_off_clean',         label: 'One-off clean',               cat: 'residential' },
  { key: 'softwash_render',       label: 'Softwash / render clean',     cat: 'exterior' },
  { key: 'driveway_clean',        label: 'Driveway / pressure wash',    cat: 'exterior' },
  { key: 'patio_clean',           label: 'Patio clean',                 cat: 'exterior' },
  { key: 'gutter_clean',          label: 'Gutter clean',                cat: 'exterior' },
  { key: 'window_clean_exterior', label: 'Window clean (exterior)',      cat: 'exterior' },
  { key: 'fascia_soffit_clean',   label: 'Fascia & soffit clean',       cat: 'exterior' },
  { key: 'roof_clean',            label: 'Roof clean / moss treatment', cat: 'exterior' },
  { key: 'decking_clean',         label: 'Decking clean',               cat: 'exterior' },
  { key: 'garden_furniture_clean',label: 'Garden furniture clean',      cat: 'exterior' },
  { key: 'office_clean',          label: 'Office clean',                cat: 'commercial' },
  { key: 'school_clean',          label: 'School clean',                cat: 'commercial' },
  { key: 'retail_clean',          label: 'Retail clean',                cat: 'commercial' },
  { key: 'medical_clean',         label: 'Medical / dental clean',      cat: 'commercial' },
  { key: 'industrial_clean',      label: 'Industrial clean',            cat: 'commercial' },
  { key: 'communal_areas_clean',  label: 'Communal areas',              cat: 'commercial' },
  { key: 'washroom_service',      label: 'Washroom service',            cat: 'commercial' },
];

const FREQUENCIES = [
  { value: 'weekly',      label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'four_weekly', label: 'Every 4 weeks' },
  { value: 'monthly',     label: 'Monthly' },
  { value: 'one_off',     label: 'One-off' },
];

const CONFIDENCE_CONFIG = {
  high:           { label: 'Exact price',     bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-400' },
  medium:         { label: 'Estimated',        bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-400' },
  low:            { label: 'Approximate',      bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400'   },
  route_to_human: { label: 'Needs site visit', bg: 'bg-[#010a4f]/5', text: 'text-[#010a4f]', dot: 'bg-[#1f48ff]' },
};

function SelectInput({ value, onChange, children }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm bg-white focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 pr-8"
      >
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function NumInput({ value, onChange, placeholder, min = 0 }) {
  return (
    <input
      type="number"
      min={min}
      step="1"
      value={value}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20"
    />
  );
}

function Label({ children }) {
  return <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{children}</p>;
}

export default function PricingSandbox({ businessId }) {
  const [serviceKey, setServiceKey] = useState('regular_clean');
  const [bedrooms, setBedrooms]     = useState(3);
  const [bathrooms, setBathrooms]   = useState('');
  const [sqm, setSqm]               = useState('');
  const [frequency, setFrequency]   = useState('fortnightly');
  const [postcode, setPostcode]     = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState([]);

  const [rule, setRule]     = useState(null);
  const [addons, setAddons] = useState([]);
  const [result, setResult] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loadingRule, setLoadingRule] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);

  const loadRule = useCallback(async (svcKey) => {
    if (!businessId) return;
    setLoadingRule(true);
    setResult(null);
    setFeedback(null);
    setHasCalculated(false);
    setSelectedAddonIds([]);

    const [{ data: ruleData }, { data: addonData }] = await Promise.all([
      supabase
        .from('pricing_rules')
        .select('*')
        .eq('business_id', businessId)
        .eq('service', svcKey)
        .eq('status', 'active')
        .single(),
      supabase
        .from('pricing_addons')
        .select('*')
        .eq('business_id', businessId)
        .eq('service', svcKey)
        .eq('active', true)
        .order('display_order'),
    ]);

    setRule(ruleData ?? null);
    setAddons(addonData ?? []);
    setLoadingRule(false);
  }, [businessId]);

  useEffect(() => { loadRule(serviceKey); }, [serviceKey, loadRule]);

  const handleCalculate = () => {
    if (!rule) return;
    const input = {
      property: {
        bedrooms:  bedrooms  !== '' ? Number(bedrooms)  : undefined,
        bathrooms: bathrooms !== '' ? Number(bathrooms) : undefined,
        sqm:       sqm       !== '' ? Number(sqm)       : undefined,
      },
      frequency,
      postcode,
      addons: selectedAddonIds,
    };
    const q = calculateQuote(rule, input, addons);
    setResult(q);
    setFeedback(null);
    setHasCalculated(true);
  };

  const toggleAddon = (id) => {
    setSelectedAddonIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
    setHasCalculated(false);
  };

  const conf = result ? (CONFIDENCE_CONFIG[result.confidence] ?? CONFIDENCE_CONFIG.low) : null;

  const selectedService = ALL_SERVICES.find(s => s.key === serviceKey);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

      {/* ── LEFT: Scenario builder ── */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 space-y-4">
          <h3 className="font-bold text-[#010a4f] text-sm">Scenario</h3>

          {/* Service */}
          <div>
            <Label>Service</Label>
            <SelectInput value={serviceKey} onChange={v => { setServiceKey(v); setHasCalculated(false); }}>
              <optgroup label="Residential">
                {ALL_SERVICES.filter(s => s.cat === 'residential').map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="Exterior">
                {ALL_SERVICES.filter(s => s.cat === 'exterior').map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
              <optgroup label="Commercial">
                {ALL_SERVICES.filter(s => s.cat === 'commercial').map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </optgroup>
            </SelectInput>

            {loadingRule && (
              <p className="text-xs text-gray-400 mt-1.5">Loading rule…</p>
            )}
            {!loadingRule && !rule && (
              <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1.5">
                <AlertTriangle size={11} />
                No pricing rule configured for this service
              </p>
            )}
            {!loadingRule && rule && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1.5">
                <Check size={11} />
                Rule loaded · {rule.pricing_method?.replace(/_/g, ' ')}
              </p>
            )}
          </div>

          {/* Property */}
          <div>
            <Label>Property</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Bedrooms</p>
                <NumInput value={bedrooms} onChange={v => { setBedrooms(v); setHasCalculated(false); }} placeholder="e.g. 3" min={1} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">Bathrooms</p>
                <NumInput value={bathrooms} onChange={v => { setBathrooms(v); setHasCalculated(false); }} placeholder="optional" min={1} />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-1">m²</p>
                <NumInput value={sqm} onChange={v => { setSqm(v); setHasCalculated(false); }} placeholder="optional" min={1} />
              </div>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <Label>Frequency</Label>
            <SelectInput value={frequency} onChange={v => { setFrequency(v); setHasCalculated(false); }}>
              {FREQUENCIES.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </SelectInput>
          </div>

          {/* Postcode */}
          <div>
            <Label>Postcode district</Label>
            <input
              type="text"
              value={postcode}
              onChange={e => { setPostcode(e.target.value); setHasCalculated(false); }}
              placeholder="e.g. CF10 or SW1A"
              className="w-full px-3 py-2.5 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20 uppercase"
            />
            <p className="text-[10px] text-gray-400 mt-1">Leave blank to skip postcode tier check</p>
          </div>
        </div>

        {/* Add-ons */}
        {addons.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
            <h3 className="font-bold text-[#010a4f] text-sm mb-3">Add-ons</h3>
            <div className="space-y-2">
              {addons.map(addon => (
                <label key={addon.id} className="flex items-center justify-between gap-3 cursor-pointer group">
                  <div className="flex items-center gap-2.5">
                    <div
                      onClick={() => toggleAddon(addon.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 cursor-pointer ${
                        selectedAddonIds.includes(addon.id)
                          ? 'bg-[#1f48ff] border-[#1f48ff]'
                          : 'border-gray-300 bg-white group-hover:border-[#1f48ff]/50'
                      }`}
                    >
                      {selectedAddonIds.includes(addon.id) && <Check size={10} className="text-white" />}
                    </div>
                    <span className="text-sm text-[#010a4f]">{addon.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600 shrink-0">+£{addon.price}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Calculate button */}
        <button
          onClick={handleCalculate}
          disabled={!rule || loadingRule}
          className="w-full py-3.5 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#1f48ff]/20"
        >
          <Play size={14} fill="white" />
          Calculate quote
        </button>
      </div>

      {/* ── RIGHT: Result ── */}
      <div className="space-y-5">
        {!hasCalculated ? (
          <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-8 flex flex-col items-center justify-center text-center min-h-[300px]">
            <div className="w-12 h-12 rounded-2xl bg-[#f0f4ff] flex items-center justify-center mb-4">
              <Play size={20} className="text-[#1f48ff]" />
            </div>
            <p className="text-sm font-semibold text-[#010a4f] mb-1">Ready to test</p>
            <p className="text-xs text-gray-400">
              {rule
                ? `Configure a scenario and click Calculate`
                : `Configure pricing for ${selectedService?.label ?? 'this service'} first`}
            </p>
          </div>
        ) : result?.confidence === 'route_to_human' ? (
          <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#010a4f]/5 flex items-center justify-center flex-shrink-0">
                <Info size={18} className="text-[#1f48ff]" />
              </div>
              <div>
                <p className="font-bold text-[#010a4f] text-sm">Needs site visit</p>
                <p className="text-xs text-gray-500 mt-0.5">{result.confidence_reason}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
              Front Desk will route this enquiry to you for a manual quote or site visit booking.
            </p>
          </div>
        ) : result ? (
          <>
            {/* Price card */}
            <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-4xl font-black text-[#010a4f]">£{result.price?.toFixed(2)}</p>
                  {result.base_price !== result.price && (
                    <p className="text-xs text-gray-400 mt-0.5">Base: £{result.base_price?.toFixed(2)}</p>
                  )}
                </div>
                {conf && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${conf.bg} ${conf.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
                    {conf.label}
                  </span>
                )}
              </div>

              {result.duration_minutes && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-4">
                  <Clock size={12} />
                  Estimated duration: {result.duration_minutes >= 60
                    ? `${Math.floor(result.duration_minutes / 60)}h ${result.duration_minutes % 60 > 0 ? `${result.duration_minutes % 60}m` : ''}`
                    : `${result.duration_minutes}m`}
                </div>
              )}

              {result.confidence_reason && (
                <p className="text-xs text-gray-400 mb-4">{result.confidence_reason}</p>
              )}

              {/* Breakdown */}
              {result.breakdown?.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Breakdown</p>
                  <div className="space-y-1.5">
                    {result.breakdown.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{item.label}</span>
                        <span className={`font-semibold tabular-nums ${
                          item.amount < 0 ? 'text-green-600' : 'text-[#010a4f]'
                        }`}>
                          {item.amount >= 0 ? `£${item.amount.toFixed(2)}` : `-£${Math.abs(item.amount).toFixed(2)}`}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs border-t border-gray-100 pt-1.5 mt-1.5">
                      <span className="font-bold text-[#010a4f]">Total</span>
                      <span className="font-black text-[#010a4f] tabular-nums">£{result.price?.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {result.warnings?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertTriangle size={11} />
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Addon options available */}
            {result.addon_options?.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Add-ons Front Desk will offer
                </p>
                <div className="space-y-1">
                  {result.addon_options.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{a.name}</span>
                      <span className="text-gray-500 tabular-nums">+£{a.price}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Feedback */}
            <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-500 mb-3">Does this price look right?</p>
              {feedback ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check size={14} />
                  <span>Thanks for the feedback</span>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setFeedback('good')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors border border-green-200"
                  >
                    <Check size={12} />
                    Spot on
                  </button>
                  <button
                    onClick={() => setFeedback('high')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
                  >
                    <Edit2 size={12} />
                    Too high
                  </button>
                  <button
                    onClick={() => setFeedback('low')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
                  >
                    <Edit2 size={12} />
                    Too low
                  </button>
                  <button
                    onClick={() => setFeedback('wrong')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <AlertTriangle size={12} />
                    Way off
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
