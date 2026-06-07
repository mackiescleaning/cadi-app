import { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { useBusinessId } from '../hooks/useBusinessId';

const FN_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

async function apiFetchBusinessInfo(businessId) {
  const res = await fetch(`${FN_BASE}/front-desk-chat?business_id=${encodeURIComponent(businessId)}`);
  if (!res.ok) return null;
  return res.json();
}

async function apiSendMessage({ businessId, conversationId, message, visitorInfo }) {
  const res = await fetch(`${FN_BASE}/front-desk-chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      business_id:     businessId,
      conversation_id: conversationId ?? null,
      message,
      visitor_info:    visitorInfo ?? {},
    }),
  });
  if (!res.ok) return { error: true, message: "Sorry, something went wrong. Please try again." };
  return res.json();
}

// ── SVG icons (mirrors widget) ────────────────────────────────────────────────

function CadiIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="16" fill="rgba(153,197,255,0.15)" />
      <path d="M16 8c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 13c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z"
        fill="rgba(153,197,255,0.8)" />
      <circle cx="16" cy="16" r="2.5" fill="#99c5ff" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="white" stroke="none" />
    </svg>
  );
}

// ── Widget sub-components ─────────────────────────────────────────────────────

function QuoteCard({ quote }) {
  if (!quote) return null;
  const conf = quote.confidence;
  const confClass = conf === 'high' ? 'cw-confidence--high' : conf === 'medium' ? 'cw-confidence--medium' : 'cw-confidence--low';
  const confLabel = conf === 'high' ? 'Exact price' : conf === 'medium' ? 'Estimated' : 'Approximate';
  return (
    <div className="cw-quote-card fs-exclude">
      <div className="cw-quote-price">£{(quote.price ?? 0).toFixed(2)}</div>
      {quote.breakdown?.length > 0 && (
        <div>
          {quote.breakdown.map((row, i) => (
            <div key={i} className="cw-quote-row">
              <span>{row.label}</span>
              <span>£{(row.amount ?? 0).toFixed(2)}</span>
            </div>
          ))}
          <div className="cw-quote-row cw-quote-row--total">
            <span>Total</span>
            <span>£{(quote.price ?? 0).toFixed(2)}</span>
          </div>
        </div>
      )}
      <span className={`cw-confidence ${confClass}`}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
        {confLabel}
      </span>
    </div>
  );
}

function BubbleMessage({ msg }) {
  const isOut = msg.role === 'user';
  return (
    <div className={`cw-msg cw-msg--${isOut ? 'out' : 'in'} fs-exclude`}>
      <div className={`cw-bubble cw-bubble--${isOut ? 'out' : 'in'}`}>{msg.text}</div>
      {msg.quote && <QuoteCard quote={msg.quote} />}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="cw-typing">
      <span /><span /><span />
    </div>
  );
}

// ── Widget styles injected once ───────────────────────────────────────────────

const WIDGET_CSS = `
  .fdp-widget-wrap * {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin: 0;
    padding: 0;
  }
  .fdp-widget-wrap .cw-header {
    background: linear-gradient(135deg, #010a4f 0%, #0d1e78 100%);
    padding: 14px 16px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .fdp-widget-wrap .cw-header-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(153,197,255,0.2);
    border: 2px solid rgba(153,197,255,0.3);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .fdp-widget-wrap .cw-header-info { flex: 1; min-width: 0; }
  .fdp-widget-wrap .cw-header-name {
    font-size: 14px; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .fdp-widget-wrap .cw-header-status {
    font-size: 11px; color: rgba(153,197,255,0.8);
    display: flex; align-items: center; gap: 4px; margin-top: 1px;
  }
  .fdp-widget-wrap .cw-online-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0;
  }
  .fdp-widget-wrap .cw-messages {
    flex: 1; overflow-y: auto; padding: 16px;
    display: flex; flex-direction: column; gap: 10px; background: #f8f9ff;
  }
  .fdp-widget-wrap .cw-messages::-webkit-scrollbar { width: 4px; }
  .fdp-widget-wrap .cw-messages::-webkit-scrollbar-track { background: transparent; }
  .fdp-widget-wrap .cw-messages::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
  .fdp-widget-wrap .cw-msg { display: flex; flex-direction: column; max-width: 82%; }
  .fdp-widget-wrap .cw-msg--out { align-self: flex-end; align-items: flex-end; }
  .fdp-widget-wrap .cw-msg--in  { align-self: flex-start; align-items: flex-start; }
  .fdp-widget-wrap .cw-bubble {
    padding: 10px 13px; border-radius: 16px;
    font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
  }
  .fdp-widget-wrap .cw-bubble--out {
    background: #1f48ff; color: #fff; border-bottom-right-radius: 4px;
  }
  .fdp-widget-wrap .cw-bubble--in {
    background: #fff; color: #010a4f; border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .fdp-widget-wrap .cw-quote-card {
    margin-top: 6px; background: #f0f4ff;
    border: 1px solid rgba(31,72,255,0.15); border-radius: 12px; padding: 10px 12px; font-size: 12px;
  }
  .fdp-widget-wrap .cw-quote-price { font-size: 22px; font-weight: 800; color: #010a4f; margin-bottom: 4px; }
  .fdp-widget-wrap .cw-quote-row {
    display: flex; justify-content: space-between; color: #374151; padding: 2px 0; font-size: 11.5px;
  }
  .fdp-widget-wrap .cw-quote-row--total {
    border-top: 1px solid rgba(31,72,255,0.12); margin-top: 4px; padding-top: 6px; font-weight: 700;
  }
  .fdp-widget-wrap .cw-confidence {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; margin-top: 5px;
  }
  .fdp-widget-wrap .cw-confidence--high   { background: #f0fdf4; color: #16a34a; }
  .fdp-widget-wrap .cw-confidence--medium { background: #fffbeb; color: #d97706; }
  .fdp-widget-wrap .cw-confidence--low    { background: #fef2f2; color: #dc2626; }
  .fdp-widget-wrap .cw-chips {
    display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px;
  }
  .fdp-widget-wrap .cw-chip {
    padding: 6px 12px; border-radius: 20px;
    border: 1.5px solid #1f48ff; background: #fff; color: #1f48ff;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .fdp-widget-wrap .cw-chip:hover { background: #1f48ff; color: #fff; }
  .fdp-widget-wrap .cw-typing {
    align-self: flex-start; background: #fff;
    border-radius: 16px; border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    padding: 12px 14px; display: flex; gap: 4px; align-items: center;
  }
  .fdp-widget-wrap .cw-typing span {
    width: 6px; height: 6px; border-radius: 50%; background: #c7d2fe;
    animation: cw-bounce 1.2s infinite ease-in-out;
  }
  .fdp-widget-wrap .cw-typing span:nth-child(2) { animation-delay: 0.2s; }
  .fdp-widget-wrap .cw-typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes cw-bounce {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
    40%           { transform: scale(1);   opacity: 1;   }
  }
  .fdp-widget-wrap .cw-input-row {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 10px 12px; border-top: 1px solid #e9edf8; background: #fff; flex-shrink: 0;
  }
  .fdp-widget-wrap .cw-input {
    flex: 1; border: 1.5px solid #e0e7ff; border-radius: 12px;
    padding: 9px 12px; font-size: 13.5px; color: #010a4f; background: #f8f9ff;
    resize: none; min-height: 40px; max-height: 90px; outline: none;
    transition: border-color 0.15s; font-family: inherit;
  }
  .fdp-widget-wrap .cw-input:focus { border-color: #1f48ff; background: #fff; }
  .fdp-widget-wrap .cw-input::placeholder { color: #9ca3af; }
  .fdp-widget-wrap .cw-send {
    width: 38px; height: 38px; border-radius: 10px; background: #1f48ff; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: background 0.15s, transform 0.1s;
  }
  .fdp-widget-wrap .cw-send:hover { background: #3a5eff; }
  .fdp-widget-wrap .cw-send:active { transform: scale(0.93); }
  .fdp-widget-wrap .cw-send:disabled { opacity: 0.4; cursor: not-allowed; }
  .fdp-widget-wrap .cw-footer {
    text-align: center; font-size: 10px; color: #9ca3af;
    padding: 6px; background: #fff; border-top: 1px solid #f3f4f6; flex-shrink: 0;
  }
  .fdp-widget-wrap .cw-footer a { color: #1f48ff; text-decoration: none; }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = WIDGET_CSS;
  document.head.appendChild(el);
  stylesInjected = true;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FrontDeskPreview({ onClose }) {
  const businessId = useBusinessId();
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [conversationId, setConvId]   = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [chips, setChips]             = useState(['Get a quote', 'Regular cleaning', 'End of tenancy', 'One-off clean']);
  const [visitorInfo, setVisitorInfo] = useState({});
  const [infoLoading, setInfoLoading] = useState(true);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { injectStyles(); }, []);

  // Load business info
  useEffect(() => {
    if (!businessId) return;
    apiFetchBusinessInfo(businessId).then(info => {
      if (info) setBusinessInfo(info);
      setInfoLoading(false);
    });
  }, [businessId]);

  // Show greeting once business info loads
  useEffect(() => {
    if (infoLoading || messages.length > 0) return;
    const bizName = businessInfo?.business_name ?? 'us';
    const greeting = businessInfo?.greeting ??
      `Hi there! 👋 I'm Cadi, the virtual assistant for ${bizName}. I can give you an instant quote for cleaning services.\n\nWhat can I help you with today?`;
    setMessages([{ role: 'assistant', text: greeting }]);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [infoLoading, businessInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || loading || !businessId) return;

    setInput('');
    setChips([]);
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setLoading(true);

    const result = await apiSendMessage({ businessId, conversationId, message: trimmed, visitorInfo });
    setLoading(false);

    if (result.conversation_id && result.conversation_id !== conversationId) {
      setConvId(result.conversation_id);
    }
    if (result.visitor_info) {
      setVisitorInfo(prev => ({ ...prev, ...result.visitor_info }));
    }

    setMessages(prev => [...prev, {
      role:  'assistant',
      text:  result.message ?? "Sorry, I couldn't process that. Please try again.",
      quote: result.quote ?? null,
    }]);

    if (result.suggestions?.length) setChips(result.suggestions);
  }, [input, loading, businessId, conversationId, visitorInfo]);

  function handleReset() {
    setMessages([]);
    setConvId(null);
    setChips(['Get a quote', 'Regular cleaning', 'End of tenancy', 'One-off clean']);
    setVisitorInfo({});
    setInfoLoading(true);
    // Re-trigger greeting
    if (businessId) {
      apiFetchBusinessInfo(businessId).then(info => {
        if (info) setBusinessInfo(info);
        setInfoLoading(false);
      });
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose();
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const bizName = businessInfo?.business_name ?? 'Your Business';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(1,10,79,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={handleBackdrop}
    >
      <div
        className="flex flex-col items-center gap-3"
        style={{ maxHeight: '100vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Preview label + controls */}
        <div className="flex items-center justify-between w-full px-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold tracking-wide"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
              PREVIEW
            </span>
            <span className="text-xs text-white/70">This is exactly what your customers will see</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
              title="Reset conversation"
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.85)' }}
            >
              <X size={12} />
              Close
            </button>
          </div>
        </div>

        {/* Widget panel */}
        <div
          className="fdp-widget-wrap flex flex-col overflow-hidden"
          style={{
            width: 360,
            height: 540,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 120px)',
            borderRadius: 16,
            background: '#fff',
            boxShadow: '0 8px 48px rgba(0,0,0,0.28)',
          }}
        >
          {/* Header */}
          <div className="cw-header">
            <div className="cw-header-avatar">
              <CadiIcon />
            </div>
            <div className="cw-header-info">
              <div className="cw-header-name">{bizName}</div>
              <div className="cw-header-status">
                <span className="cw-online-dot" />
                AI assistant · instant quotes
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="cw-messages">
            {messages.map((msg, i) => <BubbleMessage key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Chips */}
          {chips.length > 0 && !loading && (
            <div className="cw-chips">
              {chips.map(chip => (
                <button key={chip} className="cw-chip" onClick={() => send(chip)}>{chip}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="cw-input-row">
            <textarea
              ref={inputRef}
              className="cw-input"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading || !businessId}
            />
            <button
              className="cw-send"
              onClick={() => send()}
              disabled={!input.trim() || loading || !businessId}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </div>

          {/* Footer */}
          <div className="cw-footer">
            Powered by <a href="https://cadi.cleaning" target="_blank" rel="noopener noreferrer">Cadi</a>
          </div>
        </div>

        {/* Hint below */}
        <p className="text-xs text-white/50">
          Press Esc or click outside to close
        </p>
      </div>
    </div>
  );
}
