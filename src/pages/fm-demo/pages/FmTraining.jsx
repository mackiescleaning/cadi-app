const MODULES = [
  { title: 'Platform fundamentals',   desc: 'Navigating the FM portal, job board, and live ops view.', duration: '20 min', status: 'available', icon: '🖥️' },
  { title: 'Client portal walkthrough', desc: 'How your clients see their contract, evidence, and reports.', duration: '15 min', status: 'available', icon: '👥' },
  { title: 'QA and evidence review',  desc: 'Approving photo evidence, raising issues, and SLA monitoring.', duration: '25 min', status: 'available', icon: '✅' },
  { title: 'Hiring & onboarding',     desc: 'Using AI matching, the hiring pipeline, and cleaner induction flow.', duration: '30 min', status: 'coming-soon', icon: '🚀' },
  { title: 'Cadi Connect overview',   desc: 'How Connect works, scoring tiers, and deploying network operatives.', duration: '20 min', status: 'coming-soon', icon: '🌐' },
  { title: 'Reporting & client packs',desc: 'Monthly reports, client pack generation, and tender evidence exports.', duration: '15 min', status: 'coming-soon', icon: '📊' },
];

export default function FmTraining({ showToast }) {
  return (
    <div className="p-6 space-y-5 max-w-3xl">
      <div className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(79,120,255,0.08)', border: '1px solid rgba(79,120,255,0.2)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)' }}>🎓</div>
        <div>
          <div className="text-white font-black text-sm">Cadi Training Hub</div>
          <div className="text-white/45 text-xs mt-0.5">Short, focused modules to get your team up to speed — built around how Britannia FM actually works.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MODULES.map(m => (
          <div key={m.title} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', opacity: m.status === 'coming-soon' ? 0.5 : 1 }}>
            <div className="text-2xl mb-2">{m.icon}</div>
            <div className="text-white font-black text-sm">{m.title}</div>
            <div className="text-white/40 text-xs mt-1 leading-relaxed">{m.desc}</div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-white/25 text-[10px]">{m.duration}</span>
              {m.status === 'available'
                ? <button onClick={() => showToast(`start ${m.title} training module`)}
                    className="px-3 py-1 rounded-lg text-[11px] font-black transition-all"
                    style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.3)', color: '#7b9fff' }}>
                    Start
                  </button>
                : <span className="text-[9px] font-black px-2 py-0.5 rounded-full text-white/30"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Coming soon
                  </span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
