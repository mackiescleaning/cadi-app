import { useState } from 'react';
import {
  Home,
  ShoppingBag,
  ClipboardList,
  Receipt,
  PoundSterling,
  Star,
  ChevronRight,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Award,
  Lock,
  FileText,
  Upload,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Cadi Connect tab — wireframe of the subcontractor's view inside their Cadi
// Mirror of the FM Ops Portal. Same data shapes; sub-side reframing.
// ─────────────────────────────────────────────────────────────────────────────

const NAVY = '#010a4f';
const INK = '#0f172a';
const MUTE = '#94a3b8';
const SUB = '#64748b';
const LINE = '#e2e8f0';
const SOFT = '#f1f5f9';
const PAPER = '#ffffff';
const BG = '#f8faff';
const ACCENT = '#C2410C';
const GREEN = '#16a34a';
const PURPLE = '#7c3aed';

const SCREENS = [
  { key: 'home', label: 'Connect home', icon: Home },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  { key: 'myjobs', label: 'My Jobs', icon: ClipboardList },
  { key: 'invoicing', label: 'Invoicing', icon: Receipt },
  { key: 'earnings', label: 'Earnings', icon: PoundSterling },
  { key: 'profile', label: 'My Profile', icon: Star },
];

const TIER_CFG = {
  elite: { label: 'Elite tier · ≥93', color: '#a78bfa' },
  verified: { label: 'Verified · ≥80', color: GREEN },
  eligible: { label: 'Eligible · ≥70', color: '#fbbf24' },
};

// Single fictional sub identity used across the wireframe
const ME = {
  name: '{{Sub Co. A}}',
  contact: '{{Priya N.}}',
  score: 88,
  tier: 'verified',
  region: 'Bedfordshire & Bucks',
  trades: ['Ext', 'High'],
  capacity: 12,
  activeSites: 5,
};

// ─────────────────────────────────────────────────────────────────────────────
// Reusable primitives
// ─────────────────────────────────────────────────────────────────────────────

function ScreenHeader({ title, subtitle, rightSlot }) {
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
      {rightSlot}
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

function Toolbar({ tabs, active, onChange, counts }) {
  return (
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
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange && onChange(t.id)}
            style={{
              fontSize: 11,
              fontWeight: isActive ? 800 : 600,
              padding: '6px 10px',
              borderRadius: 6,
              background: isActive ? `${ACCENT}12` : 'transparent',
              color: isActive ? ACCENT : SUB,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {t.label}
            {counts && counts[t.id] !== undefined && (
              <span
                style={{
                  fontSize: 9,
                  color: isActive ? ACCENT : MUTE,
                  background: isActive ? `${ACCENT}15` : SOFT,
                  padding: '1px 6px',
                  borderRadius: 999,
                  fontWeight: 800,
                }}
              >
                {counts[t.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function TierBadge({ tier, size = 'md' }) {
  const cfg = TIER_CFG[tier];
  const isSm = size === 'sm';
  return (
    <span
      style={{
        fontSize: isSm ? 9 : 10,
        fontWeight: 800,
        color: cfg.color,
        background: `${cfg.color}15`,
        padding: isSm ? '2px 7px' : '3px 9px',
        borderRadius: 999,
        border: `1px solid ${cfg.color}30`,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect home
// ─────────────────────────────────────────────────────────────────────────────

function HomeScreen({ onNav }) {
  return (
    <div>
      <ScreenHeader
        title={`Hi ${ME.contact} — Connect tier: Verified (${ME.score})`}
        subtitle={`${ME.region} · ${ME.activeSites} active sites of ${ME.capacity} capacity`}
        rightSlot={<TierBadge tier={ME.tier} />}
      />

      {/* New jobs alert */}
      <div
        style={{
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 14,
          background: `linear-gradient(135deg, ${ACCENT}10, ${ACCENT}04)`,
          border: `1px solid ${ACCENT}30`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: ACCENT,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShoppingBag size={18} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>
            3 new jobs match you in Marketplace
          </div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
            1 is Cadi-recommended — 30-min first refusal · 2 are open to your tier
          </div>
        </div>
        <button
          onClick={() => onNav('marketplace')}
          style={{
            background: ACCENT,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '9px 14px',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          Open Marketplace →
        </button>
      </div>

      {/* KPI cards */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Earned this month', v: '£1,840', sub: 'confirmed by FMs', c: GREEN },
          { l: 'Pending payment', v: '£760', sub: '4 jobs in FM accounts', c: ACCENT },
          { l: 'Jobs done · 30d', v: '23', sub: '21 approved · 2 pending', c: NAVY },
          { l: 'Connect score', v: ME.score, sub: 'Verified · 5 from Elite', c: PURPLE },
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
            <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Your pipeline
          </span>
          <button
            onClick={() => onNav('myjobs')}
            style={{
              fontSize: 11,
              color: ACCENT,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            Open My Jobs <ChevronRight size={11} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {[
            { l: 'Upcoming', n: 6, c: '#3b82f6' },
            { l: 'On site now', n: 1, c: ACCENT, pulse: true },
            { l: 'Awaiting evidence', n: 0, c: MUTE },
            { l: 'Pending FM review', n: 2, c: PURPLE },
            { l: 'Awaiting payment', n: 4, c: '#a16207' },
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: s.c,
                    animation: s.pulse ? 'pulse 1.4s infinite' : 'none',
                  }}
                />
                <span style={{ fontSize: 18, fontWeight: 900, color: INK }}>{s.n}</span>
              </div>
              <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Connected FMs */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Connected FMs
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            {
              fm: '{{Britannia Group}}',
              region: 'Bedfordshire + Bucks',
              since: 'Jan 2026',
              jobs: 47,
              rating: 4.8,
              earned: 3995,
              mine: 4.7,
            },
            {
              fm: '{{ISS Facility Services}}',
              region: 'London corridor',
              since: 'Apr 2026',
              jobs: 19,
              rating: 4.6,
              earned: 1480,
              mine: 4.5,
            },
          ].map((f) => (
            <div
              key={f.fm}
              style={{
                background: PAPER,
                border: `1px solid ${LINE}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: `linear-gradient(135deg, ${NAVY}, ${ACCENT})`,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 14,
                  }}
                >
                  {f.fm[2]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{f.fm}</div>
                  <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
                    {f.region} · since {f.since}
                  </div>
                </div>
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
                  Active
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                <div
                  style={{
                    background: '#fafbff',
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{f.jobs}</div>
                  <div style={{ fontSize: 9, color: SUB }}>jobs done</div>
                </div>
                <div
                  style={{
                    background: '#fafbff',
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>£{f.earned}</div>
                  <div style={{ fontSize: 9, color: SUB }}>earned</div>
                </div>
                <div
                  style={{
                    background: '#fafbff',
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
                    {f.rating} ★
                  </div>
                  <div style={{ fontSize: 9, color: SUB }}>their rating</div>
                </div>
                <div
                  style={{
                    background: '#fafbff',
                    borderRadius: 6,
                    padding: '6px 8px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>{f.mine} ★</div>
                  <div style={{ fontSize: 9, color: SUB }}>your rating</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Annot>
        Home is the sub's command surface — every state on the loop is one click away. KPIs and
        pipeline mirror the FM ops side so the two views can never drift. Two-way ratings appear per
        FM so subs can see who pays well, scopes clearly, and is fair on disputes.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Marketplace (sub side)
// ─────────────────────────────────────────────────────────────────────────────

const SUB_LISTINGS = [
  {
    id: 'BF-4501',
    fm: '{{Britannia Group}}',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    spec: 'Monthly · in & out hand-height',
    freq: 'Mon-Fri',
    price: 200,
    distance: 8,
    fit: 96,
    tier: 'verified',
    cadiPick: true,
    firstRefusalMins: 26,
    status: 'open',
    fmRating: { theyRate: 4.8, youRate: 4.7 },
  },
  {
    id: 'BF-4502',
    fm: '{{Britannia Group}}',
    site: '{{Porsche Nottingham}}',
    region: 'Midlands',
    spec: 'Monthly · in & out + Quarterly · high-level',
    freq: 'Mon-Fri',
    price: 300,
    distance: 22,
    fit: 89,
    tier: 'elite',
    cadiPick: false,
    firstRefusalMins: null,
    status: 'tier-locked',
    fmRating: { theyRate: 4.8, youRate: 4.7 },
  },
  {
    id: 'BF-4503',
    fm: '{{Britannia Group}}',
    site: '{{Audi Stockport}}',
    region: 'Midlands',
    spec: 'Monthly · in & out hand-height',
    freq: 'Mon-Fri',
    price: 340,
    distance: 12,
    fit: 87,
    tier: 'verified',
    cadiPick: false,
    firstRefusalMins: null,
    status: 'open',
    format: 'rate',
    fmRating: { theyRate: 4.8, youRate: 4.7 },
  },
  {
    id: 'IS-1021',
    fm: '{{ISS Facility Services}}',
    site: '{{Canary Wharf Tower 7}}',
    region: 'London',
    spec: 'Fortnightly · cladding wash',
    freq: 'Out-of-hours',
    price: 480,
    distance: 35,
    fit: 81,
    tier: 'verified',
    cadiPick: false,
    firstRefusalMins: null,
    status: 'open',
    fmRating: { theyRate: 4.6, youRate: 4.5 },
  },
];

function ListingCard({ listing, onOpen, isOpen }) {
  const tier = TIER_CFG[listing.tier];
  const fitColor = listing.fit >= 90 ? GREEN : listing.fit >= 80 ? '#3b82f6' : '#fbbf24';
  const locked = listing.status === 'tier-locked';
  return (
    <div
      onClick={() => onOpen(listing.id)}
      style={{
        background: PAPER,
        border: `1px solid ${locked ? '#a78bfa30' : isOpen ? `${ACCENT}40` : LINE}`,
        borderLeft: `4px solid ${listing.cadiPick ? ACCENT : tier.color}`,
        borderRadius: 10,
        padding: 14,
        cursor: locked ? 'default' : 'pointer',
        opacity: locked ? 0.7 : 1,
        boxShadow: isOpen ? `0 0 0 3px ${ACCENT}15` : 'none',
        position: 'relative',
      }}
    >
      {listing.cadiPick && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 14,
            fontSize: 9,
            fontWeight: 900,
            letterSpacing: '0.08em',
            color: 'white',
            background: ACCENT,
            padding: '4px 10px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ⚡ CADI RECOMMENDS YOU · {listing.firstRefusalMins}m FIRST REFUSAL
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
          marginTop: listing.cadiPick ? 6 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          <span style={{ fontSize: 10, color: SUB }}>· {listing.fm}</span>
        </div>
        <TierBadge tier={listing.tier} size="sm" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 900, color: INK, marginBottom: 2 }}>
        {listing.site}
      </div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 10 }}>
        <MapPin size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
        {listing.region} · {listing.distance} mi · {listing.spec}
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}
      >
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>£{listing.price}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>per visit</div>
        </div>
        <div
          style={{
            background: `${fitColor}10`,
            border: `1px solid ${fitColor}25`,
            borderRadius: 6,
            padding: '6px 8px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: fitColor }}>{listing.fit}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>your fit</div>
        </div>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>
            {listing.fmRating.theyRate} ★
          </div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>their FM rating</div>
        </div>
      </div>
      {locked ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '8px 0',
            borderRadius: 6,
            background: '#a78bfa10',
            border: '1px solid #a78bfa30',
            fontSize: 11,
            fontWeight: 700,
            color: PURPLE,
          }}
        >
          <Lock size={11} /> Elite tier only — 5 more perfect visits to unlock
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 800,
              color: 'white',
              background: ACCENT,
              border: 'none',
              borderRadius: 7,
              padding: '8px 0',
              cursor: 'pointer',
            }}
          >
            {listing.format === 'rate' ? `Accept at £${listing.price}` : 'Accept'}
          </button>
          {listing.format !== 'rate' && (
            <button
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: SUB,
                background: PAPER,
                border: `1px solid ${LINE}`,
                borderRadius: 7,
                padding: '8px 12px',
                cursor: 'pointer',
              }}
            >
              Bid
            </button>
          )}
          <button
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: SUB,
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 7,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}

function MarketplaceScreen() {
  const [filter, setFilter] = useState('all');
  const tabs = [
    { id: 'all', label: 'All open' },
    { id: 'pick', label: 'Cadi picks for me' },
    { id: 'rate', label: 'Rate cards' },
    { id: 'awarded', label: 'Awarded to me' },
  ];
  const counts = {
    all: SUB_LISTINGS.length,
    pick: SUB_LISTINGS.filter((l) => l.cadiPick).length,
    rate: SUB_LISTINGS.filter((l) => l.format === 'rate').length,
    awarded: 0,
  };
  let filtered = SUB_LISTINGS;
  if (filter === 'pick') filtered = SUB_LISTINGS.filter((l) => l.cadiPick);
  if (filter === 'rate') filtered = SUB_LISTINGS.filter((l) => l.format === 'rate');
  if (filter === 'awarded') filtered = [];

  return (
    <div>
      <ScreenHeader
        title="Marketplace"
        subtitle={`Open jobs from FMs you're connected to · ranked by your fit score · filtered to your tier`}
        rightSlot={<TierBadge tier={ME.tier} />}
      />

      {/* Tier progress banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${PURPLE}08, ${ACCENT}06)`,
          border: `1px solid ${PURPLE}25`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Award size={18} color={PURPLE} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>
            You're 5 points from Elite (≥93)
          </div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
            5 more perfect visits (geo ✓✓ · evidence ✓ · sign-off ✓) and you unlock Elite-only
            listings + 12% higher avg pay.
          </div>
          <div
            style={{
              height: 5,
              background: SOFT,
              borderRadius: 3,
              marginTop: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(ME.score / 100) * 100}%`,
                background: `linear-gradient(90deg, ${GREEN}, ${PURPLE})`,
              }}
            />
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: PURPLE }}>{ME.score}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>/ 100</div>
        </div>
      </div>

      <Toolbar tabs={tabs} active={filter} onChange={setFilter} counts={counts} />

      {/* Listings grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {filtered.length === 0 ? (
          <div
            style={{
              gridColumn: '1 / -1',
              padding: 30,
              textAlign: 'center',
              background: '#fafbff',
              border: `1.5px dashed ${LINE}`,
              borderRadius: 10,
              color: MUTE,
              fontSize: 12,
            }}
          >
            Nothing here yet.
          </div>
        ) : (
          filtered.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={() => {}} isOpen={false} />
          ))
        )}
      </div>

      <Annot>
        FM-side ranking (price × score × distance × capacity) reflects back as{' '}
        <strong>your fit score</strong> here. Cadi recommends one sub per listing → 30-min first
        refusal — that's the orange ribbon. Tier-locked listings stay visible so subs always see
        what's behind the next score threshold. FMs you've worked with appear with their two-way
        rating so you can avoid bad payers.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Jobs + on-site flow
// ─────────────────────────────────────────────────────────────────────────────

const JOB_STATE = {
  upcoming: { label: 'Upcoming', color: '#3b82f6' },
  onsite: { label: 'Checked in', color: ACCENT },
  evidence: { label: 'Awaiting check-out', color: '#a78bfa' },
  review: { label: 'Pending FM review', color: PURPLE },
  done: { label: 'Approved', color: GREEN },
};

const MY_JOBS = [
  {
    id: 'JC-101',
    fm: '{{Britannia Group}}',
    site: '{{Vauxhall Bedford}}',
    region: 'Bedfordshire & Bucks',
    date: 'Today 14:00',
    value: 45,
    state: 'upcoming',
    inFence: false,
  },
  {
    id: 'JC-102',
    fm: '{{Britannia Group}}',
    site: '{{Aston Martin Mayfair}}',
    region: 'London',
    date: 'Now',
    value: 120,
    state: 'onsite',
    inFence: true,
    checkedInAt: '07:04',
    minOnSite: 42,
  },
  {
    id: 'JC-103',
    fm: '{{Britannia Group}}',
    site: '{{Stratstone JLR Nottingham}}',
    region: 'Midlands',
    date: 'Tomorrow 06:00',
    value: 200,
    state: 'upcoming',
    inFence: false,
  },
  {
    id: 'JC-104',
    fm: '{{Britannia Group}}',
    site: '{{Volvo Derby}}',
    region: 'Midlands',
    date: 'Yesterday',
    value: 70,
    state: 'review',
  },
  {
    id: 'JC-105',
    fm: '{{ISS Facility Services}}',
    site: '{{Canary Wharf Tower 7}}',
    region: 'London',
    date: '3 days ago',
    value: 480,
    state: 'done',
  },
];

function JobCard({ job, onOpen }) {
  const state = JOB_STATE[job.state];
  return (
    <div
      onClick={() => onOpen(job.id)}
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderLeft: `4px solid ${state.color}`,
        borderRadius: 10,
        padding: 14,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: state.color,
            background: `${state.color}15`,
            padding: '3px 8px',
            borderRadius: 999,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {state.label}
        </span>
        <span style={{ fontSize: 10, color: MUTE }}>
          {job.id} · {job.fm}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{job.site}</div>
      <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
        <MapPin size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
        {job.region} · {job.date}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 900, color: INK }}>£{job.value}</span>
        <span style={{ fontSize: 10, color: SUB }}>per visit</span>
        <div style={{ flex: 1 }} />
        {job.state === 'upcoming' && (
          <button
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'white',
              background: ACCENT,
              border: 'none',
              borderRadius: 7,
              padding: '7px 14px',
              cursor: 'pointer',
            }}
          >
            Open job card
          </button>
        )}
        {job.state === 'onsite' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>
            {job.minOnSite}m on site · checked in {job.checkedInAt}
          </span>
        )}
        {job.state === 'review' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: PURPLE }}>Evidence in FM queue</span>
        )}
        {job.state === 'done' && (
          <span style={{ fontSize: 10, fontWeight: 700, color: GREEN }}>✓ Invoice draft ready</span>
        )}
      </div>
    </div>
  );
}

function OnSiteFlow({ job, onClose }) {
  const [phase, setPhase] = useState('start'); // 'start' | 'checkin' | 'onsite' | 'checkout'
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        marginTop: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '14px 18px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: ACCENT, letterSpacing: '0.1em' }}>
            JOB CARD · {job.fm}
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: INK, marginTop: 2 }}>{job.site}</div>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
            {job.region} · £{job.value} per visit · {job.date}
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

      <div style={{ padding: 18 }}>
        {/* Job spec preview */}
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
              marginBottom: 6,
            }}
          >
            Scope · access · contacts
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 6, fontSize: 11 }}
          >
            <span style={{ color: SUB }}>Spec</span>
            <span style={{ color: INK, fontWeight: 700 }}>
              Monthly · in & out hand-height · 2 hrs
            </span>
            <span style={{ color: SUB }}>Access</span>
            <span style={{ color: INK, fontWeight: 700 }}>
              Service yard · gate code 4471 · contact site mgr
            </span>
            <span style={{ color: SUB }}>Checklist</span>
            <span style={{ color: INK, fontWeight: 700 }}>12 items · revealed at check-in</span>
            <span style={{ color: SUB }}>Geo-fence</span>
            <span style={{ color: INK, fontWeight: 700 }}>80m around site GPS</span>
          </div>
        </div>

        {/* Phase: pre-check-in */}
        {phase === 'start' && (
          <div>
            <div
              style={{
                padding: 18,
                background: `${ACCENT}06`,
                border: `1.5px dashed ${ACCENT}40`,
                borderRadius: 10,
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  background: ACCENT,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <MapPin size={22} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>
                Tap Check in when you arrive on site
              </div>
              <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                Cadi verifies you're inside the 80m geo-fence before allowing it. GPS is captured at
                this stamp only.
              </div>
              {job.inFence ? (
                <button
                  onClick={() => setPhase('onsite')}
                  style={{
                    marginTop: 14,
                    background: ACCENT,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Check in · you're at the site
                </button>
              ) : (
                <button
                  disabled
                  style={{
                    marginTop: 14,
                    background: SOFT,
                    color: MUTE,
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'not-allowed',
                  }}
                >
                  Check in (you're 4.2 mi from site)
                </button>
              )}
            </div>
          </div>
        )}

        {/* Phase: on site, doing work */}
        {phase === 'onsite' && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                background: `${ACCENT}08`,
                border: `1px solid ${ACCENT}25`,
                borderRadius: 10,
                marginBottom: 14,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: ACCENT,
                  animation: 'pulse 1.4s infinite',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 800, color: INK, flex: 1 }}>
                Checked in at 07:04 · 42 min on site
              </span>
              <span style={{ fontSize: 10, color: SUB }}>Geo-fence ✓</span>
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}
            >
              {/* Checklist */}
              <div
                style={{
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
                    marginBottom: 8,
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
                  <span style={{ fontSize: 11, fontWeight: 800, color: INK }}>8 / 12</span>
                </div>
                {[
                  'Cars in showcase area',
                  'Windows + glass externally',
                  'Frames + edges',
                  'Forecourt clean',
                  'Driveway clean',
                  'Sales office windows',
                  'Service bay glass',
                  'Roller shutters',
                ].map((item, i) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 0',
                      borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                      fontSize: 11,
                    }}
                  >
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 4,
                        background: i < 8 ? GREEN : 'white',
                        border: i < 8 ? 'none' : `1.5px solid ${LINE}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: 9,
                        fontWeight: 900,
                      }}
                    >
                      {i < 8 ? '✓' : ''}
                    </span>
                    <span
                      style={{
                        color: i < 8 ? MUTE : INK,
                        textDecoration: i < 8 ? 'line-through' : 'none',
                      }}
                    >
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* Photo upload */}
              <div
                style={{
                  background: PAPER,
                  border: `1px solid ${LINE}`,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
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
                  Photos · before / after
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2,1fr)',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  {['BEFORE 1', 'BEFORE 2', 'AFTER 1', 'AFTER 2'].map((l, i) => (
                    <div
                      key={l}
                      style={{
                        aspectRatio: '4/3',
                        borderRadius: 6,
                        background: i < 3 ? '#fafbff' : `${ACCENT}06`,
                        border: i < 3 ? `1px solid ${LINE}` : `1.5px dashed ${ACCENT}40`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                      }}
                    >
                      <Camera size={14} color={i < 3 ? GREEN : ACCENT} />
                      <span style={{ fontSize: 8, color: i < 3 ? GREEN : ACCENT, fontWeight: 800 }}>
                        {i < 3 ? '✓ uploaded' : '+ add'}
                      </span>
                      <span
                        style={{
                          fontSize: 8,
                          color: SUB,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                        }}
                      >
                        {l}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  style={{
                    width: '100%',
                    background: ACCENT,
                    color: 'white',
                    fontSize: 11,
                    fontWeight: 800,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 0',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Upload size={11} /> Take photo
                </button>
              </div>
            </div>

            {/* Sign-off + check-out */}
            <div
              style={{
                padding: 16,
                background: `${GREEN}06`,
                border: `1px solid ${GREEN}25`,
                borderRadius: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: INK, marginBottom: 8 }}>
                When complete
              </div>
              <div style={{ fontSize: 11, color: SUB, marginBottom: 10 }}>
                Sign-off on site (digital sig pad), then tap <strong>Check out</strong>. Cadi
                verifies you're still in the geo-fence — second stamp. Evidence + checklist
                auto-submit to {job.fm} for approval.
              </div>
              <button
                onClick={() => setPhase('checkout')}
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
                ✓ Check out · submit to FM
              </button>
            </div>
          </div>
        )}

        {/* Phase: post check-out */}
        {phase === 'checkout' && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              background: `${GREEN}06`,
              border: `1px solid ${GREEN}25`,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: GREEN,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
              }}
            >
              <CheckCircle2 size={26} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: INK }}>
              Submitted to {job.fm} for approval
            </div>
            <div
              style={{
                fontSize: 12,
                color: SUB,
                marginTop: 4,
                maxWidth: 320,
                margin: '4px auto 0',
              }}
            >
              Evidence + check-in/out stamps are now in their queue. Invoice draft appears in your
              Invoicing tab the moment they approve.
            </div>
            <button
              style={{
                marginTop: 14,
                background: PAPER,
                color: SUB,
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: '8px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to My Jobs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MyJobsScreen() {
  const [filter, setFilter] = useState('upcoming');
  const [openId, setOpenId] = useState(null);
  const tabs = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'onsite', label: 'On site' },
    { id: 'review', label: 'In FM review' },
    { id: 'done', label: 'Done' },
  ];
  const counts = {
    upcoming: MY_JOBS.filter((j) => j.state === 'upcoming').length,
    onsite: MY_JOBS.filter((j) => j.state === 'onsite').length,
    review: MY_JOBS.filter((j) => ['review', 'evidence'].includes(j.state)).length,
    done: MY_JOBS.filter((j) => j.state === 'done').length,
  };
  const filtered = MY_JOBS.filter((j) => {
    if (filter === 'upcoming') return j.state === 'upcoming';
    if (filter === 'onsite') return j.state === 'onsite';
    if (filter === 'review') return ['review', 'evidence'].includes(j.state);
    if (filter === 'done') return j.state === 'done';
    return true;
  });
  const openJob = MY_JOBS.find((j) => j.id === openId);

  return (
    <div>
      <ScreenHeader
        title="My Jobs"
        subtitle="Your accepted jobs across every connected FM. Tap a job to open the card, check in on site, complete + submit."
      />
      <Toolbar tabs={tabs} active={filter} onChange={setFilter} counts={counts} />

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
            Nothing here.
          </div>
        ) : (
          filtered.map((j) => (
            <JobCard key={j.id} job={j} onOpen={(id) => setOpenId(id === openId ? null : id)} />
          ))
        )}
      </div>

      {openJob && <OnSiteFlow job={openJob} onClose={() => setOpenId(null)} />}

      <Annot>
        Job card mirrors what the FM sees, with one extra surface: the <strong>on-site flow</strong>
        . Check-in only enables when GPS is inside the 80m fence (matches the rule the FM defined).
        Same for check-out. Evidence collected here is the same shape the FM ops side renders in
        Work approval.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoicing
// ─────────────────────────────────────────────────────────────────────────────

const INVOICES = [
  {
    id: 'INV-101',
    fm: '{{Britannia Group}}',
    site: '{{Stratstone JLR Nottingham}}',
    date: 'Today',
    value: 200,
    vat: 40,
    total: 240,
    status: 'draft',
  },
  {
    id: 'INV-100',
    fm: '{{Britannia Group}}',
    site: '{{Vauxhall Bedford}}',
    date: '2 days ago',
    value: 45,
    vat: 9,
    total: 54,
    status: 'submitted',
  },
  {
    id: 'INV-099',
    fm: '{{ISS Facility Services}}',
    site: '{{Canary Wharf Tower 7}}',
    date: '5 days ago',
    value: 480,
    vat: 96,
    total: 576,
    status: 'submitted',
  },
  {
    id: 'INV-098',
    fm: '{{Britannia Group}}',
    site: '{{Volvo Derby}}',
    date: 'Last month',
    value: 70,
    vat: 14,
    total: 84,
    status: 'paid',
    paidOn: '18 Jun',
  },
  {
    id: 'INV-097',
    fm: '{{Britannia Group}}',
    site: '{{Stratstone JLR Nottingham}}',
    date: 'Last month',
    value: 200,
    vat: 40,
    total: 240,
    status: 'paid',
    paidOn: '18 Jun',
  },
];

const INV_STATUS = {
  draft: { label: 'Draft · ready to submit', color: ACCENT },
  submitted: { label: 'Submitted · with FM', color: PURPLE },
  paid: { label: 'Paid', color: GREEN },
};

function InvoicingScreen() {
  const [filter, setFilter] = useState('draft');
  const tabs = [
    { id: 'draft', label: 'Drafts' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'paid', label: 'Paid' },
  ];
  const counts = {
    draft: INVOICES.filter((i) => i.status === 'draft').length,
    submitted: INVOICES.filter((i) => i.status === 'submitted').length,
    paid: INVOICES.filter((i) => i.status === 'paid').length,
  };
  const filtered = INVOICES.filter((i) => i.status === filter);

  return (
    <div>
      <ScreenHeader
        title="Invoicing"
        subtitle="Invoices auto-draft the moment the FM approves your job. Edit if you need to, then submit."
      />

      {/* Auto-draft banner */}
      <div
        style={{
          background: `${ACCENT}06`,
          border: `1px solid ${ACCENT}25`,
          borderRadius: 10,
          padding: '10px 14px',
          marginBottom: 12,
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
            background: ACCENT,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <FileText size={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>
            1 new draft auto-created from FM approval
          </div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
            Stratstone JLR Nottingham · £200 · ready to submit · pre-filled from job card
          </div>
        </div>
        <button
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: 'white',
            background: ACCENT,
            border: 'none',
            borderRadius: 7,
            padding: '7px 12px',
            cursor: 'pointer',
          }}
        >
          Review draft
        </button>
      </div>

      <Toolbar tabs={tabs} active={filter} onChange={setFilter} counts={counts} />

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
            gridTemplateColumns: '0.8fr 1fr 1.4fr 1fr 0.7fr 0.7fr 0.7fr 110px',
            padding: '10px 14px',
            background: SOFT,
            fontSize: 9,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          <div>Invoice</div>
          <div>FM</div>
          <div>Site / job</div>
          <div>Service date</div>
          <div>Net</div>
          <div>VAT</div>
          <div>Total</div>
          <div>Status</div>
        </div>
        {filtered.map((inv, i) => {
          const status = INV_STATUS[inv.status];
          return (
            <div
              key={inv.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '0.8fr 1fr 1.4fr 1fr 0.7fr 0.7fr 0.7fr 110px',
                padding: '12px 14px',
                borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                fontSize: 11,
                alignItems: 'center',
              }}
            >
              <span style={{ color: INK, fontWeight: 800 }}>{inv.id}</span>
              <span style={{ color: SUB }}>{inv.fm}</span>
              <span style={{ color: INK, fontWeight: 700 }}>{inv.site}</span>
              <span style={{ color: SUB, fontSize: 10 }}>{inv.date}</span>
              <span style={{ color: INK }}>£{inv.value}</span>
              <span style={{ color: SUB }}>£{inv.vat}</span>
              <span style={{ color: INK, fontWeight: 800 }}>£{inv.total}</span>
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
                {inv.status === 'paid' && inv.paidOn
                  ? `Paid ${inv.paidOn}`
                  : status.label.split(' · ')[0]}
              </span>
            </div>
          );
        })}
      </div>

      <Annot>
        No double-entry: the moment the FM approves work, Cadi pre-fills your invoice from the job
        card. Submit lands it in the FM's <strong>Accounts export</strong>. Their accounts team
        takes it from there — payment status feeds back into the row.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Earnings
// ─────────────────────────────────────────────────────────────────────────────

function EarningsScreen() {
  return (
    <div>
      <ScreenHeader
        title="Earnings"
        subtitle="Confirmed pay across every connected FM. Status mirrors what FM accounts mark in their system."
      />

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}
      >
        {[
          { l: 'Earned · this month', v: '£1,840', sub: '23 jobs approved', c: GREEN },
          { l: 'Pending payment', v: '£760', sub: '4 invoices with FMs', c: ACCENT },
          { l: 'Paid · this month', v: '£1,080', sub: 'avg 6 days after submit', c: NAVY },
          { l: 'Earned · year to date', v: '£11,950', sub: 'across 2 FMs', c: PURPLE },
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
            <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Per-FM breakdown */}
      <div
        style={{
          background: PAPER,
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
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Per-FM breakdown
        </div>
        {[
          { fm: '{{Britannia Group}}', earned: 1480, pending: 360, paid: 1080, avgDays: 6 },
          { fm: '{{ISS Facility Services}}', earned: 360, pending: 400, paid: 0, avgDays: '—' },
        ].map((f, i) => (
          <div
            key={f.fm}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr',
              padding: '10px 0',
              borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <span style={{ color: INK, fontWeight: 800 }}>{f.fm}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>£{f.earned}</div>
              <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>earned · 30d</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: ACCENT }}>£{f.pending}</div>
              <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>pending</div>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: GREEN }}>£{f.paid}</div>
              <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>paid · 30d</div>
            </div>
            <span style={{ fontSize: 11, color: SUB }}>{f.avgDays} day avg · pay terms</span>
          </div>
        ))}
      </div>

      {/* Payment timeline */}
      <div
        style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14 }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: SUB,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Recent payment activity
        </div>
        {[
          {
            e: 'Marked paid · £200 · INV-097',
            d: '18 Jun',
            who: '{{Britannia Group}} accounts',
            c: GREEN,
          },
          {
            e: 'Marked paid · £70 · INV-098',
            d: '18 Jun',
            who: '{{Britannia Group}} accounts',
            c: GREEN,
          },
          {
            e: 'Exported to Britannia accounts · 2 invoices',
            d: '14 Jun',
            who: 'Britannia ops',
            c: PURPLE,
          },
          { e: 'Approved · £200 · JC-018', d: '13 Jun', who: 'Britannia ops', c: NAVY },
          { e: 'Submitted invoice · £200', d: '13 Jun', who: 'You', c: ACCENT },
        ].map((a, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
              fontSize: 11,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.c }} />
            <span style={{ color: INK, fontWeight: 700, flex: 1 }}>{a.e}</span>
            <span style={{ color: SUB, fontSize: 10 }}>{a.who}</span>
            <span style={{ color: MUTE, fontSize: 10, minWidth: 60, textAlign: 'right' }}>
              {a.d}
            </span>
          </div>
        ))}
      </div>

      <Annot>
        Payment status is sourced from the FM's <strong>Accounts export</strong> — when their
        accounts team marks paid in the file, the row mirrors back here. No more chasing.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Profile
// ─────────────────────────────────────────────────────────────────────────────

function ProfileScreen() {
  return (
    <div>
      <ScreenHeader
        title="My Profile"
        subtitle="What FMs see when they consider you on the marketplace. Score breakdown · compliance · contracts on file."
      />

      {/* Hero */}
      <div
        style={{
          background: `linear-gradient(135deg, ${NAVY}, #1a0a00)`,
          borderRadius: 14,
          padding: '20px 22px',
          marginBottom: 14,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: 14,
            background: ACCENT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            fontWeight: 900,
          }}
        >
          A
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{ME.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>
            {ME.contact} · {ME.region} · {ME.trades.join(' · ')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: GREEN, lineHeight: 1 }}>
            {ME.score}
          </div>
          <TierBadge tier={ME.tier} size="sm" />
        </div>
      </div>

      {/* Score breakdown */}
      <div
        style={{
          background: PAPER,
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
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Connect score · how it's built
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { l: 'On-time check-in', v: 96, c: GREEN },
            { l: 'Evidence quality', v: 91, c: GREEN },
            { l: 'Sign-off rate', v: 88, c: GREEN },
            { l: 'Dispute rate', v: 82, c: '#f59e0b', sub: 'one queried this month' },
          ].map((s) => (
            <div
              key={s.l}
              style={{
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
              {s.sub && <div style={{ fontSize: 9, color: MUTE, marginTop: 2 }}>{s.sub}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Compliance */}
      <div
        style={{
          background: PAPER,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: 14,
          marginBottom: 14,
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
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Compliance · what FMs can verify
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
            Upload document
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { d: 'DBS check', ok: true, exp: 'expires {{Mar 27}}' },
            { d: 'Public liability insurance', ok: true, exp: 'expires {{Aug 26}}' },
            { d: 'Employer liability', ok: true, exp: 'expires {{Aug 26}}' },
            { d: 'RAMS · method statements', ok: true, exp: 'on file' },
            { d: 'ISO 9001 / 14001', ok: false, exp: 'optional · not on file' },
          ].map((c) => (
            <div
              key={c.d}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: c.ok ? '#fafbff' : '#fef9f0',
                border: `1px solid ${c.ok ? LINE : '#fcd34d'}`,
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: c.ok ? `${GREEN}15` : '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c.ok ? (
                  <CheckCircle2 size={12} color={GREEN} />
                ) : (
                  <AlertCircle size={12} color="#a16207" />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{c.d}</div>
                <div style={{ fontSize: 10, color: SUB }}>{c.exp}</div>
              </div>
              <button
                style={{
                  fontSize: 10,
                  color: SUB,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {c.ok ? 'View' : 'Upload →'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Contracts on file from FMs */}
      <div
        style={{
          background: PAPER,
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
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}
        >
          Contracts on file · pushed by FMs
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            {
              fm: '{{Britannia Group}}',
              doc: 'Master services agreement v2.1.pdf',
              uploaded: 'Jan 2026',
            },
            { fm: '{{Britannia Group}}', doc: 'ACERTA programme SLA.pdf', uploaded: 'Jun 2026' },
            {
              fm: '{{ISS Facility Services}}',
              doc: 'Subcontractor terms 2026.pdf',
              uploaded: 'Apr 2026',
            },
          ].map((c) => (
            <div
              key={c.doc}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                background: '#fafbff',
                border: `1px solid ${LINE}`,
                borderRadius: 8,
              }}
            >
              <FileText size={14} color={ACCENT} />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: INK,
                    fontFamily: 'ui-monospace,Menlo,monospace',
                  }}
                >
                  {c.doc}
                </div>
                <div style={{ fontSize: 10, color: SUB }}>
                  {c.fm} · uploaded {c.uploaded}
                </div>
              </div>
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
                Open →
              </button>
            </div>
          ))}
        </div>
      </div>

      <Annot>
        Profile is the bid moat: a public record FMs can verify before awarding work. Score
        breakdown is computed from actual evidence + check-in/out stamps — not self-report.
        Compliance docs and contracts both live here, with the same documents an FM uploaded from
        their side — one source of truth.
      </Annot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

const SCREEN_MAP = {
  home: HomeScreen,
  marketplace: MarketplaceScreen,
  myjobs: MyJobsScreen,
  invoicing: InvoicingScreen,
  earnings: EarningsScreen,
  profile: ProfileScreen,
};

export default function CadiConnectTabWireframe() {
  const [active, setActive] = useState('home');
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
            Cadi Connect tab
          </div>
          <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>Sub's view · in their Cadi</div>
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
          <strong style={{ color: INK, fontSize: 10 }}>Mirror of FM Ops Portal</strong> · same data
          shapes · sub-side reframing · <code>{`{{tokens}}`}</code> are runtime values.
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: '28px 36px', maxWidth: 1100 }}>
        <Screen onNav={setActive} />
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(1.25); } }`}</style>
    </div>
  );
}
