import { useState } from 'react';
import { CheckCircle2, Clock, MessageSquare, Zap, ChevronRight, Plus, X, Star } from 'lucide-react';

// ── Static data ───────────────────────────────────────────────────────────────

const SERVICES_LIST = ['Window cleaning', 'Jet washing', 'Gutter clearing', 'Graffiti removal'];

const SITES_LIST = [
  'Asda – Luton Supercentre',
  'L&D Hospital – Main Tower',
  'Next Luton The Mall',
  'Amazon Tilbury – Exterior',
  'Watford Life Sciences Park',
  'Aldi Dunstable RDC',
  'Premier Inn Bedford',
  'Tesco Distribution – Welwyn',
  'Watling House Offices',
];

const CONTRACTORS_BY_SERVICE = {
  'Window cleaning': [
    { name: 'Clearview Window Services', rating: 4.9, rate: '£130–155/job', jobs: 142, region: 'Midlands' },
    { name: 'Premier Exterior Ltd',      rating: 4.7, rate: '£120–145/job', jobs: 89,  region: 'East'     },
    { name: 'CleanFront UK',             rating: 4.6, rate: '£95–115/job',  jobs: 63,  region: 'South'    },
    { name: 'Apex Window Care',          rating: 4.5, rate: '£90–120/job',  jobs: 47,  region: 'Midlands' },
  ],
  'Jet washing': [
    { name: 'ProWash Midlands', rating: 4.8, rate: '£220–260/job', jobs: 74, region: 'Midlands' },
    { name: 'AquaClean Ltd',    rating: 4.6, rate: '£200–240/job', jobs: 38, region: 'North'    },
    { name: 'JetForce UK',      rating: 4.4, rate: '£180–220/job', jobs: 22, region: 'East'     },
  ],
  'Gutter clearing': [
    { name: 'Capital Gutters Ltd',  rating: 4.9, rate: '£280–380/job', jobs: 91, region: 'Midlands' },
    { name: 'ClearFlow Services',   rating: 4.7, rate: '£260–340/job', jobs: 55, region: 'East'     },
    { name: 'RoofDrain Specialists',rating: 4.5, rate: '£240–320/job', jobs: 31, region: 'South'    },
  ],
  'Graffiti removal': [
    { name: 'SprayTech Services', rating: 4.8, rate: '£420–520/job', jobs: 58, region: 'Midlands' },
    { name: 'GraffitiGone Ltd',   rating: 4.6, rate: '£380–480/job', jobs: 34, region: 'South'    },
    { name: 'UrbanClean Pro',     rating: 4.3, rate: '£350–440/job', jobs: 19, region: 'North'    },
  ],
};

const CADI_ESTIMATES = {
  'Window cleaning':  { label: 'Est. £90–155 per job',  note: '47 comparable window cleans avg £122 per visit.' },
  'Jet washing':      { label: 'Est. £180–280 per job', note: '23 comparable jet wash jobs avg £238 per visit.' },
  'Gutter clearing':  { label: 'Est. £150–420 per job', note: '14 comparable gutter clears avg £290 per visit.' },
  'Graffiti removal': { label: 'Est. £380–520 per job', note: '9 comparable graffiti removals avg £440 per visit.' },
};

