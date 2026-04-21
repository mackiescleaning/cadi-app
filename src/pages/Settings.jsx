import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { supabase } from '../lib/supabase';
import { getBusinessSettings, upsertBusinessSettings } from '../lib/db/settingsDb';
import {
  User, Building2, Bell, Lock, CreditCard, Palette,
  ChevronRight, Save, Check, Eye, EyeOff, Sparkles,
  LogOut, Trash2, Download, Shield, Phone, Mail,
  MapPin, Globe, Clock, PoundSterling, ToggleLeft,
  ToggleRight, AlertCircle, CheckCircle
} from 'lucide-react';

// ─── TOGGLE ───────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-[#1f48ff]' : 'bg-gray-200'
      }`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`} />
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
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          danger ? 'bg-red-100' : 'bg-[#f0f4ff]'
        }`}>
          <Icon size={15} className={danger ? 'text-red-500' : 'text-[#1f48ff]'} />
        </div>
        <div className="min-w-0">
          <p className={`text-sm font-semibold ${danger ? 'text-red-500' : 'text-[#010a4f]'}`}>{label}</p>
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
        onChange={e => onChange(e.target.value)}
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

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'business', label: 'Business', icon: Building2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'subscription', label: 'Plan', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Lock },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile: authProfile, updateProfile, signOut } = useAuth();
  const { isPro, priceMonthly } = usePlan();
  const [activeTab, setActiveTab] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Profile state — no hardcoded defaults; populated from Supabase in useEffect
  const [profile, setProfile] = useState({
    firstName: '', lastName: '',
    email: '', phone: '', avatar: '',
  });

  // Business state — name populated from Supabase in useEffect
  const [business, setBusiness] = useState({
    name: '', tagline: '',
    address: '', website: '',
    vatNumber: '', companyNumber: '',
    hourlyRate: '', currency: 'GBP',
    businessEmail: '', homePostcode: '',
    bankName: '', sortCode: '', accountNum: '',
    workingDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    startTime: '08:00', endTime: '18:00',
  });

  // Notification state
  const [notifications, setNotifications] = useState({
    jobReminders: true, invoiceOverdue: true,
    clientFollowUp: true, weeklyReport: true,
    newFeatures: false, marketingEmails: false,
    smsReminders: false, appPush: true,
  });

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '', newPassword: '', confirmPassword: '',
    twoFactor: false,
  });

  useEffect(() => {
    if (!authProfile && !user) return;

    setProfile((prev) => ({
      ...prev,
      firstName: authProfile?.first_name ?? prev.firstName,
      lastName:  authProfile?.last_name  ?? prev.lastName,
      email:     user?.email             ?? prev.email,
      phone:     authProfile?.phone      ?? prev.phone,
      avatar:    authProfile?.first_name?.[0]?.toUpperCase() ?? prev.avatar,
    }));

    if (authProfile?.business_name) {
      setBusiness((prev) => ({ ...prev, name: authProfile.business_name }));
    }
  }, [authProfile, user]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const settings = await getBusinessSettings();
        if (!mounted || !settings) return;

        const bd = settings.bank_details || {};
        const sd = settings.setup_data || {};
        setBusiness((prev) => ({
          ...prev,
          hourlyRate: settings.hourly_rate != null ? String(settings.hourly_rate) : prev.hourlyRate,
          currency: settings.currency || prev.currency,
          businessEmail: settings.business_email || sd.business_email || prev.businessEmail,
          homePostcode: authProfile?.home_postcode || authProfile?.postcode || prev.homePostcode,
          bankName: bd.bankName || prev.bankName,
          sortCode: bd.sortCode || prev.sortCode,
          accountNum: bd.accountNum || prev.accountNum,
          workingDays: sd.working_days || prev.workingDays,
          startTime: sd.start_time || prev.startTime,
          endTime: sd.finish_time || prev.endTime,
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
  }, []);

  const showSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleProfileSave = async () => {
    try {
      await updateProfile({
        first_name: profile.firstName,
        last_name:  profile.lastName,
        phone: profile.phone,
        business_name: business.name,
      });

      if (user?.email && profile.email && user.email !== profile.email) {
        await supabase.auth.updateUser({ email: profile.email });
      }

      showSaved();
    } catch {
      // Keep UI editable even if save fails.
    }
  };

  const handleBusinessSave = async () => {
    try {
      await upsertBusinessSettings({
        hourly_rate: Number(business.hourlyRate) || 0,
        currency: business.currency,
        business_email: business.businessEmail,
        bank_details: { bankName: business.bankName, sortCode: business.sortCode, accountNum: business.accountNum },
        setup_data: {
          working_days: business.workingDays,
          start_time: business.startTime,
          finish_time: business.endTime,
        },
      });

      await updateProfile({
        business_name: business.name,
        home_postcode: business.homePostcode,
        postcode: business.homePostcode,
      });
      showSaved();
    } catch {
      // Keep local values when persistence fails.
    }
  };

  const handleNotificationsSave = async () => {
    try {
      await upsertBusinessSettings({ notifications });
      showSaved();
    } catch {
      // Keep local values when persistence fails.
    }
  };

  const handlePasswordUpdate = async () => {
    if (!security.newPassword || security.newPassword !== security.confirmPassword) return;

    try {
      await supabase.auth.updateUser({ password: security.newPassword });
      setSecurity((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      showSaved();
    } catch {
      // Ignore errors and keep form values for retry.
    }
  };

  const updateProfileField = (f, v) => setProfile(p => ({ ...p, [f]: v }));
  const updateBusiness = (f, v) => setBusiness(b => ({ ...b, [f]: v }));
  const updateNotif = (f, v) => setNotifications(n => ({ ...n, [f]: v }));
  const updateSecurity = (f, v) => setSecurity(s => ({ ...s, [f]: v }));
  const toggleDay = (day) => setBusiness(b => ({
    ...b, workingDays: { ...b.workingDays, [day]: !b.workingDays[day] }
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#010a4f]">Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar bg-white p-1.5 rounded-2xl shadow-sm border border-[#99c5ff]/20 w-fit max-w-full">
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
                <p className="font-bold text-[#010a4f] text-lg">{profile.firstName} {profile.lastName}</p>
                <p className="text-sm text-gray-400">{profile.email}</p>
                <button className="mt-2 text-xs font-bold text-[#1f48ff] hover:underline">
                  Change photo
                </button>
              </div>
            </div>
          </div>

          {/* Profile form */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Personal Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="First Name" value={profile.firstName}
                onChange={v => updateProfileField('firstName', v)} placeholder="First name" />
              <InputField label="Last Name" value={profile.lastName}
                onChange={v => updateProfileField('lastName', v)} placeholder="Last name" />
            </div>
            <InputField label="Email Address" value={profile.email} type="email"
              onChange={v => updateProfileField('email', v)} placeholder="you@example.com" />
            <InputField label="Phone Number" value={profile.phone} type="tel"
              onChange={v => updateProfileField('phone', v)} placeholder="07700 000000" />
            <button
              onClick={handleProfileSave}
              className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>
        </div>
      )}

      {/* ── BUSINESS TAB ── */}
      {activeTab === 'business' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Business Details</h3>
            <InputField label="Business Name" value={business.name}
              onChange={v => updateBusiness('name', v)} placeholder="Your business name" />
            <InputField label="Tagline" value={business.tagline}
              onChange={v => updateBusiness('tagline', v)} placeholder="What you do in one line" />
            <InputField label="Business Address" value={business.address}
              onChange={v => updateBusiness('address', v)} placeholder="Town, County" />
            <InputField label="Website" value={business.website}
              onChange={v => updateBusiness('website', v)} placeholder="www.yourbusiness.co.uk" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="VAT Number (if registered)" value={business.vatNumber}
                onChange={v => updateBusiness('vatNumber', v)} placeholder="GB000000000" />
              <InputField label="Company Number" value={business.companyNumber}
                onChange={v => updateBusiness('companyNumber', v)} placeholder="Optional" />
            </div>
          </div>

          {/* Business email + postcode */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Contact & Location</h3>
            <InputField label="Business Email (for invoice reply-to)" value={business.businessEmail || ''}
              onChange={v => updateBusiness('businessEmail', v)} placeholder="invoices@yourbusiness.co.uk" />
            <InputField label="Home / Business Postcode (for route planning)" value={business.homePostcode || ''}
              onChange={v => updateBusiness('homePostcode', v)} placeholder="e.g. SW12 8AA" />
          </div>

          {/* Bank details */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Bank Details (shown on invoices)</h3>
            <InputField label="Bank Name" value={business.bankName || ''}
              onChange={v => updateBusiness('bankName', v)} placeholder="e.g. Starling Bank" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Sort Code" value={business.sortCode || ''}
                onChange={v => updateBusiness('sortCode', v)} placeholder="e.g. 60-83-71" />
              <InputField label="Account Number" value={business.accountNum || ''}
                onChange={v => updateBusiness('accountNum', v)} placeholder="e.g. 12345678" />
            </div>
          </div>

          {/* Rates */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Rates & Currency</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Default Hourly Rate (£)" value={business.hourlyRate} type="number"
                onChange={v => updateBusiness('hourlyRate', v)} placeholder="15" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Currency</label>
                <select
                  value={business.currency}
                  onChange={e => updateBusiness('currency', e.target.value)}
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
              <InputField label="Start Time" value={business.startTime} type="time"
                onChange={v => updateBusiness('startTime', v)} />
              <InputField label="End Time" value={business.endTime} type="time"
                onChange={v => updateBusiness('endTime', v)} />
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

      {/* ── NOTIFICATIONS TAB ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <Section title="Job Reminders" desc="Get notified about upcoming and overdue jobs">
            {[
              { key: 'jobReminders', label: 'Job Reminders', desc: '24 hours before each scheduled job', icon: Bell },
              { key: 'invoiceOverdue', label: 'Invoice Overdue Alerts', desc: 'When an invoice is 7, 14 or 30 days overdue', icon: AlertCircle },
              { key: 'clientFollowUp', label: 'Client Follow-Up Reminders', desc: 'Nudges to check in with lapsed clients', icon: User },
              { key: 'weeklyReport', label: 'Weekly Summary', desc: 'Monday morning overview of the week ahead', icon: CheckCircle },
            ].map(({ key, label, desc, icon }) => (
              <SettingRow key={key} icon={icon} label={label} desc={desc}>
                <Toggle enabled={notifications[key]} onChange={v => updateNotif(key, v)} />
              </SettingRow>
            ))}
          </Section>

          <Section title="Communication" desc="How we reach you">
            {[
              { key: 'appPush', label: 'App Notifications', desc: 'In-app alerts and badges', icon: Bell },
              { key: 'smsReminders', label: 'SMS Reminders', desc: 'Text message alerts (Pro only)', icon: Phone },
              { key: 'newFeatures', label: 'New Features', desc: 'When we release something new', icon: Sparkles },
              { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Tips, offers and cleaning business content', icon: Mail },
            ].map(({ key, label, desc, icon }) => (
              <SettingRow key={key} icon={icon} label={label} desc={desc}>
                <Toggle enabled={notifications[key]} onChange={v => updateNotif(key, v)} />
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

          {/* Current plan */}
          <div className="bg-[#010a4f] rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-1">Current Plan</p>
                <p className="text-2xl font-black">Free Plan</p>
              </div>
              <div className="w-12 h-12 bg-[#1f48ff] rounded-xl flex items-center justify-center">
                <CreditCard size={22} className="text-white" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {['Pricing Calculator', 'Up to 20 Clients', 'Basic Scheduler', '15 Jobs Max'].map(f => (
                <span key={f} className="text-xs px-3 py-1.5 bg-white/10 rounded-full text-white/70">{f}</span>
              ))}
            </div>
            <button onClick={() => navigate('/upgrade')} className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-white hover:text-[#010a4f] transition-colors">
              Upgrade to Pro — £{priceMonthly}/month
            </button>
          </div>

          {/* Pro plan */}
          <div className="bg-white rounded-2xl shadow-sm border-2 border-[#1f48ff] overflow-hidden">
            <div className="px-6 py-3 bg-[#1f48ff]">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-white" />
                <p className="text-xs font-bold text-white uppercase tracking-wide">Recommended</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-end gap-2 mb-1">
                <p className="text-3xl font-black text-[#010a4f]">£59</p>
                <p className="text-gray-400 mb-1">/month</p>
              </div>
              <p className="text-sm text-gray-500 mb-5">Save 30% with annual billing — £590/year (save £118)</p>
              <div className="space-y-2 mb-6">
                {[
                  'Unlimited clients & jobs',
                  'Route planner & optimisation',
                  'Invoice generator & tracker',
                  'Full money tracker & P&L',
                  'Business Lab tools',
                  'Team & staff management',
                  'Training plan builder',
                  'Annual accounts summary',
                  'SMS reminders',
                  'Priority support',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-[#1f48ff] flex-shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </div>
                ))}
              </div>
              <button className="w-full py-3 bg-[#1f48ff] text-white font-bold rounded-xl hover:bg-[#010a4f] transition-colors">
                Upgrade to Pro
              </button>
            </div>
          </div>

          {/* Bundle */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#f0f4ff] rounded-xl flex items-center justify-center flex-shrink-0">
                <PoundSterling size={20} className="text-[#1f48ff]" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-[#010a4f]">Planner + Pro Bundle</p>
                <p className="text-sm text-gray-500 mt-0.5 mb-3">Physical hardback planner + 12 months Pro access. Best value.</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-[#1f48ff]">£79</span>
                  <span className="text-sm text-gray-400 line-through">£108</span>
                  <span className="text-xs font-bold px-2.5 py-1 bg-green-100 text-green-700 rounded-full">Save £29</span>
                </div>
              </div>
            </div>
            <button className="w-full mt-4 py-3 border-2 border-[#1f48ff] text-[#1f48ff] font-bold rounded-xl hover:bg-[#1f48ff] hover:text-white transition-colors">
              Get the Bundle
            </button>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === 'security' && (
        <div className="space-y-5">

          {/* Change password */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6 space-y-4">
            <h3 className="font-bold text-[#010a4f]">Change Password</h3>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={security.currentPassword}
                  onChange={e => updateSecurity('currentPassword', e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#1f48ff] pr-10"
                />
                <button
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#010a4f]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <InputField label="New Password" value={security.newPassword} type="password"
              onChange={v => updateSecurity('newPassword', v)} placeholder="Min 8 characters" />
            <InputField label="Confirm New Password" value={security.confirmPassword} type="password"
              onChange={v => updateSecurity('confirmPassword', v)} placeholder="Repeat new password" />
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
              <Toggle enabled={security.twoFactor} onChange={v => updateSecurity('twoFactor', v)} />
            </SettingRow>
          </Section>

          {/* Data */}
          <Section title="Your Data" desc="Export or delete your account data">
            <SettingRow icon={Download} label="Export All Data" desc="Download everything as a JSON file">
              <button
                onClick={async () => {
                  const data = { profile: authProfile, settings: await getBusinessSettings() };
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a'); a.href = url; a.download = 'cadi-data-export.json'; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs font-bold px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-[#1f48ff] hover:text-[#1f48ff] transition-colors">
                Export
              </button>
            </SettingRow>
            <SettingRow icon={LogOut} label="Sign Out" desc="Sign out of this device">
              <button
                onClick={async () => { await signOut(); navigate('/login'); }}
                className="text-xs font-bold px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-400 transition-colors">
                Sign Out
              </button>
            </SettingRow>
            <SettingRow icon={Trash2} label="Delete Account" desc="Permanently delete your account and all data" danger>
              <button
                onClick={() => {
                  if (window.confirm('Are you sure? This will permanently delete your account and all data. This cannot be undone.')) {
                    // Flag account for deletion — actual deletion handled by admin
                    updateProfile({ status: 'deleted' }).then(() => { signOut(); navigate('/login'); });
                  }
                }}
                className="text-xs font-bold px-4 py-2 border-2 border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
                Delete
              </button>
            </SettingRow>
          </Section>
        </div>
      )}

      {/* Saved toast */}
      <SavedToast show={saved} />
    </div>
  );
}
