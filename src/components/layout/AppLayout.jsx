import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import CadiWordmark from '../CadiWordmark';
import {
  LayoutDashboard, Calculator, CalendarDays, Users,
  PoundSterling, Settings, Menu, X,
  TrendingUp, MapPin, FileText,
  GraduationCap, ClipboardList, Package, Lock
} from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../hooks/usePlan';
import { MoreHorizontal } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UpgradeModal } from '../UpgradePrompt';

const TAB_GUIDES = {
  '/dashboard':  "Your mission control — health score, leaderboard, badges and daily activity all in one place.",
  '/calculator': "Pricing engine — generate instant quotes for residential, commercial and exterior jobs using UK market data.",
  '/scheduler':  "Book and manage every job — daily schedule, status tracking and team assignment at a glance.",
  '/customers':  "Your client database — notes, addresses, star ratings and full job history for every customer.",
  '/inventory':  "Track your cleaning kit — products, quantities, costs and restock alerts so you never run out.",
  '/money':      "Your financial dashboard — income, expenses, tax reserve, target tracker and payment logging.",
  '/invoices':   "Send and track invoices — one tap to invoice, one tap to chase, overdue alerts automatic.",
  '/accounts':   "Bookkeeping and compliance — MTD submissions, mileage claims and year-end figures ready to go.",
  '/routes':     "Route planner — optimise your daily drive, reduce fuel costs and log mileage for HMRC.",
  '/scaling':    "Business Lab — growth strategies, pricing analysis and AI-powered insights to scale your business.",
  '/staff':      "Team management — staff profiles, skills, availability and job assignments all in one place.",
  '/review':     "Annual Review — 90-day sprint goals, performance tracking and year-on-year progress.",
  '/settings':   "Settings — update your profile, hourly rate, services, sector and business preferences.",
};

const PRO_TAB_REASONS = {
  '/money':    'Track income, expenses, tax reserve and P&L — your full financial picture in one place.',
  '/accounts': 'File MTD submissions, claim mileage and see your year-end figures ready to go.',
  '/scaling':  'Growth strategies, pricing analysis and AI-powered insights to scale your business.',
  '/staff':    'Manage staff profiles, skills, availability and job assignments.',
  '/review':   'Set 90-day sprint goals and track performance year on year.',
};

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { path: '/calculator', label: 'Pricing',         icon: Calculator },
  { path: '/scheduler',  label: 'Scheduler',       icon: CalendarDays },
  { path: '/customers',  label: 'Customers',       icon: Users },
  { path: '/inventory',  label: 'Inventory',       icon: Package },
  { path: '/money',      label: 'Money',           icon: PoundSterling },
  { path: '/invoices',   label: 'Invoices',        icon: FileText },
  { path: '/accounts',   label: 'Accounts',        icon: PoundSterling },
  { path: '/routes',     label: 'Routes',          icon: MapPin },
  { path: '/scaling',    label: 'Business Lab',    icon: TrendingUp },
  { path: '/staff',      label: 'Staff',           icon: GraduationCap },
  { path: '/review',     label: 'Annual Review',   icon: ClipboardList },
  { path: '/settings',   label: 'Settings',        icon: Settings },
];

