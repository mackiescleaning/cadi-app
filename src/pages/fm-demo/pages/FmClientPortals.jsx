import { useState, useEffect } from 'react';
import {
  ExternalLink,
  Settings2,
  Users,
  Eye,
  EyeOff,
  Globe,
  Copy,
  CheckCircle2,
  LayoutDashboard,
  Activity,
  Images,
  ClipboardList,
  ShieldCheck,
  BarChart2,
  AlertTriangle,
  MessageSquare,
  Settings,
  Rocket,
  Plus,
  X,
  Search,
  Clock,
} from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

const CLIENTS = [
  {
    id: 'asda',
    name: 'Asda Stores Ltd',
    contact: 'Helen Marsh',
    email: 'h.marsh@asda.co.uk',
    sites: 6,
    status: 'mobilising',
    statusLabel: 'Mobilising · Day 12',
    portalSlug: 'asda-stores-ltd',
    portalActive: true,
    lastLogin: '2h ago',
    monthlyViews: 147,
    users: [
      {
        name: 'Helen Marsh',
        email: 'h.marsh@asda.co.uk',
        role: 'Primary',
        avatar: 'HM',
        color: '#4f78ff',
      },
      {
        name: 'Tony Briggs',
        email: 't.briggs@asda.co.uk',
        role: 'FM Director',
        avatar: 'TB',
        color: '#10b981',
      },
    ],
    tabs: {
      overview: true,
      mobilisation: true,
      live: true,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: true,
      settings: true,
    },
    digest: 'daily',
    alertLevel: 'all',
  },
  {
    id: 'morrisons',
    name: 'Morrisons Distribution',
    contact: 'Karen Oyelaran',
    email: 'k.oyelaran@morrisons.co.uk',
    sites: 3,
    status: 'active',
    statusLabel: 'Active · 6 months',
    portalSlug: 'morrisons-distribution',
    portalActive: true,
    lastLogin: 'Yesterday',
    monthlyViews: 312,
    users: [
      {
        name: 'Karen Oyelaran',
        email: 'k.oyelaran@morrisons.co.uk',
        role: 'Primary',
        avatar: 'KO',
        color: '#f59e0b',
      },
    ],
    tabs: {
      overview: true,
      mobilisation: false,
      live: true,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: true,
      settings: false,
    },
    digest: 'weekly',
    alertLevel: 'issues',
  },
  {
    id: 'nhs',
    name: 'NHS Trust South East',
    contact: 'Dr Priya Sharma',
    email: 'p.sharma@nhs-se.nhs.uk',
    sites: 12,
    status: 'active',
    statusLabel: 'Active · 2 years',
    portalSlug: 'nhs-trust-south-east',
    portalActive: true,
    lastLogin: '3 days ago',
    monthlyViews: 489,
    users: [
      {
        name: 'Dr Priya Sharma',
        email: 'p.sharma@nhs-se.nhs.uk',
        role: 'Primary',
        avatar: 'PS',
        color: '#6366f1',
      },
      {
        name: 'Estates Manager',
        email: 'estates@nhs-se.nhs.uk',
        role: 'Estates',
        avatar: 'EM',
        color: '#ec4899',
      },
      {
        name: 'Compliance Lead',
        email: 'compliance@nhs-se.nhs.uk',
        role: 'Compliance',
        avatar: 'CL',
        color: '#10b981',
      },
    ],
    tabs: {
      overview: true,
      mobilisation: false,
      live: true,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: true,
      settings: false,
    },
    digest: 'daily',
    alertLevel: 'all',
  },
  {
    id: 'amazon',
    name: 'Amazon Fulfilment UK',
    contact: 'Sam Whitehouse',
    email: 's.whitehouse@amazon.co.uk',
    sites: 2,
    status: 'active',
    statusLabel: 'Active · 4 months',
    portalSlug: 'amazon-fulfilment-uk',
    portalActive: true,
    lastLogin: '1 week ago',
    monthlyViews: 88,
    users: [
      {
        name: 'Sam Whitehouse',
        email: 's.whitehouse@amazon.co.uk',
        role: 'Primary',
        avatar: 'SW',
        color: '#f97316',
      },
    ],
    tabs: {
      overview: true,
      mobilisation: false,
      live: false,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: false,
      settings: false,
    },
    digest: 'weekly',
    alertLevel: 'issues',
  },
  {
    id: 'prologis',
    name: 'Prologis Logistics Park',
    contact: 'Neil Foster',
    email: 'n.foster@prologis.com',
    sites: 4,
    status: 'setup',
    statusLabel: 'Portal setup pending',
    portalSlug: 'prologis-logistics',
    portalActive: false,
    lastLogin: null,
    monthlyViews: 0,
    users: [],
    tabs: {
      overview: true,
      mobilisation: true,
      live: true,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: true,
      settings: true,
    },
    digest: 'daily',
    alertLevel: 'all',
  },
  {
    id: 'intu',
    name: 'Intu Shopping Centres',
    contact: 'Fiona Blackwood',
    email: 'f.blackwood@intu.co.uk',
    sites: 8,
    status: 'setup',
    statusLabel: 'Portal setup pending',
    portalSlug: 'intu-shopping-centres',
    portalActive: false,
    lastLogin: null,
    monthlyViews: 0,
    users: [],
    tabs: {
      overview: true,
      mobilisation: true,
      live: true,
      evidence: true,
      history: true,
      compliance: true,
      reports: true,
      issue: true,
      comms: true,
      settings: true,
    },
    digest: 'daily',
    alertLevel: 'all',
  },
];

