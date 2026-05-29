import { useState } from 'react';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import clients  from '../mock/clients.json';
import { getServiceColour } from '../utils/colours';
import { Shield, MapPin, Clock, Camera, CheckCircle2, Star } from 'lucide-react';

const EVIDENCE_MOCK = [
  { type: 'Before', label: 'Main entrance',       time: '07:41', geo: '52.13618, -0.46008', accuracy: '±4m' },
  { type: 'Before', label: 'Reception area',      time: '07:43', geo: '52.13619, -0.46011', accuracy: '±5m' },
  { type: 'After',  label: 'Main entrance',       time: '08:31', geo: '52.13617, -0.46009', accuracy: '±4m' },
  { type: 'After',  label: 'Reception area',      time: '08:34', geo: '52.13620, -0.46007', accuracy: '±6m' },
  { type: 'After',  label: 'Toilets — 1st floor', time: '08:38', geo: '52.13621, -0.46012', accuracy: '±5m' },
  { type: 'Sign',   label: 'Site supervisor',     time: '08:44', geo: '52.13618, -0.46008', accuracy: '±3m' },
];

const SLA_CHECKS = [
  { item: 'Arrived within SLA window (06:00–08:00)',  pass: true  },
  { item: 'All scheduled areas cleaned',              pass: true  },
  { item: 'Before & after photos uploaded',           pass: true  },
  { item: 'Completed within time window',             pass: true  },
  { item: 'Site supervisor sign-off obtained',        pass: true  },
  { item: 'GPS on-site for full duration',            pass: true  },
];

const RATINGS = [1, 2, 3, 4, 5];

function GeoTag({ geo, accuracy, time }) {
  return (
    <div className="flex items-center gap-1.5 mt-1" style={{ opacity: 0.65 }}>
      <MapPin size={9} style={{ color: '#34d399', flexShrink: 0 }} />
      <span className="text-[9px] font-mono" style={{ color: '#34d399' }}>{geo} {accuracy}</span>
      <span className="text-[9px] text-white/30">·</span>
      <span className="text-[9px] text-white/40">{time}</span>
    </div>
  );
}

function PhotoCard({ ev, onView }) {
  const isAfter  = ev.type === 'After';
  const isSign   = ev.type === 'Sign';
  const accent   = isSign ? '#a78bfa' : isAfter ? '#34d399' : '#60a5fa';
  const label    = isSign ? 'Sign-off' : ev.type;

  return (
    <button onClick={onView}
      className="text-left rounded-2xl overflow-hidden transition-all group"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid rgba(255,255,255,0.08)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${accent}40`; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
    >
      {/* Photo thumbnail */}
      <div className="h-20 relative overflow-hidden flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${accent}18, ${accent}08)` }}>
        <Camera size={22} style={{ color: `${accent}50` }} />
        <div className="absolute top-2 right-2">
          <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: `${accent}25`, border: `1px solid ${accent}40`, color: accent }}>
            {label}
          </span>
        </div>
        {/* Geo verified badge */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <Shield size={9} style={{ color: '#34d399' }} />
          <span className="text-[8px] font-bold" style={{ color: '#34d399' }}>Geo-verified</span>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="text-white/75 text-xs font-bold leading-tight">{ev.label}</div>
        <GeoTag geo={ev.geo} accuracy={ev.accuracy} time={ev.time} />
      </div>
    </button>
  );
}

const IMPACT = [
  { before: 'FM chases cleaners for evidence via WhatsApp & email', after: 'Geo-stamped photos auto-arrive — nothing to chase', icon: '📷' },
  { before: 'SLA disputes with no proof to resolve them',           after: 'SHA-256 tamper-evident evidence, always on record',  icon: '🔒' },
  { before: 'QA sign-off takes days, holds up invoices',            after: 'One-click approval — invoice can be raised same day', icon: '⚡' },
];

