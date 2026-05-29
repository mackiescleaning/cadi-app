import { useState, useEffect } from 'react';

const DEMO_CLIENTS = [
  { id: 'c1', name: 'Tesco Distribution – Welwyn Garden City', sector: 'Industrial', sites: 1, icon: '🏭' },
  { id: 'c2', name: 'NHS Property Services – Luton Cluster', sector: 'Healthcare', sites: 4, icon: '🏥' },
  { id: 'c3', name: 'Next Retail UK Ltd', sector: 'Retail', sites: 3, icon: '🛍️' },
  { id: 'c4', name: 'Hertfordshire County Council', sector: 'Public Sector', sites: 8, icon: '🏛️' },
];

const SERVICE_OPTIONS = ['Window cleaning', 'Jet washing', 'Gutter clearing', 'Graffiti removal', 'Pressure washing'];
const SERVICE_ICONS   = { 'Window cleaning': '🪟', 'Jet washing': '💧', 'Gutter clearing': '🍂', 'Graffiti removal': '🖌️', 'Pressure washing': '🚿' };
const SERVICE_COLOURS = { 'Window cleaning': '#38bdf8', 'Jet washing': '#a78bfa', 'Gutter clearing': '#34d399', 'Graffiti removal': '#f87171', 'Pressure washing': '#60a5fa' };

const SUGGESTED_CONTRACTORS = {
  'Window cleaning':   [{ name: 'Clearview Window Services', region: 'Midlands', rating: 4.9, rate: '£130–155/job', jobs: 142 }, { name: 'Apex Window Care', region: 'Midlands', rating: 4.8, rate: '£125–145/job', jobs: 178 }],
  'Jet washing':       [{ name: 'ProWash Midlands', region: 'Midlands', rating: 4.7, rate: '£220–260/job', jobs: 89 }, { name: 'Midlands Pressure Wash', region: 'Midlands', rating: 4.4, rate: '£200–240/job', jobs: 31 }],
  'Gutter clearing':   [{ name: 'Capital Gutters Ltd', region: 'South', rating: 4.8, rate: '£280–380/job', jobs: 67 }],
  'Graffiti removal':  [{ name: 'SprayTech Services', region: 'North', rating: 4.5, rate: '£420–520/job', jobs: 44 }],
  'Pressure washing':  [{ name: 'ProWash Midlands', region: 'Midlands', rating: 4.7, rate: '£220–260/job', jobs: 89 }],
};

const STEPS = [
  { n: 1, label: 'Contract details' },
  { n: 2, label: 'Services & scope' },
  { n: 3, label: 'Contractor match'  },
  { n: 4, label: 'Broadcast'        },
  { n: 5, label: 'Go live'          },
];

const FAKE_APPROVALS = [
  'Clearview Window Services accepted · L&D Hospital · Tue 26 May',
  'ProWash Midlands accepted · Tesco Welwyn · Wed 27 May',
  'Capital Gutters Ltd accepted · Next Retail · Thu 28 May',
  'Apex Window Care accepted · NHS Outpatients · Fri 29 May',
  'Midlands Pressure Wash accepted · Council HQ · Sat 30 May',
  'SprayTech Services accepted · Watford Site · Tue 2 Jun',
];

