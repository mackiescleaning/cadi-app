import { useState } from 'react';
import {
  ChevronRight,
  Send,
  CheckCircle2,
  Clock,
  Camera,
  Shield,
  Smartphone,
  ArrowRight,
  MapPin,
  FileSpreadsheet,
  Globe,
} from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

// ── Data ──────────────────────────────────────────────────────────────────────
const CLIENTS = [
  {
    id: 'c1',
    name: 'Luton & Dunstable NHS FT',
    logo: 'LD',
    color: '#34d399',
    type: 'Healthcare',
    sites: [
      {
        id: 's1',
        name: 'L&D Hospital – Main Tower',
        address: 'Lewsey Road, Luton LU4 0DZ',
        areas: [
          {
            id: 'a1',
            name: 'General Wards 2–6',
            jobs: ['Daily clean', 'Deep clean', 'Washroom service'],
          },
          { id: 'a2', name: 'A&E & Outpatients', jobs: ['Specialist clean', 'Washroom service'] },
        ],
      },
      {
        id: 's2',
        name: 'L&D Hospital – A&E Block Ext',
        address: 'Lewsey Road, Luton LU4 0DZ',
        areas: [{ id: 'a3', name: 'Reception & Waiting', jobs: ['Daily clean'] }],
      },
    ],
  },
  {
    id: 'c2',
    name: 'Next Retail UK Ltd',
    logo: 'NX',
    color: '#4f78ff',
    type: 'Retail',
    sites: [
      {
        id: 's3',
        name: 'Next – Luton The Mall',
        address: 'The Mall, Luton LU1 2TL',
        areas: [
          { id: 'a4', name: 'Sales floor & fitting rooms', jobs: ['Morning clean'] },
          { id: 'a5', name: 'Stockroom & back of house', jobs: ['Daily clean'] },
        ],
      },
      {
        id: 's4',
        name: 'Next – Centre:MK',
        address: 'Silbury Blvd, Milton Keynes MK9 3ES',
        areas: [{ id: 'a6', name: 'Sales floor', jobs: ['Morning clean', 'Evening clean'] }],
      },
      {
        id: 's5',
        name: 'Next – Watford Atria',
        address: 'The Atria, Watford WD17 2TB',
        areas: [{ id: 'a7', name: 'Ground & first floor', jobs: ['Morning clean'] }],
      },
    ],
  },
  {
    id: 'c3',
    name: 'Luton Borough Council',
    logo: 'LB',
    color: '#a78bfa',
    type: 'Public Sector',
    sites: [
      {
        id: 's6',
        name: 'Luton Central Library',
        address: "St George's Square, Luton LU1 2NG",
        areas: [
          { id: 'a8', name: 'Public floors & toilets', jobs: ['Daily clean', 'Washroom service'] },
        ],
      },
      {
        id: 's7',
        name: 'Luton Town Hall',
        address: 'George Street, Luton LU1 2BQ',
        areas: [
          { id: 'a9', name: 'Offices & council chambers', jobs: ['Morning clean'] },
          { id: 'a10', name: 'Entrance & reception', jobs: ['Daily clean'] },
        ],
      },
    ],
  },
  {
    id: 'c4',
    name: 'University of Bedfordshire',
    logo: 'UB',
    color: '#f472b6',
    type: 'Education',
    sites: [
      {
        id: 's8',
        name: 'UoB Luton Campus',
        address: 'University Square, Luton LU1 3JU',
        areas: [
          {
            id: 'a11',
            name: 'Lecture theatres & common areas',
            jobs: ['Daily clean', 'Deep clean'],
          },
          { id: 'a12', name: 'Student toilets & washrooms', jobs: ['Washroom service'] },
        ],
      },
    ],
  },
];

const CARD_SPECS = {
  'Daily clean': {
    window: '06:00–08:00',
    freq: 'Mon–Fri',
    hrs: 44,
    dbs: null,
    route: 'employed',
    color: '#4f78ff',
    assignTo: 'Marcus T.',
    rate: '£13.50/hr',
    monthlyValue: '£594',
  },
  'Morning clean': {
    window: '05:30–08:00',
    freq: 'Mon–Sat',
    hrs: 52,
    dbs: null,
    route: 'employed',
    color: '#60a5fa',
    assignTo: 'Emma W.',
    rate: '£13.50/hr',
    monthlyValue: '£702',
  },
  'Evening clean': {
    window: '18:00–20:00',
    freq: 'Mon–Fri',
    hrs: 36,
    dbs: null,
    route: 'employed',
    color: '#818cf8',
    assignTo: 'Kwame B.',
    rate: '£13.50/hr',
    monthlyValue: '£486',
  },
  'Deep clean': {
    window: '07:00–11:00',
    freq: 'Weekly',
    hrs: 16,
    dbs: null,
    route: 'connect',
    color: '#fb923c',
    assignTo: null,
    rate: 'Quote req.',
    monthlyValue: '~£320',
  },
  'Washroom service': {
    window: '12:00–13:00',
    freq: 'Mon–Fri',
    hrs: 22,
    dbs: null,
    route: 'employed',
    color: '#a78bfa',
    assignTo: 'Claire B.',
    rate: '£13.50/hr',
    monthlyValue: '£297',
  },
  'Specialist clean': {
    window: '05:00–07:00',
    freq: 'Mon–Fri',
    hrs: 44,
    dbs: 'Enhanced DBS',
    route: 'connect',
    color: '#f472b6',
    assignTo: null,
    rate: 'Quote req.',
    monthlyValue: '~£720',
  },
};

