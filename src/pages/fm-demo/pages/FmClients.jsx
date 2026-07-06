import { useState } from 'react';
import {
  X,
  Upload,
  ChevronRight,
  ChevronLeft,
  Building2,
  MapPin,
  Layers,
  CheckCircle2,
  Circle,
  ArrowRight,
  Users,
  PoundSterling,
  BarChart2,
  Clock,
  Smartphone,
  Target,
  Zap,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Truck,
} from 'lucide-react';

// ── Wizard config ─────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 'contract', label: 'Contract', desc: 'Client & type' },
  { id: 'sites', label: 'Sites', desc: 'Locations & tiers' },
  { id: 'scope', label: 'Scope', desc: 'What gets cleaned' },
  { id: 'people', label: 'People', desc: 'Staff & compliance' },
  { id: 'slas', label: 'SLAs', desc: 'KPIs & reporting' },
  { id: 'golive', label: 'Go Live', desc: 'Portal & mobilisation' },
];

const CONTRACT_TYPES = [
  {
    id: 'contract',
    label: 'Contract Cleaning',
    desc: 'PAYE staff · daily schedules · SLA-driven',
    color: '#4f78ff',
    Icon: Users,
  },
  {
    id: 'exterior',
    label: 'Exterior Cleaning',
    desc: 'Contractors · seasonal · asset register',
    color: '#34d399',
    Icon: Truck,
  },
  {
    id: 'both',
    label: 'Both',
    desc: 'Full scope — internal + external combined',
    color: '#f59e0b',
    Icon: Zap,
  },
];

const SITE_TIERS = {
  1: { label: 'Tier 1', color: '#f87171', desc: 'Mission-critical — named supervisor Day 1' },
  2: { label: 'Tier 2', color: '#fbbf24', desc: 'Standard — Area Manager cover' },
  3: { label: 'Tier 3', color: '#34d399', desc: 'Low complexity — remote managed' },
};

const MOCK_SITES = [
  {
    id: 'ms1',
    name: 'Asda – Luton Supercentre',
    address: 'Gipsy Lane, Luton LU1 3HR',
    region: 'East of England',
    tier: 1,
  },
  {
    id: 'ms2',
    name: 'Asda – Milton Keynes Central',
    address: 'Grafton Gate E, Milton Keynes MK9 1DA',
    region: 'East of England',
    tier: 2,
  },
  {
    id: 'ms3',
    name: 'Asda – Watford Dome',
    address: 'Colonial Way, Watford WD24 4WU',
    region: 'South East',
    tier: 2,
  },
  {
    id: 'ms4',
    name: 'Asda – Stevenage Retail Park',
    address: 'Roaring Meg Retail Park, Stevenage SG1 1XN',
    region: 'East of England',
    tier: 3,
  },
  {
    id: 'ms5',
    name: 'Asda – Coventry Arena',
    address: 'Arena Park Shopping Centre, Coventry CV6 6GE',
    region: 'Midlands',
    tier: 2,
  },
  {
    id: 'ms6',
    name: 'Asda – Birmingham Minworth',
    address: 'Minworth Industrial Park, Birmingham B76 1AH',
    region: 'Midlands',
    tier: 1,
  },
];

const MOB_PHASES = [
  { id: 'award', label: 'Contract Award', Icon: FileCheck, step: 0 },
  { id: 'survey', label: 'Site Surveys', Icon: MapPin, step: 1 },
  { id: 'scope', label: 'Scope Confirmed', Icon: Layers, step: 2 },
  { id: 'people', label: 'People & TUPE', Icon: UserCheck, step: 3 },
  { id: 'kpis', label: 'KPIs Agreed', Icon: Target, step: 4 },
  { id: 'golive', label: 'Go Live', Icon: Zap, step: 5 },
];

