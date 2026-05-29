import { useState } from 'react';
import { CheckCircle2, Clock, AlertTriangle, FileText, Users, ChevronDown, ChevronRight } from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

const TRANSFERS = [
  {
    id: 'T-001',
    contract: 'Asda Stores Ltd — 24 sites · Luton cluster',
    outgoing: 'CleanPro Services Ltd',
    staff: 28,
    transferDate: '30 Jun 2026',
    noticeDate: '1 May 2026',
    consultStart: '8 May 2026',
    consultEnd: '5 Jun 2026',
    status: 'in_consultation',
    daysRemaining: 9,
    milestones: [
      { label: 'Notice served to CleanPro',   date: '1 May 2026',  done: true  },
      { label: 'Employee letters issued',      date: '8 May 2026',  done: true  },
      { label: '30-day consultation window',   date: '8 May–5 Jun', done: false, active: true },
      { label: 'ETO assessment complete',      date: '10 Jun 2026', done: false },
      { label: 'Transfer date',                date: '30 Jun 2026', done: false },
    ],
    staff_list: [
      { name: 'Sandra Boateng',    id: 'T-B001', site: 'Asda Luton Supercentre',  hrs: 37.5, consulted: true,  dbs: true  },
      { name: 'Karl Fischer',      id: 'T-B002', site: 'Asda Dunstable',           hrs: 30,   consulted: true,  dbs: true  },
      { name: 'Nadia Osei',        id: 'T-B003', site: 'Asda Luton Supercentre',  hrs: 20,   consulted: false, dbs: false },
      { name: 'Patrick Corrigan',  id: 'T-B004', site: 'Asda Houghton Regis',     hrs: 37.5, consulted: true,  dbs: true  },
      { name: 'Yemi Adeyemi',      id: 'T-B005', site: 'Asda Dunstable',           hrs: 25,   consulted: false, dbs: true  },
      { name: 'Miriam Khalid',     id: 'T-B006', site: 'Asda Luton Supercentre',  hrs: 37.5, consulted: true,  dbs: false },
      { name: 'Declan Murphy',     id: 'T-B007', site: 'Asda Houghton Regis',     hrs: 40,   consulted: true,  dbs: true  },
      { name: 'Fatou Diallo',      id: 'T-B008', site: 'Asda Luton Supercentre',  hrs: 30,   consulted: false, dbs: false },
    ],
    docs: [
      { label: 'Employee Liability Information (ELI)',     done: true  },
      { label: 'Collective consultation letter',           done: true  },
      { label: 'Individual consultation letters (28)',     done: true  },
      { label: 'ETO risk assessment',                      done: false },
      { label: 'New employment contracts drafted',         done: false },
      { label: 'Payroll migration — CleanPro to Cadi',    done: false },
    ],
  },
  {
    id: 'T-002',
    contract: 'Premier Inn Hotels Ltd — 8 sites',
    outgoing: 'Swift Facilities Group',
    staff: 14,
    transferDate: '1 Aug 2026',
    noticeDate: '15 May 2026',
    consultStart: '22 May 2026',
    consultEnd: '19 Jun 2026',
    status: 'notice_served',
    daysRemaining: 28,
    milestones: [
      { label: 'Notice served to Swift',       date: '15 May 2026', done: true  },
      { label: 'Employee letters issued',      date: '22 May 2026', done: false, active: true },
      { label: '30-day consultation window',   date: 'TBC',         done: false },
      { label: 'ETO assessment complete',      date: 'TBC',         done: false },
      { label: 'Transfer date',                date: '1 Aug 2026',  done: false },
    ],
    staff_list: [],
    docs: [
      { label: 'Employee Liability Information (ELI)',     done: true  },
      { label: 'Collective consultation letter',           done: false },
      { label: 'Individual consultation letters (14)',     done: false },
      { label: 'ETO risk assessment',                      done: false },
      { label: 'New employment contracts drafted',         done: false },
      { label: 'Payroll migration',                        done: false },
    ],
  },
];

const STATUS_CFG = {
  in_consultation: { label: 'In consultation', color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.3)' },
  notice_served:   { label: 'Notice served',   color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.3)' },
  complete:        { label: 'Complete',         color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.3)' },
};

