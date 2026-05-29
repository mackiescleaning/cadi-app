import { useState } from 'react';
import { Users, Globe, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

const AREAS = [
  { id: 'a1', site: 'L&D Hospital – Main Tower',       area: 'General Wards – Floors 2–6', workType: 'Daily clean',      freq: 'Mon–Fri', window: '06:00–08:00', hrs: 44, dbs: 'Enhanced DBS', route: 'employed'  },
  { id: 'a2', site: 'L&D Hospital – Main Tower',       area: 'General Wards – Floors 2–6', workType: 'Deep clean',       freq: 'Weekly',  window: '07:00–11:00', hrs: 16, dbs: 'Enhanced DBS', route: 'employed'  },
  { id: 'a3', site: 'L&D Hospital – Main Tower',       area: 'General Wards – Floors 2–6', workType: 'Washroom service', freq: 'Mon–Fri', window: '12:00–13:00', hrs: 22, dbs: 'Enhanced DBS', route: 'employed'  },
  { id: 'a4', site: 'L&D Hospital – Main Tower',       area: 'A&E & Outpatients',          workType: 'Specialist clean', freq: 'Mon–Fri', window: '05:00–07:00', hrs: 110,dbs: 'Enhanced DBS', route: 'connect'   },
  { id: 'a5', site: 'L&D Hospital – Main Tower',       area: 'A&E & Outpatients',          workType: 'Washroom service', freq: 'Mon–Fri', window: '13:00–14:00', hrs: 22, dbs: 'Enhanced DBS', route: 'connect'   },
  { id: 'a6', site: 'L&D Hospital – A&E Block Ext',   area: 'Reception & Waiting',        workType: 'Daily clean',      freq: 'Mon–Fri', window: '06:30–07:30', hrs: 22, dbs: 'Enhanced DBS', route: 'unassigned'},
];

const STAFF = [
  { id: 'st1', name: 'Marcus T.',  capacity: 80,  used: 44, dbs: 'Enhanced DBS' },
  { id: 'st2', name: 'Claire B.', capacity: 60,  used: 22, dbs: 'Enhanced DBS' },
  { id: 'st3', name: 'Kevin O.',  capacity: 80,  used: 16, dbs: 'Standard DBS'  },
];

export default function FmWorkforceRouting({ onNavigate }) {
  const [rows, setRows] = useState(AREAS);
  const [staffRows, setStaffRows] = useState(STAFF);

  function setRoute(id, route) {
    setRows(r => r.map(row => row.id === id ? { ...row, route } : row));
    if (route === 'employed') {
      const hrs = rows.find(r => r.id === id)?.hrs || 0;
      setStaffRows(s => {
        const available = s.find(st => st.dbs === 'Enhanced DBS' && (st.capacity - st.used) >= hrs);
        if (available) {
          return s.map(st => st.id === available.id ? { ...st, used: st.used + hrs } : st);
        }
        return s;
      });
    }
  }

  const employed   = rows.filter(r => r.route === 'employed');
  const connect    = rows.filter(r => r.route === 'connect');
  const unassigned = rows.filter(r => r.route === 'unassigned');

  const totalHrs     = rows.reduce((s, r) => s + r.hrs, 0);
  const coveredHrs   = rows.filter(r => r.route !== 'unassigned').reduce((s, r) => s + r.hrs, 0);
  const coveragePct  = Math.round((coveredHrs / totalHrs) * 100);

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
            { before: 'Workforce coverage tracked in a spreadsheet updated manually', after: 'Coverage gaps flagged automatically — act before a shift is missed', icon: '👥' },
            { before: 'Deciding employed vs contractor by instinct', after: 'Cadi recommends the right routing per area — compliance built in', icon: '⚖️' },
            { before: 'Cover arranged by phone when someone drops out', after: 'Connect fills gaps in under 15 minutes — no FM involvement needed', icon: '🔄' },
          ].map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div><div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">{before}</div>
              <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>{after}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage header */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { v: `${coveragePct}%`,    l: 'Coverage',        c: coveragePct === 100 ? '#34d399' : coveragePct > 70 ? '#fbbf24' : '#f87171' },
          { v: employed.length,      l: 'Employed',        c: '#4f78ff'  },
          { v: connect.length,       l: 'Cadi Connect',    c: '#fb923c'  },
          { v: unassigned.length,    l: 'Unassigned',      c: unassigned.length ? '#f87171' : '#34d399' },
        ].map(({ v, l, c }) => (
          <div key={l} className="rounded-2xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color: c }}>{v}</div>
            <div className="text-white/50 text-xs font-bold mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Routing table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-white/25"
          style={{ gridTemplateColumns: '1fr 1fr 1fr auto auto', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span>Area</span><span>Work type</span><span>Window · Freq</span><span className="text-center">Hrs/mo</span><span className="text-center w-52">Route</span>
        </div>

        {rows.map((row, i) => {
          const status = row.route === 'employed' ? { c: '#4f78ff', bg: 'rgba(79,120,255,0.1)', label: 'Employed' }
                       : row.route === 'connect'  ? { c: '#fb923c', bg: 'rgba(251,146,60,0.1)', label: 'Connect'  }
                       : { c: '#f87171', bg: 'rgba(248,113,113,0.08)', label: '— unassigned' };
          return (
            <div key={row.id}
              className="grid items-center px-5 py-3.5 text-xs gap-3"
              style={{ gridTemplateColumns: '1fr 1fr 1fr auto auto', borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
              <div>
                <div className="text-white/70 font-bold leading-tight truncate">{row.area}</div>
                <div className="text-white/30 text-[10px] truncate">{row.site}</div>
              </div>
              <div>
                <div className="text-white/60">{row.workType}</div>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block"
                  style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                  {row.dbs}
                </span>
              </div>
              <div className="text-white/40">{row.window} · {row.freq}</div>
              <div className="text-white font-black text-center w-12">{row.hrs}h</div>
              <div className="flex items-center gap-1.5 w-52">
                {['employed','connect','unassigned'].map(opt => (
                  <button key={opt}
                    onClick={() => setRoute(row.id, opt)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all"
                    style={row.route === opt ? {
                      background: opt === 'employed' ? 'rgba(79,120,255,0.2)'
                                : opt === 'connect'  ? 'rgba(251,146,60,0.2)'
                                : 'rgba(248,113,113,0.15)',
                      border: `1px solid ${opt === 'employed' ? 'rgba(79,120,255,0.45)'
                                         : opt === 'connect'  ? 'rgba(251,146,60,0.45)'
                                         : 'rgba(248,113,113,0.35)'}`,
                      color: opt === 'employed' ? '#7b9fff' : opt === 'connect' ? '#fb923c' : '#f87171',
                    } : {
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: 'rgba(255,255,255,0.2)',
                    }}>
                    {opt === 'employed' ? '👤 Staff' : opt === 'connect' ? '🌐 Connect' : '—'}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff capacity */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3 px-1">Employed staff capacity</div>
        <div className="grid grid-cols-3 gap-3">
          {staffRows.map(st => {
            const pct = Math.min(100, Math.round((st.used / st.capacity) * 100));
            const c   = pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#34d399';
            return (
              <div key={st.id} className="rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-black text-sm">{st.name}</span>
                  <span className="text-[10px] text-white/30">{st.dbs}</span>
                </div>
                <div className="h-1.5 rounded-full mb-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span style={{ color: c }}>{st.used}h assigned</span>
                  <span className="text-white/30">{st.capacity}h capacity</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertTriangle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
          <span className="text-xs text-white/50">{unassigned.length} area{unassigned.length !== 1 ? 's' : ''} still unassigned — assign to Employed or Connect before generating job cards.</span>
        </div>
      )}

      <button
        onClick={() => onNavigate && onNavigate('cards')}
        className="w-full py-3 rounded-xl font-black text-sm transition-all"
        style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.3), rgba(99,102,241,0.2))', border: '1px solid rgba(79,120,255,0.45)', color: 'white' }}>
        Next: Generate job cards →
      </button>
    </div>
  );
}
