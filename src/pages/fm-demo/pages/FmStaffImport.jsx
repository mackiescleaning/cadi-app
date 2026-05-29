import { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Users, Download, AlertCircle, ChevronRight, Mail, MessageSquare } from 'lucide-react';
import HowItWorks from '../components/HowItWorks';
import CadiWordmark from '../../../components/CadiWordmark';

const STEPS = ['Import', 'Review', 'Invite', 'Done'];

const CSV_ROWS = [
  { name: 'Sarah Patel',       site: 'L&D Hospital – Main Tower',  hours: 37.5, dept: 'Healthcare',    phone: '07712 334 891', ok: true  },
  { name: 'Marcus Webb',       site: 'Luton Customer Service Ctr', hours: 30,   dept: 'Public Sector', phone: '07834 002 145', ok: true  },
  { name: 'Fatima Bello',      site: 'Next – Luton The Mall',      hours: 25,   dept: 'Retail',        phone: '07901 556 720', ok: true  },
  { name: 'Kwame Boateng',     site: 'Aldi – Dunstable RDC',       hours: 37.5, dept: 'Industrial',    phone: '07765 113 408', ok: true  },
  { name: 'Dev Sharma',        site: 'UoB Luton Campus',           hours: 20,   dept: 'Education',     phone: '07523 889 034', ok: true  },
  { name: 'Leah Okonkwo',      site: 'Watling House Offices',      hours: 37.5, dept: 'Commercial',    phone: '07688 241 977', ok: true  },
  { name: 'James Thornton',    site: 'Central Beds – Priory Hse',  hours: 37.5, dept: 'Public Sector', phone: '—',            ok: true  },
  { name: 'Priya Sharma',      site: 'L&D Hospital – Outpatients', hours: 30,   dept: 'Healthcare',    phone: '—',            ok: true  },
  { name: 'Tom Adeyemi',       site: 'Next – Watford',             hours: 37.5, dept: 'Retail',        phone: '07490 667 312', ok: false, warn: 'Site not yet in system — will be matched on go-live' },
  { name: 'Amira Hassan',      site: 'Luton Central Library',      hours: 25,   dept: 'Public Sector', phone: '07356 124 809', ok: false, warn: 'Duplicate name — manual review flagged' },
];

const DEPT_COLOURS = {
  'Healthcare':    '#f87171',
  'Public Sector': '#60a5fa',
  'Retail':        '#fbbf24',
  'Industrial':    '#a78bfa',
  'Education':     '#34d399',
  'Commercial':    '#38bdf8',
};

