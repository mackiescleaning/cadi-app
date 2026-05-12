import { useState } from 'react';

const EARN_ORANGE = '#C2410C';

const SLA_CHECKS = [
  { item: 'Arrived within SLA window (06:00–08:00)',  done: true  },
  { item: 'All scheduled areas completed',            done: true  },
  { item: 'Before photos uploaded with timestamp',    done: true  },
  { item: 'After photos uploaded with timestamp',     done: true  },
  { item: 'Time on site recorded',                    done: true  },
  { item: 'Site sign-off obtained (if required)',     done: false },
];

const BEFORE_PHOTOS = [
  { label: 'Main entrance — before', uploaded: true,  time: '07:01' },
  { label: 'Reception — before',     uploaded: true,  time: '07:04' },
  { label: 'Corridor A — before',    uploaded: false, time: null    },
];

const AFTER_PHOTOS = [
  { label: 'Main entrance — after',  uploaded: true,  time: '07:41' },
  { label: 'Reception — after',      uploaded: true,  time: '07:45' },
  { label: 'Toilets — after',        uploaded: true,  time: '07:52' },
  { label: 'Corridor A — after',     uploaded: true,  time: '07:57' },
];

export default function EarnCompletion() {
  const [submitted, setSubmitted] = useState(false);
  const [issues, setIssues] = useState('');
  const [timeIn]  = useState('06:58');
  const [timeOut] = useState('08:03');

  const allChecked = SLA_CHECKS.every(c => c.done);
  const beforeDone = BEFORE_PHOTOS.filter(p => p.uploaded).length;
  const afterDone  = AFTER_PHOTOS.filter(p => p.uploaded).length;

  if (submitted) {
    return (
      <div className="max-w-lg space-y-5 pb-8">
        <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto">✅</div>
          <h2 className="font-black text-xl text-[#010a4f]">Submitted to Britannia FM</h2>
          <p className="text-sm text-gray-500">Riverside Primary · 9 May 2026 · 14 photos · 65 min on site</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'Job reference', value: '#BF-4471' },
              { label: 'FM review',     value: 'Within 24 hrs' },
              { label: 'Payment',       value: '£85 pending' },
              { label: 'SLA status',    value: '✓ Met' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl bg-[#f8faff] p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                <div className="font-bold text-[#010a4f]">{value}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setSubmitted(false)}
            className="text-xs text-[#4f78ff] font-bold hover:underline">
            ← Back to completion form
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Preview banner */}
      <div className="flex items-center gap-3 rounded-xl px-4 py-3"
        style={{ background: 'rgba(194,65,12,0.07)', border: '1px solid rgba(194,65,12,0.2)' }}>
        <span className="text-[9px] font-black tracking-widest px-2 py-0.5 rounded-full shrink-0"
          style={{ background: EARN_ORANGE, color: 'white' }}>PREVIEW</span>
        <span className="text-xs text-[#7c2d12]">
          Work completion form — submit evidence and sign off each job for FM review.
        </span>
      </div>

      {/* Job header */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-gray-400">Work completion</div>
            <h2 className="font-black text-xl text-[#010a4f] mt-0.5">Riverside Primary</h2>
            <div className="text-sm text-gray-500 mt-0.5">Britannia FM · Morning clean · 9 May 2026</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-[#010a4f]">£85</div>
            <div className="text-xs text-gray-400">job value</div>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex-1 rounded-xl bg-[#f8faff] px-3 py-2 text-center">
            <div className="text-sm font-black text-[#010a4f]">{timeIn}</div>
            <div className="text-[10px] text-gray-400">Arrived</div>
          </div>
          <div className="text-gray-300">→</div>
          <div className="flex-1 rounded-xl bg-[#f8faff] px-3 py-2 text-center">
            <div className="text-sm font-black text-[#010a4f]">{timeOut}</div>
            <div className="text-[10px] text-gray-400">Finished</div>
          </div>
          <div className="text-gray-300">·</div>
          <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
            <div className="text-sm font-black text-emerald-700">65 min</div>
            <div className="text-[10px] text-emerald-600">On site</div>
          </div>
        </div>
      </div>

      {/* SLA checklist */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">SLA checklist</div>
        <div className="space-y-2.5">
          {SLA_CHECKS.map(({ item, done }) => (
            <div key={item} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : '·'}
              </div>
              <span className="text-sm text-gray-700">{item}</span>
              {!done && <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Pending</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Before photos */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Before photos</div>
          <span className="text-xs font-bold text-gray-500">{beforeDone}/{BEFORE_PHOTOS.length} uploaded</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BEFORE_PHOTOS.map((p, i) => (
            <div key={i} className={`rounded-xl p-3 flex items-center gap-2 ${
              p.uploaded ? 'bg-gray-50 border border-gray-100' : 'bg-amber-50 border-2 border-dashed border-amber-300'
            }`}>
              <span className="text-base shrink-0">{p.uploaded ? '📷' : '+'}</span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-gray-600 truncate">{p.label}</div>
                {p.time && <div className="text-[9px] text-gray-400">{p.time}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* After photos */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">After photos</div>
          <span className="text-xs font-bold text-emerald-600">{afterDone}/{AFTER_PHOTOS.length} uploaded ✓</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {AFTER_PHOTOS.map((p, i) => (
            <div key={i} className="rounded-xl p-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100">
              <span className="text-base shrink-0">✅</span>
              <div>
                <div className="text-[10px] font-bold text-emerald-800">{p.label}</div>
                <div className="text-[9px] text-emerald-600">{p.time} · geo-stamped</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Issues */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Issues encountered (optional)</div>
        <textarea
          value={issues}
          onChange={e => setIssues(e.target.value)}
          placeholder="Report any issues found during the clean — equipment problems, access issues, areas not completed and why…"
          rows={3}
          className="w-full text-sm border border-[#99c5ff]/30 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#4f78ff] resize-none text-[#010a4f] placeholder-gray-300"
        />
      </div>

      {/* Submit */}
      <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex-1 h-1 rounded-full ${beforeDone > 0 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 rounded-full ${afterDone > 0 ? 'bg-emerald-400' : 'bg-gray-200'}`} />
          <div className="flex-1 h-1 rounded-full bg-emerald-400" />
        </div>
        <div className="text-xs text-gray-400 mb-4">
          {beforeDone === 0 ? '⚠️ Before photos required before submitting.' : afterDone < AFTER_PHOTOS.length ? '⚠️ All after photos required.' : '✓ Ready to submit.'}
        </div>
        <button
          onClick={() => setSubmitted(true)}
          disabled={beforeDone === 0 || afterDone < AFTER_PHOTOS.length}
          className="w-full py-3.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: EARN_ORANGE }}>
          Submit to Britannia FM for review →
        </button>
        <div className="text-[10px] text-gray-400 text-center mt-2">
          By submitting you confirm all work was completed to the required standard
        </div>
      </div>
    </div>
  );
}
