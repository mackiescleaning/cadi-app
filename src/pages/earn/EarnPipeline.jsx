import { useState } from 'react';
import {
  Upload, FileText, Clock, CheckCircle2, ChevronDown, ChevronUp,
  Camera, Calendar, User, Building2, CreditCard, Hash, Zap,
} from 'lucide-react';

const ORANGE = '#C2410C';
const NAVY   = '#010a4f';

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
    defaultTasks: 'Swept and mopped all retail floor areas, cleaned customer service desk, sanitised fitting rooms, emptied bins x12, cleaned windows internal, wiped down display shelving units, cleaned staff toilets, restocked consumables.',
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
    defaultTasks: 'Cleaned all guest corridor floors, vacuumed lift areas, cleaned reception and lobby, sanitised public toilets x3, wiped down breakfast area, restocked hand sanitiser stations, spot-cleaned glass entrance doors.',
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
    defaultTasks: 'Full classroom sweep and mop (8 rooms), clean staff kitchen, empty all bins, sanitise door handles and light switches, vacuum common areas, clean student toilets x4.',
    photos: 0,
    address: 'Oxford Rd, Aylesbury HP21 8PD',
    sla: '17:30–20:30',
    paymentTerms: 'Net 14',
    dueDate: '26 May 2026',
  },
];

function StatusBadge({ status, label }) {
  if (status === 'live') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse" />
      {label}
    </span>
  );
  if (status === 'invoice') return (
    <span className="inline-block text-xs font-bold rounded-full px-2.5 py-0.5"
      style={{ background: 'rgba(194,65,12,0.1)', color: ORANGE, border: `1px solid rgba(194,65,12,0.2)` }}>
      {label}
    </span>
  );
  return (
    <span className="inline-block text-xs font-bold rounded-full px-2.5 py-0.5 text-indigo-500 bg-indigo-50 border border-indigo-100">
      {label}
    </span>
  );
}

function InfoBlock({ label, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
        <Icon size={10} />
        {label}
      </div>
      {children}
    </div>
  );
}

function InfoChip({ children, accent }) {
  return (
    <span className="inline-block text-xs font-semibold rounded-lg px-2.5 py-1 border"
      style={accent
        ? { background: 'rgba(194,65,12,0.06)', color: ORANGE, borderColor: 'rgba(194,65,12,0.2)' }
        : { background: '#f8faff', color: NAVY, borderColor: '#e0e8ff' }}>
      {children}
    </span>
  );
}

