// src/pages/InvoiceSettings.jsx
// Step 3 of Phase 1: "Make your invoice yours"
// Route: /settings/invoice
// Split layout: customisation form left, live invoice preview right.
// Payment processor connection section below the form.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, X, Crown, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { markStepComplete, checkAndCompletePhase1 } from '../lib/db/thirtyDayPlanDb';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { startProCheckout } from '../lib/upgrade';
import FirstVisitCoach from '../components/FirstVisitCoach';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInvoiceNumber(format, seq) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return format
    .replace('{seq}', String(seq).padStart(3, '0'))
    .replace('{year}', year)
    .replace('{month}', month);
}

// ── Invoice preview ───────────────────────────────────────────────────────────

function InvoicePreview({ template, logoUrl, businessName }) {
  const invNum = renderInvoiceNumber(
    template.invoice_number_format || 'INV-{seq}',
    template.next_invoice_number || 1
  );
  const colour = template.brand_colour || '#010a4f';
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 14);
  const fmtDate = (d) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const label = {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#b0b0be',
    margin: '0 0 3px',
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        maxWidth: 420,
        width: '100%',
        fontFamily: font,
        color: '#111',
      }}
    >
      {/* Glassmorphism header */}
      <div
        style={{
          background: colour,
          padding: '26px 28px 22px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Glass shimmer */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.08) 100%)',
            pointerEvents: 'none',
          }}
        />
        {/* Top highlight line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: 'rgba(255,255,255,0.3)',
            pointerEvents: 'none',
          }}
        />

        {/* Business name / logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {logoUrl ? (
            <>
              <img
                src={logoUrl}
                alt="Logo"
                style={{
                  height: 30,
                  maxWidth: 110,
                  objectFit: 'contain',
                  filter: 'brightness(0) invert(1)',
                }}
              />
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.65)',
                  margin: '5px 0 0',
                }}
              >
                {businessName || 'Your Business'}
              </p>
            </>
          ) : (
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                letterSpacing: '-0.2px',
              }}
            >
              {businessName || 'Your Business'}
            </p>
          )}
        </div>

        {/* Invoice label + number */}
        <div style={{ textAlign: 'right', position: 'relative', zIndex: 1 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              margin: '0 0 5px',
            }}
          >
            Invoice
          </p>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: '#fff',
              margin: 0,
              letterSpacing: '-0.2px',
            }}
          >
            {invNum}
          </p>
        </div>
      </div>

      {/* Bill to + dates */}
      <div
        style={{
          padding: '20px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px solid #f0f0f5',
        }}
      >
        <div>
          <p style={label}>Bill to</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#111', margin: '0 0 2px' }}>
            Sample Customer
          </p>
          <p style={{ fontSize: 11, color: '#999', margin: 0 }}>sample@customer.com</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ marginBottom: 10 }}>
            <p style={label}>Date issued</p>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#444', margin: 0 }}>
              {fmtDate(today)}
            </p>
          </div>
          <div>
            <p style={label}>Due date</p>
            <p style={{ fontSize: 12, fontWeight: 700, color: colour, margin: 0 }}>
              {fmtDate(dueDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div style={{ padding: '4px 28px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...label, padding: '12px 0 8px', textAlign: 'left', width: '50%' }}>
                Description
              </th>
              <th style={{ ...label, padding: '12px 0 8px', textAlign: 'center' }}>Qty</th>
              <th style={{ ...label, padding: '12px 0 8px', textAlign: 'right' }}>Rate</th>
              <th style={{ ...label, padding: '12px 0 8px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                style={{
                  fontSize: 13,
                  color: '#222',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                }}
              >
                Weekly clean
              </td>
              <td
                style={{
                  fontSize: 12,
                  color: '#999',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'center',
                }}
              >
                1
              </td>
              <td
                style={{
                  fontSize: 12,
                  color: '#999',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'right',
                }}
              >
                £45.00
              </td>
              <td
                style={{
                  fontSize: 13,
                  color: '#222',
                  fontWeight: 600,
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'right',
                }}
              >
                £45.00
              </td>
            </tr>
            <tr>
              <td
                style={{
                  fontSize: 12,
                  color: '#888',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                }}
              >
                Oven clean add-on
              </td>
              <td
                style={{
                  fontSize: 12,
                  color: '#bbb',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'center',
                }}
              >
                1
              </td>
              <td
                style={{
                  fontSize: 12,
                  color: '#bbb',
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'right',
                }}
              >
                £20.00
              </td>
              <td
                style={{
                  fontSize: 12,
                  color: '#888',
                  fontWeight: 600,
                  padding: '11px 0',
                  borderTop: '1px solid #f0f0f5',
                  textAlign: 'right',
                }}
              >
                £20.00
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ padding: '12px 28px 0', display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
            <span style={{ fontSize: 12, color: '#aaa', fontWeight: 400 }}>Subtotal</span>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>£65.00</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '12px 0 4px',
              borderTop: `2px solid ${colour}`,
              marginTop: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#222' }}>Total due</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: colour, letterSpacing: '-0.5px' }}>
              £65.00
            </span>
          </div>
        </div>
      </div>

      {/* Payment details + terms */}
      {(template.bank_details || template.payment_terms_note) && (
        <div
          style={{
            margin: '14px 28px 0',
            padding: '13px 14px',
            background: '#f8f8fb',
            borderRadius: 8,
            borderLeft: `3px solid ${colour}40`,
          }}
        >
          {template.payment_terms_note && (
            <p
              style={{ fontSize: 11, color: '#777', margin: template.bank_details ? '0 0 8px' : 0 }}
            >
              {template.payment_terms_note}
            </p>
          )}
          {template.bank_details && (
            <>
              <p style={{ ...label, marginBottom: 4 }}>Payment details</p>
              <pre
                style={{
                  fontSize: 11,
                  color: '#555',
                  margin: 0,
                  fontFamily: font,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.65,
                }}
              >
                {template.bank_details}
              </pre>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '16px 28px 22px', marginTop: 14, borderTop: '1px solid #f0f0f5' }}>
        <p style={{ fontSize: 11, color: '#c0c0cc', margin: 0, textAlign: 'center' }}>
          {template.footer_message || 'Thank you for your business.'}
        </p>
      </div>
    </div>
  );
}

// ── Form field helpers ────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded-xl border border-[rgba(153,197,255,0.15)] bg-[#091660] px-4 py-3 text-sm text-white outline-none transition focus:border-[#99c5ff] focus:ring-2 focus:ring-[rgba(153,197,255,0.1)] placeholder:text-[rgba(153,197,255,0.3)]';
const labelCls =
  'mb-1.5 block text-[11px] font-bold uppercase tracking-[0.4px] text-[rgba(153,197,255,0.55)]';
const helperCls = 'mt-1 text-[11px] text-[rgba(153,197,255,0.35)]';

function Field({ label, helper, children }) {
  return (
    <div>
      {label && <label className={labelCls}>{label}</label>}
      {children}
      {helper && <p className={helperCls}>{helper}</p>}
    </div>
  );
}

// ── Payment processor card ────────────────────────────────────────────────────

function ProcessorCard({
  title,
  logo,
  body,
  cta,
  onConnect,
  connected,
  accountName,
  onDisconnect,
  isSkip,
  locked,
  onUpgrade,
}) {
  // Pro-gated on Lite — show the card so users know it exists, but the action
  // routes to upgrade instead of a connect flow they can't complete.
  if (locked && !connected) {
    return (
      <div className="rounded-2xl border border-[rgba(153,197,255,0.15)] bg-[rgba(255,255,255,0.02)] p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          {logo && <div>{logo}</div>}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5b21a]/15 border border-[#f5b21a]/30 text-[#f5b21a] text-[10px] font-black uppercase tracking-wider shrink-0">
            <Crown size={10} /> Pro
          </span>
        </div>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1 leading-relaxed">{body}</p>
        </div>
        <button
          onClick={onUpgrade}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors bg-[#f5b21a]/15 hover:bg-[#f5b21a]/25 text-[#f5b21a] border border-[#f5b21a]/30 flex items-center justify-center gap-1.5"
        >
          <Lock size={13} /> Upgrade to Pro
        </button>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            {logo && <div className="mb-2">{logo}</div>}
            <p className="text-sm font-black text-white">{title}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-400">Connected</span>
              {accountName && (
                <span className="text-xs text-[rgba(153,197,255,0.5)]">· {accountName}</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onDisconnect}
          className="text-xs text-[rgba(153,197,255,0.4)] hover:text-red-400 transition-colors text-left"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-3 ${
        isSkip
          ? 'border-[rgba(153,197,255,0.1)] bg-[rgba(153,197,255,0.03)]'
          : 'border-[rgba(153,197,255,0.15)] bg-[rgba(255,255,255,0.03)] hover:border-[rgba(79,120,255,0.3)] transition-colors'
      }`}
    >
      {logo && <div>{logo}</div>}
      <div>
        <p className="text-sm font-black text-white">{title}</p>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1 leading-relaxed">{body}</p>
      </div>
      <button
        onClick={onConnect}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors ${
          isSkip
            ? 'bg-white/5 hover:bg-white/8 text-[rgba(153,197,255,0.6)] hover:text-white border border-[rgba(153,197,255,0.1)]'
            : 'bg-[#4f78ff] hover:bg-[#3d68ff] text-white'
        }`}
      >
        {cta}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const DEFAULT_TEMPLATE = {
  brand_colour: '#010a4f',
  logo_position: 'top_left',
  payment_terms_note: '',
  bank_details: '',
  footer_message: '',
  invoice_number_format: 'INV-{seq}',
  next_invoice_number: 1,
};

export default function InvoiceSettings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { isPro } = usePlan();

  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [connections, setConnections] = useState({ stripe: null, gocardless: null });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [skipDismissed, setSkipDismissed] = useState(false);

  // Read logo from profile setup_data
  const [logoUrl, setLogoUrl] = useState('');
  const businessName = profile?.business_name || '';

  // Coach: staged logo file before save
  const [stagedLogoFile, setStagedLogoFile] = useState(null);
  const [stagedLogoPreview, setStagedLogoPreview] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const compressImage = (file) =>
    new Promise((resolve) => {
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
          resolve(canvas.toDataURL('image/png', 0.85));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });

  const handleCoachLogoSelect = (file) => {
    if (!file) return;
    setStagedLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setStagedLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const persistStagedLogo = async () => {
    if (!stagedLogoFile || !user) return;
    setLogoUploading(true);
    try {
      const dataUrl = await compressImage(stagedLogoFile);
      const { data: existing } = await supabase
        .from('business_settings')
        .select('setup_data')
        .eq('owner_id', user.id)
        .maybeSingle();
      const sd = existing?.setup_data ?? {};
      await supabase
        .from('business_settings')
        .upsert(
          { owner_id: user.id, setup_data: { ...sd, logo_url: dataUrl } },
          { onConflict: 'owner_id' }
        );
      setLogoUrl(dataUrl);
    } finally {
      setLogoUploading(false);
    }
  };

  function flash(msg, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [{ data: tmpl }, { data: conns }, { data: biz }] = await Promise.all([
        supabase.from('invoice_templates').select('*').maybeSingle(),
        supabase.from('payment_connections').select('*'),
        supabase
          .from('business_settings')
          .select('setup_data')
          .eq('owner_id', user.id)
          .maybeSingle(),
      ]);

      if (tmpl) setTemplate(tmpl);
      if (biz?.setup_data?.logo_url) setLogoUrl(biz.setup_data.logo_url);

      const stripeConn = conns?.find((c) => c.provider === 'stripe') ?? null;
      const gcConn = conns?.find((c) => c.provider === 'gocardless') ?? null;
      setConnections({ stripe: stripeConn, gocardless: gcConn });
    } catch (e) {
      console.error('InvoiceSettings load error', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function patch(updates) {
    setTemplate((prev) => ({ ...prev, ...updates }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', user.id)
        .single();

      if (!biz) throw new Error('Business not found');

      const payload = {
        business_id: biz.id,
        brand_colour: template.brand_colour,
        logo_position: template.logo_position,
        payment_terms_note: template.payment_terms_note || null,
        bank_details: template.bank_details || null,
        footer_message: template.footer_message || null,
        invoice_number_format: template.invoice_number_format || 'INV-{seq}',
        next_invoice_number: template.next_invoice_number || 1,
      };

      const { data: saved, error } = await supabase
        .from('invoice_templates')
        .upsert(payload, { onConflict: 'business_id' })
        .select()
        .single();

      if (error) throw error;
      setTemplate(saved);
      setSaved(true);

      // Mark step complete + check phase completion
      await markStepComplete('invoice_template');
      await checkAndCompletePhase1();

      flash('Invoice template saved. Cadi uses this every time you send an invoice.');
    } catch (e) {
      flash(e.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleStripeConnect() {
    const clientId = import.meta.env.VITE_STRIPE_CLIENT_ID;
    if (!clientId) {
      flash('Stripe Connect not configured yet — check back soon.', 'error');
      return;
    }
    const state = btoa(
      JSON.stringify({ flow: 'payment_connect', provider: 'stripe', ts: Date.now() })
    );
    const redirectUri = `${window.location.origin}/stripe/callback`;
    const url = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  }

  function handleGoCardlessConnect() {
    const clientId = import.meta.env.VITE_GOCARDLESS_PAYMENTS_CLIENT_ID;
    if (!clientId) {
      flash('GoCardless payments not configured yet — check back soon.', 'error');
      return;
    }
    const state = btoa(
      JSON.stringify({ flow: 'payment_connect', provider: 'gocardless', ts: Date.now() })
    );
    const redirectUri = `${window.location.origin}/gocardless/payment-callback`;
    const url = `https://connect.gocardless.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=read_write&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = url;
  }

  async function handleDisconnect(provider) {
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_user_id', user.id)
        .single();
      await supabase
        .from('payment_connections')
        .update({ is_connected: false, disconnected_at: new Date().toISOString() })
        .eq('business_id', biz.id)
        .eq('provider', provider);
      setConnections((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], is_connected: false },
      }));
      flash(`${provider === 'stripe' ? 'Stripe' : 'GoCardless'} disconnected.`);
    } catch {
      flash('Disconnect failed', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#040810]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgba(153,197,255,0.3)] border-t-[#99c5ff]" />
      </div>
    );
  }

  const previewNum = renderInvoiceNumber(
    template.invoice_number_format || 'INV-{seq}',
    template.next_invoice_number || 1
  );
  const stripeConnected = connections.stripe?.is_connected === true;
  const gcConnected = connections.gocardless?.is_connected === true;

  return (
    <div className="min-h-screen bg-[#040810] pb-20">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 max-w-sm rounded-xl border px-4 py-3 text-[13px] shadow-xl ${
            toast.type === 'error'
              ? 'border-red-500/30 bg-[#3b0d0d] text-red-400'
              : 'border-emerald-500/30 bg-[#0d3b2a] text-emerald-400'
          }`}
        >
          {toast.type === 'error' ? '❌ ' : '✅ '}
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div
        className="border-b border-[rgba(79,120,255,0.15)]"
        style={{ background: 'linear-gradient(135deg, #040810 0%, #06103c 50%, #080d28 100%)' }}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeft size={15} className="text-[#99c5ff]" />
          </button>
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-0.5">
              Phase 1 · Step 3
            </p>
            <h1 className="text-xl font-black text-white">Make your invoice yours</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <FirstVisitCoach
          storageKey="invoice_logo"
          title="Make your invoices yours"
          subtitle="Add your logo so every invoice and quote carries your branding."
          primaryCta="Save logo"
          skipCta="Skip for now"
          onPrimary={async () => {
            if (!stagedLogoFile) throw new Error('Pick a file first, or tap Skip for now.');
            await persistStagedLogo();
          }}
          busy={logoUploading}
        >
          <label className="block cursor-pointer rounded-xl border border-[#1f48ff]/15 bg-[#f0f4ff] p-4 hover:bg-white text-[#010a4f] transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-bold">
                  {stagedLogoFile ? stagedLogoFile.name : 'Choose a logo image'}
                </p>
                <p className="text-[11px] text-[#010a4f]/55 mt-0.5">
                  PNG or JPG — we'll resize it for you.
                </p>
              </div>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-[#1f48ff]">
                Browse
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleCoachLogoSelect(e.target.files?.[0])}
            />
          </label>

          {(stagedLogoPreview || logoUrl) && (
            <div className="bg-white border border-[#1f48ff]/15 rounded-xl p-3 flex items-center justify-center">
              <img
                src={stagedLogoPreview || logoUrl}
                alt="Logo preview"
                style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
              />
            </div>
          )}

          {!stagedLogoFile && (
            <p className="text-[11px] text-[#010a4f]/55">Pick a file to enable Save logo.</p>
          )}
        </FirstVisitCoach>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ── Left: form ── */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.02)] p-6 space-y-5">
              <h2 className="text-base font-black text-white">Branding</h2>

              {/* Brand colour */}
              <Field
                label="Brand colour"
                helper="Used for the invoice header and balance due amount."
              >
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={template.brand_colour}
                    onChange={(e) => patch({ brand_colour: e.target.value })}
                    className="h-10 w-14 rounded-lg border border-[rgba(153,197,255,0.2)] bg-[#091660] cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={template.brand_colour}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-fA-F]{0,6}$/.test(v)) patch({ brand_colour: v });
                    }}
                    className={`${inputCls} flex-1`}
                    placeholder="#010a4f"
                    maxLength={7}
                  />
                </div>
              </Field>

              {/* Logo position */}
              <Field label="Logo position" helper="Where your logo appears on the invoice header.">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'top_left', label: 'Left' },
                    { value: 'top_centre', label: 'Centre' },
                    { value: 'top_right', label: 'Right' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => patch({ logo_position: opt.value })}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                        template.logo_position === opt.value
                          ? 'border-[#4f78ff] bg-[#4f78ff]/15 text-white'
                          : 'border-[rgba(153,197,255,0.12)] bg-[#091660] text-[rgba(153,197,255,0.5)] hover:text-white hover:border-[rgba(153,197,255,0.3)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.02)] p-6 space-y-5">
              <h2 className="text-base font-black text-white">Content</h2>

              <Field label="Payment terms" helper="Shown at the bottom of every invoice.">
                <input
                  type="text"
                  value={template.payment_terms_note || ''}
                  onChange={(e) => patch({ payment_terms_note: e.target.value })}
                  placeholder="e.g. Payment due within 7 days"
                  className={inputCls}
                />
              </Field>

              <Field
                label="Bank details (optional)"
                helper="Add these if customers pay you by bank transfer. Skip if you only take card or Direct Debit."
              >
                <textarea
                  value={template.bank_details || ''}
                  onChange={(e) => patch({ bank_details: e.target.value })}
                  placeholder={`Sort code: 00-00-00\nAccount: 12345678\nName: Your business name`}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <Field
                label="Footer message (optional)"
                helper="Optional sign-off at the very bottom."
              >
                <input
                  type="text"
                  value={template.footer_message || ''}
                  onChange={(e) => patch({ footer_message: e.target.value })}
                  placeholder="e.g. Thanks for your business — see you next time."
                  className={inputCls}
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-[rgba(153,197,255,0.12)] bg-[rgba(255,255,255,0.02)] p-6 space-y-5">
              <h2 className="text-base font-black text-white">Invoice numbering</h2>

              <Field
                label="Invoice number format"
                helper={`Use {seq} for the auto-incrementing number. Examples: INV-{seq} · MACKIES-2026-{seq} · {year}-{seq}`}
              >
                <input
                  type="text"
                  value={template.invoice_number_format || 'INV-{seq}'}
                  onChange={(e) => patch({ invoice_number_format: e.target.value })}
                  placeholder="INV-{seq}"
                  className={inputCls}
                />
              </Field>

              <div className="rounded-xl bg-[rgba(79,120,255,0.08)] border border-[rgba(79,120,255,0.15)] px-4 py-3 flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(153,197,255,0.5)]">
                  Next invoice will be
                </span>
                <span className="text-sm font-black text-white">{previewNum}</span>
              </div>
            </div>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <Check size={16} strokeWidth={3} /> Invoice template saved
                </>
              ) : (
                'Save invoice template'
              )}
            </button>
          </div>

          {/* ── Right: live preview ── */}
          <div className="lg:sticky lg:top-8">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[rgba(153,197,255,0.45)] mb-4">
              Live preview
            </p>
            <InvoicePreview template={template} logoUrl={logoUrl} businessName={businessName} />
            <p className="text-[10px] text-[rgba(153,197,255,0.3)] mt-3 text-center">
              Updates as you type. Real invoices use your actual customer and job data.
            </p>
          </div>
        </div>

        {/* ── Payment processor section ── */}
        <div className="mt-12 pt-10 border-t border-[rgba(153,197,255,0.1)]">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">
                  Want customers to pay you through Cadi?
                </h2>
                {!isPro && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f5b21a]/15 border border-[#f5b21a]/30 text-[#f5b21a] text-[10px] font-black uppercase tracking-wider">
                    <Crown size={10} /> Pro
                  </span>
                )}
              </div>
              <p className="text-sm text-[rgba(153,197,255,0.5)] mt-1">
                {isPro ? (
                  <>
                    Optional — your invoices work fine without this. Connect a processor and
                    customers get a "Pay now" button on every invoice.
                  </>
                ) : (
                  <>
                    <span className="text-white font-bold">
                      Creating, branding and sending invoices is included on Lite — that's all set
                      up above.
                    </span>{' '}
                    Taking card payments (Stripe) or Direct Debit (GoCardless) automatically through
                    Cadi is a <span className="text-[#f5b21a] font-bold">Pro</span> feature. On Lite
                    you can still get paid — add your bank details above and customers pay by
                    transfer, cash, or however you already accept.
                  </>
                )}
              </p>
            </div>
            {skipDismissed && (
              <button
                onClick={() => setSkipDismissed(false)}
                className="shrink-0 text-[rgba(153,197,255,0.3)] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {!skipDismissed && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              {/* Stripe */}
              <ProcessorCard
                title="Stripe — card payments"
                logo={
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-10 rounded bg-[#635BFF] flex items-center justify-center">
                      <span className="text-white font-black text-[10px]">stripe</span>
                    </div>
                  </div>
                }
                body="Customers pay instantly by card. Best for one-off jobs and faster cash flow. 1.5% + 20p per transaction."
                cta="Connect Stripe"
                onConnect={handleStripeConnect}
                connected={stripeConnected}
                accountName={connections.stripe?.provider_account_name}
                onDisconnect={() => handleDisconnect('stripe')}
                locked={!isPro}
                onUpgrade={() => startProCheckout()}
              />

              {/* GoCardless */}
              <ProcessorCard
                title="GoCardless — Direct Debit"
                logo={
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-10 rounded bg-[#00B0B0] flex items-center justify-center">
                      <span className="text-white font-black text-[9px]">GC</span>
                    </div>
                  </div>
                }
                body="Best for regular customers paying weekly or monthly. 1% + 20p, capped at £4 per transaction."
                cta="Connect GoCardless"
                onConnect={handleGoCardlessConnect}
                connected={gcConnected}
                accountName={connections.gocardless?.provider_account_name}
                onDisconnect={() => handleDisconnect('gocardless')}
                locked={!isPro}
                onUpgrade={() => startProCheckout()}
              />

              {/* Skip */}
              <ProcessorCard
                title="I'll handle payments myself"
                body="Customers will pay you by bank transfer, cash, or however you already accept payment. You can connect a processor later in Settings."
                cta="Skip for now"
                onConnect={() => setSkipDismissed(true)}
                isSkip
              />
            </div>
          )}

          {skipDismissed && (
            <div className="mt-4 rounded-xl bg-[rgba(153,197,255,0.04)] border border-[rgba(153,197,255,0.08)] px-4 py-3 flex items-center gap-3">
              <span className="text-sm text-[rgba(153,197,255,0.4)]">
                Payment processor skipped for now. You can connect one any time in Settings.
              </span>
              <button
                onClick={() => setSkipDismissed(false)}
                className="shrink-0 text-xs font-bold text-[#4f78ff] hover:text-[#99c5ff] transition-colors"
              >
                Show options
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
