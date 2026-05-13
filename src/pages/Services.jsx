// Services.jsx — Services Menu page
// The editable menu of cleaning services. Front Desk's single source of truth for quoting.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Plus, MoreHorizontal, Lock, ChevronDown, ChevronUp, X, AlertCircle, Check,
  Pencil, Copy, Trash2, Eye, EyeOff,
} from 'lucide-react';
import {
  listServices, createService, updateService, deleteService,
  setServiceActive, duplicateService,
  formatPricingSummary, formatDuration, getFrequencyLabels, serviceHasPricing,
  countServicesNeedingPricing, seedServicesFromOnboarding,
} from '../lib/db/servicesDb';
import { supabase } from '../lib/supabase';

// ── Service catalogue (same groups as onboarding) ────────────────────────────

const SERVICE_CATALOGUE = {
  residential: [
    { label: 'Regular Cleaning', items: ['Weekly Clean', 'Fortnightly Clean', 'Monthly Clean'] },
    { label: 'One-off & Specialist', items: ['Deep Clean', 'End of Tenancy', 'Move In / Move Out', 'Spring Clean', 'After Party Clean'] },
    { label: 'Holiday & Short-Let', items: ['Airbnb Turnover', 'Holiday Let Changeover'] },
    { label: 'Add-ons', items: ['Oven Clean', 'Carpet Clean', 'Inside Windows', 'Ironing Service'] },
  ],
  commercial: [
    { label: 'Office & Retail', items: ['Daily Office Clean', 'Weekly Office Clean', 'Retail Clean'] },
    { label: 'Education & Healthcare', items: ['School / College', 'Nursery / Childcare', 'Medical Practice', 'Care Home'] },
    { label: 'Hospitality', items: ['Restaurant / Cafe', 'Hotel', 'Pub / Bar', 'Event Venue'] },
    { label: 'Specialist', items: ['Post-Construction Clean', 'Periodic Deep Clean', 'Industrial / Warehouse'] },
  ],
  exterior: [
    { label: 'Window Cleaning', items: ['Residential Windows', 'Commercial Windows', 'Conservatory Glass'] },
    { label: 'Gutters & Roofline', items: ['Gutter Clearing', 'Fascia & Soffit Clean', 'Roof Moss Removal'] },
    { label: 'Jet Washing', items: ['Driveway Jet Wash', 'Patio / Decking', 'Path & Steps'] },
    { label: 'Building Exterior', items: ['Render Wash', 'UPVC Restoration', 'Solar Panel Clean'] },
  ],
};

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'residential', label: 'Residential' },
  { key: 'exterior',    label: 'Exterior'    },
  { key: 'commercial',  label: 'Commercial'  },
];

const PRICING_TYPES = [
  { value: 'hourly',   label: 'Hourly rate'           },
  { value: 'fixed',    label: 'Fixed price'            },
  { value: 'per_sqm',  label: 'Per square metre'       },
  { value: 'per_room', label: 'Per room'               },
  { value: 'custom',   label: 'Custom (quote each one)' },
];

const FREQ_OPTIONS = [
  { key: 'frequency_one_off',    label: 'One-off'      },
  { key: 'frequency_weekly',     label: 'Weekly'       },
  { key: 'frequency_fortnightly', label: 'Fortnightly' },
  { key: 'frequency_monthly',    label: 'Monthly'      },
  { key: 'frequency_quarterly',  label: 'Quarterly'    },
  { key: 'frequency_annually',   label: 'Annually'     },
];

