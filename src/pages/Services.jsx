// Services.jsx — Services Menu page
// The editable menu of cleaning services. Front Desk's single source of truth for quoting.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Plus, MoreHorizontal, ChevronDown, ChevronUp, X, AlertCircle, Check,
  Pencil, Copy, Trash2, MessageSquare,
} from 'lucide-react';
import {
  listServices, createService, updateService, deleteService,
  setServiceActive, duplicateService,
  formatPricingSummary, formatDuration, getFrequencyLabels, serviceHasPricing,
  countServicesNeedingPricing, seedServicesFromOnboarding,
} from '../lib/db/servicesDb';
import { supabase } from '../lib/supabase';
import ServiceChat from '../components/ServiceChat';
import ServiceTemplatePicker from '../components/ServiceTemplatePicker';
import PriceListImporter from '../components/PriceListImporter';
import FrontDeskPreview from '../components/FrontDeskPreview';

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

// Category → sector colour. Used by ServiceCard, category tabs, the future
// public Menu view. Keep this the single source of truth for category styling.
export const SECTORS = {
  residential: {
    label: 'Residential',
    accent: '#1f48ff',
    bar:    'bg-[#1f48ff]',
    chip:   'bg-[#1f48ff]/15 text-[#99c5ff] border-[#1f48ff]/30',
    soft:   'from-[#1f48ff]/10',
    icon:   '🏠',
  },
  exterior: {
    label: 'Exterior',
    accent: '#10b981',
    bar:    'bg-emerald-500',
    chip:   'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    soft:   'from-emerald-500/10',
    icon:   '🪟',
  },
  commercial: {
    label: 'Commercial',
    accent: '#f59e0b',
    bar:    'bg-orange-500',
    chip:   'bg-orange-500/15 text-orange-300 border-orange-500/30',
    soft:   'from-orange-500/10',
    icon:   '🏢',
  },
};

const CATEGORIES = [
  { key: 'residential', label: SECTORS.residential.label },
  { key: 'exterior',    label: SECTORS.exterior.label    },
  { key: 'commercial',  label: SECTORS.commercial.label  },
];

const PRICING_TYPES = [
  { value: 'per_size', label: 'By property size (2 bed, 3 bed…)' },
  { value: 'hourly',   label: 'Hourly rate'                       },
  { value: 'fixed',    label: 'Single fixed price'                },
  { value: 'per_sqm',  label: 'Per square metre'                  },
  { value: 'per_room', label: 'Per room'                          },
  { value: 'custom',   label: 'Custom (quote each job)'           },
];

