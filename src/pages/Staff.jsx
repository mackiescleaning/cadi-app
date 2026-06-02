import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, UserPlus, Calendar, CreditCard, Network,
  LayoutDashboard, Search, ChevronLeft, ChevronRight,
  Plus, AlertTriangle, Clock, CheckCircle, XCircle,
  ShieldCheck, FileText, GraduationCap, Briefcase,
  Phone, Mail, DollarSign, MapPin, Edit2, X,
  ArrowRight, Zap, TrendingUp, RefreshCw, ChevronDown, Send,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtHour(h) {
  if (h == null) return '';
  const hour = Math.floor(h);
  const min  = Math.round((h % 1) * 60);
  const ampm = hour < 12 ? 'am' : 'pm';
  const disp = hour % 12 || 12;
  return min === 0 ? `${disp}${ampm}` : `${disp}:${min.toString().padStart(2, '0')}${ampm}`;
}

function toISO(date) {
  return date.toISOString().slice(0, 10);
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDateShort(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

const STATUS_COLOR = {
  scheduled:   { bg: 'rgba(31,72,255,0.15)',  text: '#99c5ff', dot: '#1f48ff' },
  in_progress: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', dot: '#f59e0b' },
  completed:   { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', dot: '#10b981' },
  cancelled:   { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5', dot: '#ef4444' },
  unassigned:  { bg: 'rgba(153,197,255,0.08)', text: 'rgba(153,197,255,0.4)', dot: 'rgba(153,197,255,0.3)' },
};

const ROLE_LABELS = { cleaner: 'Cleaner', supervisor: 'Supervisor', manager: 'Manager' };

// ─── Card shell ───────────────────────────────────────────────────────────────

function Card({ children, className = '', style = {} }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[rgba(153,197,255,0.12)] ${className}`}
      style={{ background: 'linear-gradient(135deg, #05124a 0%, #0a1860 100%)', ...style }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#99c5ff]/30 to-transparent" />
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle, action }) {
  return (
    <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
      <div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
        {subtitle && <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function RotaStat({ value, sub, color = 'normal' }) {
  const bg   = { normal: 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.12)]', green: 'bg-emerald-500/10 border-emerald-500/20', amber: 'bg-amber-500/10 border-amber-500/20', red: 'bg-red-500/10 border-red-500/20' };
  const val  = { normal: 'text-white', green: 'text-emerald-300', amber: 'text-amber-300', red: 'text-red-300' };
  const sub_ = { normal: 'text-[rgba(153,197,255,0.5)]', green: 'text-emerald-400', amber: 'text-amber-400', red: 'text-red-400' };
  return (
    <div className={`rounded-xl p-3 border ${bg[color]}`}>
      <div className={`text-xl font-bold ${val[color]}`}>{value}</div>
      <div className={`text-[11px] mt-0.5 ${sub_[color]}`}>{sub}</div>
    </div>
  );
}

// ─── Sub-tab: HUB ─────────────────────────────────────────────────────────────

function StaffHub({ staff, jobs, absences, training, loading, onTabChange }) {
  const today    = toISO(new Date());
  const todayD   = new Date(); todayD.setHours(0,0,0,0);
  const in30D    = new Date(todayD); in30D.setDate(todayD.getDate() + 30);
  const in30     = toISO(in30D);
  const todayJobs = useMemo(() => jobs.filter(j => j.date === today), [jobs, today]);
  const onShift   = todayJobs.filter(j => j.status === 'in_progress' || j.status === 'in-progress');
  const unassigned = jobs.filter(j =>
    (!j.assignee_ids || j.assignee_ids.length === 0) &&
    (!j.assignees || j.assignees.length === 0) &&
    j.date >= today
  );
  const activeStaff = staff.filter(s => s.is_active);

  // Training cert alerts
  const expiredCerts  = training.filter(t => t.expiry_date && t.expiry_date < today);
  const expiringSoon  = training.filter(t => t.expiry_date && t.expiry_date >= today && t.expiry_date <= in30);
  const expiredStaff  = new Set(expiredCerts.map(t => t.staff_id)).size;
  const expiringStaff = new Set(expiringSoon.map(t => t.staff_id)).size;

  const stats = [
    { label: 'Active staff',     value: activeStaff.length, icon: Users,        color: '#1f48ff', bg: '#f0f4ff'  },
    { label: 'On shift now',     value: onShift.length,     icon: Zap,          color: '#f59e0b', bg: '#fef9ec'  },
    { label: "Today's jobs",     value: todayJobs.length,   icon: Calendar,     color: '#16a34a', bg: '#f0fdf4'  },
    { label: 'Unassigned (7d)',  value: unassigned.length,  icon: AlertTriangle,color: unassigned.length > 0 ? '#ef4444' : '#6b7280', bg: unassigned.length > 0 ? '#fef2f2' : '#f9fafb' },
  ];

  const actionCards = [];
  if (unassigned.length > 0)
    actionCards.push({ icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', text: `${unassigned.length} unassigned job${unassigned.length > 1 ? 's' : ''} — post to Connect or assign staff`, tab: 'rota' });
  const noRate = activeStaff.filter(s => !s.hourly_rate);
  if (noRate.length > 0)
    actionCards.push({ icon: DollarSign, color: '#f59e0b', bg: '#fef9ec', text: `${noRate.length} staff member${noRate.length > 1 ? 's' : ''} missing hourly rate — needed for payroll`, tab: 'people' });
  if (expiredStaff > 0)
    actionCards.push({ icon: GraduationCap, color: '#ef4444', bg: '#fef2f2', text: `${expiredStaff} staff with expired training certification${expiredStaff > 1 ? 's' : ''}`, tab: 'people' });
  if (expiringStaff > 0)
    actionCards.push({ icon: GraduationCap, color: '#f59e0b', bg: '#fef9ec', text: `${expiringStaff} staff with training certification${expiringStaff > 1 ? 's' : ''} expiring within 30 days`, tab: 'people' });
  if (activeStaff.length === 0)
    actionCards.push({ icon: UserPlus, color: '#1f48ff', bg: '#f0f4ff', text: 'Add your first team member to get started', tab: 'people' });

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <div className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: s.bg }}>
                <s.icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <div className="text-xl font-black text-white">{loading ? '—' : s.value}</div>
                <div className="text-[11px] text-[rgba(153,197,255,0.5)] leading-tight">{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Action cards */}
        {actionCards.length > 0 && (
          <Card>
            <CardHeader title="Needs attention" />
            <div className="divide-y divide-[rgba(153,197,255,0.08)]">
              {actionCards.map((a, i) => (
                <button
                  key={i}
                  onClick={() => onTabChange(a.tab)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[rgba(153,197,255,0.05)] transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-[rgba(255,255,255,0.06)]">
                    <a.icon size={13} style={{ color: a.color }} />
                  </div>
                  <span className="text-xs text-[rgba(153,197,255,0.8)] flex-1">{a.text}</span>
                  <ArrowRight size={13} className="text-[rgba(153,197,255,0.3)] flex-shrink-0" />
                </button>
              ))}
              {actionCards.length === 0 && (
                <div className="px-5 py-4 flex items-center gap-2 text-xs text-[rgba(153,197,255,0.5)]">
                  <CheckCircle size={13} className="text-emerald-400" /> All clear
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Today's rota */}
        <Card>
          <CardHeader title="Today's jobs" subtitle={fmtDateShort(new Date())} />
          {loading ? (
            <div className="px-5 py-6 text-xs text-[rgba(153,197,255,0.5)]">Loading…</div>
          ) : todayJobs.length === 0 ? (
            <div className="px-5 py-6 text-xs text-[rgba(153,197,255,0.5)]">No jobs scheduled today</div>
          ) : (
            <div className="divide-y divide-[rgba(153,197,255,0.08)]">
              {todayJobs.slice(0, 6).map(j => {
                const sc = STATUS_COLOR[j.status] || STATUS_COLOR.scheduled;
                const names = j.assignees?.length > 0 ? j.assignees.join(', ') : j.assignee || 'Unassigned';
                return (
                  <div key={j.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{j.customer}</div>
                      <div className="text-[11px] text-[rgba(153,197,255,0.5)] truncate">{names} · {fmtHour(j.start_hour)}</div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: sc.bg, color: sc.text }}>
                      {j.status?.replace('_', ' ')}
                    </span>
                  </div>
                );
              })}
              {todayJobs.length > 6 && (
                <button onClick={() => onTabChange('rota')} className="w-full px-5 py-3 text-xs text-[#99c5ff] hover:bg-[rgba(153,197,255,0.06)] text-left">
                  +{todayJobs.length - 6} more → view rota
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Team snapshot */}
        <Card>
          <CardHeader
            title="Team"
            action={
              <button onClick={() => onTabChange('people')} className="text-xs text-[#1f48ff] font-semibold hover:underline">
                View all
              </button>
            }
          />
          {loading ? (
            <div className="px-5 py-6 text-xs text-[rgba(153,197,255,0.5)]">Loading…</div>
          ) : activeStaff.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-xs text-[rgba(153,197,255,0.5)] mb-3">No staff added yet</p>
              <button onClick={() => onTabChange('people')} className="text-xs text-[#99c5ff] font-semibold">
                Add your first team member →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(153,197,255,0.08)]">
              {activeStaff.slice(0, 5).map(s => (
                <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-[rgba(31,72,255,0.3)] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {(s.first_name?.[0] || '') + (s.last_name?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {[s.first_name, s.last_name].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-[11px] text-[rgba(153,197,255,0.5)]">{ROLE_LABELS[s.role] || s.role}</div>
                  </div>
                  {s.hourly_rate && (
                    <span className="text-[11px] text-[rgba(153,197,255,0.5)] flex-shrink-0">£{Number(s.hourly_rate).toFixed(0)}/hr</span>
                  )}
                </div>
              ))}
              {activeStaff.length > 5 && (
                <button onClick={() => onTabChange('people')} className="w-full px-5 py-3 text-xs text-[#99c5ff] hover:bg-[rgba(153,197,255,0.06)] text-left">
                  +{activeStaff.length - 5} more staff
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Sub-tab: PEOPLE ──────────────────────────────────────────────────────────

// ── Compliance helpers ────────────────────────────────────────────────────────

// ── Training cert types (cleaning-industry relevant) ──────────────────────────
const CERT_TYPES = [
  { key: 'coshh',           label: 'COSHH Awareness',            years: 2 },
  { key: 'manual_handling', label: 'Manual Handling',             years: 3 },
  { key: 'first_aid_faw',   label: 'First Aid at Work (FAW)',     years: 3 },
  { key: 'first_aid_efaw',  label: 'Emergency First Aid (EFAW)',  years: 1 },
  { key: 'fire_marshal',    label: 'Fire Marshal / Warden',       years: 3 },
  { key: 'working_height',  label: 'Working at Height',           years: 3 },
  { key: 'food_hygiene',    label: 'Food Hygiene Level 2',        years: 3 },
  { key: 'lone_worker',     label: 'Lone Worker Safety',          years: 2 },
  { key: 'asbestos',        label: 'Asbestos Awareness',          years: 1 },
  { key: 'ladder',          label: 'Ladder Safety',               years: 3 },
  { key: 'slip_trip',       label: 'Slip & Trip Prevention',      years: 2 },
  { key: 'ppe',             label: 'PPE Awareness',               years: 3 },
  { key: 'data_protection', label: 'Data Protection / GDPR',      years: 2 },
  { key: 'other',           label: 'Other certificate',           years: null },
];

function complianceStatus(s, trainingForStaff = []) {
  const today = new Date(); today.setHours(0,0,0,0);
  const in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  const rtwExpired   = s.rtw_expiry_date && new Date(s.rtw_expiry_date) < today;
  const dbsExpired   = s.dbs_expiry_date && new Date(s.dbs_expiry_date) < today;
  const trainExpired = trainingForStaff.some(t => t.expiry_date && new Date(t.expiry_date) < today);
  if (rtwExpired || dbsExpired || trainExpired) return 'expired';
  const rtwSoon   = s.rtw_expiry_date && new Date(s.rtw_expiry_date) <= in30;
  const dbsSoon   = s.dbs_expiry_date && new Date(s.dbs_expiry_date) <= in30;
  const trainSoon = trainingForStaff.some(t => t.expiry_date && new Date(t.expiry_date) > today && new Date(t.expiry_date) <= in30);
  if (rtwSoon || dbsSoon || trainSoon) return 'expiring';
  if (s.rtw_check_date) return 'compliant';
  return 'not_set';
}

const COMP_CFG = {
  compliant: { label: 'Compliant',     bg: 'bg-emerald-500/15', text: 'text-emerald-300', dot: 'bg-emerald-400', border: 'border border-emerald-500/25' },
  expiring:  { label: 'Expiring soon', bg: 'bg-amber-500/15',   text: 'text-amber-300',   dot: 'bg-amber-400',   border: 'border border-amber-500/25'   },
  expired:   { label: 'Action needed', bg: 'bg-red-500/15',     text: 'text-red-300',     dot: 'bg-red-400',     border: 'border border-red-500/25'     },
  not_set:   { label: 'Not recorded',  bg: 'bg-white/[0.08]',   text: 'text-[rgba(153,197,255,0.4)]', dot: 'bg-[rgba(153,197,255,0.3)]', border: 'border border-[rgba(153,197,255,0.12)]' },
};

function ComplianceBadge({ status }) {
  const c = COMP_CFG[status] || COMP_CFG.not_set;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}

const DBS_TYPES = { basic: 'Basic DBS', standard: 'Standard DBS', enhanced: 'Enhanced DBS' };
const RTW_DOC_TYPES = {
  uk_passport:  'UK Passport',
  eu_passport:  'EU/EEA Passport',
  brp:          'Biometric Residence Permit',
  share_code:   'Share Code',
  birth_cert:   'Birth Certificate + NI Letter',
  other:        'Other document',
};
const CONTRACT_TYPES = {
  employed:      'Employee',
  worker:        'Worker',
  zero_hours:    'Zero Hours Worker',
  self_employed: 'Self-Employed',
};

function fmtDateGB(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function countWorkingDays(startStr, endStr) {
  let count = 0;
  const cur = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr   + 'T00:00:00');
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d) - new Date()) / 86400000);
}

function DrawerRow({ label, value, valueClass = 'font-semibold text-white' }) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-[rgba(153,197,255,0.5)] flex-shrink-0">{label}</span>
      <span className={`text-right ${valueClass}`}>{value || '—'}</span>
    </div>
  );
}

function ExpiryRow({ label, date }) {
  const days    = daysUntil(date);
  const expired = days !== null && days < 0;
  const soon    = days !== null && days >= 0 && days <= 30;
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="text-[rgba(153,197,255,0.5)] flex-shrink-0">{label}</span>
      <span className={`text-right font-semibold ${expired ? 'text-red-300' : soon ? 'text-amber-300' : 'text-white'}`}>
        {fmtDateGB(date)}
        {expired && ' (expired)'}
        {!expired && soon && ` (${days}d left)`}
      </span>
    </div>
  );
}

// ─── TrainingModal ────────────────────────────────────────────────────────────
function TrainingModal({ staffMember, onSave, onClose }) {
  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-xs font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';

  const [form, setForm] = useState({ cert_type: '', obtained_date: '', expiry_date: '', notes: '' });
  const [saving, setSaving] = useState(false);

  function handleCertChange(key) {
    const cert = CERT_TYPES.find(c => c.key === key);
    const obtained = form.obtained_date;
    let expiry = '';
    if (cert?.years && obtained) {
      const d = new Date(obtained);
      d.setFullYear(d.getFullYear() + cert.years);
      expiry = d.toISOString().split('T')[0];
    }
    setForm(f => ({ ...f, cert_type: key, expiry_date: expiry }));
  }

  function handleObtainedChange(date) {
    const cert = CERT_TYPES.find(c => c.key === form.cert_type);
    let expiry = form.expiry_date;
    if (cert?.years && date) {
      const d = new Date(date);
      d.setFullYear(d.getFullYear() + cert.years);
      expiry = d.toISOString().split('T')[0];
    }
    setForm(f => ({ ...f, obtained_date: date, expiry_date: expiry }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.cert_type) { alert('Please select a certificate type'); return; }
    setSaving(true);
    const cert = CERT_TYPES.find(c => c.key === form.cert_type);
    await onSave({
      cert_type:     form.cert_type,
      cert_label:    cert?.label || form.cert_type,
      obtained_date: form.obtained_date,
      expiry_date:   form.expiry_date || null,
      notes:         form.notes || null,
    });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <h3 className="font-bold text-white">Add certification</h3>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{staffMember.first_name} {staffMember.last_name || ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[rgba(153,197,255,0.08)] rounded-lg transition-colors">
            <X size={16} className="text-[rgba(153,197,255,0.5)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={lbl}>Certificate type *</label>
            <select value={form.cert_type} onChange={e => handleCertChange(e.target.value)} className={inp} required>
              <option value="">Select certificate…</option>
              {CERT_TYPES.map(c => <option key={c.key} value={c.key}>{c.label}{c.years ? ` (renews every ${c.years}yr${c.years > 1 ? 's' : ''})` : ''}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Date obtained *</label>
              <input type="date" value={form.obtained_date}
                onChange={e => handleObtainedChange(e.target.value)}
                className={inp} required />
            </div>
            <div>
              <label className={lbl}>Expiry date</label>
              <input type="date" value={form.expiry_date}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                className={inp} />
              <p className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">Auto-set from cert type</p>
            </div>
          </div>
          <div>
            <label className={lbl}>Notes (optional)</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className={inp} placeholder="e.g. certificate number, provider" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-semibold rounded-xl hover:border-[rgba(153,197,255,0.3)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save certificate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const BLANK_COMP = {
  dbs_type: '', dbs_check_date: '', dbs_expiry_date: '',
  rtw_check_date: '', rtw_expiry_date: '', rtw_doc_type: '',
  contract_type: 'employed', contract_start_date: '',
  contracted_hours: '',
  emergency_contact_name: '', emergency_contact_phone: '',
  notes: '',
};

function StaffPeople({ staff, training, loading, onStaffChange, onTrainingChange }) {
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);
  const [filter, setFilter]             = useState('active');
  const [compFilter, setCompFilter]     = useState('all');
  const [showAdd, setShowAdd]           = useState(false);
  const [showComp, setShowComp]         = useState(false);
  const [adding, setAdding]             = useState(false);
  const [savingComp, setSavingComp]     = useState(false);
  const [savedOk, setSavedOk]           = useState(false);
  const [localUpdates, setLocalUpdates] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState({ rtw: false, dbs: false });
  const [form, setForm]                 = useState({
    first_name: '', last_name: '', role: 'cleaner',
    phone: '', email: '', hourly_rate: '', contracted_hours: '', pin_hash: '',
    contract_type: 'employed', contract_start_date: '',
  });
  const [compForm, setCompForm]         = useState(BLANK_COMP);
  const [formErr, setFormErr]           = useState('');
  const [showPayroll, setShowPayroll]   = useState(false);
  const [showTraining, setShowTraining] = useState(false);
  const { user }                        = useAuth();

  // Merge locally-saved compliance data into staff list for instant badge refresh
  const staffWithUpdates = useMemo(() =>
    staff.map(s => localUpdates[s.id] ? { ...s, ...localUpdates[s.id] } : s),
    [staff, localUpdates]
  );

  const baseFiltered = useMemo(() => staffWithUpdates.filter(s => {
    if (filter === 'active')   return s.is_active;
    if (filter === 'inactive') return !s.is_active;
    return true;
  }), [staffWithUpdates, filter]);

  const compCounts = useMemo(() => baseFiltered.reduce((acc, s) => {
    const st = complianceStatus(s, (training ?? []).filter(t => t.staff_id === s.id));
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {}), [baseFiltered, training]);

  const displayed = useMemo(() => {
    let base = baseFiltered;
    if (compFilter !== 'all') {
      base = base.filter(s => {
        const st = complianceStatus(s, (training ?? []).filter(t => t.staff_id === s.id));
        if (compFilter === 'needs_action') return st === 'expired' || st === 'not_set';
        return st === compFilter;
      });
    }
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(s =>
      [s.first_name, s.last_name, s.role, s.email, s.phone].join(' ').toLowerCase().includes(q)
    );
  }, [baseFiltered, compFilter, search]);

  function patchMember(id, patch) {
    setLocalUpdates(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
    if (selected?.id === id) setSelected(prev => ({ ...prev, ...patch }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.first_name.trim()) { setFormErr('First name required'); return; }
    if (form.pin_hash && !/^\d{4}$/.test(form.pin_hash)) { setFormErr('PIN must be exactly 4 digits'); return; }
    setAdding(true); setFormErr('');
    try {
      const { error } = await supabase.from('team_members').insert({
        business_id:          user.id,
        first_name:           form.first_name.trim(),
        last_name:            form.last_name.trim() || null,
        role:                 form.role,
        phone:                form.phone.trim() || null,
        email:                form.email.trim() || null,
        hourly_rate:          form.hourly_rate    ? parseFloat(form.hourly_rate)    : null,
        contracted_hours:     form.contracted_hours ? parseFloat(form.contracted_hours) : null,
        pin_hash:             form.pin_hash || null,
        contract_type:        form.contract_type || 'employed',
        contract_start_date:  form.contract_start_date || null,
        is_active:            true,
      });
      if (error) throw error;
      setForm({ first_name: '', last_name: '', role: 'cleaner', phone: '', email: '', hourly_rate: '', contracted_hours: '', pin_hash: '', contract_type: 'employed', contract_start_date: '' });
      setShowAdd(false);
      onStaffChange();
    } catch (err) { setFormErr(err.message); }
    finally { setAdding(false); }
  }

  function openCompModal(s) {
    setSavedOk(false);
    setCompForm({
      dbs_type:                  s.dbs_type                 || '',
      dbs_check_date:            s.dbs_check_date           || '',
      dbs_expiry_date:           s.dbs_expiry_date          || '',
      rtw_check_date:            s.rtw_check_date           || '',
      rtw_expiry_date:           s.rtw_expiry_date          || '',
      rtw_doc_type:              s.rtw_doc_type             || '',
      contract_type:             s.contract_type            || 'employed',
      contract_start_date:       s.contract_start_date      || '',
      contracted_hours:          s.contracted_hours != null  ? String(s.contracted_hours) : '',
      emergency_contact_name:    s.emergency_contact_name   || '',
      emergency_contact_phone:   s.emergency_contact_phone  || '',
      notes:                     s.notes                    || '',
    });
    setShowComp(true);
  }

  async function handleSaveCompliance(e) {
    e.preventDefault();
    setSavingComp(true);
    try {
      const payload = {
        dbs_type:                  compForm.dbs_type               || null,
        dbs_check_date:            compForm.dbs_check_date         || null,
        dbs_expiry_date:           compForm.dbs_expiry_date        || null,
        rtw_check_date:            compForm.rtw_check_date         || null,
        rtw_expiry_date:           compForm.rtw_expiry_date        || null,
        rtw_doc_type:              compForm.rtw_doc_type           || null,
        contract_type:             compForm.contract_type          || 'employed',
        contract_start_date:       compForm.contract_start_date    || null,
        contracted_hours:          compForm.contracted_hours ? parseFloat(compForm.contracted_hours) : null,
        emergency_contact_name:    compForm.emergency_contact_name  || null,
        emergency_contact_phone:   compForm.emergency_contact_phone || null,
        notes:                     compForm.notes                  || null,
      };
      const { error } = await supabase.from('team_members').update(payload).eq('id', selected.id);
      if (error) throw error;
      // Instant list + drawer update without waiting for parent re-fetch
      patchMember(selected.id, payload);
      setSavedOk(true);
      setTimeout(() => { setShowComp(false); setSavedOk(false); onStaffChange(); }, 1000);
    } catch (err) { alert(err.message); }
    finally { setSavingComp(false); }
  }

  async function handleSavePayroll(staffId, payload) {
    const { error } = await supabase.from('team_members').update(payload).eq('id', staffId);
    if (error) throw error;
    patchMember(staffId, payload);
    setShowPayroll(false);
    onStaffChange();
  }

  async function handleSaveTraining(payload) {
    if (!selected || !user) return;
    const { error } = await supabase.from('staff_training').insert({
      business_id:   user.id,
      staff_id:      selected.id,
      ...payload,
    });
    if (error) { alert(error.message); return; }
    setShowTraining(false);
    onTrainingChange?.();
  }

  async function handleDeleteTraining(id) {
    if (!window.confirm('Remove this certification record?')) return;
    const { error } = await supabase.from('staff_training').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    onTrainingChange?.();
  }

  async function handleUploadDoc(type, file) {
    if (!selected) return;
    setUploadingDoc(prev => ({ ...prev, [type]: true }));
    try {
      const ext  = file.name.split('.').pop().toLowerCase();
      const path = `${user.id}/${selected.id}/${type}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('staff-docs').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const col = type === 'rtw' ? 'rtw_doc_path' : 'dbs_doc_path';
      const { error: dbErr } = await supabase.from('team_members').update({ [col]: path }).eq('id', selected.id);
      if (dbErr) throw dbErr;
      patchMember(selected.id, { [col]: path });
    } catch (err) { alert('Upload failed: ' + err.message); }
    finally { setUploadingDoc(prev => ({ ...prev, [type]: false })); }
  }

  async function handleRemoveDoc(type) {
    if (!selected) return;
    const col  = type === 'rtw' ? 'rtw_doc_path' : 'dbs_doc_path';
    const path = selected[col];
    if (!path) return;
    try {
      await supabase.storage.from('staff-docs').remove([path]);
      await supabase.from('team_members').update({ [col]: null }).eq('id', selected.id);
      patchMember(selected.id, { [col]: null });
    } catch (err) { alert('Remove failed: ' + err.message); }
  }

  async function handleViewDoc(path) {
    const { data, error } = await supabase.storage.from('staff-docs').createSignedUrl(path, 3600);
    if (error) { alert('Could not open document: ' + error.message); return; }
    window.open(data.signedUrl, '_blank');
  }

  async function handleToggleActive(s) {
    await supabase.from('team_members').update({ is_active: !s.is_active }).eq('id', s.id);
    patchMember(s.id, { is_active: !s.is_active });
    onStaffChange();
  }

  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';
  const needsActionCount = (compCounts.expired || 0) + (compCounts.not_set || 0);

  return (
    <div className="flex gap-4 h-full">

      {/* ── List panel ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">

        {/* Compliance summary strip */}
        {staff.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'all',          label: 'All staff',     count: baseFiltered.length,      activeBg: 'bg-[#1f48ff]',        inactiveBg: 'bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)]', countColor: 'text-white'        },
              { key: 'compliant',    label: 'Compliant',     count: compCounts.compliant || 0, activeBg: 'bg-emerald-600',      inactiveBg: 'bg-emerald-500/10 border border-emerald-500/20',                     countColor: 'text-emerald-300'  },
              { key: 'expiring',     label: 'Expiring soon', count: compCounts.expiring  || 0, activeBg: 'bg-amber-500',        inactiveBg: 'bg-amber-500/10 border border-amber-500/20',                         countColor: 'text-amber-300'    },
              { key: 'needs_action', label: 'Needs action',  count: needsActionCount,          activeBg: 'bg-red-600',          inactiveBg: 'bg-red-500/10 border border-red-500/20',                             countColor: 'text-red-300'      },
            ].map(({ key, label, count, activeBg, inactiveBg, countColor }) => {
              const active = compFilter === key;
              return (
                <button key={key} onClick={() => setCompFilter(key)}
                  className={`rounded-xl p-3 text-left transition-all ${active ? `${activeBg} shadow-sm` : inactiveBg}`}>
                  <div className={`text-xl font-bold ${active ? 'text-white' : countColor}`}>{count}</div>
                  <div className={`text-[11px] mt-0.5 ${active ? 'text-white/80' : 'text-[rgba(153,197,255,0.5)]'}`}>{label}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(153,197,255,0.4)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search staff…"
              className="w-full pl-8 pr-3 py-2 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors" />
          </div>
          <div className="flex rounded-xl border border-[rgba(153,197,255,0.15)] overflow-hidden text-xs">
            {['active','inactive','all'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-2 capitalize transition-colors ${filter === f ? 'bg-[#1f48ff] text-white' : 'text-[rgba(153,197,255,0.5)] hover:bg-[rgba(153,197,255,0.06)]'}`}>
                {f}
              </button>
            ))}
          </div>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-semibold rounded-xl transition-colors">
            <Plus size={13} /> Add staff
          </button>
        </div>

        <Card>
          {loading ? (
            <div className="px-5 py-8 text-center text-xs text-[rgba(153,197,255,0.5)]">Loading staff…</div>
          ) : displayed.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[rgba(153,197,255,0.5)] mb-3">
                {search ? 'No staff match your search'
                  : compFilter !== 'all' ? 'No staff in this compliance group'
                  : filter === 'active' ? 'No active staff yet' : 'No staff'}
              </p>
              {!search && compFilter === 'all' && filter === 'active' && (
                <button onClick={() => setShowAdd(true)} className="text-xs text-[#99c5ff] font-semibold">
                  Add your first team member →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[rgba(153,197,255,0.08)]">
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 bg-[rgba(153,197,255,0.06)] text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">
                <div className="col-span-4">Name</div>
                <div className="col-span-2">Role</div>
                <div className="col-span-2">Rate</div>
                <div className="col-span-2">Contract</div>
                <div className="col-span-2">Compliance</div>
              </div>
              {displayed.map(s => {
                const name     = [s.first_name, s.last_name].filter(Boolean).join(' ');
                const initials = (s.first_name?.[0] || '') + (s.last_name?.[0] || '');
                const cStatus  = complianceStatus(s, (training ?? []).filter(t => t.staff_id === s.id));
                return (
                  <button key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
                    className={`w-full grid grid-cols-12 gap-2 px-5 py-3 text-left hover:bg-[rgba(153,197,255,0.05)] transition-colors ${selected?.id === s.id ? 'bg-[rgba(31,72,255,0.12)]' : ''}`}>
                    <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 ${s.is_active ? 'bg-[rgba(31,72,255,0.4)]' : 'bg-[rgba(153,197,255,0.12)]'}`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">{name}</div>
                        {s.email && <div className="text-[10px] text-[rgba(153,197,255,0.5)] truncate">{s.email}</div>}
                        {!s.is_active && <span className="text-[10px] text-[rgba(153,197,255,0.4)]">Inactive</span>}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-[11px] text-[rgba(153,197,255,0.6)] capitalize">{ROLE_LABELS[s.role] || s.role}</span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-[11px] text-[rgba(153,197,255,0.6)]">
                        {s.hourly_rate ? `£${Number(s.hourly_rate).toFixed(2)}/hr` : '—'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <span className="text-[11px] text-[rgba(153,197,255,0.6)]">{CONTRACT_TYPES[s.contract_type] || '—'}</span>
                    </div>
                    <div className="col-span-2 flex items-center">
                      <ComplianceBadge status={cStatus} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Profile drawer ──────────────────────────────────────────────────── */}
      {selected && (
        <div className="w-80 flex-shrink-0">
          <Card>
            <div className="px-5 py-3.5 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <span className="font-bold text-white text-sm">Staff record</span>
              <button onClick={() => setSelected(null)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={14} /></button>
            </div>
            <div className="p-5 space-y-5 overflow-y-auto max-h-[calc(100vh-200px)]">

              {/* Avatar */}
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-base font-bold flex-shrink-0 ${selected.is_active ? 'bg-[rgba(31,72,255,0.4)]' : 'bg-[rgba(153,197,255,0.12)]'}`}>
                  {(selected.first_name?.[0] || '') + (selected.last_name?.[0] || '')}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{[selected.first_name, selected.last_name].filter(Boolean).join(' ')}</div>
                  <div className="text-xs text-[rgba(153,197,255,0.5)] capitalize">{ROLE_LABELS[selected.role] || selected.role}</div>
                  <div className="mt-1"><ComplianceBadge status={complianceStatus(selected, (training ?? []).filter(t => t.staff_id === selected.id))} /></div>
                </div>
              </div>

              {/* Contact */}
              <section className="space-y-2">
                <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Contact</div>
                {selected.phone
                  ? <div className="flex items-center gap-2 text-xs text-[rgba(153,197,255,0.8)]"><Phone size={11} className="text-[rgba(153,197,255,0.4)] flex-shrink-0" />{selected.phone}</div>
                  : <p className="text-xs text-[rgba(153,197,255,0.3)] italic">No phone added</p>}
                {selected.email
                  ? <div className="flex items-center gap-2 text-xs text-[rgba(153,197,255,0.8)] break-all"><Mail size={11} className="text-[rgba(153,197,255,0.4)] flex-shrink-0" />{selected.email}</div>
                  : <p className="text-xs text-[rgba(153,197,255,0.3)] italic">No email added</p>}
              </section>

              {/* Employment */}
              <section className="space-y-2">
                <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Employment</div>
                <DrawerRow label="Contract"        value={CONTRACT_TYPES[selected.contract_type] || '—'} />
                <DrawerRow label="Started"         value={fmtDateGB(selected.contract_start_date) || '—'} />
                <DrawerRow label="Rate"            value={selected.hourly_rate ? `£${Number(selected.hourly_rate).toFixed(2)}/hr` : '—'} />
                <DrawerRow label="Contracted hrs"  value={selected.contracted_hours ? `${selected.contracted_hours} hrs/wk` : '—'} />
                <DrawerRow label="Status"          value={selected.is_active ? 'Active' : 'Inactive'} valueClass={`font-semibold ${selected.is_active ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.4)]'}`} />
                {selected.pin_hash && <DrawerRow label="Staff app PIN" value="Set ✓" valueClass="font-semibold text-emerald-400" />}
              </section>

              {/* Right to Work */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Right to Work</div>
                  {!selected.rtw_check_date && (
                    <span className="text-[10px] text-red-400 font-semibold">Legally required</span>
                  )}
                </div>
                {selected.rtw_check_date ? (
                  <>
                    <DrawerRow label="Document" value={RTW_DOC_TYPES[selected.rtw_doc_type] || selected.rtw_doc_type || '—'} />
                    <DrawerRow label="Checked"  value={fmtDateGB(selected.rtw_check_date)} />
                    {selected.rtw_expiry_date
                      ? <ExpiryRow label="Expires" date={selected.rtw_expiry_date} />
                      : <DrawerRow label="Expires" value="No expiry" valueClass="font-semibold text-emerald-400" />}
                    {selected.rtw_doc_path && (
                      <button onClick={() => handleViewDoc(selected.rtw_doc_path)}
                        className="flex items-center gap-1.5 text-[11px] text-[#99c5ff] font-medium hover:underline">
                        <FileText size={11} /> View RTW document
                      </button>
                    )}
                  </>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-[11px] text-red-300 leading-relaxed">
                    Not recorded. Click "Update compliance record" below to add it.
                  </div>
                )}
              </section>

              {/* DBS Check */}
              <section className="space-y-2">
                <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">DBS Check</div>
                {selected.dbs_check_date ? (
                  <>
                    <DrawerRow label="Type"      value={DBS_TYPES[selected.dbs_type] || selected.dbs_type || '—'} />
                    <DrawerRow label="Obtained"  value={fmtDateGB(selected.dbs_check_date)} />
                    {selected.dbs_expiry_date
                      ? <ExpiryRow label="Review by" date={selected.dbs_expiry_date} />
                      : <DrawerRow label="Review by" value="Not set" valueClass="text-[rgba(153,197,255,0.4)]" />}
                    {selected.dbs_doc_path && (
                      <button onClick={() => handleViewDoc(selected.dbs_doc_path)}
                        className="flex items-center gap-1.5 text-[11px] text-[#99c5ff] font-medium hover:underline">
                        <FileText size={11} /> View DBS certificate
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-[rgba(153,197,255,0.4)] italic">Not recorded — add if required for this role</p>
                )}
              </section>

              {/* Emergency contact */}
              {(selected.emergency_contact_name || selected.emergency_contact_phone) && (
                <section className="space-y-2">
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Emergency contact</div>
                  {selected.emergency_contact_name  && <DrawerRow label="Name"  value={selected.emergency_contact_name} />}
                  {selected.emergency_contact_phone && <DrawerRow label="Phone" value={selected.emergency_contact_phone} />}
                </section>
              )}

              {/* Training & Certifications */}
              {(() => {
                const todayStr = toISO(new Date());
                const in30Str  = toISO(addDays(new Date(), 30));
                const certs    = (training ?? []).filter(t => t.staff_id === selected.id)
                  .sort((a, b) => (a.expiry_date ?? '9999') > (b.expiry_date ?? '9999') ? 1 : -1);
                return (
                  <section className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Training & Certifications</div>
                      <button onClick={() => setShowTraining(true)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-[#99c5ff] hover:opacity-80 transition-opacity">
                        <Plus size={11} /> Add
                      </button>
                    </div>
                    {certs.length === 0 ? (
                      <p className="text-[11px] text-[rgba(153,197,255,0.4)] italic">No certifications recorded</p>
                    ) : (
                      <div className="space-y-1.5">
                        {certs.map(t => {
                          const expired = t.expiry_date && t.expiry_date < todayStr;
                          const soon    = t.expiry_date && !expired && t.expiry_date <= in30Str;
                          return (
                            <div key={t.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-[rgba(153,197,255,0.08)] last:border-0">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-white truncate">{t.cert_label}</p>
                                <p className={`text-[10px] mt-0.5 ${expired ? 'text-red-400 font-semibold' : soon ? 'text-amber-400 font-medium' : 'text-[rgba(153,197,255,0.5)]'}`}>
                                  {t.expiry_date
                                    ? `${expired ? 'Expired' : 'Expires'} ${fmtDateGB(t.expiry_date)}`
                                    : `Obtained ${fmtDateGB(t.obtained_date)} · No expiry`}
                                </p>
                              </div>
                              <button onClick={() => handleDeleteTraining(t.id)}
                                className="p-1 hover:bg-red-500/10 rounded text-[rgba(153,197,255,0.3)] hover:text-red-400 transition-colors flex-shrink-0">
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* Notes */}
              {selected.notes && (
                <section className="space-y-1">
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Notes</div>
                  <p className="text-xs text-[rgba(153,197,255,0.8)] leading-relaxed">{selected.notes}</p>
                </section>
              )}

              {/* Payroll */}
              {(selected.ni_number || selected.tax_code) && (
                <section className="space-y-2">
                  <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Payroll</div>
                  {selected.ni_number && (
                    <DrawerRow label="NI Number" value={`${selected.ni_number.slice(0,2)}•••••${selected.ni_number.slice(-1)}`} />
                  )}
                  <DrawerRow label="Tax code"    value={selected.tax_code || '1257L'} />
                  <DrawerRow label="NI category" value={selected.ni_category || 'A'} />
                  {selected.date_of_birth && <DrawerRow label="Date of birth" value={fmtDateGB(selected.date_of_birth)} />}
                </section>
              )}

              {/* Actions */}
              <div className="space-y-2 pt-1">
                <button onClick={() => openCompModal(selected)}
                  className="w-full py-2 rounded-xl bg-[rgba(153,197,255,0.08)] hover:bg-[rgba(153,197,255,0.14)] text-[#99c5ff] text-xs font-semibold border border-[rgba(153,197,255,0.15)] transition-colors flex items-center justify-center gap-2">
                  <ShieldCheck size={13} />
                  {selected.rtw_check_date ? 'Update compliance record' : 'Record compliance details'}
                </button>
                <button onClick={() => setShowPayroll(true)}
                  className="w-full py-2 rounded-xl bg-[rgba(153,197,255,0.08)] hover:bg-[rgba(153,197,255,0.14)] text-[#99c5ff] text-xs font-semibold border border-[rgba(153,197,255,0.15)] transition-colors flex items-center justify-center gap-2">
                  <DollarSign size={13} />
                  {selected.ni_number ? 'Update payroll details' : 'Add payroll details'}
                </button>
                <button onClick={() => handleToggleActive(selected)}
                  className={`w-full py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    selected.is_active ? 'bg-red-500/10 text-red-300 border-red-500/25 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                  }`}>
                  {selected.is_active ? 'Mark as inactive' : 'Reactivate'}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Add staff modal ─────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <h3 className="font-bold text-white">Add team member</h3>
              <button onClick={() => setShowAdd(false)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>First name *</label>
                  <input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} className={inp} placeholder="Sarah" required />
                </div>
                <div>
                  <label className={lbl}>Last name</label>
                  <input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} className={inp} placeholder="Mitchell" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Role</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className={inp}>
                    <option value="cleaner">Cleaner</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Contract type</label>
                  <select value={form.contract_type} onChange={e => setForm(f => ({ ...f, contract_type: e.target.value }))} className={inp}>
                    <option value="employed">Employee</option>
                    <option value="worker">Worker</option>
                    <option value="zero_hours">Zero Hours Worker</option>
                    <option value="self_employed">Self-Employed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Start date</label>
                  <input value={form.contract_start_date} onChange={e => setForm(f => ({ ...f, contract_start_date: e.target.value }))} className={inp} type="date" />
                </div>
                <div>
                  <label className={lbl}>Hourly rate (£)</label>
                  <input value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} className={inp} placeholder="12.21" type="number" step="0.01" min="0" />
                </div>
              </div>
              <div>
                <label className={lbl}>Contracted hours / week</label>
                <input value={form.contracted_hours} onChange={e => setForm(f => ({ ...f, contracted_hours: e.target.value }))} className={inp} placeholder="e.g. 20 or 37.5" type="number" step="0.5" min="0" max="168" />
                <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-1">Used to auto-calculate holiday entitlement in hours</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} placeholder="07700 900000" />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} placeholder="sarah@example.com" type="email" />
                </div>
              </div>
              <div>
                <label className={lbl}>Staff app PIN (4 digits)</label>
                <input value={form.pin_hash} onChange={e => setForm(f => ({ ...f, pin_hash: e.target.value }))} className={inp} placeholder="1234" maxLength={4} pattern="\d{4}" />
                <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-1">Staff use this to log into the Cadi team app</p>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
              <button type="submit" disabled={adding}
                className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {adding ? 'Adding…' : 'Add team member'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Compliance record modal ─────────────────────────────────────────── */}
      {showPayroll && selected && (
        <PayrollDetailsModal
          staff={selected}
          onSave={handleSavePayroll}
          onClose={() => setShowPayroll(false)}
        />
      )}

      {showTraining && selected && (
        <TrainingModal
          staffMember={selected}
          onSave={handleSaveTraining}
          onClose={() => setShowTraining(false)}
        />
      )}

      {showComp && selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowComp(false)}>
          <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Compliance record</h3>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{[selected.first_name, selected.last_name].filter(Boolean).join(' ')}</p>
              </div>
              <button onClick={() => setShowComp(false)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
            </div>

            {/* Status bar — what makes the badge go green */}
            <div className="px-6 py-3 bg-[rgba(153,197,255,0.04)] border-b border-[rgba(153,197,255,0.08)] flex items-center gap-3 text-[11px]">
              <span className={`flex items-center gap-1 font-medium ${compForm.rtw_check_date ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.4)]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${compForm.rtw_check_date ? 'bg-emerald-400' : 'bg-[rgba(153,197,255,0.2)]'}`} />
                RTW checked
              </span>
              <span className={`flex items-center gap-1 font-medium ${compForm.dbs_type ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.4)]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${compForm.dbs_type ? 'bg-emerald-400' : 'bg-[rgba(153,197,255,0.2)]'}`} />
                DBS
              </span>
              <span className={`flex items-center gap-1 font-medium ${compForm.emergency_contact_name ? 'text-emerald-400' : 'text-[rgba(153,197,255,0.4)]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${compForm.emergency_contact_name ? 'bg-emerald-400' : 'bg-[rgba(153,197,255,0.2)]'}`} />
                Emergency contact
              </span>
              <span className="ml-auto text-[rgba(153,197,255,0.4)]">Fill in RTW date to go green</span>
            </div>

            <form onSubmit={handleSaveCompliance} className="p-6 space-y-6">

              {/* Right to Work */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-[#99c5ff]" />
                  <h4 className="font-semibold text-white text-sm">Right to Work</h4>
                  <span className="text-[10px] bg-[rgba(31,72,255,0.15)] text-[#99c5ff] px-1.5 py-0.5 rounded-full font-medium border border-[rgba(31,72,255,0.25)]">Legally required</span>
                </div>
                <div>
                  <label className={lbl}>What document did you check?</label>
                  <select value={compForm.rtw_doc_type} onChange={e => setCompForm(f => ({ ...f, rtw_doc_type: e.target.value }))} className={inp}>
                    <option value="">Select document…</option>
                    {Object.entries(RTW_DOC_TYPES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Date you checked it</label>
                    <input value={compForm.rtw_check_date} onChange={e => setCompForm(f => ({ ...f, rtw_check_date: e.target.value }))} className={inp} type="date" />
                  </div>
                  <div>
                    <label className={lbl}>Document expiry (if any)</label>
                    <input value={compForm.rtw_expiry_date} onChange={e => setCompForm(f => ({ ...f, rtw_expiry_date: e.target.value }))} className={inp} type="date" />
                    <p className="text-[10px] text-[rgba(153,197,255,0.5)] mt-1">UK/Irish passport — leave blank</p>
                  </div>
                </div>
                {/* RTW document upload */}
                <div>
                  <label className={lbl}>Upload document (photo or PDF)</label>
                  {selected.rtw_doc_path ? (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
                      <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-emerald-300 flex-1 truncate">{selected.rtw_doc_path.split('/').pop()}</span>
                      <button type="button" onClick={() => handleViewDoc(selected.rtw_doc_path)} className="text-xs text-[#99c5ff] font-medium">View</button>
                      <button type="button" onClick={() => handleRemoveDoc('rtw')} className="text-xs text-red-400 font-medium ml-1">Remove</button>
                    </div>
                  ) : (
                    <label className={`flex items-center gap-2 px-3 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingDoc.rtw ? 'border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.04)]' : 'border-[rgba(153,197,255,0.15)] hover:border-[#99c5ff]/40 hover:bg-[rgba(153,197,255,0.06)]'}`}>
                      {uploadingDoc.rtw
                        ? <><RefreshCw size={12} className="text-[rgba(153,197,255,0.4)] animate-spin" /><span className="text-xs text-[rgba(153,197,255,0.4)]">Uploading…</span></>
                        : <><Plus size={12} className="text-[rgba(153,197,255,0.4)]" /><span className="text-xs text-[rgba(153,197,255,0.5)]">Upload passport, BRP, or other RTW document</span></>}
                      <input type="file" className="sr-only" accept="image/*,.pdf" disabled={uploadingDoc.rtw}
                        onChange={e => e.target.files?.[0] && handleUploadDoc('rtw', e.target.files[0])} />
                    </label>
                  )}
                </div>
              </div>

              <div className="border-t border-[rgba(153,197,255,0.08)]" />

              {/* DBS Check */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-[#99c5ff]" />
                  <h4 className="font-semibold text-white text-sm">DBS Check</h4>
                  <span className="text-[10px] bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.5)] px-1.5 py-0.5 rounded-full font-medium border border-[rgba(153,197,255,0.15)]">If required for this role</span>
                </div>
                <div>
                  <label className={lbl}>DBS type</label>
                  <select value={compForm.dbs_type} onChange={e => setCompForm(f => ({ ...f, dbs_type: e.target.value }))} className={inp}>
                    <option value="">No DBS required for this role</option>
                    <option value="basic">Basic DBS — general cleaning</option>
                    <option value="standard">Standard DBS — supervisory roles</option>
                    <option value="enhanced">Enhanced DBS — schools, healthcare, care homes</option>
                  </select>
                </div>
                {compForm.dbs_type && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={lbl}>Date obtained</label>
                        <input value={compForm.dbs_check_date} onChange={e => setCompForm(f => ({ ...f, dbs_check_date: e.target.value }))} className={inp} type="date" />
                      </div>
                      <div>
                        <label className={lbl}>Review by date</label>
                        <input value={compForm.dbs_expiry_date} onChange={e => setCompForm(f => ({ ...f, dbs_expiry_date: e.target.value }))} className={inp} type="date" />
                        <p className="text-[10px] text-[rgba(153,197,255,0.5)] mt-1">Typically every 3 years</p>
                      </div>
                    </div>
                    {/* DBS document upload */}
                    <div>
                      <label className={lbl}>Upload certificate (photo or PDF)</label>
                      {selected.dbs_doc_path ? (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
                          <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                          <span className="text-xs text-emerald-300 flex-1 truncate">{selected.dbs_doc_path.split('/').pop()}</span>
                          <button type="button" onClick={() => handleViewDoc(selected.dbs_doc_path)} className="text-xs text-[#99c5ff] font-medium">View</button>
                          <button type="button" onClick={() => handleRemoveDoc('dbs')} className="text-xs text-red-400 font-medium ml-1">Remove</button>
                        </div>
                      ) : (
                        <label className={`flex items-center gap-2 px-3 py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingDoc.dbs ? 'border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.04)]' : 'border-[rgba(153,197,255,0.15)] hover:border-[#99c5ff]/40 hover:bg-[rgba(153,197,255,0.06)]'}`}>
                          {uploadingDoc.dbs
                            ? <><RefreshCw size={12} className="text-[rgba(153,197,255,0.4)] animate-spin" /><span className="text-xs text-[rgba(153,197,255,0.4)]">Uploading…</span></>
                            : <><Plus size={12} className="text-[rgba(153,197,255,0.4)]" /><span className="text-xs text-[rgba(153,197,255,0.5)]">Upload DBS certificate</span></>}
                          <input type="file" className="sr-only" accept="image/*,.pdf" disabled={uploadingDoc.dbs}
                            onChange={e => e.target.files?.[0] && handleUploadDoc('dbs', e.target.files[0])} />
                        </label>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-[rgba(153,197,255,0.08)]" />

              {/* Employment */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-[#99c5ff]" />
                  <h4 className="font-semibold text-white text-sm">Employment</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Contract type</label>
                    <select value={compForm.contract_type} onChange={e => setCompForm(f => ({ ...f, contract_type: e.target.value }))} className={inp}>
                      <option value="employed">Employee</option>
                      <option value="worker">Worker</option>
                      <option value="zero_hours">Zero Hours Worker</option>
                      <option value="self_employed">Self-Employed</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Start date</label>
                    <input value={compForm.contract_start_date} onChange={e => setCompForm(f => ({ ...f, contract_start_date: e.target.value }))} className={inp} type="date" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Contracted hours / week</label>
                  <input value={compForm.contracted_hours} onChange={e => setCompForm(f => ({ ...f, contracted_hours: e.target.value }))} className={inp} placeholder="e.g. 20 or 37.5" type="number" step="0.5" min="0" max="168" />
                  <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-1">Used to auto-calculate holiday entitlement in hours</p>
                </div>
              </div>

              <div className="border-t border-[rgba(153,197,255,0.08)]" />

              {/* Emergency contact */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-[#99c5ff]" />
                  <h4 className="font-semibold text-white text-sm">Emergency contact</h4>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Name</label>
                    <input value={compForm.emergency_contact_name} onChange={e => setCompForm(f => ({ ...f, emergency_contact_name: e.target.value }))} className={inp} placeholder="Jane Mitchell" />
                  </div>
                  <div>
                    <label className={lbl}>Phone</label>
                    <input value={compForm.emergency_contact_phone} onChange={e => setCompForm(f => ({ ...f, emergency_contact_phone: e.target.value }))} className={inp} placeholder="07700 900000" />
                  </div>
                </div>
              </div>

              <div className="border-t border-[rgba(153,197,255,0.08)]" />

              {/* Notes */}
              <div>
                <label className={lbl}>Notes</label>
                <textarea value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))}
                  className={`${inp} resize-none`} rows={3} placeholder="Any additional notes about this team member…" />
              </div>

              <button type="submit" disabled={savingComp || savedOk}
                className={`w-full py-2.5 text-sm font-semibold rounded-xl transition-all ${
                  savedOk
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white disabled:opacity-50'
                }`}>
                {savedOk ? '✓ Saved — compliance updated' : savingComp ? 'Saving…' : 'Save compliance record'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: ROTA ────────────────────────────────────────────────────────────

const ABSENCE_TYPES = {
  holiday:  { label: 'Holiday',  bg: 'rgba(31,72,255,0.15)',   text: '#99c5ff',              border: 'rgba(31,72,255,0.3)'    },
  sick:     { label: 'Sick',     bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5',              border: 'rgba(239,68,68,0.3)'    },
  training: { label: 'Training', bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7',              border: 'rgba(16,185,129,0.3)'   },
  unpaid:   { label: 'Unpaid',   bg: 'rgba(153,197,255,0.08)', text: 'rgba(153,197,255,0.5)', border: 'rgba(153,197,255,0.15)' },
  other:    { label: 'Other',    bg: 'rgba(168,85,247,0.15)',  text: '#d8b4fe',              border: 'rgba(168,85,247,0.3)'   },
};

// ─── Payroll details modal ────────────────────────────────────────────────────

const NI_CATEGORIES = [
  { value: 'A', label: 'A — Standard (most employees)' },
  { value: 'B', label: 'B — Married women / widows (reduced rate)' },
  { value: 'C', label: 'C — Over state pension age' },
  { value: 'H', label: 'H — Apprentice under 25' },
  { value: 'M', label: 'M — Employee under 21' },
  { value: 'J', label: 'J — Deferment' },
  { value: 'Z', label: 'Z — Under 21, deferment' },
];

function PayrollDetailsModal({ staff, onSave, onClose }) {
  const [form, setForm] = useState({
    ni_number:        staff.ni_number        || '',
    date_of_birth:    staff.date_of_birth    || '',
    gender:           staff.gender           || '',
    address_line1:    staff.address_line1    || '',
    address_postcode: staff.address_postcode || '',
    tax_code:         staff.tax_code         || '1257L',
    ni_category:      staff.ni_category      || 'A',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');
  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await onSave(staff.id, {
        ni_number:        form.ni_number.toUpperCase().trim() || null,
        date_of_birth:    form.date_of_birth || null,
        gender:           form.gender || null,
        address_line1:    form.address_line1.trim() || null,
        address_postcode: form.address_postcode.toUpperCase().trim() || null,
        tax_code:         form.tax_code.toUpperCase().trim() || '1257L',
        ni_category:      form.ni_category || 'A',
      });
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">Payroll details</h3>
            <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{[staff.first_name, staff.last_name].filter(Boolean).join(' ')}</p>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>NI Number</label>
              <input value={form.ni_number} onChange={e => setForm(f => ({ ...f, ni_number: e.target.value }))}
                className={`${inp} uppercase`} placeholder="AB123456C" maxLength={9} />
            </div>
            <div>
              <label className={lbl}>Date of birth</label>
              <input value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                className={inp} type="date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Gender</label>
              <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} className={inp}>
                <option value="">Not specified</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="U">Prefer not to say</option>
              </select>
            </div>
            <div>
              <label className={lbl}>Tax code</label>
              <input value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))}
                className={`${inp} uppercase`} placeholder="1257L" />
            </div>
          </div>
          <div>
            <label className={lbl}>NI Category</label>
            <select value={form.ni_category} onChange={e => setForm(f => ({ ...f, ni_category: e.target.value }))} className={inp}>
              {NI_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Address line 1</label>
            <input value={form.address_line1} onChange={e => setForm(f => ({ ...f, address_line1: e.target.value }))}
              className={inp} placeholder="1 High Street" />
          </div>
          <div>
            <label className={lbl}>Postcode</label>
            <input value={form.address_postcode} onChange={e => setForm(f => ({ ...f, address_postcode: e.target.value }))}
              className={`${inp} uppercase`} placeholder="SW1A 1AA" />
          </div>
          <div className="bg-[rgba(31,72,255,0.12)] border border-[rgba(31,72,255,0.25)] rounded-xl p-3 text-[11px] text-[#99c5ff] leading-relaxed">
            NI number and address are required for HMRC RTI payroll submission. Tax code defaults to 1257L (standard personal allowance).
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save payroll details'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Work pattern ──────────────────────────────────────────────────────────────

const DAY_ORDER = ['1','2','3','4','5','6','0']; // Mon → Sun
const DAY_FULL  = { '1':'Monday','2':'Tuesday','3':'Wednesday','4':'Thursday','5':'Friday','6':'Saturday','0':'Sunday' };
const DEFAULT_WORK_PATTERN = {
  '1':{ start:'08:00', end:'17:00' }, '2':{ start:'08:00', end:'17:00' },
  '3':{ start:'08:00', end:'17:00' }, '4':{ start:'08:00', end:'17:00' },
  '5':{ start:'08:00', end:'17:00' }, '6':null, '0':null,
};

function WorkPatternModal({ staff, onSave, onClose }) {
  const [pattern, setPattern] = useState(() => {
    const base = staff.work_pattern ?? DEFAULT_WORK_PATTERN;
    const full = {};
    DAY_ORDER.forEach(k => { full[k] = base[k] ?? null; });
    return full;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  const toggleDay = (key) =>
    setPattern(prev => ({ ...prev, [key]: prev[key] ? null : { start: '08:00', end: '17:00' } }));

  const setTime = (key, field, val) =>
    setPattern(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

  async function handleSave() {
    setSaving(true); setErr('');
    try { await onSave(staff.id, pattern); }
    catch (e) { setErr(e.message); setSaving(false); }
  }

  const tinp = 'px-2 py-1 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-lg text-xs text-white focus:outline-none focus:border-[#99c5ff] transition-colors w-[78px]';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(153,197,255,0.08)]">
          <div>
            <div className="font-bold text-white text-sm">Work pattern</div>
            <div className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{staff.first_name} {staff.last_name || ''}</div>
          </div>
          <button onClick={onClose} className="text-[rgba(153,197,255,0.5)] hover:text-white transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 pt-4 pb-2 space-y-1.5">
          {DAY_ORDER.map(key => {
            const day   = pattern[key];
            const works = !!day;
            return (
              <div key={key} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${works ? 'bg-[rgba(153,197,255,0.06)]' : 'opacity-40'}`}>
                <button
                  onClick={() => toggleDay(key)}
                  className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${works ? 'bg-[#1f48ff]' : 'bg-[rgba(153,197,255,0.2)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${works ? 'right-0.5' : 'left-0.5'}`} />
                </button>
                <span className="text-xs font-semibold text-white w-[76px] flex-shrink-0">{DAY_FULL[key]}</span>
                {works ? (
                  <div className="flex items-center gap-1.5 flex-1">
                    <input type="time" value={day.start} onChange={e => setTime(key, 'start', e.target.value)} className={tinp} />
                    <span className="text-[10px] text-[rgba(153,197,255,0.5)]">–</span>
                    <input type="time" value={day.end}   onChange={e => setTime(key, 'end',   e.target.value)} className={tinp} />
                  </div>
                ) : (
                  <span className="text-xs text-[rgba(153,197,255,0.4)] flex-1">Day off</span>
                )}
              </div>
            );
          })}
          {err && <p className="text-xs text-red-400 px-1 pt-1">{err}</p>}
        </div>
        <div className="px-5 py-4 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[rgba(153,197,255,0.15)] text-sm font-semibold text-[rgba(153,197,255,0.6)] hover:bg-[rgba(153,197,255,0.06)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save pattern'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffRota({ staff, jobs, absences, loading, onTabChange, onAbsenceChange, onJobUpdate, user }) {
  const [weekStart, setWeekStart]         = useState(() => getMondayOf(new Date()));
  const [localAbsences, setLocalAbsences] = useState([]);
  const [yearAbsences, setYearAbsences]   = useState([]);
  const [view, setView]                   = useState('schedule');
  const [showAbsModal, setShowAbsModal]   = useState(false);
  const [absTarget, setAbsTarget]         = useState(null);
  const [absForm, setAbsForm]             = useState({ type: 'holiday', start_date: '', end_date: '', notes: '', status: 'approved' });
  const [savingAbs, setSavingAbs]         = useState(false);
  const [processingId, setProcessingId]   = useState(null);
  const [assignJob, setAssignJob]         = useState(null); // job being assigned
  const [dayPicker, setDayPicker]         = useState(null); // { staff, dateStr, dayJobs }
  const [savingAssign, setSavingAssign]   = useState(false);
  const [showWorkPattern, setShowWorkPattern]   = useState(false);
  const [wpTarget, setWpTarget]                 = useState(null);
  const [localPatterns, setLocalPatterns]       = useState({});
  const [todayTimesheets, setTodayTimesheets]   = useState([]);
  const [hrPolicy, setHrPolicy]                 = useState(null);
  const [editingPolicy, setEditingPolicy]       = useState(false);
  const [savingPolicy, setSavingPolicy]         = useState(false);
  const [policyForm, setPolicyForm]             = useState({
    holiday_policy_weeks:   '5.6',
    bank_holidays_on_top:   false,
    bank_holidays_per_year: '8',
    holiday_year_start:     'jan',
  });

  useEffect(() => {
    if (!user) return;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    supabase.from('staff_absences').select('*').eq('owner_id', user.id).gte('end_date', yearStart)
      .then(({ data }) => setYearAbsences(data ?? []));
    supabase.from('hr_settings').select('*').eq('business_id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setHrPolicy(data);
          setPolicyForm({
            holiday_policy_weeks:   String(data.holiday_policy_weeks),
            bank_holidays_on_top:   data.bank_holidays_on_top,
            bank_holidays_per_year: String(data.bank_holidays_per_year),
            holiday_year_start:     data.holiday_year_start,
          });
        }
      });
  }, [user]);

  async function handleSavePolicy(e) {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const payload = {
        business_id:           user.id,
        holiday_policy_weeks:  parseFloat(policyForm.holiday_policy_weeks) || 5.6,
        bank_holidays_on_top:  policyForm.bank_holidays_on_top,
        bank_holidays_per_year: parseInt(policyForm.bank_holidays_per_year, 10) || 8,
        holiday_year_start:    policyForm.holiday_year_start,
        updated_at:            new Date().toISOString(),
      };
      const { data, error } = await supabase.from('hr_settings')
        .upsert(payload, { onConflict: 'business_id' })
        .select().single();
      if (error) throw error;
      setHrPolicy(data);
      setEditingPolicy(false);
    } catch (err) { alert(err.message); }
    finally { setSavingPolicy(false); }
  }

  // Live clock-in status for today — realtime subscription
  useEffect(() => {
    if (!user) return;
    const today = toISO(new Date());
    supabase.from('timesheets').select('*').eq('business_id', user.id).eq('date', today)
      .then(({ data }) => setTodayTimesheets(data ?? []));

    const ch = supabase.channel('rota-timesheets-' + user.id)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'timesheets',
        filter: `business_id=eq.${user.id}`,
      }, ({ eventType, new: row }) => {
        if (!row || row.date !== today) return;
        setTodayTimesheets(prev =>
          eventType === 'INSERT'
            ? [...prev, row]
            : prev.map(t => t.id === row.id ? row : t)
        );
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const days         = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekDates    = useMemo(() => days.map(toISO), [days]);
  const weekJobs     = useMemo(() => jobs.filter(j => weekDates.includes(j.date)), [jobs, weekDates]);
  const activeStaff  = useMemo(() => staff.filter(s => s.is_active), [staff]);

  const allAbsences = useMemo(() => {
    const map = new Map();
    [...absences, ...localAbsences].forEach(a => map.set(a.id, a));
    return Array.from(map.values());
  }, [absences, localAbsences]);

  const allYearAbsences = useMemo(() => {
    const map = new Map();
    [...yearAbsences, ...localAbsences].forEach(a => map.set(a.id, a));
    return Array.from(map.values());
  }, [yearAbsences, localAbsences]);

  const absencesByStaff = useMemo(() => {
    const map = {};
    allAbsences.forEach(a => {
      if (!map[a.staff_id]) map[a.staff_id] = [];
      map[a.staff_id].push(a);
    });
    return map;
  }, [allAbsences]);

  function getAbsenceForDay(staffId, dateStr) {
    return (absencesByStaff[staffId] || []).find(
      a => a.status !== 'declined' && dateStr >= a.start_date && dateStr <= a.end_date
    );
  }

  function getJobsForStaffDay(staffMember, dateStr) {
    return weekJobs.filter(j => {
      if (j.date !== dateStr) return false;
      const ids = Array.isArray(j.assignee_ids) ? j.assignee_ids : [];
      if (ids.includes(staffMember.id)) return true;
      const names = Array.isArray(j.assignees) ? j.assignees : [];
      const fullName = [staffMember.first_name, staffMember.last_name].filter(Boolean).join(' ');
      return names.includes(fullName) || j.assignee === fullName;
    });
  }

  function getWeekHours(staffMember) {
    return weekJobs
      .filter(j => {
        const ids = Array.isArray(j.assignee_ids) ? j.assignee_ids : [];
        if (ids.includes(staffMember.id)) return true;
        const names = Array.isArray(j.assignees) ? j.assignees : [];
        const fullName = [staffMember.first_name, staffMember.last_name].filter(Boolean).join(' ');
        return names.includes(fullName) || j.assignee === fullName;
      })
      .reduce((sum, j) => sum + (j.duration_hrs || 0), 0);
  }

  const unassignedJobs = useMemo(() =>
    weekJobs.filter(j =>
      (!j.assignee_ids || j.assignee_ids.length === 0) &&
      (!j.assignees   || j.assignees.length === 0) &&
      !j.assignee
    ), [weekJobs]);

  const weekStats = useMemo(() => {
    const staffWithJobs = new Set();
    let scheduledHours = 0;
    let contractedTotal = 0;
    let wtrViolations = 0;
    activeStaff.forEach(s => {
      contractedTotal += s.contracted_hours || 0;
      if (getWeekHours(s) > 48) wtrViolations++;
    });
    weekJobs.forEach(j => {
      scheduledHours += j.duration_hrs || 0;
      (Array.isArray(j.assignee_ids) ? j.assignee_ids : []).forEach(id => staffWithJobs.add(id));
    });
    const gapDays = weekDates.filter(d =>
      weekJobs.some(j => j.date === d && (!j.assignee_ids?.length) && (!j.assignees?.length) && !j.assignee)
    ).length;
    return {
      staffCount:     staffWithJobs.size,
      scheduledHours: Math.round(scheduledHours  * 10) / 10,
      contractedTotal: Math.round(contractedTotal * 10) / 10,
      gapDays,
      wtrViolations,
    };
  }, [weekJobs, weekDates, activeStaff]);

  const pendingRequests = useMemo(() => {
    const map = new Map();
    allYearAbsences.filter(a => a.status === 'pending').forEach(a => map.set(a.id, a));
    return Array.from(map.values()).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [allYearAbsences]);

  const entitlements = useMemo(() => {
    const policyWeeks  = parseFloat(hrPolicy?.holiday_policy_weeks  ?? 5.6);
    const bHolOnTop    = hrPolicy?.bank_holidays_on_top  ?? false;
    const bHolPerYear  = parseInt(hrPolicy?.bank_holidays_per_year ?? 8, 10);
    const r2 = n => Math.round(n * 10) / 10;

    return activeStaff.map(s => {
      const contracted = parseFloat(s.contracted_hours ?? 0);
      const dailyHrs   = contracted > 0 ? contracted / 5 : 0;

      // Hours entitlement: contracted hrs × policy weeks (+ bank holidays if on top)
      let entitlementHrs = contracted * policyWeeks;
      if (bHolOnTop && contracted > 0) entitlementHrs += bHolPerYear * dailyHrs;
      entitlementHrs = r2(entitlementHrs);

      const staffYear = allYearAbsences.filter(a => a.staff_id === s.id && a.type === 'holiday');

      const calcHrs = a => a.hours_taken != null
        ? a.hours_taken
        : countWorkingDays(a.start_date, a.end_date) * dailyHrs;

      const takenHrs   = r2(staffYear.filter(a => a.status === 'approved').reduce((sum, a) => sum + calcHrs(a), 0));
      const pendingHrs = r2(staffYear.filter(a => a.status === 'pending' ).reduce((sum, a) => sum + calcHrs(a), 0));
      const remainingHrs = r2(Math.max(0, entitlementHrs - takenHrs - pendingHrs));

      return { staff: s, entitlementHrs, takenHrs, pendingHrs, remainingHrs, dailyHrs, contracted };
    });
  }, [activeStaff, allYearAbsences, hrPolicy]);

  const upcomingLeave = useMemo(() => {
    const today = toISO(new Date());
    const in30  = toISO(addDays(new Date(), 30));
    return allYearAbsences
      .filter(a => a.status === 'approved' && a.start_date >= today && a.start_date <= in30)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [allYearAbsences]);

  const isThisWeek = toISO(getMondayOf(new Date())) === toISO(weekStart);
  const todayStr   = toISO(new Date());

  function openAbsModal(s) {
    setAbsTarget(s);
    setAbsForm({ type: 'holiday', start_date: toISO(weekStart), end_date: toISO(weekStart), notes: '', status: 'approved' });
    setShowAbsModal(true);
  }

  async function handleSaveAbsence(e) {
    e.preventDefault();
    if (absForm.end_date < absForm.start_date) { alert('End date must be on or after start date'); return; }
    setSavingAbs(true);
    try {
      // For holiday absences, calculate hours to deduct from entitlement
      const wkDays   = countWorkingDays(absForm.start_date, absForm.end_date);
      const daily    = parseFloat(absTarget?.contracted_hours ?? 0) / 5;
      const hoursTaken = absForm.type === 'holiday' && daily > 0 ? Math.round(wkDays * daily * 10) / 10 : null;

      const { data, error } = await supabase.from('staff_absences').insert({
        owner_id:    user.id,
        staff_id:    absTarget.id,
        start_date:  absForm.start_date,
        end_date:    absForm.end_date,
        type:        absForm.type,
        status:      absForm.status,
        notes:       absForm.notes || null,
        hours_taken: hoursTaken,
      }).select().single();
      if (error) throw error;
      setLocalAbsences(prev => [...prev, data]);
      setYearAbsences(prev => [...prev, data]);
      setShowAbsModal(false);
      onAbsenceChange?.();
    } catch (err) { alert(err.message); }
    finally { setSavingAbs(false); }
  }

  async function handleRemoveAbsence(absence) {
    const at = ABSENCE_TYPES[absence.type];
    if (!window.confirm(`Remove ${at?.label || absence.type} (${fmtDateGB(absence.start_date)} – ${fmtDateGB(absence.end_date)})?`)) return;
    try {
      await supabase.from('staff_absences').delete().eq('id', absence.id);
      setLocalAbsences(prev => prev.filter(a => a.id !== absence.id));
      setYearAbsences(prev => prev.filter(a => a.id !== absence.id));
      onAbsenceChange?.();
    } catch (err) { alert(err.message); }
  }

  async function handleLeaveDecision(absence, newStatus) {
    setProcessingId(absence.id);
    try {
      const { error } = await supabase.from('staff_absences').update({ status: newStatus }).eq('id', absence.id);
      if (error) throw error;
      const patch = prev => prev.map(a => a.id === absence.id ? { ...a, status: newStatus } : a);
      setYearAbsences(patch);
      setLocalAbsences(patch);
    } catch (err) { alert(err.message); }
    finally { setProcessingId(null); }
  }

  async function handleAssignToggle(job, staffMember) {
    setSavingAssign(true);
    const currentIds = Array.isArray(job.assignee_ids) ? job.assignee_ids : [];
    const isAssigned = currentIds.includes(staffMember.id);
    const newIds     = isAssigned
      ? currentIds.filter(id => id !== staffMember.id)
      : [...currentIds, staffMember.id];
    try {
      const { error } = await supabase.from('jobs').update({ assignee_ids: newIds }).eq('id', job.id);
      if (error) throw error;
      onJobUpdate?.(job.id, { assignee_ids: newIds });
      setAssignJob(prev => prev ? { ...prev, assignee_ids: newIds } : null);
    } catch (err) { alert(err.message); }
    finally { setSavingAssign(false); }
  }

  function openCellClick(staffMember, dateStr) {
    const dayJobs = weekJobs.filter(j => j.date === dateStr);
    if (dayJobs.length === 1) { setAssignJob(dayJobs[0]); return; }
    if (dayJobs.length > 1)   { setDayPicker({ staff: staffMember, dateStr, dayJobs }); return; }
    // No jobs that day — nothing to assign
  }

  function getEffectivePattern(staffMember) {
    return localPatterns[staffMember.id] !== undefined
      ? localPatterns[staffMember.id]
      : staffMember.work_pattern ?? null;
  }

  function getDayAvailability(staffMember, dateStr) {
    const pattern = getEffectivePattern(staffMember);
    if (!pattern) return undefined; // no pattern set — treat as always available
    const dow   = new Date(dateStr + 'T12:00:00').getDay();
    const entry = pattern[String(dow)];
    return entry || null; // null = day off, {start,end} = working
  }

  async function handleSaveWorkPattern(staffId, pattern) {
    const { error } = await supabase.from('team_members').update({ work_pattern: pattern }).eq('id', staffId);
    if (error) throw error;
    setLocalPatterns(prev => ({ ...prev, [staffId]: pattern }));
    setShowWorkPattern(false);
    onAbsenceChange?.();
  }

  const cellBase = 'min-h-[52px] p-1 border-r border-[rgba(153,197,255,0.08)] last:border-r-0 align-top';
  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';

  return (
    <div className="space-y-3">

      {/* ── Top bar: week nav + view switcher ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(d => addDays(d, -7))}
            className="w-8 h-8 rounded-lg border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.06)] flex items-center justify-center hover:bg-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] transition-colors">
            <ChevronLeft size={14} />
          </button>
          <span className="text-sm font-semibold text-white min-w-[160px] text-center">
            {fmtDateShort(weekStart)} – {fmtDateShort(addDays(weekStart, 6))}
          </span>
          <button onClick={() => setWeekStart(d => addDays(d, 7))}
            className="w-8 h-8 rounded-lg border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.06)] flex items-center justify-center hover:bg-[rgba(153,197,255,0.12)] text-[rgba(153,197,255,0.6)] transition-colors">
            <ChevronRight size={14} />
          </button>
          {!isThisWeek && (
            <button onClick={() => setWeekStart(getMondayOf(new Date()))}
              className="text-xs text-[#99c5ff] font-semibold hover:underline flex items-center gap-1 ml-1">
              <RefreshCw size={11} /> This week
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.12)] rounded-lg p-0.5 text-xs">
          {[
            { id: 'schedule', label: 'Schedule' },
            { id: 'leave',    label: `Leave & Entitlement${pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}` },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all whitespace-nowrap ${
                view === v.id ? 'bg-[#1f48ff] text-white shadow-sm' : 'text-[rgba(153,197,255,0.5)] hover:text-white'
              } ${v.id === 'leave' && pendingRequests.length > 0 && view !== v.id ? 'text-amber-400' : ''}`}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stats bar ── */}
      {!loading && activeStaff.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <RotaStat value={weekStats.staffCount} sub="Staff on shift" />
          <RotaStat
            value={`${weekStats.scheduledHours}h`}
            sub={weekStats.contractedTotal > 0 ? `of ${weekStats.contractedTotal}h contracted` : 'scheduled this week'}
            color={weekStats.contractedTotal > 0 && weekStats.scheduledHours < weekStats.contractedTotal * 0.75 ? 'amber' : 'normal'}
          />
          <RotaStat
            value={weekStats.gapDays > 0 ? weekStats.gapDays : '✓'}
            sub={weekStats.gapDays > 0 ? `Day${weekStats.gapDays > 1 ? 's' : ''} with gaps` : 'All jobs covered'}
            color={weekStats.gapDays > 0 ? 'red' : 'green'}
          />
          <RotaStat
            value={pendingRequests.length > 0 ? pendingRequests.length : '✓'}
            sub={pendingRequests.length > 0 ? `Leave request${pendingRequests.length > 1 ? 's' : ''} pending` : 'No pending requests'}
            color={pendingRequests.length > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

      {/* ── WTR warning ── */}
      {weekStats.wtrViolations > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/25 rounded-xl text-xs text-red-300">
          <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
          <span>
            <strong>{weekStats.wtrViolations} staff member{weekStats.wtrViolations > 1 ? 's are' : ' is'}</strong> scheduled over 48 hours this week — Working Time Regulations limit exceeded
          </span>
        </div>
      )}

      {/* ══════════════ SCHEDULE VIEW ══════════════ */}
      {view === 'schedule' && (
        <>
          <Card>
            {loading ? (
              <div className="p-8 text-center text-sm text-[rgba(153,197,255,0.5)]">Loading rota…</div>
            ) : activeStaff.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-[rgba(153,197,255,0.5)] mb-3">Add staff in the People tab to build your rota</p>
                <button onClick={() => onTabChange('people')} className="text-sm text-[#99c5ff] font-semibold">Go to People →</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs" style={{ minWidth: 720 }}>
                  <thead>
                    <tr className="border-b border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.04)]">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide w-36 border-r border-[rgba(153,197,255,0.08)]">
                        Staff
                      </th>
                      {days.map((d, i) => {
                        const isToday = toISO(d) === todayStr;
                        return (
                          <th key={i} className={`text-center px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide border-r border-[rgba(153,197,255,0.08)] last:border-r-0 ${isToday ? 'text-[#99c5ff]' : 'text-[rgba(153,197,255,0.4)]'}`}>
                            <div>{DAY_LABELS[i]}</div>
                            <div className={`text-[9px] font-normal mt-0.5 ${isToday ? 'text-[#99c5ff]' : 'text-[rgba(153,197,255,0.25)]'}`}>
                              {d.getDate()}/{d.getMonth() + 1}
                            </div>
                          </th>
                        );
                      })}
                      <th className="text-center px-2 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide w-16 border-l border-[rgba(153,197,255,0.08)]">
                        Hrs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeStaff.map(s => {
                      const weekHrs   = getWeekHours(s);
                      const contracted = s.contracted_hours ?? 0;
                      const isWTR   = weekHrs > 48;
                      const isOver  = contracted > 0 && weekHrs > contracted * 1.1;
                      const isLight = contracted > 0 && weekHrs > 0 && weekHrs < contracted * 0.7;
                      const hrsColor = isWTR ? 'text-red-400' : isOver ? 'text-amber-400' : isLight ? 'text-[rgba(153,197,255,0.4)]' : weekHrs > 0 ? 'text-white' : 'text-[rgba(153,197,255,0.2)]';
                      const todayTs   = isThisWeek ? todayTimesheets.find(t => t.staff_id === s.id) : null;
                      const tsOnSite  = todayTs?.status === 'clocked_in' || todayTs?.status === 'flagged';
                      const tsDone    = todayTs?.status === 'clocked_out';
                      const tsDotCls  = tsOnSite ? 'bg-green-500 animate-pulse' : tsDone ? 'bg-blue-400' : null;
                      const tsLabel   = todayTs?.clock_in_at
                        ? `${tsOnSite ? '↑' : ''}${new Date(todayTs.clock_in_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}${tsDone && todayTs.clock_out_at ? ` – ${new Date(todayTs.clock_out_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}` : ''}`
                        : null;

                      return (
                        <tr key={s.id} className="border-b border-[rgba(153,197,255,0.06)] last:border-b-0 hover:bg-[rgba(153,197,255,0.04)] transition-colors group">
                          <td className="px-3 py-2 border-r border-[rgba(153,197,255,0.08)]">
                            <div className="flex items-center gap-2">
                              <div className="relative w-6 h-6 flex-shrink-0">
                                <div className="w-6 h-6 rounded-full bg-[rgba(31,72,255,0.35)] flex items-center justify-center text-white text-[10px] font-bold">
                                  {(s.first_name?.[0] || '') + (s.last_name?.[0] || '')}
                                </div>
                                {tsDotCls && (
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#05124a] ${tsDotCls}`} />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1">
                                  <span className="font-semibold text-white text-[11px] truncate">{s.first_name} {s.last_name || ''}</span>
                                  {isWTR && <span className="flex-shrink-0 text-[9px] bg-red-500/15 text-red-300 border border-red-500/25 rounded px-1 py-px font-bold leading-none">WTR</span>}
                                  {todayTs?.status === 'flagged' && <span className="flex-shrink-0 text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/25 rounded px-1 py-px font-bold leading-none">Away</span>}
                                </div>
                                {tsLabel ? (
                                  <div className="text-[9px] text-[rgba(153,197,255,0.5)] leading-none">{tsLabel}</div>
                                ) : (
                                  <div className="text-[10px] text-[rgba(153,197,255,0.5)] capitalize">{ROLE_LABELS[s.role] || s.role}</div>
                                )}
                              </div>
                              <button onClick={() => openAbsModal(s)} title="Log absence"
                                className="w-5 h-5 rounded-md bg-[rgba(153,197,255,0.08)] flex items-center justify-center text-[rgba(153,197,255,0.4)] hover:bg-[#1f48ff] hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                                <Plus size={10} />
                              </button>
                              <button onClick={() => { setWpTarget(s); setShowWorkPattern(true); }} title="Edit work pattern"
                                className="w-5 h-5 rounded-md bg-[rgba(153,197,255,0.08)] flex items-center justify-center text-[rgba(153,197,255,0.4)] hover:bg-[#1f48ff] hover:text-white transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100">
                                <Clock size={10} />
                              </button>
                            </div>
                          </td>

                          {days.map((d, i) => {
                            const ds       = toISO(d);
                            const absence  = getAbsenceForDay(s.id, ds);
                            const cellJobs = getJobsForStaffDay(s, ds);
                            const isToday  = ds === todayStr;
                            const absType  = absence ? (ABSENCE_TYPES[absence.type] || ABSENCE_TYPES.other) : null;
                            const avail    = absence ? undefined : getDayAvailability(s, ds);
                            // avail === undefined: no pattern set (don't show Off)
                            // avail === null:      configured day off
                            // avail === {start,end}: configured working hours
                            const isOff = avail === null;
                            return (
                              <td key={i}
                                className={`${cellBase} group/cell`}
                                style={{
                                  ...(absence ? { background: absType.bg, opacity: absence.status === 'pending' ? 0.65 : 1 } : {}),
                                  ...(!absence && isOff ? { background: 'repeating-linear-gradient(45deg,rgba(153,197,255,0.04),rgba(153,197,255,0.04) 3px,transparent 3px,transparent 10px)' } : {}),
                                  ...(!absence && !isOff && isToday ? { background: 'rgba(31,72,255,0.08)' } : {}),
                                }}>
                                {absence ? (
                                  <div className="h-full flex flex-col gap-0.5 p-0.5">
                                    <div className="flex items-center justify-between gap-0.5">
                                      <span className="text-[10px] font-semibold leading-tight" style={{ color: absType.text }}>
                                        {absType.label}{absence.status === 'pending' ? ' *' : ''}
                                      </span>
                                      <button onClick={() => handleRemoveAbsence(absence)} title="Remove"
                                        className="flex-shrink-0 text-[rgba(153,197,255,0.3)] hover:text-red-400 transition-colors">
                                        <X size={10} />
                                      </button>
                                    </div>
                                    {cellJobs.map(j => (
                                      <button key={j.id} onClick={() => setAssignJob(j)}
                                        className="w-full rounded px-1 py-0.5 bg-red-500/15 border border-red-500/25 text-[9px] text-red-300 font-medium truncate text-left hover:bg-red-500/25 transition-colors">
                                        ⚠ {j.customer}
                                      </button>
                                    ))}
                                  </div>
                                ) : isOff ? (
                                  <div className="h-full min-h-[44px] flex items-center justify-center">
                                    <span className="text-[10px] text-[rgba(153,197,255,0.2)] font-semibold select-none tracking-wide">Off</span>
                                  </div>
                                ) : cellJobs.length > 0 ? (
                                  <div className="space-y-0.5 p-0.5">
                                    {cellJobs.map(j => {
                                      const sc = STATUS_COLOR[j.status] || STATUS_COLOR.scheduled;
                                      return (
                                        <button key={j.id} onClick={() => setAssignJob(j)}
                                          className="w-full rounded-md px-1.5 py-1 text-[10px] leading-tight text-left hover:brightness-95 transition-all"
                                          style={{ background: sc.bg, color: sc.text }}>
                                          <div className="font-semibold truncate max-w-[80px]">{j.customer}</div>
                                          <div className="opacity-70">{fmtHour(j.start_hour)}{j.duration_hrs ? ` · ${j.duration_hrs}h` : ''}</div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="relative w-full min-h-[44px]">
                                    {avail && (
                                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[9px] text-[rgba(153,197,255,0.2)] font-medium select-none">
                                          {avail.start.slice(0,5)}–{avail.end.slice(0,5)}
                                        </span>
                                      </div>
                                    )}
                                    <button
                                      onClick={() => openCellClick(s, ds)}
                                      className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity text-[rgba(153,197,255,0.3)] hover:text-[#99c5ff]"
                                      title="Assign a job">
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2 py-2 text-center align-middle border-l border-[rgba(153,197,255,0.08)]">
                            <div className={`text-[11px] font-bold ${hrsColor}`}>{weekHrs > 0 ? `${weekHrs}h` : '—'}</div>
                            {contracted > 0 && weekHrs > 0 && (
                              <div className="text-[9px] text-[rgba(153,197,255,0.25)]">/{contracted}h</div>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {unassignedJobs.length > 0 && (
                      <tr className="border-t-2 border-dashed border-red-500/20">
                        <td className="px-3 py-2 border-r border-[rgba(153,197,255,0.08)]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
                              <AlertTriangle size={10} className="text-red-400" />
                            </div>
                            <div>
                              <div className="font-semibold text-red-400 text-[11px]">Unassigned</div>
                              <div className="text-[10px] text-red-400/60">{unassignedJobs.length} gap{unassignedJobs.length > 1 ? 's' : ''}</div>
                            </div>
                          </div>
                        </td>
                        {days.map((d, i) => {
                          const ds = toISO(d);
                          const dayGaps = unassignedJobs.filter(j => j.date === ds);
                          return (
                            <td key={i} className={`${cellBase} bg-red-500/5 ${ds === todayStr ? 'bg-red-500/10' : ''}`}>
                              {dayGaps.map(j => (
                                <div key={j.id} className="rounded-md px-1.5 py-1 bg-red-500/15 border border-red-500/25 text-[10px] leading-tight mb-0.5">
                                  <button onClick={() => setAssignJob(j)}
                                    className="font-semibold text-red-300 truncate max-w-[80px] text-left hover:text-red-200 transition-colors block w-full">
                                    {j.customer}
                                  </button>
                                  <button onClick={() => onTabChange('connect')}
                                    className="text-red-400/70 hover:text-red-300 flex items-center gap-0.5 mt-0.5">
                                    <Zap size={9} /> Cover via Connect
                                  </button>
                                </div>
                              ))}
                            </td>
                          );
                        })}
                        <td className="border-l border-[rgba(153,197,255,0.08)]" />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="flex items-center gap-3 flex-wrap text-[11px] text-[rgba(153,197,255,0.5)] px-1">
            {Object.entries({ scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed' }).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: STATUS_COLOR[k].bg, border: `1px solid ${STATUS_COLOR[k].dot}` }} />
                {v}
              </div>
            ))}
            {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: v.bg, border: `1px solid ${v.border}` }} />
                {v.label}
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] bg-red-500/15 text-red-300 border border-red-500/25 rounded px-1 font-bold">WTR</span>
              Over 48h · * pending absence
            </div>
          </div>
        </>
      )}

      {/* ══════════════ LEAVE VIEW ══════════════ */}
      {view === 'leave' && (
        <div className="space-y-3">

          {/* ── Holiday policy settings ── */}
          <Card>
            <CardHeader
              title="Holiday policy"
              subtitle={hrPolicy
                ? `${hrPolicy.holiday_policy_weeks} weeks · Bank holidays ${hrPolicy.bank_holidays_on_top ? 'on top' : 'within entitlement'}`
                : 'Not configured — using 5.6 weeks default'}
              action={
                !editingPolicy && (
                  <button onClick={() => setEditingPolicy(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1f48ff] hover:opacity-80 transition-opacity">
                    <Edit2 size={12} />{hrPolicy ? 'Edit' : 'Set up'}
                  </button>
                )
              }
            />
            {editingPolicy ? (
              <form onSubmit={handleSavePolicy} className="p-5 space-y-4">
                {/* Weeks */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">Entitlement (weeks/year) *</label>
                    <input
                      type="number" step="0.1" min="1" max="52"
                      value={policyForm.holiday_policy_weeks}
                      onChange={e => setPolicyForm(f => ({ ...f, holiday_policy_weeks: e.target.value }))}
                      className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#99c5ff] transition-colors"
                      required
                    />
                    <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-1">Statutory minimum = 5.6 weeks</p>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">Holiday year starts</label>
                    <select
                      value={policyForm.holiday_year_start}
                      onChange={e => setPolicyForm(f => ({ ...f, holiday_year_start: e.target.value }))}
                      className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#99c5ff] transition-colors"
                    >
                      <option value="jan">1 January</option>
                      <option value="apr">6 April (tax year)</option>
                    </select>
                  </div>
                </div>

                {/* Bank holidays */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">Bank holidays</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: false, label: 'Within entitlement', desc: 'Staff use their holiday hours for bank holidays' },
                      { value: true,  label: 'On top of entitlement', desc: 'Bank holidays are free days in addition to their allowance' },
                    ].map(opt => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setPolicyForm(f => ({ ...f, bank_holidays_on_top: opt.value }))}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${policyForm.bank_holidays_on_top === opt.value ? 'border-[#1f48ff] bg-[rgba(31,72,255,0.12)]' : 'border-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.25)]'}`}
                      >
                        <p className={`text-xs font-semibold ${policyForm.bank_holidays_on_top === opt.value ? 'text-[#99c5ff]' : 'text-white'}`}>{opt.label}</p>
                        <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1">Bank holidays per year</label>
                    <input
                      type="number" min="0" max="15"
                      value={policyForm.bank_holidays_per_year}
                      onChange={e => setPolicyForm(f => ({ ...f, bank_holidays_per_year: e.target.value }))}
                      className="w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#99c5ff] transition-colors"
                    />
                    <p className="text-[11px] text-[rgba(153,197,255,0.5)] mt-1">England &amp; Wales = 8 · Scotland = 9</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingPolicy(false)}
                    className="flex-1 py-2.5 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-semibold rounded-xl hover:bg-[rgba(153,197,255,0.06)] transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPolicy}
                    className="flex-1 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                    {savingPolicy ? 'Saving…' : 'Save policy'}
                  </button>
                </div>
              </form>
            ) : hrPolicy ? (
              <div className="px-5 pb-5 grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  ['Weeks/year',    `${hrPolicy.holiday_policy_weeks} weeks`],
                  ['Year starts',   hrPolicy.holiday_year_start === 'apr' ? '6 April' : '1 January'],
                  ['Bank holidays', hrPolicy.bank_holidays_on_top ? `${hrPolicy.bank_holidays_per_year} days on top` : `${hrPolicy.bank_holidays_per_year} days within entitlement`],
                  ['Example',       `20 hrs/wk → ${Math.round(20 * hrPolicy.holiday_policy_weeks * 10) / 10} hrs/yr${hrPolicy.bank_holidays_on_top ? ` + ${Math.round(hrPolicy.bank_holidays_per_year * 4 * 10) / 10} hrs BH` : ''}`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">{label}</p>
                    <p className="text-sm text-white font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>

          {/* Pending requests */}
          {pendingRequests.length > 0 ? (
            <Card>
              <CardHeader
                title="Pending leave requests"
                subtitle={`${pendingRequests.length} request${pendingRequests.length > 1 ? 's' : ''} awaiting approval`}
                action={<span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold flex items-center justify-center border border-amber-500/25">{pendingRequests.length}</span>}
              />
              <div className="divide-y divide-[rgba(153,197,255,0.08)]">
                {pendingRequests.map(req => {
                  const s       = staff.find(m => m.id === req.staff_id);
                  const at      = ABSENCE_TYPES[req.type] || ABSENCE_TYPES.other;
                  const wkDays  = countWorkingDays(req.start_date, req.end_date);
                  const busy    = processingId === req.id;
                  return (
                    <div key={req.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(31,72,255,0.3)] flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {s ? (s.first_name?.[0] || '') + (s.last_name?.[0] || '') : '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">
                          {s ? `${s.first_name} ${s.last_name || ''}` : 'Unknown staff'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold border" style={{ background: at.bg, color: at.text, borderColor: at.border }}>{at.label}</span>
                          <span className="text-[11px] text-[rgba(153,197,255,0.5)]">
                            {fmtDateGB(req.start_date)}{req.end_date !== req.start_date ? ` – ${fmtDateGB(req.end_date)}` : ''} · {wkDays} working day{wkDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                        {req.notes && <div className="text-[11px] text-[rgba(153,197,255,0.4)] mt-0.5 truncate">{req.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleLeaveDecision(req, 'declined')} disabled={busy}
                          className="w-8 h-8 rounded-lg border border-red-500/25 bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-40"
                          title="Decline">
                          <XCircle size={15} />
                        </button>
                        <button
                          onClick={() => handleLeaveDecision(req, 'approved')} disabled={busy}
                          className="w-8 h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/10 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                          title="Approve">
                          <CheckCircle size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            <div className="flex items-center gap-3 px-5 py-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl">
              <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
              <span className="text-sm text-emerald-300 font-medium">No pending leave requests</span>
            </div>
          )}

          {/* Upcoming approved leave */}
          {upcomingLeave.length > 0 && (
            <Card>
              <CardHeader title="Upcoming leave" subtitle="Next 30 days" />
              <div className="divide-y divide-[rgba(153,197,255,0.08)]">
                {upcomingLeave.slice(0, 8).map(abs => {
                  const s  = staff.find(m => m.id === abs.staff_id);
                  const at = ABSENCE_TYPES[abs.type] || ABSENCE_TYPES.other;
                  return (
                    <div key={abs.id} className="px-5 py-2.5 flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[rgba(31,72,255,0.3)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                        {s ? (s.first_name?.[0] || '') + (s.last_name?.[0] || '') : '?'}
                      </div>
                      <div className="flex-1 text-sm text-white font-medium truncate">
                        {s ? `${s.first_name} ${s.last_name || ''}` : '—'}
                      </div>
                      <span className="text-[11px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 border" style={{ background: at.bg, color: at.text, borderColor: at.border }}>{at.label}</span>
                      <div className="text-[11px] text-[rgba(153,197,255,0.5)] text-right flex-shrink-0">
                        {fmtDateGB(abs.start_date)}{abs.end_date !== abs.start_date ? ` – ${fmtDateGB(abs.end_date)}` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Holiday entitlement */}
          {activeStaff.length > 0 && (
            <Card>
              <CardHeader
                title="Holiday entitlement"
                subtitle={`Holiday year: ${hrPolicy?.holiday_year_start === 'apr' ? '6 Apr' : '1 Jan'} – ${hrPolicy?.holiday_year_start === 'apr' ? '5 Apr' : '31 Dec'} ${new Date().getFullYear()}`}
                action={
                  <button onClick={() => activeStaff[0] && openAbsModal(activeStaff[0])}
                    className="text-xs text-[#99c5ff] font-semibold hover:underline flex items-center gap-1">
                    <Plus size={12} /> Log absence
                  </button>
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: 520 }}>
                  <thead>
                    <tr className="border-b border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.04)]">
                      <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">Staff</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">Entitlement</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">Taken</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">Pending</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[rgba(153,197,255,0.4)] uppercase tracking-wide">Remaining</th>
                      <th className="px-5 py-2.5 w-36"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entitlements.map(({ staff: s, entitlementHrs, takenHrs, pendingHrs, remainingHrs, contracted }) => {
                      const usedPct  = entitlementHrs > 0 ? Math.min(100, Math.round((takenHrs   / entitlementHrs) * 100)) : 0;
                      const pendPct  = entitlementHrs > 0 ? Math.min(100 - usedPct, Math.round((pendingHrs / entitlementHrs) * 100)) : 0;
                      const noHours  = contracted === 0;
                      const lowFlag  = !noHours && remainingHrs < (contracted * 2);
                      const warnFlag = !noHours && !lowFlag && remainingHrs < (contracted * 4);
                      const fmt = h => h > 0 ? `${h}h` : '—';
                      return (
                        <tr key={s.id} className="border-b border-[rgba(153,197,255,0.06)] last:border-b-0 hover:bg-[rgba(153,197,255,0.04)] transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[rgba(31,72,255,0.35)] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                                {(s.first_name?.[0] || '') + (s.last_name?.[0] || '')}
                              </div>
                              <div>
                                <div className="font-semibold text-white">{s.first_name} {s.last_name || ''}</div>
                                <div className="text-[10px] text-[rgba(153,197,255,0.5)]">
                                  {contracted > 0 ? `${contracted}h/wk` : <span className="text-amber-400">No contracted hrs set</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-white">
                            {noHours ? <span className="text-[rgba(153,197,255,0.25)]">—</span> : `${entitlementHrs}h`}
                          </td>
                          <td className="px-4 py-3 text-right text-[rgba(153,197,255,0.7)]">{noHours ? '—' : fmt(takenHrs)}</td>
                          <td className="px-4 py-3 text-right text-amber-400">{noHours ? '—' : (pendingHrs > 0 ? `${pendingHrs}h` : '—')}</td>
                          <td className={`px-4 py-3 text-right font-bold ${noHours ? 'text-[rgba(153,197,255,0.25)]' : lowFlag ? 'text-red-400' : warnFlag ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {noHours ? '—' : `${remainingHrs}h`}
                          </td>
                          <td className="px-5 py-3">
                            {!noHours && (
                              <>
                                <div className="h-2 rounded-full bg-[rgba(153,197,255,0.1)] overflow-hidden flex">
                                  <div className="h-full bg-[#1f48ff] rounded-l-full" style={{ width: `${usedPct}%` }} />
                                  {pendPct > 0 && <div className="h-full bg-amber-400" style={{ width: `${pendPct}%` }} />}
                                </div>
                                <div className="text-[9px] text-[rgba(153,197,255,0.4)] mt-0.5">{usedPct}% used</div>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[rgba(153,197,255,0.08)] flex items-center gap-4 flex-wrap text-[11px] text-[rgba(153,197,255,0.5)]">
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[#1f48ff]" /> Taken</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-amber-400" /> Pending</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-2 rounded-sm bg-[rgba(153,197,255,0.1)] border border-[rgba(153,197,255,0.15)]" /> Remaining</div>
                {entitlements.filter(e => e.contracted === 0).length > 0 && (
                  <span className="ml-2 text-amber-400 font-medium">
                    {entitlements.filter(e => e.contracted === 0).length} staff need contracted hours set
                  </span>
                )}
                {entitlements.filter(e => e.contracted > 0 && e.remainingHrs < e.contracted * 2).length > 0 && (
                  <span className="ml-auto text-red-400 font-medium">
                    {entitlements.filter(e => e.contracted > 0 && e.remainingHrs < e.contracted * 2).length} staff running low on leave
                  </span>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Day picker modal (click empty cell with multiple jobs) ── */}
      {dayPicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setDayPicker(null)}>
          <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <div className="font-bold text-white">Jobs on {fmtDateGB(dayPicker.dateStr)}</div>
                <div className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Tap a job to edit who's assigned</div>
              </div>
              <button onClick={() => setDayPicker(null)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
              {dayPicker.dayJobs.map(j => {
                const sc = STATUS_COLOR[j.status] || STATUS_COLOR.scheduled;
                const assignedNames = activeStaff
                  .filter(m => (Array.isArray(j.assignee_ids) ? j.assignee_ids : []).includes(m.id))
                  .map(m => m.first_name).join(', ');
                return (
                  <button key={j.id}
                    onClick={() => { setDayPicker(null); setAssignJob(j); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(153,197,255,0.06)] transition-colors text-left">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm truncate">{j.customer}</div>
                      <div className="text-[11px] text-[rgba(153,197,255,0.5)]">
                        {fmtHour(j.start_hour)}{j.duration_hrs ? ` · ${j.duration_hrs}h` : ''}
                        {assignedNames ? ` · ${assignedNames}` : ' · Unassigned'}
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-[rgba(153,197,255,0.3)] flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Assign staff modal ── */}
      {assignJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setAssignJob(null)}>
          <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <div className="font-bold text-white">{assignJob.customer}</div>
                <div className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
                  {fmtDateGB(assignJob.date)}{assignJob.start_hour != null ? ` · ${fmtHour(assignJob.start_hour)}` : ''}{assignJob.duration_hrs ? ` · ${assignJob.duration_hrs}h` : ''}
                </div>
              </div>
              <button onClick={() => setAssignJob(null)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5">
              <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-3">
                Tap to assign or remove
              </div>
              {activeStaff.length === 0 ? (
                <p className="text-sm text-[rgba(153,197,255,0.5)]">Add staff in the People tab first.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeStaff.map(s => {
                    const ids         = Array.isArray(assignJob.assignee_ids) ? assignJob.assignee_ids : [];
                    const isOn        = ids.includes(s.id);
                    const dayAvailAss = getDayAvailability(s, assignJob.date);
                    const isOffDay    = dayAvailAss === null;
                    return (
                      <button key={s.id}
                        onClick={() => handleAssignToggle(assignJob, s)}
                        disabled={savingAssign}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all disabled:opacity-50 ${
                          isOn
                            ? 'bg-[#1f48ff] text-white border-[#1f48ff]'
                            : isOffDay
                              ? 'bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.4)] border-[rgba(153,197,255,0.12)] hover:border-amber-500/40 hover:text-amber-400'
                              : 'bg-[rgba(153,197,255,0.06)] text-[rgba(153,197,255,0.7)] border-[rgba(153,197,255,0.15)] hover:border-[#99c5ff] hover:text-white'
                        }`}>
                        <div className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-white/20 text-white' : 'bg-[rgba(153,197,255,0.1)] text-[rgba(153,197,255,0.5)]'}`}>
                          {(s.first_name?.[0] || '') + (s.last_name?.[0] || '')}
                        </div>
                        {s.first_name} {s.last_name || ''}
                        {isOffDay && !isOn && <span className="ml-0.5 text-[9px] text-amber-400 font-bold">Off</span>}
                        {isOn && <CheckCircle size={11} className="ml-0.5 opacity-80" />}
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="text-[11px] text-[rgba(153,197,255,0.4)] mt-4">Changes save instantly and sync to the Scheduler.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Work pattern modal ── */}
      {showWorkPattern && wpTarget && (
        <WorkPatternModal
          staff={wpTarget}
          onSave={handleSaveWorkPattern}
          onClose={() => setShowWorkPattern(false)}
        />
      )}

      {/* ── Absence modal ── */}
      {showAbsModal && absTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowAbsModal(false)}>
          <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-[rgba(153,197,255,0.08)] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Log absence</h3>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">{absTarget.first_name} {absTarget.last_name || ''}</p>
              </div>
              <button onClick={() => setShowAbsModal(false)} className="text-[rgba(153,197,255,0.5)] hover:text-white"><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveAbsence} className="p-6 space-y-4">
              <div>
                <label className={lbl}>Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
                    <button key={k} type="button" onClick={() => setAbsForm(f => ({ ...f, type: k }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${absForm.type === k ? 'shadow-sm' : 'border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.3)]'}`}
                      style={absForm.type === k ? { background: v.bg, color: v.text, borderColor: v.border } : {}}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>From</label>
                  <input value={absForm.start_date} onChange={e => setAbsForm(f => ({ ...f, start_date: e.target.value }))} className={inp} type="date" required />
                </div>
                <div>
                  <label className={lbl}>To</label>
                  <input value={absForm.end_date} onChange={e => setAbsForm(f => ({ ...f, end_date: e.target.value }))} className={inp} type="date" required min={absForm.start_date} />
                </div>
              </div>
              {/* Hours preview for holiday absences */}
              {absForm.type === 'holiday' && absForm.start_date && absForm.end_date >= absForm.start_date && (() => {
                const wkDays = countWorkingDays(absForm.start_date, absForm.end_date);
                const daily  = parseFloat(absTarget?.contracted_hours ?? 0) / 5;
                const hrs    = daily > 0 ? Math.round(wkDays * daily * 10) / 10 : null;
                return (
                  <div className="bg-[rgba(31,72,255,0.12)] border border-[rgba(31,72,255,0.25)] rounded-xl px-3 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-[#99c5ff]">{wkDays} working day{wkDays !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-white">
                      {hrs != null ? `${hrs} hrs deducted` : <span className="text-amber-400">Set contracted hrs for hour tracking</span>}
                    </span>
                  </div>
                );
              })()}
              <div>
                <label className={lbl}>Notes (optional)</label>
                <input value={absForm.notes} onChange={e => setAbsForm(f => ({ ...f, notes: e.target.value }))} className={inp} placeholder="e.g. annual leave, self-certified" />
              </div>
              <div>
                <label className={lbl}>Status</label>
                <div className="flex gap-2">
                  {[{ v: 'approved', label: 'Approve immediately' }, { v: 'pending', label: 'Log as request' }].map(opt => (
                    <button key={opt.v} type="button" onClick={() => setAbsForm(f => ({ ...f, status: opt.v }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        absForm.status === opt.v
                          ? opt.v === 'approved' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : 'border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] hover:border-[rgba(153,197,255,0.3)]'
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={savingAbs}
                className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                {savingAbs ? 'Saving…' : absForm.status === 'approved' ? 'Log absence' : 'Submit request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: PAY ─────────────────────────────────────────────────────────────

// ─── CreatePayRunModal ─────────────────────────────────────────────────────────
function CreatePayRunModal({ onSave, onClose }) {
  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';

  const today = new Date();
  const isAfterApril6 = today.getMonth() > 3 || (today.getMonth() === 3 && today.getDate() >= 6);
  const startYear = isAfterApril6 ? today.getFullYear() : today.getFullYear() - 1;
  const taxYear = `${startYear}-${String(startYear + 1).slice(2)}`;
  const monthsSince = (today.getFullYear() - startYear) * 12 + today.getMonth() - 3;
  const periodNo = Math.max(1, Math.min(12, monthsSince + 1));
  const fmt = d => d.toISOString().split('T')[0];
  const pStart = new Date(startYear, 3 + periodNo - 1, 6);
  const pEnd   = new Date(startYear, 3 + periodNo, 5);

  const [form, setForm] = useState({
    tax_year:     taxYear,
    period_no:    String(periodNo),
    payment_date: fmt(today),
    period_start: fmt(pStart),
    period_end:   fmt(pEnd),
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#05124a] border border-[rgba(153,197,255,0.15)] rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-[rgba(153,197,255,0.08)]">
          <h3 className="font-bold text-white">New Pay Run</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-[rgba(153,197,255,0.08)] rounded-lg transition-colors">
            <X size={16} className="text-[rgba(153,197,255,0.5)]" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Tax year *</label>
              <input value={form.tax_year}
                onChange={e => setForm(f => ({ ...f, tax_year: e.target.value }))}
                className={inp} placeholder="2026-27" required />
            </div>
            <div>
              <label className={lbl}>Period no. *</label>
              <input type="number" min="1" max="56" value={form.period_no}
                onChange={e => setForm(f => ({ ...f, period_no: e.target.value }))}
                className={inp} required />
            </div>
          </div>
          <div>
            <label className={lbl}>Payment date *</label>
            <input type="date" value={form.payment_date}
              onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
              className={inp} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Period start *</label>
              <input type="date" value={form.period_start}
                onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                className={inp} required />
            </div>
            <div>
              <label className={lbl}>Period end *</label>
              <input type="date" value={form.period_end}
                onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                className={inp} required />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-semibold rounded-xl hover:bg-[rgba(153,197,255,0.06)] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
              {saving ? 'Creating…' : 'Create pay run'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Sub-tab: PAY ─────────────────────────────────────────────────────────────
function StaffPay() {
  const { user } = useAuth();
  const [settings, setSettings]   = useState(null);
  const [loading,  setLoading]    = useState(true);
  const [saving,   setSaving]     = useState(false);
  const [saved,    setSaved]      = useState(false);
  const [editing,  setEditing]    = useState(false);
  const [form, setForm] = useState({
    tax_office_no: '', paye_ref: '', ao_ref: '',
    gateway_user_id: '', gateway_password_enc: '',
    contact_fore: '', contact_sur: '', contact_email: '',
    payment_frequency: 'M1',
    employment_allowance: false,
    sandbox_mode: true,
  });

  // Pay runs state
  const [payRuns,       setPayRuns]       = useState([]);
  const [runsLoading,   setRunsLoading]   = useState(false);
  const [creatingRun,   setCreatingRun]   = useState(false);
  const [expandedRun,   setExpandedRun]   = useState(null);
  const [calculating,   setCalculating]   = useState(null);
  const [submitting,    setSubmitting]    = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(null);

  useEffect(() => { if (user?.id) loadSettings(); }, [user]);

  async function loadSettings() {
    setLoading(true);
    const { data } = await supabase.from('payroll_settings').select('*').eq('business_id', user.id).single();
    if (data) {
      setSettings(data);
      setForm({
        tax_office_no:        data.tax_office_no        || '',
        paye_ref:             data.paye_ref             || '',
        ao_ref:               data.ao_ref               || '',
        gateway_user_id:      data.gateway_user_id      || '',
        gateway_password_enc: data.gateway_password_enc || '',
        contact_fore:         data.contact_fore         || '',
        contact_sur:          data.contact_sur          || '',
        contact_email:        data.contact_email        || '',
        payment_frequency:    data.payment_frequency    || 'M1',
        employment_allowance: data.employment_allowance || false,
        sandbox_mode:         data.sandbox_mode ?? true,
      });
    }
    setLoading(false);
    loadPayRuns();
  }

  async function loadPayRuns() {
    if (!user?.id) return;
    setRunsLoading(true);
    const { data } = await supabase
      .from('pay_runs')
      .select(`*, payslips ( id, staff_id, hours_worked, gross_pay, tax_period, ni_employee_period, ni_employer_period, net_pay, status, team_members ( first_name, last_name ) )`)
      .eq('business_id', user.id)
      .order('period_start', { ascending: false })
      .limit(24);
    setPayRuns(data ?? []);
    setRunsLoading(false);
  }

  async function handleCreatePayRun(formData) {
    const { data, error } = await supabase.from('pay_runs').insert({
      business_id:  user.id,
      tax_year:     formData.tax_year.trim(),
      period_no:    parseInt(formData.period_no, 10),
      payment_date: formData.payment_date,
      period_start: formData.period_start,
      period_end:   formData.period_end,
      status:       'draft',
    }).select().single();
    if (error) { alert(error.message); return; }
    setCreatingRun(false);
    await loadPayRuns();
    setExpandedRun(data.id);
  }

  async function handleCalculate(payRunId) {
    setCalculating(payRunId);
    try {
      const { error } = await supabase.functions.invoke('payroll-calculate', { body: { pay_run_id: payRunId } });
      if (error) throw error;
      await loadPayRuns();
    } catch (err) {
      alert(err.message || 'Calculation failed');
    } finally {
      setCalculating(null);
    }
  }

  async function handleSubmitFPS(payRunId) {
    setConfirmSubmit(null);
    setSubmitting(payRunId);
    try {
      const { data, error } = await supabase.functions.invoke('payroll-submit-fps', { body: { pay_run_id: payRunId } });
      if (error) throw error;
      await loadPayRuns();
    } catch (err) {
      alert(err.message || 'FPS submission failed');
    } finally {
      setSubmitting(null);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        business_id:          user.id,
        tax_office_no:        form.tax_office_no.trim(),
        paye_ref:             form.paye_ref.trim(),
        ao_ref:               form.ao_ref.trim(),
        gateway_user_id:      form.gateway_user_id.trim()      || null,
        gateway_password_enc: form.gateway_password_enc        || null,
        contact_fore:         form.contact_fore.trim()         || null,
        contact_sur:          form.contact_sur.trim()          || null,
        contact_email:        form.contact_email.trim()        || null,
        payment_frequency:    form.payment_frequency,
        employment_allowance: form.employment_allowance,
        sandbox_mode:         form.sandbox_mode,
        updated_at:           new Date().toISOString(),
      };
      const { error } = await supabase.from('payroll_settings').upsert(payload, { onConflict: 'business_id' });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditing(false); loadSettings(); }, 1200);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const inp = 'w-full bg-[rgba(153,197,255,0.06)] border border-[rgba(153,197,255,0.15)] rounded-xl px-3 py-2 text-sm text-white placeholder-[rgba(153,197,255,0.35)] focus:outline-none focus:border-[#99c5ff] transition-colors';
  const lbl = 'block text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)] mb-1';

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#1f48ff]/20 border-t-[#1f48ff] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── PAYE Settings ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="PAYE Settings"
          subtitle={settings ? `${settings.tax_office_no}/${settings.paye_ref} · ${settings.sandbox_mode ? 'Sandbox' : 'Live'}` : 'Not configured'}
          action={
            !editing && (
              <button onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#99c5ff] hover:opacity-80 transition-opacity">
                <Edit2 size={12} />
                {settings ? 'Edit' : 'Set up'}
              </button>
            )
          }
        />

        {!editing && !settings && (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(153,197,255,0.06)] flex items-center justify-center mx-auto mb-3">
              <CreditCard size={20} className="text-[rgba(153,197,255,0.3)]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Configure your PAYE scheme</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] max-w-xs mx-auto mb-4">
              Enter your PAYE reference and Government Gateway credentials to enable RTI payroll submissions.
            </p>
            <button onClick={() => setEditing(true)}
              className="px-4 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-semibold rounded-xl transition-colors">
              Set up payroll
            </button>
          </div>
        )}

        {!editing && settings && (
          <div className="p-5 grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              ['Tax office no.',   settings.tax_office_no],
              ['PAYE reference',   settings.paye_ref],
              ['AO reference',     settings.ao_ref],
              ['Pay frequency',    { M1:'Monthly', W1:'Weekly', W2:'Fortnightly', W4:'4-weekly' }[settings.payment_frequency] || settings.payment_frequency],
              ['Gateway User ID',  settings.gateway_user_id ? `${settings.gateway_user_id.slice(0,4)}••••••••` : '—'],
              ['Gateway password', settings.gateway_password_enc ? '••••••••' : '—'],
              ['Contact',          [settings.contact_fore, settings.contact_sur].filter(Boolean).join(' ') || '—'],
              ['Mode',             settings.sandbox_mode ? 'Sandbox (test)' : 'Live'],
              ['Emp. allowance',   settings.employment_allowance ? 'Yes' : 'No'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.5)]">{label}</p>
                <p className="text-sm text-white font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Tax office no. *</label>
                <input value={form.tax_office_no} onChange={e => setForm(f => ({ ...f, tax_office_no: e.target.value }))}
                  className={inp} placeholder="123" maxLength={3} required />
              </div>
              <div>
                <label className={lbl}>PAYE ref *</label>
                <input value={form.paye_ref} onChange={e => setForm(f => ({ ...f, paye_ref: e.target.value }))}
                  className={inp} placeholder="A45678" required />
              </div>
              <div>
                <label className={lbl}>AO ref *</label>
                <input value={form.ao_ref} onChange={e => setForm(f => ({ ...f, ao_ref: e.target.value }))}
                  className={inp} placeholder="123PA00012345" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Gateway User ID</label>
                <input value={form.gateway_user_id} onChange={e => setForm(f => ({ ...f, gateway_user_id: e.target.value }))}
                  className={inp} placeholder="123456789012" maxLength={12} />
              </div>
              <div>
                <label className={lbl}>Gateway password</label>
                <input value={form.gateway_password_enc} onChange={e => setForm(f => ({ ...f, gateway_password_enc: e.target.value }))}
                  className={inp} type="password" placeholder="••••••••" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Contact first name</label>
                <input value={form.contact_fore} onChange={e => setForm(f => ({ ...f, contact_fore: e.target.value }))}
                  className={inp} placeholder="Rhianna" />
              </div>
              <div>
                <label className={lbl}>Contact surname</label>
                <input value={form.contact_sur} onChange={e => setForm(f => ({ ...f, contact_sur: e.target.value }))}
                  className={inp} placeholder="Mackie" />
              </div>
              <div>
                <label className={lbl}>Contact email</label>
                <input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  className={inp} placeholder="rhianna@mackies.cleaning" type="email" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Pay frequency</label>
                <select value={form.payment_frequency} onChange={e => setForm(f => ({ ...f, payment_frequency: e.target.value }))} className={inp}>
                  <option value="M1">Monthly</option>
                  <option value="W1">Weekly</option>
                  <option value="W2">Fortnightly</option>
                  <option value="W4">4-weekly</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 pt-5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.employment_allowance} onChange={e => setForm(f => ({ ...f, employment_allowance: e.target.checked }))}
                    className="rounded border-[rgba(153,197,255,0.3)] text-[#1f48ff]" />
                  <span className="text-xs font-medium text-[rgba(153,197,255,0.8)]">Employment allowance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.sandbox_mode} onChange={e => setForm(f => ({ ...f, sandbox_mode: e.target.checked }))}
                    className="rounded border-[rgba(153,197,255,0.3)] text-[#1f48ff]" />
                  <span className="text-xs font-medium text-[rgba(153,197,255,0.8)]">Sandbox mode (test submissions)</span>
                </label>
              </div>
            </div>

            {form.sandbox_mode && (
              <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-3 text-[11px] text-amber-300">
                Sandbox mode is on — submissions go to HMRC's test engine and won't affect real payroll. Turn off only after HMRC recognition is confirmed.
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)}
                className="flex-1 py-2.5 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)] text-sm font-semibold rounded-xl hover:bg-[rgba(153,197,255,0.06)] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all ${saved ? 'bg-emerald-600 text-white' : 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white disabled:opacity-50'}`}>
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* ── Pay Runs ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader
          title="Pay Runs"
          subtitle="Calculate and submit payroll to HMRC"
          action={
            settings && !editing && (
              <button onClick={() => setCreatingRun(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#1f48ff] hover:opacity-80 transition-opacity">
                <Plus size={12} />
                New pay run
              </button>
            )
          }
        />

        {!settings ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(153,197,255,0.06)] flex items-center justify-center mx-auto mb-3">
              <TrendingUp size={20} className="text-[rgba(153,197,255,0.3)]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">Set up PAYE settings first</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] max-w-xs mx-auto">Configure your PAYE scheme above to unlock pay runs.</p>
          </div>
        ) : runsLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-[#1f48ff]/20 border-t-[#1f48ff] rounded-full animate-spin" />
          </div>
        ) : payRuns.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[rgba(153,197,255,0.06)] flex items-center justify-center mx-auto mb-3">
              <TrendingUp size={20} className="text-[rgba(153,197,255,0.3)]" />
            </div>
            <p className="text-sm font-semibold text-white mb-1">No pay runs yet</p>
            <p className="text-xs text-[rgba(153,197,255,0.5)] max-w-xs mx-auto mb-4">
              Create a pay run, calculate PAYE + NI from timesheets, review payslips, then submit your FPS to HMRC.
            </p>
            <button onClick={() => setCreatingRun(true)}
              className="px-4 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-semibold rounded-xl transition-colors">
              Create first pay run
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(153,197,255,0.08)] px-2 pb-2">
            {payRuns.map(run => {
              const isExpanded   = expandedRun === run.id;
              const isCalc       = calculating === run.id;
              const isSub        = submitting === run.id;
              const isConfirming = confirmSubmit === run.id;
              const slips        = run.payslips ?? [];

              const STATUS_STYLE = {
                draft:       'bg-[rgba(153,197,255,0.08)] text-[rgba(153,197,255,0.5)] border border-[rgba(153,197,255,0.12)]',
                calculating: 'bg-[rgba(31,72,255,0.15)] text-[#99c5ff] border border-[rgba(31,72,255,0.25)]',
                calculated:  'bg-[rgba(31,72,255,0.2)] text-[#99c5ff] border border-[rgba(31,72,255,0.3)]',
                submitting:  'bg-amber-500/15 text-amber-300 border border-amber-500/25',
                submitted:   'bg-amber-500/20 text-amber-300 border border-amber-500/30',
                accepted:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
                rejected:    'bg-red-500/15 text-red-300 border border-red-500/25',
              };

              return (
                <div key={run.id} className="rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    className="w-full flex items-center justify-between px-3 py-3.5 hover:bg-[rgba(153,197,255,0.05)] transition-colors text-left"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {run.tax_year} · Period {run.period_no}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_STYLE[run.status] ?? STATUS_STYLE.draft}`}>
                          {run.status}
                        </span>
                      </div>
                      <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
                        {run.period_start} – {run.period_end} · Pay {run.payment_date}
                        {slips.length > 0 && ` · ${slips.length} payslip${slips.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <ChevronDown size={15} className={`text-[rgba(153,197,255,0.4)] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[rgba(153,197,255,0.08)] px-3 py-4 space-y-4 bg-[rgba(153,197,255,0.03)]">

                      {/* Action row */}
                      <div className="flex flex-wrap gap-2 items-center">
                        {['draft', 'calculated'].includes(run.status) && (
                          <button
                            onClick={() => handleCalculate(run.id)}
                            disabled={isCalc}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {isCalc
                              ? <RefreshCw size={11} className="animate-spin" />
                              : <TrendingUp size={11} />}
                            {isCalc ? 'Calculating…' : run.status === 'calculated' ? 'Recalculate' : 'Calculate'}
                          </button>
                        )}

                        {run.status === 'calculated' && !isConfirming && (
                          <button
                            onClick={() => setConfirmSubmit(run.id)}
                            disabled={isSub}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <Send size={11} />
                            Submit FPS{settings.sandbox_mode ? ' (test)' : ''}
                          </button>
                        )}

                        {isConfirming && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-[rgba(153,197,255,0.8)] font-medium">
                              {settings.sandbox_mode ? 'Send to HMRC test engine?' : 'Send LIVE FPS to HMRC?'}
                            </span>
                            <button
                              onClick={() => handleSubmitFPS(run.id)}
                              className={`px-2.5 py-1 font-semibold rounded-lg text-white transition-colors ${settings.sandbox_mode ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                              {isSub ? <RefreshCw size={11} className="animate-spin" /> : 'Confirm'}
                            </button>
                            <button onClick={() => setConfirmSubmit(null)}
                              className="px-2.5 py-1 border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.5)] font-semibold rounded-lg hover:bg-[rgba(153,197,255,0.06)] transition-colors">
                              Cancel
                            </button>
                          </div>
                        )}

                        {run.status === 'accepted' && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle size={13} /> Accepted by HMRC
                          </span>
                        )}
                        {run.status === 'rejected' && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
                            <XCircle size={13} /> Rejected — check fps_response in database
                          </span>
                        )}
                        {['submitting','submitted'].includes(run.status) && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                            <RefreshCw size={11} className="animate-spin" /> Waiting for HMRC…
                          </span>
                        )}
                      </div>

                      {/* Payslip table */}
                      {slips.length > 0 ? (
                        <div className="overflow-x-auto rounded-xl border border-[rgba(153,197,255,0.08)] bg-[rgba(153,197,255,0.03)]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[rgba(153,197,255,0.06)] border-b border-[rgba(153,197,255,0.08)]">
                                {['Staff','Hrs','Gross','Tax','NI emp','NI empr','Net'].map(h => (
                                  <th key={h} className="text-left px-3 py-2 font-semibold text-[rgba(153,197,255,0.4)] whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {slips.map(p => (
                                <tr key={p.id} className="border-b border-[rgba(153,197,255,0.06)] last:border-0 hover:bg-[rgba(153,197,255,0.04)] transition-colors">
                                  <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">
                                    {p.team_members?.first_name} {p.team_members?.last_name}
                                  </td>
                                  <td className="px-3 py-2.5 text-[rgba(153,197,255,0.6)]">{Number(p.hours_worked).toFixed(1)}</td>
                                  <td className="px-3 py-2.5 text-[rgba(153,197,255,0.8)]">£{Number(p.gross_pay).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-red-400">£{Number(p.tax_period).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-amber-400">£{Number(p.ni_employee_period).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 text-amber-400">£{Number(p.ni_employer_period).toFixed(2)}</td>
                                  <td className="px-3 py-2.5 font-semibold text-emerald-400">£{Number(p.net_pay).toFixed(2)}</td>
                                </tr>
                              ))}
                              <tr className="bg-[rgba(153,197,255,0.08)] border-t border-[rgba(153,197,255,0.15)] font-semibold">
                                <td className="px-3 py-2.5 text-white font-bold">Total</td>
                                <td className="px-3 py-2.5 text-[rgba(153,197,255,0.6)]">{slips.reduce((s,p) => s + Number(p.hours_worked||0), 0).toFixed(1)}</td>
                                <td className="px-3 py-2.5 text-white">£{slips.reduce((s,p) => s + Number(p.gross_pay||0), 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-red-400">£{slips.reduce((s,p) => s + Number(p.tax_period||0), 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-amber-400">£{slips.reduce((s,p) => s + Number(p.ni_employee_period||0), 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-amber-400">£{slips.reduce((s,p) => s + Number(p.ni_employer_period||0), 0).toFixed(2)}</td>
                                <td className="px-3 py-2.5 text-emerald-400 font-bold">£{slips.reduce((s,p) => s + Number(p.net_pay||0), 0).toFixed(2)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : run.status === 'draft' && (
                        <p className="text-xs text-[rgba(153,197,255,0.5)]">
                          No payslips yet — click Calculate to generate from timesheets.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {creatingRun && (
        <CreatePayRunModal onSave={handleCreatePayRun} onClose={() => setCreatingRun(false)} />
      )}
    </div>
  );
}

// ─── Sub-tab: CONNECT ─────────────────────────────────────────────────────────

function StaffConnect() {
  return (
    <Card>
      <div className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[rgba(249,115,22,0.12)] border border-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <Network size={24} className="text-orange-400" />
        </div>
        <h3 className="font-bold text-white mb-2">Local Connect — coming in Sprint 3</h3>
        <p className="text-sm text-[rgba(153,197,255,0.5)] max-w-sm mx-auto">
          Post cover gaps to nearby Cadi businesses. They accept, invoice through Cadi, and your shift is filled — without the WhatsApp chaos.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm mx-auto text-left">
          {[
            'Post gaps from the Rota tab',
            'Nearby businesses apply',
            'Vet by Cadi Score',
            'Invoice through Cadi',
            'Compliance auto-checked',
            'Earn by covering others',
          ].map(f => (
            <div key={f} className="flex items-center gap-2 text-xs text-[rgba(153,197,255,0.5)]">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-400/50 flex-shrink-0" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Main Staff page ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'hub',     label: 'Hub',     icon: LayoutDashboard },
  { id: 'people',  label: 'People',  icon: Users           },
  { id: 'rota',    label: 'Rota',    icon: Calendar        },
  { id: 'pay',     label: 'Pay',     icon: CreditCard      },
  { id: 'connect', label: 'Connect', icon: Network         },
];

export default function Staff() {
  const [activeTab, setActiveTab] = useState('hub');
  const [staff,     setStaff]     = useState([]);
  const [jobs,      setJobs]      = useState([]);
  const [absences,  setAbsences]  = useState([]);
  const [training,  setTraining]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const { user }                  = useAuth();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const from = toISO(addDays(new Date(), -28));
      const to   = toISO(addDays(new Date(), 56));

      const [staffRes, jobsRes, absRes, trainRes] = await Promise.all([
        supabase.from('team_members').select('*').eq('business_id', user.id).order('first_name'),
        supabase.from('jobs').select('id,customer,date,start_hour,duration_hrs,type,service,status,assignee,assignees,assignee_ids,price,postcode').eq('owner_id', user.id).gte('date', from).lte('date', to).order('date').order('start_hour'),
        supabase.from('staff_absences').select('*').eq('owner_id', user.id).gte('end_date', from),
        supabase.from('staff_training').select('*').eq('business_id', user.id).order('expiry_date'),
      ]);

      setStaff(staffRes.data ?? []);
      setJobs(jobsRes.data ?? []);
      setAbsences(absRes.data ?? []);
      setTraining(trainRes.data ?? []);
    } catch (e) {
      console.error('Staff data load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const tab = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Sub-tab nav */}
      <div className="flex items-center gap-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(153,197,255,0.10)] rounded-2xl p-1.5 overflow-x-auto">
        {TABS.map(t => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                active
                  ? 'bg-[#1f48ff] text-white shadow-sm'
                  : 'text-[rgba(153,197,255,0.5)] hover:text-white hover:bg-[rgba(153,197,255,0.06)]'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'hub'     && <StaffHub     staff={staff} jobs={jobs} absences={absences} training={training} loading={loading} onTabChange={setActiveTab} />}
      {activeTab === 'people'  && <StaffPeople  staff={staff} training={training} loading={loading} onStaffChange={loadData} onTrainingChange={loadData} />}
      {activeTab === 'rota'    && <StaffRota    staff={staff} jobs={jobs} absences={absences} loading={loading} onTabChange={setActiveTab} onAbsenceChange={loadData} onJobUpdate={(id, updates) => setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j))} user={user} />}
      {activeTab === 'pay'     && <StaffPay />}
      {activeTab === 'connect' && <StaffConnect />}
    </div>
  );
}
