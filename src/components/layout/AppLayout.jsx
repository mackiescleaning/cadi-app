import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calculator, CalendarDays, Users,
  PoundSterling, Settings, Menu, X,
  TrendingUp, MapPin, FileText,
  GraduationCap, ClipboardList, Package
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

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

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { path: '/calculator', label: 'Pricing', icon: Calculator },
  { path: '/scheduler',  label: 'Scheduler',  icon: CalendarDays },
  { path: '/customers',  label: 'Customers',  icon: Users },
  { path: '/inventory',  label: 'Inventory',  icon: Package },
  { path: '/money',      label: 'Money',      icon: PoundSterling },
  { path: '/invoices',   label: 'Invoices',   icon: FileText },
  { path: '/accounts',   label: 'Accounts',   icon: PoundSterling },
  { path: '/routes',     label: 'Routes',     icon: MapPin },
  { path: '/scaling',    label: 'Business Lab',    icon: TrendingUp },
  { path: '/staff',      label: 'Staff',      icon: GraduationCap },
  { path: '/review',     label: 'Annual Review', icon: ClipboardList },
  { path: '/settings',   label: 'Settings',   icon: Settings },
];

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const currentPage = navItems.find(item =>
    location.pathname.startsWith(item.path)
  )?.label || 'Dashboard';

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const userInitial = profile?.first_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U';
  const userName = profile?.business_name || profile?.first_name || 'Your Business';
  const userPlan = profile?.plan === 'pro' ? 'Pro Plan' : 'Free Plan';

  return (
    <div className="flex h-full min-h-screen bg-[#f0f4ff]">

      {/* ── SIDEBAR (desktop) ── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-[#010a4f] text-white fixed left-0 top-0 bottom-0 z-40">

        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1f48ff] flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 14C7 10.134 10.134 7 14 7C16.209 7 18.18 8.014 19.5 9.6L17.4 11.35C16.56 10.34 15.35 9.7 14 9.7C11.624 9.7 9.7 11.624 9.7 14C9.7 16.376 11.624 18.3 14 18.3C15.35 18.3 16.56 17.66 17.4 16.65L19.5 18.4C18.18 19.986 16.209 21 14 21C10.134 21 7 17.866 7 14Z" fill="white"/>
              </svg>
            </div>
            <div>
              <p className="font-black text-base leading-tight text-white tracking-tight">cadi</p>
              <p className="text-xs text-[#99c5ff]">Business OS</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map(({ path, label, icon: Icon }) => {
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
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-[#1f48ff] text-white shadow-lg shadow-blue-900/40'
                        : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                  {isTourActive && (
                    <span className="w-2 h-2 rounded-full bg-brand-skyblue/60 animate-pulse shrink-0" />
                  )}
                </NavLink>
                {isTourActive && isHovered && guide && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 w-52 bg-[#0d1e78] border border-brand-blue/30 rounded-xl p-3 shadow-2xl pointer-events-none">
                    <p className="text-[11px] text-brand-skyblue/80 leading-relaxed">{guide}</p>
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-[#0d1e78]" />
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User block */}
        <div className="px-4 py-5 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
            <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold text-white">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-xs text-[#99c5ff] truncate">{userPlan}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col md:ml-64">

        {/* Top header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#99c5ff]/30 px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-[#f0f4ff]"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} className="text-[#010a4f]" />
            </button>
            <h1 className="text-lg font-bold text-[#010a4f]">{currentPage}</h1>
          </div>

          {/* Header right */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs font-semibold px-3 py-1.5 rounded-full bg-[#99c5ff]/30 text-[#1f48ff]">
              {userPlan}
            </span>
            <button className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#1f48ff] text-white hover:bg-[#010a4f] transition-colors">
              Upgrade to Pro
            </button>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-[#f0f4ff] text-[#010a4f] hover:bg-[#f0f4ff]"
            >
              Sign Out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 md:px-8 py-6">
          <Outlet />
        </main>
      </div>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-in panel */}
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[#010a4f] text-white flex flex-col">

            {/* Logo + close */}
            <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#1f48ff] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 14C7 10.134 10.134 7 14 7C16.209 7 18.18 8.014 19.5 9.6L17.4 11.35C16.56 10.34 15.35 9.7 14 9.7C11.624 9.7 9.7 11.624 9.7 14C9.7 16.376 11.624 18.3 14 18.3C15.35 18.3 16.56 17.66 17.4 16.65L19.5 18.4C18.18 19.986 16.209 21 14 21C10.134 21 7 17.866 7 14Z" fill="white"/>
                  </svg>
                </div>
                <div>
                  <p className="font-black text-base text-white tracking-tight">cadi</p>
                  <p className="text-xs text-[#99c5ff]">Business OS</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10"
              >
                <X size={18} className="text-[#99c5ff]" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-3 py-6 space-y-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#1f48ff] text-white'
                        : 'text-[#99c5ff] hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon size={18} />
                  <span className="flex-1">{label}</span>
                </NavLink>
              ))}
            </nav>

            {/* User block */}
            <div className="px-4 py-5 border-t border-white/10">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
                <div className="w-8 h-8 rounded-full bg-[#1f48ff] flex items-center justify-center text-xs font-bold">
                  {userInitial}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{userName}</p>
                  <p className="text-xs text-[#99c5ff]">{userPlan}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#010a4f] border-t border-white/10 flex">
        {navItems.slice(0, 6).map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? 'text-white'
                  : 'text-[#99c5ff]/60 hover:text-[#99c5ff]'
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
        ))}
      </nav>
    </div>
  );
}