const TAB_CONFIG = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, always: true },
  { id: 'mobilisation', label: 'Mobilisation', icon: Rocket },
  { id: 'live', label: 'Live Activity', icon: Activity },
  { id: 'evidence', label: 'Photo Evidence', icon: Images },
  { id: 'history', label: 'Job History', icon: ClipboardList },
  { id: 'compliance', label: 'Compliance Pack', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: BarChart2 },
  { id: 'issue', label: 'Report an Issue', icon: AlertTriangle },
  { id: 'comms', label: 'Messages', icon: MessageSquare },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const STATUS_STYLE = {
  mobilising: { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  active: { bg: '#f0fdf4', color: '#15803d', dot: '#10b981' },
  setup: { bg: '#f8fafc', color: '#64748b', dot: '#94a3b8' },
};

function PortalTheatre({ client, win, onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 800);
    const t2 = setTimeout(() => setStep(2), 1600);
    const t3 = setTimeout(() => {
      if (win) win.focus();
      onDone();
    }, 2500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run the intro animation once on mount
  }, []);

  const STEPS = [
    { label: `Activating ${client.name} portal…`, sub: 'Configuring access permissions' },
    { label: `Sending invite to ${client.contact}…`, sub: client.email },
    { label: 'Opening client view…', sub: `client.cadi.cleaning/${client.portalSlug}` },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="rounded-3xl px-8 py-8 flex flex-col items-center gap-5 text-center"
        style={{
          background: 'rgba(255,255,255,0.98)',
          border: '1px solid rgba(16,185,129,0.2)',
          maxWidth: 360,
          width: '90%',
          boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
        }}
      >
        <div className="relative">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
            }}
          >
            <div className="w-6 h-6 rounded-full border-[2.5px] border-emerald-100 border-t-emerald-500 animate-spin" />
          </div>
          {step === 2 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[10px] font-black">
              ✓
            </div>
          )}
        </div>
        <div>
          <div className="font-black text-[#1a1210] text-sm mb-1.5">{STEPS[step].label}</div>
          <div className="text-xs text-gray-400 font-mono">{STEPS[step].sub}</div>
        </div>
        <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: step === 0 ? '28%' : step === 1 ? '64%' : '100%',
              background: 'linear-gradient(90deg, #10b981, #34d399)',
            }}
          />
        </div>
        <div className="text-[10px] text-gray-300 font-medium">
          {client.name} · {client.sites} sites
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({ client, onClose, showToast, onOpenPortal }) {
  const [tabs, setTabs] = useState({ ...client.tabs });
  const [digest, setDigest] = useState(client.digest);
  const [alerts, setAlerts] = useState(client.alertLevel);
  const [copied, setCopied] = useState(false);
  const [invite, setInvite] = useState('');
  const portalUrl = `client.cadi.cleaning/${client.portalSlug}`;

  function copy() {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Portal URL copied to clipboard');
  }

  function save() {
    showToast('Portal settings saved — changes live immediately');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
    >
      <div className="h-full w-full max-w-md bg-white overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 flex-shrink-0">
          <div>
            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">
              Portal Setup
            </div>
            <div className="text-sm font-black text-[#1a1210]">{client.name}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{client.contact}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors mt-0.5"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Portal URL */}
          <div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
              Portal URL
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
              <Globe size={13} className="text-gray-400 shrink-0" />
              <span className="flex-1 text-xs font-mono text-gray-600 truncate">{portalUrl}</span>
              <button
                onClick={copy}
                className="shrink-0 text-[10px] font-bold text-[#4f78ff] hover:text-[#3558cc] flex items-center gap-1 transition-colors"
              >
                {copied ? (
                  <CheckCircle2 size={12} className="text-emerald-500" />
                ) : (
                  <Copy size={12} />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {client.portalActive && (
              <button
                onClick={onOpenPortal}
                className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[#4f78ff] hover:underline"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <ExternalLink size={11} />
                Open portal as client
              </button>
            )}
          </div>

          {/* Portal tabs */}
          <div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
              Visible tabs
            </div>
            <div className="space-y-1.5">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                const on = tabs[tab.id];
                return (
                  <button
                    key={tab.id}
                    disabled={tab.always}
                    onClick={() => !tab.always && setTabs((t) => ({ ...t, [tab.id]: !t[tab.id] }))}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all"
                    style={
                      on
                        ? { background: '#f0f4ff', borderColor: 'rgba(79,120,255,0.25)' }
                        : { background: '#f8fafc', borderColor: 'transparent' }
                    }
                  >
                    <Icon size={13} style={{ color: on ? '#4f78ff' : '#94a3b8' }} />
                    <span
                      className="flex-1 text-left text-xs font-medium"
                      style={{ color: on ? '#1e3a8a' : '#94a3b8' }}
                    >
                      {tab.label}
                    </span>
                    {tab.always ? (
                      <span className="text-[9px] text-gray-300 font-bold">Always on</span>
                    ) : on ? (
                      <Eye size={13} className="text-[#4f78ff]" />
                    ) : (
                      <EyeOff size={13} className="text-gray-300" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Portal users */}
          <div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
              Portal access
            </div>
            <div className="space-y-2 mb-3">
              {client.users.length === 0 ? (
                <div className="text-[11px] text-gray-400 italic px-1">
                  No users yet — invite the client below.
                </div>
              ) : (
                client.users.map((u) => (
                  <div
                    key={u.email}
                    className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      style={{ background: u.color }}
                    >
                      {u.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-700 truncate">{u.name}</div>
                      <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                    </div>
                    <span className="text-[9px] font-black text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded-full shrink-0">
                      {u.role}
                    </span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Invite by email address"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-[#4f78ff] focus:bg-white transition-all"
              />
              <button
                onClick={() => {
                  if (invite) {
                    showToast(`Invite sent to ${invite}`);
                    setInvite('');
                  }
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-white transition-colors"
                style={{ background: '#4f78ff' }}
              >
                Invite
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
              Client notifications
            </div>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-gray-500 mb-1.5">Report digest</div>
                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly', 'off'].map((v) => (
                    <button
                      key={v}
                      onClick={() => setDigest(v)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all border"
                      style={
                        digest === v
                          ? {
                              background: '#f0f4ff',
                              borderColor: 'rgba(79,120,255,0.3)',
                              color: '#1e3a8a',
                            }
                          : { background: '#f8fafc', borderColor: 'transparent', color: '#94a3b8' }
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-gray-500 mb-1.5">Alert threshold</div>
                <div className="flex gap-2">
                  {[
                    { v: 'all', l: 'All alerts' },
                    { v: 'issues', l: 'Issues only' },
                    { v: 'off', l: 'Off' },
                  ].map(({ v, l }) => (
                    <button
                      key={v}
                      onClick={() => setAlerts(v)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all border"
                      style={
                        alerts === v
                          ? {
                              background: '#f0f4ff',
                              borderColor: 'rgba(79,120,255,0.3)',
                              color: '#1e3a8a',
                            }
                          : { background: '#f8fafc', borderColor: 'transparent', color: '#94a3b8' }
                      }
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {!client.portalActive && (
            <button
              onClick={() => {
                showToast(`Portal activated — invite sent to ${client.contact}`);
                onClose();
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-colors"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}
            >
              Activate portal & invite client
            </button>
          )}
          {client.portalActive && (
            <button
              onClick={save}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white transition-colors"
              style={{ background: 'linear-gradient(135deg,#4f78ff,#3558cc)' }}
            >
              Save changes
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors border border-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FmClientPortals({ showToast }) {
  const [configClient, setConfigClient] = useState(null);
  const [search, setSearch] = useState('');
  const [theatre, setTheatre] = useState(null);

  const activePortals = CLIENTS.filter((c) => c.portalActive).length;
  const pendingSetup = CLIENTS.filter((c) => !c.portalActive).length;
  const totalViews = CLIENTS.reduce((s, c) => s + c.monthlyViews, 0);

  const filtered = CLIENTS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <HowItWorks
        setupTime="3 min per client"
        accent="#4f78ff"
        youSetUp={[
          'Client contact name and email address',
          'Site list for that client (can copy from contract)',
          'Which portal tabs to show them',
        ]}
        cadiHandles={[
          'Creates a branded portal at client.cadi.cleaning/[slug]',
          'Sends invite email to your client contact',
          'Auto-populates live job data from day one',
          'Configures SLA window tracking per site',
        ]}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Active portals',
            value: activePortals,
            sub: `of ${CLIENTS.length} clients`,
            color: '#10b981',
          },
          {
            label: 'Pending setup',
            value: pendingSetup,
            sub: 'not yet activated',
            color: '#f59e0b',
          },
          {
            label: 'Views this month',
            value: totalViews.toLocaleString(),
            sub: 'across all portals',
            color: '#4f78ff',
          },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <div className="text-2xl font-black" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="text-xs font-bold text-gray-700 mt-0.5">{s.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#ea580c]/50 transition-all"
        />
      </div>

      {/* Client portal cards */}
      <div className="space-y-3">
        {filtered.map((client) => {
          const st = STATUS_STYLE[client.status];
          const tabsOn = Object.values(client.tabs).filter(Boolean).length;
          return (
            <div
              key={client.id}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center gap-4">
                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-black text-[#1a1210]">{client.name}</span>
                    <span
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: st.bg, color: st.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
                      {client.statusLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400 flex-wrap">
                    <span>{client.contact}</span>
                    <span>·</span>
                    <span>{client.sites} sites</span>
                    {client.portalActive && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          Last login {client.lastLogin}
                        </span>
                        <span>·</span>
                        <span>{client.monthlyViews} views/mo</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {client.portalActive ? (
                    <button
                      onClick={() => {
                        const win = window.open('/client-demo', '_blank');
                        setTheatre({ client, win });
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border"
                      style={{
                        background: '#f0fdf4',
                        borderColor: 'rgba(16,185,129,0.25)',
                        color: '#15803d',
                        cursor: 'pointer',
                      }}
                    >
                      <ExternalLink size={12} />
                      Open portal
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfigClient(client)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border"
                      style={{
                        background: '#fffbeb',
                        borderColor: 'rgba(245,158,11,0.25)',
                        color: '#b45309',
                      }}
                    >
                      <Plus size={12} />
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => setConfigClient(client)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Settings2 size={12} />
                    Configure
                  </button>
                </div>
              </div>

              {/* Portal details bar */}
              <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Globe size={11} className="text-gray-400" />
                  <span className="text-[10px] font-mono text-gray-500">
                    client.cadi.cleaning/{client.portalSlug}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users size={11} className="text-gray-400" />
                  <span className="text-[10px] text-gray-500">
                    {client.users.length} user{client.users.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Eye size={11} className="text-gray-400" />
                  <span className="text-[10px] text-gray-500">{tabsOn} tabs visible</span>
                </div>
                {client.portalActive && (
                  <div className="ml-auto flex items-center gap-1">
                    {Object.entries(client.tabs)
                      .filter(([, v]) => v)
                      .slice(0, 6)
                      .map(([k]) => {
                        const tab = TAB_CONFIG.find((t) => t.id === k);
                        if (!tab) return null;
                        const Icon = tab.icon;
                        return <Icon key={k} size={11} className="text-gray-300" />;
                      })}
                    {tabsOn > 6 && (
                      <span className="text-[9px] text-gray-300 ml-0.5">+{tabsOn - 6}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Config slide-over */}
      {configClient && (
        <ConfigPanel
          client={configClient}
          onClose={() => setConfigClient(null)}
          showToast={showToast}
          onOpenPortal={() => {
            const win = window.open('/client-demo', '_blank');
            setConfigClient(null);
            setTheatre({ client: configClient, win });
          }}
        />
      )}
      {theatre && (
        <PortalTheatre client={theatre.client} win={theatre.win} onDone={() => setTheatre(null)} />
      )}
    </div>
  );
}
