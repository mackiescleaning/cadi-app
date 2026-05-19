export default function WelcomeModal({ businessName, firstName, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-brand-navy/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #05124a 0%, #010a4f 60%, #091660 100%)' }}>

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-skyblue to-transparent opacity-60" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full bg-brand-blue/20 blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-8 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-blue/20 border border-brand-blue/30 mb-4">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-brand-skyblue tracking-wide uppercase">Welcome to Cadi</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight">
                Hey! 👋{' '}
                <span className="text-brand-skyblue">
                  {businessName || firstName || 'there'}
                </span>
              </h2>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 mt-1 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-300">Welcome to the Cadi community of cleaning professionals</span>
          </div>

          <p className="mt-3 text-sm sm:text-base leading-relaxed text-[rgba(153,197,255,0.8)]">
            Allow me to introduce you to your Cadi Command Centre — this is the most powerful thing that's ever happened to your cleaning business. <span className="text-white font-semibold">Check it every morning, every evening, obsessively</span> — you're about to become <span className="text-brand-skyblue font-semibold">completely addicted to business growth.</span>
          </p>

          <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-yellow-500/15 to-amber-500/10 border border-yellow-400/20">
            <span className="text-2xl shrink-0">👑</span>
            <div>
              <p className="text-xs font-black text-yellow-300">You're a Founding Member</p>
              <p className="text-[11px] text-yellow-200/60 leading-snug">You're one of the first 1,000 businesses on Cadi. Your Founding Member badge is already waiting on your dashboard.</p>
            </div>
          </div>
        </div>

        <div className="mx-6 h-px bg-white/10" />

        <div className="px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-skyblue/70 mb-1">Start here</p>
          <p className="text-sm text-white font-semibold mb-4">3 things that'll move the needle straight away.</p>
          <div className="space-y-3">
            {[
              {
                step: 1,
                emoji: "🧹",
                title: "Set up your services",
                body: "Cadi uses these to price every job, quote and invoice automatically — takes 2 minutes.",
              },
              {
                step: 2,
                emoji: "👤",
                title: "Add your first customer",
                body: "Your client list drives scheduling, invoicing, reminders and review requests.",
              },
              {
                step: 3,
                emoji: "📅",
                title: "Schedule your first job",
                body: "One job on the calendar and your revenue tracking, health score and route planner all kick in.",
              },
            ].map(({ step, emoji, title, body }) => (
              <div key={step} className="flex gap-3 p-3.5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-7 h-7 rounded-full bg-brand-blue/30 border border-brand-blue/40 flex items-center justify-center shrink-0 text-xs font-black text-brand-skyblue">
                  {step}
                </div>
                <div>
                  <p className="text-xs font-bold text-white mb-0.5">{emoji} {title}</p>
                  <p className="text-[11px] leading-relaxed text-[rgba(153,197,255,0.6)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[rgba(153,197,255,0.35)] mt-3 text-center">
            Your dashboard will guide you through each step — we'll track your progress.
          </p>
        </div>

        <div className="px-6 pb-7 pt-1">
          <button
            onClick={onClose}
            className="w-full py-4 bg-brand-blue hover:bg-[#1a3de0] text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-brand-blue/40 hover:shadow-brand-blue/60 hover:-translate-y-0.5 active:translate-y-0"
          >
            Let's do this →
          </button>
        </div>
      </div>
    </div>
  );
}
