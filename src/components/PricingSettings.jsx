import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusinessId } from '../hooks/useBusinessId';
import { calculateQuote } from '../lib/pricingEngine';
import PricingSandbox from './PricingSandbox';
import PricingConversation from './PricingConversation';
import {
  ChevronRight, Plus, Trash2, Save, Check,
  Settings, AlertCircle, Tag, Clock, FlaskConical, MessageSquare
} from 'lucide-react';

// ─── Static data ──────────────────────────────────────────────────────────────

const SERVICES = {
  residential: [
    { key: 'regular_clean',         label: 'Regular home clean' },
    { key: 'deep_clean',            label: 'Deep clean' },
    { key: 'end_of_tenancy_clean',  label: 'End of tenancy clean' },
    { key: 'spring_clean',          label: 'Spring clean' },
    { key: 'post_renovation_clean', label: 'Post-renovation clean' },
    { key: 'one_off_clean',         label: 'One-off clean' },
  ],
  exterior: [
    { key: 'softwash_render',       label: 'Softwash / render clean' },
    { key: 'driveway_clean',        label: 'Driveway / pressure wash' },
    { key: 'patio_clean',           label: 'Patio clean' },
    { key: 'gutter_clean',          label: 'Gutter clean' },
    { key: 'window_clean_exterior', label: 'Window clean (exterior)' },
    { key: 'fascia_soffit_clean',   label: 'Fascia & soffit clean' },
    { key: 'roof_clean',            label: 'Roof clean / moss treatment' },
    { key: 'decking_clean',         label: 'Decking clean' },
    { key: 'garden_furniture_clean',label: 'Garden furniture clean' },
  ],
  commercial: [
    { key: 'office_clean',          label: 'Office clean' },
    { key: 'school_clean',          label: 'School clean' },
    { key: 'retail_clean',          label: 'Retail clean' },
    { key: 'medical_clean',         label: 'Medical / dental clean' },
    { key: 'industrial_clean',      label: 'Industrial clean' },
    { key: 'communal_areas_clean',  label: 'Communal areas' },
    { key: 'washroom_service',      label: 'Washroom service' },
  ],
};

const METHOD_META = {
  per_bedroom:           { label: 'Per bedroom',              desc: 'Price based on number of bedrooms. Best for residential.' },
  per_bedroom_bathroom:  { label: 'Bedroom + bathroom',       desc: 'Base price plus per-bedroom and per-bathroom rates.' },
  per_sqm:               { label: 'Per square metre',         desc: 'Rate per m². Best for driveways, patios, renders.' },
  per_hour:              { label: 'Per hour',                  desc: 'Hourly rate × estimated hours for the job size.' },
  flat_rate_by_size:     { label: 'Flat rate by size',        desc: 'Fixed prices for small / medium / large / extra-large.' },
  flat_rate_fixed:       { label: 'Fixed price',              desc: 'One price for this service, no variation.' },
  site_visit_required:   { label: 'Site visit required',      desc: 'No quote in chat — Front Desk books a visit instead.' },
};

const RESIDENTIAL_METHODS = ['per_bedroom', 'per_bedroom_bathroom', 'per_hour', 'flat_rate_fixed'];
const EXTERIOR_METHODS     = ['per_sqm', 'flat_rate_by_size', 'flat_rate_fixed', 'per_hour'];
const COMMERCIAL_METHODS   = ['site_visit_required'];

const DEFAULT_FREQ_MODIFIERS = {
  weekly: 0.90, fortnightly: 1.00, four_weekly: 1.05, monthly: 1.05, one_off: 1.25,
};

const DEFAULT_BASE: Record<string, object> = {
  per_bedroom:          { '1': '', '2': '', '3': '', '4': '', '5': '', '6_plus_per_extra': '' },
  per_bedroom_bathroom: { base: '', per_bedroom: '', per_bathroom: '' },
  per_sqm:              { rate_per_sqm: '', tiered_rates: [] },
  per_hour:             { hourly_rate: '', estimated_hours_by_size: { '1_bed': '', '2_bed': '', '3_bed': '', '4_bed': '', '5_bed': '' } },
  flat_rate_by_size:    {
    small:       { description: 'Up to 30m²',  price: '', max_sqm: 30 },
    medium:      { description: '30–80m²',     price: '', max_sqm: 80 },
    large:       { description: '80–150m²',    price: '', max_sqm: 150 },
    extra_large: { description: '150m²+',      price: '', max_sqm: null },
  },
  flat_rate_fixed:      { price: '' },
  site_visit_required:  {},
};

