import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  ExternalLink,
} from 'lucide-react';

const CARDS = [
  {
    id: 'jc1',
    ref: '#BF-4500',
    workType: 'Daily clean',
    area: 'General Wards 2–6',
    route: 'employed',
    assignTo: 'Marcus T.',
    status: 'confirmed',
    confirmedAt: 'Auto-assigned',
  },
  {
    id: 'jc2',
    ref: '#BF-4501',
    workType: 'Deep clean',
    area: 'General Wards 2–6',
    route: 'employed',
    assignTo: 'Marcus T.',
    status: 'confirmed',
    confirmedAt: 'Auto-assigned',
  },
  {
    id: 'jc3',
    ref: '#BF-4502',
    workType: 'Washroom service',
    area: 'General Wards 2–6',
    route: 'employed',
    assignTo: 'Claire B.',
    status: 'confirmed',
    confirmedAt: 'Auto-assigned',
  },
  {
    id: 'jc4',
    ref: '#BF-4503',
    workType: 'Specialist clean',
    area: 'A&E & Outpatients',
    route: 'connect',
    assignTo: null,
    status: 'pending',
    sentAt: '2 min ago',
    matchCount: 4,
  },
  {
    id: 'jc5',
    ref: '#BF-4504',
    workType: 'Washroom service',
    area: 'A&E & Outpatients',
    route: 'connect',
    assignTo: null,
    status: 'pending',
    sentAt: '2 min ago',
    matchCount: 6,
  },
  {
    id: 'jc6',
    ref: '#BF-4505',
    workType: 'Daily clean',
    area: 'Reception & Waiting',
    route: 'employed',
    assignTo: 'Claire B.',
    status: 'confirmed',
    confirmedAt: 'Auto-assigned',
  },
];

const STATUS_CFG = {
  confirmed: {
    label: 'Confirmed',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.1)',
    border: 'rgba(52,211,153,0.25)',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Awaiting accept',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.22)',
    icon: Clock,
  },
  declined: {
    label: 'Declined',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: AlertTriangle,
  },
};

