const SCHEDULE_ITEMS = [
  { site: 'L&D Hospital – All Buildings', service: 'Window cleaning', freq: 'Monthly', next: '28 May', contractor: 'Clearview Window Services', value: '£320/visit' },
  { site: 'L&D Hospital – Main Tower', service: 'Gutter clearing', freq: 'Quarterly', next: '15 Jun', contractor: 'Capital Gutters Ltd', value: '£180/visit' },
  { site: 'Next Luton The Mall', service: 'Window cleaning', freq: 'Monthly', next: '1 Jun', contractor: 'CleanFront UK', value: '£210/visit' },
  { site: 'Next Luton The Mall', service: 'Jet washing', freq: 'Bi-annual', next: '1 Aug', contractor: 'ProWash Midlands', value: '£340/visit' },
  { site: 'Aldi Dunstable RDC', service: 'Jet washing', freq: 'Monthly', next: '27 May', contractor: 'ProWash Midlands', value: '£280/visit' },
  { site: 'Watford Life Sciences Park', service: 'Window cleaning', freq: 'Monthly', next: '10 Jun', contractor: 'CleanFront UK', value: '£190/visit' },
];

const SERVICE_COLOURS = {
  'Window cleaning':  '#38bdf8',
  'Jet washing':      '#a78bfa',
  'Gutter clearing':  '#34d399',
  'Graffiti removal': '#f87171',
};

const FREQ_COLOURS = {
  'Monthly':   { color: '#34d399' },
  'Quarterly': { color: '#fbbf24' },
  'Bi-annual': { color: '#a78bfa' },
  'Annual':    { color: '#f87171' },
};

export default function FmExteriorScheduling({ showToast }) {
  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Scheduled visits', value: SCHEDULE_ITEMS.length, color: '#38bdf8' },
          { label: 'Due this month', value: 4, color: '#fbbf24' },
          { label: 'Auto-generated cards', value: '24', color: '#34d399' },
          { label: 'Monthly value', value: '£1.5k', color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/70 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}>
        📅 Cadi auto-generates job cards 7 days before each scheduled visit and notifies the assigned contractor automatically.
      </div>

      <div className="flex items-center gap-3">
        <button onClick={() => showToast('add new scheduled visit')} className="px-4 py-2.5 rounded-xl text-xs font-black" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(2,132,199,0.2))', border: '1px solid rgba(14,165,233,0.4)', color: 'white' }}>+ Add schedule</button>
      </div>

      <div className="space-y-3">
        {SCHEDULE_ITEMS.map((item, i) => {
          const sc = SERVICE_COLOURS[item.service] || '#94a3b8';
          const fc = FREQ_COLOURS[item.freq] || { color: '#94a3b8' };
          return (
            <div key={i} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="text-white font-black text-sm">{item.site}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: sc, background: `${sc}15`, border: `1px solid ${sc}30` }}>{item.service}</span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ color: fc.color, background: `${fc.color}15`, border: `1px solid ${fc.color}30` }}>{item.freq}</span>
                  </div>
                  <div className="text-white/40 text-xs">{item.contractor} · Next: <span className="text-sky-400/80">{item.next}</span> · {item.value}</div>
                </div>
                <button onClick={() => showToast(`edit schedule for ${item.site}`)} className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white/40 hover:text-white shrink-0 transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>Edit</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
