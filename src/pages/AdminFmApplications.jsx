import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  Building2,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  listApplications,
  approveApplication,
  rejectApplication,
  getIsCadiAdmin,
  APPLICATION_STATUS,
} from '../lib/db/fmApplyDb';

const NAVY = '#010a4f';
const INK = '#0f172a';
const SUB = '#64748b';
const MUTE = '#94a3b8';
const LINE = '#e2e8f0';
const SOFT = '#f1f5f9';
const PAPER = '#ffffff';
const BG = '#f8faff';
const ACCENT = '#C2410C';
const GREEN = '#16a34a';

const TABS = [
  { id: 'pending', label: 'Pending' },
  { id: 'reviewing', label: 'Reviewing' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
];

function StatusPill({ status }) {
  const m = APPLICATION_STATUS[status] || { label: status, color: SUB };
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: m.color,
        background: `${m.color}14`,
        padding: '3px 8px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div
      style={{
        background: PAPER,
        border: `1px solid ${LINE}`,
        borderRadius: 10,
        padding: '14px 16px',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '120px 1fr',
        gap: 12,
        padding: '8px 0',
        fontSize: 12,
      }}
    >
      <span style={{ color: SUB, fontWeight: 700 }}>{label}</span>
      <span style={{ color: INK }}>{value}</span>
    </div>
  );
}

