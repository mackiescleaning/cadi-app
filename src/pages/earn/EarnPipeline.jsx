import { useState } from 'react';
import {
  Upload, FileText, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Camera, Zap, Calendar, User, Building2, CreditCard, Hash
} from 'lucide-react';

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const inputStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: 'white',
  borderRadius: '0.75rem',
  padding: '0.5rem 0.75rem',
  width: '100%',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const jobs = [
  {
    id: 'p1',
    status: 'live',
    statusLabel: 'On site now',
    site: 'Next – Luton The Mall',
    client: 'Britannia FM',
    service: 'Retail morning clean',
    date: 'Today',
    time: '06:58–',
    rate: 85,
    ref: '#BF-4471',
    po: 'PO-2026-0091',
    defaultTasks:
      'Swept and mopped all retail floor areas, cleaned customer service desk, sanitised fitting rooms, emptied bins x12, cleaned windows internal, wiped down display shelving units, cleaned staff toilets, restocked consumables.',
    photos: 4,
    address: 'The Mall Luton, Luton LU1 2TL',
    sla: '06:00–09:00',
    paymentTerms: 'Net 14',
    dueDate: '2 Jun 2026',
  },
  {
    id: 'p2',
    status: 'invoice',
    statusLabel: 'Complete — awaiting invoice',
    site: 'Premier Inn Luton Airport',
    client: 'Britannia FM',
    service: 'Morning clean',
    date: '08 May',
    time: '07:15–07:58',
    rate: 78,
    ref: '#BF-4468',
    po: 'PO-2026-0088',
    defaultTasks:
      'Cleaned all guest corridor floors, vacuumed lift areas, cleaned reception and lobby, sanitised public toilets x3, wiped down breakfast area, restocked hand sanitiser stations, spot-cleaned glass entrance doors.',
    photos: 6,
    address: 'Airport Way, Luton LU2 9LY',
    sla: '07:00–09:30',
    paymentTerms: 'Net 14',
    dueDate: '22 May 2026',
  },
  {
    id: 'p3',
    status: 'upcoming',
    statusLabel: 'Upcoming',
    site: 'Aylesbury College',
    client: 'Metro Clean',
    service: 'Evening clean',
    date: 'Mon 12 May',
    time: '18:00–20:00',
    rate: 120,
    ref: '#MC-221',
    po: 'PO-2026-0094',
    defaultTasks:
      'Full classroom sweep and mop (8 rooms), clean staff kitchen, empty all bins, sanitise door handles and light switches, vacuum common areas, clean student toilets x4.',
    photos: 0,
    address: 'Oxford Rd, Aylesbury HP21 8PD',
    sla: '17:30–20:30',
    paymentTerms: 'Net 14',
    dueDate: '26 May 2026',
  },
];

function StatusBadge({ status, label }) {
  if (status === 'live') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 700, color: '#60a5fa' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: 'cadipulse 1.5s infinite' }} />
        Live · {label}
      </span>
    );
  }
  if (status === 'invoice') {
    return (
      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fb923c', background: 'rgba(194,65,12,0.15)', borderRadius: '999px', padding: '2px 10px' }}>
        {label}
      </span>
    );
  }
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a78bfa', background: 'rgba(124,58,237,0.12)', borderRadius: '999px', padding: '2px 10px' }}>
      {label}
    </span>
  );
}

