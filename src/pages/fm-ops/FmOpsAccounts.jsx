import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Eye,
  MapPin,
  FileDown,
  FileText,
  PoundSterling,
  Settings,
} from 'lucide-react';
import {
  listFmInvoices,
  getFmInvoiceDetail,
  markInvoicePaid,
  markInvoiceExported,
  previewAccountsExport,
  runAccountsExport,
  markInvoicesPaid,
  INVOICE_STATUS,
} from '../../lib/db/fmOpsDb';
import { greenCanvas, greenButton, ghostButton } from '../../lib/connectTheme';

// ── Business-Lab palette (matches BusinessLab.jsx) ──────────────────────────
const SKY = 'rgba(153,197,255,0.5)'; // muted sky labels
const SKY_POP = '#99c5ff'; // bright sky accent
const EMERALD = '#34d399'; // success / money in
const AMBER = '#fbbf24'; // needs action
const CARD_LINE = 'rgba(153,197,255,0.12)';

// Emerald gradient card — the Business Lab surface.
function labCard(radius = 16, padding) {
  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius,
    border: `1px solid ${CARD_LINE}`,
    background: 'linear-gradient(145deg, #052e1c 0%, #064e3b 50%, #065f46 100%)',
    boxShadow: 'inset 0 1px 0 rgba(153,197,255,0.18), 0 20px 40px -24px rgba(0,0,0,0.5)',
    ...(padding != null ? { padding } : {}),
  };
}

const DRAWER_BG = 'linear-gradient(180deg, #04331f 0%, #021a10 60%, #01120b 100%)';

const TABS = [
  { id: 'submitted', label: 'With FM' },
  { id: 'exported', label: 'Exported' },
  { id: 'paid', label: 'Paid' },
  { id: 'all', label: 'All' },
];

// INVOICE_STATUS db colours are for light surfaces — brighten for the
// dark emerald canvas.
const STATUS_POP = {
  draft: 'rgba(255,255,255,0.50)',
  submitted: AMBER,
  exported: SKY_POP,
  paid: EMERALD,
};

function StatusPill({ status }) {
  const m = INVOICE_STATUS[status] || { label: status };
  const c = STATUS_POP[status] || 'rgba(255,255,255,0.55)';
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
    <div style={labCard(14, '13px 15px')}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || '#ffffff', lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          color: SKY,
          fontWeight: 800,
          letterSpacing: '0.10em',
          textTransform: 'uppercase',
          marginTop: 7,
        }}
      >
        {label}
      </div>
    </div>
  );
}

const sectionLabel = {
  fontSize: 10,
  fontWeight: 800,
  color: SKY,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
};
const darkInput = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  border: '1px solid rgba(153,197,255,0.25)',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.08)',
  color: '#ffffff',
  outline: 'none',
  colorScheme: 'dark',
};

