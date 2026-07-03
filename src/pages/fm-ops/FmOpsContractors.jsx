import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users, Upload, Plus, MapPin, CheckCircle2, ChevronRight,
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
import {
  blueCanvas, glassDark, primaryButton, ghostButton, ON_DARK, HOVER_LIFT, FM_POP as POP,
} from '../../lib/connectTheme';

// Bright region accent rotation for the dark canvas.
const REGION_COLOURS = ['#a78bfa', POP.blue, POP.green, '#22d3ee', POP.orange, '#f472b6', '#38bdf8'];

function colourFor(region, idx) {
  return REGION_COLOURS[idx % REGION_COLOURS.length];
}

const DRAWER_BG = 'linear-gradient(180deg, #071041 0%, #030925 100%)';

function KpiCard({ label, value, pop }) {
  return (
    <div style={{ ...glassDark({ radius: 14, padding: '13px 15px' }) }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || ON_DARK.primary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    claimed:  { label: 'Active',      pop: POP.green  },
    pending:  { label: 'Invite sent', pop: POP.orange },
    expired:  { label: 'Expired',     pop: 'rgba(255,255,255,0.45)' },
    declined: { label: 'Declined',    pop: POP.red    },
  };
  const m = map[status] || { label: status, pop: 'rgba(255,255,255,0.55)' };
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

function TierBadge({ tier }) {
  if (!tier) return null;
  const colour = TIER_COLOR[tier] || 'rgba(255,255,255,0.45)';
  const hex = colour.startsWith('#');
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, color: colour,
      background: hex ? `${colour}22` : 'rgba(255,255,255,0.08)',
      border: `1px solid ${hex ? `${colour}45` : 'rgba(255,255,255,0.16)'}`,
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
      position: 'fixed', inset: 0, background: 'rgba(1,4,25,0.55)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 560, maxWidth: '92vw', background: DRAWER_BG,
        borderLeft: `1px solid ${ON_DARK.lineHi}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-16px 0 60px rgba(0,0,0,0.55)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>Bulk import contractors</div>
            <div style={{ fontSize: 12, color: ON_DARK.secondary, marginTop: 5, lineHeight: 1.5 }}>
              Drop in a CSV from the FM client. Each row becomes a Cadi Connect invite — your subs sign up free under your unlock.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`, borderRadius: 9, cursor: 'pointer', color: ON_DARK.secondary, padding: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {!parsed && (
          <>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              style={{
                border: '2px dashed rgba(251,146,60,0.45)', background: 'rgba(251,146,60,0.06)',
                borderRadius: 16, padding: 32, textAlign: 'center', cursor: 'pointer',
                marginBottom: 14,
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 13,
                background: 'rgba(251,146,60,0.16)', color: POP.orange, border: '1px solid rgba(251,146,60,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px',
              }}>
                <Upload size={20} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ON_DARK.primary, marginBottom: 4 }}>Drop CSV here, or click to choose</div>
              <div style={{ fontSize: 11, color: ON_DARK.muted }}>Columns: company · contact · email · phone · region · trades</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])}
            />
            <button onClick={downloadTemplate} style={{
              ...ghostButton({ size: 'sm', onDark: true }),
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
            }}>
              <Download size={12} /> Download template
            </button>
            <div style={{
              marginTop: 18, padding: 14, borderRadius: 12, fontSize: 11, lineHeight: 1.6,
              background: 'rgba(79,120,255,0.10)', border: '1px solid rgba(79,120,255,0.30)', color: ON_DARK.secondary,
            }}>
              <strong style={{ color: POP.blue }}>Email is required.</strong> Subs claim their account through the link in the invite email — phone-only rows are rejected.
            </div>
          </>
        )}

        {parsed && !result && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <KpiCard label="Rows in file"  value={previewRows.length} />
              <KpiCard label="Ready to send" value={validCount} pop={POP.green} />
              <KpiCard label="Skipped"       value={skipCount}  pop={skipCount ? POP.amber : ON_DARK.faint} />
            </div>
            <div style={{ ...glassDark({ radius: 14 }), marginBottom: 14, maxHeight: 240, overflowY: 'auto' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.6fr',
                padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderBottom: `1px solid ${ON_DARK.line}`,
                fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <div>Company</div><div>Email</div><div>Region</div><div>Status</div>
              </div>
              {previewRows.length === 0 && (
                <div style={{ padding: 14, fontSize: 11, color: ON_DARK.muted }}>No rows parsed. Check the CSV headers — first row must contain column names.</div>
              )}
              {previewRows.map((r, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 0.8fr 0.6fr',
                  padding: '8px 12px', borderBottom: i < previewRows.length - 1 ? `1px solid ${ON_DARK.line}` : 'none',
                  fontSize: 11, color: ON_DARK.primary, alignItems: 'center',
                }}>
                  <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.company_name || r.contact_name || '—'}</div>
                  <div style={{ color: r.email ? ON_DARK.secondary : ON_DARK.faint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email || '— no email'}</div>
                  <div style={{ color: ON_DARK.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.region || '—'}</div>
                  <div>{r.email
                    ? <span style={{ fontSize: 10, fontWeight: 800, color: POP.green }}>OK</span>
                    : <span style={{ fontSize: 10, fontWeight: 800, color: POP.amber }}>skip</span>}
                  </div>
                </div>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: ON_DARK.primary, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                style={{ accentColor: '#fb923c' }}
              />
              Send invite emails now <span style={{ color: ON_DARK.muted, fontSize: 11 }}>(recommended)</span>
            </label>
            {error && (
              <div style={{
                padding: 12, borderRadius: 12, marginBottom: 14, fontSize: 12,
                background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
              }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button onClick={() => { setParsed(null); setPreviewRows([]); setText(''); }} style={{ ...ghostButton({ size: 'sm', onDark: true }), fontSize: 12 }}>
                ← Pick another file
              </button>
              <button
                onClick={submit}
                disabled={busy || validCount === 0}
                style={{
                  ...primaryButton(),
                  cursor: busy || validCount === 0 ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.7 : validCount === 0 ? 0.45 : 1,
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
            <div style={{
              padding: 18, borderRadius: 14, marginBottom: 14,
              background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.35)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <CheckCircle2 size={22} color={POP.green} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: ON_DARK.primary }}>Imported {result.imported ?? 0} contractor{(result.imported ?? 0) === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 11, color: ON_DARK.secondary }}>
                  {result.emails_sent ?? 0} invite email{(result.emails_sent ?? 0) === 1 ? '' : 's'} sent · {result.skipped ?? 0} skipped
                </div>
              </div>
            </div>
            {result.skipped_reasons && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                <KpiCard label="Duplicates"      value={result.skipped_reasons.duplicate ?? 0} />
                <KpiCard label="Missing email"   value={result.skipped_reasons.missing_contact ?? 0} />
                <KpiCard label="Invalid email"   value={result.skipped_reasons.invalid_email ?? 0} />
              </div>
            )}
            {(result.errors?.length ?? 0) > 0 && (
              <div style={{
                borderRadius: 12, padding: 12, fontSize: 11, marginBottom: 14,
                background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
              }}>
                {result.errors.slice(0, 6).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
            <button onClick={onClose} style={{ ...primaryButton(), width: '100%', justifyContent: 'center', display: 'flex' }}>
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
// Doc-type → friendly label + criticality tag. Ordered by importance.
const FM_DOC_TYPES = [
  { key: 'public_liability',    label: 'Public Liability',        critical: true  },
  { key: 'employers_liability', label: 'Employers Liability',     critical: false },
  { key: 'dbs_basic',           label: 'DBS Basic',                critical: false },
  { key: 'dbs_enhanced',        label: 'DBS Enhanced',             critical: false },
  { key: 'company_reg',         label: 'Companies House cert',     critical: false },
  { key: 'vat_reg',             label: 'VAT registration',         critical: false },
  { key: 'ico_reg',             label: 'ICO registration',         critical: false },
  { key: 'hs_policy',           label: 'H&S policy',               critical: false },
  { key: 'method_statement',    label: 'Method statements / RAMS', critical: false },
];

function docBadgeTone(doc) {
  if (!doc) return 'missing';
  if (doc.expiry_date) {
    const days = Math.round((new Date(doc.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0)   return 'expired';
    if (days <= 30) return 'expiring';
  }
  return 'ok';
}

function ComplianceRow({ type, doc }) {
  const tone = docBadgeTone(doc);
  const critical = type.critical && !doc;
  const color =
    tone === 'ok'         ? POP.green
    : tone === 'expiring' ? POP.amber
    : tone === 'expired'  ? POP.red
    : critical            ? POP.red
                          : 'rgba(255,255,255,0.45)';
  const hex = color.startsWith('#');

  const label =
    tone === 'ok'         ? 'On file'
    : tone === 'expiring' ? 'Expiring'
    : tone === 'expired'  ? 'Expired'
    : critical            ? 'Missing (critical)'
                          : 'Not uploaded';

  async function handleView() {
    if (!doc?.file_path) return;
    try {
      const { signSubDocUrlForFm } = await import('../../lib/db/fmOpsDb');
      const url = await signSubDocUrlForFm(doc.file_path);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      /* silent */
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
      background: 'rgba(255,255,255,0.05)', border: `1px solid ${ON_DARK.line}`, borderRadius: 10,
    }}>
      <span style={{
        fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
        color, background: hex ? `${color}1f` : 'rgba(255,255,255,0.08)',
        border: `1px solid ${hex ? `${color}42` : 'rgba(255,255,255,0.16)'}`, whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {type.label}
        </div>
        {doc && (doc.provider || doc.expiry_date) && (
          <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {doc.provider && <>{doc.provider}</>}
            {doc.provider && doc.expiry_date && ' · '}
            {doc.expiry_date && <>Expires {new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
          </div>
        )}
      </div>
      {doc?.file_path && (
        <button onClick={handleView} style={{
          fontSize: 10, fontWeight: 800, color: POP.blue,
          background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 6px',
        }}>
          View →
        </button>
      )}
    </div>
  );
}

function ContractorDrawer({ sub, onClose }) {
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  useEffect(() => {
    if (!sub?.claimedUserId) { setDocs([]); setAvailability([]); return; }
    setDocsLoading(true);
    setAvailabilityLoading(true);
    import('../../lib/db/fmOpsDb').then(mod => {
      mod.listSubDocsForFm(sub.claimedUserId)
        .then(setDocs)
        .catch(() => setDocs([]))
        .finally(() => setDocsLoading(false));
      mod.listSubAvailabilityForFm(sub.claimedUserId)
        .then(setAvailability)
        .catch(() => setAvailability([]))
        .finally(() => setAvailabilityLoading(false));
    });
  }, [sub?.claimedUserId]);

  if (!sub) return null;

  const docsByType = docs.reduce((acc, d) => { acc[d.doc_type] = d; return acc; }, {});
  const totalOk    = FM_DOC_TYPES.filter(t => docsByType[t.key]).length;
  const missingCritical = FM_DOC_TYPES.some(t => t.critical && !docsByType[t.key]);

  const sectionCard = { ...glassDark({ radius: 14, padding: 14 }), marginBottom: 14 };
  const sectionLabel = { fontSize: 10, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.08em', textTransform: 'uppercase' };

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
            <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>{sub.companyName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <StatusPill status={sub.status} />
              <TierBadge tier={sub.tier} />
              {sub.region && <span style={{ fontSize: 10, color: ON_DARK.secondary, fontWeight: 700 }}><MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />{sub.region}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`, borderRadius: 9, cursor: 'pointer', color: ON_DARK.secondary, padding: 6, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          <KpiCard label="Connect score" value={sub.score ?? '—'} pop={sub.score ? POP.blue : ON_DARK.faint} />
          <KpiCard label="Capacity"      value={sub.capacity ?? '—'} pop={sub.capacity ? POP.green : ON_DARK.faint} />
        </div>

        <div style={sectionCard}>
          <div style={{ ...sectionLabel, marginBottom: 8 }}>Contact</div>
          {sub.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: ON_DARK.primary }}>
              <Mail size={12} color={ON_DARK.muted} /> <span>{sub.email}</span>
            </div>
          )}
          {sub.phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 12, color: ON_DARK.primary }}>
              <Phone size={12} color={ON_DARK.muted} /> <span>{sub.phone}</span>
            </div>
          )}
          {sub.contactName && (
            <div style={{ fontSize: 11, color: ON_DARK.muted, paddingTop: 6 }}>Contact · {sub.contactName}</div>
          )}
        </div>

        {sub.trades?.length > 0 && (
          <div style={sectionCard}>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>Trades</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sub.trades.map(t => (
                <span key={t} style={{
                  fontSize: 10, fontWeight: 700, color: ON_DARK.secondary,
                  background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`,
                  padding: '4px 10px', borderRadius: 999,
                }}>{t}</span>
              ))}
            </div>
          </div>
        )}

        {/* Compliance & insurance — only meaningful for claimed subs */}
        {sub.claimedUserId && (
          <div style={sectionCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={sectionLabel}>Compliance & insurance</div>
                <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                  {docsLoading
                    ? 'Loading…'
                    : missingCritical
                      ? '⚠ Missing critical document (Public Liability)'
                      : `${totalOk} of ${FM_DOC_TYPES.length} on file`}
                </div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: missingCritical ? POP.red : (totalOk === FM_DOC_TYPES.length ? POP.green : ON_DARK.primary) }}>
                {totalOk}<span style={{ color: ON_DARK.faint, fontSize: 11, fontWeight: 500 }}>/{FM_DOC_TYPES.length}</span>
              </div>
            </div>
            {!docsLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {FM_DOC_TYPES.map(t => (
                  <ComplianceRow key={t.key} type={t} doc={docsByType[t.key]} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming availability blocks — from the sub's own schedule */}
        {sub.claimedUserId && (
          <div style={sectionCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={sectionLabel}>Upcoming unavailability</div>
              {availability.length > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, color: POP.amber,
                  background: 'rgba(251,191,36,0.14)', border: '1px solid rgba(251,191,36,0.35)',
                  padding: '3px 8px', borderRadius: 999,
                }}>
                  {availability.length} block{availability.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {availabilityLoading && (
              <div style={{ fontSize: 11, color: ON_DARK.faint, fontStyle: 'italic' }}>Loading…</div>
            )}
            {!availabilityLoading && availability.length === 0 && (
              <div style={{ fontSize: 11, color: ON_DARK.faint, fontStyle: 'italic' }}>
                No holidays or downtime scheduled — full availability.
              </div>
            )}
            {!availabilityLoading && availability.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {availability.map(b => {
                  const s = new Date(b.start_date);
                  const e = new Date(b.end_date);
                  const opts = { day: 'numeric', month: 'short', year: s.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' };
                  const range = b.start_date === b.end_date
                    ? s.toLocaleDateString('en-GB', opts)
                    : `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', opts)}`;
                  return (
                    <div key={b.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 10,
                      background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: POP.amber }}>{range}</div>
                        {b.reason && (
                          <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.75)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.reason}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div style={{
          background: 'rgba(79,120,255,0.08)', border: '1px solid rgba(79,120,255,0.25)',
          borderRadius: 12, padding: 14, fontSize: 11, color: ON_DARK.secondary, lineHeight: 1.6,
        }}>
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
                FM Operations · Contractors
              </div>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', color: ON_DARK.primary, margin: 0 }}>
              Your contractor <span style={{ color: POP.blue }}>network</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6, maxWidth: 560 }}>
              Bulk-import from the FM client, track invites + compliance, allocate to sites.
            </div>
          </div>
          <button
            onClick={() => setImportOpen(true)}
            className={HOVER_LIFT}
            style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Upload size={14} /> Bulk import
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          <KpiCard label="Contractors in network" value={kpis.total} />
          <KpiCard label="Active (claimed)"        value={kpis.active}  pop={POP.green} />
          <KpiCard label="Pending invites"         value={kpis.pending} pop={kpis.pending ? POP.orange : ON_DARK.faint} />
          <KpiCard label="Average score"           value={kpis.avgScore ?? '—'} pop={POP.blue} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
          <button
            onClick={() => setImportOpen(true)}
            className={HOVER_LIFT}
            style={{
              background: 'rgba(251,146,60,0.07)', border: '1px dashed rgba(251,146,60,0.40)', borderRadius: 16,
              padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(251,146,60,0.16)', color: POP.orange, border: '1px solid rgba(251,146,60,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Upload size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>Bulk import (CSV)</div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 2 }}>Up to 500 rows. Sends Cadi Connect invite emails automatically.</div>
            </div>
            <ChevronRight size={14} color={ON_DARK.faint} />
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className={HOVER_LIFT}
            style={{
              background: 'rgba(52,211,153,0.06)', border: '1px dashed rgba(52,211,153,0.40)', borderRadius: 16,
              padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(52,211,153,0.14)', color: POP.green, border: '1px solid rgba(52,211,153,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>Invite individual</div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 2 }}>Add a single contractor with an email — same import flow, one row.</div>
            </div>
            <ChevronRight size={14} color={ON_DARK.faint} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
            <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading contractors…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>
            Couldn't load contractors — {error}
          </div>
        )}

        {!loading && !error && contractors.length === 0 && (
          <div style={{ padding: '44px 24px', borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.16)', textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'rgba(79,120,255,0.18)', color: POP.blue, border: '1px solid rgba(79,120,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <Users size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>No contractors yet</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, maxWidth: 400, margin: '0 auto 18px', lineHeight: 1.6 }}>
              Drop in the FM client's sub list and Cadi sends free Connect invites — you'll see them appear here as they sign up.
            </div>
            <button
              onClick={() => setImportOpen(true)}
              className={HOVER_LIFT}
              style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
            >
              <Upload size={14} /> Bulk import
            </button>
          </div>
        )}

        {!loading && !error && regions.map((bucket, idx) => {
          const colour = colourFor(bucket.region, idx);
          return (
            <div key={bucket.region} style={{ ...glassDark({ radius: 18 }), marginBottom: 14, overflow: 'hidden' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: `${colour}14`, borderBottom: `1px solid ${ON_DARK.line}`,
                borderLeft: `4px solid ${colour}`,
              }}>
                <MapPin size={14} color={colour} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary }}>{bucket.region}</div>
                  <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                    {bucket.subs.length} contractor{bucket.subs.length === 1 ? '' : 's'} · {bucket.subs.filter(s => s.status === 'claimed').length} active
                  </div>
                </div>
              </div>
              {bucket.subs.map((sub, i) => (
                <div
                  key={sub.id}
                  onClick={() => setOpenSub(sub)}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1fr 100px 30px',
                    padding: '12px 16px',
                    borderTop: i > 0 ? `1px solid ${ON_DARK.line}` : 'none',
                    borderLeft: `4px solid ${colour}`,
                    alignItems: 'center', fontSize: 11, cursor: 'pointer',
                    transition: 'background 150ms ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: `${colour}22`, color: colour,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 900, flexShrink: 0,
                    }}>{(sub.companyName?.[0] ?? '?').toUpperCase()}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.companyName}</div>
                      <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sub.email || sub.phone || sub.contactName || '—'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(sub.trades ?? []).slice(0, 3).map(t => (
                      <span key={t} style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 6,
                        background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`,
                        color: ON_DARK.secondary, fontWeight: 700,
                      }}>{t}</span>
                    ))}
                    {!sub.trades?.length && <span style={{ fontSize: 10, color: ON_DARK.faint }}>—</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusPill status={sub.status} />
                    <TierBadge tier={sub.tier} />
                  </div>
                  <div style={{ fontSize: 11, color: ON_DARK.muted }}>
                    Score <strong style={{ color: ON_DARK.primary }}>{sub.score ?? '—'}</strong>
                  </div>
                  <ChevronRight size={14} color={ON_DARK.faint} />
                </div>
              ))}
            </div>
          );
        })}

        {importOpen && <BulkImportDrawer onClose={() => setImportOpen(false)} onImported={load} />}
        {openSub   && <ContractorDrawer sub={openSub} onClose={() => setOpenSub(null)} />}
      </div>
    </div>
  );
}
