import { useState } from 'react';
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Users,
  Send,
  Calendar,
  CheckCircle2,
  Receipt,
  ChevronRight,
  Plus,
  Search,
  Filter,
  Upload,
  Download,
  MoreHorizontal,
  MapPin,
  Camera,
  AlertCircle,
  PoundSterling,
  Star,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// FM Ops Portal — generic build wireframe
// Reusable across any FM contract. Data model derived from real client spec
// (chain → sites → cost-per-visit + 1..N visit specs/frequencies).
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = '#010a4f';
const INK = '#0f172a';
const MUTE = '#94a3b8';
const SUB = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f1f5f9';
const PAPER = '#ffffff';
const BG = '#f8faff';
const ACCENT = '#C2410C'; // exterior orange
const GREEN = '#16a34a';

// ── Screens ──
const SCREENS = [
  { key: 'dash', label: 'Overview', icon: LayoutDashboard },
  { key: 'contracts', label: 'Contracts', icon: FileText },
  { key: 'sites', label: 'Sites / Job Cards', icon: ClipboardList },
  { key: 'contractors', label: 'Contractors', icon: Users },
  { key: 'marketplace', label: 'Marketplace', icon: Send },
  { key: 'schedule', label: 'Schedule', icon: Calendar },
  { key: 'approval', label: 'Work approval', icon: CheckCircle2 },
  { key: 'accounts', label: 'Accounts inbox', icon: Receipt },
];

// ─────────────────────────────────────────────────────────────────────────────
// Reusable wireframe primitives
// ─────────────────────────────────────────────────────────────────────────────

function Box({ children, h, w, dashed, soft, style }) {
  return (
    <div
      style={{
        border: `${dashed ? '1.5px dashed' : '1px solid'} ${LINE}`,
        borderRadius: 8,
        background: soft ? SOFT : PAPER,
        height: h,
        width: w,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: MUTE,
        fontSize: 11,
        fontFamily: 'ui-monospace,Menlo,monospace',
        padding: '8px 12px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Stub({ label, h = 60, w, accent, style }) {
  return (
    <div
      style={{
        border: `1.5px dashed ${LINE}`,
        borderRadius: 8,
        background: SOFT,
        height: h,
        width: w,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 4,
        color: SUB,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'ui-monospace,Menlo,monospace',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {accent && <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent }} />}
      {label}
    </div>
  );
}

function ScreenHeader({ title, subtitle, primaryAction }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: 20,
        paddingBottom: 14,
        borderBottom: `1px solid ${LINE}`,
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {primaryAction && (
        <button
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Plus size={12} /> {primaryAction}
        </button>
      )}
    </div>
  );
}

function Toolbar({ tabs, active }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: '6px 10px',
          flex: 1,
          maxWidth: 320,
        }}
      >
        <Search size={12} color={MUTE} />
        <span style={{ fontSize: 11, color: MUTE }}>Search…</span>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: 4,
        }}
      >
        {tabs.map((t, i) => (
          <span
            key={t}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '5px 10px',
              borderRadius: 6,
              background: active === i ? `${ACCENT}12` : 'transparent',
              color: active === i ? ACCENT : SUB,
            }}
          >
            {t}
          </span>
        ))}
      </div>
      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: SUB,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: '6px 10px',
          cursor: 'pointer',
        }}
      >
        <Filter size={11} /> Filter
      </button>
    </div>
  );
}