function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Export drawer ───────────────────────────────────────────────────────────
function ExportDrawer({ onClose, onDone }) {
  // Default period: current calendar month
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [periodFrom, setPeriodFrom] = useState(firstOfMonth);
  const [periodTo, setPeriodTo] = useState(today);
  const [periodLabel, setPeriodLabel] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const doPreview = async () => {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const { ok, data } = await previewAccountsExport({ periodFrom, periodTo });
      if (!ok) throw new Error(data?.error || 'Preview failed');
      setPreview(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await runAccountsExport({
        periodFrom,
        periodTo,
        periodLabel: periodLabel.trim() || `${periodFrom} → ${periodTo}`,
      });
      if (!ok) throw new Error(data?.error || 'Export failed');
      // Use the platform-specific filename the function returns (e.g.
      // sage50-purchase-invoices-2026-06.csv). Falls back to a generic
      // name if the server didn't include one.
      downloadCsv(data.filename || `cadi-connect-${periodFrom}_${periodTo}.csv`, data.csv);
      onDone?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,18,11,0.60)',
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
          background: DRAWER_BG,
          borderLeft: `1px solid ${CARD_LINE}`,
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
            <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff' }}>
              Export to accounts
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.70)',
                marginTop: 5,
                lineHeight: 1.5,
              }}
            >
              Pick a period, preview the CSV, then export — submitted invoices in range flip to
              "exported".
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${CARD_LINE}`,
              borderRadius: 9,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              padding: 6,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <div style={{ ...sectionLabel, marginBottom: 4 }}>From</div>
            <input
              type="date"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              style={darkInput}
            />
          </div>
          <div>
            <div style={{ ...sectionLabel, marginBottom: 4 }}>To</div>
            <input
              type="date"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              style={darkInput}
            />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...sectionLabel, marginBottom: 4 }}>Period label (optional)</div>
          <input
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="e.g. June 2026"
            style={darkInput}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button
            onClick={doPreview}
            disabled={busy}
            style={{
              ...ghostButton({ onDark: true }),
              flex: 1,
              fontSize: 12,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {busy && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
            <Eye size={12} /> Preview
          </button>
          <button
            onClick={doExport}
            disabled={busy || !preview || preview.row_count === 0}
            style={{
              ...greenButton(),
              flex: 1,
              fontSize: 12,
              opacity: busy || !preview || preview.row_count === 0 ? 0.45 : 1,
              cursor: busy || !preview ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Download size={12} /> Export &amp; download
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              background: 'rgba(220,38,38,0.16)',
              border: '1px solid rgba(248,113,113,0.40)',
              color: '#fecaca',
            }}
          >
            {error}
          </div>
        )}

        {preview && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
                marginBottom: 14,
              }}
            >
              <Kpi
                label="Rows in period"
                value={preview.row_count}
                pop={preview.row_count ? SKY_POP : 'rgba(255,255,255,0.4)'}
              />
              <Kpi
                label="Total value"
                value={`£${Number(preview.total_value).toFixed(2)}`}
                pop={preview.row_count ? EMERALD : 'rgba(255,255,255,0.4)'}
              />
            </div>
            {preview.row_count === 0 ? (
              <div
                style={{
                  padding: 14,
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${CARD_LINE}`,
                  borderRadius: 12,
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.65)',
                }}
              >
                No submitted invoices in this period. Subs need to submit drafts before they appear
                here.
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: `1px solid ${CARD_LINE}`,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: 'ui-monospace,Menlo,monospace',
                  fontSize: 11,
                  color: SKY_POP,
                  maxHeight: 220,
                  overflow: 'auto',
                  whiteSpace: 'pre',
                }}
              >
                {preview.csv.split('\n').slice(0, 12).join('\n')}
                {preview.csv.split('\n').length > 12 ? '\n…' : ''}
              </div>
            )}
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Invoice detail drawer ──────────────────────────────────────────────────
// FM-side equivalent of the sub's InvoiceDetailDrawer. Shows the full line
// items, lets the FM download a PDF rendering of what the sub sent, and
// exposes single-invoice mark-paid / mark-exported actions so they don't
// have to use the bulk flow for one-offs.
function InvoiceDetailDrawer({ invoiceId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'pdf' | 'paid' | 'exported'

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getFmInvoiceDetail(invoiceId));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when invoiceId changes; load() is redefined each render
  useEffect(() => {
    load();
  }, [invoiceId]);

  async function handleDownloadPdf() {
    if (!detail) return;
    setBusy('pdf');
    setError(null);
    try {
      const { generateInvoicePdf } = await import('../../lib/invoicePdf');
      // FM-side can see the sub's profile basics (business_name, name) via
      // the join, but RLS hides the sub's business_settings — so bank info /
      // VAT number / detailed address aren't available here. Render with what
      // we have; the sub's own download has the full branding.
      const pdf = generateInvoicePdf(
        {
          num: detail.reference || 'INVOICE',
          date: detail.submitted_at || detail.created_at || new Date().toISOString(),
          dueDate: '',
          customer: {
            name: detail.fm_organisation?.name || 'Facilities Manager',
            address: '',
            email: '',
          },
          lines: (detail.lines || []).map((l) => ({
            desc: l.description,
            qty: 1,
            rate: Number(l.net_value ?? 0),
            serviceDate: l.service_date,
          })),
          notes: detail.note || '',
          bankName: '',
          sortCode: '',
          accountNum: '',
          terms: 'Net 14',
        },
        {
          name: detail.subName,
          address: detail.sub?.postcode || '',
          email: '',
          phone: detail.sub?.phone || '',
          vatNumber: '',
          companyNum: '',
          entityType: 'sole_trader',
          registeredOffice: '',
          privacyUrl: 'https://cadi.cleaning/privacy.html',
          termsUrl: 'https://cadi.cleaning/terms.html',
        },
        { vatRegistered: Number(detail.vat_value ?? 0) > 0 }
      );
      // Blob URL + new tab (same approach as sub-side preview — iOS Safari friendly)
      const byteChars = atob(pdf.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = pdf.filename || `${detail.reference || 'invoice'}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      setError(e.message || 'Could not generate PDF.');
    } finally {
      setBusy(null);
    }
  }

  async function handleMarkPaid() {
    setBusy('paid');
    setError(null);
    const { ok, error: e } = await markInvoicePaid(invoiceId);
    if (!ok) {
      setError(e?.message || 'Mark paid failed.');
      setBusy(null);
      return;
    }
    onChanged?.();
    await load();
    setBusy(null);
  }

  async function handleMarkExported() {
    setBusy('exported');
    setError(null);
    const { ok, error: e } = await markInvoiceExported(invoiceId);
    if (!ok) {
      setError(e?.message || 'Mark exported failed.');
      setBusy(null);
      return;
    }
    onChanged?.();
    await load();
    setBusy(null);
  }

  const totalNet = (detail?.lines ?? []).reduce((s, l) => s + Number(l.net_value ?? 0), 0);
  const totalVat = (detail?.lines ?? []).reduce((s, l) => s + Number(l.vat_value ?? 0), 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,18,11,0.60)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: '94vw',
          background: DRAWER_BG,
          borderLeft: `1px solid ${CARD_LINE}`,
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
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color="rgba(255,255,255,0.7)"
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />{' '}
            Loading invoice…
          </div>
        )}
        {!loading && error && !detail && (
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
        {!loading && detail && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: SKY,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontFamily: 'ui-monospace, Menlo, monospace',
                  }}
                >
                  {detail.reference}
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', marginTop: 3 }}>
                  {detail.subName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.60)', marginTop: 4 }}>
                  {detail.lines?.length ?? 0} line{detail.lines?.length === 1 ? '' : 's'} ·
                  submitted{' '}
                  {detail.submitted_at ? new Date(detail.submitted_at).toLocaleDateString() : '—'}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${CARD_LINE}`,
                  borderRadius: 9,
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.7)',
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
                gridTemplateColumns: 'repeat(3,1fr)',
                gap: 8,
                marginBottom: 14,
              }}
            >
              <Kpi label="Net £" value={`£${Number(detail.net_value ?? 0).toFixed(2)}`} />
              <Kpi
                label="VAT £"
                value={`£${Number(detail.vat_value ?? 0).toFixed(2)}`}
                pop={SKY_POP}
              />
              <Kpi
                label="Total £"
                value={`£${(Number(detail.net_value ?? 0) + Number(detail.vat_value ?? 0)).toFixed(2)}`}
                pop={EMERALD}
              />
            </div>

            {/* Status strip */}
            <div
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${CARD_LINE}`,
                borderRadius: 12,
                padding: '10px 14px',
                marginBottom: 14,
                fontSize: 12,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <StatusPill status={detail.status} />
              {detail.submitted_at && (
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  · Submitted {new Date(detail.submitted_at).toLocaleDateString()}
                </span>
              )}
              {detail.exported_at && (
                <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                  · Exported {new Date(detail.exported_at).toLocaleDateString()}
                </span>
              )}
              {detail.paid_at && (
                <span style={{ color: EMERALD, fontWeight: 800 }}>
                  · Paid {new Date(detail.paid_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Line items table */}
            <div style={{ ...labCard(14), marginBottom: 14 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 1fr 1fr',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.20)',
                  borderBottom: `1px solid ${CARD_LINE}`,
                  ...sectionLabel,
                }}
              >
                <div>Site / description</div>
                <div>Service date</div>
                <div style={{ textAlign: 'right' }}>Net £</div>
              </div>
              {(detail.lines ?? []).map((l, i) => (
                <div
                  key={l.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr 1fr',
                    padding: '10px 14px',
                    borderBottom: i < detail.lines.length - 1 ? `1px solid ${CARD_LINE}` : 'none',
                    alignItems: 'center',
                    fontSize: 12,
                    color: '#ffffff',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {l.description}
                    </div>
                    {l.job?.site?.postcode && (
                      <div
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.55)',
                          marginTop: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <MapPin size={9} /> {l.job.site.postcode}
                      </div>
                    )}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.60)' }}>
                    {l.service_date ? new Date(l.service_date).toLocaleDateString() : '—'}
                  </div>
                  <div style={{ fontWeight: 800, textAlign: 'right' }}>
                    £{Number(l.net_value ?? 0).toFixed(2)}
                  </div>
                </div>
              ))}
              {(!detail.lines || detail.lines.length === 0) && (
                <div
                  style={{
                    padding: 14,
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.45)',
                    fontStyle: 'italic',
                  }}
                >
                  No line items.
                </div>
              )}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.6fr 1fr 1fr',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.20)',
                  borderTop: `2px solid ${CARD_LINE}`,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                <div>Net total</div>
                <div></div>
                <div style={{ textAlign: 'right' }}>£{totalNet.toFixed(2)}</div>
              </div>
              {totalVat > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr 1fr',
                    padding: '8px 14px',
                    background: 'rgba(0,0,0,0.20)',
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.60)',
                  }}
                >
                  <div>VAT (sub's rate)</div>
                  <div></div>
                  <div style={{ textAlign: 'right' }}>£{totalVat.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Sub's note */}
            {detail.note && (
              <div
                style={{
                  background: 'rgba(153,197,255,0.10)',
                  border: '1px solid rgba(153,197,255,0.25)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 12,
                  color: '#ffffff',
                  marginBottom: 14,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: SKY_POP,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Sub's note
                </div>
                {detail.note}
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: 10,
                  marginBottom: 10,
                  borderRadius: 10,
                  fontSize: 12,
                  background: 'rgba(220,38,38,0.16)',
                  border: '1px solid rgba(248,113,113,0.40)',
                  color: '#fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <AlertCircle size={13} /> {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <button
                onClick={handleDownloadPdf}
                disabled={busy !== null}
                style={{
                  ...ghostButton({ onDark: true }),
                  padding: '10px 12px',
                  fontSize: 12,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {busy === 'pdf' ? (
                  <>
                    <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />{' '}
                    Generating…
                  </>
                ) : (
                  <>
                    <FileDown size={12} /> Download PDF
                  </>
                )}
              </button>
              <button
                onClick={handleMarkExported}
                disabled={busy !== null || detail.status === 'exported' || detail.status === 'paid'}
                title={
                  detail.status === 'paid'
                    ? 'Already paid'
                    : detail.status === 'exported'
                      ? 'Already exported'
                      : 'Mark as pushed to your accounts system'
                }
                style={{
                  background: 'rgba(153,197,255,0.12)',
                  color: SKY_POP,
                  border: '1px solid rgba(153,197,255,0.35)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor:
                    busy || detail.status === 'exported' || detail.status === 'paid'
                      ? 'not-allowed'
                      : 'pointer',
                  opacity: detail.status === 'exported' || detail.status === 'paid' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {busy === 'exported' ? (
                  <>
                    <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> …
                  </>
                ) : (
                  <>
                    <FileText size={12} /> Mark exported
                  </>
                )}
              </button>
              <button
                onClick={handleMarkPaid}
                disabled={busy !== null || detail.status === 'paid'}
                style={{
                  ...greenButton(),
                  padding: '10px 12px',
                  fontSize: 12,
                  cursor: busy || detail.status === 'paid' ? 'not-allowed' : 'pointer',
                  opacity: detail.status === 'paid' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {busy === 'paid' ? (
                  <>
                    <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} /> …
                  </>
                ) : (
                  <>
                    <PoundSterling size={12} /> Mark paid
                  </>
                )}
              </button>
            </div>
          </>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function FmOpsAccounts() {
  const [tab, setTab] = useState('submitted');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [openId, setOpenId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [counts, setCounts] = useState({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = tab === 'all' ? null : tab;
      const rows = await listFmInvoices({ status: filter });
      setInvoices(rows);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // counts via all-rows (one fetch on mount + after actions)
  const loadCounts = async () => {
    try {
      const all = await listFmInvoices({});
      const c = { submitted: 0, exported: 0, paid: 0, all: all.length };
      all.forEach((i) => {
        if (c[i.status] != null) c[i.status]++;
      });
      setCounts(c);
    } catch {}
  };
  useEffect(() => {
    loadCounts();
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when tab changes; load() is redefined each render
  useEffect(() => {
    load();
  }, [tab]);

  const totals = useMemo(
    () => ({
      count: invoices.length,
      total: invoices.reduce((a, i) => a + (Number(i.total_value) || 0), 0),
      selected: invoices
        .filter((i) => selected.has(i.id))
        .reduce((a, i) => a + (Number(i.total_value) || 0), 0),
    }),
    [invoices, selected]
  );

  const toggleAll = () => {
    if (selected.size === invoices.length) setSelected(new Set());
    else setSelected(new Set(invoices.map((i) => i.id)));
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleMarkPaid = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Mark ${selected.size} invoice${selected.size === 1 ? '' : 's'} as paid?`)) return;
    setMarking(true);
    setError(null);
    try {
      const { ok, data } = await markInvoicesPaid([...selected]);
      if (!ok) throw new Error(data?.error || 'Mark-paid failed');
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setMarking(false);
    }
  };

  const canMarkPaid = tab === 'submitted' || tab === 'exported' || tab === 'all';

  return (
    <div style={{ ...greenCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 11,
                  background: 'rgba(52,211,153,0.18)',
                  color: EMERALD,
                  border: '1px solid rgba(52,211,153,0.40)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Receipt size={17} />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: SKY,
                }}
              >
                FM Operations · Accounts
              </div>
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: '#ffffff',
                margin: 0,
              }}
            >
              The accounts <span style={{ color: EMERALD }}>inbox</span>
            </h1>
            <div
              style={{
                fontSize: 12.5,
                color: 'rgba(255,255,255,0.72)',
                marginTop: 6,
                maxWidth: 560,
              }}
            >
              Submitted sub invoices, exports to your accounts system, and bulk mark-as-paid.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to="/fm-ops/accounts/settings"
              style={{
                ...ghostButton({ onDark: true }),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                textDecoration: 'none',
              }}
              title="Configure accounting platform, codes and supplier mapping"
            >
              <Settings size={13} /> Settings
            </Link>
            <button
              onClick={() => setExportOpen(true)}
              className="transition-all duration-200 hover:-translate-y-0.5"
              style={{ ...greenButton(), display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <Download size={14} /> Export to CSV
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <Kpi
            label="With FM (to action)"
            value={counts.submitted ?? 0}
            pop={counts.submitted ? AMBER : 'rgba(255,255,255,0.4)'}
          />
          <Kpi label="Exported" value={counts.exported ?? 0} pop={SKY_POP} />
          <Kpi label="Paid" value={counts.paid ?? 0} pop={EMERALD} />
          <Kpi label="Value in view" value={`£${totals.total.toFixed(0)}`} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ ...labCard(12), display: 'flex', gap: 4, padding: 4 }}>
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
                    background: active ? 'rgba(52,211,153,0.20)' : 'transparent',
                    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                    border: active ? '1px solid rgba(52,211,153,0.40)' : '1px solid transparent',
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
                        background: active ? EMERALD : 'rgba(255,255,255,0.10)',
                        color: active ? '#01120b' : 'rgba(255,255,255,0.65)',
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
          {canMarkPaid && selected.size > 0 && (
            <button
              onClick={handleMarkPaid}
              disabled={marking}
              style={{
                ...greenButton({ size: 'sm' }),
                cursor: marking ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {marking && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />}
              <CheckCircle2 size={12} /> Mark {selected.size} paid · £{totals.selected.toFixed(0)}
            </button>
          )}
        </div>

        {loading && (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color="rgba(255,255,255,0.7)"
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 10px',
              }}
            />{' '}
            Loading invoices…
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

        {!loading && !error && invoices.length === 0 && (
          <div
            style={{
              padding: '44px 24px',
              borderRadius: 18,
              border: '1.5px dashed rgba(153,197,255,0.20)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(52,211,153,0.14)',
                color: EMERALD,
                border: '1px solid rgba(52,211,153,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Receipt size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#ffffff', marginBottom: 6 }}>
              No invoices here yet
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.60)',
                maxWidth: 400,
                margin: '0 auto',
                lineHeight: 1.6,
              }}
            >
              Subs submit drafts after their work is approved — they show up in{' '}
              <strong style={{ color: '#ffffff' }}>With FM</strong> ready for export.
            </div>
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <div style={{ ...labCard(18), overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1.4fr 1.4fr 1fr 1fr 1fr 1fr',
                padding: '11px 18px',
                background: 'rgba(0,0,0,0.20)',
                borderBottom: `1px solid ${CARD_LINE}`,
                ...sectionLabel,
                alignItems: 'center',
              }}
            >
              <input
                type="checkbox"
                checked={invoices.length > 0 && selected.size === invoices.length}
                onChange={toggleAll}
                style={{ accentColor: '#10b981', cursor: 'pointer' }}
              />
              <div>Reference</div>
              <div>Sub · Site</div>
              <div>Service date</div>
              <div>Net £</div>
              <div>Total £</div>
              <div>Status</div>
            </div>
            {invoices.map((inv, i) => (
              <div
                key={inv.id}
                onClick={() => setOpenId(inv.id)}
                onMouseEnter={(e) => {
                  if (!selected.has(inv.id))
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!selected.has(inv.id)) e.currentTarget.style.background = 'transparent';
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '32px 1.4fr 1.4fr 1fr 1fr 1fr 1fr',
                  padding: '12px 18px',
                  borderBottom: i < invoices.length - 1 ? `1px solid ${CARD_LINE}` : 'none',
                  alignItems: 'center',
                  fontSize: 12,
                  color: '#ffffff',
                  background: selected.has(inv.id) ? 'rgba(52,211,153,0.08)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(inv.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleOne(inv.id)}
                  disabled={inv.status === 'paid' || inv.status === 'draft'}
                  style={{
                    accentColor: '#10b981',
                    cursor:
                      inv.status === 'paid' || inv.status === 'draft' ? 'not-allowed' : 'pointer',
                  }}
                />
                <div
                  style={{
                    fontWeight: 800,
                    fontFamily: 'ui-monospace,Menlo,monospace',
                    fontSize: 11,
                  }}
                >
                  {inv.reference ?? '—'}
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
                    {inv.subName}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'rgba(255,255,255,0.55)',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inv.siteName ?? '—'}
                    {inv.sitePostcode ? ` · ${inv.sitePostcode}` : ''}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.60)' }}>
                  {inv.service_date ? new Date(inv.service_date).toLocaleDateString() : '—'}
                </div>
                <div>£{Number(inv.net_value ?? 0).toFixed(2)}</div>
                <div style={{ fontWeight: 800 }}>£{Number(inv.total_value ?? 0).toFixed(2)}</div>
                <div>
                  <StatusPill status={inv.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        {exportOpen && (
          <ExportDrawer
            onClose={() => setExportOpen(false)}
            onDone={() => {
              load();
              loadCounts();
            }}
          />
        )}
        {openId && (
          <InvoiceDetailDrawer
            invoiceId={openId}
            onClose={() => setOpenId(null)}
            onChanged={() => {
              load();
              loadCounts();
            }}
          />
        )}
      </div>
    </div>
  );
}