const BOTTOM_NAV_ITEMS = navItems.slice(0, 5);
const MORE_NAV_ITEMS = navItems.slice(5);

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [upgradeModalReason, setUpgradeModalReason] = useState(null); // null = closed
  const [upgradeBanner, setUpgradeBanner] = useState(null); // { message }
  const moreMenuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { isPro, isTabLocked } = usePlan();

  // Close "More" menu when clicking outside or navigating
  useEffect(() => {
    const handler = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMoreMenuOpen(false); }, [location.pathname]);

  // Handle return from Stripe checkout (?upgraded=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('upgraded')) return;
    window.history.replaceState({}, '', window.location.pathname);

    setUpgradeBanner({ message: 'Confirming your payment…' });
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from('profiles').select('plan').single();
      if (data?.plan === 'pro') {
        clearInterval(interval);
        refreshProfile();
        setUpgradeBanner({ message: '🎉 Welcome to Cadi Pro! All features are now unlocked.' });
        setTimeout(() => setUpgradeBanner(null), 5000);
      } else if (attempts >= 15) {
        clearInterval(interval);
        setUpgradeBanner({ message: 'Payment received — activation may take a minute. Refresh if features are still locked.', warn: true });
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentPage = navItems.find(item =>
    location.pathname.startsWith(item.path)
  )?.label || 'Dashboard';

  const isMoreActive = MORE_NAV_ITEMS.some(item => location.pathname.startsWith(item.path));

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNavClick = useCallback((path, e) => {
    if (isTabLocked(path)) {
      e.preventDefault();
      const reason = PRO_TAB_REASONS[path] || 'Upgrade to Cadi Pro to unlock this feature.';
      setUpgradeModalReason(reason);
    }
  }, [isTabLocked]);

  const userInitial = profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U';
  const userName = profile?.business_name || profile?.first_name || 'Your Business';
  const planLabel = isPro ? 'Cadi Pro' : 'Free plan';

  return (
    <div className="flex h-full min-h-screen bg-[#f0f4ff]">

      {/* Upgrade modal */}
      {upgradeModalReason && (
        <UpgradeModal
          reason={upgradeModalReason}
          onClose={() => setUpgradeModalReason(null)}
        />
      )}

      {/* Payment confirmation banner */}
      {upgradeBanner && (
        <div className={`fixed top-0 inset-x-0 z-50 px-4 py-3 text-center text-sm font-semibold ${upgradeBanner.warn ? 'bg-amber-500 text-white' : 'bg-[#1f48ff] text-white'}`}>
          {upgradeBanner.message}
        </div>
      )}

      {/* ── SIDEBAR (desktop) ── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-[#010a4f] text-white fixed left-0 top-0 bottom-0 z-40">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <CadiWordmark height={24} />
          <p className="text-[10px] text-[#99c5ff] mt-1 tracking-wide">Business OS</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const locked = isTabLocked(path);
            const isTourActive = !profile?.dashboard_tour_complete;
            const guide = TAB_GUIDES[path];
            const isHovered = hoveredNav === path;
            return (
              <div
                key={path}
                className="relative"
                onMouseEnter={() => setHoveredNav(path)}
                onMouseLeave={() => setHoveredNav(null)}
              >
                <NavLink
                  to={path}
                  onClick={(e) => handleNavClick(path, e)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      locked
                        ? 'text-[#99c5ff]/40 hover:bg-white/5 hover:text-[#99c5ff]/60'
                        : isActive
                          ? 'bg-[#1f48ff] text-white shadow-lg shadow-blue-900/40'
                          : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {locked
                    ? <Lock size={11} className="shrink-0 opacity-40" />
                    : isTourActive && <span className="w-2 h-2 rounded-full bg-brand-skyblue/60 animate-pulse shrink-0" />
                  }
                </NavLink>
                {isTourActive && isHovered && guide && !locked && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 w-52 bg-[#0d1e78] border border-brand-blue/30 rounded-xl p-3 shadow-2xl pointer-events-none">
                    <p className="text-[11px] text-brand-skyblue/80 leading-relaxed">{guide}</p>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[#0d1e78]" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Upgrade CTA for free users */}
        {!isPro && (
          <div className="px-4 pb-4">
            <button
              onClick={() => setUpgradeModalReason('Unlock every feature in Cadi — money tracking, HMRC MTD, open banking, GoCardless and more.')}
              className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors text-center"
            >
              Upgrade to Pro — £29/mo
            </button>
          </div>
        )}

        {/* User block */}
        <div className="px-4 py-5 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold text-white">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-[#99c5ff] truncate">{planLabel}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">

        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#99c5ff]/30 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-2 -ml-1 rounded-lg hover:bg-[#f0f4ff] active:bg-[#e0e8ff]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} className="text-[#010a4f]" />
            </button>
            <h1 className="text-base md:text-lg font-bold text-[#010a4f]">{currentPage}</h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <span className={`hidden sm:block text-xs font-semibold px-3 py-1.5 rounded-full ${
              isPro
                ? 'bg-[#99c5ff]/30 text-[#1f48ff]'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {planLabel}
            </span>
            {!isPro && (
              <button
                onClick={() => setUpgradeModalReason('Unlock every feature in Cadi — money tracking, HMRC MTD, open banking, GoCardless and more.')}
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

        {/* Page content — blocked for free users on pro-only routes */}
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
                      Upgrade to Pro — £29/month
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
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#010a4f] text-white flex flex-col">
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <CadiWordmark height={24} />
                <p className="text-[10px] text-[#99c5ff] mt-1 tracking-wide">Business OS</p>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/10">
                <X size={18} className="text-[#99c5ff]" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
              {navItems.map(({ path, label, icon: Icon }) => {
                const locked = isTabLocked(path);
                return (
                  <NavLink
                    key={path}
                    to={path}
                    onClick={(e) => {
                      handleNavClick(path, e);
                      if (!locked) setMobileMenuOpen(false);
                    }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        locked
                          ? 'text-[#99c5ff]/40'
                          : isActive
                            ? 'bg-[#1f48ff] text-white'
                            : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    <Icon size={18} />
                    <span className="flex-1">{label}</span>
                    {locked && <Lock size={11} className="shrink-0 opacity-40" />}
                  </NavLink>
                );
              })}
            </nav>

            {!isPro && (
              <div className="px-4 pb-4">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setUpgradeModalReason('Unlock every feature in Cadi — money tracking, HMRC MTD, open banking, GoCardless and more.');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#1f48ff] text-white text-xs font-black hover:bg-[#3a5eff] transition-colors"
                >
                  Upgrade to Pro — £29/mo
                </button>
              </div>
            )}

            <div className="px-4 py-5 border-t border-white/10">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
                <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold">
                  {userInitial}
                </div>
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
          {BOTTOM_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
            const locked = isTabLocked(path);
            return (
              <NavLink
                key={path}
                to={path}
                onClick={(e) => handleNavClick(path, e)}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                    isActive ? 'text-white' : locked ? 'text-[#99c5ff]/30' : 'text-[#99c5ff]/60 hover:text-[#99c5ff]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-lg transition-colors ${isActive ? 'bg-[#1f48ff]' : ''}`}>
                      <Icon size={16} />
                    </div>
                    {label}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* More button */}
          <div className="flex-1 relative" ref={moreMenuRef}>
            <button
              onClick={() => setMoreMenuOpen(v => !v)}
              className={`w-full flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                isMoreActive || moreMenuOpen ? 'text-white' : 'text-[#99c5ff]/60 hover:text-[#99c5ff]'
              }`}
            >
              <div className={`p-1.5 rounded-lg transition-colors ${isMoreActive ? 'bg-[#1f48ff]' : ''}`}>
                <MoreHorizontal size={16} />
              </div>
              More
            </button>

            {moreMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 mr-1 w-56 bg-[#010a4f] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
                {MORE_NAV_ITEMS.map(({ path, label, icon: Icon }) => {
                  const locked = isTabLocked(path);
                  return (
                    <NavLink
                      key={path}
                      to={path}
                      onClick={(e) => {
                        handleNavClick(path, e);
                        if (!locked) setMoreMenuOpen(false);
                      }}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          locked
                            ? 'text-[#99c5ff]/40'
                            : isActive
                              ? 'bg-[#1f48ff] text-white'
                              : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                        }`
                      }
                    >
                      <Icon size={16} />
                      <span className="flex-1">{label}</span>
                      {locked && <Lock size={11} className="opacity-40" />}
                    </NavLink>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}
