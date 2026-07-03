import { useEffect, useMemo, useState } from 'react';
import {
  UserPlus, Mail, Loader2, X, CheckCircle2, AlertCircle, Copy,
  Shield, Users,
} from 'lucide-react';
import { listFmInvites, inviteTeammate } from '../../lib/db/fmApplyDb';
import {
  blueCanvas, glassDark, primaryButton, ghostButton, ON_DARK, HOVER_LIFT, FM_POP as POP,
} from '../../lib/connectTheme';

const STATUS_PILL = {
  pending:  { label: 'Invite sent', pop: POP.orange },
  claimed:  { label: 'Active',      pop: POP.green  },
  expired:  { label: 'Expired',     pop: 'rgba(255,255,255,0.45)' },
  declined: { label: 'Declined',    pop: POP.red    },
};

const ROLE_LABEL = { admin: 'Admin', member: 'Member' };

const DRAWER_BG = 'linear-gradient(180deg, #071041 0%, #030925 100%)';
const sectionLabel = { fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.08em', textTransform: 'uppercase' };
const darkInput = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: `1px solid ${ON_DARK.lineHi}`, borderRadius: 10,
  background: 'rgba(255,255,255,0.08)', color: ON_DARK.primary, outline: 'none',
  colorScheme: 'dark', boxSizing: 'border-box',
};

function Pill({ status }) {
  const m = STATUS_PILL[status] || { label: status, pop: 'rgba(255,255,255,0.55)' };
  const hex = m.pop.startsWith('#');
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.pop,
      background: hex ? `${m.pop}1f` : 'rgba(255,255,255,0.08)',
      border: `1px solid ${hex ? `${m.pop}42` : 'rgba(255,255,255,0.16)'}`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Kpi({ label, value, pop }) {
  return (
    <div style={{ ...glassDark({ radius: 14, padding: '13px 15px' }) }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || ON_DARK.primary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 6 }}>{label}</div>
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
      position: 'fixed', inset: 0, background: 'rgba(1,4,25,0.55)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 480, maxWidth: '92vw', background: DRAWER_BG,
        borderLeft: `1px solid ${ON_DARK.lineHi}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-16px 0 60px rgba(0,0,0,0.55)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>Invite a teammate</div>
            <div style={{ fontSize: 12, color: ON_DARK.secondary, marginTop: 5 }}>Send a one-time sign-up link to a colleague.</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`, borderRadius: 9, cursor: 'pointer', color: ON_DARK.secondary, padding: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {!result && (
          <>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 4 }}>Work email</div>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  style={darkInput}
                />
              </div>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 4 }}>Name (optional)</div>
                <input
                  value={name} onChange={e => setName(e.target.value)}
                  placeholder="Their name"
                  style={darkInput}
                />
              </div>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>Role</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {['member','admin'].map(r => {
                    const a = role === r;
                    return (
                      <button key={r} onClick={() => setRole(r)} style={{
                        fontSize: 12, padding: '10px 12px', borderRadius: 10,
                        border: `1px solid ${a ? 'rgba(79,120,255,0.45)' : ON_DARK.line}`,
                        background: a ? 'rgba(79,120,255,0.18)' : 'rgba(255,255,255,0.04)',
                        color: a ? POP.blue : ON_DARK.secondary,
                        fontWeight: a ? 800 : 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        {r === 'admin' && <Shield size={11} />}
                        {ROLE_LABEL[r]}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 10, color: ON_DARK.faint, marginTop: 6 }}>
                  Both roles see the same portal today. Role is recorded for future fine-grained controls.
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                marginTop: 14, padding: 12, borderRadius: 12, fontSize: 12,
                background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}

            <button
              onClick={send}
              disabled={busy}
              style={{
                ...primaryButton(),
                marginTop: 18, width: '100%',
                cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
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
            <div style={{
              padding: 18, borderRadius: 14, marginBottom: 14,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <CheckCircle2 size={22} color={POP.green} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ON_DARK.primary }}>
                  {result.already_invited ? 'Already invited' : 'Invitation sent'}
                </div>
                <div style={{ fontSize: 11, color: ON_DARK.secondary }}>
                  {result.email_sent
                    ? `Email delivered to ${email}.`
                    : 'No email sent — copy the link below to share it directly.'}
                </div>
              </div>
            </div>
            {inviteUrl && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${ON_DARK.line}`, borderRadius: 12, padding: 12 }}>
                <div style={{ ...sectionLabel, marginBottom: 6 }}>One-time invite link</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ flex: 1, fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 11, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inviteUrl}</div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                    style={{ ...ghostButton({ size: 'sm', onDark: true }), fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
              </div>
            )}
            <button onClick={onClose} style={{
              ...primaryButton(),
              marginTop: 16, width: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
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
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11,
                background: 'rgba(79,120,255,0.22)', color: POP.blue,
                border: '1px solid rgba(79,120,255,0.40)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Users size={17} /></div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: ON_DARK.muted }}>
                FM Operations · Team
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: ON_DARK.primary, margin: 0 }}>
              Your <span style={{ color: POP.blue }}>team</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6 }}>
              People who can access this FM portal. Invite teammates by email.
            </div>
          </div>
          <button
            onClick={() => setInviteOpen(true)}
            className={HOVER_LIFT}
            style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <UserPlus size={14} /> Invite teammate
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
          <Kpi label="Active members"  value={kpis.active}  pop={POP.green} />
          <Kpi label="Pending invites" value={kpis.pending} pop={kpis.pending ? POP.orange : ON_DARK.faint} />
          <Kpi label="Total"           value={kpis.total} />
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
            <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading team…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>{error}</div>
        )}

        {!loading && !error && rows.length === 0 && (
          <div style={{ padding: '44px 24px', borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.16)', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(79,120,255,0.18)', color: POP.blue, border: '1px solid rgba(79,120,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <Users size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>You're flying solo</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, maxWidth: 400, margin: '0 auto 18px', lineHeight: 1.6 }}>
              Invite teammates so the work doesn't pile up on one inbox.
            </div>
            <button
              onClick={() => setInviteOpen(true)}
              className={HOVER_LIFT}
              style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <UserPlus size={14} /> Invite teammate
            </button>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={{ ...glassDark({ radius: 18 }), overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '2fr 1.6fr 1fr 1fr 1fr',
              padding: '11px 18px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${ON_DARK.line}`,
              fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
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
                    padding: '12px 18px', borderBottom: i < rows.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                    alignItems: 'center', fontSize: 12, color: ON_DARK.primary,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayName}
                    </div>
                    {r.invited_by && (
                      <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                        Invited by {[r.invited_by.first_name, r.invited_by.last_name].filter(Boolean).join(' ') || '—'}
                      </div>
                    )}
                  </div>
                  <div style={{ color: ON_DARK.secondary, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Mail size={11} /> {r.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {r.role === 'admin' && <Shield size={11} color={POP.blue} />}
                    <span style={{ fontWeight: 700, color: r.role === 'admin' ? POP.blue : ON_DARK.secondary }}>{ROLE_LABEL[r.role]}</span>
                  </div>
                  <div style={{ color: ON_DARK.secondary }}>{new Date(r.created_at).toLocaleDateString()}</div>
                  <div><Pill status={r.status} /></div>
                </div>
              );
            })}
          </div>
        )}

        {inviteOpen && <InviteDrawer onClose={() => setInviteOpen(false)} onSent={load} />}
      </div>
    </div>
  );
}
