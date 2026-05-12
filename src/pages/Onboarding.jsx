import { useEffect, useRef, useState, useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── Service catalogue (unchanged) ─────────────────────────────────────────────

const SERVICE_GROUPS = {
  residential: [
    { label: 'Regular Cleaning', items: ['Weekly Clean', 'Fortnightly Clean', 'Monthly Clean'] },
    { label: 'One-off & Specialist', items: ['Deep Clean', 'End of Tenancy', 'Move In / Move Out', 'Spring Clean', 'After Party Clean'] },
    { label: 'Holiday & Short-Let', items: ['Airbnb Turnover', 'Holiday Let Changeover'] },
    { label: 'Add-ons', items: ['Oven Clean', 'Carpet Clean', 'Inside Windows', 'Ironing Service'] },
  ],
  commercial: [
    { label: 'Office & Retail', items: ['Daily Office Clean', 'Weekly Office Clean', 'Retail Clean'] },
    { label: 'Education & Healthcare', items: ['School / College', 'Nursery / Childcare', 'Medical Practice', 'Care Home'] },
    { label: 'Hospitality', items: ['Restaurant / Cafe', 'Hotel', 'Pub / Bar', 'Event Venue'] },
    { label: 'Specialist', items: ['Post-Construction Clean', 'Periodic Deep Clean', 'Industrial / Warehouse'] },
  ],
  exterior: [
    { label: 'Window Cleaning', items: ['Residential Windows', 'Commercial Windows', 'Conservatory Glass'] },
    { label: 'Gutters & Roofline', items: ['Gutter Clearing', 'Fascia & Soffit Clean', 'Roof Moss Removal'] },
    { label: 'Jet Washing', items: ['Driveway Jet Wash', 'Patio / Decking', 'Path & Steps'] },
    { label: 'Building Exterior', items: ['Render Wash', 'UPVC Restoration', 'Solar Panel Clean'] },
  ],
};

const ACCREDITATION_OPTIONS = ['BICSc', 'CHAS', 'Safe Contractor', 'Constructionline', 'ISO 9001', 'Living Wage Employer'];

// ── Conversation script ───────────────────────────────────────────────────────
// Each turn: { id, cadi(string|fn), type, field?, chapter, skippable? }

const TURNS = [
  {
    id: 'confirm',
    cadi: f => f.firstName
      ? `Hi ${f.firstName}! 👋 I've pulled your details from signup — just confirm everything looks right and we'll get started. Takes about 2 minutes.`
      : `Hi! I'm Cadi — your cleaning business co-pilot 🧹\n\nLet's get your account set up. Takes about 2 minutes.`,
    type: 'confirm',
    chapter: 1,
  },
  {
    id: 'logo',
    cadi: f => `One more thing — want to add your logo? It'll appear at the top of the app, on every invoice and quote, making ${f.bizName} look completely yours from day one. Skip if you want to add it in Settings later.`,
    type: 'logo',
    chapter: 1,
    skippable: true,
  },
  {
    id: 'contact',
    cadi: 'Phone number and base postcode? Both optional — tap Skip if not now.',
    type: 'contact',
    chapter: 1,
    skippable: true,
  },
  {
    id: 'sectors',
    cadi: f => `Great. Now let's build ${f.bizName}.\n\nWhat type of cleaning do you do? Tap all that apply — your choices shape everything in the app.`,
    type: 'sectors',
    field: 'cleanerSectors',
    required: true,
    chapter: 2,
  },
  {
    id: 'bizStructure',
    cadi: 'How is your business set up legally? This shapes your tax, accounts, and compliance tools.',
    type: 'structure',
    field: 'bizStructure',
    required: true,
    chapter: 2,
  },
  {
    id: 'vatRegistered',
    cadi: 'Are you VAT registered?\n\n(If your turnover is under £90,000 it\'s usually optional — but Cadi will track your threshold either way.)',
    type: 'yes-no',
    field: 'vatRegistered',
    chapter: 2,
  },
  {
    id: 'teamStructure',
    cadi: 'Do you work solo or with a team? This sets up your scheduling, job assignment, and staff tools.',
    type: 'team',
    field: 'teamStructure',
    required: true,
    chapter: 2,
  },
  {
    id: 'services',
    cadi: f => `Now let's build your service menu.\n\nTap everything ${f.bizName} offers — these pre-fill your job cards, quotes, and invoices so you're never typing from scratch.`,
    type: 'services',
    field: 'services',
    chapter: 3,
    skippable: true,
  },
  {
    id: 'pricing',
    cadi: 'What\'s your base hourly rate? These become your defaults across all quotes and job cards — you can override per job at any time.',
    type: 'pricing',
    chapter: 3,
    skippable: true,
  },
  {
    id: 'widget',
    cadi: f => `Pricing done — now let's get ${f.bizName} its first online lead. 🌐\n\nThis is Cadi's chat widget. It sits on your website as a small button. Visitors click it, get an instant quote, and their details land straight in your Cadi account.\n\nTap the blue button below to see exactly what your customers would see — then I'll show you how to add it to your site in 30 seconds.`,
    type: 'widget',
    chapter: 4,
    skippable: true,
  },
  {
    id: 'goals',
    cadi: f => `What are you building towards, ${f.firstName}?\n\nSet your targets and the Cadi dashboard will track your progress every week — showing exactly how many jobs stand between you and your goal.`,
    type: 'goals',
    chapter: 5,
    skippable: true,
  },
  {
    id: 'compliance',
    cadi: 'Any compliance to log? Cadi tracks renewal dates and sends reminders so nothing lapses. Skip for now if you want.',
    type: 'compliance',
    chapter: 5,
    skippable: true,
  },
  {
    id: 'marketplace_interest',
    cadi: f => `One last thing, ${f.firstName} — we're building a marketplace that connects Cadi cleaners to commercial FM aggregators across the UK.\n\nWould you be interested in receiving commercial work through Cadi when the marketplace launches?`,
    type: 'marketplace-interest',
    chapter: 5,
  },
  {
    id: 'summary',
    cadi: f => `You're all set, ${f.firstName}! 🎉\n\nHere's everything I've built for ${f.bizName || 'your account'} — ready to go the moment you walk in.\n\nYour first 3 actions inside Cadi:\n📅 Add your first job in Scheduler\n👥 Add your first customer\n📄 Send your first invoice\n\nAsk Cadi anything if you get stuck — I'm on every tab.`,
    type: 'summary',
    chapter: 5,
  },
];

const CHAPTERS = [
  { id: 1, label: 'About You' },
  { id: 2, label: 'Your Business' },
  { id: 3, label: 'Services & Pricing' },
  { id: 4, label: 'Get Online' },
  { id: 5, label: 'Goals & Finish' },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-[10px] border border-[rgba(153,197,255,0.15)] bg-[#091660] px-[13px] py-[11px] text-sm text-white outline-none transition focus:border-[#99c5ff] focus:ring-4 focus:ring-[rgba(153,197,255,0.1)] placeholder:text-[rgba(153,197,255,0.3)]';
const labelCls = 'mb-[5px] block text-[11px] font-semibold uppercase tracking-[0.4px] text-[rgba(153,197,255,0.55)]';

function Chip({ selected, onClick, children, color }) {
  const base = 'rounded-lg border px-3 py-2 text-[13px] font-medium transition cursor-pointer';
  const on = color
    ? `border-[${color}] bg-[rgba(153,197,255,0.08)] text-white`
    : 'border-[#99c5ff] bg-[rgba(31,72,255,0.18)] text-[#99c5ff]';
  const off = 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white';
  return (
    <button type="button" onClick={onClick} className={`${base} ${selected ? on : off}`}>
      {children}
    </button>
  );
}

function ToggleRow({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[rgba(153,197,255,0.1)] bg-[#091660] px-4 py-[13px]">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        {hint && <div className="text-xs text-[rgba(153,197,255,0.5)]">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#1f48ff]' : 'bg-[rgba(153,197,255,0.2)]'}`}
      >
        <span className={`absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Onboarding({ isModal = false, onComplete = null }) {
  const { user, profile, loading, profileLoading, updateProfile } = useAuth();
  const navigate = useNavigate();
  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const initialized = useRef(false);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [turnIndex, setTurnIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState(null);
  const [confirmEditing, setConfirmEditing] = useState(false);
  const [widgetDemoOpen, setWidgetDemoOpen] = useState(false);

  // Input state (local to current turn — cleared on advance)
  const [textValue, setTextValue] = useState('');
  const [activeServiceTab, setActiveServiceTab] = useState('residential');

  // Form data (same shape as before — all saves go to same Supabase tables)
  const [form, setForm] = useState({
    firstName: '', lastName: '', bizName: '', bizEmail: '',
    logoUrl: '',
    bizPhone: '', bizPostcode: '',
    cleanerType: null, cleanerSectors: [],
    bizStructure: null, companyNumber: '', fyEnd: '',
    vatRegistered: false, vatNumber: '', vatScheme: '',
    teamStructure: null, employmentTypes: [],
    services: [], customService: '',
    hourlyRate: '', minJobRate: '', minJobMins: '120',
    quoteType: 'inc_vat', paymentTerms: '0',
    workingDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
    startTime: '08:00', finishTime: '18:00',
    currentRevenue: '', targetRevenue: '',
    currentClients: '', targetClients: '',
    targetDate: '', ambition: 'growing_fast',
    pli: false, pliPolicy: '', pliRenewal: '',
    dbs: false, ico: false, coshh: false, accreditations: [],
    businessId: null,
    bankConnected: false, goCardless: false, stripe: false,
    accountantName: '', accountantEmail: '', accountantFirm: '',
    marketplaceInterest: null,
  });

  function patch(p) { setForm(prev => ({ ...prev, ...p })); }

  function toggleArr(field, val) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(val) ? prev[field].filter(v => v !== val) : [...prev[field], val],
    }));
  }

  function flash(msg, type = 'success') {
    setNotif({ msg, type });
    clearTimeout(flash._t);
    flash._t = setTimeout(() => setNotif(null), 4000);
  }

  // Resolve cadi message text
  function cadiText(turn, f) {
    return typeof turn.cadi === 'function' ? turn.cadi(f ?? form) : turn.cadi;
  }

  // Scroll chat to bottom
  function scrollDown() {
    setTimeout(() => {
      chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, 60);
  }

  // Show first cadi message once profile has loaded
  useEffect(() => {
    if (loading || profileLoading) return;
    if (initialized.current) return;
    initialized.current = true;

    setIsTyping(true);
    const delay = setTimeout(() => {
      setIsTyping(false);
      const hasSignupData = profile?.first_name && profile?.business_name;
      const prefilledForm = {
        firstName: profile?.first_name || '',
        lastName:  profile?.last_name  || '',
        bizName:   profile?.business_name || '',
        bizEmail:  user?.email || '',
      };
      setForm(prev => ({ ...prev, ...prefilledForm }));
      // confirm is always turn 0 — open edit fields immediately if nothing to confirm
      if (!hasSignupData) setConfirmEditing(true);
      setTurnIndex(0);
      setMessages([{ id: 'cadi-0', role: 'cadi', text: cadiText(TURNS[0], { ...prefilledForm }) }]);
      scrollDown();
    }, 900);
    return () => clearTimeout(delay);
  }, [loading, profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load business ID for widget snippet
  useEffect(() => {
    if (!user) return;
    supabase.from('businesses').select('id').eq('owner_user_id', user.id).single()
      .then(({ data }) => { if (data) patch({ businessId: data.id }); });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill from existing profile
  useEffect(() => {
    if (!profile) return;
    const sd = (typeof profile.setup_data === 'object' && profile.setup_data) || null;
    setForm(prev => ({
      ...prev,
      firstName: profile.first_name || prev.firstName,
      lastName: profile.last_name || prev.lastName,
      bizName: profile.business_name || prev.bizName,
      bizEmail: user?.email || sd?.business_email || prev.bizEmail,
      logoUrl: sd?.logo_url || prev.logoUrl,
      bizPhone: profile.phone || prev.bizPhone,
      bizPostcode: profile.postcode || prev.bizPostcode,
      cleanerType: profile.cleaner_type || prev.cleanerType,
      cleanerSectors: sd?.cleaner_sectors || (profile.cleaner_type ? [profile.cleaner_type] : []),
      bizStructure: profile.biz_structure || prev.bizStructure,
      teamStructure: profile.team_structure || prev.teamStructure,
      vatRegistered: typeof profile.vat_registered === 'boolean' ? profile.vat_registered : prev.vatRegistered,
      vatNumber: sd?.vat_number || prev.vatNumber,
      vatScheme: sd?.vat_scheme || prev.vatScheme,
      services: sd?.services || prev.services,
      customService: sd?.custom_service || prev.customService,
      hourlyRate: sd?.hourly_rate?.toString() || prev.hourlyRate,
      minJobRate: sd?.min_job_rate?.toString() || prev.minJobRate,
      currentRevenue: sd?.current_revenue?.toString() || prev.currentRevenue,
      targetRevenue: sd?.target_revenue?.toString() || prev.targetRevenue,
      currentClients: sd?.current_clients?.toString() || prev.currentClients,
      targetClients: sd?.target_clients?.toString() || prev.targetClients,
      ambition: sd?.ambition || prev.ambition,
      pli: typeof sd?.pli === 'boolean' ? sd.pli : prev.pli,
      dbs: typeof sd?.dbs === 'boolean' ? sd.dbs : prev.dbs,
      ico: typeof sd?.ico === 'boolean' ? sd.ico : prev.ico,
      coshh: typeof sd?.coshh === 'boolean' ? sd.coshh : prev.coshh,
      accreditations: sd?.accreditations || prev.accreditations,
    }));
  }, [profile, user]);

  useEffect(() => {
    if (profile?.onboarding_complete) {
      if (isModal) onComplete?.();
      else navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate, isModal, onComplete]);

  // ── Advance conversation ────────────────────────────────────────────────────

  function advance(userLabel, updatedForm) {
    const next = turnIndex + 1;
    if (next >= TURNS.length) return;
    const liveForm = updatedForm ?? form;

    setMessages(prev => [...prev, { id: `user-${turnIndex}`, role: 'user', text: userLabel }]);
    scrollDown();
    setIsTyping(true);
    setTextValue('');

    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [...prev, { id: `cadi-${next}`, role: 'cadi', text: cadiText(TURNS[next], liveForm) }]);
      setTurnIndex(next);
      scrollDown();
      setTimeout(() => inputRef.current?.focus(), 80);
    }, 680);
  }

  // ── Supabase helpers ────────────────────────────────────────────────────────

  async function loadSetupData() {
    if (user?.id === 'demo-user') return {};
    const { data } = await supabase
      .from('business_settings')
      .select('setup_data')
      .eq('owner_id', user.id)
      .single();
    return data?.setup_data || {};
  }

  async function mergeSetupData(patch) {
    if (user?.id === 'demo-user') return;
    const existing = await loadSetupData();
    await supabase
      .from('business_settings')
      .upsert(
        { owner_id: user.id, setup_data: { ...existing, ...patch } },
        { onConflict: 'owner_id' }
      );
  }

  // Upsert helper — creates or updates the profiles row, never silently fails
  async function saveProfile(fields) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, ...fields }, { onConflict: 'id' });
    if (error) throw error;
  }

  // Save is batched at chapter boundaries — called before advancing on key turns
  async function saveChapter(id) {
    if (!user || user.id === 'demo-user') return;
    try {
      if (id === 'confirm') {
        await saveProfile({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          business_name: form.bizName.trim(),
          onboarding_step: 1,
        });
        await mergeSetupData({ business_email: form.bizEmail.trim() });
      }
      if (id === 'logo') {
        if (form.logoUrl) await mergeSetupData({ logo_url: form.logoUrl });
      }
      if (id === 'contact') {
        await saveProfile({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          business_name: form.bizName.trim(),
          phone: form.bizPhone.trim(),
          postcode: form.bizPostcode.trim(),
          onboarding_step: 2,
        });
        await mergeSetupData({ business_email: form.bizEmail.trim() });
      }
      if (id === 'sectors') {
        const primary = form.cleanerSectors[0] || null;
        await saveProfile({ cleaner_type: primary, onboarding_step: 3 });
        await mergeSetupData({ cleaner_sectors: form.cleanerSectors });
      }
      if (id === 'bizStructure') {
        await saveProfile({ biz_structure: form.bizStructure, onboarding_step: 4 });
        await mergeSetupData({ company_number: form.companyNumber, fy_end: form.fyEnd || null });
      }
      if (id === 'vatRegistered') {
        await supabase.from('business_settings').upsert({ owner_id: user.id, vat_registered: form.vatRegistered }, { onConflict: 'owner_id' });
        await mergeSetupData({ vat_number: form.vatNumber, vat_scheme: form.vatScheme || null });
        await saveProfile({ onboarding_step: 5 });
      }
      if (id === 'teamStructure') {
        await saveProfile({ team_structure: form.teamStructure, onboarding_step: 6 });
        await mergeSetupData({ employment_types: form.employmentTypes });
      }
      if (id === 'services') {
        await mergeSetupData({ services: form.services, custom_service: form.customService.trim() });
        await saveProfile({ onboarding_step: 7 });
      }
      if (id === 'pricing') {
        const hr = Number(form.hourlyRate || 0);
        await supabase.from('business_settings').upsert({ owner_id: user.id, hourly_rate: hr || 20 }, { onConflict: 'owner_id' });
        await mergeSetupData({
          hourly_rate: hr || null,
          min_job_rate: Number(form.minJobRate || 0) || null,
          min_job_mins: Number(form.minJobMins || 120),
          quote_type: form.quoteType,
          payment_terms: Number(form.paymentTerms || 0),
          working_days: form.workingDays,
          start_time: form.startTime,
          finish_time: form.finishTime,
        });
        await saveProfile({ onboarding_step: 8 });
      }
      if (id === 'widget') {
        await saveProfile({ onboarding_step: 9 });
      }
      if (id === 'goals') {
        const annual = Number(form.targetRevenue || 0) * 12;
        if (annual) await supabase.from('business_settings').upsert({ owner_id: user.id, annual_target: annual }, { onConflict: 'owner_id' });
        await mergeSetupData({
          current_revenue: Number(form.currentRevenue || 0) || null,
          target_revenue: Number(form.targetRevenue || 0) || null,
          current_clients: Number(form.currentClients || 0) || null,
          target_clients: Number(form.targetClients || 0) || null,
          target_date: form.targetDate || null,
          ambition: form.ambition,
        });
        await saveProfile({ onboarding_step: 10 });
      }
      if (id === 'compliance') {
        await mergeSetupData({
          pli: form.pli, pli_policy: form.pliPolicy, pli_renewal: form.pliRenewal || null,
          dbs: form.dbs, ico: form.ico, coshh: form.coshh,
          accreditations: form.accreditations,
        });
        await saveProfile({ onboarding_step: 11 });
      }
      if (id === 'marketplace_interest') {
        const interested = form.marketplaceInterest === true;
        await saveProfile({
          marketplace_interest: interested,
          marketplace_interest_at: interested ? new Date().toISOString() : null,
          onboarding_step: 12,
        });
      }
    } catch (e) {
      flash(e.message || 'Save failed', 'error');
      throw e;
    }
  }

  async function finishOnboarding() {
    setSaving(true);

    // Fire the DB write without blocking — all chapter data was already saved
    // incrementally, so a hang here should never trap the user on this screen.
    if (user?.id !== 'demo-user') {
      supabase.from('profiles')
        .upsert({ id: user.id, onboarding_complete: true, onboarding_step: 13 }, { onConflict: 'id' })
        .then(() => {}).catch(() => {});
    }

    // Update local auth state and navigate — don't wait for the DB round-trip
    try {
      await updateProfile({ onboarding_complete: true, onboarding_step: 13 });
    } catch {
      // Even if this fails, still let the user in — they can complete setup later
    }

    if (isModal) onComplete?.();
    else navigate('/dashboard', { replace: true });
  }

  // ── Validate + handle answer submission ─────────────────────────────────────

  async function handleAnswer(turnId, value, label, updatedForm) {
    setSaving(true);
    try {
      await saveChapter(turnId);
    } catch {
      setSaving(false);
      return;
    }
    setSaving(false);

    if (turnId === 'summary') {
      await finishOnboarding();
      return;
    }

    advance(label, updatedForm);
  }

  // Current turn
  const turn = TURNS[turnIndex] || null;
  const currentChapter = turn?.chapter ?? 4;

  // ── Render input area for current turn ─────────────────────────────────────

  function renderInput() {
    if (!turn || isTyping) return null;
    const { id, type, field, placeholder, skippable } = turn;

    // Simple text / email input
    if (type === 'text' || type === 'email') {
      const validate = () => {
        if (!textValue.trim()) { flash('Please enter a value.', 'error'); return false; }
        if (type === 'email' && !textValue.includes('@')) { flash('Please enter a valid email.', 'error'); return false; }
        return true;
      };
      return (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type={type}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && validate()) { patch({ [field]: textValue.trim() }); handleAnswer(id, textValue.trim(), textValue.trim(), { ...form, [field]: textValue.trim() }); } }}
            placeholder={placeholder}
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (validate()) { patch({ [field]: textValue.trim() }); handleAnswer(id, textValue.trim(), textValue.trim(), { ...form, [field]: textValue.trim() }); } }}
            className="rounded-[10px] bg-[#1f48ff] px-5 py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] transition hover:bg-[#3a5eff] disabled:opacity-60"
          >
            {saving ? '…' : '→'}
          </button>
        </div>
      );
    }

    // Confirm pre-filled signup details
    if (type === 'confirm') {
      const displayEmail = form.bizEmail || user?.email || '';
      return (
        <div className="space-y-3">
          {!confirmEditing ? (
            <>
              <div className="rounded-xl border border-[rgba(153,197,255,0.15)] bg-[#091660] divide-y divide-[rgba(153,197,255,0.08)]">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-[rgba(153,197,255,0.5)] uppercase tracking-wide">Your name</span>
                  <span className="text-sm font-semibold text-white">{`${form.firstName} ${form.lastName}`.trim() || form.firstName}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs text-[rgba(153,197,255,0.5)] uppercase tracking-wide">Business name</span>
                  <span className="text-sm font-semibold text-white">{form.bizName}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[rgba(153,197,255,0.2)] bg-[#091660] px-4 py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[rgba(153,197,255,0.5)] uppercase tracking-wide">Email address</span>
                  <span className="text-sm font-semibold text-white">{displayEmail}</span>
                </div>
                <p className="text-xs text-[rgba(153,197,255,0.4)]">This is your login email. Tap "Edit details" below if it needs changing.</p>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>First name</label>
                  <input className={inputCls} value={form.firstName} onChange={e => patch({ firstName: e.target.value })} placeholder="First name" />
                </div>
                <div>
                  <label className={labelCls}>Last name</label>
                  <input className={inputCls} value={form.lastName} onChange={e => patch({ lastName: e.target.value })} placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Business name</label>
                <input className={inputCls} value={form.bizName} onChange={e => patch({ bizName: e.target.value })} placeholder="Your business name" />
              </div>
              <div>
                <label className={labelCls}>Email address</label>
                <input className={inputCls} type="email" value={form.bizEmail || user?.email || ''} onChange={e => patch({ bizEmail: e.target.value })} placeholder="hello@yourbusiness.co.uk" />
                <p className="mt-1 text-xs text-[rgba(153,197,255,0.35)]">Changing your email here updates it in Settings — you may need to reverify.</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmEditing(v => !v)}
              className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition"
            >
              {confirmEditing ? 'Cancel' : 'Edit details'}
            </button>
            <button
              type="button"
              disabled={saving || !form.firstName || !form.bizName}
              onClick={() => {
                setConfirmEditing(false);
                handleAnswer(id, `${form.firstName} · ${form.bizName}`, `${form.firstName} · ${form.bizName}`);
              }}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] transition hover:bg-[#3a5eff] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Yes, that\'s correct →'}
            </button>
          </div>
        </div>
      );
    }

    // Logo upload
    if (type === 'logo') {
      function compressImage(file, cb) {
        const reader = new FileReader();
        reader.onload = e => {
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
      }
      return (
        <div className="space-y-3">
          {form.logoUrl ? (
            <div className="flex items-center gap-4 rounded-xl border border-[rgba(153,197,255,0.2)] bg-[#091660] p-4">
              <img src={form.logoUrl} alt="Logo preview" className="h-16 w-16 rounded-xl object-contain bg-white/10 p-1" />
              <div className="flex-1">
                <p className="text-sm font-bold text-white">Logo uploaded ✓</p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Will appear in the sidebar, invoices and quotes</p>
              </div>
              <button type="button" onClick={() => patch({ logoUrl: '' })} className="text-xs text-[rgba(153,197,255,0.4)] hover:text-white transition">Remove</button>
            </div>
          ) : (
            <label className="block cursor-pointer rounded-xl border-2 border-dashed border-[rgba(153,197,255,0.2)] bg-[#091660] p-6 text-center transition hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.05)]">
              <div className="mb-2 text-3xl">🖼️</div>
              <p className="text-sm font-bold text-white">Tap to upload your logo</p>
              <p className="mt-1 text-xs text-[rgba(153,197,255,0.45)]">PNG, JPG or SVG — we'll resize it automatically</p>
              <input type="file" accept="image/*" className="hidden" onChange={e => {
                const file = e.target.files?.[0];
                if (file) compressImage(file, url => patch({ logoUrl: url }));
              }} />
            </label>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">Skip</button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, form.logoUrl ? 'Logo added ✓' : 'Skipped', form.logoUrl ? 'Logo added' : 'Skipped')}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : form.logoUrl ? 'Continue with logo →' : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Phone + postcode
    if (type === 'contact') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.bizPhone} onChange={e => patch({ bizPhone: e.target.value })} placeholder="07700 900 000" />
            </div>
            <div>
              <label className={labelCls}>Base Postcode</label>
              <input className={inputCls} value={form.bizPostcode} onChange={e => patch({ bizPostcode: e.target.value })} placeholder="e.g. RM1 3AB" />
            </div>
          </div>
          <div className="flex gap-2">
            {skippable && <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.55)] transition hover:border-[rgba(153,197,255,0.35)] hover:text-white">Skip</button>}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, `${form.bizPhone || '—'} · ${form.bizPostcode || '—'}`, `${form.bizPhone || '—'} · ${form.bizPostcode || '—'}`)}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] transition hover:bg-[#3a5eff] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Sector cards
    if (type === 'sectors') {
      const sectors = [
        { key: 'residential', emoji: '🏠', title: 'Residential', desc: 'Homes, end of tenancy, Airbnb', color: '#10b981', border: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.08)' },
        { key: 'commercial',  emoji: '🏢', title: 'Commercial',  desc: 'Offices, schools, hospitality', color: '#99c5ff', border: 'rgba(153,197,255,0.3)', bg: 'rgba(153,197,255,0.08)' },
        { key: 'exterior',    emoji: '🪟', title: 'Exterior',    desc: 'Windows, gutters, jet washing', color: '#fb923c', border: 'rgba(251,146,60,0.3)', bg: 'rgba(251,146,60,0.08)' },
      ];
      const valid = form.cleanerSectors.length > 0;
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 max-[480px]:grid-cols-1">
            {sectors.map(s => {
              const sel = form.cleanerSectors.includes(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    const updated = sel ? form.cleanerSectors.filter(x => x !== s.key) : [...form.cleanerSectors, s.key];
                    patch({ cleanerSectors: updated, cleanerType: updated[0] || null });
                    if (!sel) setActiveServiceTab(s.key);
                  }}
                  className="rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5"
                  style={{ borderColor: sel ? s.color : s.border, background: sel ? s.bg : 'rgba(9,22,96,0.6)' }}
                >
                  <div className="mb-2 text-2xl">{s.emoji}</div>
                  <div className="text-sm font-bold text-white">{s.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-[rgba(153,197,255,0.55)]">{s.desc}</div>
                  {sel && <div className="mt-2 text-xs font-bold" style={{ color: s.color }}>✓ Selected</div>}
                </button>
              );
            })}
          </div>
          {valid && (
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, form.cleanerSectors.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', '), form.cleanerSectors.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', '))}
              className="w-full rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] transition hover:bg-[#3a5eff] disabled:opacity-60"
            >
              {saving ? 'Saving…' : `Continue with ${form.cleanerSectors.length} sector${form.cleanerSectors.length > 1 ? 's' : ''} →`}
            </button>
          )}
        </div>
      );
    }

    // Legal structure cards
    if (type === 'structure') {
      const options = [
        { value: 'sole_trader',  icon: '👤', title: 'Sole Trader',          desc: 'Self-employed, Self Assessment' },
        { value: 'limited',      icon: '🏛️', title: 'Limited Company',       desc: 'Incorporated, Corporation Tax' },
        { value: 'partnership',  icon: '🤝', title: 'Partnership',           desc: 'Two or more people, shared profits' },
        { value: 'llp',          icon: '📑', title: 'LLP',                   desc: 'Limited Liability Partnership' },
        { value: 'new_business', icon: '🌱', title: 'Just Getting Started',  desc: "Haven't formally set up yet" },
      ];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={async () => {
                  patch({ bizStructure: o.value });
                  const f2 = { ...form, bizStructure: o.value };
                  setSaving(true);
                  try { await saveChapter('bizStructure'); } catch { setSaving(false); return; }
                  setSaving(false);
                  advance(o.title, f2);
                }}
                className={`rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${form.bizStructure === o.value ? 'border-[#99c5ff] bg-[rgba(153,197,255,0.08)]' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] hover:border-[rgba(153,197,255,0.3)]'} ${o.value === 'new_business' ? 'col-span-2 max-[480px]:col-span-1' : ''}`}
              >
                <span className="mb-2 block text-xl">{o.icon}</span>
                <div className="text-sm font-bold text-white">{o.title}</div>
                <div className="mt-1 text-xs text-[rgba(153,197,255,0.5)]">{o.desc}</div>
              </button>
            ))}
          </div>
          {form.bizStructure === 'limited' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[rgba(153,197,255,0.12)] bg-[#091660] p-4 max-[480px]:grid-cols-1">
              <div>
                <label className={labelCls}>Company Reg. Number</label>
                <input className={inputCls} value={form.companyNumber} onChange={e => patch({ companyNumber: e.target.value })} placeholder="e.g. 12345678" />
              </div>
              <div>
                <label className={labelCls}>Financial Year End</label>
                <input type="date" className={inputCls} value={form.fyEnd} onChange={e => patch({ fyEnd: e.target.value })} />
              </div>
            </div>
          )}
        </div>
      );
    }

    // VAT yes/no
    if (type === 'yes-no') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[{ val: true, label: '✅ Yes, VAT registered', color: '#34d399' }, { val: false, label: '❌ Not VAT registered', color: '#fb923c' }].map(opt => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={async () => {
                  patch({ vatRegistered: opt.val });
                  if (!opt.val) {
                    const f2 = { ...form, vatRegistered: false };
                    setSaving(true);
                    try { await saveChapter('vatRegistered'); } catch { setSaving(false); return; }
                    setSaving(false);
                    advance(opt.label, f2);
                  }
                }}
                className={`rounded-xl border-2 py-4 text-sm font-bold transition ${form.vatRegistered === opt.val ? 'border-[#99c5ff] bg-[rgba(153,197,255,0.1)] text-white' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.3)] hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.vatRegistered && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>VAT Number</label>
                  <input className={inputCls} value={form.vatNumber} onChange={e => patch({ vatNumber: e.target.value })} placeholder="GB123456789" />
                </div>
                <div>
                  <label className={labelCls}>VAT Scheme</label>
                  <select className={inputCls} value={form.vatScheme} onChange={e => patch({ vatScheme: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="standard">Standard Rate (20%)</option>
                    <option value="flat">Flat Rate Scheme</option>
                    <option value="annual">Annual Accounting</option>
                    <option value="cash">Cash Accounting</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try { await saveChapter('vatRegistered'); } catch { setSaving(false); return; }
                  setSaving(false);
                  advance(`VAT registered · ${form.vatScheme || 'scheme TBC'}`);
                }}
                className="w-full rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      );
    }

    // Team size
    if (type === 'team') {
      const options = [
        { value: 'solo',       icon: '🧑',  label: 'Just me' },
        { value: 'small',      icon: '👥',  label: 'Small team (2–5)' },
        { value: 'growing',    icon: '📈',  label: 'Growing (6–15)' },
        { value: 'enterprise', icon: '🏢',  label: 'Enterprise (15+)' },
      ];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={async () => {
                  patch({ teamStructure: o.value });
                  const f2 = { ...form, teamStructure: o.value };
                  setSaving(true);
                  try { await saveChapter('teamStructure'); } catch { setSaving(false); return; }
                  setSaving(false);
                  advance(`${o.icon} ${o.label}`, f2);
                }}
                className={`rounded-xl border-2 py-4 px-3 text-left transition hover:-translate-y-0.5 ${form.teamStructure === o.value ? 'border-[#99c5ff] bg-[rgba(153,197,255,0.08)]' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] hover:border-[rgba(153,197,255,0.28)]'}`}
              >
                <div className="mb-1 text-xl">{o.icon}</div>
                <div className="text-sm font-bold text-white">{o.label}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    // Service picker
    if (type === 'services') {
      const tabs = Object.keys(SERVICE_GROUPS);
      const tabLabels = { residential: '🏠 Residential', commercial: '🏢 Commercial', exterior: '🪟 Exterior' };
      const activeGroups = SERVICE_GROUPS[activeServiceTab] || [];
      return (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {tabs.map(t => (
              <button key={t} type="button" onClick={() => setActiveServiceTab(t)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${activeServiceTab === t ? 'border-[#1f48ff] bg-[#1f48ff] text-white' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.55)] hover:text-white'}`}>
                {tabLabels[t]}
              </button>
            ))}
          </div>
          <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
            {activeGroups.map(group => (
              <div key={group.label} className="rounded-xl border border-[rgba(153,197,255,0.1)] bg-[#091660] p-3">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[rgba(153,197,255,0.45)]">{group.label}</div>
                <div className="flex flex-wrap gap-1.5">
                  {group.items.map(item => (
                    <Chip key={item} selected={form.services.includes(item)} onClick={() => toggleArr('services', item)}>
                      {item}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <input className={inputCls} value={form.customService} onChange={e => patch({ customService: e.target.value })} placeholder="Other services not listed (comma-separated)…" />
          <div className="flex gap-2">
            {skippable && <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">Skip</button>}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, `${form.services.length} service${form.services.length !== 1 ? 's' : ''} selected`, `${form.services.length} services`)}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : form.services.length > 0 ? `Continue with ${form.services.length} services →` : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Pricing
    if (type === 'pricing') {
      const DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
      const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Hourly Rate (£)</label>
              <input type="number" className={inputCls} value={form.hourlyRate} onChange={e => patch({ hourlyRate: e.target.value })} placeholder="e.g. 22" min="0" />
            </div>
            <div>
              <label className={labelCls}>Minimum Job Price (£)</label>
              <input type="number" className={inputCls} value={form.minJobRate} onChange={e => patch({ minJobRate: e.target.value })} placeholder="e.g. 45" min="0" />
            </div>
            <div>
              <label className={labelCls}>Minimum Duration</label>
              <select className={inputCls} value={form.minJobMins} onChange={e => patch({ minJobMins: e.target.value })}>
                <option value="0">No minimum</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
                <option value="180">3 hours</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Quote Type</label>
              <select className={inputCls} value={form.quoteType} onChange={e => patch({ quoteType: e.target.value })}>
                <option value="inc_vat">Inc. VAT</option>
                <option value="ex_vat">Ex. VAT</option>
                <option value="no_vat">No VAT</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Payment Terms</label>
              <select className={inputCls} value={form.paymentTerms} onChange={e => patch({ paymentTerms: e.target.value })}>
                <option value="0">On completion</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Working Days</label>
            <div className="flex gap-1.5 flex-wrap mt-1">
              {DAYS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patch({ workingDays: { ...form.workingDays, [d]: !form.workingDays[d] } })}
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                    form.workingDays[d]
                      ? 'border-[#99c5ff] bg-[rgba(31,72,255,0.25)] text-white'
                      : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.4)] hover:text-white'
                  }`}
                >
                  {DAY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Opening Time</label>
              <input type="time" className={inputCls} value={form.startTime} onChange={e => patch({ startTime: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Closing Time</label>
              <input type="time" className={inputCls} value={form.finishTime} onChange={e => patch({ finishTime: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            {skippable && <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">Skip</button>}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, form.hourlyRate ? `£${form.hourlyRate}/hr${form.minJobRate ? ` · min £${form.minJobRate}` : ''}` : 'Pricing set', form.hourlyRate ? `£${form.hourlyRate}/hr` : 'Set')}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Goals
    if (type === 'goals') {
      const ambitionOptions = [
        { value: 'growing_fast', label: '🚀 Growing fast' },
        { value: 'steady_growth', label: '📈 Steady growth' },
        { value: 'maintaining', label: '🔒 Maintaining' },
        { value: 'lifestyle', label: '🌴 Lifestyle business' },
        { value: 'building_to_sell', label: '💰 Building to sell' },
      ];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Current Monthly Revenue (£)</label>
              <input type="number" className={inputCls} value={form.currentRevenue} onChange={e => patch({ currentRevenue: e.target.value })} placeholder="e.g. 2500" />
            </div>
            <div>
              <label className={labelCls}>Target Monthly Revenue (£)</label>
              <input type="number" className={inputCls} value={form.targetRevenue} onChange={e => patch({ targetRevenue: e.target.value })} placeholder="e.g. 6000" />
            </div>
            <div>
              <label className={labelCls}>Current Clients</label>
              <input type="number" className={inputCls} value={form.currentClients} onChange={e => patch({ currentClients: e.target.value })} placeholder="e.g. 12" />
            </div>
            <div>
              <label className={labelCls}>Target Clients</label>
              <input type="number" className={inputCls} value={form.targetClients} onChange={e => patch({ targetClients: e.target.value })} placeholder="e.g. 30" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Target Date</label>
              <input type="date" className={inputCls} value={form.targetDate} onChange={e => patch({ targetDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Business Ambition</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ambitionOptions.map(a => (
                <Chip key={a.value} selected={form.ambition === a.value} onClick={() => patch({ ambition: a.value })}>{a.label}</Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            {skippable && <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">Skip</button>}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, form.targetRevenue ? `Target: £${Number(form.targetRevenue).toLocaleString()}/mo` : 'Goals noted', form.targetRevenue ? `£${form.targetRevenue}/mo target` : 'Set')}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Compliance
    if (type === 'compliance') {
      return (
        <div className="space-y-2">
          <ToggleRow checked={form.pli} onChange={v => patch({ pli: v })} label="Public Liability Insurance" hint="Required by most commercial clients" />
          {form.pli && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[#091660] p-3">
              <div>
                <label className={labelCls}>Policy Number</label>
                <input className={inputCls} value={form.pliPolicy} onChange={e => patch({ pliPolicy: e.target.value })} placeholder="PLI-2024-001" />
              </div>
              <div>
                <label className={labelCls}>Renewal Date</label>
                <input type="date" className={inputCls} value={form.pliRenewal} onChange={e => patch({ pliRenewal: e.target.value })} />
              </div>
            </div>
          )}
          <ToggleRow checked={form.dbs} onChange={v => patch({ dbs: v })} label="DBS Check" hint="Required for residential and care environments" />
          <ToggleRow checked={form.ico} onChange={v => patch({ ico: v })} label="ICO Registered" hint="Required if storing client data digitally" />
          <ToggleRow checked={form.coshh} onChange={v => patch({ coshh: v })} label="COSHH Trained" hint="Control of Substances Hazardous to Health" />
          <div>
            <label className={labelCls}>Accreditations</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {ACCREDITATION_OPTIONS.map(a => (
                <Chip key={a} selected={form.accreditations.includes(a)} onClick={() => toggleArr('accreditations', a)}>{a}</Chip>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            {skippable && <button type="button" onClick={() => advance('Skipped', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">Skip</button>}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                const items = [form.pli && 'PLI', form.dbs && 'DBS', form.ico && 'ICO', form.coshh && 'COSHH'].filter(Boolean);
                handleAnswer(id, items.length ? items.join(' · ') : 'Added compliance', items.join(' · ') || 'Done');
              }}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-3 text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Continue →'}
            </button>
          </div>
        </div>
      );
    }

    // Summary — what's been pre-built for them
    if (type === 'summary') {
      const readyItems = [
        form.logoUrl && {
          icon: null, img: form.logoUrl, label: 'Your logo loaded', detail: 'Appears in the sidebar, on invoices and on every quote — the app looks completely yours',
        },
        form.cleanerSectors.length && {
          icon: '🧹', label: 'App customised', detail: `${form.cleanerSectors.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')} edition — dashboard, tools and filters set to match your work`,
        },
        form.services.length && {
          icon: '✅', label: 'Service menu built', detail: `${form.services.length} service${form.services.length !== 1 ? 's' : ''} ready as quick-picks on every job card, quote and invoice`,
        },
        form.hourlyRate && {
          icon: '💷', label: 'Pricing pre-loaded', detail: `£${form.hourlyRate}/hr flows into your pricing calculator, quote builder and job cards automatically`,
        },
        form.targetRevenue && {
          icon: '🎯', label: 'Sprint target set', detail: `£${Number(form.targetRevenue).toLocaleString()}/mo target pinned to your dashboard — Cadi tracks every job against it`,
        },
        form.bizStructure && {
          icon: '📋', label: 'Tax & accounts configured', detail: `${form.bizStructure === 'sole_trader' ? 'Self Assessment SA103' : form.bizStructure === 'limited' ? 'Corporation Tax & Companies House' : 'Accounts'} tools and defaults set for your structure`,
        },
        form.vatRegistered && {
          icon: '🧾', label: 'VAT set up', detail: `${form.vatScheme || 'Standard'} scheme — invoices, quotes and reports will show VAT correctly`,
        },
        (form.pli || form.dbs || form.ico || form.coshh) && {
          icon: '🛡️', label: 'Compliance logged', detail: 'Renewal reminders are set — Cadi will alert you before anything lapses',
        },
        form.teamStructure && form.teamStructure !== 'solo' && {
          icon: '👥', label: 'Team features on', detail: 'Job assignment, staff scheduling and multi-cleaner tracking are active',
        },
      ].filter(Boolean);

      return (
        <div className="space-y-3">
          <div className="space-y-2">
            {readyItems.map(item => (
              <div key={item.label} className="flex gap-3 rounded-xl border border-[rgba(153,197,255,0.1)] bg-[#091660] px-4 py-3">
                {item.img
                  ? <img src={item.img} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-lg object-contain bg-white/10 p-0.5" />
                  : <span className="mt-0.5 shrink-0 text-lg">{item.icon}</span>
                }
                <div>
                  <div className="text-sm font-bold text-[#99c5ff]">{item.label}</div>
                  <div className="mt-0.5 text-xs leading-relaxed text-[rgba(153,197,255,0.6)]">{item.detail}</div>
                </div>
              </div>
            ))}
          </div>
          {readyItems.length === 0 && (
            <p className="text-sm text-[rgba(153,197,255,0.6)]">Your account is ready — you can fill in the details from inside the app.</p>
          )}

          {/* Next 3 actions */}
          <div className="rounded-xl border border-[rgba(153,197,255,0.15)] bg-[#091660] px-4 py-3 space-y-2">
            <p className="text-[10px] font-bold tracking-widest uppercase text-[rgba(153,197,255,0.4)] mb-1">Your first 3 actions</p>
            {[
              { emoji: '📅', label: 'Add your first job', detail: 'Scheduler' },
              { emoji: '👥', label: 'Add your first customer', detail: 'Customers' },
              { emoji: '📄', label: 'Send your first invoice', detail: 'Invoices' },
            ].map(a => (
              <div key={a.label} className="flex items-center gap-3">
                <span className="text-base shrink-0">{a.emoji}</span>
                <span className="text-sm text-white font-semibold flex-1">{a.label}</span>
                <span className="text-[10px] text-[rgba(153,197,255,0.4)]">{a.detail}</span>
              </div>
            ))}
            <p className="text-[10px] text-[rgba(153,197,255,0.35)] pt-1">Ask Cadi anything if you get stuck — I'm on every tab.</p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={finishOnboarding}
            className="mt-2 w-full rounded-[12px] bg-[#1f48ff] py-4 text-[15px] font-extrabold text-white shadow-[0_6px_24px_rgba(31,72,255,0.5)] transition hover:-translate-y-0.5 hover:bg-[#3a5eff] disabled:opacity-60"
          >
            {saving ? 'Setting up your account…' : `🚀 Open ${form.bizName || 'Cadi'}`}
          </button>
        </div>
      );
    }

    // Widget embed
    if (type === 'widget') {
      const snippet = form.businessId
        ? `<script src="https://widget.cadi.cleaning/widget.js" data-business-id="${form.businessId}" async></script>`
        : `<script src="https://widget.cadi.cleaning/widget.js" data-business-id="…" async></script>`;
      const bizName = form.bizName || 'Your Business';
      const slugDomain = bizName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        <div className="space-y-3">

          {/* ── Interactive browser mockup ── */}
          <div className="rounded-xl overflow-hidden border border-[rgba(153,197,255,0.15)] shadow-lg">
            {/* Browser chrome */}
            <div className="bg-[#06091f] px-3 py-2 flex items-center gap-2 border-b border-[rgba(153,197,255,0.08)]">
              <div className="flex gap-1.5 shrink-0">
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,80,80,0.5)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(255,200,50,0.5)]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[rgba(50,200,80,0.5)]" />
              </div>
              <div className="flex-1 bg-white/5 rounded px-3 py-[3px] text-[10px] text-white/25 font-mono truncate">
                www.{slugDomain}.co.uk
              </div>
            </div>

            {/* Fake website */}
            <div className="relative bg-gray-50" style={{ height: 200 }}>
              {/* Fake nav */}
              <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[#010a4f] font-black text-sm">{bizName}</span>
                <div className="flex gap-3">
                  {['Services', 'Areas', 'Contact'].map(l => (
                    <span key={l} className="text-gray-400 text-[10px]">{l}</span>
                  ))}
                </div>
              </div>
              {/* Fake hero content */}
              <div className="px-4 pt-4 pb-2">
                <div className="h-3 bg-gray-300 rounded-full w-40 mb-2.5" />
                <div className="h-2 bg-gray-200 rounded-full w-full mb-1.5" />
                <div className="h-2 bg-gray-200 rounded-full w-5/6 mb-1.5" />
                <div className="h-2 bg-gray-200 rounded-full w-3/4 mb-3" />
                <div className="h-7 bg-[#010a4f] rounded-lg w-28" />
              </div>

              {/* Chat bubble */}
              <button
                type="button"
                onClick={() => setWidgetDemoOpen(v => !v)}
                className="absolute bottom-3 right-3 w-12 h-12 rounded-full bg-[#1f48ff] shadow-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
                style={{ boxShadow: '0 4px 20px rgba(31,72,255,0.5)' }}
              >
                {widgetDemoOpen
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                  : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                }
              </button>

              {/* Widget chat panel */}
              {widgetDemoOpen && (
                <div className="absolute bottom-[68px] right-3 w-60 rounded-xl shadow-2xl overflow-hidden border border-gray-200 bg-white"
                  style={{ animation: 'fadeSlideUp 0.18s ease-out' }}>
                  <div className="bg-[#010a4f] px-4 py-3">
                    <p className="text-white font-bold text-[11px]">{bizName}</p>
                    <p className="text-white/50 text-[10px]">Instant quotes · Book online</p>
                  </div>
                  <div className="px-3 py-3 space-y-2.5 bg-gray-50">
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-[#1f48ff] shrink-0 flex items-center justify-center text-white text-[8px] font-black mt-0.5">C</div>
                      <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 text-[11px] text-gray-800 shadow-sm leading-relaxed">
                        Hi! 👋 I can get you a quote in under a minute. What type of clean are you looking for?
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap pl-8">
                      {['Regular clean ✓', 'Deep clean', 'End of tenancy'].map(opt => (
                        <span key={opt} className="px-2 py-1 rounded-full border border-[#1f48ff]/40 bg-white text-[#1f48ff] text-[10px] font-semibold">{opt}</span>
                      ))}
                    </div>
                    <div className="flex gap-2 items-start pl-8">
                      <div className="bg-[#1f48ff]/10 rounded-xl rounded-tl-none px-3 py-2 text-[11px] text-[#1f48ff] font-semibold shadow-sm">
                        Regular clean ✓
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-6 h-6 rounded-full bg-[#1f48ff] shrink-0 flex items-center justify-center text-white text-[8px] font-black mt-0.5">C</div>
                      <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 text-[11px] text-gray-800 shadow-sm leading-relaxed">
                        Great choice! How many bedrooms?
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-2">
                    <span className="flex-1 text-[11px] text-gray-300">Type a message…</span>
                    <div className="w-6 h-6 rounded-full bg-[#1f48ff] flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tap prompt / what it does */}
          {!widgetDemoOpen && (
            <p className="text-center text-xs text-[rgba(153,197,255,0.45)]">👆 Tap the blue button to see your customers' experience</p>
          )}
          {widgetDemoOpen && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { emoji: '⚡', label: 'Instant quotes', desc: 'No back-and-forth' },
                { emoji: '📩', label: 'Lead capture', desc: 'Name + email every time' },
                { emoji: '📅', label: 'Book direct', desc: 'Lands in your Cadi' },
              ].map(b => (
                <div key={b.label} className="rounded-xl bg-[#091660] border border-[rgba(153,197,255,0.1)] px-2 py-3 text-center">
                  <div className="text-base mb-1">{b.emoji}</div>
                  <div className="text-[10px] font-bold text-white leading-tight">{b.label}</div>
                  <div className="text-[10px] text-[rgba(153,197,255,0.4)] mt-0.5">{b.desc}</div>
                </div>
              ))}
            </div>
          )}

          {/* Code snippet */}
          <div className="rounded-xl bg-[#020d3a] border border-[rgba(153,197,255,0.15)] px-4 py-3 pr-14 font-mono text-[11px] text-[#99c5ff] break-all leading-relaxed relative">
            {snippet}
            <button
              type="button"
              onClick={() => { try { navigator.clipboard.writeText(snippet); flash('Copied!'); } catch {} }}
              className="absolute right-2 top-2 px-2 py-1 rounded-lg bg-[#1f48ff] text-white text-[10px] font-bold hover:bg-[#3a5eff] transition"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-[rgba(153,197,255,0.4)]">Paste this just before &lt;/body&gt; on your site. 30 seconds — or do it later in Settings → Front Desk.</p>

          <div className="flex gap-2">
            <button type="button" onClick={() => advance('Do it later', form)} className="rounded-[10px] border border-[rgba(153,197,255,0.15)] px-4 py-[11px] text-sm text-[rgba(153,197,255,0.5)] hover:text-white transition">
              Do it later
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleAnswer(id, 'Widget added ✓', 'Widget added')}
              className="flex-1 rounded-[10px] bg-[#1f48ff] py-[11px] text-sm font-bold text-white shadow-[0_4px_16px_rgba(31,72,255,0.4)] hover:bg-[#3a5eff] transition disabled:opacity-60"
            >
              {saving ? 'Saving…' : "I've added it →"}
            </button>
          </div>
        </div>
      );
    }

    // Marketplace interest
    if (type === 'marketplace-interest') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: true,  label: '✅ Yes, I\'m interested',   hint: "We'll add you to the early-access list" },
              { val: false, label: '⏳ Not now',                 hint: "No problem — you can join later in the Earn tab" },
            ].map(opt => (
              <button
                key={String(opt.val)}
                type="button"
                onClick={async () => {
                  const f2 = { ...form, marketplaceInterest: opt.val };
                  patch({ marketplaceInterest: opt.val });
                  setSaving(true);
                  try {
                    const interested = opt.val === true;
                    await supabase.from('profiles').update({
                      marketplace_interest:    interested,
                      marketplace_interest_at: interested ? new Date().toISOString() : null,
                      onboarding_step: 11,
                    }).eq('id', user.id);
                  } catch { setSaving(false); return; }
                  setSaving(false);
                  advance(opt.label, f2);
                }}
                className="rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 border-[rgba(153,197,255,0.15)] bg-[#091660] hover:border-[rgba(153,197,255,0.35)]"
              >
                <div className="text-sm font-bold text-white mb-1">{opt.label}</div>
                <div className="text-xs text-[rgba(153,197,255,0.5)]">{opt.hint}</div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return null;
  }

  // ── Chapter progress ────────────────────────────────────────────────────────

  const completedChapters = useMemo(() => {
    const done = new Set();
    messages.forEach(m => {
      if (m.role === 'user') {
        const turnForMsg = TURNS.find((t, i) => messages.findIndex(x => x.id === `user-${i}`) !== -1 && `user-${i}` === m.id);
        if (turnForMsg) done.add(turnForMsg.chapter);
      }
    });
    return done;
  }, [messages]);

  // ── Loading / redirect guards ───────────────────────────────────────────────

  const isLoading = loading || (user && profileLoading);
  if (!isModal && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#010a4f]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(153,197,255,0.3)] border-t-[#99c5ff]" />
      </div>
    );
  }
  if (!isModal && !user) return <Navigate to="/login" replace />;

  // ── Main render ─────────────────────────────────────────────────────────────

  const inner = (
    <div className="relative z-10 flex h-full w-full max-w-[680px] flex-col">

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[20px] font-extrabold tracking-[-0.4px] text-white">Cadi</div>
        <div className="flex items-center gap-2">
          {CHAPTERS.map((ch, i) => {
            const active = ch.id === currentChapter;
            const done = ch.id < currentChapter;
            return (
              <div key={ch.id} className="flex items-center gap-1.5">
                <div className={`flex h-[26px] items-center rounded-full px-3 text-[11px] font-bold transition-all ${active ? 'bg-[#1f48ff] text-white shadow-[0_0_12px_rgba(31,72,255,0.5)]' : done ? 'bg-[rgba(153,197,255,0.15)] text-[#99c5ff]' : 'text-[rgba(153,197,255,0.3)]'}`}>
                  {done ? '✓' : null} {ch.label}
                </div>
                {i < CHAPTERS.length - 1 && <div className={`h-px w-3 ${ch.id < currentChapter ? 'bg-[rgba(153,197,255,0.4)]' : 'bg-[rgba(153,197,255,0.12)]'}`} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat feed */}
      <div
        ref={chatRef}
        className="flex-1 overflow-y-auto space-y-4 pb-2 pr-1"
        style={{ maxHeight: isModal ? '52vh' : 'calc(100vh - 280px)', minHeight: '200px' }}
      >
        <style>{`
          @keyframes bubbleIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .bubble-in { animation: bubbleIn 0.3s ease forwards; }
          @keyframes blink { 0%,80%,100% { opacity: 0.3 } 40% { opacity: 1 } }
        `}</style>

        {messages.map(msg => (
          <div key={msg.id} className={`bubble-in flex ${msg.role === 'cadi' ? 'justify-start' : 'justify-end'}`}>
            {msg.role === 'cadi' && (
              <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f48ff] text-[13px] font-extrabold text-white shadow-[0_0_12px_rgba(31,72,255,0.4)]">C</div>
            )}
            <div
              className={`max-w-[82%] rounded-[18px] px-4 py-3 text-sm leading-[1.6] whitespace-pre-line ${
                msg.role === 'cadi'
                  ? 'rounded-tl-sm bg-[#05124a] text-white border border-[rgba(153,197,255,0.1)]'
                  : 'rounded-tr-sm bg-[#1f48ff] text-white'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="bubble-in flex justify-start">
            <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1f48ff] text-[13px] font-extrabold text-white">C</div>
            <div className="rounded-[18px] rounded-tl-sm border border-[rgba(153,197,255,0.1)] bg-[#05124a] px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <span key={i} className="h-2 w-2 rounded-full bg-[rgba(153,197,255,0.6)]" style={{ animation: `blink 1.2s ease ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      {!isTyping && turn && (
        <div className="bubble-in mt-4 rounded-[16px] border border-[rgba(153,197,255,0.12)] bg-[#05124a] p-4">
          {renderInput()}
        </div>
      )}
    </div>
  );

  // Notification toast
  const toast = notif && (
    <div className={`fixed right-5 top-5 z-[300] max-w-[340px] rounded-xl border px-4 py-3 text-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${notif.type === 'error' ? 'border-[rgba(248,113,113,0.3)] bg-[#3b0d0d] text-[#f87171]' : 'border-[rgba(52,211,153,0.3)] bg-[#0d3b2a] text-[#34d399]'}`}>
      {notif.type === 'error' ? '❌ ' : '✅ '}{notif.msg}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto">
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.03) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="pointer-events-none absolute -right-32 -top-40 h-[480px] w-[480px] rounded-full bg-[rgba(31,72,255,0.2)] blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 h-[320px] w-[320px] rounded-full bg-[rgba(153,197,255,0.07)] blur-[80px]" />
        {toast}
        <div className="relative flex min-h-full items-start justify-center px-4 py-8 text-white sm:py-10">
          {inner}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-x-hidden bg-[#010a4f] px-4 py-8 text-white sm:justify-center sm:py-10">
      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.03) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="pointer-events-none fixed -right-32 -top-40 h-[480px] w-[480px] rounded-full bg-[rgba(31,72,255,0.2)] blur-[90px]" />
      <div className="pointer-events-none fixed -bottom-24 -left-20 h-[320px] w-[320px] rounded-full bg-[rgba(153,197,255,0.07)] blur-[80px]" />
      {toast}
      <div className="relative z-10 w-full max-w-[680px] flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>
        {inner}
      </div>
    </div>
  );
}