function buildCards(site) {
  const cards = [];
  let ref = 4500;
  site.areas.forEach((area) => {
    area.jobs.forEach((jobType) => {
      const spec = CARD_SPECS[jobType] || CARD_SPECS['Daily clean'];
      cards.push({
        id: `jc-${ref}`,
        ref: `#BF-${ref++}`,
        area: area.name,
        jobType,
        ...spec,
        photos: true,
        sent: false,
      });
    });
  });
  return cards;
}

// ── Job card component ─────────────────────────────────────────────────────────
function JobCard({ card, onSend }) {
  const isConnect = card.route === 'connect';

  if (card.sent) {
    return (
      <div
        style={{
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(52,211,153,0.2)',
          background: 'rgba(52,211,153,0.04)',
          opacity: 0.65,
        }}
      >
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle2 size={18} style={{ color: '#34d399', flexShrink: 0 }} />
          <div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 800, fontSize: 13 }}>
              {card.jobType}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2 }}>
              {card.area} · Sent to {isConnect ? 'Cadi Connect' : card.assignTo}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 900, color: '#34d399' }}>
            ✓ Sent
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid rgba(255,255,255,0.1)`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'all 0.2s',
      }}
    >
      {/* Coloured top band — job type big and clear */}
      <div
        style={{
          background: `linear-gradient(135deg, ${card.color}28, ${card.color}12)`,
          borderBottom: `1px solid ${card.color}30`,
          padding: '14px 18px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              {card.jobType}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.5)',
                marginTop: 5,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <MapPin size={10} style={{ color: card.color, flexShrink: 0 }} />
              {card.area}
            </div>
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.25)',
              fontFamily: 'monospace',
              marginTop: 2,
              flexShrink: 0,
            }}
          >
            {card.ref}
          </span>
        </div>
      </div>

      {/* Schedule — 3 clear data points */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.15)',
        }}
      >
        {[
          {
            icon: <Clock size={13} style={{ color: card.color }} />,
            label: 'Time',
            value: card.window,
          },
          { icon: <span style={{ fontSize: 13 }}>📅</span>, label: 'Days', value: card.freq },
          {
            icon: <span style={{ fontSize: 13 }}>⏱</span>,
            label: 'Hours',
            value: `${card.hrs}h/mo`,
          },
        ].map(({ icon, label, value }, i) => (
          <div
            key={label}
            style={{
              padding: '12px 14px',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
              {icon}
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                {label}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Pricing row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: `${card.color}07`,
        }}
      >
        {[
          { label: 'Rate', value: card.rate },
          { label: 'Hrs/mo', value: `${card.hrs}h` },
          { label: 'Monthly value', value: card.monthlyValue },
        ].map(({ label, value }, i) => (
          <div
            key={label}
            style={{
              padding: '9px 14px',
              borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.25)',
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 13, fontWeight: 900, color: card.color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Requirements row */}
      {(card.dbs || card.photos) && (
        <div
          style={{
            padding: '8px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          {card.dbs && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(167,139,250,0.15)',
                color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.25)',
              }}
            >
              <Shield size={10} /> {card.dbs} required
            </span>
          )}
          {card.photos && (
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Camera size={10} /> Photo evidence required
            </span>
          )}
        </div>
      )}

      {/* Footer — assignment + send action */}
      <div
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {isConnect ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(251,146,60,0.15)',
                border: '1px solid rgba(251,146,60,0.3)',
              }}
            >
              <Globe size={13} style={{ color: '#fb923c' }} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                Cadi Connect
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                Posted to marketplace
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 900,
                background: 'rgba(79,120,255,0.18)',
                border: '1px solid rgba(79,120,255,0.3)',
                color: '#7b9fff',
                flexShrink: 0,
              }}
            >
              {card.assignTo
                ?.split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
                {card.assignTo}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Assigned operative</div>
            </div>
          </div>
        )}

        <button
          onClick={() => onSend(card.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            padding: '9px 18px',
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 900,
            color: 'white',
            cursor: 'pointer',
            border: 'none',
            flexShrink: 0,
            background: isConnect
              ? 'linear-gradient(135deg,#fb923c,#ea580c)'
              : 'linear-gradient(135deg,#4f78ff,#6366f1)',
            boxShadow: `0 4px 14px ${isConnect ? 'rgba(251,146,60,0.35)' : 'rgba(79,120,255,0.35)'}`,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
        >
          <Smartphone size={13} />
          {isConnect ? 'Post to marketplace' : 'Send to phone'}
        </button>
      </div>
    </div>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ client, site, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12 }}>
      <button
        onClick={() => onBack('client')}
        style={{
          color: 'rgba(255,255,255,0.35)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          fontWeight: 700,
        }}
      >
        All clients
      </button>
      {client && (
        <>
          <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <button
            onClick={() => onBack('site')}
            style={{
              color: site ? 'rgba(255,255,255,0.35)' : client.color,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontWeight: 700,
            }}
          >
            {client.name}
          </button>
        </>
      )}
      {site && (
        <>
          <ChevronRight size={12} style={{ color: 'rgba(255,255,255,0.2)' }} />
          <span style={{ color: 'white', fontWeight: 700 }}>{site.name}</span>
        </>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FmJobCards({ onNavigate, initialClientId }) {
  const [clientId, setClientId] = useState(initialClientId || null);
  const [siteId, setSiteId] = useState(null);
  const [cards, setCards] = useState([]);
  const [allSent, setAllSent] = useState(false);

  const client = CLIENTS.find((c) => c.id === clientId);
  const site = client?.sites.find((s) => s.id === siteId);

  function pickClient(id) {
    setClientId(id);
    setSiteId(null);
    setCards([]);
    setAllSent(false);
  }

  function pickSite(id) {
    setSiteId(id);
    const s = client.sites.find((s) => s.id === id);
    setCards(buildCards(s));
    setAllSent(false);
  }

  function goBack(to) {
    if (to === 'client') {
      setClientId(null);
      setSiteId(null);
      setCards([]);
    }
    if (to === 'site') {
      setSiteId(null);
      setCards([]);
    }
  }

  function sendCard(cardId) {
    setCards((cs) => cs.map((c) => (c.id === cardId ? { ...c, sent: true } : c)));
  }

  function sendAll() {
    setCards((cs) => cs.map((c) => ({ ...c, sent: true })));
    setAllSent(true);
  }

  const sentCount = cards.filter((c) => c.sent).length;

  // ── Before/After strip (always visible) ──────────────────────────────────
  const beforeAfter = (
    <>
      <HowItWorks
        setupTime="2–3 hrs for templates"
        youSetUp={[
          'Site list with cleaning scope and task requirements',
          'Shift patterns and cleaning frequencies per site',
          'Photo evidence requirements per job type',
        ]}
        cadiHandles={[
          'Generates job cards from your site and scope data',
          'Assigns to area managers for dispatch',
          'Creates task checklists and evidence prompts per card',
          'Updates live status for your clients to see in real time',
        ]}
      />
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 24,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.25)',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
        }}
      >
        <div style={{ padding: '12px 18px', background: 'rgba(194,65,12,0.06)' }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#c2410c',
              marginBottom: 6,
            }}
          >
            How it works today
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <FileSpreadsheet size={22} style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
              Win contract → build spreadsheet → copy each shift into emails or WhatsApp → chase
              replies → someone's missing → start again
            </span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 14px',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <ArrowRight size={16} style={{ color: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div style={{ padding: '12px 18px', background: 'rgba(52,211,153,0.04)' }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#34d399',
              marginBottom: 6,
            }}
          >
            With Cadi
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Smartphone size={22} style={{ color: '#34d399', flexShrink: 0, opacity: 0.7 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Select client → select location → job cards built automatically → sent to each
              operative's phone in one click
            </span>
          </div>
        </div>
      </div>
    </>
  );

  // ── Step 1: Select client ─────────────────────────────────────────────────
  if (!clientId) {
    return (
      <div style={{ padding: 24, maxWidth: 900 }}>
        {beforeAfter}
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: 14,
          }}
        >
          Step 1 — Select client
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          {CLIENTS.map((c) => (
            <button
              key={c.id}
              onClick={() => pickClient(c.id)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 18px',
                borderRadius: 16,
                textAlign: 'left',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${c.color}12`;
                e.currentTarget.style.border = `1px solid ${c.color}40`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)';
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  flexShrink: 0,
                  background: `${c.color}20`,
                  border: `1px solid ${c.color}40`,
                  color: c.color,
                }}
              >
                {c.logo}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 13, marginBottom: 3 }}>
                  {c.name}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: c.color, marginBottom: 8 }}>
                  {c.type}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {c.sites.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      <MapPin size={9} style={{ color: c.color, flexShrink: 0 }} />
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
              <ChevronRight
                size={14}
                style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, marginTop: 2 }}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 2: Select site ───────────────────────────────────────────────────
  if (!siteId) {
    return (
      <div style={{ padding: 24, maxWidth: 900 }}>
        {beforeAfter}
        <Breadcrumb client={client} site={null} onBack={goBack} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.3)',
            marginBottom: 14,
          }}
        >
          Step 2 — Select location
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {client.sites.map((s) => (
            <button
              key={s.id}
              onClick={() => pickSite(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 20px',
                borderRadius: 16,
                textAlign: 'left',
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.09)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${client.color}10`;
                e.currentTarget.style.border = `1px solid ${client.color}35`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)';
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: `${client.color}15`,
                  border: `1px solid ${client.color}30`,
                }}
              >
                <MapPin size={16} style={{ color: client.color }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 13 }}>{s.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                  {s.address}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {s.areas.map((a) => (
                    <span
                      key={a.id}
                      style={{
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        color: 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {a.name} · {a.jobs.length} job{a.jobs.length !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ color: client.color, fontWeight: 900, fontSize: 18 }}>
                  {s.areas.reduce((n, a) => n + a.jobs.length, 0)}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>job cards</div>
              </div>
              <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Step 3: Job cards for selected site ───────────────────────────────────
  if (allSent) {
    return (
      <div style={{ padding: 24, maxWidth: 900 }}>
        <Breadcrumb client={client} site={site} onBack={goBack} />
        <div
          style={{
            borderRadius: 20,
            padding: 40,
            textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(79,120,255,0.05))',
            border: '1px solid rgba(52,211,153,0.25)',
          }}
        >
          <CheckCircle2 size={44} style={{ color: '#34d399', margin: '0 auto 16px' }} />
          <div style={{ color: 'white', fontWeight: 900, fontSize: 20, marginBottom: 8 }}>
            All {cards.length} job cards sent
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 6 }}>
            {site.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, marginBottom: 24 }}>
            No emails · No spreadsheets · No chasing
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => goBack('site')}
              style={{
                padding: '10px 20px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              ← Back to locations
            </button>
            <button
              onClick={() => onNavigate && onNavigate('staff-import')}
              style={{
                padding: '10px 24px',
                borderRadius: 12,
                fontWeight: 900,
                fontSize: 13,
                color: 'white',
                background: 'linear-gradient(135deg,#4f78ff,#6366f1)',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(79,120,255,0.3)',
              }}
            >
              Next: Import Staff →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Breadcrumb client={client} site={site} onBack={goBack} />

      {/* Site summary */}
      <div
        style={{
          borderRadius: 14,
          padding: '14px 18px',
          marginBottom: 20,
          background: `${client.color}0d`,
          border: `1px solid ${client.color}25`,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <MapPin size={20} style={{ color: client.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>{site.name}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 }}>
            {site.address}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: client.color, fontWeight: 900, fontSize: 20 }}>
              {site.areas.length}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>areas</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: client.color, fontWeight: 900, fontSize: 20 }}>{cards.length}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>job cards</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#34d399', fontWeight: 900, fontSize: 20 }}>{sentCount}</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>sent</div>
          </div>
        </div>
      </div>

      {/* Cards grouped by area */}
      {site.areas.map((area) => {
        const areaCards = cards.filter((c) => c.area === area.name);
        return (
          <div key={area.id} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.3)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: client.color }} />
              {area.name}
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontWeight: 600 }}>
                · {areaCards.length} card{areaCards.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {areaCards.map((card) => (
                <JobCard key={card.id} card={card} onSend={sendCard} accentColor={client.color} />
              ))}
            </div>
          </div>
        );
      })}

      {/* Send all */}
      {sentCount < cards.length ? (
        <button
          onClick={sendAll}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 13,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'linear-gradient(135deg,rgba(52,211,153,0.2),rgba(79,120,255,0.15))',
            border: '1px solid rgba(52,211,153,0.35)',
            cursor: 'pointer',
          }}
        >
          <Send size={15} />
          Send all {cards.length - sentCount} remaining cards
        </button>
      ) : (
        <button
          onClick={() => onNavigate && onNavigate('staff-import')}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 14,
            fontWeight: 900,
            fontSize: 13,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'linear-gradient(135deg,#34d399,#059669)',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(52,211,153,0.3)',
          }}
        >
          ✓ All sent — Next: Import Staff →
        </button>
      )}
    </div>
  );
}
