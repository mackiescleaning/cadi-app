import { useState, useEffect } from 'react';
import WorkflowPipeline from './pages/WorkflowPipeline';
import FmDashboard    from './pages/FmDashboard';
import FmLiveOps      from './pages/FmLiveOps';
import FmCreateJob    from './pages/FmCreateJob';
import FmCoverageGaps from './pages/FmCoverageGaps';
import FmQaQueue      from './pages/FmQaQueue';
import FmReports      from './pages/FmReports';
import FmClientReport from './pages/FmClientReport';
import FmSettings     from './pages/FmSettings';
import FmHowItConnects from './pages/FmHowItConnects';
import FmIssues             from './pages/FmIssues';
import FmOnboarding         from './pages/FmOnboarding';
import FmWorkforce          from './pages/FmWorkforce';
import FmClients            from './pages/FmClients';
import FmClientPortals      from './pages/FmClientPortals';
import FmReviews            from './pages/FmReviews';
import FmCadiConnect        from './pages/FmCadiConnect';
import FmHiring             from './pages/FmHiring';
import FmCleanerOnboarding  from './pages/FmCleanerOnboarding';
import FmTenderPacks        from './pages/FmTenderPacks';
import FmTraining           from './pages/FmTraining';
import FmSupport            from './pages/FmSupport';
import FmAccounts                  from './pages/FmAccounts';
import FmInvoiceSubmit             from './pages/FmInvoiceSubmit';
import FmHome                      from './pages/FmHome';
import FmSubcontractorWorkflow     from './pages/FmSubcontractorWorkflow';
import FmContractedStaffWorkflow   from './pages/FmContractedStaffWorkflow';
import FmContractWizard            from './pages/FmContractWizard';
import FmScopeDecomposition        from './pages/FmScopeDecomposition';
import FmWorkforceRouting          from './pages/FmWorkforceRouting';
import FmStaffHR                   from './pages/FmStaffHR';
import FmStaffRota                 from './pages/FmStaffRota';
import FmPayroll                   from './pages/FmPayroll';
import FmJobCards                  from './pages/FmJobCards';
import FmDispatchBoard             from './pages/FmDispatchBoard';
import FmAreaManager               from './pages/FmAreaManager';
import FmExteriorDashboard         from './pages/FmExteriorDashboard';
import FmDeployExterior            from './pages/FmDeployExterior';
import FmSubPool                   from './pages/FmSubPool';
import FmStaffImport               from './pages/FmStaffImport';
import FmTupe                      from './pages/FmTupe';
import FmJobApprovals              from './pages/FmJobApprovals';
import FmExteriorContracts         from './pages/FmExteriorContracts';
import FmQuoteManagement           from './pages/FmQuoteManagement';
import FmExteriorScheduling        from './pages/FmExteriorScheduling';
import FmExteriorLive              from './pages/FmExteriorLive';
import {
  LayoutDashboard, MapPin, Building2, FilePlus, ClipboardCheck, FileText,
  CheckSquare, AlertTriangle, Star, UserCheck, Globe, UserPlus, Rocket, MonitorSmartphone,
  BarChart2, FileCheck, Share2, BookOpen, LifeBuoy,
  Settings, X, Bell, Receipt, GitBranch, Users, Wand2, BadgeCheck,
  TreePine, Route, CreditCard, Radio, Calendar, TrendingUp,
  Droplets, Wind, Layers,
} from 'lucide-react';
import CadiWordmark from '../../components/CadiWordmark';