function ApplicationDrawer({ app, onClose, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [result, setResult] = useState(null);

  const doApprove = async () => {
    setBusy('approve');
    setError(null);
    try {
      const { ok, data } = await approveApplication({ applicationId: app.id });
      if (!ok) throw new Error(data?.error || 'Approve failed');
      setResult({ kind: 'approved', ...data });
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    if (!rejectReason.trim()) {
      setError('Reason required');
      return;
    }
    setBusy('reject');
    setError(null);
    try {
      await rejectApplication({ applicationId: app.id, reason: rejectReason });
      setResult({ kind: 'rejected' });
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
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
          background: PAPER,
          borderLeft: `1px solid ${LINE}`,
          padding: '24px 28px',
          overflowY: 'auto',
          boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <StatusPill status={app.status} />
              <span style={{ fontSize: 10, color: MUTE }}>
                Submitted {new Date(app.created_at).toLocaleString()}
              </span>
            </div>
            <div style={{ fontSize: 19, fontWeight: 900, color: INK }}>{app.company_name}</div>
            {app.company_website && (
              <a
                href={app.company_website}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 11,
                  color: ACCENT,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  marginTop: 4,
                }}
              >
                {app.company_website} <ExternalLink size={10} />
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: MUTE,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Contact */}
        <div
          style={{
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Contact
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{app.contact_name}</div>
          {app.contact_role && (
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{app.contact_role}</div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            <a
              href={`mailto:${app.contact_email}`}
              style={{
                fontSize: 11,
                color: ACCENT,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Mail size={11} /> {app.contact_email}
            </a>
            {app.contact_phone && (
              <span
                style={{
                  fontSize: 11,
                  color: SUB,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Phone size={11} /> {app.contact_phone}
              </span>
            )}
          </div>
        </div>

        {/* Company */}
        <div
          style={{
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: SUB,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Company
          </div>
          <DetailRow label="Size" value={app.company_size} />
          <DetailRow
            label="Sites managed"
            value={app.sites_managed != null ? `${app.sites_managed}` : null}
          />
          <DetailRow
            label="Sub-contractors"
            value={app.current_subs != null ? `${app.current_subs}` : null}
          />
          <DetailRow label="Current software" value={app.current_software} />
          {app.regions_covered?.length > 0 && (
            <DetailRow label="Regions" value={app.regions_covered.join(' · ')} />
          )}
          {app.business_model && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginBottom: 4 }}>
                Business model
              </div>
              <div style={{ fontSize: 12, color: INK, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {app.business_model}
              </div>
            </div>
          )}
        </div>

        {/* Pitch */}
        {app.why_cadi && (
          <div
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Why Cadi
            </div>
            <div style={{ fontSize: 12, color: INK, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
              {app.why_cadi}
            </div>
          </div>
        )}

        {/* Reviewed state */}
        {app.status === 'rejected' && app.rejection_reason && (
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 12,
              color: '#991b1b',
            }}
          >
            <strong>Rejection reason:</strong> {app.rejection_reason}
          </div>
        )}
        {app.status === 'approved' && (
          <div
            style={{
              padding: 12,
              background: `${GREEN}10`,
              border: `1px solid ${GREEN}30`,
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 12,
              color: '#065f46',
            }}
          >
            <strong>Approved.</strong> FM org created · invite sent to {app.contact_email}.
          </div>
        )}

        {/* Result panel */}
        {result?.kind === 'approved' && (
          <div
            style={{
              padding: 14,
              background: `${GREEN}10`,
              border: `1px solid ${GREEN}30`,
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 13,
              color: INK,
            }}
          >
            <CheckCircle2
              size={14}
              color={GREEN}
              style={{ verticalAlign: 'middle', marginRight: 6 }}
            />
            <strong>Approved.</strong> Invite{' '}
            {result.email_sent ? 'emailed' : '(email skipped — no Resend key)'}. Token:{' '}
            <code style={{ fontSize: 11 }}>{result.token?.slice(0, 12)}…</code>
          </div>
        )}
        {result?.kind === 'rejected' && (
          <div
            style={{
              padding: 14,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 10,
              marginBottom: 14,
              fontSize: 13,
              color: '#991b1b',
            }}
          >
            <XCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            <strong>Rejected.</strong>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              marginBottom: 14,
              fontSize: 12,
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        {(app.status === 'pending' || app.status === 'reviewing') && !result && (
          <>
            {!showRejectForm ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  onClick={doApprove}
                  disabled={!!busy}
                  style={{
                    background: busy === 'approve' ? `${GREEN}80` : GREEN,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {busy === 'approve' && (
                    <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                  )}
                  <CheckCircle2 size={13} /> Approve · create org &amp; invite
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  disabled={!!busy}
                  style={{
                    background: PAPER,
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    borderRadius: 8,
                    padding: '12px 16px',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: busy ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <XCircle size={13} /> Reject
                </button>
              </div>
            ) : (
              <>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why are you rejecting? (Saved to the application record — not sent to the FM by default.)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 13,
                    border: `1px solid ${LINE}`,
                    borderRadius: 8,
                    background: PAPER,
                    color: INK,
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    marginBottom: 10,
                  }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectReason('');
                    }}
                    style={{
                      background: PAPER,
                      color: SUB,
                      border: `1px solid ${LINE}`,
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={doReject}
                    disabled={busy === 'reject'}
                    style={{
                      flex: 1,
                      background: '#b91c1c',
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: busy ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {busy === 'reject' && (
                      <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />
                    )}
                    Confirm reject
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function AdminFmApplications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState('pending');
  const [apps, setApps] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openApp, setOpenApp] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/login');
      return;
    }
    getIsCadiAdmin().then(setIsAdmin);
  }, [authLoading, user, navigate]);

  const loadCounts = async () => {
    try {
      const all = await listApplications({ status: 'all' });
      const c = { pending: 0, reviewing: 0, approved: 0, rejected: 0, all: all.length };
      all.forEach((a) => {
        if (c[a.status] != null) c[a.status]++;
      });
      setCounts(c);
    } catch {}
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setApps(await listApplications({ status: tab }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run on isAdmin/tab; load() is redefined each render
  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, tab]);
  useEffect(() => {
    if (isAdmin) loadCounts();
  }, [isAdmin]);

  if (authLoading || isAdmin === null) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', color: SUB }} />
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#fef2f2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <Shield size={26} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: INK, marginBottom: 6 }}>Admin only</h1>
          <p style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginBottom: 22 }}>
            This page is for Cadi internal staff reviewing FM applications.
          </p>
          <Link
            to="/dashboard"
            style={{
              display: 'inline-block',
              background: NAVY,
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ← Back to Cadi
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '28px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: `${NAVY}10`,
                color: NAVY,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              <Shield size={11} /> Cadi internal
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: INK }}>FM applications</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              Review prospective FM partners. Approving creates the org + sends the first-admin
              invite email.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <Kpi
            label="Pending"
            value={counts.pending ?? 0}
            accent={counts.pending ? ACCENT : MUTE}
          />
          <Kpi label="Reviewing" value={counts.reviewing ?? 0} accent={NAVY} />
          <Kpi label="Approved" value={counts.approved ?? 0} accent={GREEN} />
          <Kpi label="Rejected" value={counts.rejected ?? 0} accent={MUTE} />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            background: PAPER,
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: 4,
            marginBottom: 16,
            width: 'fit-content',
          }}
        >
          {TABS.map((t) => {
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: tab === t.id ? `${NAVY}12` : 'transparent',
                  color: tab === t.id ? NAVY : SUB,
                  border: 'none',
                  cursor: 'pointer',
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
                      background: tab === t.id ? NAVY : SOFT,
                      color: tab === t.id ? 'white' : SUB,
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
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB }}>
            <Loader2
              size={20}
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />{' '}
            Loading applications…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div
            style={{
              padding: 18,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 12,
              color: '#b91c1c',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && apps.length === 0 && (
          <div
            style={{
              padding: 40,
              background: PAPER,
              border: `1.5px dashed ${LINE}`,
              borderRadius: 14,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 13,
                background: `${NAVY}10`,
                color: NAVY,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Building2 size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>
              Nothing in {tab}
            </div>
            <div style={{ fontSize: 12, color: SUB }}>
              Applications come in through{' '}
              <Link
                to="/apply/fm"
                style={{ color: ACCENT, textDecoration: 'none', fontWeight: 700 }}
              >
                /apply/fm
              </Link>
              .
            </div>
          </div>
        )}

        {!loading && !error && apps.length > 0 && (
          <div
            style={{
              background: PAPER,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1fr',
                padding: '10px 16px',
                background: SOFT,
                borderBottom: `1px solid ${LINE}`,
                fontSize: 10,
                fontWeight: 800,
                color: SUB,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              <div>Company</div>
              <div>Contact</div>
              <div>Size</div>
              <div>Sites</div>
              <div>Submitted</div>
              <div>Status</div>
            </div>
            {apps.map((a, i) => (
              <div
                key={a.id}
                onClick={() => setOpenApp(a)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.4fr 1fr 1fr 1fr 1fr',
                  padding: '14px 16px',
                  borderBottom: i < apps.length - 1 ? `1px solid ${LINE}` : 'none',
                  alignItems: 'center',
                  fontSize: 12,
                  color: INK,
                  cursor: 'pointer',
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
                    {a.company_name}
                  </div>
                  {a.regions_covered?.length > 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: MUTE,
                        marginTop: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <MapPin size={9} /> {a.regions_covered.slice(0, 3).join(', ')}
                      {a.regions_covered.length > 3 ? ` +${a.regions_covered.length - 3}` : ''}
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
                    {a.contact_name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: SUB,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.contact_email}
                  </div>
                </div>
                <div style={{ color: SUB }}>{a.company_size ?? '—'}</div>
                <div style={{ fontWeight: 800 }}>{a.sites_managed ?? '—'}</div>
                <div style={{ color: SUB }}>{new Date(a.created_at).toLocaleDateString()}</div>
                <div>
                  <StatusPill status={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openApp && (
        <ApplicationDrawer
          app={openApp}
          onClose={() => setOpenApp(null)}
          onChanged={() => {
            load();
            loadCounts();
          }}
        />
      )}
    </div>
  );
}
