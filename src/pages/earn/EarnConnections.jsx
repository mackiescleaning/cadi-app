import { useState } from 'react';

const EARN_ORANGE = '#C2410C';

const STATUS_CFG = {
  active:          { label: 'Active',           color: '#059669', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)'  },
  pending:         { label: 'Pending review',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)'  },
  'not-connected': { label: 'Not connected',    color: '#6b7280', bg: 'rgba(107,114,128,0.08)', border: 'rgba(107,114,128,0.2)'  },
  suspended:       { label: 'Suspended',        color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)'  },
};

const FMS = [
  {
    id: 'fm1', name: 'Britannia FM', region: 'Bedfordshire + Bucks',
    status: 'active', since: 'Jan 2026', jobsDone: 47, avgRating: 4.8,
    pendingPay: 420, totalEarned: 3995,
    contract: 'Standard subcontractor · Net 14 payment',
    desc: 'Leading FM aggregator across South East Midlands. 200+ sites under management.',
    minScore: 70,
  },
  {
    id: 'fm2', name: 'Metro Clean Management', region: 'Luton + Hertfordshire',
    status: 'pending', applied: '3 days ago',
    desc: 'Specialist in commercial and retail sites. Require 75+ Cadi score.',
    minScore: 75, jobsAvail: 8,
  },
  {
    id: 'fm3', name: 'Compass FM', region: 'Milton Keynes + Northants',
    status: 'not-connected',
    desc: 'Government and public sector specialist. Enhanced DBS required.',
    minScore: 80, jobsAvail: 12, avgJobValue: 95,
  },
  {
    id: 'fm4', name: 'Spotless Networks', region: 'Bedfordshire + Cambs',
    status: 'not-connected',
    desc: 'Retail and logistics sector. Fast-turnaround contracts. Flexible hours.',
    minScore: 65, jobsAvail: 8, avgJobValue: 110,
  },
  {
    id: 'fm5', name: 'CityClean Group', region: 'Milton Keynes area',
    status: 'not-connected',
    desc: 'Hospitality and leisure sector. Weekend-heavy rota. Premium rates.',
    minScore: 70, jobsAvail: 5, avgJobValue: 78,
  },
];

export default function EarnConnections() {
  const [applied, setApplied] = useState({});
  const [expanded, setExpanded] = useState({ fm1: true });

  return (
    <div className="max-w-2xl space-y-5 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">FM Connections</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your FM relationships — each has its own contract terms, rates and requirements.</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Connected',   value: FMS.filter(f => f.status === 'active').length,          color: '#059669' },
          { label: 'Pending',     value: FMS.filter(f => f.status === 'pending').length,         color: '#f59e0b' },
          { label: 'Available',   value: FMS.filter(f => f.status === 'not-connected').length,   color: '#6b7280' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm p-4 text-center">
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* FM cards */}
      {FMS.map(fm => {
        const cfg = STATUS_CFG[fm.status];
        const isOpen = expanded[fm.id];
        const didApply = applied[fm.id];

        return (
          <div key={fm.id} className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpanded(p => ({ ...p, [fm.id]: !p[fm.id] }))}
              className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-[#010a4f]">{fm.name}</span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">{fm.region}</div>
              </div>
              {fm.status === 'active' && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-[#010a4f]">£{fm.totalEarned?.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">total earned</div>
                </div>
              )}
              {fm.status === 'not-connected' && (
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-gray-500">{fm.jobsAvail} jobs</div>
                  <div className="text-[10px] text-gray-400">in your area</div>
                </div>
              )}
              <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-50 pt-4">
                <p className="text-sm text-gray-500 leading-relaxed">{fm.desc}</p>

                {fm.status === 'active' && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Jobs completed', value: fm.jobsDone },
                      { label: 'Avg. rating',    value: `${fm.avgRating}★` },
                      { label: 'Pending pay',    value: `£${fm.pendingPay}` },
                      { label: 'Contract',       value: fm.contract },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl bg-[#f8faff] px-3 py-2.5">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</div>
                        <div className="text-sm font-bold text-[#010a4f] leading-snug">{value}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-bold text-gray-400">Min. Cadi score:</div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#f0f4ff] text-[#4f78ff]">{fm.minScore}+</span>
                </div>

                {fm.status === 'active' && (
                  <div className="flex gap-2">
                    <button className="px-4 py-2 rounded-xl text-xs font-bold border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300 transition-colors">
                      View jobs
                    </button>
                    <button className="px-4 py-2 rounded-xl text-xs font-bold border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300 transition-colors">
                      Payment history
                    </button>
                  </div>
                )}

                {fm.status === 'pending' && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                    Application submitted {fm.applied}. Britannia reviews typically take 3–5 working days.
                  </div>
                )}

                {fm.status === 'not-connected' && (
                  <button
                    onClick={() => setApplied(p => ({ ...p, [fm.id]: true }))}
                    disabled={!!didApply}
                    className="px-6 py-2.5 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-60"
                    style={{ background: EARN_ORANGE }}>
                    {didApply ? '✓ Application sent' : 'Apply to join →'}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
