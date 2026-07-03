import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings, Save, ArrowLeft, AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  getFmAccountsSettings,
  upsertFmAccountsSettings,
  ACCOUNTS_PLATFORMS,
} from '../../lib/db/fmOpsDb';
import { greenCanvas, greenButton } from '../../lib/connectTheme';

// Business-Lab palette — matches FmOpsAccounts + BusinessLab.jsx.
const SKY       = 'rgba(153,197,255,0.5)';
const SKY_POP   = '#99c5ff';
const EMERALD   = '#34d399';
const CARD_LINE = 'rgba(153,197,255,0.12)';

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 800, color: SKY,
  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  border: '1px solid rgba(153,197,255,0.25)',
  fontSize: 13, color: '#ffffff', background: 'rgba(255,255,255,0.08)',
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  colorScheme: 'dark',
};
const hintStyle = { fontSize: 11, color: 'rgba(255,255,255,0.50)', marginTop: 6 };

// Help text shown under each platform option in the dropdown.
function platformHint(value) {
  return ACCOUNTS_PLATFORMS.find(p => p.value === value)?.hint ?? '';
}

export default function FmOpsAccountsSettings() {
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);

  const [form, setForm] = useState({
    accounts_platform:          'generic',
    default_nominal_code:       '',
    default_vat_code:           '',
    default_payment_terms_days: 30,
    accounts_email:             '',
  });

  useEffect(() => {
    (async () => {
      try {
        const settings = await getFmAccountsSettings();
        if (settings) {
          setForm({
            accounts_platform:          settings.accounts_platform || 'generic',
            default_nominal_code:       settings.default_nominal_code || '',
            default_vat_code:           settings.default_vat_code || '',
            default_payment_terms_days: settings.default_payment_terms_days ?? 30,
            accounts_email:             settings.accounts_email || '',
          });
        }
      } catch (e) {
        setError(e.message || 'Could not load settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function patch(updates) {
    setForm(prev => ({ ...prev, ...updates }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true); setError(null); setSaved(false);
    try {
      await upsertFmAccountsSettings({
        accounts_platform:          form.accounts_platform,
        default_nominal_code:       form.default_nominal_code || null,
        default_vat_code:           form.default_vat_code || null,
        default_payment_terms_days: Number(form.default_payment_terms_days) || 30,
        accounts_email:             form.accounts_email || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  // Sensible defaults the user can adopt with one tap, per platform.
  const platformDefaults = {
    sage_50:    { nominal: '5000', vat: 'T1' },
    sage_cloud: { nominal: '5000', vat: 'T1' },
    xero:       { nominal: '310',  vat: '20% (VAT on Income)' },
    quickbooks: { nominal: '5000', vat: '20% S' },
    freeagent:  { nominal: '285',  vat: '20%' },
    generic:    { nominal: '',     vat: '' },
  };

  return (
    <div style={{ ...greenCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <button
            onClick={() => navigate('/fm-ops/accounts')}
            style={{
              fontSize: 11, color: 'rgba(255,255,255,0.60)', background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, marginBottom: 10,
              display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700,
            }}>
            <ArrowLeft size={11} /> Back to Accounts
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 11,
              background: 'rgba(52,211,153,0.18)', color: EMERALD,
              border: '1px solid rgba(52,211,153,0.40)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Settings size={17} /></div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: SKY }}>
              FM Operations · Accounts
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', margin: 0 }}>
            Accounts <span style={{ color: EMERALD }}>settings</span>
          </h1>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 6, maxWidth: 620, lineHeight: 1.5 }}>
            Tell Cadi which accounting platform you use and the defaults for new supplier invoices. The Export to Accounts CSV will be formatted ready for direct import.
          </div>
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 700 }}>
            <Loader2 size={20} color="rgba(255,255,255,0.7)" style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && (
          <div style={{
            position: 'relative', overflow: 'hidden',
            borderRadius: 18, border: `1px solid ${CARD_LINE}`,
            background: 'linear-gradient(145deg, #052e1c 0%, #064e3b 50%, #065f46 100%)',
            boxShadow: 'inset 0 1px 0 rgba(153,197,255,0.18), 0 20px 40px -24px rgba(0,0,0,0.5)',
            padding: 24, maxWidth: 640,
          }}>
            {/* Platform */}
            <div style={{ marginBottom: 22 }}>
              <label style={labelStyle}>
                Accounting platform
              </label>
              <select
                value={form.accounts_platform}
                onChange={e => {
                  const v = e.target.value;
                  const d = platformDefaults[v] || {};
                  patch({
                    accounts_platform: v,
                    // Fill defaults if the user hasn't set their own values yet.
                    default_nominal_code: form.default_nominal_code || d.nominal || '',
                    default_vat_code:     form.default_vat_code     || d.vat     || '',
                  });
                }}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                {ACCOUNTS_PLATFORMS.map(p => (
                  <option key={p.value} value={p.value} style={{ color: '#052e1c' }}>{p.label}</option>
                ))}
              </select>
              <div style={{ ...hintStyle, fontStyle: 'italic' }}>
                {platformHint(form.accounts_platform)}
              </div>
            </div>

            {/* Nominal code + VAT code side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
              <div>
                <label style={labelStyle}>
                  Default nominal / account code
                </label>
                <input
                  value={form.default_nominal_code}
                  onChange={e => patch({ default_nominal_code: e.target.value })}
                  placeholder="e.g. 5000"
                  style={inputStyle}
                />
                <div style={hintStyle}>
                  The code your accounting system uses for sub-contractor / cleaning purchases.
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Default VAT / tax code
                </label>
                <input
                  value={form.default_vat_code}
                  onChange={e => patch({ default_vat_code: e.target.value })}
                  placeholder="e.g. T9 (or T1 if all subs are VAT registered)"
                  style={inputStyle}
                />
                <div style={hintStyle}>
                  Applied when a sub's invoice has no VAT. VAT-bearing invoices get the 20% code automatically.
                </div>
              </div>
            </div>

            {/* Payment terms + accounts email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
              <div>
                <label style={labelStyle}>
                  Default payment terms (days)
                </label>
                <input
                  type="number" min="0" max="120"
                  value={form.default_payment_terms_days}
                  onChange={e => patch({ default_payment_terms_days: e.target.value })}
                  style={inputStyle}
                />
                <div style={hintStyle}>
                  Used to calculate each invoice's due date in the export.
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Accounts email (optional)
                </label>
                <input
                  type="email"
                  value={form.accounts_email}
                  onChange={e => patch({ accounts_email: e.target.value })}
                  placeholder="accounts@yourcompany.com"
                  style={inputStyle}
                />
                <div style={hintStyle}>
                  Where Cadi should send export confirmations and copies in future. Doesn't email yet — saved for v2.
                </div>
              </div>
            </div>

            {/* Supplier codes note */}
            <div style={{
              background: 'rgba(153,197,255,0.08)', border: '1px dashed rgba(153,197,255,0.30)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 22,
              fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 1.6,
            }}>
              <strong style={{ color: '#ffffff' }}>Supplier codes are auto-generated</strong> on first export — three letters of the contractor's business name plus a sequence (e.g. <code style={{ background: 'rgba(0,0,0,0.35)', color: SKY_POP, padding: '1px 5px', borderRadius: 4, fontFamily: 'ui-monospace,Menlo,monospace' }}>MAC001</code>). You can override them per contractor in <span style={{ color: EMERALD, fontWeight: 700 }}>Contractors</span> when needed.
            </div>

            {error && (
              <div style={{
                padding: 10, marginBottom: 14, borderRadius: 10, fontSize: 12,
                background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  ...greenButton(),
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: saving ? 0.6 : 1,
                }}>
                {saving
                  ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Saving…</>
                  : <><Save size={13} /> Save settings</>}
              </button>
              {saved && (
                <div style={{ fontSize: 12, color: EMERALD, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={13} /> Saved
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