// ── Contract Cleaning nav — one item per workflow step ───────────────────────
const CONTRACT_NAV_GROUPS = [
  {
    group: 'Overview',
    items: [
      { id: 'dashboard', label: 'Business Overview', icon: LayoutDashboard, component: FmDashboard,
        tooltip: 'Live across all sites — jobs today, staff on-site, cover rate and payroll in one view. The "under one roof" anchor.' },
    ],
  },
  {
    group: '1 · Win Contract',
    items: [
      { id: 'clients', label: 'Clients', icon: Building2, component: FmClients,
        tooltip: 'Every client, site and open issue in one place. Win the contract, get them live.' },
      { id: 'tupe', label: 'TUPE Transfers', icon: Users, component: FmTupe,
        tooltip: 'Track staff transfers when winning a contract — 30-day consultation windows, DBS checks and document compliance, all in one view.' },
    ],
  },
  {
    group: '2 · Client Portals',
    items: [
      { id: 'client-portals', label: 'Client Portals', icon: MonitorSmartphone, component: FmClientPortals,
        tooltip: 'Every client portal in one place. Open, configure and manage access for each client.' },
    ],
  },
  {
    group: '3 · Job Cards',
    items: [
      { id: 'job-cards', label: 'Job Cards', icon: CreditCard, component: FmJobCards,
        tooltip: 'Every shift scheduled, assigned and tracked. Every hour accounted for.' },
    ],
  },
  {
    group: '4 · Your Staff',
    items: [
      { id: 'staff-import', label: 'Import Staff', icon: Users, component: FmStaffImport,
        tooltip: 'Bulk upload your 1,487 PAYE employees via CSV — Cadi creates Staff App accounts and sends SMS invites automatically.' },
      { id: 'hr-staff', label: 'Staff & HR', icon: BadgeCheck, component: FmStaffHR,
        tooltip: '1,487 employed staff · DBS, right-to-work, training and payroll compliance all in one place.' },
    ],
  },
  {
    group: '5 · Area Manager',
    items: [
      { id: 'dispatch-board', label: 'Area Manager', icon: Radio, component: FmAreaManager,
        tooltip: 'Morning briefing, site round audits, staff actions and client relationship log — everything an area manager needs in one view.' },
    ],
  },
  {
    group: '6 · Staff Rota',
    items: [
      { id: 'staff-rota', label: 'Staff Rota', icon: Calendar, component: FmStaffRota,
        tooltip: 'Cleaners see their schedule in the app. Rotas built and published — no WhatsApp, no spreadsheets.' },
    ],
  },
  {
    group: '7 · Track Hours',
    items: [
      { id: 'live', label: 'Live Check-in', icon: MapPin, component: FmLiveOps,
        tooltip: 'Check-in status across every site in real time. Know who\'s on site before the client notices.' },
    ],
  },
  {
    group: '8 · Payroll',
    items: [
      { id: 'payroll', label: 'Payroll', icon: Receipt, component: FmPayroll,
        tooltip: 'Timesheets auto-captured → manager approval → BACS export. No manual entry.' },
    ],
  },
];

// ── Exterior Cleaning nav — one item per workflow step ───────────────────────
const EXTERIOR_NAV_GROUPS = [
  {
    group: '0 · Contractors',
    items: [
      { id: 'sub-pool', label: 'Contractors', icon: Users, component: FmSubPool,
        tooltip: 'Import your existing contractors via CSV — Cadi sends app invites automatically. Your pool is live in minutes.' },
      { id: 'cadi-connect', label: 'Cadi Connect', icon: Globe, component: FmCadiConnect,
        tooltip: 'Browse the wider network of vetted, scored contractors — tap in when your own pool is at capacity.' },
    ],
  },
  {
    group: '1 · Win Contract',
    items: [
      { id: 'ext-clients', label: 'Clients', icon: Building2, component: FmClients,
        tooltip: 'Client enquiry comes in — log the contact, confirm sites and set up the exterior contract.' },
    ],
  },
  {
    group: '2 · Job Cards',
    items: [
      { id: 'ext-quotes', label: 'Job Cards', icon: TrendingUp, component: FmQuoteManagement,
        tooltip: 'Create a job card, set your price with Cadi\'s suggestion, then deploy to a contractor — all in one place.' },
      { id: 'ext-deploy', label: 'Job Cards', icon: Wand2, component: FmDeployExterior, hidden: true,
        tooltip: 'One card per job type per location. Each card goes straight to a verified contractor.' },
    ],
  },
  {
    group: '3 · Schedule',
    items: [
      { id: 'ext-scheduling', label: 'Scheduling', icon: Calendar, component: FmExteriorScheduling,
        tooltip: 'Contractor picks their date and time in the app. Job card updates and Britannia Group is notified.' },
    ],
  },
  {
    group: '4 · Work Done',
    items: [
      { id: 'ext-live', label: 'Live Jobs', icon: MapPin, component: FmExteriorLive,
        tooltip: 'Contractor marks job complete and uploads photo evidence. Saved to the job — no chasing.' },
    ],
  },
  {
    group: '5 · Invoice',
    items: [
      { id: 'ext-accounts', label: 'Accounts Inbox', icon: Receipt, component: FmAccounts, badge: 2,
        tooltip: 'Submitted invoices land here. Approve, query or reject — then pay or export to Xero.' },
    ],
  },
];

