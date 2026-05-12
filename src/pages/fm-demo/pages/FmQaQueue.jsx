import { useState } from 'react';
import jobs     from '../mock/jobs.json';
import cleaners from '../mock/cleaners.json';
import sites    from '../mock/sites.json';
import clients  from '../mock/clients.json';
import { getServiceColour } from '../utils/colours';

const EVIDENCE_MOCK = [
  { type: 'Before',    label: 'Main entrance — before',    icon: '📷', time: '07:41' },
  { type: 'Before',    label: 'Reception — before',        icon: '📷', time: '07:43' },
  { type: 'After',     label: 'Main entrance — after',     icon: '✅', time: '08:31' },
  { type: 'After',     label: 'Reception — after',         icon: '✅', time: '08:35' },
  { type: 'After',     label: 'Toilets — after',           icon: '✅', time: '08:40' },
  { type: 'Signature', label: 'Site supervisor sign-off',  icon: '✍️', time: '08:44' },
];

const SLA_CHECKS = [
  { item: 'Arrived within SLA window',            pass: true  },
  { item: 'All areas cleaned as per schedule',    pass: true  },
  { item: 'Before & after photos uploaded',       pass: true  },
  { item: 'Completed within time window',         pass: true  },
  { item: 'Site supervisor sign-off obtained',    pass: true  },
];

const RATINGS = [1, 2, 3, 4, 5];