function Annot({ children }) {
  return (
    <div
      style={{
        marginTop: 24,
        padding: '12px 14px',
        borderRadius: 10,
        background: `${NAVY}06`,
        border: `1px solid ${NAVY}18`,
        fontSize: 11,
        color: '#334155',
        lineHeight: 1.6,
      }}
    >
      <strong
        style={{ color: NAVY, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}
      >
        Notes ·&nbsp;
      </strong>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screens
// ─────────────────────────────────────────────────────────────────────────────

function Dash() {
  const KPIS = [
    { l: 'Active contracts', v: '{{n}}' },
    { l: 'Sites in scope', v: '{{n}}' },
    { l: 'Jobs this week', v: '{{n}}' },
    { l: 'Awaiting approval', v: '{{n}}', accent: ACCENT },
    { l: 'Invoices due', v: '£{{x}}' },
    { l: 'Active sub-contractors', v: '{{n}}' },
  ];
  return (
    <div>
      <ScreenHeader
        title="Overview"
        subtitle="At-a-glance status across every FM contract in the portal."
      />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}
      >
        {KPIS.map((k) => (
          <div
            key={k.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: k.accent || INK, lineHeight: 1 }}>
              {k.v}
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{k.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Stub label="WEEK SCHEDULE · all sites · all contracts" h={220} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Stub label="ACTION QUEUE · awaiting your review" h={100} accent={ACCENT} />
          <Stub label="SUB ACTIVITY · last 24h" h={110} />
        </div>
      </div>
      <Annot>
        One-screen ops view. KPIs roll up across every contract; action queue is the only place that
        ever needs a click — everything else is monitoring.
      </Annot>
    </div>
  );
}

function Stepper({ step, steps, onStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 20 }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        const color = done ? GREEN : active ? ACCENT : SUB;
        return (
          <div
            key={s}
            style={{ display: 'flex', alignItems: 'center', flex: i === steps.length - 1 ? 0 : 1 }}
          >
            <button
              onClick={() => onStep(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: active ? color : done ? `${color}15` : SOFT,
                  border: `1.5px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 900,
                  color: active ? 'white' : color,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? INK : SUB }}
              >
                {s}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                style={{ flex: 1, height: 1, background: done ? GREEN : LINE, margin: '0 12px' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ContractsList({ onNew }) {
  return (
    <>
      <ScreenHeader
        title="Contracts"
        subtitle="One FM client contract per row. Each contains N sites and an allocated contractor network."
        primaryAction="New contract"
      />
      <Toolbar tabs={['Active', 'Mobilising', 'Paused', 'All']} active={0} />
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 40px',
            padding: '10px 14px',
            background: SOFT,
            borderBottom: `1px solid ${LINE}`,
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <div>Contract</div>
          <div>Sites</div>
          <div>Frequency mix</div>
          <div>Per-visit value</div>
          <div>Active subs</div>
          <div></div>
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            onClick={onNew}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 40px',
              padding: '14px',
              borderBottom: i < 3 ? `1px solid ${LINE}` : 'none',
              alignItems: 'center',
              fontSize: 12,
              color: INK,
              cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontWeight: 800 }}>{`{{Contract ${i}}}`}</div>
              <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>
                Chain · region · started DD/MM/YY
              </div>
            </div>
            <div style={{ color: SUB }}>{`{{n}} sites`}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['Mthly', '2-wk', 'Qtrly'].map((t) => (
                <span
                  key={t}
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: SOFT,
                    color: SUB,
                    fontWeight: 700,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div style={{ fontWeight: 800 }}>£{`{{x}}`}</div>
            <div style={{ color: SUB }}>{`{{n}}`}</div>
            <MoreHorizontal size={14} color={MUTE} />
          </div>
        ))}
      </div>
      <button
        onClick={onNew}
        style={{
          marginTop: 14,
          width: '100%',
          padding: '14px',
          border: `1.5px dashed ${ACCENT}50`,
          background: `${ACCENT}06`,
          borderRadius: 10,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: ACCENT,
          fontWeight: 800,
          fontSize: 13,
        }}
      >
        <Plus size={14} /> New contract — upload site list to begin
      </button>
      <Annot>
        Data shape per contract:{' '}
        <code>{`{ chain, sites[], allocations[], marketplace_listings[], billing_terms, compliance }`}</code>
        . Frequency mix derived from each site's visit specs — every site can have 1..N specs (e.g.
        monthly + quarterly high-level).
      </Annot>
    </>
  );
}

function StepUpload({ onNext }) {
  return (
    <>
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          <div>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              FM client / chain
            </label>
            <Box
              h={36}
              style={{ marginTop: 4, justifyContent: 'flex-start' }}
            >{`{{ Client name }}`}</Box>
          </div>
          <div>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Contract reference
            </label>
            <Box
              h={36}
              style={{ marginTop: 4, justifyContent: 'flex-start' }}
            >{`{{ e.g. ACERTA JUNE 26 }}`}</Box>
          </div>
          <div>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Work type
            </label>
            <Box
              h={36}
              style={{ marginTop: 4, justifyContent: 'flex-start' }}
            >{`{{ Exterior · Interior · Specialist }}`}</Box>
          </div>
          <div>
            <label
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              Start date
            </label>
            <Box
              h={36}
              style={{ marginTop: 4, justifyContent: 'flex-start' }}
            >{`DD / MM / YYYY`}</Box>
          </div>
        </div>
      </div>

      <div
        style={{
          background: PAPER,
          border: `2px dashed ${ACCENT}55`,
          borderRadius: 12,
          padding: 28,
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: `${ACCENT}10`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
          }}
        >
          <Upload size={20} color={ACCENT} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>
          Drop the FM's site list (CSV / Excel)
        </div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 12 }}>
          Site name · cost per visit · visit specs (1–N) · notes — any column order, Cadi maps it.
        </div>
        <button
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Choose file
        </button>
        <div style={{ fontSize: 10, color: MUTE, marginTop: 10 }}>
          Or paste a Google Sheet link · or{' '}
          <span style={{ color: ACCENT, fontWeight: 700 }}>download template</span>
        </div>
      </div>

      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Column mapping · preview after upload
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            ['Their column', 'Cadi field'],
            ['Car Dealership Name', 'site.name'],
            ['Cost Per Clean', 'site.price_per_visit'],
            ['Specification 1', 'spec[0]'],
            ['Specification 2', 'spec[1]'],
            ['Specification 3', 'spec[2]'],
            ['NOTES', 'site.notes (closed flag detected)'],
          ].flatMap((row, i) => [
            <div
              key={`a${i}`}
              style={{
                fontSize: 11,
                color: i === 0 ? SUB : INK,
                fontWeight: i === 0 ? 800 : 600,
                padding: '6px 0',
              }}
            >
              {row[0]}
            </div>,
            <div
              key={`b${i}`}
              style={{
                fontSize: 11,
                color: i === 0 ? SUB : ACCENT,
                fontWeight: i === 0 ? 800 : 700,
                padding: '6px 0',
                fontFamily: i === 0 ? 'inherit' : 'ui-monospace,Menlo,monospace',
              }}
            >
              → {row[1]}
            </div>,
          ])}
        </div>
      </div>

      <Annot>
        Importer is shape-agnostic — sniffs columns and lets the user remap. Notes column
        auto-detects "closed" / "ceased" keywords to flag drop-sites. Multi-spec rows ingest as 1
        site with N visit specs.
      </Annot>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
        <button
          onClick={onNext}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Continue → allocate sites
        </button>
      </div>
    </>
  );
}

// Region-first sample data — sites and subs both grouped by region
const REGIONS = [
  {
    key: 'mid',
    name: 'Midlands',
    color: '#7c3aed',
    sites: [
      {
        id: 1,
        name: '{{Site · Birmingham 1}}',
        town: 'Birmingham · B1',
        price: '{{x}}',
        specs: ['Monthly · low-level', 'Quarterly · high-level'],
      },
      {
        id: 2,
        name: '{{Site · Wolverhampton}}',
        town: 'Wolverhampton · WV1',
        price: '{{x}}',
        specs: ['Monthly · low-level'],
      },
      {
        id: 3,
        name: '{{Site · Derby}}',
        town: 'Derby · DE1',
        price: '{{x}}',
        specs: ['Monthly · low-level', 'Quarterly · high-level'],
      },
    ],
    subs: [
      { id: 'B', name: '{{Sub Co. B}}', capacity: 18, score: 88 },
      { id: 'D', name: '{{Sub Co. D}}', capacity: 9, score: 82 },
    ],
  },
  {
    key: 'beds',
    name: 'Bedfordshire & Bucks',
    color: NAVY,
    sites: [
      {
        id: 4,
        name: '{{Site · Bedford}}',
        town: 'Bedford · MK40',
        price: '{{x}}',
        specs: ['Monthly · low-level'],
      },
      {
        id: 5,
        name: '{{Site · Milton Keynes}}',
        town: 'MK · MK9',
        price: '{{x}}',
        specs: ['Monthly · low-level', 'Quarterly · high-level'],
      },
    ],
    subs: [{ id: 'A', name: '{{Sub Co. A}}', capacity: 12, score: 94 }],
  },
  {
    key: 'lon',
    name: 'London',
    color: GREEN,
    sites: [
      {
        id: 6,
        name: '{{Site · Mayfair}}',
        town: 'London · W1',
        price: '{{x}}',
        specs: ['Monthly · low-level', 'Quarterly · high-level', 'Fortnightly · cladding'],
      },
      {
        id: 7,
        name: '{{Site · Tottenham}}',
        town: 'London · N17',
        price: '{{x}}',
        specs: ['Monthly · low-level'],
      },
    ],
    subs: [
      { id: 'C', name: '{{Sub Co. C}}', capacity: 6, score: 91 },
      { id: 'C2', name: '{{Sub Co. E}}', capacity: 4, score: 86 },
    ],
  },
  {
    key: 'sw',
    name: 'South West',
    color: '#0891b2',
    sites: [
      {
        id: 8,
        name: '{{Site · Cardiff}}',
        town: 'Cardiff · CF10',
        price: '{{x}}',
        specs: ['Monthly · low-level'],
      },
    ],
    subs: [], // no sub in this region → defaults to marketplace
  },
];

function RegionCard({ region, allocations, setAllocations }) {
  const siteIds = region.sites.map((s) => s.id);
  const allocCounts = siteIds.reduce(
    (acc, id) => {
      const a = allocations[id];
      if (!a) acc.unassigned++;
      else if (a === 'M') acc.market++;
      else acc.pool++;
      return acc;
    },
    { pool: 0, market: 0, unassigned: 0 }
  );

  const hasSubs = region.subs.length > 0;
  const allToSub = (subId) => {
    const next = { ...allocations };
    siteIds.forEach((id) => {
      next[id] = subId;
    });
    setAllocations(next);
  };

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginBottom: 14,
        overflow: 'hidden',
      }}
    >
      {/* Region header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: `${region.color}06`,
          borderBottom: `1px solid ${region.color}20`,
          borderLeft: `4px solid ${region.color}`,
        }}
      >
        <MapPin size={14} color={region.color} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>{region.name}</div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
            {region.sites.length} site{region.sites.length === 1 ? '' : 's'} · {region.subs.length}{' '}
            sub{region.subs.length === 1 ? '' : 's'} available
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: GREEN,
              background: `${GREEN}12`,
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            {allocCounts.pool} network
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: ACCENT,
              background: `${ACCENT}12`,
              padding: '3px 8px',
              borderRadius: 999,
            }}
          >
            {allocCounts.market} market
          </span>
          {allocCounts.unassigned > 0 && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: '#a16207',
                background: '#fef3c7',
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {allocCounts.unassigned} unassigned
            </span>
          )}
        </div>
      </div>

      {/* Two-column body: sites left, subs right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', minHeight: 100 }}>
        {/* Sites */}
        <div style={{ padding: '12px 16px', borderRight: `1px solid ${LINE}` }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Sites in scope
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {region.sites.map((site) => {
              const current = allocations[site.id];
              const isMkt = current === 'M';
              const assignedSub = region.subs.find((s) => s.id === current);
              return (
                <div
                  key={site.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: isMkt ? `${ACCENT}06` : assignedSub ? `${GREEN}06` : '#fafbff',
                    border: `1px solid ${isMkt ? `${ACCENT}25` : assignedSub ? `${GREEN}25` : LINE}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>{site.name}</div>
                    <div style={{ fontSize: 9, color: MUTE, marginTop: 1 }}>
                      {site.town} · £{site.price}/visit · {site.specs.length} spec
                      {site.specs.length === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {current ? (
                      <>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: isMkt ? ACCENT : GREEN,
                            background: isMkt ? `${ACCENT}15` : `${GREEN}15`,
                            padding: '3px 8px',
                            borderRadius: 999,
                          }}
                        >
                          {isMkt ? '→ Marketplace' : `→ ${assignedSub?.name || current}`}
                        </span>
                        <button
                          onClick={() => setAllocations({ ...allocations, [site.id]: null })}
                          style={{
                            fontSize: 11,
                            color: MUTE,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#a16207',
                          background: '#fef3c7',
                          padding: '3px 8px',
                          borderRadius: 999,
                        }}
                      >
                        unassigned
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Subs panel — region-filtered */}
        <div style={{ padding: '12px 16px', background: '#fafbff' }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Allocate to · {hasSubs ? 'subs in this region' : 'no subs — marketplace only'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {region.subs.map((sub) => (
              <button
                key={sub.id}
                onClick={() => allToSub(sub.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: PAPER,
                  border: `1px solid ${LINE}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = region.color;
                  e.currentTarget.style.background = `${region.color}08`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = LINE;
                  e.currentTarget.style.background = PAPER;
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: `${region.color}15`,
                    color: region.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {sub.id}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>{sub.name}</div>
                  <div style={{ fontSize: 9, color: SUB, marginTop: 1 }}>
                    Cap {sub.capacity} · score {sub.score}
                  </div>
                </div>
                <ChevronRight size={11} color={MUTE} />
              </button>
            ))}
            <button
              onClick={() => allToSub('M')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: `${ACCENT}06`,
                border: `1px dashed ${ACCENT}40`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: `${ACCENT}15`,
                  color: ACCENT,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={11} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>
                  Send region to marketplace
                </div>
                <div style={{ fontSize: 9, color: SUB, marginTop: 1 }}>
                  Network bids — any verified sub in region
                </div>
              </div>
            </button>
          </div>
          {hasSubs && (
            <div style={{ marginTop: 8, fontSize: 9, color: MUTE, fontStyle: 'italic' }}>
              Click a sub to allocate all {region.sites.length} sites · or pick per-site on the left
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepAllocate({ onNext, onBack, allocations, setAllocations }) {
  const allSiteIds = REGIONS.flatMap((r) => r.sites.map((s) => s.id));
  const summary = allSiteIds.reduce(
    (acc, id) => {
      const a = allocations[id];
      if (!a) acc.unassigned++;
      else if (a === 'M') acc.market++;
      else acc.pool++;
      return acc;
    },
    { pool: 0, market: 0, unassigned: 0 }
  );

  const autoAllocate = () => {
    const next = { ...allocations };
    REGIONS.forEach((r) => {
      r.sites.forEach((site) => {
        if (!next[site.id]) next[site.id] = r.subs[0]?.id || 'M';
      });
    });
    setAllocations(next);
  };
  const pushUnassignedToMkt = () => {
    const next = { ...allocations };
    allSiteIds.forEach((id) => {
      if (!next[id]) next[id] = 'M';
    });
    setAllocations(next);
  };
  const clearAll = () => {
    const next = {};
    allSiteIds.forEach((id) => {
      next[id] = null;
    });
    setAllocations(next);
  };

  return (
    <>
      {/* Summary KPIs */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Total sites', v: allSiteIds.length, c: INK },
          { l: 'Allocated to network', v: summary.pool, c: GREEN },
          { l: 'To marketplace', v: summary.market, c: ACCENT },
          { l: 'Unassigned', v: summary.unassigned, c: summary.unassigned ? '#a16207' : MUTE },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Bulk actions */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>Bulk ·</span>
        <button
          onClick={autoAllocate}
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: NAVY,
            background: `${NAVY}08`,
            border: `1px solid ${NAVY}25`,
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Auto-allocate by region
        </button>
        <button
          onClick={pushUnassignedToMkt}
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: ACCENT,
            background: `${ACCENT}08`,
            border: `1px solid ${ACCENT}30`,
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Send unassigned → marketplace
        </button>
        <button
          onClick={clearAll}
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Clear all
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: MUTE }}>
          Grouped by region · contractors filtered to each region's network
        </span>
      </div>

      {/* Region cards */}
      {REGIONS.map((r) => (
        <RegionCard
          key={r.key}
          region={r}
          allocations={allocations}
          setAllocations={setAllocations}
        />
      ))}

      <Annot>
        Sites and subs are <strong>both grouped by region</strong> so the right answer is visually
        obvious — each region card shows its sites on the left, and only the subs who cover that
        region on the right. One click on a sub allocates every site in that region; per-site
        override on the left. Regions with no sub in your network surface a clear "marketplace only"
        route.
      </Annot>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: PAPER,
            color: SUB,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← Back to upload
        </button>
        <button
          onClick={onNext}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Continue → publish marketplace listings
        </button>
      </div>
    </>
  );
}

function StepPublish({ onNext, onBack, allocations }) {
  const mktSites = Object.entries(allocations)
    .filter(([_, v]) => v === 'M')
    .map(([k]) => k);
  return (
    <>
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: INK, marginBottom: 4 }}>
          {mktSites.length || '{{n}}'} sites going to marketplace
        </div>
        <div style={{ fontSize: 11, color: SUB }}>
          Set how each listing is exposed to the network. Direct-allocated sites skip this step —
          they're already dispatched.
        </div>
      </div>

      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Listing defaults · apply to all
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            {
              l: 'Visibility',
              opts: ['Your network only', 'Invite list', 'Open marketplace'],
              active: 2,
            },
            { l: 'Bid window', opts: ['24h', '72h', '7 days'], active: 1 },
            { l: 'Award rule', opts: ['Lowest bid', 'Best fit (auto)', 'Manual'], active: 1 },
          ].map((g) => (
            <div key={g.l}>
              <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginBottom: 6 }}>
                {g.l}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.opts.map((o, i) => (
                  <span
                    key={o}
                    style={{
                      fontSize: 11,
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: `1px solid ${i === g.active ? ACCENT : LINE}`,
                      background: i === g.active ? `${ACCENT}10` : PAPER,
                      color: i === g.active ? ACCENT : INK,
                      fontWeight: i === g.active ? 800 : 600,
                      cursor: 'pointer',
                    }}
                  >
                    {o}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1fr',
            padding: '10px 14px',
            background: SOFT,
            borderBottom: `1px solid ${LINE}`,
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <div>Site listing</div>
          <div>Floor price</div>
          <div>Visibility</div>
          <div>Window</div>
          <div>Reach</div>
        </div>
        {(mktSites.length ? mktSites : ['1', '2']).map((i, idx) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 1fr 1fr',
              padding: '12px 14px',
              borderBottom: idx < 2 ? `1px solid ${LINE}` : 'none',
              alignItems: 'center',
              fontSize: 11,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: INK }}>{`{{Site ${i}}}`}</div>
              <div style={{ fontSize: 10, color: MUTE, marginTop: 1 }}>
                Monthly · low-level{idx % 2 === 0 ? ' + Quarterly · high-level' : ''}
              </div>
            </div>
            <div style={{ fontWeight: 800, color: INK }}>£{`{{x}}`}</div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: ACCENT,
                background: `${ACCENT}10`,
                padding: '3px 8px',
                borderRadius: 999,
                alignSelf: 'flex-start',
              }}
            >
              Open to network
            </span>
            <span style={{ color: SUB }}>72h</span>
            <span style={{ color: NAVY, fontWeight: 800 }}>{`~${30 + idx * 8}`} subs</span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: `${ACCENT}06`,
          border: `1px solid ${ACCENT}25`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AlertCircle size={16} color={ACCENT} />
        <div style={{ flex: 1, fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
          <strong>Listings will appear instantly</strong> in matched subs' Cadi Connect tabs
          (Marketplace + Inbox alert). Awarded jobs auto-dispatch and land in the sub's My Jobs.
        </div>
      </div>

      <Annot>
        Publish writes <code>marketplace_listings[]</code> records linked to the contract. Awarding
        flips a listing into a <code>job_card</code> with the winning sub assigned — same model as
        direct-allocated sites from step 2.
      </Annot>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: PAPER,
            color: SUB,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ← Back to allocate
        </button>
        <button
          onClick={onNext}
          style={{
            background: GREEN,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Publish &amp; activate contract ✓
        </button>
      </div>
    </>
  );
}

function Contracts() {
  const [step, setStep] = useState(-1); // -1 = list view
  const [allocations, setAllocations] = useState({
    1: 'A',
    2: 'M',
    3: 'B',
    4: null,
    5: 'M',
    6: 'C',
  });
  const STEPS = ['Upload site list', 'Allocate to network', 'Marketplace listings'];

  if (step === -1)
    return (
      <div>
        <ContractsList onNew={() => setStep(0)} />
      </div>
    );

  return (
    <div>
      <ScreenHeader
        title="New contract"
        subtitle="Upload the FM's site list, allocate to your contractor network, publish the rest to marketplace."
      />
      <Stepper step={step} steps={STEPS} onStep={setStep} />
      {step === 0 && <StepUpload onNext={() => setStep(1)} />}
      {step === 1 && (
        <StepAllocate
          onNext={() => setStep(2)}
          onBack={() => setStep(0)}
          allocations={allocations}
          setAllocations={setAllocations}
        />
      )}
      {step === 2 && (
        <StepPublish
          onNext={() => setStep(-1)}
          onBack={() => setStep(1)}
          allocations={allocations}
        />
      )}
    </div>
  );
}

const SAMPLE_SITES = [
  {
    id: 1,
    name: '{{Stratstone JLR Nottingham}}',
    town: 'Nottingham · NG2',
    region: 'Midlands',
    contract: '{{ACERTA June 26}}',
    sub: '{{Sub Co. B}}',
    subId: 'B',
    price: 200,
    status: 'active',
    nextVisit: '02 Jul',
    lastVisit: '04 Jun',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'Service yard · gate code 4471',
        duration: '4h',
      },
      {
        freq: 'Quarterly',
        scope: 'high-level internal',
        access: 'Out-of-hours · 18:00–22:00',
        duration: '6h',
      },
    ],
    history: [
      { date: '04 Jun', spec: 'Monthly', sub: 'Sub B', status: 'approved', amount: 200 },
      { date: '04 May', spec: 'Monthly', sub: 'Sub B', status: 'approved', amount: 200 },
      { date: '03 Apr', spec: 'Monthly', sub: 'Sub B', status: 'approved', amount: 200 },
    ],
  },
  {
    id: 2,
    name: '{{Vauxhall Bedford}}',
    town: 'Bedford · MK42',
    region: 'Bedfordshire & Bucks',
    contract: '{{ACERTA June 26}}',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    price: 45,
    status: 'active',
    nextVisit: '15 Jul',
    lastVisit: '12 Jun',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'Front showroom · key holder Mon-Sat',
        duration: '2h',
      },
    ],
    history: [
      { date: '12 Jun', spec: 'Monthly', sub: 'Sub A', status: 'approved', amount: 45 },
      { date: '14 May', spec: 'Monthly', sub: 'Sub A', status: 'approved', amount: 45 },
    ],
  },
  {
    id: 3,
    name: '{{Porsche Nottingham}}',
    town: 'Nottingham · NG7',
    region: 'Midlands',
    contract: '{{ACERTA June 26}}',
    sub: null,
    subId: null,
    price: 300,
    status: 'marketplace',
    nextVisit: '—',
    lastVisit: '—',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'Premium site · brand standards apply',
        duration: '5h',
      },
    ],
    history: [],
  },
  {
    id: 4,
    name: '{{Aston Martin Mayfair}}',
    town: 'London · W1',
    region: 'London',
    contract: '{{ACERTA June 26}}',
    sub: '{{Sub Co. C}}',
    subId: 'C',
    price: 120,
    status: 'closed',
    nextVisit: '—',
    lastVisit: '14 Apr',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'Closed May 26 — historic record only',
        duration: '3h',
      },
    ],
    history: [{ date: '14 Apr', spec: 'Monthly', sub: 'Sub C', status: 'approved', amount: 120 }],
  },
  {
    id: 5,
    name: '{{Volvo Derby}}',
    town: 'Derby · DE21',
    region: 'Midlands',
    contract: '{{ACERTA June 26}}',
    sub: '{{Sub Co. D}}',
    subId: 'D',
    price: 70,
    status: 'awaiting-evidence',
    nextVisit: '24 Jun',
    lastVisit: 'Today',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'After 17:00 weekdays',
        duration: '3h',
      },
      {
        freq: 'Quarterly',
        scope: 'high-level internal',
        access: 'Cherry-picker access OK',
        duration: '5h',
      },
    ],
    history: [
      { date: 'Today', spec: 'Monthly', sub: 'Sub D', status: 'awaiting-evidence', amount: 70 },
      { date: '23 May', spec: 'Monthly', sub: 'Sub D', status: 'approved', amount: 70 },
    ],
  },
  {
    id: 6,
    name: '{{Audi Stockport}}',
    town: 'Stockport · SK4',
    region: 'Midlands',
    contract: '{{ACERTA June 26}}',
    sub: null,
    subId: null,
    price: 340,
    status: 'unassigned',
    nextVisit: '—',
    lastVisit: '—',
    specs: [
      {
        freq: 'Monthly',
        scope: 'in & out hand-height',
        access: 'New site — survey pending',
        duration: '5h',
      },
    ],
    history: [],
  },
];

const STATUS_CFG = {
  active: { label: 'Active', color: GREEN },
  'awaiting-evidence': { label: 'Awaiting evidence', color: ACCENT },
  marketplace: { label: 'On marketplace', color: '#7c3aed' },
  unassigned: { label: 'Unassigned', color: '#a16207' },
  closed: { label: 'Closed', color: MUTE },
};

function SiteRow({ site, onOpen, isOpen }) {
  const status = STATUS_CFG[site.status];
  return (
    <div
      onClick={() => onOpen(site.id)}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 2fr 1.4fr 1fr 1.5fr 1fr 100px',
        padding: '12px 14px',
        borderBottom: `1px solid ${LINE}`,
        alignItems: 'center',
        fontSize: 11,
        background: isOpen ? `${ACCENT}06` : PAPER,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        disabled
        style={{ accentColor: ACCENT }}
        onClick={(e) => e.stopPropagation()}
      />
      <div>
        <div style={{ fontWeight: 800, color: INK }}>{site.name}</div>
        <div style={{ fontSize: 10, color: MUTE, marginTop: 1 }}>
          {site.town} · <span style={{ fontWeight: 700 }}>{site.region}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {site.specs.map((s, i) => (
          <span
            key={i}
            style={{
              fontSize: 9,
              padding: '2px 6px',
              borderRadius: 4,
              background: SOFT,
              color: SUB,
              fontWeight: 700,
              alignSelf: 'flex-start',
            }}
          >
            {s.freq} · {s.scope}
          </span>
        ))}
      </div>
      <div style={{ fontWeight: 800, color: INK }}>£{site.price}</div>
      <div>
        {site.sub ? (
          <span style={{ fontSize: 11, color: SUB }}>{site.sub}</span>
        ) : site.status === 'marketplace' ? (
          <span style={{ fontSize: 10, fontWeight: 800, color: '#7c3aed' }}>→ marketplace</span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#a16207' }}>—</span>
        )}
      </div>
      <div
        style={{
          fontSize: 11,
          color: site.nextVisit === '—' ? MUTE : INK,
          fontWeight: site.nextVisit === '—' ? 600 : 700,
        }}
      >
        {site.nextVisit}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: status.color,
          background: `${status.color}12`,
          borderRadius: 999,
          padding: '3px 8px',
          alignSelf: 'flex-start',
        }}
      >
        {status.label}
      </span>
    </div>
  );
}

function SiteDetail({ site, onClose, tab, setTab }) {
  if (!site) return null;
  const status = STATUS_CFG[site.status];
  const TABS = ['Overview', 'Visit specs', 'Schedule', 'Job card (sub view)', 'Evidence history'];
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${status.color}08, transparent)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: status.color,
                background: `${status.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </span>
            <span style={{ fontSize: 10, color: MUTE }}>{site.contract}</span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>
            {site.name}
          </div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>
            <MapPin
              size={10}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
            />
            {site.town} · <strong>{site.region}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: ACCENT,
              background: `${ACCENT}10`,
              border: `1px solid ${ACCENT}30`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Reassign
          </button>
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          background: '#fafbff',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              fontSize: 11,
              fontWeight: tab === i ? 800 : 600,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === i ? ACCENT : SUB,
              borderBottom: tab === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab body */}
      <div style={{ padding: 20 }}>
        {tab === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Site details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr',
                  rowGap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: SUB }}>Address</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.town}</span>
                <span style={{ color: SUB }}>Region</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.region}</span>
                <span style={{ color: SUB }}>Contract</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.contract}</span>
                <span style={{ color: SUB }}>Price / visit</span>
                <span style={{ color: INK, fontWeight: 800 }}>£{site.price}</span>
                <span style={{ color: SUB }}>Specs</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.specs.length} active</span>
                <span style={{ color: SUB }}>Last visit</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.lastVisit}</span>
                <span style={{ color: SUB }}>Next visit</span>
                <span style={{ color: INK, fontWeight: 700 }}>{site.nextVisit}</span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Assigned to
              </div>
              {site.sub ? (
                <div
                  style={{
                    padding: 12,
                    background: `${GREEN}06`,
                    border: `1px solid ${GREEN}25`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: `${GREEN}20`,
                        color: GREEN,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      {site.subId}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{site.sub}</div>
                      <div style={{ fontSize: 10, color: SUB }}>{site.region}</div>
                    </div>
                  </div>
                </div>
              ) : site.status === 'marketplace' ? (
                <div
                  style={{
                    padding: 12,
                    background: `#7c3aed08`,
                    border: `1px solid #7c3aed25`,
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#5b21b6',
                  }}
                >
                  Listed on marketplace · awaiting bid
                </div>
              ) : (
                <div
                  style={{
                    padding: 12,
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: 8,
                    fontSize: 11,
                    color: '#a16207',
                  }}
                >
                  Unassigned — needs a sub or marketplace listing
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 1 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              {site.specs.length} visit spec{site.specs.length === 1 ? '' : 's'} on this site
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {site.specs.map((s, i) => (
                <div
                  key={i}
                  style={{
                    background: '#fafbff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: ACCENT,
                          background: `${ACCENT}12`,
                          padding: '2px 7px',
                          borderRadius: 999,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {s.freq}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: INK, marginLeft: 8 }}>
                        {s.scope}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: SUB }}>{s.duration} on site</span>
                  </div>
                  <div style={{ fontSize: 11, color: SUB }}>
                    <strong style={{ color: INK }}>Access:</strong> {s.access}
                  </div>
                </div>
              ))}
              <button
                style={{
                  padding: '10px 12px',
                  border: `1.5px dashed ${LINE}`,
                  background: PAPER,
                  borderRadius: 8,
                  color: SUB,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Plus size={11} /> Add visit spec
              </button>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Upcoming visits — next 90 days
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                '02 Jul · Monthly clean',
                '15 Jul · skipped (sub absent)',
                '02 Aug · Monthly clean',
                '02 Sep · Monthly clean + Quarterly high-level',
              ].map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#fafbff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 8,
                  }}
                >
                  <Calendar size={12} color={SUB} />
                  <span style={{ fontSize: 11, color: INK, flex: 1 }}>{row}</span>
                  <span style={{ fontSize: 10, color: SUB }}>{site.sub || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 3 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              What the sub sees in their Cadi Connect tab
            </div>
            <div
              style={{
                maxWidth: 380,
                margin: '0 auto',
                background: '#0f172a',
                borderRadius: 18,
                padding: 8,
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ background: '#f8faff', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: ACCENT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={10} color="white" />
                  </div>
                  <span
                    style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '0.12em' }}
                  >
                    JOB CARD · {site.contract}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>{site.name}</div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 10 }}>
                  {site.town} · {site.region}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ background: PAPER, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>£{site.price}</div>
                    <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>per visit</div>
                  </div>
                  <div style={{ background: PAPER, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>
                      {site.nextVisit}
                    </div>
                    <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>next visit</div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: SUB,
                    letterSpacing: '0.06em',
                    marginBottom: 6,
                  }}
                >
                  SCOPE
                </div>
                {site.specs.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: INK,
                      padding: '4px 0',
                      borderTop: i > 0 ? `1px solid ${LINE}` : 'none',
                    }}
                  >
                    <strong>{s.freq}</strong> · {s.scope} · {s.duration}
                  </div>
                ))}
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: SUB,
                    letterSpacing: '0.06em',
                    margin: '8px 0 4px',
                  }}
                >
                  ACCESS
                </div>
                <div style={{ fontSize: 10, color: INK }}>{site.specs[0].access}</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 4 }}>
                  <button
                    style={{
                      flex: 1,
                      background: ACCENT,
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 0',
                    }}
                  >
                    Check-in & start
                  </button>
                  <button
                    style={{
                      background: PAPER,
                      color: SUB,
                      fontSize: 10,
                      fontWeight: 700,
                      border: `1px solid ${LINE}`,
                      borderRadius: 6,
                      padding: '7px 10px',
                    }}
                  >
                    Specs
                  </button>
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 10,
                color: MUTE,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              Same data — different view. Site edits here propagate to the sub's card instantly.
            </div>
          </div>
        )}

        {tab === 4 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Past visits + evidence
            </div>
            {site.history.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  textAlign: 'center',
                  color: MUTE,
                  fontSize: 11,
                  background: '#fafbff',
                  border: `1.5px dashed ${LINE}`,
                  borderRadius: 10,
                }}
              >
                No history yet — site hasn't been visited.
              </div>
            ) : (
              <div
                style={{
                  background: PAPER,
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 100px 100px 100px',
                    padding: '8px 14px',
                    background: SOFT,
                    fontSize: 9,
                    fontWeight: 800,
                    color: SUB,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  <div>Date</div>
                  <div>Spec</div>
                  <div>Sub</div>
                  <div>Status</div>
                  <div>Amount</div>
                </div>
                {site.history.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 100px 100px 100px',
                      padding: '10px 14px',
                      borderTop: `1px solid ${SOFT}`,
                      fontSize: 11,
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ color: INK, fontWeight: 700 }}>{h.date}</span>
                    <span style={{ color: SUB }}>{h.spec}</span>
                    <span style={{ color: SUB }}>{h.sub}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: h.status === 'approved' ? GREEN : ACCENT,
                        background: h.status === 'approved' ? `${GREEN}12` : `${ACCENT}12`,
                        padding: '3px 8px',
                        borderRadius: 999,
                        justifySelf: 'flex-start',
                      }}
                    >
                      {h.status}
                    </span>
                    <span style={{ color: INK, fontWeight: 800 }}>£{h.amount}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Sites() {
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const sites = SAMPLE_SITES.filter(
    (s) =>
      (statusFilter === 'all' || s.status === statusFilter) &&
      (regionFilter === 'all' || s.region === regionFilter)
  );

  const STATUS_TABS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'awaiting-evidence', label: 'Awaiting evidence' },
    { id: 'marketplace', label: 'On marketplace' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'closed', label: 'Closed' },
  ];
  const REGIONS_LIST = ['all', ...Array.from(new Set(SAMPLE_SITES.map((s) => s.region)))];
  const openSite = sites.find((s) => s.id === openId);

  const totalSpecs = sites.reduce((a, s) => a + s.specs.length, 0);
  const totalValue = sites.filter((s) => s.status !== 'closed').reduce((a, s) => a + s.price, 0);

  return (
    <div>
      <ScreenHeader
        title="Sites / Job Cards"
        subtitle="One row per site. Click any row to open it — visit specs, schedule, the job card your sub sees, and evidence history."
        primaryAction="Add site"
      />

      {/* Summary */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Sites in view', v: sites.length, c: INK },
          { l: 'Active visit specs', v: totalSpecs, c: NAVY },
          { l: 'Per-visit value', v: `£${totalValue}`, c: ACCENT },
          {
            l: 'Sites needing action',
            v: sites.filter((s) => ['awaiting-evidence', 'unassigned'].includes(s.status)).length,
            c: '#a16207',
          },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Filters + bulk */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <button
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: ACCENT,
            background: `${ACCENT}10`,
            border: `1px solid ${ACCENT}30`,
            borderRadius: 8,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Upload size={11} /> Import sites
        </button>
        <button
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SUB,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Download size={11} /> Export
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '4px 4px 4px 10px',
          }}
        >
          <span style={{ fontSize: 10, color: SUB, fontWeight: 700 }}>Region:</span>
          {REGIONS_LIST.map((r) => (
            <button
              key={r}
              onClick={() => setRegionFilter(r)}
              style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 5,
                background: regionFilter === r ? `${NAVY}10` : 'transparent',
                color: regionFilter === r ? NAVY : SUB,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {r === 'all' ? 'All' : r}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: MUTE }}>Click any row → opens job card</span>
      </div>

      {/* Status tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: 4,
          alignItems: 'center',
        }}
      >
        {STATUS_TABS.map((t) => {
          const count =
            t.id === 'all'
              ? SAMPLE_SITES.length
              : SAMPLE_SITES.filter((s) => s.status === t.id).length;
          const isActive = statusFilter === t.id;
          const cfg = STATUS_CFG[t.id];
          const color = isActive ? cfg?.color || ACCENT : SUB;
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                padding: '6px 10px',
                borderRadius: 6,
                background: isActive ? `${color}10` : 'transparent',
                color,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 9,
                  color: isActive ? color : MUTE,
                  background: isActive ? `${color}15` : SOFT,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '40px 2fr 1.4fr 1fr 1.5fr 1fr 100px',
            padding: '10px 14px',
            background: SOFT,
            borderBottom: `1px solid ${LINE}`,
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <div></div>
          <div>Site</div>
          <div>Visit specs</div>
          <div>£ / visit</div>
          <div>Assigned</div>
          <div>Next visit</div>
          <div>Status</div>
        </div>
        {sites.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: MUTE, fontSize: 12 }}>
            No sites match the current filters.
          </div>
        ) : (
          sites.map((s) => (
            <SiteRow
              key={s.id}
              site={s}
              onOpen={(id) => {
                setOpenId(id === openId ? null : id);
                setTab(0);
              }}
              isOpen={openId === s.id}
            />
          ))
        )}
      </div>

      {/* Detail panel */}
      {openSite && (
        <SiteDetail site={openSite} onClose={() => setOpenId(null)} tab={tab} setTab={setTab} />
      )}

      <Annot>
        Site model:{' '}
        <code>{`{ name, address, region, contract_id, price_per_visit, specs: [{ frequency, scope, access_notes, duration }], assigned_sub_id, status, history[] }`}</code>
        . Status drives the workflow: <strong>Active</strong> (running clean) →{' '}
        <strong>Awaiting evidence</strong> (sub completed, FM to review) → <strong>Approved</strong>
        .<strong>Marketplace</strong> and <strong>Unassigned</strong> live alongside so coverage
        gaps are visible at a glance. Detail drawer's <em>Job card</em> tab previews the exact view
        the sub sees in their Cadi — same data, no extra editing surface.
      </Annot>
    </div>
  );
}

