import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listQuotes, updateQuoteStatus, deleteQuote } from '../lib/db/quotesDb';
import { acceptSavedQuote } from '../lib/pricingStore';

const STATUS_TABS = [
  { id: 'all',      label: 'All' },
  { id: 'pending',  label: 'Pending' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'declined', label: 'Declined' },
];

const TYPE_LABELS = {
  residential: 'Residential',
  commercial:  'Commercial',
  exterior:    'Exterior',
  walkthrough: 'Walkthrough',
};

const STATUS_STYLES = {
  draft:    { dot: 'bg-gray-400',    badge: 'bg-gray-100 text-gray-500',     label: 'Draft'    },
  sent:     { dot: 'bg-amber-400',   badge: 'bg-amber-50 text-amber-700',    label: 'Sent'     },
  accepted: { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700',label: 'Accepted' },
  declined: { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-600',        label: 'Declined' },
};

function isPending(status) {
  return status === 'draft' || status === 'sent';
}

function matchesTab(quote, tab) {
  if (tab === 'all')      return true;
  if (tab === 'pending')  return isPending(quote.status);
  if (tab === 'accepted') return quote.status === 'accepted';
  if (tab === 'declined') return quote.status === 'declined';
  return true;
}

function fmt(n) {
  return `£${Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
}

function relativeDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now - d) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7)  return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes,      setQuotes]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState('all');
  const [expandedId,  setExpandedId]  = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [error,       setError]       = useState(null);

  const load = useCallback(async () => {
    try {
      const rows = await listQuotes({ pageSize: 200 });
      setQuotes(rows);
    } catch (e) {
      // Auth session missing = demo mode or not yet logged in — show empty state, not an error
      const isAuthError = e?.message?.toLowerCase().includes('auth') || e?.message?.toLowerCase().includes('session');
      if (!isAuthError) setError('Could not load quotes — please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAccept = async (quote) => {
    setActioningId(quote.id);
    try {
      await acceptSavedQuote(quote);
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'accepted' } : q));
    } catch {
      setError('Could not accept quote — try again.');
    } finally {
      setActioningId(null);
    }
  };

  const handleDecline = async (quote) => {
    setActioningId(quote.id);
    try {
      await updateQuoteStatus(quote.id, 'declined');
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'declined' } : q));
    } catch {
      setError('Could not update quote — try again.');
    } finally {
      setActioningId(null);
    }
  };

  const handleMarkSent = async (quote) => {
    setActioningId(quote.id);
    try {
      await updateQuoteStatus(quote.id, 'sent');
      setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, status: 'sent' } : q));
    } catch {
      setError('Could not update quote — try again.');
    } finally {
      setActioningId(null);
    }
  };

  const handleDelete = async (quote) => {
    if (!window.confirm(`Delete quote for ${quote.job_label || quote.customer || 'this customer'}?`)) return;
    setActioningId(quote.id);
    try {
      await deleteQuote(quote.id);
      setQuotes(prev => prev.filter(q => q.id !== quote.id));
      if (expandedId === quote.id) setExpandedId(null);
    } catch {
      setError('Could not delete quote — try again.');
    } finally {
      setActioningId(null);
    }
  };

  const visible = quotes.filter(q => matchesTab(q, activeTab));

  const counts = {
    all:      quotes.length,
    pending:  quotes.filter(q => isPending(q.status)).length,
    accepted: quotes.filter(q => q.status === 'accepted').length,
    declined: quotes.filter(q => q.status === 'declined').length,
  };

  const totalPending  = quotes.filter(q => isPending(q.status)).reduce((s, q) => s + Number(q.price), 0);
  const totalAccepted = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + Number(q.price), 0);

  return (
    <div className="flex flex-col h-full bg-gray-50/50">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <p className="text-xs font-bold tracking-widest uppercase text-brand-blue mb-0.5">Quotes</p>
        <h2 className="text-2xl font-bold text-brand-navy">Quote pipeline</h2>
        {/* Pipeline summary */}
        {counts.all > 0 && (
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <p className="text-xs text-gray-500">{counts.pending} pending · <span className="font-bold text-gray-700">{fmt(totalPending)}</span></p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs text-gray-500">{counts.accepted} accepted · <span className="font-bold text-gray-700">{fmt(totalAccepted)}</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Status tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3 border-b-2 text-sm font-semibold transition-all -mb-px ${
                activeTab === tab.id
                  ? 'border-brand-blue text-brand-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-100 text-gray-500'
                }`}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-2">

          {error && (
            <div className="px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between">
              {error}
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-4">✕</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500">Loading quotes…</p>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <EmptyState tab={activeTab} onNew={() => navigate('/calculator')} />
          ) : (
            visible.map(quote => {
              const st      = STATUS_STYLES[quote.status] ?? STATUS_STYLES.draft;
              const isOpen  = expandedId === quote.id;
              const busy    = actioningId === quote.id;
              const label   = quote.job_label || quote.payload?.customer || 'Quote';
              const typeKey = quote.type?.toLowerCase();
              const typeLabel = TYPE_LABELS[typeKey] ?? quote.type ?? 'Quote';
              const notes   = quote.notes || quote.payload?.notes || '';
              const hrs     = Number(quote.hrs) || 0;

              return (
                <div
                  key={quote.id}
                  className="bg-white border border-gray-200 rounded-sm overflow-hidden"
                >
                  {/* Main row */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : quote.id)}
                    className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${st.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-brand-navy truncate">{label}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${st.badge}`}>{st.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-gray-100 text-gray-500">{typeLabel}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {relativeDate(quote.created_at)}{hrs > 0 ? ` · ${hrs} hrs` : ''}
                        {notes && ` · ${notes.split('\n')[0].slice(0, 60)}${notes.length > 60 ? '…' : ''}`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-brand-navy">{fmt(quote.price)}</p>
                      <p className="text-[10px] text-gray-400">{isOpen ? '▲' : '▼'}</p>
                    </div>
                  </button>

                  {/* Expanded detail + actions */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-3 space-y-3 bg-gray-50/60">

                      {/* Notes / scope */}
                      {notes && (
                        <div>
                          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-1">Scope / notes</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">{notes}</p>
                        </div>
                      )}

                      {/* Quick actions */}
                      <div className="flex flex-wrap gap-2">
                        {isPending(quote.status) && (
                          <>
                            {quote.status !== 'sent' && (
                              <button
                                onClick={() => handleMarkSent(quote)}
                                disabled={busy}
                                className="px-3 py-1.5 text-xs font-bold border border-amber-300 text-amber-700 bg-amber-50 rounded-sm hover:bg-amber-100 transition-colors disabled:opacity-50"
                              >
                                Mark sent
                              </button>
                            )}
                            <button
                              onClick={() => handleAccept(quote)}
                              disabled={busy}
                              className="px-3 py-1.5 text-xs font-bold border border-emerald-400 text-emerald-700 bg-emerald-50 rounded-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
                            >
                              {busy ? 'Saving…' : '✓ Customer said yes'}
                            </button>
                            <button
                              onClick={() => handleDecline(quote)}
                              disabled={busy}
                              className="px-3 py-1.5 text-xs font-bold border border-red-300 text-red-600 bg-red-50 rounded-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                              ✕ Not this time
                            </button>
                          </>
                        )}

                        {quote.status === 'accepted' && (
                          <button
                            onClick={() => navigate(`/scheduler?customer=${encodeURIComponent(label)}`)}
                            className="px-3 py-1.5 text-xs font-bold border border-brand-blue text-brand-blue bg-blue-50 rounded-sm hover:bg-blue-100 transition-colors"
                          >
                            Book as job →
                          </button>
                        )}

                        {quote.status === 'declined' && (
                          <button
                            onClick={() => handleAccept(quote)}
                            disabled={busy}
                            className="px-3 py-1.5 text-xs font-bold border border-emerald-400 text-emerald-700 bg-emerald-50 rounded-sm hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          >
                            {busy ? 'Saving…' : 'They changed their mind'}
                          </button>
                        )}

                        <button
                          onClick={() => navigate('/calculator')}
                          className="px-3 py-1.5 text-xs font-bold border border-gray-200 text-gray-500 bg-white rounded-sm hover:bg-gray-100 transition-colors"
                        >
                          New quote
                        </button>

                        <button
                          onClick={() => handleDelete(quote)}
                          disabled={busy}
                          className="px-3 py-1.5 text-xs font-bold border border-gray-200 text-red-400 bg-white rounded-sm hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50 ml-auto"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="h-6" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ tab, onNew }) {
  const msgs = {
    all:      { icon: '📋', title: 'No quotes yet', body: 'Build your first quote in the Pricing tab and it will appear here.' },
    pending:  { icon: '⏳', title: 'No pending quotes', body: 'Quotes waiting for a customer response will show here.' },
    accepted: { icon: '✅', title: 'No accepted quotes', body: 'Once a customer says yes, mark the quote as accepted and it logs to your income.' },
    declined: { icon: '🙅', title: 'Nothing declined', body: 'Quotes the customer passed on will show here — useful for spotting pricing patterns.' },
  };
  const m = msgs[tab] ?? msgs.all;
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <p className="text-4xl mb-3">{m.icon}</p>
      <p className="text-base font-bold text-brand-navy mb-1">{m.title}</p>
      <p className="text-sm text-gray-400 mb-6 max-w-xs">{m.body}</p>
      {tab === 'all' && (
        <button
          onClick={onNew}
          className="px-5 py-2.5 bg-brand-navy text-white text-sm font-bold rounded-sm hover:bg-brand-blue transition-colors"
        >
          Build a quote →
        </button>
      )}
    </div>
  );
}
