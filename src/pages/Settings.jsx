import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { supabase } from '../lib/supabase';
import { startProCheckout } from '../lib/upgrade';
import { getBusinessSettings, upsertBusinessSettings } from '../lib/db/settingsDb';
import {
  inviteMember,
  listMembers,
  resendInvite,
  setAccessLevel,
  revokeMember,
  reinstateMember,
  getAuditLog,
} from '../lib/db/teamDb';
import {
  User,
  Building2,
  Bell,
  Lock,
  CreditCard,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
  Sparkles,
  LogOut,
  Trash2,
  Download,
  Shield,
  Phone,
  Mail,
  Globe,
  AlertCircle,
  CheckCircle,
  Plug,
  Link,
  Unlink,
  Copy,
  Tag,
  Bot,
  MessageSquare,
  Star,
  Cookie,
} from 'lucide-react';
import { getConsent, setConsent, initFullStory, shutdownFullStory } from '../lib/fullstory';
import PricingSettings from '../components/PricingSettings';
import AgentSettings from '../components/AgentSettings';
import FrontDeskSettings from '../components/FrontDeskSettings';
import ReviewsSettings from '../components/ReviewsSettings';

// ─── Billing portal button ────────────────────────────────────────────────────

function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleOpen = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-portal', {
        body: { returnUrl: window.location.origin + '/settings' },
      });
      if (fnError) throw fnError;
      if (data?.url) window.location.href = data.url;
      else throw new Error('No portal URL returned');
    } catch {
      setError('Could not open billing portal. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        onClick={handleOpen}
        disabled={loading}
        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
      >
        {loading ? 'Opening…' : 'Manage subscription · Cancel · Update card'}
      </button>
    </div>
  );
}