const CONTRACTOR_REGIONS = [
  {
    name: 'Midlands',
    color: '#7c3aed',
    sites: 14,
    subs: [
      {
        id: 'B',
        name: '{{Sub Co. B}}',
        contact: '{{Jay Patel}}',
        email: 'ops@subco-b.example',
        phone: '07700 900 000',
        trades: ['Ext', 'High'],
        score: 88,
        capacity: 18,
        dbs: true,
        ins: true,
        rams: true,
        activeSites: 5,
        jobsDone: 47,
        onTime: 94,
        vat: 'VAT-reg',
        cis: false,
        invited: '{{12 Feb}}',
        firstJob: '{{14 Feb}}',
      },
      {
        id: 'D',
        name: '{{Sub Co. D}}',
        contact: '{{R. Owen}}',
        email: 'rowen@subco-d.example',
        phone: '07700 900 001',
        trades: ['Ext'],
        score: 82,
        capacity: 9,
        dbs: true,
        ins: true,
        rams: false,
        activeSites: 3,
        jobsDone: 19,
        onTime: 88,
        vat: '—',
        cis: true,
        invited: '{{4 Mar}}',
        firstJob: '{{6 Mar}}',
      },
    ],
  },
  {
    name: 'Bedfordshire & Bucks',
    color: NAVY,
    sites: 8,
    subs: [
      {
        id: 'A',
        name: '{{Sub Co. A}}',
        contact: '{{S. Riley}}',
        email: 'sr@subco-a.example',
        phone: '07700 900 002',
        trades: ['Ext', 'Cladding'],
        score: 94,
        capacity: 12,
        dbs: true,
        ins: true,
        rams: true,
        activeSites: 6,
        jobsDone: 71,
        onTime: 97,
        vat: 'VAT-reg',
        cis: false,
        invited: '{{8 Jan}}',
        firstJob: '{{9 Jan}}',
      },
    ],
  },
  {
    name: 'London',
    color: GREEN,
    sites: 11,
    subs: [
      {
        id: 'C',
        name: '{{Sub Co. C}}',
        contact: '{{M. Allen}}',
        email: 'ma@subco-c.example',
        phone: '07700 900 003',
        trades: ['Ext', 'High'],
        score: 91,
        capacity: 6,
        dbs: true,
        ins: true,
        rams: true,
        activeSites: 4,
        jobsDone: 52,
        onTime: 95,
        vat: 'VAT-reg',
        cis: false,
        invited: '{{2 Feb}}',
        firstJob: '{{5 Feb}}',
      },
      {
        id: 'E',
        name: '{{Sub Co. E}}',
        contact: '{{P. Singh}}',
        email: 'ps@subco-e.example',
        phone: '07700 900 004',
        trades: ['Ext'],
        score: 86,
        capacity: 4,
        dbs: false,
        ins: true,
        rams: true,
        activeSites: 2,
        jobsDone: 14,
        onTime: 89,
        vat: '—',
        cis: true,
        invited: '{{21 Apr}}',
        firstJob: '—',
      },
    ],
  },
  { name: 'South West', color: '#0891b2', sites: 3, subs: [] },
];

