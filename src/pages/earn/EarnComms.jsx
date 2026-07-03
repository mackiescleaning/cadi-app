import { useEffect, useState } from 'react';
import { MessageCircleQuestion, Inbox, Send, Loader2, MessagesSquare } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { listJobMessages, postJobMessage } from '../../lib/db/connectDb';
import {
  CONNECT_COLORS, CONNECT_RADII, ON_DARK,
  glassDark, orangeCanvas,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const BLUE   = '#7ea3ff';

// Pull all jobs that have at least one message AND belong to the current sub.
async function listMyMessageThreads() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: messages, error: mErr } = await supabase
    .from('job_messages')
    .select(`
      id, job_id, author_id, author_role, body, created_at,
      job:jobs (
        id, date,
        site:sites ( id, name, postcode ),
        fm_organisation:fm_organisations ( id, name )
      )
    `)
    .order('created_at', { ascending: false });
  if (mErr) throw mErr;

  const byJob = new Map();
  for (const m of messages ?? []) {
    if (!m.job) continue;
    const existing = byJob.get(m.job_id);
    if (!existing) {
      byJob.set(m.job_id, {
        jobId:        m.job_id,
        siteName:     m.job.site?.name ?? 'Site',
        sitePostcode: m.job.site?.postcode ?? '',
        fmName:       m.job.fm_organisation?.name ?? 'FM',
        jobDate:      m.job.date,
        latest:       m,
        fmCount:      m.author_role === 'fm' ? 1 : 0,
        total:        1,
      });
    } else {
      existing.total += 1;
      if (m.author_role === 'fm') existing.fmCount += 1;
    }
  }
  return Array.from(byJob.values()).sort((a, b) => (
    new Date(b.latest.created_at) - new Date(a.latest.created_at)
  ));
}

/* ─── Notifications panel ─────────────────────────────────────────────────── */
function NotificationsPanel() {
  return (
    <div style={{
      ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
      textAlign: 'center',
    }}>
      <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: `linear-gradient(135deg, #ffffff 0%, #ffd7bf 100%)`,
          boxShadow: '0 12px 30px -12px rgba(255,255,255,0.35)',
        }}>
        <Inbox size={22} color={CONNECT_COLORS.orange} strokeWidth={2.2} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
        In-app alerts coming soon
      </div>
      <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 8, maxWidth: 420, margin: '8px auto 0', lineHeight: 1.5 }}>
        You already get emailed when an FM approves, queries or rejects a job, and when an invoice is paid. A live in-app feed of the same events will land here next.
      </div>
    </div>
  );
}

