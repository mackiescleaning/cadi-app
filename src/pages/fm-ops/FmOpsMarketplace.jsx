import { useEffect, useMemo, useState } from 'react';
import {
  Send, Plus, Search, MapPin, ChevronRight, Loader2, AlertCircle,
  Award, X, CheckCircle2,
} from 'lucide-react';
import {
  listFmListings,
  getListingWithBids,
  listVisitSpecsForListing,
  publishSingleListing,
  awardListing,
  closeListing,
  getMyFmOrganisation,
  LISTING_STATUS,
  FORMAT_LABEL,
  TIER_LABEL,
  TIER_COLOR,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const STATUS_TABS = [
  { id: 'live',     label: 'Live'      },
  { id: 'open',     label: 'Open'      },
  { id: 'bidding',  label: 'Bidding'   },
  { id: 'awarded',  label: 'Awarded'   },
  { id: 'closed',   label: 'Closed'    },
  { id: 'all',      label: 'All'       },
];

const FREQ_LABEL = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
  quarterly: 'Quarterly', annual: 'Annual', one_off: 'One-off',
};

function StatusPill({ status }) {
  const m = LISTING_STATUS[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999,
      whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
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

function FitBar({ value, label, color = ACCENT }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10 }}>
      <span style={{ color: SUB, fontWeight: 700, width: 64 }}>{label}</span>
      <div style={{ flex: 1, height: 4, background: SOFT, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
      <span style={{ color: INK, fontWeight: 800, width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ─── Listing card ───────────────────────────────────────────────────────────
function ListingCard({ listing, onOpen }) {
  const m = LISTING_STATUS[listing.status] || { color: SUB };
  const vs = listing.visit_spec;
  return (
    <button
      onClick={onOpen}
      style={{
        background: PAPER, border: `1px solid ${LINE}`,
        borderLeft: `4px solid ${m.color}`, borderRadius: 12,
        padding: 14, cursor: 'pointer', textAlign: 'left',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          #{listing.id.slice(0, 8)}
        </span>
        <StatusPill status={listing.status} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: INK, marginBottom: 2 }}>
          {vs?.site?.name ?? 'Site'}
        </div>
        <div style={{ fontSize: 11, color: SUB }}>
          <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
          {vs?.site?.postcode ?? ''} · {FREQ_LABEL[vs?.frequency] ?? vs?.frequency} · {vs?.scope}
        </div>
        {vs?.contract?.name && (
          <div style={{ fontSize: 10, color: MUTE, marginTop: 4 }}>{vs.contract.name}</div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>£{listing.target_price}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>target</div>
        </div>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: NAVY }}>{listing.bidCount}</div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>bids</div>
        </div>
        <div style={{ background: SOFT, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: SUB }}>
            {FORMAT_LABEL[listing.format] ?? listing.format}
          </div>
          <div style={{ fontSize: 9, color: SUB, fontWeight: 700 }}>format</div>
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
      try { setSpecs(await listVisitSpecsForListing()); }
      catch (e) { setError(e.message); }
      finally { setLoadingSpecs(false); }
    })();
  }, []);

  const pickSpec = (vs) => {
    setSelectedSpec(vs);
    setFields(f => ({
      ...f,
      target_price:  vs.price_per_visit,
      floor_price:   Math.round(Number(vs.price_per_visit) * 0.8) || '',
      ceiling_price: Math.round(Number(vs.price_per_visit) * 1.1) || '',
    }));
  };

  const publish = async () => {
    if (!selectedSpec) return;
    setBusy(true); setError(null);
    try {
      await publishSingleListing({
        fmOrganisationId: fmOrg.id,
        visitSpec:        selectedSpec,
        listingFields:    fields,
      });
      onPublished?.();
      onClose();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
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
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>New listing</div>
            <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
              Pick an unassigned visit spec and publish it to your network.
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {!selectedSpec && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Pick a visit spec
            </div>
            {loadingSpecs && (
              <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: SUB }}>
                <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 6px' }} /> Loading unassigned specs…
              </div>
            )}
            {!loadingSpecs && specs.length === 0 && (
              <div style={{ padding: 24, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10, fontSize: 12, color: SUB, textAlign: 'center' }}>
                No unassigned visit specs. Create a contract first or send an assigned spec back to "unassigned" from its detail page.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {specs.map(s => (
                <button
                  key={s.id}
                  onClick={() => pickSpec(s)}
                  style={{
                    background: PAPER, border: `1px solid ${LINE}`,
                    borderRadius: 10, padding: 12, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{s.site?.name ?? 'Site'}</div>
                    <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
                      {s.contract?.name && <>{s.contract.name} · </>}
                      {FREQ_LABEL[s.frequency] ?? s.frequency} · {s.scope}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>£{s.price_per_visit}</div>
                  <ChevronRight size={14} color={MUTE} />
                </button>
              ))}
            </div>
          </>
        )}

        {selectedSpec && (
          <>
            <div style={{ background: SOFT, padding: 12, borderRadius: 10, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{selectedSpec.site?.name}</div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>
                  {FREQ_LABEL[selectedSpec.frequency] ?? selectedSpec.frequency} · {selectedSpec.scope}
                </div>
              </div>
              <button onClick={() => setSelectedSpec(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: SUB, fontWeight: 700 }}>change</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { k: 'floor_price',   l: 'Floor £', placeholder: '160' },
                { k: 'target_price',  l: 'Target £', placeholder: '200' },
                { k: 'ceiling_price', l: 'Ceiling £', placeholder: '230' },
              ].map(f => (
                <div key={f.k}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{f.l}</div>
                  <input
                    type="number" min="0" placeholder={f.placeholder}
                    value={fields[f.k]}
                    onChange={e => setFields(prev => ({ ...prev, [f.k]: e.target.value }))}
                    style={{
                      width: '100%', padding: '8px 10px', fontSize: 13,
                      border: `1px solid ${LINE}`, borderRadius: 8,
                      background: PAPER, color: INK, outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>Visibility</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { v: 'elite',    l: 'Elite ≥93' },
                  { v: 'verified', l: 'Verified ≥80' },
                  { v: 'eligible', l: 'Eligible ≥70' },
                  { v: 'open',     l: 'Any score' },
                ].map(o => {
                  const a = fields.visibility === o.v;
                  return (
                    <button key={o.v} onClick={() => setFields(p => ({ ...p, visibility: o.v }))} style={{
                      fontSize: 11, padding: '6px 10px', borderRadius: 6, flex: 1,
                      border: `1px solid ${a ? ACCENT : LINE}`,
                      background: a ? `${ACCENT}10` : PAPER,
                      color: a ? ACCENT : INK,
                      fontWeight: a ? 800 : 600, cursor: 'pointer',
                    }}>{o.l}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Bid window</div>
                <select
                  value={fields.bid_window_hours}
                  onChange={e => setFields(p => ({ ...p, bid_window_hours: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER }}
                >
                  <option value={24}>24h</option>
                  <option value={72}>72h</option>
                  <option value={168}>7 days</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Award rule</div>
                <select
                  value={fields.award_rule}
                  onChange={e => setFields(p => ({ ...p, award_rule: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: `1px solid ${LINE}`, borderRadius: 8, background: PAPER }}
                >
                  <option value="best_fit">Best fit (auto)</option>
                  <option value="lowest_price">Lowest bid</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            {error && (
              <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#b91c1c' }}>
                {error}
              </div>
            )}
            <button
              onClick={publish}
              disabled={busy}
              style={{
                width: '100%', background: busy ? MUTE : ACCENT, color: 'white', border: 'none',
                borderRadius: 8, padding: '12px 18px', fontSize: 13, fontWeight: 800,
                cursor: busy ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
function ListingDetail({ listingId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [awarding, setAwarding] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await getListingWithBids(listingId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [listingId]);

  const handleAward = async (bid) => {
    if (!confirm(`Award £${bid.bid_price} to ${bid.subName}? This creates a scheduled job and locks the other bids.`)) return;
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
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 50,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 640, maxWidth: '94vw', background: PAPER,
        borderLeft: `1px solid ${LINE}`, padding: '24px 28px',
        overflowY: 'auto', boxShadow: '-12px 0 40px rgba(15,23,42,0.18)',
      }}>
        {loading && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
            <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading listing…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {!loading && (!data || error) && (
          <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
            {error || 'Listing not found.'}
          </div>
        )}
        {!loading && data && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <StatusPill status={data.status} />
                  <TierBadge tier={data.visibility !== 'open' ? data.visibility : null} />
                  <span style={{ fontSize: 10, color: MUTE }}>#{data.id.slice(0, 8)}</span>
                </div>
                <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{data.visit_spec?.site?.name}</div>
                <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
                  <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  {data.visit_spec?.site?.postcode} · {FREQ_LABEL[data.visit_spec?.frequency] ?? data.visit_spec?.frequency} · {data.visit_spec?.scope}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { l: 'Target',  v: `£${data.target_price}` },
                { l: 'Floor',   v: data.floor_price   != null ? `£${data.floor_price}`   : '—' },
                { l: 'Ceiling', v: data.ceiling_price != null ? `£${data.ceiling_price}` : '—' },
                { l: 'Bids',    v: data.bids.length },
              ].map(k => (
                <div key={k.l} style={{ background: SOFT, borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: INK }}>{k.v}</div>
                  <div style={{ fontSize: 9, color: SUB, fontWeight: 700, marginTop: 2 }}>{k.l}</div>
                </div>
              ))}
            </div>

            {data.status !== 'awarded' && data.status !== 'closed' && (
              <button onClick={handleClose} style={{
                fontSize: 11, color: '#b91c1c', background: '#fef2f2', border: '1px solid #fca5a5',
                borderRadius: 6, padding: '5px 10px', cursor: 'pointer', marginBottom: 14,
              }}>Close listing</button>
            )}

            <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
              Bids ranked by {data.award_rule === 'lowest_price' ? 'price' : 'best fit'}
            </div>

            {data.bids.length === 0 && (
              <div style={{ padding: 24, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10, fontSize: 12, color: SUB, textAlign: 'center' }}>
                No bids yet. Cadi is auto-matching subs — first bid usually arrives within 1 hour.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.bids.map((bid, i) => {
                const isTop = i === 0 && data.status !== 'awarded';
                const isWinner = bid.status === 'accepted';
                const fitColour = bid.fit >= 90 ? GREEN : bid.fit >= 80 ? '#3b82f6' : bid.fit >= 70 ? '#fbbf24' : '#ef4444';
                return (
                  <div key={bid.id} style={{
                    background: isWinner ? `${GREEN}06` : isTop ? `${GREEN}03` : PAPER,
                    border: `1px solid ${isWinner ? GREEN : isTop ? `${GREEN}25` : LINE}`,
                    borderRadius: 10, padding: 12, position: 'relative',
                  }}>
                    {isWinner && (
                      <span style={{
                        position: 'absolute', top: -8, left: 12,
                        fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
                        color: 'white', background: GREEN, padding: '3px 8px', borderRadius: 999,
                      }}>✓ AWARDED</span>
                    )}
                    {isTop && !isWinner && (
                      <span style={{
                        position: 'absolute', top: -8, left: 12,
                        fontSize: 9, fontWeight: 900, letterSpacing: '0.1em',
                        color: 'white', background: GREEN, padding: '3px 8px', borderRadius: 999,
                      }}>BEST FIT</span>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 90px 120px', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: INK }}>{bid.subName}</span>
                          <TierBadge tier={bid.subTier} />
                        </div>
                        <div style={{ fontSize: 10, color: SUB }}>
                          Score <strong style={{ color: INK }}>{bid.subScore}</strong>
                          {bid.subRegion ? <> · {bid.subRegion}</> : null}
                          {' · '}cap {bid.subCapacity}
                        </div>
                        {bid.note && (
                          <div style={{ fontSize: 10, color: SUB, marginTop: 6, fontStyle: 'italic', padding: '4px 8px', background: SOFT, borderRadius: 6 }}>"{bid.note}"</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <FitBar label="Price"    value={data.floor_price && data.target_price && data.target_price > data.floor_price
                          ? Math.max(60, 100 - Math.round(((Number(bid.bid_price) - Number(data.floor_price)) / (Number(data.target_price) - Number(data.floor_price))) * 50))
                          : 90} color={ACCENT} />
                        <FitBar label="Score"    value={bid.subScore} color={GREEN} />
                        <FitBar label="Capacity" value={Math.min(100, bid.subCapacity * 10)} color="#a78bfa" />
                      </div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: INK, lineHeight: 1 }}>£{bid.bid_price}</div>
                        <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>per visit</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 42, height: 42, borderRadius: '50%',
                          border: `3px solid ${fitColour}`,
                          fontSize: 13, fontWeight: 900, color: fitColour,
                          marginBottom: 6,
                        }}>{bid.fit}</div>
                        <div style={{ fontSize: 9, color: SUB, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>fit</div>
                        {!isWinner && data.status !== 'awarded' && data.status !== 'closed' && bid.status === 'submitted' && (
                          <button
                            onClick={() => handleAward(bid)}
                            disabled={!!awarding}
                            style={{
                              fontSize: 11, fontWeight: 800, color: 'white',
                              background: isTop ? GREEN : ACCENT, border: 'none',
                              borderRadius: 7, padding: '6px 12px',
                              cursor: awarding ? 'not-allowed' : 'pointer',
                              width: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                            }}
                          >
                            {awarding === bid.id && <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} />}
                            <Award size={11} /> Award
                          </button>
                        )}
                        {bid.status === 'lost' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: MUTE }}>not awarded</span>
                        )}
                        {bid.status === 'withdrawn' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: MUTE }}>withdrawn</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {data.status === 'awarded' && (
              <div style={{
                marginTop: 14, padding: 12, background: `${GREEN}10`, border: `1px solid ${GREEN}30`,
                borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#065f46',
              }}>
                <CheckCircle2 size={16} color={GREEN} />
                <span>Awarded {data.awarded_at ? `on ${new Date(data.awarded_at).toLocaleDateString()}` : ''}. A scheduled job has been created.</span>
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
    setLoading(true); setError(null);
    try {
      const [rows, org] = await Promise.all([listFmListings(), getMyFmOrganisation()]);
      setListings(rows);
      setFmOrg(org);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let r = listings;
    if (tab === 'live') {
      r = r.filter(l => l.status === 'open' || l.status === 'bidding');
    } else if (tab !== 'all') {
      r = r.filter(l => l.status === tab);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter(l =>
        l.visit_spec?.site?.name?.toLowerCase().includes(needle) ||
        l.visit_spec?.contract?.name?.toLowerCase().includes(needle),
      );
    }
    return r;
  }, [listings, tab, q]);

  const counts = useMemo(() => {
    const c = { live: 0, open: 0, bidding: 0, awarded: 0, closed: 0 };
    listings.forEach(l => {
      if (l.status === 'open' || l.status === 'bidding') c.live++;
      if (c[l.status] != null) c[l.status]++;
    });
    return c;
  }, [listings]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Marketplace</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Your published listings, ranked bids, and award flow. Cadi auto-matches the top subs per listing.
          </div>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          style={{
            background: ACCENT, color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          }}
        >
          <Plus size={13} /> New listing
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
          padding: '6px 10px', flex: 1, maxWidth: 320, minWidth: 200,
        }}>
          <Search size={12} color={MUTE} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by site or contract…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, color: INK, background: 'transparent' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: 4 }}>
          {STATUS_TABS.map(t => {
            const count = counts[t.id];
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6,
                  background: tab === t.id ? `${ACCENT}12` : 'transparent',
                  color: tab === t.id ? ACCENT : SUB,
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                {count != null && count > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, background: tab === t.id ? ACCENT : SOFT, color: tab === t.id ? 'white' : SUB, padding: '1px 6px', borderRadius: 999 }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading listings…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${ACCENT}10`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Send size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>
            {listings.length === 0 ? 'No listings yet' : 'Nothing matches this filter'}
          </div>
          <div style={{ fontSize: 12, color: SUB, marginBottom: 18, maxWidth: 400, margin: '0 auto 18px' }}>
            {listings.length === 0
              ? 'Publish unassigned visit specs to your network — Cadi auto-matches the best subs and routes bids back to you.'
              : 'Try a different status tab to see other listings.'}
          </div>
          {listings.length === 0 && fmOrg && (
            <button
              onClick={() => setNewOpen(true)}
              style={{
                background: ACCENT, color: 'white', border: 'none',
                borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Plus size={13} /> New listing
            </button>
          )}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map(l => (
            <ListingCard key={l.id} listing={l} onOpen={() => setOpenId(l.id)} />
          ))}
        </div>
      )}

      {openId && (
        <ListingDetail
          listingId={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}

      {newOpen && fmOrg && (
        <NewListingDrawer
          fmOrg={fmOrg}
          onClose={() => setNewOpen(false)}
          onPublished={load}
        />
      )}
    </div>
  );
}
