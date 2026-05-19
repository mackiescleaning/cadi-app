import { useState } from 'react';
import FmDashboard    from './pages/FmDashboard';
import FmJobBoard     from './pages/FmJobBoard';
import FmCreateJob    from './pages/FmCreateJob';
import FmCleaners     from './pages/FmCleaners';
import FmCoverageGaps from './pages/FmCoverageGaps';
import FmLiveOps      from './pages/FmLiveOps';
import FmQaQueue      from './pages/FmQaQueue';
import FmReports      from './pages/FmReports';
import FmClientReport from './pages/FmClientReport';
import FmSettings     from './pages/FmSettings';
import FmHowItConnects from './pages/FmHowItConnects';
import FmIssues             from './pages/FmIssues';
import FmOnboarding         from './pages/FmOnboarding';
import FmWorkforce          from './pages/FmWorkforce';
import FmClients            from './pages/FmClients';
import FmReviews            from './pages/FmReviews';
import FmCadiConnect        from './pages/FmCadiConnect';
import FmHiring             from './pages/FmHiring';
import FmCleanerOnboarding  from './pages/FmCleanerOnboarding';
import FmTenderPacks        from './pages/FmTenderPacks';
import FmTraining           from './pages/FmTraining';
import FmSupport            from './pages/FmSupport';
import FmAccounts           from './pages/FmAccounts';
import {
  LayoutDashboard, MapPin, Building2, FilePlus, ClipboardCheck, FileText,
  CheckSquare, AlertTriangle, Star, UserCheck, Globe, UserPlus, Rocket,
  BarChart2, FileCheck, Share2, BookOpen, LifeBuoy,
  Settings, X, Bell, Receipt,
} from 'lucide-react';

const NAV_GROUPS = [
  {
    group: 'Operations',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: FmDashboard },
      { id: 'live',      label: 'Live Ops',  icon: MapPin,          component: FmLiveOps  },
    ],
  },
  {
    group: 'Clients',
    items: [
      { id: 'clients',           label: 'Clients',           icon: Building2,      component: FmClients                        },
      { id: 'create',            label: 'Create Contract',   icon: FilePlus,       component: FmCreateJob                      },
      { id: 'client-onboarding', label: 'Client Onboarding', icon: ClipboardCheck, component: FmOnboarding,  badge: 'NEW'      },
      { id: 'tender-packs',      label: 'Tender Packs',      icon: FileText,       component: FmTenderPacks                    },
    ],
  },
  {
    group: 'Helpdesk',
    items: [
      { id: 'qa',      label: 'QA Queue', icon: CheckSquare,   component: FmQaQueue, badge: 2     },
      { id: 'issues',  label: 'Issues',   icon: AlertTriangle, component: FmIssues,  badge: 2     },
      { id: 'reviews', label: 'Reviews',  icon: Star,          component: FmReviews, badge: 'NEW' },
    ],
  },
  {
    group: 'Network',
    items: [
      { id: 'workforce',          label: 'FM Workforce',  icon: UserCheck, component: FmWorkforce                        },
      { id: 'cadi-connect',       label: 'Cadi Connect',  icon: Globe,     component: FmCadiConnect, badge: 'NEW'        },
      { id: 'hiring',             label: 'Hiring',        icon: UserPlus,  component: FmHiring                          },
      { id: 'cleaner-onboarding', label: 'Onboarding',    icon: Rocket,    component: FmCleanerOnboarding               },
    ],
  },
  {
    group: 'Reporting',
    items: [
      { id: 'reports',       label: 'Monthly Reports', icon: BarChart2, component: FmReports      },
      { id: 'client-report', label: 'Client Packs',    icon: FileCheck, component: FmClientReport },
    ],
  },
  {
    group: 'Accounts',
    items: [
      { id: 'accounts', label: 'Invoices', icon: Receipt, component: FmAccounts, badge: 2 },
    ],
  },
  {
    group: 'Platform',
    items: [
      { id: 'how-it-connects', label: 'How it connects', icon: Share2,   component: FmHowItConnects },
      { id: 'training',        label: 'Training',         icon: BookOpen, component: FmTraining      },
      { id: 'support',         label: 'Support',          icon: LifeBuoy, component: FmSupport       },
    ],
  },
];

