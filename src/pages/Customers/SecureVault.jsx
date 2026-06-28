import { useState, useEffect } from "react";
import { GlassCard } from "./primitives";
import { readVault, writeVault } from "../../lib/db/secureVaultDb";

const EMPTY = { keyCode: "", alarmCode: "", gateCode: "", accessNotes: "" };

export default function SecureVault({ customer }) {
  const [vaultData, setVaultData] = useState(EMPTY);
  const [editForm,  setEditForm]  = useState(EMPTY);
  const [editing,   setEditing]   = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState(null);

  // Pull on mount + whenever the active customer changes. The read RPC
  // writes an audit_log entry every time — so we deliberately don't refetch
  // on focus/visibility, only when the user opens a new profile.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    readVault(customer.id)
      .then(data => { if (!cancelled) { setVaultData(data); setEditForm(data); } })
      .catch(err => { if (!cancelled) setError(err.message || 'Could not load.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customer.id]);

  const saveVault = async () => {
    setSaving(true);
    setError(null);
    try {
      await writeVault(customer.id, editForm);
      setVaultData(editForm);
      setEditing(false);
    } catch (err) {
      setError(err.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const hasContent = vaultData.keyCode || vaultData.alarmCode || vaultData.gateCode || vaultData.accessNotes;

  const inp = "w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.25)] focus:outline-none focus:border-[#99c5ff] transition-colors";
  const lbl = "block text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.5)] mb-1.5";

  const Banner = (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
      <span className="text-sm shrink-0 mt-0.5">🔐</span>
      <div className="text-[11px] text-emerald-200/90 leading-snug">
        <span className="font-bold">Server-encrypted vault.</span>{" "}
        Stored encrypted at rest with a key that never leaves the database.
        Every view and edit is logged to the audit trail — open <span className="italic">Settings → Audit log</span> to review.
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {Banner}
        <GlassCard className="p-8 text-center">
          <p className="text-xs text-[rgba(153,197,255,0.45)]">Loading…</p>
        </GlassCard>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="space-y-4">
        {Banner}
        {error && (
          <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs leading-snug">
            <span className="shrink-0 mt-0.5">⚠</span>{error}
          </div>
        )}
        <GlassCard className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Access notes</p>
              <p className="text-sm font-black text-white">Edit access info</p>
            </div>
            <button onClick={() => { setEditForm(vaultData); setEditing(false); setError(null); }}
              className="text-xs text-[rgba(153,197,255,0.4)] hover:text-white px-3 py-1.5 rounded-lg border border-[rgba(153,197,255,0.1)] hover:border-[rgba(153,197,255,0.25)] transition-all">
              Cancel
            </button>
          </div>
          {[
            { key: "keyCode",   label: "Key / lockbox code", placeholder: "e.g. 4521 or key under mat" },
            { key: "alarmCode", label: "Alarm code",         placeholder: "e.g. 1234  (disarm on entry)" },
            { key: "gateCode",  label: "Gate / entry code",  placeholder: "e.g. *0042#" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className={lbl}>{label}</label>
              <input type="text" value={editForm[key]}
                onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder} className={inp} />
            </div>
          ))}
          <div>
            <label className={lbl}>Access notes</label>
            <textarea value={editForm.accessNotes}
              onChange={e => setEditForm(f => ({ ...f, accessNotes: e.target.value }))}
              placeholder="Parking spot, pet name, entry instructions, anything else…"
              rows={3} className={`${inp} resize-none`} />
          </div>
          <button onClick={saveVault} disabled={saving}
            className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-[#1f48ff]/25">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {Banner}
      {error && (
        <div className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs leading-snug">
          <span className="shrink-0 mt-0.5">⚠</span>{error}
        </div>
      )}

      {hasContent ? (
        <GlassCard className="divide-y divide-[rgba(153,197,255,0.08)]">
          {[
            { emoji: "🗝", label: "Key / lockbox", value: vaultData.keyCode   },
            { emoji: "🚨", label: "Alarm code",    value: vaultData.alarmCode },
            { emoji: "🚪", label: "Gate code",     value: vaultData.gateCode  },
          ].filter(r => r.value).map(r => (
            <div key={r.label} className="flex items-center gap-3 px-4 py-3.5">
              <span className="text-base shrink-0">{r.emoji}</span>
              <span className="text-xs text-[rgba(153,197,255,0.45)] w-24 shrink-0 font-semibold uppercase tracking-wide">{r.label}</span>
              <span className="font-black text-base text-white tracking-[0.2em] select-all">{r.value}</span>
            </div>
          ))}
          {vaultData.accessNotes && (
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">📋 Access notes</p>
              <p className="text-sm text-[rgba(153,197,255,0.85)] leading-relaxed">{vaultData.accessNotes}</p>
            </div>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-8 text-center">
          <span className="text-4xl mb-3 block">🗝</span>
          <p className="text-sm font-semibold text-[rgba(153,197,255,0.5)]">Nothing saved yet</p>
          <p className="text-xs text-[rgba(153,197,255,0.3)] mt-1">Add key codes, alarm codes and access instructions</p>
        </GlassCard>
      )}

      <button
        onClick={() => { setEditForm(vaultData); setEditing(true); }}
        className="w-full py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.04)] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white text-xs font-bold transition-all"
      >
        ✏ Edit access info
      </button>
    </div>
  );
}
