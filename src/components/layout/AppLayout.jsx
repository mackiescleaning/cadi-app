import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import CadiWordmark from '../CadiWordmark';
import {
  LayoutDashboard, Calculator, CalendarDays, Users,
  PoundSterling, Settings, Menu, X,
  TrendingUp, MapPin, FileText, ClipboardCheck,
  GraduationCap, ClipboardList, Package, Lock,
  Briefcase, Star, Network, CheckSquare,
  ShoppingBag, GitBranch, MessageSquare, Bell, Inbox, UtensilsCrossed,
  CalendarClock, ChevronRight, CreditCard,
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { useClientContext } from '../../context/ClientContext';
import { MoreHorizontal, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UpgradeModal } from '../UpgradePrompt';

// ── Section definitions ───────────────────────────────────────────────────────

const RUN_COLOR  = '#0d1a5e';
const GROW_COLOR = '#059669';
const EARN_COLOR = '#C2410C';

const NAV_SECTIONS = [
  {
    id: 'run',
    label: 'Run your business',
    color: EARN_COLOR,   // accent only; bg stays navy
    accent: '#3b5bdb',
    items: [
      { path: '/scheduler',  label: 'Schedule',        icon: CalendarDays  },
      { path: '/customers',  label: 'Customers',       icon: Users         },
      { path: '/services',   label: 'Services',        icon: ClipboardCheck },
      { path: '/payments',   label: 'Payments',        icon: CreditCard    },
      { path: '/money',      label: 'Money',           icon: PoundSterling },
      { path: '/accounts',   label: 'Accounting',      icon: PoundSterling },
      { path: '/staff',      label: 'Staff',           icon: GraduationCap },
      { path: '/inventory',  label: 'Inventory',       icon: Package       },
      { path: '/routes',     label: 'Route Planner',   icon: MapPin        },
    ],
    tagline: 'RUN',
    accentColor: '#4f78ff',
  },
  {
    id: 'grow',
    label: 'Grow your margins',
    items: [
      { path: '/scaling',    label: 'Cadi AI',         icon: TrendingUp },
      { path: '/calculator', label: 'Pricing Calculator', icon: Calculator },
      { path: '/business-lab', label: 'Business Lab',  icon: Briefcase },
      { path: '/review',     label: 'Annual Review',   icon: ClipboardList },
    ],
    tagline: 'GROW',
    accentColor: GROW_COLOR,
  },
  {
    id: 'earn',
    label: 'Earn more work',
    items: [
      { path: '/earn/marketplace',  label: 'Marketplace',      icon: ShoppingBag   },
      { path: '/earn/pipeline',     label: 'Job Pipeline',     icon: GitBranch     },
      { path: '/earn/completion',   label: 'Work Completion',  icon: CheckSquare   },
      { path: '/earn/connections',  label: 'FM Connections',   icon: Network       },
      { path: '/earn/reputation',   label: 'My Profile',       icon: Star          },
      { path: '/earn/earnings',     label: 'Earnings',         icon: PoundSterling },
      { path: '/earn/comms',        label: 'Messages',         icon: MessageSquare },
    ],
    tagline: 'EARN',
    accentColor: EARN_COLOR,
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { path: '/settings', label: 'Settings', icon: Settings },
    ],
    tagline: 'ACCOUNT',
    accentColor: '#6b7280',
  },
];

// Flat nav for matching active route
const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