const KEYFRAMES = `
@keyframes blob-drift {
  0%,100% { transform: translate(0,0) scale(1); }
  33%      { transform: translate(40px,-30px) scale(1.08); }
  66%      { transform: translate(-20px,20px) scale(0.95); }
}
@keyframes blob-drift-2 {
  0%,100% { transform: translate(0,0) scale(1); }
  40%     { transform: translate(-50px,25px) scale(1.12); }
  70%     { transform: translate(30px,-15px) scale(0.9); }
}
@keyframes logo-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(79,120,255,0.4), 0 4px 20px rgba(79,120,255,0.35); }
  50%     { box-shadow: 0 0 0 6px rgba(79,120,255,0.0), 0 4px 28px rgba(79,120,255,0.55); }
}
@keyframes nav-shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes toast-in {
  from { opacity:0; transform: translateY(-8px) scale(0.97); }
  to   { opacity:1; transform: translateY(0)    scale(1); }
}
@keyframes alert-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.6; }
}
`;

function Toast({ msg, onClose }) {
  return (
    <div
      className="fixed top-5 right-5 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl max-w-sm"
      style={{
        background: 'rgba(2,12,62,0.96)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(79,120,255,0.4)',
        boxShadow: '0 8px 40px rgba(79,120,255,0.2), 0 2px 8px rgba(0,0,0,0.4)',
        animation: 'toast-in 0.2s ease-out',
      }}
    >
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[#4f78ff] text-xs shrink-0"
        style={{ background: 'rgba(79,120,255,0.15)', border: '1px solid rgba(79,120,255,0.4)' }}>✓</div>
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
    <>
      <style>{KEYFRAMES}</style>
      <div
        className="flex h-screen overflow-hidden"
        style={{
          fontFamily: "'Satoshi', 'Inter', sans-serif",
          background: 'linear-gradient(145deg, #010b38 0%, #020e45 35%, #010b38 65%, #030f40 100%)',
        }}
      >
        {/* Animated ambient blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-18%', left: '-8%',
            width: '60%', height: '60%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(79,120,255,0.14) 0%, transparent 70%)',
            animation: 'blob-drift 22s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '-22%', right: '2%',
            width: '50%', height: '50%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
            animation: 'blob-drift-2 28s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', top: '35%', right: '20%',
            width: '30%', height: '30%', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 70%)',
            animation: 'blob-drift 35s ease-in-out infinite reverse',
          }} />
          {/* Subtle grid texture */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(79,120,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(79,120,255,0.025) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }} />
        </div>

        {/* DEMO ribbon */}
        <div className="fixed top-0 right-0 z-50 pointer-events-none overflow-hidden w-20 h-20">
          <div className="text-white text-[9px] font-black tracking-widest py-1.5 text-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #C2410C, #ea580c)',
              transform: 'rotate(45deg) translate(14px, -14px)',
              transformOrigin: 'center', width: 80,
            }}>
            DEMO
          </div>
        </div>

        {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

        {/* ── Sidebar ── */}
        <aside
          className="w-60 flex-shrink-0 flex flex-col relative"
          style={{
            zIndex: 10,
            background: 'rgba(1,8,40,0.7)',
            backdropFilter: 'blur(32px)',
            borderRight: '1px solid rgba(79,120,255,0.12)',
            boxShadow: '1px 0 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Sidebar inner glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(180deg, rgba(79,120,255,0.06) 0%, transparent 40%)',
            borderRadius: 'inherit',
          }} />

          {/* Logo lockup */}
          <div className="px-5 pt-6 pb-5 relative" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[#4f78ff] flex items-center justify-center text-white font-black text-base shrink-0"
                style={{ animation: 'logo-pulse 3s ease-in-out infinite' }}>B</div>
              <div>
                <div className="text-white font-black text-sm leading-tight tracking-tight">Britannia FM</div>
                <div className="text-white/35 text-[11px] leading-tight">Ops Portal</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 4px #34d399' }} />
              <div className="text-white/20 text-[9px] font-black uppercase tracking-[0.2em]">Live · Powered by Cadi</div>
            </div>
          </div>

          {/* Nav groups */}
          <nav className="flex-1 px-2.5 py-4 overflow-y-auto space-y-5">
            {NAV_GROUPS.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 mb-1.5 text-white/20 text-[9px] font-black uppercase tracking-[0.18em]">{group}</div>
                <div className="space-y-0.5">
                  {items.map(({ id, label, icon: Icon, badge }) => {
                    const active = page === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setPage(id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden"
                        style={active ? {
                          background: 'linear-gradient(135deg, rgba(79,120,255,0.22) 0%, rgba(99,102,241,0.14) 100%)',
                          border: '1px solid rgba(79,120,255,0.45)',
                          color: 'white',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 20px rgba(79,120,255,0.12)',
                        } : {
                          color: 'rgba(255,255,255,0.4)',
                          border: '1px solid transparent',
                        }}
                        onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
                        onMouseLeave={e => { if (!active) { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'transparent'; } }}
                      >
                        {/* Active left beam */}
                        {active && (
                          <div style={{
                            position: 'absolute', left: 0, top: '20%', bottom: '20%',
                            width: 2, borderRadius: 2,
                            background: 'linear-gradient(180deg, transparent, #4f78ff, transparent)',
                            boxShadow: '0 0 8px rgba(79,120,255,0.8)',
                          }} />
                        )}
                        <Icon size={15} style={{ color: active ? '#7b9fff' : undefined, flexShrink: 0 }} />
                        <span className="flex-1 text-left tracking-tight" style={active ? {
                          background: 'linear-gradient(90deg, white 0%, rgba(200,215,255,0.9) 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        } : {}}>{label}</span>
                        {badge && (
                          typeof badge === 'string'
                            ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: 'linear-gradient(135deg,#C2410C,#ea580c)', color: 'white', letterSpacing: '0.05em' }}>{badge}</span>
                            : <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Settings + user footer */}
          <div className="px-2.5 pb-2 relative" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="pt-3 space-y-0.5">
              {(() => {
                const active = page === 'settings';
                return (
                  <button
                    onClick={() => setPage('settings')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={active
                      ? { background: 'linear-gradient(135deg, rgba(79,120,255,0.22) 0%, rgba(99,102,241,0.14) 100%)', border: '1px solid rgba(79,120,255,0.45)', color: 'white' }
                      : { color: 'rgba(255,255,255,0.4)', border: '1px solid transparent' }
                    }
                  >
                    <Settings size={15} style={{ color: active ? '#7b9fff' : undefined }} />
                    <span>Settings</span>
                  </button>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 px-3 py-3 mt-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white/80 text-xs font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(79,120,255,0.35), rgba(99,102,241,0.25))', border: '1px solid rgba(79,120,255,0.4)' }}>J</div>
              <div className="min-w-0">
                <div className="text-white/75 text-xs font-bold truncate">James Harper</div>
                <div className="text-white/30 text-[10px] truncate">Operations Manager</div>
              </div>
            </div>

            <div className="px-2 pb-3 text-center">
              <div className="text-white/12 text-[9px] leading-relaxed">Preview · Live dispatch Q3 2026</div>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{ zIndex: 10 }}>

          {/* Top bar */}
          <header
            className="flex-shrink-0 px-8 h-14 flex items-center gap-4"
            style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(1,8,40,0.4)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 1px 0 rgba(79,120,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2 flex-1">
              <h1 className="text-white font-black text-base tracking-tight">{current.label}</h1>
            </div>
            <div className="flex items-center gap-2.5">
              <button className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white/30 hover:text-white transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                  style={{ background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.8)' }} />
              </button>
              <div className="text-[9px] font-black px-3 py-1.5 rounded-full tracking-[0.15em]"
                style={{
                  color: '#ea580c',
                  background: 'rgba(194,65,12,0.1)',
                  border: '1px solid rgba(194,65,12,0.25)',
                }}>
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
    </>
  );
}
