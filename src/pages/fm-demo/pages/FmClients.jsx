import { useState } from 'react';

const CLIENTS = [
  {
    id: 'cl1', name: 'Next Retail UK Ltd', logo: 'NX', type: 'Retail',
    sites: 3, value: 5400, sla: 99, contact: 'Helen Marsh', contactRole: 'Facilities Manager',
    since: 'Jan 2024', status: 'active', openIssues: 0,
    siteList: ['Next – Luton The Mall', 'Next – Centre:MK', 'Next – Watford Atria'],
    lastClean: 'Today 07:42', note: null,
  },
  {
    id: 'cl2', name: 'Luton & Dunstable NHS FT', logo: 'LD', type: 'Healthcare',
    sites: 2, value: 13000, sla: 98, contact: 'Brian Cole', contactRole: 'Estates Manager',
    since: 'Mar 2023', status: 'active', openIssues: 1,
    siteList: ['L&D Hospital – Main Tower', 'L&D Hospital – A&E & Outpatients'],
    lastClean: 'Today 06:15', note: 'ISS-0040 in progress — quality dispute A&E wing',
  },
  {
    id: 'cl3', name: 'Aldi UK Ltd', logo: 'AL', type: 'Industrial',
    sites: 1, value: 4200, sla: 97, contact: 'Ops Team', contactRole: 'Regional Ops',
    since: 'Jun 2023', status: 'active', openIssues: 0,
    siteList: ['Aldi – Dunstable Distribution RDC'],
    lastClean: 'Today 05:50', note: null,
  },
  {
    id: 'cl4', name: 'Luton Borough Council', logo: 'LB', type: 'Public Sector',
    sites: 2, value: 6800, sla: 96, contact: 'Janet Simms', contactRole: 'Facilities Lead',
    since: 'Sep 2023', status: 'active', openIssues: 1,
    siteList: ['Luton Central Library', 'Luton Town Hall'],
    lastClean: 'Today 07:10', note: 'ISS-0041 open — SLA breach Luton Library this morning',
  },
  {
    id: 'cl5', name: 'Central Bedfordshire Council', logo: 'CB', type: 'Public Sector',
    sites: 2, value: 7200, sla: 98, contact: 'Mark Davies', contactRole: 'Estates Director',
    since: 'Nov 2023', status: 'active', openIssues: 0,
    siteList: ['Central Beds Council HQ', 'Central Beds Watling House'],
    lastClean: 'Today 07:30', note: null,
  },
  {
    id: 'cl6', name: 'Whitbread Hotels Ltd', logo: 'WH', type: 'Hospitality',
    sites: 1, value: 3200, sla: 95, contact: 'Ops Team', contactRole: 'Regional Ops',
    since: 'Feb 2024', status: 'active', openIssues: 0,
    siteList: ['Premier Inn Luton Airport'],
    lastClean: 'Today 06:30', note: null,
  },
  {
    id: 'cl7', name: 'Waterstones Ltd', logo: 'WS', type: 'Retail',
    sites: 2, value: 3600, sla: 97, contact: 'Regional Ops', contactRole: 'Regional Manager',
    since: 'Apr 2024', status: 'active', openIssues: 0,
    siteList: ['Waterstones – Luton', 'Waterstones – Watford'],
    lastClean: 'Today 07:55', note: null,
  },
  {
    id: 'cl8', name: 'University of Bedfordshire', logo: 'UB', type: 'Education',
    sites: 1, value: 5800, sla: 99, contact: 'Facilities Manager', contactRole: 'Campus FM',
    since: 'Aug 2023', status: 'active', openIssues: 0,
    siteList: ['UoB Luton Campus'],
    lastClean: 'Today 06:45', note: null,
  },
];

const TYPE_COLORS = {
  'Retail':       '#4f78ff',
  'Healthcare':   '#34d399',
  'Industrial':   '#fbbf24',
  'Public Sector':'#a78bfa',
  'Hospitality':  '#60a5fa',
  'Education':    '#f472b6',
};

