import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const TOTAL = 12;
const SKIP_STEPS = [10, 11];

const EDITION_LABEL = {
  residential: 'Residential',
  commercial: 'Commercial',
  exterior: 'Exterior',
};

const STRUCTURE_LABEL = {
  sole_trader: 'Sole Trader',
  limited: 'Limited Company',
  partnership: 'Partnership',
  llp: 'LLP',
};

const TEAM_LABEL = {
  solo: 'Solo Operator',
  small: 'Small Team (2-5)',
  growing: 'Growing Business (6-15)',
  enterprise: 'Enterprise (15+)',
};

const SERVICE_GROUPS = {
  residential: [
    {
      label: 'Regular Cleaning',
      items: ['Weekly Clean', 'Fortnightly Clean', 'Monthly Clean'],
    },
    {
      label: 'One-off & Specialist',
      items: ['Deep Clean', 'End of Tenancy', 'Move In / Move Out', 'Spring Clean', 'After Party Clean'],
    },
    {
      label: 'Holiday & Short-Let',
      items: ['Airbnb Turnover', 'Holiday Let Changeover'],
    },
    {
      label: 'Add-ons',
      items: ['Oven Clean', 'Carpet Clean', 'Inside Windows', 'Ironing Service'],
    },
  ],
  commercial: [
    {
      label: 'Office & Retail',
      items: ['Daily Office Clean', 'Weekly Office Clean', 'Retail Clean'],
    },
    {
      label: 'Education & Healthcare',
      items: ['School / College', 'Nursery / Childcare', 'Medical Practice', 'Care Home'],
    },
    {
      label: 'Hospitality',
      items: ['Restaurant / Cafe', 'Hotel', 'Pub / Bar', 'Event Venue'],
    },
    {
      label: 'Specialist',
      items: ['Post-Construction Clean', 'Periodic Deep Clean', 'Industrial / Warehouse'],
    },
  ],
  exterior: [
    {
      label: 'Window Cleaning',
      items: ['Residential Windows', 'Commercial Windows', 'Conservatory Glass'],
    },
    {
      label: 'Gutters & Roofline',
      items: ['Gutter Clearing', 'Fascia & Soffit Clean', 'Roof Moss Removal'],
    },
    {
      label: 'Jet Washing',
      items: ['Driveway Jet Wash', 'Patio / Decking', 'Path & Steps'],
    },
    {
      label: 'Building Exterior',
      items: ['Render Wash', 'UPVC Restoration', 'Solar Panel Clean'],
    },
  ],
};

const employmentTypeOptions = [
  'PAYE Employees',
  'Self-employed Subcontractors',
  'Zero-hours Contracts',
  'Agency Workers',
  'Family Members',
];

const accreditationOptions = ['BICSc', 'CHAS', 'Safe Contractor', 'Constructionline', 'ISO 9001', 'Living Wage Employer'];

const inputClassName = 'w-full rounded-[10px] border border-[rgba(153,197,255,0.12)] bg-[#091660] px-[13px] py-[11px] text-sm text-white outline-none transition focus:border-[#99c5ff] focus:ring-4 focus:ring-[rgba(153,197,255,0.12)] placeholder:text-[rgba(153,197,255,0.35)]';
const labelClassName = 'text-[11px] font-semibold uppercase tracking-[0.4px] text-[rgba(153,197,255,0.6)]';

function StepTag({ children }) {
  return (
    <div className="mb-[14px] inline-flex items-center gap-[6px] rounded-md border border-[rgba(153,197,255,0.2)] bg-[rgba(153,197,255,0.1)] px-[10px] py-1 text-[11px] font-semibold uppercase tracking-[0.6px] text-[#99c5ff]">
      {children}
    </div>
  );
}

function StepTitle({ children }) {
  return <h1 className="mb-2 text-[25px] font-extrabold leading-[1.2] tracking-[-0.4px] text-white">{children}</h1>;
}

function StepSubtitle({ children, mobileText }) {
  return (
    <>
      {mobileText ? (
        <>
          <p className="mb-7 text-sm leading-[1.55] text-[rgba(153,197,255,0.6)] sm:hidden">{mobileText}</p>
          <p className="mb-7 hidden text-sm leading-[1.55] text-[rgba(153,197,255,0.6)] sm:block">{children}</p>
        </>
      ) : (
        <p className="mb-7 text-sm leading-[1.55] text-[rgba(153,197,255,0.6)]">{children}</p>
      )}
    </>
  );
}

