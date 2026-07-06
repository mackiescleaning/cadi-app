// CatalogueEditor.jsx — the post-onboarding catalogue editor.
// Lets the owner add / remove / edit services, tiers, modifiers and durations
// after onboarding without going back through the migration flow. Reads via
// getCatalogue (same source every surface consumes) and writes via
// catalogueDb's per-table replace helpers.

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Star, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { getCatalogue, quotePrice } from '../lib/catalogue';
import { createService, deleteService, saveServiceWithChildren } from '../lib/db/catalogueDb';

const DIVISIONS = [
  { key: 'residential', label: 'Residential', accent: '#1f48ff' },
  { key: 'exterior', label: 'Exterior', accent: '#10b981' },
  { key: 'commercial', label: 'Commercial', accent: '#f59e0b' },
];

const PRICING_MODELS = [
  { key: 'flat', label: 'Flat — one fixed price' },
  { key: 'tiered', label: 'Tiered — different prices per property type' },
  { key: 'by_unit', label: 'By unit — per window / hour / sqm' },
  { key: 'by_frequency', label: 'By frequency — different prices per cadence' },
  { key: 'quote_only', label: 'Quote only — always enquiry' },
];

const BOOKING_MODES = [
  {
    key: 'instant',
    label: 'Instant book',
    hint: 'Customers see a fixed price and book straight in.',
  },
  {
    key: 'quick_quote',
    label: 'Quick quote',
    hint: 'Customers pick a tier, see price, then book.',
  },
  { key: 'enquiry', label: 'Enquiry only', hint: 'Customers enquire — you reply with a price.' },
];

const MODIFIER_TYPES = [
  { key: 'addon_fixed', label: 'Add-on (£ fixed)' },
  { key: 'addon_percent', label: 'Add-on (%)' },
  { key: 'surcharge', label: 'Surcharge (£)' },
  { key: 'discount', label: 'Discount (£)' },
];

const UNIT_TYPES = ['window', 'hour', 'sqm', 'room', 'panel', 'metre'];