/* ─── Messages panel ──────────────────────────────────────────────────────── */
function MessagesPanel() {
  const [threads,     setThreads]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeJobId, setActiveJobId] = useState(null);
  const [messages,    setMessages]    = useState([]);
  const [msgLoading,  setMsgLoading]  = useState(false);
  const [draft,       setDraft]       = useState('');
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const t = await listMyMessageThreads();
        setThreads(t);
        if (t.length > 0 && !activeJobId) setActiveJobId(t[0].jobId);
      } catch (e) {
        setError(e.message || 'Could not load messages');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeJobId) { setMessages([]); return; }
    setMsgLoading(true);
    listJobMessages(activeJobId)
      .then(setMessages)
      .catch(e => setError(e.message))
      .finally(() => setMsgLoading(false));
  }, [activeJobId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!draft.trim() || !activeJobId) return;
    setSending(true); setError(null);
    try {
      const { ok, data } = await postJobMessage({ jobId: activeJobId, body: draft.trim() });
      if (!ok) throw new Error(data?.error || 'Send failed');
      setDraft('');
      setMessages(await listJobMessages(activeJobId));
      setThreads(await listMyMessageThreads());
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div style={{ ...glassDark({ padding: 40, radius: CONNECT_RADII.lg }), textAlign: 'center', color: ON_DARK.muted }}>
        <Loader2 size={18} className="mx-auto mb-2"
          style={{ animation: 'connectSpin 0.8s linear infinite' }} />
        <div style={{ fontSize: 12 }}>Loading…</div>
        <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div style={{
        ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
        textAlign: 'center',
      }}>
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
          style={{
            background: `linear-gradient(135deg, ${BLUE} 0%, #1e3a8a 100%)`,
            boxShadow: '0 12px 30px -12px rgba(126,163,255,0.55)',
          }}>
          <MessageCircleQuestion size={22} color="#ffffff" strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>No conversations yet</div>
        <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 8, maxWidth: 420, margin: '8px auto 0', lineHeight: 1.5 }}>
          When an FM queries one of your completed jobs, the back-and-forth lands here. Reply to clear the query and resubmit the job for approval.
        </div>
      </div>
    );
  }

  const active = threads.find(t => t.jobId === activeJobId);

  return (
    <div className="grid md:grid-cols-[260px_1fr] gap-4" style={{ minHeight: 480 }}>
      {/* Thread list */}
      <div style={{ ...glassDark({ radius: CONNECT_RADII.lg, strong: true }), overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.20em', textTransform: 'uppercase' }}>
            Conversations
          </div>
        </div>
        {threads.map(t => {
          const isActive = activeJobId === t.jobId;
          return (
            <button key={t.jobId}
              onClick={() => setActiveJobId(t.jobId)}
              style={{
                width: '100%', textAlign: 'left',
                padding: '14px 16px',
                background: isActive ? 'rgba(255,255,255,0.10)' : 'transparent',
                borderLeft: `3px solid ${isActive ? ORANGE : 'transparent'}`,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                cursor: 'pointer',
                transition: 'background 150ms ease',
              }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.fmName}</div>
                <span style={{
                  fontSize: 9, fontWeight: 900, color: '#ffffff',
                  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
                  padding: '2px 7px', borderRadius: 999, flexShrink: 0,
                }}>{t.total}</span>
              </div>
              <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.siteName}{t.sitePostcode ? ` · ${t.sitePostcode}` : ''}
              </div>
              <div style={{ fontSize: 10, color: ON_DARK.faint, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.latest.body}
              </div>
            </button>
          );
        })}
      </div>

      {/* Message view */}
      {active && (
        <div style={{ ...glassDark({ radius: CONNECT_RADII.lg, strong: true }), display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>{active.fmName}</div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>{active.siteName}{active.sitePostcode ? ` · ${active.sitePostcode}` : ''}</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 420 }}>
            {msgLoading && <div style={{ textAlign: 'center', fontSize: 11, color: ON_DARK.muted }}>Loading…</div>}
            {!msgLoading && messages.map(m => {
              const mine = m.author_role === 'sub';
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%' }}>
                    <div style={{
                      fontSize: 10, fontWeight: 800, color: ON_DARK.faint,
                      marginBottom: 4, textAlign: mine ? 'right' : 'left',
                    }}>
                      {mine ? 'You' : active.fmName} · {new Date(m.created_at).toLocaleString()}
                    </div>
                    <div style={{
                      padding: '10px 14px',
                      background: mine ? '#ffffff' : 'rgba(255,255,255,0.08)',
                      color: mine ? CONNECT_COLORS.navy : '#ffffff',
                      border: mine ? '1px solid rgba(255,255,255,0.8)' : '1px solid rgba(255,255,255,0.14)',
                      borderRadius: 14,
                      borderBottomRightRadius: mine ? 4 : 14,
                      borderBottomLeftRadius:  mine ? 14 : 4,
                      fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                    }}>
                      {m.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {error && (
            <div style={{
              padding: '10px 20px',
              background: 'rgba(220,38,38,0.14)',
              borderTop: '1px solid rgba(220,38,38,0.30)',
              fontSize: 11, color: '#fca5a5',
            }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSend}
            style={{
              padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', gap: 8,
            }}>
            <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
              placeholder={`Message ${active.fmName}…`}
              style={{
                flex: 1, padding: '10px 12px', borderRadius: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)',
                fontSize: 13, color: '#ffffff', outline: 'none', fontFamily: 'inherit',
              }}
              disabled={sending} />
            <button type="submit"
              style={{
                padding: '10px 16px', borderRadius: 12,
                background: draft.trim() ? '#ffffff' : 'rgba(255,255,255,0.10)',
                color: draft.trim() ? CONNECT_COLORS.navy : ON_DARK.muted,
                border: '1px solid rgba(255,255,255,0.4)',
                fontSize: 12, fontWeight: 900,
                cursor: draft.trim() && !sending ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              disabled={!draft.trim() || sending}>
              {sending ? <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} /> : <Send size={12} />} Send
            </button>
          </form>
          <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnComms() {
  const [activeTab, setActiveTab] = useState('messages');

  return (
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={orangeCanvas()}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">

        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(255, 176, 90, 0.28) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(1, 10, 79, 0.30) 0%, transparent 60%),
              rgba(255,255,255,0.05)
            `,
          }}>
          <div className="relative px-6 md:px-9 py-7 md:py-8">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                style={{ background: '#ffffff', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.4)' }}>
                <MessagesSquare size={13} color={CONNECT_COLORS.navy} strokeWidth={2.5} />
              </div>
              <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">Messages</span>
            </div>
            <h1 className="text-white mb-2"
              style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              FM conversations{' '}
              <span style={{ color: '#ffd7bf' }}>on your jobs.</span>
            </h1>
            <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
              Every back-and-forth on a queried job lives here. Alerts land here too as we ship them.
            </p>
          </div>
        </div>

        {/* Tab pills */}
        <div style={{
          display: 'inline-flex', gap: 4,
          padding: 4,
          ...glassDark({ radius: 999, strong: true }),
        }}>
          {[
            { id: 'messages',      label: 'Messages' },
            { id: 'notifications', label: 'Alerts' },
          ].map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                style={{
                  padding: '8px 18px', borderRadius: 999,
                  fontSize: 12, fontWeight: 900,
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? CONNECT_COLORS.navy : ON_DARK.muted,
                  border: 'none', cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}>
                {label}
              </button>
            );
          })}
        </div>

        {activeTab === 'messages' ? <MessagesPanel /> : <NotificationsPanel />}
      </div>
    </div>
  );
}