const EMPTY_FORM = {
  category: 'residential',
  name: '',
  description_included: '',
  description_excluded: '',
  pricing_type: 'hourly',
  price_hourly_rate: '',
  price_hourly_minimum_hours: '',
  price_fixed_basic: '',
  price_fixed_standard: '',
  price_fixed_premium: '',
  price_per_sqm: '',
  price_per_sqm_minimum: '',
  price_per_room: '',
  price_per_bathroom: '',
  pricing_notes: '',
  duration_value: '',
  duration_unit: 'hours',
  frequency_one_off: true,
  frequency_weekly: false,
  frequency_fortnightly: false,
  frequency_monthly: false,
  frequency_quarterly: false,
  frequency_annually: false,
  service_area_uses_default: true,
  service_area_custom: [],
  materials_equipment_notes: '',
  private_notes: '',
  is_active: true,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function numericField(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function formToRecord(form) {
  return {
    category: form.category,
    name: form.name.trim(),
    description_included: form.description_included.trim() || null,
    description_excluded: form.description_excluded.trim() || null,
    pricing_type: form.pricing_type,
    price_hourly_rate: numericField(form.price_hourly_rate),
    price_hourly_minimum_hours: numericField(form.price_hourly_minimum_hours),
    price_fixed_basic: numericField(form.price_fixed_basic),
    price_fixed_standard: numericField(form.price_fixed_standard),
    price_fixed_premium: numericField(form.price_fixed_premium),
    price_per_sqm: numericField(form.price_per_sqm),
    price_per_sqm_minimum: numericField(form.price_per_sqm_minimum),
    price_per_room: numericField(form.price_per_room),
    price_per_bathroom: numericField(form.price_per_bathroom),
    pricing_notes: form.pricing_notes.trim() || null,
    duration_value: numericField(form.duration_value),
    duration_unit: form.duration_unit,
    frequency_one_off: form.frequency_one_off,
    frequency_weekly: form.frequency_weekly,
    frequency_fortnightly: form.frequency_fortnightly,
    frequency_monthly: form.frequency_monthly,
    frequency_quarterly: form.frequency_quarterly,
    frequency_annually: form.frequency_annually,
    service_area_uses_default: form.service_area_uses_default,
    service_area_custom: form.service_area_uses_default ? null : form.service_area_custom,
    materials_equipment_notes: form.materials_equipment_notes.trim() || null,
    private_notes: form.private_notes.trim() || null,
    is_active: form.is_active,
  };
}

function recordToForm(record) {
  return {
    ...EMPTY_FORM,
    ...record,
    price_hourly_rate: record.price_hourly_rate ?? '',
    price_hourly_minimum_hours: record.price_hourly_minimum_hours ?? '',
    price_fixed_basic: record.price_fixed_basic ?? '',
    price_fixed_standard: record.price_fixed_standard ?? '',
    price_fixed_premium: record.price_fixed_premium ?? '',
    price_per_sqm: record.price_per_sqm ?? '',
    price_per_sqm_minimum: record.price_per_sqm_minimum ?? '',
    price_per_room: record.price_per_room ?? '',
    price_per_bathroom: record.price_per_bathroom ?? '',
    duration_value: record.duration_value ?? '',
    description_included: record.description_included ?? '',
    description_excluded: record.description_excluded ?? '',
    pricing_notes: record.pricing_notes ?? '',
    materials_equipment_notes: record.materials_equipment_notes ?? '',
    private_notes: record.private_notes ?? '',
    service_area_custom: record.service_area_custom ?? [],
  };
}

function validate(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Service name is required.';
  if (!form.pricing_type) errors.pricing_type = 'Choose a pricing method.';
  return errors;
}

// ── Accordion section ─────────────────────────────────────────────────────────

function AccordionSection({ title, filledCount, totalCount, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[rgba(153,197,255,0.15)] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[rgba(153,197,255,0.05)] hover:bg-[rgba(153,197,255,0.1)] transition-colors text-left"
      >
        <span className="text-sm font-bold text-white">{title}</span>
        <div className="flex items-center gap-2">
          {totalCount !== undefined && (
            <span className="text-xs text-[rgba(153,197,255,0.5)]">
              {filledCount} of {totalCount}
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-[#99c5ff]" /> : <ChevronDown size={14} className="text-[#99c5ff]" />}
        </div>
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </div>
  );
}

// ── Form field components ─────────────────────────────────────────────────────

function FieldLabel({ children, required }) {
  return (
    <label className="block text-xs font-bold text-[#99c5ff] mb-1.5 uppercase tracking-wider">
      {children}{required && <span className="text-[#4f78ff] ml-0.5">*</span>}
    </label>
  );
}

function FieldHelper({ children }) {
  return <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1">{children}</p>;
}

function TextInput({ value, onChange, placeholder, error, className = '' }) {
  return (
    <>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg bg-[rgba(153,197,255,0.07)] border text-white text-sm placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#4f78ff] transition-colors ${
          error ? 'border-red-400' : 'border-[rgba(153,197,255,0.2)]'
        } ${className}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.2)] text-white text-sm placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#4f78ff] transition-colors resize-none"
    />
  );
}

function NumberInput({ value, onChange, placeholder, prefix, suffix, className = '' }) {
  return (
    <div className={`flex items-center bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.2)] rounded-lg overflow-hidden focus-within:border-[#4f78ff] transition-colors ${className}`}>
      {prefix && <span className="px-3 text-sm text-[rgba(153,197,255,0.6)] border-r border-[rgba(153,197,255,0.2)]">{prefix}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-2.5 bg-transparent text-white text-sm placeholder-[rgba(153,197,255,0.3)] focus:outline-none"
      />
      {suffix && <span className="px-3 text-sm text-[rgba(153,197,255,0.6)]">{suffix}</span>}
    </div>
  );
}

// ── Pricing fields (conditional on type) ─────────────────────────────────────

function PricingFields({ form, patch }) {
  if (form.pricing_type === 'hourly') return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Rate per hour</FieldLabel>
        <NumberInput prefix="£" value={form.price_hourly_rate} onChange={v => patch({ price_hourly_rate: v })} placeholder="0.00" suffix="/hr" />
      </div>
      <div>
        <FieldLabel>Minimum hours</FieldLabel>
        <NumberInput value={form.price_hourly_minimum_hours} onChange={v => patch({ price_hourly_minimum_hours: v })} placeholder="e.g. 2" />
      </div>
    </div>
  );

  if (form.pricing_type === 'fixed') return (
    <div className="space-y-3">
      <p className="text-xs text-[rgba(153,197,255,0.5)]">Add up to three tiers — Basic, Standard, Premium. Fill the ones that apply.</p>
      <div className="grid grid-cols-3 gap-3">
        {[['price_fixed_basic','Basic'],['price_fixed_standard','Standard'],['price_fixed_premium','Premium']].map(([field, label]) => (
          <div key={field}>
            <FieldLabel>{label}</FieldLabel>
            <NumberInput prefix="£" value={form[field]} onChange={v => patch({ [field]: v })} placeholder="0.00" />
          </div>
        ))}
      </div>
    </div>
  );

  if (form.pricing_type === 'per_sqm') return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Rate per m²</FieldLabel>
        <NumberInput prefix="£" value={form.price_per_sqm} onChange={v => patch({ price_per_sqm: v })} placeholder="0.00" suffix="/m²" />
      </div>
      <div>
        <FieldLabel>Minimum charge</FieldLabel>
        <NumberInput prefix="£" value={form.price_per_sqm_minimum} onChange={v => patch({ price_per_sqm_minimum: v })} placeholder="0.00" />
      </div>
    </div>
  );

  if (form.pricing_type === 'per_room') return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <FieldLabel>Per room</FieldLabel>
        <NumberInput prefix="£" value={form.price_per_room} onChange={v => patch({ price_per_room: v })} placeholder="0.00" />
      </div>
      <div>
        <FieldLabel>Per bathroom (optional)</FieldLabel>
        <NumberInput prefix="£" value={form.price_per_bathroom} onChange={v => patch({ price_per_bathroom: v })} placeholder="0.00" />
      </div>
    </div>
  );

  if (form.pricing_type === 'custom') return (
    <div className="p-3 rounded-lg bg-[rgba(79,120,255,0.1)] border border-[rgba(79,120,255,0.25)]">
      <p className="text-xs text-[#99c5ff]">Front Desk will gather inquiry details and flag this for you to quote manually.</p>
    </div>
  );

  return null;
}