export default function FmClients({ showToast, onNavigate }) {
  const [expanded, setExpanded] = useState(null);

  const totalValue  = CLIENTS.reduce((s, c) => s + c.value, 0);
  const totalSites  = CLIENTS.reduce((s, c) => s + c.sites, 0);
  const avgSla      = Math.round(CLIENTS.reduce((s, c) => s + c.sla, 0) / CLIENTS.length);
  const openIssues  = CLIENTS.reduce((s, c) => s + c.openIssues, 0);

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active clients',    value: CLIENTS.length, sub: 'all contracts live',      color: '#4f78ff' },
          { label: 'Total sites',       value: totalSites,     sub: 'under management',         color: '#a78bfa' },
          { label: 'Monthly value',     value: `£${(totalValue/1000).toFixed(1)}k`, sub: 'contracted MRR', color: '#34d399' },
          { label: 'Portfolio SLA',     value: `${avgSla}%`,   sub: `${openIssues} open issue${openIssues !== 1 ? 's' : ''}`, color: openIssues > 0 ? '#fbbf24' : '#34d399' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/80 text-xs font-bold mt-0.5">{label}</div>
            <div className="text-white/30 text-[10px] mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Client list */}
      <div className="space-y-2">
        {CLIENTS.map(c => {
          const typeColor = TYPE_COLORS[c.type] || '#94a3b8';
          const isOpen = expanded === c.id;
          return (
            <div key={c.id} className="rounded-2xl overflow-hidden transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${isOpen ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.08)'}` }}>

              {/* Main row */}
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : c.id)}>
                {/* Logo */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                  style={{ background: `${typeColor}22`, border: `1px solid ${typeColor}40`, color: typeColor }}>
                  {c.logo}
                </div>
                {/* Name + type */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-sm">{c.name}</span>
                    {c.openIssues > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
                        {c.openIssues} open issue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${typeColor}15`, color: typeColor }}>{c.type}</span>
                    <span className="text-white/30 text-[10px]">Since {c.since}</span>
                  </div>
                </div>
                {/* Sites */}
                <div className="text-center w-16">
                  <div className="text-white font-black text-sm">{c.sites}</div>
                  <div className="text-white/30 text-[10px]">site{c.sites !== 1 ? 's' : ''}</div>
                </div>
                {/* Value */}
                <div className="text-center w-24">
                  <div className="text-white font-black text-sm">£{c.value.toLocaleString()}</div>
                  <div className="text-white/30 text-[10px]">per month</div>
                </div>
                {/* SLA */}
                <div className="text-center w-16">
                  <div className="font-black text-sm" style={{ color: c.sla >= 98 ? '#34d399' : c.sla >= 95 ? '#fbbf24' : '#f87171' }}>{c.sla}%</div>
                  <div className="text-white/30 text-[10px]">SLA</div>
                </div>
                {/* Chevron */}
                <div className="text-white/20 text-sm ml-2">{isOpen ? '↑' : '↓'}</div>
              </div>

              {/* Expanded */}
              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-white/5 grid grid-cols-3 gap-4">
                  {/* Sites */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Sites under contract</div>
                    <div className="space-y-2">
                      {c.siteList.map(s => (
                        <div key={s} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: typeColor }} />
                          <span className="text-xs text-white/60">{s}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 text-[10px] text-white/30">Last clean: {c.lastClean}</div>
                  </div>
                  {/* Contact */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Client contact</div>
                    <div className="text-white font-bold text-sm">{c.contact}</div>
                    <div className="text-white/40 text-xs mt-0.5">{c.contactRole}</div>
                    {c.note && (
                      <div className="mt-3 p-2 rounded-lg text-[10px] text-amber-400/80 italic"
                        style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                        {c.note}
                      </div>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">Actions</div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'View client portal', action: () => window.open('/client-demo', '_blank') },
                        { label: 'Send client report', action: () => showToast(`send monthly report to ${c.name}`) },
                        { label: 'Message contact',    action: () => showToast(`open message thread with ${c.contact}`) },
                        { label: 'Add new site',       action: () => onNavigate('create') },
                      ].map(({ label, action }) => (
                        <button key={label} onClick={action}
                          className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all text-white/50 hover:text-white"
                          style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
