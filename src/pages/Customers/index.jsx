import { useState, useMemo, useCallback, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { usePlan, FREE_CUSTOMER_LIMIT } from "../../hooks/usePlan";
import { UpgradeModal } from "../../components/UpgradePrompt";
import { listOpenSurveys } from "../../lib/db/surveyDb";
import { approveAllPending, approvePendingCustomer, exportCustomerData } from "../../lib/db/customersDb";
import CustomerImport from "../../components/CustomerImport";
import { JOB_TYPES, generateSuggestions } from "./helpers";
import CustomerRow from "./CustomerRow";
import CustomerDetail from "./CustomerDetail";
import MessageComposer from "./MessageComposer";
import AddCustomerModal from "./AddCustomerModal";
import CustomerPulse from "./CustomerPulse";

// Celebration modal shown after bulk-approval lands.
// Bridges the gap between "I just approved my customers" and "where in
// Cadi do I go next?" by surfacing the post-onboarding sequence as
// clickable cards — the service catalogue (often forgotten because it
// was buried inside onboarding), the invoice template, and the schedule.
function PostApprovalCelebration({ open, summary, onClose, navigate }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#010a4f]/85 backdrop-blur-md" onClick={onClose}>
      <div
        className="relative max-w-md w-full rounded-3xl border border-emerald-500/30 p-6 sm:p-8 shadow-2xl"
        style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-[rgba(153,197,255,0.45)] hover:text-white hover:bg-white/[0.05] transition-colors flex items-center justify-center"
        >
          ✕
        </button>

        {/* Headline */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-2xl">✓</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">
            You're set up.
          </h2>
          <p className="text-[12px] text-[rgba(153,197,255,0.7)] leading-snug">
            <span className="font-bold text-white">{summary.customers}</span> customer{summary.customers === 1 ? '' : 's'} live ·{' '}
            <span className="font-bold text-white">{summary.jobs}</span> job{summary.jobs === 1 ? '' : 's'} scheduled across the next 12 weeks.
          </p>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wider text-[#99c5ff] mb-2.5 pl-1">
          What's next in Cadi
        </p>
        <div className="space-y-2">
          <NextStepCard
            emoji="🍽"
            title="Your service menu is live"
            body="Review prices, share with customers as a web link or PDF."
            onClick={() => { onClose(); navigate('/services'); }}
          />
          <NextStepCard
            emoji="📄"
            title="Customise your invoice template"
            body="Add your branding to every invoice Cadi sends. Two minutes."
            onClick={() => { onClose(); navigate('/settings/invoice'); }}
          />
          <NextStepCard
            emoji="🗓"
            title="See your week"
            body="Drag, drop, reorder. The schedule is yours."
            onClick={() => { onClose(); navigate('/scheduler'); }}
          />
        </div>

        <button
          onClick={() => { onClose(); navigate('/dashboard'); }}
          className="w-full mt-5 py-2.5 rounded-xl text-[12px] font-bold text-[#99c5ff] hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          Take me to my dashboard
        </button>
      </div>
    </div>
  );
}

function NextStepCard({ emoji, title, body, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-[rgba(153,197,255,0.15)] bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#99c5ff]/40 transition-all p-3 flex items-center gap-3"
    >
      <div className="w-10 h-10 rounded-xl bg-[#1f48ff]/20 border border-[#1f48ff]/40 flex items-center justify-center shrink-0">
        <span className="text-lg">{emoji}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-black text-white leading-tight mb-0.5">{title}</p>
        <p className="text-[11px] text-[rgba(153,197,255,0.65)] leading-snug">{body}</p>
      </div>
      <span className="text-[#99c5ff] text-base shrink-0">›</span>
    </button>
  );
}

// Amber banner shown above the customer list whenever there are imported
// customers awaiting review. One tap to approve them all — they then
// transition to active and start appearing in scheduler / reports / Score.
function PendingReviewBanner({ count, onApproveAll }) {
  const [busy, setBusy] = useState(false);
  if (!count) return null;
  return (
    <div className="mx-2 sm:mx-4 mb-3 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3 sm:p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
        <span className="text-base">⚠️</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-black text-white leading-snug">
          {count} customer{count === 1 ? '' : 's'} waiting for review
        </p>
        <p className="text-[11px] text-[rgba(253,224,71,0.7)] mt-0.5 leading-snug">
          Check the highlighted rows below, then approve. Nothing's on the schedule until you do.
        </p>
      </div>
      <button
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          try { await onApproveAll(); } finally { setBusy(false); }
        }}
        disabled={busy}
        className="shrink-0 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:bg-amber-400/40 text-[#010a4f] text-xs font-black transition-colors active:scale-95"
      >
        {busy ? 'Approving…' : `Approve ${count > 1 ? 'all' : ''}`}
      </button>
    </div>
  );
}

