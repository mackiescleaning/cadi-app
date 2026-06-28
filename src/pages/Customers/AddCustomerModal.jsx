import { useState } from "react";
import { useEscapeKey } from "../../hooks/useEscapeKey";
import { lookupPostcode } from "../../lib/postcode";
import { StarRating } from "./primitives";

export default function AddCustomerModal({ onClose, onSave, customer: editCustomer }) {
  useEscapeKey(onClose);
  const isEdit = Boolean(editCustomer);
  const [pcLookup, setPcLookup] = useState({ status: 'idle', msg: '' });
  const [form, setForm] = useState({
    name:        editCustomer?.name        ?? "",
    email:       editCustomer?.email       ?? "",
    phone:       editCustomer?.phone       ?? "",
    addressLine1:editCustomer?.addressLine1 ?? "",
    addressLine2:editCustomer?.addressLine2 ?? "",
    town:        editCustomer?.town        ?? "",
    county:      editCustomer?.county      ?? "",
    postcode:    editCustomer?.postcode    ?? "",
    frequency:   editCustomer?.frequency   ?? "one-off",
    status:      editCustomer?.status      ?? "active",
    notes:       editCustomer?.notes       ?? "",
    source:      editCustomer?.source      ?? "",
    rating:      editCustomer?.rating      ?? 0,
    segment:     editCustomer?.segment && editCustomer.segment !== 'unsegmented'
                   ? editCustomer.segment : "unsegmented",
    birthday:      editCustomer?.birthday      ?? "",
    customerSince: editCustomer?.customerSince ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const customer = {
        ...(isEdit ? editCustomer : {}),
        id: isEdit ? editCustomer.id : crypto.randomUUID(),
        name:         form.name.trim(),
        email:        form.email.trim(),
        phone:        form.phone.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        town:         form.town.trim(),
        county:       form.county.trim(),
        postcode:     form.postcode.trim().toUpperCase(),
        frequency:    form.frequency,
        status:       form.status,
        rating:       form.rating || 0,
        segment:      form.segment,
        segmentSource:'owner_set',
        notes:        form.notes.trim(),
        source:       form.source.trim(),
        birthday:     form.birthday || null,
        customerSince:form.customerSince || null,
        ...(!isEdit ? {
          serviceTypes: [],
          tags: [],
          lastJobDate: new Date().toISOString().slice(0, 10),
          nextJobDate: null,
          lifetimeValue: 0,
          services: [],
        } : {}),
      };
      onSave(customer);
    } catch (err) {
      setError(err.message || "Couldn't save customer.");
      setSaving(false);
    }
  };

  const inputCls = "w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors";
  const labelCls = "block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] mb-1";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="addcust-title"
      onClick={onClose}
    >
      <div
        className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)] w-full max-w-md flex flex-col"
        style={{ background: "linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/60 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Customers</p>
            <h3 id="addcust-title" className="text-lg font-black text-white">{isEdit ? "Edit customer" : "Add new customer"}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.10)] text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.25)] transition-all text-sm"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="relative overflow-y-auto px-5 py-4 space-y-4 max-h-[70vh]">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
              <span>⚠</span> {error}
            </div>
          )}

          <div>
            <label className={labelCls}>Customer type</label>
            <div className="flex gap-1.5">
              {[
                { value: "residential", label: "Residential", icon: "🏠" },
                { value: "commercial",  label: "Commercial",  icon: "🏢" },
                { value: "exterior",    label: "Exterior",    icon: "🏗" },
              ].map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set("segment", value)}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                    form.segment === value
                      ? "bg-[#1f48ff]/20 border-[#1f48ff]/50 text-white"
                      : "bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.25)]"
                  }`}
                >
                  <span className="text-base">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Full name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              placeholder="Jane Smith"
              required
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                placeholder="jane@example.com" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.phone} onChange={e => set("phone", e.target.value)}
                placeholder="07700 900000" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Postcode</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.postcode}
                onChange={e => { set("postcode", e.target.value.toUpperCase()); setPcLookup({ status: 'idle', msg: '' }); }}
                onKeyDown={async e => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  setPcLookup({ status: 'loading', msg: 'Looking up…' });
                  const r = await lookupPostcode(form.postcode);
                  if (!r) { setPcLookup({ status: 'error', msg: 'Postcode not found' }); return; }
                  set('postcode', r.postcode);
                  if (r.town   && !form.town)   set('town', r.town);
                  if (r.county && !form.county) set('county', r.county);
                  setPcLookup({ status: 'ok', msg: `${r.town ?? ''}${r.county ? ' · ' + r.county : ''}`.trim() });
                }}
                placeholder="SW1A 1AA  (enter to look up)"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={async () => {
                  setPcLookup({ status: 'loading', msg: 'Looking up…' });
                  const r = await lookupPostcode(form.postcode);
                  if (!r) { setPcLookup({ status: 'error', msg: 'Postcode not found' }); return; }
                  set('postcode', r.postcode);
                  if (r.town   && !form.town)   set('town', r.town);
                  if (r.county && !form.county) set('county', r.county);
                  setPcLookup({ status: 'ok', msg: `${r.town ?? ''}${r.county ? ' · ' + r.county : ''}`.trim() });
                }}
                disabled={!form.postcode || pcLookup.status === 'loading'}
                className="px-3 py-2.5 rounded-xl border border-[rgba(153,197,255,0.2)] bg-[rgba(153,197,255,0.08)] text-xs font-bold text-[#99c5ff] hover:border-[#99c5ff] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                Look up
              </button>
            </div>
            {pcLookup.status !== 'idle' && (
              <p className={`text-[10px] mt-1 ${
                pcLookup.status === 'ok'    ? 'text-emerald-400' :
                pcLookup.status === 'error' ? 'text-red-400'     :
                                              'text-[rgba(153,197,255,0.5)]'
              }`}>
                {pcLookup.status === 'ok' ? '✓ ' : ''}{pcLookup.msg}
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Address Line 1</label>
            <input type="text" value={form.addressLine1} onChange={e => set("addressLine1", e.target.value)}
              placeholder="12 High Street" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Address Line 2 <span className="normal-case font-normal opacity-60">(optional)</span></label>
            <input type="text" value={form.addressLine2} onChange={e => set("addressLine2", e.target.value)}
              placeholder="Flat 3" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Town / City</label>
              <input type="text" value={form.town} onChange={e => set("town", e.target.value)}
                placeholder="London" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>County</label>
              <input type="text" value={form.county} onChange={e => set("county", e.target.value)}
                placeholder="Greater London" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Frequency</label>
              <select value={form.frequency} onChange={e => set("frequency", e.target.value)}
                className={inputCls}>
                <option value="one-off">One-off</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="6-weekly">6-weekly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className={inputCls}>
                <option value="active">Active</option>
                <option value="at-risk">At risk</option>
                <option value="lapsed">Lapsed</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <input type="text" value={form.source} onChange={e => set("source", e.target.value)}
                placeholder="Referral, leaflet…" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Birthday <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input type="date" value={form.birthday} onChange={e => set("birthday", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Customer since</label>
              <input type="date" value={form.customerSince} onChange={e => set("customerSince", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              placeholder="Access codes, preferences, allergies…"
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div>
            <label className={labelCls}>Rating</label>
            <StarRating value={form.rating || 0} onChange={r => set('rating', r)} size="sm" />
          </div>

          <div className="flex gap-3 pt-1 pb-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-bold hover:border-[rgba(153,197,255,0.3)] hover:text-white transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black transition-all shadow-lg shadow-[#1f48ff]/25 disabled:opacity-50">
              {saving ? "Saving…" : isEdit ? "Save changes →" : "Save customer →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
