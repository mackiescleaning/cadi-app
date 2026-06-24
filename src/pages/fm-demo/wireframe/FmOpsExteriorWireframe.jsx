import { useState } from 'react';
import {
  ArrowRight, ArrowLeft, Building2, Users, FileText, Send, Calendar,
  Camera, CheckCircle2, Receipt, PoundSterling, Upload, ShoppingBag,
  ClipboardList, Star, Briefcase, AlertTriangle, Lock, Unlock, Zap,
} from 'lucide-react';
import acerta from './acerta-sites.json';

// ─────────────────────────────────────────────────────────────────────────────
// FM Ops Portal (Exterior / Sub-contracted) — build wireframe
// Single annotated map of the end-to-end loop:
//   FM Ops side  ↔  Cadi Connect tabs inside main Cadi (subcontractor)
// ─────────────────────────────────────────────────────────────────────────────

const NAVY   = '#010a4f';
const ORANGE = '#C2410C';
const GREEN  = '#16a34a';
const INK    = '#0f172a';
const MUTE   = '#64748b';
const LINE   = '#e2e8f0';
const PAPER  = '#ffffff';
const BG     = '#f8faff';

// 8 stations of the loop — drives the top diagram and the row order below
const LOOP = [
  { n: 1, side: 'fm',  key: 'contract',  label: 'Contract upload',   icon: Upload,        note: 'FM uploads signed sub-contract → visible on sub profile' },
  { n: 2, side: 'fm',  key: 'dispatch',  label: 'Dispatch / publish', icon: Send,          note: 'FM publishes job card → either direct dispatch or marketplace' },
  { n: 3, side: 'sub', key: 'inbox',     label: 'Inbox / marketplace',icon: ShoppingBag,   note: 'Sub sees new job in Cadi Connect tab inside their main Cadi' },
  { n: 4, side: 'sub', key: 'accept',    label: 'Accept & schedule',  icon: Calendar,      note: 'Sub picks date → syncs back to FM scheduling' },
  { n: 5, side: 'sub', key: 'complete',  label: 'Complete on site',   icon: Camera,        note: 'Sub uploads geo-stamped photos + sign-off' },
  { n: 6, side: 'fm',  key: 'approve',   label: 'Ops approval',       icon: CheckCircle2,  note: 'FM ops reviews evidence → approve / query / reject' },
  { n: 7, side: 'sub', key: 'invoice',   label: 'Invoice submission', icon: Receipt,       note: 'On approval, sub raises invoice from inside Cadi Connect' },
  { n: 8, side: 'fm',  key: 'pay',       label: 'Accounts → pay',     icon: PoundSterling, note: 'FM accounts inbox: pay or export to Xero → updates sub Earnings' },
];

// FM Ops screens — pulled from the existing demo (FmDemoApp exterior mode)
const FM_SCREENS = [
  {
    key: 'contractors', label: 'Contractors', icon: Users,
    source: 'FmSubPool.jsx · NEEDS bulk-upload',
    blocks: [
      'Sub list (name · region · trades · score)',
      'Bulk CSV import: 100–300 Britannia subs in one drop',
      'Auto-provision free Cadi Lite + Connect unlocked',
      'Compliance flags (DBS · insurance · RAMS)',
    ],
  },
  {
    key: 'contracts', label: 'Contracts upload', icon: Upload,
    source: 'NEW · build',
    blocks: [
      'Per-sub contract list (PDF on file)',
      'Upload contract · type (MSA/SLA/NDA)',
      'Expiry tracker · auto-flag 30 days out',
      'Push contract to sub profile inside their Cadi',
    ],
  },
  {
    key: 'jobcards', label: 'Job Cards', icon: ClipboardList,
    source: 'FmQuoteManagement.jsx · FmDeployExterior.jsx',
    blocks: [
      'Build card: site · scope · price · window',
      'Deploy → direct sub OR marketplace listing',
      'Auto-suggest match from Connect score',
      'Track card status: open → assigned → done',
    ],
  },
  {
    key: 'marketplace', label: 'Marketplace publish', icon: Send,
    source: 'NEW · build (mirrors EarnMarketplace)',
    blocks: [
      'Listings published by this FM',
      'Visibility: open · invited · Connect Elite only',
      'Bids / interest list',
      'Award + auto-dispatch on accept',
    ],
  },
  {
    key: 'scheduling', label: 'Scheduling', icon: Calendar,
    source: 'FmExteriorScheduling.jsx',
    blocks: [
      'Week grid · all sub-contracted sites',
      'Date confirmations land here',
      'Gaps + conflicts surfaced',
      'Client-side schedule view link',
    ],
  },
  {
    key: 'approval', label: 'Work approval', icon: CheckCircle2,
    source: 'FmExteriorLive.jsx · FmJobApprovals.jsx',
    blocks: [
      'Evidence queue (photos · geo · timestamp)',
      'Approve · query (back to sub) · reject',
      'Auto-release invoice on approve',
      'SLA + KPI capture',
    ],
  },
  {
    key: 'accounts', label: 'Accounts inbox', icon: Receipt,
    source: 'FmAccounts.jsx · FmInvoiceSubmit.jsx',
    blocks: [
      'Submitted invoices from subs',
      'Match to approved job card',
      'Pay (BACS) · export to Xero · dispute',
      'Payment status feeds back to sub Earnings',
    ],
  },
];

