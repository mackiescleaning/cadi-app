import { useState } from 'react';
import { CheckCircle, Clock, Download, ChevronRight, AlertCircle, Users, PoundSterling } from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

const PERIOD = 'May 2026';

const SUMMARY = [
  { label: 'Employees on payroll', value: '1,487', icon: Users,         color: '#ea580c' },
  { label: 'Total hours this period', value: '54,218', icon: Clock,       color: '#3b82f6' },
  { label: 'Gross pay',             value: '£689,450', icon: PoundSterling, color: '#16a34a' },
  { label: 'PAYE & NI liability',   value: '£198,220', icon: AlertCircle,  color: '#f59e0b' },
];

const TIMESHEETS = [
  { name: 'Tara Hobson',   id: 'E-0445', site: 'L&D Hospital',      hours: 148.5, rate: '£11.44', gross: '£1,699',  status: 'approved' },
  { name: 'Sarah Patel',   id: 'E-0112', site: 'Luton Town Hall',   hours: 118.5, rate: '£11.44', gross: '£1,356',  status: 'approved' },
  { name: 'Claire Nduka',  id: 'E-0234', site: 'Premier Inn Luton', hours: 148.5, rate: '£11.44', gross: '£1,699',  status: 'approved' },
  { name: 'Marcus Webb',   id: 'E-0311', site: 'Aldi Dunstable',    hours: 160.0, rate: '£13.20', gross: '£2,112',  status: 'approved' },
  { name: 'Priya Sharma',  id: 'E-0178', site: 'L&D Hospital',      hours:  80.0, rate: '£11.44', gross: '£915',    status: 'pending'  },
  { name: 'Amina Hassan',  id: 'E-0402', site: 'Luton Town Hall',   hours:  96.0, rate: '£11.44', gross: '£1,098',  status: 'pending'  },
  { name: 'Tom Griffiths', id: 'E-0089', site: 'HSBC Birmingham',   hours: 130.0, rate: '£11.44', gross: '£1,487',  status: 'approved' },
  { name: 'James Okafor',  id: 'E-0501', site: 'Aldi Dunstable',    hours: 148.5, rate: '£11.44', gross: '£1,699',  status: 'approved' },
];

const STEPS = [
  { label: 'Timesheets auto-captured', done: true  },
  { label: 'Manager approval',         done: true  },
  { label: 'Payroll confirmed',        done: false },
  { label: 'Export to BACS / Xero',    done: false },
  { label: 'Pay day',                  done: false },
];

const approved = TIMESHEETS.filter(t => t.status === 'approved').length;
const pending  = TIMESHEETS.filter(t => t.status === 'pending').length;