export default function FmDispatchBoard() {
  const [cards, setCards] = useState(CARDS);
  const [reportSent, setReportSent] = useState(false);

  function acceptConnect(id) {
    setCards((cs) =>
      cs.map((c) =>
        c.id === id
          ? { ...c, status: 'confirmed', assignTo: 'Priya N.', confirmedAt: 'Just now' }
          : c
      )
    );
  }
  function redispatch(id) {
    setCards((cs) =>
      cs.map((c) =>
        c.id === id ? { ...c, status: 'pending', sentAt: 'Just now', matchCount: 3 } : c
      )
    );
  }

  const confirmed = cards.filter((c) => c.status === 'confirmed');
  const pending = cards.filter((c) => c.status === 'pending');
  const declined = cards.filter((c) => c.status === 'declined');
  const coveragePct = Math.round((confirmed.length / cards.length) * 100);

  return (
    <div className="p-6 max-w-5xl space-y-5">
      {/* Impact strip */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(79,120,255,0.18)', background: 'rgba(1,8,40,0.6)' }}
      >
        <div
          className="px-5 py-2.5 flex items-center gap-3"
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(79,120,255,0.06)',
          }}
        >
          <span className="text-[9px] font-black uppercase tracking-widest text-white/30">
            What Cadi replaces
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: '#4f78ff' }}
          >
            With Cadi
          </span>
        </div>
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderColor: 'rgba(255,255,255,0.06)' }}
        >
          {[
            {
              before: 'Dispatch managed by phone — FM chases every operative manually',
              after: 'Job cards dispatched automatically — operative confirms in the app',
              icon: '📲',
            },
            {
              before: 'Cover gap discovered when operative does not show up',
              after: 'Gap flagged instantly — Connect fills it before the SLA window opens',
              icon: '⚡',
            },
            {
              before: 'No record of who was sent what or when',
              after: 'Full dispatch log per job — every action timestamped and auditable',
              icon: '📋',
            },
          ].map(({ before, after, icon }) => (
            <div key={icon} className="px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="text-[10px] text-white/30 line-through decoration-white/20 mb-1 leading-snug">
                  {before}
                </div>
                <div className="text-[10px] font-bold leading-snug" style={{ color: '#60a5fa' }}>
                  {after}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coverage bar */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-white font-black text-base">L&D Hospital — Dispatch Status</div>
            <div className="text-white/40 text-xs mt-0.5">
              Luton & Dunstable NHS FT · Contract deploys 1 Jun 2026
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-3xl font-black"
              style={{ color: coveragePct === 100 ? '#34d399' : '#fbbf24' }}
            >
              {coveragePct}%
            </div>
            <div className="text-white/30 text-[10px]">coverage confirmed</div>
          </div>
        </div>
        <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${coveragePct}%`,
              background:
                coveragePct === 100 ? '#34d399' : 'linear-gradient(90deg, #34d399, #fbbf24)',
            }}
          />
        </div>
        <div className="flex items-center gap-5 mt-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#34d399]" />
            <span className="text-white/50">{confirmed.length} confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#fbbf24]" />
            <span className="text-white/50">{pending.length} awaiting</span>
          </div>
          {declined.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#f87171]" />
              <span className="text-white/50">{declined.length} declined</span>
            </div>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {cards.map((card) => {
          const st = STATUS_CFG[card.status];
          const Icon = st.icon;
          const isEmployed = card.route === 'employed';
          const routeC = isEmployed ? '#4f78ff' : '#fb923c';

          return (
            <div
              key={card.id}
              className="rounded-2xl p-4 flex items-center gap-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${card.status === 'confirmed' ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {/* Status dot */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: st.bg, border: `1px solid ${st.border}` }}
              >
                <Icon size={14} style={{ color: st.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-[10px] font-black text-white/30">{card.ref}</span>
                  <span className="text-sm font-black text-white">{card.workType}</span>
                  <span
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: `${routeC}15`,
                      color: routeC,
                      border: `1px solid ${routeC}30`,
                    }}
                  >
                    {isEmployed
                      ? `👤 ${card.assignTo || 'Staff'}`
                      : card.assignTo
                        ? `🌐 ${card.assignTo}`
                        : '🌐 Connect'}
                  </span>
                </div>
                <div className="text-[11px] text-white/35">{card.area}</div>
              </div>

              {/* Status + action */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-[11px] font-bold" style={{ color: st.color }}>
                    {st.label}
                  </div>
                  <div className="text-[10px] text-white/25">
                    {card.status === 'confirmed'
                      ? card.confirmedAt
                      : card.status === 'pending'
                        ? `Sent ${card.sentAt} · ${card.matchCount} matches`
                        : `Declined — needs redispatch`}
                  </div>
                </div>
                {card.status === 'pending' && !isEmployed && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => acceptConnect(card.id)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black"
                      style={{
                        background: 'rgba(52,211,153,0.12)',
                        border: '1px solid rgba(52,211,153,0.25)',
                        color: '#34d399',
                      }}
                    >
                      Accept (demo) ✓
                    </button>
                    <button
                      onClick={() => window.open('/operative-demo', '_blank')}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1"
                      style={{
                        background: 'rgba(251,146,60,0.1)',
                        border: '1px solid rgba(251,146,60,0.25)',
                        color: '#fb923c',
                      }}
                    >
                      <ExternalLink size={10} /> Cleaner view
                    </button>
                  </div>
                )}
                {card.status === 'declined' && (
                  <button
                    onClick={() => redispatch(card.id)}
                    className="px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5"
                    style={{
                      background: 'rgba(251,191,36,0.1)',
                      border: '1px solid rgba(251,191,36,0.25)',
                      color: '#fbbf24',
                    }}
                  >
                    <RefreshCw size={11} /> Redispatch
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Client coverage report */}
      {coveragePct === 100 && !reportSent && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{
            background: 'linear-gradient(135deg, rgba(52,211,153,0.08), rgba(79,120,255,0.05))',
            border: '1px solid rgba(52,211,153,0.25)',
          }}
        >
          <FileCheck size={20} style={{ color: '#34d399', flexShrink: 0 }} />
          <div className="flex-1">
            <div className="text-white font-black text-sm">Full coverage achieved</div>
            <div className="text-white/40 text-xs mt-0.5">
              All 6 job cards confirmed. Ready to send coverage confirmation to Luton & Dunstable
              NHS FT.
            </div>
          </div>
          <button
            onClick={() => setReportSent(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-black shrink-0"
            style={{
              background: 'rgba(52,211,153,0.2)',
              border: '1px solid rgba(52,211,153,0.4)',
              color: '#34d399',
            }}
          >
            Send to client portal →
          </button>
        </div>
      )}
      {reportSent && (
        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}
        >
          <CheckCircle2 size={14} style={{ color: '#34d399' }} />
          <span className="text-xs font-bold text-white/60">
            Coverage confirmation sent to client portal ✓ — Luton & Dunstable NHS FT notified
          </span>
        </div>
      )}
    </div>
  );
}