function ContractorUploadWizard({ onClose }) {
  const [step, setStep] = useState(0);
  const STEPS = ['Upload list', 'Map columns', 'Confirm & provision'];

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: 22,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${ACCENT}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Upload size={15} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>Bulk import contractors</div>
          <div style={{ fontSize: 11, color: SUB }}>
            Drop the FM client's sub list — Cadi maps columns and provisions accounts.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 14,
            color: MUTE,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 6px',
          }}
        >
          ✕
        </button>
      </div>

      <Stepper step={step} steps={STEPS} onStep={setStep} />

      {step === 0 && (
        <>
          <div
            style={{
              background: '#fafbff',
              border: `2px dashed ${ACCENT}55`,
              borderRadius: 12,
              padding: 28,
              textAlign: 'center',
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${ACCENT}10`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}
            >
              <Upload size={20} color={ACCENT} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>
              Drop CSV / Excel of contractors
            </div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 12 }}>
              1–500 rows · company · contact · email · phone · region · trades · compliance
            </div>
            <button
              style={{
                background: ACCENT,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Choose file
            </button>
            <div style={{ fontSize: 10, color: MUTE, marginTop: 10 }}>
              or <span style={{ color: ACCENT, fontWeight: 700 }}>download template</span>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setStep(1)}
              style={{
                background: ACCENT,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Continue → map columns
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div
            style={{
              background: '#fafbff',
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Detected columns · auto-mapped
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Company', 'contractor.name'],
                ['Contact name', 'contractor.contact'],
                ['Email', 'contractor.email'],
                ['Mobile', 'contractor.phone'],
                ['Region', 'contractor.region · primary grouping'],
                ['Trades / services', 'contractor.trades[]'],
                ['DBS status', 'compliance.dbs'],
                ['PL Insurance', 'compliance.public_liability'],
                ['VAT no.', 'contractor.vat'],
                ['CIS status', 'contractor.cis'],
              ].flatMap((row, i) => [
                <div
                  key={`a${i}`}
                  style={{
                    fontSize: 11,
                    color: INK,
                    fontWeight: 700,
                    padding: '6px 0',
                    borderBottom: `1px solid ${SOFT}`,
                  }}
                >
                  {row[0]}
                </div>,
                <div
                  key={`b${i}`}
                  style={{
                    fontSize: 11,
                    color: ACCENT,
                    fontWeight: 700,
                    padding: '6px 0',
                    fontFamily: 'ui-monospace,Menlo,monospace',
                    borderBottom: `1px solid ${SOFT}`,
                  }}
                >
                  → {row[1]}
                </div>,
              ])}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(0)}
              style={{
                background: PAPER,
                color: SUB,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              style={{
                background: ACCENT,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Continue → confirm
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,1fr)',
              gap: 10,
              marginBottom: 14,
            }}
          >
            {[
              { l: 'Contractors to provision', v: '{{n}}', c: INK },
              { l: 'Auto-grouped regions', v: '{{n}}', c: NAVY },
              { l: 'Compliance gaps detected', v: '{{n}}', c: '#a16207' },
              { l: 'Already in network', v: '{{n}}', c: MUTE },
            ].map((s) => (
              <div
                key={s.l}
                style={{
                  background: '#fafbff',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, color: s.c, lineHeight: 1 }}>
                  {s.v}
                </div>
                <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              background: `${ACCENT}06`,
              border: `1px solid ${ACCENT}25`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: ACCENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={14} color="white" />
            </div>
            <div style={{ flex: 1, fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
              On confirm: SMS + email invite is sent to each contractor. They land in the region
              they were uploaded into and are allocatable immediately on your next contract.
            </div>
          </div>
          <Annot>
            Each row creates a contractor record + invite. Once they accept, they appear in the
            region card and can be assigned to sites in step 2 of New Contract.
          </Annot>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button
              onClick={() => setStep(1)}
              style={{
                background: PAPER,
                color: SUB,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <button
              onClick={onClose}
              style={{
                background: GREEN,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Provision &amp; send invites ✓
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ContractorDetail({ sub, region, onClose, tab, setTab }) {
  if (!sub) return null;
  const TABS = ['Overview', 'Compliance', 'Sites & performance', 'Activity'];

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${region.color}08, transparent)`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${region.color}15`,
            color: region.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 900,
          }}
        >
          {sub.id}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 900, color: INK }}>{sub.name}</span>
            {sub.firstJob === '—' ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#a16207',
                  background: '#fef3c7',
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                Awaiting first job
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: GREEN,
                  background: `${GREEN}15`,
                  padding: '3px 8px',
                  borderRadius: 999,
                }}
              >
                Active
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: SUB }}>
            <MapPin
              size={10}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
            />
            <strong>{region.name}</strong> · {sub.contact} · {sub.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: ACCENT,
              background: `${ACCENT}10`,
              border: `1px solid ${ACCENT}30`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Assign to sites
          </button>
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          background: '#fafbff',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              fontSize: 11,
              fontWeight: tab === i ? 800 : 600,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === i ? ACCENT : SUB,
              borderBottom: tab === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Company details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr',
                  rowGap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: SUB }}>Trading name</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.name}</span>
                <span style={{ color: SUB }}>Contact</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.contact}</span>
                <span style={{ color: SUB }}>Email</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.email}</span>
                <span style={{ color: SUB }}>Phone</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.phone}</span>
                <span style={{ color: SUB }}>Region</span>
                <span style={{ color: INK, fontWeight: 700 }}>{region.name}</span>
                <span style={{ color: SUB }}>Trades</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.trades.join(' · ')}</span>
                <span style={{ color: SUB }}>VAT status</span>
                <span style={{ color: INK, fontWeight: 700 }}>{sub.vat}</span>
                <span style={{ color: SUB }}>CIS scheme</span>
                <span style={{ color: INK, fontWeight: 700 }}>
                  {sub.cis ? 'Subcontractor (deduct)' : 'Not applicable'}
                </span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Capacity &amp; load
              </div>
              <div
                style={{
                  padding: 14,
                  background: '#fafbff',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: INK }}>
                    {sub.activeSites}
                  </span>
                  <span style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>
                    / {sub.capacity} active sites
                  </span>
                </div>
                <div style={{ height: 6, background: SOFT, borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(sub.activeSites / sub.capacity) * 100}%`,
                      background: region.color,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 8 }}>
                  Room for <strong style={{ color: INK }}>{sub.capacity - sub.activeSites}</strong>{' '}
                  more sites this month
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Connect score
              </div>
              <div
                style={{
                  padding: 14,
                  background: `${GREEN}06`,
                  border: `1px solid ${GREEN}25`,
                  borderRadius: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: GREEN }}>{sub.score}</span>
                  <span style={{ fontSize: 10, color: SUB, fontWeight: 700 }}>/ 100</span>
                </div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>
                  {sub.score >= 90 ? 'Elite tier' : sub.score >= 80 ? 'Verified' : 'Eligible'}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Compliance documents
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { key: 'dbs', label: 'DBS check', ok: sub.dbs, exp: 'expires {{Mar 27}}' },
                {
                  key: 'ins',
                  label: 'Public liability insurance',
                  ok: sub.ins,
                  exp: 'expires {{Aug 26}}',
                },
                { key: 'el', label: 'Employer liability', ok: true, exp: 'expires {{Aug 26}}' },
                {
                  key: 'rams',
                  label: 'RAMS · method statements',
                  ok: sub.rams,
                  exp: sub.rams ? 'on file' : 'missing — request',
                },
                { key: 'iso', label: 'ISO 9001 / 14001', ok: false, exp: 'optional · not on file' },
              ].map((d) => (
                <div
                  key={d.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: d.ok ? '#fafbff' : '#fef9f0',
                    border: `1px solid ${d.ok ? LINE : '#fcd34d'}`,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: d.ok ? `${GREEN}15` : '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {d.ok ? (
                      <CheckCircle2 size={14} color={GREEN} />
                    ) : (
                      <AlertCircle size={14} color="#a16207" />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{d.label}</div>
                    <div style={{ fontSize: 10, color: SUB }}>{d.exp}</div>
                  </div>
                  <button
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: d.ok ? SUB : ACCENT,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {d.ok ? 'View' : 'Request →'}
                  </button>
                </div>
              ))}
              <button
                style={{
                  padding: '10px 12px',
                  border: `1.5px dashed ${LINE}`,
                  background: PAPER,
                  borderRadius: 8,
                  color: SUB,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Plus size={11} /> Upload document
              </button>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                { l: 'Active sites', v: sub.activeSites, c: INK },
                { l: 'Jobs completed', v: sub.jobsDone, c: NAVY },
                { l: 'On-time %', v: `${sub.onTime}%`, c: GREEN },
                { l: 'Avg evidence', v: '{{0-5}}', c: ACCENT },
              ].map((k) => (
                <div
                  key={k.l}
                  style={{
                    background: '#fafbff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 900, color: k.c, lineHeight: 1 }}>
                    {k.v}
                  </div>
                  <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginTop: 3 }}>
                    {k.l}
                  </div>
                </div>
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Sites currently assigned
            </div>
            <div
              style={{
                background: PAPER,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: Math.min(sub.activeSites, 4) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 80px',
                    padding: '10px 14px',
                    borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                    fontSize: 11,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: INK }}>{`{{Site ${i + 1}}}`}</div>
                    <div style={{ fontSize: 10, color: MUTE, marginTop: 1 }}>{region.name}</div>
                  </div>
                  <span
                    style={{
                      fontSize: 9,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: SOFT,
                      color: SUB,
                      fontWeight: 700,
                      justifySelf: 'flex-start',
                    }}
                  >
                    Monthly
                  </span>
                  <span style={{ color: SUB }}>{`{{date}}`}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: GREEN,
                      background: `${GREEN}12`,
                      padding: '3px 8px',
                      borderRadius: 999,
                      justifySelf: 'flex-start',
                    }}
                  >
                    active
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 3 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Recent activity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  e: 'Evidence submitted',
                  d: '{{Today 09:42}}',
                  sub: '{{Stratstone JLR Nottingham}}',
                },
                { e: 'Job accepted', d: '{{Yesterday}}', sub: '{{Volvo Derby · Quarterly}}' },
                { e: 'Payment received', d: '{{2 days ago}}', sub: '£200 · INV-0041' },
                { e: 'Compliance updated', d: '{{1 wk ago}}', sub: 'RAMS uploaded' },
              ].map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#fafbff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{ width: 6, height: 6, borderRadius: '50%', background: region.color }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{a.e}</div>
                    <div style={{ fontSize: 10, color: SUB }}>{a.sub}</div>
                  </div>
                  <span style={{ fontSize: 10, color: MUTE }}>{a.d}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Contractors() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [openSub, setOpenSub] = useState(null); // { subId, regionName }
  const [tab, setTab] = useState(0);

  const selected = openSub
    ? (() => {
        const region = CONTRACTOR_REGIONS.find((r) => r.name === openSub.regionName);
        if (!region) return null;
        const sub = region.subs.find((s) => s.id === openSub.subId);
        return sub ? { sub, region } : null;
      })()
    : null;

  const allSubs = CONTRACTOR_REGIONS.flatMap((r) => r.subs);
  const totalSubs = allSubs.length;
  const complGaps = allSubs.filter((s) => !(s.dbs && s.ins && s.rams)).length;
  const activeSubs = allSubs.filter((s) => s.firstJob !== '—').length;
  const avgScore = totalSubs ? Math.round(allSubs.reduce((a, s) => a + s.score, 0) / totalSubs) : 0;

  return (
    <div>
      <ScreenHeader
        title="Contractors"
        subtitle="Your contractor network. Bulk-import from the FM client, auto-provision free accounts, track compliance."
        primaryAction="Add contractor"
      />
      {/* KPI summary */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Contractors in network', v: totalSubs, c: INK },
          { l: 'Actively running jobs', v: activeSubs, c: GREEN },
          { l: 'Average score', v: avgScore, c: NAVY },
          { l: 'Compliance gaps', v: complGaps, c: complGaps ? '#a16207' : MUTE },
        ].map((k) => (
          <div
            key={k.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}</div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{k.l}</div>
          </div>
        ))}
      </div>

      {/* Add contractors actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => setWizardOpen(true)}
          style={{
            background: PAPER,
            border: `1px dashed ${ACCENT}50`,
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${ACCENT}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upload size={16} color={ACCENT} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>
              Bulk import (CSV / Excel)
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
              Drop the FM client's sub list — 1 to 500 rows. Invites sent automatically.
            </div>
          </div>
          <ChevronRight size={14} color={MUTE} />
        </button>
        <button
          style={{
            background: PAPER,
            border: `1px dashed ${GREEN}50`,
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: `${GREEN}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Plus size={16} color={GREEN} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>Invite individual</div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
              Send a single SMS / email invite. Sub completes onboarding in their Cadi app.
            </div>
          </div>
          <ChevronRight size={14} color={MUTE} />
        </button>
      </div>

      {wizardOpen && <ContractorUploadWizard onClose={() => setWizardOpen(false)} />}

      <Toolbar tabs={['By region', 'All', 'Pending', 'Compliance gap']} active={0} />

      {/* Region-grouped contractor network */}
      {CONTRACTOR_REGIONS.map((region) => (
        <div
          key={region.name}
          style={{
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 12,
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          {/* Region header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              background: `${region.color}06`,
              borderBottom: region.subs.length ? `1px solid ${region.color}20` : 'none',
              borderLeft: `4px solid ${region.color}`,
            }}
          >
            <MapPin size={14} color={region.color} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>{region.name}</div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
                {region.subs.length} sub{region.subs.length === 1 ? '' : 's'} · covering{' '}
                {`{{${region.sites}}}`} sites in scope
              </div>
            </div>
            <button
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: region.color,
                background: `${region.color}10`,
                border: `1px solid ${region.color}30`,
                borderRadius: 8,
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={11} /> Add sub
            </button>
          </div>

          {/* Sub rows */}
          {region.subs.length === 0 ? (
            <div
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#fffaf2',
                borderLeft: `4px solid ${region.color}`,
              }}
            >
              <AlertCircle size={14} color={ACCENT} />
              <span style={{ fontSize: 11, color: SUB, flex: 1 }}>
                No contractors in this region — sites here will need to go through{' '}
                <strong style={{ color: ACCENT }}>Marketplace</strong> or you can invite a new sub.
              </span>
              <button
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: ACCENT,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Invite →
              </button>
            </div>
          ) : (
            region.subs.map((sub, i) => (
              <div
                key={sub.id}
                onClick={() => {
                  setOpenSub({ subId: sub.id, regionName: region.name });
                  setTab(0);
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1.2fr 1fr 80px',
                  padding: '12px 16px',
                  borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                  alignItems: 'center',
                  fontSize: 11,
                  borderLeft: `4px solid ${region.color}`,
                  background:
                    openSub?.subId === sub.id && openSub?.regionName === region.name
                      ? `${region.color}06`
                      : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      background: `${region.color}15`,
                      color: region.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                    }}
                  >
                    {sub.id}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, color: INK }}>{sub.name}</div>
                    <div style={{ fontSize: 10, color: MUTE, marginTop: 1 }}>
                      Cap {sub.capacity} jobs · {`{{contact}}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {sub.trades.map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 9,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: SOFT,
                        color: SUB,
                        fontWeight: 700,
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[
                    { label: 'DBS', ok: sub.dbs },
                    { label: 'Ins', ok: sub.ins },
                    { label: 'RAMS', ok: sub.rams },
                  ].map((c) => (
                    <span
                      key={c.label}
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: c.ok ? `${GREEN}12` : '#fee2e2',
                        color: c.ok ? GREEN : '#b91c1c',
                      }}
                    >
                      {c.label}
                      {c.ok ? '✓' : '!'}
                    </span>
                  ))}
                </div>
                <div style={{ color: SUB, fontSize: 11 }}>
                  Score <strong style={{ color: INK }}>{sub.score}</strong>
                </div>
                <MoreHorizontal size={14} color={MUTE} />
              </div>
            ))
          )}
        </div>
      ))}

      {/* Detail drawer */}
      {selected && (
        <ContractorDetail
          sub={selected.sub}
          region={selected.region}
          onClose={() => setOpenSub(null)}
          tab={tab}
          setTab={setTab}
        />
      )}

      <Annot>
        Bulk import groups subs by region on intake — the FM client's spreadsheet usually has region
        as a column, so we surface it as the primary axis. Each region card shows its subs + a count
        of contract sites that fall in it, so coverage gaps (regions with sites but no subs) are
        visible immediately. Click a row → drawer reveals Compliance docs, sites covered,
        performance, and recent activity.
      </Annot>
    </div>
  );
}

// ── Marketplace data ────────────────────────────────────────────────────────

const TIER_CFG = {
  elite: { label: 'Elite tier · ≥93', color: '#a78bfa', dot: '#a78bfa' },
  verified: { label: 'Verified · ≥80', color: GREEN, dot: GREEN },
  eligible: { label: 'Eligible · ≥70', color: '#fbbf24', dot: '#fbbf24' },
  open: { label: 'Open', color: SUB, dot: MUTE },
};

const LISTING_STATUS = {
  open: { label: 'Open', color: '#3b82f6' },
  bidding: { label: 'Bidding', color: ACCENT },
  awarded: { label: 'Awarded', color: GREEN },
  closed: { label: 'Closed', color: MUTE },
};

const FORMAT_CFG = {
  auction: { label: 'Auction · best fit', icon: Send },
  rate: { label: 'Rate card direct', icon: PoundSterling },
  cluster: { label: 'Cluster bid', icon: ClipboardList },
};

const SAMPLE_LISTINGS = [
  {
    id: 'BF-4501',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    spec: 'Monthly · in & out hand-height',
    freq: 'Mon-Fri',
    price: 200,
    floor: 160,
    ceiling: 230,
    distance: 8,
    visibility: 'verified',
    status: 'bidding',
    format: 'auction',
    bidCount: 4,
    bestFit: 94,
    publishedAgo: '2h ago',
    tierTimeline: { elite: 'Now', verified: 'in 1h', eligible: 'in 3h' },
    bids: [
      {
        subId: 'A',
        sub: '{{Sub Co. A}}',
        score: 94,
        price: 195,
        distance: 12,
        capacityFree: 6,
        fit: 94,
        recommendsCadi: true,
        twoWay: { fmRating: 4.8, subRating: 4.6 },
        jobs: 71,
        onTime: 97,
        evidence: ['after-1', 'after-2'],
      },
      {
        subId: 'B',
        sub: '{{Sub Co. B}}',
        score: 88,
        price: 175,
        distance: 6,
        capacityFree: 12,
        fit: 89,
        recommendsCadi: false,
        twoWay: { fmRating: 4.5, subRating: 4.7 },
        jobs: 47,
        onTime: 94,
        evidence: ['after-3', 'after-4'],
      },
      {
        subId: 'D',
        sub: '{{Sub Co. D}}',
        score: 82,
        price: 165,
        distance: 14,
        capacityFree: 6,
        fit: 76,
        recommendsCadi: false,
        twoWay: { fmRating: 4.2, subRating: 4.4 },
        jobs: 19,
        onTime: 88,
        evidence: ['after-5'],
      },
      {
        subId: 'X',
        sub: '{{Sub Co. X}}',
        score: 78,
        price: 220,
        distance: 22,
        capacityFree: 2,
        fit: 64,
        recommendsCadi: false,
        twoWay: { fmRating: 4.0, subRating: 4.1 },
        jobs: 8,
        onTime: 86,
        evidence: [],
      },
    ],
  },
  {
    id: 'BF-4502',
    site: '{{Porsche Nottingham}}',
    region: 'Midlands',
    spec: 'Monthly · in & out + Quarterly · high-level',
    freq: 'Mon-Fri',
    price: 300,
    floor: 240,
    ceiling: 340,
    distance: 5,
    visibility: 'elite',
    status: 'open',
    format: 'auction',
    bidCount: 2,
    bestFit: 96,
    publishedAgo: '30m ago',
    tierTimeline: { elite: 'Now', verified: 'in 2h', eligible: 'in 5h' },
    bids: [
      {
        subId: 'A',
        sub: '{{Sub Co. A}}',
        score: 94,
        price: 290,
        distance: 22,
        capacityFree: 6,
        fit: 92,
        recommendsCadi: true,
        twoWay: { fmRating: 4.8, subRating: 4.6 },
        jobs: 71,
        onTime: 97,
        evidence: ['after-1', 'after-2', 'after-3'],
      },
      {
        subId: 'C',
        sub: '{{Sub Co. C}}',
        score: 91,
        price: 305,
        distance: 80,
        capacityFree: 2,
        fit: 73,
        recommendsCadi: false,
        twoWay: { fmRating: 4.6, subRating: 4.5 },
        jobs: 52,
        onTime: 95,
        evidence: ['after-4'],
      },
    ],
  },
  {
    id: 'BF-4503',
    site: '{{Audi Stockport}}',
    region: 'Midlands',
    spec: 'Monthly · in & out hand-height',
    freq: 'Mon-Fri',
    price: 340,
    floor: 280,
    ceiling: 360,
    distance: 12,
    visibility: 'open',
    status: 'open',
    format: 'rate',
    bidCount: 0,
    bestFit: null,
    publishedAgo: '5m ago',
    tierTimeline: { elite: 'Now', verified: 'in 1h', eligible: 'in 3h' },
    bids: [],
  },
  {
    id: 'BF-4498',
    site: '{{Vauxhall · Cluster of 5}}',
    region: 'Bedfordshire & Bucks',
    spec: 'Monthly · cluster across MK40/MK42/MK9/LU1/LU2',
    freq: 'Mon-Fri',
    price: 285,
    floor: 220,
    ceiling: 320,
    distance: 18,
    visibility: 'verified',
    status: 'awarded',
    format: 'cluster',
    bidCount: 3,
    bestFit: 92,
    publishedAgo: '3d ago',
    tierTimeline: { elite: 'Done', verified: 'Done', eligible: 'Done' },
    awardedTo: 'A',
    bids: [
      {
        subId: 'A',
        sub: '{{Sub Co. A}}',
        score: 94,
        price: 270,
        distance: 14,
        capacityFree: 6,
        fit: 92,
        recommendsCadi: true,
        twoWay: { fmRating: 4.8, subRating: 4.6 },
        jobs: 71,
        onTime: 97,
        evidence: ['after-1', 'after-2'],
      },
    ],
  },
];

function FitBar({ value, label, color = ACCENT }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
      <span style={{ color: SUB, fontWeight: 700, width: 70 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: SOFT, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color }} />
      </div>
      <span style={{ color: INK, fontWeight: 800, width: 32, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function BidRow({ bid, listing, isTop, onAward }) {
  const fitColor =
    bid.fit >= 90 ? GREEN : bid.fit >= 80 ? '#3b82f6' : bid.fit >= 70 ? '#fbbf24' : '#ef4444';
  return (
    <div
      style={{
        background: isTop ? `${GREEN}06` : PAPER,
        border: `1px solid ${isTop ? GREEN : LINE}25`,
        borderRadius: 10,
        padding: 14,
        marginBottom: 8,
        position: 'relative',
      }}
    >
      {isTop && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: 14,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.1em',
            color: 'white',
            background: GREEN,
            padding: '3px 8px',
            borderRadius: 999,
          }}
        >
          BEST FIT
        </span>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1.4fr 1fr 110px',
          gap: 14,
          alignItems: 'center',
        }}
      >
        {/* Sub identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: `${fitColor}15`,
              color: fitColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            {bid.subId}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: INK }}>{bid.sub}</span>
              {bid.recommendsCadi && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 900,
                    color: '#a78bfa',
                    background: '#a78bfa15',
                    padding: '1px 6px',
                    borderRadius: 999,
                    letterSpacing: '0.06em',
                  }}
                >
                  CADI PICK
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
              Score <strong style={{ color: INK }}>{bid.score}</strong> · {bid.jobs} jobs ·{' '}
              {bid.onTime}% on-time
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 9, color: SUB }}>
              <span>
                ★ FM rates: <strong style={{ color: INK }}>{bid.twoWay.fmRating}</strong>
              </span>
              <span>
                ★ sub rates FM: <strong style={{ color: INK }}>{bid.twoWay.subRating}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Fit breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <FitBar
            label="Price"
            value={
              listing.format === 'rate'
                ? 90
                : Math.max(
                    60,
                    100 -
                      Math.round(
                        ((bid.price - listing.floor) / (listing.ceiling - listing.floor)) * 50
                      )
                  )
            }
            color={ACCENT}
          />
          <FitBar label="Score" value={bid.score} color={GREEN} />
          <FitBar label="Distance" value={Math.max(40, 100 - bid.distance * 2)} color={NAVY} />
          <FitBar label="Capacity" value={Math.min(100, bid.capacityFree * 10)} color="#a78bfa" />
        </div>

        {/* Bid + evidence */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: INK, lineHeight: 1 }}>
            £{bid.price}
          </div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>per visit</div>
          {bid.evidence.length > 0 && (
            <div style={{ display: 'flex', gap: 3, marginTop: 8 }}>
              {bid.evidence.slice(0, 3).map((e, i) => (
                <div
                  key={i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${SOFT}, ${LINE})`,
                    border: `1px solid ${LINE}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Camera size={10} color={MUTE} />
                </div>
              ))}
              <span style={{ fontSize: 9, color: SUB, alignSelf: 'center', marginLeft: 3 }}>
                portfolio
              </span>
            </div>
          )}
        </div>

        {/* Fit score + award */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 46,
              height: 46,
              borderRadius: '50%',
              border: `3px solid ${fitColor}`,
              fontSize: 14,
              fontWeight: 900,
              color: fitColor,
              marginBottom: 6,
            }}
          >
            {bid.fit}
          </div>
          <div
            style={{
              fontSize: 9,
              color: SUB,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            fit score
          </div>
          {listing.status !== 'awarded' && (
            <button
              onClick={onAward}
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'white',
                background: isTop ? GREEN : ACCENT,
                border: 'none',
                borderRadius: 7,
                padding: '6px 12px',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {listing.status === 'open' ? 'Award' : 'Award'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ListingDetail({ listing, onClose, tab, setTab }) {
  if (!listing) return null;
  const tier = TIER_CFG[listing.visibility];
  const status = LISTING_STATUS[listing.status];
  const format = FORMAT_CFG[listing.format];
  const TABS = ['Bids ranked', 'Listing details', 'Sub view preview', 'Activity'];
  const ranked = [...listing.bids].sort((a, b) => b.fit - a.fit);

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${status.color}08, transparent)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: status.color,
                background: `${status.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: tier.color,
                background: `${tier.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              {tier.label}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: SUB,
                background: SOFT,
                padding: '3px 8px',
                borderRadius: 999,
              }}
            >
              <format.icon
                size={10}
                style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
              />
              {format.label}
            </span>
            <span style={{ fontSize: 10, color: MUTE }}>
              #{listing.id} · {listing.publishedAgo}
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{listing.site}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>
            <MapPin
              size={10}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
            />
            {listing.region} · {listing.spec} · {listing.freq}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Edit listing
          </button>
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          background: '#fafbff',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              fontSize: 11,
              fontWeight: tab === i ? 800 : 600,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === i ? ACCENT : SUB,
              borderBottom: tab === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t}{' '}
            {i === 0 && listing.bids.length > 0 && (
              <span
                style={{
                  marginLeft: 4,
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: ACCENT,
                  color: 'white',
                }}
              >
                {listing.bids.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 0 && (
          <>
            {ranked.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: 'center',
                  background: '#fafbff',
                  border: `1.5px dashed ${LINE}`,
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: SUB, marginBottom: 4 }}>
                  No bids yet
                </div>
                <div style={{ fontSize: 11, color: MUTE }}>
                  Cadi is auto-matching subs in {listing.region}. First bid usually arrives within 1
                  hour for {tier.label.toLowerCase()} listings.
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 14,
                    padding: '10px 12px',
                    background: '#fafbff',
                    borderRadius: 8,
                    border: `1px solid ${LINE}`,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: `${ACCENT}15`,
                      color: ACCENT,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Send size={13} />
                  </div>
                  <div style={{ flex: 1, fontSize: 11, color: '#334155' }}>
                    <strong style={{ color: INK }}>Best fit recommended</strong> — Cadi ranks bids
                    by price × Connect score × distance × capacity. You can override by sorting by
                    price alone.
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: SUB }}>
                    Sort: <strong style={{ color: ACCENT }}>Best fit</strong> · Price · Score ·
                    Distance
                  </span>
                </div>
                {ranked.map((bid, i) => (
                  <BidRow
                    key={bid.subId}
                    bid={bid}
                    listing={listing}
                    isTop={i === 0}
                    onAward={() => {}}
                  />
                ))}
              </>
            )}
          </>
        )}

        {tab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Listing
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  rowGap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: SUB }}>Site</span>
                <span style={{ color: INK, fontWeight: 700 }}>{listing.site}</span>
                <span style={{ color: SUB }}>Region</span>
                <span style={{ color: INK, fontWeight: 700 }}>{listing.region}</span>
                <span style={{ color: SUB }}>Spec</span>
                <span style={{ color: INK, fontWeight: 700 }}>{listing.spec}</span>
                <span style={{ color: SUB }}>Frequency</span>
                <span style={{ color: INK, fontWeight: 700 }}>{listing.freq}</span>
                <span style={{ color: SUB }}>Target price</span>
                <span style={{ color: INK, fontWeight: 800 }}>£{listing.price}/visit</span>
                <span style={{ color: SUB }}>Floor</span>
                <span style={{ color: INK, fontWeight: 700 }}>
                  £{listing.floor} (auto-reject below)
                </span>
                <span style={{ color: SUB }}>Ceiling</span>
                <span style={{ color: INK, fontWeight: 700 }}>£{listing.ceiling}</span>
                <span style={{ color: SUB }}>Format</span>
                <span style={{ color: INK, fontWeight: 700 }}>{format.label}</span>
                <span style={{ color: SUB }}>Award rule</span>
                <span style={{ color: INK, fontWeight: 700 }}>Best fit (default)</span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Tiered visibility timeline
              </div>
              <div
                style={{
                  background: '#fafbff',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                {['elite', 'verified', 'eligible'].map((t) => {
                  const cfg = TIER_CFG[t];
                  const when = listing.tierTimeline[t];
                  const past = when === 'Now' || when === 'Done';
                  return (
                    <div
                      key={t}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 0',
                        borderTop: t !== 'elite' ? `1px solid ${SOFT}` : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: past ? cfg.dot : SOFT,
                          border: past ? 'none' : `1px solid ${LINE}`,
                        }}
                      />
                      <span
                        style={{ fontSize: 11, color: past ? INK : SUB, fontWeight: 700, flex: 1 }}
                      >
                        {cfg.label}
                      </span>
                      <span
                        style={{ fontSize: 10, fontWeight: 800, color: past ? cfg.color : MUTE }}
                      >
                        {when}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  marginTop: 14,
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Auto-match
              </div>
              <div
                style={{
                  padding: 12,
                  background: `${ACCENT}06`,
                  border: `1px solid ${ACCENT}25`,
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: 11, color: INK, fontWeight: 700, marginBottom: 4 }}>
                  5 subs matched on publish
                </div>
                <div style={{ fontSize: 10, color: SUB, lineHeight: 1.5 }}>
                  Top match gets a 30-minute first-refusal push. If declined, opens to next tier.
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              How this listing looks inside a sub's Cadi Connect tab
            </div>
            <div
              style={{
                maxWidth: 380,
                margin: '0 auto',
                background: '#0f172a',
                borderRadius: 18,
                padding: 8,
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ background: '#f8faff', borderRadius: 12, padding: 14 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '0.12em' }}
                  >
                    MARKETPLACE · NEW
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: tier.color,
                      background: `${tier.color}15`,
                      padding: '2px 7px',
                      borderRadius: 999,
                    }}
                  >
                    {listing.visibility === 'elite' ? 'Elite-only' : 'Open'}
                  </span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>{listing.site}</div>
                <div style={{ fontSize: 10, color: SUB, marginBottom: 10 }}>
                  {listing.region} · {listing.distance} mi away
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ background: PAPER, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>
                      £{listing.price}
                    </div>
                    <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>target / visit</div>
                  </div>
                  <div style={{ background: PAPER, borderRadius: 6, padding: '6px 8px' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: GREEN }}>96%</div>
                    <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>your fit score</div>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: SUB,
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  SPEC
                </div>
                <div style={{ fontSize: 10, color: INK, marginBottom: 10 }}>
                  {listing.spec} · {listing.freq}
                </div>
                <div
                  style={{
                    padding: '8px 10px',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: 6,
                    fontSize: 10,
                    color: '#92400e',
                    marginBottom: 10,
                  }}
                >
                  ⚡ Cadi recommends you — 30-min first refusal
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    style={{
                      flex: 1,
                      background: ACCENT,
                      color: 'white',
                      fontSize: 10,
                      fontWeight: 800,
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 0',
                    }}
                  >
                    Accept at £{listing.price}
                  </button>
                  <button
                    style={{
                      background: PAPER,
                      color: SUB,
                      fontSize: 10,
                      fontWeight: 700,
                      border: `1px solid ${LINE}`,
                      borderRadius: 6,
                      padding: '7px 10px',
                    }}
                  >
                    Bid
                  </button>
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 10,
                color: MUTE,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              Same listing — different framing for the sub. Fit score shown is theirs.
            </div>
          </div>
        )}

        {tab === 3 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Listing activity
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  e: 'Published to Elite tier',
                  d: listing.publishedAgo,
                  who: 'Cadi · auto-matched 5 subs',
                },
                { e: 'First view', d: '1h 50m ago', who: '{{Sub Co. A}} viewed' },
                { e: 'Bid placed', d: '1h 30m ago', who: '{{Sub Co. A}} — £195' },
                { e: 'Verified tier unlocked', d: '1h ago', who: '+12 subs notified' },
                { e: 'Bid placed', d: '40m ago', who: '{{Sub Co. B}} — £175' },
              ].map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: '#fafbff',
                    border: `1px solid ${LINE}`,
                    borderRadius: 8,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{a.e}</div>
                    <div style={{ fontSize: 10, color: SUB }}>{a.who}</div>
                  </div>
                  <span style={{ fontSize: 10, color: MUTE }}>{a.d}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ListingCard({ listing, isOpen, onOpen }) {
  const tier = TIER_CFG[listing.visibility];
  const status = LISTING_STATUS[listing.status];
  const format = FORMAT_CFG[listing.format];
  return (
    <div
      onClick={() => onOpen(listing.id)}
      style={{
        background: PAPER,
        border: `1px solid ${isOpen ? `${ACCENT}40` : LINE}`,
        borderRadius: 10,
        padding: 14,
        cursor: 'pointer',
        borderLeft: `4px solid ${status.color}`,
        boxShadow: isOpen ? `0 0 0 3px ${ACCENT}15` : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          #{listing.id}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: tier.color,
            background: `${tier.color}15`,
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {tier.label}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: INK, marginBottom: 3 }}>
        {listing.site}
      </div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 4 }}>{listing.spec}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <format.icon size={10} color={SUB} />
        <span style={{ fontSize: 10, color: SUB, fontWeight: 700 }}>
          {format.label} · {listing.publishedAgo}
        </span>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}
      >
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>£{listing.price}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>target</div>
        </div>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: NAVY }}>{listing.bidCount}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>bids</div>
        </div>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: listing.bestFit ? GREEN : MUTE }}>
            {listing.bestFit ? listing.bestFit : '—'}
          </div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>best fit</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 800,
            color: listing.status === 'awarded' ? GREEN : 'white',
            background: listing.status === 'awarded' ? `${GREEN}15` : ACCENT,
            border: 'none',
            borderRadius: 6,
            padding: '6px 0',
            cursor: 'pointer',
          }}
        >
          {listing.status === 'awarded'
            ? `✓ Awarded · ${listing.awardedTo}`
            : isOpen
              ? 'Open below ↓'
              : 'View bids'}
        </button>
      </div>
    </div>
  );
}

function NewListingPanel({ onClose }) {
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>New listing</div>
          <div style={{ fontSize: 11, color: SUB }}>
            One step — Cadi handles tiered visibility and auto-match.
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            fontSize: 14,
            color: MUTE,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 6px',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        <div>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Site (from your contracts)
          </label>
          <Box h={36} style={{ marginTop: 4, justifyContent: 'flex-start' }}>{`{{Pick site}}`}</Box>
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Format
          </label>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {Object.entries(FORMAT_CFG).map(([k, cfg], i) => {
              const Icon = cfg.icon;
              return (
                <span
                  key={k}
                  style={{
                    fontSize: 10,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${i === 0 ? ACCENT : LINE}`,
                    background: i === 0 ? `${ACCENT}10` : PAPER,
                    color: i === 0 ? ACCENT : SUB,
                    fontWeight: i === 0 ? 800 : 600,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <Icon size={10} /> {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Floor / target / ceiling
          </label>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <Box h={36} w="33%" style={{ justifyContent: 'flex-start' }}>
              £floor
            </Box>
            <Box h={36} w="33%" style={{ justifyContent: 'flex-start' }}>
              £target
            </Box>
            <Box h={36} w="33%" style={{ justifyContent: 'flex-start' }}>
              £ceiling
            </Box>
          </div>
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Score floor
          </label>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {[
              { k: 'elite', l: 'Elite ≥93' },
              { k: 'verified', l: 'Verified ≥80' },
              { k: 'eligible', l: 'Eligible ≥70' },
              { k: 'open', l: 'Any' },
            ].map((t, i) => {
              const cfg = TIER_CFG[t.k];
              return (
                <span
                  key={t.k}
                  style={{
                    fontSize: 10,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${i === 1 ? cfg.color : LINE}`,
                    background: i === 1 ? `${cfg.color}10` : PAPER,
                    color: i === 1 ? cfg.color : SUB,
                    fontWeight: i === 1 ? 800 : 600,
                    flex: 1,
                    textAlign: 'center',
                  }}
                >
                  {t.l}
                </span>
              );
            })}
          </div>
        </div>
      </div>
      <div
        style={{
          padding: 14,
          background: `${ACCENT}06`,
          border: `1px solid ${ACCENT}25`,
          borderRadius: 10,
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Send size={16} color={ACCENT} />
        <div style={{ flex: 1, fontSize: 11, color: '#334155' }}>
          On publish, Cadi will <strong>auto-match the top 5 subs</strong>, push first-refusal to
          the #1 match, and tier-release every hour. You don't have to chase.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button
          onClick={onClose}
          style={{
            background: PAPER,
            color: SUB,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 18px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Publish listing →
        </button>
      </div>
    </div>
  );
}

function Marketplace() {
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [newOpen, setNewOpen] = useState(false);

  const filtered = SAMPLE_LISTINGS.filter(
    (l) => statusFilter === 'all' || l.status === statusFilter
  );
  const openListing =
    filtered.find((l) => l.id === openId) || SAMPLE_LISTINGS.find((l) => l.id === openId);

  const STATUS_TABS = [
    { id: 'all', label: 'All listings' },
    { id: 'open', label: 'Open' },
    { id: 'bidding', label: 'Bidding' },
    { id: 'awarded', label: 'Awarded' },
    { id: 'closed', label: 'Closed' },
  ];

  const totalBids = SAMPLE_LISTINGS.reduce((a, l) => a + l.bidCount, 0);
  const openCount = SAMPLE_LISTINGS.filter((l) => l.status === 'open').length;
  const awardedVal = SAMPLE_LISTINGS.filter((l) => l.status === 'awarded').reduce(
    (a, l) => a + l.price,
    0
  );
  const avgFit = (() => {
    const fits = SAMPLE_LISTINGS.flatMap((l) => l.bids.map((b) => b.fit));
    return fits.length ? Math.round(fits.reduce((a, b) => a + b, 0) / fits.length) : 0;
  })();

  return (
    <div>
      <ScreenHeader
        title="Marketplace"
        subtitle="Tiered listings · auto-matched · awarded by best fit, not lowest price."
        primaryAction="Publish listing"
      />

      {/* KPIs */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          {
            l: 'Open + bidding',
            v: openCount + SAMPLE_LISTINGS.filter((l) => l.status === 'bidding').length,
            c: ACCENT,
          },
          { l: 'Total bids in', v: totalBids, c: NAVY },
          { l: 'Avg fit score', v: avgFit || '—', c: GREEN },
          { l: 'Awarded value', v: `£${awardedVal}`, c: INK },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Elite features explainer */}
      <div
        style={{
          background: `linear-gradient(135deg, ${NAVY}05, ${ACCENT}05)`,
          border: `1px solid ${NAVY}15`,
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            color: NAVY,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          How Cadi's marketplace works
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            { l: 'Tiered visibility', d: 'Elite sees first · Verified +1h · Eligible +3h' },
            { l: 'Auto-match', d: 'Top 5 subs pushed on publish · 30m first refusal' },
            { l: 'Best-fit award', d: 'Price × score × distance × capacity — not lowest bid' },
            { l: 'Two-way reviews', d: 'Subs rate FMs · FMs rate subs · both visible' },
            { l: 'Rate cards', d: 'Subs publish per-postcode rates · skip auctions' },
          ].map((f) => (
            <div
              key={f.l}
              style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 10px' }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>{f.l}</div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 3, lineHeight: 1.4 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* New listing button */}
      <button
        onClick={() => setNewOpen(!newOpen)}
        style={{
          background: PAPER,
          border: `1px dashed ${ACCENT}50`,
          borderRadius: 10,
          padding: '12px 16px',
          marginBottom: 14,
          cursor: 'pointer',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${ACCENT}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={14} color={ACCENT} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>Publish a new listing</div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
            Pick a site · set price + score floor · Cadi handles the rest
          </div>
        </div>
        <ChevronRight
          size={14}
          color={MUTE}
          style={{ transform: newOpen ? 'rotate(90deg)' : 'none' }}
        />
      </button>

      {newOpen && <NewListingPanel onClose={() => setNewOpen(false)} />}

      {/* Status filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: 4,
        }}
      >
        {STATUS_TABS.map((t) => {
          const count =
            t.id === 'all'
              ? SAMPLE_LISTINGS.length
              : SAMPLE_LISTINGS.filter((l) => l.status === t.id).length;
          const isActive = statusFilter === t.id;
          const cfg = t.id === 'all' ? { color: ACCENT } : LISTING_STATUS[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                padding: '6px 10px',
                borderRadius: 6,
                background: isActive ? `${cfg.color}12` : 'transparent',
                color: isActive ? cfg.color : SUB,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 9,
                  color: isActive ? cfg.color : MUTE,
                  background: isActive ? `${cfg.color}15` : SOFT,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Listing grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {filtered.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            isOpen={openId === l.id}
            onOpen={(id) => {
              setOpenId(id === openId ? null : id);
              setTab(0);
            }}
          />
        ))}
      </div>

      {/* Detail panel */}
      {openListing && (
        <ListingDetail
          listing={openListing}
          onClose={() => setOpenId(null)}
          tab={tab}
          setTab={setTab}
        />
      )}

      <Annot>
        Elite-marketplace defaults: <strong>best-fit award</strong> (price × score × distance ×
        capacity), <strong>tiered visibility</strong> by Connect score, <strong>auto-match</strong>{' '}
        with first-refusal push, <strong>two-way reviews</strong> visible on every bid,{' '}
        <strong>rate cards</strong> for no-auction direct work. Instant payouts are deferred to v2.
        Listings model:{' '}
        <code>{`{ id, site, region, spec, freq, price/floor/ceiling, visibility, format, status, bids[] }`}</code>
        .
      </Annot>
    </div>
  );
}

// ── Schedule data + status model ─────────────────────────────────────────────

const JOB_STATE = {
  upcoming: { label: 'Upcoming', color: '#3b82f6', dot: '#3b82f6' },
  onsite: { label: 'Checked in', color: ACCENT, dot: ACCENT },
  done: { label: 'Checked out', color: GREEN, dot: GREEN },
  late: { label: 'Late check-in', color: '#f59e0b', dot: '#f59e0b' },
  noshow: { label: 'No-show', color: '#dc2626', dot: '#dc2626' },
};

const SAMPLE_JOBS = [
  // "Today" = Wed (day index 2). lateMin = minutes past start without check-in.
  {
    id: 'JC-001',
    day: 0,
    start: 6,
    dur: 2,
    site: '{{Stratstone JLR Nottingham}}',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    region: 'Midlands',
    state: 'done',
    onSiteMin: 118,
    lateMin: null,
    geoOk: true,
    evidence: true,
    ref: 'BF-4471',
  },
  {
    id: 'JC-002',
    day: 0,
    start: 13,
    dur: 1,
    site: '{{Volvo Derby}}',
    sub: '{{Sub Co. D}}',
    subId: 'D',
    region: 'Midlands',
    state: 'done',
    onSiteMin: 64,
    lateMin: null,
    geoOk: true,
    evidence: true,
    ref: 'BF-4472',
  },
  {
    id: 'JC-003',
    day: 1,
    start: 8,
    dur: 2,
    site: '{{Vauxhall Bedford}}',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    region: 'Bedfordshire & Bucks',
    state: 'done',
    onSiteMin: 124,
    lateMin: null,
    geoOk: true,
    evidence: true,
    ref: 'BF-4473',
  },
  {
    id: 'JC-004',
    day: 2,
    start: 7,
    dur: 2,
    site: '{{Aston Martin Mayfair}}',
    sub: '{{Sub Co. C}}',
    subId: 'C',
    region: 'London',
    state: 'onsite',
    onSiteMin: 42,
    lateMin: null,
    geoOk: true,
    evidence: false,
    ref: 'BF-4474',
  },
  {
    id: 'JC-005',
    day: 2,
    start: 9,
    dur: 1.5,
    site: '{{Audi Stockport}}',
    sub: '{{Sub Co. B}}',
    subId: 'B',
    region: 'Midlands',
    state: 'upcoming',
    onSiteMin: 0,
    lateMin: null,
    geoOk: null,
    evidence: false,
    ref: 'BF-4475',
  },
  {
    id: 'JC-006',
    day: 2,
    start: 11,
    dur: 2,
    site: '{{Porsche Nottingham}}',
    sub: '{{Sub Co. B}}',
    subId: 'B',
    region: 'Midlands',
    state: 'upcoming',
    onSiteMin: 0,
    lateMin: null,
    geoOk: null,
    evidence: false,
    ref: 'BF-4476',
  },
  {
    id: 'JC-007',
    day: 2,
    start: 14,
    dur: 2,
    site: '{{Vauxhall Bedford}}',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    region: 'Bedfordshire & Bucks',
    state: 'upcoming',
    onSiteMin: 0,
    lateMin: null,
    geoOk: null,
    evidence: false,
    ref: 'BF-4477',
  },
  {
    id: 'JC-008',
    day: 2,
    start: 7,
    dur: 2,
    site: '{{Volvo Derby}}',
    sub: '{{Sub Co. D}}',
    subId: 'D',
    region: 'Midlands',
    state: 'late',
    onSiteMin: 0,
    lateMin: 22,
    geoOk: null,
    evidence: false,
    ref: 'BF-4478',
  },
  {
    id: 'JC-009',
    day: 3,
    start: 9,
    dur: 2,
    site: '{{Stratstone JLR Nottingham}}',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    region: 'Midlands',
    state: 'upcoming',
    onSiteMin: 0,
    lateMin: null,
    geoOk: null,
    evidence: false,
    ref: 'BF-4479',
  },
  {
    id: 'JC-010',
    day: 4,
    start: 11,
    dur: 2,
    site: '{{Audi Stockport}}',
    sub: '{{Sub Co. B}}',
    subId: 'B',
    region: 'Midlands',
    state: 'upcoming',
    onSiteMin: 0,
    lateMin: null,
    geoOk: null,
    evidence: false,
    ref: 'BF-4480',
  },
];

const REGION_COLOR_MAP = {
  Midlands: '#7c3aed',
  'Bedfordshire & Bucks': NAVY,
  London: GREEN,
  'South West': '#0891b2',
};

// Wireframe map — UK silhouette via positioned pins (no tile layer)
const MAP_SITES = [
  {
    id: 'JC-004',
    name: 'Aston Martin Mayfair',
    x: 50,
    y: 75,
    state: 'onsite',
    sub: 'C',
    region: 'London',
  },
  {
    id: 'JC-005',
    name: 'Audi Stockport',
    x: 34,
    y: 38,
    state: 'upcoming',
    sub: 'B',
    region: 'Midlands',
  },
  {
    id: 'JC-006',
    name: 'Porsche Nottingham',
    x: 44,
    y: 45,
    state: 'upcoming',
    sub: 'B',
    region: 'Midlands',
  },
  { id: 'JC-008', name: 'Volvo Derby', x: 40, y: 47, state: 'late', sub: 'D', region: 'Midlands' },
  {
    id: 'JC-009',
    name: 'Stratstone JLR Nott',
    x: 46,
    y: 47,
    state: 'upcoming',
    sub: 'A',
    region: 'Midlands',
  },
  {
    id: 'JC-007',
    name: 'Vauxhall Bedford',
    x: 50,
    y: 64,
    state: 'upcoming',
    sub: 'A',
    region: 'Bedfordshire & Bucks',
  },
];

const DAY_LABELS = ['Mon 22', 'Tue 23', 'Wed 24', 'Thu 25', 'Fri 26', 'Sat 27', 'Sun 28'];
const HOURS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// ── Reusable bits ────────────────────────────────────────────────────────────

function StateDot({ state, withPulse }) {
  const cfg = JOB_STATE[state];
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 10,
        height: 10,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
      {withPulse && (state === 'onsite' || state === 'late') && (
        <span
          style={{
            position: 'absolute',
            inset: -2,
            borderRadius: '50%',
            border: `2px solid ${cfg.dot}`,
            opacity: 0.4,
            animation: 'pulse 1.4s ease-in-out infinite',
          }}
        />
      )}
    </span>
  );
}

function WeekGrid({ jobs, onOpen, openId }) {
  const COL_W = 'minmax(0, 1fr)';
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `48px repeat(7, ${COL_W})`,
          borderBottom: `1px solid ${LINE}`,
          background: SOFT,
        }}
      >
        <div></div>
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            style={{
              padding: '8px 0',
              textAlign: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: i === 2 ? ACCENT : SUB,
              borderLeft: `1px solid ${LINE}`,
              background: i === 2 ? `${ACCENT}06` : 'transparent',
            }}
          >
            {d}
            {i === 2 && (
              <div
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  color: ACCENT,
                  letterSpacing: '0.08em',
                  marginTop: 2,
                }}
              >
                TODAY
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        {HOURS.map((h, ri) => (
          <div
            key={h}
            style={{
              display: 'grid',
              gridTemplateColumns: `48px repeat(7, ${COL_W})`,
              height: 32,
              borderBottom: ri < HOURS.length - 1 ? `1px solid ${SOFT}` : 'none',
              position: 'relative',
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: MUTE,
                padding: '4px 6px',
                borderRight: `1px solid ${LINE}`,
              }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
            {DAY_LABELS.map((_, di) => (
              <div
                key={di}
                style={{
                  borderLeft: `1px solid ${SOFT}`,
                  background: di === 2 ? `${ACCENT}03` : 'transparent',
                }}
              />
            ))}
          </div>
        ))}
        {/* Now-line on today (Wed = day index 2), at 09:30 local */}
        <div
          style={{
            position: 'absolute',
            left: `calc(48px + 2 * (100% - 48px) / 7)`,
            width: `calc((100% - 48px) / 7)`,
            top: `${(9.5 - HOURS[0]) * 32}px`,
            height: 2,
            background: ACCENT,
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: -8,
              top: -4,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: ACCENT,
              boxShadow: `0 0 0 3px ${ACCENT}25`,
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 4,
              top: -16,
              fontSize: 9,
              fontWeight: 900,
              color: ACCENT,
              background: PAPER,
              padding: '1px 4px',
              borderRadius: 3,
            }}
          >
            09:30 NOW
          </span>
        </div>

        {jobs.map((job) => {
          const cfg = JOB_STATE[job.state];
          const regionColor = REGION_COLOR_MAP[job.region] || cfg.color;
          const topOffset = (job.start - HOURS[0]) * 32;
          const height = job.dur * 32 - 2;
          const colWidth = `calc((100% - 48px) / 7)`;
          const left = `calc(48px + ${job.day} * ${colWidth} + 2px)`;
          const isOpen = openId === job.id;
          return (
            <div
              key={job.id}
              onClick={() => onOpen(job.id)}
              style={{
                position: 'absolute',
                top: topOffset + 1,
                left,
                width: `calc(${colWidth} - 4px)`,
                height,
                borderRadius: 6,
                background: PAPER,
                borderLeft: `3px solid ${cfg.color}`,
                border: `1px solid ${cfg.color}40`,
                padding: '3px 5px',
                fontSize: 9,
                color: INK,
                cursor: 'pointer',
                overflow: 'hidden',
                boxShadow: isOpen ? `0 0 0 2px ${ACCENT}40` : 'none',
                zIndex: isOpen ? 6 : 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
                <StateDot state={job.state} withPulse />
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 900,
                    color: cfg.color,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {cfg.label}
                </span>
                {job.state === 'onsite' && (
                  <span style={{ marginLeft: 'auto', fontSize: 8, color: SUB, fontWeight: 700 }}>
                    {job.onSiteMin}m on site
                  </span>
                )}
                {job.state === 'late' && (
                  <span
                    style={{ marginLeft: 'auto', fontSize: 8, color: '#dc2626', fontWeight: 900 }}
                  >
                    +{job.lateMin}m
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: INK,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {job.site}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: `${regionColor}20`,
                    color: regionColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 7,
                    fontWeight: 900,
                  }}
                >
                  {job.subId}
                </div>
                <span style={{ fontSize: 8, color: SUB }}>{job.sub.replace(/[{}]/g, '')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveMap({ onOpen }) {
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: `1px solid ${LINE}`,
          background: SOFT,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: ACCENT,
            animation: 'pulse 1.4s infinite',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: INK }}>
            Today's sites · check-in status
          </div>
          <div style={{ fontSize: 10, color: SUB }}>
            Pin colour = check-in state · GPS only captured at check-in / check-out
          </div>
        </div>
        <span style={{ fontSize: 10, color: SUB }}>Updated 09:30:42 · auto-refresh 30s</span>
      </div>
      <div
        style={{
          position: 'relative',
          height: 420,
          background: 'linear-gradient(180deg, #f0f6ff, #f8faff)',
        }}
      >
        {/* UK silhouette via CSS shapes — wireframe stand-in */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}
        >
          <path
            d="M 35 8 L 48 6 L 55 14 L 62 22 L 60 32 L 65 40 L 60 50 L 65 60 L 60 70 L 65 80 L 55 88 L 42 90 L 32 82 L 28 72 L 32 62 L 28 50 L 32 38 L 28 28 L 32 18 Z"
            fill={NAVY}
          />
        </svg>

        {/* Region overlays */}
        {[
          { name: 'Midlands', x: 36, y: 42, color: '#7c3aed' },
          { name: 'Beds & Bucks', x: 50, y: 62, color: NAVY },
          { name: 'London', x: 52, y: 76, color: GREEN },
        ].map((r) => (
          <div
            key={r.name}
            style={{
              position: 'absolute',
              left: `${r.x}%`,
              top: `${r.y}%`,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${r.color}10 0%, ${r.color}00 70%)`,
              }}
            />
            <span
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontSize: 9,
                fontWeight: 800,
                color: r.color,
                opacity: 0.6,
                whiteSpace: 'nowrap',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {r.name}
            </span>
          </div>
        ))}

        {/* Site pins */}
        {MAP_SITES.map((s) => {
          const cfg = JOB_STATE[s.state];
          return (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                transform: 'translate(-50%, -100%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50% 50% 50% 0',
                  transform: 'rotate(-45deg)',
                  background: cfg.color,
                  border: '2px solid white',
                  boxShadow: `0 2px 8px ${cfg.color}50`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    transform: 'rotate(45deg)',
                    color: 'white',
                    fontWeight: 900,
                    fontSize: 11,
                  }}
                >
                  {s.sub}
                </span>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: -36,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 9,
                  fontWeight: 800,
                  color: INK,
                  background: PAPER,
                  padding: '3px 8px',
                  borderRadius: 5,
                  border: `1px solid ${LINE}`,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                {s.name} <span style={{ color: cfg.color, marginLeft: 4 }}>· {cfg.label}</span>
              </div>
            </button>
          );
        })}

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            Live status
          </div>
          {[
            { s: 'onsite', l: 'Checked in · geo-fence ✓' },
            { s: 'done', l: 'Checked out' },
            { s: 'upcoming', l: 'Upcoming today' },
            { s: 'late', l: 'Late · no check-in' },
          ].map(({ s, l }) => {
            const cfg = JOB_STATE[s];
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color }} />
                <span style={{ color: INK }}>{l}</span>
              </div>
            );
          })}
        </div>

        {/* GPS privacy badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 10,
            color: SUB,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <CheckCircle2 size={12} color={GREEN} />
          GPS captured at check-in & check-out only · 4 of 4 subs consented
        </div>
      </div>
    </div>
  );
}

function JobDrawer({ job, onClose, tab, setTab }) {
  if (!job) return null;
  const cfg = JOB_STATE[job.state];
  const TABS = ['Live status', 'Job details', 'Sub', 'Check-in / out log'];

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${cfg.color}08, transparent)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: cfg.color,
                background: `${cfg.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {cfg.label}
            </span>
            <span style={{ fontSize: 10, color: MUTE }}>
              #{job.id} · {DAY_LABELS[job.day]} {String(job.start).padStart(2, '0')}:00–
              {String(job.start + job.dur).padStart(2, '0')}:00
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{job.site}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>
            <MapPin
              size={10}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
            />
            {job.region} · <strong>{job.sub}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {job.state === 'late' && (
            <button
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 7,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Ping sub
            </button>
          )}
          {job.state === 'noshow' && (
            <button
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: ACCENT,
                background: `${ACCENT}10`,
                border: `1px solid ${ACCENT}30`,
                borderRadius: 7,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Re-dispatch
            </button>
          )}
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Reschedule
          </button>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          background: '#fafbff',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              fontSize: 11,
              fontWeight: tab === i ? 800 : 600,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === i ? ACCENT : SUB,
              borderBottom: tab === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                GPS-tracked state
              </div>
              {job.state === 'onsite' && (
                <div
                  style={{
                    padding: 16,
                    background: `${ACCENT}08`,
                    border: `1px solid ${ACCENT}25`,
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <StateDot state="onsite" withPulse />
                    <span style={{ fontSize: 13, fontWeight: 900, color: ACCENT }}>
                      Checked in · {job.onSiteMin} min ago
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
                    Sub tapped <strong>Check in</strong> at {String(job.start).padStart(2, '0')}:00
                    inside the 80m geo-fence. Cadi is awaiting check-out + evidence to complete the
                    visit.
                  </div>
                </div>
              )}
              {job.state === 'late' && (
                <div
                  style={{
                    padding: 16,
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <StateDot state="late" withPulse />
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#b45309' }}>
                      Late check-in · +{job.lateMin} min past start
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
                    No check-in tapped yet. Cadi auto-pinged the sub at +5 min. Client portal will
                    surface a delay alert at +30 min · auto-flip to <strong>No-show</strong> at +60.
                  </div>
                </div>
              )}
              {job.state === 'done' && (
                <div
                  style={{
                    padding: 16,
                    background: `${GREEN}08`,
                    border: `1px solid ${GREEN}25`,
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <CheckCircle2 size={14} color={GREEN} />
                    <span style={{ fontSize: 13, fontWeight: 900, color: GREEN }}>
                      Checked out · {job.onSiteMin}m on site
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.55 }}>
                    Geo-fence ✓ at both check-in and check-out · evidence ✓ · sign-off submitted.
                    Routed to Work approval queue.
                  </div>
                </div>
              )}
              {job.state === 'upcoming' && (
                <div
                  style={{
                    padding: 16,
                    background: `${LINE}30`,
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <StateDot state="upcoming" />
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#3b82f6' }}>
                      Upcoming · starts {String(job.start).padStart(2, '0')}:00
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#334155' }}>
                    Sub will tap <strong>Check in</strong> in their Cadi when they arrive — Cadi
                    verifies they're within the geo-fence before allowing it.
                  </div>
                </div>
              )}

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Geo-fence rules
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  { l: 'Radius', v: '80m' },
                  { l: 'Anchored to', v: 'Site GPS · verified Jun 4' },
                  {
                    l: 'Check-in',
                    v:
                      job.geoOk === true
                        ? '✓ inside fence'
                        : job.geoOk === false
                          ? '✗ outside'
                          : '— pending',
                  },
                  { l: 'Check-out', v: job.state === 'done' ? '✓ inside fence' : '— pending' },
                  { l: 'Auto-flag late', v: '+15 min · no check-in' },
                  { l: 'Auto-no-show', v: '+60 min · no check-in' },
                ].map((s) => (
                  <div
                    key={s.l}
                    style={{
                      background: '#fafbff',
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ fontSize: 9, color: SUB, fontWeight: 700, marginBottom: 2 }}>
                      {s.l}
                    </div>
                    <div style={{ fontSize: 11, color: INK, fontWeight: 700 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini live snapshot */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Live snapshot
              </div>
              <div
                style={{
                  aspectRatio: '1 / 1',
                  background: 'linear-gradient(180deg,#f0f6ff,#fafbff)',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Site at centre, geo-fence circle */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: '60%',
                    height: '60%',
                    borderRadius: '50%',
                    border: `2px dashed ${ACCENT}50`,
                    background: `${ACCENT}05`,
                  }}
                />
                {/* Site pin */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -100%)',
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50% 50% 50% 0',
                      transform: 'rotate(-45deg)',
                      background: cfg.color,
                      border: '2px solid white',
                      boxShadow: `0 2px 8px ${cfg.color}50`,
                    }}
                  />
                </div>
                {/* Sub vehicle */}
                {(job.state === 'onsite' || job.state === 'done') && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%,-50%)',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: ACCENT,
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 8,
                        fontWeight: 900,
                      }}
                    >
                      {job.subId}
                    </div>
                  </div>
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 8,
                    left: 8,
                    right: 8,
                    fontSize: 9,
                    color: SUB,
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  Dashed = 80m geo-fence
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Visit details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr',
                  rowGap: 8,
                  fontSize: 11,
                }}
              >
                <span style={{ color: SUB }}>Reference</span>
                <span style={{ color: INK, fontWeight: 700 }}>{job.ref}</span>
                <span style={{ color: SUB }}>Site</span>
                <span style={{ color: INK, fontWeight: 700 }}>{job.site}</span>
                <span style={{ color: SUB }}>Window</span>
                <span style={{ color: INK, fontWeight: 700 }}>
                  {String(job.start).padStart(2, '0')}:00–
                  {String(job.start + job.dur).padStart(2, '0')}:00
                </span>
                <span style={{ color: SUB }}>Duration</span>
                <span style={{ color: INK, fontWeight: 700 }}>{job.dur} hr scheduled</span>
                <span style={{ color: SUB }}>Region</span>
                <span style={{ color: INK, fontWeight: 700 }}>{job.region}</span>
                <span style={{ color: SUB }}>Source</span>
                <span style={{ color: INK, fontWeight: 700 }}>Marketplace award #{job.ref}</span>
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Day chain for {job.sub}
              </div>
              <div
                style={{
                  background: '#fafbff',
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  padding: 10,
                }}
              >
                {[
                  '08:00 · Vauxhall Bedford · ✓',
                  '11:00 · ' + job.site.replace(/[{}]/g, '') + ' · ' + cfg.label,
                  '14:00 · Vauxhall Bedford · upcoming',
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      fontSize: 10,
                      color: i === 1 ? INK : SUB,
                      fontWeight: i === 1 ? 800 : 600,
                      padding: '4px 0',
                      borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                    }}
                  >
                    {row}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 14,
                background: `${cfg.color}15`,
                color: cfg.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {job.subId}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: INK }}>{job.sub}</div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
                {job.region} · check-in/out GPS consent ✓ · responds within ~2 min
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: ACCENT,
                    background: `${ACCENT}10`,
                    border: `1px solid ${ACCENT}30`,
                    borderRadius: 7,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Open profile
                </button>
                <button
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: SUB,
                    background: PAPER,
                    border: `1px solid ${LINE}`,
                    borderRadius: 7,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Message in-app
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 3 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Stamped GPS events for this job
            </div>
            <div
              style={{
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: 14,
                marginBottom: 12,
              }}
            >
              {(() => {
                const events = [];
                if (job.state === 'late') {
                  events.push({
                    t: String(job.start).padStart(2, '0') + ':00',
                    e: 'Scheduled start',
                    missed: true,
                  });
                  events.push({
                    t: String(job.start).padStart(2, '0') + ':05',
                    e: 'Cadi auto-pinged sub',
                    missed: true,
                  });
                } else if (job.state === 'upcoming') {
                  events.push({ t: '—', e: 'Awaiting check-in at scheduled start' });
                } else {
                  events.push({
                    t: String(job.start).padStart(2, '0') + ':00',
                    e: 'Check-in tapped · geo-fence ✓',
                    ok: true,
                  });
                  if (job.state === 'done') {
                    const out = job.start + job.dur;
                    events.push({
                      t: String(Math.floor(out)).padStart(2, '0') + ':' + (out % 1 ? '30' : '00'),
                      e: 'Check-out tapped · geo-fence ✓ · evidence submitted',
                      ok: true,
                    });
                  } else {
                    events.push({ t: '—', e: 'Check-out pending' });
                  }
                }
                return events.map((r, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '70px 14px 1fr',
                      alignItems: 'center',
                      padding: '6px 0',
                      fontSize: 11,
                      borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                    }}
                  >
                    <span
                      style={{
                        color: SUB,
                        fontFamily: 'ui-monospace,Menlo,monospace',
                        fontSize: 10,
                      }}
                    >
                      {r.t}
                    </span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: r.ok ? GREEN : r.missed ? '#dc2626' : MUTE,
                      }}
                    />
                    <span style={{ color: INK }}>{r.e}</span>
                  </div>
                ));
              })()}
            </div>
            <div style={{ fontSize: 10, color: MUTE, fontStyle: 'italic' }}>
              Two stamps per job · immutable · used in disputes, payroll, KPI. No other GPS
              captured.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Schedule() {
  const [view, setView] = useState('week'); // 'week' | 'map'
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState(0);

  const openJob = SAMPLE_JOBS.find((j) => j.id === openId);

  const today = SAMPLE_JOBS.filter((j) => j.day === 2);
  const onSite = SAMPLE_JOBS.filter((j) => j.state === 'onsite').length;
  const checkedOut = today.filter((j) => j.state === 'done').length;
  const late = SAMPLE_JOBS.filter((j) => j.state === 'late' || j.state === 'noshow').length;
  const todayCount = today.length;

  return (
    <div>
      <ScreenHeader
        title="Schedule"
        subtitle="Week grid + sites map. Geo-fenced check-in & check-out · late + no-show alerts · stamped time-on-site."
      />

      {/* Live KPI strip */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Scheduled today', v: todayCount, c: INK, sub: 'across all contracts' },
          { l: 'Checked in now', v: onSite, c: ACCENT, sub: 'inside geo-fence', pulse: !!onSite },
          { l: 'Checked out', v: checkedOut, c: GREEN, sub: 'evidence submitted' },
          {
            l: 'Late check-ins',
            v: late,
            c: late ? '#dc2626' : MUTE,
            sub: late ? 'needs attention' : 'all clear',
            pulse: !!late,
          },
          { l: 'GPS consents', v: '4 / 4', c: GREEN, sub: 'across active subs' },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
              {s.pulse && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: s.c,
                    animation: 'pulse 1.4s infinite',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
            <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* View toggle + smart-suggestion banner */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 4,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: 4,
          }}
        >
          {[
            { id: 'week', label: 'Week grid', icon: Calendar },
            { id: 'map', label: 'Live map', icon: MapPin },
          ].map((t) => {
            const Icon = t.icon;
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                style={{
                  fontSize: 11,
                  fontWeight: active ? 800 : 600,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: active ? `${ACCENT}12` : 'transparent',
                  color: active ? ACCENT : SUB,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon size={12} /> {t.label}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: MUTE, alignSelf: 'center' }}>
          Week of 22–28 Jun · region: All
        </span>
      </div>

      {/* Cadi suggestions strip — sits above whichever view */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div
          style={{
            background: '#fafbff',
            border: `1px solid ${ACCENT}20`,
            borderRadius: 10,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: `${ACCENT}15`,
              color: ACCENT,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>
              Cluster suggestion · Sub B
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
              Group Audi Stockport + Porsche Nottingham + Derby into one trip — saves 47 min drive
              time.
            </div>
          </div>
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: ACCENT,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Apply →
          </button>
        </div>
        {late > 0 && (
          <div
            style={{
              background: '#fef9f0',
              border: `1px solid #fcd34d`,
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle size={14} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>
                Late check-in · Sub D · Volvo Derby
              </div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
                22 min past scheduled start · no check-in yet. Cadi auto-pinged the sub at +5 min.
                Auto-flag No-show at +60.
              </div>
            </div>
            <button
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: '#b45309',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Investigate →
            </button>
          </div>
        )}
      </div>

      {/* View body */}
      {view === 'week' && (
        <WeekGrid
          jobs={SAMPLE_JOBS}
          onOpen={(id) => {
            setOpenId(id === openId ? null : id);
            setTab(0);
          }}
          openId={openId}
        />
      )}
      {view === 'map' && (
        <LiveMap
          onOpen={(id) => {
            setOpenId(id === openId ? null : id);
            setTab(0);
          }}
        />
      )}

      {/* Drawer */}
      {openJob && (
        <JobDrawer job={openJob} onClose={() => setOpenId(null)} tab={tab} setTab={setTab} />
      )}

      <Annot>
        <strong>GPS, scoped to two taps per job:</strong> Check in (sub must be inside the 80m site
        geo-fence to tap) and Check out (same fence check). Nothing in between. Powers three things:
        (1) verified time-on-site, (2) late + no-show auto-flags (no check-in by +15 / +60), (3) two
        stamped events per job for disputes, payroll, KPI. Job state model:{' '}
        <code>{`{ id, day, start, dur, site, region, sub, state, geoOk, onSiteMin, lateMin, evidence }`}</code>
        .
      </Annot>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.25); } }`}</style>
    </div>
  );
}

const APPROVAL_STATUS = {
  pending: { label: 'Pending review', color: ACCENT },
  queried: { label: 'Queried sub', color: '#7c3aed' },
  approved: { label: 'Approved', color: GREEN },
  rejected: { label: 'Rejected', color: '#dc2626' },
};

const SAMPLE_APPROVALS = [
  {
    id: 'JC-001',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    subScore: 94,
    contract: '{{ACERTA June 26}}',
    spec: 'Monthly · in & out hand-height',
    value: 200,
    submitted: '2h ago',
    status: 'pending',
    checkIn: '07:00',
    checkOut: '08:58',
    onSiteMin: 118,
    scheduledMin: 120,
    geoIn: true,
    geoOut: true,
    photos: { before: 3, after: 3, signOff: 1 },
    checklist: { done: 12, total: 12 },
    pattern: {
      match: 96,
      comparedTo: 12,
      note: 'Consistent with last 12 visits · photo angles + times match',
    },
    flags: [],
  },
  {
    id: 'JC-004',
    site: '{{Aston Martin Mayfair}}',
    region: 'London',
    sub: '{{Sub Co. C}}',
    subId: 'C',
    subScore: 91,
    contract: '{{ACERTA June 26}}',
    spec: 'Monthly · in & out hand-height',
    value: 120,
    submitted: '20m ago',
    status: 'pending',
    checkIn: '07:04',
    checkOut: '08:50',
    geoIn: true,
    geoOut: true,
    photos: { before: 2, after: 3, signOff: 1 },
    checklist: { done: 11, total: 12 },
    pattern: {
      match: 88,
      comparedTo: 9,
      note: '1 checklist item skipped · photos otherwise consistent',
    },
    flags: [{ kind: 'warn', text: '1 checklist item unchecked' }],
  },
  {
    id: 'JC-003',
    site: '{{Vauxhall Bedford}}',
    region: 'Bedfordshire & Bucks',
    sub: '{{Sub Co. A}}',
    subId: 'A',
    subScore: 94,
    contract: '{{ACERTA June 26}}',
    spec: 'Monthly · in & out hand-height',
    value: 45,
    submitted: 'yesterday',
    status: 'queried',
    checkIn: '08:28',
    checkOut: '09:14',
    geoIn: true,
    geoOut: false,
    photos: { before: 1, after: 2, signOff: 0 },
    checklist: { done: 7, total: 12 },
    pattern: {
      match: 61,
      comparedTo: 14,
      note: 'Check-out outside fence · sign-off missing · low photo count',
    },
    flags: [
      { kind: 'flag', text: 'Check-out 110m outside geo-fence' },
      { kind: 'flag', text: '5 of 12 checklist items missed' },
      { kind: 'warn', text: 'Sign-off not captured' },
    ],
    queryNote:
      'Why was check-out outside the fence? Please resubmit photos of vehicle bay & sign-off.',
  },
  {
    id: 'JC-002',
    site: '{{Volvo Derby}}',
    region: 'Midlands',
    sub: '{{Sub Co. D}}',
    subId: 'D',
    subScore: 82,
    contract: '{{ACERTA June 26}}',
    spec: 'Monthly · in & out hand-height',
    value: 70,
    submitted: 'today 14:02',
    status: 'approved',
    checkIn: '13:00',
    checkOut: '14:04',
    onSiteMin: 64,
    scheduledMin: 60,
    geoIn: true,
    geoOut: true,
    photos: { before: 2, after: 2, signOff: 1 },
    checklist: { done: 8, total: 8 },
    pattern: { match: 94, comparedTo: 6, note: 'Matches last 6 visits' },
    flags: [],
  },
];

function PhotoSlot({ label, accent, num }) {
  return (
    <div
      style={{
        border: `1.5px dashed ${LINE}`,
        borderRadius: 6,
        background: '#fafbff',
        aspectRatio: '4 / 3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        position: 'relative',
      }}
    >
      <Camera size={14} color={accent} />
      <span style={{ fontSize: 8, color: SUB, fontWeight: 800, letterSpacing: '0.08em' }}>
        {label}
      </span>
      {num !== undefined && (
        <span
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            fontSize: 8,
            fontWeight: 800,
            color: accent,
            background: PAPER,
            padding: '1px 6px',
            borderRadius: 999,
          }}
        >
          {num}
        </span>
      )}
    </div>
  );
}

function ApprovalCard({ job, onOpen, isOpen }) {
  const status = APPROVAL_STATUS[job.status];
  const checklistOk = job.checklist.done === job.checklist.total;
  return (
    <div
      onClick={() => onOpen(job.id)}
      style={{
        background: PAPER,
        border: `1px solid ${isOpen ? `${ACCENT}40` : LINE}`,
        borderLeft: `4px solid ${status.color}`,
        borderRadius: 10,
        padding: 14,
        cursor: 'pointer',
        boxShadow: isOpen ? `0 0 0 3px ${ACCENT}15` : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{job.site}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: status.color,
                background: `${status.color}15`,
                padding: '2px 7px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </span>
            {job.flags.length === 0 ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: GREEN,
                  background: `${GREEN}12`,
                  padding: '2px 7px',
                  borderRadius: 999,
                }}
              >
                ✓ clean
              </span>
            ) : job.flags.some((f) => f.kind === 'flag') ? (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#dc2626',
                  background: '#fee2e2',
                  padding: '2px 7px',
                  borderRadius: 999,
                }}
              >
                ⚠ {job.flags.length} flag{job.flags.length === 1 ? '' : 's'}
              </span>
            ) : (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#a16207',
                  background: '#fef3c7',
                  padding: '2px 7px',
                  borderRadius: 999,
                }}
              >
                ⚠ {job.flags.length} warn{job.flags.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: SUB,
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ color: INK }}>{job.sub}</strong>
            <span>· score {job.subScore}</span>
            <span>· {job.spec}</span>
            <span>· submitted {job.submitted}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: INK, lineHeight: 1 }}>
            £{job.value}
          </div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{job.contract}</div>
        </div>
      </div>

      {/* Trust signals strip — geo + evidence + checklist + sign-off (no time emphasis) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 10 }}
      >
        <div
          style={{
            background: '#fafbff',
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>CHECK-IN</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: job.geoIn ? GREEN : '#dc2626' }}>
            {job.checkIn} · {job.geoIn ? '✓ in fence' : '✗ outside'}
          </div>
        </div>
        <div
          style={{
            background: '#fafbff',
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>CHECK-OUT</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: job.geoOut ? GREEN : '#dc2626' }}>
            {job.checkOut} · {job.geoOut ? '✓ in fence' : '✗ outside'}
          </div>
        </div>
        <div
          style={{
            background: '#fafbff',
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>PHOTOS</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>
            {job.photos.before} before · {job.photos.after} after
          </div>
        </div>
        <div
          style={{
            background: '#fafbff',
            border: `1px solid ${LINE}`,
            borderRadius: 6,
            padding: '6px 8px',
          }}
        >
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>CHECKLIST · SIGN-OFF</div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: checklistOk && job.photos.signOff > 0 ? GREEN : '#a16207',
            }}
          >
            {job.checklist.done}/{job.checklist.total} ·{' '}
            {job.photos.signOff > 0 ? 'signed' : 'missing'}
          </div>
        </div>
      </div>

      {/* Pattern match */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 7,
          background:
            job.pattern.match >= 90
              ? `${GREEN}08`
              : job.pattern.match >= 75
                ? '#fef3c7'
                : '#fee2e2',
          border: `1px solid ${job.pattern.match >= 90 ? `${GREEN}25` : job.pattern.match >= 75 ? '#fcd34d' : '#fca5a5'}`,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            border: `2.5px solid ${job.pattern.match >= 90 ? GREEN : job.pattern.match >= 75 ? '#a16207' : '#dc2626'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            color:
              job.pattern.match >= 90 ? GREEN : job.pattern.match >= 75 ? '#a16207' : '#dc2626',
          }}
        >
          {job.pattern.match}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>
            Pattern match vs last {job.pattern.comparedTo} visits
          </div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{job.pattern.note}</div>
        </div>
      </div>

      {/* Action row */}
      {job.status === 'pending' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 800,
              color: 'white',
              background: GREEN,
              border: 'none',
              borderRadius: 7,
              padding: '9px 0',
              cursor: 'pointer',
            }}
          >
            ✓ Approve · release invoice
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#7c3aed',
              background: '#7c3aed10',
              border: '1px solid #7c3aed30',
              borderRadius: 7,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            Query sub
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#b91c1c',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 7,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
        </div>
      )}
      {job.status === 'queried' && (
        <div
          style={{
            padding: '8px 10px',
            background: '#7c3aed08',
            border: '1px solid #7c3aed25',
            borderRadius: 7,
            fontSize: 11,
            color: '#5b21b6',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Send size={12} />
          Query sent: <em style={{ color: INK }}>"{job.queryNote}"</em>
        </div>
      )}
      {job.status === 'approved' && (
        <div
          style={{
            padding: '8px 10px',
            background: `${GREEN}08`,
            border: `1px solid ${GREEN}25`,
            borderRadius: 7,
            fontSize: 11,
            color: GREEN,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 700,
          }}
        >
          <CheckCircle2 size={12} />
          Approved · £{job.value} invoice draft created for sub
        </div>
      )}
    </div>
  );
}

function ApprovalDrawer({ job, onClose, tab, setTab }) {
  if (!job) return null;
  const status = APPROVAL_STATUS[job.status];
  const TABS = ['Evidence', 'Check-in / out', 'Site context', 'Two-way review'];

  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${status.color}08, transparent)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: status.color,
                background: `${status.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </span>
            <span style={{ fontSize: 10, color: MUTE }}>
              #{job.id} · submitted {job.submitted}
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{job.site}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>
            <MapPin
              size={10}
              style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }}
            />
            {job.region} · <strong>{job.sub}</strong> · score {job.subScore}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 0,
          padding: '0 20px',
          background: '#fafbff',
          borderBottom: `1px solid ${LINE}`,
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            style={{
              fontSize: 11,
              fontWeight: tab === i ? 800 : 600,
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === i ? ACCENT : SUB,
              borderBottom: tab === i ? `2px solid ${ACCENT}` : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ padding: 20 }}>
        {tab === 0 && (
          <div>
            {job.flags.length > 0 && (
              <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {job.flags.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      borderRadius: 7,
                      background: f.kind === 'flag' ? '#fee2e2' : '#fef3c7',
                      border: `1px solid ${f.kind === 'flag' ? '#fca5a5' : '#fcd34d'}`,
                      fontSize: 11,
                      color: f.kind === 'flag' ? '#b91c1c' : '#a16207',
                      fontWeight: 700,
                    }}
                  >
                    <AlertCircle size={13} />
                    {f.text}
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Before · {job.photos.before} photo{job.photos.before === 1 ? '' : 's'}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 6,
                marginBottom: 14,
              }}
            >
              {Array.from({ length: job.photos.before }).map((_, i) => (
                <PhotoSlot key={i} label="BEFORE" accent={NAVY} num={i + 1} />
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              After · {job.photos.after} photo{job.photos.after === 1 ? '' : 's'}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 6,
                marginBottom: 14,
              }}
            >
              {Array.from({ length: job.photos.after }).map((_, i) => (
                <PhotoSlot key={i} label="AFTER" accent={ACCENT} num={i + 1} />
              ))}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Sign-off + checklist
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              {job.photos.signOff > 0 ? (
                <PhotoSlot label="SIGN-OFF" accent={GREEN} />
              ) : (
                <div
                  style={{
                    border: `1.5px dashed #fca5a5`,
                    borderRadius: 6,
                    background: '#fee2e2',
                    aspectRatio: '4 / 3',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    color: '#b91c1c',
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  <AlertCircle size={14} /> SIGN-OFF MISSING
                </div>
              )}
              <div
                style={{
                  background: '#fafbff',
                  border: `1px solid ${LINE}`,
                  borderRadius: 6,
                  padding: 10,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: SUB,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Checklist
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: job.checklist.done === job.checklist.total ? GREEN : '#a16207',
                    }}
                  >
                    {job.checklist.done}/{job.checklist.total}
                  </span>
                </div>
                <div style={{ height: 6, background: SOFT, borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(job.checklist.done / job.checklist.total) * 100}%`,
                      background: job.checklist.done === job.checklist.total ? GREEN : '#a16207',
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 8 }}>
                  {job.checklist.done === job.checklist.total
                    ? 'All items confirmed by sub on site.'
                    : `${job.checklist.total - job.checklist.done} items unchecked — see Site context for the spec list.`}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div
              style={{
                padding: 16,
                background: `${job.geoIn ? GREEN : '#dc2626'}06`,
                border: `1px solid ${job.geoIn ? GREEN : '#dc2626'}25`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Check-in
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: INK, lineHeight: 1 }}>
                {job.checkIn}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: job.geoIn ? GREEN : '#dc2626',
                  marginTop: 8,
                }}
              >
                {job.geoIn ? '✓ Inside 80m geo-fence' : '✗ Outside geo-fence'}
              </div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>
                Sub tapped check-in at this stamp.
              </div>
            </div>
            <div
              style={{
                padding: 16,
                background: `${job.geoOut ? GREEN : '#dc2626'}06`,
                border: `1px solid ${job.geoOut ? GREEN : '#dc2626'}25`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Check-out
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: INK, lineHeight: 1 }}>
                {job.checkOut}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: job.geoOut ? GREEN : '#dc2626',
                  marginTop: 8,
                }}
              >
                {job.geoOut ? '✓ Inside 80m geo-fence' : '✗ Outside geo-fence (110m)'}
              </div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 4 }}>
                Evidence + sign-off submitted at this stamp.
              </div>
            </div>
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 12,
                background: '#fafbff',
                border: `1px dashed ${LINE}`,
                borderRadius: 10,
                fontSize: 11,
                color: SUB,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: INK }}>Exterior work is paid per visit, not per hour.</strong>{' '}
              Time on site is recorded for the immutable log but isn't a trust signal — Cadi judges
              the visit on geo-fence + evidence + checklist + sign-off.
            </div>
          </div>
        )}

        {tab === 2 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              This visit vs the site's history
            </div>
            <div
              style={{
                background: PAPER,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '90px 1fr 80px 100px 80px',
                  padding: '8px 14px',
                  background: SOFT,
                  fontSize: 9,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                <div>Date</div>
                <div>Sub</div>
                <div>Photos</div>
                <div>Checklist</div>
                <div>Status</div>
              </div>
              {[
                {
                  date: 'This visit',
                  sub: job.sub,
                  photos: job.photos.before + job.photos.after,
                  list: `${job.checklist.done}/${job.checklist.total}`,
                  status: 'this',
                },
                { date: 'Last month', sub: job.sub, photos: 6, list: '12/12', status: 'approved' },
                { date: '2 mo ago', sub: job.sub, photos: 6, list: '12/12', status: 'approved' },
                { date: '3 mo ago', sub: job.sub, photos: 7, list: '12/12', status: 'approved' },
                {
                  date: '4 mo ago',
                  sub: '{{prev sub}}',
                  photos: 5,
                  list: '11/12',
                  status: 'approved',
                },
              ].map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 80px 100px 80px',
                    padding: '10px 14px',
                    borderTop: `1px solid ${SOFT}`,
                    fontSize: 11,
                    alignItems: 'center',
                    background: r.status === 'this' ? `${ACCENT}05` : 'transparent',
                  }}
                >
                  <span
                    style={{
                      color: r.status === 'this' ? ACCENT : INK,
                      fontWeight: r.status === 'this' ? 800 : 700,
                    }}
                  >
                    {r.date}
                  </span>
                  <span style={{ color: SUB }}>{r.sub}</span>
                  <span style={{ color: INK }}>{r.photos}</span>
                  <span style={{ color: SUB }}>{r.list}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: r.status === 'this' ? ACCENT : GREEN,
                      background: r.status === 'this' ? `${ACCENT}12` : `${GREEN}12`,
                      padding: '3px 8px',
                      borderRadius: 999,
                      justifySelf: 'flex-start',
                    }}
                  >
                    {r.status === 'this' ? 'reviewing' : 'approved'}
                  </span>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                fontSize: 11,
                color: '#334155',
              }}
            >
              <strong style={{ color: INK }}>Pattern match: {job.pattern.match}/100</strong> —{' '}
              {job.pattern.note}
            </div>
          </div>
        )}

        {tab === 3 && (
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Rate this visit · feeds into the sub's Connect score
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['Evidence quality', 'Site finish', 'Sign-off captured', 'Communication'].map(
                (d) => (
                  <div
                    key={d}
                    style={{
                      background: '#fafbff',
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: INK, marginBottom: 6 }}>
                      {d}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span
                          key={s}
                          style={{ fontSize: 16, color: s <= 4 ? '#f59e0b' : '#e2e8f0' }}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SUB,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Optional note (visible to sub)
              </div>
              <Box
                h={64}
                style={{ alignItems: 'flex-start', justifyContent: 'flex-start' }}
              >{`{{Write feedback…}}`}</Box>
            </div>
            <div
              style={{
                marginTop: 14,
                padding: 12,
                background: `${ACCENT}06`,
                border: `1px solid ${ACCENT}25`,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Star size={14} color={ACCENT} />
              <div style={{ flex: 1, fontSize: 11, color: '#334155' }}>
                Sub also rates <strong>your FM</strong> on payment speed, scope clarity, dispute
                fairness. Both ratings appear on every marketplace bid.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky decision footer */}
      {job.status === 'pending' && (
        <div
          style={{
            borderTop: `1px solid ${LINE}`,
            background: SOFT,
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ flex: 1, fontSize: 11, color: SUB }}>
            <strong style={{ color: INK }}>Approve</strong> creates the £{job.value} invoice draft
            on the sub's side · <strong style={{ color: '#7c3aed' }}>Query</strong> reopens for
            resubmit · <strong style={{ color: '#b91c1c' }}>Reject</strong> closes job + flags for
            re-dispatch
          </div>
          <button
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#b91c1c',
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 7,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Reject
          </button>
          <button
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#7c3aed',
              background: '#7c3aed10',
              border: '1px solid #7c3aed30',
              borderRadius: 7,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Query sub
          </button>
          <button
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: 'white',
              background: GREEN,
              border: 'none',
              borderRadius: 7,
              padding: '8px 16px',
              cursor: 'pointer',
            }}
          >
            ✓ Approve · release £{job.value}
          </button>
        </div>
      )}
    </div>
  );
}

function Approval() {
  const [openId, setOpenId] = useState(null);
  const [tab, setTab] = useState(0);
  const [statusFilter, setStatusFilter] = useState('pending');

  const filtered = SAMPLE_APPROVALS.filter((a) => a.status === statusFilter);
  const openJob = SAMPLE_APPROVALS.find((a) => a.id === openId);

  const counts = {
    pending: SAMPLE_APPROVALS.filter((a) => a.status === 'pending').length,
    queried: SAMPLE_APPROVALS.filter((a) => a.status === 'queried').length,
    approved: SAMPLE_APPROVALS.filter((a) => a.status === 'approved').length,
    rejected: SAMPLE_APPROVALS.filter((a) => a.status === 'rejected').length,
  };
  const pendingValue = SAMPLE_APPROVALS.filter((a) => a.status === 'pending').reduce(
    (acc, a) => acc + a.value,
    0
  );
  const flaggedCount = SAMPLE_APPROVALS.filter(
    (a) => a.status === 'pending' && a.flags.length > 0
  ).length;
  const cleanCount = counts.pending - flaggedCount;

  return (
    <div>
      <ScreenHeader
        title="Work approval"
        subtitle="Evidence + check-in/out stamps land here. Approve → invoice. Query → back to sub. Reject → re-dispatch."
      />

      {/* KPI strip */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          {
            l: 'Pending review',
            v: counts.pending,
            c: ACCENT,
            sub: `£${pendingValue} in invoice value`,
            pulse: !!counts.pending,
          },
          { l: 'Clean · auto-eligible', v: cleanCount, c: GREEN, sub: 'no flags · match ≥90' },
          {
            l: 'Flagged',
            v: flaggedCount,
            c: flaggedCount ? '#a16207' : MUTE,
            sub: flaggedCount ? 'review carefully' : 'all clear',
          },
          {
            l: 'Queried · awaiting sub',
            v: counts.queried,
            c: '#7c3aed',
            sub: 'in resubmit thread',
          },
          { l: 'Avg decision time', v: '11m', c: NAVY, sub: 'last 30 days' },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
              {s.pulse && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: s.c,
                    animation: 'pulse 1.4s infinite',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
            <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Bulk action banner */}
      {cleanCount > 0 && statusFilter === 'pending' && (
        <div
          style={{
            background: `${GREEN}06`,
            border: `1px solid ${GREEN}25`,
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${GREEN}15`,
              color: GREEN,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircle2 size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>
              {cleanCount} job{cleanCount === 1 ? '' : 's'} ready for bulk approve
            </div>
            <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
              Geo-fence ✓ both stamps · evidence complete · pattern match ≥90 vs site history. Cadi
              recommends.
            </div>
          </div>
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'white',
              background: GREEN,
              border: 'none',
              borderRadius: 7,
              padding: '8px 14px',
              cursor: 'pointer',
            }}
          >
            Review &amp; bulk approve
          </button>
        </div>
      )}

      {/* Status filter tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: 4,
        }}
      >
        {[
          { id: 'pending', label: 'Pending review', cfg: APPROVAL_STATUS.pending },
          { id: 'queried', label: 'Queried · sub', cfg: APPROVAL_STATUS.queried },
          { id: 'approved', label: 'Approved today', cfg: APPROVAL_STATUS.approved },
          { id: 'rejected', label: 'Rejected', cfg: APPROVAL_STATUS.rejected },
        ].map((t) => {
          const isActive = statusFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                padding: '6px 10px',
                borderRadius: 6,
                background: isActive ? `${t.cfg.color}12` : 'transparent',
                color: isActive ? t.cfg.color : SUB,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 9,
                  color: isActive ? t.cfg.color : MUTE,
                  background: isActive ? `${t.cfg.color}15` : SOFT,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 30,
              textAlign: 'center',
              background: '#fafbff',
              border: `1.5px dashed ${LINE}`,
              borderRadius: 10,
              color: MUTE,
              fontSize: 12,
            }}
          >
            Nothing in this queue.
          </div>
        ) : (
          filtered.map((job) => (
            <ApprovalCard
              key={job.id}
              job={job}
              isOpen={openId === job.id}
              onOpen={(id) => {
                setOpenId(id === openId ? null : id);
                setTab(0);
              }}
            />
          ))
        )}
      </div>

      {/* Drawer */}
      {openJob && (
        <ApprovalDrawer job={openJob} onClose={() => setOpenId(null)} tab={tab} setTab={setTab} />
      )}

      <Annot>
        Exterior work is paid per visit — Cadi judges the visit on three things, time-on-site isn't
        one of them: <strong>geo-fence on both stamps</strong> (check-in + check-out) ·{' '}
        <strong>evidence completeness</strong> (photos + checklist + sign-off) ·{' '}
        <strong>pattern match</strong> vs the site's history with this sub. Approve writes an
        invoice draft on the sub's side (lands in Accounts inbox after the sub submits). Query opens
        a thread, sub resubmits. Reject closes + flips back into the schedule for re-dispatch.
        Two-way review is optional but feeds the sub's Connect score and powers marketplace ranking.
      </Annot>
    </div>
  );
}