export default function FmDeployExterior({ showToast }) {
  const [step,            setStep]            = useState(1);
  const [clientId,        setClientId]        = useState('c1');
  const [value,           setValue]           = useState('£4,200');
  const [startDate,       setStartDate]       = useState('1 Jun 2026');
  const [rateMode,        setRateMode]        = useState('set'); // 'set' | 'quote'
  const [services,        setServices]        = useState(['Window cleaning', 'Jet washing']);
  const [acceptedSubs,    setAcceptedSubs]    = useState({});
  const [broadcasting,    setBroadcasting]    = useState(false);
  const [broadcastDone,   setBroadcastDone]   = useState(false);
  const [approvalFeed,    setApprovalFeed]    = useState([]);
  const [approvalCount,   setApprovalCount]   = useState(0);
  const [coveragePct,     setCoveragePct]     = useState(0);

  const client = DEMO_CLIENTS.find(c => c.id === clientId) || DEMO_CLIENTS[0];
  const totalSubs = services.reduce((s, svc) => s + (SUGGESTED_CONTRACTORS[svc]?.length || 0), 0);

  function toggleService(svc) {
    setServices(prev => prev.includes(svc) ? prev.filter(s => s !== svc) : [...prev, svc]);
  }

  function acceptSub(service, sub) {
    setAcceptedSubs(prev => ({ ...prev, [service]: sub }));
  }

  function doBroadcast() {
    setBroadcasting(true);
    setTimeout(() => {
      setBroadcasting(false);
      setBroadcastDone(true);
      let i = 0;
      const interval = setInterval(() => {
        if (i >= FAKE_APPROVALS.length) { clearInterval(interval); setCoveragePct(100); setStep(5); return; }
        setApprovalFeed(prev => [FAKE_APPROVALS[i], ...prev]);
        setApprovalCount(c => c + 1);
        setCoveragePct(Math.round(((i + 1) / FAKE_APPROVALS.length) * 100));
        i++;
      }, 700);
    }, 1800);
  }

  const inputStyle = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', color: 'white', fontSize: 13, width: '100%', outline: 'none' };

  return (
    <div className="p-6 max-w-3xl space-y-5">

      {/* Time saving banner */}
      <div className="rounded-2xl px-6 py-4 flex items-center gap-6" style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(2,132,199,0.08))', border: '1px solid rgba(14,165,233,0.25)' }}>
        <div className="text-center">
          <div className="text-3xl font-black" style={{ color: '#f87171' }}>6 weeks</div>
          <div className="text-[10px] font-bold text-white/40 mt-0.5">old process</div>
        </div>
        <div className="flex-1 flex items-center gap-3">
          <div className="h-0.5 flex-1" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="text-white/30 text-lg">→</div>
          <div className="h-0.5 flex-1" style={{ background: 'rgba(14,165,233,0.4)' }} />
        </div>
        <div className="text-center">
          <div className="text-3xl font-black" style={{ color: '#34d399' }}>11 days</div>
          <div className="text-[10px] font-bold text-white/40 mt-0.5">with Cadi</div>
        </div>
        <div className="ml-4 text-right">
          <div className="text-lg font-black" style={{ color: '#38bdf8' }}>£0</div>
          <div className="text-[10px] text-white/35">admin cost saved</div>
        </div>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-0">
        {STEPS.map(({ n, label }, i) => {
          const done    = step > n;
          const current = step === n;
          return (
            <div key={n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all"
                  style={done ? { background: '#34d399', color: 'white', boxShadow: '0 0 12px rgba(52,211,153,0.4)' }
                    : current ? { background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', boxShadow: '0 0 12px rgba(14,165,233,0.4)' }
                    : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                  {done ? '✓' : n}
                </div>
                <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: done ? '#34d399' : current ? '#38bdf8' : 'rgba(255,255,255,0.25)' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 mt-[-12px]" style={{ background: step > n ? '#34d399' : 'rgba(255,255,255,0.08)', transition: 'background 0.3s' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* ── Step 1: Contract details ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <div className="text-white font-black text-base mb-1">Contract details</div>
              <div className="text-white/40 text-xs">Cadi uses previous contracts for this client to suggest service types and rates automatically.</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Select client</div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_CLIENTS.map(c => (
                  <button key={c.id} onClick={() => setClientId(c.id)}
                    className="text-left px-4 py-3 rounded-xl transition-all"
                    style={clientId === c.id ? { background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.35)', color: 'white' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                    <div className="text-sm font-black mb-0.5">{c.icon} {c.name}</div>
                    <div className="text-[10px]" style={{ color: clientId === c.id ? '#38bdf8' : 'rgba(255,255,255,0.3)' }}>{c.sector} · {c.sites} site{c.sites !== 1 ? 's' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Contract value</div>
                <input value={value} onChange={e => setValue(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Start date</div>
                <input value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Rate mode</div>
              <div className="flex gap-2">
                {[
                  { v: 'set', label: '💷 We set the price', desc: 'Contractors accept or decline your job price' },
                  { v: 'quote', label: '📩 Request quotes', desc: 'Contractors quote per job, you review & accept' },
                ].map(opt => (
                  <button key={opt.v} onClick={() => setRateMode(opt.v)}
                    className="flex-1 text-left px-3 py-2.5 rounded-xl transition-all"
                    style={rateMode === opt.v ? { background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', color: 'white' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                    <div className="text-xs font-black">{opt.label}</div>
                    <div className="text-[10px] mt-0.5 opacity-60">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full py-3 rounded-xl text-sm font-black text-white transition-all" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 4px 16px rgba(14,165,233,0.3)' }}>
              Continue → Select services
            </button>
          </div>
        )}

        {/* ── Step 2: Services & scope ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <div className="text-white font-black text-base mb-1">Services & scope</div>
              <div className="text-white/40 text-xs">Cadi pre-selects based on previous {client.sector} contracts. Edit as needed.</div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_OPTIONS.map(svc => {
                const on = services.includes(svc);
                const c  = SERVICE_COLOURS[svc];
                return (
                  <button key={svc} onClick={() => toggleService(svc)}
                    className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl transition-all"
                    style={on ? { background: `${c}15`, border: `1px solid ${c}40`, color: c } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                    <span className="text-2xl">{SERVICE_ICONS[svc]}</span>
                    <span className="text-[10px] font-black text-center leading-snug">{svc}</span>
                    {on && <span className="text-[9px] font-black px-2 py-0.5 rounded-full" style={{ background: `${c}20`, color: c }}>Selected</span>}
                  </button>
                );
              })}
            </div>
            <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#38bdf8' }}>
              ✓ {services.length} service type{services.length !== 1 ? 's' : ''} selected · Cadi will match {totalSubs} contractor{totalSubs !== 1 ? 's' : ''} from your pool for {client.sites} site{client.sites !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="px-6 py-3 rounded-xl text-sm font-bold text-white/40 transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl text-sm font-black text-white" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 4px 16px rgba(14,165,233,0.3)' }}>
                Continue → Cadi matches your contractors
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Sub match ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="text-white font-black text-base mb-1">Contractor match</div>
              <div className="text-white/40 text-xs">Cadi scored your contractor pool by trade, proximity and past performance. Review and confirm.</div>
            </div>
            <div className="space-y-4">
              {services.map(svc => {
                const subs = SUGGESTED_CONTRACTORS[svc] || [];
                const c    = SERVICE_COLOURS[svc];
                return (
                  <div key={svc}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">{SERVICE_ICONS[svc]}</span>
                      <span className="text-xs font-black" style={{ color: c }}>{svc}</span>
                    </div>
                    <div className="space-y-1.5">
                      {subs.map(sub => {
                        const accepted = acceptedSubs[svc]?.name === sub.name;
                        return (
                          <div key={sub.name} className="flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all"
                            style={accepted ? { background: `${c}12`, border: `1px solid ${c}30` } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="flex-1 min-w-0">
                              <div className="text-white text-xs font-black">{sub.name}</div>
                              <div className="text-white/40 text-[10px]">{sub.region} · {sub.rating}★ · {sub.jobs} jobs · {sub.rate}</div>
                            </div>
                            <button onClick={() => acceptSub(svc, sub)}
                              className="px-3 py-1 rounded-lg text-[11px] font-black transition-all shrink-0"
                              style={accepted ? { background: `${c}20`, color: c, border: `1px solid ${c}30` } : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {accepted ? '✓ Selected' : 'Select'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="px-6 py-3 rounded-xl text-sm font-bold text-white/40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>← Back</button>
              <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl text-sm font-black text-white" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: '0 4px 16px rgba(14,165,233,0.3)' }}>
                Continue → Ready to broadcast
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Broadcast ── */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <div className="text-white font-black text-base mb-1">Ready to broadcast</div>
              <div className="text-white/40 text-xs">One click sends job cards to all matched contractors simultaneously. Old process: 6 weeks of calls and emails.</div>
            </div>
            <div className="rounded-xl p-5 space-y-3" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)' }}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-2xl font-black text-white">{client.sites}</div><div className="text-[10px] text-white/40">Sites</div></div>
                <div><div className="text-2xl font-black" style={{ color: '#38bdf8' }}>{services.length}</div><div className="text-[10px] text-white/40">Service types</div></div>
                <div><div className="text-2xl font-black" style={{ color: '#34d399' }}>{totalSubs}</div><div className="text-[10px] text-white/40">Contractors notified</div></div>
              </div>
              <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Client</span><span className="text-white font-bold">{client.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Contract value</span><span className="text-white font-bold">{value}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Mode</span><span className="font-bold" style={{ color: '#38bdf8' }}>{rateMode === 'set' ? 'Britannia sets price — contractors accept/decline' : 'Contractors quote per job — you review'}</span>
              </div>
            </div>

            {broadcastDone ? (
              <div className="space-y-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/30">Live approval feed</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {approvalFeed.map((msg, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                      <span className="text-emerald-400 text-xs font-black shrink-0">✓</span>
                      <span className="text-white/60 text-[11px]">{msg}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-white/40">Coverage</span>
                    <span className="font-black" style={{ color: coveragePct === 100 ? '#34d399' : '#38bdf8' }}>{coveragePct}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${coveragePct}%`, background: coveragePct === 100 ? '#34d399' : '#38bdf8', boxShadow: `0 0 12px ${coveragePct === 100 ? '#34d399' : '#38bdf8'}60` }} />
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={doBroadcast} disabled={broadcasting}
                className="w-full py-4 rounded-xl text-sm font-black text-white transition-all"
                style={{ background: broadcasting ? 'rgba(14,165,233,0.3)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)', boxShadow: broadcasting ? 'none' : '0 4px 20px rgba(14,165,233,0.4)', cursor: broadcasting ? 'wait' : 'pointer' }}>
                {broadcasting ? '⚡ Broadcasting to contractor pool...' : `🚀 Fire job cards to ${totalSubs} contractor${totalSubs !== 1 ? 's' : ''}`}
              </button>
            )}

            {!broadcastDone && (
              <button onClick={() => setStep(3)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white/40" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>← Back</button>
            )}
          </div>
        )}

        {/* ── Step 5: Go live ── */}
        {step === 5 && (
          <div className="space-y-5 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto" style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', boxShadow: '0 0 32px rgba(52,211,153,0.15)' }}>🚀</div>
            <div>
              <div className="text-white font-black text-xl mb-1">Contract live</div>
              <div className="text-white/40 text-sm">100% coverage confirmed. {client.name} notified. First visits scheduled.</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Contractors confirmed', value: approvalCount, color: '#34d399' },
                { label: 'Days to deploy', value: '11', color: '#38bdf8' },
                { label: 'Weeks saved', value: '3+', color: '#a78bfa' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl py-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="text-2xl font-black" style={{ color }}>{value}</div>
                  <div className="text-white/50 text-xs mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <div className="text-left rounded-xl p-4 space-y-2" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              {[
                '✓ Job cards auto-generated for all sites',
                '✓ Contractors notified of first visit dates',
                `✓ ${client.name} received onboarding confirmation`,
                '✓ Schedule live — Cadi generates job cards 7 days ahead',
                '✓ Evidence required on completion — invoicing automated',
              ].map(line => (
                <div key={line} className="text-[11px] text-emerald-400/80">{line}</div>
              ))}
            </div>
            <button onClick={() => { setStep(1); setAcceptedSubs({}); setBroadcastDone(false); setApprovalFeed([]); setApprovalCount(0); setCoveragePct(0); }}
              className="w-full py-3 rounded-xl text-sm font-black text-white/60 transition-all" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              ↺ Run again with another client
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