const ADDON_DEFAULTS: Record<string, { name: string; price: number; duration_minutes_added: number | null }[]> = {
  regular_clean:        [
    { name: 'Inside the oven',    price: 25, duration_minutes_added: 30 },
    { name: 'Inside the fridge',  price: 15, duration_minutes_added: 15 },
    { name: 'Inside microwave',   price: 10, duration_minutes_added: 10 },
    { name: 'Inside windows',     price: 30, duration_minutes_added: 30 },
    { name: 'Ironing',            price: 20, duration_minutes_added: 60 },
    { name: 'Change bed linen',   price: 10, duration_minutes_added: 15 },
  ],
  deep_clean:           [
    { name: 'Inside the oven',    price: 25, duration_minutes_added: 30 },
    { name: 'Inside the fridge',  price: 15, duration_minutes_added: 15 },
    { name: 'Inside windows',     price: 30, duration_minutes_added: 30 },
    { name: 'Carpet cleaning',    price: 50, duration_minutes_added: 60 },
  ],
  end_of_tenancy_clean: [
    { name: 'Carpet cleaning',    price: 50, duration_minutes_added: 60 },
    { name: 'Oven steam clean',   price: 35, duration_minutes_added: 45 },
    { name: 'Descaling',          price: 20, duration_minutes_added: 20 },
  ],
  softwash_render:      [
    { name: 'Moss biocide treatment', price: 40, duration_minutes_added: 30 },
    { name: 'Render seal',            price: 60, duration_minutes_added: 60 },
  ],
  driveway_clean:       [
    { name: 'Re-sanding joints',      price: 35, duration_minutes_added: 45 },
    { name: 'Driveway sealant',       price: 80, duration_minutes_added: 60 },
  ],
  gutter_clean:         [
    { name: 'Fascia & soffit clean',  price: 30, duration_minutes_added: 30 },
    { name: 'Downpipe unblock',       price: 25, duration_minutes_added: 20 },
  ],
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({ label, children, hint }) {
  return (
    <div className="flex items-start gap-4">
      <label className="w-36 shrink-0 text-sm font-medium text-[#010a4f] pt-2">{label}</label>
      <div className="flex-1">
        {children}
        {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function NumInput({ value, onChange, placeholder = '0', prefix = '£', suffix }) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-24 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/20"
      />
      {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
    </div>
  );
}

// ─── Base amounts editors ─────────────────────────────────────────────────────

function PerBedroomEditor({ value, onChange }) {
  const beds = ['1', '2', '3', '4', '5'];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {beds.map(b => (
          <div key={b} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-600 w-16">{b} bed</span>
            <NumInput
              value={value[b] ?? ''}
              onChange={v => onChange({ ...value, [b]: v })}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        <span className="text-sm font-medium text-gray-600 w-16">6+ bed<br />(per extra)</span>
        <NumInput
          value={value['6_plus_per_extra'] ?? ''}
          onChange={v => onChange({ ...value, '6_plus_per_extra': v })}
          placeholder="15"
        />
      </div>
    </div>
  );
}

function PerBedroomBathroomEditor({ value, onChange }) {
  return (
    <div className="space-y-2">
      {[
        { key: 'base',         label: 'Base price' },
        { key: 'per_bedroom',  label: 'Per bedroom' },
        { key: 'per_bathroom', label: 'Per bathroom' },
      ].map(({ key, label }) => (
        <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm font-medium text-gray-600 w-28">{label}</span>
          <NumInput value={value[key] ?? ''} onChange={v => onChange({ ...value, [key]: v })} />
        </div>
      ))}
    </div>
  );
}

function PerSqmEditor({ value, onChange }) {
  const tiers = value.tiered_rates ?? [];
  const updateTier = (i, field, v) => {
    const next = [...tiers];
    next[i] = { ...next[i], [field]: v };
    onChange({ ...value, tiered_rates: next });
  };
  const addTier   = () => onChange({ ...value, tiered_rates: [...tiers, { up_to_sqm: '', rate: '' }] });
  const removeTier = i => onChange({ ...value, tiered_rates: tiers.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        <span className="text-sm font-medium text-gray-600 w-28">Standard rate</span>
        <NumInput
          value={value.rate_per_sqm ?? ''}
          onChange={v => onChange({ ...value, rate_per_sqm: v })}
          prefix="£"
          suffix="/m²"
        />
      </div>

      {tiers.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Tiered rates (optional)</p>
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <span className="text-xs text-gray-500 shrink-0">Up to</span>
              <input
                type="number"
                value={t.up_to_sqm ?? ''}
                onChange={e => updateTier(i, 'up_to_sqm', e.target.value)}
                placeholder="50"
                className="w-20 px-2 py-1.5 rounded-lg border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
              />
              <span className="text-xs text-gray-500">m²</span>
              <NumInput value={t.rate ?? ''} onChange={v => updateTier(i, 'rate', v)} prefix="£" suffix="/m²" />
              <button onClick={() => removeTier(i)} className="text-gray-400 hover:text-red-400 ml-auto">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={addTier} className="text-sm text-[#1f48ff] font-medium flex items-center gap-1 hover:underline">
        <Plus size={14} /> Add tiered rate
      </button>
    </div>
  );
}

function PerHourEditor({ value, onChange }) {
  const sizes = ['1_bed', '2_bed', '3_bed', '4_bed', '5_bed'];
  const hrs = value.estimated_hours_by_size ?? {};
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        <span className="text-sm font-medium text-gray-600 w-28">Hourly rate</span>
        <NumInput
          value={value.hourly_rate ?? ''}
          onChange={v => onChange({ ...value, hourly_rate: v })}
          prefix="£"
          suffix="/hr"
        />
      </div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Estimated hours by size</p>
      <div className="grid grid-cols-2 gap-2">
        {sizes.map(s => (
          <div key={s} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-600 w-16">{s.replace('_', ' ')}</span>
            <NumInput
              value={hrs[s] ?? ''}
              onChange={v => onChange({ ...value, estimated_hours_by_size: { ...hrs, [s]: v } })}
              prefix=""
              suffix="hrs"
              placeholder="2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FlatRateBySizeEditor({ value, onChange }) {
  const buckets = [
    { key: 'small',       label: 'Small' },
    { key: 'medium',      label: 'Medium' },
    { key: 'large',       label: 'Large' },
    { key: 'extra_large', label: 'Extra large' },
  ];
  return (
    <div className="space-y-2">
      {buckets.map(({ key, label }) => {
        const b = value[key] ?? {};
        return (
          <div key={key} className="p-3 bg-gray-50 rounded-xl space-y-2">
            <p className="text-sm font-medium text-[#010a4f]">{label}</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">Up to</span>
                <input
                  type="number"
                  value={b.max_sqm ?? ''}
                  onChange={e => onChange({ ...value, [key]: { ...b, max_sqm: e.target.value || null } })}
                  placeholder="no limit"
                  className="w-20 px-2 py-1.5 rounded-lg border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
                />
                <span className="text-xs text-gray-500">m²</span>
              </div>
              <NumInput
                value={b.price ?? ''}
                onChange={v => onChange({ ...value, [key]: { ...b, price: v } })}
              />
              <input
                type="text"
                value={b.description ?? ''}
                onChange={e => onChange({ ...value, [key]: { ...b, description: e.target.value } })}
                placeholder="Description (optional)"
                className="flex-1 min-w-32 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BaseAmountsEditor({ method, value, onChange }) {
  switch (method) {
    case 'per_bedroom':          return <PerBedroomEditor value={value} onChange={onChange} />;
    case 'per_bedroom_bathroom': return <PerBedroomBathroomEditor value={value} onChange={onChange} />;
    case 'per_sqm':              return <PerSqmEditor value={value} onChange={onChange} />;
    case 'per_hour':             return <PerHourEditor value={value} onChange={onChange} />;
    case 'flat_rate_by_size':    return <FlatRateBySizeEditor value={value} onChange={onChange} />;
    case 'flat_rate_fixed':
      return (
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm font-medium text-gray-600 w-28">Fixed price</span>
          <NumInput value={value.price ?? ''} onChange={v => onChange({ ...value, price: v })} />
        </div>
      );
    case 'site_visit_required':
      return (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          Front Desk will capture the enquiry and book a site visit — no quote is generated in chat.
        </div>
      );
    default:
      return null;
  }
}

// ─── Frequency modifiers editor ───────────────────────────────────────────────

function FreqModifiersEditor({ value, onChange }) {
  const freqs = [
    { key: 'weekly',      label: 'Weekly' },
    { key: 'fortnightly', label: 'Fortnightly' },
    { key: 'four_weekly', label: 'Four-weekly' },
    { key: 'monthly',     label: 'Monthly' },
    { key: 'one_off',     label: 'One-off' },
  ];
  return (
    <div className="space-y-2">
      {freqs.map(({ key, label }) => {
        const mod = value[key] ?? DEFAULT_FREQ_MODIFIERS[key];
        const pct = Math.round((mod - 1) * 100);
        return (
          <div key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <span className="text-sm font-medium text-gray-600 w-28">{label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={mod}
                onChange={e => onChange({ ...value, [key]: parseFloat(e.target.value) || 1 })}
                className="w-20 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
              />
              <span className={`text-xs font-medium w-16 ${pct > 0 ? 'text-amber-600' : pct < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                {pct === 0 ? 'base price' : pct > 0 ? `+${pct}%` : `${pct}%`}
              </span>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-gray-400">1.0 = base price · 0.9 = 10% less · 1.25 = 25% more</p>
    </div>
  );
}

// ─── Duration estimates editor ────────────────────────────────────────────────

function DurationEditor({ method, value, onChange }) {
  if (method === 'site_visit_required' || method === 'flat_rate_fixed') return null;

  const fields = method === 'flat_rate_by_size'
    ? [
        { key: 'small', label: 'Small' }, { key: 'medium', label: 'Medium' },
        { key: 'large', label: 'Large' }, { key: 'extra_large', label: 'XL' },
      ]
    : [
        { key: '1', label: '1 bed' }, { key: '2', label: '2 bed' },
        { key: '3', label: '3 bed' }, { key: '4', label: '4 bed' },
        { key: '5', label: '5 bed' },
      ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600 w-16">{label}</span>
          <NumInput
            value={value?.[key] ?? ''}
            onChange={v => onChange({ ...(value ?? {}), [key]: v })}
            prefix=""
            suffix="min"
            placeholder="90"
          />
        </div>
      ))}
    </div>
  );
}

// ─── Add-ons editor ───────────────────────────────────────────────────────────

function AddonsEditor({ businessId, serviceKey }) {
  const [addons, setAddons]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(null); // addon id being saved
  const [newAddon, setNewAddon] = useState({ name: '', price: '', duration_minutes_added: '', display_mode: 'common' });

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    const { data } = await supabase
      .from('pricing_addons')
      .select('*')
      .eq('business_id', businessId)
      .eq('service', serviceKey)
      .eq('active', true)
      .order('display_order');
    setAddons(data ?? []);
    setLoading(false);
  }, [businessId, serviceKey]);

  useEffect(() => { load(); }, [load]);

  const saveAddon = async () => {
    if (!newAddon.name || !newAddon.price) return;
    const row = {
      business_id:           businessId,
      service:               serviceKey,
      name:                  newAddon.name,
      price:                 parseFloat(newAddon.price),
      duration_minutes_added: newAddon.duration_minutes_added ? parseInt(newAddon.duration_minutes_added) : null,
      display_mode:          newAddon.display_mode,
      display_order:         addons.length,
    };
    await supabase.from('pricing_addons').insert(row);
    setNewAddon({ name: '', price: '', duration_minutes_added: '', display_mode: 'common' });
    load();
  };

  const removeAddon = async (id) => {
    setSaving(id);
    await supabase.from('pricing_addons').update({ active: false }).eq('id', id);
    setSaving(null);
    load();
  };

  const addDefaults = async () => {
    const defaults = ADDON_DEFAULTS[serviceKey] ?? [];
    if (!defaults.length) return;
    const rows = defaults.map((d, i) => ({
      business_id:           businessId,
      service:               serviceKey,
      name:                  d.name,
      price:                 d.price,
      duration_minutes_added: d.duration_minutes_added,
      display_mode:          'common',
      display_order:         i,
    }));
    await supabase.from('pricing_addons').upsert(rows, { onConflict: 'business_id,service,name' });
    load();
  };

  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;

  return (
    <div className="space-y-3">
      {addons.length === 0 && (
        <div className="text-center py-6 text-sm text-gray-400">
          No add-ons yet.
          {ADDON_DEFAULTS[serviceKey] && (
            <button onClick={addDefaults} className="ml-2 text-[#1f48ff] font-medium hover:underline">
              Add common defaults
            </button>
          )}
        </div>
      )}

      {addons.map(a => (
        <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#010a4f]">{a.name}</p>
            <p className="text-xs text-gray-400">
              £{a.price}
              {a.duration_minutes_added ? ` · +${a.duration_minutes_added} min` : ''}
              {' · '}
              <span className={a.display_mode === 'common' ? 'text-[#1f48ff]' : 'text-gray-400'}>
                {a.display_mode === 'common' ? 'shown in chat' : 'on request'}
              </span>
            </p>
          </div>
          <button
            onClick={() => removeAddon(a.id)}
            disabled={saving === a.id}
            className="text-gray-300 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {/* Add new */}
      <div className="border border-dashed border-[#99c5ff]/60 rounded-xl p-3 space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add an add-on</p>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={newAddon.name}
            onChange={e => setNewAddon(p => ({ ...p, name: e.target.value }))}
            placeholder="Name (e.g. Inside the oven)"
            className="flex-1 min-w-40 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
          />
          <div className="flex items-center gap-1">
            <span className="text-sm text-gray-500">£</span>
            <input
              type="number"
              value={newAddon.price}
              onChange={e => setNewAddon(p => ({ ...p, price: e.target.value }))}
              placeholder="25"
              className="w-20 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
            />
          </div>
          <div className="flex items-center gap-1">
            <Clock size={13} className="text-gray-400" />
            <input
              type="number"
              value={newAddon.duration_minutes_added}
              onChange={e => setNewAddon(p => ({ ...p, duration_minutes_added: e.target.value }))}
              placeholder="min"
              className="w-16 px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff]"
            />
          </div>
          <select
            value={newAddon.display_mode}
            onChange={e => setNewAddon(p => ({ ...p, display_mode: e.target.value }))}
            className="px-3 py-2 rounded-xl border border-[#99c5ff]/40 text-sm focus:outline-none focus:border-[#1f48ff] bg-white"
          >
            <option value="common">Show in chat</option>
            <option value="on_request">On request only</option>
          </select>
          <button
            onClick={saveAddon}
            disabled={!newAddon.name || !newAddon.price}
            className="px-4 py-2 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule editor ──────────────────────────────────────────────────────────────

function RuleEditor({ businessId, service, category, onSaved, onClose }) {
  const allowedMethods = category === 'commercial'
    ? COMMERCIAL_METHODS
    : category === 'exterior' ? EXTERIOR_METHODS : RESIDENTIAL_METHODS;

  const defaultMethod = allowedMethods[0];

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [activeSection, setActiveSection] = useState('pricing');

  const [method, setMethod]           = useState(defaultMethod);
  const [baseAmounts, setBaseAmounts] = useState(DEFAULT_BASE[defaultMethod] ?? {});
  const [freqMods, setFreqMods]       = useState({ ...DEFAULT_FREQ_MODIFIERS });
  const [minPrice, setMinPrice]       = useState('');
  const [durationEst, setDurationEst] = useState({});

  useEffect(() => {
    if (!businessId) return;
    setLoading(true);
    supabase
      .from('pricing_rules')
      .select('*')
      .eq('business_id', businessId)
      .eq('service', service.key)
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setRule(data);
          setMethod(data.pricing_method);
          setBaseAmounts(data.base_amounts ?? {});
          setFreqMods(data.frequency_modifiers ?? { ...DEFAULT_FREQ_MODIFIERS });
          setMinPrice(data.minimum_price ?? '');
          setDurationEst(data.duration_estimates ?? {});
        }
        setLoading(false);
      });
  }, [businessId, service.key]);

  const handleMethodChange = (m) => {
    setMethod(m);
    setBaseAmounts(DEFAULT_BASE[m] ?? {});
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      business_id:        businessId,
      service:            service.key,
      category,
      status:             'active',
      pricing_method:     method,
      base_amounts:       baseAmounts,
      frequency_modifiers: freqMods,
      minimum_price:      minPrice ? parseFloat(minPrice) : null,
      duration_estimates: Object.keys(durationEst).length ? durationEst : null,
      effective_from:     new Date().toISOString(),
    };

    if (rule) {
      // Version the old rule and create a new one
      const newVersion = (rule.version ?? 1) + 1;
      const { data: newRule } = await supabase
        .from('pricing_rules')
        .insert({ ...payload, version: newVersion })
        .select()
        .single();

      if (newRule) {
        await supabase
          .from('pricing_rules')
          .update({ status: 'archived', superseded_by_rule_id: newRule.id })
          .eq('id', rule.id);
        setRule(newRule);
      }
    } else {
      const { data: newRule } = await supabase
        .from('pricing_rules')
        .insert({ ...payload, version: 1 })
        .select()
        .single();
      if (newRule) setRule(newRule);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
    );
  }

  const sections = [
    { id: 'pricing',    label: 'Pricing method' },
    { id: 'frequency',  label: 'Frequency' },
    { id: 'duration',   label: 'Duration' },
    { id: 'addons',     label: 'Add-ons' },
  ].filter(s => !(method === 'site_visit_required' && s.id !== 'pricing'));

  return (
    <div className="bg-white rounded-2xl border border-[#99c5ff]/30 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <p className="font-black text-[#010a4f] text-lg">{service.label}</p>
          <p className="text-xs text-gray-400 capitalize">{category}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || method === 'site_visit_required'}
            className="flex items-center gap-2 px-4 py-2 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save rules</>}
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2">×</button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeSection === s.id
                ? 'text-[#1f48ff] border-b-2 border-[#1f48ff]'
                : 'text-gray-500 hover:text-[#010a4f]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">
        {/* Pricing method */}
        {activeSection === 'pricing' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Choose how this service is priced.</p>
            <div className="grid gap-2">
              {allowedMethods.map(m => (
                <button
                  key={m}
                  onClick={() => handleMethodChange(m)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    method === m
                      ? 'border-[#1f48ff] bg-[#1f48ff]/5'
                      : 'border-gray-200 hover:border-[#99c5ff]'
                  }`}
                >
                  <p className={`text-sm font-bold ${method === m ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}>
                    {METHOD_META[m].label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{METHOD_META[m].desc}</p>
                </button>
              ))}
            </div>

            {method !== 'site_visit_required' && (
              <div className="space-y-3 pt-2">
                <p className="text-sm font-medium text-[#010a4f]">Prices</p>
                <BaseAmountsEditor method={method} value={baseAmounts} onChange={setBaseAmounts} />
                <FieldRow label="Minimum charge" hint="Floor price — never quote below this.">
                  <NumInput value={minPrice} onChange={setMinPrice} placeholder="0" />
                </FieldRow>
              </div>
            )}
          </div>
        )}

        {/* Frequency */}
        {activeSection === 'frequency' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Multipliers applied to the base price for each visit frequency. 1.0 = same price.
            </p>
            <FreqModifiersEditor value={freqMods} onChange={setFreqMods} />
          </div>
        )}

        {/* Duration */}
        {activeSection === 'duration' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Estimated duration in minutes. Used by the scheduler to fit jobs into slots.
            </p>
            <DurationEditor method={method} value={durationEst} onChange={setDurationEst} />
          </div>
        )}

        {/* Add-ons */}
        {activeSection === 'addons' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Optional extras customers can add when booking. "Show in chat" means Front Desk suggests them automatically.
            </p>
            <AddonsEditor businessId={businessId} serviceKey={service.key} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PricingSettings() {
  const businessId = useBusinessId();
  const [view, setView] = useState('configure'); // 'configure' | 'sandbox'
  const [configuredServices, setConfiguredServices] = useState(new Set());
  const [selectedService, setSelectedService] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const loadConfigured = useCallback(async () => {
    if (!businessId) return;
    const { data } = await supabase
      .from('pricing_rules')
      .select('service')
      .eq('business_id', businessId)
      .eq('status', 'active');
    setConfiguredServices(new Set((data ?? []).map(r => r.service)));
  }, [businessId]);

  useEffect(() => { loadConfigured(); }, [loadConfigured]);

  const handleConfigure = (service, category) => {
    setSelectedService(service);
    setSelectedCategory(category);
  };

  const handleClose = () => {
    setSelectedService(null);
    setSelectedCategory(null);
    loadConfigured();
  };

  const categoryLabels = { residential: 'Residential', exterior: 'Exterior', commercial: 'Commercial' };

  return (
    <div className="space-y-6">
      {selectedService ? (
        <RuleEditor
          businessId={businessId}
          service={selectedService}
          category={selectedCategory}
          onSaved={loadConfigured}
          onClose={handleClose}
        />
      ) : (
        <>
          {/* View toggle */}
          <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-gray-500 flex-1">
              {view === 'configure' && 'Configure pricing for each service you offer. Front Desk will quote these automatically.'}
              {view === 'sandbox'   && 'Test your pricing rules. Pick a scenario and see exactly what Front Desk would quote.'}
              {view === 'chat'      && 'Answer a few questions and Cadi will build your pricing rule automatically.'}
            </p>
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl self-start sm:self-auto shrink-0">
              <button
                onClick={() => setView('configure')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === 'configure'
                    ? 'bg-white text-[#1f48ff] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings size={12} />
                Configure
              </button>
              <button
                onClick={() => setView('sandbox')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === 'sandbox'
                    ? 'bg-white text-[#1f48ff] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FlaskConical size={12} />
                Test
              </button>
              <button
                onClick={() => setView('chat')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  view === 'chat'
                    ? 'bg-white text-[#1f48ff] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <MessageSquare size={12} />
                AI Setup
              </button>
            </div>
          </div>

          {/* Sandbox view */}
          {view === 'sandbox' && (
            <PricingSandbox businessId={businessId} />
          )}

          {/* Conversation view */}
          {view === 'chat' && (
            <PricingConversation businessId={businessId} onRuleSaved={loadConfigured} />
          )}

          {/* Configure view */}
          {view === 'configure' && (
            <>
              {Object.entries(SERVICES).map(([cat, services]) => (
                <div key={cat} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="font-bold text-[#010a4f]">{categoryLabels[cat]}</p>
                    {cat === 'commercial' && (
                      <p className="text-xs text-gray-400 mt-0.5">Commercial services use the site visit flow — no in-chat quote</p>
                    )}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {services.map(service => {
                      const configured = configuredServices.has(service.key);
                      return (
                        <div key={service.key} className="flex items-center justify-between px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${configured ? 'bg-green-400' : 'bg-gray-200'}`} />
                            <span className="text-sm font-medium text-[#010a4f]">{service.label}</span>
                            {configured && (
                              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-medium">
                                Configured
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleConfigure(service, cat)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#1f48ff] hover:bg-[#1f48ff]/5 rounded-lg transition-colors"
                          >
                            <Settings size={12} />
                            {configured ? 'Edit' : 'Configure'}
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
