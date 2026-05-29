import { useState } from 'react';

const INITIAL_MESSAGES = [
  {
    id: 1, from: 'fm', sender: 'Britannia Group', time: '08:05',
    text: 'Good morning — your morning clean at Next – Luton The Mall is complete. 12 photos uploaded. All areas signed off per the schedule.',
  },
  {
    id: 2, from: 'client', sender: 'Helen Marsh', time: '09:10',
    text: 'Thanks — can we look at scheduling a one-off deep clean of the stockroom and fitting rooms ahead of the summer sale starting 23 May?',
  },
  {
    id: 3, from: 'fm', sender: 'Britannia Group', time: '09:44',
    text: "Absolutely. I'll get a quote over to you by end of day. Would a Sunday morning work? That's typically best for retail sites — no trading disruption.",
  },
  {
    id: 4, from: 'client', sender: 'Helen Marsh', time: '10:01',
    text: 'Sunday works perfectly — 18 May if possible? A 07:00 start would be ideal so everything is done well before the doors open.',
  },
  {
    id: 5, from: 'fm', sender: 'Britannia Group', time: '10:15',
    text: "Confirmed for Sun 18 May, 07:00–11:00. I'll add it to your schedule and send the quote and booking confirmation this afternoon. Our deep clean team will cover the stockroom, fitting rooms, and all toilet facilities.",
  },
  {
    id: 6, from: 'client', sender: 'Helen Marsh', time: '10:22',
    text: 'Perfect — thank you. Please also include the checkout area near the main entrance if there\'s time.',
  },
  {
    id: 7, from: 'fm', sender: 'Britannia Group', time: '14:35',
    text: "Quote attached (PDF). Deep clean includes stockroom, fitting rooms, toilets, and checkout zone — £385 + VAT. Happy to proceed once you have internal sign-off.",
  },
];

const NOTIFICATIONS = [
  { type: 'complete', text: 'Clean completed — Next Luton The Mall',  time: '08:05', read: true  },
  { type: 'complete', text: 'Clean completed — Next Centre:MK',       time: '08:22', read: true  },
  { type: 'complete', text: 'Clean completed — Next Watford Atria',   time: '08:41', read: true  },
  { type: 'quote',    text: 'Quote ready — Deep clean 18 May',        time: '14:35', read: false },
];

export default function ClientComms({ showToast }) {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [draft, setDraft] = useState('');
  const [tab, setTab] = useState('messages');

  function handleSend(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const msg = {
      id: messages.length + 1,
      from: 'client',
      sender: 'Sarah Mitchell',
      time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      text: draft.trim(),
    };
    setMessages(prev => [...prev, msg]);
    setDraft('');
    showToast('message sent to Britannia Group');
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ maxHeight: 'calc(100vh - 64px)' }}>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        {[
          { id: 'messages', label: 'Messages' },
          { id: 'notifications', label: 'Notifications' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === id ? 'bg-[#010a4f] text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {label}
            {id === 'notifications' && <span className="ml-1.5 bg-[#4f78ff] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">1</span>}
          </button>
        ))}
        <div className="ml-auto text-xs text-gray-400">Next – Luton The Mall · Britannia Group</div>
      </div>

      {tab === 'messages' ? (
        <>
          {/* Message thread */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            <div className="text-center text-[10px] text-gray-400 mb-2">Today, 9 May 2026</div>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'client' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-sm ${msg.from === 'client' ? 'order-2' : ''}`}>
                  <div className={`flex items-baseline gap-2 mb-1 ${msg.from === 'client' ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-bold text-gray-500">{msg.sender}</span>
                    <span className="text-[10px] text-gray-400">{msg.time}</span>
                  </div>
                  <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'client'
                      ? 'bg-[#010a4f] text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-[#010a4f] shadow-sm rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 flex-shrink-0">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder="Message Britannia Group…"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#4f78ff] bg-gray-50"
              />
              <button type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#010a4f] text-white text-sm font-bold hover:bg-[#1f48ff] transition-colors disabled:opacity-40"
                disabled={!draft.trim()}>
                Send
              </button>
            </form>
            <div className="text-[10px] text-gray-400 mt-2">Messages go directly to your Britannia Group account manager. Typical response within 2 hours.</div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
          {NOTIFICATIONS.map((n, i) => (
            <div key={i} className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${n.read ? 'border-gray-100' : 'border-[#4f78ff]/30 shadow-sm'}`}>
              <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${n.read ? 'bg-gray-200' : 'bg-[#4f78ff]'}`} />
              <div className="flex-1">
                <div className="text-sm font-medium text-[#010a4f]">{n.text}</div>
                <div className="text-xs text-gray-400 mt-0.5">Today {n.time}</div>
              </div>
              {!n.read && (
                <span className="text-[9px] font-black text-[#4f78ff] bg-[#4f78ff]/10 px-2 py-0.5 rounded-full shrink-0">NEW</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
