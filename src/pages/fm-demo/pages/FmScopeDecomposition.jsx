import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, AlertCircle, Check, X } from 'lucide-react';

const SECTOR_SPECS = {
  Healthcare:     { dbs: 'Enhanced DBS', certs: ['Infection Control', 'COSHH'],         colour: '#34d399', emoji: '🏥' },
  Retail:         { dbs: 'Basic DBS',    certs: ['Manual Handling'],                     colour: '#4f78ff', emoji: '🛍️' },
  'Public Sector':{ dbs: 'Standard DBS', certs: ['COSHH'],                               colour: '#a78bfa', emoji: '🏛️' },
  Education:      { dbs: 'Enhanced DBS', certs: ['Safeguarding', 'COSHH'],               colour: '#f472b6', emoji: '🎓' },
  Hospitality:    { dbs: 'Basic DBS',    certs: ['Food Hygiene'],                         colour: '#60a5fa', emoji: '🏨' },
  Industrial:     { dbs: 'Basic DBS',    certs: ['COSHH', 'Asbestos Awareness'],          colour: '#fbbf24', emoji: '🏭' },
};

const WORK_TYPES   = ['Daily clean','Morning clean','Evening clean','Deep clean','Washroom service','Specialist clean','Window clean','Carpet clean'];
const FREQUENCIES  = ['Mon–Fri daily','Mon–Sat daily','Daily (7 days)','3× per week','Weekly','Fortnightly'];
const SLA_WINDOWS  = ['05:00–07:00','06:00–08:00','06:30–08:30','07:00–09:00','18:00–20:00','20:00–22:00','22:00–00:00'];

const WORK_TYPE_HOURS = {
  'Daily clean':2,'Morning clean':2,'Evening clean':2,'Deep clean':4,
  'Washroom service':1,'Specialist clean':5,'Window clean':3,'Carpet clean':3,
};
const FREQ_MULTI = {
  'Mon–Fri daily':22,'Mon–Sat daily':26,'Daily (7 days)':30,
  '3× per week':13,'Weekly':4,'Fortnightly':2,
};

function calcHours(wt) {
  return (WORK_TYPE_HOURS[wt.type] || 2) * (FREQ_MULTI[wt.freq] || 4);
}

const glass = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };

const DEMO_CLIENTS = [
  { name: 'Luton & Dunstable NHS FT',     sector: 'Healthcare',     value: 13000, initials: 'LD' },
  { name: 'Next Retail UK Ltd',           sector: 'Retail',         value: 5400,  initials: 'NX' },
  { name: 'Luton Borough Council',        sector: 'Public Sector',  value: 6800,  initials: 'LB' },
  { name: 'University of Bedfordshire',   sector: 'Education',      value: 5800,  initials: 'UB' },
  { name: 'Whitbread Hotels Ltd',         sector: 'Hospitality',    value: 3200,  initials: 'WH' },
  { name: 'Aldi UK Ltd',                  sector: 'Industrial',     value: 4200,  initials: 'AL' },
];

const INITIAL_TREES = {
  'Healthcare': [
    { id: 's1', name: 'L&D Hospital – Main Tower', open: true, areas: [
      { id: 'a1', name: 'General Wards – Floors 2–6', open: true, workTypes: [
        { id: 'wt1', type: 'Daily clean',     freq: 'Mon–Fri daily', window: '06:00–08:00' },
        { id: 'wt2', type: 'Deep clean',      freq: 'Weekly',        window: '07:00–09:00' },
        { id: 'wt3', type: 'Washroom service',freq: 'Mon–Fri daily', window: '12:00–13:00' },
      ]},
      { id: 'a2', name: 'A&E & Outpatients', open: false, workTypes: [
        { id: 'wt4', type: 'Specialist clean', freq: 'Mon–Fri daily', window: '05:00–07:00' },
        { id: 'wt5', type: 'Washroom service', freq: 'Mon–Fri daily', window: '06:00–08:00' },
      ]},
    ]},
    { id: 's2', name: 'L&D Hospital – A&E Block Extension', open: false, areas: [
      { id: 'a3', name: 'Reception & Waiting', open: false, workTypes: [
        { id: 'wt6', type: 'Daily clean', freq: 'Mon–Fri daily', window: '06:30–08:30' },
      ]},
    ]},
  ],
  'Retail': [
    { id: 's1', name: 'Next – Luton The Mall', open: true, areas: [
      { id: 'a1', name: 'Sales floor', open: true, workTypes: [
        { id: 'wt1', type: 'Morning clean', freq: 'Mon–Sat daily', window: '06:00–08:00' },
      ]},
      { id: 'a2', name: 'Staff areas & toilets', open: false, workTypes: [
        { id: 'wt2', type: 'Daily clean',     freq: 'Mon–Sat daily', window: '06:00–08:00' },
        { id: 'wt3', type: 'Washroom service',freq: 'Mon–Sat daily', window: '06:00–08:00' },
      ]},
    ]},
  ],
};