export default function FmPayroll({ showToast }) {
  const [runState, setRunState] = useState('ready'); // ready | confirming | exported

  return (
    <div style={{ padding: '1.25rem 1.5rem 3rem', maxWidth: 960 }}>

      <HowItWorks
        setupTime="~2 hrs to configure"
        youSetUp={[
          'Pay week start day and pay date',
          'BACS bank details or connect Xero/Sage',
          'Overtime rules and holiday pay settings',
        ]}
        cadiHandles={[
          'Auto-captures hours from every geo-stamped check-in',
          'Calculates gross pay, PAYE and NI automatically',
          'Exports to BACS or your payroll system in one click',
          'Handles timesheet corrections and adjustments',
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'white', fontWeight: 900, fontSize: '1.05rem', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
            Payroll — {PERIOD}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.7rem', margin: 0 }}>
            PAYE · 1,487 employees · pay date 28 May 2026
          </p>
        </div>
        <button
          onClick={() => { setRunState('exported'); showToast('payroll exported to BACS'); }}
          disabled={runState === 'exported'}
          style={{
            padding: '0.5rem 1.1rem', borderRadius: '0.5rem', border: 'none', flexShrink: 0,
            background: runState === 'exported'
              ? 'rgba(22,163,74,0.2)'
              : 'linear-gradient(135deg, #ea580c, #c2410c)',
            color: runState === 'exported' ? '#4ade80' : 'white',
            fontSize: '0.72rem', fontWeight: 800, cursor: runState === 'exported' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}
        >
          {runState === 'exported'
            ? <><CheckCircle size={13} /> Exported to BACS</>
            : <><Download size={13} /> Run Payroll & Export</>
          }
        </button>
      </div>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.65rem', marginBottom: '1.1rem' }}>
        {SUMMARY.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            borderRadius: '0.75rem', padding: '0.875rem 1rem',
            background: `${color}0d`, border: `1px solid ${color}22`,
          }}>
            <Icon size={15} style={{ color, marginBottom: '0.4rem' }} />
            <div style={{ fontWeight: 900, fontSize: '1.35rem', color: 'white', lineHeight: 1, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Pay run progress */}
      <div style={{
        borderRadius: '0.875rem', padding: '1rem 1.1rem', marginBottom: '1.1rem',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.875rem' }}>
          Pay Run Progress
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STEPS.map((step, i) => {
            const isActive = !step.done && (i === 0 || STEPS[i - 1].done);
            const done = runState === 'exported' ? true : step.done;
            return (
              <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: done || (runState === 'exported')
                      ? 'linear-gradient(135deg, #16a34a, #15803d)'
                      : isActive
                        ? 'linear-gradient(135deg, #ea580c, #c2410c)'
                        : 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: (done || isActive) ? `0 2px 8px ${done ? '#16a34a' : '#ea580c'}40` : 'none',
                  }}>
                    {done || runState === 'exported'
                      ? <CheckCircle size={14} style={{ color: 'white' }} />
                      : <span style={{ fontSize: '0.6rem', fontWeight: 900, color: isActive ? 'white' : 'rgba(255,255,255,0.3)' }}>{i + 1}</span>
                    }
                  </div>
                  <span style={{
                    fontSize: '0.5rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2,
                    color: done || isActive ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
                    whiteSpace: 'nowrap',
                  }}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: '1rem' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timesheet approvals */}
      <div style={{
        borderRadius: '0.875rem', overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.1rem', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Timesheets
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)', fontSize: '0.58rem', fontWeight: 800, color: '#4ade80' }}>
              {approved} approved
            </div>
            {pending > 0 && (
              <div style={{ padding: '0.2rem 0.55rem', borderRadius: '999px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.58rem', fontWeight: 800, color: '#fbbf24' }}>
                {pending} pending
              </div>
            )}
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
          padding: '0.45rem 1.1rem', gap: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {['Employee', 'Primary Site', 'Hours', 'Rate', 'Gross Pay', 'Status', ''].map(h => (
            <div key={h} style={{ fontSize: '0.56rem', fontWeight: 800, color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {TIMESHEETS.map((ts, i) => (
          <div key={ts.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 2fr 0.8fr 0.8fr 1fr 0.8fr 1.2fr',
            padding: '0.6rem 1.1rem', gap: '0.5rem', alignItems: 'center',
            borderBottom: i < TIMESHEETS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            transition: 'background 0.15s', cursor: 'pointer',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{ts.name}</div>
              <div style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,0.3)' }}>{ts.id}</div>
            </div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ts.site}</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'white' }}>{ts.hours}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.45)' }}>{ts.rate}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 900, color: 'white' }}>{ts.gross}</div>
            <div>
              {ts.status === 'approved' ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.18rem 0.45rem', borderRadius: '999px', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)' }}>
                  <CheckCircle size={8} style={{ color: '#4ade80' }} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#4ade80' }}>Approved</span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '0.18rem 0.45rem', borderRadius: '999px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <Clock size={8} style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#fbbf24' }}>Pending</span>
                </div>
              )}
            </div>
            <button onClick={() => showToast('open timesheet detail')} style={{
              display: 'flex', alignItems: 'center', gap: 3,
              background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.35rem',
              padding: '0.22rem 0.5rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem', fontWeight: 700, cursor: 'pointer',
            }}>
              View <ChevronRight size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* Export options */}
      <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.875rem' }}>
        {['BACS Direct', 'Export to Xero', 'Export to Sage', 'Download CSV'].map(label => (
          <button key={label} onClick={() => showToast(`${label.toLowerCase()} export`)} style={{
            padding: '0.4rem 0.75rem', borderRadius: '0.45rem',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.45)', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
          }}>{label}</button>
        ))}
      </div>
    </div>
  );
}
