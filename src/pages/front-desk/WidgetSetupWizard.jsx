// src/pages/front-desk/WidgetSetupWizard.jsx
// 5-step setup wizard for the Cadi widget — writes to widget_configs

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check, ChevronRight, ChevronLeft, X, Copy, Play,
  Home, Grid, Building2, Mail, Bell, MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBusinessId } from '../../hooks/useBusinessId';
import FrontDeskPreview from '../../components/FrontDeskPreview';

const WIDGET_URL = 'https://widget.cadi.cleaning/widget.js';

const STEPS = [
  { id: 1, label: 'Services'      },
  { id: 2, label: 'Basics'        },
  { id: 3, label: 'Tone'          },
  { id: 4, label: 'Notifications' },
  { id: 5, label: 'Install'       },
];

const SECTORS = [
  {
    id:   'residential',
    Icon:  Home,
    title: 'Residential',
    desc:  'Home cleaning — regular, one-off, end of tenancy, after builders',
  },
  {
    id:   'exterior',
    Icon:  Grid,
    title: 'Exterior',
    desc:  'Window cleaning, gutters, pressure washing, fascias & soffits',
  },
  {
    id:   'commercial',
    Icon:  Building2,
    title: 'Commercial',
    desc:  'Office, retail, industrial, schools, healthcare',
  },
];

const RESPONSE_WINDOWS = [
  { value: '1 hour',          label: 'Within 1 hour' },
  { value: '2 hours',         label: 'Within 2 hours' },
  { value: 'same day',        label: 'Same day' },
  { value: 'next working day', label: 'Next working day' },
];

const TONE_PRESETS = [
  {
    id:      'friendly',
    title:   'Friendly',
    desc:    'Warm and conversational. Uses first names. Feels like a real person.',
    example: '"No worries — I\'ll pass that over and someone will be in touch."',
  },
  {
    id:      'professional',
    title:   'Professional',
    desc:    'Measured, complete sentences. Confident without being cold.',
    example: '"I\'ll arrange for the team to be in contact with you shortly."',
  },
  {
    id:      'casual',
    title:   'Casual',
    desc:    'Short and punchy, like texting. Good for younger audiences.',
    example: '"Got it. Someone\'ll be in touch soon."',
  },
  {
    id:      'formal',
    title:   'Formal',
    desc:    'Courteous and thorough. Suits corporate or healthcare clients.',
    example: '"We will ensure a member of our team contacts you at the earliest opportunity."',
  },
];

// ─── Step 1 — Sectors ─────────────────────────────────────────────────────────

function StepSectors({ modes, setModes }) {
  function toggle(id) {
    setModes(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-black text-[#010a4f]">What sectors do you cover?</h2>
        <p className="text-sm text-gray-400 mt-1">
          Your widget will only show the conversation flows relevant to your business. Tick all that apply.
        </p>
      </div>
      <div className="p-4 space-y-3">
        {SECTORS.map(({ id, Icon, title, desc }) => {
          const active = modes.includes(id);
          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                active
                  ? 'border-[#1f48ff] bg-[#f0f4ff]'
                  : 'border-gray-100 hover:border-[#99c5ff]/40 hover:bg-gray-50'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                active ? 'bg-[#1f48ff]' : 'bg-gray-100'
              }`}>
                <Icon size={18} className={active ? 'text-white' : 'text-gray-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${active ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}>{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
              </div>
              <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                active ? 'bg-[#1f48ff] border-[#1f48ff]' : 'border-gray-300'
              }`}>
                {active && <Check size={12} className="text-white" />}
              </div>
            </button>
          );
        })}
        {modes.length === 0 && (
          <p className="text-xs text-red-500 px-1">Select at least one sector to continue.</p>
        )}
      </div>
    </div>
  );
}

// ─── Step 2 — Business basics ─────────────────────────────────────────────────