export default function FmQaQueue({ showToast }) {
  const [selected, setSelected] = useState(null);
  const [actioned, setActioned] = useState({});
  const [rating,   setRating]   = useState(0);

  const qaJobs = jobs.filter(j => j.status === 'awaiting-qa' || j.status === 'disputed');
  const sel     = qaJobs.find(j => j.id === selected);
  const selSite = sel ? sites.find(s => s.id === sel.siteId) : null;
  const selCleaner = sel?.cleanerId ? cleaners.find(c => c.id === sel.cleanerId) : null;
  const selClient  = sel ? clients.find(c => c.id === sel.clientId) : null;

  const pending = qaJobs.filter(j => !actioned[j.id]).length;

  function handleAction(action) {
    setActioned(prev => ({ ...prev, [selected]: action }));
    const msgs = {
      approve:  `approve job and release payment to ${selCleaner?.name}`,
      changes:  `request changes from ${selCleaner?.name}`,
      dispute:  `raise dispute for job at ${selSite?.name}`,
    };
    showToast(msgs[action]);
    setSelected(null);
    setRating(0);
  }

  const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)' };

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: queue list ── */}
      <div className="w-[42%] flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="text-white font-bold text-sm">QA Queue</div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}>
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
                  background: isActive ? 'rgba(79,120,255,0.12)' : 'rgba(255,255,255,0.05)',
                  border: isActive
                    ? '1px solid rgba(79,120,255,0.4)'
                    : isDisputed
                    ? '1px solid rgba(239,68,68,0.3)'
                    : '1px solid rgba(255,255,255,0.09)',
                  backdropFilter: 'blur(12px)',
                  opacity: done ? 0.5 : 1,
                  cursor: done ? 'default' : 'pointer',
                }}
              >
                <div className="flex items-start gap-3">
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
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-white/40 text-xs">{cleaner?.name}</span>
                      {(() => { const sc = getServiceColour(job.service); return (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                          {job.service}
                        </span>
                      ); })()}
                    </div>
                    <div className="text-white/30 text-xs">{job.completedAt} · {job.evidenceCount} photos</div>
                  </div>
                  {done ? (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 mt-0.5"
                      style={{
                        background: done === 'approve' ? 'rgba(16,185,129,0.12)' : done === 'changes' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                        border: done === 'approve' ? '1px solid rgba(16,185,129,0.3)' : done === 'changes' ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(239,68,68,0.3)',
                        color: done === 'approve' ? '#34d399' : done === 'changes' ? '#fbbf24' : '#f87171',
                      }}>
                      {done === 'approve' ? '✓ Approved' : done === 'changes' ? 'Changes req.' : 'Disputed'}
                    </span>
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                  )}
                </div>
                {job.disputeNote && (
                  <div className="mt-2 text-xs text-red-400 font-medium pl-0.5 truncate">{job.disputeNote}</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: evidence panel ── */}
      <div className="flex-1 overflow-y-auto">
        {!sel ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="text-4xl opacity-30">🔍</div>
            <div className="text-white/40 text-sm font-medium">Select a job from the queue to review evidence</div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-white font-black text-base">{selSite?.name}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-white/50 text-sm">{selClient?.name}</span>
                {(() => { const sc = getServiceColour(sel.service); return (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                    style={{ background: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}>
                    {sel.service}
                  </span>
                ); })()}
              </div>
                <div className="text-white/35 text-xs mt-1">
                  {selCleaner?.name} · Completed {sel.completedAt} · {sel.evidenceCount} items uploaded
                </div>
              </div>
              {sel.status === 'disputed' && (
                <span className="text-xs font-black px-3 py-1.5 rounded-full shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                  DISPUTED
                </span>
              )}
            </div>

            {sel.disputeNote && (
              <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <div className="text-[10px] font-black uppercase tracking-widest text-red-400/60 mb-1">Dispute reason</div>
                <div className="text-sm text-red-300">{sel.disputeNote}</div>
              </div>
            )}

            {/* SLA checklist */}
            <div className="rounded-2xl p-5" style={glass}>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">SLA checklist</div>
              <div className="space-y-2.5">
                {SLA_CHECKS.map(({ item, pass }) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold"
                      style={pass
                        ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }
                        : { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }
                      }>
                      {pass ? '✓' : '✗'}
                    </div>
                    <span className="text-sm text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence grid */}
            <div className="rounded-2xl p-5" style={glass}>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-4">
                Evidence pack — {sel.evidenceCount} items
              </div>
              <div className="grid grid-cols-2 gap-3">
                {EVIDENCE_MOCK.map((e, i) => (
                  <button key={i} onClick={() => showToast(`view photo: ${e.label}`)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
                    onMouseEnter={el => { el.currentTarget.style.background = 'rgba(255,255,255,0.1)'; el.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                    onMouseLeave={el => { el.currentTarget.style.background = 'rgba(255,255,255,0.05)'; el.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; }}
                  >
                    <span className="text-xl shrink-0">{e.icon}</span>
                    <div>
                      <div className="text-white/80 text-xs font-bold leading-tight">{e.label}</div>
                      <div className="text-white/30 text-[10px] mt-0.5">{e.type} · {e.time}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Rate cleaner */}
            <div className="rounded-2xl p-5" style={glass}>
              <div className="text-white/35 text-[10px] font-black uppercase tracking-widest mb-3">Rate this clean</div>
              <div className="flex items-center gap-2">
                {RATINGS.map(n => (
                  <button key={n} onClick={() => setRating(n)}
                    className="text-2xl transition-transform hover:scale-110"
                    style={{ opacity: n <= rating ? 1 : 0.25 }}>
                    ★
                  </button>
                ))}
                {rating > 0 && <span className="text-white/40 text-xs ml-2">{['','Poor','Below average','Average','Good','Excellent'][rating]}</span>}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => handleAction('approve')}
                className="py-3 rounded-xl text-sm font-black text-white transition-colors"
                style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.35)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
              >
                ✓ Approve
              </button>
              <button onClick={() => handleAction('changes')}
                className="py-3 rounded-xl text-sm font-black text-white transition-colors"
                style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.18)'}
              >
                Request Changes
              </button>
              <button onClick={() => handleAction('dispute')}
                className="py-3 rounded-xl text-sm font-black text-white transition-colors"
                style={{ background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.4)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
              >
                Raise Dispute
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