export default function CatalogueEditor() {
  const [catalogue, setCatalogue] = useState(null);
  const [error, setError] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  const load = useCallback(async () => {
    try {
      setCatalogue(await getCatalogue());
    } catch (e) {
      setError(e?.message ?? "Couldn't load your catalogue.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map(DIVISIONS.map((d) => [d.key, []]));
    map.set('other', []);
    for (const s of catalogue?.services ?? []) {
      const k = s.division || 'other';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(s);
    }
    return map;
  }, [catalogue]);

  const addService = async (division) => {
    try {
      const newSvc = await createService({
        name: `New ${division ?? 'service'}`,
        division: division ?? null,
        booking_mode: 'enquiry',
        pricing_model: 'flat',
        flat_price: 0,
        duration_mins: 60,
      });
      await load();
      setExpanded((prev) => new Set(prev).add(newSvc.id));
    } catch (e) {
      setError(e?.message ?? "Couldn't add service.");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}? This removes the service and its tiers.`)) return;
    try {
      await deleteService(id);
      await load();
    } catch (e) {
      setError(e?.message ?? "Couldn't delete.");
    }
  };

  const handleSave = async (id, draft) => {
    setSavingId(id);
    try {
      await saveServiceWithChildren(id, draft);
      await load();
    } catch (e) {
      setError(e?.message ?? "Couldn't save.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!catalogue) {
    return (
      <div className="min-h-full text-[#010a4f] flex items-center justify-center p-6">
        <p className="text-sm text-[#1f48ff]">Loading catalogue…</p>
      </div>
    );
  }

  return (
    <div className="min-h-full text-[#010a4f]">
      <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#1f48ff] mb-0.5">
              Cadi
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-[#010a4f]">Services</h1>
            <p className="text-[11px] text-[#010a4f]/60 mt-1">
              Your catalogue — what Front Desk uses to quote.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-600 flex items-start gap-2">
            <AlertCircle size={12} className="text-red-600 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700">
              ✕
            </button>
          </div>
        )}

        {/* For each division, render the services + an "add new" button. */}
        {DIVISIONS.map((d) => {
          const list = grouped.get(d.key) ?? [];
          return (
            <section key={d.key} className="mb-7">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-1.5 h-5 rounded-full" style={{ background: d.accent }} />
                <h2 className="text-sm font-black text-[#010a4f]">{d.label}</h2>
                <span
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full border"
                  style={{
                    borderColor: `${d.accent}50`,
                    color: d.accent,
                    background: `${d.accent}15`,
                  }}
                >
                  {list.length}
                </span>
                <button
                  onClick={() => addService(d.key)}
                  className="ml-auto text-[11px] font-bold text-[#1f48ff] hover:text-[#010a4f] px-2 py-1 rounded-md hover:bg-[#f0f4ff] transition-colors flex items-center gap-1"
                >
                  <Plus size={12} /> Add service
                </button>
              </div>
              {list.length === 0 ? (
                <p className="text-[11px] text-[#010a4f]/45 italic py-3 px-1">
                  No {d.label.toLowerCase()} services yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {list.map((svc) => (
                    <ServiceCard
                      key={svc.id}
                      service={svc}
                      accent={d.accent}
                      expanded={expanded.has(svc.id)}
                      onToggle={() => toggleExpand(svc.id)}
                      saving={savingId === svc.id}
                      onSave={(draft) => handleSave(svc.id, draft)}
                      onDelete={() => handleDelete(svc.id, svc.name)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* "Other" division — services with no division set (legacy). */}
        {(grouped.get('other') ?? []).length > 0 && (
          <section className="mb-7">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-5 rounded-full bg-[#1f48ff]" />
              <h2 className="text-sm font-black text-[#010a4f]">Other</h2>
            </div>
            <div className="space-y-2">
              {(grouped.get('other') ?? []).map((svc) => (
                <ServiceCard
                  key={svc.id}
                  service={svc}
                  accent="#99c5ff"
                  expanded={expanded.has(svc.id)}
                  onToggle={() => toggleExpand(svc.id)}
                  saving={savingId === svc.id}
                  onSave={(draft) => handleSave(svc.id, draft)}
                  onDelete={() => handleDelete(svc.id, svc.name)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ── Per-service card ────────────────────────────────────────────────────────

function ServiceCard({ service, accent, expanded, onToggle, saving, onSave, onDelete }) {
  // Local editable draft. Replaces source-of-truth fields with what's on
  // the catalogue; commits via onSave when the user hits Save.
  const [draft, setDraft] = useState(() => initDraft(service));
  useEffect(() => {
    setDraft(initDraft(service));
  }, [service]);

  const setField = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setNested = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  // Live quote preview — owner sees what the customer would see when this
  // service is rendered through quotePrice.
  const previewSvc = useMemo(
    () => ({
      ...service,
      booking_mode: draft.booking_mode,
      pricing_model: draft.pricing_model,
      pricing_config:
        draft.pricing_model === 'flat' && draft.flat_price != null
          ? { price: Number(draft.flat_price) }
          : null,
      tiers: draft.tiers,
      units: draft.units,
      modifiers: draft.modifiers.map((m) => ({ ...m, key: m.key ?? m.label })),
    }),
    [draft, service]
  );
  const quote = useMemo(() => {
    if (draft.pricing_model === 'flat') return quotePrice(previewSvc, {});
    if (draft.pricing_model === 'tiered' && draft.tiers.length) {
      const def = draft.tiers.find((t) => t.is_default) ?? draft.tiers[0];
      return quotePrice(previewSvc, { tier_key: def.tier_key });
    }
    if (draft.pricing_model === 'by_unit') return { price: 'enquiry' };
    return quotePrice(previewSvc, {});
  }, [previewSvc, draft]);

  const save = () =>
    onSave({
      core: {
        name: draft.name,
        category: draft.division || null,
        description_included: draft.description || null,
        booking_mode: draft.booking_mode,
        pricing_model: draft.pricing_model,
        pricing_config:
          draft.pricing_model === 'flat' && draft.flat_price != null
            ? { price: Number(draft.flat_price) }
            : null,
        price_fixed_basic:
          draft.pricing_model === 'flat' && draft.flat_price != null
            ? Number(draft.flat_price)
            : null,
        default_duration_mins: draft.duration_mins != null ? Number(draft.duration_mins) : null,
        status: draft.status,
      },
      tiers: draft.pricing_model === 'tiered' ? draft.tiers : [],
      units: draft.pricing_model === 'by_unit' ? draft.units : [],
      modifiers: draft.modifiers,
      cadi_context: draft.cadi_context ?? '',
    });

  return (
    <div className="rounded-2xl border border-[#1f48ff]/15 overflow-hidden bg-white shadow-sm">
      <div
        className="relative pl-4 pr-3 py-3 cursor-pointer flex items-start gap-3"
        onClick={onToggle}
      >
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-[#010a4f] truncate">{draft.name || '—'}</p>
          <p className="text-[11px] text-[#010a4f]/60 mt-0.5 truncate">
            {PRICING_MODELS.find((p) => p.key === draft.pricing_model)?.label.split(' — ')[0]} ·{' '}
            {BOOKING_MODES.find((b) => b.key === draft.booking_mode)?.label}
          </p>
        </div>
        <div className="text-right shrink-0">
          {quote.price === 'enquiry' ? (
            <span className="text-[11px] font-bold text-[#1f48ff]">Enquiry</span>
          ) : (
            (() => {
              // Tiered services show "from £lowest" so the catalogue header
              // honestly reflects there's a price range, not a single number.
              const isTieredMulti = draft.pricing_model === 'tiered' && draft.tiers?.length > 1;
              const display = isTieredMulti
                ? Math.min(...draft.tiers.map((t) => Number(t.price) || 0))
                : Number(quote.price);
              return (
                <p className="text-sm font-black text-emerald-600 tabular-nums">
                  {isTieredMulti && (
                    <span className="text-[10px] font-bold text-emerald-600/70 uppercase mr-1">
                      from
                    </span>
                  )}
                  £{display.toFixed(2)}
                </p>
              );
            })()
          )}
        </div>
        <button className="text-[#010a4f]/45">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-[#1f48ff]/15">
          {/* Name + description */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Service name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setField('name', e.target.value)}
                className={inp}
              />
            </Field>
            <Field label="Duration (mins)">
              <input
                type="number"
                min="0"
                step="5"
                value={draft.duration_mins ?? ''}
                onChange={(e) =>
                  setField('duration_mins', e.target.value === '' ? null : Number(e.target.value))
                }
                className={inp}
              />
            </Field>
          </div>
          <Field label="Description (shown to customers)">
            <textarea
              value={draft.description ?? ''}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              className={`${inp} resize-none leading-snug`}
              placeholder="One short sentence — what's included."
            />
          </Field>

          {/* Booking mode + pricing model */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Booking mode">
              <select
                value={draft.booking_mode}
                onChange={(e) => setField('booking_mode', e.target.value)}
                className={inp}
              >
                {BOOKING_MODES.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pricing model">
              <select
                value={draft.pricing_model}
                onChange={(e) => setField('pricing_model', e.target.value)}
                className={inp}
              >
                {PRICING_MODELS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Flat price */}
          {draft.pricing_model === 'flat' && (
            <Field label="Price">
              <div className="flex items-center gap-2">
                <span className="text-sm text-emerald-600 font-bold">£</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.flat_price ?? ''}
                  onChange={(e) =>
                    setField('flat_price', e.target.value === '' ? null : Number(e.target.value))
                  }
                  className={inp}
                />
              </div>
            </Field>
          )}

          {/* Tier editor */}
          {draft.pricing_model === 'tiered' && (
            <TierEditor tiers={draft.tiers} onChange={(list) => setNested('tiers', list)} />
          )}

          {/* Unit editor */}
          {draft.pricing_model === 'by_unit' && (
            <UnitEditor units={draft.units} onChange={(list) => setNested('units', list)} />
          )}

          {/* Modifier editor */}
          <ModifierEditor
            modifiers={draft.modifiers}
            onChange={(list) => setNested('modifiers', list)}
          />

          {/* Cadi context — free-form notes that Front Desk reads when this
              service is on the table. Seeded from onboarding Q&A; owner
              edits to teach Cadi more about how to talk about this service. */}
          <Field label="What should Cadi know about this service? (Front Desk reads this)">
            <textarea
              value={draft.cadi_context ?? ''}
              onChange={(e) => setField('cadi_context', e.target.value)}
              rows={3}
              className={`${inp} resize-none leading-snug`}
              placeholder="e.g. We only do upstairs windows with a pole, never ladders. First clean takes longer because of build-up — we charge a one-off £10 surcharge. Customers usually pay by BACS."
            />
          </Field>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[#1f48ff]/15">
            <button
              onClick={onDelete}
              className="text-[11px] font-bold text-red-600/80 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 transition-colors flex items-center gap-1"
            >
              <Trash2 size={11} /> Delete service
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-[12px] font-black bg-[#1f48ff] hover:bg-[#3a5eff] text-white px-4 py-2 rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <Save size={12} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Child editors ───────────────────────────────────────────────────────────

function TierEditor({ tiers, onChange }) {
  // Setting any field on a tier also clears the is_estimated flag — once
  // the owner has touched it, it's a confirmed price.
  const setTier = (i, patch) =>
    onChange(tiers.map((t, idx) => (idx === i ? { ...t, ...patch, is_estimated: false } : t)));
  const remove = (i) => onChange(tiers.filter((_, idx) => idx !== i));
  const setDefault = (i) => onChange(tiers.map((t, idx) => ({ ...t, is_default: idx === i })));
  const add = () =>
    onChange([
      ...tiers,
      {
        tier_key: `tier${tiers.length + 1}`,
        label: 'New tier',
        price: 0,
        is_default: tiers.length === 0,
      },
    ]);

  return (
    <Field label="Tiers">
      <div className="space-y-1.5">
        {tiers.map((t, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-lg border p-2 ${
              t.is_estimated ? 'border-amber-200 bg-amber-50' : 'border-[#1f48ff]/15 bg-[#f0f4ff]'
            }`}
          >
            <button
              onClick={() => setDefault(i)}
              title={t.is_default ? 'Default tier' : 'Make default'}
              className="shrink-0"
            >
              <Star
                size={13}
                className={
                  t.is_default
                    ? 'text-amber-300 fill-amber-300'
                    : 'text-[#010a4f]/40 hover:text-amber-300'
                }
              />
            </button>
            <input
              type="text"
              value={t.label}
              onChange={(e) => setTier(i, { label: e.target.value })}
              className="flex-1 bg-transparent border-0 text-[12px] text-[#010a4f] focus:outline-none"
              placeholder="Tier name"
            />
            {t.is_estimated && (
              <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-1.5 py-0.5">
                Est.
              </span>
            )}
            <span
              className={`text-[11px] font-bold ${t.is_estimated ? 'text-amber-700/80' : 'text-emerald-600/70'}`}
            >
              £
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={t.price ?? ''}
              onChange={(e) =>
                setTier(i, { price: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              className={`w-16 text-right bg-transparent border-0 text-[12px] font-black focus:outline-none tabular-nums ${
                t.is_estimated ? 'text-amber-700' : 'text-emerald-600'
              }`}
            />
            <button
              onClick={() => remove(i)}
              className="w-6 h-6 rounded-md text-[#010a4f]/40 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="w-full py-1.5 text-[11px] font-bold text-[#1f48ff] hover:text-[#010a4f] border border-dashed border-[#1f48ff]/30 hover:border-[#1f48ff]/60 rounded-lg transition-all flex items-center justify-center gap-1"
        >
          <Plus size={11} /> Add tier
        </button>
      </div>
    </Field>
  );
}

function UnitEditor({ units, onChange }) {
  const u = units[0] ?? { unit_type: 'window', price_per_unit: 0, min_charge: null };
  const setU = (patch) => onChange([{ ...u, ...patch }]);

  return (
    <Field label={`Price per unit`}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#010a4f]/60 w-16">Unit</span>
          <select
            value={u.unit_type}
            onChange={(e) => setU({ unit_type: e.target.value })}
            className={inp}
          >
            {UNIT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#010a4f]/60 w-16">Per unit</span>
          <span className="text-sm text-emerald-600 font-bold">£</span>
          <input
            type="number"
            min="0"
            step="0.10"
            value={u.price_per_unit ?? ''}
            onChange={(e) =>
              setU({ price_per_unit: e.target.value === '' ? 0 : Number(e.target.value) })
            }
            className={inp}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#010a4f]/60 w-16">Min charge</span>
          <span className="text-sm text-emerald-600 font-bold">£</span>
          <input
            type="number"
            min="0"
            step="1"
            value={u.min_charge ?? ''}
            onChange={(e) =>
              setU({ min_charge: e.target.value === '' ? null : Number(e.target.value) })
            }
            className={inp}
            placeholder="optional floor"
          />
        </div>
      </div>
    </Field>
  );
}

function ModifierEditor({ modifiers, onChange }) {
  const setM = (i, patch) =>
    onChange(modifiers.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  const remove = (i) => onChange(modifiers.filter((_, idx) => idx !== i));
  const add = () =>
    onChange([
      ...modifiers,
      {
        key: `mod${modifiers.length + 1}`,
        label: 'New add-on',
        type: 'addon_fixed',
        value: 0,
        default_on: false,
      },
    ]);

  return (
    <Field label="Add-ons & modifiers (optional)">
      <div className="space-y-1.5">
        {modifiers.map((m, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-[#1f48ff]/15 bg-[#f0f4ff] p-2"
          >
            <input
              type="checkbox"
              checked={Boolean(m.default_on)}
              onChange={(e) => setM(i, { default_on: e.target.checked })}
              title="Default on (auto-applied)"
            />
            <input
              type="text"
              value={m.label}
              onChange={(e) => setM(i, { label: e.target.value })}
              className="flex-1 bg-transparent border-0 text-[12px] text-[#010a4f] focus:outline-none"
              placeholder="Label"
            />
            <select
              value={m.type}
              onChange={(e) => setM(i, { type: e.target.value })}
              className="text-[10px] bg-white border border-[#1f48ff]/15 rounded-md px-1.5 py-0.5 text-[#010a4f] focus:outline-none focus:border-[#1f48ff]"
            >
              {MODIFIER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.50"
              value={m.value ?? ''}
              onChange={(e) =>
                setM(i, { value: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              className="w-14 text-right bg-transparent border-0 text-[12px] font-black text-emerald-600 focus:outline-none tabular-nums"
            />
            <button
              onClick={() => remove(i)}
              className="w-6 h-6 rounded-md text-[#010a4f]/40 hover:text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        <button
          onClick={add}
          className="w-full py-1.5 text-[11px] font-bold text-[#1f48ff] hover:text-[#010a4f] border border-dashed border-[#1f48ff]/30 hover:border-[#1f48ff]/60 rounded-lg transition-all flex items-center justify-center gap-1"
        >
          <Plus size={11} /> Add modifier
        </button>
      </div>
    </Field>
  );
}

// ── Tiny field wrapper ─────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#1f48ff] mb-1">{label}</p>
      {children}
    </div>
  );
}

const inp =
  'w-full bg-white border border-[#1f48ff]/15 rounded-lg px-2.5 py-1.5 text-[12px] text-[#010a4f] placeholder-[#010a4f]/35 focus:outline-none focus:border-[#1f48ff]';

// ── Helpers ─────────────────────────────────────────────────────────────────

function initDraft(svc) {
  return {
    name: svc.name ?? '',
    division: svc.division ?? '',
    description: svc.description ?? '',
    duration_mins: svc.duration_mins ?? null,
    booking_mode: svc.booking_mode ?? 'enquiry',
    pricing_model: svc.pricing_model ?? 'flat',
    flat_price: Number(svc?.pricing_config?.price ?? svc?.display_price?.amount ?? 0) || null,
    tiers: (svc.tiers ?? []).map((t) => ({
      tier_key: t.key,
      label: t.label,
      price: Number(t.price) || 0,
      is_default: Boolean(t.is_default),
      is_estimated: Boolean(t.is_estimated),
    })),
    units: (svc.units ?? []).map((u) => ({
      unit_type: u.unit_type,
      price_per_unit: Number(u.price_per_unit) || 0,
      min_units: u.min_units != null ? Number(u.min_units) : null,
      min_charge: u.min_charge != null ? Number(u.min_charge) : null,
    })),
    modifiers: (svc.modifiers ?? []).map((m) => ({
      key: m.key,
      label: m.label,
      type: m.type,
      value: Number(m.value) || 0,
      default_on: Boolean(m.default_on),
    })),
    cadi_context: svc.cadi_context ?? '',
    status: 'live',
  };
}
