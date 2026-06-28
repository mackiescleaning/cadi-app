// quotePrice — the single pricing brain that every surface reads through.
// Pure JS, deterministic, no side effects. Front Desk widget, booking portal,
// scheduler, photo-quoter, monthly report, Cadi Score — all of them route
// through here. If pricing rules change, this file is the only file to edit.
//
// Spec §7 contract:
//   quotePrice(service, selections) -> { price: number | "enquiry", breakdown: [] }
//   selections = { tier_key?, units?, frequency?, modifiers?: string[] }
//
// Rules (in order):
//   1. booking_mode === 'enquiry' → ALWAYS returns "enquiry" (the floor)
//   2. pricing_model picks the base:
//        flat        → service.pricing_config.price
//        tiered      → matching tier (by tier_key, or default)
//        by_unit     → units * price_per_unit (apply min_charge)
//        by_frequency→ rates[frequency]
//        quote_only  → "enquiry"
//   3. Modifiers apply in sort_order. default_on always applied unless
//      the selection explicitly drops them.
//   4. addon_fixed / surcharge ADD £ to base.
//      discount SUBTRACTS £.
//      addon_percent = value as percent of base (e.g. value=10 means +10%).

const MODIFIER_TYPES = new Set(['addon_fixed', 'addon_percent', 'surcharge', 'discount']);

export function quotePrice(service, selections = {}) {
  // Floor: enquiry overrides everything.
  if (!service || service.booking_mode === 'enquiry' || service.pricing_model === 'quote_only') {
    return { price: 'enquiry', breakdown: [{ label: 'Enquiry only', value: null }] };
  }

  const breakdown = [];
  let base = null;

  switch (service.pricing_model) {
    case 'flat': {
      const v = Number(service?.pricing_config?.price);
      base = Number.isFinite(v) ? v : null;
      if (base != null) breakdown.push({ label: 'Base price', value: base });
      break;
    }

    case 'tiered': {
      const tiers = Array.isArray(service.tiers) ? service.tiers : [];
      let pick = null;
      if (selections.tier_key) {
        pick = tiers.find(t => t.key === selections.tier_key) ?? null;
      }
      if (!pick) pick = tiers.find(t => t.is_default) ?? tiers[0] ?? null;
      if (pick) {
        base = Number(pick.price);
        breakdown.push({ label: pick.label ?? 'Tier', value: base });
      }
      break;
    }

    case 'by_unit': {
      const units = Array.isArray(service.units) ? service.units : [];
      const unit = units[0];
      if (!unit) break;
      const count = Number(selections.units);
      if (!Number.isFinite(count) || count <= 0) {
        // Can't compute without a unit count — surfaces should ask. Treat
        // as enquiry until the user supplies a count.
        return { price: 'enquiry', breakdown: [{ label: 'Awaiting unit count', value: null }] };
      }
      let total = count * Number(unit.price_per_unit);
      breakdown.push({ label: `${count} × £${unit.price_per_unit}/${unit.unit_type}`, value: total });
      if (Number.isFinite(Number(unit.min_charge)) && total < Number(unit.min_charge)) {
        const top = Number(unit.min_charge) - total;
        breakdown.push({ label: `Minimum charge top-up`, value: top });
        total = Number(unit.min_charge);
      }
      base = total;
      break;
    }

    case 'by_frequency': {
      const rates = service?.pricing_config?.rates ?? {};
      const key   = selections.frequency || service?.pricing_config?.default_frequency;
      const v     = key != null ? Number(rates[key]) : NaN;
      if (Number.isFinite(v)) {
        base = v;
        breakdown.push({ label: key, value: base });
      } else {
        return { price: 'enquiry', breakdown: [{ label: 'Frequency required', value: null }] };
      }
      break;
    }

    default:
      return { price: 'enquiry', breakdown: [{ label: 'Unknown pricing model', value: null }] };
  }

  if (base == null || !Number.isFinite(base)) {
    return { price: 'enquiry', breakdown: [{ label: 'No base price configured', value: null }] };
  }

  // Apply modifiers — default_on unless the caller passes selections.modifiers
  // explicitly (a list of modifier keys to include).
  const allMods = Array.isArray(service.modifiers) ? service.modifiers : [];
  let selectedMods;
  if (selections.modifiers === undefined) {
    // No selection — auto-apply all default_on
    selectedMods = allMods.filter(m => m.default_on);
  } else {
    const set = new Set(selections.modifiers);
    selectedMods = allMods.filter(m => set.has(m.key));
  }

  let running = base;
  for (const m of selectedMods.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (!MODIFIER_TYPES.has(m.type)) continue;
    const v = Number(m.value);
    if (!Number.isFinite(v)) continue;
    if (m.type === 'addon_fixed' || m.type === 'surcharge') {
      running += v;
      breakdown.push({ label: m.label, value: v });
    } else if (m.type === 'addon_percent') {
      const pct = base * (v / 100);
      running += pct;
      breakdown.push({ label: `${m.label} (${v}%)`, value: Math.round(pct * 100) / 100 });
    } else if (m.type === 'discount') {
      running -= v;
      breakdown.push({ label: m.label, value: -v });
    }
  }

  // Round to 2dp to avoid float dust in displays.
  const price = Math.round(running * 100) / 100;
  return { price, breakdown };
}
