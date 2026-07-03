import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusinessId } from '../hooks/useBusinessId';
import { useFrontDeskUsage } from '../hooks/useFrontDeskUsage';
import { approveAgentAction, rejectAgentAction } from '../lib/agentFramework';
import {
  Check, X, Clock, Inbox as InboxIcon,
  MessageSquare, Star, CalendarDays, CalendarClock, ChevronDown, ChevronRight,
  RefreshCw, Eye, MapPin, Phone, Building2, Wrench, Tag, Repeat, Timer, ArrowRight, Lock,
} from 'lucide-react';
import { FD_CARD_BG, FD_GOLD, FD_GOLD_SOFT, FD_GOLD_BORDER, FD_GOLD_GLOW, FD_BLUE, FD_SKY, ON_DARK, fdCanvas, fdCard } from '../lib/frontDeskTheme';

// ─── Static maps ──────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  send_quote:           'Quote',
  send_review_request:  'Review request',
  send_followup:        'Follow-up',
  send_invoice:         'Invoice',
  book_job:             'Job booked',
  cancel_job:           'Job cancelled',
  issue_refund:         'Refund',
  send_complaint_reply: 'Complaint reply',
  site_visit_request:   'Site visit request',
};

// Bright, dark-canvas-tuned status colours (the light-mode STATUS_CONFIG
// pairs — amber-50/text-amber-600 etc — go muddy on a navy background).
const STATUS_CONFIG = {
  pending_approval: { label: 'Needs approval', hex: FD_GOLD,   dot: FD_GOLD   },
  approved:         { label: 'Approved',        hex: '#34d399', dot: '#34d399' },
  rejected:         { label: 'Rejected',        hex: '#f87171', dot: '#f87171' },
  sent:             { label: 'Sent',            hex: FD_BLUE,   dot: FD_BLUE   },
  auto_sent:        { label: 'Auto-sent',       hex: FD_SKY,    dot: FD_SKY    },
  failed:           { label: 'Failed',          hex: '#f87171', dot: '#f87171' },
  superseded:       { label: 'Superseded',      hex: 'rgba(153,197,255,0.4)', dot: 'rgba(153,197,255,0.3)' },
};

// Maps agent DB key → display config (includes legacy keys for old rows)
const AGENT_CONFIG = {
  sales_manager:      { label: 'Sales Manager',      icon: MessageSquare,  accent: FD_BLUE },
  front_desk:         { label: 'Sales Manager',      icon: MessageSquare,  accent: FD_BLUE },
  review_agent:       { label: 'Review Agent',        icon: Star,           accent: '#34d399' },
  reviews:            { label: 'Review Agent',        icon: Star,           accent: '#34d399' },
  operations_manager: { label: 'Operations Manager',  icon: CalendarClock,  accent: '#fb923c' },
  scheduler:          { label: 'Scheduler',           icon: CalendarDays,   accent: '#a78bfa' },
};

// Filter tabs — null means "all"
const FILTER_TABS = [
  { key: null,                label: 'All',                accent: FD_BLUE },
  { key: 'sales_manager',     label: 'Sales Manager',     agents: ['sales_manager', 'front_desk'], accent: FD_BLUE },
  { key: 'review_agent',      label: 'Review Agent',       agents: ['review_agent', 'reviews'],     accent: '#34d399' },
  { key: 'operations_manager',label: 'Operations Manager', agents: ['operations_manager'],          accent: '#fb923c' },
];