function ProgressBar({ step }) {
  const steps = ['upload', 'review', 'inviting', 'done'];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} style={{ display: 'contents' }}>
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
              style={{
                background: i < idx ? '#ea580c' : i === idx ? 'rgba(234,88,12,0.25)' : 'rgba(255,255,255,0.07)',
                border: i <= idx ? '1px solid #ea580c' : '1px solid rgba(255,255,255,0.1)',
                color: i <= idx ? (i < idx ? 'white' : '#fb923c') : 'rgba(255,255,255,0.25)',
              }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider"
              style={{ color: i === idx ? '#fb923c' : i < idx ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px mx-2 mb-5"
              style={{ background: i < idx ? '#ea580c' : 'rgba(255,255,255,0.08)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

function StepUpload({ onUpload, showToast }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 text-white font-black text-xl leading-tight mb-2">
          Onboard your PAYE staff onto <CadiWordmark height={22} />
        </div>
        <p className="text-white/40 text-sm leading-relaxed max-w-lg">
          Upload your existing staff spreadsheet. Cadi creates a Staff App account for each person,
          sends them a download invite, and populates your HR module — DBS tracking, RTW, rota and pay, all in one place.
        </p>
      </div>

      <button
        onClick={() => showToast('Staff CSV template downloaded')}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
        style={{ background: 'rgba(234,88,12,0.1)', border: '1px solid rgba(234,88,12,0.25)', color: '#fb923c' }}>
        <Download size={14} />
        Download CSV template
      </button>

      <button
        onClick={onUpload}
        className="w-full rounded-2xl p-10 flex flex-col items-center gap-3 transition-all"
        style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.12)' }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(234,88,12,0.4)'; e.currentTarget.style.background = 'rgba(234,88,12,0.03)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
          <Upload size={20} color="#fb923c" />
        </div>
        <div>
          <div className="text-white font-black text-sm">Drop your CSV or Excel file here</div>
          <div className="text-white/30 text-xs mt-1">Supports .csv · .xlsx · up to 5,000 rows</div>
        </div>
        <div className="px-5 py-2 rounded-xl text-xs font-black text-white"
          style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)' }}>
          Browse files
        </div>
      </button>

      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25">What gets imported</div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Staff name & contact', icon: '👤' },
            { label: 'Assigned site(s)', icon: '📍' },
            { label: 'Contract hours', icon: '⏱' },
            { label: 'Department & role', icon: '🏷' },
            { label: 'Pay rate', icon: '£' },
            { label: 'DBS & RTW status', icon: '✓' },
          ].map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="text-white/45 text-xs">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepParsing() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + 5, 100)), 60);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
        <Upload size={28} color="#fb923c" />
      </div>
      <div className="text-center">
        <div className="text-white font-black text-lg mb-1">Reading your file…</div>
        <div className="text-white/35 text-sm">Matching staff to sites and validating records</div>
      </div>
      <div className="w-64 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-100"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #ea580c, #fb923c)' }} />
      </div>
      <div className="text-white/25 text-xs">{Math.round(progress)}% processed</div>
    </div>
  );
}