function JobCard({ job }) {
  const [open, setOpen]           = useState(job.status !== 'upcoming');
  const [tasks, setTasks]         = useState(job.defaultTasks);
  const [jobDone, setJobDone]     = useState(false);
  const [invDone, setInvDone]     = useState(false);
  const isUpcoming = job.status === 'upcoming';
  const isLive     = job.status === 'live';
  const isInvoice  = job.status === 'invoice';

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-opacity ${isUpcoming ? 'opacity-60' : ''}`}
      style={{ borderColor: isLive ? 'rgba(59,130,246,0.3)' : isInvoice ? 'rgba(194,65,12,0.25)' : '#e8eeff' }}>

      {/* Header row */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-gray-50/50 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="mb-1"><StatusBadge status={job.status} label={job.statusLabel} /></div>
          <div className="font-black text-base truncate" style={{ color: NAVY }}>{job.site}</div>
          <div className="text-xs text-gray-400 mt-0.5">{job.client} · {job.service} · {job.date} {job.time}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="font-black text-lg" style={{ color: NAVY }}>£{job.rate}</span>
          <span className="text-[10px] text-gray-300 font-mono">{job.ref}</span>
          {open ? <ChevronUp size={14} className="text-gray-300 mt-0.5" /> : <ChevronDown size={14} className="text-gray-300 mt-0.5" />}
        </div>
      </button>

      {/* Expanded worksheet */}
      {open && (
        <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: '#f0f4ff' }}>

          {/* 2-col grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">

            {/* From */}
            <InfoBlock label="From" icon={User}>
              <div className="bg-[#f8faff] border border-[#e8eeff] rounded-xl px-3 py-2.5 text-xs">
                <div className="font-bold" style={{ color: NAVY }}>Sarah K.</div>
                <div className="text-gray-400 mt-0.5">Sole trader · cleaning operative</div>
                <div className="text-gray-300 mt-0.5 font-mono text-[10px]">UTR: 12345 67890</div>
              </div>
            </InfoBlock>

            {/* To */}
            <InfoBlock label="To" icon={Building2}>
              <div className="bg-[#f8faff] border border-[#e8eeff] rounded-xl px-3 py-2.5 text-xs">
                <div className="font-bold" style={{ color: NAVY }}>{job.client} Ltd</div>
                <div className="text-gray-400 mt-0.5">{job.address}</div>
              </div>
            </InfoBlock>

            {/* Date & SLA */}
            <InfoBlock label="Date & SLA" icon={Calendar}>
              <div className="flex flex-wrap gap-1.5">
                <InfoChip>{job.date}</InfoChip>
                <InfoChip>{job.time || '—'}</InfoChip>
                <InfoChip>SLA {job.sla}</InfoChip>
              </div>
            </InfoBlock>

            {/* Service */}
            <InfoBlock label="Service" icon={FileText}>
              <InfoChip>{job.service}</InfoChip>
            </InfoBlock>

            {/* PO Number */}
            <InfoBlock label="PO Number" icon={Hash}>
              <InfoChip accent>{job.po}</InfoChip>
            </InfoBlock>

            {/* Payment terms */}
            <InfoBlock label="Payment terms" icon={CreditCard}>
              <div className="flex items-center gap-2 flex-wrap">
                <InfoChip>{job.paymentTerms}</InfoChip>
                <span className="text-xs text-gray-400">Due {job.dueDate}</span>
              </div>
            </InfoBlock>

            {/* Evidence */}
            <InfoBlock label="Evidence" icon={Camera}>
              {job.photos > 0
                ? <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
                    <CheckCircle2 size={11} /> {job.photos} photos verified
                  </span>
                : <span className="text-xs text-gray-300 font-medium">No photos yet</span>
              }
            </InfoBlock>

            {/* Paper invoice upload */}
            <InfoBlock label="Paper invoice" icon={Upload}>
              <label className={`block border-2 border-dashed rounded-xl p-3 text-center transition-colors ${isUpcoming ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-orange-300 hover:bg-orange-50/30'}`}
                style={{ borderColor: 'rgba(194,65,12,0.2)' }}>
                <Upload size={16} className="mx-auto mb-1 text-gray-300" />
                <div className="text-[11px] text-gray-400 leading-snug">Upload — Cadi converts to<br />{job.client}-approved PDF</div>
                <div className="text-[10px] text-gray-300 mt-1">JPG · PNG · PDF</div>
                {!isUpcoming && <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" />}
              </label>
            </InfoBlock>
          </div>

          {/* Work completed — full width */}
          <div className="mt-4">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
              <CheckCircle2 size={10} /> Work completed
            </div>
            <textarea
              value={tasks}
              onChange={e => setTasks(e.target.value)}
              disabled={isUpcoming}
              rows={3}
              className="w-full rounded-xl border text-sm px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: '#e0e8ff', color: NAVY, fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>

          {/* CTAs */}
          {isLive && !jobDone && (
            <button onClick={() => setJobDone(true)}
              className="mt-3 w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-95"
              style={{ background: '#EFF6FF', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>
              Mark Job Complete →
            </button>
          )}
          {isLive && jobDone && (
            <div className="mt-3 py-3 rounded-xl text-center text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100">
              ✓ Job marked complete — ready to invoice
            </div>
          )}
          {isInvoice && !invDone && (
            <button onClick={() => setInvDone(true)}
              className="mt-3 w-full py-3 rounded-xl font-black text-sm text-white transition-all hover:brightness-90"
              style={{ background: ORANGE }}>
              Create Invoice →
            </button>
          )}
          {isInvoice && invDone && (
            <div className="mt-3 py-3 rounded-xl text-center text-sm font-bold text-emerald-600 bg-emerald-50 border border-emerald-100">
              ✓ Invoice created — tracking live in Earnings
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EarnPipeline() {
  return (
    <div className="max-w-2xl space-y-4 pb-10">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black" style={{ color: NAVY }}>Current Work</h1>
        <p className="text-sm text-gray-400 mt-0.5">Active jobs, worksheets and invoice readiness</p>
      </div>

      {/* Summary strip */}
      <div className="bg-white rounded-2xl border border-[#e8eeff] shadow-sm px-5 py-3.5 flex items-center gap-5 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-bold text-blue-600">On site</span>
          <span className="font-black text-sm" style={{ color: NAVY }}>1</span>
        </div>
        <div className="w-px h-4 bg-gray-100" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: ORANGE }} />
          <span className="text-xs font-bold" style={{ color: ORANGE }}>Invoice ready</span>
          <span className="font-black text-sm" style={{ color: NAVY }}>1</span>
        </div>
        <div className="w-px h-4 bg-gray-100" />
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <span className="text-xs font-bold text-indigo-500">Upcoming</span>
          <span className="font-black text-sm" style={{ color: NAVY }}>1</span>
        </div>
        <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-300">
          <Clock size={10} /> Live
        </div>
      </div>

      {jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  );
}