// Subcontractor screens — Cadi Connect tabs inside main Cadi (operative side)
const SUB_SCREENS = [
  {
    key: 'home', label: 'Connect home', icon: Briefcase,
    source: 'ConnectPortalHome.jsx',
    blocks: [
      'New job alert banner',
      'Pipeline: on site · awaiting evidence · pending review',
      'Connected FMs (Britannia Group · since Jan)',
      'Earnings + Connect score header',
    ],
  },
  {
    key: 'marketplace', label: 'Marketplace', icon: ShoppingBag,
    source: 'OperativePortalDemo › CONNECT › Marketplace',
    blocks: [
      'Open jobs from all connected FMs',
      'Filter: distance · trade · DBS · value',
      'Match score per job',
      'Accept → moves to My Jobs',
    ],
  },
  {
    key: 'myjobs', label: 'My Jobs', icon: ClipboardList,
    source: 'OperativePortalDemo › CONNECT › My Jobs',
    blocks: [
      'Tabs: upcoming · on site · awaiting evidence · done',
      'Job card view: scope · access · contact',
      'Date picker — syncs to FM scheduling',
      'Mirrors into main Cadi scheduler',
    ],
  },
  {
    key: 'completion', label: 'Complete on site', icon: Camera,
    source: 'NEW · build (uses staff-app camera pattern)',
    blocks: [
      'Check-in (geo + time)',
      'Task checklist from job card',
      'Photo upload (before / after)',
      'Sign-off + submit to FM approval',
    ],
  },
  {
    key: 'invoicing', label: 'Invoicing', icon: Receipt,
    source: 'OperativePortalDemo › CONNECT › Invoicing',
    blocks: [
      'Auto-drafted from approved job',
      'Edit lines · VAT · CIS if applicable',
      'Submit → lands in FM Accounts inbox',
      'Status: pending · approved · paid',
    ],
  },
  {
    key: 'earnings', label: 'Earnings', icon: PoundSterling,
    source: 'OperativePortalDemo › CONNECT › Earnings',
    blocks: [
      'Paid this month · ytd',
      'Per-FM breakdown',
      'Payment timeline · CIS deductions',
      'Export to accounting',
    ],
  },
  {
    key: 'profile', label: 'My Profile', icon: Star,
    source: 'OperativePortalDemo › CONNECT › Profile',
    blocks: [
      'Connect score + tier (Elite / Verified)',
      'Compliance docs (DBS · insurance)',
      'Contracts on file (pushed from FM)',
      'Trades · service area',
    ],
  },
];

// Flow arrows between FM and Sub — drawn under the loop diagram
const FLOWS = [
  { from: 'fm/dispatch',    to: 'sub/inbox',     label: 'Job appears in Connect tab' },
  { from: 'sub/accept',     to: 'fm/scheduling', label: 'Date syncs to FM grid' },
  { from: 'sub/complete',   to: 'fm/approval',   label: 'Evidence to approval queue' },
  { from: 'fm/approve',     to: 'sub/invoicing', label: 'Releases invoice draft' },
  { from: 'sub/invoice',    to: 'fm/accounts',   label: 'Invoice to accounts inbox' },
  { from: 'fm/pay',         to: 'sub/earnings',  label: 'Payment updates earnings' },
  { from: 'fm/contract',    to: 'sub/profile',   label: 'Contract pushed to profile' },
];

// ─────────────────────────────────────────────────────────────────────────────

