import { useState } from 'react';

const EARN_ORANGE = '#C2410C';

const NOTIFICATIONS = [
  { id: 'n1', type: 'job-new',   icon: '⭐', title: 'New job matched to you',       sub: 'Premier Inn Luton Airport · MK42 · Britannia FM · £85/visit',    time: '5 min ago',  read: false },
  { id: 'n2', type: 'accepted',  icon: '✅', title: 'Application accepted',          sub: 'Luton Library evening clean · Britannia FM',              time: '08:47',      read: false },
  { id: 'n3', type: 'review',    icon: '★',  title: 'New FM review posted',          sub: 'Britannia FM · Next – Luton The Mall · 5 stars',             time: '08:30',      read: true  },
  { id: 'n4', type: 'payment',   icon: '💷', title: 'Payment confirmed',             sub: 'Britannia FM · £425 · ref #BF-PAY-0512',                 time: 'Yesterday',  read: true  },
  { id: 'n5', type: 'job-new',   icon: '⭐', title: 'New job matched to you',       sub: 'Next – Centre:MK · MK41 · Metro Clean · £92/visit',     time: 'Yesterday',  read: true  },
  { id: 'n6', type: 'change',    icon: '📋', title: 'Job details updated by FM',    sub: 'Next – Luton The Mall · 9 May · time window adjusted',        time: '2 days ago', read: true  },
];

const THREADS = [
  {
    id: 't1', fm: 'Britannia FM', contact: 'James Morris — Ops Manager', unread: 2,
    messages: [
      { from: 'fm',  time: '08:30', text: 'Hi — just to confirm, Next – Luton The Mall is a daily job Monday to Friday, 06:00–08:00. Please make sure photos are uploaded before you leave site each morning.' },
      { from: 'me',  time: '08:45', text: "Understood, thanks. Will do — I\'ve been uploading within 10 minutes of leaving. Any specific areas they want more coverage on?" },
      { from: 'fm',  time: '09:02', text: "The site supervisor has mentioned the toilets on the first floor could have more photos — they want 2 per room ideally. Can you add that from tomorrow?" },
      { from: 'me',  time: '09:15', text: 'Yes, no problem at all. I\'ll cover all 6 toilet cubicles from tomorrow.' },
      { from: 'fm',  time: '09:18', text: 'Perfect, thank you. Your quality scores have been great by the way — keep it up.' },
    ],
  },
  {
    id: 't2', fm: 'Metro Clean', contact: 'Priya Sharma — Account Manager', unread: 0,
    messages: [
      { from: 'fm', time: '15 Apr 16:30', text: 'Thanks for your application to join Metro Clean\'s network. We\'re reviewing your profile and will be in touch within 5 working days.' },
      { from: 'fm', time: '16 Apr 10:15', text: 'Application approved! Welcome to Metro Clean. You\'ll start receiving job matches from Monday.' },
    ],
  },
];

export default function EarnComms() {
  const [activeTab,    setActiveTab]    = useState('notifications');
  const [activeThread, setActiveThread] = useState('t1');
  const [draft,        setDraft]        = useState('');
  const [threads,      setThreads]      = useState(THREADS);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);

  const thread = threads.find(t => t.id === activeThread);
  const unreadCount = notifications.filter(n => !n.read).length;

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setThreads(prev => prev.map(t => t.id === activeThread
      ? { ...t, messages: [...t.messages, { from: 'me', time: 'Now', text: draft.trim() }] }
      : t
    ));
    setDraft('');
  }

  return (
    <div className="max-w-3xl space-y-5 pb-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#010a4f]">Messages</h1>
        <p className="text-sm text-gray-500 mt-0.5">All FM communications and job alerts in one place — no buried emails.</p>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1">
        {[
          { id: 'notifications', label: 'Alerts', badge: unreadCount },
          { id: 'messages',      label: 'Messages', badge: threads.reduce((s, t) => s + t.unread, 0) },
        ].map(({ id, label, badge }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              activeTab === id ? 'text-white' : 'bg-white border border-[#99c5ff]/30 text-gray-600 hover:border-gray-300'
            }`}
            style={activeTab === id ? { background: EARN_ORANGE } : {}}>
            {label}
            {badge > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-white/25 text-white' : 'bg-[#C2410C] text-white'}`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'notifications' ? (
        <div className="space-y-2">
          {notifications.map(n => (
            <button key={n.id}
              onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))}
              className={`w-full bg-white rounded-2xl border text-left p-4 flex items-start gap-3 transition-all hover:shadow-sm ${
                n.read ? 'border-[#99c5ff]/20' : 'border-[#C2410C]/30 shadow-sm'
              }`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: n.read ? '#f8faff' : 'rgba(194,65,12,0.08)' }}>
                {n.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-sm font-bold ${n.read ? 'text-gray-700' : 'text-[#010a4f]'}`}>{n.title}</span>
                  {!n.read && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: EARN_ORANGE }} />}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 truncate">{n.sub}</div>
              </div>
              <div className="text-[10px] text-gray-400 shrink-0">{n.time}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[220px_1fr] gap-4" style={{ minHeight: 480 }}>
          {/* Thread list */}
          <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conversations</div>
            </div>
            {threads.map(t => (
              <button key={t.id}
                onClick={() => setActiveThread(t.id)}
                className={`w-full text-left px-4 py-3.5 transition-all ${
                  activeThread === t.id ? 'bg-[#f0f4ff]' : 'hover:bg-gray-50'
                }`}
                style={{ borderLeft: activeThread === t.id ? `3px solid ${EARN_ORANGE}` : '3px solid transparent', borderBottom: '1px solid #f9fafb' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-[#010a4f] truncate">{t.fm}</div>
                  {t.unread > 0 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ background: EARN_ORANGE }}>{t.unread}</span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">{t.contact}</div>
                <div className="text-[10px] text-gray-400 truncate mt-1">{t.messages[t.messages.length - 1]?.text}</div>
              </button>
            ))}
          </div>

          {/* Message view */}
          {thread && (
            <div className="bg-white rounded-2xl border border-[#99c5ff]/20 shadow-sm flex flex-col overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex-shrink-0">
                <div className="font-bold text-sm text-[#010a4f]">{thread.fm}</div>
                <div className="text-xs text-gray-400">{thread.contact}</div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {thread.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-xs">
                      <div className={`text-[10px] font-bold text-gray-400 mb-1 ${msg.from === 'me' ? 'text-right' : ''}`}>
                        {msg.from === 'me' ? 'You' : thread.fm} · {msg.time}
                      </div>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        msg.from === 'me'
                          ? 'text-white rounded-br-sm'
                          : 'bg-[#f8faff] border border-[#99c5ff]/20 text-[#010a4f] rounded-bl-sm'
                      }`}
                        style={msg.from === 'me' ? { background: EARN_ORANGE } : {}}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSend} className="px-5 py-3 border-t border-gray-50 flex gap-2 flex-shrink-0">
                <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
                  placeholder={`Message ${thread.fm}…`}
                  className="flex-1 border border-[#99c5ff]/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#4f78ff] bg-[#f8faff]" />
                <button type="submit"
                  className="px-4 py-2 rounded-xl text-sm font-black text-white transition-all hover:brightness-110 disabled:opacity-40"
                  style={{ background: EARN_ORANGE }}
                  disabled={!draft.trim()}>
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