// ── Catalogue picker modal ────────────────────────────────────────────────────

const CAT_TABS = [
  { key: 'residential', label: 'Residential' },
  { key: 'exterior',    label: 'Exterior'    },
  { key: 'commercial',  label: 'Commercial'  },
];

function CatalogueModal({ existingNames, onAdd, onCustom, onClose }) {
  const [tab, setTab] = useState('residential');
  const [selected, setSelected] = useState({}); // name → true

  const existingSet = new Set((existingNames || []).map(n => n.toLowerCase()));

  const toggleItem = (name) => {
    if (existingSet.has(name.toLowerCase())) return;
    setSelected(s => ({ ...s, [name]: !s[name] }));
  };

  const tabItems = (SERVICE_CATALOGUE[tab] || []).flatMap(g => g.items);
  const allAvailable = tabItems.filter(n => !existingSet.has(n.toLowerCase()));
  const tabSelected = tabItems.filter(n => selected[n]);
  const allTabSelected = allAvailable.length > 0 && allAvailable.every(n => selected[n]);

  const toggleAll = () => {
    if (allTabSelected) {
      const next = { ...selected };
      tabItems.forEach(n => { delete next[n]; });
      setSelected(next);
    } else {
      const next = { ...selected };
      allAvailable.forEach(n => { next[n] = true; });
      setSelected(next);
    }
  };

  const selectedNames = Object.keys(selected).filter(k => selected[k]);
  const totalCount = selectedNames.length;

  const handleAdd = async () => {
    if (!totalCount) return;
    await onAdd(selectedNames);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">Add services</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 px-5 pb-3">
          {CAT_TABS.map(c => {
            const count = (SERVICE_CATALOGUE[c.key] || []).flatMap(g => g.items).filter(n => selected[n]).length;
            return (
              <button
                key={c.key}
                onClick={() => setTab(c.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tab === c.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {c.label}
                {count > 0 && (
                  <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === c.key ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Select all toggle */}
        {allAvailable.length > 0 && (
          <div className="px-5 pb-2">
            <button
              onClick={toggleAll}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              {allTabSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        )}

        {/* Service chips */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-5">
          {(SERVICE_CATALOGUE[tab] || []).map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map(name => {
                  const already = existingSet.has(name.toLowerCase());
                  const isSelected = selected[name];
                  return (
                    <button
                      key={name}
                      onClick={() => toggleItem(name)}
                      disabled={already}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                        already
                          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-default'
                          : isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      {already ? <span className="flex items-center gap-1"><Check size={12} className="text-gray-400" />{name}</span> : name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex flex-col gap-2">
          <button
            onClick={handleAdd}
            disabled={!totalCount}
            className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {totalCount > 0 ? `Add ${totalCount} service${totalCount !== 1 ? 's' : ''} →` : 'Select services above'}
          </button>
          <button
            onClick={onCustom}
            className="text-sm text-gray-500 hover:text-gray-700 text-center py-1"
          >
            Add a custom service instead
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add/Edit modal ─────────────────────────────────────────────────────────────

function ServiceModal({ initialData, onSave, onClose, onSaveAndAdd }) {
  const navigate = useNavigate();
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState(isEdit ? recordToForm(initialData) : { ...EMPTY_FORM, category: initialData?.category ?? 'residential' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const patch = useCallback((fields) => setForm(f => ({ ...f, ...fields })), []);

  const countOptional = (fields) => fields.filter(f => form[f] && String(form[f]).trim()).length;

  const handleSubmit = async (andAdd = false) => {
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const record = formToRecord(form);
      if (isEdit) {
        await updateService(initialData.id, record);
      } else {
        await createService(record);
      }
      if (andAdd) {
        onSaveAndAdd(form.name);
        setForm({ ...EMPTY_FORM, category: form.category });
      } else {
        onSave(form.name);
      }
    } catch (e) {
      setErrors({ _global: 'Something didn\'t save. Try again or come back in a minute.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.15)] overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        {/* Grid texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.12)] shrink-0">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">
              {isEdit ? 'Edit service' : 'Add a service'}
            </p>
            <p className="text-xs text-[rgba(153,197,255,0.5)]">This is what Front Desk quotes from, so be specific.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
            <X size={14} className="text-white" />
          </button>
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {errors._global && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{errors._global}</p>
            </div>
          )}

          {/* Category */}
          <div>
            <FieldLabel required>Category</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => patch({ category: c.key })}
                  className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                    form.category === c.key
                      ? 'bg-[#4f78ff] border-[#4f78ff] text-white'
                      : 'border-[rgba(153,197,255,0.2)] text-[rgba(153,197,255,0.7)] hover:border-[#4f78ff] hover:text-white'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Service name */}
          <div>
            <FieldLabel required>Service name</FieldLabel>
            <TextInput
              value={form.name}
              onChange={v => patch({ name: v })}
              placeholder='e.g. "Regular weekly clean"'
              error={errors.name}
            />
            <FieldHelper>Call it what your customers call it.</FieldHelper>
          </div>

          {/* Pricing type */}
          <div>
            <FieldLabel required>How do you price this?</FieldLabel>
            <div className="space-y-2">
              {PRICING_TYPES.map(pt => (
                <label key={pt.value} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                    form.pricing_type === pt.value ? 'border-[#4f78ff] bg-[#4f78ff]' : 'border-[rgba(153,197,255,0.3)] group-hover:border-[#4f78ff]'
                  }`}>
                    {form.pricing_type === pt.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <input type="radio" className="sr-only" checked={form.pricing_type === pt.value} onChange={() => patch({ pricing_type: pt.value })} />
                  <span className={`text-sm ${form.pricing_type === pt.value ? 'text-white font-semibold' : 'text-[rgba(153,197,255,0.7)]'}`}>{pt.label}</span>
                </label>
              ))}
            </div>
            <FieldHelper>Pick the way you naturally price this job.</FieldHelper>
          </div>

          {/* Pricing fields */}
          <div>
            <PricingFields form={form} patch={patch} />
          </div>

          {/* Duration */}
          <div>
            <FieldLabel>Job duration</FieldLabel>
            <div className="flex gap-2">
              <NumberInput
                value={form.duration_value}
                onChange={v => patch({ duration_value: v })}
                placeholder="e.g. 2"
                className="flex-1"
              />
              <select
                value={form.duration_unit}
                onChange={e => patch({ duration_unit: e.target.value })}
                className="px-3 py-2.5 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.2)] text-white text-sm focus:outline-none focus:border-[#4f78ff]"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <FieldHelper>Roughly how long does this take? Helps Cadi build accurate schedules.</FieldHelper>
          </div>

          {/* Optional sections */}
          <AccordionSection
            title="What's included / not included"
            filledCount={countOptional(['description_included', 'description_excluded'])}
            totalCount={2}
          >
            <div>
              <FieldLabel>What's included</FieldLabel>
              <TextArea
                value={form.description_included}
                onChange={v => patch({ description_included: v })}
                placeholder='e.g. "Hoovering, dusting, kitchen and bathrooms, bins emptied."'
              />
              <FieldHelper>Front Desk reads this when quoting. The more detail, the better the quote.</FieldHelper>
            </div>
            <div>
              <FieldLabel>What's not included</FieldLabel>
              <TextArea
                value={form.description_excluded}
                onChange={v => patch({ description_excluded: v })}
                placeholder='e.g. "Oven cleaning, inside windows, ironing."'
              />
              <FieldHelper>Stops Front Desk over-promising.</FieldHelper>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Pricing notes for Front Desk"
            filledCount={countOptional(['pricing_notes'])}
            totalCount={1}
          >
            <div>
              <FieldLabel>Pricing notes</FieldLabel>
              <TextArea
                value={form.pricing_notes}
                onChange={v => patch({ pricing_notes: v })}
                placeholder='e.g. "Add £15 for parking in central areas. Discount 10% for fortnightly bookings."'
              />
              <FieldHelper>Tell Front Desk how to adjust the price in different situations. Plain English is fine.</FieldHelper>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Frequency options"
            filledCount={FREQ_OPTIONS.filter(f => form[f.key]).length}
            totalCount={FREQ_OPTIONS.length}
          >
            <div>
              <FieldHelper className="mb-3">How can customers book this? Affects what Front Desk offers.</FieldHelper>
              <div className="grid grid-cols-2 gap-2">
                {FREQ_OPTIONS.map(f => (
                  <label key={f.key} className="flex items-center gap-2.5 cursor-pointer group">
                    <button
                      type="button"
                      onClick={() => patch({ [f.key]: !form[f.key] })}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                        form[f.key] ? 'bg-[#4f78ff] border-[#4f78ff]' : 'border-[rgba(153,197,255,0.3)] group-hover:border-[#4f78ff]'
                      }`}
                    >
                      {form[f.key] && <Check size={10} className="text-white" strokeWidth={3} />}
                    </button>
                    <span className={`text-sm ${form[f.key] ? 'text-white font-semibold' : 'text-[rgba(153,197,255,0.6)]'}`}>{f.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Service area"
            filledCount={form.service_area_uses_default ? 0 : 1}
            totalCount={1}
          >
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <button
                  type="button"
                  onClick={() => patch({ service_area_uses_default: !form.service_area_uses_default })}
                  className={`w-10 h-5 rounded-full flex items-center transition-all ${
                    form.service_area_uses_default ? 'bg-[#4f78ff] justify-end' : 'bg-[rgba(153,197,255,0.15)] justify-start'
                  } px-0.5`}
                >
                  <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </button>
                <span className="text-sm text-[rgba(153,197,255,0.8)]">Same as your business profile (default)</span>
              </label>
              {!form.service_area_uses_default && (
                <div>
                  <FieldHelper>Enter postcodes or area names where you offer this service.</FieldHelper>
                  <TextInput
                    value={(form.service_area_custom ?? []).join(', ')}
                    onChange={v => patch({ service_area_custom: v.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="SW1, SW4, Clapham, Brixton..."
                  />
                </div>
              )}
            </div>
          </AccordionSection>

          <AccordionSection
            title="Materials & equipment"
            filledCount={countOptional(['materials_equipment_notes'])}
            totalCount={1}
          >
            <div>
              <FieldLabel>Materials & equipment notes</FieldLabel>
              <TextArea
                value={form.materials_equipment_notes}
                onChange={v => patch({ materials_equipment_notes: v })}
                placeholder='e.g. "Customer provides hoover. We bring all chemicals and cloths."'
              />
              <FieldHelper>Front Desk uses this to set expectations with customers.</FieldHelper>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Private notes"
            filledCount={countOptional(['private_notes'])}
            totalCount={1}
          >
            <div>
              <FieldLabel>Private notes</FieldLabel>
              <TextArea
                value={form.private_notes}
                onChange={v => patch({ private_notes: v })}
                placeholder="Only you can see this. Useful for supplier costs, job memories, etc."
              />
              <FieldHelper>Only you can see this.</FieldHelper>
            </div>
          </AccordionSection>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(153,197,255,0.04)]">
            <div>
              <p className="text-sm font-bold text-white">Active</p>
              <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
                {form.is_active ? 'Front Desk can quote this service.' : 'Hidden from Front Desk.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => patch({ is_active: !form.is_active })}
              className={`w-12 h-6 rounded-full flex items-center transition-all px-0.5 ${
                form.is_active ? 'bg-[#4f78ff] justify-end' : 'bg-[rgba(153,197,255,0.15)] justify-start'
              }`}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-sm" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-5 py-4 border-t border-[rgba(153,197,255,0.12)] shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save service'}
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-[rgba(153,197,255,0.25)] text-[#99c5ff] font-bold text-sm hover:bg-[rgba(153,197,255,0.08)] transition-colors disabled:opacity-60"
            >
              Save and add another
            </button>
          )}
          <button type="button" onClick={onClose} className="text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold px-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirmation modal ─────────────────────────────────────────────────

function DeleteModal({ serviceName, onConfirm, onCancel, deleting }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-black text-gray-900 text-lg mb-2">Delete this service?</h3>
        <p className="text-sm text-gray-500 mb-6">
          Delete <span className="font-semibold text-gray-800">{serviceName}</span>? Front Desk won't quote on it again. This can't be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Service card ──────────────────────────────────────────────────────────────

function ServiceCard({ service, onEdit, onDuplicate, onDelete, onToggleActive }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const hasPricing = serviceHasPricing(service);

  const handleToggle = async () => {
    setToggling(true);
    await onToggleActive(service.id, !service.is_active);
    setToggling(false);
  };

  const freq = getFrequencyLabels(service);
  const duration = formatDuration(service);
  const pricing = formatPricingSummary(service);

  return (
    <div className={`relative bg-white border rounded-xl overflow-hidden transition-all ${
      service.is_active ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-60'
    }`}>
      {/* Pricing warning */}
      {!hasPricing && service.is_active && (
        <div className="flex items-center gap-1.5 px-4 py-2 bg-amber-50 border-b border-amber-100">
          <AlertCircle size={12} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 font-medium">Add pricing so Front Desk can quote this.</p>
        </div>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-black text-gray-900 text-sm leading-tight">{service.name}</h3>
          <div className="flex items-center gap-2 shrink-0">
            {/* Active toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={service.is_active ? 'Pause this service' : 'Reactivate this service'}
              className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all ${
                service.is_active ? 'bg-[#4f78ff] justify-end' : 'bg-gray-200 justify-start'
              } ${toggling ? 'opacity-60' : ''}`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <MoreHorizontal size={14} className="text-gray-500" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-xl w-40 py-1 overflow-hidden">
                    <button onClick={() => { setMenuOpen(false); onEdit(service); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Pencil size={13} className="text-gray-400" /> Edit
                    </button>
                    <button onClick={() => { setMenuOpen(false); onDuplicate(service.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <Copy size={13} className="text-gray-400" /> Duplicate
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(service); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} className="text-red-400" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description snippet */}
        {service.description_included && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{service.description_included}</p>
        )}

        {/* Pricing + duration */}
        <div className="flex items-center gap-3 mb-3">
          <span className={`text-xs font-bold ${hasPricing ? 'text-[#0d1a5e]' : 'text-amber-600'}`}>{pricing}</span>
          {duration && <span className="text-xs text-gray-400">{duration}</span>}
        </div>

        {/* Frequency pills */}
        {freq.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {freq.map(f => (
              <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#040810]/5 text-[#0d1a5e] border border-[#040810]/10">
                {f}
              </span>
            ))}
          </div>
        )}

        {/* Profit margin tease (locked) */}
        <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100">
          <Lock size={11} className="text-gray-300" />
          <span className="text-[10px] text-gray-300 font-semibold">Profit margin tracking — unlock with Pro</span>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ category, onAdd }) {
  const examples = {
    residential: ['regular domestic clean', 'deep clean', 'end of tenancy'],
    exterior: ['window cleaning', 'gutter clearance', 'pressure washing'],
    commercial: ['office clean', 'school clean', 'retail clean'],
  };
  const label = CATEGORIES.find(c => c.key === category)?.label ?? 'this category';
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Plus size={24} className="text-gray-400" />
      </div>
      <h3 className="font-black text-gray-800 text-lg mb-1">No {label.toLowerCase()} services yet.</h3>
      <p className="text-sm text-gray-400 mb-2">
        Examples: {examples[category]?.join(', ')}.
      </p>
      <button
        onClick={onAdd}
        className="mt-4 px-5 py-2.5 rounded-xl bg-[#4f78ff] text-white font-bold text-sm hover:bg-[#3d68ff] transition-colors"
      >
        Add a {label.toLowerCase()} service
      </button>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-xl bg-[#0d1a5e] border border-[rgba(79,120,255,0.4)] text-white text-sm font-semibold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom">
      <Check size={14} className="text-[#4f78ff]" /> {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Services() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('residential');
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data }
  const [catalogueOpen, setCatalogueOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [attentionCount, setAttentionCount] = useState(0);
  const [firstVisitBanner, setFirstVisitBanner] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      const [all, needsPricing] = await Promise.all([
        listServices({ includeInactive: true }),
        countServicesNeedingPricing(),
      ]);

      // If the user has no services yet but picked some during onboarding,
      // seed them automatically so they don't have to re-enter their choices.
      if (all.length === 0 && user?.id && user.id !== 'demo-user') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('setup_data')
          .eq('id', user.id)
          .single();
        const onboardingServices = profile?.setup_data?.services ?? [];
        const customService = profile?.setup_data?.custom_service ?? '';
        if (onboardingServices.length > 0 || customService) {
          await seedServicesFromOnboarding(onboardingServices, customService);
          const seeded = await listServices({ includeInactive: true });
          setServices(seeded);
          setAttentionCount(seeded.filter(s => s.is_active && !serviceHasPricing(s)).length);
          if (seeded.length > 0) setToast(`${seeded.length} service${seeded.length !== 1 ? 's' : ''} imported from your setup. Add pricing to activate them.`);
          return;
        }
      }

      setServices(all);
      setAttentionCount(needsPricing);
    } catch (e) {
      console.error('Services load error', e?.message, e?.code);
    } finally {
      setLoading(false);
    }
  }, [navigate, user]);

  useEffect(() => {
    load();
    const visited = localStorage.getItem('cadi_services_visited');
    if (!visited) {
      setFirstVisitBanner(true);
      localStorage.setItem('cadi_services_visited', '1');
    }
  }, [load]);

  const openAdd = () => setCatalogueOpen(true);
  const openCustomAdd = (category = activeCategory) => { setCatalogueOpen(false); setModal({ mode: 'add', data: { category } }); };
  const openEdit = (service) => setModal({ mode: 'edit', data: service });

  const handleCatalogueAdd = async (names) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      await Promise.all(names.map(name => {
        const cat = Object.entries(SERVICE_CATALOGUE).find(([, groups]) =>
          groups.some(g => g.items.includes(name))
        )?.[0] ?? 'residential';
        return createService({ name, category: cat, pricing_type: 'custom', frequency_one_off: true, is_active: true });
      }));
      setCatalogueOpen(false);
      setToast(`${names.length} service${names.length !== 1 ? 's' : ''} added. Now add your pricing.`);
      load();
    } catch (e) {
      console.error('[CatalogueAdd] error:', e?.message, e?.code);
      setToast('Something went wrong. Try again.');
    }
  };

  const handleSaved = (name) => {
    setModal(null);
    setToast(`${name} added to your menu. Front Desk can now quote on this.`);
    load();
  };

  const handleSaveAndAdd = (name) => {
    setToast(`${name} saved.`);
    load();
  };

  const handleDuplicate = async (id) => {
    try {
      await duplicateService(id);
      setToast('Service duplicated.');
      load();
    } catch (e) {
      setToast('Something went wrong. Try again.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteService(deleteTarget.id);
      setDeleteTarget(null);
      setToast(`${deleteTarget.name} removed.`);
      load();
    } catch (e) {
      setToast('Something went wrong. Try again.');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (id, isActive) => {
    await setServiceActive(id, isActive);
    load();
  };

  const byCategory = (cat) => services.filter(s => s.category === cat);
  const countByCategory = (cat) => services.filter(s => s.category === cat).length;
  const visible = byCategory(activeCategory);

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header */}
      <div className="bg-[#040810] text-white px-5 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#4f78ff] mb-1">Services Menu</p>
            <h2 className="text-xl font-black text-white mb-1">Your services menu</h2>
            <p className="text-xs text-[rgba(153,197,255,0.6)] max-w-md">
              Like a restaurant menu, but for the services you sell. This is what Front Desk uses to quote your customers.
            </p>
          </div>
          <button
            onClick={() => openAdd()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-bold text-sm transition-colors shrink-0"
          >
            <Plus size={16} /> Add a service
          </button>
        </div>
      </div>

      {/* First-visit banner */}
      {firstVisitBanner && (
        <div className="mx-5 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#4f78ff]/10 border border-[#4f78ff]/25">
          <AlertCircle size={14} className="text-[#4f78ff] mt-0.5 shrink-0" />
          <p className="text-sm text-[#0d1a5e]">
            Heads up — anything in your services menu is what Front Desk will quote on. Keep it accurate and Front Desk will do the selling for you.
          </p>
          <button onClick={() => setFirstVisitBanner(false)} className="shrink-0 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pricing attention banner */}
      {attentionCount > 0 && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800">
            You have <span className="font-bold">{attentionCount} service{attentionCount !== 1 ? 's' : ''}</span> that need pricing added before Front Desk can quote them.
          </p>
        </div>
      )}

      {/* Category tabs */}
      <div className="px-5 sm:px-6 mt-5">
        <div className="flex gap-1 border-b border-gray-200">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={`px-4 py-2.5 text-sm font-bold border-b-2 transition-all -mb-px ${
                activeCategory === c.key
                  ? 'border-[#4f78ff] text-[#4f78ff]'
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {c.label} ({countByCategory(c.key)})
            </button>
          ))}
        </div>
      </div>

      {/* Service grid */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#4f78ff] border-t-transparent animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState category={activeCategory} onAdd={() => openAdd()} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(s => (
              <ServiceCard
                key={s.id}
                service={s}
                onEdit={openEdit}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteTarget}
                onToggleActive={handleToggleActive}
              />
            ))}
            {/* Add another card */}
            <button
              onClick={() => openAdd()}
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-12 hover:border-[#4f78ff] hover:bg-[#4f78ff]/5 transition-all group"
            >
              <Plus size={20} className="text-gray-300 group-hover:text-[#4f78ff] transition-colors" />
              <span className="text-sm text-gray-400 group-hover:text-[#4f78ff] font-semibold transition-colors">Add a service</span>
            </button>
          </div>
        )}
      </div>

      {/* Catalogue picker */}
      {catalogueOpen && (
        <CatalogueModal
          existingNames={services.map(s => s.name)}
          onAdd={handleCatalogueAdd}
          onCustom={() => openCustomAdd(activeCategory)}
          onClose={() => setCatalogueOpen(false)}
        />
      )}

      {/* Add/Edit modal */}
      {modal && (
        <ServiceModal
          initialData={modal.data}
          onSave={handleSaved}
          onSaveAndAdd={handleSaveAndAdd}
          onClose={() => setModal(null)}
        />
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          serviceName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
