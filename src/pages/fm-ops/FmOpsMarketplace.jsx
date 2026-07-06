import { useEffect, useMemo, useState } from 'react';
import {
  Send,
  Plus,
  Search,
  MapPin,
  ChevronRight,
  Loader2,
  Award,
  X,
  CheckCircle2,
  MessageCircleQuestion,
} from 'lucide-react';
import {
  listFmListings,
  getListingWithBids,
  listVisitSpecsForListing,
  publishSingleListing,
  awardListing,
  closeListing,
  getMyFmOrganisation,
  listListingQuestionsFm,
  postListingAnswer,
  LISTING_STATUS,
  FORMAT_LABEL,
  TIER_LABEL,
  TIER_COLOR,
} from '../../lib/db/fmOpsDb';
import {
  blueCanvas,
  glassDark,
  primaryButton,
  ON_DARK,
  HOVER_LIFT,
  FM_POP as POP,
} from '../../lib/connectTheme';

const STATUS_TABS = [
  { id: 'live', label: 'Live' },
  { id: 'open', label: 'Open' },
  { id: 'bidding', label: 'Bidding' },
  { id: 'awarded', label: 'Awarded' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

const FREQ_LABEL = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  one_off: 'One-off',
};

// LISTING_STATUS db colours are for light surfaces — brighten for navy.
const STATUS_POP = {
  draft: 'rgba(255,255,255,0.55)',
  open: POP.blue,
  bidding: POP.orange,
  awarded: POP.green,
  closed: 'rgba(255,255,255,0.40)',
};
const statusPop = (s) => STATUS_POP[s] || 'rgba(255,255,255,0.55)';

const DRAWER_BG = 'linear-gradient(180deg, #071041 0%, #030925 100%)';
const CELL = { background: 'rgba(255,255,255,0.06)', border: `1px solid ${ON_DARK.line}` };

function StatusPill({ status }) {
  const m = LISTING_STATUS[status] || { label: status };
  const c = statusPop(status);
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
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {m.label}
    </span>
  );
}

function TierBadge({ tier }) {
  if (!tier) return null;
  const colour = TIER_COLOR[tier] || 'rgba(255,255,255,0.45)';
  const hex = colour.startsWith('#');
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: colour,
        background: hex ? `${colour}22` : 'rgba(255,255,255,0.08)',
        border: `1px solid ${hex ? `${colour}45` : 'rgba(255,255,255,0.16)'}`,
        padding: '2px 7px',
        borderRadius: 999,
      }}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}

function FitBar({ value, label, color = POP.orange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
      <span style={{ color: ON_DARK.muted, fontWeight: 700, width: 64 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: color,
          }}
        />
      </div>
      <span style={{ color: ON_DARK.primary, fontWeight: 800, width: 28, textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ─── Listing card ───────────────────────────────────────────────────────────
function ListingCard({ listing, onOpen }) {
  const pop = statusPop(listing.status);
  const vs = listing.visit_spec;
  return (
    <button
      onClick={onOpen}
      className={HOVER_LIFT}
      style={{
        ...glassDark({ radius: 16, padding: 14 }),
        borderLeft: `4px solid ${pop}`,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: ON_DARK.muted,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          #{listing.id.slice(0, 8)}
        </span>
        <StatusPill status={listing.status} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: ON_DARK.primary, marginBottom: 3 }}>
          {vs?.site?.name ?? 'Site'}
        </div>
        <div style={{ fontSize: 11, color: ON_DARK.secondary }}>
          <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
          {vs?.site?.postcode ?? ''} · {FREQ_LABEL[vs?.frequency] ?? vs?.frequency} · {vs?.scope}
        </div>
        {vs?.contract?.name && (
          <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 4 }}>{vs.contract.name}</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div style={{ ...CELL, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary }}>
            £{listing.target_price}
          </div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700 }}>target</div>
        </div>
        <div style={{ ...CELL, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: listing.bidCount ? POP.orange : ON_DARK.primary,
            }}
          >
            {listing.bidCount}
          </div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700 }}>bids</div>
        </div>
        <div style={{ ...CELL, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: ON_DARK.secondary }}>
            {FORMAT_LABEL[listing.format] ?? listing.format}
          </div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700 }}>format</div>
        </div>
      </div>
    </button>
  );
}

