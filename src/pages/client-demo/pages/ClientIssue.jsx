import { useState } from 'react';

const AREAS = [
  'Main entrance', 'Reception', 'Corridor A', 'Corridor B',
  'Toilets — Ground floor', 'Toilets — First floor', 'Classroom block',
  'Staff room', 'Kitchen', 'Playground area', 'Car park',
];

const SEVERITY = [
  { value: 'low',    label: 'Low',      desc: 'Minor — no urgent action needed',      color: '#059669' },
  { value: 'medium', label: 'Medium',   desc: 'Should be addressed at next clean',    color: '#f59e0b' },
  { value: 'high',   label: 'High',     desc: 'Urgent — needs same-day response',     color: '#ef4444' },
];

export default function ClientIssue({ showToast, onNavigate }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ area: '', severity: '', description: '' });
  function patch(p) { setForm(prev => ({ ...prev, ...p })); }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="p-6 max-w-md flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl">✅</div>
        <h2 className="font-black text-xl text-[#010a4f]">Issue reported</h2>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 w-full text-left space-y-2">
          {[
            { label: 'Reference',  value: '#4471' },
            { label: 'Reported to', value: 'Britannia Group' },
            { label: 'Response',   value: 'Within 4 business hours' },
            { label: 'Area',       value: form.area || 'Main entrance' },
            { label: 'Severity',   value: form.severity || 'Medium' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-400">{label}</span>
              <span className="font-medium text-[#010a4f]">{value}</span>
            </div>
          ))}
        </div>
        <button onClick={() => { setSubmitted(false); setForm({ area: '', severity: '', description: '' }); onNavigate('dashboard'); }}
          className="w-full py-3 rounded-xl bg-[#010a4f] text-white font-bold text-sm hover:bg-[#1f48ff] transition-colors">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md space-y-5">
      <div>
        <h2 className="font-black text-[#010a4f] text-lg">Report an issue</h2>
        <p className="text-xs text-gray-400 mt-0.5">Reported directly to Britannia Group. Reference number issued on submission.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Area */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Location in building</label>
          <select
            required
            value={form.area}
            onChange={e => patch({ area: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4f78ff] bg-white"
          >
            <option value="">Select area…</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Severity</label>
          <div className="space-y-2">
            {SEVERITY.map(({ value, label, desc, color }) => (
              <button key={value} type="button"
                onClick={() => patch({ severity: value })}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                  form.severity === value ? 'border-2' : 'border border-gray-100 bg-white hover:border-gray-200'
                }`}
                style={form.severity === value ? { borderColor: color, backgroundColor: color + '10' } : {}}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div>
                  <div className="text-sm font-bold text-[#010a4f]">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Description</label>
          <textarea
            required
            value={form.description}
            onChange={e => patch({ description: e.target.value })}
            placeholder="Please describe the issue clearly…"
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4f78ff] resize-none"
          />
        </div>

        {/* Photo */}
        <div>
          <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Photo (optional)</label>
          <label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 text-center hover:border-[#4f78ff] transition-colors">
            <div className="text-2xl mb-1">📸</div>
            <div className="text-xs text-gray-400">Tap to add a photo</div>
            <input type="file" accept="image/*" className="hidden" />
          </label>
        </div>

        <button type="submit"
          className="w-full py-3.5 rounded-xl bg-[#010a4f] text-white font-black text-sm hover:bg-[#1f48ff] transition-colors">
          Submit issue report
        </button>
      </form>
    </div>
  );
}