function getInitialTree(sector) {
  return INITIAL_TREES[sector] || [
    { id: 's1', name: 'Site 1', open: true, areas: [
      { id: 'a1', name: 'Main area', open: true, workTypes: [
        { id: 'wt1', type: 'Daily clean', freq: 'Mon–Fri daily', window: '06:00–08:00' },
      ]},
    ]},
  ];
}

function uid() { return `id_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

export default function FmScopeDecomposition({ onNavigate }) {
  const [clientIdx, setClientIdx]   = useState(0);
  const [tree, setTree]             = useState(getInitialTree(DEMO_CLIENTS[0].sector));
  const [addingSite, setAddingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [addingArea, setAddingArea] = useState(null);
  const [newAreaName, setNewAreaName] = useState('');
  const [editing, setEditing]       = useState(null); // { siteId, areaId, wtId, field }

  const client = DEMO_CLIENTS[clientIdx];
  const spec   = SECTOR_SPECS[client.sector];

  function switchClient(idx) {
    setClientIdx(idx);
    setTree(getInitialTree(DEMO_CLIENTS[idx].sector));
    setEditing(null); setAddingSite(false); setAddingArea(null);
  }

  const allWTs    = tree.flatMap(s => s.areas.flatMap(a => a.workTypes));
  const totalHrs  = allWTs.reduce((s, wt) => s + calcHours(wt), 0);
  const totalCards = allWTs.length;
  const costEst   = Math.round(totalHrs * 12.5);
  const margin    = client.value > 0 ? Math.round(((client.value - costEst) / client.value) * 100) : 0;

  // ── tree mutations ──────────────────────────────────────────────────────────
  function toggleSite(sid) {
    setTree(t => t.map(s => s.id === sid ? { ...s, open: !s.open } : s));
  }
  function toggleArea(sid, aid) {
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, areas: s.areas.map(a => a.id === aid ? { ...a, open: !a.open } : a),
    }));
  }
  function removeSite(sid) {
    setTree(t => t.filter(s => s.id !== sid));
  }
  function removeArea(sid, aid) {
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, areas: s.areas.filter(a => a.id !== aid),
    }));
  }
  function removeWT(sid, aid, wtid) {
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, areas: s.areas.map(a => a.id !== aid ? a : {
        ...a, workTypes: a.workTypes.filter(wt => wt.id !== wtid),
      }),
    }));
  }
  function addSite() {
    if (!newSiteName.trim()) return;
    const id = uid();
    setTree(t => [...t, {
      id, name: newSiteName.trim(), open: true,
      areas: [{ id: uid(), name: 'Main area', open: true, workTypes: [
        { id: uid(), type: 'Daily clean', freq: 'Mon–Fri daily', window: '06:00–08:00' },
      ]}],
    }]);
    setNewSiteName(''); setAddingSite(false);
  }
  function addArea(sid) {
    if (!newAreaName.trim()) return;
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, open: true,
      areas: [...s.areas, { id: uid(), name: newAreaName.trim(), open: true, workTypes: [
        { id: uid(), type: 'Daily clean', freq: 'Mon–Fri daily', window: '06:00–08:00' },
      ]}],
    }));
    setNewAreaName(''); setAddingArea(null);
  }
  function addWT(sid, aid) {
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, areas: s.areas.map(a => a.id !== aid ? a : {
        ...a, open: true,
        workTypes: [...a.workTypes, { id: uid(), type: 'Daily clean', freq: 'Mon–Fri daily', window: '06:00–08:00' }],
      }),
    }));
  }
  function updateWT(sid, aid, wtid, field, value) {
    setTree(t => t.map(s => s.id !== sid ? s : {
      ...s, areas: s.areas.map(a => a.id !== aid ? a : {
        ...a, workTypes: a.workTypes.map(wt => wt.id !== wtid ? wt : { ...wt, [field]: value }),
      }),
    }));
    setEditing(null);
  }

  const sel = editing;

  return (
    <div className="p-6 max-w-5xl space-y-5">

      {/* Impact strip */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(79,120,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">What Cadi replaces</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: '#4f78ff' }}>With Cadi</span>
        </div>
        <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {[
            { before: 'Scope built in Excel — no link to live contracts or staff', after: 'Scope decomposed by area, type and SLA — tied to every job', icon: '🗂' },
            { before: 'Compliance requirements guessed or missed per site',        after: 'DBS and cert requirements pulled automatically by sector',  icon: '🔒' },
            { before: 'Scope changes communicated by email, lost in threads',      after: 'Change saved once — all operatives and clients updated live', icon: '🔄' },
          ].map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client selector */}
      <div className="rounded-2xl overflow-hidden" style={{ ...glass }}>
        <div className="px-5 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">Select client to scope</span>
        </div>
        <div className="grid grid-cols-6 divide-x" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {DEMO_CLIENTS.map((c, i) => {
            const sp = SECTOR_SPECS[c.sector];
            const active = i === clientIdx;
            return (
              <button key={c.initials} onClick={() => switchClient(i)}
                className="px-3 py-3 flex flex-col items-center gap-1 transition-all"
                style={active ? { background: `${sp.colour}15`, borderBottom: `2px solid ${sp.colour}` } : { borderBottom: '2px solid transparent' }}>
                <div className="text-lg">{sp.emoji}</div>
                <div className="text-[10px] font-black leading-tight text-center" style={{ color: active ? sp.colour : 'rgba(255,255,255,0.4)' }}>
                  {c.initials}
                </div>
                <div className="text-[9px] text-white/25 leading-tight text-center hidden sm:block">{c.sector}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contract header + live metrics */}
      <div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${spec.colour}10, rgba(79,120,255,0.06))`, border: `1px solid ${spec.colour}30` }}>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black shrink-0 text-sm"
            style={{ background: `${spec.colour}20`, border: `1px solid ${spec.colour}35`, color: spec.colour }}>
            {client.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-black text-base">{client.name}</div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${spec.colour}15`, color: spec.colour }}>{client.sector}</span>
              <span className="text-[10px] text-white/40">£{client.value.toLocaleString()}/mo</span>
              <span className="text-[10px] text-white/40">·</span>
              <span className="text-[10px] text-white/40">{spec.dbs}</span>
              {spec.certs.map(c => <span key={c} className="text-[10px] text-white/40">· {c}</span>)}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center shrink-0">
            {[
              { v: tree.reduce((s,si) => s + si.areas.length, 0), l: 'Areas',     c: 'white' },
              { v: totalCards,                                      l: 'Job cards', c: '#60a5fa' },
              { v: `${totalHrs}h`,                                 l: 'Hrs/mo',   c: '#a78bfa' },
              { v: `${margin}%`,                                   l: 'Margin',   c: margin > 30 ? '#34d399' : '#fbbf24' },
            ].map(({ v, l, c }) => (
              <div key={l} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-lg font-black" style={{ color: c }}>{v}</div>
                <div className="text-[10px] text-white/30">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scope tree */}
      <div className="space-y-3">
        {tree.map(site => (
          <div key={site.id} className="rounded-2xl overflow-hidden" style={glass}>

            {/* Site header */}
            <div className="flex items-center gap-2 px-4 py-3.5 group"
              style={{ borderBottom: site.open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <button onClick={() => toggleSite(site.id)} className="flex items-center gap-2 flex-1 text-left">
                {site.open
                  ? <ChevronDown size={15} className="text-white/40 shrink-0" />
                  : <ChevronRight size={15} className="text-white/40 shrink-0" />}
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: spec.colour }} />
                <span className="text-white font-black text-sm">{site.name}</span>
              </button>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
                style={{ background: `${spec.colour}12`, color: spec.colour }}>{client.sector}</span>
              <span className="text-[10px] text-white/25 shrink-0">{site.areas.length} area{site.areas.length !== 1 ? 's' : ''}</span>
              <button onClick={() => removeSite(site.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-red-400/40 hover:text-red-400 shrink-0">
                <Trash2 size={13} />
              </button>
            </div>

            {site.open && (
              <div className="px-4 pb-4 pt-3 space-y-2.5">
                {site.areas.map(area => (
                  <div key={area.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>

                    {/* Area header */}
                    <div className="flex items-center gap-2 px-3 py-2.5 group/area"
                      style={{ borderBottom: area.open ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <button onClick={() => toggleArea(site.id, area.id)} className="flex items-center gap-2 flex-1 text-left">
                        {area.open
                          ? <ChevronDown size={13} className="text-white/30 shrink-0" />
                          : <ChevronRight size={13} className="text-white/30 shrink-0" />}
                        <span className="text-white/80 font-bold text-xs">{area.name}</span>
                      </button>
                      <span className="text-[10px] text-white/25">{area.workTypes.length} work type{area.workTypes.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => removeArea(site.id, area.id)}
                        className="opacity-0 group-hover/area:opacity-100 transition-opacity ml-1 text-red-400/40 hover:text-red-400 shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>

                    {area.open && (
                      <div className="px-3 pb-3 pt-2 space-y-1.5">
                        {/* Column headers */}
                        <div className="grid px-2 mb-1" style={{ gridTemplateColumns: '1fr 160px 130px 80px 28px' }}>
                          {['Service type', 'Frequency', 'SLA window', 'Hrs/mo', ''].map(h => (
                            <div key={h} className="text-[9px] font-black uppercase tracking-widest text-white/20">{h}</div>
                          ))}
                        </div>

                        {area.workTypes.map(wt => {
                          const isEditing = sel?.siteId === site.id && sel?.areaId === area.id && sel?.wtId === wt.id;
                          return (
                            <div key={wt.id}
                              className="grid items-center gap-2 px-2 py-2 rounded-lg group/wt"
                              style={{ gridTemplateColumns: '1fr 160px 130px 80px 28px', background: isEditing ? 'rgba(79,120,255,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isEditing ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.05)'}` }}>

                              {/* Service type */}
                              {isEditing && sel.field === 'type'
                                ? <select autoFocus value={wt.type}
                                    onChange={e => updateWT(site.id, area.id, wt.id, 'type', e.target.value)}
                                    onBlur={() => setEditing(null)}
                                    className="bg-[#0d1b4f] text-white text-xs font-bold rounded px-2 py-1 outline-none w-full"
                                    style={{ border: '1px solid rgba(79,120,255,0.5)' }}>
                                    {WORK_TYPES.map(t => <option key={t}>{t}</option>)}
                                  </select>
                                : <button onClick={() => setEditing({ siteId: site.id, areaId: area.id, wtId: wt.id, field: 'type' })}
                                    className="text-white/80 font-bold text-xs text-left hover:text-white transition-colors truncate">
                                    {wt.type}
                                  </button>
                              }

                              {/* Frequency */}
                              {isEditing && sel.field === 'freq'
                                ? <select autoFocus value={wt.freq}
                                    onChange={e => updateWT(site.id, area.id, wt.id, 'freq', e.target.value)}
                                    onBlur={() => setEditing(null)}
                                    className="bg-[#0d1b4f] text-white text-xs rounded px-2 py-1 outline-none w-full"
                                    style={{ border: '1px solid rgba(79,120,255,0.5)' }}>
                                    {FREQUENCIES.map(f => <option key={f}>{f}</option>)}
                                  </select>
                                : <button onClick={() => setEditing({ siteId: site.id, areaId: area.id, wtId: wt.id, field: 'freq' })}
                                    className="text-white/40 text-xs text-left hover:text-white/70 transition-colors truncate">
                                    {wt.freq}
                                  </button>
                              }

                              {/* SLA window */}
                              {isEditing && sel.field === 'window'
                                ? <select autoFocus value={wt.window}
                                    onChange={e => updateWT(site.id, area.id, wt.id, 'window', e.target.value)}
                                    onBlur={() => setEditing(null)}
                                    className="bg-[#0d1b4f] text-white text-xs rounded px-2 py-1 outline-none w-full"
                                    style={{ border: '1px solid rgba(79,120,255,0.5)' }}>
                                    {SLA_WINDOWS.map(w => <option key={w}>{w}</option>)}
                                  </select>
                                : <button onClick={() => setEditing({ siteId: site.id, areaId: area.id, wtId: wt.id, field: 'window' })}
                                    className="text-white/40 text-xs text-left hover:text-white/70 transition-colors">
                                    {wt.window}
                                  </button>
                              }

                              {/* Hours */}
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-center"
                                style={{ background: `${spec.colour}12`, color: spec.colour, border: `1px solid ${spec.colour}25` }}>
                                {calcHours(wt)}h
                              </span>

                              {/* Remove */}
                              <button onClick={() => removeWT(site.id, area.id, wt.id)}
                                className="opacity-0 group-hover/wt:opacity-100 transition-opacity text-red-400/40 hover:text-red-400 flex items-center justify-center">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          );
                        })}

                        {/* Add work type */}
                        <button onClick={() => addWT(site.id, area.id)}
                          className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-2 rounded-lg mt-1 transition-all"
                          style={{ color: 'rgba(255,255,255,0.25)', border: '1px dashed rgba(255,255,255,0.1)' }}
                          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                          <Plus size={11} /> Add work type
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add area inline */}
                {addingArea === site.id ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={newAreaName}
                      onChange={e => setNewAreaName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') addArea(site.id); if (e.key === 'Escape') { setAddingArea(null); setNewAreaName(''); } }}
                      placeholder="Area name (e.g. Ground floor toilets)"
                      className="flex-1 bg-[#0d1b4f] text-white text-xs rounded-lg px-3 py-2 outline-none"
                      style={{ border: '1px solid rgba(79,120,255,0.4)' }}
                    />
                    <button onClick={() => addArea(site.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}>
                      <Check size={12} />
                    </button>
                    <button onClick={() => { setAddingArea(null); setNewAreaName(''); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingArea(site.id); setNewAreaName(''); }}
                    className="flex items-center gap-1.5 text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all mt-1"
                    style={{ color: 'rgba(255,255,255,0.3)', border: '1px dashed rgba(255,255,255,0.12)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                    <Plus size={11} /> Add area
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add site */}
        {addingSite ? (
          <div className="rounded-2xl p-4 flex items-center gap-3" style={{ border: '1px dashed rgba(79,120,255,0.4)', background: 'rgba(79,120,255,0.06)' }}>
            <input
              autoFocus
              value={newSiteName}
              onChange={e => setNewSiteName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addSite(); if (e.key === 'Escape') { setAddingSite(false); setNewSiteName(''); } }}
              placeholder={`Site name (e.g. ${client.name} – North Wing)`}
              className="flex-1 bg-[#0d1b4f] text-white text-sm rounded-xl px-4 py-2.5 outline-none"
              style={{ border: '1px solid rgba(79,120,255,0.4)' }}
            />
            <button onClick={addSite}
              className="px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5"
              style={{ background: 'rgba(52,211,153,0.2)', border: '1px solid rgba(52,211,153,0.4)', color: '#34d399' }}>
              <Check size={13} /> Add site
            </button>
            <button onClick={() => { setAddingSite(false); setNewSiteName(''); }} className="text-white/30 hover:text-white/60">
              <X size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setAddingSite(true)}
            className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
            style={{ border: '1px dashed rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(79,120,255,0.5)'; e.currentTarget.style.color = '#60a5fa'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
            <Plus size={15} /> Add site
          </button>
        )}
      </div>

      {/* Compliance callout */}
      <div className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: `${spec.colour}10`, border: `1px solid ${spec.colour}25` }}>
        <AlertCircle size={15} style={{ color: spec.colour, flexShrink: 0 }} />
        <span className="text-xs text-white/50">
          All <span className="font-bold" style={{ color: spec.colour }}>{spec.dbs}</span> + <span className="font-bold" style={{ color: spec.colour }}>{spec.certs.join(' + ')}</span> requirements auto-applied to every work type in this <strong className="text-white/60">{client.sector}</strong> contract.
        </span>
      </div>

      {/* Edit hint */}
      <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="text-[10px] text-white/25">💡 Click any service type, frequency, or SLA window to edit inline. Hover a row to delete it. Hours and margin update live.</span>
      </div>

      <button
        onClick={() => onNavigate && onNavigate('routing')}
        className="w-full py-3 rounded-xl font-black text-sm transition-all"
        style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(79,120,255,0.45)', color: 'white' }}>
        Next: Route to workforce →
      </button>
    </div>
  );
}