function StepReview({ onSendInvites }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)' }}>
        <CheckCircle2 size={18} color="#fb923c" className="shrink-0" />
        <div className="flex-1">
          <div className="text-white font-black text-sm">Rows detected — ready to import</div>
          <div className="text-white/40 text-xs mt-0.5">1,485 valid · 2 warnings (shown below) · 0 errors</div>
        </div>
      </div>

      {/* Dept breakdown */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { dept: 'Healthcare', count: 312 },
          { dept: 'Retail', count: 284 },
          { dept: 'Public Sector', count: 391 },
          { dept: 'Industrial', count: 198 },
          { dept: 'Commercial', count: 176 },
          { dept: 'Education', count: 126 },
        ].map(({ dept, count }) => (
          <div key={dept} className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEPT_COLOURS[dept] }} />
            <div>
              <div className="text-white/70 text-xs font-bold">{count}</div>
              <div className="text-white/30 text-[9px]">{dept}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Preview table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/25"
          style={{ gridTemplateColumns: '1.6fr 1.8fr 0.7fr 1.1fr 1.2fr 52px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span>Name</span><span>Site</span><span>Hrs/wk</span><span>Dept</span><span>Phone</span><span>Status</span>
        </div>
        {CSV_ROWS.map((row, i) => (
          <div key={i} className="grid px-4 py-2.5 items-center"
            style={{
              gridTemplateColumns: '1.6fr 1.8fr 0.7fr 1.1fr 1.2fr 52px',
              background: row.ok ? (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)') : 'rgba(251,191,36,0.04)',
              borderBottom: i < CSV_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
            <span className="text-white/80 text-xs font-medium truncate pr-2">{row.name}</span>
            <span className="text-white/40 text-xs truncate pr-2">{row.site}</span>
            <span className="text-white/40 text-xs">{row.hours}h</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit"
              style={{ color: DEPT_COLOURS[row.dept] || '#94a3b8', background: `${DEPT_COLOURS[row.dept] || '#94a3b8'}15` }}>
              {row.dept}
            </span>
            <span className={`text-[10px] font-mono ${row.phone === '—' ? 'text-white/20' : 'text-white/45'}`}>
              {row.phone}
            </span>
            <div>
              {row.ok
                ? <span className="text-[9px] font-black text-emerald-400">✓ OK</span>
                : <span className="flex items-center gap-1"><AlertCircle size={11} color="#fbbf24" /><span className="text-[9px] font-black text-amber-400">Warn</span></span>
              }
            </div>
          </div>
        ))}
        <div className="px-4 py-3 text-white/20 text-xs"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          … and 1,477 more rows
        </div>
      </div>

      <div className="space-y-2">
        {CSV_ROWS.filter(r => !r.ok).map((row, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <AlertCircle size={14} color="#fbbf24" className="shrink-0 mt-0.5" />
            <div>
              <div className="text-white/70 text-xs font-bold">{row.name}</div>
              <div className="text-amber-400/80 text-[10px] mt-0.5">{row.warn}</div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onSendInvites}
        className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 8px 24px rgba(234,88,12,0.3)' }}>
        Create Staff App accounts &amp; send invites to your staff
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function StepInviting() {
  const [smsSent, setSmsSent] = useState(0);
  const [emailSent, setEmailSent] = useState(0);

  useEffect(() => {
    const smsT = setInterval(() => setSmsSent(s => {
      if (s >= 1485) { clearInterval(smsT); return 1485; }
      return Math.min(s + Math.floor(Math.random() * 60 + 30), 1485);
    }), 100);
    const emailT = setInterval(() => setEmailSent(e => {
      if (e >= 2) { clearInterval(emailT); return 2; }
      return e + 1;
    }), 700);
    return () => { clearInterval(smsT); clearInterval(emailT); };
  }, []);

  const smsProgress  = Math.min(smsSent  / 1485 * 100, 100);
  const emailProgress = Math.min(emailSent / 2   * 100, 100);
  const totalSent = Math.min(smsSent, 1485) + Math.min(emailSent, 2);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
        <span className="text-2xl">📱</span>
      </div>
      <div className="text-center">
        <div className="text-white font-black text-lg mb-1">Creating Staff App accounts…</div>
        <div className="text-white/35 text-sm">Sending invites across two channels simultaneously</div>
      </div>

      <div className="w-72 space-y-4">
        {/* SMS channel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={12} style={{ color: '#fb923c' }} />
              <span className="text-xs font-bold text-white/60">SMS — 1,485 staff</span>
            </div>
            <span className="text-xs font-black" style={{ color: '#fb923c' }}>{Math.min(smsSent, 1485).toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-100"
              style={{ width: `${smsProgress}%`, background: 'linear-gradient(90deg, #ea580c, #fb923c)' }} />
          </div>
        </div>

        {/* Email channel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail size={12} style={{ color: '#60a5fa' }} />
              <span className="text-xs font-bold text-white/60">Email — 2 flagged (no phone)</span>
            </div>
            <span className="text-xs font-black" style={{ color: '#60a5fa' }}>{Math.min(emailSent, 2)}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-100"
              style={{ width: `${emailProgress}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
          </div>
        </div>
      </div>

      <div className="text-white/25 text-xs">{totalSent.toLocaleString()} invites sent</div>
    </div>
  );
}

function StepDone({ onViewHR }) {
  // Match the batch totals shown in StepReview / StepInviting
  const created    = 1485;
  const emailCount = 2;    // no phone on file (as flagged in review)
  const smsCount   = created - emailCount;
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center py-10 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(234,88,12,0.15)', border: '1px solid rgba(234,88,12,0.3)' }}>
          <CheckCircle2 size={30} color="#fb923c" />
        </div>
        <div>
          <div className="text-white font-black text-2xl mb-2">{created} staff accounts created</div>
          <div className="text-white/40 text-sm leading-relaxed max-w-md">
            {smsCount} invites sent by SMS · {emailCount} by email (no phone on file).
            Staff are live in your HR module — DBS tracking, RTW and rota dispatch ready immediately.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-sm mt-2">
          {[
            { value: created,   label: 'Accounts created', color: '#fb923c' },
            { value: smsCount,  label: 'SMS invites',      color: '#4ade80' },
            { value: emailCount,label: 'Email invites',    color: '#60a5fa' },
          ].map(({ value, label, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xl font-black" style={{ color }}>{value}</div>
              <div className="text-white/35 text-[10px] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* What staff get */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(234,88,12,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ background: 'rgba(234,88,12,0.1)', borderBottom: '1px solid rgba(234,88,12,0.15)' }}>
          <span className="text-[10px] font-black text-orange-300">What each staff member gets in their app</span>
        </div>
        <div className="px-5 py-4 space-y-2.5" style={{ background: 'rgba(234,88,12,0.04)' }}>
          {[
            { icon: '📅', text: 'Their assigned rota — shifts, sites and times. No more WhatsApp.' },
            { icon: '📍', text: 'Geo-stamped check-in. Clock in, clock out. Hours captured automatically.' },
            { icon: '✅', text: 'Task checklist and photo evidence per shift — signed off in the app.' },
            { icon: '💷', text: 'Pay summary, payslips and holiday balance — always up to date.' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <span className="text-sm shrink-0">{icon}</span>
              <span className="text-white/50 text-xs leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Message templates */}
      <div className="space-y-3">
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(234,88,12,0.06)', border: '1px solid rgba(234,88,12,0.15)' }}>
          <MessageSquare size={15} style={{ color: '#fb923c', flexShrink: 0 }} className="mt-0.5" />
          <div>
            <div className="text-white/60 text-xs font-bold mb-0.5">SMS — sent to 1,485 staff</div>
            <div className="text-white/30 text-xs leading-relaxed italic">
              "Hi Sarah — Britannia Group has set up your work profile on Cadi. Download the app to see your rota, check in to shifts and view your pay. [link]"
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(79,120,255,0.06)', border: '1px solid rgba(79,120,255,0.15)' }}>
          <Mail size={15} style={{ color: '#60a5fa', flexShrink: 0 }} className="mt-0.5" />
          <div>
            <div className="text-white/60 text-xs font-bold mb-0.5">Email — sent to 2 staff (no mobile number on file)</div>
            <div className="text-white/30 text-xs leading-relaxed italic">
              "Hi Tom — Britannia Group has created your Cadi account. Click below to set up your profile, view your rota and check in to shifts. [Activate account]"
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onViewHR}
          className="flex-1 py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', boxShadow: '0 8px 24px rgba(234,88,12,0.3)' }}>
          <Users size={16} />
          View HR module
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function FmStaffImport({ showToast, onNavigate }) {
  const [step, setStep] = useState('upload');

  useEffect(() => {
    if (step === 'parsing') {
      const t = setTimeout(() => setStep('review'), 2200);
      return () => clearTimeout(t);
    }
    if (step === 'inviting') {
      const t = setTimeout(() => setStep('done'), 2600);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div className="p-6 max-w-3xl">
      <HowItWorks
        setupTime="~30 min"
        youSetUp={[
          'CSV with Name, Site, Contracted hours, Start date',
          'DBS certificate numbers (can add later)',
          'Payroll reference numbers for BACS export',
        ]}
        cadiHandles={[
          'Creates a Staff App account for each person',
          'Sends SMS app download invite automatically',
          'Populates your HR module — DBS, RTW, training tracking',
          'Assigns each person to their site from your CSV',
        ]}
      />
      <ProgressBar step={step} />
      {step === 'upload'   && <StepUpload   onUpload={() => setStep('parsing')}           showToast={showToast} />}
      {step === 'parsing'  && <StepParsing  />}
      {step === 'review'   && <StepReview   onSendInvites={() => setStep('inviting')}     />}
      {step === 'inviting' && <StepInviting />}
      {step === 'done'     && <StepDone     onViewHR={() => onNavigate?.('hr-staff')}    />}
    </div>
  );
}
