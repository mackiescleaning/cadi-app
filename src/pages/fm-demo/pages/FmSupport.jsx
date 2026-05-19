export default function FmSupport({ showToast }) {
  return (
    <div className="p-6 space-y-5 max-w-3xl">

      <div className="rounded-2xl p-5 flex items-start gap-4"
        style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)' }}>🛟</div>
        <div>
          <div className="text-white font-black text-sm">Cadi Support</div>
          <div className="text-white/45 text-xs mt-0.5">Your dedicated account team is here. Typical response time under 2 hours on business days.</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { icon: '💬', title: 'Live chat',          desc: 'Chat directly with your account manager.', action: 'open live chat', label: 'Start chat',      color: '#4f78ff' },
          { icon: '📧', title: 'Email support',      desc: 'support@cadi.cleaning — we aim to reply within 2 hours.', action: 'open email to support', label: 'Send email', color: '#a78bfa' },
          { icon: '📞', title: 'Account manager',    desc: 'Direct line to your named Cadi account manager.', action: 'call account manager', label: 'Call now',   color: '#34d399' },
          { icon: '📖', title: 'Help centre',        desc: 'Step-by-step guides, FAQs, and video walkthroughs.', action: 'open help centre', label: 'Browse',    color: '#fbbf24' },
        ].map(({ icon, title, desc, action, label, color }) => (
          <div key={title} className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl mb-2">{icon}</div>
            <div className="text-white font-black text-sm">{title}</div>
            <div className="text-white/40 text-xs mt-1 leading-relaxed">{desc}</div>
            <button onClick={() => showToast(action)}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-black transition-all"
              style={{ background: `${color}18`, border: `1px solid ${color}35`, color }}>
              {label}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-xs font-black uppercase tracking-widest text-white/20 mb-3">System status</div>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #34d399' }} />
          <span className="text-white/60 text-sm font-medium">All systems operational</span>
          <span className="text-white/25 text-xs ml-auto">Last checked 5 min ago</span>
        </div>
      </div>
    </div>
  );
}