function TransferCard({ t }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[t.status];
  const consultedCount = t.staff_list.filter(s => s.consulted).length;
  const dbsReadyCount  = t.staff_list.filter(s => s.dbs).length;
  const docsComplete   = t.docs.filter(d => d.done).length;

  return (
    <div style={{ borderRadius: '1rem', overflow: 'hidden', border: `1px solid ${cfg.border}`, background: 'rgba(255,255,255,0.03)' }}>

      {/* Header */}
      <div style={{ padding: '0.875rem 1rem', background: `${cfg.bg}`, borderBottom: `1px solid ${cfg.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span style={{ fontSize: '0.55rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0.15rem 0.55rem', borderRadius: '999px', background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>{cfg.label}</span>
              <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', fontWeight: 700 }}>{t.id}</span>
            </div>
            <div style={{ fontWeight: 900, fontSize: '0.88rem', color: 'white', lineHeight: 1.2 }}>{t.contract}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.18rem' }}>
              Incoming from <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{t.outgoing}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, alignItems: 'flex-start' }}>
            {[
              { n: t.staff, label: 'staff' },
              { n: `${t.daysRemaining}d`, label: 'remaining' },
              { n: t.transferDate.split(' ')[0], label: t.transferDate.split(' ').slice(1).join(' ') },
            ].map(({ n, label }) => (
              <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', padding: '0.35rem 0.55rem', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 900, fontSize: '0.82rem', color: 'white', lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.28)', fontWeight: 600, marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {t.milestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < t.milestones.length - 1 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.18rem' }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: m.done ? 'rgba(74,222,128,0.15)' : m.active ? 'rgba(251,146,60,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${m.done ? 'rgba(74,222,128,0.4)' : m.active ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.48rem', fontWeight: 900,
                  color: m.done ? '#4ade80' : m.active ? '#fb923c' : 'rgba(255,255,255,0.2)',
                }}>
                  {m.done ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: '0.48rem', fontWeight: 700, color: m.done ? '#4ade80' : m.active ? '#fb923c' : 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 60, lineHeight: 1.2 }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '0.44rem', color: 'rgba(255,255,255,0.18)', textAlign: 'center' }}>{m.date}</div>
              </div>
              {i < t.milestones.length - 1 && (
                <div style={{ flex: 1, height: 1, background: m.done ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.07)', margin: '0 0.2rem', marginBottom: '1.4rem' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick stats row */}
      {t.staff_list.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '0.6rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '0.5rem' }}>
          {[
            { label: 'Consulted',    v: `${consultedCount}/${t.staff_list.length}`, ok: consultedCount === t.staff_list.length, color: '#4ade80' },
            { label: 'DBS ready',   v: `${dbsReadyCount}/${t.staff_list.length}`,  ok: dbsReadyCount  === t.staff_list.length, color: '#60a5fa' },
            { label: 'Docs done',   v: `${docsComplete}/${t.docs.length}`,         ok: docsComplete   === t.docs.length,       color: '#a78bfa' },
          ].map(({ label, v, ok, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: ok ? '#4ade80' : '#f87171', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 900, fontSize: '0.78rem', color: ok ? color : '#f87171' }}>{v}</div>
                <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>{expanded ? 'Hide' : 'Show'} staff list & documents</span>
        {expanded ? <ChevronDown size={13} style={{ color: 'rgba(255,255,255,0.25)' }} /> : <ChevronRight size={13} style={{ color: 'rgba(255,255,255,0.25)' }} />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Staff list */}
          {t.staff_list.length > 0 && (
            <div>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', marginBottom: '0.5rem' }}>Staff transferring</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {t.staff_list.map(s => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.42rem 0.65rem', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '0.67rem', fontWeight: 700, color: 'white' }}>{s.name}</div>
                      <div style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.28)' }}>{s.site} · {s.hrs}h/wk</div>
                    </div>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: s.consulted ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${s.consulted ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, color: s.consulted ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                      {s.consulted ? '✓ Consulted' : '⚠ Pending'}
                    </span>
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: s.dbs ? 'rgba(96,165,250,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${s.dbs ? 'rgba(96,165,250,0.3)' : 'rgba(248,113,113,0.3)'}`, color: s.dbs ? '#60a5fa' : '#f87171', whiteSpace: 'nowrap' }}>
                      {s.dbs ? '✓ DBS' : '⚠ DBS'}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.25)', fontWeight: 600 }}>{s.id}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Docs */}
          <div>
            <div style={{ fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)', marginBottom: '0.5rem' }}>Document checklist</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.28rem' }}>
              {t.docs.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', padding: '0.38rem 0.65rem', borderRadius: '0.45rem', background: d.done ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${d.done ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                  {d.done
                    ? <CheckCircle2 size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
                    : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                  }
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: d.done ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)' }}>{d.label}</span>
                  {!d.done && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.55rem', fontWeight: 700, color: 'rgba(248,113,113,0.7)' }}>Outstanding</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FmTupe({ showToast }) {
  const activeCount = TRANSFERS.filter(t => t.status !== 'complete').length;
  const totalStaff  = TRANSFERS.reduce((s, t) => s + t.staff, 0);

  return (
    <div style={{ padding: '1.25rem 1.5rem 3rem' }}>

      <HowItWorks
        setupTime="30 min per transfer"
        youSetUp={[
          'List of transferring staff from outgoing provider',
          'Send ELI (Employee Liability Information) request to outgoing contractor',
        ]}
        cadiHandles={[
          'Opens a 30-day consultation tracker per employee',
          'Sends individual consultation letters and tracks responses',
          'Document checklist with completion status',
          'Flags any overdue actions before the transfer date',
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
              TUPE Management
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>
              Transfer of Undertakings — track consultation windows, staff eligibility and document compliance
            </p>
          </div>
          <button
            onClick={() => showToast('initiate new TUPE transfer')}
            style={{ padding: '0.45rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: 'white', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
            + New transfer
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem' }}>
          {[
            { label: 'Active transfers',      value: activeCount,   color: '#fb923c' },
            { label: 'Staff transferring',    value: totalStaff,    color: '#60a5fa' },
            { label: 'Outstanding consults',  value: 3,             color: '#f87171', alert: true },
            { label: 'Outstanding docs',      value: 8,             color: '#f87171', alert: true },
          ].map(({ label, value, color, alert }) => (
            <div key={label} style={{ borderRadius: '0.75rem', padding: '0.75rem 0.9rem', background: alert ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.03)', border: `1px solid ${alert ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
              <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'white', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                {alert && <AlertTriangle size={9} style={{ color }} />}
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legal info strip */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.65rem 0.875rem', borderRadius: '0.6rem', marginBottom: '1rem', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)' }}>
        <FileText size={13} style={{ color: '#60a5fa', flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>
          <strong style={{ color: 'rgba(255,255,255,0.65)' }}>TUPE Regulations 2006</strong> — employees must be informed and consulted before transfer. Britannia Group holds liability from transfer date. 30-day consultation window where 10+ employees transfer. Cadi tracks every milestone and flags overdue actions automatically.
        </div>
      </div>

      {/* Transfer cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {TRANSFERS.map(t => <TransferCard key={t.id} t={t} />)}
      </div>
    </div>
  );
}
