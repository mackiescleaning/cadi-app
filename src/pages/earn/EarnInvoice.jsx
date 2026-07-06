import { useEffect, useMemo, useState } from 'react';
import {
  Receipt,
  FileText,
  AlertCircle,
  Building2,
  MapPin,
  Camera,
  Layers,
  Eye,
  Send,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  listMyConnectInvoices,
  submitConnectInvoice,
  mergeConnectInvoices,
} from '../../lib/db/connectDb';
import { getBusinessSettings } from '../../lib/db/settingsDb';
import { supabase } from '../../lib/supabase';
import EarnInvoiceUploadWizard from './EarnInvoiceUploadWizard';
import {
  CONNECT_COLORS,
  CONNECT_RADII,
  ON_DARK,
  glassDark,
  orangeCanvas,
  HOVER_LIFT,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const GREEN = '#22c55e';
const PURPLE = '#c084fc';
const BLUE = '#7ea3ff';

const STATUS_CFG = {
  draft: { label: 'Draft · ready to submit', color: '#ffd7bf' },
  submitted: { label: 'Submitted · with FM', color: PURPLE },
  exported: { label: 'Exported to FM accounts', color: BLUE },
  paid: { label: 'Paid', color: GREEN },
  disputed: { label: 'Disputed', color: '#f87171' },
  void: { label: 'Merged into another invoice', color: '#a3a3a3' },
};

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const SUBLABEL = {
  fontSize: 10,
  fontWeight: 800,
  color: ON_DARK.muted,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

/* ─── Invoice row ─────────────────────────────────────────────────────────── */
function InvoiceRow({ inv, selected, onToggle, onOpen, mergeDisabledReason }) {
  const status = STATUS_CFG[inv.status] || STATUS_CFG.draft;
  const isDraft = inv.status === 'draft';
  const lineCount = inv.lines?.length ?? 0;

  return (
    <div
      className={HOVER_LIFT}
      style={{
        ...glassDark({ padding: 16, radius: CONNECT_RADII.lg, strong: selected }),
        borderLeft: `3px solid ${selected ? ORANGE : status.color}`,
        boxShadow: selected
          ? '0 0 0 2px rgba(194,65,12,0.35), 0 20px 40px -20px rgba(0,0,0,0.35)'
          : '0 20px 40px -20px rgba(0,0,0,0.35)',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      {isDraft && (
        <label
          onClick={(e) => e.stopPropagation()}
          title={mergeDisabledReason || 'Select to merge with other drafts for the same FM'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            marginTop: 2,
            flexShrink: 0,
            cursor: mergeDisabledReason ? 'not-allowed' : 'pointer',
            opacity: mergeDisabledReason ? 0.4 : 1,
          }}
        >
          <input
            type="checkbox"
            checked={!!selected}
            disabled={!!mergeDisabledReason}
            onChange={() => onToggle(inv.id)}
            style={{ width: 16, height: 16, accentColor: ORANGE, cursor: 'inherit' }}
          />
        </label>
      )}
      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onOpen(inv.id)}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: status.color,
              background: `${status.color}22`,
              border: `1px solid ${status.color}44`,
              padding: '3px 9px',
              borderRadius: 999,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}
          >
            {status.label}
          </span>
          <span style={{ fontSize: 10, color: ON_DARK.muted }}>{inv.reference ?? '—'}</span>
          {lineCount > 1 && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: '#ffffff',
                background: 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.16)',
                padding: '3px 8px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Layers size={9} /> {lineCount} sites
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
          {lineCount === 1
            ? (inv.job?.site?.name ?? inv.lines?.[0]?.description ?? 'Cleaning service')
            : `Bundle — ${lineCount} sites`}
        </div>
        <div
          style={{
            fontSize: 11,
            color: ON_DARK.muted,
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          <Building2 size={10} /> {inv.fm_organisation?.name ?? '—'}
          {lineCount === 1 && inv.job?.site?.postcode && (
            <>
              <span style={{ opacity: 0.5 }}>·</span>
              <MapPin size={10} /> {inv.job.site.postcode}
            </>
          )}
          <span style={{ opacity: 0.5 }}>·</span>
          Service {fmtDate(inv.service_date)}
        </div>
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 12 }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '7px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
              £{Number(inv.net_value ?? 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>
              net
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              padding: '7px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
              £{Number(inv.vat_value ?? 0).toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>
              VAT
            </div>
          </div>
          <div
            style={{
              background: 'rgba(255,176,138,0.16)',
              border: '1px solid rgba(255,176,138,0.32)',
              borderRadius: 8,
              padding: '7px 8px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 900, color: '#ffd7bf' }}>
              £{(Number(inv.net_value ?? 0) + Number(inv.vat_value ?? 0)).toFixed(2)}
            </div>
            <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>
              total
            </div>
          </div>
        </div>
      </div>
      <ChevronRight
        size={16}
        color="rgba(255,255,255,0.55)"
        style={{ flexShrink: 0, marginTop: 4 }}
      />
    </div>
  );
}

/* ─── Detail drawer ───────────────────────────────────────────────────────── */
function InvoiceDetailDrawer({ invoice, onClose, onSubmitted }) {
  const [netInput, setNetInput] = useState(String(invoice.net_value ?? 0));
  const [vatInput, setVatInput] = useState(String(invoice.vat_value ?? 0));
  const [note, setNote] = useState(invoice.note ?? '');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const isDraft = invoice.status === 'draft';
  const lines = invoice.lines ?? [];
  const totalNet = lines.reduce((s, l) => s + Number(l.net_value ?? 0), 0);

  async function fetchBusinessAndTemplate() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return { business: {}, vatRegistered: false };

    const [{ data: profile }, settings] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, business_name, first_name, last_name, phone, postcode')
        .eq('id', user.id)
        .maybeSingle(),
      getBusinessSettings().catch(() => null),
    ]);

    const ba = settings?.setup_data?.business_address || {};
    const structuredAddress = [ba.line1, ba.line2, ba.town, ba.county, ba.postcode]
      .filter(Boolean)
      .join('\n');
    const fullAddress =
      structuredAddress || settings?.setup_data?.address || profile?.postcode || '';
    const registeredOffice =
      settings?.setup_data?.registered_office ||
      settings?.setup_data?.registered_office_address ||
      fullAddress;
    const bank = settings?.bank_details || {};
    const businessName =
      profile?.business_name ||
      [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
      'Your business';

    return {
      business: {
        name: businessName,
        address: fullAddress,
        email: settings?.business_email || user.email || '',
        phone: profile?.phone || '',
        vatNumber: settings?.vat_number || settings?.setup_data?.vat_number || '',
        companyNum: settings?.companies_house_number || settings?.setup_data?.company_number || '',
        entityType: settings?.entity_type || 'sole_trader',
        registeredOffice,
        privacyUrl: 'https://cadi.cleaning/privacy.html',
        termsUrl: 'https://cadi.cleaning/terms.html',
        bankName: bank.bankName || '',
        sortCode: bank.sortCode || '',
        accountNum: bank.accountNum || '',
      },
      vatRegistered: !!settings?.vat_registered,
    };
  }

  async function handlePreview() {
    setBusy('preview');
    setError(null);
    try {
      const { business, vatRegistered } = await fetchBusinessAndTemplate();
      const { generateInvoicePdf } = await import('../../lib/invoicePdf');
      const pdf = generateInvoicePdf(
        {
          num: invoice.reference || 'DRAFT',
          date: invoice.service_date || new Date().toISOString(),
          dueDate: '',
          customer: {
            name: invoice.fm_organisation?.name || 'Facilities Manager',
            address: '',
            email: '',
          },
          lines: lines.map((l) => ({
            desc: l.description,
            qty: 1,
            rate: Number(l.net_value ?? 0),
            serviceDate: l.service_date,
          })),
          notes: note || '',
          bankName: business.bankName || '',
          sortCode: business.sortCode || '',
          accountNum: business.accountNum || '',
          terms: 'Net 14',
        },
        business,
        { vatRegistered }
      );
      const byteChars = atob(pdf.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const win = window.open(blobUrl, '_blank');
      if (!win) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = pdf.filename || 'invoice.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      setError(e.message || 'Could not generate preview.');
    } finally {
      setBusy(null);
    }
  }

  async function handleSubmit() {
    setBusy('submit');
    setError(null);
    try {
      const { ok, data } = await submitConnectInvoice({
        invoiceId: invoice.id,
        netValue: Number(netInput),
        vatValue: Number(vatInput),
        note: note || null,
      });
      if (!ok) throw new Error(data?.error || 'Submit failed');
      onSubmitted?.();
    } catch (e) {
      setError(e.message || 'Submit failed');
      setBusy(null);
    }
  }

  const darkInputStyle = {
    padding: '10px 12px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.16)',
    fontSize: 13,
    color: '#ffffff',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 5, 0, 0.65)',
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
          width: 660,
          maxWidth: '94vw',
          background: 'linear-gradient(180deg, #3d0f04 0%, #1a0400 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.14)',
          padding: '24px 28px 40px',
          overflowY: 'auto',
          boxShadow: '-30px 0 80px -20px rgba(0,0,0,0.55)',
          color: '#ffffff',
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
            <div style={{ ...SUBLABEL }}>Invoice {invoice.reference}</div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: '#ffffff',
                marginTop: 4,
                letterSpacing: '-0.02em',
              }}
            >
              {invoice.fm_organisation?.name ?? 'Customer'}
            </div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 6 }}>
              {lines.length} line{lines.length === 1 ? '' : 's'} · service{' '}
              {fmtDate(invoice.service_date)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#ffffff',
              cursor: 'pointer',
              padding: 8,
              borderRadius: 10,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Line items */}
        <div style={{ ...glassDark({ padding: 16, radius: 14, strong: true }), marginBottom: 14 }}>
          <div style={{ ...SUBLABEL, marginBottom: 12 }}>Line items</div>
          {lines.length === 0 && (
            <div style={{ fontSize: 11, color: ON_DARK.faint, fontStyle: 'italic' }}>
              No line items.
            </div>
          )}
          {lines.map((l, idx) => (
            <div
              key={l.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                padding: '10px 0',
                borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                  {l.description}
                </div>
                {l.service_date && (
                  <div style={{ fontSize: 10, color: ON_DARK.faint, marginTop: 3 }}>
                    {fmtDate(l.service_date)}
                  </div>
                )}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  marginLeft: 12,
                }}
              >
                £{Number(l.net_value ?? 0).toFixed(2)}
              </div>
            </div>
          ))}
          <div
            style={{
              marginTop: 10,
              paddingTop: 12,
              borderTop: '2px solid rgba(255,255,255,0.18)',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13,
              fontWeight: 900,
              color: '#ffffff',
            }}
          >
            <span>Net total from lines</span>
            <span>£{totalNet.toFixed(2)}</span>
          </div>
        </div>

        {/* Editable / status */}
        {isDraft ? (
          <div
            style={{ ...glassDark({ padding: 16, radius: 14, strong: true }), marginBottom: 14 }}
          >
            <div style={{ ...SUBLABEL, marginBottom: 12 }}>Adjust before sending</div>
            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}
            >
              <label style={{ ...SUBLABEL, textTransform: 'uppercase' }}>
                Net total (£)
                <input
                  value={netInput}
                  onChange={(e) => setNetInput(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ ...darkInputStyle, display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
              <label style={{ ...SUBLABEL, textTransform: 'uppercase' }}>
                VAT (£)
                <input
                  value={vatInput}
                  onChange={(e) => setVatInput(e.target.value)}
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ ...darkInputStyle, display: 'block', width: '100%', marginTop: 6 }}
                />
              </label>
            </div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginBottom: 12 }}>
              Total after submit:{' '}
              <strong style={{ color: '#ffffff' }}>
                £{(Number(netInput) + Number(vatInput)).toFixed(2)}
              </strong>
            </div>
            <label style={{ ...SUBLABEL, textTransform: 'uppercase', display: 'block' }}>
              Note for the FM (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                style={{
                  ...darkInputStyle,
                  display: 'block',
                  width: '100%',
                  marginTop: 6,
                  resize: 'vertical',
                }}
                placeholder="e.g. PO ref ACE-2025-04 — please pay within 14 days."
              />
            </label>
          </div>
        ) : (
          <div
            style={{
              ...glassDark({ padding: 16, radius: 14, strong: true }),
              marginBottom: 14,
              fontSize: 12,
              color: ON_DARK.muted,
            }}
          >
            <div style={{ color: '#ffffff' }}>
              <strong>Status:</strong> {STATUS_CFG[invoice.status]?.label ?? invoice.status}
            </div>
            {invoice.submitted_at && (
              <div style={{ marginTop: 6 }}>Submitted {fmtDate(invoice.submitted_at)}</div>
            )}
            {invoice.exported_at && (
              <div style={{ marginTop: 6 }}>
                Exported to FM accounts {fmtDate(invoice.exported_at)}
              </div>
            )}
            {invoice.paid_at && (
              <div style={{ marginTop: 6, color: GREEN, fontWeight: 700 }}>
                ✓ Paid {fmtDate(invoice.paid_at)}
              </div>
            )}
            {invoice.note && (
              <div style={{ marginTop: 8, fontStyle: 'italic', color: '#ffffff' }}>
                {invoice.note}
              </div>
            )}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 12,
              marginBottom: 12,
              borderRadius: 10,
              background: 'rgba(220,38,38,0.14)',
              border: '1px solid rgba(220,38,38,0.30)',
              fontSize: 12,
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handlePreview}
            disabled={busy !== null}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'rgba(255,255,255,0.06)',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.20)',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 800,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {busy === 'preview' ? (
              <>
                <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
                Generating…
              </>
            ) : (
              <>
                <Eye size={12} /> Preview PDF
              </>
            )}
          </button>
          {isDraft && (
            <button
              onClick={handleSubmit}
              disabled={busy !== null}
              style={{
                flex: 2,
                padding: '12px 0',
                background: '#ffffff',
                color: CONNECT_COLORS.navy,
                border: '1px solid rgba(255,255,255,0.5)',
                boxShadow: '0 12px 30px -12px rgba(255,255,255,0.4)',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 900,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: busy ? 0.6 : 1,
              }}
            >
              {busy === 'submit' ? (
                <>
                  <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
                  Submitting…
                </>
              ) : (
                <>
                  <Send size={12} /> Submit to FM
                </>
              )}
            </button>
          )}
        </div>

        <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnInvoice() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('draft');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [merging, setMerging] = useState(false);
  const [openDetailId, setOpenDetailId] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  async function reload() {
    setError('');
    try {
      const rows = await listMyConnectInvoices();
      setInvoices(rows);
      setSelectedIds((prev) => {
        const next = new Set();
        for (const id of prev) {
          const r = rows.find((x) => x.id === id);
          if (r && r.status === 'draft') next.add(id);
        }
        return next;
      });
    } catch (e) {
      setError(e.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const selectedDrafts = useMemo(
    () => invoices.filter((i) => selectedIds.has(i.id) && i.status === 'draft'),
    [invoices, selectedIds]
  );
  const lockedFmId = selectedDrafts[0]?.fm_organisation?.id ?? null;

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleMerge() {
    if (selectedDrafts.length < 2) return;
    setMerging(true);
    setError('');
    try {
      const { ok, data } = await mergeConnectInvoices({
        sourceInvoiceIds: selectedDrafts.map((i) => i.id),
      });
      if (!ok) throw new Error(data?.error || 'Merge failed');
      clearSelection();
      await reload();
      if (data?.invoice_id) setOpenDetailId(data.invoice_id);
    } catch (e) {
      setError(e.message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  }

  const tabs = [
    { id: 'draft', label: 'Drafts' },
    { id: 'submitted', label: 'Submitted' },
    { id: 'exported', label: 'With FM' },
    { id: 'paid', label: 'Paid' },
  ];
  const counts = invoices.reduce((acc, inv) => {
    const k = inv.status === 'void' ? 'void' : inv.status;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = invoices.filter((inv) => {
    if (inv.status === 'void') return false;
    return inv.status === filter;
  });
  const drafts = invoices.filter((i) => i.status === 'draft');

  const openDetail = invoices.find((i) => i.id === openDetailId);

  const totalDraftValue = drafts.reduce(
    (s, i) => s + Number(i.net_value ?? 0) + Number(i.vat_value ?? 0),
    0
  );
  const paidValue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + Number(i.net_value ?? 0) + Number(i.vat_value ?? 0), 0);

  return (
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={orangeCanvas()}>
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">
        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(255, 176, 90, 0.28) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(1, 10, 79, 0.30) 0%, transparent 60%),
              rgba(255,255,255,0.05)
            `,
          }}
        >
          <div className="relative px-6 md:px-9 py-7 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#ffffff', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.4)' }}
                >
                  <Receipt size={13} color={CONNECT_COLORS.navy} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">
                  Invoicing
                </span>
              </div>
              <h1
                className="text-white mb-2"
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                }}
              >
                One approved job, <span style={{ color: '#ffd7bf' }}>one invoice.</span>
              </h1>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
                Tick several drafts for the same FM and merge them into a bundled invoice. Preview
                the PDF before you send.
              </p>
            </div>

            <div className="flex flex-col gap-2 shrink-0" style={{ minWidth: 220 }}>
              <button
                onClick={() => setWizardOpen(true)}
                disabled={drafts.length === 0}
                title={
                  drafts.length === 0
                    ? 'A draft will appear when your FM approves a completed job'
                    : undefined
                }
                style={{
                  background: drafts.length === 0 ? 'rgba(255,255,255,0.10)' : '#ffffff',
                  color: drafts.length === 0 ? ON_DARK.muted : CONNECT_COLORS.navy,
                  border: '1px solid rgba(255,255,255,0.4)',
                  boxShadow:
                    drafts.length === 0 ? 'none' : '0 10px 24px -12px rgba(255,255,255,0.4)',
                  borderRadius: 12,
                  padding: '11px 16px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: drafts.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <Camera size={13} /> Upload invoice
              </button>
              <div className="grid grid-cols-2 gap-2">
                <div
                  style={{
                    ...glassDark({ padding: 10, radius: 12, strong: true }),
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#ffd7bf', lineHeight: 1 }}>
                    £{totalDraftValue.toFixed(0)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: ON_DARK.muted,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginTop: 5,
                    }}
                  >
                    drafts
                  </div>
                </div>
                <div
                  style={{
                    ...glassDark({ padding: 10, radius: 12, strong: true }),
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 16, fontWeight: 900, color: GREEN, lineHeight: 1 }}>
                    £{paidValue.toFixed(0)}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: ON_DARK.muted,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginTop: 5,
                    }}
                  >
                    paid
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: CONNECT_RADII.md,
              background: 'rgba(220,38,38,0.14)',
              border: '1px solid rgba(220,38,38,0.35)',
              color: '#fca5a5',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Tab pills */}
        <div
          style={{
            display: 'inline-flex',
            gap: 4,
            padding: 4,
            ...glassDark({ radius: 999, strong: true }),
            flexWrap: 'wrap',
          }}
        >
          {tabs.map((t) => {
            const isActive = filter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 900,
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? CONNECT_COLORS.navy : ON_DARK.muted,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 150ms ease',
                }}
              >
                {t.label}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: isActive ? CONNECT_COLORS.navy : '#ffffff',
                    background: isActive ? 'rgba(1,10,79,0.10)' : 'rgba(255,255,255,0.12)',
                    padding: '2px 7px',
                    borderRadius: 999,
                  }}
                >
                  {counts[t.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div
            style={{
              ...glassDark({ padding: 40, radius: CONNECT_RADII.lg }),
              textAlign: 'center',
              color: ON_DARK.muted,
              fontSize: 12,
            }}
          >
            <Loader2
              size={18}
              className="mx-auto mb-2"
              style={{ animation: 'connectSpin 0.8s linear infinite' }}
            />
            Loading…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
              textAlign: 'center',
            }}
          >
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, #ffffff 0%, #ffd7bf 100%)`,
                boxShadow: '0 12px 30px -12px rgba(255,255,255,0.35)',
              }}
            >
              <FileText size={22} color={CONNECT_COLORS.orange} strokeWidth={2.2} />
            </div>
            <div
              style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}
            >
              Nothing here
            </div>
            <div
              style={{
                fontSize: 12,
                color: ON_DARK.muted,
                marginTop: 8,
                maxWidth: 380,
                margin: '8px auto 0',
                lineHeight: 1.5,
              }}
            >
              Invoices appear here automatically the moment your FM approves a checked-out job.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              paddingBottom: selectedDrafts.length > 0 ? 100 : 0,
            }}
          >
            {filtered.map((inv) => {
              const isDraft = inv.status === 'draft';
              const sameFm = !lockedFmId || inv.fm_organisation?.id === lockedFmId;
              const mergeDisabledReason = !isDraft
                ? null
                : sameFm
                  ? null
                  : `Already selecting drafts for ${selectedDrafts[0]?.fm_organisation?.name ?? 'another FM'}`;
              return (
                <InvoiceRow
                  key={inv.id}
                  inv={inv}
                  selected={selectedIds.has(inv.id)}
                  onToggle={toggleSelect}
                  onOpen={setOpenDetailId}
                  mergeDisabledReason={mergeDisabledReason}
                />
              );
            })}
          </div>
        )}

        {/* Floating merge bar */}
        {selectedDrafts.length > 0 && (
          <div
            style={{
              position: 'sticky',
              bottom: 12,
              marginTop: 16,
              zIndex: 30,
              ...glassDark({ padding: 14, radius: CONNECT_RADII.lg, strong: true, blur: 20 }),
              background: 'rgba(20, 5, 0, 0.85)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 -20px 40px -10px rgba(0,0,0,0.4), 0 20px 40px -20px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                {selectedDrafts.length} draft{selectedDrafts.length === 1 ? '' : 's'} selected ·{' '}
                {selectedDrafts[0]?.fm_organisation?.name ?? ''}
              </div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
                Net £{selectedDrafts.reduce((s, i) => s + Number(i.net_value ?? 0), 0).toFixed(2)} ·
                merged into one bundled invoice
              </div>
            </div>
            <button
              onClick={clearSelection}
              style={{
                background: 'transparent',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.20)',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 800,
                padding: '8px 14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleMerge}
              disabled={selectedDrafts.length < 2 || merging}
              title={selectedDrafts.length < 2 ? 'Select at least 2 drafts' : undefined}
              style={{
                background: selectedDrafts.length < 2 ? 'rgba(255,255,255,0.10)' : '#ffffff',
                color: selectedDrafts.length < 2 ? ON_DARK.muted : CONNECT_COLORS.navy,
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 900,
                padding: '10px 16px',
                cursor: selectedDrafts.length < 2 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {merging ? (
                <>
                  <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
                  Merging…
                </>
              ) : (
                <>
                  <Layers size={12} /> Merge {selectedDrafts.length} into one
                </>
              )}
            </button>
          </div>
        )}

        {openDetail && (
          <InvoiceDetailDrawer
            invoice={openDetail}
            onClose={() => setOpenDetailId(null)}
            onSubmitted={() => {
              setOpenDetailId(null);
              reload();
            }}
          />
        )}

        {wizardOpen && (
          <EarnInvoiceUploadWizard
            drafts={drafts}
            onClose={() => setWizardOpen(false)}
            onSent={reload}
          />
        )}

        <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
