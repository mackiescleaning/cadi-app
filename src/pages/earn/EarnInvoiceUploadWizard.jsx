import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, CheckCircle2, FileText, Send, ChevronRight, ChevronLeft,
  Building2, MapPin, Calendar, Hash, X, Loader2,
} from 'lucide-react';
import { submitConnectInvoice } from '../../lib/db/connectDb';

const ORANGE = '#C2410C';
const NAVY   = '#010a4f';
const INK    = '#0f172a';
const SUB    = '#64748b';
const MUTE   = '#94a3b8';
const LINE   = '#e2e8f0';
const SOFT   = '#f1f5f9';
const PAPER  = '#ffffff';
const GREEN  = '#16a34a';

const STEPS = ['Pick job & upload', 'Confirm details', 'Send'];

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        const colour = done ? GREEN : active ? ORANGE : SUB;
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i === STEPS.length - 1 ? 0 : 1 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: active ? colour : done ? `${colour}15` : SOFT,
              border: `1.5px solid ${colour}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900,
              color: active ? 'white' : colour,
            }}>{done ? '✓' : i + 1}</div>
            <span style={{ fontSize: 11, fontWeight: active ? 800 : 600, color: active ? INK : SUB, marginLeft: 6, whiteSpace: 'nowrap' }}>{label}</span>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? GREEN : LINE, margin: '0 10px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Pick a draft + upload a photo ──────────────────────────────────
function StepPickAndUpload({ drafts, selectedId, setSelectedId, photoUrl, setPhotoUrl, onNext, onClose }) {
  const fileRef = useRef(null);

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const ready = !!selectedId;

  return (
    <>
      <div style={{ fontSize: 13, color: SUB, marginBottom: 14, lineHeight: 1.6 }}>
        Pick the job this invoice is for. The amount is pre-filled from the FM-approved job — you can
        adjust it on the next step. Optionally attach a photo of your paper invoice for the FM's records.
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Job · {drafts.length} draft{drafts.length === 1 ? '' : 's'} ready
        </div>
        {drafts.length === 0 ? (
          <div style={{ padding: 18, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10, fontSize: 12, color: SUB, textAlign: 'center' }}>
            No drafts yet. A draft appears here the moment one of your FMs approves a completed job — then you can upload your invoice for it.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' }}>
            {drafts.map(d => {
              const active = selectedId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: 10, borderRadius: 8,
                    border: `1px solid ${active ? ORANGE : LINE}`,
                    background: active ? `${ORANGE}06` : PAPER,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${active ? ORANGE : LINE}`,
                    background: active ? ORANGE : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {active && <CheckCircle2 size={10} color="white" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.job?.site?.name ?? 'Site'}
                    </div>
                    <div style={{ fontSize: 10, color: SUB, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building2 size={9} /> {d.fm_organisation?.name ?? '—'}
                      <span style={{ color: '#cbd5e1' }}>·</span>
                      <Calendar size={9} /> {fmtDate(d.service_date)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: ORANGE }}>£{Number(d.total_value ?? 0).toFixed(2)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedId && (
        <>
          <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Photo of your invoice <span style={{ color: MUTE, fontWeight: 700, textTransform: 'none' }}>(optional)</span></div>
          {!photoUrl ? (
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
              style={{
                background: PAPER, border: `2px dashed ${ORANGE}45`, borderRadius: 12,
                padding: 22, textAlign: 'center', cursor: 'pointer', marginBottom: 12,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${ORANGE}15`, color: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                <Camera size={18} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: INK, marginBottom: 2 }}>
                Take a photo, or drop a PDF / image
              </div>
              <div style={{ fontSize: 11, color: SUB }}>
                Optional — attached to your submission for the FM's records.
              </div>
            </div>
          ) : (
            <div style={{ background: SOFT, borderRadius: 12, padding: 8, marginBottom: 12, position: 'relative' }}>
              <img src={photoUrl} alt="invoice" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 8, background: PAPER }} />
              <button onClick={() => setPhotoUrl(null)} style={{
                position: 'absolute', top: 14, right: 14,
                background: 'rgba(15,23,42,0.8)', color: 'white',
                border: 'none', borderRadius: 6, padding: '4px 10px',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
              }}>Remove</button>
            </div>
          )}
          <input
            ref={fileRef} type="file"
            accept="image/*,application/pdf"
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 18 }}>
        <button onClick={onClose} style={{
          background: PAPER, color: SUB, border: `1px solid ${LINE}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Cancel</button>
        <button
          onClick={onNext}
          disabled={!ready}
          style={{
            background: ready ? ORANGE : MUTE, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Continue <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// (No OCR/"reading" step: the amount is pre-filled from the FM-approved job draft,
// not extracted from the uploaded photo — the photo is an optional record attachment.)

// ─── Step 2 — Confirm + edit ────────────────────────────────────────────────
function StepConfirm({ draft, fields, setFields, onBack, onNext }) {
  const total = Number(fields.net || 0) + Number(fields.vat || 0);
  return (
    <>
      <div style={{ background: `${ORANGE}06`, border: `1px solid ${ORANGE}25`, borderRadius: 10, padding: 12, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
        <CheckCircle2 size={16} color={ORANGE} />
        <div style={{ flex: 1, fontSize: 12, color: '#3f1d0a', lineHeight: 1.5 }}>
          <strong style={{ color: ORANGE }}>Pre-filled from the approved job.</strong> Check the amount matches your invoice and edit if anything's off.
        </div>
      </div>

      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>For job</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: INK }}>{draft.job?.site?.name ?? 'Site'}</div>
        <div style={{ fontSize: 11, color: SUB, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Building2 size={10} /> {draft.fm_organisation?.name ?? '—'}
          <span style={{ color: '#cbd5e1' }}>·</span>
          <MapPin size={10} /> {draft.job?.site?.postcode ?? ''}
          <span style={{ color: '#cbd5e1' }}>·</span>
          <Calendar size={10} /> Service {fmtDate(draft.service_date)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <label style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Net (£)
          <input
            type="number" step="0.01" min="0" value={fields.net}
            onChange={e => setFields(f => ({ ...f, net: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: INK, outline: 'none' }}
          />
        </label>
        <label style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          VAT (£)
          <input
            type="number" step="0.01" min="0" value={fields.vat}
            onChange={e => setFields(f => ({ ...f, vat: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: INK, outline: 'none' }}
          />
        </label>
      </div>

      <label style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 12 }}>
        Note (optional)
        <textarea
          value={fields.note}
          onChange={e => setFields(f => ({ ...f, note: e.target.value }))}
          placeholder="Anything the FM should know — e.g. quoted extra for cherry-picker access."
          rows={2}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 10px', borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 13, color: INK, outline: 'none', fontFamily: 'inherit', resize: 'vertical' }}
        />
      </label>

      <div style={{
        background: `${NAVY}05`, border: `1px solid ${NAVY}15`, borderRadius: 12,
        padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: SUB }}>Total to send</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>£{total.toFixed(2)}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={onBack} style={{
          background: PAPER, color: SUB, border: `1px solid ${LINE}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <ChevronLeft size={12} /> Back
        </button>
        <button
          onClick={onNext}
          style={{
            background: ORANGE, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Preview <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// ─── Step 4 — Preview + send ────────────────────────────────────────────────
function StepPreview({ draft, fields, photoUrl, onBack, onSend, busy, error }) {
  const total = Number(fields.net || 0) + Number(fields.vat || 0);
  return (
    <>
      <div style={{ fontSize: 13, color: SUB, marginBottom: 14, lineHeight: 1.6 }}>
        Last check — this is what will land in <strong style={{ color: INK }}>{draft.fm_organisation?.name ?? 'the FM'}</strong>'s accounts inbox.
      </div>

      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: ORANGE, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Invoice</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{draft.reference ?? '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: SUB }}>Service date</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{fmtDate(draft.service_date)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>From</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK, marginTop: 4 }}>{draft.sub?.business_name ?? 'You'}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>To</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: INK, marginTop: 4 }}>{draft.fm_organisation?.name ?? '—'}</div>
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: INK }}>
            <span>{draft.job?.site?.name ?? 'Site'} · service</span>
            <span style={{ fontWeight: 800 }}>£{Number(fields.net || 0).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 12, color: SUB }}>
            <span>VAT</span>
            <span>£{Number(fields.vat || 0).toFixed(2)}</span>
          </div>
        </div>

        <div style={{
          background: SOFT, borderRadius: 8, padding: '10px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>Total</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: ORANGE }}>£{total.toFixed(2)}</span>
        </div>

        {fields.note && (
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fafbff', border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 11, color: SUB, fontStyle: 'italic' }}>
            "{fields.note}"
          </div>
        )}
      </div>

      {photoUrl && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Attached photo</div>
          <img src={photoUrl} alt="invoice" style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, background: SOFT, padding: 6, border: `1px solid ${LINE}` }} />
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <button onClick={onBack} disabled={busy} style={{
          background: PAPER, color: SUB, border: `1px solid ${LINE}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 12, fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <ChevronLeft size={12} /> Edit details
        </button>
        <button
          onClick={onSend}
          disabled={busy}
          style={{
            background: GREEN, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {busy && <Loader2 size={13} style={{ animation: 'invSpin 0.8s linear infinite' }} />}
          <Send size={13} /> Send to FM
        </button>
      </div>
      <style>{`@keyframes invSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

// ─── Wizard wrapper ─────────────────────────────────────────────────────────
export default function EarnInvoiceUploadWizard({ drafts, onClose, onSent }) {
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState(drafts[0]?.id ?? null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fields, setFields] = useState({ net: '0.00', vat: '0.00', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const draft = useMemo(
    () => drafts.find(d => d.id === selectedId) || drafts[0] || null,
    [drafts, selectedId],
  );

  useEffect(() => {
    if (draft) {
      setFields(f => ({
        ...f,
        net: String(draft.net_value ?? 0),
        vat: String(draft.vat_value ?? 0),
        note: draft.note ?? '',
      }));
    }
  }, [draft?.id]);

  const send = async () => {
    if (!draft) return;
    setBusy(true); setError(null);
    try {
      const { ok, data } = await submitConnectInvoice({
        invoiceId: draft.id,
        netValue: Number(fields.net) || 0,
        vatValue: Number(fields.vat) || 0,
        note: fields.note?.trim() || null,
      });
      if (!ok) throw new Error(data?.error || 'Send failed');
      onSent?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: '40px 16px', zIndex: 60, overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560, background: '#f8faff',
        borderRadius: 16, padding: 22,
        boxShadow: '0 20px 80px rgba(15,23,42,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>Upload an invoice</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              Confirm the amount and send — attach a photo of your paper invoice if you like.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <StepDots step={step} />

        {step === 0 && (
          <StepPickAndUpload
            drafts={drafts}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            photoUrl={photoUrl}
            setPhotoUrl={setPhotoUrl}
            onNext={() => setStep(1)}
            onClose={onClose}
          />
        )}
        {step === 1 && draft && (
          <StepConfirm
            draft={draft}
            fields={fields}
            setFields={setFields}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && draft && (
          <StepPreview
            draft={draft}
            fields={fields}
            photoUrl={photoUrl}
            onBack={() => setStep(1)}
            onSend={send}
            busy={busy}
            error={error}
          />
        )}
      </div>
    </div>
  );
}
