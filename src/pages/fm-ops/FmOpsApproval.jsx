import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  MapPin,
  Camera,
  Loader2,
  X,
  ThumbsUp,
  MessageCircleQuestion,
  ShieldX,
  Clock,
  ChevronRight,
  UserCheck,
  UserX,
  Send,
} from 'lucide-react';
import {
  listJobsForApproval,
  getJobApprovalDetail,
  approveJob,
  postJobMessage,
  TIER_LABEL,
  TIER_COLOR,
} from '../../lib/db/fmOpsDb';
import { blueCanvas, glassDark, greenButton, ON_DARK, FM_POP as POP } from '../../lib/connectTheme';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'queried', label: 'Queried' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

const FREQ_LABEL = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  one_off: 'One-off',
};

const DRAWER_BG = 'linear-gradient(180deg, #071041 0%, #030925 100%)';

const APPROVAL_POP = {
  pending: POP.orange,
  approved: POP.green,
  queried: POP.blue,
  rejected: POP.red,
};

function TierBadge({ tier }) {
  if (!tier) return null;
  const colour = TIER_COLOR[tier] || 'rgba(255,255,255,0.45)';
  const hex = colour.startsWith('#');
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: colour,
        background: hex ? `${colour}22` : 'rgba(255,255,255,0.08)',
        border: `1px solid ${hex ? `${colour}45` : 'rgba(255,255,255,0.16)'}`,
        padding: '2px 7px',
        borderRadius: 999,
      }}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}