const TAB_GUIDES = {
  '/front-desk':                     "Your Front Desk inbox — review and approve actions from your three AI agents.",
  '/front-desk/sales-manager':       "Sales Manager — handles inbound enquiries, quotes and bookings.",
  '/front-desk/review-agent':        "Review Agent — sends review requests after every completed job.",
  '/front-desk/operations-manager':  "Operations Manager — reminders, team schedules, check-ins and payment matching.",
  '/dashboard':    "Your mission control — health score, leaderboard, badges and daily activity all in one place.",
  '/calculator':   "Pricing engine — generate instant quotes using UK market data.",
  '/scheduler':    "Book and manage every job — daily schedule, status tracking and team assignment.",
  '/customers':    "Your client database — notes, addresses, star ratings and full job history.",
  '/inventory':    "Track your cleaning kit — products, quantities, costs and restock alerts.",
  '/money':        "Your financial dashboard — income, expenses, tax reserve and payment logging.",
  '/payments':     "Invoices, quotes, and payment processor setup — Stripe and GoCardless.",
  '/accounts':     "Bookkeeping and compliance — MTD submissions, mileage and year-end figures.",
  '/routes':       "Route planner — optimise your daily drive and log mileage for HMRC.",
  '/scaling':      "Cadi AI — growth strategies, pricing analysis and AI-powered insights.",
  '/business-lab': "Business Lab — tools and experiments to grow your margins.",
  '/staff':        "Team management — staff profiles, skills, availability and job assignments.",
  '/review':       "Annual Review — 90-day sprint goals and year-on-year progress.",
  '/settings':     "Settings — update your profile, hourly rate, services and preferences.",
};

const PRO_TAB_REASONS = {
  '/money':        'Track income, expenses, tax reserve and P&L — your full financial picture.',
  '/accounts':     'File MTD submissions, claim mileage and see your year-end figures ready to go.',
  '/scaling':      'Growth strategies, pricing analysis and AI-powered insights.',
  '/business-lab': 'Business Lab tools to grow your margins.',
  '/staff':        'Manage staff profiles, skills, availability and job assignments.',
  '/review':       'Set 90-day sprint goals and track performance year on year.',
};

// Section persistence key
const SECTION_STATE_KEY = 'cadi_nav_sections';

function getSectionState() {
  try { return JSON.parse(localStorage.getItem(SECTION_STATE_KEY)) || {}; } catch { return {}; }
}
function saveSectionState(s) {
  try { localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(s)); } catch {}
}

