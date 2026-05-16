// src/pages/Payments.jsx
// Route: /payments
// Tabbed shell: Invoices | Quotes | Payment Setup (Stripe + GoCardless)

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, ClipboardCheck, CreditCard, Check, Unlink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import InvoiceGenerator from './InvoiceGenerator';
import Quotes from './Quotes';

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'invoices', label: 'Invoices',      icon: FileText        },
  { id: 'quotes',   label: 'Quotes',        icon: ClipboardCheck  },
  { id: 'setup',    label: 'Payment Setup', icon: CreditCard      },
];

// ── Processor card ─────────────────────────────────────────────────────────────
function ProcessorCard({ logo, title, body, cta, connected, accountName, onConnect, onDisconnect, connecting }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #040810 0%, #06103c 60%, #080d28 100%)',
        borderColor: connected ? 'rgba(52,211,153,0.3)' : 'rgba(79,120,255,0.18)',
      }}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-[rgba(79,120,255,0.1)] flex items-center gap-3">
        {logo}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">{title}</p>
        </div>
        {connected && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Check size={10} /> Connected
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {connected ? (
          <div className="space-y-3">
            {accountName && (
              <p className="text-sm text-[rgba(153,197,255,0.6)]">
                Account: <span className="text-white font-semibold">{accountName}</span>
              </p>
            )}
            <button
              onClick={onDisconnect}
              className="flex items-center gap-2 text-xs font-bold text-red-400 border border-red-500/30 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors"
            >
              <Unlink size={12} />
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[rgba(153,197,255,0.55)] leading-relaxed">{body}</p>
            <button
              onClick={onConnect}
              disabled={connecting}
              className="w-full py-2.5 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white text-sm font-black transition-colors disabled:opacity-50"
            >
              {connecting ? 'Redirecting…' : cta}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Payment Setup tab ──────────────────────────────────────────────────────────
function PaymentSetupTab() {
  const { user } = useAuth();
  const [connections, setConnections] = useState({ stripe: null, gocardless: null });
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('payment_connections').select('*');
      const stripeConn = data?.find(c => c.provider === 'stripe') ?? null;
      const gcConn     = data?.find(c => c.provider === 'gocardless') ?? null;
      setConnections({ stripe: stripeConn, gocardless: gcConn });
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  function handleStripeConnect() {
    const clientId = process.env.REACT_APP_STRIPE_CLIENT_ID;
    if (!clientId) { alert('Stripe Connect not configured yet — check back soon.'); return; }
    setConnecting('stripe');
    const state       = btoa(JSON.stringify({ flow: 'payment_connect', provider: 'stripe', ts: Date.now() }));
    const redirectUri = `${window.location.origin}/stripe/callback`;
    window.location.href = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${clientId}&scope=read_write&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  function handleGcConnect() {
    const clientId = process.env.REACT_APP_GOCARDLESS_PAYMENTS_CLIENT_ID;
    if (!clientId) { alert('GoCardless payments not configured yet — check back soon.'); return; }
    setConnecting('gocardless');
    const state       = btoa(JSON.stringify({ flow: 'payment_connect', provider: 'gocardless', ts: Date.now() }));
    const redirectUri = `${window.location.origin}/gocardless/payment-callback`;
    window.location.href = `https://connect.gocardless.com/oauth/authorize?client_id=${clientId}&response_type=code&scope=read_write&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  }

  async function handleDisconnect(provider) {
    if (!window.confirm(`Disconnect ${provider === 'stripe' ? 'Stripe' : 'GoCardless'}? Customers won't be able to pay online until you reconnect.`)) return;
    try {
      await supabase.from('payment_connections')
        .update({ is_connected: false })
        .eq('provider', provider);
      setConnections(prev => ({ ...prev, [provider]: { ...prev[provider], is_connected: false } }));
    } catch { /* ignore */ }
  }

  const stripeConnected = connections.stripe?.is_connected === true;
  const gcConnected     = connections.gocardless?.is_connected === true;

  if (loading) return <div className="py-12 text-center text-[rgba(153,197,255,0.4)] text-sm">Loading…</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-[#010a4f]">Want customers to pay you through Cadi?</h2>
        <p className="text-sm text-gray-500 mt-1">
          Optional — your invoices work fine without this. Connect a processor and customers see a "Pay now" button on every invoice.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ProcessorCard
          title="Stripe — card payments"
          logo={
            <div className="h-7 w-12 rounded-md bg-[#635BFF] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-[11px] tracking-tight">stripe</span>
            </div>
          }
          body="Customers pay instantly by card. Best for one-off jobs and faster cash flow. 1.5% + 20p per transaction."
          cta="Connect Stripe"
          connected={stripeConnected}
          accountName={connections.stripe?.provider_account_name}
          onConnect={handleStripeConnect}
          onDisconnect={() => handleDisconnect('stripe')}
          connecting={connecting === 'stripe'}
        />

        <ProcessorCard
          title="GoCardless — Direct Debit"
          logo={
            <div className="h-7 w-12 rounded-md bg-[#00B0B0] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-[11px]">GC</span>
            </div>
          }
          body="Best for regular customers paying weekly or monthly. 1% + 20p, capped at £4 per transaction."
          cta="Connect GoCardless"
          connected={gcConnected}
          accountName={connections.gocardless?.provider_account_name}
          onConnect={handleGcConnect}
          onDisconnect={() => handleDisconnect('gocardless')}
          connecting={connecting === 'gocardless'}
        />
      </div>

      <p className="text-xs text-gray-400">
        You can also manage payment processors in{' '}
        <a href="/settings/invoice" className="text-[#1f48ff] hover:underline font-semibold">Invoice Settings</a>.
      </p>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Payments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'invoices';

  function setTab(id) {
    setSearchParams(id === 'invoices' ? {} : { tab: id });
  }

  return (
    <div className="-mx-4 md:-mx-8 -mt-6">
      {/* Tab bar */}
      <div className="sticky top-[57px] z-20 bg-white/90 backdrop-blur-md border-b border-[#99c5ff]/30 px-4 md:px-8">
        <div className="flex gap-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3.5 text-sm font-bold border-b-2 transition-all duration-150 ${
                  active
                    ? 'border-[#1f48ff] text-[#1f48ff]'
                    : 'border-transparent text-gray-400 hover:text-[#010a4f] hover:border-gray-300'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 md:px-8 pt-6 pb-6">
        {activeTab === 'invoices' && <InvoiceGenerator />}
        {activeTab === 'quotes'   && <Quotes />}
        {activeTab === 'setup'    && <PaymentSetupTab />}
      </div>
    </div>
  );
}