function StationDot({ station, active, onClick }) {
  const Icon = station.icon;
  const isSub = station.side === 'sub';
  const color = isSub ? ORANGE : NAVY;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 92,
      }}
    >
      <div style={{
        width: 46, height: 46, borderRadius: 14,
        background: active ? color : PAPER,
        border: `1.5px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: active ? `0 4px 14px ${color}40` : 'none',
        transition: 'all 0.18s',
      }}>
        <Icon size={18} color={active ? 'white' : color} />
      </div>
      <div style={{ fontSize: 9, fontWeight: 800, color: MUTE, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {isSub ? 'SUB' : 'FM'} · {station.n}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: INK, textAlign: 'center', lineHeight: 1.25 }}>
        {station.label}
      </div>
    </button>
  );
}

function ScreenCard({ screen, side }) {
  const Icon = screen.icon;
  const color = side === 'sub' ? ORANGE : NAVY;
  const isNew = screen.source.startsWith('NEW');
  return (
    <div style={{
      background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12,
      padding: '14px 16px', position: 'relative',
      borderLeft: `3px solid ${color}`,
    }}>
      {isNew && (
        <div style={{
          position: 'absolute', top: 10, right: 12,
          fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
          color: GREEN, background: `${GREEN}12`, border: `1px solid ${GREEN}40`,
          borderRadius: 999, padding: '2px 8px',
        }}>BUILD</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon size={14} color={color} />
        <div style={{ fontWeight: 800, fontSize: 13, color: INK }}>{screen.label}</div>
      </div>
      <div style={{ fontSize: 10, color: MUTE, marginBottom: 10, fontFamily: 'ui-monospace, Menlo, monospace' }}>
        {screen.source}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {screen.blocks.map((b, i) => (
          <li key={i} style={{
            fontSize: 11, color: '#334155', lineHeight: 1.4,
            paddingLeft: 12, position: 'relative',
          }}>
            <span style={{
              position: 'absolute', left: 0, top: 7,
              width: 4, height: 4, borderRadius: '50%', background: color,
            }} />
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FmOpsExteriorWireframe() {
  const [activeStation, setActiveStation] = useState(null);

  return (
    <div style={{
      minHeight: '100vh', background: BG, padding: '32px 40px',
      fontFamily: "'Satoshi','Inter',system-ui,sans-serif", color: INK,
    }}>
      {/* Header */}
      <div style={{ maxWidth: 1280, margin: '0 auto 28px' }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: MUTE, marginBottom: 6 }}>
          BUILD WIREFRAME · v1
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>
          FM Ops Portal — Exterior / Sub-contracted
        </h1>
        <p style={{ fontSize: 14, color: MUTE, maxWidth: 760, lineHeight: 1.55, marginTop: 8 }}>
          End-to-end loop between the FM ops side and the <strong style={{ color: ORANGE }}>Cadi Connect</strong> tabs that live inside each
          subcontractor's main Cadi. Eight stations · two surfaces · one source of truth. Existing demo pieces are reused; only
          <span style={{ color: GREEN, fontWeight: 800 }}> BUILD</span> screens are net-new.
        </p>
      </div>

      {/* First contract — ACERTA real data */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 24px',
        background: `linear-gradient(135deg, ${NAVY} 0%, #1a0a00 100%)`,
        borderRadius: 18, padding: '22px 26px', color: 'white',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 220, height: 220, borderRadius: '50%', background: `radial-gradient(circle, ${ORANGE}30 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Zap size={14} color={ORANGE} />
            <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
              First production contract · real data loaded
            </div>
          </div>
          <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>
            {acerta.contract}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 16 }}>
            {acerta.client_chain} · {acerta.work_type}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            {[
              { v: acerta.site_count,          l: 'sites in scope' },
              { v: acerta.priced_site_count,   l: 'priced & ready' },
              { v: `£${acerta.monthly_value_per_visit.toLocaleString()}`, l: 'per-visit value', accent: ORANGE },
              { v: acerta.acerta_new_count,    l: 'new ACERTA sites', accent: GREEN },
              { v: acerta.closed_count,        l: 'closed · drop', accent: '#f87171' },
            ].map((x,i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: x.accent || 'white', lineHeight: 1 }}>{x.v}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginTop: 4 }}>{x.l}</div>
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55,
          }}>
            Seeded to <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.3)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>acerta-sites.json</code> —
            ingestable as Job Cards on the FM Ops side. Mix of Vauxhall · Aston Martin · Porsche · Audi · JLR · BMW · Ford · Ferrari dealerships across the UK.
          </div>
        </div>
      </div>

      {/* Britannia Connect entitlement model */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 24px',
        background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
        padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Unlock size={14} color={ORANGE} />
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: INK, textTransform: 'uppercase' }}>
            Sub onboarding model · 100–300 Britannia subs
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { icon: Upload, color: NAVY, title: '1 · Britannia bulk-uploads', body: 'FM uploads Excel of 100–300 subs into FM Ops → Contractors screen. CSV maps: company · contact · email · phone · trades · region · DBS · insurance · contract ref.' },
            { icon: Unlock, color: ORANGE, title: '2 · Free Lite + Connect unlocked', body: 'Each sub gets a free Cadi Lite account auto-provisioned. Britannia Connect tab is unlocked by default — receive jobs, complete work, invoice, see earnings. Flag: connect_unlocked_by_fm_id.' },
            { icon: Lock,   color: '#a16207', title: '3 · Rest behind Pro paywall', body: 'Run · Grow · Front Desk · Staff stay locked behind Pro £39/mo. Sub sees the rest of Cadi, can upgrade for their own business — this is the conversion wedge.' },
          ].map((c,i) => {
            const Icon = c.icon;
            return (
              <div key={i} style={{
                padding: 14, borderRadius: 10,
                border: `1px solid ${c.color}30`, background: `${c.color}06`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color="white" />
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 12, color: INK }}>{c.title}</div>
                </div>
                <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>{c.body}</div>
              </div>
            );
          })}
        </div>
        <div style={{
          marginTop: 14, padding: '11px 14px', borderRadius: 10,
          background: '#fafbff', border: `1px dashed ${LINE}`,
          fontSize: 11, color: '#475569', lineHeight: 1.55,
        }}>
          <strong style={{ color: ORANGE }}>Why it works:</strong> Britannia drives distribution at zero acquisition cost · Cadi gets 100–300 vetted, scored operatives on the network in one drop · clear path to Pro conversion through the rest of the app.
        </div>
      </div>

      {/* Top loop diagram */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 32px',
        background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
        padding: '22px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: INK, textTransform: 'uppercase' }}>
            The loop
          </div>
          <div style={{ flex: 1, height: 1, background: LINE }} />
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: MUTE }}>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: NAVY, marginRight: 6, verticalAlign: 'middle' }} />FM Ops</span>
            <span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: ORANGE, marginRight: 6, verticalAlign: 'middle' }} />Subcontractor (in their Cadi)</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
          {LOOP.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <StationDot
                station={s}
                active={activeStation === s.key}
                onClick={() => setActiveStation(activeStation === s.key ? null : s.key)}
              />
              {i < LOOP.length - 1 && (
                <ArrowRight size={14} color="#cbd5e1" style={{ flexShrink: 0, marginTop: -22 }} />
              )}
            </div>
          ))}
        </div>

        {activeStation && (() => {
          const s = LOOP.find(x => x.key === activeStation);
          return (
            <div style={{
              marginTop: 18, padding: '12px 16px', borderRadius: 10,
              background: s.side === 'sub' ? `${ORANGE}08` : `${NAVY}08`,
              border: `1px solid ${s.side === 'sub' ? ORANGE : NAVY}25`,
              fontSize: 12, color: INK,
            }}>
              <strong>{s.n}. {s.label}</strong> — {s.note}
            </div>
          );
        })()}
      </div>

      {/* Two-column wireframes */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 32px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
      }}>
        {/* FM Ops column */}
        <div style={{
          background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
          padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Building2 size={16} color={NAVY} />
            <div style={{ fontSize: 13, fontWeight: 900, color: NAVY }}>FM Ops Portal</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTE }}>(/fm-demo · exterior mode)</span>
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginBottom: 16 }}>
            What the FM ops team operates. Full control of work completion, contracts, marketplace listings.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FM_SCREENS.map(s => <ScreenCard key={s.key} screen={s} side="fm" />)}
          </div>
        </div>

        {/* Subcontractor column */}
        <div style={{
          background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
          padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Users size={16} color={ORANGE} />
            <div style={{ fontSize: 13, fontWeight: 900, color: ORANGE }}>Cadi Connect (in subcontractor's Cadi)</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: MUTE }}>(tab inside main Cadi)</span>
          </div>
          <div style={{ fontSize: 11, color: MUTE, marginBottom: 16 }}>
            How the subcontractor receives jobs, completes work, raises invoices — without leaving their own Cadi.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUB_SCREENS.map(s => <ScreenCard key={s.key} screen={s} side="sub" />)}
          </div>
        </div>
      </div>

      {/* Flow connectors table */}
      <div style={{
        maxWidth: 1280, margin: '0 auto 32px',
        background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
        padding: '20px 22px',
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: INK, textTransform: 'uppercase', marginBottom: 14 }}>
          Cross-surface data flows
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {FLOWS.map((f, i) => {
            const [fromSide, fromKey] = f.from.split('/');
            const [toSide, toKey]     = f.to.split('/');
            const fromColor = fromSide === 'sub' ? ORANGE : NAVY;
            const toColor   = toSide   === 'sub' ? ORANGE : NAVY;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10,
                border: `1px solid ${LINE}`, background: '#fafbff',
              }}>
                <span style={{
                  fontSize: 10, fontWeight: 900, color: fromColor,
                  padding: '3px 8px', borderRadius: 6,
                  background: `${fromColor}10`, border: `1px solid ${fromColor}25`,
                  whiteSpace: 'nowrap',
                }}>{fromSide.toUpperCase()} · {fromKey}</span>
                <ArrowRight size={12} color={MUTE} style={{ flexShrink: 0 }} />
                <span style={{
                  fontSize: 10, fontWeight: 900, color: toColor,
                  padding: '3px 8px', borderRadius: 6,
                  background: `${toColor}10`, border: `1px solid ${toColor}25`,
                  whiteSpace: 'nowrap',
                }}>{toSide.toUpperCase()} · {toKey}</span>
                <span style={{ fontSize: 11, color: '#334155', flex: 1 }}>{f.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Build status */}
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        background: PAPER, borderRadius: 18, border: `1px solid ${LINE}`,
        padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertTriangle size={14} color={GREEN} />
          <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.12em', color: INK, textTransform: 'uppercase' }}>
            Build gaps · what's net-new vs reuse
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: '#fafbff' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: NAVY, marginBottom: 8 }}>Reuse as-is</div>
            <ul style={{ fontSize: 11, color: '#334155', paddingLeft: 16, margin: 0, lineHeight: 1.65 }}>
              <li>FmSubPool · contractors list</li>
              <li>FmExteriorScheduling · week grid</li>
              <li>FmAccounts · invoice inbox</li>
              <li>ConnectPortalHome · sub home</li>
              <li>OperativePortalDemo CONNECT tabs</li>
            </ul>
          </div>
          <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${LINE}`, background: '#fafbff' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#a16207', marginBottom: 8 }}>Refactor &amp; wire</div>
            <ul style={{ fontSize: 11, color: '#334155', paddingLeft: 16, margin: 0, lineHeight: 1.65 }}>
              <li>FmQuoteManagement → real job card model</li>
              <li>FmJobApprovals → evidence review queue</li>
              <li>FmExteriorLive → live status feed</li>
              <li>Sub My Jobs → mirror into main scheduler</li>
              <li>Invoicing → auto-draft on approve</li>
            </ul>
          </div>
          <div style={{ padding: 14, borderRadius: 10, border: `1px solid ${GREEN}40`, background: `${GREEN}08` }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: GREEN, marginBottom: 8 }}>BUILD (net-new)</div>
            <ul style={{ fontSize: 11, color: '#334155', paddingLeft: 16, margin: 0, lineHeight: 1.65 }}>
              <li>Contracts upload + push to sub</li>
              <li>Marketplace publish (FM side)</li>
              <li>Sub on-site completion screen</li>
              <li>Cross-surface job state model</li>
              <li>Payment ↔ earnings link</li>
            </ul>
          </div>
        </div>

        <div style={{
          marginTop: 18, padding: '12px 14px', borderRadius: 10,
          background: `${NAVY}06`, border: `1px solid ${NAVY}20`,
          fontSize: 11, color: '#334155', lineHeight: 1.55,
        }}>
          <strong style={{ color: NAVY }}>Next step:</strong> pick one station from the loop above and spec the data contract
          (Supabase tables + edge function). Recommend starting at <strong>Station 3 — Inbox / marketplace</strong>: it's
          the surface that proves the cross-app sync between FM Ops and a sub's main Cadi.
        </div>
      </div>
    </div>
  );
}
