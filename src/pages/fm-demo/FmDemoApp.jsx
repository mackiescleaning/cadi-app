import { useState } from 'react';
import FmDashboard    from './pages/FmDashboard';
import FmJobBoard     from './pages/FmJobBoard';
import FmCreateJob    from './pages/FmCreateJob';
import FmCleaners     from './pages/FmCleaners';
import FmCoverageGaps from './pages/FmCoverageGaps';
import FmLiveOps      from './pages/FmLiveOps';
import FmQaQueue      from './pages/FmQaQueue';
import FmReports      from './pages/FmReports';
import FmSettings     from './pages/FmSettings';
import {
  LayoutDashboard, ClipboardList, PlusCircle, Users, TrendingUp,
  MapPin, CheckSquare, BarChart2, Settings, X, Bell,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'Operations',
    items: [
      { id: 'dashboard', label: 'Dashboard',      icon: LayoutDashboard, component: FmDashboard    },
      { id: 'live',      label: 'Live Ops',        icon: MapPin,          component: FmLiveOps      },
    ],
  },
  {
    group: 'Jobs',
    items: [
      { id: 'jobs',      label: 'Job Board',       icon: ClipboardList,   component: FmJobBoard     },
      { id: 'create',    label: 'Create Job',      icon: PlusCircle,      component: FmCreateJob    },
    ],
  },
  {
    group: 'Quality',
    items: [
      { id: 'qa',        label: 'QA Queue',        icon: CheckSquare,     component: FmQaQueue,  badge: 2 },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'cleaners',  label: 'Cleaner Network', icon: Users,           component: FmCleaners     },
      { id: 'coverage',  label: 'Coverage Gaps',   icon: TrendingUp,      component: FmCoverageGaps },
    ],
  },
  {
    group: 'Reporting',
    items: [
      { id: 'reports',   label: 'Reports',         icon: BarChart2,       component: FmReports      },
    ],
  },
];

function Toast({ msg, onClose }) {
  return (
    <div
      className="fixed top-5 right-5 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl max-w-sm"
      style={{ background: 'rgba(2,12,62,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(79,120,255,0.35)' }}
    >
      <div className="w-6 h-6 rounded-full bg-[#4f78ff]/20 border border-[#4f78ff]/40 flex items-center justify-center text-[#4f78ff] text-xs shrink-0">✓</div>
      <span className="text-sm font-medium text-white flex-1">{msg}</span>
      <button onClick={onClose} className="ml-1 text-white/30 hover:text-white transition-colors"><X size={13} /></button>
    </div>
  );
}

export default function FmDemoApp() {
  const [page, setPage]   = useState('dashboard');
  const [toast, setToast] = useState(null);

  function showToast(action) {
    setToast(`Demo — would ${action} in live version`);
    setTimeout(() => setToast(null), 3500);
  }

  const allItems = [...NAV_GROUPS.flatMap(g => g.items), { id: 'settings', label: 'Settings', icon: Settings, component: FmSettings }];
  const current  = allItems.find(p => p.id === page) || allItems[0];
  const ActivePage = current.component;

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        fontFamily: "'Satoshi', 'Inter', sans-serif",
        background: 'linear-gradient(135deg, #020c3e 0%, #081540 40%, #020c3e 100%)',
      }}
    >
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(79,120,255,0.12) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-20%] right-[5%] w-[45%] h-[45%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(79,120,255,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* DEMO ribbon */}
      <div className="fixed top-0 right-0 z-50 pointer-events-none overflow-hidden w-20 h-20">
        <div className="bg-[#C2410C] text-white text-[9px] font-black tracking-widest py-1.5 text-center shadow-lg"
          style={{ transform: 'rotate(45deg) translate(14px, -14px)', transformOrigin: 'center', width: 80 }}>
          DEMO
        </div>
      </div>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      {/* ── Sidebar ── */}
      <aside
        className="w-60 flex-shrink-0 flex flex-col relative z-10"
        style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(24px)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Logo lockup */}
        <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-[#4f78ff] flex items-center justify-center text-white font-black text-base shadow-lg shadow-[#4f78ff]/30">B</div>
            <div>
              <div className="text-white font-black text-sm leading-tight">Britannia FM</div>
              <div className="text-white/40 text-[11px] leading-tight">Ops Portal</div>
            </div>
          </div>
          <div className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">Powered by Cadi</div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-4">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group}>
              <div className="px-3 mb-1 text-white/25 text-[9px] font-black uppercase tracking-[0.15em]">{group}</div>
              <div className="space-y-0.5">
                {items.map(({ id, label, icon: Icon, badge }) => {
                  const active = page === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPage(id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={active
                        ? { background: 'rgba(79,120,255,0.18)', border: '1px solid rgba(79,120,255,0.38)', color: 'white' }
                        : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }
                      }
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; } }}
                    >
                      <Icon size={15} style={{ color: active ? '#4f78ff' : undefined, flexShrink: 0 }} />
                      <span className="flex-1 text-left">{label}</span>
                      {badge && (
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings + user footer */}
        <div className="px-3 pb-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="pt-3 space-y-0.5">
            {(() => {
              const active = page === 'settings';
              return (
                <button
                  onClick={() => setPage('settings')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={active
                    ? { background: 'rgba(79,120,255,0.18)', border: '1px solid rgba(79,120,255,0.38)', color: 'white' }
                    : { color: 'rgba(255,255,255,0.45)', border: '1px solid transparent' }
                  }
                >
                  <Settings size={15} style={{ color: active ? '#4f78ff' : undefined }} />
                  <span>Settings</span>
                </button>
              );
            })()}
          </div>

          <div className="flex items-center gap-3 px-3 py-3 mt-1">
            <div className="w-7 h-7 rounded-lg bg-[#4f78ff]/25 border border-[#4f78ff]/35 flex items-center justify-center text-white/80 text-xs font-black shrink-0">J</div>
            <div className="min-w-0">
              <div className="text-white/75 text-xs font-bold truncate">James Harper</div>
              <div className="text-white/30 text-[10px] truncate">Operations Manager</div>
            </div>
          </div>

          <div className="px-2 pb-3 text-center">
            <div className="text-white/15 text-[9px] leading-relaxed">Preview · Live dispatch Q3 2026</div>
          </div>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">

        {/* Top bar */}
        <header
          className="flex-shrink-0 px-8 h-14 flex items-center gap-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h1 className="text-white font-black text-base flex-1">{current.label}</h1>
          <div className="flex items-center gap-2.5">
            <button
              className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white/35 hover:text-white hover:bg-white/[0.08] transition-colors"
            >
              <Bell size={15} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
            </button>
            <div className="text-[9px] font-black text-[#C2410C] bg-[#C2410C]/12 border border-[#C2410C]/25 px-3 py-1.5 rounded-full tracking-[0.15em]">
              DEMO MODE
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <ActivePage showToast={showToast} onNavigate={setPage} />
        </main>
      </div>
    </div>
  );
}