export default function CustomerTab() {
  const { customers, addCustomer, updateCustomer, deleteCustomer, eraseCustomer, refreshCustomers, refreshJobs } = useData();
  const { user } = useAuth();
  const { isPro, customerLimit } = usePlan();
  const navigate = useNavigate();
  const ownerId = user?.id || "demo";
  const [search,        setSearch]       = useState("");
  const [jobTypeFilter, setJobTypeFilter]= useState("all");
  const [statusFilter,  setStatusFilter] = useState("all");
  const [sortBy,        setSortBy]       = useState("urgent");
  const [selected,      setSelected]     = useState(null);
  const [composing,     setComposing]    = useState(null);
  const [showDetail,    setShowDetail]   = useState(false);
  const [showAddModal,  setShowAddModal] = useState(false);
  const [showImport,    setShowImport]   = useState(false);
  const [celebration,   setCelebration]  = useState(null);   // { customers, jobs } when set → modal open
  const locationState  = useLocation();
  // Backwards-compat: any older surface still routing here with
  // state.openImport gets redirected to the new onboarding migration flow
  // instead of the legacy CustomerImport modal.
  useEffect(() => {
    if (locationState.state?.openImport) {
      window.history.replaceState({}, '', locationState.pathname);
      navigate('/onboarding/customers');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Always pull fresh customers + jobs on mount so users landing here from
  // the onboarding commit (or any other writes elsewhere in the app) see
  // their new data without a hard refresh. Both calls are paginated and
  // cap at 2000 — cheap to run on tab open.
  useEffect(() => {
    refreshCustomers?.();
    refreshJobs?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showUpgrade,   setShowUpgrade]  = useState(false);
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [openSurveys,   setOpenSurveys]   = useState([]);
  const [surveysLoaded, setSurveysLoaded] = useState(false);

  const activeCustomers = useMemo(() => customers.filter(c => c.status !== 'archived'), [customers]);
  const atLimit = !isPro && activeCustomers.length >= customerLimit;

  const suggestionsByCustomer = useMemo(() => {
    const map = new Map();
    for (const c of customers) map.set(c.id, generateSuggestions(c));
    return map;
  }, [customers]);

  useEffect(() => {
    if (segmentFilter !== 'commercial' || surveysLoaded) return;
    listOpenSurveys().then(rows => { setOpenSurveys(rows); setSurveysLoaded(true); }).catch(() => {});
  }, [segmentFilter, surveysLoaded]);

  const filtered = useMemo(() => {
    let list = statusFilter === 'archived'
      ? customers.filter(c => c.status === 'archived')
      : customers.filter(c => c.status !== 'archived');

    if (segmentFilter !== "all") {
      list = list.filter(c => {
        if (c.segment && c.segment !== 'unsegmented') return c.segment === segmentFilter;
        const tags = c.tags ?? [];
        const serviceTypes = c.services.map(s => s.type);
        if (segmentFilter === 'commercial') return tags.includes('commercial') || tags.includes('contract') || serviceTypes.includes('commercial');
        if (segmentFilter === 'exterior')   return tags.includes('exterior')   || serviceTypes.some(t => ['exterior','windows','gutter','roof'].includes(t));
        if (segmentFilter === 'residential') return serviceTypes.some(t => ['regular','deep','end-of-tenancy','carpet','oven'].includes(t));
        return true;
      });
    }

    if (jobTypeFilter !== "all") {
      list = list.filter(c => c.services.some(s => s.type === jobTypeFilter));
    }

    if (statusFilter !== "all" && statusFilter !== "archived") {
      list = list.filter(c => c.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.postcode.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.notes.toLowerCase().includes(q)
      );
    }

    // Pending-review customers (just imported) always float to the top
    // so they're impossible to miss. Within the pending block, fall back
    // to the chosen sort.
    const pendingFirst = (a, b) => {
      const ap = a.accountStatus === 'pending_review' ? 0 : 1;
      const bp = b.accountStatus === 'pending_review' ? 0 : 1;
      return ap - bp;
    };

    if (sortBy === "name")   list = [...list].sort((a, b) => pendingFirst(a, b) || a.name.localeCompare(b.name));
    else if (sortBy === "value")  list = [...list].sort((a, b) => pendingFirst(a, b) || b.lifetimeValue - a.lifetimeValue);
    else if (sortBy === "recent") list = [...list].sort((a, b) => pendingFirst(a, b) || new Date(b.lastJobDate) - new Date(a.lastJobDate));
    else if (sortBy === "urgent") {
      const scores = new Map(list.map(c => {
        const days = c.lastJobDate ? Math.floor((Date.now() - new Date(c.lastJobDate)) / 86400000) : 0;
        const pri  = suggestionsByCustomer.get(c.id)?.[0]?.priority;
        const base = pri === "urgent" ? 1000 : pri === "high" ? 100 : 0;
        return [c.id, base + days];
      }));
      list = [...list].sort((a, b) => scores.get(b.id) - scores.get(a.id));
    }

    return list;
  }, [customers, search, jobTypeFilter, statusFilter, sortBy, suggestionsByCustomer, segmentFilter]);

  const density = activeCustomers.length >= 100 ? 'compact'
    : activeCustomers.length >= 30  ? 'medium'
    : 'large';

  const handleMessage = useCallback((customer, suggestion) => {
    setComposing({ customer, suggestion });
  }, []);

  const handleAddSave = useCallback(async (newCustomer) => {
    if (atLimit) { setShowUpgrade(true); return; }
    await addCustomer(newCustomer);
    setShowAddModal(false);
  }, [addCustomer, atLimit]);

  const handleBookJob = (customer) => navigate('/scheduler', { state: { customerName: customer.name } });

  const handleSelectCustomer = (customer) => {
    setSelected(customer);
    setShowDetail(true);
  };

  return (
    <div className="relative flex h-full bg-[#010a4f] overflow-hidden">
      <PostApprovalCelebration
        open={!!celebration}
        summary={celebration ?? { customers: 0, jobs: 0 }}
        onClose={() => setCelebration(null)}
        navigate={navigate}
      />
      {showUpgrade && (
        <UpgradeModal
          reason={`You've reached ${FREE_CUSTOMER_LIMIT} customers on the free plan. Upgrade to Pro for unlimited customers.`}
          onClose={() => setShowUpgrade(false)}
        />
      )}
      {/* Ambient depth — three orbs that the glass cards refract over.
          Larger on desktop (lg:), still present but smaller on mobile so
          we keep some character without paying for big GPU layers. */}
      <div className="pointer-events-none fixed -top-40 -right-20 w-[300px] h-[300px] lg:w-[520px] lg:h-[520px] rounded-full bg-[rgba(31,72,255,0.12)] blur-[90px] lg:blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-32 -left-16 w-[260px] h-[260px] lg:w-[420px] lg:h-[420px] rounded-full bg-[rgba(153,197,255,0.06)] blur-[70px] lg:blur-[100px]" />
      <div className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] lg:w-[480px] lg:h-[480px] rounded-full bg-[rgba(99,128,255,0.04)] blur-[110px] hidden lg:block" />

      <div className={`relative flex flex-col min-w-0 ${showDetail ? "hidden lg:flex lg:w-[400px]" : "flex-1"} border-r border-[rgba(153,197,255,0.08)] bg-[#010a4f]`}>

        <div className="relative bg-[#010a4f]/80 backdrop-blur-sm border-b border-[rgba(153,197,255,0.1)] px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-0.5">Cadi</p>
              <h2 className="text-2xl font-black text-white">Customers</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/onboarding/customers')}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-[rgba(153,197,255,0.1)] hover:bg-[rgba(153,197,255,0.18)] text-[#99c5ff] text-sm font-bold transition-all rounded-xl border border-[rgba(153,197,255,0.2)] active:scale-95">
                Import
              </button>
              <button
                onClick={() => atLimit ? setShowUpgrade(true) : setShowAddModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold transition-all rounded-xl shadow-lg shadow-[#1f48ff]/30 active:scale-95">
                <span className="text-lg leading-none">{atLimit ? '🔒' : '+'}</span>
                {atLimit ? `${activeCustomers.length}/${FREE_CUSTOMER_LIMIT}` : 'Add'}
              </button>
            </div>
          </div>
          <div className="flex gap-1 mt-3 p-1 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(153,197,255,0.10)]">
            {[
              { label: "All",         value: "all",         icon: null },
              { label: "Commercial",  value: "commercial",  icon: "🏢" },
              { label: "Residential", value: "residential", icon: "🏠" },
              { label: "Exterior",    value: "exterior",    icon: "🏗" },
            ].map(({ label, value, icon }) => (
              <button
                key={value}
                onClick={() => setSegmentFilter(value)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  segmentFilter === value
                    ? "bg-[#1f48ff] text-white shadow-sm"
                    : "text-[rgba(153,197,255,0.5)] hover:text-[rgba(153,197,255,0.8)]"
                }`}
              >
                {icon && <span className="text-sm leading-none">{icon}</span>}
                {label}
              </button>
            ))}
          </div>

          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {[
              { label: "All", value: "all" },
              { label: "Active", value: "active" },
              { label: "Lapsed", value: "lapsed" },
              { label: "At risk", value: "at-risk" },
            ].map(({ label, value }) => (
              <button key={value} onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 text-xs font-bold border rounded-lg transition-all whitespace-nowrap shrink-0 ${
                  statusFilter === value
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.5)] border-[rgba(153,197,255,0.12)]"
                }`}>{label}</button>
            ))}
          </div>
        </div>

        {!isPro && activeCustomers.length >= FREE_CUSTOMER_LIMIT - 5 && activeCustomers.length < FREE_CUSTOMER_LIMIT && (
          <div className="mx-4 mt-3 flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
            <p className="text-xs text-amber-300 leading-snug">
              <span className="font-black">{activeCustomers.length}/{FREE_CUSTOMER_LIMIT} customers</span> — you're nearly at your free limit.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="shrink-0 text-[11px] font-black px-3 py-1.5 bg-[#1f48ff] text-white rounded-lg hover:bg-[#3a5eff] transition-colors whitespace-nowrap"
            >
              Upgrade →
            </button>
          </div>
        )}

        <div className="border-b border-[rgba(153,197,255,0.08)]">
          <CustomerPulse
            customers={customers}
            onSelectCustomer={handleSelectCustomer}
            onMessage={handleMessage}
            onFilter={(status) => setStatusFilter(status)}
          />
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[rgba(153,197,255,0.4)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, postcode, notes…"
              className="w-full pl-8 pr-8 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl py-2.5 text-sm text-white placeholder-[rgba(153,197,255,0.3)] focus:outline-none focus:border-[#99c5ff] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(153,197,255,0.4)] hover:text-white text-xs font-bold transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="px-4 pb-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {JOB_TYPES.map(jt => (
              <button
                key={jt.id}
                onClick={() => setJobTypeFilter(jt.id)}
                className={`px-2.5 py-1 text-xs font-bold border rounded-lg whitespace-nowrap transition-colors shrink-0 ${
                  jobTypeFilter === jt.id
                    ? "bg-[#1f48ff] text-white border-[#1f48ff]/60"
                    : "bg-[rgba(153,197,255,0.06)] border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.7)] hover:border-[rgba(153,197,255,0.35)] hover:text-white"
                }`}
              >
                {jt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-xs text-[rgba(153,197,255,0.8)] focus:outline-none focus:border-[#99c5ff] transition-colors"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="lapsed">Lapsed</option>
            <option value="at-risk">At risk</option>
            <option value="archived">Archived</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-xs text-[rgba(153,197,255,0.8)] focus:outline-none focus:border-[#99c5ff] transition-colors"
          >
            <option value="name">Sort: Name</option>
            <option value="value">Sort: Value</option>
            <option value="recent">Sort: Recent</option>
            <option value="urgent">Sort: Urgent first</option>
          </select>
          <span className="text-xs text-[rgba(153,197,255,0.4)] ml-auto">{filtered.length} customers</span>
        </div>

        {segmentFilter === 'commercial' && (
          <div className="mx-4 mb-3 rounded-xl border border-[rgba(31,72,255,0.25)] bg-[rgba(31,72,255,0.06)] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[rgba(31,72,255,0.15)]">
              <p className="text-xs font-bold text-[#99c5ff]">Open surveys</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.4)]">Select a customer below to start one</p>
            </div>
            {openSurveys.length === 0 ? (
              <div className="px-4 py-3">
                <p className="text-xs text-[rgba(153,197,255,0.4)]">No surveys in progress — open a commercial customer to start one.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(31,72,255,0.12)]">
                {openSurveys.map(sv => (
                  <button
                    key={sv.id}
                    onClick={() => navigate(`/survey/${sv.id}`)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[rgba(31,72,255,0.1)] transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{sv.customers?.name ?? '—'}</p>
                      <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 capitalize">{sv.status.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                        sv.status === 'capturing'   ? 'bg-blue-500/15 text-blue-300 border-blue-500/25' :
                        sv.status === 'structured'  ? 'bg-amber-500/15 text-amber-300 border-amber-500/25' :
                        sv.status === 'quoted'      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' :
                                                      'bg-white/10 text-[rgba(153,197,255,0.5)] border-white/10'
                      }`}>{sv.status}</span>
                      <span className="text-[#99c5ff] text-sm">→</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="bg-transparent overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            activeCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-16 h-16 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] flex items-center justify-center mb-4">
                  <span className="text-2xl">👥</span>
                </div>
                <p className="text-base font-black text-white mb-1">Bring your customers in.</p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mb-5 leading-relaxed max-w-xs">
                  Cadi auto-detects exports from CleanerPlanner, Squeegee, Aworka, Jobber and ServiceM8 — addresses, schedules and balances move across.
                </p>
                <button
                  onClick={() => navigate('/onboarding/customers')}
                  className="px-5 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-black rounded-xl transition-colors shadow-lg shadow-[#1f48ff]/30 mb-3 w-full max-w-xs"
                >
                  📥 Import customers
                </button>
                <div className="flex items-center gap-1.5 text-[10px] text-[rgba(153,197,255,0.3)] mb-4">
                  {['CleanerPlanner', 'Squeegee', 'Aworka', 'Jobber'].map((label, i) => (
                    <span key={label}>{i > 0 && '·'} <span className={i > 0 ? 'ml-1' : ''}>{label}</span></span>
                  ))}
                </div>
                <button
                  onClick={() => atLimit ? setShowUpgrade(true) : setShowAddModal(true)}
                  className="text-xs text-[rgba(153,197,255,0.55)] hover:text-white font-semibold transition-colors"
                >
                  Or add one by hand →
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] flex items-center justify-center mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <p className="text-sm text-[rgba(153,197,255,0.5)] mb-1">No customers found</p>
                <button
                  onClick={() => { setSearch(""); setJobTypeFilter("all"); setStatusFilter("all"); }}
                  className="mt-1 text-xs text-[#99c5ff] hover:text-white font-semibold transition-colors"
                >
                  Clear filters
                </button>
              </div>
            )
          ) : (
            <>
              <PendingReviewBanner
                count={customers.filter(c => c.accountStatus === 'pending_review').length}
                onApproveAll={async () => {
                  try {
                    const { count, jobsCreated } = await approveAllPending();
                    if (count > 0) await refreshCustomers();
                    if (jobsCreated > 0) await refreshJobs?.();
                    if (count > 0) {
                      // Trigger the celebration modal instead of a flat alert
                      // so the user sees their next steps in Cadi.
                      setCelebration({ customers: count, jobs: jobsCreated });
                    }
                  } catch (e) {
                    alert(e?.message ?? "Couldn't approve — try again.");
                  }
                }}
              />
              {filtered.map(customer => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  onClick={handleSelectCustomer}
                  selected={selected?.id === customer.id}
                  onArchive={(id) => { deleteCustomer(id); if (selected?.id === id) { setShowDetail(false); setSelected(null); } }}
                  onApprove={async (id) => {
                    try {
                      const result = await approvePendingCustomer(id);
                      await refreshCustomers();
                      if ((result?.jobsCreated ?? 0) > 0) await refreshJobs?.();
                    } catch (e) { alert(e?.message ?? "Couldn't approve."); }
                  }}
                  density={density}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {showDetail && selected ? (
        <div className="flex-1 overflow-hidden">
          <CustomerDetail
            customer={customers.find(c => c.id === selected.id) ?? selected}
            onMessage={handleMessage}
            onClose={() => { setShowDetail(false); setSelected(null); }}
            onBookJob={handleBookJob}
            onUpdateCustomer={updateCustomer}
            onDeleteCustomer={(id) => { deleteCustomer(id); setShowDetail(false); setSelected(null); }}
            onEraseCustomer={async (id) => {
              const result = await eraseCustomer(id);
              // Brief delay so the success receipt is visible before the
              // detail closes and the row vanishes from the list.
              setTimeout(() => { setShowDetail(false); setSelected(null); }, 1500);
              return result;
            }}
            onExportCustomer={async (id) => {
              // SAR fulfilment — pulls the full envelope from Supabase, builds
              // a JSON blob, and triggers a browser download. The audit log
              // entry is written server-side by exportCustomerData itself.
              const envelope = await exportCustomerData(id);
              const filename = `cadi-sar-${(envelope.customer?.name || 'customer').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}-${envelope.exported_at.slice(0, 10)}.json`;
              const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
              const url  = URL.createObjectURL(blob);
              const a    = document.createElement('a');
              a.href = url; a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              return envelope;
            }}
            ownerId={ownerId}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-[#010a4f]">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.1)] flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👤</span>
            </div>
            <p className="text-sm font-bold text-[rgba(153,197,255,0.5)] mb-1">Select a customer</p>
            <p className="text-xs text-[rgba(153,197,255,0.3)]">View profile, job history and opportunities</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setShowAddModal(true)}
        className="lg:hidden fixed bottom-20 right-5 z-40 w-14 h-14 rounded-2xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-2xl font-bold shadow-2xl shadow-[#1f48ff]/40 flex items-center justify-center transition-all active:scale-95"
        aria-label="Add customer"
      >
        +
      </button>

      {composing && (
        <MessageComposer
          customer={composing.customer}
          suggestion={composing.suggestion}
          onClose={() => setComposing(null)}
        />
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddSave}
        />
      )}

      {showImport && (
        <CustomerImport
          onClose={() => setShowImport(false)}
          existingCustomers={customers}
          onImported={() => {
            refreshCustomers();
            refreshJobs();
          }}
          onViewScheduler={() => {
            refreshCustomers();
            refreshJobs();
            setShowImport(false);
            navigate('/scheduler');
          }}
        />
      )}
    </div>
  );
}
