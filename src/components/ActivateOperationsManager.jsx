import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Check, CalendarClock, Bell, Users, Zap, CreditCard, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useBusinessId } from '../hooks/useBusinessId';
import TeamMembersUI from './TeamMembersUI';

const STEPS = [
  { id: 'welcome',    label: 'Welcome' },
  { id: 'reminders',  label: 'Reminders' },
  { id: 'team',       label: 'Your team' },
  { id: 'schedules',  label: 'Schedules' },
  { id: 'completion', label: 'Completion' },
  { id: 'activate',   label: 'Go live' },
];

function StepDots({ current }) {
  return (
    <div className="flex items-center gap-1.5 justify-center mb-6">
      {STEPS.map((s, i) => (
        <div
          key={s.id}
          className={`rounded-full transition-all ${
            i === current
              ? 'w-6 h-2 bg-[#C2410C]'
              : i < current
              ? 'w-2 h-2 bg-[#C2410C]/40'
              : 'w-2 h-2 bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto shadow-lg">
        <CalendarClock size={30} className="text-white" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#010a4f]">Meet your Operations Manager</h2>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-sm mx-auto">
          Your Operations Manager handles the day-to-day admin that eats up your time —
          reminders, daily schedules, job tracking, and payment matching.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-left pt-2">
        {[
          { icon: Bell,        label: 'Customer reminders',  desc: 'Auto-texts before every job' },
          { icon: Users,       label: 'Team schedules',      desc: 'Daily job lists sent each morning' },
          { icon: Zap,         label: 'Job completion',      desc: 'Closes jobs automatically' },
          { icon: CreditCard,  label: 'Payment matching',    desc: 'Links payments to invoices' },
        ].map(f => (
          <div key={f.label} className="p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]">
            <f.icon size={16} className="text-[#C2410C] mb-1.5" />
            <p className="text-xs font-bold text-[#010a4f]">{f.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RemindersStep({ settings, onChange }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
          <Bell size={22} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-[#010a4f]">Customer reminders</h2>
        <p className="text-sm text-gray-500 mt-1">
          Cadi texts customers automatically before their clean. Fewer no-shows, no chasing.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-[#C2410C]/30 transition-colors">
          <div>
            <p className="text-sm font-bold text-[#010a4f]">Enable customer reminders</p>
            <p className="text-xs text-gray-400 mt-0.5">Send an SMS reminder before each job</p>
          </div>
          <input
            type="checkbox"
            checked={settings.customer_reminders_enabled}
            onChange={e => onChange('customer_reminders_enabled', e.target.checked)}
            className="w-5 h-5 accent-[#C2410C] shrink-0"
          />
        </label>

        {settings.customer_reminders_enabled && (
          <div className="space-y-3 pl-1">
            <div>
              <label className="block text-xs font-semibold text-[#010a4f] mb-1.5">
                How many hours before the job?
              </label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30"
                value={settings.reminder_hours_before}
                onChange={e => onChange('reminder_hours_before', Number(e.target.value))}
              >
                {[2, 4, 6, 12, 24, 48].map(h => (
                  <option key={h} value={h}>{h} hours before</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#010a4f] mb-1.5">
                Message template <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 resize-none"
                rows={3}
                placeholder="Hi {customer_name}, just a reminder your clean is tomorrow at {time}. Reply STOP to opt out."
                value={settings.reminder_message_template ?? ''}
                onChange={e => onChange('reminder_message_template', e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to use the default template. Use {`{customer_name}`} and {`{time}`}.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamStep() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
          <Users size={22} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-[#010a4f]">Add your team</h2>
        <p className="text-sm text-gray-500 mt-1">
          Add the cleaners and supervisors who should receive daily schedules and can check in to jobs.
        </p>
      </div>
      <TeamMembersUI />
    </div>
  );
}

function SchedulesStep({ settings, onChange }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
          <CalendarClock size={22} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-[#010a4f]">Daily team schedules</h2>
        <p className="text-sm text-gray-500 mt-1">
          Each morning, Cadi sends every team member their job list for the day — address, time, and notes.
        </p>
      </div>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-[#C2410C]/30 transition-colors">
          <div>
            <p className="text-sm font-bold text-[#010a4f]">Enable daily schedules</p>
            <p className="text-xs text-gray-400 mt-0.5">Send each team member their jobs each morning</p>
          </div>
          <input
            type="checkbox"
            checked={settings.team_schedules_enabled}
            onChange={e => onChange('team_schedules_enabled', e.target.checked)}
            className="w-5 h-5 accent-[#C2410C] shrink-0"
          />
        </label>

        {settings.team_schedules_enabled && (
          <div>
            <label className="block text-xs font-semibold text-[#010a4f] mb-1.5">
              What time should schedules be sent?
            </label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30"
              value={settings.schedule_send_time}
              onChange={e => onChange('schedule_send_time', e.target.value)}
            >
              {['06:00','06:30','07:00','07:30','08:00','08:30','09:00'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletionStep({ settings, onChange }) {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
          <Zap size={22} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-[#010a4f]">Automatic job completion</h2>
        <p className="text-sm text-gray-500 mt-1">
          Cadi watches for signals — check-ins, payments, reviews — and marks jobs complete automatically.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 cursor-pointer hover:border-[#C2410C]/30 transition-colors">
          <div>
            <p className="text-sm font-bold text-[#010a4f]">Enable job auto-completion</p>
            <p className="text-xs text-gray-400 mt-0.5">Mark jobs done when confidence is high enough</p>
          </div>
          <input
            type="checkbox"
            checked={settings.job_completion_enabled}
            onChange={e => onChange('job_completion_enabled', e.target.checked)}
            className="w-5 h-5 accent-[#C2410C] shrink-0"
          />
        </label>

        <div className="p-4 rounded-xl bg-[#fffbf5] border border-amber-200">
          <p className="text-xs font-bold text-amber-800 mb-2">How the confidence score works</p>
          <ul className="space-y-1.5 text-xs text-amber-700">
            {[
              'Staff check-in (arrived + left) → +50%',
              'Payment received → +20%',
              'Review received → +15%',
              'Recurring job, no exceptions → +15%',
              'Reaches 85% → auto-completes',
              'Reaches 60% → adds to your Front Desk for review',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">·</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function ActivateStep({ settings, onChange, saving }) {
  const enabledFeatures = [
    settings.customer_reminders_enabled && 'Customer reminders',
    settings.team_schedules_enabled && 'Daily team schedules',
    settings.job_completion_enabled && 'Job auto-completion',
  ].filter(Boolean);

  return (
    <div className="space-y-5 text-center">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-3 shadow-lg">
          <Sparkles size={28} className="text-white" />
        </div>
        <h2 className="text-xl font-bold text-[#010a4f]">Ready to go live</h2>
        <p className="text-sm text-gray-500 mt-1">
          You can change any of these settings at any time.
        </p>
      </div>

      <div className="text-left p-4 rounded-xl bg-[#f8faff] border border-[#e8eeff] space-y-2">
        <p className="text-xs font-bold text-[#010a4f] mb-2">You're activating:</p>
        {enabledFeatures.length === 0 ? (
          <p className="text-xs text-gray-400">No features enabled — you can turn them on after activation.</p>
        ) : (
          enabledFeatures.map(f => (
            <div key={f} className="flex items-center gap-2 text-sm text-[#010a4f]">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Check size={11} className="text-green-600" />
              </div>
              {f}
            </div>
          ))
        )}
      </div>

      <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-200 cursor-pointer text-left hover:border-[#C2410C]/30 transition-colors">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">Activate Operations Manager</p>
          <p className="text-xs text-gray-400 mt-0.5">Turn this off at any time from the settings</p>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={e => onChange('enabled', e.target.checked)}
          className="w-5 h-5 accent-[#C2410C] shrink-0"
        />
      </label>

      {saving && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-[#C2410C] animate-spin" />
          Saving your settings…
        </div>
      )}
    </div>
  );
}

export default function ActivateOperationsManager({ onComplete, onClose }) {
  const businessId = useBusinessId();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    enabled: true,
    customer_reminders_enabled: true,
    team_schedules_enabled: true,
    job_completion_enabled: true,
    payment_matching_enabled: false,
    reminder_hours_before: 24,
    reminder_message_template: '',
    schedule_send_time: '07:00',
    schedule_send_days_before: 1,
    confidence_threshold_auto: 0.85,
    confidence_threshold_prompt: 0.60,
  });

  function updateSetting(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  async function handleFinish() {
    if (!businessId) return;
    setSaving(true);
    await supabase
      .from('autobooking_settings')
      .upsert(
        { ...settings, business_id: businessId },
        { onConflict: 'business_id' }
      );
    // Also upsert agent_settings row so the toggle in OperationsManagerPage is aware
    await supabase
      .from('agent_settings')
      .upsert(
        { business_id: businessId, agent: 'operations_manager', mode: settings.enabled ? 'auto' : 'off' },
        { onConflict: 'business_id,agent' }
      );
    setSaving(false);
    onComplete?.();
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Step {step + 1} of {STEPS.length} — {STEPS[step].label}
          </p>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <StepDots current={step} />

          {step === 0 && <WelcomeStep />}
          {step === 1 && <RemindersStep settings={settings} onChange={updateSetting} />}
          {step === 2 && <TeamStep />}
          {step === 3 && <SchedulesStep settings={settings} onChange={updateSetting} />}
          {step === 4 && <CompletionStep settings={settings} onChange={updateSetting} />}
          {step === 5 && <ActivateStep settings={settings} onChange={updateSetting} saving={saving} />}
        </div>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-0 transition-colors"
          >
            <ArrowLeft size={13} />
            Back
          </button>
          {isLast ? (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold text-white bg-[#C2410C] rounded-lg hover:bg-[#b03a0b] disabled:opacity-50 transition-colors"
            >
              <Sparkles size={14} />
              Activate
            </button>
          ) : (
            <button
              onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#010a4f] rounded-lg hover:bg-[#0d1a6e] transition-colors"
            >
              Next
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