function ChoiceCard({ selected, onClick, icon, title, description, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative overflow-hidden rounded-[14px] border-2 p-[18px] text-left transition-all ${selected ? 'border-[#99c5ff] bg-[rgba(153,197,255,0.08)] shadow-[0_0_0_1px_rgba(153,197,255,0.15),0_8px_24px_rgba(31,72,255,0.2)]' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] hover:border-[rgba(153,197,255,0.4)] hover:bg-[#0d1e78] hover:-translate-y-0.5'} ${className}`}
    >
      {selected && (
        <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#99c5ff] text-[10px] font-extrabold text-[#010a4f]">
          ✓
        </span>
      )}
      {children ?? (
        <>
          {icon && <span className="mb-2 block text-2xl">{icon}</span>}
          <div className="mb-1 text-sm font-bold text-white">{title}</div>
          <div className="text-xs leading-[1.4] text-[rgba(153,197,255,0.6)]">{description}</div>
        </>
      )}
    </button>
  );
}

function ToggleRow({ checked, onChange, label, hint }) {
  return (
    <div className="mb-[10px] flex items-center justify-between rounded-xl border border-[rgba(153,197,255,0.12)] bg-[#091660] px-4 py-[13px]">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-[rgba(153,197,255,0.6)]">{hint}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-[#1f48ff]' : 'bg-[rgba(153,197,255,0.2)]'}`}
      >
        <span className={`absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white transition ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function Chip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs transition sm:px-[13px] sm:py-2 sm:text-[13px] ${selected ? 'border-[#99c5ff] bg-[rgba(31,72,255,0.2)] text-[#99c5ff]' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.28)] hover:bg-[#0d1e78] hover:text-white'}`}
    >
      {children}
    </button>
  );
}

function InfoBox({ tone = 'info', children }) {
  const toneClasses = {
    info: 'border-[rgba(153,197,255,0.18)] bg-[rgba(153,197,255,0.08)] text-[#99c5ff]',
    warning: 'border-[rgba(251,146,60,0.2)] bg-[rgba(251,146,60,0.08)] text-[#fb923c]',
    success: 'border-[rgba(52,211,153,0.2)] bg-[rgba(52,211,153,0.08)] text-[#34d399]',
  };

  return <div className={`mt-[14px] flex gap-[10px] rounded-[10px] border px-[15px] py-[13px] text-[13px] leading-[1.5] ${toneClasses[tone]}`}>{children}</div>;
}

function ProgressDots({ current }) {
  return (
    <div className="flex items-center gap-[5px]">
      {Array.from({ length: TOTAL }, (_, index) => {
        const stepNumber = index + 1;
        const active = stepNumber === current;
        const done = stepNumber < current;
        return (
          <div
            key={stepNumber}
            className="rounded-full transition-all duration-300"
            style={{
              width: active ? 22 : 7,
              height: 7,
              borderRadius: active ? 4 : 999,
              background: active ? '#99c5ff' : done ? 'rgba(153,197,255,0.45)' : 'rgba(153,197,255,0.2)',
              boxShadow: active ? '0 0 10px rgba(153,197,255,0.75)' : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

export default function Onboarding({ isModal = false, onComplete = null }) {
  const { user, profile, loading, profileLoading, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(1);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState(null);
  const [activeServiceTab, setActiveServiceTab] = useState('residential');
  const [expandedServiceGroups, setExpandedServiceGroups] = useState({ residential: 0, commercial: 0, exterior: 0 });
  const [csvFileName, setCsvFileName] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bizName: '',
    bizEmail: '',
    bizPhone: '',
    bizPostcode: '',
    cleanerType: null,
    cleanerSectors: [],
    bizStructure: null,
    companyNumber: '',
    fyEnd: '',
    vatRegistered: false,
    vatNumber: '',
    vatScheme: '',
    teamStructure: null,
    employmentTypes: [],
    services: [],
    customService: '',
    hourlyRate: '',
    minJobRate: '',
    minJobMins: '120',
    weekendUplift: '50',
    quoteType: 'inc_vat',
    paymentTerms: '0',
    workingDays: 'mon_fri',
    startTime: '08:00',
    finishTime: '17:00',
    currentRevenue: '',
    targetRevenue: '',
    currentClients: '',
    targetClients: '',
    targetDate: '',
    ambition: 'growing_fast',
    pli: false,
    pliPolicy: '',
    pliRenewal: '',
    dbs: false,
    ico: false,
    coshh: false,
    accreditations: [],
    bankConnected: false,
    goCardless: false,
    stripe: false,
    accountantName: '',
    accountantEmail: '',
    accountantFirm: '',
  });

  function patchForm(patch) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  function flash(message, type = 'success') {
    setNotif({ message, type });
    window.clearTimeout(flash.timeoutId);
    flash.timeoutId = window.setTimeout(() => setNotif(null), 4000);
  }

  useEffect(() => {
    if (!profile) return;

    const setup = profile?.setup_data || null;
    const setupData = typeof setup === 'object' && setup !== null ? setup : null;

    setForm(prev => ({
      ...prev,
      firstName: profile.first_name || prev.firstName,
      lastName: profile.last_name || prev.lastName,
      bizName: profile.business_name || prev.bizName,
      bizEmail: user?.email || setupData?.business_email || prev.bizEmail,
      bizPhone: profile.phone || prev.bizPhone,
      bizPostcode: profile.postcode || prev.bizPostcode,
      cleanerType: profile.cleaner_type || prev.cleanerType,
      cleanerSectors: setupData?.cleaner_sectors || (profile.cleaner_type ? [profile.cleaner_type] : prev.cleanerSectors),
      bizStructure: profile.biz_structure || prev.bizStructure,
      teamStructure: profile.team_structure || prev.teamStructure,
      companyNumber: setupData?.company_number || prev.companyNumber,
      fyEnd: setupData?.fy_end || prev.fyEnd,
      vatRegistered: typeof profile.vat_registered === 'boolean' ? profile.vat_registered : prev.vatRegistered,
      vatNumber: setupData?.vat_number || prev.vatNumber,
      vatScheme: setupData?.vat_scheme || prev.vatScheme,
      employmentTypes: setupData?.employment_types || prev.employmentTypes,
      services: setupData?.services || prev.services,
      customService: setupData?.custom_service || prev.customService,
      hourlyRate: setupData?.hourly_rate?.toString?.() || prev.hourlyRate,
      minJobRate: setupData?.min_job_rate?.toString?.() || prev.minJobRate,
      minJobMins: setupData?.min_job_mins?.toString?.() || prev.minJobMins,
      weekendUplift: setupData?.weekend_uplift?.toString?.() || prev.weekendUplift,
      quoteType: setupData?.quote_type || prev.quoteType,
      paymentTerms: setupData?.payment_terms?.toString?.() || prev.paymentTerms,
      workingDays: setupData?.working_days || prev.workingDays,
      startTime: setupData?.start_time || prev.startTime,
      finishTime: setupData?.finish_time || prev.finishTime,
      currentRevenue: setupData?.current_revenue?.toString?.() || prev.currentRevenue,
      targetRevenue: setupData?.target_revenue?.toString?.() || prev.targetRevenue,
      currentClients: setupData?.current_clients?.toString?.() || prev.currentClients,
      targetClients: setupData?.target_clients?.toString?.() || prev.targetClients,
      targetDate: setupData?.target_date || prev.targetDate,
      ambition: setupData?.ambition || prev.ambition,
      pli: typeof setupData?.pli === 'boolean' ? setupData.pli : prev.pli,
      pliPolicy: setupData?.pli_policy || prev.pliPolicy,
      pliRenewal: setupData?.pli_renewal || prev.pliRenewal,
      dbs: typeof setupData?.dbs === 'boolean' ? setupData.dbs : prev.dbs,
      ico: typeof setupData?.ico === 'boolean' ? setupData.ico : prev.ico,
      coshh: typeof setupData?.coshh === 'boolean' ? setupData.coshh : prev.coshh,
      accreditations: setupData?.accreditations || prev.accreditations,
      bankConnected: typeof setupData?.bank_connected === 'boolean' ? setupData.bank_connected : prev.bankConnected,
      goCardless: typeof setupData?.gocardless === 'boolean' ? setupData.gocardless : prev.goCardless,
      stripe: typeof setupData?.stripe === 'boolean' ? setupData.stripe : prev.stripe,
      accountantName: setupData?.accountant_name || prev.accountantName,
      accountantEmail: setupData?.accountant_email || prev.accountantEmail,
      accountantFirm: setupData?.accountant_firm || prev.accountantFirm,
    }));

    if (profile.onboarding_step) {
      setCurrent(Math.min(profile.onboarding_step, TOTAL));
    }
  }, [profile, user]);

  useEffect(() => {
    if (profile?.onboarding_complete) {
      if (isModal) { onComplete?.(); }
      else { navigate('/dashboard', { replace: true }); }
    }
  }, [profile, navigate, isModal, onComplete]);

  useEffect(() => {
    setExpandedServiceGroups(prev => {
      if (typeof prev[activeServiceTab] === 'number') return prev;
      return { ...prev, [activeServiceTab]: 0 };
    });
  }, [activeServiceTab]);

  const score = useMemo(() => {
    let total = 0;
    if (form.firstName) total += 8;
    if (form.lastName) total += 8;
    if (form.bizName) total += 8;
    if (form.bizEmail) total += 8;
    if (form.cleanerType) total += 8;
    if (form.bizStructure) total += 8;
    if (form.vatRegistered || !form.vatRegistered) total += 8;
    if (form.teamStructure) total += 8;
    if (form.services.length || form.customService) total += 10;
    if (form.hourlyRate || form.minJobRate) total += 10;
    if (form.targetRevenue || form.targetClients) total += 10;
    if (form.pli || form.dbs || form.ico || form.coshh) total += 7;
    if (form.bankConnected || form.goCardless || form.stripe) total += 4;
    if (form.accountantName || form.accountantEmail) total += 3;
    return Math.min(100, total);
  }, [form]);

  const missingItems = useMemo(() => {
    const items = [];
    if (!form.bankConnected) items.push('Connect your business bank account');
    if (!form.accountantName && !form.accountantEmail) items.push('Add your accountant details');
    if (!form.services.length && !form.customService) items.push('Select your core services');
    if (!form.targetRevenue) items.push('Set a revenue target');
    return items;
  }, [form]);

  async function loadSetupData() {
    const { data, error } = await supabase
      .from('business_settings')
      .select('setup_data')
      .eq('owner_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data?.setup_data || {};
  }

  async function mergeSetupData(patch) {
    const existing = await loadSetupData();
    const { error } = await supabase
      .from('business_settings')
      .update({ setup_data: { ...existing, ...patch } })
      .eq('owner_id', user.id);

    if (error) throw error;
  }

  function validateStep(step) {
    if (step === 1) {
      if (!form.firstName.trim()) return 'Please enter your first name.';
      if (!form.lastName.trim()) return 'Please enter your last name.';
      if (!form.bizName.trim()) return 'Please enter your business name.';
      if (!form.bizEmail.trim() || !form.bizEmail.includes('@')) return 'Please enter a valid business email.';
    }

    if (step === 2 && form.cleanerSectors.length === 0) return 'Please select at least one cleaning sector.';
    if (step === 3 && !form.bizStructure) return 'Please select your business structure.';
    if (step === 5 && !form.teamStructure) return 'Please select your team structure.';

    return null;
  }

  async function saveCurrentStep() {
    if (!user) return;

    if (current === 1) {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          business_name: form.bizName.trim(),
          phone: form.bizPhone.trim(),
          postcode: form.bizPostcode.trim(),
          onboarding_step: 2,
        })
        .eq('id', user.id);
      if (error) throw error;
      await mergeSetupData({ business_email: form.bizEmail.trim() });
      return;
    }

    if (current === 2) {
      const primarySector = form.cleanerSectors[0] || form.cleanerType;
      const { error } = await supabase
        .from('profiles')
        .update({ cleaner_type: primarySector, onboarding_step: 3 })
        .eq('id', user.id);
      if (error) throw error;
      await mergeSetupData({ cleaner_sectors: form.cleanerSectors });
      return;
    }

    if (current === 3) {
      const { error } = await supabase
        .from('profiles')
        .update({ biz_structure: form.bizStructure, onboarding_step: 4 })
        .eq('id', user.id);
      if (error) throw error;
      await mergeSetupData({ company_number: form.companyNumber.trim(), fy_end: form.fyEnd || null });
      return;
    }

    if (current === 4) {
      const { error } = await supabase
        .from('business_settings')
        .update({ vat_registered: form.vatRegistered })
        .eq('owner_id', user.id);
      if (error) throw error;
      await mergeSetupData({ vat_number: form.vatNumber.trim(), vat_scheme: form.vatScheme || null });
      await supabase.from('profiles').update({ onboarding_step: 5 }).eq('id', user.id);
      return;
    }

    if (current === 5) {
      const { error } = await supabase
        .from('profiles')
        .update({ team_structure: form.teamStructure, onboarding_step: 6 })
        .eq('id', user.id);
      if (error) throw error;
      await mergeSetupData({ employment_types: form.employmentTypes });
      return;
    }

    if (current === 6) {
      await mergeSetupData({ services: form.services, custom_service: form.customService.trim() });
      await supabase.from('profiles').update({ onboarding_step: 7 }).eq('id', user.id);
      return;
    }

    if (current === 7) {
      const hourlyRate = Number(form.hourlyRate || 0);
      const { error } = await supabase
        .from('business_settings')
        .update({ hourly_rate: hourlyRate || 20 })
        .eq('owner_id', user.id);
      if (error) throw error;
      await mergeSetupData({
        hourly_rate: hourlyRate || null,
        min_job_rate: Number(form.minJobRate || 0) || null,
        min_job_mins: Number(form.minJobMins || 120),
        quote_type: form.quoteType,
        payment_terms: Number(form.paymentTerms || 0),
        working_days: form.workingDays,
        start_time: form.startTime,
        finish_time: form.finishTime,
      });
      await supabase.from('profiles').update({ onboarding_step: 8 }).eq('id', user.id);
      return;
    }

    if (current === 8) {
      const annualTarget = Number(form.targetRevenue || 0) * 12;
      if (annualTarget) {
        const { error } = await supabase
          .from('business_settings')
          .update({ annual_target: annualTarget })
          .eq('owner_id', user.id);
        if (error) throw error;
      }

      await mergeSetupData({
        current_revenue: Number(form.currentRevenue || 0) || null,
        target_revenue: Number(form.targetRevenue || 0) || null,
        current_clients: Number(form.currentClients || 0) || null,
        target_clients: Number(form.targetClients || 0) || null,
        target_date: form.targetDate || null,
        ambition: form.ambition,
      });
      await supabase.from('profiles').update({ onboarding_step: 9 }).eq('id', user.id);
      return;
    }

    if (current === 9) {
      await mergeSetupData({
        pli: form.pli,
        pli_policy: form.pliPolicy.trim(),
        pli_renewal: form.pliRenewal || null,
        dbs: form.dbs,
        ico: form.ico,
        coshh: form.coshh,
        accreditations: form.accreditations,
      });
      await supabase.from('profiles').update({ onboarding_step: 10 }).eq('id', user.id);
      return;
    }

    if (current === 10) {
      await mergeSetupData({
        bank_connected: form.bankConnected,
        gocardless: form.goCardless,
        stripe: form.stripe,
        accountant_name: form.accountantName.trim(),
        accountant_email: form.accountantEmail.trim(),
        accountant_firm: form.accountantFirm.trim(),
      });
      await supabase.from('profiles').update({ onboarding_step: 11 }).eq('id', user.id);
      return;
    }

    if (current === 11) {
      await mergeSetupData({ customer_import_file: csvFileName || null });
      await supabase.from('profiles').update({ onboarding_step: 12 }).eq('id', user.id);
    }
  }

  async function handleNext() {
    if (current === TOTAL) {
      await finishOnboarding();
      return;
    }

    const errorMessage = validateStep(current);
    if (errorMessage) {
      flash(errorMessage, 'error');
      return;
    }

    setSaving(true);
    try {
      await saveCurrentStep();
    } catch (error) {
      flash(error.message || 'Something went wrong while saving.', 'error');
      setSaving(false);
      return;
    }

    setSaving(false);
    setCurrent(prev => prev + 1);
  }

  function handleBack() {
    if (current > 1) setCurrent(prev => prev - 1);
  }

  function handleSkip() {
    setCurrent(prev => Math.min(TOTAL, prev + 1));
  }

  async function finishOnboarding() {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true, onboarding_step: TOTAL })
        .eq('id', user.id);
      if (error) throw error;
      await updateProfile({ onboarding_complete: true, onboarding_step: TOTAL });
      if (isModal) { onComplete?.(); }
      else { navigate('/dashboard', { replace: true }); }
    } catch (error) {
      flash(error.message || 'Could not complete onboarding.', 'error');
      setSaving(false);
    }
  }

  function toggleArrayValue(field, value) {
    patchForm({
      [field]: form[field].includes(value)
        ? form[field].filter(item => item !== value)
        : [...form[field], value],
    });
  }

  function setExpandedGroup(tab, index) {
    setExpandedServiceGroups(prev => ({
      ...prev,
      [tab]: prev[tab] === index ? -1 : index,
    }));
  }

  const isLoading = loading || (user && profileLoading);
  if (!isModal && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#010a4f]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1f48ff] animate-pulse">
            <span className="text-2xl font-black text-white">CP</span>
          </div>
          <p className="text-sm font-semibold text-[#99c5ff]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isModal && !user) {
    return <Navigate to="/login" replace />;
  }

  // ── Shared inner content ──────────────────────────────────────────────────
  const innerContent = (
    <div className="relative z-10 w-full max-w-[740px]">
      <div className="mb-6 flex flex-col gap-3 sm:mb-7 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[22px] font-extrabold tracking-[-0.5px] text-white">Cadi</div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-1">
          <ProgressDots current={current} />
          <div className="text-xs font-semibold text-[rgba(153,197,255,0.6)] sm:ml-[10px]">
            Step <span className="text-[#99c5ff]">{current}</span> of <span>{TOTAL}</span>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[22px] border border-[rgba(153,197,255,0.12)] bg-[#05124a] p-5 sm:p-8 before:absolute before:left-0 before:right-0 before:top-0 before:h-px before:bg-[linear-gradient(90deg,transparent,#99c5ff,#1f48ff,transparent)] before:opacity-60 before:content-['']">
        <style>{`@keyframes onboardingStepIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}`}</style>
        <div key={current} style={{ animation: 'onboardingStepIn 350ms ease' }}>
          {current === 1 && (
            <>
              <StepTag>👋 Welcome</StepTag>
              <StepTitle>
                {form.firstName ? (
                  <>Welcome, <span className="text-[#99c5ff]">{form.firstName}</span>!</>
                ) : (
                  <>Welcome to <span className="text-[#99c5ff]">Cadi</span>!</>
                )}
              </StepTitle>
              {form.bizName ? (
                <p className="mb-3 text-base font-semibold text-[rgba(153,197,255,0.85)]">
                  Let's set up your Cadi account for <span className="text-white">{form.bizName}</span>
                </p>
              ) : null}
              <StepSubtitle mobileText="Takes about 5 minutes. We'll tailor every part of the app to your business.">Takes about 5 minutes. Your answers shape everything — your dashboard, pricing tools, tax settings, scheduling and more. Let's build something brilliant.</StepSubtitle>
              <div className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                <div className="flex flex-col gap-[6px]">
                  <label className={labelClassName}>First Name *</label>
                  <input className={inputClassName} value={form.firstName} onChange={e => patchForm({ firstName: e.target.value })} placeholder="e.g. Sarah" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <label className={labelClassName}>Last Name *</label>
                  <input className={inputClassName} value={form.lastName} onChange={e => patchForm({ lastName: e.target.value })} placeholder="e.g. Mitchell" />
                </div>
                <div className="col-span-2 flex flex-col gap-[6px] max-[600px]:col-span-1">
                  <label className={labelClassName}>Business Name *</label>
                  <input className={inputClassName} value={form.bizName} onChange={e => patchForm({ bizName: e.target.value })} placeholder="e.g. Spotless Pro Cleaning" />
                </div>
                <div className="col-span-2 flex flex-col gap-[6px] max-[600px]:col-span-1">
                  <label className={labelClassName}>Business Email *</label>
                  <input className={inputClassName} type="email" value={form.bizEmail} onChange={e => patchForm({ bizEmail: e.target.value })} placeholder="hello@spotlesspro.co.uk" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <label className={labelClassName}>Phone Number</label>
                  <input className={inputClassName} value={form.bizPhone} onChange={e => patchForm({ bizPhone: e.target.value })} placeholder="07700 900 000" />
                </div>
                <div className="flex flex-col gap-[6px]">
                  <label className={labelClassName}>Base Postcode</label>
                  <input className={inputClassName} value={form.bizPostcode} onChange={e => patchForm({ bizPostcode: e.target.value })} placeholder="e.g. RM1 3AB" />
                </div>
              </div>
            </>
          )}

          {current === 2 && (
            <>
              <StepTag>🧹 Cleaning Sectors</StepTag>
              <StepTitle>Which sectors do <span className="text-[#99c5ff]">you work in?</span></StepTitle>
              <StepSubtitle mobileText="Select all that apply — your chosen sectors appear first throughout the app.">Choose all the sectors you work in. Your selections determine which services, pricing templates and tools appear first throughout the app. You can add more later.</StepSubtitle>
              <div className="grid grid-cols-3 gap-[11px] max-[600px]:grid-cols-1">
                {[
                  { key: 'residential', emoji: '🏠', title: 'Residential', desc: 'Domestic homes, end of tenancy, regular cleans, Airbnb turnarounds, ironing', border: 'rgba(16,185,129,0.25)', bg: 'linear-gradient(135deg,rgba(16,185,129,.12),rgba(16,185,129,.05))', stripe: '#10b981', selectedBorder: '#10b981', selectedShadow: '0 8px 28px rgba(16,185,129,.2)' },
                  { key: 'commercial', emoji: '🏢', title: 'Commercial', desc: 'Offices, retail, schools, hospitality, industrial, contract cleaning', border: 'rgba(153,197,255,0.25)', bg: 'linear-gradient(135deg,rgba(153,197,255,.12),rgba(31,72,255,.08))', stripe: '#99c5ff', selectedBorder: '#99c5ff', selectedShadow: '0 8px 28px rgba(31,72,255,.25)' },
                  { key: 'exterior', emoji: '🪟', title: 'Exterior', desc: 'Windows, gutters, jet washing, fascias, solar panels, render washing', border: 'rgba(251,146,60,0.25)', bg: 'linear-gradient(135deg,rgba(251,146,60,.12),rgba(251,146,60,.05))', stripe: '#fb923c', selectedBorder: '#fb923c', selectedShadow: '0 8px 28px rgba(251,146,60,.2)' },
                ].map(card => {
                  const selected = form.cleanerSectors.includes(card.key);
                  return (
                    <button
                      key={card.key}
                      type="button"
                      onClick={() => {
                        const updated = selected
                          ? form.cleanerSectors.filter(s => s !== card.key)
                          : [...form.cleanerSectors, card.key];
                        patchForm({ cleanerSectors: updated, cleanerType: updated[0] || null });
                        if (!selected) setActiveServiceTab(card.key);
                      }}
                      className="relative overflow-hidden rounded-2xl border-2 p-[22px] text-left transition-all hover:-translate-y-[3px] hover:brightness-110"
                      style={{ borderColor: selected ? card.selectedBorder : card.border, background: card.bg, boxShadow: selected ? card.selectedShadow : 'none' }}
                    >
                      {selected && (
                        <span className="absolute right-[14px] top-3 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[11px] font-extrabold"
                          style={{ background: card.selectedBorder, color: card.key === 'commercial' ? '#010a4f' : '#fff' }}>✓</span>
                      )}
                      <div className="mb-[14px] h-1 w-8 rounded-sm" style={{ background: card.stripe }} />
                      <div className="mb-[10px] text-[30px]">{card.emoji}</div>
                      <div className="mb-[5px] text-[15px] font-bold">{card.title}</div>
                      <div className="text-xs leading-[1.45] text-[rgba(153,197,255,0.6)]">{card.desc}</div>
                    </button>
                  );
                })}
              </div>
              {form.cleanerSectors.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-[13px] text-[rgba(153,197,255,0.7)]">
                  <span className="text-[#99c5ff] font-semibold">{form.cleanerSectors.length} sector{form.cleanerSectors.length > 1 ? 's' : ''} selected</span>
                  {form.cleanerSectors.length > 1 && <span>— your primary sector will appear first across the app</span>}
                </div>
              )}
            </>
          )}

          {current === 3 && (
            <>
              <StepTag>📋 Legal Structure</StepTag>
              <StepTitle>How is your business <span className="text-[#99c5ff]">set up legally?</span></StepTitle>
              <StepSubtitle mobileText="This helps us set up your accounting and tax defaults correctly.">This affects how Cadi handles your accounts, tax calculations, Self Assessment, and compliance tools. Not sure yet? No problem.</StepSubtitle>
              <div className="grid grid-cols-2 gap-[11px] max-[600px]:grid-cols-1">
                {[
                  { value: 'sole_trader', icon: '👤', title: 'Sole Trader', description: 'Self-employed, file Self Assessment. Most common for independent cleaners.' },
                  { value: 'limited', icon: '🏛️', title: 'Limited Company', description: 'Incorporated, pay Corporation Tax. Directors take salary + dividends.' },
                  { value: 'partnership', icon: '🤝', title: 'Partnership', description: 'Two or more people sharing profits and liability jointly.' },
                  { value: 'llp', icon: '📑', title: 'LLP', description: 'Limited Liability Partnership — flexibility with legal protection.' },
                  { value: 'new_business', icon: '🌱', title: 'New Business / Just Getting Started', description: "Haven't set up yet — I'm in the early stages of launching my cleaning business." },
                ].map(option => (
                  <ChoiceCard
                    key={option.value}
                    selected={form.bizStructure === option.value}
                    onClick={() => patchForm({ bizStructure: option.value })}
                    icon={option.icon}
                    title={option.title}
                    description={option.description}
                    className={option.value === 'new_business' ? 'col-span-2 max-[600px]:col-span-1' : ''}
                  />
                ))}
              </div>

              {form.bizStructure === 'new_business' && (
                <InfoBox tone="success">
                  <span>🚀</span>
                  <div>
                    <strong>Welcome to the start of something great!</strong> We'll send you a free guide to setting up your cleaning business — covering sole trader registration, insurance, pricing, and landing your first customers.
                    <button
                      type="button"
                      onClick={() => flash('Starter guide sent! Check your email for everything you need to get going.')}
                      className="mt-2 block rounded-lg border border-[rgba(52,211,153,0.4)] px-4 py-2 text-xs font-bold text-[#34d399] hover:bg-[rgba(52,211,153,0.1)] transition"
                    >
                      📧 Send me the free starter guide →
                    </button>
                  </div>
                </InfoBox>
              )}

              {form.bizStructure === 'limited' && (
                <>
                  <hr className="my-[22px] border-t border-[rgba(153,197,255,0.12)]" />
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Limited Company Details</div>
                  <div className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                    <div className="flex flex-col gap-[6px]">
                      <label className={labelClassName}>Company Registration Number</label>
                      <input className={inputClassName} value={form.companyNumber} onChange={e => patchForm({ companyNumber: e.target.value })} placeholder="e.g. 12345678" />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className={labelClassName}>Financial Year End</label>
                      <input className={inputClassName} type="date" value={form.fyEnd} onChange={e => patchForm({ fyEnd: e.target.value })} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {current === 4 && (
            <>
              <StepTag>🧾 VAT Status</StepTag>
              <StepTitle>Are you <span className="text-[#99c5ff]">VAT registered?</span></StepTitle>
              <StepSubtitle mobileText="If you're under £90,000 turnover, registration is usually optional.">Not sure? If your annual turnover is under £90,000 you're not required to register — but you can choose to voluntarily.</StepSubtitle>

              <ToggleRow checked={form.vatRegistered} onChange={value => patchForm({ vatRegistered: value })} label="VAT Registered" hint="I am registered for VAT with HMRC" />

              {form.vatRegistered ? (
                <>
                  <div className="mt-[14px] grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                    <div className="flex flex-col gap-[6px]">
                      <label className={labelClassName}>VAT Registration Number</label>
                      <input className={inputClassName} value={form.vatNumber} onChange={e => patchForm({ vatNumber: e.target.value })} placeholder="GB123456789" />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                      <label className={labelClassName}>VAT Scheme</label>
                      <select className={inputClassName} value={form.vatScheme} onChange={e => patchForm({ vatScheme: e.target.value })}>
                        <option value="">Select scheme...</option>
                        <option value="standard">Standard Rate (20%)</option>
                        <option value="flat">Flat Rate Scheme</option>
                        <option value="annual">Annual Accounting</option>
                        <option value="cash">Cash Accounting</option>
                      </select>
                    </div>
                  </div>
                  {form.vatScheme === 'flat' && (
                    <InfoBox tone="warning">
                      <span>⚠️</span>
                      <span>Cadi will automatically run the <strong>Limited Cost Trader test</strong> each quarter. If your goods spend is under 2% of turnover, your flat rate drops to 16.5%.</span>
                    </InfoBox>
                  )}
                </>
              ) : (
                <InfoBox>
                  <span>💡</span>
                  <span>Cadi will monitor your turnover and alert you when you're approaching the £90,000 VAT registration threshold.</span>
                </InfoBox>
              )}
            </>
          )}

          {current === 5 && (
            <>
              <StepTag>👥 Team Structure</StepTag>
              <StepTitle>Do you work <span className="text-[#99c5ff]">solo or with a team?</span></StepTitle>
              <StepSubtitle mobileText="We'll tailor staff, scheduling, and payroll tools to this choice.">Determines your scheduling, job assignment, payroll tracking, and team features. All plans include a 14-day free trial — no card required.</StepSubtitle>
              <div className="grid grid-cols-2 gap-[11px] max-[600px]:grid-cols-1">
                {[
                  {
                    value: 'solo', icon: '🧑', title: 'Solo Operator',
                    description: 'Just me — I run everything myself.',
                    plan: 'Free', planDetail: 'Up to 15 customers · all core tools', planColor: 'text-[#34d399]', planBg: 'bg-[rgba(52,211,153,0.12)] border-[rgba(52,211,153,0.25)]',
                  },
                  {
                    value: 'small', icon: '👥', title: 'Small Team (2–5)',
                    description: 'A small mix of employees or subcontractors.',
                    plan: 'Pro · £19/mo', planDetail: 'Up to 100 customers · 5 team members', planColor: 'text-[#99c5ff]', planBg: 'bg-[rgba(153,197,255,0.1)] border-[rgba(153,197,255,0.25)]',
                  },
                  {
                    value: 'growing', icon: '📈', title: 'Growing Business (6–15)',
                    description: 'Multiple staff — scheduling, job assignment, payroll.',
                    plan: 'Business · £39/mo', planDetail: 'Unlimited customers · 20 team members', planColor: 'text-[#fb923c]', planBg: 'bg-[rgba(251,146,60,0.1)] border-[rgba(251,146,60,0.25)]',
                  },
                  {
                    value: 'enterprise', icon: '🏢', title: 'Enterprise (15+)',
                    description: 'Multiple locations, managers, advanced reporting.',
                    plan: 'Enterprise · Custom', planDetail: 'Unlimited everything · priority support', planColor: 'text-[#a78bfa]', planBg: 'bg-[rgba(167,139,250,0.1)] border-[rgba(167,139,250,0.25)]',
                  },
                ].map(option => (
                  <ChoiceCard
                    key={option.value}
                    selected={form.teamStructure === option.value}
                    onClick={() => patchForm({ teamStructure: option.value })}
                  >
                    <div className="mb-2 text-2xl">{option.icon}</div>
                    <div className="mb-1 text-sm font-bold text-white">{option.title}</div>
                    <div className="mb-3 text-xs leading-[1.4] text-[rgba(153,197,255,0.6)]">{option.description}</div>
                    <div className={`rounded-lg border px-3 py-2 ${option.planBg}`}>
                      <div className={`text-xs font-bold ${option.planColor}`}>{option.plan}</div>
                      <div className="text-[11px] text-[rgba(153,197,255,0.55)] mt-0.5">{option.planDetail}</div>
                    </div>
                  </ChoiceCard>
                ))}
              </div>

              <InfoBox>
                <span>🎁</span>
                <span>All paid plans come with a <strong>14-day free trial</strong> — no credit card required. You can upgrade, downgrade or cancel at any time from your account settings.</span>
              </InfoBox>

              {form.teamStructure && form.teamStructure !== 'solo' && (
                <div className="mt-[18px]">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Employment Types in Your Team</div>
                  <div className="flex flex-wrap gap-2">
                    {employmentTypeOptions.map(option => (
                      <Chip key={option} selected={form.employmentTypes.includes(option)} onClick={() => toggleArrayValue('employmentTypes', option)}>
                        {option}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {current === 6 && (
            <>
              <StepTag>✅ Your Services</StepTag>
              <StepTitle>Which services <span className="text-[#99c5ff]">do you offer?</span></StepTitle>
              <StepSubtitle mobileText="Pick your core services so quotes, invoices, and job cards are pre-built correctly.">Select everything you do across any sector. These build your pricing calculators, job cards, invoice templates and service menus throughout the app.</StepSubtitle>
              <div className="mb-[14px] flex items-start gap-2.5 rounded-[10px] border border-[rgba(153,197,255,0.15)] bg-[#0a1860] px-[14px] py-[10px]">
                <span className="mt-px text-sm">📅</span>
                <p className="text-[12px] leading-relaxed text-[rgba(153,197,255,0.75)]">
                  <span className="font-semibold text-[#99c5ff]">Tip — select everything you offer.</span> Your choices appear as quick-pick options every time you add a new job in the Schedule tab, so booking is faster from day one.
                </p>
              </div>
              <div className="mb-[18px] flex flex-wrap gap-[6px]">
                {Object.keys(SERVICE_GROUPS).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveServiceTab(tab)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition sm:px-[14px] sm:py-[7px] sm:text-xs ${activeServiceTab === tab ? 'border-[#1f48ff] bg-[#1f48ff] text-white' : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.6)] hover:border-[rgba(153,197,255,0.28)] hover:text-white'}`}
                  >
                    {tab === 'residential' ? '🏠 Residential' : tab === 'commercial' ? '🏢 Commercial' : '🪟 Exterior'}
                  </button>
                ))}
              </div>

              <div>
                {SERVICE_GROUPS[activeServiceTab].map(group => (
                  <div key={group.label} className="mb-[14px] last:mb-0 overflow-hidden rounded-xl border border-[rgba(153,197,255,0.12)] bg-[#091660]">
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(activeServiceTab, SERVICE_GROUPS[activeServiceTab].indexOf(group))}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#0d1e78]"
                    >
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">{group.label}</div>
                        <div className="mt-1 text-xs text-[rgba(153,197,255,0.45)]">
                          {group.items.filter(item => form.services.includes(item)).length} selected
                        </div>
                      </div>
                      <span className="text-sm text-[rgba(153,197,255,0.75)]">
                        {expandedServiceGroups[activeServiceTab] === SERVICE_GROUPS[activeServiceTab].indexOf(group) ? '−' : '+'}
                      </span>
                    </button>
                    {expandedServiceGroups[activeServiceTab] === SERVICE_GROUPS[activeServiceTab].indexOf(group) && (
                      <div className="flex flex-wrap gap-2 border-t border-[rgba(153,197,255,0.08)] px-4 py-4">
                        {group.items.map(item => (
                          <Chip key={item} selected={form.services.includes(item)} onClick={() => toggleArrayValue('services', item)}>
                            {item}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-[18px] flex flex-col gap-[6px]">
                <label className={labelClassName}>Other services not listed above</label>
                <input className={inputClassName} value={form.customService} onChange={e => patchForm({ customService: e.target.value })} placeholder="e.g. Swimming pool surround, clinical clean, waste removal..." />
                <p className="text-[11px] text-[rgba(153,197,255,0.45)]">Separate multiple services with a comma. These will be available throughout your pricing and invoicing tools.</p>
              </div>
            </>
          )}

          {current === 7 && (
            <>
              <StepTag>💷 Pricing Foundations</StepTag>
              <StepTitle>How do you <span className="text-[#99c5ff]">price your work?</span></StepTitle>
              <StepSubtitle mobileText="These become your default pricing settings, but you can override them per job.">These become your defaults across all pricing tools, quotes and job cards — you can override per job at any time.</StepSubtitle>
              <div className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Base Hourly Rate (£)</label><input type="number" className={inputClassName} value={form.hourlyRate} onChange={e => patchForm({ hourlyRate: e.target.value })} placeholder="e.g. 22" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Minimum Job Rate (£)</label><input type="number" className={inputClassName} value={form.minJobRate} onChange={e => patchForm({ minJobRate: e.target.value })} placeholder="e.g. 45" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Minimum Job Duration</label><select className={inputClassName} value={form.minJobMins} onChange={e => patchForm({ minJobMins: e.target.value })}><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option><option value="180">3 hours</option></select></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Quote Type</label><select className={inputClassName} value={form.quoteType} onChange={e => patchForm({ quoteType: e.target.value })}><option value="inc_vat">Inc. VAT</option><option value="ex_vat">Ex. VAT</option><option value="no_vat">Not VAT registered</option></select></div>
                <div className="flex flex-col gap-[6px] col-span-2 max-[600px]:col-span-1"><label className={labelClassName}>Payment Terms</label><select className={inputClassName} value={form.paymentTerms} onChange={e => patchForm({ paymentTerms: e.target.value })}><option value="0">On completion</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div>
              </div>

              <hr className="my-[22px] border-t border-[rgba(153,197,255,0.12)]" />
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Working Hours</div>
              <div className="grid grid-cols-3 gap-[14px] max-[600px]:grid-cols-1 max-[600px]:max-w-none">
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Working Days</label><select className={inputClassName} value={form.workingDays} onChange={e => patchForm({ workingDays: e.target.value })}><option value="mon_fri">Mon-Fri</option><option value="mon_sat">Mon-Sat</option><option value="mon_sun">Mon-Sun</option></select></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Start Time</label><input className={inputClassName} value={form.startTime} onChange={e => patchForm({ startTime: e.target.value })} placeholder="08:00" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Finish Time</label><input className={inputClassName} value={form.finishTime} onChange={e => patchForm({ finishTime: e.target.value })} placeholder="17:00" /></div>
              </div>
            </>
          )}

          {current === 8 && (
            <>
              <StepTag>🎯 Your Goals</StepTag>
              <StepTitle>What are you <span className="text-[#99c5ff]">building towards?</span></StepTitle>
              <StepSubtitle mobileText="Set your targets so the dashboard can track the gap and your next milestone.">Your targets power the Monday dashboard, 90-day sprint planner, and income scaling tools. Cadi will show you exactly how many jobs stand between you and your goal.</StepSubtitle>
              <div className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Current Monthly Revenue (£)</label><input type="number" className={inputClassName} value={form.currentRevenue} onChange={e => patchForm({ currentRevenue: e.target.value })} placeholder="e.g. 2500" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Target Monthly Revenue (£)</label><input type="number" className={inputClassName} value={form.targetRevenue} onChange={e => patchForm({ targetRevenue: e.target.value })} placeholder="e.g. 6000" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Current No. of Clients</label><input type="number" className={inputClassName} value={form.currentClients} onChange={e => patchForm({ currentClients: e.target.value })} placeholder="e.g. 12" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Target No. of Clients</label><input type="number" className={inputClassName} value={form.targetClients} onChange={e => patchForm({ targetClients: e.target.value })} placeholder="e.g. 30" min="0" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Target Date</label><input type="date" className={inputClassName} value={form.targetDate} onChange={e => patchForm({ targetDate: e.target.value })} /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Business Ambition</label><select className={inputClassName} value={form.ambition} onChange={e => patchForm({ ambition: e.target.value })}><option value="growing_fast">Growing fast</option><option value="steady_growth">Steady growth</option><option value="maintaining">Maintaining current level</option><option value="building_to_sell">Building to sell</option><option value="lifestyle">Lifestyle business</option></select></div>
              </div>
              <InfoBox>
                <span>🚀</span>
                <span>Cadi surfaces your revenue target on every dashboard — showing the gap between where you are and where you want to be.</span>
              </InfoBox>
            </>
          )}

          {current === 9 && (
            <>
              <StepTag>🛡️ Compliance</StepTag>
              <StepTitle>Let's log your <span className="text-[#99c5ff]">compliance details</span></StepTitle>
              <StepSubtitle mobileText="Add anything relevant now — you can skip the rest and fill it in later.">Cadi tracks renewal dates and sends you reminders so nothing lapses. Skip anything that doesn't apply.</StepSubtitle>
              <ToggleRow checked={form.pli} onChange={value => patchForm({ pli: value })} label="Public Liability Insurance" hint="Required by most commercial clients" />
              {form.pli && (
                <div className="mb-[10px] grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                  <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Policy Number</label><input className={inputClassName} value={form.pliPolicy} onChange={e => patchForm({ pliPolicy: e.target.value })} placeholder="e.g. PLI-2024-001" /></div>
                  <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Renewal Date</label><input type="date" className={inputClassName} value={form.pliRenewal} onChange={e => patchForm({ pliRenewal: e.target.value })} /></div>
                </div>
              )}
              <ToggleRow checked={form.dbs} onChange={value => patchForm({ dbs: value })} label="DBS Check (Enhanced)" hint="Required for residential and care/school environments" />
              <ToggleRow checked={form.ico} onChange={value => patchForm({ ico: value })} label="ICO Registered (Data Protection)" hint="Required if you store client personal data digitally" />
              <ToggleRow checked={form.coshh} onChange={value => patchForm({ coshh: value })} label="COSHH Trained" hint="Control of Substances Hazardous to Health certification" />
              <div className="mt-[18px] mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Accreditations</div>
              <div className="flex flex-wrap gap-2">
                {accreditationOptions.map(item => (
                  <Chip key={item} selected={form.accreditations.includes(item)} onClick={() => toggleArrayValue('accreditations', item)}>
                    {item}
                  </Chip>
                ))}
              </div>

              <hr className="my-[22px] border-t border-[rgba(153,197,255,0.12)]" />
              <div className="rounded-[14px] border border-[rgba(153,197,255,0.18)] bg-[rgba(153,197,255,0.05)] p-[18px]">
                <div className="mb-2 text-sm font-bold text-white">🆘 Need help getting started with compliance?</div>
                <p className="mb-4 text-[13px] leading-[1.5] text-[rgba(153,197,255,0.65)]">
                  Not sure what insurance you need, whether you need a DBS check, or how to stay on the right side of data protection? We've got you covered with free tutorials and guides.
                </p>
                <button
                  type="button"
                  onClick={() => flash('Compliance starter pack sent! Check your email for guides on insurance, DBS, ICO registration and more.')}
                  className="w-full rounded-[10px] border border-[rgba(153,197,255,0.3)] bg-[rgba(153,197,255,0.1)] px-4 py-3 text-[13px] font-bold text-[#99c5ff] transition hover:bg-[rgba(153,197,255,0.18)] hover:border-[#99c5ff]"
                >
                  📧 Send me the compliance starter pack →
                </button>
              </div>
            </>
          )}

          {current === 10 && (
            <>
              <StepTag>🏦 Connections</StepTag>
              <StepTitle>Connect your <span className="text-[#99c5ff]">bank & accountant</span></StepTitle>
              <StepSubtitle mobileText="Optional for now. You can add these later when you're ready.">Optional — but this is what makes Cadi genuinely intelligent. Connect whenever you're ready.</StepSubtitle>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Open Banking</div>
              <div className="mb-3 rounded-[14px] border-2 border-[rgba(153,197,255,0.12)] bg-[#091660] p-[18px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="mb-1 text-sm font-bold text-white">🏦 Connect Your Business Bank Account</div>
                    <div className="text-xs leading-[1.4] text-[rgba(153,197,255,0.6)]">Auto-reconcile income, match invoices, real-time cash flow. FCA regulated Open Banking.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      patchForm({ bankConnected: true });
                      flash('Open Banking connected — we\'ll link your account after setup completes.');
                    }}
                    className="rounded-lg bg-[#1f48ff] px-[18px] py-[10px] text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(31,72,255,0.4)]"
                  >
                    Connect Bank
                  </button>
                </div>
              </div>
              <ToggleRow checked={form.goCardless} onChange={value => patchForm({ goCardless: value })} label="I use GoCardless for direct debits" hint="Sync recurring payment status to your customer tracker" />
              <ToggleRow checked={form.stripe} onChange={value => patchForm({ stripe: value })} label="I use Stripe / card payments" hint="Match card receipts to invoices automatically" />
              <hr className="my-[22px] border-t border-[rgba(153,197,255,0.12)]" />
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1px] text-[rgba(153,197,255,0.6)]">Your Accountant</div>
              <div className="grid grid-cols-2 gap-[14px] max-[600px]:grid-cols-1">
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Accountant Name</label><input className={inputClassName} value={form.accountantName} onChange={e => patchForm({ accountantName: e.target.value })} placeholder="e.g. James Patel" /></div>
                <div className="flex flex-col gap-[6px]"><label className={labelClassName}>Accountant Email</label><input type="email" className={inputClassName} value={form.accountantEmail} onChange={e => patchForm({ accountantEmail: e.target.value })} placeholder="james@firm.co.uk" /></div>
                <div className="col-span-2 flex flex-col gap-[6px] max-[600px]:col-span-1"><label className={labelClassName}>Accountant Firm</label><input className={inputClassName} value={form.accountantFirm} onChange={e => patchForm({ accountantFirm: e.target.value })} placeholder="e.g. Pavell & Co Accountants" /></div>
              </div>
              <InfoBox>
                <span>📤</span>
                <span>Cadi auto-generates year-end export packs with all SA103 boxes pre-mapped, ready to send to your accountant.</span>
              </InfoBox>
            </>
          )}

          {current === 11 && (
            <>
              <StepTag>📋 Import Customers</StepTag>
              <StepTitle>Drop your <span className="text-[#99c5ff]">customer list in</span></StepTitle>
              <StepSubtitle mobileText="Import your customer list now, or skip and add your first client later.">Got existing clients? Import via CSV now or add your first client manually. You can always do this from the Customer Tracker later.</StepSubtitle>
              <label className="block cursor-pointer rounded-[14px] border-2 border-dashed border-[rgba(153,197,255,0.25)] bg-[#091660] p-8 text-center transition hover:border-[#99c5ff] hover:bg-[rgba(153,197,255,0.06)]">
                <span className="mb-[10px] block text-[38px]">📂</span>
                <p><strong>Drag & drop your CSV or spreadsheet here</strong></p>
                <p className="mt-[6px] text-[13px]">Accepts .csv and .xlsx — we preview and match columns before importing anything</p>
                <span className="mt-[14px] inline-block rounded-lg border border-[#99c5ff] px-[18px] py-2 text-[13px] text-[#99c5ff] transition hover:bg-[#99c5ff] hover:text-[#010a4f]">Browse Files</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.xlsx"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setCsvFileName(file.name);
                      flash(`${file.name} selected — column matching will run on import.`);
                    }
                  }}
                />
              </label>
              {csvFileName && (
                <InfoBox tone="success">
                  <span>✅</span>
                  <span>{csvFileName} selected — column matching will run on import.</span>
                </InfoBox>
              )}
              <div className="mt-3 text-center text-[13px] text-[#99c5ff] underline underline-offset-2">⬇ Download Cadi CSV Template</div>
              <InfoBox>
                <span>💡</span>
                <span>Your CSV needs: <strong>Name, Address, Phone, Email, Service Type, Frequency</strong>. We preview and match columns before anything is imported.</span>
              </InfoBox>
              <hr className="my-[22px] border-t border-[rgba(153,197,255,0.12)]" />
              <div className="text-center">
                <div className="mb-3 text-[13px] text-[rgba(153,197,255,0.6)]">Or start fresh</div>
                <button type="button" className="rounded-[10px] border border-[rgba(153,197,255,0.28)] px-5 py-[10px] text-sm transition hover:border-[#99c5ff]">+ Add First Customer Manually</button>
              </div>
            </>
          )}

          {current === 12 && (
            <>
              <StepTag>🎉 All Set</StepTag>
              <StepTitle>Welcome to <span className="text-[#99c5ff]">Cadi</span>, {form.firstName || 'there'}!</StepTitle>
              <StepSubtitle mobileText="Here’s your setup summary. You can edit any of this later in Settings.">Here's what we've configured. You can edit any of this in Settings at any time.</StepSubtitle>
              <div className="mb-[18px] rounded-[14px] border border-[rgba(153,197,255,0.12)] bg-[#091660] p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[13px] text-[rgba(153,197,255,0.6)]">Setup Completion</div>
                  <div className="text-2xl font-extrabold text-[#99c5ff]">{score}%</div>
                </div>
                <div className="h-[6px] overflow-hidden rounded bg-[rgba(153,197,255,0.12)]">
                  <div className="h-full rounded bg-[linear-gradient(90deg,#1f48ff,#99c5ff)] transition-all duration-700" style={{ width: `${score}%` }} />
                </div>
                <div className="mt-3">
                  {missingItems.length > 0 && (
                    <>
                      <div className="mb-2 text-xs text-[rgba(153,197,255,0.6)]">Complete your setup to unlock full intelligence:</div>
                      {missingItems.map(item => (
                        <div key={item} className="flex items-center gap-2 py-[3px] text-[13px] text-[rgba(153,197,255,0.6)]"><span className="h-[6px] w-[6px] rounded-full bg-[#fb923c]" />{item}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="mb-5 grid grid-cols-2 gap-[11px] max-[600px]:grid-cols-1">
                {[
                  ['Business', form.bizName || '—'],
                  ['Edition', form.cleanerType ? EDITION_LABEL[form.cleanerType] : '—'],
                  ['Structure', form.bizStructure ? STRUCTURE_LABEL[form.bizStructure] : '—'],
                  ['VAT Status', form.vatRegistered ? 'Registered' : 'Not Registered'],
                  ['Team', form.teamStructure ? TEAM_LABEL[form.teamStructure] : '—'],
                  ['Revenue Target', form.targetRevenue ? `£${Number(form.targetRevenue).toLocaleString()}/mo` : '—'],
                ].map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-[rgba(153,197,255,0.12)] bg-[#091660] p-[15px]">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.5px] text-[rgba(153,197,255,0.6)]">{key}</div>
                    <div className="text-[15px] font-medium">{value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="order-2 sm:order-1">
            {current > 1 && (
              <button type="button" onClick={handleBack} className="w-full rounded-[10px] border border-[rgba(153,197,255,0.12)] px-[22px] py-3 text-sm font-medium text-[rgba(153,197,255,0.6)] transition hover:border-[rgba(153,197,255,0.28)] hover:text-white sm:w-auto">
                ← Back
              </button>
            )}
          </div>
          <div className="order-1 flex flex-col gap-3 sm:order-2 sm:flex-row sm:items-center">
            {SKIP_STEPS.includes(current) && (
              <button type="button" onClick={handleSkip} className="text-left text-[13px] text-[rgba(153,197,255,0.6)] underline underline-offset-2 transition hover:text-[#99c5ff] sm:text-center">
                Skip for now
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={handleNext}
              className="flex w-full min-w-[140px] items-center justify-center gap-2 rounded-[10px] bg-[#1f48ff] px-7 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(31,72,255,0.4)] transition hover:-translate-y-px hover:bg-[#3a5eff] hover:shadow-[0_8px_28px_rgba(31,72,255,0.5)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 sm:ml-auto sm:w-auto"
            >
              {saving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[rgba(255,255,255,0.3)] border-t-white" />
                  Saving...
                </>
              ) : current === TOTAL ? '🚀 Let\'s go!' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
  );

  // ── Modal render ─────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className="fixed inset-0 z-[200] overflow-y-auto">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.04) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
        <div className="pointer-events-none absolute -right-[120px] -top-[180px] h-[500px] w-[500px] rounded-full bg-[rgba(31,72,255,0.22)] opacity-50 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-[100px] -left-[80px] h-[350px] w-[350px] rounded-full bg-[rgba(153,197,255,0.09)] opacity-50 blur-[90px]" />
        {notif && (
          <div className={`fixed right-5 top-5 z-50 max-w-[360px] rounded-xl border px-[18px] py-[14px] text-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${notif.type === 'error' ? 'border-[rgba(248,113,113,0.3)] bg-[#3b0d0d] text-[#f87171]' : 'border-[rgba(52,211,153,0.3)] bg-[#0d3b2a] text-[#34d399]'}`}>
            {notif.type === 'error' ? '❌ ' : '✅ '}{notif.message}
          </div>
        )}
        <div className="relative flex min-h-full items-start justify-center px-4 py-8 text-white sm:px-5">
          {innerContent}
        </div>
      </div>
    );
  }

  // ── Full-page render ──────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-x-hidden bg-[#010a4f] px-4 py-6 text-white sm:items-center sm:px-5 sm:py-8">
      <div className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'linear-gradient(rgba(153,197,255,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,0.04) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="pointer-events-none fixed -right-[120px] -top-[180px] h-[500px] w-[500px] rounded-full bg-[rgba(31,72,255,0.22)] opacity-50 blur-[90px]" />
      <div className="pointer-events-none fixed -bottom-[100px] -left-[80px] h-[350px] w-[350px] rounded-full bg-[rgba(153,197,255,0.09)] opacity-50 blur-[90px]" />
      {notif && (
        <div className={`fixed right-5 top-5 z-50 max-w-[360px] rounded-xl border px-[18px] py-[14px] text-[13px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] ${notif.type === 'error' ? 'border-[rgba(248,113,113,0.3)] bg-[#3b0d0d] text-[#f87171]' : 'border-[rgba(52,211,153,0.3)] bg-[#0d3b2a] text-[#34d399]'}`}>
          {notif.type === 'error' ? '❌ ' : '✅ '}{notif.message}
        </div>
      )}
      {innerContent}
    </div>
  );
}