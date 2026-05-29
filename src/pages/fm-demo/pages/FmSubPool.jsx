import { useState, useEffect } from 'react';
import { Upload, CheckCircle2, Users, AlertCircle, Search, Globe, ChevronRight, Mail, MessageSquare } from 'lucide-react';
import HowItWorks from '../components/HowItWorks';

const SUBS = [
  { id: 's1', name: 'Clearview Window Services', trades: ['Window cleaning'], region: 'Midlands', rating: 4.9, jobs: 142, rate: '£85–£140/job', status: 'available', initials: 'CW', imported: true },
  { id: 's2', name: 'ProWash Midlands',           trades: ['Jet washing', 'Graffiti removal'], region: 'Midlands', rating: 4.7, jobs: 89,  rate: '£180–£280/job', status: 'on-job',   initials: 'PW', imported: true },
  { id: 's3', name: 'Capital Gutters Ltd',         trades: ['Gutter clearing'],                  region: 'South',   rating: 4.8, jobs: 67,  rate: '£120–£200/job', status: 'available', initials: 'CG', imported: true },
  { id: 's4', name: 'CleanFront UK',               trades: ['Window cleaning', 'Jet washing'],    region: 'South',   rating: 4.6, jobs: 203, rate: '£85–£180/job', status: 'available', initials: 'CF', imported: true },
  { id: 's5', name: 'SprayTech Services',          trades: ['Graffiti removal', 'Jet washing'],   region: 'North',   rating: 4.5, jobs: 44,  rate: '£150–£280/job', status: 'available', initials: 'ST', imported: true },
  { id: 's6', name: 'Apex Window Care',            trades: ['Window cleaning'],                   region: 'North',   rating: 4.9, jobs: 178, rate: '£80–£130/job', status: 'on-job',   initials: 'AW', imported: true },
  { id: 's7', name: 'Midlands Pressure Wash',      trades: ['Jet washing', 'Gutter clearing'],    region: 'Midlands', rating: 4.4, jobs: 31, rate: '£120–£250/job', status: 'available', initials: 'MP', imported: true },
];

const TRADE_COLOURS = {
  'Window cleaning':  '#38bdf8',
  'Jet washing':      '#a78bfa',
  'Gutter clearing':  '#34d399',
  'Graffiti removal': '#f87171',
};

const CSV_ROWS = [
  { name: 'Clearview Window Services', trade: 'Window cleaning',  region: 'Midlands', phone: '07700 900123', ok: true  },
  { name: 'ProWash Midlands',          trade: 'Jet washing',      region: 'Midlands', phone: '07700 900456', ok: true  },
  { name: 'Capital Gutters Ltd',       trade: 'Gutter clearing',  region: 'South',    phone: '07700 900789', ok: true  },
  { name: 'CleanFront UK',             trade: 'Window cleaning',  region: 'South',    phone: '07700 900321', ok: true  },
  { name: 'SprayTech Services',        trade: 'Graffiti removal', region: 'North',    phone: '07700 900654', ok: true  },
  { name: 'Apex Window Care',          trade: 'Window cleaning',  region: 'North',    phone: '07700 900987', ok: true  },
  { name: 'Midlands Pressure Wash',    trade: 'Jet washing',      region: 'Midlands', phone: '07700 900147', ok: true  },
  { name: 'GutterGuard South',         trade: 'Gutter clearing',  region: 'South',    phone: '07700 900258', ok: true  },
  { name: 'Graffiti Gone Ltd',         trade: 'Graffiti removal', region: 'North',    phone: '07700 900369', ok: false, warn: 'Duplicate phone — will be flagged' },
  { name: 'Premier Wash Co',           trade: 'Jet washing',      region: 'South',    phone: '—',            ok: false, warn: 'No phone · invite by email instead' },
];

