/**
 * src/pages/BankingSettings.jsx
 * Cadi — Phase 2 Step 1: Connect Open Banking
 *
 * Route: /banking/connect
 * Step 1 — trust-building intro
 * Step 2 — bank picker (institutionId required by yapily-auth)
 * Step 3 — redirect into Yapily OAuth
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const BG   = 'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628]';
const CARD = 'mx-auto max-w-lg w-full';

// Sandbox banks (Modelo, Mock Bank) only get hidden when env explicitly says we're
// in production. Default behaviour is to show everything so testers always have
// something to click — much safer default than silently presenting an empty list.
const HIDE_SANDBOX_BANKS = (import.meta.env?.VITE_YAPILY_ENV ?? '') === 'production';

function HelpDrawer({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0d1530] border border-white/10 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base">How Open Banking works</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-white/60 text-sm mb-4 leading-relaxed">
          Open Banking is a UK regulation that lets you securely share your bank data with apps you trust — without giving them your password.
        </p>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Here's the journey</p>
        <ol className="space-y-2.5 mb-5">
          {[
            'You pick your bank from the list',
            'Cadi sends you to your bank\'s secure login page',
            'Your bank logs you in (same way you\'d log into your banking app)',
            'Your bank shows you exactly what Cadi is asking permission to see',
            'You approve — and we\'re back in Cadi',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-[#4f78ff]/20 border border-[#4f78ff]/40 flex items-center justify-center text-[10px] font-bold text-[#4f78ff]">{i + 1}</span>
              <p className="text-sm text-white/60 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
        <p className="text-white/50 text-sm leading-relaxed mb-5">
          Cadi only ever has <strong className="text-white/70">read-only access</strong>. Your bank verifies that. We literally can't move money or change anything — we can only read what's already happened.
        </p>
        <p className="text-white/40 text-xs">If you ever want to disconnect, head to Settings → Banking. Takes one click.</p>
        <button
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-white/8 hover:bg-white/12 text-white font-semibold text-sm transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

function BankPicker({ onPick, loading, onCancel }) {
  const [institutions, setInstitutions] = useState([]);
  const [error, setError]               = useState('');
  const [search, setSearch]             = useState('');
  const [fetching, setFetching]         = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not signed in');
        const { data, error: fnErr } = await supabase.functions.invoke('yapily-auth', {
          body:    { action: 'institutions' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (fnErr)        throw new Error(fnErr.message);
        if (data?.error)  throw new Error(data.error);
        const list = (data?.institutions ?? []).filter(inst => {
          const isSandboxBank = /sandbox|mock|modelo/i.test(inst.id);
          return HIDE_SANDBOX_BANKS ? !isSandboxBank : true;
        });
        setInstitutions(list);
      } catch (err) {
        setError(err.message ?? 'Could not load bank list.');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return institutions;
    return institutions.filter(i => i.name?.toLowerCase().includes(q) || i.id?.toLowerCase().includes(q));
  }, [institutions, search]);

  return (
    <div>
      <div className="mb-4">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-2">Pick your bank</p>
        <h2 className="text-xl font-black text-white leading-tight mb-1">Which bank do you want to connect?</h2>
        <p className="text-white/50 text-sm">{HIDE_SANDBOX_BANKS ? 'UK banks supported by Yapily Open Banking.' : 'UK banks + sandbox test banks.'}</p>
      </div>

      <input
        type="search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search Monzo, Starling, Lloyds…"
        className="w-full mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[#4f78ff]/60"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/8">
        {fetching ? (
          <div className="py-8 text-center text-sm text-white/40">Loading banks…</div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/40">No banks match "{search}"</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {filtered.map(inst => (
              <li key={inst.id}>
                <button
                  disabled={loading}
                  onClick={() => onPick(inst.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/4 transition-colors disabled:opacity-50"
                >
                  {inst.logoUrl
                    ? <img src={inst.logoUrl} alt="" className="w-8 h-8 rounded-md shrink-0 bg-white/10 object-contain" />
                    : <div className="w-8 h-8 rounded-md bg-white/10 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{inst.name}</p>
                  </div>
                  <span className="text-white/30 text-lg">→</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={onCancel}
        className="mt-4 w-full py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}

export default function BankingSettings() {
  const navigate      = useNavigate();
  const [step,    setStep]    = useState('intro'); // 'intro' | 'picker'
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [alreadyConnected, setAlreadyConnected] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase.functions.invoke('yapily-auth', {
        body:    { action: 'status' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.connected) setAlreadyConnected(data);
    })();
  }, []);

  async function handleBankPicked(institutionId) {
    setLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not signed in');
      const { data, error: fnErr } = await supabase.functions.invoke('yapily-auth', {
        body:    { action: 'url', institutionId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr)        throw new Error(fnErr.message);
      if (data?.error)  throw new Error(data.error);
      if (!data?.url)   throw new Error('Could not get authorisation URL');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message ?? 'Something went wrong — please try again.');
      setLoading(false);
    }
  }

  return (
    <div className={BG}>
      <HelpDrawer open={showHelp} onClose={() => setShowHelp(false)} />

      <div className="px-4 pt-10 pb-16">
        <div className={CARD}>
          {/* Back button */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-semibold mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </button>

          {step === 'picker' ? (
            <BankPicker
              loading={loading}
              onPick={handleBankPicked}
              onCancel={() => { setStep('intro'); setError(''); }}
            />
          ) : (
            <>
              {/* Header */}
              <div className="mb-8">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-2">Phase 2 · Step 1</p>
                <h1 className="text-2xl font-black text-white leading-tight mb-2">
                  Connect your business bank account.
                </h1>
                <p className="text-white/50 text-sm">Three quick things to know:</p>
              </div>

              {/* Trust bullets */}
              <div className="space-y-3 mb-8">
                {[
                  {
                    icon: '🔒',
                    title: 'Read-only access.',
                    body: 'Cadi can see your transactions but can never move your money. We can\'t make payments. We can\'t take money out.',
                  },
                  {
                    icon: '🇬🇧',
                    title: 'FCA-regulated through Yapily.',
                    body: 'The same open banking infrastructure used by major UK fintech apps. Your bank credentials never touch Cadi.',
                  },
                  {
                    icon: '⏱',
                    title: '60 seconds.',
                    body: "You'll log into your bank, give permission, and you're done.",
                  },
                ].map(({ icon, title, body }) => (
                  <div key={title} className="flex items-start gap-3 p-4 rounded-xl bg-white/4 border border-white/8">
                    <span className="text-lg mt-0.5 shrink-0">{icon}</span>
                    <div>
                      <p className="text-sm font-bold text-white">{title}</p>
                      <p className="text-sm text-white/50 mt-0.5 leading-relaxed">{body}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* What it unlocks */}
              <div className="mb-8 px-4 py-4 rounded-xl bg-[#4f78ff]/8 border border-[#4f78ff]/20">
                <p className="text-xs font-bold text-[#99c5ff] mb-2.5">Once connected, Cadi can:</p>
                <ul className="space-y-1.5">
                  {[
                    'Sit down with you and walk through where your money\'s going',
                    'Automatically match customer payments to invoices',
                    'Send you weekly reports on how your business is doing',
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/55">
                      <span className="text-[#4f78ff] mt-0.5 shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-white/30 mt-3">You can disconnect any time from settings.</p>
              </div>

              {/* Already connected state */}
              {alreadyConnected && (
                <div className="fs-exclude mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-sm font-bold text-emerald-400 mb-0.5">Already connected</p>
                  <p className="text-xs text-emerald-400/70">
                    {alreadyConnected.bankName
                      ? `${alreadyConnected.bankName}${alreadyConnected.accountLast4 ? ` ···${alreadyConnected.accountLast4}` : ''}`
                      : 'Your bank account is linked.'
                    }
                  </p>
                  {alreadyConnected.needsReauth && (
                    <p className="text-xs text-amber-300 mt-2">Your bank consent has expired. Click below to reconnect.</p>
                  )}
                  {alreadyConnected.reconsentDaysLeft !== null && alreadyConnected.reconsentDaysLeft <= 14 && !alreadyConnected.needsReauth && (
                    <p className="text-xs text-amber-300 mt-2">Bank consent expires in {alreadyConnected.reconsentDaysLeft} days — reconnect to avoid an interruption.</p>
                  )}
                </div>
              )}

              {error && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* CTAs */}
              <div className="space-y-2">
                <button
                  onClick={() => setStep('picker')}
                  disabled={loading}
                  className="w-full py-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-50 text-white font-black text-base transition-colors"
                >
                  {alreadyConnected ? 'Reconnect my bank' : 'Connect my bank'}
                </button>
                <button
                  onClick={() => setShowHelp(true)}
                  className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors"
                >
                  How does this work? →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