const ACCOUNTS_STATUS = {
  ready: { label: 'Ready to export', color: ACCENT },
  exported: { label: 'Exported', color: '#7c3aed' },
  paid: { label: 'Marked paid', color: GREEN },
};

const SAMPLE_ACCOUNTS = [
  {
    id: 'JC-001',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    sub: '{{Sub Co. A}}',
    vat: 'VAT-reg',
    cis: false,
    approved: 'Today 10:14',
    value: 200,
    status: 'ready',
  },
  {
    id: 'JC-002',
    site: '{{Volvo Derby}}',
    region: 'Midlands',
    sub: '{{Sub Co. D}}',
    vat: '—',
    cis: true,
    approved: 'Today 14:08',
    value: 70,
    status: 'ready',
  },
  {
    id: 'JC-004',
    site: '{{Aston Martin Mayfair}}',
    region: 'London',
    sub: '{{Sub Co. C}}',
    vat: 'VAT-reg',
    cis: false,
    approved: 'Yesterday',
    value: 120,
    status: 'ready',
  },
  {
    id: 'JC-031',
    site: '{{Vauxhall Bedford}}',
    region: 'Bedfordshire & Bucks',
    sub: '{{Sub Co. A}}',
    vat: 'VAT-reg',
    cis: false,
    approved: '4 days ago',
    value: 45,
    status: 'exported',
    exportedOn: '20 Jun',
    exportedBy: '{{you}}',
  },
  {
    id: 'JC-029',
    site: '{{Vauxhall Portsmouth}}',
    region: 'South',
    sub: '{{Sub Co. F}}',
    vat: '—',
    cis: true,
    approved: '6 days ago',
    value: 100,
    status: 'exported',
    exportedOn: '20 Jun',
    exportedBy: '{{you}}',
  },
  {
    id: 'JC-018',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    sub: '{{Sub Co. A}}',
    vat: 'VAT-reg',
    cis: false,
    approved: '12 days ago',
    value: 200,
    status: 'paid',
    exportedOn: '14 Jun',
    paidOn: '18 Jun',
  },
  {
    id: 'JC-014',
    site: '{{Volvo Derby}}',
    region: 'Midlands',
    sub: '{{Sub Co. D}}',
    vat: '—',
    cis: true,
    approved: '14 days ago',
    value: 70,
    status: 'paid',
    exportedOn: '14 Jun',
    paidOn: '17 Jun',
  },
];

