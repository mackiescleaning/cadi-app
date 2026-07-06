import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  MapPin,
  ChevronRight,
  Loader2,
  ClipboardList,
  X,
  Send,
  Camera,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react';
import {
  listFmSites,
  SITE_STATUS,
  listFmActiveSubs,
  assignVisitSpec,
  sendVisitSpecsToMarketplace,
  publishListings,
  getMyFmOrganisation,
  getSiteJobHistory,
} from '../../lib/db/fmOpsDb';
import { blueCanvas, glassDark, ON_DARK, FM_POP as POP } from '../../lib/connectTheme';

const FREQ_LABEL = {
  weekly: 'Weekly',
  fortnightly: '2-wk',
  monthly: 'Mthly',
  quarterly: 'Qtrly',
  annual: 'Annual',
  one_off: 'One-off',
};

// Status keys → bright accents for the dark canvas (db colour maps are
// tuned for light surfaces).
const STATUS_POP = {
  unassigned: POP.amber,
  'no-specs': POP.amber,
  assigned: POP.green,
  active: POP.green,
  marketplace: POP.orange,
  closed: 'rgba(255,255,255,0.40)',
  pending: POP.amber,
  approved: POP.green,
  queried: POP.blue,
  rejected: POP.red,
};
const popFor = (status) => STATUS_POP[status] || 'rgba(255,255,255,0.55)';

const SPEC_STATUS_LABEL = {
  unassigned: { label: 'Unassigned' },
  assigned: { label: 'Assigned' },
  marketplace: { label: 'Marketplace' },
  active: { label: 'Active' },
  closed: { label: 'Closed' },
};

