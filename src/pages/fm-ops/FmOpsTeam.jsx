import { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Mail, Loader2, X, CheckCircle2, AlertCircle, Copy,
  Shield, Users,
} from 'lucide-react';
import { listFmInvites, inviteTeammate } from '../../lib/db/fmApplyDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const STATUS_PILL = {
  pending:  { label: 'Invite sent', color: ACCENT  },
  claimed:  { label: 'Active',      color: GREEN   },
  expired:  { label: 'Expired',     color: MUTE    },
  declined: { label: 'Declined',    color: '#b91c1c' },
};

const ROLE_LABEL = { admin: 'Admin', member: 'Member' };

function Pill({ status }) {
  const m = STATUS_PILL[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
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

function InviteDrawer({ onClose, onSent }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('member');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Valid email required'); return;
    }
    setBusy(true); setError(null);
    try {
      const { ok, data } = await inviteTeammate({ email: email.trim(), name: name.trim(), role });
      if (!ok) throw new Error(data?.error || 'Invite failed');
      setResult(data);
      onSent?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const inviteUrl = result?.token
    ? `${window.location.origin}/invite/${result.token}?source=fm-ops`
    : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxWidth: '92vw', background: PAPER,
        borderLeft: `1px solid ${LINE}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>Invite a teammate</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>Send a one-time sign-up link to a colleague.</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {!result && (
          <>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Work email</div>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER, color: INK, outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Name (optional)</div>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Their name"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER, color: INK, outline: 'none' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Role</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {['member','admin'].map(r => {
                    const a = role === r;
                    return (
                      <button key={r} onClick={() => setRole(r)} style={{
                        fontSize: 12, padding: '10px 12px', borderRadius: 8,
                        border: `1px solid ${a ? ACCENT : LINE}`,
                        background: a ? `${ACCENT}10` : PAPER,
                        color: a ? ACCENT : INK,
                        fontWeight: a ? 800 : 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        {r === 'admin' && <Shield size={11} />}
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: MUTE, marginTop: 6 }}>
                  Both roles see the same portal today. Role is recorded for future fine-grained controls.
                </div>
              </div>
            </div>

            {error && (
              <div style={{ marginTop: 14, padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <button
              onClick={send}
              disabled={busy}
              style={{
                marginTop: 18, width: '100%', background: busy ? MUTE : ACCENT, color: 'white', border: 'none',
                borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {busy && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              <UserPlus size={13} /> Send invite
            </button>
          </>
        )}

        {result && (
          <div>
            <div style={{ padding: 18, background: `${GREEN}10`, border: `1px solid ${GREEN}30`, borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={22} color={GREEN} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>
                  {result.already_invited ? 'Already invited' : 'Invitation sent'}
                </div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {result.email_sent
                    ? `Email delivered to ${email}.`
                    : 'No email sent — copy the link below to share it directly.'}
                </div>
              </div>
            </div>
            {inviteUrl && (
              <div style={{ background: SOFT, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>One-time invite link</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteUrl}</div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                    style={{ background: PAPER, color: NAVY, border: `1px solid ${LINE}`, borderRadius: 6, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
              </div>
            )}
            <button onClick={onClose} style={{
              marginTop: 16, width: '100%', background: NAVY, color: 'white', border: 'none',
              borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>
              Done
            </button>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function FmOpsTeam() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = async () => {
    setLoading(true); setError(null);
    try { setRows(await listFmInvites()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => ({
    active:  rows.filter(r => r.status === 'claimed').length,
    pending: rows.filter(r => r.status === 'pending').length,
    total:   rows.length,
  }), [rows]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Team</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            People who can access this FM portal. Invite teammates by email.
          </div>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          style={{
            background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <UserPlus size={13} /> Invite teammate
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="Active members"  value={kpis.active}  accent={GREEN} />
        <Kpi label="Pending invites" value={kpis.pending} accent={kpis.pending ? ACCENT : MUTE} />
        <Kpi label="Total"           value={kpis.total}   accent={INK} />
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading team…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Users size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>You're flying solo</div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
            Invite teammates so the work doesn't pile up on one inbox.
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            style={{
              background: ACCENT, color: 'white', border: 'none',
              borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <UserPlus size={13} /> Invite teammate
          </button>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1.6fr 1fr 1fr 1fr',
            padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
            fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <div>Member</div>
            <div>Email</div>
            <div>Role</div>
            <div>Invited</div>
            <div>Status</div>
          </div>
          {rows.map((r, i) => {
            const displayName = r.claimed_by?.business_name
              || [r.claimed_by?.first_name, r.claimed_by?.last_name].filter(Boolean).join(' ')
              || r.contact_name
              || '—';
            return (
              <div
                key={r.id}
                style={{
                  display: 'grid', gridTemplateColumns: '2fr 1.6fr 1fr 1fr 1fr',
                  padding: '12px 16px', borderBottom: i < rows.length - 1 ? `1px solid ${LINE}` : 'none',
                  alignItems: 'center', fontSize: 12, color: INK,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </div>
                  {r.invited_by && (
                    <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>
                      Invited by {[r.invited_by.first_name, r.invited_by.last_name].filter(Boolean).join(' ') || '—'}
                    </div>
                  )}
                </div>
                <div style={{ color: SUB, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <Mail size={11} /> {r.email}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {r.role === 'admin' && <Shield size={11} color={NAVY} />}
                  <span style={{ fontWeight: 700, color: r.role === 'admin' ? NAVY : SUB }}>{ROLE_LABEL[r.role]}</span>
                </div>
                <div style={{ color: SUB }}>{new Date(r.created_at).toLocaleDateString()}</div>
                <div><Pill status={r.status} /></div>
              </div>
            );
          })}
        </div>
      )}

      {inviteOpen && <InviteDrawer onClose={() => setInviteOpen(false)} onSent={load} />}
    </div>
  );
}
