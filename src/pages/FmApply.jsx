import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, ChevronRight, ChevronLeft, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import {
  submitFmApplication,
  COMPANY_SIZE_OPTIONS,
  UK_REGIONS,
} from '../lib/db/fmApplyDb';

const NAVY    = '#010a4f';
const INK     = '#0f172a';
const SUB     = '#64748b';
const MUTE    = '#94a3b8';
const LINE    = '#e2e8f0';
const PAPER   = '#ffffff';
const BG      = '#f8faff';
const ACCENT  = '#C2410C';

const STEPS = ['About your company', 'Scale & scope', 'You + your pitch'];

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ marginTop: 4 }}>{children}</div>
      {hint && <div style={{ fontSize: 10, color: MUTE, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: `1px solid ${LINE}`, borderRadius: 8,
  background: PAPER, color: INK, outline: 'none', fontFamily: 'inherit',
};

export default function FmApply() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    company_name: '', company_website: '', company_size: '', business_model: '',
    regions_covered: [], sites_managed: '', current_subs: '', current_software: '',
    contact_name: '', contact_role: '', contact_email: '', contact_phone: '',
    why_cadi: '',
    // Honeypot — real users leave this empty (input is off-screen +
    // aria-hidden). Bots populating every field trigger silent-success
    // in the fm-application-submit function.
    hp_website2: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleRegion = (r) => {
    setForm(f => ({
      ...f,
      regions_covered: f.regions_covered.includes(r)
        ? f.regions_covered.filter(x => x !== r)
        : [...f.regions_covered, r],
    }));
  };

  const step1Valid = form.company_name.trim().length > 0;
  const step3Valid = form.contact_name.trim() && form.contact_email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email);
  const canSubmit = step1Valid && step3Valid;

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await submitFmApplication(form);
      setDone(res);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ maxWidth: 560, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 16, padding: 36, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: `${ACCENT}10`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <CheckCircle2 size={30} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: INK, marginBottom: 8 }}>Application received</h1>
          <p style={{ fontSize: 14, color: SUB, lineHeight: 1.65, marginBottom: 24 }}>
            Thanks for applying to Cadi Connect, <strong style={{ color: INK }}>{form.company_name}</strong>.
            Our team will review and come back to <strong style={{ color: INK }}>{form.contact_email}</strong> within
            a few working days. If it's a good fit, we'll send a private invite link to set up your portal.
          </p>
          <Link to="/" style={{ display: 'inline-block', background: NAVY, color: 'white', textDecoration: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800 }}>
            Back to cadi.cleaning
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '40px 20px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '6px 12px', borderRadius: 999,
            background: `${ACCENT}10`, color: ACCENT,
            fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <Building2 size={12} /> Cadi Connect · FM application
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: INK, marginBottom: 8 }}>
            Run your sub-contractor network on Cadi
          </h1>
          <p style={{ fontSize: 14, color: SUB, lineHeight: 1.65, maxWidth: 560, margin: '0 auto' }}>
            Cadi Connect's FM side is invite-only while we onboard our first cohort. Tell us about your business —
            we read every application and reply within a few working days.
          </p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {STEPS.map((s, i) => {
            const active = i === step;
            const done = i < step;
            const colour = done ? '#16a34a' : active ? ACCENT : SUB;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === STEPS.length - 1 ? 0 : 1 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: active ? colour : done ? `${colour}15` : '#f1f5f9',
                  border: `1.5px solid ${colour}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 900,
                  color: active ? 'white' : colour,
                }}>{done ? '✓' : i + 1}</div>
                <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? INK : SUB, marginLeft: 8 }}>{s}</span>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 1, background: done ? '#16a34a' : LINE, margin: '0 14px' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 28 }}>
          {step === 0 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Company name *">
                <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Your FM company name" style={inputStyle} />
              </Field>
              <Field label="Website (optional)">
                <input value={form.company_website} onChange={e => set('company_website', e.target.value)} placeholder="https://…" style={inputStyle} />
              </Field>
              <Field label="Company size">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {COMPANY_SIZE_OPTIONS.map(o => {
                    const a = form.company_size === o.value;
                    return (
                      <button key={o.value} onClick={() => set('company_size', o.value)} style={{
                        fontSize: 12, padding: '7px 12px', borderRadius: 8,
                        border: `1px solid ${a ? ACCENT : LINE}`,
                        background: a ? `${ACCENT}10` : PAPER, color: a ? ACCENT : INK,
                        fontWeight: a ? 800 : 600, cursor: 'pointer',
                      }}>{o.label}</button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Business model" hint="Free text — e.g. 'We win FM contracts from car dealerships and dispatch to a vetted network of cleaning subs.'">
                <textarea value={form.business_model} onChange={e => set('business_model', e.target.value)} rows={3} placeholder="What does your business do? Who do you serve? How do you make money?" style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <Field label="Regions you cover">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {UK_REGIONS.map(r => {
                    const a = form.regions_covered.includes(r);
                    return (
                      <button key={r} onClick={() => toggleRegion(r)} style={{
                        fontSize: 11, padding: '6px 10px', borderRadius: 999,
                        border: `1px solid ${a ? ACCENT : LINE}`,
                        background: a ? `${ACCENT}10` : PAPER, color: a ? ACCENT : INK,
                        fontWeight: a ? 800 : 600, cursor: 'pointer',
                      }}>{r}</button>
                    );
                  })}
                </div>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Sites you manage" hint="Approx — total commercial sites in scope">
                  <input type="number" min="0" value={form.sites_managed} onChange={e => set('sites_managed', e.target.value)} placeholder="e.g. 250" style={inputStyle} />
                </Field>
                <Field label="Sub-contractors today" hint="Active in your network">
                  <input type="number" min="0" value={form.current_subs} onChange={e => set('current_subs', e.target.value)} placeholder="e.g. 35" style={inputStyle} />
                </Field>
              </div>
              <Field label="Current software" hint="What do you use today? Spreadsheets is a fine answer.">
                <input value={form.current_software} onChange={e => set('current_software', e.target.value)} placeholder="e.g. Pinnacle, Squeegee, Aworka, spreadsheets" style={inputStyle} />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Your name *">
                  <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Full name" style={inputStyle} />
                </Field>
                <Field label="Your role">
                  <input value={form.contact_role} onChange={e => set('contact_role', e.target.value)} placeholder="e.g. Operations Director" style={inputStyle} />
                </Field>
                <Field label="Work email *">
                  <input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="you@company.com" style={inputStyle} />
                </Field>
                <Field label="Phone">
                  <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="Optional" style={inputStyle} />
                </Field>
              </div>
              <Field label="Why Cadi?" hint="What problem are you trying to solve? What would success look like in 6 months?">
                <textarea value={form.why_cadi} onChange={e => set('why_cadi', e.target.value)} rows={5} placeholder="Tell us about the problem, the network you want to run, and what's broken with how you do it today." style={{ ...inputStyle, resize: 'vertical' }} />
              </Field>
              {error && (
                <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          )}

          {/* Honeypot — off-screen + aria-hidden so real users never see or
              tab into it. Bots that auto-fill every field will fill this too
              and get silently trapped by the fm-application-submit function. */}
          <input
            type="text"
            name="website2"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.hp_website2}
            onChange={e => set('hp_website2', e.target.value)}
            style={{
              position: 'absolute', left: '-10000px', top: 'auto',
              width: 1, height: 1, overflow: 'hidden',
            }}
          />

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 24, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
            <button
              onClick={() => setStep(step - 1)}
              disabled={step === 0 || busy}
              style={{
                background: PAPER, color: SUB, border: `1px solid ${LINE}`,
                borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
                cursor: step === 0 || busy ? 'not-allowed' : 'pointer', opacity: step === 0 ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ChevronLeft size={13} /> Back
            </button>
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 0 && !step1Valid}
                style={{
                  background: (step === 0 && !step1Valid) ? MUTE : ACCENT,
                  color: 'white', border: 'none',
                  borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
                  cursor: (step === 0 && !step1Valid) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                Continue <ChevronRight size={13} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSubmit || busy}
                style={{
                  background: !canSubmit || busy ? MUTE : ACCENT,
                  color: 'white', border: 'none',
                  borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 800,
                  cursor: !canSubmit || busy ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {busy && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
                Submit application
              </button>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: MUTE }}>
          Already approved? <Link to="/login" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 700 }}>Sign in →</Link>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
