import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2, AlertCircle, MapPin, Camera, Loader2, X,
  ThumbsUp, MessageCircleQuestion, ShieldX, Clock, ChevronRight,
} from 'lucide-react';
import {
  listJobsForApproval,
  getJobApprovalDetail,
  approveJob,
  TIER_LABEL,
  TIER_COLOR,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const TABS = [
  { id: 'pending',  label: 'Pending'  },
  { id: 'queried',  label: 'Queried'  },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all',      label: 'All'      },
];

const FREQ_LABEL = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
  quarterly: 'Quarterly', annual: 'Annual', one_off: 'One-off',
};

function TierBadge({ tier }) {
  if (!tier) return null;
  const colour = TIER_COLOR[tier] || MUTE;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, color: colour,
      background: `${colour}15`, border: `1px solid ${colour}30`,
      padding: '2px 7px', borderRadius: 999,
    }}>{TIER_LABEL[tier] ?? tier}</span>
  );
}

function ApprovalPill({ status }) {
  const map = {
    pending:  { label: 'Pending review', color: '#a16207' },
    approved: { label: 'Approved',       color: GREEN     },
    queried:  { label: 'Queried',        color: '#3b82f6' },
    rejected: { label: 'Rejected',       color: '#b91c1c' },
  };
  const m = map[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

// ─── Detail drawer ───────────────────────────────────────────────────────────
function ApprovalDrawer({ jobId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);    // 'approved' | 'queried' | 'rejected'
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true); setError(null);
    try { setDetail(await getJobApprovalDetail(jobId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [jobId]);

  const decide = async (decision) => {
    if ((decision === 'queried' || decision === 'rejected') && !note.trim()) {
      setError('A note is required when querying or rejecting.');
      return;
    }
    setBusy(decision); setError(null);
    try {
      const { ok, data } = await approveJob({ jobId, decision, note: note.trim() || null });
      if (!ok) throw new Error(data?.error || 'Update failed');
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const checkin = detail?.checkins?.find(c => c.action === 'checkin' || c.action === 'in') ?? detail?.checkins?.[0];
  const checkout = detail?.checkins?.find(c => c.action === 'checkout' || c.action === 'out') ?? detail?.checkins?.[detail.checkins.length - 1];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '94vw', background: PAPER,
        borderLeft: `1px solid ${LINE}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
      }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading job…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && (!detail || error) && !detail?.id && (
          <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
            {error || 'Job not found.'}
          </div>
        )}
        {!loading && detail && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <ApprovalPill status={detail.approval_status} />
                  {detail.contract?.name && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: SOFT, padding: '3px 8px', borderRadius: 999 }}>{detail.contract.name}</span>
                  )}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{detail.site?.name}</div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                  <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {detail.site?.postcode}{detail.site?.address ? ` · ${detail.site.address}` : ''}
                </div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>
                  {FREQ_LABEL[detail.visit_spec?.frequency] ?? detail.visit_spec?.frequency} · {detail.visit_spec?.scope}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              <Kpi label="Job value"        value={`£${detail.price ?? 0}`} accent={INK} />
              <Kpi label="Service date"     value={detail.date ? new Date(detail.date).toLocaleDateString() : '—'} accent={NAVY} />
              <Kpi label="Actual duration"  value={detail.actual_duration_minutes ? `${detail.actual_duration_minutes}m` : '—'} accent={NAVY} />
              <Kpi label="Completed"        value={detail.completion_marked_at ? new Date(detail.completion_marked_at).toLocaleDateString() : '—'} accent={NAVY} />
            </div>

            {/* Sub */}
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Contractor</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>
                  {(detail.subName?.[0] ?? '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{detail.subName}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <TierBadge tier={detail.sub?.connect_tier} />
                    <span style={{ fontSize: 10, color: SUB }}>Score <strong style={{ color: INK }}>{detail.sub?.connect_score ?? '—'}</strong></span>
                    {detail.sub?.connect_region && <span style={{ fontSize: 10, color: SUB }}>· {detail.sub.connect_region}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Geo-fence trust signals */}
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>On-site verification</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[['Check-in', checkin], ['Check-out', checkout]].map(([label, c]) => (
                  <div key={label} style={{
                    background: c ? (c.inside_geo_fence ? `${GREEN}06` : '#fef3c7') : SOFT,
                    border: `1px solid ${c ? (c.inside_geo_fence ? `${GREEN}25` : '#fcd34d') : LINE}`,
                    borderRadius: 8, padding: '10px 12px',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                    {!c && <div style={{ fontSize: 12, color: MUTE }}>— no record</div>}
                    {c && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: c.inside_geo_fence ? GREEN : '#a16207' }}>
                          {c.inside_geo_fence
                            ? <><CheckCircle2 size={13} /> In fence</>
                            : <><AlertCircle size={13} /> Outside fence</>
                          }
                        </div>
                        <div style={{ fontSize: 10, color: SUB, marginTop: 3 }}>
                          {c.distance_from_site_m != null ? `${Math.round(c.distance_from_site_m)}m from site · ` : ''}
                          {c.checked_in_at ? new Date(c.checked_in_at).toLocaleString() : ''}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              {detail.completion_method && (
                <div style={{ marginTop: 10, fontSize: 11, color: SUB, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={11} /> Completion method · <strong style={{ color: INK }}>{detail.completion_method.replace('_', ' ')}</strong>
                </div>
              )}
            </div>

            {/* Evidence */}
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                Evidence <span style={{ color: MUTE, fontWeight: 700 }}>· {detail.evidence.length} item{detail.evidence.length === 1 ? '' : 's'}</span>
              </div>
              {detail.evidence.length === 0 && (
                <div style={{ fontSize: 11, color: MUTE, fontStyle: 'italic' }}>No photo evidence uploaded.</div>
              )}
              {detail.evidence.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {detail.evidence.map(e => {
                    const url = e.data?.url ?? e.data?.photo_url ?? null;
                    return (
                      <div key={e.id} style={{ borderRadius: 8, background: SOFT, border: `1px solid ${LINE}`, aspectRatio: '4 / 3', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {url
                          ? <img src={url} alt="evidence" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Camera size={20} color={MUTE} />
                        }
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past notes */}
            {detail.query_note && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: '#1e3a8a' }}>
                <strong>Previously queried:</strong> {detail.query_note}
              </div>
            )}
            {detail.rejection_note && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12, color: '#991b1b' }}>
                <strong>Previously rejected:</strong> {detail.rejection_note}
              </div>
            )}

            {/* Decision */}
            {detail.approval_status === 'pending' || detail.approval_status === 'queried' ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
                    Note (required for Query / Reject)
                  </div>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional for Approve — required if querying or rejecting."
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px', fontSize: 13,
                      border: `1px solid ${LINE}`, borderRadius: 8,
                      background: PAPER, color: INK, outline: 'none',
                      fontFamily: 'inherit', resize: 'vertical',
                    }}
                  />
                </div>
                {error && (
                  <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#b91c1c' }}>
                    {error}
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <button onClick={() => decide('approved')} disabled={!!busy} style={{
                    background: busy === 'approved' ? `${GREEN}80` : GREEN, color: 'white', border: 'none',
                    borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {busy === 'approved' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                    <ThumbsUp size={12} /> Approve
                  </button>
                  <button onClick={() => decide('queried')} disabled={!!busy} style={{
                    background: PAPER, color: '#3b82f6', border: '1px solid #93c5fd',
                    borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {busy === 'queried' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                    <MessageCircleQuestion size={12} /> Query
                  </button>
                  <button onClick={() => decide('rejected')} disabled={!!busy} style={{
                    background: PAPER, color: '#b91c1c', border: '1px solid #fca5a5',
                    borderRadius: 8, padding: '10px 12px', fontSize: 12, fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {busy === 'rejected' && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
                    <ShieldX size={12} /> Reject
                  </button>
                </div>
              </>
            ) : (
              <div style={{
                padding: 12,
                background: detail.approval_status === 'approved' ? `${GREEN}10` : '#fef2f2',
                border: `1px solid ${detail.approval_status === 'approved' ? `${GREEN}30` : '#fca5a5'}`,
                borderRadius: 10,
                fontSize: 12, color: detail.approval_status === 'approved' ? '#065f46' : '#991b1b',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                {detail.approval_status === 'approved' ? <CheckCircle2 size={14} /> : <ShieldX size={14} />}
                <span>Already {detail.approval_status}{detail.approved_at ? ` on ${new Date(detail.approved_at).toLocaleDateString()}` : ''}. Read-only.</span>
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
    setLoading(true); setError(null);
    try {
      const rows = await listJobsForApproval({ filter: tab });
      setJobs(rows);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Counts for tabs (pull all once on mount)
  useEffect(() => {
    (async () => {
      try {
        const all = await listJobsForApproval({ filter: 'all' });
        const c = { pending: 0, queried: 0, approved: 0, rejected: 0, all: all.length };
        all.forEach(j => { if (c[j.approval_status] != null) c[j.approval_status]++; });
        setCounts(c);
      } catch {}
    })();
  }, []);

  useEffect(() => { load(); }, [tab]);

  const totals = useMemo(() => {
    const total = jobs.reduce((a, j) => a + (Number(j.price) || 0), 0);
    return { count: jobs.length, total };
  }, [jobs]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Work approval</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Completed jobs awaiting sign-off. Approve drafts the sub's invoice; query or reject sends it back with a note.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
        <Kpi label="Awaiting your review" value={counts.pending ?? 0} accent={counts.pending ? ACCENT : MUTE} />
        <Kpi label={`In ${TABS.find(t => t.id === tab)?.label.toLowerCase()}`} value={totals.count} accent={INK} />
        <Kpi label="Value in view" value={`£${totals.total.toFixed(0)}`} accent={NAVY} />
      </div>

      <div style={{ display: 'flex', gap: 4, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 4, marginBottom: 16, alignSelf: 'flex-start', width: 'fit-content' }}>
        {TABS.map(t => {
          const count = counts[t.id];
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                background: tab === t.id ? `${ACCENT}12` : 'transparent',
                color: tab === t.id ? ACCENT : SUB,
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {t.label}
              {count != null && count > 0 && (
                <span style={{ fontSize: 9, fontWeight: 800, background: tab === t.id ? ACCENT : SOFT, color: tab === t.id ? 'white' : SUB, padding: '1px 6px', borderRadius: 999 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading jobs…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${GREEN}10`, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>Nothing to review</div>
          <div style={{ fontSize: 12, color: SUB, maxWidth: 400, margin: '0 auto' }}>
            {tab === 'pending'
              ? 'Completed jobs from your subs land here for sign-off.'
              : 'No jobs in this state.'}
          </div>
        </div>
      )}

      {!loading && !error && jobs.length > 0 && (
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 40px',
            padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
            fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <div>Site</div><div>Contractor</div><div>Completed</div><div>Value</div><div>Status</div><div></div>
          </div>
          {jobs.map((j, i) => (
            <div
              key={j.id}
              onClick={() => setOpenId(j.id)}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 40px',
                padding: '14px 16px', borderBottom: i < jobs.length - 1 ? `1px solid ${LINE}` : 'none',
                alignItems: 'center', fontSize: 12, color: INK, cursor: 'pointer',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {j.site?.name ?? 'Site'}
                </div>
                <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>
                  {j.site?.postcode ?? ''}{j.visit_spec?.scope ? ` · ${j.visit_spec.scope}` : ''}
                </div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {j.subName}
                </div>
                {j.sub?.connect_score != null && (
                  <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>Score {j.sub.connect_score}</div>
                )}
              </div>
              <div style={{ color: SUB }}>
                {j.completion_marked_at ? new Date(j.completion_marked_at).toLocaleDateString() : '—'}
              </div>
              <div style={{ fontWeight: 800 }}>£{j.price ?? 0}</div>
              <div><ApprovalPill status={j.approval_status} /></div>
              <ChevronRight size={14} color={MUTE} />
            </div>
          ))}
        </div>
      )}

      {openId && <ApprovalDrawer jobId={openId} onClose={() => setOpenId(null)} onChanged={() => {
        load();
        // refresh counts
        listJobsForApproval({ filter: 'all' }).then(all => {
          const c = { pending: 0, queried: 0, approved: 0, rejected: 0, all: all.length };
          all.forEach(j => { if (c[j.approval_status] != null) c[j.approval_status]++; });
          setCounts(c);
        }).catch(() => {});
      }} />}
    </div>
  );
}