// ─── TOGGLE ───────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-[#1f48ff]' : 'bg-gray-200'
      }`}
    >
      <div
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── SECTION WRAPPER ──────────────────────────────────────────────────────────

function Section({ title, desc, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-bold text-[#010a4f]">{title}</h3>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

// ─── SETTING ROW ──────────────────────────────────────────────────────────────

function SettingRow({ icon: Icon, label, desc, children, danger }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            danger ? 'bg-red-100' : 'bg-[#f0f4ff]'
          }`}
        >
          <Icon size={15} className={danger ? 'text-red-500' : 'text-[#1f48ff]'} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-[#010a4f]'}`}>
            {label}
          </p>
          {desc && <p className="text-xs text-gray-400 mt-0.5 truncate">{desc}</p>}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ─── INPUT FIELD ──────────────────────────────────────────────────────────────

function InputField({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff] focus:ring-2 focus:ring-[#1f48ff]/10"
      />
    </div>
  );
}

// ─── SAVED TOAST ──────────────────────────────────────────────────────────────

function SavedToast({ show }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 bg-[#010a4f] text-white px-5 py-3 rounded-xl shadow-2xl">
        <CheckCircle size={15} className="text-green-400" />
        <span className="text-sm font-semibold">Changes saved</span>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

// ─── STAFF SECTION ───────────────────────────────────────────────────────────

function StaffSection({ user }) {
  const [staff, setStaff] = useState([]);
  const [loginToken, setLoginToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Cleaner');
  const [pin, setPin] = useState('');
  const [rate, setRate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const staffLoginUrl = loginToken ? `${window.location.origin}/staff-login/${loginToken}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(staffLoginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // team_members is canonical (migration 019). Map to the shape the UI expects
  // (name / active) so the JSX below doesn't need to change.
  const ALLOWED_ROLES = ['cleaner', 'supervisor', 'manager'];
  const normaliseRole = (r) => {
    const lower = (r || '').trim().toLowerCase();
    return ALLOWED_ROLES.includes(lower) ? lower : 'cleaner';
  };
  const splitName = (full) => {
    const trimmed = (full || '').trim();
    const i = trimmed.indexOf(' ');
    return i === -1
      ? { first_name: trimmed || 'Unnamed', last_name: null }
      : { first_name: trimmed.slice(0, i), last_name: trimmed.slice(i + 1).trim() || null };
  };
  const fromTeamRow = (r) => ({
    id: r.id,
    owner_id: r.business_id,
    name: [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unnamed',
    role: r.role || 'cleaner',
    // Edit field stays empty by default — typing a new PIN replaces; the DB
    // trigger bcrypts it on write. `has_pin` is the canonical "is PIN set" flag.
    pin_hash: '',
    has_pin: !!r.has_pin,
    hourly_rate: r.hourly_rate,
    active: r.is_active,
    created_at: r.created_at,
  });

  const loadStaff = useCallback(async () => {
    const [{ data: staffData }, { data: bizData }] = await Promise.all([
      supabase
        .from('team_members')
        .select('*')
        .eq('business_id', user.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('business_settings')
        .select('staff_login_token')
        .eq('owner_id', user.id)
        .single(),
    ]);
    setStaff((staffData ?? []).map(fromTeamRow));
    if (bizData?.staff_login_token) setLoginToken(bizData.staff_login_token);
  }, [user.id]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  async function handleAdd(e) {
    e.preventDefault();
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setMsg({ type: 'err', text: 'PIN must be exactly 4 digits' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { first_name, last_name } = splitName(name);
      const { error } = await supabase.from('team_members').insert({
        business_id: user.id,
        first_name,
        last_name,
        role: normaliseRole(role),
        pin_hash: pin,
        hourly_rate: rate ? parseFloat(rate) : null,
        is_active: true,
      });
      if (error) throw error;
      setMsg({ type: 'ok', text: `${name} added` });
      setName('');
      setPin('');
      setRate('');
      setRole('Cleaner');
      await loadStaff();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(member) {
    setBusy(true);
    try {
      // Only write pin_hash if the user typed a new one — otherwise leave the
      // existing bcrypt'd value alone. Trigger bcrypts on save.
      const update = {
        hourly_rate: member.hourly_rate,
        role: normaliseRole(member.role),
      };
      if (member.pin_hash && /^\d{4,8}$/.test(member.pin_hash)) {
        update.pin_hash = member.pin_hash;
      }
      const { error } = await supabase.from('team_members').update(update).eq('id', member.id);
      if (error) throw error;
      setEditingId(null);
      await loadStaff();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(member) {
    await supabase.from('team_members').update({ is_active: !member.active }).eq('id', member.id);
    await loadStaff();
  }

  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  return (
    <div className="space-y-4">
      {/* Staff login link */}
      {staffLoginUrl && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[#010a4f]">Staff login link</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Share this link with your staff — it's unique to your business. Bookmark it on a
              shared device.
            </p>
          </div>
          <div className="px-6 py-4 flex items-center gap-3">
            <p className="flex-1 text-xs font-mono text-gray-500 bg-gray-50 px-3 py-2 rounded-lg truncate">
              {staffLoginUrl}
            </p>
            <button
              onClick={copyLink}
              className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg border transition-colors ${
                copied
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                  : 'bg-[#f0f4ff] text-[#1f48ff] border-[#1f48ff]/20 hover:bg-[#e0e8ff]'
              }`}
            >
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      {/* Add staff form */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Add staff member</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Each staff member needs a unique 4-digit PIN.
          </p>
        </div>
        <div className="px-6 py-5">
          {msg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {msg.text}
            </div>
          )}
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Emma Clarke"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
                <input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Cleaner"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">4-digit PIN</label>
                <input
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="e.g. 1234"
                  maxLength={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#010a4f] font-mono focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Hourly rate (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  placeholder="e.g. 13.50"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#1a3de0] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {busy ? 'Adding…' : 'Add staff member →'}
            </button>
          </form>
        </div>
      </div>

      {/* Active staff */}
      {active.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[#010a4f]">Active staff</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {active.map((s) => (
              <div key={s.id} className="px-6 py-4">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Role</label>
                        <input
                          value={s.role ?? ''}
                          onChange={(e) =>
                            setStaff((prev) =>
                              prev.map((x) => (x.id === s.id ? { ...x, role: e.target.value } : x))
                            )
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1f48ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">PIN</label>
                        <input
                          value={s.pin_hash ?? ''}
                          maxLength={4}
                          placeholder={s.has_pin ? 'Leave blank to keep' : 'Set a new PIN'}
                          onChange={(e) =>
                            setStaff((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      pin_hash: e.target.value.replace(/\D/g, '').slice(0, 4),
                                    }
                                  : x
                              )
                            )
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#1f48ff]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">
                          Rate (£/hr)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={s.hourly_rate ?? ''}
                          onChange={(e) =>
                            setStaff((prev) =>
                              prev.map((x) =>
                                x.id === s.id ? { ...x, hourly_rate: e.target.value } : x
                              )
                            )
                          }
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#1f48ff]"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(s)}
                        disabled={busy}
                        className="flex-1 py-2 bg-[#1f48ff] text-white text-xs font-bold rounded-lg hover:bg-[#1a3de0] disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 rounded-lg border border-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#010a4f]">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.role ?? 'Staff'}
                        {s.hourly_rate ? ` · £${parseFloat(s.hourly_rate).toFixed(2)}/hr` : ''}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-mono px-2 py-1 rounded ${s.has_pin ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-50'}`}
                    >
                      {s.has_pin ? 'PIN set ✓' : 'No PIN'}
                    </span>
                    <button
                      onClick={() => setEditingId(s.id)}
                      className="text-xs text-[#1f48ff] hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(s)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                    >
                      Deactivate
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inactive staff */}
      {inactive.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[#010a4f] text-opacity-60">Inactive staff</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {inactive.map((s) => (
              <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-400">{s.name}</p>
                  <p className="text-xs text-gray-300">{s.role ?? 'Staff'}</p>
                </div>
                <button
                  onClick={() => handleToggleActive(s)}
                  className="text-xs text-[#1f48ff] hover:underline font-medium"
                >
                  Reinstate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {staff.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No staff added yet.</p>
      )}
    </div>
  );
}

// ─── TEAM TAB ─────────────────────────────────────────────────────────────────

const STATUS_CHIP = {
  pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  revoked: { label: 'Revoked', cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

function TeamTab({ user }) {
  const [members, setMembers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('accountant');
  const [access, setAccess] = useState('read_only');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'ok'|'err', text }
  const [showAudit, setShowAudit] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [m, a] = await Promise.all([listMembers(), getAuditLog(user.id)]);
      setMembers(m);
      setAuditLog(a);
    } catch {
      /* ignore */
    }
  }, [user.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleInvite(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await inviteMember({ email, role, accessLevel: access });
      setMsg({ type: 'ok', text: `Invite sent to ${email}` });
      setEmail('');
      await reload();
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleAccess(member) {
    const next = member.access_level === 'read_only' ? 'full' : 'read_only';
    try {
      await setAccessLevel(member.id, next);
      await reload();
    } catch {
      /* ignore */
    }
  }

  async function handleRevoke(member) {
    try {
      if (member.status === 'revoked') await reinstateMember(member.id);
      else await revokeMember(member.id);
      await reload();
    } catch {
      /* ignore */
    }
  }

  async function handleResend(member) {
    try {
      await resendInvite(member.id);
      setMsg({ type: 'ok', text: `Invite resent to ${member.member_email}` });
    } catch (err) {
      setMsg({ type: 'err', text: err.message });
    }
  }

  const active = members.filter((m) => m.status !== 'revoked');
  const revoked = members.filter((m) => m.status === 'revoked');

  return (
    <div className="space-y-4">
      {/* Invite form */}
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#010a4f]">Invite a team member</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            They'll get an email with a link to accept access to your account.
          </p>
        </div>
        <div className="px-6 py-5">
          {msg && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium border ${
                msg.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {msg.text}
            </div>
          )}
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accountant@example.com"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                >
                  <option value="accountant">Accountant</option>
                  <option value="bookkeeper">Bookkeeper</option>
                  <option value="manager">Manager</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Access level</label>
                <select
                  value={access}
                  onChange={(e) => setAccess(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:ring-2 focus:ring-[#1f48ff]/20 focus:border-[#1f48ff]"
                >
                  <option value="read_only">Read only</option>
                  <option value="full">Full access</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#1f48ff] hover:bg-[#1a3de0] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send invite →'}
            </button>
          </form>
        </div>
      </div>

      {/* Active members */}
      {active.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-[#010a4f]">Team members</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {active.map((m) => {
              const chip = STATUS_CHIP[m.status] ?? STATUS_CHIP.pending;
              return (
                <div key={m.id} className="px-6 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#010a4f] truncate">{m.member_email}</p>
                    <p className="text-xs text-gray-400 capitalize">{m.role}</p>
                  </div>
                  {/* Access toggle */}
                  {m.status === 'active' && (
                    <button
                      onClick={() => handleToggleAccess(m)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                        m.access_level === 'full'
                          ? 'bg-[#1f48ff]/10 text-[#1f48ff] border-[#1f48ff]/20 hover:bg-[#1f48ff]/20'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {m.access_level === 'full' ? 'Full access' : 'Read only'}
                    </button>
                  )}
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${chip.cls}`}>
                    {chip.label}
                  </span>
                  {m.status === 'pending' && (
                    <button
                      onClick={() => handleResend(m)}
                      className="text-xs text-gray-400 hover:text-[#1f48ff] transition-colors font-medium"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    onClick={() => handleRevoke(m)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                  >
                    Revoke
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revoked members (collapsed) */}
      {revoked.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-[#010a4f]">Revoked access</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {revoked.map((m) => (
              <div key={m.id} className="px-6 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-400 truncate">{m.member_email}</p>
                  <p className="text-xs text-gray-300 capitalize">{m.role}</p>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${STATUS_CHIP.revoked.cls}`}
                >
                  Revoked
                </span>
                <button
                  onClick={() => handleRevoke(m)}
                  className="text-xs text-[#1f48ff] hover:underline font-medium"
                >
                  Reinstate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      {auditLog.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
          <button
            onClick={() => setShowAudit((v) => !v)}
            className="w-full px-6 py-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-bold text-[#010a4f]">Activity log</h3>
            <ChevronRight
              className={`w-4 h-4 text-gray-400 transition-transform ${showAudit ? 'rotate-90' : ''}`}
            />
          </button>
          {showAudit && (
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="px-6 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#010a4f] capitalize">
                      {entry.action.replace(/_/g, ' ')}
                    </p>
                    {entry.detail?.member_email && (
                      <p className="text-xs text-gray-400">{entry.detail.member_email}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 shrink-0">
                    {new Date(entry.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">
          No team members yet. Invite an accountant, bookkeeper, or manager above.
        </p>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3 py-2">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs font-bold text-gray-300 uppercase tracking-widest">Staff</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <StaffSection user={user} />
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'pricing', label: 'Pricing', icon: Tag },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'front_desk', label: 'Sales Manager', icon: MessageSquare },
  { id: 'reviews', label: 'Review Agent', icon: Star },
  { id: 'compliance', label: 'Compliance', icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'subscription', label: 'Plan', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'team', label: 'Team', icon: User },
];

function CookiePreferencesToggle() {
  const [consent, setConsentState] = useState(getConsent() || 'unset');
  const handle = (next) => {
    setConsent(next);
    setConsentState(next);
    if (next === 'accepted') initFullStory();
    else shutdownFullStory();
  };
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handle('accepted')}
        className={`text-xs font-bold px-3 py-2 rounded-xl transition-colors ${consent === 'accepted' ? 'bg-emerald-500 text-white' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-400'}`}
      >
        Allow
      </button>
      <button
        onClick={() => handle('declined')}
        className={`text-xs font-bold px-3 py-2 rounded-xl transition-colors ${consent === 'declined' ? 'bg-gray-700 text-white' : 'border-2 border-gray-200 text-gray-500 hover:border-gray-400'}`}
      >
        Decline
      </button>
    </div>
  );
}

function ExportDataButton() {
  const [phase, setPhase] = useState('idle'); // idle | exporting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleExport() {
    setPhase('exporting');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('export-data', { body: {} });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cadi-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setPhase('done');
      setTimeout(() => setPhase('idle'), 3000);
    } catch (err) {
      setErrorMsg(err?.message ?? 'Export failed. Please email support@cadi.cleaning.');
      setPhase('error');
    }
  }

  if (phase === 'exporting') {
    return <span className="text-xs font-bold px-4 py-2 text-gray-500">Preparing your data…</span>;
  }
  if (phase === 'done') {
    return <span className="text-xs font-bold px-4 py-2 text-emerald-500">Downloaded ✓</span>;
  }
  if (phase === 'error') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500">{errorMsg}</span>
        <button
          onClick={() => setPhase('idle')}
          className="text-xs font-bold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={handleExport}
      className="text-xs font-bold px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-[#1f48ff] hover:text-[#1f48ff] transition-colors"
    >
      Export
    </button>
  );
}

function DeleteAccountButton({ onDeleted }) {
  const [phase, setPhase] = useState('idle'); // idle | confirm | deleting | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleDelete() {
    setPhase('deleting');
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      onDeleted();
    } catch (err) {
      const msg = err?.message ?? 'Something went wrong. Please contact support@cadi.cleaning';
      setErrorMsg(msg);
      setPhase('error');
    }
  }

  if (phase === 'idle') {
    return (
      <button
        onClick={() => setPhase('confirm')}
        className="text-xs font-bold px-4 py-2 border-2 border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
      >
        Delete
      </button>
    );
  }

  if (phase === 'confirm') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-500 font-semibold">Are you sure?</span>
        <button
          onClick={handleDelete}
          className="text-xs font-bold px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        >
          Yes, delete
        </button>
        <button
          onClick={() => setPhase('idle')}
          className="text-xs font-bold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500 hover:border-gray-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (phase === 'deleting') {
    return <span className="text-xs text-gray-400">Deleting…</span>;
  }

  return (
    <div className="text-right">
      <p className="text-xs text-red-500 mb-1">{errorMsg}</p>
      <button
        onClick={() => setPhase('idle')}
        className="text-xs font-bold px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500"
      >
        Dismiss
      </button>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile: authProfile, updateProfile, signOut } = useAuth();
  const { isPro, priceMonthly } = usePlan();
  const [activeTab, setActiveTab] = useState(() => {
    if (searchParams.get('upgraded') === '1') return 'subscription';
    if (searchParams.get('tab')) return searchParams.get('tab');
    return 'profile';
  });
  const [upgradeSuccess] = useState(searchParams.get('upgraded') === '1');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // After returning from Stripe, poll the DB directly (avoids stale closure on isPro)
  useEffect(() => {
    if (searchParams.get('upgraded') !== '1') return;
    setSearchParams({}, { replace: true });

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier, plan')
        .eq('id', user.id)
        .single();
      const activated =
        data?.subscription_tier === 'pro' ||
        data?.subscription_tier === 'max' ||
        data?.plan === 'pro';
      if (activated || attempts >= 20) {
        clearInterval(interval);
        if (activated) window.location.reload();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Profile state — no hardcoded defaults; populated from Supabase in useEffect
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    avatar: '',
  });

  // Business state — name populated from Supabase in useEffect
  const [business, setBusiness] = useState({
    name: '',
    tagline: '',
    address: '',
    website: '',
    vatNumber: '',
    vatScheme: 'none',
    companyNumber: '',
    hourlyRate: '',
    currency: 'GBP',
    businessEmail: '',
    homePostcode: '',
    bankName: '',
    sortCode: '',
    accountNum: '',
    workingDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    startTime: '08:00',
    endTime: '18:00',
    entityType: 'sole_trader',
    corporationTaxUtr: '',
    director1Name: '',
    directorSalary: '12570',
    director2Name: '',
    director2Salary: '',
    accountingYearEndMonth: '3',
  });

  // Notification state
  const [notifications, setNotifications] = useState({
    jobReminders: true,
    invoiceOverdue: true,
    clientFollowUp: true,
    weeklyReport: true,
    newFeatures: false,
    marketingEmails: false,
    smsReminders: false,
    appPush: true,
  });

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: false,
  });

  // Compliance state
  const [compliance, setCompliance] = useState({
    pli: false,
    pliPolicy: '',
    pliRenewal: '',
    dbs: false,
    ico: false,
    coshh: false,
  });

  const [communityOptIn, setCommunityOptIn] = useState(Boolean(authProfile?.community_opt_in));
  // Email reports toggle — controls whether the monthly customer pulse and
  // monthly finance report edge functions actually send to this owner. The
  // column defaults to true; this lets the owner opt out via Settings,
  // which is the unsubscribe path the report-email footers link to.
  const [emailReports, setEmailReports] = useState(authProfile?.email_reports !== false);
  const [emailReportsSaving, setEmailReportsSaving] = useState(false);

  // Logo state
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // GoCardless state
  const [gcStatus, setGcStatus] = useState(null); // null | { connected, connectedAt, organisationId, sandbox }
  const [gcLoading, setGcLoading] = useState(false);
  const [confirmGcDisconnect, setConfirmGcDisconnect] = useState(false);
  const [gcCopied, setGcCopied] = useState(false);

  useEffect(() => {
    if (!authProfile && !user) return;

    setProfile((prev) => ({
      ...prev,
      firstName: authProfile?.first_name ?? prev.firstName,
      lastName: authProfile?.last_name ?? prev.lastName,
      email: user?.email ?? prev.email,
      phone: authProfile?.phone ?? prev.phone,
      avatar: authProfile?.first_name?.[0]?.toUpperCase() ?? prev.avatar,
    }));

    if (authProfile?.business_name) {
      setBusiness((prev) => ({ ...prev, name: authProfile.business_name }));
    }

    setCommunityOptIn(Boolean(authProfile?.community_opt_in));
    setEmailReports(authProfile?.email_reports !== false);
  }, [authProfile, user]);

  const handleCommunityToggle = async (value) => {
    setCommunityOptIn(value);
    try {
      localStorage.setItem('cadi_community_opt_in', value ? '1' : '0');
    } catch {}
    try {
      await updateProfile({ community_opt_in: value });
    } catch (err) {
      console.error('Failed to update community opt-in:', err);
      setCommunityOptIn(!value);
    }
  };

  // Optimistic toggle. On failure we roll back the UI state — the
  // monthly-report edge functions both check `profiles.email_reports`
  // before sending, so a successful write here is the unsubscribe.
  const handleEmailReportsToggle = async (value) => {
    setEmailReports(value);
    setEmailReportsSaving(true);
    try {
      await updateProfile({ email_reports: value });
    } catch (err) {
      console.error('Failed to update email reports preference:', err);
      setEmailReports(!value);
    } finally {
      setEmailReportsSaving(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await getBusinessSettings();
        if (!mounted || !settings) return;

        const bd = settings.bank_details || {};
        const sd = settings.setup_data || {};
        if (sd.logo_url) setLogoUrl(sd.logo_url);
        setCompliance({
          pli: Boolean(sd.pli),
          pliPolicy: sd.pli_policy || '',
          pliRenewal: sd.pli_renewal || '',
          dbs: Boolean(sd.dbs),
          ico: Boolean(sd.ico),
          coshh: Boolean(sd.coshh),
        });
        setBusiness((prev) => ({
          ...prev,
          hourlyRate: settings.hourly_rate != null ? String(settings.hourly_rate) : prev.hourlyRate,
          currency: settings.currency || prev.currency,
          businessEmail: settings.business_email || sd.business_email || prev.businessEmail,
          homePostcode: authProfile?.home_postcode || authProfile?.postcode || prev.homePostcode,
          bankName: bd.bankName || prev.bankName,
          sortCode: bd.sortCode || prev.sortCode,
          accountNum: bd.accountNum || prev.accountNum,
          tagline: sd.tagline || prev.tagline,
          address: sd.address || prev.address,
          website: sd.website || prev.website,
          workingDays: sd.working_days || prev.workingDays,
          startTime: sd.start_time || prev.startTime,
          endTime: sd.finish_time || prev.endTime,
          vatNumber: settings.vat_number || prev.vatNumber,
          vatScheme: settings.vat_scheme || prev.vatScheme,
          companyNumber: settings.companies_house_number || prev.companyNumber,
          entityType: settings.entity_type || prev.entityType,
          corporationTaxUtr: settings.corporation_tax_utr || prev.corporationTaxUtr,
          director1Name: settings.director_1_name || prev.director1Name,
          directorSalary:
            settings.director_salary_annual != null
              ? String(settings.director_salary_annual)
              : prev.directorSalary,
          director2Name: settings.director_2_name || prev.director2Name,
          director2Salary:
            settings.director_2_salary_annual != null
              ? String(settings.director_2_salary_annual)
              : prev.director2Salary,
          accountingYearEndMonth:
            settings.accounting_year_end_month != null
              ? String(settings.accounting_year_end_month)
              : prev.accountingYearEndMonth,
        }));

        if (settings.notifications && typeof settings.notifications === 'object') {
          setNotifications((prev) => ({ ...prev, ...settings.notifications }));
        }
      } catch {
        // Keep local defaults as fallback when Supabase settings are unavailable.
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load settings once on mount; authProfile is only an initial fallback
  }, []);

  // Load GoCardless status when Integrations tab opens
  useEffect(() => {
    if (activeTab !== 'integrations') return;
    let mounted = true;
    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || !mounted) return;
        const { data } = await supabase.functions.invoke('gocardless-auth', {
          body: { action: 'status' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (mounted) setGcStatus(data);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const handleGcConnect = async () => {
    setGcLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.functions.invoke('gocardless-auth', {
        body: { action: 'url' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.url) window.location.href = data.url;
    } catch {
      /* ignore */
    } finally {
      setGcLoading(false);
    }
  };

  const handleGcDisconnect = async () => {
    setGcLoading(true);
    setConfirmGcDisconnect(false);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.functions.invoke('gocardless-auth', {
        body: { action: 'disconnect' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setGcStatus((s) => ({ ...s, connected: false, connectedAt: null, organisationId: null }));
    } catch {
      /* ignore */
    } finally {
      setGcLoading(false);
    }
  };

  const showSaved = () => {
    setSaveError(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const showSaveError = (msg) => {
    setSaveError(msg || "Couldn't save — check your connection and try again.");
    setTimeout(() => setSaveError(null), 5000);
  };

  const handleProfileSave = async () => {
    try {
      await updateProfile({
        first_name: profile.firstName,
        last_name: profile.lastName,
        phone: profile.phone,
        business_name: business.name,
      });

      if (user?.email && profile.email && user.email !== profile.email) {
        await supabase.auth.updateUser({ email: profile.email });
      }

      showSaved();
    } catch {
      showSaveError();
    }
  };

  const handleBusinessSave = async () => {
    try {
      const existing = await getBusinessSettings();
      const sd = existing?.setup_data ?? {};
      await upsertBusinessSettings({
        hourly_rate: Number(business.hourlyRate) || 0,
        currency: business.currency,
        business_email: business.businessEmail,
        bank_details: {
          bankName: business.bankName,
          sortCode: business.sortCode,
          accountNum: business.accountNum,
        },
        setup_data: {
          ...sd,
          tagline: business.tagline || null,
          address: business.address || null,
          website: business.website || null,
          working_days: business.workingDays,
          start_time: business.startTime,
          finish_time: business.endTime,
        },
        entity_type: business.entityType,
        vat_number: business.vatNumber || null,
        vat_scheme: business.vatScheme || 'none',
        companies_house_number: business.companyNumber || null,
        corporation_tax_utr: business.corporationTaxUtr || null,
        director_1_name: business.director1Name || null,
        director_salary_annual: Number(business.directorSalary) || 0,
        director_2_name: business.director2Name || null,
        director_2_salary_annual: business.director2Salary
          ? Number(business.director2Salary)
          : null,
        accounting_year_end_month: Number(business.accountingYearEndMonth) || 3,
      });

      await updateProfile({
        business_name: business.name,
        home_postcode: business.homePostcode,
        postcode: business.homePostcode,
      });
      showSaved();
    } catch {
      showSaveError();
    }
  };

  const handleComplianceSave = async () => {
    try {
      const existing = await getBusinessSettings();
      const sd = existing?.setup_data ?? {};
      await upsertBusinessSettings({
        setup_data: {
          ...sd,
          pli: compliance.pli,
          pli_policy: compliance.pliPolicy,
          pli_renewal: compliance.pliRenewal,
          dbs: compliance.dbs,
          ico: compliance.ico,
          coshh: compliance.coshh,
        },
      });
      showSaved();
    } catch {
      showSaveError();
    }
  };

  const handleNotificationsSave = async () => {
    try {
      await upsertBusinessSettings({ notifications });
      showSaved();
    } catch {
      showSaveError();
    }
  };

  const handlePasswordUpdate = async () => {
    if (!security.currentPassword) {
      showSaveError('Enter your current password.');
      return;
    }
    if (!security.newPassword || security.newPassword !== security.confirmPassword) {
      showSaveError("New passwords don't match.");
      return;
    }
    if (security.newPassword.length < 8) {
      showSaveError('New password must be at least 8 characters.');
      return;
    }
    if (security.newPassword === security.currentPassword) {
      showSaveError('New password must be different from your current one.');
      return;
    }

    const email = user?.email;
    if (!email) {
      showSaveError();
      return;
    }

    try {
      // Reauthenticate before changing: verify the current password so a borrowed
      // or hijacked session can't silently change it. Forgot-password users go
      // through the email reset flow (/auth/confirm) instead, which needs no old
      // password.
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email,
        password: security.currentPassword,
      });
      if (reauthErr) {
        showSaveError('Current password is incorrect.');
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({
        password: security.newPassword,
      });
      if (updateErr) {
        showSaveError(updateErr.message);
        return;
      }

      setSecurity((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
      showSaved();
    } catch {
      showSaveError();
    }
  };

  const compressImage = (file, cb) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        cb(canvas.toDataURL('image/png', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async (file) => {
    if (!file || !user) return;
    setLogoUploading(true);
    compressImage(file, async (dataUrl) => {
      try {
        const { data: existing } = await supabase
          .from('business_settings')
          .select('setup_data')
          .eq('owner_id', user.id)
          .single();
        const sd = existing?.setup_data ?? {};
        await supabase
          .from('business_settings')
          .upsert(
            { owner_id: user.id, setup_data: { ...sd, logo_url: dataUrl } },
            { onConflict: 'owner_id' }
          );
        setLogoUrl(dataUrl);
        showSaved();
      } catch {
        /* ignore */
      }
      setLogoUploading(false);
    });
  };

  const handleLogoRemove = async () => {
    if (!user) return;
    try {
      const { data: existing } = await supabase
        .from('business_settings')
        .select('setup_data')
        .eq('owner_id', user.id)
        .single();
      const sd = { ...(existing?.setup_data ?? {}) };
      delete sd.logo_url;
      await supabase
        .from('business_settings')
        .upsert({ owner_id: user.id, setup_data: sd }, { onConflict: 'owner_id' });
      setLogoUrl('');
      showSaved();
    } catch {
      /* ignore */
    }
  };

  const updateProfileField = (f, v) => setProfile((p) => ({ ...p, [f]: v }));
  const updateBusiness = (f, v) => setBusiness((b) => ({ ...b, [f]: v }));
  const updateNotif = (f, v) => setNotifications((n) => ({ ...n, [f]: v }));
  const updateSecurity = (f, v) => setSecurity((s) => ({ ...s, [f]: v }));
  const updateCompliance = (f, v) => setCompliance((c) => ({ ...c, [f]: v }));
  const toggleDay = (day) =>
    setBusiness((b) => ({
      ...b,
      workingDays: { ...b.workingDays, [day]: !b.workingDays[day] },
    }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#010a4f]">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-[#99c5ff]/20 w-full">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === id
                ? 'bg-[#1f48ff] text-white shadow-sm'
                : 'text-gray-500 hover:text-[#010a4f]'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="space-y-5">
          {/* Avatar */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl bg-[#1f48ff] flex items-center justify-center text-white font-black text-2xl flex-shrink-0">
                {profile.avatar}
              </div>
              <div>
                <p className="font-bold text-[#010a4f] text-lg">
                  {profile.firstName} {profile.lastName}
                </p>
                <p className="text-sm text-gray-400">{profile.email}</p>
                <button className="mt-2 text-xs font-bold text-[#1f48ff] hover:underline">
                  Change photo
                </button>
              </div>
            </div>
          </div>

          {/* Business Logo */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6">
            <h3 className="font-bold text-[#010a4f] mb-1">Business Logo</h3>
            <p className="text-xs text-gray-400 mb-4">
              Appears in the sidebar, on invoices and quotes. Square or circular logos look best.
            </p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Business logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-2xl">🖼️</span>
                )}
              </div>
              <div className="space-y-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#1f48ff] text-white text-xs font-bold rounded-xl hover:bg-[#010a4f] transition-colors">
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]);
                    }}
                    disabled={logoUploading}
                  />
                </label>
                {logoUrl && (
                  <button
                    onClick={handleLogoRemove}
                    className="block text-xs font-semibold text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove logo
                  </button>
                )}
                <p className="text-[10px] text-gray-400">PNG, JPG or SVG · max 256px stored</p>
              </div>
            </div>
          </div>

          {/* Profile form */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Personal Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="First Name"
                value={profile.firstName}
                onChange={(v) => updateProfileField('firstName', v)}
                placeholder="First name"
              />
              <InputField
                label="Last Name"
                value={profile.lastName}
                onChange={(v) => updateProfileField('lastName', v)}
                placeholder="Last name"
              />
            </div>
            <div>
              <InputField
                label="Email Address"
                value={profile.email}
                type="email"
                onChange={(v) => updateProfileField('email', v)}
                placeholder="you@example.com"
              />
              {profile.email !== user?.email && (
                <p className="text-xs text-amber-600 mt-1.5">
                  We'll send a confirmation link to this address — the change won't take effect
                  until you click it.
                </p>
              )}
              {profile.email === user?.email && (
                <p className="text-xs text-gray-400 mt-1.5">
                  This is the email address you use to log in. Wrong address? Change it here and
                  save.
                </p>
              )}
            </div>
            <InputField
              label="Phone Number"
              value={profile.phone}
              type="tel"
              onChange={(v) => updateProfileField('phone', v)}
              placeholder="07700 000000"
            />
            <button
              onClick={handleProfileSave}
              className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>

          <Section
            title="Cadi Community"
            desc="Controls whether your business appears on the public leaderboard"
          >
            <SettingRow
              icon={Sparkles}
              label={communityOptIn ? 'Community member' : 'Join the community'}
              desc={
                communityOptIn
                  ? `${business.name || 'Your business'} is visible to other Cadi users`
                  : 'Share your business name, sector, region and health score on the leaderboard'
              }
            >
              <Toggle enabled={communityOptIn} onChange={handleCommunityToggle} />
            </SettingRow>
          </Section>
        </div>
      )}

      {/* ── BUSINESS TAB ── */}
      {activeTab === 'business' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Business Details</h3>
            <InputField
              label="Business Name"
              value={business.name}
              onChange={(v) => updateBusiness('name', v)}
              placeholder="Your business name"
            />
            <InputField
              label="Tagline"
              value={business.tagline}
              onChange={(v) => updateBusiness('tagline', v)}
              placeholder="What you do in one line"
            />
            <InputField
              label="Business Address"
              value={business.address}
              onChange={(v) => updateBusiness('address', v)}
              placeholder="Town, County"
            />
            <InputField
              label="Website"
              value={business.website}
              onChange={(v) => updateBusiness('website', v)}
              placeholder="www.yourbusiness.co.uk"
            />
          </div>

          {/* Business Structure */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Business Structure</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Entity Type</label>
              <select
                value={business.entityType}
                onChange={(e) => updateBusiness('entityType', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff]"
              >
                <option value="sole_trader">Sole Trader</option>
                <option value="limited_company">Limited Company</option>
                <option value="partnership">Partnership</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                This determines how Cadi calculates your tax estimates and what HMRC filings apply.
              </p>
            </div>

            {business.entityType === 'limited_company' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Companies House Number"
                    value={business.companyNumber}
                    onChange={(v) => updateBusiness('companyNumber', v)}
                    placeholder="e.g. 12345678"
                  />
                  <InputField
                    label="Corporation Tax UTR"
                    value={business.corporationTaxUtr}
                    onChange={(v) => updateBusiness('corporationTaxUtr', v)}
                    placeholder="10-digit UTR"
                  />
                </div>
                {/* Director 1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Director 1 Name"
                    value={business.director1Name}
                    onChange={(v) => updateBusiness('director1Name', v)}
                    placeholder="e.g. Jane Smith"
                  />
                  <InputField
                    label="Director 1 Salary (annual, £)"
                    value={business.directorSalary}
                    type="number"
                    onChange={(v) => updateBusiness('directorSalary', v)}
                    placeholder="e.g. 12570"
                  />
                </div>

                {/* Director 2 — toggle */}
                {!business.director2Name && !business.director2Salary ? (
                  <button
                    type="button"
                    onClick={() => updateBusiness('director2Name', ' ')}
                    className="text-xs font-semibold text-[#1f48ff] hover:underline text-left"
                  >
                    + Add second director
                  </button>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                    <InputField
                      label="Director 2 Name"
                      value={business.director2Name.trim()}
                      onChange={(v) => updateBusiness('director2Name', v)}
                      placeholder="e.g. John Smith"
                    />
                    <InputField
                      label="Director 2 Salary (annual, £)"
                      value={business.director2Salary}
                      type="number"
                      onChange={(v) => updateBusiness('director2Salary', v)}
                      placeholder="e.g. 12570"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateBusiness('director2Name', '');
                        updateBusiness('director2Salary', '');
                      }}
                      className="text-xs text-gray-400 hover:text-red-500 text-left col-span-full"
                    >
                      Remove second director
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="hidden sm:block" />
                  {/* spacer */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Accounting Year End Month
                    </label>
                    <select
                      value={business.accountingYearEndMonth}
                      onChange={(e) => updateBusiness('accountingYearEndMonth', e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff]"
                    >
                      {[
                        'January',
                        'February',
                        'March',
                        'April',
                        'May',
                        'June',
                        'July',
                        'August',
                        'September',
                        'October',
                        'November',
                        'December',
                      ].map((m, i) => (
                        <option key={m} value={String(i + 1)}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* VAT Details */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">VAT Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="VAT Registration Number (VRN)"
                value={business.vatNumber}
                onChange={(v) => updateBusiness('vatNumber', v)}
                placeholder="GB 123 4567 89"
              />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">VAT Scheme</label>
                <select
                  value={business.vatScheme}
                  onChange={(e) => updateBusiness('vatScheme', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff]"
                >
                  <option value="none">Not VAT registered</option>
                  <option value="standard">Standard rate</option>
                  <option value="flat_rate">Flat Rate Scheme (FRS)</option>
                  <option value="cash">Cash Accounting</option>
                  <option value="annual">Annual Accounting</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              VAT return submission to HMRC coming soon — we'll use these details when it launches.
            </p>
          </div>

          {/* Business email + postcode */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Contact & Location</h3>
            <InputField
              label="Business Email (for invoice reply-to)"
              value={business.businessEmail || ''}
              onChange={(v) => updateBusiness('businessEmail', v)}
              placeholder="invoices@yourbusiness.co.uk"
            />
            <InputField
              label="Home / Business Postcode (for route planning)"
              value={business.homePostcode || ''}
              onChange={(v) => updateBusiness('homePostcode', v)}
              placeholder="e.g. SW12 8AA"
            />
          </div>

          {/* Bank details */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Bank Details (shown on invoices)</h3>
            <div className="fs-exclude">
              <InputField
                label="Bank Name"
                value={business.bankName || ''}
                onChange={(v) => updateBusiness('bankName', v)}
                placeholder="e.g. Starling Bank"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Sort Code"
                  value={business.sortCode || ''}
                  onChange={(v) => updateBusiness('sortCode', v)}
                  placeholder="e.g. 60-83-71"
                />
                <InputField
                  label="Account Number"
                  value={business.accountNum || ''}
                  onChange={(v) => updateBusiness('accountNum', v)}
                  placeholder="e.g. 12345678"
                />
              </div>
            </div>
          </div>

          {/* Rates */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Rates & Currency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Default Hourly Rate (£)"
                value={business.hourlyRate}
                type="number"
                onChange={(v) => updateBusiness('hourlyRate', v)}
                placeholder="15"
              />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Currency</label>
                <select
                  value={business.currency}
                  onChange={(e) => updateBusiness('currency', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff]"
                >
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Working days */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Working Hours</h3>
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Working Days</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(business.workingDays).map(([day, active]) => (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                      active
                        ? 'bg-[#1f48ff] text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label="Start Time"
                value={business.startTime}
                type="time"
                onChange={(v) => updateBusiness('startTime', v)}
              />
              <InputField
                label="End Time"
                value={business.endTime}
                type="time"
                onChange={(v) => updateBusiness('endTime', v)}
              />
            </div>
            <button
              onClick={handleBusinessSave}
              className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── PRICING TAB ── */}
      {activeTab === 'pricing' && <PricingSettings />}

      {/* ── AGENTS TAB ── */}
      {activeTab === 'agents' && <AgentSettings />}

      {/* ── FRONT DESK TAB ── */}
      {activeTab === 'front_desk' && <FrontDeskSettings />}

      {/* ── REVIEWS TAB ── */}
      {activeTab === 'reviews' && <ReviewsSettings />}

      {/* ── COMPLIANCE TAB ── */}
      {activeTab === 'compliance' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-1">
            <h3 className="font-bold text-[#010a4f]">Compliance &amp; Certificates</h3>
            <p className="text-xs text-gray-400">
              Keep a record of your insurance and regulatory documents. These are for your reference
              only — Cadi doesn't verify or store document files.
            </p>
          </div>

          {/* Public Liability Insurance */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#f0f4ff] flex items-center justify-center shrink-0">
                  <Shield size={15} className="text-[#1f48ff]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#010a4f]">Public Liability Insurance</p>
                  <p className="text-xs text-gray-400">
                    Required for most commercial cleaning contracts
                  </p>
                </div>
              </div>
              <Toggle enabled={compliance.pli} onChange={(v) => updateCompliance('pli', v)} />
            </div>
            {compliance.pli && (
              <div className="px-6 py-4 space-y-4">
                <InputField
                  label="Policy Number"
                  value={compliance.pliPolicy}
                  onChange={(v) => updateCompliance('pliPolicy', v)}
                  placeholder="e.g. PLI-0000000"
                />
                <InputField
                  label="Renewal Date"
                  value={compliance.pliRenewal}
                  onChange={(v) => updateCompliance('pliRenewal', v)}
                  type="date"
                />
              </div>
            )}
          </div>

          {/* DBS Check */}
          <Section
            title="DBS Check"
            desc="Disclosure and Barring Service check — required for some domestic clients"
          >
            <SettingRow
              icon={CheckCircle}
              label="DBS Check completed"
              desc="You hold a valid DBS certificate"
            >
              <Toggle enabled={compliance.dbs} onChange={(v) => updateCompliance('dbs', v)} />
            </SettingRow>
          </Section>

          {/* ICO Registration */}
          <Section
            title="ICO Registration"
            desc="Required if you store personal data about clients or staff"
          >
            <SettingRow
              icon={Globe}
              label="Registered with ICO"
              desc="Information Commissioner's Office data registration"
            >
              <Toggle enabled={compliance.ico} onChange={(v) => updateCompliance('ico', v)} />
            </SettingRow>
          </Section>

          {/* COSHH */}
          <Section
            title="COSHH Awareness"
            desc="Control of Substances Hazardous to Health — handling cleaning chemicals safely"
          >
            <SettingRow
              icon={AlertCircle}
              label="COSHH training completed"
              desc="You understand safe handling of cleaning products"
            >
              <Toggle enabled={compliance.coshh} onChange={(v) => updateCompliance('coshh', v)} />
            </SettingRow>
          </Section>

          <button
            onClick={handleComplianceSave}
            className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
          >
            <Save size={14} /> Save Compliance
          </button>
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <Section title="Job Reminders" desc="Get notified about upcoming and overdue jobs">
            {[
              {
                key: 'jobReminders',
                label: 'Job Reminders',
                desc: '24 hours before each scheduled job',
                icon: Bell,
              },
              {
                key: 'invoiceOverdue',
                label: 'Invoice Overdue Alerts',
                desc: 'When an invoice is 7, 14 or 30 days overdue',
                icon: AlertCircle,
              },
              {
                key: 'clientFollowUp',
                label: 'Client Follow-Up Reminders',
                desc: 'Nudges to check in with lapsed clients',
                icon: User,
              },
              {
                key: 'weeklyReport',
                label: 'Weekly Summary',
                desc: 'Monday morning overview of the week ahead',
                icon: CheckCircle,
              },
            ].map(({ key, label, desc, icon }) => (
              <SettingRow key={key} icon={icon} label={label} desc={desc}>
                <Toggle enabled={notifications[key]} onChange={(v) => updateNotif(key, v)} />
              </SettingRow>
            ))}
          </Section>

          <Section title="Monthly reports" desc="Owner digests sent on the 1st of each month">
            <SettingRow
              icon={Mail}
              label="Monthly email reports"
              desc="Your finance summary + customer pulse, delivered to your inbox on the 1st. Turn off anytime."
            >
              <Toggle
                enabled={emailReports}
                onChange={handleEmailReportsToggle}
                disabled={emailReportsSaving}
              />
            </SettingRow>
          </Section>

          <Section title="Communication" desc="How we reach you">
            {[
              {
                key: 'appPush',
                label: 'App Notifications',
                desc: 'In-app alerts and badges',
                icon: Bell,
              },
              {
                key: 'smsReminders',
                label: 'SMS Reminders',
                desc: 'Text message alerts (Pro only)',
                icon: Phone,
              },
              {
                key: 'newFeatures',
                label: 'New Features',
                desc: 'When we release something new',
                icon: Sparkles,
              },
              {
                key: 'marketingEmails',
                label: 'Marketing Emails',
                desc: 'Tips, offers and cleaning business content',
                icon: Mail,
              },
            ].map(({ key, label, desc, icon }) => (
              <SettingRow key={key} icon={icon} label={label} desc={desc}>
                <Toggle enabled={notifications[key]} onChange={(v) => updateNotif(key, v)} />
              </SettingRow>
            ))}
          </Section>

          <button
            onClick={handleNotificationsSave}
            className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
          >
            <Save size={14} /> Save Notification Settings
          </button>
        </div>
      )}

      {/* ── SUBSCRIPTION TAB ── */}
      {activeTab === 'subscription' && (
        <div className="space-y-5">
          {upgradeSuccess && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/15 border border-green-500/25 text-green-300 text-sm font-medium">
              <CheckCircle size={18} className="shrink-0" />
              Welcome to Cadi Pro! Your subscription is active.
            </div>
          )}

          {isPro ? (
            /* Active subscription */
            <div className="bg-[#010a4f] rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-1">
                    Current Plan
                  </p>
                  <p className="text-2xl font-black">Cadi Pro · £{priceMonthly}/month</p>
                </div>
                <div className="w-12 h-12 bg-[#1f48ff] rounded-xl flex items-center justify-center">
                  <CreditCard size={22} className="text-white" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {[
                  'Unlimited customers',
                  'HMRC MTD',
                  'Invoicing',
                  'Staff management',
                  'Business Lab',
                ].map((f) => (
                  <span
                    key={f}
                    className="text-xs px-3 py-1.5 bg-white/10 rounded-full text-white/70"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <BillingPortalButton />
            </div>
          ) : (
            /* Free user — prompt to upgrade */
            <div className="bg-[#010a4f] rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-1">
                    Current Plan
                  </p>
                  <p className="text-2xl font-black">Free</p>
                </div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <CreditCard size={22} className="text-white/50" />
                </div>
              </div>
              <p className="text-[rgba(153,197,255,0.6)] text-sm mb-5">
                Upgrade to Cadi Pro to unlock all features for £{priceMonthly}/month.
              </p>
              <button
                onClick={() => startProCheckout()}
                className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-bold text-sm rounded-xl transition-colors"
              >
                Subscribe — £{priceMonthly}/month
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div className="space-y-5">
          {/* Change password */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Change Password</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={security.currentPassword}
                  onChange={(e) => updateSecurity('currentPassword', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff] pr-10"
                />
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#010a4f]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <InputField
              label="New Password"
              value={security.newPassword}
              type="password"
              onChange={(v) => updateSecurity('newPassword', v)}
              placeholder="Min 8 characters"
            />
            <InputField
              label="Confirm New Password"
              value={security.confirmPassword}
              type="password"
              onChange={(v) => updateSecurity('confirmPassword', v)}
              placeholder="Repeat new password"
            />
            <button
              onClick={handlePasswordUpdate}
              className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
            >
              <Save size={14} /> Update Password
            </button>
          </div>

          {/* Two factor */}
          <Section title="Two-Factor Authentication" desc="Extra security for your account">
            <SettingRow icon={Shield} label="Enable 2FA" desc="Require a code when signing in">
              <Toggle
                enabled={security.twoFactor}
                onChange={(v) => updateSecurity('twoFactor', v)}
              />
            </SettingRow>
          </Section>

          {/* Data */}
          <Section
            title="Your Data"
            desc="Export or delete your account data (UK GDPR Article 15 & 17)"
          >
            <SettingRow
              icon={Cookie}
              label="Cookie preferences"
              desc="Choose whether to allow anonymised session replay (FullStory)"
            >
              <CookiePreferencesToggle />
            </SettingRow>
            <SettingRow
              icon={Download}
              label="Export All Data"
              desc="Download a complete copy of everything we hold on you (JSON)"
            >
              <ExportDataButton />
            </SettingRow>
            <SettingRow icon={LogOut} label="Sign Out" desc="Sign out of this device">
              <button
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }}
                className="text-xs font-bold px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-400 transition-colors"
              >
                Sign Out
              </button>
            </SettingRow>
            <SettingRow
              icon={Trash2}
              label="Delete Account"
              desc="Permanently delete your account and all data"
              danger
            >
              <DeleteAccountButton
                onDeleted={() => {
                  signOut();
                  navigate('/login');
                }}
              />
            </SettingRow>
          </Section>
        </div>
      )}

      {/* ── INTEGRATIONS TAB ── */}
      {activeTab === 'integrations' && (
        <div className="space-y-5">
          {/* GoCardless Payments */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f0f4ff] flex items-center justify-center text-xl shrink-0">
                🏦
              </div>
              <div>
                <h3 className="font-bold text-[#010a4f]">GoCardless — Direct Debit collection</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Collect payments from your customers by Direct Debit · 1% + 20p, max £4 per
                  transaction
                </p>
              </div>
              {gcStatus?.sandbox && (
                <span className="ml-auto shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 border border-amber-200">
                  Sandbox
                </span>
              )}
            </div>

            <div className="p-6 space-y-5">
              {/* Connection status */}
              {gcStatus === null ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#1f48ff] animate-spin" />
                  Checking connection…
                </div>
              ) : gcStatus.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 border border-green-100">
                    <div className="w-8 h-8 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                      <CheckCircle size={15} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-green-800">GoCardless connected</p>
                      <p className="text-xs text-green-600 mt-0.5 font-mono truncate">
                        Org: {gcStatus.organisationId ?? '—'}
                      </p>
                    </div>
                    {confirmGcDisconnect ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-500">Sure?</span>
                        <button
                          onClick={handleGcDisconnect}
                          disabled={gcLoading}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-40"
                        >
                          Yes, disconnect
                        </button>
                        <button
                          onClick={() => setConfirmGcDisconnect(false)}
                          className="px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmGcDisconnect(true)}
                        disabled={gcLoading}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                      >
                        <Unlink size={12} />
                        Disconnect
                      </button>
                    )}
                  </div>

                  {/* Customer payment link */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">
                      Send this link to customers to set up their Direct Debit mandate:
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-mono text-gray-500 truncate">
                        Use "Set up Direct Debit" button on each customer's profile
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText('https://app.cadi.cleaning/customers');
                          setGcCopied(true);
                          setTimeout(() => setGcCopied(false), 2000);
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-xl hover:bg-[#1f48ff]/5 transition-colors"
                      >
                        <Copy size={12} />
                        {gcCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* What's enabled */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: '🔗', label: 'Mandate links', desc: 'Send setup links to customers' },
                      {
                        icon: '💸',
                        label: 'One-off collection',
                        desc: 'Collect against any invoice',
                      },
                      {
                        icon: '🔄',
                        label: 'Auto status sync',
                        desc: 'Invoices marked paid automatically',
                      },
                    ].map((f) => (
                      <div
                        key={f.label}
                        className="p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]"
                      >
                        <div className="text-lg mb-1">{f.icon}</div>
                        <p className="text-xs font-bold text-[#010a4f]">{f.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    Connect your GoCardless account to start collecting Direct Debit payments from
                    your customers. Money goes straight to your bank — Cadi never touches it.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      {
                        icon: '⚡',
                        label: 'One-click collection',
                        desc: 'Tick off jobs and collect with one click',
                      },
                      {
                        icon: '🏦',
                        label: 'Direct to your bank',
                        desc: 'Funds clear directly, no middleman',
                      },
                      {
                        icon: '📧',
                        label: 'Email mandate links',
                        desc: 'Customers set up DD in 2 minutes',
                      },
                      {
                        icon: '✅',
                        label: 'Auto invoice updates',
                        desc: 'Invoices marked paid when DD clears',
                      },
                    ].map((f) => (
                      <div
                        key={f.label}
                        className="flex items-start gap-3 p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]"
                      >
                        <span className="text-lg shrink-0">{f.icon}</span>
                        <div>
                          <p className="text-xs font-bold text-[#010a4f]">{f.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-1">
                    <button
                      onClick={handleGcConnect}
                      disabled={gcLoading}
                      className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] hover:bg-[#010a4f] text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Link size={14} />
                      {gcLoading ? 'Redirecting…' : 'Connect GoCardless account'}
                    </button>
                    <p className="text-xs text-gray-400">
                      You'll need a GoCardless merchant account.{' '}
                      <a
                        href="https://gocardless.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#1f48ff] hover:underline font-semibold"
                      >
                        Sign up free →
                      </a>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Open Banking (coming soon) */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden opacity-70">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#f0f4ff] flex items-center justify-center text-xl shrink-0">
                📊
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-[#010a4f]">
                  Open Banking — auto-import transactions
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Connect your business bank account · zero manual entry · instant categorisation
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-[#1f48ff]/10 text-[#1f48ff] border border-[#1f48ff]/20">
                Coming soon
              </span>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-400">
                Auto-import your bank transactions, match them to invoices, and categorise expenses
                — all without manual entry.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && <TeamTab user={user} />}

      {/* Saved toast */}
      <SavedToast show={saved} />

      {/* Error toast */}
      {saveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] px-5 py-3 rounded-xl bg-red-600 border border-red-500 text-white text-sm font-semibold shadow-2xl flex items-center gap-2">
          ⚠ {saveError}
        </div>
      )}
    </div>
  );
}