const EXPORT_LOG = [
  {
    when: '20 Jun · 16:42',
    who: '{{you}}',
    rows: 2,
    total: 145,
    format: 'CSV',
    file: 'cadi-acerta-payruns-2026-06-20.csv',
  },
  {
    when: '14 Jun · 09:08',
    who: '{{you}}',
    rows: 5,
    total: 765,
    format: 'CSV',
    file: 'cadi-acerta-payruns-2026-06-14.csv',
  },
  {
    when: '31 May · 18:11',
    who: '{{you}}',
    rows: 12,
    total: 1820,
    format: 'Excel',
    file: 'cadi-acerta-payruns-2026-05-31.xlsx',
  },
];

function AccountsRow({ row, selected, onSelect, onOpen }) {
  const status = ACCOUNTS_STATUS[row.status];
  return (
    <div
      onClick={() => onOpen(row.id)}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr 1.5fr 1fr 1fr 0.6fr 0.8fr 100px',
        padding: '12px 14px',
        borderTop: `1px solid ${SOFT}`,
        alignItems: 'center',
        fontSize: 11,
        background: selected ? `${ACCENT}05` : PAPER,
        cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(row.id);
        }}
        onClick={(e) => e.stopPropagation()}
        style={{ accentColor: ACCENT }}
        disabled={row.status !== 'ready'}
      />
      <div>
        <div style={{ fontWeight: 800, color: INK }}>{row.sub}</div>
        <div style={{ fontSize: 9, color: MUTE, marginTop: 1 }}>
          {row.vat}
          {row.cis ? ' · CIS' : ''}
        </div>
      </div>
      <div>
        <div style={{ color: INK, fontWeight: 700 }}>{row.site}</div>
        <div style={{ fontSize: 9, color: MUTE, marginTop: 1 }}>
          {row.region} · {row.id}
        </div>
      </div>
      <span style={{ color: SUB, fontSize: 10 }}>{row.approved}</span>
      <span style={{ color: row.status === 'paid' ? GREEN : INK, fontWeight: 800, fontSize: 13 }}>
        £{row.value}
      </span>
      <span style={{ color: SUB, fontSize: 10 }}>{row.exportedOn || '—'}</span>
      <span
        style={{
          color: row.paidOn ? GREEN : SUB,
          fontSize: 10,
          fontWeight: row.paidOn ? 700 : 500,
        }}
      >
        {row.paidOn || '—'}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: status.color,
          background: `${status.color}12`,
          padding: '3px 8px',
          borderRadius: 999,
          justifySelf: 'flex-start',
        }}
      >
        {status.label}
      </span>
    </div>
  );
}

