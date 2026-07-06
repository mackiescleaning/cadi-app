import { useEffect, useState } from 'react';
import { Star, Award, Sparkles } from 'lucide-react';
import PublicProfilePreview from '../../components/PublicProfilePreview';
import {
  getMyConnectProfile,
  listMyFmRatings,
  listMySubDocs,
  uploadSubDoc,
  deleteSubDoc,
  signSubDocUrl,
  SUB_DOC_TYPES,
} from '../../lib/db/connectDb';
import {
  CONNECT_COLORS,
  CONNECT_RADII,
  ON_DARK,
  glassDark,
  navyCanvas,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const GREEN = '#22c55e';
const BLUE = '#7ea3ff';
const PURPLE = '#c084fc';

function Stars({ n }) {
  return (
    <span aria-label={`${n} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          style={{ color: i <= n ? '#fbbf24' : 'rgba(255,255,255,0.20)', fontSize: 14 }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const METRIC_LABEL = {
  approval_rate: 'Approval rate',
  reject_rate: 'No rejections',
  query_rate: 'No queries',
  fm_rating: 'FM star rating',
  on_time_check_in: 'On-time check-in',
  evidence_quality: 'Photo evidence',
  site_contact: 'Site contact captured',
  response_time: 'Query response',
};

function tierMeta(tier) {
  const map = {
    elite: { label: 'Connect Elite', color: PURPLE, glow: 'rgba(192,132,252,0.45)' },
    verified: { label: 'Connect Verified', color: GREEN, glow: 'rgba(34,197,94,0.45)' },
    trusted: { label: 'Trusted', color: GREEN, glow: 'rgba(34,197,94,0.45)' },
    eligible: { label: 'Connect Eligible', color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },
    active: { label: 'Active', color: BLUE, glow: 'rgba(126,163,255,0.45)' },
    new: { label: 'New', color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },
  };
  return (
    map[tier] || { label: 'Building reputation', color: '#a3a3a3', glow: 'rgba(163,163,163,0.35)' }
  );
}

const SUBLABEL = {
  fontSize: 10,
  fontWeight: 800,
  color: ON_DARK.muted,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
};

function docStatus(doc) {
  if (!doc) return { tone: 'missing', label: 'Missing' };
  if (doc.expiry_date) {
    const days = Math.round((new Date(doc.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { tone: 'expired', label: 'Expired', sub: `${Math.abs(days)}d ago` };
    if (days <= 30) return { tone: 'expiring', label: 'Expiring', sub: `in ${days}d` };
    return {
      tone: 'ok',
      label: 'Uploaded',
      sub: `Expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }
  return { tone: 'ok', label: 'Uploaded', sub: 'No expiry set' };
}

const DARK_INPUT_STYLE = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.16)',
  fontSize: 12,
  color: '#ffffff',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

/* ─── Doc row ─────────────────────────────────────────────────────────────── */
function DocRow({ type, doc, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState(null);
  const [expiry, setExpiry] = useState(doc?.expiry_date ?? '');
  const [provider, setProvider] = useState(doc?.provider ?? '');
  const [policy, setPolicy] = useState(doc?.policy_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const status = docStatus(doc);
  const tone = status.tone;
  const toneColor =
    tone === 'ok'
      ? GREEN
      : tone === 'expiring'
        ? '#fbbf24'
        : tone === 'expired'
          ? '#f87171'
          : ON_DARK.faint;
  const toneBg =
    tone === 'ok'
      ? 'rgba(34,197,94,0.14)'
      : tone === 'expiring'
        ? 'rgba(251,191,36,0.14)'
        : tone === 'expired'
          ? 'rgba(220,38,38,0.14)'
          : 'rgba(255,255,255,0.06)';

  async function handleView() {
    if (!doc?.file_path) return;
    const url = await signSubDocUrl(doc.file_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) {
      setError('Pick a file first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await uploadSubDoc({
        docType: type.key,
        file,
        expiryDate: expiry || null,
        provider: provider || null,
        policyNumber: policy || null,
      });
      setFile(null);
      setExpanded(false);
      await onChanged();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!doc || !confirm(`Remove your ${type.label}?`)) return;
    setSaving(true);
    try {
      await deleteSubDoc(doc.id);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 900,
            color: toneColor,
            background: toneBg,
            border: `1px solid ${toneColor}55`,
            padding: '3px 9px',
            borderRadius: 999,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {status.label}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: '#ffffff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {type.label}
          </div>
          <div
            style={{
              fontSize: 11,
              color: ON_DARK.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc ? `${status.sub}${doc.provider ? ` · ${doc.provider}` : ''}` : type.hint}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {doc && (
            <button
              onClick={handleView}
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: BLUE,
                background: 'transparent',
                border: 'none',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              View
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontSize: 11,
              fontWeight: 900,
              padding: '7px 12px',
              borderRadius: 8,
              background: doc ? 'rgba(255,255,255,0.08)' : '#ffffff',
              color: doc ? '#ffffff' : CONNECT_COLORS.navy,
              border: `1px solid ${doc ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.5)'}`,
              cursor: 'pointer',
            }}
          >
            {expanded ? 'Cancel' : doc ? 'Replace' : 'Upload'}
          </button>
        </div>
      </div>

      {expanded && (
        <form
          onSubmit={handleUpload}
          style={{
            borderTop: '1px solid rgba(255,255,255,0.08)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            background: 'rgba(255,255,255,0.03)',
          }}
        >
          <label style={{ display: 'block' }}>
            <span style={SUBLABEL}>File</span>
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ ...DARK_INPUT_STYLE, marginTop: 6 }}
            />
            <span style={{ fontSize: 10, color: ON_DARK.faint, marginTop: 4, display: 'block' }}>
              PDF or image, max 10 MB
            </span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'block' }}>
              <span style={SUBLABEL}>Expiry date</span>
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={{ ...DARK_INPUT_STYLE, marginTop: 6 }}
              />
            </label>
            <label style={{ display: 'block' }}>
              <span style={SUBLABEL}>Provider</span>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Simply Business"
                style={{ ...DARK_INPUT_STYLE, marginTop: 6 }}
              />
            </label>
          </div>
          <label style={{ display: 'block' }}>
            <span style={SUBLABEL}>Policy / reference number</span>
            <input
              type="text"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              style={{ ...DARK_INPUT_STYLE, marginTop: 6 }}
            />
          </label>
          {error && (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                fontSize: 11,
                color: '#fca5a5',
                background: 'rgba(220,38,38,0.14)',
                border: '1px solid rgba(220,38,38,0.30)',
              }}
            >
              {error}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="submit"
              disabled={saving || !file}
              style={{
                fontSize: 12,
                fontWeight: 900,
                padding: '10px 18px',
                borderRadius: 10,
                background: saving || !file ? 'rgba(255,255,255,0.10)' : '#ffffff',
                color: saving || !file ? ON_DARK.muted : CONNECT_COLORS.navy,
                border: '1px solid rgba(255,255,255,0.4)',
                cursor: saving || !file ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
            </button>
            {doc && (
              <button
                type="button"
                onClick={handleDelete}
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#fca5a5',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 12px',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/* ─── Compliance section ──────────────────────────────────────────────────── */
function ComplianceSection() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function reload() {
    setError(null);
    try {
      setDocs(await listMySubDocs());
    } catch (e) {
      setError(e.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const byType = docs.reduce((acc, d) => {
    acc[d.doc_type] = d;
    return acc;
  }, {});
  const totalOk = SUB_DOC_TYPES.filter((t) => byType[t.key]).length;

  return (
    <div style={{ ...glassDark({ padding: 20, radius: CONNECT_RADII.xl, strong: true }) }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 12,
        }}
      >
        <div>
          <div style={{ ...SUBLABEL }}>Compliance & insurance</div>
          <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 6, lineHeight: 1.5 }}>
            FMs see badges based on what you've uploaded. Missing docs = fewer marketplace
            opportunities.
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{ fontSize: 22, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}
          >
            {totalOk}
            <span style={{ color: ON_DARK.faint, fontSize: 14, fontWeight: 500 }}>
              /{SUB_DOC_TYPES.length}
            </span>
          </div>
          <div style={{ ...SUBLABEL, textAlign: 'right' }}>on file</div>
        </div>
      </div>

      {loading && (
        <div style={{ fontSize: 12, color: ON_DARK.muted, textAlign: 'center', padding: '16px 0' }}>
          Loading documents…
        </div>
      )}
      {error && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            marginBottom: 12,
            fontSize: 12,
            color: '#fca5a5',
            background: 'rgba(220,38,38,0.14)',
            border: '1px solid rgba(220,38,38,0.30)',
          }}
        >
          {error}
        </div>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SUB_DOC_TYPES.map((t) => (
            <DocRow key={t.key} type={t} doc={byType[t.key]} onChanged={reload} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnReputation() {
  const [available, setAvailable] = useState(true);
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState([]);

  useEffect(() => {
    getMyConnectProfile()
      .then(setProfile)
      .catch(() => {});
    listMyFmRatings()
      .then(setRatings)
      .catch(() => setRatings([]));
  }, []);

  const avgStars =
    ratings.length > 0
      ? Math.round((ratings.reduce((s, r) => s + Number(r.stars || 0), 0) / ratings.length) * 10) /
        10
      : null;

  const score = profile?.connect_score ?? null;
  const status = profile?.connect_score_status ?? null;
  const tier = tierMeta(status === 'building' ? null : profile?.connect_tier);
  const breakdown = profile?.score_breakdown ?? null;
  const metrics = breakdown?.metrics ?? null;
  const jobsInWindow = breakdown?.jobs_in_window ?? 0;
  const recomputedAt = profile?.score_recomputed_at;

  return (
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={navyCanvas()}>
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
              radial-gradient(120% 80% at 100% 0%, rgba(194, 65, 12, 0.30) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(79, 120, 255, 0.18) 0%, transparent 60%),
              rgba(255,255,255,0.04)
            `,
          }}
        >
          <div className="relative px-6 md:px-9 py-7 md:py-8 flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: ORANGE, boxShadow: '0 8px 20px -6px rgba(194,65,12,0.6)' }}
                >
                  <Star size={13} color="#ffffff" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/60 uppercase">
                  My Profile
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
                Your portable <span style={{ color: '#ffb08a' }}>reputation.</span>
              </h1>
              <p className="text-white/60 text-[14px] leading-relaxed max-w-2xl">
                This is how FM companies see you on Cadi Connect. Score updates nightly from your
                last 90 days of work.
              </p>
            </div>

            {/* Score badge on right */}
            <div className="relative shrink-0" style={{ width: 130 }}>
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: tier.glow, transform: 'scale(0.9)' }}
              />
              <div
                style={{
                  ...glassDark({ radius: 999, blur: 20, strong: true }),
                  position: 'relative',
                  width: 130,
                  height: 130,
                  border: `1px solid ${tier.glow}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    color: ON_DARK.muted,
                    fontSize: 9,
                    fontWeight: 900,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Cadi Score
                </div>
                <div
                  style={{
                    color: '#ffffff',
                    fontSize: 36,
                    fontWeight: 900,
                    lineHeight: 1,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {score ?? '—'}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 900,
                    color: '#ffffff',
                    background: 'rgba(255,255,255,0.14)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {tier.label.replace('Connect ', '')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── AVAILABILITY TOGGLE ──────────────────────────────────── */}
        <div
          style={{
            ...glassDark({ padding: 18, radius: CONNECT_RADII.lg, strong: true }),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: available
                  ? `linear-gradient(135deg, #34d399 0%, #047857 100%)`
                  : 'rgba(255,255,255,0.10)',
                border: '1px solid rgba(255,255,255,0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: available ? '0 12px 30px -12px rgba(16,185,129,0.55)' : 'none',
              }}
            >
              <Sparkles size={16} color="#ffffff" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                }}
              >
                Availability
              </div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
                {available
                  ? 'Visible to FMs and accepting new work'
                  : 'Hidden from FMs — not taking on new work'}
              </div>
            </div>
          </div>
          <button
            onClick={() => setAvailable((v) => !v)}
            style={{
              position: 'relative',
              width: 48,
              height: 26,
              borderRadius: 999,
              background: available ? GREEN : 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.20)',
              cursor: 'pointer',
              transition: 'background 200ms ease',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 3,
                width: 18,
                height: 18,
                borderRadius: 999,
                background: '#ffffff',
                boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                transition: 'left 200ms ease',
                left: available ? '26px' : '3px',
              }}
            />
          </button>
        </div>

        {/* ─── PUBLIC PROFILE PREVIEW (light card wrapper) ────────── */}
        <div>
          <div
            style={{
              ...SUBLABEL,
              marginBottom: 10,
              marginLeft: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Award size={12} /> How FMs see you
          </div>
          <div
            style={{
              padding: 4,
              background: 'rgba(255,255,255,0.94)',
              border: '1px solid rgba(255,255,255,0.6)',
              borderRadius: CONNECT_RADII.lg,
              boxShadow: '0 24px 48px -20px rgba(0,0,0,0.4)',
            }}
          >
            <PublicProfilePreview />
          </div>
        </div>

        {/* ─── SCORE BREAKDOWN ───────────────────────────────────── */}
        <div style={{ ...glassDark({ padding: 20, radius: CONNECT_RADII.xl, strong: true }) }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              gap: 12,
            }}
          >
            <div>
              <div style={{ ...SUBLABEL }}>Connect Score breakdown</div>
              <div style={{ fontSize: 11, color: ON_DARK.faint, marginTop: 6 }}>
                {recomputedAt
                  ? `Last recomputed ${new Date(recomputedAt).toLocaleString()}`
                  : 'Not yet computed — first daily recompute runs overnight'}
                {jobsInWindow > 0 && ` · ${jobsInWindow} jobs in last 90 days`}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 900,
                color: '#ffffff',
                background: `${tier.color}33`,
                border: `1px solid ${tier.color}55`,
                padding: '4px 10px',
                borderRadius: 999,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {tier.label}
            </span>
          </div>

          {status === 'building' && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'rgba(251,191,36,0.14)',
                border: '1px solid rgba(251,191,36,0.32)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fcd34d', marginBottom: 6 }}>
                Building reputation
              </div>
              <div style={{ fontSize: 12, color: '#fef3c7', lineHeight: 1.55 }}>
                {breakdown?.status_reason ||
                  `Complete at least 5 jobs to unlock a full Connect Score. You're at ${jobsInWindow}.`}{' '}
                Until then your profile is visible in the marketplace at a neutral score so you can
                earn work.
              </div>
            </div>
          )}

          {!metrics && status !== 'building' && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                fontSize: 12,
                color: ON_DARK.muted,
                lineHeight: 1.55,
              }}
            >
              Your score will appear here after the daily recompute (overnight) once you've
              completed a few jobs. Take photos, capture site contacts, respond fast to FM queries —
              these all push your score up.
            </div>
          )}

          {metrics && status === 'scored' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.entries(metrics).map(([key, m]) => {
                const max = m.max ?? 0;
                const pts = m.pts ?? 0;
                const pct = max > 0 ? Math.round((pts / max) * 100) : 0;
                const color =
                  pct >= 90 ? GREEN : pct >= 70 ? BLUE : pct >= 50 ? '#fbbf24' : '#f87171';
                return (
                  <div key={key}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 6,
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                          {METRIC_LABEL[key] || key}
                        </span>
                        <span style={{ fontSize: 11, color: ON_DARK.muted, marginLeft: 10 }}>
                          {m.desc}
                        </span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color }}>
                        {pts}
                        <span style={{ fontSize: 11, fontWeight: 500, color: ON_DARK.faint }}>
                          /{max}
                        </span>
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        background: 'rgba(255,255,255,0.08)',
                        borderRadius: 999,
                        height: 6,
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          borderRadius: 999,
                          width: `${pct}%`,
                          backgroundColor: color,
                          transition: 'width 300ms ease',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              padding: 12,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12,
              color: ON_DARK.muted,
              lineHeight: 1.55,
            }}
          >
            <span style={{ fontWeight: 900, color: '#ffffff' }}>Connect Score</span> is your
            portable reputation across the Cadi network. It recomputes daily from your last 90 days
            of work — approval rate, photos, on-time check-ins, query response speed. FMs use it to
            award new jobs.
          </div>
        </div>

        {/* ─── COMPLIANCE ────────────────────────────────────────── */}
        <ComplianceSection />

        {/* ─── FM REVIEWS ────────────────────────────────────────── */}
        <div
          style={{ ...glassDark({ radius: CONNECT_RADII.xl, strong: true }), overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={SUBLABEL}>FM reviews</div>
            {avgStars != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stars n={Math.round(avgStars)} />
                <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>
                  {avgStars.toFixed(1)}
                </span>
                <span style={{ fontSize: 11, color: ON_DARK.muted }}>
                  ({ratings.length} rating{ratings.length === 1 ? '' : 's'})
                </span>
              </div>
            )}
          </div>

          {ratings.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10, color: 'rgba(255,255,255,0.20)' }}>
                ★
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#ffffff',
                  marginBottom: 6,
                  letterSpacing: '-0.01em',
                }}
              >
                No written reviews yet
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: ON_DARK.muted,
                  maxWidth: 420,
                  margin: '6px auto 0',
                  lineHeight: 1.55,
                }}
              >
                Your{' '}
                <span style={{ fontWeight: 900, color: '#ffffff' }}>Connect Score breakdown</span>{' '}
                above tracks your automated metrics. Written star reviews appear here whenever an FM
                rates you on approval.
              </div>
            </div>
          ) : (
            <div>
              {ratings.map((r, idx) => (
                <div
                  key={r.job_id}
                  style={{
                    padding: '16px 20px',
                    borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                        {r.siteName}
                      </div>
                      <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
                        {r.fmName}
                        {r.serviceDate && ` · ${fmtDate(r.serviceDate)}`}
                      </div>
                    </div>
                    <Stars n={r.stars} />
                  </div>
                  {r.comment && (
                    <p
                      style={{
                        fontSize: 13,
                        color: '#e6ecff',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                      }}
                    >
                      {r.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