const REGIONS = ['All', 'North', 'Midlands', 'South'];

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
  0%,100% { box-shadow: 0 0 0 0 rgba(234,88,12,0.4), 0 4px 20px rgba(234,88,12,0.3); }
  50%     { box-shadow: 0 0 0 6px rgba(234,88,12,0.0), 0 4px 28px rgba(234,88,12,0.5); }
}
@keyframes toast-in {
  from { opacity:0; transform: translateY(-8px) scale(0.97); }
  to   { opacity:1; transform: translateY(0)    scale(1); }
}
@keyframes alert-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.6; }
}
@keyframes tooltip-in {
  from { opacity:0; transform: translateX(-6px) scale(0.97); }
  to   { opacity:1; transform: translateX(0)    scale(1); }
}
@keyframes guide-in {
  from { opacity:0; transform: translateX(24px); }
  to   { opacity:1; transform: translateX(0); }
}
@keyframes popup-in {
  from { opacity:0; transform: scale(0.91) translateY(20px); }
  to   { opacity:1; transform: scale(1)    translateY(0); }
}
`;

const DEMO_STEPS = [
  { n: 1,  label: 'Workflow Overview',        page: 'home',          mode: 'contract',  mins: 1,
    hint: 'Start here. Show both workflow paths and "What this replaces" — the WhatsApp rota and DBS spreadsheet lines land hard.' },
  { n: 2,  label: 'Win Contract — Clients',   page: 'clients',       mode: 'contract',  mins: 2,
    hint: 'Open Asda. Show the site list, mobilisation tracker, and open issues. This is the single-place-for-everything moment.' },
  { n: 3,  label: 'Client Portals',           page: 'client-portals',mode: 'contract',  mins: 3,
    hint: 'Click "Activate portal" on Asda — show the 3-step theatre animation, then "Open portal as client". This is the wow moment.' },
  { n: 4,  label: 'Job Cards',                page: 'job-cards',     mode: 'contract',  mins: 2,
    hint: 'Show a scheduled shift. Highlight geo-stamp, task list, and photo evidence columns — every shift accounted for.' },
  { n: 5,  label: 'Staff & HR',               page: 'hr-staff',      mode: 'contract',  mins: 2,
    hint: '1,487 staff. Show DBS expiry flags, right-to-work, and training records. This handles the compliance anxiety.' },
  { n: 6,  label: 'Live Check-in Map',         page: 'live',          mode: 'contract',  mins: 2,
    hint: 'Red/green dots across all sites. Click a cleaner — show arrival time + photo. Then hit "See what your cleaner sees →".' },
  { n: 7,  label: 'Payroll',                  page: 'payroll',       mode: 'contract',  mins: 2,
    hint: 'Timesheets auto-captured from check-in → manager approval → BACS export. No manual entry.' },
  { n: 8,  label: 'Client Portal (Asda view)',page: null, external: '/client-demo',     mins: 3,
    hint: 'Open in a new tab. Show Asda\'s view: live site status, geo-stamped photo evidence, SLA tracker. Closes the loop.' },
  { n: 9,  label: 'Staff App (Sarah\'s view)', page: null, external: '/staff-demo',      mins: 2,
    hint: 'Open in a new tab. Show the rota, check-in button, task checklist, and pay summary — what 1,487 cleaners see.' },
  { n: 10, label: 'Back to Demo Home',         page: null, external: '/demo',            mins: 1,
    hint: 'Zoom out. All four portals side by side — FM · Client · Staff · Contractor. One connected system.' },
];

function DemoCompleteModal({ onClose, visitedExternal, onOpenPortal }) {
  const PORTALS = [
    { key: 'fm',         label: 'FM Portal',       sub: 'Britannia Group ops',   done: true,                       color: '#ea580c', emoji: '🏢' },
    { key: 'client',     label: 'Client Portal',   sub: "Asda's live view",      done: visitedExternal.client,     color: '#34d399', emoji: '🏪', url: '/client-demo' },
    { key: 'staff',      label: 'Staff App',        sub: "Sarah's cleaner view",  done: visitedExternal.staff,      color: '#4f78ff', emoji: '🧹', url: '/staff-demo' },
    { key: 'contractor', label: 'Contractor App',   sub: 'Contractor view',       done: visitedExternal.contractor, color: '#a78bfa', emoji: '🔧', url: '/operative-demo' },
  ];
  const seenCount = PORTALS.filter(p => p.done).length;
  const allSeen   = seenCount === 4;

  const NEXT_STEPS = [
    { emoji: '📅', label: 'Book a live walkthrough', sub: 'Tailored to your contracts and sites', color: '#ea580c', cta: 'Book now →', href: 'mailto:hello@cadi.cleaning?subject=Live%20Walkthrough%20Request' },
    { emoji: '🚀', label: 'Start a pilot',           sub: 'Live on one contract in 2 weeks',      color: '#34d399', cta: 'Get started →', href: 'https://cadi.cleaning' },
    { emoji: '💷', label: 'Get pricing',              sub: 'Per-site, no hidden fees',             color: '#a78bfa', cta: 'See pricing →', href: 'https://cadi.cleaning' },
    { emoji: '🔗', label: 'Share this demo',          sub: 'Send the link to your team',           color: '#38bdf8', cta: 'Copy link →', onClick: () => { navigator.clipboard?.writeText(window.location.origin + '/demo'); } },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 65, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(14px)' }}>
      <div style={{ width: '100%', maxWidth: 600, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(145deg,#0f0d0a,#1c1510)', border: '1px solid rgba(234,88,12,0.28)', boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 80px rgba(234,88,12,0.07)', animation: 'popup-in 0.28s cubic-bezier(0.34,1.56,0.64,1)' }}>

        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 28, height: 28, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={13} /></button>
          <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>{allSeen ? '🎉' : '✅'}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: 6 }}>
            {allSeen ? 'Demo complete — full picture seen' : `${seenCount} of 4 portals seen`}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.5 }}>
            {allSeen
              ? 'Your prospect has seen everything Cadi connects — FM · Client · Staff · Contractor.'
              : 'Open the remaining portals to show the full connected system — each one clicks live.'}
          </div>
        </div>

        {/* Four portals */}
        <div style={{ padding: '18px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.22)', marginBottom: 12 }}>Four portals · one connected system</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {PORTALS.map(p => (
              <div key={p.key}
                onClick={!p.done && p.url ? () => onOpenPortal(p.url, p.key) : undefined}
                style={{ padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, cursor: !p.done && p.url ? 'pointer' : 'default', transition: 'all 0.15s', background: p.done ? `${p.color}0e` : 'rgba(255,255,255,0.03)', border: p.done ? `1px solid ${p.color}35` : '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ fontSize: 20 }}>{p.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: p.done ? 'white' : 'rgba(255,255,255,0.3)' }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 1 }}>{p.sub}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, background: p.done ? p.color : 'rgba(255,255,255,0.07)', color: p.done ? 'white' : 'rgba(255,255,255,0.25)' }}>
                  {p.done ? '✓' : '↗'}
                </div>
              </div>
            ))}
          </div>
          {!allSeen && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)', fontSize: 10, color: 'rgba(56,189,248,0.7)' }}>
              Click an unvisited portal above to open it in a new tab — it updates the checklist automatically.
            </div>
          )}
        </div>

        {/* Next steps */}
        <div style={{ padding: '18px 28px 22px' }}>
          <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.22)', marginBottom: 12 }}>What happens next</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {NEXT_STEPS.map(item => (
              <a key={item.label}
                href={item.href || undefined}
                target={item.href ? '_blank' : undefined}
                rel="noreferrer"
                onClick={item.onClick}
                style={{ padding: '14px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: `${item.color}08`, border: `1px solid ${item.color}1e`, textDecoration: 'none', display: 'block', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = `${item.color}14`; e.currentTarget.style.borderColor = `${item.color}35`; }}
                onMouseLeave={e => { e.currentTarget.style.background = `${item.color}08`; e.currentTarget.style.borderColor = `${item.color}1e`; }}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{item.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 900, color: 'white', marginBottom: 3 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)', marginBottom: 10, lineHeight: 1.4 }}>{item.sub}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: item.color }}>{item.cta}</div>
              </a>
            ))}
          </div>

          {/* Contact strip */}
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'white' }}>Talk to the Cadi team</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>hello@cadi.cleaning · cadi.cleaning</div>
            </div>
            <a href="https://cadi.cleaning" target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 800, color: '#ea580c', textDecoration: 'none' }}>cadi.cleaning →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoGuidePanel({ currentPage, onNavigateWithMode, onClose, onExternalVisit, onShowComplete }) {
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 288, zIndex: 45,
      background: 'rgba(10,8,6,0.97)', backdropFilter: 'blur(32px)',
      borderLeft: '1px solid rgba(234,88,12,0.18)',
      boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
      animation: 'guide-in 0.22s ease-out',
      fontFamily: "'Satoshi','Inter',sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: '1rem 1rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ea580c', boxShadow: '0 0 6px rgba(234,88,12,0.8)' }} />
            <div style={{ fontWeight: 900, fontSize: '0.78rem', color: 'white', letterSpacing: '-0.01em' }}>Demo Presenter Guide</div>
          </div>
          <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.28)', fontWeight: 700, letterSpacing: '0.05em' }}>~20 MIN · 10 STEPS · CONTRACT PATH FIRST</div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.4rem', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
          <X size={13} />
        </button>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.6rem 0.65rem' }}>
        {DEMO_STEPS.map((step, idx) => {
          const isActive = step.page === currentPage;
          const isExternal = !!step.external;
          return (
            <button
              key={step.n}
              onClick={() => {
                if (isExternal) {
                  if (onExternalVisit) onExternalVisit(step.external);
                  else window.open(step.external, '_blank');
                } else if (step.page) onNavigateWithMode(step.page, step.mode);
              }}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', gap: '0.55rem',
                padding: '0.6rem 0.65rem', borderRadius: '0.6rem',
                marginBottom: '0.22rem', cursor: 'pointer',
                background: isActive ? 'rgba(234,88,12,0.12)' : 'rgba(255,255,255,0.02)',
                border: isActive ? '1px solid rgba(234,88,12,0.3)' : '1px solid rgba(255,255,255,0.04)',
                transition: 'background 0.12s, border-color 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'; } }}
            >
              {/* Step number */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: isActive ? 'linear-gradient(135deg,#ea580c,#c2410c)' : 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.52rem', fontWeight: 900,
                color: isActive ? 'white' : 'rgba(255,255,255,0.3)',
                boxShadow: isActive ? '0 2px 8px rgba(234,88,12,0.4)' : 'none',
              }}>{step.n}</div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.3rem', marginBottom: '0.18rem' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: isActive ? 'white' : 'rgba(255,255,255,0.55)', lineHeight: 1.2, letterSpacing: '-0.01em' }}>{step.label}</div>
                  <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.2)', fontWeight: 700, flexShrink: 0 }}>{step.mins}m{isExternal ? ' ↗' : ''}</div>
                </div>
                <div style={{ fontSize: '0.58rem', color: isActive ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.22)', lineHeight: 1.4 }}>{step.hint}</div>
              </div>
            </button>
          );
        })}

        {/* Bottom spacer */}
        <div style={{ height: '0.5rem' }} />
      </div>

      {/* Footer tip + wrap-up */}
      <div style={{ padding: '0.65rem 1rem 0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <button
          onClick={onShowComplete}
          style={{ width: '100%', marginBottom: '0.6rem', padding: '0.55rem 0.75rem', borderRadius: '0.55rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'linear-gradient(135deg,rgba(234,88,12,0.18),rgba(194,65,12,0.12))', border: '1px solid rgba(234,88,12,0.35)', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 900, color: '#fb923c', letterSpacing: '-0.01em' }}
          onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg,rgba(234,88,12,0.28),rgba(194,65,12,0.2))'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg,rgba(234,88,12,0.18),rgba(194,65,12,0.12))'}
        >
          🎉 Demo summary &amp; next steps
        </button>
        <div style={{ fontSize: '0.57rem', color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, fontWeight: 600 }}>
          Tip: click any step to jump there instantly. ↗ steps open in a new tab — keep this portal open behind them.
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-5 right-5 z-[60] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl max-w-sm"
      style={{
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(32px)',
        border: '1px solid rgba(234,88,12,0.3)',
        boxShadow: '0 8px 40px rgba(234,88,12,0.15), 0 2px 8px rgba(0,0,0,0.08)',
        animation: 'toast-in 0.2s ease-out',
      }}>
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
        style={{ background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)', color: '#ea580c' }}>✓</div>
      <span className="text-sm font-medium text-gray-800 flex-1">{msg}</span>
      <button onClick={onClose} className="ml-1 text-gray-300 hover:text-gray-600 transition-colors"><X size={13} /></button>
    </div>
  );
}

function NavTooltip({ label, text, y }) {
  const top = Math.max(12, Math.min(typeof window !== 'undefined' ? window.innerHeight - 110 : 600, y - 38));
  return (
    <div className="fixed pointer-events-none z-50" style={{ left: 252, top, minWidth: 230, maxWidth: 268, animation: 'tooltip-in 0.15s ease-out' }}>
      <div style={{ position: 'absolute', left: -5, top: 18, width: 10, height: 10, background: 'white', border: '1px solid rgba(234,88,12,0.2)', borderRight: 'none', borderTop: 'none', transform: 'rotate(45deg)', boxShadow: '-1px 1px 4px rgba(0,0,0,0.04)' }} />
      <div style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(234,88,12,0.2)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 32px rgba(234,88,12,0.1), 0 2px 12px rgba(0,0,0,0.08)' }}>
        <div className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: '#ea580c' }}>{label}</div>
        <div className="text-[11px] leading-snug" style={{ color: '#4b4540' }}>{text}</div>
      </div>
    </div>
  );
}

export default function FmDemoApp() {
  const [mode, setMode]         = useState('contract');
  const [region, setRegion]     = useState('all');
  const [page, setPage]         = useState('home');
  const [toast, setToast]       = useState(null);
  const [tooltip, setTooltip]   = useState(null);
  const [demoClientId, setDemoClientId] = useState(null);
  const [guideOpen,          setGuideOpen]          = useState(false);
  const [showDemoComplete,   setShowDemoComplete]   = useState(false);
  const [demoCompleteSeen,   setDemoCompleteSeen]   = useState(false); // once closed, auto-trigger won't re-fire
  const [visitedPages,       setVisitedPages]       = useState(new Set(['home']));
  const [visitedExternal,    setVisitedExternal]    = useState(() => ({
    client:     typeof localStorage !== 'undefined' && localStorage.getItem('cadi_visited_client')     === '1',
    staff:      typeof localStorage !== 'undefined' && localStorage.getItem('cadi_visited_staff')      === '1',
    contractor: typeof localStorage !== 'undefined' && localStorage.getItem('cadi_visited_contractor') === '1',
  }));

  function showToast(action) {
    setToast(`Demo — would ${action} in live version`);
    setTimeout(() => setToast(null), 3500);
  }

  function switchMode(m) {
    setMode(m);
    setPage('home');
    setTooltip(null);
  }

  function navigateWithMode(pageId, newMode) {
    if (newMode && newMode !== mode) setMode(newMode);
    setPage(pageId);
    setTooltip(null);
  }

  // Track every page visit
  useEffect(() => {
    setVisitedPages(prev => { const n = new Set(prev); n.add(page); return n; });
  }, [page]);

  // Auto-trigger when both workflow endings are visited — only fires once
  useEffect(() => {
    if (visitedPages.has('payroll') && visitedPages.has('ext-accounts') && !demoCompleteSeen) {
      const t = setTimeout(() => { setShowDemoComplete(true); setDemoCompleteSeen(true); }, 900);
      return () => clearTimeout(t);
    }
  }, [visitedPages, demoCompleteSeen]);

  function handleExternalVisit(url) {
    window.open(url, '_blank');
    const updates = {};
    if (url.includes('client-demo'))     { localStorage.setItem('cadi_visited_client',     '1'); updates.client     = true; }
    if (url.includes('staff-demo'))      { localStorage.setItem('cadi_visited_staff',      '1'); updates.staff      = true; }
    if (url.includes('operative-demo'))  { localStorage.setItem('cadi_visited_contractor', '1'); updates.contractor = true; }
    if (Object.keys(updates).length) setVisitedExternal(prev => ({ ...prev, ...updates }));
  }

  function handleOpenPortal(url, key) {
    window.open(url, '_blank');
    const storageKey = { client: 'cadi_visited_client', staff: 'cadi_visited_staff', contractor: 'cadi_visited_contractor' }[key];
    if (storageKey) { localStorage.setItem(storageKey, '1'); setVisitedExternal(prev => ({ ...prev, [key]: true })); }
  }

  const navGroups = mode === 'contract' ? CONTRACT_NAV_GROUPS : EXTERIOR_NAV_GROUPS;
  const allItems  = [
    { id: 'home', label: 'Home', icon: LayoutDashboard, component: FmHome },
    ...CONTRACT_NAV_GROUPS.flatMap(g => g.items),
    ...EXTERIOR_NAV_GROUPS.flatMap(g => g.items),
    { id: 'settings', label: 'Settings', icon: Settings, component: FmSettings },
  ];
  const current    = allItems.find(p => p.id === page) || allItems[0];
  const ActivePage = current.component;

  const exteriorAccent = '#16a34a'; // green-600 for exterior mode accents
  const accent = mode === 'exterior' ? exteriorAccent : '#ea580c';
  const accentBg = mode === 'exterior' ? 'rgba(22,163,74,0.1)' : 'rgba(234,88,12,0.1)';
  const accentBorder = mode === 'exterior' ? 'rgba(22,163,74,0.25)' : 'rgba(234,88,12,0.25)';

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="flex h-screen overflow-hidden"
        style={{ fontFamily: "'Satoshi', 'Inter', sans-serif", background: 'linear-gradient(145deg, #0f0d0a 0%, #1c1510 35%, #0f0c09 65%, #171209 100%)' }}>

        {/* Ambient blobs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-18%', left: '-8%', width: '60%', height: '60%', borderRadius: '50%', background: `radial-gradient(circle, ${mode === 'exterior' ? 'rgba(22,163,74,0.14)' : 'rgba(234,88,12,0.16)'} 0%, transparent 70%)`, animation: 'blob-drift 22s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-22%', right: '2%', width: '50%', height: '50%', borderRadius: '50%', background: `radial-gradient(circle, ${mode === 'exterior' ? 'rgba(34,197,94,0.09)' : 'rgba(251,191,36,0.1)'} 0%, transparent 70%)`, animation: 'blob-drift-2 28s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${mode === 'exterior' ? 'rgba(22,163,74,0.022)' : 'rgba(234,88,12,0.025)'} 1px, transparent 1px), linear-gradient(90deg, ${mode === 'exterior' ? 'rgba(22,163,74,0.022)' : 'rgba(234,88,12,0.025)'} 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
        </div>

        {/* DEMO ribbon */}
        <div className="fixed top-0 right-0 z-50 pointer-events-none overflow-hidden w-20 h-20">
          <div className="text-white text-[9px] font-black tracking-widest py-1.5 text-center"
            style={{ background: 'linear-gradient(135deg, #C2410C, #ea580c)', transform: 'rotate(45deg) translate(14px, -14px)', transformOrigin: 'center', width: 80 }}>
            DEMO
          </div>
        </div>

        {toast   && <Toast msg={toast} onClose={() => setToast(null)} />}
        {tooltip && <NavTooltip label={tooltip.label} text={tooltip.text} y={tooltip.y} />}
        {guideOpen && <DemoGuidePanel currentPage={page} onNavigateWithMode={navigateWithMode} onClose={() => setGuideOpen(false)} onExternalVisit={handleExternalVisit} onShowComplete={() => { setGuideOpen(false); setDemoCompleteSeen(true); setShowDemoComplete(true); }} />}
        {showDemoComplete && <DemoCompleteModal onClose={() => setShowDemoComplete(false)} visitedExternal={visitedExternal} onOpenPortal={handleOpenPortal} />}


        {/* ── Sidebar ── */}
        <aside className="w-60 flex-shrink-0 flex flex-col relative"
          style={{ zIndex: 10, background: 'rgba(255,255,255,0.93)', backdropFilter: 'blur(40px) saturate(1.8)', borderRight: `1px solid ${mode === 'exterior' ? 'rgba(22,163,74,0.15)' : 'rgba(234,88,12,0.15)'}`, boxShadow: `2px 0 24px ${mode === 'exterior' ? 'rgba(22,163,74,0.06)' : 'rgba(234,88,12,0.07)'}`, transition: 'border-color 0.3s, box-shadow 0.3s' }}>

          {/* Inner top glow */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: `linear-gradient(180deg, ${mode === 'exterior' ? 'rgba(22,163,74,0.04)' : 'rgba(234,88,12,0.04)'} 0%, transparent 30%)`, transition: 'background 0.3s' }} />

          {/* Logo */}
          <div className="px-5 pt-5 pb-4 relative" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-base shrink-0"
                style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', animation: 'logo-pulse 3s ease-in-out infinite' }}>B</div>
              <div>
                <div className="font-black text-sm leading-tight tracking-tight" style={{ color: '#1a1210' }}>Britannia Group</div>
                <div className="text-[11px] leading-tight" style={{ color: 'rgba(0,0,0,0.35)' }}>Ops Portal</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full" style={{ background: '#ea580c', boxShadow: '0 0 4px rgba(234,88,12,0.8)' }} />
              <div className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(0,0,0,0.25)' }}>Live · Powered by Cadi</div>
            </div>
          </div>

          {/* Home button */}
          {page !== 'home' && (
            <button
              onClick={() => setPage('home')}
              className="mx-3 mt-2 mb-1 py-1.5 rounded-lg text-[10px] font-black w-[calc(100%-1.5rem)] flex items-center justify-center gap-1.5 transition-all"
              style={{ background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.18)', color: 'rgba(234,88,12,0.7)' }}
            >
              ← Workflow overview
            </button>
          )}

          {/* Mode toggle */}
          <div className="px-3 pt-3 pb-2">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.06)' }}>
              <button onClick={() => switchMode('contract')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all leading-tight"
                style={mode === 'contract' ? { background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: 'white', boxShadow: '0 2px 8px rgba(234,88,12,0.35)' } : { color: 'rgba(0,0,0,0.4)' }}>
                Contract<br/>Cleaning
              </button>
              <button onClick={() => switchMode('exterior')}
                className="flex-1 py-1.5 rounded-lg text-[10px] font-black transition-all leading-tight"
                style={mode === 'exterior' ? { background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white', boxShadow: '0 2px 8px rgba(22,163,74,0.35)' } : { color: 'rgba(0,0,0,0.4)' }}>
                Exterior<br/>Services
              </button>
            </div>
          </div>

          {/* Region filter — contract mode only */}
          {mode === 'contract' && (
            <div className="px-3 pb-3">
              <div className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'rgba(0,0,0,0.25)' }}>Region</div>
              <div className="flex gap-1">
                {REGIONS.map(r => (
                  <button key={r} onClick={() => setRegion(r.toLowerCase())}
                    className="flex-1 py-1 rounded-lg text-[9px] font-black transition-all"
                    style={region === r.toLowerCase() ? { background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)', color: '#9a3412' } : { background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)', color: 'rgba(0,0,0,0.38)' }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nav groups */}
          <nav className="flex-1 px-2.5 py-2 overflow-y-auto space-y-4">
            {navGroups.map(({ group, items }) => (
              <div key={group}>
                <div className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: 'rgba(0,0,0,0.28)' }}>{group}</div>
                <div className="space-y-0.5">
                  {items.filter(item => !item.hidden).map(({ id, label, icon: Icon, badge, tooltip: tipText }) => {
                    const active = page === id;
                    return (
                      <button key={id}
                        onClick={() => { setPage(id); setTooltip(null); }}
                        onMouseEnter={e => {
                          if (!active) { e.currentTarget.style.background = `${accentBg}`; }
                          if (tipText) { const r = e.currentTarget.getBoundingClientRect(); setTooltip({ label, text: tipText, y: r.top + r.height / 2 }); }
                        }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; setTooltip(null); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative overflow-hidden"
                        style={active ? { background: accentBg, border: `1px solid ${accentBorder}`, color: mode === 'exterior' ? '#14532d' : '#9a3412', boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6)` } : { color: 'rgba(0,0,0,0.48)', border: '1px solid transparent' }}>
                        {active && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 2, borderRadius: 2, background: `linear-gradient(180deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 8px ${accent}90` }} />}
                        <Icon size={15} style={{ color: active ? accent : 'rgba(0,0,0,0.32)', flexShrink: 0 }} />
                        <span className="flex-1 text-left tracking-tight font-semibold" style={active ? { color: mode === 'exterior' ? '#14532d' : '#9a3412', fontWeight: 800 } : {}}>{label}</span>
                        {badge && (
                          typeof badge === 'string'
                            ? <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg,#C2410C,#ea580c)', color: 'white' }}>{badge}</span>
                            : <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', boxShadow: '0 2px 8px rgba(245,158,11,0.35)' }}>{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer — settings + role + user */}
          <div className="px-2.5 pb-2 relative" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <div className="pt-3 space-y-0.5">
              {(() => {
                const active = page === 'settings';
                return (
                  <button onClick={() => setPage('settings')}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = accentBg; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = ''; }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                    style={active ? { background: accentBg, border: `1px solid ${accentBorder}`, color: '#9a3412' } : { color: 'rgba(0,0,0,0.48)', border: '1px solid transparent' }}>
                    <Settings size={15} style={{ color: active ? accent : 'rgba(0,0,0,0.32)' }} />
                    <span>Settings</span>
                  </button>
                );
              })()}
            </div>

              <div className="px-3 pb-3">
              <a href="/demo"
                className="flex items-center gap-1.5 w-full py-1.5 px-3 rounded-lg no-underline transition-all text-[10px] font-bold"
                style={{ color: 'rgba(0,0,0,0.38)', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.07)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,88,12,0.07)'; e.currentTarget.style.color = 'rgba(234,88,12,0.8)'; e.currentTarget.style.borderColor = 'rgba(234,88,12,0.2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = 'rgba(0,0,0,0.38)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.07)'; }}
              >
                ← Demo home
              </a>
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative" style={{ zIndex: 10 }}>
          <header className="flex-shrink-0 px-8 h-14 flex items-center gap-4"
            style={{ borderBottom: `1px solid ${mode === 'exterior' ? 'rgba(22,163,74,0.1)' : 'rgba(234,88,12,0.1)'}`, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(24px)', transition: 'border-color 0.3s' }}>
            <a
              href="/demo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black no-underline shrink-0 transition-all"
              style={{ background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.2)', color: 'rgba(234,88,12,0.65)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(234,88,12,0.14)'; e.currentTarget.style.color = '#ea580c'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(234,88,12,0.07)'; e.currentTarget.style.color = 'rgba(234,88,12,0.65)'; }}
            >
              ← Demo home
            </a>
            <div className="flex items-center gap-3 flex-1">
              <h1 className="font-black text-base tracking-tight" style={{ color: '#1a1210' }}>{current.label}</h1>
              {mode === 'contract' && region !== 'all' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', color: '#9a3412' }}>
                  {region.charAt(0).toUpperCase() + region.slice(1)} Region
                </span>
              )}
              {mode === 'exterior' && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', color: '#14532d' }}>
                  Exterior Services
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button className="relative w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(0,0,0,0.3)' }}>
                <Bell size={15} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b', boxShadow: '0 0 6px rgba(245,158,11,0.7)' }} />
              </button>
              <button
                onClick={() => setGuideOpen(g => !g)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black tracking-[0.12em] transition-all"
                style={guideOpen
                  ? { background: 'rgba(234,88,12,0.18)', border: '1px solid rgba(234,88,12,0.45)', color: '#ea580c' }
                  : { background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.2)', color: 'rgba(234,88,12,0.7)' }}>
                <BookOpen size={11} />
                DEMO GUIDE
              </button>
              <div className="text-[9px] font-black px-3 py-1.5 rounded-full tracking-[0.15em]"
                style={{ color: '#ea580c', background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.22)' }}>
                DEMO MODE
              </div>
            </div>
          </header>

          {page !== 'home' && (
            <WorkflowPipeline mode={mode} page={page} onNavigate={setPage} />
          )}

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {page === 'home' ? (
              <FmHome onNavigateWithMode={navigateWithMode} mode={mode} />
            ) : (
              <ActivePage showToast={showToast} onNavigate={setPage} onNavigateMain={setPage} onNavigateWithMode={navigateWithMode} region={region} mode={mode} initialClientId={demoClientId} onSelectClient={setDemoClientId} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}
