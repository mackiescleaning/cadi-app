import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Camera,
  Loader2,
  MessageCircleQuestion,
  Send,
  Receipt,
  ChevronRight,
  ClipboardCheck,
} from 'lucide-react';
import {
  listMyConnectJobs,
  connectCheckIn,
  connectCheckOut,
  getCurrentPosition,
  uploadCheckoutEvidence,
  listJobMessages,
  postJobMessage,
  resubmitConnectJob,
  listMyConnectInvoices,
} from '../../lib/db/connectDb';
import {
  CONNECT_COLORS,
  CONNECT_RADII,
  ON_DARK,
  glassDark,
  orangeCanvas,
  whiteButton,
  HOVER_LIFT,
} from '../../lib/connectTheme';

const GREEN = '#22c55e';
const BLUE = '#7ea3ff';
const MAX_PHOTOS = 4;

const STATUS_CFG = {
  scheduled: { label: 'Upcoming', color: BLUE },
  pending_confirmation: { label: 'Awaiting confirm', color: '#c084fc' },
  in_progress: { label: 'Checked in', color: '#fbbf24' },
  complete: { label: 'Checked out', color: GREEN },
  unassigned: { label: 'Unassigned', color: '#94a3b8' },
};

function fmtTime(date, startHour) {
  if (!date) return '—';
  const h = Math.floor(startHour ?? 0);
  const m = Math.round(((startHour ?? 0) - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dCopy = new Date(d);
  dCopy.setHours(0, 0, 0, 0);
  const days = Math.round((dCopy - today) / (1000 * 60 * 60 * 24));
  const dayLabel =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Tomorrow'
        : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${dayLabel} · ${hh}:${mm}`;
}

/* ─── Modal shell ─────────────────────────────────────────────────────────── */
function ModalShell({ children, onCancel, maxWidth = 480 }) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(20, 5, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 50,
        padding: '24px 16px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          background: 'linear-gradient(180deg, #3d0f04 0%, #1a0400 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: CONNECT_RADII.xl,
          padding: '22px 22px 18px',
          boxShadow: '0 -30px 80px -20px rgba(0,0,0,0.55)',
          maxHeight: '90vh',
          overflowY: 'auto',
          color: '#ffffff',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalLabel({ children }) {
  return (
    <label
      style={{
        display: 'block',
        fontSize: 10,
        fontWeight: 800,
        color: ON_DARK.muted,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}
    >
      {children}
    </label>
  );
}

function DarkInput(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.05)',
        fontSize: 13,
        color: '#ffffff',
        outline: 'none',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  );
}

function DarkTextarea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.16)',
        background: 'rgba(255,255,255,0.05)',
        fontSize: 13,
        color: '#ffffff',
        outline: 'none',
        resize: 'vertical',
        fontFamily: 'inherit',
        boxSizing: 'border-box',
        ...(props.style || {}),
      }}
    />
  );
}

function ErrorBanner({ children }) {
  if (!children) return null;
  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 10,
        background: 'rgba(220,38,38,0.14)',
        border: '1px solid rgba(220,38,38,0.35)',
        borderRadius: 10,
        fontSize: 12,
        color: '#fca5a5',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <AlertCircle size={13} /> {children}
    </div>
  );
}

/* ─── Fence feedback (per-card fallback for errors) ───────────────────────── */
function FenceFeedback({ result }) {
  if (!result) return null;
  return (
    <div
      style={{
        marginTop: 10,
        padding: '9px 12px',
        borderRadius: 10,
        background: 'rgba(220,38,38,0.14)',
        border: '1px solid rgba(220,38,38,0.30)',
        fontSize: 11,
        color: '#fca5a5',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <AlertCircle size={13} /> {result.message || result.error}
    </div>
  );
}

/* ─── Checkout modal ──────────────────────────────────────────────────────── */
function CheckoutModal({ job, onCancel, onConfirmed }) {
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [customerOnSite, setCustomerOnSite] = useState(null);
  const [customerName, setCustomerName] = useState('');

  function addFiles(picked) {
    const arr = Array.from(picked || []);
    if (!arr.length) return;
    setFiles((prev) => [...prev, ...arr].slice(0, MAX_PHOTOS));
  }
  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleConfirm() {
    setBusy('confirm');
    setError(null);
    try {
      await uploadCheckoutEvidence({ jobId: job.id, files, note });
      const pos = await getCurrentPosition();
      const { ok, data } = await connectCheckOut({
        jobId: job.id,
        lat: pos.lat,
        lng: pos.lng,
        note: note || undefined,
        customerOnSite,
        customerName: customerOnSite ? customerName.trim() || undefined : undefined,
      });
      if (!ok) {
        setError(data?.error || 'Check-out rejected.');
        setBusy(null);
        return;
      }
      onConfirmed?.({ ok: true, action: 'checkout', distance_m: data?.distance_m });
    } catch (e) {
      setError(e.message || 'Could not complete check-out.');
      setBusy(null);
    }
  }

  return (
    <ModalShell onCancel={onCancel}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            Check out
          </div>
          <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
            {job.site?.name ?? 'Site'}
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#ffffff',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
          }}
        >
          <X size={16} />
        </button>
      </div>

      <ModalLabel>Was a site contact present?</ModalLabel>
      <div style={{ display: 'flex', gap: 6, marginBottom: customerOnSite ? 8 : 14 }}>
        {[
          { value: true, label: 'Yes' },
          { value: false, label: 'No' },
        ].map((opt) => {
          const selected = customerOnSite === opt.value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setCustomerOnSite(opt.value)}
              style={{
                flex: 1,
                padding: '10px 0',
                fontSize: 12,
                fontWeight: 800,
                background: selected ? GREEN : 'rgba(255,255,255,0.05)',
                color: selected ? '#052e16' : '#ffffff',
                border: `1px solid ${selected ? GREEN : 'rgba(255,255,255,0.16)'}`,
                borderRadius: 10,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {customerOnSite === true && (
        <DarkInput
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Name of the person on site (e.g. Tim Gibson)"
          style={{ marginBottom: 14 }}
        />
      )}

      <ModalLabel>Notes for the FM</ModalLabel>
      <DarkTextarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        placeholder="e.g. all areas cleaned, refilled soap dispensers in WCs."
        style={{ marginBottom: 14 }}
      />

      <ModalLabel>
        Photos ({files.length}/{MAX_PHOTOS})
      </ModalLabel>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}
      >
        {files.map((f, i) => {
          const url = URL.createObjectURL(f);
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                aspectRatio: '1',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.06)',
              }}
            >
              <img
                src={url}
                alt="evidence"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={() => removeFile(i)}
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  background: 'rgba(0,0,0,0.7)',
                  border: 'none',
                  color: 'white',
                  borderRadius: 12,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={11} />
              </button>
            </div>
          );
        })}
        {files.length < MAX_PHOTOS && (
          <label
            style={{
              aspectRatio: '1',
              borderRadius: 10,
              border: '1.5px dashed rgba(255,255,255,0.20)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: ON_DARK.muted,
              cursor: 'pointer',
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            <Camera size={18} />
            <input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>
        )}
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      {(() => {
        const hasWitness = customerOnSite === true && customerName.trim().length > 0;
        const enough = files.length >= 1 && (files.length >= 2 || hasWitness);
        if (enough) return null;
        let need;
        if (files.length === 0) need = 'Add at least 1 photo of the finished work.';
        else if (files.length === 1 && !hasWitness)
          need = 'Add 1 more photo — or tick that a site contact was present and add their name.';
        else need = 'Tap Yes for the site contact and add their name, or add another photo.';
        return (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: 10,
              background: 'rgba(251,191,36,0.14)',
              border: '1px solid rgba(251,191,36,0.35)',
              borderRadius: 10,
              fontSize: 12,
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AlertCircle size={13} /> {need}
          </div>
        );
      })()}

      {(() => {
        const hasWitness = customerOnSite === true && customerName.trim().length > 0;
        const enough = files.length >= 1 && (files.length >= 2 || hasWitness);
        const blocked = !enough || busy !== null;
        return (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onCancel}
              disabled={busy !== null}
              style={{
                flex: 1,
                padding: '12px 0',
                background: 'rgba(255,255,255,0.06)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={blocked}
              style={{
                flex: 2,
                padding: '12px 0',
                background: enough ? '#ffffff' : 'rgba(255,255,255,0.14)',
                color: enough ? CONNECT_COLORS.navy : ON_DARK.muted,
                border: '1px solid rgba(255,255,255,0.5)',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 900,
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {busy ? (
                <>
                  <Loader2 size={13} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
                  Submitting…
                </>
              ) : (
                <>
                  <CheckCircle2 size={13} /> Confirm check out
                </>
              )}
            </button>
          </div>
        );
      })()}

      <p
        style={{
          fontSize: 10,
          color: ON_DARK.faint,
          textAlign: 'center',
          margin: '10px 0 0',
          lineHeight: 1.4,
        }}
      >
        Photos + notes go to the FM with your check-out timestamp and GPS.
      </p>

      <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </ModalShell>
  );
}

/* ─── Query reply modal ───────────────────────────────────────────────────── */
function QueryReplyModal({ job, onCancel, onResubmitted }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [addedSinceLoad, setAdded] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMessages(await listJobMessages(job.id));
    } catch (e) {
      setError(e.message || 'Could not load thread.');
    } finally {
      setLoading(false);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load the thread once on mount; load() is redefined each render
  useEffect(() => {
    load();
  }, []);

  function addFiles(picked) {
    const arr = Array.from(picked || []);
    if (arr.length) setFiles((prev) => [...prev, ...arr].slice(0, MAX_PHOTOS));
  }
  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handlePostReply() {
    if (!reply.trim() && files.length === 0) {
      setError('Type a reply or add at least one photo.');
      return;
    }
    setBusy('reply');
    setError(null);
    try {
      if (files.length) {
        await uploadCheckoutEvidence({ jobId: job.id, files, note: '' });
        setFiles([]);
      }
      if (reply.trim()) {
        const { ok, data } = await postJobMessage({ jobId: job.id, body: reply.trim() });
        if (!ok) throw new Error(data?.error || 'Could not send reply.');
        setReply('');
      }
      setAdded(true);
      await load();
    } catch (e) {
      setError(e.message || 'Could not send reply.');
    } finally {
      setBusy(null);
    }
  }

  async function handleResubmit() {
    setBusy('resubmit');
    setError(null);
    try {
      const { ok, data } = await resubmitConnectJob(job.id);
      if (!ok) throw new Error(data?.error || 'Could not resubmit.');
      onResubmitted?.();
    } catch (e) {
      setError(e.message || 'Could not resubmit.');
      setBusy(null);
    }
  }

  const subHasReplied = messages.some((m) => m.author_role === 'sub');
  const canResubmit = (subHasReplied || addedSinceLoad) && busy === null;

  return (
    <ModalShell onCancel={onCancel} maxWidth={520}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageCircleQuestion size={16} color={BLUE} />
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              FM queried this job
            </div>
          </div>
          <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3, marginLeft: 24 }}>
            {job.site?.name ?? 'Site'}
          </div>
        </div>
        <button
          onClick={onCancel}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#ffffff',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
          }}
        >
          <X size={16} />
        </button>
      </div>

      {job.query_note && (
        <div
          style={{
            background: 'rgba(126,163,255,0.12)',
            border: '1px solid rgba(126,163,255,0.30)',
            borderRadius: 10,
            padding: '10px 12px',
            fontSize: 12,
            color: '#c7d7ff',
            marginBottom: 14,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              color: BLUE,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            The query
          </div>
          {job.query_note}
        </div>
      )}

      <ModalLabel>Conversation</ModalLabel>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          marginBottom: 14,
          minHeight: 60,
        }}
      >
        {loading && (
          <div style={{ fontSize: 11, color: ON_DARK.muted, textAlign: 'center' }}>Loading…</div>
        )}
        {!loading && messages.length === 0 && (
          <div
            style={{
              fontSize: 11,
              color: ON_DARK.faint,
              fontStyle: 'italic',
              textAlign: 'center',
              padding: '12px 0',
            }}
          >
            No replies yet. Send the first response below.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.author_role === 'sub';
          return (
            <div
              key={m.id}
              style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: '78%',
                  padding: '9px 12px',
                  borderRadius: 12,
                  background: mine ? '#ffffff' : 'rgba(255,255,255,0.08)',
                  color: mine ? CONNECT_COLORS.navy : '#ffffff',
                  border: mine
                    ? '1px solid rgba(255,255,255,0.8)'
                    : '1px solid rgba(255,255,255,0.14)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.body}
                <div style={{ fontSize: 9, opacity: mine ? 0.55 : 0.65, marginTop: 4 }}>
                  {mine ? 'You' : 'FM'} · {new Date(m.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {files.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            marginBottom: 8,
          }}
        >
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <img
                  src={url}
                  alt="evidence"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: 'white',
                    borderRadius: 12,
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 10 }}>
        <DarkTextarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={2}
          placeholder="Reply to the FM…"
        />
        <label
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.16)',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <Camera size={16} />
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <ErrorBanner>{error}</ErrorBanner>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handlePostReply}
          disabled={busy !== null || (!reply.trim() && files.length === 0)}
          style={{
            flex: 1,
            padding: '12px 0',
            background: reply.trim() || files.length ? BLUE : 'rgba(255,255,255,0.10)',
            color: reply.trim() || files.length ? '#01041f' : ON_DARK.muted,
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 900,
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {busy === 'reply' ? (
            <>
              <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
              Sending…
            </>
          ) : (
            <>
              <Send size={12} /> Send reply
            </>
          )}
        </button>
        <button
          onClick={handleResubmit}
          disabled={!canResubmit}
          style={{
            flex: 1,
            padding: '12px 0',
            background: canResubmit ? '#ffffff' : 'rgba(255,255,255,0.10)',
            color: canResubmit ? CONNECT_COLORS.navy : ON_DARK.muted,
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 10,
            fontSize: 12,
            fontWeight: 900,
            cursor: canResubmit ? 'pointer' : 'not-allowed',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          title={canResubmit ? 'Send back to FM for approval' : 'Send a reply first'}
        >
          {busy === 'resubmit' ? (
            <>
              <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />{' '}
              Resubmitting…
            </>
          ) : (
            <>
              <CheckCircle2 size={12} /> Resubmit
            </>
          )}
        </button>
      </div>

      <p
        style={{
          fontSize: 10,
          color: ON_DARK.faint,
          textAlign: 'center',
          margin: '10px 0 0',
          lineHeight: 1.4,
        }}
      >
        Resubmit when you've answered the FM's question. Goes back to the top of their review queue.
      </p>

      <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </ModalShell>
  );
}

/* ─── Job card ────────────────────────────────────────────────────────────── */
function JobCard({ job, onUpdated, onCheckedIn, onCheckedOut }) {
  const [busy, setBusy] = useState(null);
  const [fenceResult, setFenceResult] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);

  const status = STATUS_CFG[job.status] || STATUS_CFG.scheduled;
  const canCheckIn = ['scheduled', 'unassigned', 'pending_confirmation'].includes(job.status);
  const canCheckOut = job.status === 'in_progress';
  const isQueried = job.approval_status === 'queried';
  const statusColor = isQueried ? BLUE : status.color;

  async function handleCheckIn() {
    setBusy('checkin');
    setFenceResult(null);
    try {
      const pos = await getCurrentPosition();
      const { ok, data } = await connectCheckIn({
        jobId: job.id,
        lat: pos.lat,
        lng: pos.lng,
        accuracyM: pos.accuracyM,
      });
      if (!ok) {
        setFenceResult({
          ok: false,
          action: 'checkin',
          distance_m: data?.distance_m,
          message: data?.error || 'Check-in rejected.',
        });
      } else {
        onCheckedIn?.({
          jobId: job.id,
          siteName: job.site?.name ?? 'the site',
          distance_m: data?.distance_m,
        });
        onUpdated?.();
      }
    } catch (e) {
      setFenceResult({ ok: false, message: e.message });
    } finally {
      setBusy(null);
    }
  }

  function openCheckoutModal() {
    setFenceResult(null);
    setShowCheckoutModal(true);
  }
  function onCheckoutConfirmed(result) {
    setShowCheckoutModal(false);
    if (result?.ok) {
      onCheckedOut?.({
        jobId: job.id,
        siteName: job.site?.name ?? 'the site',
        distance_m: result.distance_m,
      });
    } else {
      setFenceResult(result);
    }
    onUpdated?.();
  }

  return (
    <div
      className={HOVER_LIFT}
      style={{
        ...glassDark({ padding: 16, radius: CONNECT_RADII.lg }),
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: statusColor,
            background: `${statusColor}22`,
            border: `1px solid ${statusColor}44`,
            padding: '3px 9px',
            borderRadius: 999,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
          }}
        >
          {isQueried ? 'Queried' : status.label}
        </span>
        <span style={{ fontSize: 10, color: ON_DARK.muted }}>
          {job.fm_organisation?.name ?? '—'}
        </span>
      </div>

      <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>
        {job.site?.name ?? 'Site'}
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
        <MapPin size={10} /> {job.site?.postcode ?? ''}
        <span style={{ opacity: 0.5 }}>·</span>
        <Clock size={10} /> {fmtTime(job.date, job.start_hour)}
      </div>

      {job.status === 'complete' && job.actual_duration_minutes != null && (
        <div style={{ marginTop: 8, fontSize: 11, color: ON_DARK.muted }}>
          Time on site:{' '}
          <strong style={{ color: '#ffffff' }}>{job.actual_duration_minutes} min</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
        {canCheckIn && (
          <button
            onClick={handleCheckIn}
            disabled={busy !== null}
            style={{
              ...whiteButton({ size: 'md' }),
              flex: 1,
              padding: '10px 0',
              opacity: busy ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <MapPin size={13} />
            {busy === 'checkin' ? 'Reading GPS…' : 'Check in'}
          </button>
        )}
        {canCheckOut && (
          <button
            onClick={openCheckoutModal}
            disabled={busy !== null}
            style={{
              ...whiteButton({ size: 'md' }),
              flex: 1,
              padding: '10px 0',
              background: GREEN,
              color: '#052e16',
              border: `1px solid ${GREEN}`,
              boxShadow: '0 4px 12px -4px rgba(34,197,94,0.5)',
              opacity: busy ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={13} /> Check out
          </button>
        )}
        {job.status === 'complete' && !isQueried && (
          <div
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 800,
              color: GREEN,
              background: 'rgba(34,197,94,0.10)',
              border: `1px solid rgba(34,197,94,0.28)`,
              borderRadius: 10,
              padding: '10px 0',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <CheckCircle2 size={13} /> Submitted to FM
          </div>
        )}
        {isQueried && (
          <button
            onClick={() => setShowQueryModal(true)}
            disabled={busy !== null}
            style={{
              flex: 1,
              fontSize: 12,
              fontWeight: 900,
              color: '#01041f',
              background: BLUE,
              border: `1px solid ${BLUE}`,
              borderRadius: 10,
              padding: '10px 0',
              cursor: 'pointer',
              boxShadow: '0 4px 12px -4px rgba(126,163,255,0.55)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <MessageCircleQuestion size={13} /> Reply to FM
          </button>
        )}
      </div>

      <FenceFeedback result={fenceResult} />

      {showCheckoutModal && (
        <CheckoutModal
          job={job}
          onCancel={() => setShowCheckoutModal(false)}
          onConfirmed={onCheckoutConfirmed}
        />
      )}
      {showQueryModal && (
        <QueryReplyModal
          job={job}
          onCancel={() => setShowQueryModal(false)}
          onResubmitted={() => {
            setShowQueryModal(false);
            onUpdated?.();
          }}
        />
      )}
    </div>
  );
}

/* ─── Section heading on dark ─────────────────────────────────────────────── */
function SectionHead({ children, icon: Icon, tone = 'muted' }) {
  const color = tone === 'blue' ? BLUE : ON_DARK.muted;
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        color,
        letterSpacing: '0.20em',
        textTransform: 'uppercase',
        marginBottom: 10,
        marginLeft: 4,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {Icon && <Icon size={12} />}
      {children}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnCompletion() {
  const [jobs, setJobs] = useState([]);
  const [draftInvoices, setDraftInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recentEvent, setRecentEvent] = useState(null);

  async function reload() {
    setError('');
    try {
      const [rows, invoices] = await Promise.all([
        listMyConnectJobs(),
        listMyConnectInvoices().catch(() => []),
      ]);
      setJobs(rows);
      setDraftInvoices((invoices ?? []).filter((i) => i.status === 'draft'));
    } catch (e) {
      setError(e.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!recentEvent) return;
    const job = jobs.find((j) => j.id === recentEvent.jobId);
    if (recentEvent.kind === 'checkin' && job && job.status !== 'in_progress') {
      setRecentEvent(null);
    }
  }, [jobs, recentEvent]);

  const queried = jobs.filter((j) => j.approval_status === 'queried');
  const upcoming = jobs.filter((j) =>
    ['scheduled', 'unassigned', 'pending_confirmation'].includes(j.status)
  );
  const onSite = jobs.filter((j) => j.status === 'in_progress');
  const recent = jobs
    .filter((j) => j.status === 'complete' && j.approval_status !== 'queried')
    .slice(0, 5);

  return (
    // Bleed orange edge-to-edge past AppLayout's main padding.
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={orangeCanvas()}>
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">
        {/* ─── HERO ───────────────────────────────────────────────────── */}
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
                  <ClipboardCheck size={13} color={CONNECT_COLORS.navy} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">
                  Work Completion
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
                Check in, get it done, <span style={{ color: '#ffd7bf' }}>ship the evidence.</span>
              </h1>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
                Both check-in and check-out verify you're inside the site fence (80m by default).
                Photos and notes ship to the FM automatically.
              </p>
            </div>

            {/* Live counter — active work at a glance */}
            <div className="grid grid-cols-3 gap-2 shrink-0" style={{ minWidth: 220 }}>
              {[
                { label: 'Queried', count: queried.length, color: BLUE },
                { label: 'On site', count: onSite.length, color: '#fbbf24' },
                { label: 'Upcoming', count: upcoming.length, color: '#ffd7bf' },
              ].map(({ label, count, color }) => (
                <div
                  key={label}
                  style={{
                    ...glassDark({ padding: 10, radius: 12, strong: true }),
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: ON_DARK.muted,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginTop: 4,
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── STICKY SUCCESS BANNER ─────────────────────────────────── */}
        {recentEvent && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              background: 'rgba(34,197,94,0.14)',
              border: '1px solid rgba(34,197,94,0.35)',
              borderRadius: CONNECT_RADII.lg,
              position: 'sticky',
              top: 8,
              zIndex: 5,
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              boxShadow: '0 20px 40px -20px rgba(0,0,0,0.35)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'rgba(34,197,94,0.25)',
                color: GREEN,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', lineHeight: 1.25 }}>
                {recentEvent.kind === 'checkin'
                  ? `You're checked in at ${recentEvent.siteName}`
                  : `Submitted ${recentEvent.siteName} to the FM`}
              </div>
              <div style={{ fontSize: 12, color: '#dcfce7', marginTop: 4, lineHeight: 1.4 }}>
                {recentEvent.kind === 'checkin'
                  ? "Start your clean — when you're done, tap Check out below to upload your photos and finish."
                  : "They'll review and approve your work — you'll get an email if anything needs changing."}
              </div>
              {recentEvent.distance_m != null && (
                <div style={{ fontSize: 10, color: '#86efac', marginTop: 4 }}>
                  Geo-fence ✓ — {recentEvent.distance_m}m from site centre
                </div>
              )}
            </div>
            <button
              onClick={() => setRecentEvent(null)}
              aria-label="Dismiss"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.14)',
                cursor: 'pointer',
                color: '#ffffff',
                padding: 6,
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* ─── DRAFT INVOICE NUDGE ───────────────────────────────────── */}
        {draftInvoices.length > 0 && (
          <Link
            to="/connect/invoice"
            className={HOVER_LIFT}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              ...glassDark({ padding: 14, radius: CONNECT_RADII.lg, strong: true }),
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `linear-gradient(135deg, #34d399 0%, #047857 100%)`,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 10px 24px -12px rgba(16,185,129,0.55)',
              }}
            >
              <Receipt size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                }}
              >
                {draftInvoices.length === 1
                  ? '1 invoice ready to send'
                  : `${draftInvoices.length} invoices ready to send`}
              </div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 2 }}>
                The FM approved your work — open Invoicing to review and submit.
              </div>
            </div>
            <ChevronRight size={16} style={{ color: ON_DARK.muted }} />
          </Link>
        )}

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
            Loading your jobs…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : jobs.length === 0 ? (
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
              <MapPin size={22} color={CONNECT_COLORS.orange} strokeWidth={2.2} />
            </div>
            <div
              style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}
            >
              No scheduled jobs yet
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
              Once an FM dispatches you a visit, it'll appear here ready to check in.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {queried.length > 0 && (
              <section>
                <SectionHead icon={MessageCircleQuestion} tone="blue">
                  Needs your response
                </SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {queried.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      onUpdated={reload}
                      onCheckedIn={(ev) => setRecentEvent({ kind: 'checkin', ...ev })}
                      onCheckedOut={(ev) => setRecentEvent({ kind: 'checkout', ...ev })}
                    />
                  ))}
                </div>
              </section>
            )}
            {onSite.length > 0 && (
              <section>
                <SectionHead>On site now</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {onSite.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      onUpdated={reload}
                      onCheckedIn={(ev) => setRecentEvent({ kind: 'checkin', ...ev })}
                      onCheckedOut={(ev) => setRecentEvent({ kind: 'checkout', ...ev })}
                    />
                  ))}
                </div>
              </section>
            )}
            {upcoming.length > 0 && (
              <section>
                <SectionHead>Upcoming</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcoming.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      onUpdated={reload}
                      onCheckedIn={(ev) => setRecentEvent({ kind: 'checkin', ...ev })}
                      onCheckedOut={(ev) => setRecentEvent({ kind: 'checkout', ...ev })}
                    />
                  ))}
                </div>
              </section>
            )}
            {recent.length > 0 && (
              <section>
                <SectionHead>Recently completed</SectionHead>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recent.map((j) => (
                    <JobCard
                      key={j.id}
                      job={j}
                      onUpdated={reload}
                      onCheckedIn={(ev) => setRecentEvent({ kind: 'checkin', ...ev })}
                      onCheckedOut={(ev) => setRecentEvent({ kind: 'checkout', ...ev })}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