function AccountsDrawer({ row, onClose }) {
  if (!row) return null;
  const status = ACCOUNTS_STATUS[row.status];
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          background: `linear-gradient(180deg, ${status.color}08, transparent)`,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: status.color,
                background: `${status.color}15`,
                padding: '3px 8px',
                borderRadius: 999,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {status.label}
            </span>
            <span style={{ fontSize: 10, color: MUTE }}>
              #{row.id} · approved {row.approved}
            </span>
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{row.site}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 3 }}>
            <strong>{row.sub}</strong> · {row.region} · £{row.value}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            View evidence
          </button>
          {row.status !== 'paid' && (
            <button
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'white',
                background: GREEN,
                border: 'none',
                borderRadius: 7,
                padding: '6px 10px',
                cursor: 'pointer',
              }}
            >
              Mark paid
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              fontSize: 14,
              color: MUTE,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 6px',
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Payment data (per row in export)
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 6, fontSize: 11 }}
          >
            <span style={{ color: SUB }}>Sub</span>
            <span style={{ color: INK, fontWeight: 700 }}>{row.sub}</span>
            <span style={{ color: SUB }}>VAT status</span>
            <span style={{ color: INK, fontWeight: 700 }}>{row.vat}</span>
            <span style={{ color: SUB }}>CIS deduction</span>
            <span style={{ color: INK, fontWeight: 700 }}>
              {row.cis ? '20% (subcontractor)' : '—'}
            </span>
            <span style={{ color: SUB }}>Job reference</span>
            <span style={{ color: INK, fontWeight: 700 }}>{row.id}</span>
            <span style={{ color: SUB }}>Site</span>
            <span style={{ color: INK, fontWeight: 700 }}>{row.site}</span>
            <span style={{ color: SUB }}>Service date</span>
            <span style={{ color: INK, fontWeight: 700 }}>{row.approved}</span>
            <span style={{ color: SUB }}>Net value</span>
            <span style={{ color: INK, fontWeight: 800 }}>£{row.value}</span>
            <span style={{ color: SUB }}>Bank details</span>
            <span style={{ color: INK, fontWeight: 700 }}>{`{{sort + acct on file}}`}</span>
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Audit trail
          </div>
          <div
            style={{
              background: '#fafbff',
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 12,
            }}
          >
            {[
              { e: 'Job completed + evidence submitted', d: row.approved, ok: true },
              { e: 'Approved by FM ops', d: row.approved, ok: true },
              {
                e: 'Exported to accounts file',
                d: row.exportedOn || 'pending',
                ok: !!row.exportedOn,
              },
              { e: 'Marked paid by accounts', d: row.paidOn || 'pending', ok: !!row.paidOn },
            ].map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '5px 0',
                  fontSize: 11,
                  borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: s.ok ? GREEN : LINE,
                  }}
                />
                <span style={{ color: INK, fontWeight: 700, flex: 1 }}>{s.e}</span>
                <span style={{ color: s.ok ? SUB : MUTE, fontSize: 10 }}>{s.d}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Accounts() {
  const [statusFilter, setStatusFilter] = useState('ready');
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [period, setPeriod] = useState('Jun 2026');
  const [groupBy, setGroupBy] = useState('sub');

  const filtered = SAMPLE_ACCOUNTS.filter((r) => r.status === statusFilter);
  const openRow = SAMPLE_ACCOUNTS.find((r) => r.id === openId);

  const counts = {
    ready: SAMPLE_ACCOUNTS.filter((r) => r.status === 'ready').length,
    exported: SAMPLE_ACCOUNTS.filter((r) => r.status === 'exported').length,
    paid: SAMPLE_ACCOUNTS.filter((r) => r.status === 'paid').length,
  };
  const value = {
    ready: SAMPLE_ACCOUNTS.filter((r) => r.status === 'ready').reduce((a, r) => a + r.value, 0),
    exported: SAMPLE_ACCOUNTS.filter((r) => r.status === 'exported').reduce(
      (a, r) => a + r.value,
      0
    ),
    paid: SAMPLE_ACCOUNTS.filter((r) => r.status === 'paid').reduce((a, r) => a + r.value, 0),
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const allReadyIds = SAMPLE_ACCOUNTS.filter((r) => r.status === 'ready').map((r) => r.id);
  const selectAll = () => setSelected(new Set(allReadyIds));
  const clearSel = () => setSelected(new Set());
  const selectedValue = SAMPLE_ACCOUNTS.filter((r) => selected.has(r.id)).reduce(
    (a, r) => a + r.value,
    0
  );

  return (
    <div>
      <ScreenHeader
        title="Accounts export"
        subtitle="We gather + approve. Britannia's accounts team handles payment. Download a file — they take it from there."
      />

      {/* KPI strip */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          {
            l: 'Approved · ready to export',
            v: counts.ready,
            sub: `£${value.ready} outstanding`,
            c: ACCENT,
            pulse: !!counts.ready,
          },
          {
            l: 'Exported · awaiting payment',
            v: counts.exported,
            sub: `£${value.exported} in flight`,
            c: '#7c3aed',
          },
          { l: 'Paid this month', v: counts.paid, sub: `£${value.paid} settled`, c: GREEN },
          { l: 'Last export', v: '20 Jun', sub: '2 rows · £145 · CSV', c: NAVY },
        ].map((s) => (
          <div
            key={s.l}
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
              {s.pulse && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: s.c,
                    animation: 'pulse 1.4s infinite',
                  }}
                />
              )}
            </div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
            <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Export panel */}
      <div
        style={{
          background: `linear-gradient(135deg, ${ACCENT}06, ${NAVY}03)`,
          border: `1px solid ${ACCENT}25`,
          borderRadius: 12,
          padding: 18,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: ACCENT,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Download size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>Export to accounts file</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
              One row per approved job · ready to drop into Britannia's payment workflow (BACS /
              Xero / Sage import).
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <label
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Period
            </label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {['Jun 2026', 'May 2026', 'Custom'].map((p) => (
                <span
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    fontSize: 10,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${period === p ? ACCENT : LINE}`,
                    background: period === p ? `${ACCENT}10` : PAPER,
                    color: period === p ? ACCENT : SUB,
                    fontWeight: period === p ? 800 : 600,
                    flex: 1,
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Group by
            </label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {[
                { k: 'sub', l: 'Sub' },
                { k: 'region', l: 'Region' },
                { k: 'flat', l: 'Flat list' },
              ].map((g) => (
                <span
                  key={g.k}
                  onClick={() => setGroupBy(g.k)}
                  style={{
                    fontSize: 10,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${groupBy === g.k ? NAVY : LINE}`,
                    background: groupBy === g.k ? `${NAVY}08` : PAPER,
                    color: groupBy === g.k ? NAVY : SUB,
                    fontWeight: groupBy === g.k ? 800 : 600,
                    flex: 1,
                    textAlign: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {g.l}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Selection
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 4,
                padding: '6px 10px',
                borderRadius: 6,
                background: PAPER,
                border: `1px solid ${LINE}`,
              }}
            >
              <span style={{ fontSize: 11, color: INK, fontWeight: 700, flex: 1 }}>
                {selected.size || allReadyIds.length} of {allReadyIds.length} rows · £
                {selectedValue || value.ready}
              </span>
              <button
                onClick={selectAll}
                style={{
                  fontSize: 10,
                  color: ACCENT,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                All
              </button>
              <button
                onClick={clearSel}
                style={{
                  fontSize: 10,
                  color: SUB,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                None
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
              color: 'white',
              background: ACCENT,
              border: 'none',
              borderRadius: 8,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Download CSV
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 800,
              color: INK,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            <Download size={13} /> Download Excel
          </button>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 8,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            <FileText size={13} /> PDF summary
          </button>
          <div style={{ flex: 1 }} />
          <button
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SUB,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            What's in the export →
          </button>
        </div>

        {/* File preview */}
        <div
          style={{
            marginTop: 14,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: 10,
            fontFamily: 'ui-monospace,Menlo,monospace',
            fontSize: 10,
            color: SUB,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <FileText size={11} />
            <span style={{ color: INK, fontWeight: 700 }}>preview.csv</span>
            <span style={{ marginLeft: 'auto', color: MUTE }}>
              {counts.ready} rows · £{value.ready}
            </span>
          </div>
          <div style={{ color: '#7c3aed' }}>
            sub,vat_status,cis,job_ref,site,region,service_date,net_value,bank_sort,bank_acct,evidence_url
          </div>
          <div style={{ color: INK }}>
            Sub Co. A,VAT-reg,no,JC-001,Stratstone JLR Nottingham,Midlands,2026-06-24,200,
            {`{{sort}}`},{`{{acct}}`},…
          </div>
          <div style={{ color: INK }}>
            Sub Co. D,—,yes,JC-002,Volvo Derby,Midlands,2026-06-24,70,{`{{sort}}`},{`{{acct}}`},…
          </div>
          <div style={{ color: MUTE }}>… + {counts.ready - 2} more rows</div>
        </div>
      </div>

      {/* Status tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 12,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 8,
          padding: 4,
        }}
      >
        {[
          { id: 'ready', label: 'Ready to export' },
          { id: 'exported', label: 'Exported' },
          { id: 'paid', label: 'Marked paid' },
        ].map((t) => {
          const cfg = ACCOUNTS_STATUS[t.id];
          const isActive = statusFilter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              style={{
                fontSize: 11,
                fontWeight: isActive ? 800 : 600,
                padding: '6px 10px',
                borderRadius: 6,
                background: isActive ? `${cfg.color}12` : 'transparent',
                color: isActive ? cfg.color : SUB,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              {t.label}
              <span
                style={{
                  fontSize: 9,
                  color: isActive ? cfg.color : MUTE,
                  background: isActive ? `${cfg.color}15` : SOFT,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                {counts[t.id]}
              </span>
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        {statusFilter === 'exported' && (
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'white',
              background: GREEN,
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Bulk mark paid
          </button>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 1.5fr 1fr 1fr 0.6fr 0.8fr 100px',
            padding: '10px 14px',
            background: SOFT,
            fontSize: 9,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <div></div>
          <div>Sub</div>
          <div>Site / job</div>
          <div>Approved</div>
          <div>Net value</div>
          <div>Exported</div>
          <div>Paid</div>
          <div>Status</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: MUTE, fontSize: 12 }}>
            Nothing here.
          </div>
        ) : (
          filtered.map((r) => (
            <AccountsRow
              key={r.id}
              row={r}
              selected={selected.has(r.id)}
              onSelect={toggle}
              onOpen={(id) => setOpenId(id === openId ? null : id)}
            />
          ))
        )}
      </div>

      {/* Drawer */}
      {openRow && <AccountsDrawer row={openRow} onClose={() => setOpenId(null)} />}

      {/* Export log */}
      <div
        style={{
          marginTop: 16,
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Recent exports
          </span>
          <button
            style={{
              fontSize: 11,
              color: ACCENT,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            View all →
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EXPORT_LOG.map((e, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 80px 80px 90px',
                padding: '8px 10px',
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                fontSize: 11,
                alignItems: 'center',
              }}
            >
              <span style={{ color: SUB, fontSize: 10 }}>{e.when}</span>
              <span
                style={{ color: INK, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 10 }}
              >
                {e.file}
              </span>
              <span style={{ color: SUB, fontSize: 10 }}>{e.rows} rows</span>
              <span style={{ color: INK, fontWeight: 700, fontSize: 11 }}>£{e.total}</span>
              <button
                style={{
                  fontSize: 11,
                  color: ACCENT,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textAlign: 'right',
                }}
              >
                Re-download
              </button>
            </div>
          ))}
        </div>
      </div>

      <Annot>
        <strong>Out of scope for now:</strong> running payments. Cadi gathers the data + holds the
        approval, then hands off a file Britannia's accounts team imports into BACS / Xero / Sage.
        Once they've paid, you (or accounts) mark the row paid — that closes the loop visible to the
        sub. Export schema:{' '}
        <code>{`{ sub, vat_status, cis, job_ref, site, region, service_date, net_value, bank_sort, bank_acct, evidence_url }`}</code>
        .
      </Annot>
    </div>
  );
}

const SCREEN_MAP = {
  dash: Dash,
  contracts: Contracts,
  sites: Sites,
  contractors: Contractors,
  marketplace: Marketplace,
  schedule: Schedule,
  approval: Approval,
  accounts: Accounts,
};

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

export default function FmOpsPortalWireframe() {
  const [active, setActive] = useState('dash');
  const Screen = SCREEN_MAP[active];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: BG,
        display: 'flex',
        fontFamily: "'Satoshi','Inter',system-ui,sans-serif",
        color: INK,
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          background: PAPER,
          borderRight: `1px solid ${LINE}`,
          padding: '22px 14px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ padding: '0 6px 16px', borderBottom: `1px solid ${LINE}`, marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: '0.18em',
              color: SUB,
              textTransform: 'uppercase',
            }}
          >
            Wireframe
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: INK, marginTop: 2 }}>
            FM Ops Portal
          </div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>Exterior · sub-contracted</div>
        </div>
        {SCREENS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '8px 10px',
                borderRadius: 8,
                background: isActive ? `${ACCENT}10` : 'transparent',
                border: `1px solid ${isActive ? `${ACCENT}30` : 'transparent'}`,
                color: isActive ? ACCENT : '#475569',
                fontSize: 12,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                marginBottom: 2,
                textAlign: 'left',
              }}
            >
              <Icon size={14} />
              <span style={{ flex: 1 }}>{s.label}</span>
              {isActive && <ChevronRight size={12} />}
            </button>
          );
        })}
        <div
          style={{
            marginTop: 16,
            padding: 10,
            borderRadius: 8,
            background: SOFT,
            fontSize: 10,
            color: SUB,
            lineHeight: 1.5,
          }}
        >
          <strong style={{ color: INK, fontSize: 10 }}>Generic wireframe</strong> · drives any FM
          contract, not just Britannia. <code>{`{{tokens}}`}</code> are runtime values.
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '28px 36px', maxWidth: 1100 }}>
        <Screen />
      </div>
    </div>
  );
}