function ApprovalPill({ status }) {
  const map = {
    pending: { label: 'Pending review' },
    approved: { label: 'Approved' },
    queried: { label: 'Queried' },
    rejected: { label: 'Rejected' },
  };
  const m = map[status] || { label: status };
  const c = APPROVAL_POP[status] || 'rgba(255,255,255,0.55)';
  const hex = c.startsWith('#');
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: c,
        background: hex ? `${c}1f` : 'rgba(255,255,255,0.08)',
        border: `1px solid ${hex ? `${c}42` : 'rgba(255,255,255,0.16)'}`,
        padding: '3px 9px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

function Kpi({ label, value, pop }) {
  return (
    <div style={{ ...glassDark({ radius: 14, padding: '13px 15px' }) }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || ON_DARK.primary, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

const sectionLabel = {
  fontSize: 10,
  fontWeight: 800,
  color: ON_DARK.muted,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};
const darkInput = {
  padding: '10px 12px',
  fontSize: 13,
  border: `1px solid ${ON_DARK.lineHi}`,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.08)',
  color: ON_DARK.primary,
  outline: 'none',
  fontFamily: 'inherit',
  resize: 'vertical',
  colorScheme: 'dark',
};

// ─── Detail drawer ───────────────────────────────────────────────────────────
function ApprovalDrawer({ jobId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'approved' | 'queried' | 'rejected' | 'message'
  const [note, setNote] = useState('');
  const [threadReply, setThreadReply] = useState('');
  const [ratingStars, setRatingStars] = useState(0); // 0 = not rated
  const [ratingComment, setRatingComment] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getJobApprovalDetail(jobId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when jobId changes; load() is redefined each render
  useEffect(() => {
    load();
  }, [jobId]);

  const decide = async (decision) => {
    if ((decision === 'queried' || decision === 'rejected') && !note.trim()) {
      setError('A note is required when querying or rejecting.');
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      // Rating is only meaningful on approve; harmless on the wire otherwise
      // because the function ignores it for query/reject decisions.
      const { ok, data } = await approveJob({
        jobId,
        decision,
        note: note.trim() || null,
        ratingStars: decision === 'approved' && ratingStars > 0 ? ratingStars : null,
        ratingComment: decision === 'approved' ? ratingComment.trim() || null : null,
      });
      if (!ok) throw new Error(data?.error || 'Update failed');
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const sendReply = async () => {
    if (!threadReply.trim()) return;
    setBusy('message');
    setError(null);
    try {
      const { ok, data } = await postJobMessage({ jobId, body: threadReply.trim() });
      if (!ok) throw new Error(data?.error || 'Could not send message');
      setThreadReply('');
      await load(); // refresh thread
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const checkin =
    detail?.checkins?.find((c) => c.action === 'checkin' || c.action === 'in') ??
    detail?.checkins?.[0];
  const checkout =
    detail?.checkins?.find((c) => c.action === 'checkout' || c.action === 'out') ??
    detail?.checkins?.[detail.checkins.length - 1];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,4,25,0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: '94vw',
          background: DRAWER_BG,
          borderLeft: `1px solid ${ON_DARK.lineHi}`,
          padding: '24px 28px',
          overflowY: 'auto',
          boxShadow: '-16px 0 60px rgba(0,0,0,0.55)',
        }}
      >
        {loading && (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              fontSize: 12,
              color: ON_DARK.muted,
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color={ON_DARK.secondary}
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />{' '}
            Loading job…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && (!detail || error) && !detail?.id && (
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              fontSize: 13,
              background: 'rgba(220,38,38,0.16)',
              border: '1px solid rgba(248,113,113,0.40)',
              color: '#fecaca',
            }}
          >
            {error || 'Job not found.'}
          </div>
        )}
        {!loading && detail && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 14,
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <ApprovalPill status={detail.approval_status} />
                  {detail.contract?.name && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: ON_DARK.secondary,
                        background: 'rgba(255,255,255,0.08)',
                        border: `1px solid ${ON_DARK.line}`,
                        padding: '3px 9px',
                        borderRadius: 999,
                      }}
                    >
                      {detail.contract.name}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>
                  {detail.site?.name}
                </div>
                <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 5 }}>
                  <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {detail.site?.postcode}
                  {detail.site?.address ? ` · ${detail.site.address}` : ''}
                </div>
                <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 2 }}>
                  {FREQ_LABEL[detail.visit_spec?.frequency] ?? detail.visit_spec?.frequency} ·{' '}
                  {detail.visit_spec?.scope}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${ON_DARK.line}`,
                  borderRadius: 9,
                  cursor: 'pointer',
                  color: ON_DARK.secondary,
                  padding: 6,
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* KPIs */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <Kpi label="Job value" value={`£${detail.price ?? 0}`} />
              <Kpi
                label="Service date"
                value={detail.date ? new Date(detail.date).toLocaleDateString() : '—'}
                pop={POP.blue}
              />
              <Kpi
                label="Actual duration"
                value={detail.actual_duration_minutes ? `${detail.actual_duration_minutes}m` : '—'}
                pop={POP.blue}
              />
              <Kpi
                label="Completed"
                value={
                  detail.completion_marked_at
                    ? new Date(detail.completion_marked_at).toLocaleDateString()
                    : '—'
                }
                pop={POP.blue}
              />
            </div>

            {/* Sub */}
            <div style={{ ...glassDark({ radius: 14, padding: 14 }), marginBottom: 14 }}>
              <div style={{ ...sectionLabel, marginBottom: 8 }}>Contractor</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(79,120,255,0.20)',
                    color: POP.blue,
                    border: '1px solid rgba(79,120,255,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 900,
                  }}
                >
                  {(detail.subName?.[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>
                    {detail.subName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <TierBadge tier={detail.sub?.connect_tier} />
                    <span style={{ fontSize: 10, color: ON_DARK.muted }}>
                      Score{' '}
                      <strong style={{ color: ON_DARK.primary }}>
                        {detail.sub?.connect_score ?? '—'}
                      </strong>
                    </span>
                    {detail.sub?.connect_region && (
                      <span style={{ fontSize: 10, color: ON_DARK.muted }}>
                        · {detail.sub.connect_region}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Geo-fence trust signals */}
            <div style={{ ...glassDark({ radius: 14, padding: 14 }), marginBottom: 14 }}>
              <div style={{ ...sectionLabel, marginBottom: 10 }}>On-site verification</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Check-in', checkin],
                  ['Check-out', checkout],
                ].map(([label, c]) => (
                  <div
                    key={label}
                    style={{
                      background: c
                        ? c.inside_geo_fence
                          ? 'rgba(52,211,153,0.10)'
                          : 'rgba(251,191,36,0.10)'
                        : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${c ? (c.inside_geo_fence ? 'rgba(52,211,153,0.30)' : 'rgba(251,191,36,0.30)') : ON_DARK.line}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ ...sectionLabel, marginBottom: 4 }}>{label}</div>
                    {!c && <div style={{ fontSize: 12, color: ON_DARK.faint }}>— no record</div>}
                    {c && (
                      <>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 12,
                            fontWeight: 800,
                            color: c.inside_geo_fence ? POP.green : POP.amber,
                          }}
                        >
                          {c.inside_geo_fence ? (
                            <>
                              <CheckCircle2 size={13} /> In fence
                            </>
                          ) : (
                            <>
                              <AlertCircle size={13} /> Outside fence
                            </>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 3 }}>
                          {c.distance_from_site_m != null
                            ? `${Math.round(c.distance_from_site_m)}m from site · `
                            : ''}
                          {c.checked_in_at ? new Date(c.checked_in_at).toLocaleString() : ''}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {detail.completion_method && (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 11,
                    color: ON_DARK.muted,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Clock size={11} /> Completion method ·{' '}
                  <strong style={{ color: ON_DARK.primary }}>
                    {detail.completion_method.replace('_', ' ')}
                  </strong>
                </div>
              )}
            </div>

            {/* Site contact presence — captured at check-out instead of a
                paper signature. customer_on_site lives on the checkout
                job_checkins row; null means the sub never answered. */}
            {(() => {
              const presence = checkout?.customer_on_site;
              const wasPresent = presence === true;
              const wasAbsent = presence === false;
              const colour = wasPresent
                ? POP.green
                : wasAbsent
                  ? POP.amber
                  : 'rgba(255,255,255,0.45)';
              const bg = wasPresent
                ? 'rgba(52,211,153,0.08)'
                : wasAbsent
                  ? 'rgba(251,191,36,0.08)'
                  : 'rgba(255,255,255,0.04)';
              const border = wasPresent
                ? 'rgba(52,211,153,0.30)'
                : wasAbsent
                  ? 'rgba(251,191,36,0.30)'
                  : ON_DARK.line;
              return (
                <div
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ ...sectionLabel, marginBottom: 8 }}>Site contact</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 9,
                        background: colour.startsWith('#')
                          ? `${colour}22`
                          : 'rgba(255,255,255,0.08)',
                        color: colour,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {wasPresent ? <UserCheck size={16} /> : <UserX size={16} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      {wasPresent && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>
                            {checkout?.customer_name?.trim() || 'On site (name not recorded)'}
                          </div>
                          <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                            Witnessed the work at check-out
                          </div>
                        </>
                      )}
                      {wasAbsent && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>
                            No site contact present
                          </div>
                          <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                            GPS + photo evidence stand in for sign-off
                          </div>
                        </>
                      )}
                      {presence == null && (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 700, color: ON_DARK.faint }}>
                            Not recorded
                          </div>
                          <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                            Sub didn't tick a site-contact option at check-out
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Evidence — promoted panel. Photos are the primary acceptance
                proof now that paper signatures are gone, so this gets its own
                emphasis: bold orange border + larger thumbnails. */}
            <div
              style={{
                ...glassDark({ radius: 14, padding: 16, strong: true }),
                border: '1.5px solid rgba(251,146,60,0.55)',
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: POP.orange,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={13} /> Photo evidence
                </div>
                <span style={{ fontSize: 10, color: ON_DARK.muted, fontWeight: 700 }}>
                  {detail.evidence.filter((e) => e.type !== 'note').length} photo
                  {detail.evidence.filter((e) => e.type !== 'note').length === 1 ? '' : 's'}
                </span>
              </div>
              {detail.evidence.filter((e) => e.type !== 'note').length === 0 && (
                <div
                  style={{
                    padding: 18,
                    borderRadius: 10,
                    fontSize: 12,
                    textAlign: 'center',
                    background: 'rgba(251,191,36,0.10)',
                    border: '1px solid rgba(251,191,36,0.30)',
                    color: POP.amber,
                  }}
                >
                  <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  No photo evidence uploaded — review GPS + duration carefully before approving.
                </div>
              )}
              {detail.evidence.filter((e) => e.type !== 'note').length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {detail.evidence
                    .filter((e) => e.type !== 'note')
                    .map((e) => {
                      const url = e.data?.url ?? e.data?.photo_url ?? null;
                      return (
                        <a
                          key={e.id}
                          href={url ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(ev) => {
                            if (!url) ev.preventDefault();
                          }}
                          style={{
                            borderRadius: 10,
                            background: 'rgba(255,255,255,0.06)',
                            border: `1px solid ${ON_DARK.lineHi}`,
                            aspectRatio: '4 / 3',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            cursor: url ? 'pointer' : 'default',
                          }}
                        >
                          {url ? (
                            <img
                              src={url}
                              alt="evidence"
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Camera size={22} color={ON_DARK.faint} />
                          )}
                        </a>
                      );
                    })}
                </div>
              )}
              {detail.evidence
                .filter((e) => e.type === 'note')
                .map((e) => (
                  <div
                    key={e.id}
                    style={{
                      marginTop: 10,
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${ON_DARK.line}`,
                      borderRadius: 10,
                      fontSize: 12,
                      color: ON_DARK.secondary,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: ON_DARK.muted,
                        marginBottom: 4,
                      }}
                    >
                      Sub's note
                    </div>
                    {e.data?.text ?? ''}
                  </div>
                ))}
            </div>

            {/* Query thread — shown whenever a query has ever been raised on
                this job (query_note set) OR any messages exist. Lets FM and
                sub keep talking until resolved. */}
            {(detail.query_note || detail.messages?.length > 0) && (
              <div style={{ ...glassDark({ radius: 14, padding: 14 }), marginBottom: 14 }}>
                <div
                  style={{
                    ...sectionLabel,
                    marginBottom: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MessageCircleQuestion size={11} /> Query thread
                </div>

                {detail.query_note && (
                  <div
                    style={{
                      background: 'rgba(79,120,255,0.12)',
                      border: '1px solid rgba(79,120,255,0.30)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      color: ON_DARK.primary,
                      marginBottom: 10,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: POP.blue,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        marginBottom: 4,
                      }}
                    >
                      Original query
                    </div>
                    {detail.query_note}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {(detail.messages ?? []).map((m) => {
                    const mine = m.author_role === 'fm';
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: mine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '78%',
                            padding: '8px 11px',
                            borderRadius: 12,
                            background: mine
                              ? 'linear-gradient(180deg, #d64510 0%, #C2410C 100%)'
                              : 'rgba(255,255,255,0.08)',
                            border: mine
                              ? '1px solid rgba(255,255,255,0.15)'
                              : `1px solid ${ON_DARK.line}`,
                            color: mine ? 'white' : ON_DARK.primary,
                            fontSize: 12,
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {m.body}
                          <div style={{ fontSize: 9, opacity: 0.75, marginTop: 4 }}>
                            {mine ? 'You' : 'Contractor'} ·{' '}
                            {new Date(m.created_at).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {(!detail.messages || detail.messages.length === 0) && detail.query_note && (
                    <div
                      style={{
                        fontSize: 11,
                        color: ON_DARK.faint,
                        fontStyle: 'italic',
                        padding: '4px 0',
                      }}
                    >
                      Waiting for the contractor's response.
                    </div>
                  )}
                </div>

                {/* Reply box — works at any approval state so FM can keep talking */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <textarea
                    value={threadReply}
                    onChange={(e) => setThreadReply(e.target.value)}
                    rows={2}
                    placeholder="Reply to the contractor…"
                    style={{ ...darkInput, flex: 1, fontSize: 12, boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!threadReply.trim() || busy === 'message'}
                    style={{
                      width: 84,
                      background: threadReply.trim()
                        ? 'linear-gradient(180deg, #d64510 0%, #C2410C 100%)'
                        : 'rgba(255,255,255,0.10)',
                      color: threadReply.trim() ? 'white' : ON_DARK.faint,
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: threadReply.trim() ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    {busy === 'message' ? (
                      <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    ) : (
                      <>
                        <Send size={12} /> Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {detail.rejection_note && (
              <div
                style={{
                  background: 'rgba(220,38,38,0.14)',
                  border: '1px solid rgba(248,113,113,0.40)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 14,
                  fontSize: 12,
                  color: '#fecaca',
                }}
              >
                <strong>Previously rejected:</strong> {detail.rejection_note}
              </div>
            )}

            {/* Decision */}
            {detail.approval_status === 'pending' || detail.approval_status === 'queried' ? (
              <>
                {/* Optional star rating — only applies to Approve. Feeds
                    the sub's public profile + the Cadi Score (15 pts). */}
                <div
                  style={{
                    background: 'rgba(251,146,60,0.08)',
                    border: '1px solid rgba(251,146,60,0.30)',
                    borderRadius: 12,
                    padding: '10px 12px',
                    marginBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <div style={sectionLabel}>
                      Rate this job{' '}
                      <span
                        style={{
                          color: ON_DARK.faint,
                          fontWeight: 700,
                          letterSpacing: 0,
                          textTransform: 'none',
                        }}
                      >
                        · optional, applies on Approve
                      </span>
                    </div>
                    {ratingStars > 0 && (
                      <button
                        onClick={() => {
                          setRatingStars(0);
                          setRatingComment('');
                        }}
                        style={{
                          fontSize: 10,
                          color: ON_DARK.muted,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 3, marginBottom: ratingStars > 0 ? 8 : 0 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRatingStars(ratingStars === n ? 0 : n)}
                        aria-label={`${n} star${n === 1 ? '' : 's'}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          fontSize: 26,
                          lineHeight: 1,
                          color: n <= ratingStars ? POP.amber : 'rgba(255,255,255,0.18)',
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  {ratingStars > 0 && (
                    <textarea
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="Optional comment — visible to the sub on their profile."
                      style={{ ...darkInput, width: '100%', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  )}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ ...sectionLabel, marginBottom: 6 }}>
                    Note (required for Query / Reject)
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Optional for Approve — required if querying or rejecting."
                    rows={3}
                    style={{ ...darkInput, width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
                {error && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      marginBottom: 12,
                      fontSize: 12,
                      background: 'rgba(220,38,38,0.16)',
                      border: '1px solid rgba(248,113,113,0.40)',
                      color: '#fecaca',
                    }}
                  >
                    {error}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => decide('approved')}
                    disabled={!!busy}
                    style={{
                      ...greenButton(),
                      padding: '10px 12px',
                      fontSize: 12,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy === 'approved' ? 0.7 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {busy === 'approved' && (
                      <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    )}
                    <ThumbsUp size={12} /> Approve
                  </button>
                  <button
                    onClick={() => decide('queried')}
                    disabled={!!busy}
                    style={{
                      background: 'rgba(79,120,255,0.14)',
                      color: POP.blue,
                      border: '1px solid rgba(79,120,255,0.40)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {busy === 'queried' && (
                      <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    )}
                    <MessageCircleQuestion size={12} /> Query
                  </button>
                  <button
                    onClick={() => decide('rejected')}
                    disabled={!!busy}
                    style={{
                      background: 'rgba(220,38,38,0.14)',
                      color: POP.red,
                      border: '1px solid rgba(248,113,113,0.40)',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {busy === 'rejected' && (
                      <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
                    )}
                    <ShieldX size={12} /> Reject
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: 12,
                  background:
                    detail.approval_status === 'approved'
                      ? 'rgba(52,211,153,0.12)'
                      : 'rgba(220,38,38,0.14)',
                  border: `1px solid ${detail.approval_status === 'approved' ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.40)'}`,
                  borderRadius: 12,
                  fontSize: 12,
                  color: detail.approval_status === 'approved' ? POP.green : '#fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {detail.approval_status === 'approved' ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <ShieldX size={14} />
                )}
                <span>
                  Already {detail.approval_status}
                  {detail.approved_at
                    ? ` on ${new Date(detail.approved_at).toLocaleDateString()}`
                    : ''}
                  . Read-only.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function FmOpsApproval() {
  const [tab, setTab] = useState('pending');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [counts, setCounts] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listJobsForApproval({ filter: tab });
      setJobs(rows);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Counts for tabs (pull all once on mount)
  useEffect(() => {
    (async () => {
      try {
        const all = await listJobsForApproval({ filter: 'all' });
        const c = { pending: 0, queried: 0, approved: 0, rejected: 0, all: all.length };
        all.forEach((j) => {
          if (c[j.approval_status] != null) c[j.approval_status]++;
        });
        setCounts(c);
      } catch {}
    })();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when tab changes; load() is redefined each render
  useEffect(() => {
    load();
  }, [tab]);

  const totals = useMemo(() => {
    const total = jobs.reduce((a, j) => a + (Number(j.price) || 0), 0);
    return { count: jobs.length, total };
  }, [jobs]);

  return (
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: 'rgba(251,146,60,0.20)',
                color: POP.orange,
                border: '1px solid rgba(251,146,60,0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={17} />
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ON_DARK.muted,
              }}
            >
              FM Operations · Work approval
            </div>
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: ON_DARK.primary,
              margin: 0,
            }}
          >
            Sign off <span style={{ color: POP.orange }}>completed work</span>
          </h1>
          <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6, maxWidth: 620 }}>
            Completed jobs awaiting sign-off. Approve drafts the sub's invoice; query or reject
            sends it back with a note.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Kpi
            label="Awaiting your review"
            value={counts.pending ?? 0}
            pop={counts.pending ? POP.orange : ON_DARK.faint}
          />
          <Kpi
            label={`In ${TABS.find((t) => t.id === tab)?.label.toLowerCase()}`}
            value={totals.count}
          />
          <Kpi label="Value in view" value={`£${totals.total.toFixed(0)}`} pop={POP.blue} />
        </div>

        <div
          style={{
            ...glassDark({ radius: 12 }),
            display: 'flex',
            gap: 4,
            padding: 4,
            marginBottom: 18,
            width: 'fit-content',
          }}
        >
          {TABS.map((t) => {
            const count = counts[t.id];
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 11px',
                  borderRadius: 9,
                  background: active ? 'rgba(251,146,60,0.22)' : 'transparent',
                  color: active ? '#fff' : ON_DARK.muted,
                  border: active ? '1px solid rgba(251,146,60,0.40)' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'background 150ms ease, color 150ms ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      background: active ? POP.orange : 'rgba(255,255,255,0.10)',
                      color: active ? '#01120b' : ON_DARK.secondary,
                      padding: '1px 6px',
                      borderRadius: 999,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading && (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              fontSize: 12,
              color: ON_DARK.muted,
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color={ON_DARK.secondary}
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 10px',
              }}
            />{' '}
            Loading jobs…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 18,
              borderRadius: 14,
              fontSize: 13,
              background: 'rgba(220,38,38,0.16)',
              border: '1px solid rgba(248,113,113,0.40)',
              color: '#fecaca',
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && jobs.length === 0 && (
          <div
            style={{
              padding: '44px 24px',
              borderRadius: 18,
              border: '1.5px dashed rgba(255,255,255,0.16)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(52,211,153,0.14)',
                color: POP.green,
                border: '1px solid rgba(52,211,153,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>
              Nothing to review
            </div>
            <div
              style={{
                fontSize: 12,
                color: ON_DARK.muted,
                maxWidth: 400,
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              {tab === 'pending'
                ? 'Completed jobs from your subs land here for sign-off.'
                : 'No jobs in this state.'}
            </div>
          </div>
        )}

        {!loading && !error && jobs.length > 0 && (
          <div style={{ ...glassDark({ radius: 18 }), overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 40px',
                padding: '11px 18px',
                background: 'rgba(255,255,255,0.04)',
                borderBottom: `1px solid ${ON_DARK.line}`,
                fontSize: 10,
                fontWeight: 800,
                color: ON_DARK.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              <div>Site</div>
              <div>Contractor</div>
              <div>Completed</div>
              <div>Value</div>
              <div>Status</div>
              <div></div>
            </div>
            {jobs.map((j, i) => (
              <div
                key={j.id}
                onClick={() => setOpenId(j.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 40px',
                  padding: '14px 18px',
                  borderBottom: i < jobs.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                  alignItems: 'center',
                  fontSize: 12,
                  color: ON_DARK.primary,
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {j.site?.name ?? 'Site'}
                  </div>
                  <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                    {j.site?.postcode ?? ''}
                    {j.visit_spec?.scope ? ` · ${j.visit_spec.scope}` : ''}
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {j.subName}
                  </div>
                  {j.sub?.connect_score != null && (
                    <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                      Score {j.sub.connect_score}
                    </div>
                  )}
                </div>
                <div style={{ color: ON_DARK.secondary }}>
                  {j.completion_marked_at
                    ? new Date(j.completion_marked_at).toLocaleDateString()
                    : '—'}
                </div>
                <div style={{ fontWeight: 800 }}>£{j.price ?? 0}</div>
                <div>
                  <ApprovalPill status={j.approval_status} />
                </div>
                <ChevronRight size={14} color={ON_DARK.faint} />
              </div>
            ))}
          </div>
        )}

        {openId && (
          <ApprovalDrawer
            jobId={openId}
            onClose={() => setOpenId(null)}
            onChanged={() => {
              load();
              // refresh counts
              listJobsForApproval({ filter: 'all' })
                .then((all) => {
                  const c = { pending: 0, queried: 0, approved: 0, rejected: 0, all: all.length };
                  all.forEach((j) => {
                    if (c[j.approval_status] != null) c[j.approval_status]++;
                  });
                  setCounts(c);
                })
                .catch(() => {});
            }}
          />
        )}
      </div>
    </div>
  );
}