export default function FmQaQueue({ showToast }) {
  const [selected, setSelected] = useState(null);
  const [actioned, setActioned] = useState({});
  const [rating,   setRating]   = useState(0);

  const qaJobs    = jobs.filter(j => j.status === 'awaiting-qa' || j.status === 'disputed');
  const sel       = qaJobs.find(j => j.id === selected);
  const selSite   = sel ? sites.find(s => s.id === sel.siteId)    : null;
  const selCleaner= sel?.cleanerId ? cleaners.find(c => c.id === sel.cleanerId) : null;
  const selClient = sel ? clients.find(c => c.id === sel.clientId) : null;
  const pending   = qaJobs.filter(j => !actioned[j.id]).length;

  function handleAction(action) {
    setActioned(prev => ({ ...prev, [selected]: action }));
    const msgs = {
      approve: `approve job and release payment to ${selCleaner?.name}`,
      changes: `request changes from ${selCleaner?.name}`,
      dispute: `raise dispute for job at ${selSite?.name}`,
    };
    showToast(msgs[action]);
    setSelected(null);
    setRating(0);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Impact strip */}
      <div className="flex-shrink-0 flex divide-x" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(1,8,40,0.7)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="px-4 py-2 flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] font-black uppercase tracking-widest text-white/25">What Cadi replaces</span>
        </div>
        {IMPACT.map(({ before, after, icon }) => (
          <div key={icon} className="flex-1 flex items-center gap-3 px-4 py-2.5">
            <span className="text-base flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              <div className="text-[9px] text-white/25 line-through decoration-white/15 truncate">{before}</div>
              <div className="text-[10px] font-bold truncate" style={{ color: '#60a5fa' }}>{after}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-1 overflow-hidden">

      {/* ── Left: queue list ── */}
      <div className="w-[40%] flex flex-col overflow-hidden flex-shrink-0" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div className="text-white font-bold text-sm">QA Queue</div>
            <div className="text-white/35 text-xs mt-0.5">Evidence review — one click approval</div>
          </div>
          <span className="text-xs font-black px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24', boxShadow: '0 0 12px rgba(245,158,11,0.1)' }}>
            {pending} pending
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {qaJobs.map(job => {
            const site    = sites.find(s => s.id === job.siteId);
            const cleaner = cleaners.find(c => c.id === job.cleanerId);
            const done    = actioned[job.id];
            const isDisputed = job.status === 'disputed';
            const isActive   = selected === job.id;

            return (
              <button key={job.id}
                onClick={() => !done && setSelected(job.id === selected ? null : job.id)}
                className="w-full text-left p-4 rounded-2xl transition-all"
                style={{
                  background: isActive
                    ? 'rgba(79,120,255,0.12)'
                    : 'rgba(255,255,255,0.04)',
                  border: isActive
                    ? '1px solid rgba(79,120,255,0.45)'
                    : isDisputed
                    ? '1px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: isActive ? '0 0 20px rgba(79,120,255,0.1), inset 0 1px 0 rgba(255,255,255,0.07)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                  opacity: done ? 0.5 : 1,
                  cursor: done ? 'default' : 'pointer',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Active left beam */}
                  {isActive && (
                    <div style={{
                      position: 'absolute', left: 16, width: 2, height: '60%', borderRadius: 2,
                      background: 'linear-gradient(180deg, transparent, #4f78ff, transparent)',
                    }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-bold text-sm truncate">{site?.name}</span>
                      {isDisputed && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                          DISPUTED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-white/40 text-xs">{cleaner?.name}</span>
                      {(() => { const sc = getServiceColour(job.service); return (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                          {job.service}
                        </span>
                      ); })()}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex items-center gap-1">
                        <Shield size={9} style={{ color: '#34d399' }} />
                        <span className="text-[9px] text-emerald-400/80 font-bold">Geo-verified</span>
                      </div>
                      <span className="text-white/20 text-[9px]">·</span>
                      <span className="text-white/30 text-[9px]">{job.evidenceCount} photos · {job.completedAt}</span>
                    </div>
                  </div>
                  {done ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: done === 'approve' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                        border: done === 'approve' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)',
                        color: done === 'approve' ? '#34d399' : '#fbbf24',
                      }}>
                      {done === 'approve' ? '✓ Approved' : 'Changes req.'}
                    </span>
                  ) : (
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.6)' }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: evidence review panel ── */}
      <div className="flex-1 overflow-y-auto">
        {!sel ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-white/15 text-xs text-center">Select an item to view details</div>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-black text-base">{selSite?.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-white/45 text-sm">{selClient?.name}</span>
                  {(() => { const sc = getServiceColour(sel.service); return (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                      {sel.service}
                    </span>
                  ); })()}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)' }}>
                      <Shield size={10} style={{ color: '#34d399' }} />
                    </div>
                    <span className="text-xs font-bold" style={{ color: '#34d399' }}>All evidence geo-verified</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/30 text-xs">
                    <Clock size={10} />
                    <span>Completed {sel.completedAt}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Geo audit summary */}
            <div className="rounded-2xl p-4" style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.2)',
              boxShadow: '0 0 20px rgba(52,211,153,0.04)',
            }}>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={13} style={{ color: '#34d399' }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: '#34d399' }}>Geo-verification summary</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Photos verified', value: `${sel.evidenceCount}/${sel.evidenceCount}` },
                  { label: 'Max distance from site', value: '11m' },
                  { label: 'Tamper-evident', value: 'SHA-256' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.15)' }}>
                    <div className="text-emerald-300 font-black text-base">{value}</div>
                    <div className="text-emerald-400/50 text-[10px] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA checklist */}
            <div className="rounded-2xl p-5" style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
              <div className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-4">SLA checklist</div>
              <div className="space-y-2">
                {SLA_CHECKS.map(({ item, pass }) => (
                  <div key={item} className="flex items-center gap-3 py-1">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={pass
                        ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)' }
                        : { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }
                      }>
                      {pass
                        ? <CheckCircle2 size={11} style={{ color: '#34d399' }} />
                        : <span style={{ color: '#f87171', fontSize: 9, fontWeight: 900 }}>✗</span>
                      }
                    </div>
                    <span className="text-sm text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Photo evidence grid */}
            <div className="rounded-2xl p-5" style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-white/30 text-[10px] font-black uppercase tracking-widest">Evidence pack</div>
                <span className="text-[10px] font-bold text-white/30">{sel.evidenceCount} items · all geo-tagged</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {EVIDENCE_MOCK.map((ev, i) => (
                  <PhotoCard key={i} ev={ev} onView={() => showToast(`view photo: ${ev.label}`)} />
                ))}
              </div>
            </div>

            {/* Rate cleaner */}
            <div className="rounded-2xl p-5" style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            }}>
              <div className="text-white/30 text-[10px] font-black uppercase tracking-widest mb-3">Rate this clean</div>
              <div className="flex items-center gap-2">
                {RATINGS.map(n => (
                  <button key={n} onClick={() => setRating(n)}
                    className="transition-all hover:scale-110"
                    style={{ fontSize: 22, color: n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.15)', filter: n <= rating ? 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' : 'none' }}>
                    <Star size={20} fill={n <= rating ? '#fbbf24' : 'none'} color={n <= rating ? '#fbbf24' : 'rgba(255,255,255,0.2)'} />
                  </button>
                ))}
                {rating > 0 && <span className="text-white/45 text-xs ml-2 font-bold">{['','Poor','Below avg','Average','Good','Excellent'][rating]}</span>}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => handleAction('approve')}
                className="py-3.5 rounded-xl text-sm font-black text-white transition-all relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.2))', border: '1px solid rgba(16,185,129,0.4)', boxShadow: '0 0 20px rgba(16,185,129,0.1)' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 30px rgba(16,185,129,0.2)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(16,185,129,0.1)'}>
                <span className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Approve
                </span>
              </button>
              <button onClick={() => handleAction('changes')}
                className="py-3.5 rounded-xl text-sm font-black text-white transition-all"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.25)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.15)'}>
                Request Changes
              </button>
              <button onClick={() => handleAction('dispute')}
                className="py-3.5 rounded-xl text-sm font-black text-white transition-all"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.22)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.12)'}>
                Raise Dispute
              </button>
            </div>

          </div>
        )}
      </div>
      </div>
    </div>
  );
}