const STEPS = ['Import', 'Review', 'Invite', 'Done'];

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
                background: i < idx ? '#16a34a' : i === idx ? 'rgba(22,163,74,0.25)' : 'rgba(255,255,255,0.07)',
                border: i <= idx ? '1px solid #16a34a' : '1px solid rgba(255,255,255,0.1)',
                color: i <= idx ? (i < idx ? 'white' : '#4ade80') : 'rgba(255,255,255,0.25)',
              }}>
              {i < idx ? '✓' : i + 1}
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider"
              style={{ color: i === idx ? '#4ade80' : i < idx ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="flex-1 h-px mx-2 mb-5"
              style={{ background: i < idx ? '#16a34a' : 'rgba(255,255,255,0.08)' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step: landing — two routes ────────────────────────────────────────────────
function StepUpload({ onBulk, onManual }) {
  return (
    <div className="space-y-6">

      {/* Value prop */}
      <div>
        <span className="inline-block text-[10px] font-black px-2.5 py-1 rounded-full tracking-widest uppercase mb-3"
          style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', color: '#4ade80' }}>
          Cadi Lite · free for your contractors
        </span>
        <div className="text-white font-black text-xl leading-tight mb-2">
          Every contractor you add gets a free Cadi Lite account
        </div>
        <p className="text-white/40 text-sm leading-relaxed max-w-lg">
          No charge to them, nothing to configure on your end. Add your contractors by bulk upload or one by one —
          Cadi creates their account, sends the invite, and they're live on your jobs and on Cadi Connect.
        </p>
      </div>

      {/* What Cadi Lite includes */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: 'rgba(22,163,74,0.07)', border: '1px solid rgba(22,163,74,0.2)' }}>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/30">What they get — free, forever</div>
        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
          {[
            { icon: '📋', text: 'Receive your job cards & accept in-app' },
            { icon: '📍', text: 'GPS check-in and photo evidence' },
            { icon: '🧾', text: 'Invoice submission straight to your accounts' },
            { icon: '🌐', text: 'Direct access to Cadi Connect marketplace' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-2">
              <span className="text-sm shrink-0">{icon}</span>
              <span className="text-white/55 text-xs">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Workflow steps */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {[
          { n: '1', label: 'You add them',          sub: 'CSV or manual'       },
          { n: '2', label: 'Account created',        sub: 'Free Cadi Lite'      },
          { n: '3', label: 'SMS invite sent',        sub: 'Instant, automatic'  },
          { n: '4', label: 'Live on Connect',        sub: 'Jobs + marketplace'  },
        ].map(({ n, label, sub }, i, arr) => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < arr.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)', fontSize: 11, fontWeight: 900, color: '#4ade80' }}>{n}</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 800, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>{label}</div>
                <div style={{ fontSize: '0.52rem', color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>{sub}</div>
              </div>
            </div>
            {i < arr.length - 1 && <div style={{ flex: 1, height: 1, background: 'rgba(22,163,74,0.2)', margin: '0 6px', marginBottom: 18 }} />}
          </div>
        ))}
      </div>

      {/* Two routes */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">How would you like to add them?</div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onBulk}
            className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center transition-all"
            style={{ background: 'rgba(22,163,74,0.07)', border: '2px dashed rgba(22,163,74,0.3)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(22,163,74,0.6)'; e.currentTarget.style.background = 'rgba(22,163,74,0.11)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(22,163,74,0.3)'; e.currentTarget.style.background = 'rgba(22,163,74,0.07)'; }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
              <Upload size={20} color="#4ade80" />
            </div>
            <div>
              <div className="text-white font-black text-sm mb-1">Bulk upload</div>
              <div className="text-white/35 text-xs leading-relaxed">Upload a CSV of your existing contractor list — Cadi creates all accounts in one go</div>
            </div>
            <div className="px-4 py-1.5 rounded-xl text-xs font-black text-white"
              style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
              Upload CSV →
            </div>
          </button>
          <button
            onClick={onManual}
            className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center transition-all"
            style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.1)', cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(22,163,74,0.3)'; e.currentTarget.style.background = 'rgba(22,163,74,0.05)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <Users size={20} color="rgba(255,255,255,0.45)" />
            </div>
            <div>
              <div className="text-white font-black text-sm mb-1">Add manually</div>
              <div className="text-white/35 text-xs leading-relaxed">Add contractors one by one as you onboard them — just a name, trade and phone number</div>
            </div>
            <div className="px-4 py-1.5 rounded-xl text-xs font-black"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', border: '1px solid rgba(255,255,255,0.1)' }}>
              Add manually →
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step: manual add ─────────────────────────────────────────────────────────
function StepManual({ onBack, onAdded }) {
  const [name,   setName]   = useState('');
  const [phone,  setPhone]  = useState('');
  const [trade,  setTrade]  = useState('Window cleaning');
  const [region, setRegion] = useState('Midlands');
  const [done,   setDone]   = useState(false);

  const inputStyle = {
    width: '100%', padding: '0.55rem 0.85rem', borderRadius: '0.65rem',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'white', fontSize: '0.78rem', outline: 'none',
  };

  function handleCreate() {
    setDone(true);
    setTimeout(() => onAdded(), 1400);
  }

  if (done) return (
    <div className="flex flex-col items-center py-16 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <CheckCircle2 size={30} color="#4ade80" />
      </div>
      <div className="text-white font-black text-lg">Account created</div>
      <div className="text-white/40 text-sm text-center max-w-xs">
        {name || 'Your contractor'} will receive an SMS invite to download Cadi and access their free Lite account.
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 440 }} className="space-y-5">
      <div>
        <div className="text-white font-black text-lg mb-1">Add a contractor</div>
        <div className="text-white/40 text-sm">They'll receive a free Cadi Lite account and an SMS invite straight away.</div>
      </div>
      <div className="space-y-3">
        <div>
          <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Company / name</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Harris Window Services" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Mobile number</label>
          <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="For SMS invite" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Trade</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={trade} onChange={e => setTrade(e.target.value)}>
              {['Window cleaning', 'Jet washing', 'Gutter clearing', 'Graffiti removal'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>Region</label>
            <select style={{ ...inputStyle, appearance: 'none' }} value={region} onChange={e => setRegion(e.target.value)}>
              {['North', 'Midlands', 'South'].map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button onClick={onBack} style={{ padding: '0.65rem 1.1rem', borderRadius: '0.65rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
          ← Back
        </button>
        <button
          onClick={handleCreate}
          disabled={!name || !phone}
          style={{ flex: 1, padding: '0.65rem 1.1rem', borderRadius: '0.65rem', background: name && phone ? 'linear-gradient(135deg, #16a34a, #15803d)' : 'rgba(255,255,255,0.06)', border: 'none', color: name && phone ? 'white' : 'rgba(255,255,255,0.25)', fontSize: '0.75rem', fontWeight: 900, cursor: name && phone ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          Create free Cadi Lite account →
        </button>
      </div>
    </div>
  );
}

function StepParsing() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + 8, 100)), 80);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <Upload size={28} color="#4ade80" />
      </div>
      <div className="text-center">
        <div className="text-white font-black text-lg mb-1">Reading your file…</div>
        <div className="text-white/35 text-sm">Validating rows and matching trade types</div>
      </div>
      <div className="w-64 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className="h-full rounded-full transition-all duration-100"
          style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
      </div>
      <div className="text-white/25 text-xs">{Math.round(progress)}% processed</div>
    </div>
  );
}

function StepReview({ onSendInvites }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 p-4 rounded-2xl"
        style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)' }}>
        <CheckCircle2 size={18} color="#4ade80" className="shrink-0" />
        <div className="flex-1">
          <div className="text-white font-black text-sm">File ready — click to import contractors</div>
          <div className="text-white/40 text-xs mt-0.5">298 valid · 2 warnings (shown below) · 0 errors</div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="grid px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-white/25"
          style={{ gridTemplateColumns: '2fr 1.5fr 1fr 1.4fr 60px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span>Name</span><span>Trade</span><span>Region</span><span>Phone</span><span>Status</span>
        </div>
        {CSV_ROWS.map((row, i) => (
          <div key={i} className="grid px-4 py-2.5 items-center"
            style={{
              gridTemplateColumns: '2fr 1.5fr 1fr 1.4fr 60px',
              background: row.ok ? (i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)') : 'rgba(251,191,36,0.04)',
              borderBottom: i < CSV_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
            <span className="text-white/80 text-xs font-medium truncate pr-2">{row.name}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md w-fit"
              style={{ color: TRADE_COLOURS[row.trade] || '#94a3b8', background: `${TRADE_COLOURS[row.trade] || '#94a3b8'}15` }}>
              {row.trade}
            </span>
            <span className="text-white/40 text-xs">{row.region}</span>
            <span className="text-white/40 text-xs font-mono">{row.phone}</span>
            <div className="flex items-center gap-1.5">
              {row.ok ? (
                <span className="text-[9px] font-black text-emerald-400">✓ OK</span>
              ) : (
                <div className="flex items-center gap-1">
                  <AlertCircle size={12} color="#fbbf24" />
                  <span className="text-[9px] font-black text-amber-400">Warn</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="px-4 py-3 text-white/20 text-xs"
          style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          … and 290 more rows
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
        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 8px 24px rgba(22,163,74,0.3)' }}>
        Create free Cadi Lite accounts &amp; send invites
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function StepInviting() {
  const [smsSent,   setSmsSent]   = useState(0);
  const [emailSent, setEmailSent] = useState(0);

  useEffect(() => {
    const smsT = setInterval(() => setSmsSent(s => {
      if (s >= 298) { clearInterval(smsT); return 298; }
      return Math.min(s + Math.floor(Math.random() * 18 + 8), 298);
    }), 100);
    const emailT = setInterval(() => setEmailSent(e => {
      if (e >= 2) { clearInterval(emailT); return 2; }
      return e + 1;
    }), 800);
    return () => { clearInterval(smsT); clearInterval(emailT); };
  }, []);

  const smsProgress   = Math.min(smsSent  / 298 * 100, 100);
  const emailProgress = Math.min(emailSent / 2   * 100, 100);
  const totalSent = Math.min(smsSent, 298) + Math.min(emailSent, 2);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
        <span className="text-2xl">📱</span>
      </div>
      <div className="text-center">
        <div className="text-white font-black text-lg mb-1">Creating Cadi Lite accounts…</div>
        <div className="text-white/35 text-sm">Sending invites across two channels simultaneously</div>
      </div>

      <div className="w-72 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={12} style={{ color: '#4ade80' }} />
              <span className="text-xs font-bold text-white/60">SMS — 298 contractors</span>
            </div>
            <span className="text-xs font-black" style={{ color: '#4ade80' }}>{Math.min(smsSent, 298)}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="h-full rounded-full transition-all duration-100"
              style={{ width: `${smsProgress}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)' }} />
          </div>
        </div>

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

      <div className="text-white/25 text-xs">{totalSent} invites sent</div>
    </div>
  );
}

function StepDone({ onViewPool }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center py-10 gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
          <CheckCircle2 size={30} color="#4ade80" />
        </div>
        <div>
          <div className="text-white font-black text-2xl mb-2">Cadi Lite accounts created</div>
          <div className="text-white/40 text-sm leading-relaxed max-w-md">
            298 invites sent by SMS · 2 by email (no phone on file).
            Each contractor now has a free Cadi Lite account and is connected to Britannia's jobs and to Cadi Connect.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-sm mt-2">
          {[
            { value: '✓',   label: 'Lite accounts', color: '#a78bfa' },
            { value: '✓',   label: 'SMS invites',   color: '#4ade80' },
            { value: '2',   label: 'Email invites', color: '#60a5fa' },
          ].map(({ value, label, color }) => (
            <div key={label} className="rounded-2xl p-3 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xl font-black" style={{ color }}>{value}</div>
              <div className="text-white/35 text-[10px] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ background: 'rgba(99,102,241,0.1)', borderBottom: '1px solid rgba(99,102,241,0.15)' }}>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#a78bfa', border: '1px solid rgba(99,102,241,0.3)' }}>
            Cadi Lite
          </span>
          <span className="text-white/50 text-xs font-bold">What your contractors now have access to</span>
        </div>
        <div className="px-5 py-4 space-y-2.5"
          style={{ background: 'rgba(99,102,241,0.04)' }}>
          {[
            { icon: '🔔', text: 'Job card notifications from Britannia — accept, schedule, complete, invoice' },
            { icon: '🌐', text: 'Direct access to Cadi Connect — visibility of available jobs across the network' },
            { icon: '📍', text: 'GPS check-in, photo evidence upload and invoice tools — all in one app' },
            { icon: '⭐', text: 'Connect score — rated by every job completed, visible to all FM companies on the platform' },
          ].map(({ icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <span className="text-sm shrink-0">{icon}</span>
              <span className="text-white/50 text-xs leading-relaxed">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite message templates */}
      <div className="space-y-3">
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)' }}>
          <MessageSquare size={15} style={{ color: '#4ade80', flexShrink: 0 }} className="mt-0.5" />
          <div>
            <div className="text-white/60 text-xs font-bold mb-0.5">SMS — sent to 298 contractors</div>
            <div className="text-white/30 text-xs leading-relaxed italic">
              "Hi Clearview — Britannia Group has added you to their contractor network on Cadi Connect. Your free Cadi Lite account is ready — accept jobs, upload evidence and invoice in-app. [Activate now]"
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'rgba(79,120,255,0.06)', border: '1px solid rgba(79,120,255,0.15)' }}>
          <Mail size={15} style={{ color: '#60a5fa', flexShrink: 0 }} className="mt-0.5" />
          <div>
            <div className="text-white/60 text-xs font-bold mb-0.5">Email — sent to 2 contractors (no mobile on file)</div>
            <div className="text-white/30 text-xs leading-relaxed italic">
              "Hi Premier Wash — Britannia Group has set up a free Cadi Lite account for you. Click below to activate, view job cards and start invoicing directly. [Activate account]"
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onViewPool}
        className="w-full py-3.5 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', boxShadow: '0 8px 24px rgba(22,163,74,0.3)' }}>
        <Users size={16} />
        View your contractor pool
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function PoolView({ showToast, onShowConnect }) {
  const [search, setSearch] = useState('');
  const filtered = SUBS.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.trades.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    s.region.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Your contractors', value: 'Live',  color: '#38bdf8' },
          { label: 'Available now',   value: '187',  color: '#4ade80' },
          { label: 'On job today',    value: '43',   color: '#fbbf24' },
          { label: 'Avg rating',      value: '4.7★', color: '#a78bfa' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-2xl font-black" style={{ color }}>{value}</div>
            <div className="text-white/50 text-xs font-bold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: '#a78bfa' }}>
          <CheckCircle2 size={11} />
          Cadi Lite accounts active · onboarded 24 May 2026
        </div>
        <div className="ml-auto flex items-center gap-2 flex-1 max-w-xs rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <Search size={13} color="rgba(255,255,255,0.3)" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search contractors…" className="bg-transparent text-white text-xs flex-1 outline-none placeholder-white/20" />
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.map(sub => (
          <div key={sub.id} className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(14,165,233,0.3), rgba(2,132,199,0.2))', border: '1px solid rgba(14,165,233,0.3)' }}>
                {sub.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-white font-black text-sm">{sub.name}</span>
                  <span className="text-[9px] font-black" style={{ color: sub.status === 'available' ? '#4ade80' : '#fbbf24' }}>
                    {sub.status === 'available' ? '● Available' : '● On job'}
                  </span>
                  {sub.imported && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a78bfa' }}>
                      CADI LITE
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {sub.trades.map(t => (
                    <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ color: TRADE_COLOURS[t] || '#94a3b8', background: `${TRADE_COLOURS[t] || '#94a3b8'}15` }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-white/60 text-xs font-bold">{sub.rate} · {sub.region}</div>
                <div className="text-white/30 text-[11px]">{sub.rating}★ · {sub.jobs} jobs</div>
              </div>
              <button
                onClick={() => showToast(`send job to ${sub.name}`)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
                style={{ border: '1px solid rgba(14,165,233,0.2)', color: 'rgba(56,189,248,0.7)' }}>
                Send job
              </button>
            </div>
          </div>
        ))}
        <div className="text-center text-white/20 text-xs py-2">
          Showing 7 — use search to filter your full pool
        </div>
      </div>

      <div className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.08), rgba(79,120,255,0.06))', border: '1px solid rgba(167,139,250,0.2)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
            style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)' }}>
            🌐
          </div>
          <div className="flex-1">
            <div className="text-white font-black text-sm mb-0.5">Need more contractors?</div>
            <div className="text-white/40 text-xs leading-relaxed">
              Cadi Connect gives you access to a wider network of vetted, scored operatives — ready to deploy when your own pool is at capacity.
            </div>
          </div>
          {onShowConnect && (
            <button
              onClick={onShowConnect}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black shrink-0"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa' }}>
              <Globe size={12} />
              View Cadi Connect
              <ChevronRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FmSubPool({ showToast, onNavigateWithMode }) {
  const [step, setStep] = useState('landing');

  useEffect(() => {
    if (step === 'parsing') {
      const t = setTimeout(() => setStep('review'), 2000);
      return () => clearTimeout(t);
    }
    if (step === 'inviting') {
      const t = setTimeout(() => setStep('done'), 2400);
      return () => clearTimeout(t);
    }
  }, [step]);

  const showConnect = onNavigateWithMode
    ? () => onNavigateWithMode('cadi-connect', 'exterior')
    : null;

  const inBulkFlow = ['upload', 'parsing', 'review', 'inviting', 'done'].includes(step);

  return (
    <div className="p-6 max-w-3xl">
      <HowItWorks
        setupTime="~15 min"
        accent="#16a34a"
        youSetUp={[
          'Contractor CSV with Name, Company, Trade, Phone, Email',
          'Or add manually one by one as you onboard new contractors',
        ]}
        cadiHandles={[
          'Creates a free Cadi Lite account for each contractor',
          'Sends app invite automatically — nothing for you to do',
          'Gives them direct access to Cadi Connect and your job cards',
          'Enables invoice submission straight to your accounts inbox',
        ]}
      />

      {inBulkFlow && <ProgressBar step={step} />}

      {step === 'landing'  && <StepUpload   onBulk={() => setStep('upload')} onManual={() => setStep('manual')} />}
      {step === 'manual'   && <StepManual   onBack={() => setStep('landing')} onAdded={() => setStep('pool')} />}
      {step === 'upload'   && (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-3 transition-all cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.12)' }}
          onClick={() => setStep('parsing')}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(22,163,74,0.4)'; e.currentTarget.style.background = 'rgba(22,163,74,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.3)' }}>
            <Upload size={20} color="#4ade80" />
          </div>
          <div className="text-center">
            <div className="text-white font-black text-sm">Drop your CSV or Excel file here</div>
            <div className="text-white/30 text-xs mt-1">Supports .csv · .xlsx · up to 1,000 rows</div>
          </div>
          <div className="px-5 py-2 rounded-xl text-xs font-black text-white"
            style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
            Browse files
          </div>
          <button onClick={e => { e.stopPropagation(); setStep('landing'); }} className="text-white/25 text-xs mt-2 hover:text-white/50 transition-colors">← Back</button>
        </div>
      )}
      {step === 'parsing'  && <StepParsing />}
      {step === 'review'   && <StepReview   onSendInvites={() => setStep('inviting')} />}
      {step === 'inviting' && <StepInviting />}
      {step === 'done'     && <StepDone     onViewPool={() => setStep('pool')} />}
      {step === 'pool'     && <PoolView     showToast={showToast} onShowConnect={showConnect} />}
    </div>
  );
}