function Pill({ map, status }) {
  const m = map[status] || { label: status };
  const c = popFor(status);
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

const APPROVAL_PILL = {
  pending: { label: 'Pending' },
  approved: { label: 'Approved' },
  queried: { label: 'Queried' },
  rejected: { label: 'Rejected' },
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function SiteDrawer({ site, subs, fmOrg, onClose, onChanged }) {
  const [busy, setBusy] = useState(new Set());
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState(null); // null = not loaded yet, [] = loaded empty
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setHistoryLoading(true);
    getSiteJobHistory(site.id, { limit: 100 })
      .then((rows) => {
        if (alive) setHistory(rows);
      })
      .catch(() => {
        if (alive) setHistory([]);
      })
      .finally(() => {
        if (alive) setHistoryLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [site.id]);

  // KPI aggregates over the fetched history
  const stats = useMemo(() => {
    if (!history || history.length === 0)
      return { total: 0, approvalPct: null, thisYear: 0, valueYtd: 0 };
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    let approved = 0;
    let reviewed = 0;
    let thisYearCount = 0;
    let valueYtd = 0;
    for (const j of history) {
      if (
        j.approval_status === 'approved' ||
        j.approval_status === 'rejected' ||
        j.approval_status === 'queried'
      ) {
        reviewed++;
        if (j.approval_status === 'approved') approved++;
      }
      const dt = j.date ? new Date(j.date) : null;
      if (dt && dt >= yearStart) {
        thisYearCount++;
        if (j.approval_status === 'approved') valueYtd += Number(j.price ?? 0);
      }
    }
    return {
      total: history.length,
      approvalPct: reviewed > 0 ? Math.round((approved / reviewed) * 100) : null,
      thisYear: thisYearCount,
      valueYtd,
    };
  }, [history]);
  const markBusy = (specId, on) =>
    setBusy((prev) => {
      const n = new Set(prev);
      if (on) n.add(specId);
      else n.delete(specId);
      return n;
    });

  const handleAssign = async (specId, subUserId) => {
    markBusy(specId, true);
    setErr(null);
    try {
      await assignVisitSpec({ visitSpecId: specId, subUserId });
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      markBusy(specId, false);
    }
  };

  const handleToMarket = async (spec) => {
    markBusy(spec.id, true);
    setErr(null);
    try {
      await sendVisitSpecsToMarketplace([spec.id]);
      if (fmOrg) {
        await publishListings({
          fmOrganisationId: fmOrg.id,
          visitSpecs: [spec],
          defaults: { visibility: 'open', bid_window_hours: 72, award_rule: 'best_fit' },
        });
      }
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      markBusy(spec.id, false);
    }
  };

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
          width: 560,
          maxWidth: '92vw',
          background: 'linear-gradient(180deg, #071041 0%, #030925 100%)',
          borderLeft: `1px solid ${ON_DARK.lineHi}`,
          padding: '24px 28px',
          overflowY: 'auto',
          boxShadow: '-16px 0 60px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <Pill map={SITE_STATUS} status={site.status} />
              {site.endClientName && (
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
                  {site.endClientName}
                </span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>{site.name}</div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 5 }}>
              <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {site.postcode}
              {site.address ? ` · ${site.address}` : ''}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Kpi label="Visit specs" value={site.specs.length} pop={POP.blue} />
          <Kpi label="Per-cycle value" value={`£${site.perVisit}`} />
        </div>

        {site.notes && (
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: `1px solid ${ON_DARK.line}`,
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              color: ON_DARK.secondary,
            }}
          >
            <strong style={{ color: ON_DARK.primary }}>Notes · </strong>
            {site.notes}
          </div>
        )}

        {err && (
          <div
            style={{
              padding: 10,
              borderRadius: 10,
              marginBottom: 12,
              fontSize: 11,
              background: 'rgba(220,38,38,0.16)',
              border: '1px solid rgba(248,113,113,0.40)',
              color: '#fecaca',
            }}
          >
            {err}
          </div>
        )}

        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: ON_DARK.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Visit specs
        </div>
        {site.specs.length === 0 && (
          <div
            style={{
              padding: 16,
              fontSize: 12,
              color: ON_DARK.muted,
              border: '1.5px dashed rgba(255,255,255,0.16)',
              borderRadius: 12,
            }}
          >
            This site has no visit specs yet.
          </div>
        )}
        {site.specs.map((s) => {
          const assignedSub = subs.find((sub) => sub.id === s.assigned_sub_user_id);
          const isBusy = busy.has(s.id);
          const locked = s.status === 'marketplace' || s.status === 'active';
          return (
            <div
              key={s.id}
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${ON_DARK.line}`,
                marginBottom: 7,
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '70px 1fr 60px 90px',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: ON_DARK.primary }}>
                  {FREQ_LABEL[s.frequency] ?? s.frequency}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: ON_DARK.secondary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.scope}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ON_DARK.primary }}>
                  £{s.price_per_visit}
                </div>
                <Pill map={SPEC_STATUS_LABEL} status={s.status} />
              </div>
              {assignedSub && (
                <div style={{ fontSize: 10, color: ON_DARK.secondary, marginBottom: 6 }}>
                  → {assignedSub.name}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isBusy && (
                  <Loader2
                    size={13}
                    color={ON_DARK.secondary}
                    style={{ animation: 'spin 0.8s linear infinite' }}
                  />
                )}
                {!isBusy && (
                  <>
                    <select
                      value={s.assigned_sub_user_id ?? ''}
                      onChange={(e) => handleAssign(s.id, e.target.value || null)}
                      disabled={locked}
                      style={{
                        flex: 1,
                        padding: '6px 9px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: `1px solid ${locked ? ON_DARK.line : ON_DARK.lineHi}`,
                        borderRadius: 8,
                        background: 'rgba(255,255,255,0.10)',
                        color: locked ? ON_DARK.faint : ON_DARK.primary,
                        cursor: locked ? 'not-allowed' : 'pointer',
                        outline: 'none',
                      }}
                    >
                      <option value="" style={{ color: '#010a4f' }}>
                        {locked ? '(locked while on marketplace / active)' : 'Assign sub…'}
                      </option>
                      {subs.map((sub) => (
                        <option key={sub.id} value={sub.id} style={{ color: '#010a4f' }}>
                          {sub.name}
                          {sub.region ? ` · ${sub.region}` : ''}
                        </option>
                      ))}
                    </select>
                    {!locked && (
                      <button
                        onClick={() => handleToMarket(s)}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          background: 'rgba(251,146,60,0.14)',
                          color: POP.orange,
                          border: '1px solid rgba(251,146,60,0.35)',
                          borderRadius: 8,
                          padding: '6px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Send size={11} /> Market
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* ─── Job history ─────────────────────────────────────────────
            All jobs at this site (past + upcoming), with sub name, approval
            state, and photo thumbnails. Tap a row → Work Approval to review. */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: ON_DARK.muted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <History size={11} /> Site history
          </div>

          {/* KPIs */}
          {history && history.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <Kpi label="Total jobs" value={stats.total} />
              <Kpi
                label="Approval rate"
                value={stats.approvalPct == null ? '—' : `${stats.approvalPct}%`}
                pop={POP.green}
              />
              <Kpi label="This year" value={stats.thisYear} pop={POP.blue} />
              <Kpi
                label="£ YTD (paid ok)"
                value={`£${stats.valueYtd.toFixed(0)}`}
                pop={POP.orange}
              />
            </div>
          )}

          {historyLoading && (
            <div style={{ padding: 16, fontSize: 11, color: ON_DARK.muted, textAlign: 'center' }}>
              <Loader2
                size={14}
                color={ON_DARK.secondary}
                style={{
                  animation: 'spin 0.8s linear infinite',
                  display: 'block',
                  margin: '0 auto 6px',
                }}
              />
              Loading history…
            </div>
          )}

          {!historyLoading && history && history.length === 0 && (
            <div
              style={{
                padding: 16,
                fontSize: 12,
                color: ON_DARK.muted,
                border: '1.5px dashed rgba(255,255,255,0.16)',
                borderRadius: 12,
              }}
            >
              No jobs completed at this site yet.
            </div>
          )}

          {!historyLoading && history && history.length > 0 && (
            <div style={{ ...glassDark({ radius: 14 }), overflow: 'hidden' }}>
              {history.map((j, i) => {
                const pill = APPROVAL_PILL[j.approval_status] || { label: j.status };
                const pillPop = popFor(j.approval_status);
                const isCompleted = !!j.completion_marked_at;
                return (
                  <div
                    key={j.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 84px 90px',
                      gap: 10,
                      padding: '10px 12px',
                      borderBottom: i < history.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                      alignItems: 'center',
                      fontSize: 12,
                      color: ON_DARK.primary,
                    }}
                  >
                    <div style={{ fontSize: 11, color: ON_DARK.muted }}>
                      {fmtDate(j.date)}
                      {isCompleted && (
                        <div
                          style={{
                            fontSize: 10,
                            color: POP.green,
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <CheckCircle2 size={9} />{' '}
                          {new Date(j.completion_marked_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </div>
                      )}
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
                      {j.service && (
                        <div
                          style={{
                            fontSize: 10,
                            color: ON_DARK.muted,
                            marginTop: 2,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {j.service}
                        </div>
                      )}
                      {j.photoUrls?.length > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                          {j.photoUrls.slice(0, 4).map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                overflow: 'hidden',
                                background: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${ON_DARK.lineHi}`,
                                display: 'block',
                              }}
                              title="Open photo in a new tab"
                            >
                              <img
                                src={url}
                                alt="evidence"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </a>
                          ))}
                          {j.photoCount > 4 && (
                            <div
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${ON_DARK.lineHi}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                fontWeight: 800,
                                color: ON_DARK.secondary,
                              }}
                            >
                              +{j.photoCount - 4}
                            </div>
                          )}
                        </div>
                      )}
                      {(!j.photoUrls || j.photoUrls.length === 0) && j.status === 'complete' && (
                        <div
                          style={{
                            fontSize: 10,
                            color: ON_DARK.faint,
                            marginTop: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Camera size={9} /> No photos
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 800, textAlign: 'right' }}>
                      {j.price != null ? `£${Number(j.price).toFixed(0)}` : '—'}
                      {j.actual_duration_minutes != null && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 500,
                            color: ON_DARK.muted,
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            justifyContent: 'flex-end',
                          }}
                        >
                          <Clock size={9} /> {j.actual_duration_minutes}m
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: pillPop,
                          background: pillPop.startsWith('#')
                            ? `${pillPop}1f`
                            : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${pillPop.startsWith('#') ? `${pillPop}42` : 'rgba(255,255,255,0.16)'}`,
                          padding: '3px 8px',
                          borderRadius: 999,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pill.label}
                      </span>
                    </div>
                  </div>
                );
              })}
              {history.length >= 100 && (
                <div
                  style={{
                    padding: 8,
                    fontSize: 10,
                    color: ON_DARK.muted,
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  Showing most recent 100 jobs — older history available on request.
                </div>
              )}
              <div
                style={{
                  padding: '9px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  borderTop: `1px solid ${ON_DARK.line}`,
                }}
              >
                <Link
                  to="/fm-ops/approval"
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: POP.orange,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Full approval queue <ChevronRight size={11} />
                </Link>
              </div>
            </div>
          )}
        </div>

        {site.contract?.name && (
          <div style={{ marginTop: 14, fontSize: 11, color: ON_DARK.muted }}>
            Contract · <strong style={{ color: ON_DARK.primary }}>{site.contract.name}</strong>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function FmOpsSites() {
  const [sites, setSites] = useState([]);
  const [subs, setSubs] = useState([]);
  const [fmOrg, setFmOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [openSite, setOpenSite] = useState(null);

  const reload = async () => {
    const fresh = await listFmSites();
    setSites(fresh);
    // Keep the drawer in sync with refreshed data so post-assign labels update.
    if (openSite) {
      const next = fresh.find((s) => s.id === openSite.id);
      if (next) setOpenSite(next);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, subList, org] = await Promise.all([
          listFmSites(),
          listFmActiveSubs(),
          getMyFmOrganisation(),
        ]);
        setSites(s);
        setSubs(subList);
        setFmOrg(org);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return sites;
    const needle = q.trim().toLowerCase();
    return sites.filter(
      (s) =>
        s.name?.toLowerCase().includes(needle) ||
        s.postcode?.toLowerCase().includes(needle) ||
        s.endClientName?.toLowerCase().includes(needle)
    );
  }, [sites, q]);

  const kpis = useMemo(
    () => ({
      total: sites.length,
      active: sites.filter((s) => s.status === 'active' || s.status === 'assigned').length,
      onMarket: sites.filter((s) => s.status === 'marketplace').length,
      unassigned: sites.filter((s) => s.status === 'unassigned' || s.status === 'no-specs').length,
      pendingApprovals: sites.reduce((a, s) => a + (s.pendingJobs || 0), 0),
    }),
    [sites]
  );

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
                background: 'rgba(79,120,255,0.22)',
                color: POP.blue,
                border: '1px solid rgba(79,120,255,0.40)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={17} />
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
              FM Operations · Sites
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
            Sites / <span style={{ color: POP.blue }}>job cards</span>
          </h1>
          <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6, maxWidth: 560 }}>
            Master list of every site across your contracts, with current allocation + next visit
            rolled up.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5,1fr)',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <Kpi label="Total sites" value={kpis.total} />
          <Kpi label="Active" value={kpis.active} pop={POP.green} />
          <Kpi label="On marketplace" value={kpis.onMarket} pop={POP.orange} />
          <Kpi
            label="Unassigned"
            value={kpis.unassigned}
            pop={kpis.unassigned ? POP.amber : ON_DARK.faint}
          />
          <Kpi
            label="Pending approval"
            value={kpis.pendingApprovals}
            pop={kpis.pendingApprovals ? POP.orange : ON_DARK.faint}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div
            style={{
              ...glassDark({ radius: 12 }),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              flex: 1,
              maxWidth: 380,
            }}
          >
            <Search size={13} color={ON_DARK.faint} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by site, postcode or client…"
              style={{
                border: 'none',
                outline: 'none',
                flex: 1,
                fontSize: 12,
                color: ON_DARK.primary,
                background: 'transparent',
              }}
            />
          </div>
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
            Loading sites…
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

        {!loading && !error && filtered.length === 0 && (
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
                background: 'rgba(79,120,255,0.18)',
                color: POP.blue,
                border: '1px solid rgba(79,120,255,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <ClipboardList size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>
              {sites.length === 0 ? 'No sites yet' : 'Nothing matches that search'}
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
              {sites.length === 0
                ? 'Sites land here when you upload them via Contracts → New contract.'
                : 'Try a different search term.'}
            </div>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div style={{ ...glassDark({ radius: 18 }), overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 2fr 1.4fr 1fr 1fr 1fr 1fr 40px',
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
              <input type="checkbox" disabled style={{ accentColor: '#fb923c' }} />
              <div>Site</div>
              <div>Specs</div>
              <div>Per-cycle</div>
              <div>Last visit</div>
              <div>Next visit</div>
              <div>Status</div>
              <div></div>
            </div>
            {filtered.map((s, i) => (
              <div
                key={s.id}
                onClick={() => setOpenSite(s)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 2fr 1.4fr 1fr 1fr 1fr 1fr 40px',
                  padding: '12px 18px',
                  borderBottom: i < filtered.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                  alignItems: 'center',
                  fontSize: 12,
                  color: ON_DARK.primary,
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <input
                  type="checkbox"
                  disabled
                  style={{ accentColor: '#fb923c' }}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                    {s.postcode}
                    {s.endClientName ? ` · ${s.endClientName}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {s.specs.slice(0, 3).map((spec, idx) => (
                    <span
                      key={spec.id ?? idx}
                      style={{
                        fontSize: 9,
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.08)',
                        border: `1px solid ${ON_DARK.line}`,
                        color: ON_DARK.secondary,
                        fontWeight: 700,
                      }}
                    >
                      {FREQ_LABEL[spec.frequency] ?? spec.frequency}
                    </span>
                  ))}
                  {s.specs.length === 0 && (
                    <span style={{ fontSize: 10, color: ON_DARK.faint }}>—</span>
                  )}
                </div>
                <div style={{ fontWeight: 800 }}>{s.perVisit ? `£${s.perVisit}` : '—'}</div>
                <div style={{ color: ON_DARK.secondary }}>
                  {s.lastVisit ? new Date(s.lastVisit).toLocaleDateString() : '—'}
                </div>
                <div
                  style={{
                    color: s.nextVisit ? ON_DARK.primary : ON_DARK.faint,
                    fontWeight: s.nextVisit ? 700 : 500,
                  }}
                >
                  {s.nextVisit ? new Date(s.nextVisit).toLocaleDateString() : '—'}
                </div>
                <div>
                  <Pill map={SITE_STATUS} status={s.status} />
                </div>
                <ChevronRight size={14} color={ON_DARK.faint} />
              </div>
            ))}
          </div>
        )}

        {openSite && (
          <SiteDrawer
            site={openSite}
            subs={subs}
            fmOrg={fmOrg}
            onClose={() => setOpenSite(null)}
            onChanged={reload}
          />
        )}
      </div>
    </div>
  );
}