// ─── New listing drawer ────────────────────────────────────────────────────
function NewListingDrawer({ fmOrg, onClose, onPublished }) {
  const [specs, setSpecs] = useState([]);
  const [loadingSpecs, setLoadingSpecs] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState(null);
  const [fields, setFields] = useState({
    target_price: '',
    floor_price: '',
    ceiling_price: '',
    visibility: 'open',
    format: 'auction',
    score_floor: 70,
    bid_window_hours: 72,
    award_rule: 'best_fit',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setSpecs(await listVisitSpecsForListing());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingSpecs(false);
      }
    })();
  }, []);

  const pickSpec = (vs) => {
    setSelectedSpec(vs);
    setFields((f) => ({
      ...f,
      target_price: vs.price_per_visit,
      floor_price: Math.round(Number(vs.price_per_visit) * 0.8) || '',
      ceiling_price: Math.round(Number(vs.price_per_visit) * 1.1) || '',
    }));
  };

  const publish = async () => {
    if (!selectedSpec) return;
    setBusy(true);
    setError(null);
    try {
      await publishSingleListing({
        fmOrganisationId: fmOrg.id,
        visitSpec: selectedSpec,
        listingFields: fields,
      });
      onPublished?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    border: `1px solid ${ON_DARK.lineHi}`,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.08)',
    color: ON_DARK.primary,
    outline: 'none',
    colorScheme: 'dark',
  };
  const sectionLabel = {
    fontSize: 10,
    fontWeight: 800,
    color: ON_DARK.muted,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,4,25,0.55)',
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
          borderLeft: `1px solid ${ON_DARK.lineHi}`,
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
            <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>New listing</div>
            <div style={{ fontSize: 12, color: ON_DARK.secondary, marginTop: 5 }}>
              Pick an unassigned visit spec and publish it to your network.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: `1px solid ${ON_DARK.line}`,
              borderRadius: 9,
              cursor: 'pointer',
              color: ON_DARK.secondary,
              padding: 6,
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {!selectedSpec && (
          <>
            <div style={{ ...sectionLabel, marginBottom: 8 }}>Pick a visit spec</div>
            {loadingSpecs && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: ON_DARK.muted }}>
                <Loader2
                  size={16}
                  color={ON_DARK.secondary}
                  style={{
                    animation: 'spin 0.8s linear infinite',
                    display: 'block',
                    margin: '0 auto 6px',
                  }}
                />{' '}
                Loading unassigned specs…
              </div>
            )}
            {!loadingSpecs && specs.length === 0 && (
              <div
                style={{
                  padding: 24,
                  border: '1.5px dashed rgba(255,255,255,0.16)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: ON_DARK.muted,
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                No unassigned visit specs. Create a contract first or send an assigned spec back to
                "unassigned" from its detail page.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {specs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickSpec(s)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${ON_DARK.lineHi}`,
                    borderRadius: 12,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary }}>
                      {s.site?.name ?? 'Site'}
                    </div>
                    <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                      {s.contract?.name && <>{s.contract.name} · </>}
                      {FREQ_LABEL[s.frequency] ?? s.frequency} · {s.scope}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary }}>
                    £{s.price_per_visit}
                  </div>
                  <ChevronRight size={14} color={ON_DARK.faint} />
                </button>
              ))}
            </div>
          </>
        )}

        {selectedSpec && (
          <>
            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${ON_DARK.line}`,
                padding: 12,
                borderRadius: 12,
                marginBottom: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary }}>
                  {selectedSpec.site?.name}
                </div>
                <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                  {FREQ_LABEL[selectedSpec.frequency] ?? selectedSpec.frequency} ·{' '}
                  {selectedSpec.scope}
                </div>
              </div>
              <button
                onClick={() => setSelectedSpec(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  color: POP.blue,
                  fontWeight: 700,
                }}
              >
                change
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { k: 'floor_price', l: 'Floor £', placeholder: '160' },
                { k: 'target_price', l: 'Target £', placeholder: '200' },
                { k: 'ceiling_price', l: 'Ceiling £', placeholder: '230' },
              ].map((f) => (
                <div key={f.k}>
                  <div style={{ ...sectionLabel, marginBottom: 4 }}>{f.l}</div>
                  <input
                    type="number"
                    min="0"
                    placeholder={f.placeholder}
                    value={fields[f.k]}
                    onChange={(e) => setFields((prev) => ({ ...prev, [f.k]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ ...sectionLabel, marginBottom: 6 }}>Visibility</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { v: 'elite', l: 'Elite ≥93' },
                  { v: 'verified', l: 'Verified ≥80' },
                  { v: 'eligible', l: 'Eligible ≥70' },
                  { v: 'open', l: 'Any score' },
                ].map((o) => {
                  const a = fields.visibility === o.v;
                  return (
                    <button
                      key={o.v}
                      onClick={() => setFields((p) => ({ ...p, visibility: o.v }))}
                      style={{
                        fontSize: 11,
                        padding: '7px 10px',
                        borderRadius: 9,
                        flex: 1,
                        border: `1px solid ${a ? 'rgba(251,146,60,0.45)' : ON_DARK.line}`,
                        background: a ? 'rgba(251,146,60,0.14)' : 'rgba(255,255,255,0.04)',
                        color: a ? POP.orange : ON_DARK.secondary,
                        fontWeight: a ? 800 : 600,
                        cursor: 'pointer',
                      }}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}
            >
              <div>
                <div style={{ ...sectionLabel, marginBottom: 4 }}>Bid window</div>
                <select
                  value={fields.bid_window_hours}
                  onChange={(e) =>
                    setFields((p) => ({ ...p, bid_window_hours: Number(e.target.value) }))
                  }
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value={24} style={{ color: '#010a4f' }}>
                    24h
                  </option>
                  <option value={72} style={{ color: '#010a4f' }}>
                    72h
                  </option>
                  <option value={168} style={{ color: '#010a4f' }}>
                    7 days
                  </option>
                </select>
              </div>
              <div>
                <div style={{ ...sectionLabel, marginBottom: 4 }}>Award rule</div>
                <select
                  value={fields.award_rule}
                  onChange={(e) => setFields((p) => ({ ...p, award_rule: e.target.value }))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="best_fit" style={{ color: '#010a4f' }}>
                    Best fit (auto)
                  </option>
                  <option value="lowest_price" style={{ color: '#010a4f' }}>
                    Lowest bid
                  </option>
                  <option value="manual" style={{ color: '#010a4f' }}>
                    Manual
                  </option>
                </select>
              </div>
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
            <button
              onClick={publish}
              disabled={busy}
              style={{
                ...primaryButton(),
                width: '100%',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {busy && <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />}
              Publish listing →
            </button>
          </>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

// ─── Listing detail (bids ranked) ──────────────────────────────────────────
// ── Q&A thread panel (FM view — sees author names) ───────────────────────
function QaPanel({ listingId, listingStatus }) {
  const [qa, setQa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const locked = !['open', 'bidding'].includes(listingStatus);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setQa(await listListingQuestionsFm(listingId));
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when listingId changes; load() is redefined each render
  }, [listingId]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { ok, data } = await postListingAnswer({ listingId, body: text.trim() });
      if (!ok) throw new Error(data?.error || 'Send failed');
      setText('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ ...glassDark({ radius: 14, padding: 14 }), marginBottom: 14 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: ON_DARK.muted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <MessageCircleQuestion size={11} /> Bidder questions
        <span
          style={{
            fontSize: 9,
            color: ON_DARK.faint,
            fontWeight: 700,
            letterSpacing: 0,
            textTransform: 'none',
          }}
        >
          · you see names · they see each other anonymously
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginBottom: 10,
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {loading && (
          <div style={{ fontSize: 11, color: ON_DARK.faint, fontStyle: 'italic' }}>Loading…</div>
        )}
        {!loading && qa.length === 0 && (
          <div
            style={{ fontSize: 12, color: ON_DARK.muted, fontStyle: 'italic', padding: '4px 0' }}
          >
            No questions yet — subs will post here before bidding.
          </div>
        )}
        {qa.map((m) => {
          const isFm = m.author_role === 'fm';
          return (
            <div
              key={m.id}
              style={{ display: 'flex', justifyContent: isFm ? 'flex-end' : 'flex-start' }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '8px 11px',
                  borderRadius: 12,
                  background: isFm
                    ? 'linear-gradient(180deg, #d64510 0%, #C2410C 100%)'
                    : 'rgba(79,120,255,0.14)',
                  color: isFm ? 'white' : ON_DARK.primary,
                  border: isFm
                    ? '1px solid rgba(255,255,255,0.15)'
                    : '1px solid rgba(79,120,255,0.30)',
                  fontSize: 12,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 800, opacity: 0.85, marginBottom: 4 }}>
                  {isFm ? 'You' : m.authorName} · {new Date(m.created_at).toLocaleString()}
                </div>
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div
          style={{
            padding: 8,
            marginBottom: 8,
            borderRadius: 8,
            fontSize: 11,
            background: 'rgba(220,38,38,0.16)',
            border: '1px solid rgba(248,113,113,0.40)',
            color: '#fecaca',
          }}
        >
          {error}
        </div>
      )}

      {locked ? (
        <div style={{ fontSize: 11, color: ON_DARK.faint, fontStyle: 'italic', padding: '6px 0' }}>
          Q&A is closed — listing is no longer accepting bids.
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Answer bidders — everyone bidding sees your reply"
            disabled={sending}
            maxLength={2000}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 10,
              border: `1px solid ${ON_DARK.lineHi}`,
              fontSize: 12,
              color: ON_DARK.primary,
              outline: 'none',
              fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.08)',
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            style={{
              ...primaryButton({ size: 'sm' }),
              opacity: text.trim() ? 1 : 0.45,
              cursor: text.trim() ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {sending ? (
              <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <>
                <Send size={11} /> Reply
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

function ListingDetail({ listingId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [awarding, setAwarding] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getListingWithBids(listingId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when listingId changes; load() is redefined each render
  }, [listingId]);

  const handleAward = async (bid) => {
    if (
      !confirm(
        `Award £${bid.bid_price} to ${bid.subName}? This creates a scheduled job and locks the other bids.`
      )
    )
      return;
    setAwarding(bid.id);
    try {
      const { ok, data: res } = await awardListing({ listingId, bidId: bid.id });
      if (!ok) throw new Error(res?.error || 'Award failed');
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setAwarding(null);
    }
  };

  const handleClose = async () => {
    if (!confirm('Close this listing? It will stop accepting bids.')) return;
    try {
      await closeListing(listingId);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(1,4,25,0.55)',
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
          width: 640,
          maxWidth: '94vw',
          background: DRAWER_BG,
          borderLeft: `1px solid ${ON_DARK.lineHi}`,
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
              color: ON_DARK.muted,
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color={ON_DARK.secondary}
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 8px',
              }}
            />{' '}
            Loading listing…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && (!data || error) && (
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
            {error || 'Listing not found.'}
          </div>
        )}
        {!loading && data && (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <StatusPill status={data.status} />
                  <TierBadge tier={data.visibility !== 'open' ? data.visibility : null} />
                  <span style={{ fontSize: 10, color: ON_DARK.faint }}>#{data.id.slice(0, 8)}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: ON_DARK.primary }}>
                  {data.visit_spec?.site?.name}
                </div>
                <div style={{ fontSize: 11, color: ON_DARK.secondary, marginTop: 5 }}>
                  <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {data.visit_spec?.site?.postcode} ·{' '}
                  {FREQ_LABEL[data.visit_spec?.frequency] ?? data.visit_spec?.frequency} ·{' '}
                  {data.visit_spec?.scope}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: `1px solid ${ON_DARK.line}`,
                  borderRadius: 9,
                  cursor: 'pointer',
                  color: ON_DARK.secondary,
                  padding: 6,
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4,1fr)',
                gap: 8,
                marginBottom: 14,
              }}
            >
              {[
                { l: 'Target', v: `£${data.target_price}` },
                { l: 'Floor', v: data.floor_price != null ? `£${data.floor_price}` : '—' },
                { l: 'Ceiling', v: data.ceiling_price != null ? `£${data.ceiling_price}` : '—' },
                { l: 'Bids', v: data.bids.length },
              ].map((k) => (
                <div
                  key={k.l}
                  style={{ ...CELL, borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 14, fontWeight: 900, color: ON_DARK.primary }}>{k.v}</div>
                  <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 2 }}>
                    {k.l}
                  </div>
                </div>
              ))}
            </div>

            {data.status !== 'awarded' && data.status !== 'closed' && (
              <button
                onClick={handleClose}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: POP.red,
                  background: 'rgba(220,38,38,0.12)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  borderRadius: 9,
                  padding: '5px 11px',
                  cursor: 'pointer',
                  marginBottom: 14,
                }}
              >
                Close listing
              </button>
            )}

            {/* Q&A thread — bidders' questions + your public answers */}
            <QaPanel listingId={listingId} listingStatus={data.status} />

            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: ON_DARK.muted,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Bids ranked by {data.award_rule === 'lowest_price' ? 'price' : 'best fit'}
            </div>

            {data.bids.length === 0 && (
              <div
                style={{
                  padding: 24,
                  border: '1.5px dashed rgba(255,255,255,0.16)',
                  borderRadius: 12,
                  fontSize: 12,
                  color: ON_DARK.muted,
                  textAlign: 'center',
                }}
              >
                No bids yet. Cadi is auto-matching subs — first bid usually arrives within 1 hour.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.bids.map((bid, i) => {
                const isTop = i === 0 && data.status !== 'awarded';
                const isWinner = bid.status === 'accepted';
                const fitColour =
                  bid.fit >= 90
                    ? POP.green
                    : bid.fit >= 80
                      ? POP.blue
                      : bid.fit >= 70
                        ? POP.amber
                        : POP.red;
                return (
                  <div
                    key={bid.id}
                    style={{
                      background: isWinner
                        ? 'rgba(52,211,153,0.10)'
                        : isTop
                          ? 'rgba(52,211,153,0.05)'
                          : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isWinner ? 'rgba(52,211,153,0.50)' : isTop ? 'rgba(52,211,153,0.30)' : ON_DARK.line}`,
                      borderRadius: 12,
                      padding: 12,
                      position: 'relative',
                    }}
                  >
                    {isWinner && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: 12,
                          fontSize: 9,
                          fontWeight: 900,
                          letterSpacing: '0.1em',
                          color: '#01120b',
                          background: POP.green,
                          padding: '3px 8px',
                          borderRadius: 999,
                        }}
                      >
                        ✓ AWARDED
                      </span>
                    )}
                    {isTop && !isWinner && (
                      <span
                        style={{
                          position: 'absolute',
                          top: -8,
                          left: 12,
                          fontSize: 9,
                          fontWeight: 900,
                          letterSpacing: '0.1em',
                          color: '#01120b',
                          background: POP.green,
                          padding: '3px 8px',
                          borderRadius: 999,
                        }}
                      >
                        BEST FIT
                      </span>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1.2fr 90px 120px',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 800, color: ON_DARK.primary }}>
                            {bid.subName}
                          </span>
                          <TierBadge tier={bid.subTier} />
                        </div>
                        <div style={{ fontSize: 10, color: ON_DARK.muted }}>
                          Score <strong style={{ color: ON_DARK.primary }}>{bid.subScore}</strong>
                          {bid.subRegion ? <> · {bid.subRegion}</> : null}
                          {' · '}cap {bid.subCapacity}
                        </div>
                        {bid.note && (
                          <div
                            style={{
                              fontSize: 10,
                              color: ON_DARK.secondary,
                              marginTop: 6,
                              fontStyle: 'italic',
                              padding: '4px 8px',
                              background: 'rgba(255,255,255,0.06)',
                              borderRadius: 8,
                            }}
                          >
                            "{bid.note}"
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <FitBar
                          label="Price"
                          value={
                            data.floor_price &&
                            data.target_price &&
                            data.target_price > data.floor_price
                              ? Math.max(
                                  60,
                                  100 -
                                    Math.round(
                                      ((Number(bid.bid_price) - Number(data.floor_price)) /
                                        (Number(data.target_price) - Number(data.floor_price))) *
                                        50
                                    )
                                )
                              : 90
                          }
                          color={POP.orange}
                        />
                        <FitBar label="Score" value={bid.subScore} color={POP.green} />
                        <FitBar
                          label="Capacity"
                          value={Math.min(100, bid.subCapacity * 10)}
                          color="#a78bfa"
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 18,
                            fontWeight: 900,
                            color: ON_DARK.primary,
                            lineHeight: 1,
                          }}
                        >
                          £{bid.bid_price}
                        </div>
                        <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                          per visit
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            border: `3px solid ${fitColour}`,
                            fontSize: 13,
                            fontWeight: 900,
                            color: fitColour,
                            marginBottom: 6,
                          }}
                        >
                          {bid.fit}
                        </div>
                        <div
                          style={{
                            fontSize: 9,
                            color: ON_DARK.muted,
                            fontWeight: 700,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            marginBottom: 6,
                          }}
                        >
                          fit
                        </div>
                        {!isWinner &&
                          data.status !== 'awarded' &&
                          data.status !== 'closed' &&
                          bid.status === 'submitted' && (
                            <button
                              onClick={() => handleAward(bid)}
                              disabled={!!awarding}
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: 'white',
                                background: isTop
                                  ? 'linear-gradient(180deg, #10b981 0%, #047857 100%)'
                                  : 'linear-gradient(180deg, #d64510 0%, #C2410C 100%)',
                                border: '1px solid rgba(255,255,255,0.15)',
                                borderRadius: 8,
                                padding: '6px 12px',
                                cursor: awarding ? 'not-allowed' : 'pointer',
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                              }}
                            >
                              {awarding === bid.id && (
                                <Loader2
                                  size={11}
                                  style={{ animation: 'spin 0.8s linear infinite' }}
                                />
                              )}
                              <Award size={11} /> Award
                            </button>
                          )}
                        {bid.status === 'lost' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: ON_DARK.faint }}>
                            not awarded
                          </span>
                        )}
                        {bid.status === 'withdrawn' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: ON_DARK.faint }}>
                            withdrawn
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {data.status === 'awarded' && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  background: 'rgba(52,211,153,0.12)',
                  border: '1px solid rgba(52,211,153,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 12,
                  color: ON_DARK.secondary,
                }}
              >
                <CheckCircle2 size={16} color={POP.green} />
                <span>
                  Awarded{' '}
                  {data.awarded_at ? `on ${new Date(data.awarded_at).toLocaleDateString()}` : ''}. A
                  scheduled job has been created.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function FmOpsMarketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('live');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [fmOrg, setFmOrg] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, org] = await Promise.all([listFmListings(), getMyFmOrganisation()]);
      setListings(rows);
      setFmOrg(org);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let r = listings;
    if (tab === 'live') {
      r = r.filter((l) => l.status === 'open' || l.status === 'bidding');
    } else if (tab !== 'all') {
      r = r.filter((l) => l.status === tab);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter(
        (l) =>
          l.visit_spec?.site?.name?.toLowerCase().includes(needle) ||
          l.visit_spec?.contract?.name?.toLowerCase().includes(needle)
      );
    }
    return r;
  }, [listings, tab, q]);

  const counts = useMemo(() => {
    const c = { live: 0, open: 0, bidding: 0, awarded: 0, closed: 0 };
    listings.forEach((l) => {
      if (l.status === 'open' || l.status === 'bidding') c.live++;
      if (c[l.status] != null) c[l.status]++;
    });
    return c;
  }, [listings]);

  return (
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
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
                  background: 'rgba(251,146,60,0.20)',
                  color: POP.orange,
                  border: '1px solid rgba(251,146,60,0.40)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={17} />
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: ON_DARK.muted,
                }}
              >
                FM Operations · Marketplace
              </div>
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-0.02em',
                color: ON_DARK.primary,
                margin: 0,
              }}
            >
              Listings, bids &amp; <span style={{ color: POP.orange }}>awards</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6, maxWidth: 560 }}>
              Your published listings, ranked bids, and award flow. Cadi auto-matches the top subs
              per listing.
            </div>
          </div>
          <button
            onClick={() => setNewOpen(true)}
            className={HOVER_LIFT}
            style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
          >
            <Plus size={14} /> New listing
          </button>
        </div>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 18,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              ...glassDark({ radius: 12 }),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              flex: 1,
              maxWidth: 340,
              minWidth: 200,
            }}
          >
            <Search size={13} color={ON_DARK.faint} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by site or contract…"
              style={{
                border: 'none',
                outline: 'none',
                flex: 1,
                fontSize: 12,
                color: ON_DARK.primary,
                background: 'transparent',
              }}
            />
          </div>
          <div
            style={{
              ...glassDark({ radius: 12 }),
              display: 'flex',
              gap: 4,
              padding: 4,
              flexWrap: 'wrap',
            }}
          >
            {STATUS_TABS.map((t) => {
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
                    background: active ? 'rgba(251,146,60,0.22)' : 'transparent',
                    color: active ? '#fff' : ON_DARK.muted,
                    border: active ? '1px solid rgba(251,146,60,0.40)' : '1px solid transparent',
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
                        background: active ? POP.orange : 'rgba(255,255,255,0.10)',
                        color: active ? '#01120b' : ON_DARK.secondary,
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
        </div>

        {loading && (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              fontSize: 12,
              color: ON_DARK.muted,
              fontWeight: 700,
            }}
          >
            <Loader2
              size={20}
              color={ON_DARK.secondary}
              style={{
                animation: 'spin 0.8s linear infinite',
                display: 'block',
                margin: '0 auto 10px',
              }}
            />{' '}
            Loading listings…
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

        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              padding: '44px 24px',
              borderRadius: 18,
              border: '1.5px dashed rgba(255,255,255,0.16)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: 'rgba(251,146,60,0.16)',
                color: POP.orange,
                border: '1px solid rgba(251,146,60,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <Send size={24} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ON_DARK.primary, marginBottom: 6 }}>
              {listings.length === 0 ? 'No listings yet' : 'Nothing matches this filter'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: ON_DARK.muted,
                maxWidth: 400,
                margin: '0 auto 18px',
                lineHeight: 1.6,
              }}
            >
              {listings.length === 0
                ? 'Publish unassigned visit specs to your network — Cadi auto-matches the best subs and routes bids back to you.'
                : 'Try a different status tab to see other listings.'}
            </div>
            {listings.length === 0 && fmOrg && (
              <button
                onClick={() => setNewOpen(true)}
                className={HOVER_LIFT}
                style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <Plus size={14} /> New listing
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 14,
            }}
          >
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onOpen={() => setOpenId(l.id)} />
            ))}
          </div>
        )}

        {openId && (
          <ListingDetail listingId={openId} onClose={() => setOpenId(null)} onChanged={load} />
        )}

        {newOpen && fmOrg && (
          <NewListingDrawer fmOrg={fmOrg} onClose={() => setNewOpen(false)} onPublished={load} />
        )}
      </div>
    </div>
  );
}
