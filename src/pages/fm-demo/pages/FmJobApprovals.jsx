import { useState } from 'react';

const INITIAL_APPROVALS = [
  { id: 'ja1', contractor: 'Clearview Window Services', site: 'L&D Hospital – Outpatients', service: 'Window cleaning', date: 'Mon 26 May', rate: '£72 per job', status: 'pending' },
  { id: 'ja2', contractor: 'ProWash Midlands', site: 'Aldi Dunstable RDC', service: 'Jet washing', date: 'Tue 27 May', rate: '£240 per job', status: 'pending' },
  { id: 'ja3', contractor: 'Capital Gutters Ltd', site: 'Next Watford', service: 'Gutter clearing', date: 'Wed 28 May', rate: '£180 per job', status: 'pending' },
  { id: 'ja4', contractor: 'SprayTech Services', site: 'Luton Council HQ', service: 'Graffiti removal', date: 'Thu 29 May', rate: '£420 per job', status: 'accepted' },
  { id: 'ja5', contractor: 'CleanFront UK', site: 'Watford Life Sciences', service: 'Window cleaning', date: 'Fri 30 May', rate: '£95 per job', status: 'declined' },
];

const SERVICE_ICONS = { 'Window cleaning': '🪟', 'Jet washing': '💧', 'Gutter clearing': '🍂', 'Graffiti removal': '🖌️' };

export default function FmJobApprovals({ showToast }) {
  const [items, setItems] = useState(INITIAL_APPROVALS);

  function act(id, action) {
    setItems(prev => prev.map(a => a.id === id ? { ...a, status: action } : a));
    if (action === 'declined') showToast('backup contractor automatically notified — coverage maintained');
  }

  const pending  = items.filter(a => a.status === 'pending').length;
  const accepted = items.filter(a => a.status === 'accepted').length;
  const declined = items.filter(a => a.status === 'declined').length;

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Awaiting response', value: pending,  color: '#fbbf24' },
          { label: 'Accepted',          value: accepted, color: '#34d399' },
          { label: 'Declined',          value: declined, color: '#f87171' },
          { label: 'Auto-covered',      value: declined, color: '#38bdf8' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}>
        ⚡ When a contractor declines, Cadi automatically notifies the next best match from the pool — no manual chasing.
      </div>

      <div className="space-y-3">
        {items.map(a => (
          <div key={a.id} className="rounded-2xl p-4 transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', opacity: a.status !== 'pending' ? 0.65 : 1 }}>
            <div className="flex items-center gap-4">
              <div className="text-2xl shrink-0">{SERVICE_ICONS[a.service] || '🧹'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-black text-sm">{a.contractor}</div>
                <div className="text-white/50 text-xs mt-0.5">{a.site} · {a.service} · {a.date}</div>
                <div className="text-white/30 text-[11px] mt-0.5">{a.rate}</div>
              </div>
              <div className="shrink-0">
                {a.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button onClick={() => act(a.id, 'accepted')} className="px-3 py-1.5 rounded-lg text-[11px] font-black text-emerald-300 transition-all" style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>Accept</button>
                    <button onClick={() => act(a.id, 'declined')} className="px-3 py-1.5 rounded-lg text-[11px] font-black text-red-300 transition-all" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>Decline</button>
                  </div>
                ) : (
                  <span className="text-[11px] font-black px-3 py-1.5 rounded-lg" style={{ color: a.status === 'accepted' ? '#34d399' : '#f87171', background: a.status === 'accepted' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)' }}>
                    {a.status === 'accepted' ? '✓ Accepted' : '✗ Declined — backup notified'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