const INITIAL_CARDS = [
  {
    id: 'jc0', contractor: 'Premier Exterior Ltd', site: 'Asda – Luton Supercentre',
    service: 'Window cleaning', date: 'Sat 7 Jun', time: 'Morning',
    status: 'needs-pricing', price: null, mode: null, sent: null, lineItems: [],
    cadi: { label: 'Est. £120–145 per job', note: '12 comparable superstore window cleans avg £132. Standard two-storey exterior.' },
  },
  {
    id: 'jc2', contractor: 'Capital Gutters Ltd', site: 'L&D Hospital – Main Tower',
    service: 'Gutter clearing', date: 'Sat 6 Jun', time: 'Flexible',
    status: 'quote-received', price: '£380', mode: 'quote', sent: '20 May',
    cadi: { label: 'Est. £350–420 per job', note: '6 similar L&D Hospital tower clears — contractor\'s quote of £380 is within expected range.' },
    lineItems: [
      { desc: 'Gutter clearance — 4 sections', qty: 4, unit: '£65', total: '£260' },
      { desc: 'Downpipe flush & debris removal', qty: 1, unit: '£80', total: '£80'  },
      { desc: 'MEWP access surcharge',           qty: 1, unit: '£40', total: '£40'  },
    ],
  },
  {
    id: 'jc4', contractor: 'SprayTech Services', site: 'Premier Inn Bedford',
    service: 'Graffiti removal', date: 'Fri 29 May', time: '08:00–12:00',
    status: 'declined', price: '£448', mode: 'set', sent: '22 May', lineItems: [],
    cadi: { label: '£460–520 specialist range', note: 'Graffiti removal carries a specialist premium. SprayTech typically prices £470–490 per job — consider revising up slightly.' },
  },
  {
    id: 'jc3', contractor: 'ProWash Midlands', site: 'Amazon Tilbury – Exterior',
    service: 'Jet washing', date: 'Fri 29 May', time: '06:30–10:30',
    status: 'awaiting', price: '£240', mode: 'set', sent: '21 May', lineItems: [],
    cadi: { label: '£220–260 per job', note: 'Distribution centre jet wash avg £238 per job. Your price is competitive.' },
  },
  {
    id: 'jc5', contractor: 'Apex Window Care', site: 'Watling House Offices',
    service: 'Window cleaning', date: 'Thu 4 Jun', time: '06:00–09:00',
    status: 'negotiating', price: '£210', counterOffer: '£190', mode: 'quote', sent: '18 May',
    cadi: { label: 'Est. £180–210 per job', note: '4-floor comparable office avg £195. Contractor quoted £210 — your counter of £190 is reasonable.' },
    lineItems: [
      { desc: 'External windows — ground floor', qty: 1, unit: '£90',  total: '£90'  },
      { desc: 'External windows — floors 2–4',   qty: 3, unit: '£40',  total: '£120' },
    ],
  },
  {
    id: 'jc1', contractor: 'Clearview Window Services', site: 'Tesco Distribution – Welwyn',
    service: 'Window cleaning', date: 'Sat 30 May', time: '07:00–09:00',
    status: 'accepted', price: '£144', mode: 'set', sent: '20 May', lineItems: [],
    cadi: { label: '£130–155 per job', note: '47 comparable Tesco window cleans avg £142 per visit — your price was in range.' },
  },
];