const DEFAULT_SIZE_TIERS = [
  { label: 'Studio / 1 bed', price: '' },
  { label: '2 bed',          price: '' },
  { label: '3 bed',          price: '' },
  { label: '4 bed',          price: '' },
  { label: '5 bed+',         price: '' },
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
  pricing_type: 'per_size',
  pricing_matrix: DEFAULT_SIZE_TIERS.map(t => ({ ...t })),
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
  site_visit_required: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function numericField(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function formToRecord(form) {
  const matrix = form.pricing_type === 'per_size'
    ? (form.pricing_matrix ?? []).filter(r => r.label?.trim() && r.price !== '').map(r => ({ label: r.label.trim(), price: parseFloat(r.price) })).filter(r => !isNaN(r.price))
    : null;
  return {
    category: form.category,
    name: form.name.trim(),
    description_included: form.description_included.trim() || null,
    description_excluded: form.description_excluded.trim() || null,
    pricing_type: form.pricing_type,
    pricing_matrix: matrix,
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
    site_visit_required: form.site_visit_required ?? false,
  };
}

function recordToForm(record) {
  const matrix = record.pricing_matrix?.length
    ? record.pricing_matrix.map(r => ({ label: r.label, price: String(r.price) }))
    : DEFAULT_SIZE_TIERS.map(t => ({ ...t }));
  return {
    ...EMPTY_FORM,
    ...record,
    pricing_matrix: matrix,
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

function PricingMatrixEditor({ rows, onChange }) {
  const updateRow = (i, field, val) => {
    const next = rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r);
    onChange(next);
  };
  const addRow = () => onChange([...rows, { label: '', price: '' }]);
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <p className="text-xs text-[rgba(153,197,255,0.5)]">
        Set a price for each size you offer. Front Desk will ask the customer how many bedrooms and quote the right price automatically.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={row.label}
              onChange={e => updateRow(i, 'label', e.target.value)}
              placeholder="e.g. 2 bed"
              className="flex-1 px-3 py-2 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.2)] text-white text-sm placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#4f78ff]"
            />
            <div className="flex items-center bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.2)] rounded-lg overflow-hidden focus-within:border-[#4f78ff] w-28">
              <span className="px-2 text-sm text-[rgba(153,197,255,0.6)] border-r border-[rgba(153,197,255,0.2)]">£</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={row.price}
                onChange={e => updateRow(i, 'price', e.target.value)}
                placeholder="0.00"
                className="flex-1 px-2 py-2 bg-transparent text-white text-sm placeholder-[rgba(153,197,255,0.3)] focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[rgba(153,197,255,0.4)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-xs text-[#4f78ff] hover:text-[#99c5ff] font-semibold flex items-center gap-1 mt-1"
      >
        <Plus size={12} /> Add another size
      </button>
    </div>
  );
}

function PricingFields({ form, patch }) {
  if (form.pricing_type === 'per_size') return (
    <PricingMatrixEditor
      rows={form.pricing_matrix ?? DEFAULT_SIZE_TIERS.map(t => ({ ...t }))}
      onChange={matrix => patch({ pricing_matrix: matrix })}
    />
  );

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
      <p className="text-xs text-[rgba(153,197,255,0.5)]">One fixed price regardless of size. Use "By property size" if you charge differently per bedroom.</p>
      <NumberInput prefix="£" value={form.price_fixed_basic} onChange={v => patch({ price_fixed_basic: v })} placeholder="0.00" />
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
      <p className="text-xs text-[#99c5ff]">Front Desk will gather enquiry details and flag this job for you to quote manually.</p>
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
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button>
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
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
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

          {/* Site visit required toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[rgba(153,197,255,0.04)]">
            <div>
              <p className="text-sm font-bold text-white">Needs a site visit</p>
              <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
                {form.site_visit_required
                  ? 'Front Desk will collect contact details and request a visit — no instant quote.'
                  : 'Front Desk will quote this service instantly.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => patch({ site_visit_required: !form.site_visit_required })}
              className={`w-12 h-6 rounded-full flex items-center transition-all px-0.5 ${
                form.site_visit_required ? 'bg-[#4f78ff] justify-end' : 'bg-[rgba(153,197,255,0.15)] justify-start'
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
    try {
      await onToggleActive(service.id, !service.is_active);
    } finally {
      setToggling(false);
    }
  };

  const freq = getFrequencyLabels(service);
  const duration = formatDuration(service);
  const pricing = formatPricingSummary(service);

  const sector = SECTORS[service.category] ?? SECTORS.residential;

  return (
    <div
      className={`group relative rounded-xl border overflow-hidden transition-all ${
        service.is_active
          ? 'border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.25)] hover:-translate-y-[1px]'
          : 'border-[rgba(153,197,255,0.06)] opacity-50'
      }`}
      style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
    >
      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent" />

      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Sector accent bar (left) */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${sector.bar}`} />

      {/* Pricing warning */}
      {!hasPricing && service.is_active && (
        <div className="relative flex items-center gap-1.5 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <AlertCircle size={12} className="text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 font-medium">Add pricing so Front Desk can quote this.</p>
        </div>
      )}

      <div className="relative p-4 pl-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-black text-white text-sm leading-tight">{service.name}</h3>
            <span className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${sector.chip}`}>
              <span className="text-[11px] leading-none">{sector.icon}</span>
              {sector.label}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Active toggle */}
            <button
              onClick={handleToggle}
              disabled={toggling}
              title={service.is_active ? 'Pause this service' : 'Reactivate this service'}
              aria-label={service.is_active ? 'Pause service' : 'Reactivate service'}
              className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-all ${
                service.is_active ? 'bg-[#1f48ff] justify-end' : 'bg-[rgba(153,197,255,0.12)] justify-start'
              } ${toggling ? 'opacity-60' : ''}`}
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
            </button>
            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(o => !o)}
                aria-label="More actions"
                className="w-7 h-7 rounded-lg border border-[rgba(153,197,255,0.15)] bg-white/5 flex items-center justify-center hover:bg-white/10 hover:border-[rgba(153,197,255,0.3)] transition-colors"
              >
                <MoreHorizontal size={14} className="text-[#99c5ff]" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute right-0 top-9 z-20 rounded-xl border border-[rgba(153,197,255,0.15)] shadow-2xl w-44 py-1 overflow-hidden"
                    style={{ background: 'linear-gradient(145deg, #05124a 0%, #0a1860 100%)' }}
                  >
                    <button onClick={() => { setMenuOpen(false); onEdit(service); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors">
                      <MessageSquare size={13} className="text-[#99c5ff]" /> Edit with Cadi
                    </button>
                    <button onClick={() => { setMenuOpen(false); onDuplicate(service.id); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white hover:bg-white/5 transition-colors">
                      <Copy size={13} className="text-[#99c5ff]" /> Duplicate
                    </button>
                    <div className="h-px bg-[rgba(153,197,255,0.1)] my-1" />
                    <button onClick={() => { setMenuOpen(false); onDelete(service); }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/10 transition-colors">
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
          <p className="text-xs text-[rgba(153,197,255,0.55)] mt-3 mb-3 line-clamp-2 leading-relaxed">
            {service.description_included}
          </p>
        )}

        {/* Pricing + duration */}
        <div className="flex items-center gap-3 mt-3 mb-3">
          <span className={`text-base font-black tabular-nums ${hasPricing ? 'text-emerald-300' : 'text-amber-300'}`}>
            {pricing}
          </span>
          {duration && <span className="text-[11px] text-[rgba(153,197,255,0.4)] font-semibold">{duration}</span>}
        </div>

        {/* Frequency pills */}
        {freq.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {freq.map(f => (
              <span
                key={f}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-[rgba(153,197,255,0.7)] border border-[rgba(153,197,255,0.12)]"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ category, onAdd, onUseTemplate, onChat, onImport }) {
  const navigate = useNavigate();
  const examples = {
    residential: ['regular domestic clean', 'deep clean', 'end of tenancy'],
    exterior:    ['window cleaning', 'gutter clearance', 'pressure washing'],
    commercial:  ['office clean', 'school clean', 'retail clean'],
  };
  const sector = SECTORS[category] ?? SECTORS.residential;
  const label = sector.label;
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6 max-w-md mx-auto">
      <div
        className="w-16 h-16 rounded-2xl border flex items-center justify-center mb-4 text-2xl"
        style={{
          background: `linear-gradient(145deg, ${sector.accent}25, ${sector.accent}08)`,
          borderColor: `${sector.accent}40`,
        }}
      >
        {sector.icon}
      </div>
      <h3 className="font-black text-white text-lg mb-1">Build your {label.toLowerCase()} menu.</h3>
      <p className="text-sm text-[rgba(153,197,255,0.6)] mb-5 leading-relaxed">
        Cadi uses this menu to quote, schedule, and invoice — pick the fastest way in.
      </p>
      <div className="flex flex-col gap-2 w-full">
        <button
          onClick={() => navigate('/onboarding/customers')}
          className="w-full px-4 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm shadow-lg shadow-[#1f48ff]/30 transition-all"
        >
          ✨ Build it from your customers
        </button>
        {onImport && (
          <button
            onClick={onImport}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[rgba(153,197,255,0.2)] hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.1)] text-[#99c5ff] hover:text-white font-semibold text-sm transition-all"
          >
            📷 Snap your price list
          </button>
        )}
        {onUseTemplate && (
          <button
            onClick={() => onUseTemplate(category)}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[rgba(153,197,255,0.2)] hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.1)] text-[#99c5ff] hover:text-white font-semibold text-sm transition-all"
          >
            ⚡ Start from a {label.toLowerCase()} template
          </button>
        )}
        {onChat && (
          <button
            onClick={onChat}
            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[rgba(153,197,255,0.2)] hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.1)] text-[#99c5ff] hover:text-white font-semibold text-sm transition-all"
          >
            💬 Describe a service to Cadi
          </button>
        )}
        <button
          onClick={onAdd}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-[rgba(153,197,255,0.2)] hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.1)] text-[#99c5ff] hover:text-white font-semibold text-sm transition-all"
        >
          + Add one by hand
        </button>
      </div>
      <p className="text-[11px] text-[rgba(153,197,255,0.4)] mt-5">
        Typical {label.toLowerCase()}: {examples[category]?.join(' · ')}.
      </p>
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
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-xl border border-[rgba(153,197,255,0.25)] text-white text-sm font-semibold shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom backdrop-blur-md"
      style={{ background: 'linear-gradient(145deg, #05124a 0%, #0d1e78 100%)' }}
    >
      <Check size={14} className="text-emerald-400" /> {message}
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
  // Chat-based service builder — null when closed, or { context, editService?, editField?, onboardingServices? }
  const [chatSession, setChatSession] = useState(null);
  const [templatePickerCategory, setTemplatePickerCategory] = useState(null);
  const [importerOpen, setImporterOpen] = useState(false);

  const handleTemplateApplied = async ({ pack, count }) => {
    const refreshed = await listServices({ includeInactive: true });
    setServices(refreshed);
    setAttentionCount(refreshed.filter(s => s.is_active && !serviceHasPricing(s)).length);
    setToast(`${count} services added from "${pack.label}". Tweak prices anytime.`);
  };

  const handleImporterApplied = async ({ count }) => {
    const refreshed = await listServices({ includeInactive: true });
    setServices(refreshed);
    setAttentionCount(refreshed.filter(s => s.is_active && !serviceHasPricing(s)).length);
    setToast(`${count} services imported from your price list. Edit any of them anytime.`);
  };
  const [showPreview, setShowPreview] = useState(false);

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
          if (seeded.length > 0) {
            // Open the conversational builder automatically for first-time setup
            const chatAlreadyOpened = localStorage.getItem('cadi_services_chat_opened');
            if (!chatAlreadyOpened) {
              localStorage.setItem('cadi_services_chat_opened', '1');
              const serviceNames = seeded.map(s => s.name);
              setChatSession({ context: 'first_setup', onboardingServices: serviceNames });
            } else {
              setToast(`${seeded.length} service${seeded.length !== 1 ? 's' : ''} imported. Add pricing so Front Desk can quote them.`);
            }
          }
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

  const openAdd = () => setChatSession({ context: 'add_new' });
  const openCustomAdd = (category = activeCategory) => { setCatalogueOpen(false); setModal({ mode: 'add', data: { category } }); };
  const openEdit = (service) => setChatSession({ context: 'edit', editService: service });

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
    try {
      await setServiceActive(id, isActive);
      load();
    } catch (e) {
      setToast('Couldn\'t update that service. Try again in a moment.');
    }
  };

  const handleChatDone = (serviceName) => {
    setChatSession(null);
    if (serviceName) setToast(`${serviceName} saved.`);
    load();
  };

  const byCategory = (cat) => services.filter(s => s.category === cat);
  const countByCategory = (cat) => services.filter(s => s.category === cat).length;
  const visible = byCategory(activeCategory);

  return (
    <div className="flex flex-col h-full bg-[#010a4f] overflow-y-auto">
      {/* Top-edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/40 to-transparent z-10 pointer-events-none" />

      {/* Header */}
      <div className="relative bg-[#010a4f]/80 backdrop-blur-sm border-b border-[rgba(153,197,255,0.1)] px-5 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-1">Services Menu</p>
            <h2 className="text-xl font-black text-white mb-1">Your services menu</h2>
            <p className="text-xs text-[rgba(153,197,255,0.6)] max-w-md">
              Like a restaurant menu, but for the services you sell. This is what Front Desk uses to quote your customers.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={() => setImporterOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[rgba(153,197,255,0.2)] bg-white/5 text-[#99c5ff] font-bold text-sm transition-all hover:bg-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.35)]"
              title="Bring in your existing price list — photo, URL or paste"
            >
              📷 Import price list
            </button>
            <button
              onClick={() => setTemplatePickerCategory(activeCategory)}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[rgba(153,197,255,0.2)] bg-white/5 text-[#99c5ff] font-bold text-sm transition-all hover:bg-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.35)]"
              title="Add a starter pack by sub-industry"
            >
              ⚡ Templates
            </button>
            <button
              onClick={() => navigate('/services/catalogue')}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[#1f48ff]/40 bg-[#1f48ff]/10 text-[#99c5ff] font-bold text-sm transition-all hover:bg-[#1f48ff]/20 hover:border-[#1f48ff]/60"
              title="Tiers, modifiers, durations + per-service pricing"
            >
              ✎ Edit catalogue
            </button>
            <button
              onClick={() => navigate('/menu/preview')}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-bold text-sm transition-all hover:bg-emerald-500/15 hover:border-emerald-500/50"
              title="See your shareable menu — the version your customers see"
            >
              ✨ Preview menu
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-[rgba(153,197,255,0.2)] bg-white/5 text-[#99c5ff] font-bold text-sm transition-all hover:bg-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.35)]"
            >
              <MessageSquare size={15} /> Try Front Desk
            </button>
            <button
              onClick={() => openAdd()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-bold text-sm transition-all shadow-lg shadow-[#1f48ff]/30"
            >
              <Plus size={16} /> Add a service
            </button>
          </div>
        </div>
      </div>

      {/* First-visit banner */}
      {firstVisitBanner && (
        <div className="mx-5 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-[#1f48ff]/10 border border-[#1f48ff]/25">
          <AlertCircle size={14} className="text-[#99c5ff] mt-0.5 shrink-0" />
          <p className="text-sm text-[#99c5ff] flex-1">
            Heads up — anything in your services menu is what Front Desk will quote on. Keep it accurate and Front Desk will do the selling for you.
          </p>
          <button onClick={() => setFirstVisitBanner(false)} aria-label="Dismiss" className="shrink-0 text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pricing attention banner */}
      {attentionCount > 0 && (
        <div className="mx-5 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25">
          <AlertCircle size={14} className="text-amber-400 shrink-0" />
          <p className="text-sm text-amber-200 flex-1">
            You have <span className="font-bold text-amber-100">{attentionCount} service{attentionCount !== 1 ? 's' : ''}</span> that need pricing added before Front Desk can quote them.
          </p>
          <button
            onClick={() => {
              const unpricedNames = services.filter(s => s.is_active && !serviceHasPricing(s)).map(s => s.name);
              setChatSession({ context: 'first_setup', onboardingServices: unpricedNames });
            }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors"
          >
            <MessageSquare size={11} /> Set up with Cadi
          </button>
        </div>
      )}

      {/* Category tabs */}
      <div className="px-5 sm:px-6 mt-5">
        <div className="flex gap-1 border-b border-[rgba(153,197,255,0.12)] overflow-x-auto no-scrollbar">
          {CATEGORIES.map(c => {
            const sector = SECTORS[c.key];
            const isActive = activeCategory === c.key;
            const count = countByCategory(c.key);
            return (
              <button
                key={c.key}
                onClick={() => setActiveCategory(c.key)}
                className={`relative px-4 py-2.5 text-sm font-bold transition-all -mb-px whitespace-nowrap flex items-center gap-2 ${
                  isActive
                    ? 'text-white'
                    : 'text-[rgba(153,197,255,0.45)] hover:text-[#99c5ff]'
                }`}
              >
                <span className={`text-[13px] ${isActive ? '' : 'opacity-50'}`}>{sector.icon}</span>
                <span>{c.label}</span>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md tabular-nums ${
                  isActive
                    ? `${sector.chip}`
                    : 'bg-white/5 text-[rgba(153,197,255,0.5)] border border-[rgba(153,197,255,0.1)]'
                }`}>
                  {count}
                </span>
                {isActive && (
                  <span
                    className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                    style={{ background: sector.accent }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Service grid */}
      <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#99c5ff] border-t-transparent animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            category={activeCategory}
            onAdd={() => openAdd()}
            onChat={() => setChatSession({ context: 'add_new' })}
            onUseTemplate={(cat) => setTemplatePickerCategory(cat)}
            onImport={() => setImporterOpen(true)}
          />
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
              className="group flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[rgba(153,197,255,0.15)] rounded-xl py-12 hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.05)] transition-all"
            >
              <Plus size={20} className="text-[rgba(153,197,255,0.4)] group-hover:text-[#99c5ff] transition-colors" />
              <span className="text-sm text-[rgba(153,197,255,0.5)] group-hover:text-white font-semibold transition-colors">Add a service</span>
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

      {/* Conversational service builder */}
      {chatSession && (
        <ServiceChat
          context={chatSession.context}
          onboardingServices={chatSession.onboardingServices || []}
          editService={chatSession.editService || null}
          editField={chatSession.editField || null}
          onDone={() => {
            const name = chatSession.editService?.name;
            handleChatDone(name);
          }}
          onUseForm={() => {
            const ctx = chatSession;
            setChatSession(null);
            if (ctx.context === 'edit' && ctx.editService) {
              setModal({ mode: 'edit', data: ctx.editService });
            } else {
              setCatalogueOpen(true);
            }
          }}
        />
      )}

      {/* Front Desk preview */}
      {showPreview && <FrontDeskPreview onClose={() => setShowPreview(false)} />}

      {/* Sub-industry template packs */}
      {templatePickerCategory && (
        <ServiceTemplatePicker
          category={templatePickerCategory}
          onClose={() => setTemplatePickerCategory(null)}
          onApplied={handleTemplateApplied}
        />
      )}

      {/* Photo / URL / paste → AI-extracted menu */}
      {importerOpen && (
        <PriceListImporter
          onClose={() => setImporterOpen(false)}
          onApplied={handleImporterApplied}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
