import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { supabase } from '../lib/supabase';
import { getBusinessSettings, upsertBusinessSettings } from '../lib/db/settingsDb';
import {
  User, Building2, Bell, Lock, CreditCard, Palette,
  ChevronRight, Save, Check, Eye, EyeOff, Sparkles,
  LogOut, Trash2, Download, Shield, Phone, Mail,
  MapPin, Globe, Clock, PoundSterling, ToggleLeft,
  ToggleRight, AlertCircle, CheckCircle, Plug, Link, Unlink, RefreshCw, Copy,
  Tag, Bot, MessageSquare, Star
} from 'lucide-react';
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
  { id: 'profile',      label: 'Profile',       icon: User       },
  { id: 'business',     label: 'Business',      icon: Building2  },
  { id: 'pricing',      label: 'Pricing',       icon: Tag        },
  { id: 'agents',       label: 'Agents',        icon: Bot        },
  { id: 'front_desk',   label: 'Front Desk',    icon: MessageSquare },
  { id: 'reviews',      label: 'Reviews',       icon: Star       },
  { id: 'compliance',   label: 'Compliance',    icon: Shield     },
  { id: 'notifications',label: 'Notifications', icon: Bell       },
  { id: 'subscription', label: 'Plan',          icon: CreditCard },
  { id: 'security',     label: 'Security',      icon: Lock       },
  { id: 'integrations', label: 'Integrations',  icon: Plug       },
];

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
  const [upgradeSuccess, setUpgradeSuccess] = useState(searchParams.get('upgraded') === '1');
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Compliance state
  const [compliance, setCompliance] = useState({
    pli: false, pliPolicy: '', pliRenewal: '',
    dbs: false, ico: false, coshh: false,
  });

  const [communityOptIn, setCommunityOptIn] = useState(Boolean(authProfile?.community_opt_in));

  // Logo state
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  // GoCardless state
  const [gcStatus, setGcStatus] = useState(null); // null | { connected, connectedAt, organisationId, sandbox }
  const [gcLoading, setGcLoading] = useState(false);
  const [gcCopied, setGcCopied] = useState(false);

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

    setCommunityOptIn(Boolean(authProfile?.community_opt_in));
  }, [authProfile, user]);

  const handleCommunityToggle = async (value) => {
    setCommunityOptIn(value);
    try { localStorage.setItem('cadi_community_opt_in', value ? '1' : '0'); } catch {}
    try {
      await updateProfile({ community_opt_in: value });
    } catch (err) {
      console.error('Failed to update community opt-in:', err);
      setCommunityOptIn(!value);
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

  // Load GoCardless status when Integrations tab opens
  useEffect(() => {
    if (activeTab !== 'integrations') return;
    let mounted = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || !mounted) return;
        const { data } = await supabase.functions.invoke('gocardless-auth', {
          body:    { action: 'status' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (mounted) setGcStatus(data);
      } catch { /* ignore */ }
    })();
    return () => { mounted = false; };
  }, [activeTab]);

  const handleGcConnect = async () => {
    setGcLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data } = await supabase.functions.invoke('gocardless-auth', {
        body:    { action: 'url' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.url) window.location.href = data.url;
    } catch { /* ignore */ } finally {
      setGcLoading(false);
    }
  };

  const handleGcDisconnect = async () => {
    if (!window.confirm('Disconnect GoCardless? You will no longer be able to collect Direct Debits until you reconnect.')) return;
    setGcLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('gocardless-auth', {
        body:    { action: 'disconnect' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setGcStatus(s => ({ ...s, connected: false, connectedAt: null, organisationId: null }));
    } catch { /* ignore */ } finally {
      setGcLoading(false);
    }
  };

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
      const existing = await getBusinessSettings();
      const sd = existing?.setup_data ?? {};
      await upsertBusinessSettings({
        hourly_rate: Number(business.hourlyRate) || 0,
        currency: business.currency,
        business_email: business.businessEmail,
        bank_details: { bankName: business.bankName, sortCode: business.sortCode, accountNum: business.accountNum },
        setup_data: {
          ...sd,
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

  const compressImage = (file, cb) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
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
          .upsert({ owner_id: user.id, setup_data: { ...sd, logo_url: dataUrl } }, { onConflict: 'owner_id' });
        setLogoUrl(dataUrl);
        showSaved();
      } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  };

  const updateProfileField = (f, v) => setProfile(p => ({ ...p, [f]: v }));
  const updateBusiness = (f, v) => setBusiness(b => ({ ...b, [f]: v }));
  const updateNotif = (f, v) => setNotifications(n => ({ ...n, [f]: v }));
  const updateSecurity = (f, v) => setSecurity(s => ({ ...s, [f]: v }));
  const updateCompliance = (f, v) => setCompliance(c => ({ ...c, [f]: v }));
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

          {/* Business Logo */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-6">
            <h3 className="font-bold text-[#010a4f] mb-1">Business Logo</h3>
            <p className="text-xs text-gray-400 mb-4">Appears in the sidebar, on invoices and quotes. Square or circular logos look best.</p>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Business logo" className="w-full h-full object-contain" />
                  : <span className="text-2xl">🖼️</span>
                }
              </div>
              <div className="space-y-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#1f48ff] text-white text-xs font-bold rounded-xl hover:bg-[#010a4f] transition-colors">
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => { if (e.target.files?.[0]) handleLogoUpload(e.target.files[0]); }}
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
              <InputField label="First Name" value={profile.firstName}
                onChange={v => updateProfileField('firstName', v)} placeholder="First name" />
              <InputField label="Last Name" value={profile.lastName}
                onChange={v => updateProfileField('lastName', v)} placeholder="Last name" />
            </div>
            <div>
              <InputField label="Email Address" value={profile.email} type="email"
                onChange={v => updateProfileField('email', v)} placeholder="you@example.com" />
              {profile.email !== user?.email && (
                <p className="text-xs text-amber-600 mt-1.5">We'll send a confirmation link to this address — the change won't take effect until you click it.</p>
              )}
              {profile.email === user?.email && (
                <p className="text-xs text-gray-400 mt-1.5">This is the email address you use to log in. Wrong address? Change it here and save.</p>
              )}
            </div>
            <InputField label="Phone Number" value={profile.phone} type="tel"
              onChange={v => updateProfileField('phone', v)} placeholder="07700 000000" />
            <button
              onClick={handleProfileSave}
              className="flex items-center gap-2 px-6 py-3 bg-[#1f48ff] text-white text-sm font-bold rounded-xl hover:bg-[#010a4f] transition-colors"
            >
              <Save size={14} /> Save Changes
            </button>
          </div>

          <Section title="Cadi Community" desc="Controls whether your business appears on the public leaderboard">
            <SettingRow
              icon={Sparkles}
              label={communityOptIn ? 'Community member' : 'Join the community'}
              desc={communityOptIn
                ? `${business.name || 'Your business'} is visible to other Cadi users`
                : 'Share your business name, sector, and health score on the leaderboard'}
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
            <p className="text-xs text-gray-400">Keep a record of your insurance and regulatory documents. These are for your reference only — Cadi doesn't verify or store document files.</p>
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
                  <p className="text-xs text-gray-400">Required for most commercial cleaning contracts</p>
                </div>
              </div>
              <Toggle enabled={compliance.pli} onChange={v => updateCompliance('pli', v)} />
            </div>
            {compliance.pli && (
              <div className="px-6 py-4 space-y-4">
                <InputField
                  label="Policy Number"
                  value={compliance.pliPolicy}
                  onChange={v => updateCompliance('pliPolicy', v)}
                  placeholder="e.g. PLI-0000000"
                />
                <InputField
                  label="Renewal Date"
                  value={compliance.pliRenewal}
                  onChange={v => updateCompliance('pliRenewal', v)}
                  type="date"
                />
              </div>
            )}
          </div>

          {/* DBS Check */}
          <Section title="DBS Check" desc="Disclosure and Barring Service check — required for some domestic clients">
            <SettingRow icon={CheckCircle} label="DBS Check completed" desc="You hold a valid DBS certificate">
              <Toggle enabled={compliance.dbs} onChange={v => updateCompliance('dbs', v)} />
            </SettingRow>
          </Section>

          {/* ICO Registration */}
          <Section title="ICO Registration" desc="Required if you store personal data about clients or staff">
            <SettingRow icon={Globe} label="Registered with ICO" desc="Information Commissioner's Office data registration">
              <Toggle enabled={compliance.ico} onChange={v => updateCompliance('ico', v)} />
            </SettingRow>
          </Section>

          {/* COSHH */}
          <Section title="COSHH Awareness" desc="Control of Substances Hazardous to Health — handling cleaning chemicals safely">
            <SettingRow icon={AlertCircle} label="COSHH training completed" desc="You understand safe handling of cleaning products">
              <Toggle enabled={compliance.coshh} onChange={v => updateCompliance('coshh', v)} />
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
                  <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-1">Current Plan</p>
                  <p className="text-2xl font-black">Cadi Pro · £{priceMonthly}/month</p>
                </div>
                <div className="w-12 h-12 bg-[#1f48ff] rounded-xl flex items-center justify-center">
                  <CreditCard size={22} className="text-white" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {['Unlimited customers', 'HMRC MTD', 'Invoicing', 'Staff management', 'Business Lab'].map(f => (
                  <span key={f} className="text-xs px-3 py-1.5 bg-white/10 rounded-full text-white/70">{f}</span>
                ))}
              </div>
              <BillingPortalButton />
            </div>
          ) : (
            /* Free user — prompt to upgrade */
            <div className="bg-[#010a4f] rounded-2xl p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-[#99c5ff] uppercase tracking-wide mb-1">Current Plan</p>
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
                onClick={() => navigate('/upgrade')}
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
                <p className="text-xs text-gray-400 mt-0.5">Collect payments from your customers by Direct Debit · 1% + 20p, max £4 per transaction</p>
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
                    <button
                      onClick={handleGcDisconnect}
                      disabled={gcLoading}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      <Unlink size={12} />
                      Disconnect
                    </button>
                  </div>

                  {/* Customer payment link */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500">Send this link to customers to set up their Direct Debit mandate:</p>
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
                      { icon: '💸', label: 'One-off collection', desc: 'Collect against any invoice' },
                      { icon: '🔄', label: 'Auto status sync', desc: 'Invoices marked paid automatically' },
                    ].map(f => (
                      <div key={f.label} className="p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]">
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
                    Connect your GoCardless account to start collecting Direct Debit payments from your customers.
                    Money goes straight to your bank — Cadi never touches it.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: '⚡', label: 'One-click collection', desc: 'Tick off jobs and collect with one click' },
                      { icon: '🏦', label: 'Direct to your bank', desc: 'Funds clear directly, no middleman' },
                      { icon: '📧', label: 'Email mandate links', desc: 'Customers set up DD in 2 minutes' },
                      { icon: '✅', label: 'Auto invoice updates', desc: 'Invoices marked paid when DD clears' },
                    ].map(f => (
                      <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]">
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
                <h3 className="font-bold text-[#010a4f]">Open Banking — auto-import transactions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Connect your business bank account · zero manual entry · instant categorisation</p>
              </div>
              <span className="shrink-0 text-xs font-bold px-2.5 py-1 rounded-full bg-[#1f48ff]/10 text-[#1f48ff] border border-[#1f48ff]/20">
                Coming soon
              </span>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-400">
                Auto-import your bank transactions, match them to invoices, and categorise expenses — all without manual entry.
              </p>
            </div>
          </div>

        </div>
      )}

      {/* Saved toast */}
      <SavedToast show={saved} />
    </div>
  );
}
