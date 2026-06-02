import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useBusinessId } from '../hooks/useBusinessId';
import { useFrontDeskUsage } from '../hooks/useFrontDeskUsage';
import { approveAgentAction, rejectAgentAction, AGENTS } from '../lib/agentFramework';
import {
  Check, X, Clock, Send, AlertTriangle, Inbox,
  MessageSquare, Star, CalendarDays, CalendarClock, ChevronDown, ChevronRight,
  RefreshCw, Eye, MapPin, Phone, Mail, Building2, Wrench, Tag, Repeat, Timer
} from 'lucide-react';

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

const STATUS_CONFIG = {
  pending_approval: { label: 'Needs approval', color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200', dot: 'bg-amber-400' },
  approved:         { label: 'Approved',        color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200', dot: 'bg-green-400' },
  rejected:         { label: 'Rejected',        color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-400'   },
  sent:             { label: 'Sent',            color: 'text-[#1f48ff]',  bg: 'bg-[#f0f4ff]', border: 'border-[#1f48ff]/20', dot: 'bg-[#1f48ff]' },
  auto_sent:        { label: 'Auto-sent',       color: 'text-[#1f48ff]',  bg: 'bg-[#f0f4ff]', border: 'border-[#1f48ff]/20', dot: 'bg-[#99c5ff]' },
  failed:           { label: 'Failed',          color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200',   dot: 'bg-red-400'   },
  superseded:       { label: 'Superseded',      color: 'text-gray-400',   bg: 'bg-gray-50',   border: 'border-gray-200',  dot: 'bg-gray-300'  },
};

// Maps agent DB key → display config (includes legacy keys for old rows)
const AGENT_CONFIG = {
  sales_manager:      { label: 'Sales Manager',      icon: MessageSquare,  accent: '#3b5bdb' },
  front_desk:         { label: 'Sales Manager',      icon: MessageSquare,  accent: '#3b5bdb' },
  review_agent:       { label: 'Review Agent',        icon: Star,           accent: '#059669' },
  reviews:            { label: 'Review Agent',        icon: Star,           accent: '#059669' },
  operations_manager: { label: 'Operations Manager',  icon: CalendarClock,  accent: '#C2410C' },
  scheduler:          { label: 'Scheduler',           icon: CalendarDays,   accent: '#7c3aed' },
};

// Filter tabs — null means "all"
const FILTER_TABS = [
  { key: null,                label: 'All' },
  { key: 'sales_manager',     label: 'Sales Manager',     agents: ['sales_manager', 'front_desk'] },
  { key: 'review_agent',      label: 'Review Agent',       agents: ['review_agent', 'reviews'] },
  { key: 'operations_manager',label: 'Operations Manager', agents: ['operations_manager'] },
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
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isPending ? 'border-amber-200 bg-amber-50/50' : 'border-[#99c5ff]/20 bg-white'
    }`}>
      {/* Header row */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        {/* Agent badge */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: cfg.accent + '18' }}>
          <AgentIcon size={15} style={{ color: cfg.accent }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md"
              style={{ backgroundColor: cfg.accent + '18', color: cfg.accent }}>
              {agentLabel}
            </span>
            <span className="text-xs text-gray-600">{actionLabel}</span>
            {action.customers?.name && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs font-medium text-[#010a4f]">
                  {action.customers.name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${st.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            <span className="text-[10px] text-gray-400">{timeAgo(action.created_at)}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Preview — first line of message */}
      {!expanded && payload.message && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-gray-500 truncate">{payload.message}</p>
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-3">
          {payload.message && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Proposed message</p>
              <div className="bg-white rounded-xl border border-[#99c5ff]/20 px-3 py-2.5 text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                {payload.message}
              </div>
            </div>
          )}
          {payload.subject && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-xs text-gray-600">{payload.subject}</p>
            </div>
          )}
          {payload.channel && (
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Channel</p>
              <span className="text-xs text-gray-600 capitalize">{payload.channel}</span>
            </div>
          )}
          {action.reasoning && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Why Cadi chose this</p>
              <p className="text-xs text-gray-500 italic">{action.reasoning}</p>
            </div>
          )}
        </div>
      )}

      {/* Approval buttons */}
      {isPending && (
        <div className="px-4 pb-4 space-y-2">
          {cardError && (
            <p className="text-xs text-red-500 font-medium">{cardError}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleApprove}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50"
            >
              <Check size={12} />
              Approve & send
            </button>
            <button
              onClick={handleReject}
              disabled={working}
              className="px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

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

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isPending ? 'border-[#1D1B8E]/25 bg-[#f5f7ff]' : 'border-[#99c5ff]/20 bg-white'
    }`}>
      {/* Header */}
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#1D1B8E]/10">
          <MapPin size={15} className="text-[#1D1B8E]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#1D1B8E]/10 text-[#1D1B8E]">
              Mackies Website
            </span>
            <span className="text-xs text-gray-600">Site visit request</span>
            {p.name && (
              <>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs font-medium text-[#010a4f]">
                  {p.name}{p.company ? ` — ${p.company}` : ''}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${st.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            <span className="text-[10px] text-gray-400">{timeAgo(action.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div className="border-t border-gray-100 px-4 py-3 grid grid-cols-1 gap-2">
        {(p.phone || p.email) && (
          <div className="flex items-start gap-3">
            <Phone size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-700 space-y-0.5">
              {p.phone && <a href={`tel:${p.phone}`} className="block font-medium text-[#1D1B8E] hover:underline">{p.phone}</a>}
              {p.email && <a href={`mailto:${p.email}`} className="block text-gray-500 hover:underline">{p.email}</a>}
            </div>
          </div>
        )}
        {(p.mode || p.sector_label || p.premises_type) && (
          <div className="flex items-start gap-3">
            <Building2 size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700">
              {[
                p.mode ? p.mode.charAt(0).toUpperCase() + p.mode.slice(1) : null,
                p.premises_type ? p.premises_type.charAt(0).toUpperCase() + p.premises_type.slice(1) : null,
                p.sector_label,
              ].filter(Boolean).join(' · ')}
              {p.role ? <span className="text-gray-400"> — {p.role}</span> : null}
            </span>
          </div>
        )}
        {(p.service_labels?.length > 0 || p.clean_type || p.services?.length > 0) && (
          <div className="flex items-start gap-3">
            <Wrench size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700">
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
            <Repeat size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700 capitalize">{p.frequency}</span>
          </div>
        )}
        {p.timeline && (
          <div className="flex items-start gap-3">
            <Timer size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700 capitalize">{p.timeline}</span>
          </div>
        )}
        {(p.address || p.postcode) && (
          <div className="flex items-start gap-3">
            <MapPin size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700">{p.address || p.postcode}</span>
          </div>
        )}
        {p.access_notes && (
          <div className="flex items-start gap-3">
            <Tag size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700">{p.access_notes}</span>
          </div>
        )}
        {(p.bedrooms || p.size || p.situation) && (
          <div className="flex items-start gap-3">
            <Tag size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-gray-700">
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
        <div className="border-t border-[#1D1B8E]/10 px-4 py-3 bg-white space-y-3">
          <p className="text-[10px] font-black text-[#1D1B8E] uppercase tracking-wider">Add to schedule</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Date</label>
              <input
                type="date"
                value={visitDate}
                onChange={e => setVisitDate(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1D1B8E]/50"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block mb-1">Time</label>
              <input
                type="time"
                value={visitTime}
                onChange={e => setVisitTime(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#1D1B8E]/50"
              />
            </div>
          </div>
          <textarea
            value={visitNote}
            onChange={e => setVisitNote(e.target.value)}
            placeholder="Notes — e.g. access details, what to bring, anything agreed on the call…"
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 resize-none focus:outline-none focus:border-[#1D1B8E]/50"
          />
          {cardError && <p className="text-xs text-red-500 font-medium">{cardError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={working}
              className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1D1B8E] hover:bg-[#2E6EF7] text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50"
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
          {cardError && <p className="text-xs text-red-500 font-medium">{cardError}</p>}
        <div className="flex gap-2">
          {p.phone && (
            <a
              href={`tel:${p.phone}`}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-[#1D1B8E]/20 text-[#1D1B8E] text-xs font-bold rounded-xl hover:bg-[#f0f4ff] transition-colors"
            >
              <Phone size={12} /> Call
            </a>
          )}
          <button
            onClick={() => setConfirming(true)}
            disabled={working}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#1D1B8E] hover:bg-[#2E6EF7] text-white text-xs font-black rounded-xl transition-colors disabled:opacity-50"
          >
            <Check size={12} /> Review &amp; book visit
          </button>
          <button
            onClick={handleReject}
            disabled={working}
            className="px-4 py-2 bg-white border border-red-200 text-red-500 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
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
      <div className="w-14 h-14 rounded-2xl bg-[#f0f4ff] flex items-center justify-center mb-4">
        {tab === 'pending' ? <Clock size={22} className="text-[#1f48ff]" /> : <Eye size={22} className="text-[#1f48ff]" />}
      </div>
      <p className="text-sm font-bold text-[#010a4f] mb-1">
        {tab === 'pending' ? 'Nothing on your desk' : 'No activity yet'}
      </p>
      <p className="text-xs text-gray-400 max-w-xs">
        {tab === 'pending'
          ? `Your Front Desk staff are handling things. When ${agentName} needs your input, it'll appear here.`
          : `Once your agents start taking actions — quotes, review requests, reminders — the full history appears here.`}
      </p>
      {isFirstTime && tab === 'pending' && (
        <div className="mt-5 px-4 py-3 rounded-xl bg-[#f0f4ff] border border-[#99c5ff]/30 max-w-xs text-left">
          <p className="text-xs font-black text-[#010a4f] mb-1">Getting started</p>
          <p className="text-xs text-gray-500 mb-2">Front Desk handles enquiries from your website. Add the chat widget to your site to start receiving messages.</p>
          <Link to="/front-desk/widget" className="text-xs font-bold text-[#1f48ff] hover:underline">Set up your chat widget →</Link>
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

  return (
    <div className="min-h-screen bg-[#f5f7ff]">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#010a4f]">Front Desk</h1>
            <p className="text-sm text-gray-500 mt-0.5">Items from your AI staff that need your input</p>
          </div>
          <button
            onClick={load}
            className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-[#99c5ff]/20 text-gray-400 hover:text-[#1f48ff] transition-all"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Waiting chats banner */}
        {waitingChats > 0 && (
          <div className="mb-5 rounded-xl border border-[#1f48ff]/30 px-4 py-3 flex items-center justify-between gap-3"
            style={{ background: 'linear-gradient(135deg, #010a4f 0%, #0d1e78 100%)' }}>
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#99c5ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4f78ff]" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">
                  {waitingChats} visitor{waitingChats !== 1 ? 's' : ''} chatted in the last 24 hours
                </p>
                <p className="text-xs text-[rgba(153,197,255,0.6)] mt-0.5">
                  Their details are captured — check your Sales Manager inbox below
                </p>
              </div>
            </div>
            <MessageSquare size={18} className="text-[#4f78ff] shrink-0" />
          </div>
        )}

        {/* Front Desk usage bar — free users only */}
        {!fdUsage.isPro && !fdUsage.loading && (
          <div className={`mb-5 rounded-xl border px-4 py-3 ${
            fdUsage.isAtLimit
              ? 'bg-red-50 border-red-200'
              : fdUsage.isNearLimit
              ? 'bg-amber-50 border-amber-200'
              : 'bg-white border-[#99c5ff]/20'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-bold ${
                fdUsage.isAtLimit ? 'text-red-600' : fdUsage.isNearLimit ? 'text-amber-700' : 'text-[#010a4f]'
              }`}>
                {fdUsage.isAtLimit
                  ? 'Monthly limit reached — new actions paused until next month'
                  : `${fdUsage.used} of ${fdUsage.limit} Front Desk actions used this month`}
              </span>
              <Link
                to="/upgrade"
                className="text-xs font-bold text-[#1f48ff] hover:underline shrink-0 ml-3"
              >
                Upgrade for unlimited →
              </Link>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  fdUsage.isAtLimit ? 'bg-red-400' : fdUsage.isNearLimit ? 'bg-amber-400' : 'bg-[#1f48ff]'
                }`}
                style={{ width: `${Math.min((fdUsage.used / fdUsage.limit) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Pending / History tabs */}
        <div className="flex items-center gap-1 p-1 bg-white rounded-xl border border-[#99c5ff]/20 shadow-sm mb-3">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              tab === 'pending' ? 'bg-[#010a4f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={14} />
            Needs approval
            {pending.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                tab === 'pending' ? 'bg-amber-400 text-[#010a4f]' : 'bg-amber-100 text-amber-700'
              }`}>
                {pending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
              tab === 'history' ? 'bg-[#010a4f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye size={14} />
            History
          </button>
        </div>

        {/* Agent filter tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
          {FILTER_TABS.map(({ key, label }) => {
            const count = pendingCount(key);
            const active = agentFilter === key;
            return (
              <button
                key={String(key)}
                onClick={() => setAgentFilter(key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? 'bg-[#010a4f] text-white'
                    : 'bg-white border border-[#99c5ff]/30 text-gray-500 hover:text-[#010a4f] hover:border-[#99c5ff]/60'
                }`}
              >
                {label}
                {count > 0 && tab === 'pending' && (
                  <span className={`px-1 py-0.5 rounded-full text-[9px] font-black ${
                    active ? 'bg-amber-400 text-[#010a4f]' : 'bg-amber-100 text-amber-700'
                  }`}>
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
              <div key={i} className="h-20 rounded-2xl bg-white border border-[#99c5ff]/20 animate-pulse" />
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