// Last-viewed sub-tab per section
const LAST_TAB_KEY = 'cadi_last_tab';
function getLastTabs() {
  try { return JSON.parse(localStorage.getItem(LAST_TAB_KEY)) || {}; } catch { return {}; }
}
function saveLastTab(sectionId, path) {
  const t = getLastTabs(); t[sectionId] = path;
  try { localStorage.setItem(LAST_TAB_KEY, JSON.stringify(t)); } catch {}
}

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen]         = useState(false);
  const [hoveredNav, setHoveredNav]                 = useState(null);
  const [upgradeModalReason, setUpgradeModalReason] = useState(null);
  const [upgradeBanner, setUpgradeBanner]           = useState(null);
  const [mobileSectionId, setMobileSectionId]       = useState('run'); // active mobile section
  const [collapsed, setCollapsed]                   = useState(() => getSectionState());
  const [pendingActions, setPendingActions]          = useState(0);

  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { isPro, isTabLocked } = usePlan();
  const { isAccountant, activeClient, clients, switchClient, exitClientView } = useClientContext();
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (!user || user.id === 'demo-user') return;
    (async () => {
      try {
        const { data } = await supabase.from('business_settings').select('setup_data').eq('owner_id', user.id).maybeSingle();
        setLogoUrl(data?.setup_data?.logo_url || '');
      } catch {}
    })();
  }, [user, location.pathname]);

  // Poll pending agent actions count
  useEffect(() => {
    if (!user || user.id === 'demo-user') return;
    const loadPending = async () => {
      try {
        const { data: biz } = await supabase.from('businesses').select('id').eq('owner_user_id', user.id).single();
        if (!biz) return;
        const { count } = await supabase
          .from('agent_actions')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', biz.id)
          .eq('status', 'pending_approval');
        setPendingActions(count ?? 0);
      } catch {}
    };
    loadPending();
    const interval = setInterval(loadPending, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  // Track last-viewed tab per section and active mobile section
  useEffect(() => {
    const active = NAV_SECTIONS.find(s => s.items.some(i => location.pathname.startsWith(i.path)));
    if (active) {
      const item = active.items.find(i => location.pathname.startsWith(i.path));
      if (item) saveLastTab(active.id, item.path);
      setMobileSectionId(active.id);
    }
  }, [location.pathname]);

  // Stripe upgrade confirmation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('upgraded')) return;
    window.history.replaceState({}, '', window.location.pathname);
    setUpgradeBanner({ message: 'Confirming your payment…' });
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from('profiles').select('plan, subscription_tier').single();
      const activated = data?.subscription_tier === 'pro' || data?.subscription_tier === 'max' || data?.plan === 'pro';
      if (activated) {
        clearInterval(interval);
        window.location.reload();
      } else if (attempts >= 20) {
        clearInterval(interval);
        setUpgradeBanner({ message: 'Payment received — tap here to activate.', warn: true, reload: true });
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const handleNavClick = useCallback((path, e) => {
    if (isTabLocked(path)) {
      e.preventDefault();
      const reason = PRO_TAB_REASONS[path] || 'Upgrade to Cadi Pro to unlock this feature.';
      setUpgradeModalReason(reason);
    }
  }, [isTabLocked]);

  const toggleSection = (id) => {
    setCollapsed(prev => {
      const next = { ...prev, [id]: !prev[id] };
      saveSectionState(next);
      return next;
    });
  };

  const currentLabel =
    location.pathname === '/dashboard' ? 'Dashboard' :
    location.pathname === '/front-desk' ? 'Front Desk' :
    location.pathname.startsWith('/front-desk/sales-manager') ? 'Sales Manager' :
    location.pathname.startsWith('/front-desk/review-agent') ? 'Review Agent' :
    location.pathname.startsWith('/front-desk/operations-manager') ? 'Operations Manager' :
    ALL_NAV_ITEMS.find(i => location.pathname.startsWith(i.path))?.label || 'Cadi';

  const userInitial = profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U';
  const userName    = profile?.business_name || profile?.first_name || 'Your Business';
  const planLabel   = isPro ? 'Cadi Pro' : 'Free plan';

  // ── Front Desk expandable nav group ─────────────────────────────────────────
  function FrontDeskNavGroup({ onNavigate }) {
    const [open, setOpen] = useState(() => {
      try { return localStorage.getItem('cadi_fd_nav_open') !== '0'; } catch { return true; }
    });
    const isFrontDeskActive = location.pathname.startsWith('/front-desk');

    const toggle = () => setOpen(v => {
      const next = !v;
      try { localStorage.setItem('cadi_fd_nav_open', next ? '1' : '0'); } catch {}
      return next;
    });

    const items = [
      { path: '/front-desk',                    label: 'Inbox',               badge: pendingActions, icon: Inbox },
      { path: '/front-desk/sales-manager',      label: 'Sales Manager',       icon: MessageSquare,  accent: '#3b5bdb' },
      { path: '/front-desk/review-agent',       label: 'Review Agent',        icon: Star,           accent: '#059669' },
      { path: '/front-desk/operations-manager', label: 'Operations Manager',  icon: CalendarClock,  accent: '#C2410C', proOnly: true },
    ];

    return (
      <div className="mb-1">
        <button
          onClick={toggle}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors ${isFrontDeskActive ? 'bg-white/5' : ''}`}
        >
          <span className="w-1.5 h-4 rounded-full shrink-0" style={{ backgroundColor: '#4f78ff' }} />
          <span className="flex-1 text-left">
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: '#4f78ff' }}>FRONT DESK</span>
            <span className="block text-[10px] text-[#99c5ff]/40 leading-tight">Your AI staff</span>
          </span>
          {pendingActions > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-[#010a4f]">
              {pendingActions}
            </span>
          )}
          <ChevronDown
            size={12}
            className={`text-[#99c5ff]/30 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        {open && (
          <div className="mt-0.5 space-y-0.5 pl-2">
            {items.map(({ path, label, badge, icon: Icon, accent, proOnly }) => {
              const locked    = proOnly && !isPro;
              const isActive  = location.pathname === path || (path !== '/front-desk' && location.pathname.startsWith(path));
              return (
                <NavLink
                  key={path}
                  to={locked ? '/upgrade' : path}
                  onClick={() => onNavigate?.()}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                    locked
                      ? 'text-[#99c5ff]/40 hover:bg-white/5'
                      : isActive
                        ? 'text-white'
                        : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                  }`}
                  style={isActive ? { backgroundColor: '#4f78ff33', borderLeft: '2px solid #4f78ff' } : {}}
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-[#010a4f]">
                      {badge}
                    </span>
                  )}
                  {locked && <Lock size={10} className="shrink-0 opacity-40" />}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Sidebar section renderer ────────────────────────────────────────────────
  function SidebarSection({ section, onNavigate }) {
    const isOpen = !collapsed[section.id];
    const isSectionActive = section.items.some(i => location.pathname.startsWith(i.path));
    const isTourActive = !profile?.dashboard_tour_complete;

    return (
      <div className="mb-1">
        {/* Section header */}
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
        >
          <span
            className="w-1.5 h-4 rounded-full shrink-0"
            style={{ backgroundColor: section.accentColor }}
          />
          <span className="flex-1 text-left">
            <span className="flex items-center gap-1.5">
              <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: section.accentColor }}>
                {section.tagline}
              </span>
              {section.id === 'earn' && (
                <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-wider"
                  style={{ background: 'rgba(194,65,12,0.25)', color: '#C2410C' }}>
                  COMING SOON
                </span>
              )}
            </span>
            <span className="block text-[10px] text-[#99c5ff]/40 leading-tight">{section.label}</span>
          </span>
          <ChevronDown
            size={12}
            className={`text-[#99c5ff]/30 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        {/* Section items */}
        {isOpen && (
          <div className="mt-0.5 space-y-0.5 pl-2">
            {section.items.map(({ path, label, icon: Icon, comingSoon, badge }) => {
              const badgeCount = badge === 'pendingActions' ? pendingActions : 0;
              const locked = isTabLocked(path);
              const guide  = TAB_GUIDES[path];
              const isHovered = hoveredNav === path;
              const isActive  = location.pathname.startsWith(path);

              return (
                <div
                  key={path}
                  className="relative"
                  onMouseEnter={() => setHoveredNav(path)}
                  onMouseLeave={() => setHoveredNav(null)}
                >
                  <NavLink
                    to={comingSoon ? '/earn' : path}
                    onClick={(e) => {
                      if (comingSoon) { e.preventDefault(); navigate('/earn'); return; }
                      handleNavClick(path, e);
                      onNavigate?.();
                    }}
                    className={({ isActive: navActive }) => {
                      const active = navActive || (comingSoon && location.pathname === '/earn' && isActive);
                      return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                        locked
                          ? 'text-[#99c5ff]/40 hover:bg-white/5'
                          : active
                            ? 'text-white shadow-md'
                            : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                      }`;
                    }}
                    style={({ isActive: navActive }) => {
                      const active = navActive && !comingSoon;
                      return active ? { backgroundColor: section.accentColor + '33', borderLeft: `2px solid ${section.accentColor}` } : {};
                    }}
                  >
                    <Icon size={16} className="shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {badgeCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-400 text-[#010a4f]">
                        {badgeCount}
                      </span>
                    )}
                    {comingSoon && (
                      <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: EARN_COLOR + '33', color: EARN_COLOR }}>
                        SOON
                      </span>
                    )}
                    {locked && !comingSoon && <Lock size={10} className="shrink-0 opacity-40" />}
                    {isTourActive && !locked && !comingSoon && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#4f78ff]/60 animate-pulse shrink-0" />
                    )}
                  </NavLink>

                  {isTourActive && isHovered && guide && !locked && !comingSoon && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 w-52 bg-[#0d1e78] border border-[#4f78ff]/30 rounded-xl p-3 shadow-2xl pointer-events-none">
                      <p className="text-[11px] text-[#99c5ff]/80 leading-relaxed">{guide}</p>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[#0d1e78]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Mobile bottom section picker ─────────────────────────────────────────────
  const MOBILE_SECTIONS = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'run',   label: 'Run',   icon: CalendarDays, color: '#4f78ff' },
    { id: 'grow',  label: 'Grow',  icon: TrendingUp,  color: GROW_COLOR },
    { id: 'earn',  label: 'Earn',  icon: Star,        color: EARN_COLOR },
  ];

  return (
    <div className="flex h-full min-h-screen bg-[#f0f4ff]">

      {upgradeModalReason && (
        <UpgradeModal reason={upgradeModalReason} onClose={() => setUpgradeModalReason(null)} />
      )}

      {upgradeBanner && (
        <div
          onClick={upgradeBanner.reload ? () => window.location.reload() : undefined}
          className={`fixed top-0 inset-x-0 z-50 px-4 py-3 text-center text-sm font-semibold ${upgradeBanner.warn ? 'bg-amber-500 text-white' : 'bg-[#1f48ff] text-white'} ${upgradeBanner.reload ? 'cursor-pointer hover:opacity-90' : ''}`}
        >
          {upgradeBanner.message}
        </div>
      )}

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-[#010a4f] text-white fixed left-0 top-0 bottom-0 z-40">

        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          {logoUrl ? (
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Business logo" className="h-9 w-9 rounded-xl object-contain bg-white/10 p-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{profile?.business_name || 'My Business'}</p>
                <p className="text-[10px] text-[#99c5ff] tracking-wide">powered by Cadi</p>
              </div>
            </div>
          ) : (
            <>
              <CadiWordmark height={24} />
              <p className="text-[10px] text-[#99c5ff] mt-1 tracking-wide">Business OS</p>
            </>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-1">

          {/* Dashboard — always visible above sections */}
          <div
            onMouseEnter={() => setHoveredNav('/dashboard')}
            onMouseLeave={() => setHoveredNav(null)}
            className="relative mb-3"
          >
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#1f48ff] text-white shadow-lg shadow-blue-900/40'
                    : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </NavLink>
          </div>

          <div className="border-t border-white/10 mb-3" />

          {/* Front Desk — expandable agent hub */}
          <FrontDeskNavGroup />

          <div className="border-t border-white/10 my-2" />

          {NAV_SECTIONS.map(section => (
            <SidebarSection key={section.id} section={section} />
          ))}
        </nav>

        {!isPro && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setUpgradeModalReason('Unlock every feature in Cadi — money tracking, HMRC MTD, open banking, GoCardless and more.')}
              className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors"
            >
              Upgrade to Pro — £39/mo
            </button>
          </div>
        )}

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
            {logoUrl
              ? <img src={logoUrl} alt="" className="w-8 h-8 rounded-full object-contain bg-white/10 p-0.5 shrink-0" />
              : <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold shrink-0">{userInitial}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-[#99c5ff]">{planLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">

        {/* Accountant client switcher banner */}
        {isAccountant && (
          <div className="sticky top-0 z-40 bg-[#010a4f] border-b border-[rgba(153,197,255,0.15)] px-4 md:px-8 py-2 flex items-center gap-3">
            <span className="text-xs font-bold text-[rgba(153,197,255,0.5)] shrink-0">Viewing as accountant:</span>
            <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
              {clients.map(c => (
                <button
                  key={c.owner_id}
                  onClick={() => switchClient(c)}
                  className={`shrink-0 text-xs font-black px-3 py-1.5 rounded-lg transition-colors ${
                    activeClient?.owner_id === c.owner_id
                      ? 'bg-[#1f48ff] text-white'
                      : 'bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.7)] hover:bg-[rgba(153,197,255,0.15)]'
                  }`}>
                  {c.owner_id.slice(0, 8)}…
                </button>
              ))}
            </div>
            {activeClient && (
              <button
                onClick={exitClientView}
                className="shrink-0 text-xs text-[rgba(153,197,255,0.4)] hover:text-white transition-colors font-medium">
                Exit client view
              </button>
            )}
          </div>
        )}

        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#99c5ff]/30 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-1 rounded-lg hover:bg-[#f0f4ff]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} className="text-[#010a4f]" />
            </button>
            <h1 className="text-base md:text-lg font-bold text-[#010a4f]">{currentLabel}</h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <span className={`hidden sm:block text-xs font-semibold px-3 py-1.5 rounded-full ${isPro ? 'bg-[#99c5ff]/30 text-[#1f48ff]' : 'bg-gray-100 text-gray-500'}`}>
              {planLabel}
            </span>
            {!isPro && (
              <button
                onClick={() => setUpgradeModalReason('Unlock every feature in Cadi.')}
                className="hidden sm:block text-xs font-black px-4 py-2 rounded-lg bg-[#1f48ff] text-white hover:bg-[#3a5eff] transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold px-3 md:px-4 py-2 rounded-lg bg-[#f0f4ff] text-[#010a4f] hover:bg-[#e0e8ff] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-6 pb-24 md:pb-6">
          {isTabLocked(location.pathname) ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="w-full max-w-md">
                <div className="rounded-2xl overflow-hidden border border-[#1f48ff]/20 text-center"
                  style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}>
                  <div className="px-6 py-10">
                    <div className="text-4xl mb-4">🔒</div>
                    <p className="text-lg font-black text-white mb-2">Cadi Pro feature</p>
                    <p className="text-sm text-white/50 mb-6">
                      {PRO_TAB_REASONS[Object.keys(PRO_TAB_REASONS).find(k => location.pathname.startsWith(k))] || 'Upgrade to unlock this feature.'}
                    </p>
                    <button
                      onClick={() => setUpgradeModalReason(PRO_TAB_REASONS[Object.keys(PRO_TAB_REASONS).find(k => location.pathname.startsWith(k))] || 'Upgrade to Cadi Pro.')}
                      className="px-6 py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black text-sm rounded-xl transition-all shadow-lg"
                    >
                      Upgrade to Pro — £39/month
                    </button>
                    <p className="text-[10px] text-white/25 mt-3">Cancel anytime · Powered by Stripe</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#010a4f] text-white flex flex-col">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <CadiWordmark height={24} />
                <p className="text-[10px] text-[#99c5ff] mt-1 tracking-wide">Business OS</p>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X size={18} className="text-[#99c5ff]" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <div className="mb-3">
                <NavLink
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-[#1f48ff] text-white' : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'}`
                  }
                >
                  <LayoutDashboard size={16} />
                  <span>Dashboard</span>
                </NavLink>
              </div>
              <div className="border-t border-white/10 mb-3" />
              <FrontDeskNavGroup onNavigate={() => setMobileMenuOpen(false)} />
              <div className="border-t border-white/10 my-2" />
              {NAV_SECTIONS.map(section => (
                <SidebarSection key={section.id} section={section} onNavigate={() => setMobileMenuOpen(false)} />
              ))}
            </nav>

            {!isPro && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => { setMobileMenuOpen(false); setUpgradeModalReason('Unlock every feature in Cadi.'); }}
                  className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black"
                >
                  Upgrade to Pro — £39/mo
                </button>
              </div>
            )}

            <div className="px-4 py-4 border-t border-white/10">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
                <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold">{userInitial}</div>
                <div>
                  <p className="text-sm font-semibold text-white">{userName}</p>
                  <p className="text-xs text-[#99c5ff]">{planLabel}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#010a4f] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          {MOBILE_SECTIONS.map(({ id, label, icon: Icon, path, color }) => {
            const isDashboard = id === 'dashboard';
            const sectionItems = !isDashboard ? NAV_SECTIONS.find(s => s.id === id)?.items || [] : [];
            const isSectionActive = isDashboard
              ? location.pathname === '/dashboard'
              : sectionItems.some(i => location.pathname.startsWith(i.path)) ||
                (id === 'earn' && location.pathname.startsWith('/earn'));

            const lastTabs = getLastTabs();
            const dest = isDashboard ? '/dashboard' : (lastTabs[id] || sectionItems[0]?.path || '/earn');

            return (
              <button
                key={id}
                onClick={() => {
                  if (isDashboard) navigate('/dashboard');
                  else if (id === 'earn') navigate('/earn');
                  else navigate(dest);
                  setMobileMenuOpen(false);
                }}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                  isSectionActive ? 'text-white' : 'text-[#99c5ff]/60'
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors`}
                  style={isSectionActive ? { backgroundColor: color || '#1f48ff' } : {}}>
                  <Icon size={16} />
                </div>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