// The agent roster shown on the hub — Sales Manager is live, the other two
// are flagged "coming soon" (their pages still work if visited directly).
const AGENT_ROSTER = [
  { path: '/front-desk/sales-manager',      label: 'Sales Manager',      icon: MessageSquare, accent: FD_BLUE,   desc: 'Handles inbound enquiries, quotes and bookings.', live: true },
  { path: '/front-desk/review-agent',       label: 'Review Agent',       icon: Star,          accent: '#34d399', desc: 'Sends review requests after every completed job.', live: false },
  { path: '/front-desk/operations-manager', label: 'Operations Manager', icon: CalendarClock, accent: '#fb923c', desc: 'Reminders, schedules, check-ins and payment matching.', live: false },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Agent roster card ──────────────────────────────────────────────────────

function AgentRosterCard({ agent }) {
  const Icon = agent.icon;
  return (
    <Link
      to={agent.path}
      className="block rounded-2xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        ...fdCard({ radius: 16 }),
        opacity: agent.live ? 1 : 0.82,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${agent.accent}22`, border: `1px solid ${agent.accent}40` }}
        >
          <Icon size={17} style={{ color: agent.accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <p className="text-sm font-black text-white">{agent.label}</p>
            {agent.live ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active
              </span>
            ) : (
              <span
                className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: FD_GOLD_SOFT, color: FD_GOLD, border: `1px solid ${FD_GOLD_BORDER}` }}
              >
                Coming soon
              </span>
            )}
          </div>
          <p className="text-xs leading-relaxed" style={{ color: ON_DARK.muted }}>{agent.desc}</p>
        </div>
        {agent.live
          ? <ArrowRight size={14} className="shrink-0 mt-1" style={{ color: ON_DARK.faint }} />
          : <Lock size={12} className="shrink-0 mt-1.5 opacity-40" style={{ color: ON_DARK.faint }} />}
      </div>
    </Link>
  );
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({ action, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [working,  setWorking]  = useState(false);
  const [cardError, setCardError] = useState(null);
  const { user } = useAuth();

  const isPending = action.status === 'pending_approval';
  const st        = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.sent;
  const cfg       = AGENT_CONFIG[action.agent] ?? AGENT_CONFIG.scheduler;
  const AgentIcon = cfg.icon;
  const agentLabel = cfg.label;
  const actionLabel = ACTION_LABELS[action.action_type] ?? action.action_type?.replace(/_/g, ' ');

  const payload = action.proposed_payload ?? {};

  const handleApprove = async () => {
    setWorking(true);
    setCardError(null);
    try {
      await approveAgentAction(action.id, user?.id);

      if (action.action_type === 'send_review_request') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.functions.invoke('send-review-request', {
            body:    { action_id: action.id },
            headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
          });
        } catch (e) {
          console.error('send-review-request failed:', e);
        }
      }

      onRefresh();
    } catch (e) {
      setCardError('Couldn\'t approve — try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleReject = async () => {
    setWorking(true);
    setCardError(null);
    try {
      await rejectAgentAction(action.id, user?.id);
      onRefresh();
    } catch (e) {
      setCardError('Couldn\'t reject — try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={isPending ? fdCard({ radius: 16, gold: true }) : fdCard({ radius: 16 })}
    >
      {/* Header row */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Agent badge */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.accent + '22', border: `1px solid ${cfg.accent}40` }}>
          <AgentIcon size={15} style={{ color: cfg.accent }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: cfg.accent + '22', color: cfg.accent }}>
              {agentLabel}
            </span>
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>{actionLabel}</span>
            {action.customers?.name && (
              <>
                <span className="text-xs" style={{ color: ON_DARK.faint }}>·</span>
                <span className="text-xs font-medium text-white">
                  {action.customers.name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: st.hex }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
              {st.label}
            </span>
            <span className="text-[10px]" style={{ color: ON_DARK.faint }}>{timeAgo(action.created_at)}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="transition-colors p-1"
          style={{ color: ON_DARK.faint }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Preview — first line of message */}
      {!expanded && payload.message && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs truncate" style={{ color: ON_DARK.muted }}>{payload.message}</p>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 py-3 space-y-3" style={{ borderTop: `1px solid ${ON_DARK.line}` }}>
          {payload.message && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: ON_DARK.faint }}>Proposed message</p>
              <div className="rounded-xl px-3 py-2.5 text-xs whitespace-pre-wrap leading-relaxed text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${ON_DARK.line}` }}>
                {payload.message}
              </div>
            </div>
          )}
          {payload.subject && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: ON_DARK.faint }}>Subject</p>
              <p className="text-xs" style={{ color: ON_DARK.secondary }}>{payload.subject}</p>
            </div>
          )}
          {payload.channel && (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: ON_DARK.faint }}>Channel</p>
              <span className="text-xs capitalize" style={{ color: ON_DARK.secondary }}>{payload.channel}</span>
            </div>
          )}
          {action.reasoning && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: ON_DARK.faint }}>Why Cadi chose this</p>
              <p className="text-xs italic" style={{ color: ON_DARK.muted }}>{action.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Approval buttons */}
      {isPending && (
        <div className="px-4 pb-4 space-y-2">
          {cardError && (
            <p className="text-xs text-red-400 font-medium">{cardError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[#010a4f] text-xs font-black rounded-xl transition-all hover:brightness-110 disabled:opacity-50"
              style={{ background: `linear-gradient(180deg, #fde68a 0%, ${FD_GOLD} 100%)`, boxShadow: `0 6px 16px -6px ${FD_GOLD_GLOW}` }}
            >
              <Check size={12} />
              Approve & send
            </button>
            <button
              onClick={handleReject}
              disabled={working}
              className="px-4 py-2 text-red-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 hover:bg-red-500/10"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.30)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Site visit request card ──────────────────────────────────────────────────

function SiteVisitCard({ action, onRefresh }) {
  const [working,    setWorking]    = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [visitDate,  setVisitDate]  = useState('');
  const [visitTime,  setVisitTime]  = useState('09:00');
  const [visitNote,  setVisitNote]  = useState('');
  const [cardError,  setCardError]  = useState(null);
  const { user } = useAuth();
  const businessId = useBusinessId();
  const p = action.proposed_payload ?? {};

  const isPending = action.status === 'pending_approval';
  const st = STATUS_CONFIG[action.status] ?? STATUS_CONFIG.sent;

  const handleConfirm = async () => {
    setWorking(true);
    setCardError(null);
    try {
      if (visitDate && businessId) {
        const [h, m]    = visitTime.split(':');
        const startHour = parseInt(h) + parseInt(m) / 60;
        const { error: jobErr } = await supabase.from('jobs').insert({
          owner_id:          user.id,
          business_id:       businessId,
          customer:          p.name || 'Site visit enquiry',
          postcode:          '',
          date:              visitDate,
          start_hour:        startHour,
          duration_hrs:      1,
          type:              'site_visit',
          service:           'Site Visit',
          price:             0,
          status:            'scheduled',
          source:            'direct',
          notes:             [
            p.company                ? `Company: ${p.company}` : '',
            p.service_labels?.length ? `Services: ${p.service_labels.join(', ')}` : '',
            p.address                ? `Address: ${p.address}` : '',
            visitNote,
          ].filter(Boolean).join('\n'),
          evidence_required: {},
          is_recurring:      false,
        });
        if (jobErr) {
          setCardError(`Couldn't add to schedule: ${jobErr.message}`);
          return;
        }
      }

      await approveAgentAction(action.id, user?.id, {
        visit_date:         visitDate || null,
        visit_time:         visitTime,
        note:               visitNote || null,
        added_to_schedule:  !!(visitDate && businessId),
      });

      onRefresh();
    } catch (e) {
      setCardError('Something went wrong — please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleReject = async () => {
    setWorking(true);
    setCardError(null);
    try {
      await rejectAgentAction(action.id, user?.id);
      onRefresh();
    } catch (e) {
      setCardError('Couldn\'t reject — try again.');
    } finally {
      setWorking(false);
    }
  };

  const inputCls = "w-full text-xs rounded-lg px-2 py-1.5 text-white focus:outline-none";
  const inputStyle = { background: 'rgba(255,255,255,0.07)', border: `1px solid ${ON_DARK.lineHi}`, colorScheme: 'dark' };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={isPending ? fdCard({ radius: 16, gold: false }) : fdCard({ radius: 16 })}
    >
      {/* Header */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${FD_BLUE}22`, border: `1px solid ${FD_BLUE}40` }}>
          <MapPin size={15} style={{ color: FD_SKY }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${FD_BLUE}22`, color: FD_SKY }}>
              Mackies Website
            </span>
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>Site visit request</span>
            {p.name && (
              <>
                <span className="text-xs" style={{ color: ON_DARK.faint }}>·</span>
                <span className="text-xs font-medium text-white">
                  {p.name}{p.company ? ` — ${p.company}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: st.hex }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.dot }} />
              {st.label}
            </span>
            <span className="text-[10px]" style={{ color: ON_DARK.faint }}>{timeAgo(action.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="px-4 py-3 grid grid-cols-1 gap-2" style={{ borderTop: `1px solid ${ON_DARK.line}` }}>
        {(p.phone || p.email) && (
          <div className="flex items-start gap-3">
            <Phone size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <div className="text-xs space-y-0.5">
              {p.phone && <a href={`tel:${p.phone}`} className="block font-medium hover:underline" style={{ color: FD_SKY }}>{p.phone}</a>}
              {p.email && <a href={`mailto:${p.email}`} className="block hover:underline" style={{ color: ON_DARK.muted }}>{p.email}</a>}
            </div>
          </div>
        )}
        {(p.mode || p.sector_label || p.premises_type) && (
          <div className="flex items-start gap-3">
            <Building2 size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>
              {[
                p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : null,
                p.premises_type ? p.premises_type.charAt(0).toUpperCase() + p.premises_type.slice(1) : null,
                p.sector_label,
              ].filter(Boolean).join(' · ')}
              {p.role ? <span style={{ color: ON_DARK.faint }}> — {p.role}</span> : null}
            </span>
          </div>
        )}
        {(p.service_labels?.length > 0 || p.clean_type || p.services?.length > 0) && (
          <div className="flex items-start gap-3">
            <Wrench size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>
              {[
                p.clean_type,
                ...(p.service_labels ?? []),
                ...(p.services ?? []),
              ].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
        {p.frequency && (
          <div className="flex items-start gap-3">
            <Repeat size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs capitalize" style={{ color: ON_DARK.secondary }}>{p.frequency}</span>
          </div>
        )}
        {p.timeline && (
          <div className="flex items-start gap-3">
            <Timer size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs capitalize" style={{ color: ON_DARK.secondary }}>{p.timeline}</span>
          </div>
        )}
        {(p.address || p.postcode) && (
          <div className="flex items-start gap-3">
            <MapPin size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>{p.address || p.postcode}</span>
          </div>
        )}
        {p.access_notes && (
          <div className="flex items-start gap-3">
            <Tag size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>{p.access_notes}</span>
          </div>
        )}
        {(p.bedrooms || p.size || p.situation) && (
          <div className="flex items-start gap-3">
            <Tag size={12} className="mt-0.5 flex-shrink-0" style={{ color: ON_DARK.faint }} />
            <span className="text-xs" style={{ color: ON_DARK.secondary }}>
              {[
                p.bedrooms ? `${p.bedrooms} bed` : null,
                p.size,
                p.situation,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>

      {/* Schedule panel — shown after tapping "Confirm visit booked" */}
      {isPending && confirming && (
        <div className="px-4 py-3 space-y-3" style={{ borderTop: `1px solid ${ON_DARK.line}` }}>
          <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: FD_SKY }}>Add to schedule</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: ON_DARK.faint }}>Date</label>
              <input type="date" value={visitDate} onChange={e => setVisitDate(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: ON_DARK.faint }}>Time</label>
              <input type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
          <textarea
            value={visitNote}
            onChange={e => setVisitNote(e.target.value)}
            placeholder="Notes — e.g. access details, what to bring, anything agreed on the call…"
            rows={2}
            className={`${inputCls} resize-none py-2`}
            style={inputStyle}
          />
          {cardError && <p className="text-xs text-red-400 font-medium">{cardError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={working}
              className="px-3 py-2 text-xs disabled:opacity-50 hover:text-white transition-colors"
              style={{ color: ON_DARK.faint }}
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50"
              style={{ background: FD_BLUE }}
            >
              <Check size={12} />
              {visitDate ? 'Add to schedule & confirm' : 'Confirm (no schedule entry)'}
            </button>
          </div>
        </div>
      )}

      {/* Call + confirm/reject buttons */}
      {isPending && !confirming && (
        <div className="px-4 pb-4 space-y-2">
          {cardError && <p className="text-xs text-red-400 font-medium">{cardError}</p>}
          <div className="flex gap-2">
            {p.phone && (
              <a
                href={`tel:${p.phone}`}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-colors"
                style={{ background: 'rgba(79,120,255,0.10)', border: `1px solid ${FD_BLUE}40`, color: FD_SKY }}
              >
                <Phone size={12} /> Call
              </a>
            )}
            <button
              onClick={() => setConfirming(true)}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50"
              style={{ background: FD_BLUE }}
            >
              <Check size={12} /> Review &amp; book visit
            </button>
            <button
              onClick={handleReject}
              disabled={working}
              className="px-4 py-2 text-red-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.30)' }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tab, agentFilter, isFirstTime }) {
  const agentName = FILTER_TABS.find(t => t.key === agentFilter)?.label ?? 'your agents';
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${FD_BLUE}22`, border: `1px solid ${FD_BLUE}40` }}>
        {tab === 'pending' ? <Clock size={22} style={{ color: FD_SKY }} /> : <Eye size={22} style={{ color: FD_SKY }} />}
      </div>
      <p className="text-sm font-bold text-white mb-1">
        {tab === 'pending' ? 'Nothing on your desk' : 'No activity yet'}
      </p>
      <p className="text-xs max-w-xs" style={{ color: ON_DARK.muted }}>
        {tab === 'pending'
          ? `Your Front Desk staff are handling things. When ${agentName} needs your input, it'll appear here.`
          : `Once your agents start taking actions — quotes, review requests, reminders — the full history appears here.`}
      </p>
      {isFirstTime && tab === 'pending' && (
        <div className="mt-5 px-4 py-3 rounded-xl max-w-xs text-left" style={fdCard({ radius: 12 })}>
          <p className="text-xs font-black text-white mb-1">Getting started</p>
          <p className="text-xs mb-2" style={{ color: ON_DARK.muted }}>Front Desk handles enquiries from your website. Add the chat widget to your site to start receiving messages.</p>
          <Link to="/front-desk/sales-manager/setup" className="text-xs font-bold hover:underline" style={{ color: FD_SKY }}>Set up your chat widget →</Link>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const businessId = useBusinessId();
  const fdUsage    = useFrontDeskUsage();
  const [tab,         setTab]         = useState('pending');
  const [agentFilter, setAgentFilter] = useState(null); // null = all
  const [pending,     setPending]     = useState([]);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [waitingChats, setWaitingChats] = useState(0);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);

    const SELECT = `
      id, agent, action_type, status, proposed_payload, reasoning,
      created_at, sent_at, approved_at, expires_at,
      customers ( name )
    `;

    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ data: pendingData }, { data: historyData }, { count: chatCount }] = await Promise.all([
        supabase.from('agent_actions').select(SELECT)
          .eq('business_id', businessId)
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('agent_actions').select(SELECT)
          .eq('business_id', businessId)
          .neq('status', 'pending_approval')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('business_id', businessId)
          .eq('channel', 'web_chat')
          .gte('last_message_at', cutoff),
      ]);

      setPending(pendingData ?? []);
      setHistory(historyData ?? []);
      setWaitingChats(chatCount ?? 0);
    } catch (e) {
      console.error('Inbox load error:', e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  const filterItems = (items) => {
    if (!agentFilter) return items;
    const allowed = FILTER_TABS.find(t => t.key === agentFilter)?.agents ?? [agentFilter];
    return items.filter(a => allowed.includes(a.agent));
  };

  const allItems     = tab === 'pending' ? pending : history;
  const items        = filterItems(allItems);

  // Count pending per agent filter for badges
  const pendingCount = (key) => {
    if (!key) return pending.length;
    const allowed = FILTER_TABS.find(t => t.key === key)?.agents ?? [key];
    return pending.filter(a => allowed.includes(a.agent)).length;
  };

  const sentTodayCount = history.filter(a => {
    if (!a.sent_at && !a.approved_at) return false;
    const t = new Date(a.sent_at || a.approved_at).getTime();
    return Date.now() - t < 86_400_000;
  }).length;

  return (
    <div style={fdCanvas()} className="-mx-4 md:-mx-8 -mt-6 -mb-24 md:-mb-6">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Front Desk hero header */}
        <div className="rounded-2xl overflow-hidden mb-6" style={fdCard({ radius: 20 })}>
          <div className="px-6 py-5 relative" style={{ background: 'linear-gradient(135deg, #010a4f 0%, #1f48ff 100%)' }}>
            <button
              onClick={load}
              aria-label="Refresh"
              className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <div className="flex items-start gap-4 pr-10">
              <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                <InboxIcon size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#99c5ff]/70 mb-1">Front Desk · Inbox</p>
                <h1 className="text-xl font-black text-white">Your AI staff</h1>
                <p className="text-sm text-white/60 mt-1">
                  Items your agents need your input on, plus a live history of what they've done.
                </p>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-3 divide-x" style={{ borderTop: `1px solid ${ON_DARK.line}`, borderColor: 'rgba(79,120,255,0.10)' }}>
            <div className="px-5 py-4 text-center">
              <p className="text-2xl font-black" style={{ color: pending.length > 0 ? FD_GOLD : '#ffffff' }}>{pending.length}</p>
              <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Needs approval</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-2xl font-black text-white">{sentTodayCount}</p>
              <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Sent today</p>
            </div>
            <div className="px-5 py-4 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-sm font-bold text-emerald-300">Active</p>
              </div>
              <p className="text-[10px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: ON_DARK.faint }}>Status</p>
            </div>
          </div>
        </div>

        {/* Agent roster */}
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-widest mb-2.5 px-1" style={{ color: ON_DARK.faint }}>Your agents</p>
          <div className="grid grid-cols-1 gap-2.5">
            {AGENT_ROSTER.map(agent => <AgentRosterCard key={agent.path} agent={agent} />)}
          </div>
        </div>

        {/* Waiting chats banner */}
        {waitingChats > 0 && (
          <div className="mb-5 rounded-xl px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)', border: `1px solid ${FD_BLUE}4d` }}>
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#99c5ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4f78ff]" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">
                  {waitingChats} visitor{waitingChats !== 1 ? 's' : ''} chatted in the last 24 hours
                </p>
                <p className="text-xs mt-0.5" style={{ color: ON_DARK.muted }}>
                  Their details are captured — check your Sales Manager inbox below
                </p>
              </div>
            </div>
            <MessageSquare size={18} className="text-[#4f78ff] shrink-0" />
          </div>
        )}

        {/* Front Desk usage bar — free users only */}
        {!fdUsage.isPro && !fdUsage.loading && (
          <div
            className="mb-5 rounded-xl px-4 py-3"
            style={
              fdUsage.isAtLimit
                ? { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.30)' }
                : fdUsage.isNearLimit
                ? { background: FD_GOLD_SOFT, border: `1px solid ${FD_GOLD_BORDER}` }
                : fdCard({ radius: 12 })
            }
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold" style={{ color: fdUsage.isAtLimit ? '#f87171' : fdUsage.isNearLimit ? FD_GOLD : '#ffffff' }}>
                {fdUsage.isAtLimit
                  ? 'Monthly limit reached — new actions paused until next month'
                  : `${fdUsage.used} of ${fdUsage.limit} Front Desk actions used this month`}
              </span>
              <Link to="/upgrade" className="text-xs font-bold hover:underline shrink-0 ml-3" style={{ color: FD_SKY }}>
                Upgrade for unlimited →
              </Link>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((fdUsage.used / fdUsage.limit) * 100, 100)}%`,
                  background: fdUsage.isAtLimit ? '#f87171' : fdUsage.isNearLimit ? FD_GOLD : FD_BLUE,
                }}
              />
            </div>
          </div>
        )}

        {/* Pending / History tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl mb-3" style={fdCard({ radius: 14 })}>
          <button
            onClick={() => setTab('pending')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={tab === 'pending' ? { background: FD_BLUE, color: '#ffffff' } : { color: ON_DARK.muted }}
          >
            <Clock size={14} />
            Needs approval
            {pending.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black" style={{ background: FD_GOLD, color: '#010a4f' }}>
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={tab === 'history' ? { background: FD_BLUE, color: '#ffffff' } : { color: ON_DARK.muted }}
          >
            <Eye size={14} />
            History
          </button>
        </div>

        {/* Agent filter tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {FILTER_TABS.map(({ key, label, accent }) => {
            const count = pendingCount(key);
            const active = agentFilter === key;
            return (
              <button
                key={String(key)}
                onClick={() => setAgentFilter(key)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={active
                  ? { backgroundColor: accent, color: '#ffffff' }
                  : { background: 'rgba(255,255,255,0.05)', border: `1px solid ${ON_DARK.lineHi}`, color: ON_DARK.muted }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : accent }}
                />
                {label}
                {count > 0 && tab === 'pending' && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                    style={active ? { background: 'rgba(255,255,255,0.25)', color: '#ffffff' } : { background: FD_GOLD_SOFT, color: FD_GOLD }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={fdCard({ radius: 16 })} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} agentFilter={agentFilter} isFirstTime={!loading && pending.length === 0 && history.length === 0} />
        ) : (
          <div className="space-y-3">
            {items.map(action => (
              action.action_type === 'site_visit_request'
                ? <SiteVisitCard key={action.id} action={action} onRefresh={load} />
                : <ActionCard    key={action.id} action={action} onRefresh={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