// ── Mobilisation Panel ────────────────────────────────────────────────────────
function MobilisationPanel({ step, orgName, contractType, sites }) {
  const tier1 = sites.filter((s) => s.tier === 1).length;
  const tier2 = sites.filter((s) => s.tier === 2).length;
  const tier3 = sites.filter((s) => s.tier === 3).length;

  return (
    <div
      style={{
        width: 230,
        flexShrink: 0,
        background: 'rgba(1,8,40,0.8)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.25)',
            marginBottom: 6,
          }}
        >
          Mobilisation plan
        </div>
        <div style={{ fontSize: 12, fontWeight: 900, color: 'white', lineHeight: 1.2 }}>
          {orgName || 'New client'}
          {orgName ? ' — live' : ''}
        </div>
        {sites.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {tier1 > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(248,113,113,0.15)',
                  color: '#f87171',
                }}
              >
                T1 ×{tier1}
              </span>
            )}
            {tier2 > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(251,191,36,0.15)',
                  color: '#fbbf24',
                }}
              >
                T2 ×{tier2}
              </span>
            )}
            {tier3 > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 900,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(52,211,153,0.15)',
                  color: '#34d399',
                }}
              >
                T3 ×{tier3}
              </span>
            )}
          </div>
        )}
      </div>

      <div
        style={{ flex: 1, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 0 }}
      >
        {MOB_PHASES.map((phase, i) => {
          const { Icon } = phase;
          const done = step > phase.step;
          const active = step === phase.step;
          const last = i === MOB_PHASES.length - 1;
          const weeks = [0, 2, 3, 4, 6, 8];
          return (
            <div key={phase.id} style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 20,
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done
                      ? '#34d399'
                      : active
                        ? 'rgba(79,120,255,0.2)'
                        : 'rgba(255,255,255,0.05)',
                    border: done
                      ? '1px solid #34d399'
                      : active
                        ? '1px solid rgba(79,120,255,0.6)'
                        : '1px solid rgba(255,255,255,0.1)',
                    flexShrink: 0,
                  }}
                >
                  {done ? (
                    <CheckCircle2 size={11} style={{ color: 'white' }} />
                  ) : (
                    <Icon
                      size={9}
                      style={{ color: active ? '#4f78ff' : 'rgba(255,255,255,0.2)' }}
                    />
                  )}
                </div>
                {!last && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      minHeight: 14,
                      background: done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)',
                      margin: '3px 0',
                    }}
                  />
                )}
              </div>
              <div style={{ paddingBottom: last ? 0 : 14, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: done || active ? 700 : 500,
                    color: done ? '#34d399' : active ? 'white' : 'rgba(255,255,255,0.25)',
                  }}
                >
                  {phase.label}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>
                  {done ? '✓ Complete' : active ? 'In progress' : `Week ${weeks[i] + 1}`}
                </div>
                {phase.id === 'survey' && step >= 1 && sites.length > 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 9,
                      color: 'rgba(255,255,255,0.35)',
                      lineHeight: 1.5,
                    }}
                  >
                    {tier1 > 0 && (
                      <div>
                        Wk 1–2: {tier1} Tier 1 site{tier1 !== 1 ? 's' : ''}
                      </div>
                    )}
                    {tier2 > 0 && (
                      <div>
                        Wk 3–5: {tier2} Tier 2 site{tier2 !== 1 ? 's' : ''}
                      </div>
                    )}
                    {tier3 > 0 && (
                      <div>
                        Wk 6–8: {tier3} Tier 3 site{tier3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {contractType && (
        <div style={{ padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.25)',
              marginBottom: 5,
            }}
          >
            Contract type
          </div>
          <div
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              background:
                contractType === 'contract'
                  ? 'rgba(79,120,255,0.15)'
                  : contractType === 'exterior'
                    ? 'rgba(52,211,153,0.15)'
                    : 'rgba(245,158,11,0.15)',
              border: `1px solid ${contractType === 'contract' ? 'rgba(79,120,255,0.3)' : contractType === 'exterior' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
              color:
                contractType === 'contract'
                  ? '#7b9fff'
                  : contractType === 'exterior'
                    ? '#34d399'
                    : '#f59e0b',
              fontSize: 11,
              fontWeight: 900,
            }}
          >
            {contractType === 'contract'
              ? 'Contract Cleaning'
              : contractType === 'exterior'
                ? 'Exterior Cleaning'
                : 'Contract + Exterior'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Client Modal — 6-step wizard ─────────────────────────────────────────
function AddClientModal({ onClose, showToast, onNavigate }) {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState('Asda Stores Ltd');
  const [contractType, setContractType] = useState(null);
  const [contactName, setContactName] = useState('Helen Marsh');
  const [contactRole, setContactRole] = useState('Head of FM');
  const [contactEmail, setContactEmail] = useState('h.marsh@asda.com');
  const [contractValue, setContractValue] = useState('28,000');
  const [startDate, setStartDate] = useState('01/07/2026');
  const [mobTarget, setMobTarget] = useState('23/06/2026');
  const [importMode, setImportMode] = useState(null);
  const [sites, setSites] = useState([]);
  const [tupeYes, setTupeYes] = useState(true);
  const [tupeCount, setTupeCount] = useState('18');
  const [auditTarget] = useState(87);
  const [extContractorSource, setExtContractorSource] = useState('own'); // 'own' | 'connect' | 'both'
  const [contractStaffSource, setContractStaffSource] = useState('own'); // 'own' | 'connect' | 'both'

  const canNext = step === 0 ? contractType !== null : true;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          borderRadius: 20,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(145deg,#0f0d0a,#1c1510)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div>
            <div style={{ color: 'white', fontWeight: 900, fontSize: 14 }}>Onboard new client</div>
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 }}>
              Cadi builds your mobilisation plan and client portal as you go
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.3)',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Step bar */}
        <div
          style={{
            display: 'flex',
            padding: '8px 22px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          {WIZARD_STEPS.map((s, i) => {
            const done = i < step;
            const active = i === step;
            const last = i === WIZARD_STEPS.length - 1;
            return (
              <div
                key={s.id}
                style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}
              >
                <button
                  onClick={() => i < step && setStep(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'transparent',
                    border: 'none',
                    cursor: i < step ? 'pointer' : 'default',
                    padding: '3px 0',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      fontWeight: 900,
                      flexShrink: 0,
                      background: done
                        ? '#34d399'
                        : active
                          ? 'linear-gradient(135deg,#4f78ff,#6366f1)'
                          : 'rgba(255,255,255,0.06)',
                      color: done || active ? 'white' : 'rgba(255,255,255,0.25)',
                      boxShadow: active ? '0 0 8px rgba(79,120,255,0.4)' : 'none',
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ textAlign: 'left', minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        lineHeight: 1,
                        color: active ? 'white' : done ? '#34d399' : 'rgba(255,255,255,0.22)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.label}
                    </div>
                    <div
                      style={{
                        fontSize: 8,
                        color: 'rgba(255,255,255,0.15)',
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.desc}
                    </div>
                  </div>
                </button>
                {!last && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      margin: '0 8px',
                      minWidth: 6,
                      background: done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.06)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
            {/* ── STEP 0: Contract ── */}
            {step === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Contract type <span style={{ color: '#f87171' }}>*</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    {CONTRACT_TYPES.map((ct) => {
                      const { Icon } = ct;
                      const sel = contractType === ct.id;
                      return (
                        <button
                          key={ct.id}
                          onClick={() => setContractType(ct.id)}
                          style={{
                            padding: '14px 12px',
                            borderRadius: 14,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: sel ? `${ct.color}18` : 'rgba(255,255,255,0.03)',
                            border: sel
                              ? `2px solid ${ct.color}60`
                              : '2px solid rgba(255,255,255,0.08)',
                            boxShadow: sel ? `0 0 20px ${ct.color}20` : 'none',
                          }}
                        >
                          <Icon
                            size={18}
                            style={{
                              color: sel ? ct.color : 'rgba(255,255,255,0.2)',
                              marginBottom: 8,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              color: sel ? 'white' : 'rgba(255,255,255,0.5)',
                              marginBottom: 4,
                            }}
                          >
                            {ct.label}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              color: sel ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
                              lineHeight: 1.4,
                            }}
                          >
                            {ct.desc}
                          </div>
                          {sel && (
                            <div
                              style={{
                                marginTop: 8,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: ct.color,
                                }}
                              />
                              <span style={{ fontSize: 9, fontWeight: 900, color: ct.color }}>
                                Selected
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!contractType && (
                    <div style={{ marginTop: 6, fontSize: 10, color: 'rgba(248,113,113,0.6)' }}>
                      Select a contract type to continue
                    </div>
                  )}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Client details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Organisation name', value: orgName, onChange: setOrgName },
                      {
                        label: 'Sector',
                        value: 'Retail',
                        type: 'select',
                        options: [
                          'Retail',
                          'Industrial / Logistics',
                          'Commercial / Offices',
                          'Public Sector',
                          'Education',
                          'Healthcare',
                          'Hospitality',
                          'FM Contractor',
                        ],
                      },
                      { label: 'Primary contact', value: contactName, onChange: setContactName },
                      { label: 'Role', value: contactRole, onChange: setContactRole },
                      { label: 'Contact email', value: contactEmail, onChange: setContactEmail },
                      {
                        label: 'Monthly contract value (£)',
                        value: contractValue,
                        onChange: setContractValue,
                      },
                    ].map(({ label, value, onChange, type, options }) => (
                      <div key={label}>
                        <label
                          style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 5,
                          }}
                        >
                          {label}
                        </label>
                        {type === 'select' ? (
                          <select
                            defaultValue={value}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white appearance-none"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              outline: 'none',
                            }}
                          >
                            {options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              outline: 'none',
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Contract dates
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: 'Contract start date', value: startDate, onChange: setStartDate },
                      {
                        label: 'Mobilisation target (Day 1)',
                        value: mobTarget,
                        onChange: setMobTarget,
                      },
                    ].map(({ label, value, onChange }) => (
                      <div key={label}>
                        <label
                          style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 5,
                          }}
                        >
                          {label}
                        </label>
                        <input
                          value={value}
                          onChange={(e) => onChange(e.target.value)}
                          className="w-full rounded-xl px-3 py-2 text-sm text-white"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      marginTop: 10,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(245,158,11,0.06)',
                      border: '1px solid rgba(245,158,11,0.2)',
                      fontSize: 10,
                      color: 'rgba(245,158,11,0.7)',
                      display: 'flex',
                      gap: 6,
                      alignItems: 'flex-start',
                    }}
                  >
                    <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
                    TUPE transfers require 28 days notice from staff notification — Cadi will flag
                    if your mobilisation window is tight.
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 1: Sites ── */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  Import your site list. Each site gets tier-classified — Tier 1 sites go live first
                  with a dedicated supervisor from Day 1.
                </div>

                {!importMode && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <button
                      onClick={() => {
                        setImportMode('csv');
                        setSites(MOCK_SITES);
                      }}
                      style={{
                        borderRadius: 16,
                        padding: 20,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(79,120,255,0.08)',
                        border: '2px dashed rgba(79,120,255,0.3)',
                        color: '#7b9fff',
                      }}
                    >
                      <Upload size={22} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                      <div style={{ fontSize: 13, fontWeight: 900 }}>Upload CSV</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                        Site name · address · region · tier
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        setImportMode('manual');
                        setSites([]);
                      }}
                      style={{
                        borderRadius: 16,
                        padding: 20,
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.03)',
                        border: '2px dashed rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.4)',
                      }}
                    >
                      <Layers size={22} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                      <div style={{ fontSize: 13, fontWeight: 900 }}>Add manually</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                        Build site list one by one
                      </div>
                    </button>
                  </div>
                )}

                {importMode === 'csv' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div
                      style={{
                        borderRadius: 10,
                        padding: '10px 14px',
                        textAlign: 'center',
                        background: 'rgba(79,120,255,0.06)',
                        border: '2px dashed rgba(79,120,255,0.2)',
                        marginBottom: 2,
                      }}
                    >
                      <div
                        style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}
                      >
                        Demo — auto-imported from spreadsheet
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 900, color: '#7b9fff' }}>
                        ✓ asda-sites.csv — {MOCK_SITES.length} sites imported
                      </div>
                    </div>
                    {MOCK_SITES.map((s) => {
                      const tier = SITE_TIERS[s.tier];
                      return (
                        <div
                          key={s.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            borderRadius: 12,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: tier.color,
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {s.name}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                              {s.address}
                            </div>
                          </div>
                          <div
                            style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}
                          >
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: 'rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.4)',
                              }}
                            >
                              {s.region}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                padding: '2px 7px',
                                borderRadius: 5,
                                background: `${tier.color}18`,
                                color: tier.color,
                              }}
                            >
                              {tier.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      onClick={() => {
                        setImportMode(null);
                        setSites([]);
                      }}
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.25)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        marginTop: 2,
                      }}
                    >
                      ← Change import method
                    </button>
                  </div>
                )}

                {importMode === 'manual' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        fontSize: 11,
                        color: 'rgba(255,255,255,0.35)',
                        textAlign: 'center',
                      }}
                    >
                      No sites added yet — use the button below to add your first site
                    </div>
                    <button
                      style={{
                        padding: '10px 12px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.4)',
                        textAlign: 'left',
                        background: 'transparent',
                        border: '1px dashed rgba(255,255,255,0.12)',
                        cursor: 'pointer',
                      }}
                    >
                      + Add site
                    </button>
                    <button
                      onClick={() => {
                        setImportMode(null);
                        setSites([]);
                      }}
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.25)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      ← Switch to CSV upload
                    </button>
                  </div>
                )}

                {importMode === 'csv' && (
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        color: 'rgba(255,255,255,0.25)',
                        marginBottom: 8,
                      }}
                    >
                      Phased mobilisation (auto-generated from tiers)
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {[
                        {
                          color: '#f87171',
                          label: 'Week 1–2',
                          title: 'Tier 1 sites',
                          desc: 'Named supervisor · on-site management from Day 1',
                        },
                        {
                          color: '#fbbf24',
                          label: 'Week 3–5',
                          title: 'Tier 2 sites',
                          desc: 'Area Manager cover · regular site visits',
                        },
                        {
                          color: '#34d399',
                          label: 'Week 6–8',
                          title: 'Tier 3 sites',
                          desc: 'Remote managed · periodic visits',
                        },
                      ].map((row) => (
                        <div
                          key={row.label}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: row.color,
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.35)',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {row.label}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                            {row.title}
                          </span>
                          <span style={{ color: 'rgba(255,255,255,0.3)' }}>— {row.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Scope ── */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                  {contractType === 'exterior'
                    ? 'Build the exterior asset register for each site. Cadi generates schedules and method statements automatically.'
                    : contractType === 'both'
                      ? 'Define the internal scope and exterior asset register for each site.'
                      : 'Define what gets cleaned at each site — this generates job cards and allocates hours automatically.'}
                </div>

                {(contractType === 'contract' || contractType === 'both') && (
                  <div
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid rgba(79,120,255,0.25)',
                      background: 'rgba(79,120,255,0.04)',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ color: 'white', fontWeight: 800, fontSize: 12 }}>
                          Asda – Luton Supercentre
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                          Tier 1 · East of England · contract cleaning scope
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(248,113,113,0.15)',
                          color: '#f87171',
                        }}
                      >
                        TIER 1
                      </span>
                    </div>
                    <div
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {[
                        {
                          area: 'Sales floor & checkouts',
                          type: 'Morning clean',
                          window: '05:30–08:00',
                          freq: 'Mon–Sat',
                          hrs: 52,
                        },
                        {
                          area: 'Stockroom & back of house',
                          type: 'Daily clean',
                          window: '06:00–08:00',
                          freq: 'Mon–Fri',
                          hrs: 44,
                        },
                        {
                          area: 'All washrooms',
                          type: 'Washroom service',
                          window: '12:00–13:00',
                          freq: 'Mon–Sat',
                          hrs: 26,
                        },
                        {
                          area: 'Whole store',
                          type: 'Deep clean',
                          window: '22:00–02:00',
                          freq: 'Weekly',
                          hrs: 16,
                        },
                      ].map((row, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 12px',
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(79,120,255,0.1)',
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 2,
                              background: '#4f78ff',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.45)',
                              fontSize: 10,
                              flex: '0 0 150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.area}
                          </span>
                          <span
                            style={{
                              color: 'white',
                              fontWeight: 700,
                              fontSize: 11,
                              flex: '0 0 120px',
                            }}
                          >
                            {row.type}
                          </span>
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.3)',
                              fontSize: 10,
                              flex: '0 0 85px',
                            }}
                          >
                            ⏱ {row.window}
                          </span>
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.3)',
                              fontSize: 10,
                              flex: '0 0 70px',
                            }}
                          >
                            {row.freq}
                          </span>
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: 10,
                              marginLeft: 'auto',
                            }}
                          >
                            {row.hrs}h/mo
                          </span>
                        </div>
                      ))}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: 4,
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#4f78ff' }}>
                          4 job cards · 138 hrs/month
                        </span>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                          + 5 more sites to configure
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {(contractType === 'exterior' || contractType === 'both') && (
                  <div
                    style={{
                      borderRadius: 14,
                      overflow: 'hidden',
                      border: '1px solid rgba(52,211,153,0.25)',
                      background: 'rgba(52,211,153,0.04)',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div style={{ color: 'white', fontWeight: 800, fontSize: 12 }}>
                        Exterior asset register — Asda Luton
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
                        Car park · facade · windows · gutters · grounds
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '12px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {[
                        {
                          asset: 'Car park',
                          detail: '3,200 m² · tarmac · 184 bays',
                          freq: 'Monthly jet wash',
                        },
                        {
                          asset: 'Building facade',
                          detail: '2,100 m² · composite cladding',
                          freq: 'Bi-annual clean',
                        },
                        {
                          asset: 'Windows',
                          detail: '3 floors · reach & wash system',
                          freq: 'Monthly',
                        },
                        {
                          asset: 'Gutters & downpipes',
                          detail: '240 lin.m · last cleared Apr 2025',
                          freq: 'Bi-annual clear',
                        },
                        {
                          asset: 'Grounds & landscape',
                          detail: '1,800 m² · beds, lawn, hard landscape',
                          freq: 'Fortnightly cut',
                        },
                      ].map((row, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '9px 12px',
                            borderRadius: 8,
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(52,211,153,0.1)',
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 2,
                              background: '#34d399',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              color: 'white',
                              fontWeight: 700,
                              fontSize: 11,
                              flex: '0 0 130px',
                            }}
                          >
                            {row.asset}
                          </span>
                          <span
                            style={{
                              color: 'rgba(255,255,255,0.4)',
                              fontSize: 10,
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {row.detail}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(52,211,153,0.12)',
                              color: '#34d399',
                              flexShrink: 0,
                            }}
                          >
                            {row.freq}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(79,120,255,0.06)',
                    border: '1px solid rgba(79,120,255,0.2)',
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  In the full flow, you complete scope for all 6 sites. Cadi automatically generates{' '}
                  <strong style={{ color: '#7b9fff' }}>
                    {contractType === 'both' ? 28 : contractType === 'exterior' ? 30 : 24} job cards
                  </strong>{' '}
                  and a <strong style={{ color: '#7b9fff' }}>site-level method statement</strong>{' '}
                  for each.
                </div>
              </div>
            )}

            {/* ── STEP 3: People ── */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {(contractType === 'contract' || contractType === 'both') && (
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.3)',
                        marginBottom: 10,
                      }}
                    >
                      TUPE — staff transfer
                    </div>
                    <div
                      style={{
                        borderRadius: 14,
                        padding: 16,
                        background: tupeYes ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.03)',
                        border: tupeYes
                          ? '1px solid rgba(251,191,36,0.25)'
                          : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <div
                        style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}
                      >
                        Are staff transferring from the outgoing contractor?
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginBottom: tupeYes ? 14 : 0 }}>
                        {[true, false].map((val) => (
                          <button
                            key={String(val)}
                            onClick={() => setTupeYes(val)}
                            style={{
                              flex: 1,
                              padding: '10px',
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 900,
                              cursor: 'pointer',
                              background:
                                tupeYes === val
                                  ? val
                                    ? 'rgba(251,191,36,0.15)'
                                    : 'rgba(52,211,153,0.15)'
                                  : 'rgba(255,255,255,0.04)',
                              border:
                                tupeYes === val
                                  ? `1px solid ${val ? 'rgba(251,191,36,0.4)' : 'rgba(52,211,153,0.4)'}`
                                  : '1px solid rgba(255,255,255,0.1)',
                              color:
                                tupeYes === val
                                  ? val
                                    ? '#fbbf24'
                                    : '#34d399'
                                  : 'rgba(255,255,255,0.35)',
                            }}
                          >
                            {val ? 'Yes — TUPE applies' : 'No — new hires only'}
                          </button>
                        ))}
                      </div>
                      {tupeYes && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {[
                              {
                                label: 'Staff transferring',
                                value: tupeCount,
                                onChange: setTupeCount,
                              },
                              { label: 'Transfer date', value: '01/07/2026', onChange: () => {} },
                            ].map(({ label, value, onChange }) => (
                              <div key={label}>
                                <label
                                  style={{
                                    display: 'block',
                                    color: 'rgba(255,255,255,0.3)',
                                    fontSize: '0.6rem',
                                    fontWeight: 900,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    marginBottom: 5,
                                  }}
                                >
                                  {label}
                                </label>
                                <input
                                  value={value}
                                  onChange={(e) => onChange(e.target.value)}
                                  className="w-full rounded-xl px-3 py-2 text-sm text-white"
                                  style={{
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.12)',
                                    outline: 'none',
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <div
                            style={{
                              fontSize: 9,
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              letterSpacing: '0.12em',
                              color: 'rgba(255,255,255,0.25)',
                              marginBottom: 2,
                            }}
                          >
                            TUPE checklist — Cadi tracks automatically
                          </div>
                          {[
                            {
                              label:
                                'Employee liability information requested from outgoing contractor',
                              done: true,
                            },
                            {
                              label: 'Individual staff consultation meetings scheduled',
                              done: true,
                            },
                            { label: 'Right-to-work documentation verified', done: false },
                            { label: 'DBS checks initiated', done: false },
                            { label: 'Payroll records transferred', done: false },
                            { label: 'Uniform and access passes ordered', done: false },
                          ].map(({ label, done }) => (
                            <div
                              key={label}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                padding: '7px 10px',
                                borderRadius: 8,
                                background: done
                                  ? 'rgba(52,211,153,0.05)'
                                  : 'rgba(255,255,255,0.02)',
                                border: `1px solid ${done ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)'}`,
                              }}
                            >
                              {done ? (
                                <CheckCircle2
                                  size={13}
                                  style={{ color: '#34d399', flexShrink: 0 }}
                                />
                              ) : (
                                <Circle
                                  size={13}
                                  style={{ color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}
                                />
                              )}
                              <span
                                style={{
                                  fontSize: 10,
                                  color: done ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                                }}
                              >
                                {label}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(contractType === 'contract' || contractType === 'both') && (
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.3)',
                        marginBottom: 6,
                      }}
                    >
                      Staff source (contract cleaning)
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                      Choose where staff are sourced from — select one or both.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        {
                          key: 'own',
                          label: 'Your employed staff',
                          desc: 'PAYE cleaners on your payroll — scheduled and managed through Cadi',
                          color: '#4f78ff',
                        },
                        {
                          key: 'connect',
                          label: 'Cadi Connect',
                          desc: 'Access verified freelance and agency staff for overflow or specialist requirements',
                          color: '#f59e0b',
                        },
                      ].map(({ key, label, desc, color }) => {
                        const active =
                          contractStaffSource === key || contractStaffSource === 'both';
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setContractStaffSource((prev) =>
                                prev === key
                                  ? key === 'own'
                                    ? 'connect'
                                    : 'own'
                                  : prev === 'both'
                                    ? key === 'own'
                                      ? 'connect'
                                      : 'own'
                                    : 'both'
                              )
                            }
                            style={{
                              padding: '12px 14px',
                              borderRadius: 12,
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              background: active ? `${color}0d` : 'rgba(255,255,255,0.03)',
                              border: active
                                ? `1px solid ${color}40`
                                : '1px solid rgba(255,255,255,0.08)',
                              boxShadow: active ? `0 0 12px ${color}15` : 'none',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: active ? 'white' : 'rgba(255,255,255,0.4)',
                                marginBottom: 4,
                              }}
                            >
                              {label}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.3)',
                                lineHeight: 1.4,
                              }}
                            >
                              {desc}
                            </div>
                            {active && (
                              <div style={{ marginTop: 8, fontSize: 9, fontWeight: 900, color }}>
                                ✓ Selected
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {contractStaffSource === 'both' && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: 'rgba(79,120,255,0.06)',
                          border: '1px solid rgba(79,120,255,0.2)',
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.45)',
                        }}
                      >
                        ✓ Your employed staff cover scheduled work — Cadi Connect fills gaps
                        automatically.
                      </div>
                    )}
                  </div>
                )}

                {(contractType === 'exterior' || contractType === 'both') && (
                  <div>
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.3)',
                        marginBottom: 6,
                      }}
                    >
                      Contractors (exterior)
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>
                      Choose where exterior jobs are assigned from — select one or both.
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        {
                          key: 'own',
                          label: 'Your contractor pool',
                          desc: 'Send job cards to your own vetted contractors — ranked by rating and availability',
                          color: '#34d399',
                        },
                        {
                          key: 'connect',
                          label: 'Cadi Connect',
                          desc: 'Tap into the wider network of verified contractors when your pool is at capacity',
                          color: '#f59e0b',
                        },
                      ].map(({ key, label, desc, color }) => {
                        const active =
                          extContractorSource === key || extContractorSource === 'both';
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setExtContractorSource((prev) =>
                                prev === key
                                  ? key === 'own'
                                    ? 'connect'
                                    : 'own'
                                  : prev === 'both'
                                    ? key === 'own'
                                      ? 'connect'
                                      : 'own'
                                    : 'both'
                              )
                            }
                            style={{
                              padding: '12px 14px',
                              borderRadius: 12,
                              textAlign: 'left',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              background: active ? `${color}0d` : 'rgba(255,255,255,0.03)',
                              border: active
                                ? `1px solid ${color}40`
                                : '1px solid rgba(255,255,255,0.08)',
                              boxShadow: active ? `0 0 12px ${color}15` : 'none',
                            }}
                          >
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 900,
                                color: active ? 'white' : 'rgba(255,255,255,0.4)',
                                marginBottom: 4,
                              }}
                            >
                              {label}
                            </div>
                            <div
                              style={{
                                fontSize: 10,
                                color: 'rgba(255,255,255,0.3)',
                                lineHeight: 1.4,
                              }}
                            >
                              {desc}
                            </div>
                            {active && (
                              <div style={{ marginTop: 8, fontSize: 9, fontWeight: 900, color }}>
                                ✓ Selected
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {extContractorSource === 'both' && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: 'rgba(79,120,255,0.06)',
                          border: '1px solid rgba(79,120,255,0.2)',
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.45)',
                        }}
                      >
                        ✓ Your pool gets first offer — Cadi Connect fills any gaps automatically.
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Compliance requirements
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'DBS check level', value: 'Basic DBS (Retail)' },
                      { label: 'COSHH assessment required', value: 'Yes — all chemicals' },
                      { label: 'RAMS per site', value: 'Yes — generated by Cadi' },
                      { label: 'Public liability insurance', value: '£10m (Britannia standard)' },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: 9,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 4: SLAs ── */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    KPI framework
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {[
                      {
                        label: 'Cleaning audit pass score',
                        value: `${auditTarget}%`,
                        sub: 'Minimum pass threshold',
                        color: '#4f78ff',
                      },
                      {
                        label: 'Re-clean response time',
                        value: '24 hours',
                        sub: 'From complaint logged',
                        color: '#34d399',
                      },
                      {
                        label: 'Staff cover rate',
                        value: '95%',
                        sub: 'Minimum acceptable',
                        color: '#a78bfa',
                      },
                      {
                        label: 'Reactive request SLA',
                        value: '4 hours',
                        sub: 'Emergency call-outs',
                        color: '#f59e0b',
                      },
                    ].map(({ label, value, sub, color }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${color}12`,
                            flexShrink: 0,
                          }}
                        >
                          <Target size={15} style={{ color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>
                            {label}
                          </div>
                          <div
                            style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}
                          >
                            {sub}
                          </div>
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 900, color }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Reporting & escalation
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      {
                        label: 'Report frequency',
                        value: 'Monthly',
                        type: 'select',
                        options: ['Weekly', 'Monthly', 'Quarterly'],
                      },
                      { label: 'Reports sent to', value: 'h.marsh@asda.com', type: 'input' },
                      {
                        label: 'First escalation',
                        value: 'James Harper (Ops Director)',
                        type: 'input',
                      },
                      { label: 'Emergency out-of-hours', value: '+44 7700 900 000', type: 'input' },
                    ].map(({ label, value, type, options }) => (
                      <div key={label}>
                        <label
                          style={{
                            display: 'block',
                            color: 'rgba(255,255,255,0.3)',
                            fontSize: '0.6rem',
                            fontWeight: 900,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            marginBottom: 5,
                          }}
                        >
                          {label}
                        </label>
                        {type === 'select' ? (
                          <select
                            defaultValue={value}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white appearance-none"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              outline: 'none',
                            }}
                          >
                            {options.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            defaultValue={value}
                            className="w-full rounded-xl px-3 py-2 text-sm text-white"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              border: '1px solid rgba(255,255,255,0.12)',
                              outline: 'none',
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    Client portal features
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { label: 'Live job status per site', on: true },
                      { label: 'Photo evidence per visit', on: true },
                      { label: 'SLA performance dashboard', on: true },
                      { label: 'Monthly report download', on: true },
                      { label: 'Raise issues & requests', on: true },
                      { label: 'Mobilisation tracker', on: true },
                      { label: 'Invoice access', on: false },
                    ].map(({ label, on }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 9,
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 900,
                            color: on ? '#34d399' : 'rgba(255,255,255,0.2)',
                          }}
                        >
                          {on ? '✓ On' : '— Off'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 5: Go Live ── */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                  {[
                    { label: 'Sites', value: sites.length || 6, color: '#4f78ff' },
                    {
                      label: 'Job cards',
                      value: contractType === 'both' ? 28 : contractType === 'exterior' ? 30 : 24,
                      color: '#34d399',
                    },
                    { label: 'Monthly', value: `£${contractValue || '28,000'}`, color: '#f59e0b' },
                    {
                      label: 'Staff / TUPE',
                      value: tupeYes ? `${tupeCount} TUPE` : 'New hires',
                      color: '#a78bfa',
                    },
                    { label: 'Audit target', value: `${auditTarget}%`, color: '#60a5fa' },
                    { label: 'Go-live', value: startDate || '01/07/2026', color: '#f472b6' },
                  ].map(({ label, value, color }) => (
                    <div
                      key={label}
                      style={{
                        padding: '12px',
                        borderRadius: 12,
                        background: `${color}0a`,
                        border: `1px solid ${color}25`,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 900, color }}>{value}</div>
                      <div
                        style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.3)',
                          marginTop: 2,
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    padding: 16,
                    background: 'rgba(52,211,153,0.07)',
                    border: '1px solid rgba(52,211,153,0.25)',
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
                      <div style={{ color: 'white', fontSize: 12, fontWeight: 900 }}>
                        Client portal — ready to activate
                      </div>
                      <div
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.4)',
                          marginTop: 3,
                        }}
                      >
                        client.cadi.cleaning/
                        {orgName
                          .toLowerCase()
                          .replace(/\s+/g, '-')
                          .replace(/[^a-z0-9-]/g, '')}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        padding: '4px 10px',
                        borderRadius: 20,
                        background: 'rgba(52,211,153,0.15)',
                        color: '#34d399',
                        border: '1px solid rgba(52,211,153,0.3)',
                      }}
                    >
                      READY
                    </span>
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                    {orgName} will receive a login email. They'll see their site map, live job
                    status, mobilisation tracker and photo evidence from Day 1.
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'rgba(255,255,255,0.3)',
                      marginBottom: 10,
                    }}
                  >
                    What Cadi does next — automatically
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      `Generates ${contractType === 'both' ? 28 : contractType === 'exterior' ? 30 : 24} job cards across all ${sites.length || 6} sites`,
                      'Creates RAMS and COSHH templates per site',
                      'Schedules site survey reminders for each tier',
                      tupeYes
                        ? `Opens TUPE checklist and tracks the 28-day transfer timeline for ${tupeCount} staff`
                        : 'Creates recruitment pipeline for new hires',
                      `Activates the client portal and sends login to ${contactName}`,
                      'Builds mobilisation Gantt and notifies assigned Area Managers',
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          borderRadius: 9,
                          background: 'rgba(52,211,153,0.05)',
                          border: '1px solid rgba(52,211,153,0.12)',
                        }}
                      >
                        <Zap size={11} style={{ color: '#34d399', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <MobilisationPanel
            step={step}
            orgName={orgName}
            contractType={contractType}
            sites={sites}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 22px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <button
            onClick={step === 0 ? onClose : () => setStep((s) => s - 1)}
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              cursor: 'pointer',
            }}
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {WIZARD_STEPS.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background:
                      i === step ? '#4f78ff' : i < step ? '#34d399' : 'rgba(255,255,255,0.1)',
                    transition: 'all 0.2s',
                  }}
                />
              ))}
            </div>
            {step < WIZARD_STEPS.length - 1 ? (
              <button
                onClick={() => canNext && setStep((s) => s + 1)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 900,
                  color: canNext ? 'white' : 'rgba(255,255,255,0.3)',
                  background: canNext
                    ? 'linear-gradient(135deg,#4f78ff,#6366f1)'
                    : 'rgba(255,255,255,0.06)',
                  boxShadow: canNext ? '0 4px 16px rgba(79,120,255,0.35)' : 'none',
                  border: 'none',
                  cursor: canNext ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                Next <ChevronRight size={13} />
              </button>
            ) : (
              <button
                onClick={() => {
                  showToast(`${orgName} onboarded — mobilisation plan live · portal activating`);
                  onClose();
                  onNavigate('client-portals');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 22px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 900,
                  color: 'white',
                  background: 'linear-gradient(135deg,#34d399,#059669)',
                  boxShadow: '0 4px 16px rgba(52,211,153,0.35)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ✓ Launch mobilisation &amp; activate portal
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Client data ───────────────────────────────────────────────────────────────
const CLIENTS = [
  {
    id: 'cl1',
    name: 'Next Retail UK Ltd',
    logo: 'NX',
    type: 'Retail',
    sites: 3,
    value: 5400,
    sla: 99,
    contact: 'Helen Marsh',
    contactRole: 'Facilities Manager',
    since: 'Jan 2024',
    openIssues: 0,
    siteList: ['Next – Luton The Mall', 'Next – Centre:MK', 'Next – Watford Atria'],
    lastClean: 'Today 07:42',
    portalActive: true,
  },
  {
    id: 'cl2',
    name: 'Luton & Dunstable NHS FT',
    logo: 'LD',
    type: 'Healthcare',
    sites: 2,
    value: 13000,
    sla: 98,
    contact: 'Brian Cole',
    contactRole: 'Estates Manager',
    since: 'Mar 2023',
    openIssues: 1,
    siteList: ['L&D Hospital – Main Tower', 'L&D Hospital – A&E'],
    lastClean: 'Today 06:15',
    portalActive: true,
    note: 'ISS-0040 in progress — quality dispute A&E wing',
  },
  {
    id: 'cl3',
    name: 'Aldi UK Ltd',
    logo: 'AL',
    type: 'Industrial',
    sites: 1,
    value: 4200,
    sla: 97,
    contact: 'Ops Team',
    contactRole: 'Regional Ops',
    since: 'Jun 2023',
    openIssues: 0,
    siteList: ['Aldi – Dunstable Distribution RDC'],
    lastClean: 'Today 05:50',
    portalActive: true,
  },
  {
    id: 'cl4',
    name: 'Luton Borough Council',
    logo: 'LB',
    type: 'Public Sector',
    sites: 2,
    value: 6800,
    sla: 96,
    contact: 'Janet Simms',
    contactRole: 'Facilities Lead',
    since: 'Sep 2023',
    openIssues: 1,
    siteList: ['Luton Central Library', 'Luton Town Hall'],
    lastClean: 'Today 07:10',
    portalActive: true,
    note: 'ISS-0041 open — SLA breach Luton Library this morning',
  },
  {
    id: 'cl5',
    name: 'Central Bedfordshire Council',
    logo: 'CB',
    type: 'Public Sector',
    sites: 2,
    value: 7200,
    sla: 98,
    contact: 'Mark Davies',
    contactRole: 'Estates Director',
    since: 'Nov 2023',
    openIssues: 0,
    siteList: ['Central Beds Council HQ', 'Central Beds Watling House'],
    lastClean: 'Today 07:30',
    portalActive: true,
  },
  {
    id: 'cl6',
    name: 'Whitbread Hotels Ltd',
    logo: 'WH',
    type: 'Hospitality',
    sites: 1,
    value: 3200,
    sla: 95,
    contact: 'Ops Team',
    contactRole: 'Regional Ops',
    since: 'Feb 2024',
    openIssues: 0,
    siteList: ['Premier Inn Luton Airport'],
    lastClean: 'Today 06:30',
    portalActive: true,
  },
  {
    id: 'cl7',
    name: 'Waterstones Ltd',
    logo: 'WS',
    type: 'Retail',
    sites: 2,
    value: 3600,
    sla: 97,
    contact: 'Regional Ops',
    contactRole: 'Regional Manager',
    since: 'Apr 2024',
    openIssues: 0,
    siteList: ['Waterstones – Luton', 'Waterstones – Watford'],
    lastClean: 'Today 07:55',
    portalActive: true,
  },
  {
    id: 'cl8',
    name: 'University of Bedfordshire',
    logo: 'UB',
    type: 'Education',
    sites: 1,
    value: 5800,
    sla: 99,
    contact: 'Facilities Manager',
    contactRole: 'Campus FM',
    since: 'Aug 2023',
    openIssues: 0,
    siteList: ['UoB Luton Campus'],
    lastClean: 'Today 06:45',
    portalActive: true,
  },
];

const TYPE_COLORS = {
  Retail: '#4f78ff',
  Healthcare: '#34d399',
  Industrial: '#fbbf24',
  'Public Sector': '#a78bfa',
  Hospitality: '#60a5fa',
  Education: '#f472b6',
};

// ── Client detail data (matches FmJobCards data) ──────────────────────────────
const CLIENTS_DETAIL = {
  cl1: {
    id: 'c2',
    name: 'Next Retail UK Ltd',
    logo: 'NX',
    color: '#4f78ff',
    type: 'Retail',
    monthlyValue: '£22,000',
    coverRate: '97%',
    sites: [
      {
        id: 's3',
        name: 'Next – Luton The Mall',
        address: 'The Mall, Luton LU1 2TL',
        areas: [
          {
            id: 'a4',
            name: 'Sales floor & fitting rooms',
            jobs: [
              {
                type: 'Morning clean',
                window: '05:30–08:00',
                freq: 'Mon–Sat',
                hrs: 52,
                route: 'employed',
                assignTo: 'Emma W.',
                color: '#60a5fa',
              },
            ],
          },
          {
            id: 'a5',
            name: 'Stockroom & back of house',
            jobs: [
              {
                type: 'Daily clean',
                window: '06:00–08:00',
                freq: 'Mon–Fri',
                hrs: 44,
                route: 'employed',
                assignTo: 'Marcus T.',
                color: '#4f78ff',
              },
            ],
          },
        ],
      },
      {
        id: 's4',
        name: 'Next – Centre:MK',
        address: 'Silbury Blvd, Milton Keynes MK9 3ES',
        areas: [
          {
            id: 'a6',
            name: 'Sales floor',
            jobs: [
              {
                type: 'Morning clean',
                window: '05:30–08:00',
                freq: 'Mon–Sat',
                hrs: 52,
                route: 'employed',
                assignTo: 'Emma W.',
                color: '#60a5fa',
              },
              {
                type: 'Evening clean',
                window: '18:00–20:00',
                freq: 'Mon–Fri',
                hrs: 36,
                route: 'employed',
                assignTo: 'Kwame B.',
                color: '#818cf8',
              },
            ],
          },
        ],
      },
      {
        id: 's5',
        name: 'Next – Watford Atria',
        address: 'The Atria, Watford WD17 2TB',
        areas: [
          {
            id: 'a7',
            name: 'Ground & first floor',
            jobs: [
              {
                type: 'Morning clean',
                window: '05:30–08:00',
                freq: 'Mon–Sat',
                hrs: 52,
                route: 'employed',
                assignTo: 'Emma W.',
                color: '#60a5fa',
              },
            ],
          },
        ],
      },
    ],
  },
  cl2: {
    id: 'c1',
    name: 'Luton & Dunstable NHS FT',
    logo: 'LD',
    color: '#34d399',
    type: 'Healthcare',
    monthlyValue: '£13,000',
    coverRate: '94%',
    sites: [
      {
        id: 's1',
        name: 'L&D Hospital – Main Tower',
        address: 'Lewsey Road, Luton LU4 0DZ',
        areas: [
          {
            id: 'a1',
            name: 'General Wards 2–6',
            jobs: [
              {
                type: 'Daily clean',
                window: '06:00–08:00',
                freq: 'Mon–Fri',
                hrs: 44,
                route: 'employed',
                assignTo: 'Marcus T.',
                color: '#4f78ff',
              },
              {
                type: 'Deep clean',
                window: '07:00–11:00',
                freq: 'Weekly',
                hrs: 16,
                route: 'connect',
                assignTo: null,
                color: '#fb923c',
              },
              {
                type: 'Washroom service',
                window: '12:00–13:00',
                freq: 'Mon–Fri',
                hrs: 22,
                route: 'employed',
                assignTo: 'Claire B.',
                color: '#a78bfa',
              },
            ],
          },
          {
            id: 'a2',
            name: 'A&E & Outpatients',
            jobs: [
              {
                type: 'Specialist clean',
                window: '05:00–07:00',
                freq: 'Mon–Fri',
                hrs: 44,
                route: 'connect',
                assignTo: null,
                color: '#f472b6',
              },
              {
                type: 'Washroom service',
                window: '12:00–13:00',
                freq: 'Mon–Fri',
                hrs: 22,
                route: 'employed',
                assignTo: 'Claire B.',
                color: '#a78bfa',
              },
            ],
          },
        ],
      },
      {
        id: 's2',
        name: 'L&D Hospital – A&E Block Ext',
        address: 'Lewsey Road, Luton LU4 0DZ',
        areas: [
          {
            id: 'a3',
            name: 'Reception & Waiting',
            jobs: [
              {
                type: 'Daily clean',
                window: '06:00–08:00',
                freq: 'Mon–Fri',
                hrs: 44,
                route: 'employed',
                assignTo: 'Marcus T.',
                color: '#4f78ff',
              },
            ],
          },
        ],
      },
    ],
  },
};

const DEMO_NEW_SITE = {
  id: 'demo-new',
  name: 'Next – Bluewater',
  address: 'Bluewater Shopping Centre, Greenhithe DA9 9ST',
  areas: [
    {
      id: 'dn1',
      name: 'Main sales floor',
      jobs: [
        {
          type: 'Morning clean',
          window: '05:30–08:00',
          freq: 'Mon–Sat',
          hrs: 52,
          route: 'employed',
          assignTo: 'TBC',
          color: '#60a5fa',
        },
      ],
    },
    {
      id: 'dn2',
      name: 'Stockroom',
      jobs: [
        {
          type: 'Daily clean',
          window: '06:00–08:00',
          freq: 'Mon–Fri',
          hrs: 44,
          route: 'employed',
          assignTo: 'TBC',
          color: '#4f78ff',
        },
      ],
    },
  ],
};

// ── Client detail view ─────────────────────────────────────────────────────────
function ClientDetail({ clientListItem, onBack, onBuildJobCards }) {
  const detail = CLIENTS_DETAIL[clientListItem.id];
  const color = TYPE_COLORS[clientListItem.type] || '#94a3b8';
  const [expanded, setExpanded] = useState({});
  const [sites, setSites] = useState(detail ? detail.sites : []);
  const [addingSite, setAddingSite] = useState(false);
  const [_siteAdded, setSiteAdded] = useState(false);

  const totalCards = sites.reduce((n, s) => n + s.areas.reduce((m, a) => m + a.jobs.length, 0), 0);
  const totalHrs = sites.reduce(
    (n, s) => n + s.areas.reduce((m, a) => m + a.jobs.reduce((k, j) => k + j.hrs, 0), 0),
    0
  );
  const isNext = clientListItem.id === 'cl1';

  function toggleSite(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function addDemoSite() {
    setSites((s) => [...s, DEMO_NEW_SITE]);
    setAddingSite(false);
    setSiteAdded(true);
    setTimeout(() => setExpanded((e) => ({ ...e, 'demo-new': true })), 80);
  }

  if (!detail) {
    const color = TYPE_COLORS[clientListItem.type] || '#94a3b8';
    return (
      <div style={{ padding: 24, maxWidth: 900 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'rgba(255,255,255,0.4)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginBottom: 20,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <ChevronLeft size={14} /> All clients
        </button>
        <div
          style={{
            borderRadius: 18,
            padding: '20px 24px',
            marginBottom: 16,
            background: `${color}0d`,
            border: `1px solid ${color}25`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 900,
                background: `${color}20`,
                border: `1px solid ${color}40`,
                color,
                flexShrink: 0,
              }}
            >
              {clientListItem.logo}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 900, fontSize: 18 }}>
                {clientListItem.name}
              </div>
              <div style={{ color, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                {clientListItem.type} · Since {clientListItem.since} · {clientListItem.sites} site
                {clientListItem.sites !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
            {[
              { label: 'Monthly value', value: `£${clientListItem.value.toLocaleString()}` },
              { label: 'SLA score', value: `${clientListItem.sla}%` },
              { label: 'Open issues', value: clientListItem.openIssues },
              { label: 'Last clean', value: clientListItem.lastClean },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  textAlign: 'center',
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16 }}>{value}</div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            padding: '18px 22px',
            borderRadius: 14,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div style={{ fontSize: 28 }}>💡</div>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
              Full site breakdown shown for Next Retail &amp; L&amp;D Hospital
            </div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.5 }}>
              In a live account, every client has its own site map, job card history, evidence trail
              and SLA dashboard — just like the Next Retail walkthrough.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: 'rgba(255,255,255,0.4)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 20,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <ChevronLeft size={14} /> All clients
      </button>

      <div
        style={{
          borderRadius: 18,
          padding: '20px 24px',
          marginBottom: 20,
          background: `${color}0d`,
          border: `1px solid ${color}25`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 900,
              background: `${color}20`,
              border: `1px solid ${color}40`,
              color,
              flexShrink: 0,
            }}
          >
            {clientListItem.logo}
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{ color: 'white', fontWeight: 900, fontSize: 19, letterSpacing: '-0.02em' }}
            >
              {clientListItem.name}
            </div>
            <div style={{ color, fontSize: 11, fontWeight: 700, marginTop: 3 }}>
              {clientListItem.type} · Since {clientListItem.since}
            </div>
          </div>
          <button
            onClick={onBuildJobCards}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '11px 22px',
              borderRadius: 14,
              fontSize: 13,
              fontWeight: 900,
              color: 'white',
              background: `linear-gradient(135deg, ${color}, ${color}bb)`,
              border: 'none',
              cursor: 'pointer',
              boxShadow: `0 4px 18px ${color}45`,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
          >
            <Smartphone size={14} /> Build job cards
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
          {[
            { label: 'Sites', value: sites.length },
            { label: 'Job cards', value: totalCards },
            { label: 'Hrs / month', value: `${totalHrs}h` },
            { label: 'Monthly value', value: detail.monthlyValue },
            { label: 'Cover rate', value: detail.coverRate },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                padding: '10px 8px',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ color: 'white', fontWeight: 900, fontSize: 17 }}>{value}</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 2 }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          fontSize: 10,
          fontWeight: 900,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: 'rgba(255,255,255,0.3)',
          marginBottom: 10,
        }}
      >
        {sites.length} site{sites.length !== 1 ? 's' : ''} · contract scope
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {sites.map((site) => {
          const isOpen = !!expanded[site.id];
          const siteCrds = site.areas.reduce((n, a) => n + a.jobs.length, 0);
          const siteHrs = site.areas.reduce((n, a) => n + a.jobs.reduce((m, j) => m + j.hrs, 0), 0);
          return (
            <div
              key={site.id}
              style={{
                borderRadius: 14,
                overflow: 'hidden',
                border: `1px solid ${isOpen ? color + '35' : 'rgba(255,255,255,0.08)'}`,
                background: isOpen ? `${color}06` : 'rgba(255,255,255,0.03)',
                transition: 'all 0.2s',
              }}
            >
              <button
                onClick={() => toggleSite(site.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 18px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${color}15`,
                    border: `1px solid ${color}25`,
                    flexShrink: 0,
                  }}
                >
                  <MapPin size={14} style={{ color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: 13 }}>{site.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                    {site.address}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color, fontWeight: 900, fontSize: 16 }}>{siteCrds}</div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>job cards</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 13 }}>
                      {siteHrs}h
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>hrs/mo</div>
                  </div>
                  <ChevronRight
                    size={14}
                    style={{
                      color: 'rgba(255,255,255,0.2)',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                      flexShrink: 0,
                    }}
                  />
                </div>
              </button>

              {isOpen && (
                <div style={{ borderTop: `1px solid ${color}15`, padding: '12px 18px 16px' }}>
                  {site.areas.map((area) => (
                    <div key={area.id} style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          color: 'rgba(255,255,255,0.25)',
                          marginBottom: 8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{ width: 5, height: 5, borderRadius: '50%', background: color }}
                        />
                        {area.name}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {area.jobs.map((job, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '9px 12px',
                              borderRadius: 8,
                              background: 'rgba(0,0,0,0.2)',
                              border: `1px solid ${job.color}18`,
                            }}
                          >
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 3,
                                background: job.color,
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                color: 'white',
                                fontWeight: 800,
                                fontSize: 12,
                                flex: '0 0 130px',
                              }}
                            >
                              {job.type}
                            </span>
                            <span
                              style={{
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: 11,
                                flex: '0 0 100px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Clock size={9} style={{ color: job.color }} /> {job.window}
                            </span>
                            <span
                              style={{
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: 11,
                                flex: '0 0 80px',
                              }}
                            >
                              {job.freq}
                            </span>
                            <span
                              style={{
                                color: 'rgba(255,255,255,0.3)',
                                fontSize: 11,
                                flex: '0 0 60px',
                              }}
                            >
                              {job.hrs}h/mo
                            </span>
                            <div style={{ marginLeft: 'auto' }}>
                              {job.route === 'connect' ? (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(251,146,60,0.15)',
                                    color: '#fb923c',
                                    border: '1px solid rgba(251,146,60,0.25)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Cadi Connect
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(79,120,255,0.15)',
                                    color: '#7b9fff',
                                    border: '1px solid rgba(79,120,255,0.2)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {job.assignTo}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {isNext && !addingSite && (
        <button
          onClick={() => setAddingSite(true)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: 12,
            color: 'rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.15)',
            cursor: 'pointer',
            marginBottom: 16,
            letterSpacing: '-0.01em',
          }}
        >
          + Add site
        </button>
      )}

      {isNext && addingSite && (
        <div
          style={{
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 16,
            background: `${color}08`,
            border: `1px solid ${color}30`,
          }}
        >
          <div
            style={{
              color: 'rgba(255,255,255,0.45)',
              fontSize: 11,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            New site — details pre-filled from contract
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}
          >
            {[
              { label: 'Site name', value: 'Next – Bluewater', strong: true },
              { label: 'Address', value: 'Bluewater Shopping Centre, Greenhithe DA9 9ST' },
              { label: 'Service', value: 'Morning clean + Daily clean' },
              { label: 'Region', value: 'South East' },
            ].map(({ label, value, strong }) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: 'rgba(255,255,255,0.25)',
                    marginBottom: 5,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: strong ? 'white' : 'rgba(255,255,255,0.55)',
                    fontSize: strong ? 12 : 11,
                    fontWeight: strong ? 800 : 500,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setAddingSite(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={addDemoSite}
              style={{
                padding: '8px 22px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 900,
                color: 'white',
                background: `linear-gradient(135deg, ${color}, ${color}bb)`,
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 2px 12px ${color}40`,
              }}
            >
              Add site →
            </button>
          </div>
        </div>
      )}

      <button
        onClick={onBuildJobCards}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: '17px',
          borderRadius: 16,
          fontWeight: 900,
          fontSize: 14,
          color: 'white',
          background: `linear-gradient(135deg, ${color}, ${color}bb)`,
          border: 'none',
          cursor: 'pointer',
          boxShadow: `0 4px 24px ${color}40`,
          letterSpacing: '-0.01em',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
      >
        <Smartphone size={16} />
        Build job cards for all {sites.length} sites
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FmClients({ showToast, onNavigate, onSelectClient }) {
  const [expanded, setExpanded] = useState(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [detailClient, setDetailClient] = useState(null);

  if (detailClient) {
    return (
      <ClientDetail
        clientListItem={detailClient}
        onBack={() => setDetailClient(null)}
        onBuildJobCards={() => {
          if (onSelectClient)
            onSelectClient(CLIENTS_DETAIL[detailClient.id]?.id || detailClient.id);
          onNavigate('job-cards');
        }}
      />
    );
  }

  const totalValue = CLIENTS.reduce((s, c) => s + c.value, 0);
  const totalSites = CLIENTS.reduce((s, c) => s + c.sites, 0);
  const avgSla = Math.round(CLIENTS.reduce((s, c) => s + c.sla, 0) / CLIENTS.length);
  const openIssues = CLIENTS.reduce((s, c) => s + c.openIssues, 0);

  return (
    <div style={{ padding: 24, maxWidth: 960 }}>
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          showToast={showToast}
          onNavigate={onNavigate}
        />
      )}

      {/* ── Onboard New Client showcase ──────────────────────────────────────── */}
      <div
        style={{
          borderRadius: 20,
          marginBottom: 24,
          overflow: 'hidden',
          border: '1px solid rgba(79,120,255,0.25)',
          background: 'rgba(7,10,30,0.95)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px 16px',
            borderBottom: '1px solid rgba(79,120,255,0.12)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            background:
              'linear-gradient(135deg, rgba(79,120,255,0.1) 0%, rgba(99,102,241,0.05) 100%)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.58rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                color: '#7b9fff',
                marginBottom: 6,
              }}
            >
              How to onboard a new client
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-0.02em',
                marginBottom: 6,
                lineHeight: 1.2,
              }}
            >
              From signed contract to Day 1 live — in one flow
            </div>
            <div
              style={{
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.6,
                maxWidth: 520,
              }}
            >
              You bring the contract details, site list and scope. Cadi turns that into a full
              mobilisation plan, job cards across every site, TUPE checklist and a live client
              portal — automatically, as you go through each step.
            </div>
          </div>
          <button
            onClick={() => setShowAddClient(true)}
            style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '11px 20px',
              borderRadius: 12,
              fontSize: '0.75rem',
              fontWeight: 900,
              color: 'white',
              background: 'linear-gradient(135deg, #4f78ff, #6366f1)',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(79,120,255,0.4)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
          >
            <Building2 size={14} /> Try it: onboard a demo client <ArrowRight size={13} />
          </button>
        </div>

        {/* You provide → Cadi builds */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 44px 1fr',
            padding: '16px 22px',
            borderBottom: '1px solid rgba(79,120,255,0.08)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.52rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.22)',
                marginBottom: 10,
              }}
            >
              You provide
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { Icon: Upload, text: 'Site list — CSV or manual (name, address, tier)' },
                {
                  Icon: Layers,
                  text: 'Cleaning scope per site — areas, frequencies, shift windows',
                },
                { Icon: FileCheck, text: 'Contract details — start date, monthly value, sector' },
                {
                  Icon: UserCheck,
                  text: 'TUPE staff list from outgoing contractor (if applicable)',
                },
                { Icon: Target, text: 'KPIs and SLAs agreed with your client' },
              ].map(({ Icon, text }, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    padding: '7px 10px',
                    borderRadius: 9,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Icon
                    size={12}
                    style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0, marginTop: 1 }}
                  />
                  <span
                    style={{
                      fontSize: '0.65rem',
                      color: 'rgba(255,255,255,0.45)',
                      lineHeight: 1.4,
                    }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(79,120,255,0.15)',
                border: '1px solid rgba(79,120,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={14} style={{ color: '#4f78ff' }} />
            </div>
          </div>

          <div>
            <div
              style={{
                fontSize: '0.52rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: '#34d399',
                marginBottom: 10,
              }}
            >
              Cadi builds automatically
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Phased mobilisation plan — Tier 1 sites live first, Tier 3 last',
                'All job cards generated per site, area and shift — ready to dispatch',
                'TUPE 28-day checklist with automatic reminders and compliance flags',
                'Client portal activated and login sent to your FM contact',
                'RAMS and COSHH templates per site — method statements included',
                'Mobilisation Gantt shared with all assigned Area Managers',
              ].map((text, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    padding: '7px 10px',
                    borderRadius: 9,
                    background: 'rgba(52,211,153,0.05)',
                    border: '1px solid rgba(52,211,153,0.12)',
                  }}
                >
                  <CheckCircle2
                    size={12}
                    style={{ color: '#34d399', flexShrink: 0, marginTop: 1 }}
                  />
                  <span
                    style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}
                  >
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Before vs After */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(79,120,255,0.08)',
          }}
        >
          <div style={{ padding: '14px 22px', borderRight: '1px solid rgba(79,120,255,0.08)' }}>
            <div
              style={{
                fontSize: '0.52rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(248,113,113,0.5)',
                marginBottom: 10,
              }}
            >
              How it works today
            </div>
            {[
              'Site list built in Excel, shared with ops by email',
              'Job specs written per site in Word — reformatted every new contract',
              'TUPE tracked on a spreadsheet, manually chased each week',
              'Client updates via email chains and attached PDF reports',
            ].map((text, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}
              >
                <span
                  style={{
                    color: 'rgba(248,113,113,0.5)',
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  ✕
                </span>
                <span
                  style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.28)', lineHeight: 1.45 }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
          <div style={{ padding: '14px 22px' }}>
            <div
              style={{
                fontSize: '0.52rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: '#34d399',
                marginBottom: 10,
              }}
            >
              With Cadi
            </div>
            {[
              'Upload site CSV → tiered mobilisation plan generated instantly',
              'Define scope once → all job cards created per site automatically',
              'TUPE flagged — 28-day checklist opened with reminders, zero spreadsheets',
              'Client portal live from Day 1 — real-time job status, no email reports',
            ].map((text, i) => (
              <div
                key={i}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 0' }}
              >
                <span
                  style={{
                    color: '#34d399',
                    fontSize: '0.7rem',
                    lineHeight: 1,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  ✓
                </span>
                <span
                  style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}
                >
                  {text}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Process steps strip */}
        <div style={{ padding: '12px 22px', display: 'flex', alignItems: 'center' }}>
          {[
            { label: 'Contract award', Icon: FileCheck, color: '#4f78ff' },
            { label: 'Sites & tiers', Icon: MapPin, color: '#a78bfa' },
            { label: 'Scope & jobs', Icon: Layers, color: '#34d399' },
            { label: 'People & TUPE', Icon: UserCheck, color: '#fbbf24' },
            { label: 'KPIs & SLAs', Icon: Target, color: '#60a5fa' },
            { label: 'Day 1 live', Icon: Zap, color: '#f472b6' },
          ].map(({ label, Icon, color }, i, arr) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                flex: i < arr.length - 1 ? 1 : 'none',
              }}
            >
              <div
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `${color}15`,
                    border: `1px solid ${color}35`,
                  }}
                >
                  <Icon size={11} style={{ color }} />
                </div>
                <span
                  style={{
                    fontSize: '0.49rem',
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.35)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: 'rgba(255,255,255,0.07)',
                    margin: '0 6px',
                    marginBottom: 14,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}
      >
        {[
          {
            label: 'Active clients',
            value: CLIENTS.length,
            sub: 'all contracts live',
            color: '#4f78ff',
            Icon: Building2,
          },
          {
            label: 'Total sites',
            value: totalSites,
            sub: 'under management',
            color: '#a78bfa',
            Icon: MapPin,
          },
          {
            label: 'Monthly revenue',
            value: `£${(totalValue / 1000).toFixed(1)}k`,
            sub: 'contracted MRR',
            color: '#34d399',
            Icon: PoundSterling,
          },
          {
            label: 'Cover rate',
            value: `${avgSla}%`,
            sub: `${openIssues} open issue${openIssues !== 1 ? 's' : ''}`,
            color: openIssues > 0 ? '#fbbf24' : '#34d399',
            Icon: BarChart2,
          },
        ].map(({ label, value, sub, color, Icon }) => (
          <div
            key={label}
            style={{
              borderRadius: 16,
              padding: '16px 18px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ position: 'absolute', top: 12, right: 14, opacity: 0.08 }}>
              <Icon size={28} style={{ color }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color }}>{value}</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.7)',
                marginTop: 2,
              }}
            >
              {label}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Client list header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.3)',
          }}
        >
          {CLIENTS.length} clients · click to expand
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Retail', 'Healthcare', 'Public Sector'].map((f) => (
            <button
              key={f}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 700,
                background: f === 'All' ? 'rgba(79,120,255,0.15)' : 'rgba(255,255,255,0.04)',
                border:
                  f === 'All'
                    ? '1px solid rgba(79,120,255,0.35)'
                    : '1px solid rgba(255,255,255,0.08)',
                color: f === 'All' ? '#7b9fff' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Client rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {CLIENTS.map((c) => {
          const typeColor = TYPE_COLORS[c.type] || '#94a3b8';
          const isOpen = expanded === c.id;
          return (
            <div
              key={c.id}
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                transition: 'all 0.2s',
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${isOpen ? 'rgba(79,120,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                style={{ padding: '14px 20px', cursor: 'pointer' }}
                onClick={() =>
                  CLIENTS_DETAIL[c.id] ? setDetailClient(c) : setExpanded(isOpen ? null : c.id)
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                      background: `${typeColor}20`,
                      border: `1px solid ${typeColor}40`,
                      color: typeColor,
                    }}
                  >
                    {c.logo}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <span style={{ color: 'white', fontWeight: 900, fontSize: 13 }}>
                        {c.name}
                      </span>
                      {c.openIssues > 0 && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 20,
                            background: 'rgba(251,191,36,0.15)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251,191,36,0.3)',
                          }}
                        >
                          {c.openIssues} open issue
                        </span>
                      )}
                      {c.portalActive && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 900,
                            padding: '2px 6px',
                            borderRadius: 20,
                            background: 'rgba(52,211,153,0.1)',
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.2)',
                          }}
                        >
                          🌐 Portal live
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: `${typeColor}15`,
                          color: typeColor,
                        }}
                      >
                        {c.type}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>
                        Since {c.since}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                      {c.siteList.map((s) => (
                        <span
                          key={s}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10,
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            color: 'rgba(255,255,255,0.5)',
                          }}
                        >
                          <MapPin size={8} style={{ color: typeColor, flexShrink: 0 }} />
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'white', fontWeight: 900, fontSize: 13 }}>
                        £{c.value.toLocaleString()}
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>per month</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontWeight: 900,
                          fontSize: 13,
                          color: c.sla >= 98 ? '#34d399' : c.sla >= 95 ? '#fbbf24' : '#f87171',
                        }}
                      >
                        {c.sla}%
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>Cover</div>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                      {isOpen ? '↑' : '↓'}
                    </div>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div
                  style={{
                    padding: '0 20px 20px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 14,
                    paddingTop: 16,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 12,
                      padding: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.25)',
                        marginBottom: 10,
                      }}
                    >
                      Sites under contract
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {c.siteList.map((s) => (
                        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              flexShrink: 0,
                              background: typeColor,
                            }}
                          />
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                      Last clean: {c.lastClean}
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 12,
                      padding: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.25)',
                        marginBottom: 10,
                      }}
                    >
                      Client contact
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{c.contact}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      {c.contactRole}
                    </div>
                    {c.portalActive && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'rgba(52,211,153,0.08)',
                          border: '1px solid rgba(52,211,153,0.2)',
                          fontSize: 10,
                          color: '#34d399',
                          fontWeight: 700,
                        }}
                      >
                        🌐 Portal active
                      </div>
                    )}
                    {c.note && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: 8,
                          borderRadius: 8,
                          fontSize: 10,
                          color: 'rgba(251,191,36,0.8)',
                          fontStyle: 'italic',
                          background: 'rgba(251,191,36,0.08)',
                          border: '1px solid rgba(251,191,36,0.2)',
                        }}
                      >
                        {c.note}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: 12,
                      padding: 14,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'rgba(255,255,255,0.25)',
                        marginBottom: 10,
                      }}
                    >
                      Quick actions
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[
                        {
                          label: '🚀 Deploy contract →',
                          action: () => onNavigate('contract-wizard'),
                          highlight: true,
                        },
                        {
                          label: '🌐 View client portal →',
                          action: () => window.open('/client-demo', '_blank'),
                        },
                        {
                          label: 'Send monthly report',
                          action: () => showToast(`Monthly report sent to ${c.name}`),
                        },
                        {
                          label: 'Message contact',
                          action: () => showToast(`Message thread opened with ${c.contact}`),
                        },
                      ].map(({ label, action, highlight }) => (
                        <button
                          key={label}
                          onClick={action}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: 8,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            background: highlight
                              ? 'rgba(79,120,255,0.12)'
                              : 'rgba(255,255,255,0.03)',
                            border: highlight
                              ? '1px solid rgba(79,120,255,0.4)'
                              : '1px solid rgba(255,255,255,0.08)',
                            color: highlight ? '#7b9fff' : 'rgba(255,255,255,0.5)',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