const STATUS_CFG = {
  'needs-pricing':  { label: 'Set price',   color: '#38bdf8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)'  },
  'quote-received': { label: 'Quote in',    color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  'declined':       { label: 'Declined',    color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.3)' },
  'awaiting':       { label: 'Awaiting',    color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
  'negotiating':    { label: 'Negotiating', color: '#fb923c', bg: 'rgba(251,146,60,0.1)',  border: 'rgba(251,146,60,0.25)' },
  'accepted':       { label: 'Confirmed',   color: '#34d399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)' },
};

const NEEDS_ACTION = new Set(['needs-pricing', 'quote-received', 'declined']);

// ── Shared components ─────────────────────────────────────────────────────────

function Pill({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG['awaiting'];
  return (
    <span style={{ fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 999,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function CadiChip({ label, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '0.65rem 0.9rem',
      borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)' }}>
      <Zap size={13} color="#a78bfa" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <span style={{ fontSize: 11, fontWeight: 900, color: '#a78bfa' }}>Cadi&nbsp;</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.65)' }}>{label}</span>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2, lineHeight: 1.5 }}>{note}</div>
      </div>
    </div>
  );
}

// ── New job card wizard ───────────────────────────────────────────────────────

function NewCardWizard({ onDeploy, onClose, showToast }) {
  const [step,           setStep]           = useState(1);
  const [service,        setService]        = useState('');
  const [contractor,     setContractor]     = useState(null); // full contractor object
  const [site,           setSite]           = useState('');
  const [date,           setDate]           = useState('');
  const [priceInput,     setPriceInput]     = useState('');
  const [mode,           setMode]           = useState('set');

  const cadiEst       = service ? CADI_ESTIMATES[service] : null;
  const contractorList = service ? (CONTRACTORS_BY_SERVICE[service] || []) : [];
  const canStep1      = service && contractor && site;
  const canDeploy     = mode === 'quote' || priceInput;

  function handleDeploy() {
    const newCard = {
      id: `jc-${Date.now()}`,
      contractor: contractor.name,
      site,
      service,
      date: date || 'TBC',
      time: 'TBC',
      status: 'awaiting',
      price: mode === 'set' && priceInput ? `£${priceInput}` : null,
      mode,
      sent: 'Today',
      lineItems: [],
      cadi: cadiEst || { label: '', note: '' },
    };
    onDeploy(newCard);
    if (mode === 'set') showToast(`Job card deployed — £${priceInput} sent to ${contractor.name}`);
    else showToast(`Quote requested from ${contractor.name}`);
  }

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(14,165,233,0.3)', background: 'rgba(1,8,40,0.8)', marginBottom: '0.75rem', boxShadow: '0 8px 32px rgba(14,165,233,0.12)' }}>

      {/* Wizard header */}
      <div style={{ padding: '1rem 1.25rem', background: 'rgba(14,165,233,0.07)', borderBottom: '1px solid rgba(14,165,233,0.14)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[1, 2].map(n => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {n > 1 && <div style={{ width: 28, height: 1, background: step >= n ? '#38bdf8' : 'rgba(255,255,255,0.12)' }} />}
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900,
                background: step >= n ? '#38bdf8' : 'rgba(255,255,255,0.08)',
                color: step >= n ? 'white' : 'rgba(255,255,255,0.25)',
                boxShadow: step === n ? '0 0 10px rgba(56,189,248,0.5)' : 'none',
              }}>{n}</div>
              <span style={{ fontSize: 11, fontWeight: 800, color: step === n ? '#38bdf8' : 'rgba(255,255,255,0.3)' }}>
                {n === 1 ? 'Service, contractor & site' : 'Price & deploy'}
              </span>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, lineHeight: 1 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: '1.25rem 1.25rem' }}>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Service type */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Service type</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {SERVICES_LIST.map(s => (
                  <button key={s} onClick={() => { setService(s); setContractor(null); }}
                    style={{ padding: '0.5rem 1rem', borderRadius: 999, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.12s',
                      background: service === s ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${service === s ? 'rgba(56,189,248,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      color: service === s ? '#38bdf8' : 'rgba(255,255,255,0.45)',
                      boxShadow: service === s ? '0 0 12px rgba(56,189,248,0.15)' : 'none',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Contractor picker — shown once service selected */}
            {service && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Choose contractor
                  <span style={{ marginLeft: 6, fontWeight: 600, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.2)', fontSize: 9 }}>— ranked by rating for {service.toLowerCase()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {contractorList.map(c => {
                    const isSelected = contractor?.name === c.name;
                    return (
                      <button key={c.name} onClick={() => setContractor(c)}
                        style={{ padding: '0.7rem 0.9rem', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.12s',
                          background: isSelected ? 'rgba(56,189,248,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected ? 'rgba(56,189,248,0.45)' : 'rgba(255,255,255,0.08)'}`,
                          boxShadow: isSelected ? '0 0 14px rgba(56,189,248,0.12)' : 'none',
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 900, color: isSelected ? '#38bdf8' : 'white' }}>{c.name}</span>
                          {isSelected && <CheckCircle2 size={13} color="#38bdf8" style={{ flexShrink: 0 }} />}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 800 }}>★ {c.rating}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{c.rate}</span>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>·</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{c.jobs} jobs</span>
                        </div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', marginTop: 2 }}>{c.region}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Site + Date row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>Site</div>
                <select value={site} onChange={e => setSite(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.65rem 0.85rem', color: site ? 'white' : 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' }}>
                  <option value="">Select site…</option>
                  {SITES_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
                  Date <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: 'rgba(255,255,255,0.18)', fontSize: 9 }}>(optional)</span>
                </div>
                <input type="text" placeholder="e.g. Mon 9 Jun" value={date} onChange={e => setDate(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '0.65rem 0.85rem', color: 'white', fontSize: 12, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Cadi estimate — shows once service picked */}
            {cadiEst && <CadiChip label={cadiEst.label} note={cadiEst.note} />}

            <button onClick={() => setStep(2)} disabled={!canStep1}
              style={{ padding: '0.85rem', borderRadius: 12, fontSize: 13, fontWeight: 900, cursor: canStep1 ? 'pointer' : 'default', transition: 'all 0.15s',
                background: canStep1 ? 'linear-gradient(135deg, rgba(56,189,248,0.2), rgba(14,165,233,0.15))' : 'rgba(255,255,255,0.04)',
                color: canStep1 ? '#38bdf8' : 'rgba(255,255,255,0.2)',
                border: `1px solid ${canStep1 ? 'rgba(56,189,248,0.35)' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: canStep1 ? '0 2px 12px rgba(56,189,248,0.1)' : 'none',
              }}>
              Next: Set price →
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Summary */}
            <div style={{ padding: '0.7rem 0.9rem', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 900, color: 'white' }}>{service}</span>
              {' · '}{site}
              {date ? ` · ${date}` : ''}
              <br />
              Contractor: <span style={{ color: '#38bdf8', fontWeight: 800 }}>{contractor?.name}</span>
              {contractor && (
                <span style={{ marginLeft: 8, fontSize: 10, color: '#fbbf24' }}>★ {contractor.rating}</span>
              )}
              {contractor && (
                <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>· {contractor.rate}</span>
              )}
            </div>

            {cadiEst && <CadiChip label={cadiEst.label} note={cadiEst.note} />}

            {/* Mode toggle */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>Pricing method</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ id: 'set', label: "I'll set the price" }, { id: 'quote', label: 'Request their quote' }].map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)}
                    style={{ flex: 1, padding: '0.65rem 0.75rem', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all 0.12s',
                      background: mode === m.id ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${mode === m.id ? 'rgba(56,189,248,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: mode === m.id ? '#38bdf8' : 'rgba(255,255,255,0.35)',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price input */}
            {mode === 'set' && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#38bdf8', fontWeight: 900, fontSize: 18 }}>£</span>
                  <input style={{ width: '100%', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12, padding: '0.85rem 0.85rem 0.85rem 2rem', color: 'white', fontSize: 22, fontWeight: 900, outline: 'none', boxSizing: 'border-box' }}
                    placeholder="0" type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700, flexShrink: 0 }}>per job</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ padding: '0.8rem 1.1rem', borderRadius: 12, fontSize: 12, fontWeight: 800, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>← Back</button>
              <button onClick={handleDeploy} disabled={!canDeploy}
                style={{ flex: 1, padding: '0.8rem', borderRadius: 12, fontSize: 13, fontWeight: 900, border: 'none', cursor: canDeploy ? 'pointer' : 'default', transition: 'all 0.15s',
                  background: canDeploy ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'rgba(255,255,255,0.06)',
                  color: canDeploy ? 'white' : 'rgba(255,255,255,0.2)',
                  boxShadow: canDeploy ? '0 4px 20px rgba(14,165,233,0.35)' : 'none',
                }}>
                {mode === 'set'
                  ? `Deploy to ${contractor?.name} →`
                  : `Request quote from ${contractor?.name} →`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Card detail view ──────────────────────────────────────────────────────────

function CardDetail({ card, onBack, onUpdateCard, showToast }) {
  const [priceInput,   setPriceInput]   = useState('');
  const [reofferInput, setReofferInput] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        ← All job cards
      </button>

      <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ padding: '0.9rem 1.25rem', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: 'white' }}>{card.contractor}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{card.site} · {card.service}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{card.date} · {card.time}{card.sent ? ` · Sent ${card.sent}` : ''}</div>
          </div>
          <Pill status={card.status} />
        </div>

        {card.lineItems?.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ padding: '0.4rem 1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.22)' }}>
              Contractor's quote breakdown
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Description', 'Qty', 'Unit', 'Total'].map(h => (
                    <th key={h} style={{ padding: '0.35rem 1.25rem', textAlign: h === 'Description' ? 'left' : 'right', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.25)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.lineItems.map((item, i) => (
                  <tr key={i} style={{ borderBottom: i < card.lineItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                    <td style={{ padding: '0.5rem 1.25rem', color: 'rgba(255,255,255,0.62)', fontWeight: 600 }}>{item.desc}</td>
                    <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', color: 'rgba(255,255,255,0.4)' }}>{item.qty}</td>
                    <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', color: 'rgba(255,255,255,0.4)' }}>{item.unit}</td>
                    <td style={{ padding: '0.5rem 1.25rem', textAlign: 'right', fontWeight: 800, color: 'rgba(255,255,255,0.72)' }}>{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: '0.6rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Contractor's total</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#a78bfa' }}>{card.price}</span>
            </div>
            {card.counterOffer && (
              <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(251,146,60,0.04)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>Your counter-offer</span>
                <span style={{ fontSize: 20, fontWeight: 900, color: '#fb923c' }}>{card.counterOffer}</span>
              </div>
            )}
          </div>
        )}

        {card.price && card.mode === 'set' && (
          <div style={{ padding: '0.9rem 1.25rem', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Your price</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#38bdf8' }}>{card.price} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>per job</span></span>
          </div>
        )}
      </div>

      <CadiChip label={card.cadi.label} note={card.cadi.note} />

      {card.status === 'needs-pricing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>Set your job price</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#38bdf8', fontWeight: 900, fontSize: 16 }}>£</span>
              <input style={{ width: '100%', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 12, padding: '0.75rem 0.75rem 0.75rem 1.75rem', color: 'white', fontSize: 18, fontWeight: 900, outline: 'none', boxSizing: 'border-box' }}
                placeholder="0" type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)} />
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 600, flexShrink: 0 }}>per job</div>
          </div>
          <button onClick={() => { if (!priceInput) return; onUpdateCard(card.id, { status: 'awaiting', price: `£${priceInput}`, mode: 'set', sent: '27 May' }); showToast(`Price £${priceInput} sent to ${card.contractor}`); }}
            disabled={!priceInput}
            style={{ width: '100%', padding: '0.85rem', borderRadius: 12, fontSize: 13, fontWeight: 900,
              background: priceInput ? 'linear-gradient(135deg, #0ea5e9, #0284c7)' : 'rgba(255,255,255,0.06)',
              color: priceInput ? 'white' : 'rgba(255,255,255,0.2)', border: 'none',
              cursor: priceInput ? 'pointer' : 'default',
              boxShadow: priceInput ? '0 4px 16px rgba(14,165,233,0.3)' : 'none', transition: 'all 0.15s' }}>
            Send price to {card.contractor} →
          </button>
          <button onClick={() => { onUpdateCard(card.id, { status: 'awaiting', price: null, mode: 'quote', sent: '27 May' }); showToast(`Quote requested from ${card.contractor}`); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'rgba(255,255,255,0.3)', textDecoration: 'underline', padding: '0.25rem 0', textAlign: 'center' }}>
            Request a quote from them instead
          </button>
        </div>
      )}

      {card.status === 'awaiting' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.85rem', borderRadius: 12, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Clock size={14} color="#fbbf24" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>
              {card.mode === 'quote' ? 'Quote requested — awaiting contractor response' : 'Price sent — awaiting contractor response'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              {card.mode === 'quote'
                ? `${card.contractor} will submit a per-job quote with a line-item breakdown.`
                : `${card.contractor} has not yet accepted or declined your price of ${card.price}.`}
            </div>
          </div>
        </div>
      )}

      {card.status === 'declined' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ padding: '0.85rem', borderRadius: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#f87171', marginBottom: 3 }}>Contractor declined — re-offer at a higher price</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{card.contractor} declined your price of {card.price}. Enter a revised price to re-offer.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#fb923c', fontWeight: 900, fontSize: 15 }}>£</span>
              <input style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: '0.65rem 0.7rem 0.65rem 1.6rem', color: 'white', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }}
                placeholder="Revised job price" type="number" value={reofferInput} onChange={e => setReofferInput(e.target.value)} />
            </div>
            <button onClick={() => { if (!reofferInput) return; onUpdateCard(card.id, { status: 'awaiting', price: `£${reofferInput}`, sent: '27 May' }); showToast(`Revised price £${reofferInput} sent to ${card.contractor}`); }}
              disabled={!reofferInput}
              style={{ padding: '0.65rem 1.1rem', borderRadius: 10, background: reofferInput ? 'linear-gradient(135deg, #ea580c, #c2410c)' : 'rgba(255,255,255,0.06)', border: 'none', color: reofferInput ? 'white' : 'rgba(255,255,255,0.25)', fontWeight: 900, fontSize: 12, cursor: reofferInput ? 'pointer' : 'default', flexShrink: 0 }}>
              Re-offer →
            </button>
          </div>
        </div>
      )}

      {card.status === 'quote-received' && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { onUpdateCard(card.id, { status: 'accepted' }); showToast(`Quote from ${card.contractor} approved at ${card.price}`); }}
            style={{ flex: 1, padding: '0.75rem', borderRadius: 12, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.28)', color: '#34d399', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
            <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Approve {card.price}
          </button>
          <button onClick={() => { showToast(`Counter-offer sent to ${card.contractor}`); onBack(); }}
            style={{ flex: 1, padding: '0.75rem', borderRadius: 12, background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.28)', color: '#fb923c', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}>
            <MessageSquare size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
            Counter
          </button>
          <button onClick={() => { showToast(`Quote from ${card.contractor} declined`); onBack(); }}
            style={{ padding: '0.75rem 1rem', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Decline
          </button>
        </div>
      )}

      {card.status === 'negotiating' && (
        <div style={{ padding: '0.85rem', borderRadius: 12, background: 'rgba(251,146,60,0.07)', border: '1px solid rgba(251,146,60,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#fb923c', marginBottom: 3 }}>Counter-offer sent — awaiting contractor response</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Your counter of {card.counterOffer} sent to {card.contractor}. They will accept, counter, or decline in-app.</div>
        </div>
      )}

      {card.status === 'accepted' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.85rem', borderRadius: 12, background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <CheckCircle2 size={14} color="#34d399" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#34d399' }}>Job confirmed at {card.price}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>Invoice will land in your accounts inbox on completion.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FmQuoteManagement({ showToast }) {
  const [cards,    setCards]    = useState(INITIAL_CARDS);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  function updateCard(id, patch) {
    setCards(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
    setSelected(null);
  }

  function deployNewCard(newCard) {
    setCards(prev => [newCard, ...prev]);
    setCreating(false);
  }

  const needsAction = cards.filter(c => NEEDS_ACTION.has(c.status)).length;
  const awaiting    = cards.filter(c => c.status === 'awaiting' || c.status === 'negotiating').length;
  const confirmed   = cards.filter(c => c.status === 'accepted').length;
  const selectedCard = cards.find(c => c.id === selected);

  return (
    <div className="p-6 space-y-4 max-w-4xl">

      {/* ── Create banner ── */}
      <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(14,165,233,0.25)', background: 'rgba(14,165,233,0.05)' }}>
        <div style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={18} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: 'white', marginBottom: 3 }}>Create, price &amp; deploy</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                Pick a service · choose your contractor · set a price with Cadi's benchmark · deploy in one click
              </div>
            </div>
          </div>
          {!selectedCard && (
            <button onClick={() => { setCreating(c => !c); setSelected(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0.65rem 1.15rem', borderRadius: 12, fontSize: 12, fontWeight: 900, cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                background: creating ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                border: creating ? '1px solid rgba(255,255,255,0.1)' : 'none',
                color: creating ? 'rgba(255,255,255,0.4)' : 'white',
                boxShadow: creating ? 'none' : '0 4px 16px rgba(14,165,233,0.35)',
              }}>
              {creating ? <X size={13} /> : <Plus size={13} />}
              {creating ? 'Cancel' : 'New job card'}
            </button>
          )}
        </div>

        {/* Steps preview — only shown when not creating */}
        {!creating && !selectedCard && (
          <div style={{ display: 'flex', borderTop: '1px solid rgba(14,165,233,0.1)' }}>
            {[
              { n: 1, label: 'Service type',        dim: 'Window cleaning, jet wash…' },
              { n: 2, label: 'Choose contractor',   dim: 'Ranked by rating & price' },
              { n: 3, label: 'Set price or quote',  dim: 'Cadi benchmarks every job' },
              { n: 4, label: 'Deploy',              dim: 'Card sent instantly' },
            ].map((s, i) => (
              <div key={s.n} style={{ flex: 1, padding: '0.65rem 1rem', borderLeft: i > 0 ? '1px solid rgba(14,165,233,0.1)' : 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#38bdf8', flexShrink: 0 }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>{s.dim}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Need action',       value: needsAction, color: '#f87171' },
          { label: 'Awaiting response', value: awaiting,    color: '#fbbf24' },
          { label: 'Confirmed',         value: confirmed,   color: '#34d399' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/50 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Wizard */}
      {creating && !selectedCard && (
        <NewCardWizard onDeploy={deployNewCard} onClose={() => setCreating(false)} showToast={showToast} />
      )}

      {/* Detail or list */}
      {selectedCard ? (
        <CardDetail card={selectedCard} onBack={() => setSelected(null)} onUpdateCard={updateCard} showToast={showToast} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {cards.map(card => {
            const cfg      = STATUS_CFG[card.status] || STATUS_CFG['awaiting'];
            const isAction = NEEDS_ACTION.has(card.status);
            return (
              <button key={card.id} onClick={() => { setSelected(card.id); setCreating(false); }}
                style={{ width: '100%', padding: '0.9rem 1rem', borderRadius: 14, textAlign: 'left',
                  background: isAction ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isAction ? cfg.border : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isAction ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'; }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{card.contractor}</span>
                      <Pill status={card.status} />
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{card.site} · {card.service}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{card.date}{card.sent ? ` · Sent ${card.sent}` : ''}</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 10, fontWeight: 800, color: '#a78bfa', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 999, padding: '1px 8px' }}>
                      <Zap size={9} />{card.cadi.label}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {card.price ? (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 900, color: card.mode === 'quote' ? '#a78bfa' : '#38bdf8' }}>{card.price}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                          {card.status === 'quote-received' || card.status === 'negotiating' ? 'quoted' : 'per job'}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 800 }}>Set price →</div>
                    )}
                    <ChevronRight size={14} color="rgba(255,255,255,0.2)" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
