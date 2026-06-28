import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Upload, Plus, MapPin, AlertCircle, CheckCircle2, ChevronRight,
  Mail, Phone, Download, X, Loader2,
} from 'lucide-react';
import {
  listFmContractors,
  groupByRegion,
  summariseContractors,
  fmBulkImportSubs,
  parseCsv,
  csvRowToInvite,
  TIER_LABEL,
  TIER_COLOR,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT = '#f1f5f9';
const GREEN = '#16a34a';

const REGION_COLOURS = ['#7c3aed', NAVY, GREEN, '#0891b2', ACCENT, '#db2777', '#0ea5e9'];

function colourFor(region, idx) {
  return REGION_COLOURS[idx % REGION_COLOURS.length];
}

function ScreenHeader({ title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
    }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    claimed:  { label: 'Active',   color: GREEN     },
    pending:  { label: 'Invite sent', color: ACCENT  },
    expired:  { label: 'Expired',  color: MUTE      },
    declined: { label: 'Declined', color: '#b91c1c' },
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

// ─── Bulk import drawer ──────────────────────────────────────────────────────
function BulkImportDrawer({ onClose, onImported }) {
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);  // { headers, rows }
  const [previewRows, setPreviewRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sendEmail, setSendEmail] = useState(true);

  const handleFile = async (file) => {
    if (!file) return;
    const txt = await file.text();
    setText(txt);
    const p = parseCsv(txt);
    setParsed(p);
    setPreviewRows(p.rows.map(csvRowToInvite));
    setResult(null);
    setError(null);
  };

  const validCount = previewRows.filter(r => r.email).length;
  const skipCount  = previewRows.length - validCount;

  const submit = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const rows = previewRows.filter(r => r.email);  // edge fn rejects no-email rows anyway
      const { ok, status, data } = await fmBulkImportSubs({ rows, sendEmail });
      if (!ok) throw new Error(data?.error || `Import failed (${status})`);
      setResult(data);
      onImported?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'company,contact,email,phone,region,trades',
      'Sub Co. A,Aisha Khan,aisha@subco-a.example,07700 900 001,Midlands,exterior',
      'Sub Co. B,Ben Carter,ben@subco-b.example,07700 900 002,London,interior;specialist',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cadi-connect-subs-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', background: PAPER,
        borderLeft: `1px solid ${LINE}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>Bulk import contractors</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              Drop in a CSV from the FM client. Each row becomes a Cadi Connect invite — your subs sign up free under your unlock.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {!parsed && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              style={{
                border: `2px dashed ${ACCENT}55`, background: `${ACCENT}06`,
                borderRadius: 14, padding: 32, textAlign: 'center', cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${ACCENT}18`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                <Upload size={20} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>Drop CSV here, or click to choose</div>
              <div style={{ fontSize: 11, color: SUB }}>Columns: company · contact · email · phone · region · trades</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            <button onClick={downloadTemplate} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: PAPER, color: SUB, border: `1px solid ${LINE}`,
              borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>
              <Download size={12} /> Download template
            </button>
            <div style={{ marginTop: 18, padding: 14, background: `${NAVY}06`, border: `1px solid ${NAVY}18`, borderRadius: 10, fontSize: 11, color: '#334155', lineHeight: 1.6 }}>
              <strong style={{ color: NAVY }}>Email is required.</strong> Subs claim their account through the link in the invite email — phone-only rows are rejected.
            </div>
          </>
        )}

        {parsed && !result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <KpiCard label="Rows in file"  value={previewRows.length} />
              <KpiCard label="Ready to send" value={validCount} accent={GREEN} />
              <KpiCard label="Skipped"       value={skipCount}  accent={skipCount ? '#a16207' : MUTE} />
            </div>
            <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, marginBottom: 14, maxHeight: 240, overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.6fr', padding: '8px 12px', background: SOFT, borderBottom: `1px solid ${LINE}`, fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <div>Company</div><div>Email</div><div>Region</div><div>Status</div>
              </div>
              {previewRows.length === 0 && (
                <div style={{ padding: 14, fontSize: 11, color: SUB }}>No rows parsed. Check the CSV headers — first row must contain column names.</div>
              )}
              {previewRows.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.6fr', padding: '8px 12px', borderBottom: i < previewRows.length - 1 ? `1px solid ${SOFT}` : 'none', fontSize: 11, color: INK, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name || r.contact_name || '—'}</div>
                  <div style={{ color: r.email ? INK : MUTE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email || '— no email'}</div>
                  <div style={{ color: SUB, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.region || '—'}</div>
                  <div>{r.email
                    ? <span style={{ fontSize: 10, fontWeight: 800, color: GREEN }}>OK</span>
                    : <span style={{ fontSize: 10, fontWeight: 800, color: '#a16207' }}>skip</span>}
                  </div>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: INK, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                style={{ accentColor: ACCENT }}
              />
              Send invite emails now <span style={{ color: SUB, fontSize: 11 }}>(recommended)</span>
            </label>
            {error && (
              <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => { setParsed(null); setPreviewRows([]); setText(''); }} style={{ background: PAPER, color: SUB, border: `1px solid ${LINE}`, borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ← Pick another file
              </button>
              <button
                onClick={submit}
                disabled={busy || validCount === 0}
                style={{
                  background: validCount === 0 ? MUTE : ACCENT, color: 'white',
                  border: 'none', borderRadius: 8, padding: '10px 18px',
                  fontSize: 13, fontWeight: 800,
                  cursor: busy || validCount === 0 ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {busy && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
                Import {validCount} contractor{validCount === 1 ? '' : 's'} →
              </button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ padding: 18, background: `${GREEN}10`, border: `1px solid ${GREEN}30`, borderRadius: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckCircle2 size={22} color={GREEN} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: INK }}>Imported {result.imported ?? 0} contractor{(result.imported ?? 0) === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 11, color: SUB }}>
                  {result.emails_sent ?? 0} invite email{(result.emails_sent ?? 0) === 1 ? '' : 's'} sent · {result.skipped ?? 0} skipped
                </div>
              </div>
            </div>
            {result.skipped_reasons && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                <KpiCard label="Duplicates"      value={result.skipped_reasons.duplicate ?? 0} accent={SUB} />
                <KpiCard label="Missing email"   value={result.skipped_reasons.missing_contact ?? 0} accent={SUB} />
                <KpiCard label="Invalid email"   value={result.skipped_reasons.invalid_email ?? 0} accent={SUB} />
              </div>
            )}
            {(result.errors?.length ?? 0) > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, fontSize: 11, color: '#b91c1c', marginBottom: 14 }}>
                {result.errors.slice(0, 6).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <button onClick={onClose} style={{
              width: '100%', background: NAVY, color: 'white', border: 'none',
              borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>
              Done
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Detail drawer ───────────────────────────────────────────────────────────
function ContractorDrawer({ sub, onClose }) {
  if (!sub) return null;
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
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{sub.companyName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <StatusPill status={sub.status} />
              <TierBadge tier={sub.tier} />
              {sub.region && <span style={{ fontSize: 10, color: SUB, fontWeight: 700 }}><MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{sub.region}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <KpiCard label="Connect score" value={sub.score ?? '—'} accent={sub.score ? NAVY : MUTE} />
          <KpiCard label="Capacity"      value={sub.capacity ?? '—'} accent={sub.capacity ? GREEN : MUTE} />
        </div>

        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Contact</div>
          {sub.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: INK }}>
              <Mail size={12} color={SUB} /> <span>{sub.email}</span>
            </div>
          )}
          {sub.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: INK }}>
              <Phone size={12} color={SUB} /> <span>{sub.phone}</span>
            </div>
          )}
          {sub.contactName && (
            <div style={{ fontSize: 11, color: SUB, paddingTop: 6 }}>Contact · {sub.contactName}</div>
          )}
        </div>

        {sub.trades?.length > 0 && (
          <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Trades</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sub.trades.map(t => (
                <span key={t} style={{ fontSize: 10, fontWeight: 700, color: SUB, background: SOFT, padding: '4px 9px', borderRadius: 999 }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ background: `${NAVY}05`, border: `1px solid ${NAVY}15`, borderRadius: 10, padding: 14, fontSize: 11, color: SUB, lineHeight: 1.6 }}>
          {sub.status === 'pending' && <>Invited {new Date(sub.invitedAt).toLocaleDateString()} · expires {new Date(sub.expiresAt).toLocaleDateString()}. They'll appear as active once they accept the email invite.</>}
          {sub.status === 'claimed' && <>Joined {sub.claimedAt ? new Date(sub.claimedAt).toLocaleDateString() : '—'}. Use Contracts → Allocate to assign this contractor to sites.</>}
          {sub.status === 'expired' && <>Invite expired — re-send from the Contractors list to renew the token.</>}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function FmOpsContractors() {
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [openSub, setOpenSub] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const rows = await listFmContractors();
      setContractors(rows);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const kpis    = useMemo(() => summariseContractors(contractors), [contractors]);
  const regions = useMemo(() => groupByRegion(contractors),       [contractors]);

  return (
    <div>
      <ScreenHeader
        title="Contractors"
        subtitle="Your sub-contractor network. Bulk-import from the FM client, track invites + compliance, allocate to sites."
        action={
          <button
            onClick={() => setImportOpen(true)}
            style={{
              background: ACCENT, color: 'white', border: 'none',
              borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            }}
          >
            <Upload size={13} /> Bulk import
          </button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 18 }}>
        <KpiCard label="Contractors in network" value={kpis.total} />
        <KpiCard label="Active (claimed)"        value={kpis.active}  accent={GREEN} />
        <KpiCard label="Pending invites"         value={kpis.pending} accent={kpis.pending ? ACCENT : MUTE} />
        <KpiCard label="Average score"           value={kpis.avgScore ?? '—'} accent={NAVY} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => setImportOpen(true)}
          style={{
            background: PAPER, border: `1px dashed ${ACCENT}50`, borderRadius: 12,
            padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>Bulk import (CSV)</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>Up to 500 rows. Sends Cadi Connect invite emails automatically.</div>
          </div>
          <ChevronRight size={14} color={MUTE} />
        </button>
        <button
          onClick={() => setImportOpen(true)}
          style={{
            background: PAPER, border: `1px dashed ${GREEN}50`, borderRadius: 12,
            padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 9, background: `${GREEN}15`, color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={17} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>Invite individual</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>Add a single contractor with an email — same import flow, one row.</div>
          </div>
          <ChevronRight size={14} color={MUTE} />
        </button>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading contractors…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
          Couldn't load contractors — {error}
        </div>
      )}

      {!loading && !error && contractors.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Users size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>No contractors yet</div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
            Drop in the FM client's sub list and Cadi sends free Connect invites — you'll see them appear here as they sign up.
          </div>
          <button
            onClick={() => setImportOpen(true)}
            style={{
              background: ACCENT, color: 'white', border: 'none',
              borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Upload size={13} /> Bulk import
          </button>
        </div>
      )}

      {!loading && !error && regions.map((bucket, idx) => {
        const colour = colourFor(bucket.region, idx);
        return (
          <div key={bucket.region} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              background: `${colour}06`, borderBottom: `1px solid ${colour}20`,
              borderLeft: `4px solid ${colour}`,
            }}>
              <MapPin size={14} color={colour} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>{bucket.region}</div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
                  {bucket.subs.length} contractor{bucket.subs.length === 1 ? '' : 's'} · {bucket.subs.filter(s => s.status === 'claimed').length} active
                </div>
              </div>
            </div>
            {bucket.subs.map((sub, i) => (
              <div
                key={sub.id}
                onClick={() => setOpenSub(sub)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1.2fr 1fr 100px 30px',
                  padding: '12px 16px',
                  borderTop: i > 0 ? `1px solid ${SOFT}` : 'none',
                  borderLeft: `4px solid ${colour}`,
                  alignItems: 'center', fontSize: 11, cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 7,
                    background: `${colour}15`, color: colour,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 900, flexShrink: 0,
                  }}>{(sub.companyName?.[0] ?? '?').toUpperCase()}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.companyName}</div>
                    <div style={{ fontSize: 10, color: MUTE, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sub.email || sub.phone || sub.contactName || '—'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {(sub.trades ?? []).slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: SOFT, color: SUB, fontWeight: 700 }}>{t}</span>
                  ))}
                  {!sub.trades?.length && <span style={{ fontSize: 10, color: MUTE }}>—</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusPill status={sub.status} />
                  <TierBadge tier={sub.tier} />
                </div>
                <div style={{ fontSize: 11, color: SUB }}>
                  Score <strong style={{ color: INK }}>{sub.score ?? '—'}</strong>
                </div>
                <ChevronRight size={14} color={MUTE} />
              </div>
            ))}
          </div>
        );
      })}

      {importOpen && <BulkImportDrawer onClose={() => setImportOpen(false)} onImported={load} />}
      {openSub   && <ContractorDrawer sub={openSub} onClose={() => setOpenSub(null)} />}
    </div>
  );
}
