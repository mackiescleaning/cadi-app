// src/components/WeekOneMoneyLog.jsx
// Cadi — Lite users' route into Phase 2 of the 30-day plan.
// Open banking is Pro/Max-only, so Lite users log last week's money by hand:
// what came in, what went out. Three entries is enough to unlock the
// financial walkthrough and the first weekly report. Every screen sells the
// upgrade quietly: on Pro, the bank feed does this typing for you.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMoneyEntry } from '../lib/db/moneyDb';

const QUICK_EXPENSE_CATS = [
  { id: 'fuel',      label: 'Fuel',      emoji: '⛽' },
  { id: 'supplies',  label: 'Supplies',  emoji: '🧴' },
  { id: 'equipment', label: 'Equipment', emoji: '🔧' },
  { id: 'insurance', label: 'Insurance', emoji: '🛡️' },
  { id: 'phone',     label: 'Phone',     emoji: '📱' },
  { id: 'other',     label: 'Other',     emoji: '📦' },
];

const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export default function WeekOneMoneyLog({ onClose, onLogged }) {
  const navigate = useNavigate();
  const [kind,     setKind]     = useState('income'); // 'income' | 'expense'
  const [label,    setLabel]    = useState('');
  const [amount,   setAmount]   = useState('');
  const [date,     setDate]     = useState(daysAgo(2));
  const [category, setCategory] = useState('fuel');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);
  const [logged,   setLogged]   = useState([]); // { kind, label, amount }

  const enough = logged.length >= 3 && logged.some(e => e.kind === 'income');

  const addEntry = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter an amount.'); return; }
    setSaving(true); setError(null);
    try {
      await createMoneyEntry({
        kind,
        amount: amt,
        date,
        client: kind === 'income' ? (label || 'Cash job') : (label || null),
        category: kind === 'expense' ? category : null,
        method: 'manual',
      });
      setLogged(prev => [...prev, { kind, label: label || (kind === 'income' ? 'Cash job' : QUICK_EXPENSE_CATS.find(c => c.id === category)?.label), amount: amt }]);
      setLabel(''); setAmount('');
      onLogged?.(logged.length + 1);
    } catch (e) {
      setError(e.message === 'Not authenticated' ? 'Please sign in first.' : (e.message || 'Could not save — try again.'));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(153,197,255,0.15)] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}>
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/50 to-transparent" />

        {/* Header */}
        <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.1)] flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-white">Log last week's money</p>
            <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-0.5">
              Rough numbers are fine — Cadi turns them into your first weekly report.
            </p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.4)] hover:text-white text-xl leading-none shrink-0">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* In / out toggle */}
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-0.5 gap-0.5">
            {[
              { id: 'income',  label: '💷 Money in'  },
              { id: 'expense', label: '💸 Money out' },
            ].map(k => (
              <button key={k.id} onClick={() => setKind(k.id)}
                className={`flex-1 px-3 py-2 text-xs font-black rounded-[10px] transition-all ${
                  kind === k.id
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : 'text-[rgba(153,197,255,0.45)] hover:text-white border border-transparent'
                }`}>
                {k.label}
              </button>
            ))}
          </div>

          {/* Entry form */}
          <div className="space-y-3">
            <input
              type="text" value={label} onChange={e => setLabel(e.target.value)}
              placeholder={kind === 'income' ? 'Who paid you? (e.g. Mrs Johnson)' : 'What was it? (e.g. Shell garage)'}
              className="w-full bg-[rgba(0,0,0,0.25)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] outline-none focus:border-[#4f78ff]"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-1 bg-[rgba(0,0,0,0.25)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3">
                <span className="text-sm font-black text-[rgba(153,197,255,0.5)]">£</span>
                <input type="number" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent py-2.5 text-sm font-black text-white placeholder-[rgba(153,197,255,0.3)] outline-none" />
              </div>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-[rgba(0,0,0,0.25)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2.5 text-xs text-white outline-none" />
            </div>
            {kind === 'expense' && (
              <div className="flex gap-1.5 flex-wrap">
                {QUICK_EXPENSE_CATS.map(c => (
                  <button key={c.id} onClick={() => setCategory(c.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${
                      category === c.id
                        ? 'bg-[#1f48ff]/25 border-[#1f48ff]/60 text-white'
                        : 'border-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] hover:text-white'
                    }`}>
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={addEntry} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : `+ Add ${kind === 'income' ? 'payment' : 'expense'}`}
            </button>
            {error && <p className="text-[11px] text-red-400">{error}</p>}
          </div>

          {/* Logged so far */}
          {logged.length > 0 && (
            <div className="rounded-xl border border-[rgba(153,197,255,0.1)] divide-y divide-[rgba(153,197,255,0.06)]">
              {logged.map((e, i) => (
                <div key={i} className="flex justify-between px-3 py-2 text-xs">
                  <span className="text-[rgba(153,197,255,0.6)] truncate">{e.kind === 'income' ? '💷' : '💸'} {e.label}</span>
                  <span className={`font-black tabular-nums shrink-0 ${e.kind === 'income' ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {e.kind === 'income' ? '+' : '−'}£{e.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Progress / done state */}
          {enough ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
              <p className="text-xs font-black text-emerald-300">✓ That's enough for your first report</p>
              <p className="text-[11px] text-[rgba(153,197,255,0.55)] mt-0.5">
                Add more if you like — the fuller the picture, the sharper the report. Your walkthrough is now unlocked.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-[rgba(153,197,255,0.45)] text-center">
              {logged.length === 0
                ? 'Log at least 3 entries (including one payment in) to unlock your report.'
                : `${logged.length} of 3 — keep going.`}
            </p>
          )}

          {/* Upgrade strip */}
          <button onClick={() => navigate('/upgrade')}
            className="w-full text-left px-3 py-3 rounded-xl border border-amber-400/30 hover:bg-amber-400/10 transition-colors"
            style={{ background: 'rgba(251,191,36,0.06)' }}>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-0.5">⚡ Cadi can do this for you</p>
            <p className="text-[11px] text-white leading-snug">
              On Pro, Cadi connects securely to your bank and logs every transaction automatically — no typing, ever. <span className="font-black text-amber-300">See Pro →</span>
            </p>
          </button>

          {enough && (
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black hover:bg-emerald-500/30 transition-colors">
              Done — back to my plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