function Chip({ children, color }) {
  return (
    <span style={{
      background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: '0.75rem',
      color: color || '#e2e8f0',
      fontWeight: 600,
      display: 'inline-block',
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.45rem', color: 'rgba(226,232,240,0.45)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      <Icon size={11} />
      {children}
    </div>
  );
}

function JobCard({ job }) {
  const [open, setOpen] = useState(job.status === 'live' || job.status === 'invoice');
  const [tasks, setTasks] = useState(job.defaultTasks);
  const [invoiceSent, setInvoiceSent] = useState(false);
  const [jobComplete, setJobComplete] = useState(false);

  const isUpcoming = job.status === 'upcoming';
  const isLive = job.status === 'live';
  const isInvoice = job.status === 'invoice';

  return (
    <div style={{ ...card, borderRadius: '1rem', overflow: 'hidden', opacity: isUpcoming ? 0.72 : 1 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
          padding: '1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: '1rem',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '0.3rem' }}>
            <StatusBadge status={job.status} label={job.statusLabel} />
          </div>
          <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem', marginBottom: '0.15rem' }}>{job.site}</div>
          <div style={{ color: 'rgba(226,232,240,0.5)', fontSize: '0.8rem' }}>{job.client} · {job.service} · {job.date} {job.time}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
          <span style={{ color: 'white', fontWeight: 900, fontSize: '1.1rem', fontFamily: 'monospace' }}>£{job.rate}</span>
          <span style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.72rem' }}>{job.ref}</span>
          {open ? <ChevronUp size={15} color="rgba(226,232,240,0.35)" /> : <ChevronDown size={15} color="rgba(226,232,240,0.35)" />}
        </div>
      </button>

      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ paddingTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            {/* Left */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <SectionLabel icon={User}>From</SectionLabel>
                <div style={{ ...card, borderRadius: '0.75rem', padding: '0.65rem 0.85rem', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'white', marginBottom: '0.15rem' }}>Sarah K.</div>
                  <div style={{ color: 'rgba(226,232,240,0.5)' }}>Sole trader</div>
                  <div style={{ color: 'rgba(226,232,240,0.35)', fontSize: '0.72rem' }}>UTR: 12345 67890</div>
                </div>
              </div>

              <div>
                <SectionLabel icon={Building2}>To</SectionLabel>
                <div style={{ ...card, borderRadius: '0.75rem', padding: '0.65rem 0.85rem', fontSize: '0.8rem' }}>
                  <div style={{ fontWeight: 700, color: 'white', marginBottom: '0.15rem' }}>{job.client} Ltd</div>
                  <div style={{ color: 'rgba(226,232,240,0.5)' }}>{job.address}</div>
                </div>
              </div>

              <div>
                <SectionLabel icon={Calendar}>Date &amp; SLA</SectionLabel>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <Chip>{job.date}</Chip>
                  <Chip>{job.time}</Chip>
                  <Chip color="rgba(226,232,240,0.45)">SLA {job.sla}</Chip>
                </div>
              </div>

              <div>
                <SectionLabel icon={FileText}>Service type</SectionLabel>
                <Chip>{job.service}</Chip>
              </div>
            </div>

            {/* Right */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <SectionLabel icon={Hash}>PO Number</SectionLabel>
                <Chip color="#fb923c">{job.po}</Chip>
              </div>

              <div>
                <SectionLabel icon={CreditCard}>Payment terms</SectionLabel>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Chip>{job.paymentTerms}</Chip>
                  <span style={{ fontSize: '0.73rem', color: 'rgba(226,232,240,0.4)' }}>Due {job.dueDate}</span>
                </div>
              </div>

              <div>
                <SectionLabel icon={Camera}>Evidence</SectionLabel>
                <Chip color={job.photos > 0 ? '#4ade80' : 'rgba(226,232,240,0.3)'}>
                  {job.photos > 0 ? `${job.photos} photos verified ✓` : 'No photos yet'}
                </Chip>
              </div>

              <div>
                <SectionLabel icon={Upload}>Paper invoice upload</SectionLabel>
                <div style={{
                  border: '1.5px dashed rgba(255,255,255,0.14)',
                  borderRadius: '0.75rem',
                  padding: '0.85rem',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: isUpcoming ? 'not-allowed' : 'pointer',
                }}>
                  <Upload size={18} color="rgba(226,232,240,0.3)" style={{ margin: '0 auto 0.35rem', display: 'block' }} />
                  <div style={{ fontSize: '0.73rem', color: 'rgba(226,232,240,0.45)', lineHeight: 1.45 }}>
                    Upload paper invoice — Cadi converts to {job.client}-approved PDF
                  </div>
                  <div style={{ fontSize: '0.66rem', color: 'rgba(226,232,240,0.28)', marginTop: '0.3rem' }}>Supported: JPG, PNG, PDF</div>
                </div>
              </div>
            </div>
          </div>

          {/* Work completed — full width */}
          <div style={{ marginTop: '1rem' }}>
            <SectionLabel icon={CheckCircle2}>Work completed</SectionLabel>
            <textarea
              value={tasks}
              onChange={e => setTasks(e.target.value)}
              disabled={isUpcoming}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, opacity: isUpcoming ? 0.5 : 1 }}
            />
          </div>

          {/* CTAs */}
          {isLive && !jobComplete && (
            <button
              onClick={() => setJobComplete(true)}
              style={{
                marginTop: '0.75rem', width: '100%', padding: '0.75rem', borderRadius: '0.75rem',
                background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.28)',
                color: '#60a5fa', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              Complete Job →
            </button>
          )}
          {isLive && jobComplete && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontWeight: 700, fontSize: '0.875rem', textAlign: 'center' }}>
              Job marked complete ✓
            </div>
          )}
          {isInvoice && !invoiceSent && (
            <button
              onClick={() => setInvoiceSent(true)}
              style={{
                marginTop: '0.75rem', width: '100%', padding: '0.75rem', borderRadius: '0.75rem',
                background: '#C2410C', border: 'none', color: 'white',
                fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
              }}
            >
              Create Invoice →
            </button>
          )}
          {isInvoice && invoiceSent && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', color: '#4ade80', fontWeight: 700, fontSize: '0.875rem', textAlign: 'center' }}>
              Invoice created ✓ — tracking live in Earnings
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EarnPipeline() {
  return (
    <div className="flex flex-col gap-5 p-6 pb-10" style={{ color: '#e2e8f0' }}>
      <style>{`
        @keyframes cadipulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }
      `}</style>

      <div>
        <h1 style={{ color: 'white', fontWeight: 900, fontSize: '1.5rem', margin: 0, marginBottom: '0.2rem' }}>Current Work</h1>
        <p style={{ color: 'rgba(226,232,240,0.4)', fontSize: '0.875rem', margin: 0 }}>Active jobs, worksheets and invoice readiness</p>
      </div>

      {/* Summary strip */}
      <div style={{ ...card, borderRadius: '1rem', padding: '0.85rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', display: 'inline-block', animation: 'cadipulse 1.5s infinite' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>On site</span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>1</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fb923c', display: 'inline-block' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fb923c' }}>Invoice ready</span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>1</span>
        </div>
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#a78bfa' }}>Upcoming</span>
          <span style={{ fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>1</span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'rgba(226,232,240,0.3)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <Clock size={11} />
          Live data
        </div>
      </div>

      {jobs.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