function StepBasics({ businessName, setBusinessName, ownerName, setOwnerName, serviceArea, setServiceArea, responseWindow, setResponseWindow }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-black text-[#010a4f]">A bit about your business</h2>
        <p className="text-sm text-gray-400 mt-1">
          Cadi uses this to introduce itself correctly and set expectations with your customers.
        </p>
      </div>
      <div className="p-6 space-y-5">
        <label className="block">
          <span className="text-xs font-bold text-[#010a4f] uppercase tracking-widest">Business name</span>
          <input
            className="mt-1.5 w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors"
            placeholder="e.g. Mackies Cleaning"
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-[#010a4f] uppercase tracking-widest">Your first name</span>
          <p className="text-xs text-gray-400 mt-0.5 mb-1.5">Used when Cadi says "the team will be in touch with [name]"</p>
          <input
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors"
            placeholder="e.g. Chris"
            value={ownerName}
            onChange={e => setOwnerName(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="text-xs font-bold text-[#010a4f] uppercase tracking-widest">Service area</span>
          <p className="text-xs text-gray-400 mt-0.5 mb-1.5">Where do you work? Postcodes, towns, or a description.</p>
          <textarea
            className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors resize-none"
            placeholder="e.g. Cardiff, Newport, Vale of Glamorgan — or CF10, CF11, NP10"
            rows={2}
            value={serviceArea}
            onChange={e => setServiceArea(e.target.value)}
          />
        </label>

        <div>
          <span className="text-xs font-bold text-[#010a4f] uppercase tracking-widest">How fast do you respond?</span>
          <p className="text-xs text-gray-400 mt-0.5 mb-2">Cadi tells customers when to expect a call or email from you.</p>
          <div className="grid grid-cols-2 gap-2">
            {RESPONSE_WINDOWS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setResponseWindow(value)}
                className={`text-left px-3.5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                  responseWindow === value
                    ? 'border-[#1f48ff] bg-[#f0f4ff] text-[#1f48ff]'
                    : 'border-gray-100 text-gray-600 hover:border-[#99c5ff]/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3 — Tone ────────────────────────────────────────────────────────────

function StepTone({ tonePreset, setTonePreset, neverSay, setNeverSay, neverSayInput, setNeverSayInput, addNeverSay }) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-black text-[#010a4f]">How should Cadi sound?</h2>
          <p className="text-sm text-gray-400 mt-1">Pick the tone that fits your brand. You can change this any time.</p>
        </div>
        <div className="p-4 space-y-2.5">
          {TONE_PRESETS.map(({ id, title, desc, example }) => {
            const active = tonePreset === id;
            return (
              <button
                key={id}
                onClick={() => setTonePreset(id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  active
                    ? 'border-[#1f48ff] bg-[#f0f4ff]'
                    : 'border-gray-100 hover:border-[#99c5ff]/40 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <p className={`text-sm font-bold ${active ? 'text-[#1f48ff]' : 'text-[#010a4f]'}`}>{title}</p>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    active ? 'border-[#1f48ff]' : 'border-gray-300'
                  }`}>
                    {active && <div className="w-2 h-2 rounded-full bg-[#1f48ff]" />}
                  </div>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-2">{desc}</p>
                <p className="text-xs text-gray-400 italic leading-relaxed bg-gray-50 px-3 py-2 rounded-lg">{example}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-bold text-[#010a4f]">Words or phrases to avoid</h3>
          <p className="text-xs text-gray-400 mt-0.5">Optional. Cadi will never use these. Type one and press Enter.</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-200 rounded-xl px-3.5 py-2 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors"
              placeholder="e.g. cheap, bargain, amazing..."
              value={neverSayInput}
              onChange={e => setNeverSayInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNeverSay(); } }}
            />
            <button
              onClick={addNeverSay}
              className="px-4 py-2 text-sm font-bold text-[#1f48ff] border border-[#1f48ff]/30 rounded-xl hover:bg-[#1f48ff]/5 transition-colors"
            >
              Add
            </button>
          </div>
          {neverSay.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {neverSay.map(phrase => (
                <span key={phrase} className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0f4ff] text-[#1f48ff] text-xs font-semibold rounded-full border border-[#1f48ff]/20">
                  {phrase}
                  <button onClick={() => setNeverSay(p => p.filter(x => x !== phrase))} className="hover:text-red-500 transition-colors">
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 — Notifications ───────────────────────────────────────────────────

function Toggle({ enabled, onChange }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-[#1f48ff]' : 'bg-gray-200'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function StepNotifications({ notifyEmail, setNotifyEmail, notifyEmailAddress, setNotifyEmailAddress, secondEmail, setSecondEmail }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="text-lg font-black text-[#010a4f]">How do you want to be notified?</h2>
        <p className="text-sm text-gray-400 mt-1">
          Every time Cadi captures a lead, we'll ping you straight away so you can follow up fast.
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {/* Email */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f0f4ff] flex items-center justify-center">
                <Mail size={16} className="text-[#1f48ff]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#010a4f]">Email</p>
                <p className="text-xs text-gray-400">Lead card sent to your inbox</p>
              </div>
            </div>
            <Toggle enabled={notifyEmail} onChange={setNotifyEmail} />
          </div>
          {notifyEmail && (
            <input
              className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors"
              placeholder="your@email.com"
              type="email"
              value={notifyEmailAddress}
              onChange={e => setNotifyEmailAddress(e.target.value)}
            />
          )}
        </div>

        {/* Second recipient */}
        <div className="px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f0f4ff] flex items-center justify-center shrink-0 mt-0.5">
              <Bell size={16} className="text-[#1f48ff]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#010a4f] mb-0.5">Second recipient</p>
              <p className="text-xs text-gray-400 mb-2">CC someone else on every lead — e.g. a business partner or VA</p>
              <input
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#010a4f] focus:outline-none focus:border-[#1f48ff] transition-colors"
                placeholder="optional@email.com"
                type="email"
                value={secondEmail}
                onChange={e => setSecondEmail(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* SMS coming soon */}
        <div className="px-6 py-4 flex items-center gap-3 opacity-50">
          <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <MessageSquare size={16} className="text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-500">SMS <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">Coming soon</span></p>
            <p className="text-xs text-gray-400">Text notification within seconds of a lead coming in</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 5 — Install ─────────────────────────────────────────────────────────

function StepInstall({ snippet, copied, onCopy, businessId }) {
  const [showPreview, setShowPreview] = useState(false);
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-black text-[#010a4f]">Add to your website</h2>
          <p className="text-sm text-gray-400 mt-1">
            Paste this single line before the <code className="font-mono text-[#1f48ff]">&lt;/body&gt;</code> tag on every page.
          </p>
        </div>
        <div className="p-6">
          <div className="relative mb-4">
            <div className="rounded-xl bg-[#010a4f] px-4 py-3 pr-20 font-mono text-xs text-[#99c5ff] break-all leading-relaxed">
              {snippet}
            </div>
            <button
              onClick={onCopy}
              disabled={!businessId}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#1f48ff] rounded-lg hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: '⚡', label: 'Instant leads', desc: 'Structured lead card in your inbox every time' },
              { icon: '🎯', label: 'Right flow', desc: 'Residential, exterior or commercial — your visitor chooses' },
              { icon: '🎨', label: 'Your brand', desc: 'Business name, tone and service area all set' },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-xl bg-[#f8faff] border border-[#e8eeff]">
                <div className="text-lg mb-1">{f.icon}</div>
                <p className="text-xs font-bold text-[#010a4f]">{f.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-[#99c5ff]/20 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#010a4f]">Try it before you go live</p>
          <p className="text-xs text-gray-400 mt-0.5">See exactly what your customers will see</p>
        </div>
        <button
          onClick={() => setShowPreview(true)}
          disabled={!businessId}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-[#1f48ff] rounded-xl hover:bg-[#3a5eff] transition-colors disabled:opacity-40"
        >
          <Play size={13} />
          Preview widget
        </button>
      </div>

      {showPreview && <FrontDeskPreview onClose={() => setShowPreview(false)} />}
    </div>
  );
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export default function WidgetSetupWizard() {
  const navigate    = useNavigate();
  const businessId  = useBusinessId();
  const [step, setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [modes,           setModes]           = useState(['residential', 'exterior', 'commercial']);
  const [businessName,    setBusinessName]     = useState('');
  const [ownerName,       setOwnerName]        = useState('');
  const [serviceArea,     setServiceArea]      = useState('');
  const [responseWindow,  setResponseWindow]   = useState('2 hours');
  const [tonePreset,      setTonePreset]       = useState('friendly');
  const [neverSayInput,   setNeverSayInput]    = useState('');
  const [neverSay,        setNeverSay]         = useState([]);
  const [notifyEmail,     setNotifyEmail]      = useState(true);
  const [notifyEmailAddr, setNotifyEmailAddr]  = useState('');
  const [secondEmail,     setSecondEmail]      = useState('');

  // Load existing config + profile defaults
  useEffect(() => {
    if (!businessId) return;
    (async () => {
      try {
        const [{ data: wc }, { data: profile }, { data: { user } }] = await Promise.all([
          supabase.from('widget_configs').select('*').eq('business_id', businessId).maybeSingle(),
          supabase.from('profiles').select('business_name, brand_voice').eq('id', businessId).maybeSingle(),
          supabase.auth.getUser(),
        ]);

        if (wc) {
          if (wc.modes?.length)        setModes(wc.modes);
          if (wc.business_name)        setBusinessName(wc.business_name);
          if (wc.owner_name)           setOwnerName(wc.owner_name);
          if (wc.service_area)         setServiceArea(wc.service_area);
          if (wc.response_window)      setResponseWindow(wc.response_window);
          if (wc.tone_preset)          setTonePreset(wc.tone_preset);
          if (wc.never_say?.length)    setNeverSay(wc.never_say);
          setNotifyEmail(wc.notify_email ?? true);
          if (wc.notify_email_address) setNotifyEmailAddr(wc.notify_email_address);
          if (wc.second_recipient_email) setSecondEmail(wc.second_recipient_email);
        }

        // Pre-fill from profile if widget_configs has no business_name yet
        if (!wc?.business_name && profile?.business_name) setBusinessName(profile.business_name);
        if (!wc?.owner_name && profile?.brand_voice?.sign_off_name) setOwnerName(profile.brand_voice.sign_off_name);
        if (!wc?.notify_email_address && user?.email) setNotifyEmailAddr(user.email);
      } catch (e) {
        console.error('WidgetSetupWizard load error:', e);
      }
    })();
  }, [businessId]);

  async function saveStep(extraFields = {}) {
    if (!businessId) return;
    setSaving(true);
    try {
      await supabase.from('widget_configs').upsert(
        {
          business_id:            businessId,
          modes,
          business_name:          businessName  || null,
          owner_name:             ownerName     || null,
          service_area:           serviceArea   || null,
          response_window:        responseWindow,
          tone_preset:            tonePreset,
          never_say:              neverSay.length ? neverSay : null,
          notify_email:           notifyEmail,
          notify_email_address:   notifyEmailAddr || null,
          second_recipient_email: secondEmail   || null,
          ...extraFields,
        },
        { onConflict: 'business_id' }
      );
    } catch (e) {
      console.error('WidgetSetupWizard save error:', e);
      throw e;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    const isLast = step === STEPS.length;
    try {
      await saveStep(isLast ? { setup_step: 5 } : { setup_step: step });
      if (isLast) {
        navigate('/front-desk/sales-manager');
      } else {
        setStep(s => s + 1);
      }
    } catch {
      // saveStep already logged the error; saving spinner has been cleared
    }
  }

  function addNeverSay() {
    const t = neverSayInput.trim();
    if (!t || neverSay.includes(t)) return;
    setNeverSay(prev => [...prev, t]);
    setNeverSayInput('');
  }

  const snippet  = businessId
    ? `<script src="${WIDGET_URL}" data-business-id="${businessId}" async></script>`
    : `<script src="${WIDGET_URL}" data-business-id="…" async></script>`;

  function handleCopy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canNext = step === 1 ? modes.length > 0 : true;

  return (
    <div className="max-w-2xl space-y-6">

      {/* Page header */}
      <div>
        <button
          onClick={() => navigate('/front-desk/sales-manager')}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#010a4f] transition-colors mb-3"
        >
          <ChevronLeft size={14} /> Sales Manager
        </button>
        <h1 className="text-2xl font-black text-[#010a4f]">Widget setup</h1>
        <p className="text-sm text-gray-400 mt-1">Get your Cadi widget live in 5 steps.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? '1' : undefined }}>
            <div className="flex items-center gap-2 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step > s.id  ? 'bg-emerald-500 text-white' :
                step === s.id ? 'bg-[#1f48ff] text-white'   :
                'bg-gray-100 text-gray-400'
              }`}>
                {step > s.id ? <Check size={12} /> : s.id}
              </div>
              <span className={`text-xs font-semibold hidden sm:inline ${step === s.id ? 'text-[#010a4f]' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step > s.id ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 1 && (
        <StepSectors modes={modes} setModes={setModes} />
      )}
      {step === 2 && (
        <StepBasics
          businessName={businessName}   setBusinessName={setBusinessName}
          ownerName={ownerName}         setOwnerName={setOwnerName}
          serviceArea={serviceArea}     setServiceArea={setServiceArea}
          responseWindow={responseWindow} setResponseWindow={setResponseWindow}
        />
      )}
      {step === 3 && (
        <StepTone
          tonePreset={tonePreset}       setTonePreset={setTonePreset}
          neverSay={neverSay}           setNeverSay={setNeverSay}
          neverSayInput={neverSayInput} setNeverSayInput={setNeverSayInput}
          addNeverSay={addNeverSay}
        />
      )}
      {step === 4 && (
        <StepNotifications
          notifyEmail={notifyEmail}         setNotifyEmail={setNotifyEmail}
          notifyEmailAddress={notifyEmailAddr} setNotifyEmailAddress={setNotifyEmailAddr}
          secondEmail={secondEmail}         setSecondEmail={setSecondEmail}
        />
      )}
      {step === 5 && (
        <StepInstall
          snippet={snippet}
          copied={copied}
          onCopy={handleCopy}
          businessId={businessId}
        />
      )}

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 1}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-gray-400 hover:text-[#010a4f] disabled:opacity-0 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={handleNext}
          disabled={!canNext || saving}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-[#1f48ff] rounded-xl hover:bg-[#3a5eff] disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : step === STEPS.length ? 'Finish setup' : 'Next'}
          {!saving && <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
}
