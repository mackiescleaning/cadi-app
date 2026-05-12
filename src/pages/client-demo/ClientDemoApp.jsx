import { useState } from 'react';
import { LayoutDashboard, Activity, ClipboardList, ShieldCheck, BarChart2, AlertTriangle, MessageSquare, Settings, Menu, X } from 'lucide-react';
import ClientOverview      from './pages/ClientOverview';
import ClientLiveActivity  from './pages/ClientLiveActivity';
import ClientJobHistory    from './pages/ClientJobHistory';
import ClientCompliance    from './pages/ClientCompliance';
import ClientReports       from './pages/ClientReports';
import ClientIssue         from './pages/ClientIssue';
import ClientComms         from './pages/ClientComms';
import ClientSettings      from './pages/ClientSettings';

const SITES = [
  { id: 'rp', name: 'Riverside Primary',   status: 'good'    },
  { id: 'an', name: 'Academy Nursery',      status: 'good'    },
  { id: 'rs', name: 'Riverside Secondary',  status: 'warning' },
  { id: 'sf', name: 'Sixth Form Centre',    status: 'good'    },
  { id: 'ah', name: 'Trust Admin Hub',      status: 'good'    },
];

const STATUS_DOT = {
  good:    '#10b981',
  warning: '#f59e0b',
  breach:  '#ef4444',
};

const PAGES = [
  { id: 'overview',    label: 'Overview',        icon: LayoutDashboard, component: ClientOverview     },
  { id: 'live',        label: 'Live Activity',    icon: Activity,        component: ClientLiveActivity },
  { id: 'history',     label: 'Job History',      icon: ClipboardList,   component: ClientJobHistory   },
  { id: 'compliance',  label: 'Compliance Pack',  icon: ShieldCheck,     component: ClientCompliance   },
  { id: 'reports',     label: 'Reports',          icon: BarChart2,       component: ClientReports      },
  { id: 'issue',       label: 'Report an Issue',  icon: AlertTriangle,   component: ClientIssue        },
  { id: 'comms',       label: 'Messages',         icon: MessageSquare,   component: ClientComms        },
  { id: 'settings',    label: 'Settings',         icon: Settings,        component: ClientSettings     },
];

function DemoToast({ msg, onClose }) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-[#010a4f] border border-[#4f78ff]/40 text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 max-w-sm">
      <span className="text-base">✅</span>
      <span className="text-sm font-medium flex-1 leading-snug">Demo action: {msg}</span>
      <button onClick={onClose} className="text-white/40 hover:text-white ml-2"><X size={14} /></button>
    </div>
  );
}

export default function ClientDemoApp() {
  const [page,        setPage]        = useState('overview');
  const [activeSite,  setActiveSite]  = useState('rp');
  const [sitesOpen,   setSitesOpen]   = useState(true);
  const [toast,       setToast]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function showToast(action) {
    setToast(action);
    setTimeout(() => setToast(null), 4000);
  }

  const ActivePage  = PAGES.find(p => p.id === page)?.component || ClientOverview;
  const currentSite = SITES.find(s => s.id === activeSite);

  return (
    <div className="flex h-screen overflow-hidden" style={{ fontFamily: "'Satoshi',sans-serif", background: '#f8fafc' }}>

      {/* Demo ribbon */}
      <div className="fixed top-0 right-0 z-50 pointer-events-none">
        <div className="bg-[#C2410C] text-white text-[10px] font-black px-8 py-1.5 rotate-45 translate-x-7 -translate-y-1 tracking-widest shadow-lg">
          DEMO
        </div>
      </div>

      {toast && <DemoToast msg={toast} onClose={() => setToast(null)} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-gray-100 flex flex-col transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:flex`}>

        {/* Branding */}
        <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
          <div className="text-[10px] font-black tracking-widest text-gray-400 uppercase mb-0.5">Britannia FM</div>
          <div className="text-sm font-black text-[#010a4f]">Client Portal</div>
          <div className="text-[10px] text-gray-300 mt-0.5">powered by Cadi</div>
          <button className="md:hidden absolute top-4 right-4 p-1 hover:bg-gray-100 rounded" onClick={() => setSidebarOpen(false)}>
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Site selector */}
        <div className="flex-shrink-0 border-b border-gray-100">
          <button
            onClick={() => setSitesOpen(v => !v)}
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-50 transition-colors">
            <div>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Current site</div>
              <div className="text-sm font-bold text-[#010a4f] mt-0.5">{currentSite?.name}</div>
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${sitesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {sitesOpen && (
            <div className="px-3 pb-2 space-y-0.5">
              <button
                onClick={() => { setActiveSite('all'); setPage('overview'); setSitesOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${activeSite === 'all' ? 'bg-[#f0f4ff] text-[#1f48ff] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
                <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                All sites
              </button>
              {SITES.map(site => (
                <button key={site.id}
                  onClick={() => { setActiveSite(site.id); setSitesOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${activeSite === site.id && activeSite !== 'all' ? 'bg-[#f0f4ff] text-[#1f48ff] font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOT[site.status] }} />
                  <span className="truncate">{site.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {PAGES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setPage(id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                page === id
                  ? 'bg-[#f0f4ff] text-[#1f48ff] font-bold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}>
              <Icon size={15} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {id === 'comms' && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#4f78ff] shrink-0" />
              )}
              {id === 'issue' && (
                <span className="text-[9px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">0 open</span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <div className="text-[10px] text-gray-300 leading-relaxed">
            Riverside Academy Trust · 5 sites
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-5 py-3 flex items-center gap-3 flex-shrink-0">
          <button className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg" onClick={() => setSidebarOpen(true)}>
            <Menu size={18} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-gray-400 truncate">
              {activeSite === 'all' ? 'Riverside Academy Trust — All sites' : currentSite?.name + ' · Riverside Academy Trust'}
            </div>
            <h1 className="text-sm font-bold text-[#010a4f] truncate">{PAGES.find(p => p.id === page)?.label}</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-[10px] font-bold text-[#C2410C] bg-[#C2410C]/10 px-2.5 py-1 rounded-full">DEMO</div>
            <div className="w-7 h-7 rounded-full bg-[#f0f4ff] flex items-center justify-center text-[10px] font-black text-[#4f78ff]">SM</div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <ActivePage showToast={showToast} onNavigate={setPage} />
        </main>
      </div>
    </div>
  );
}
