import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, MapPin, Lock, AlertCircle, CheckCircle2, Award,
  X, Clock, Calendar, Key, PoundSterling, ExternalLink, Loader2,
  ChevronRight, MessageCircleQuestion, Send,
} from 'lucide-react';
import {
  getMyConnectProfile,
  listOpenMarketplaceListings,
  listMyBids,
  placeBid,
  withdrawBid,
  computeFitScore,
  TIER_LABEL,
  TIER_COLOR,
  listListingQuestions,
  postListingQuestion,
} from '../../lib/db/connectDb';
import { geocodePostcodes, normalisePostcode, haversineMiles } from '../../lib/geocode';
import {
  CONNECT_COLORS, CONNECT_RADII, ON_DARK,
  glassDark, orangeCanvas, HOVER_LIFT,
} from '../../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;
const GREEN  = '#22c55e';
const BLUE   = '#7ea3ff';
const PURPLE = '#c084fc';

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtFreq(f) {
  return { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
           quarterly: 'Quarterly', annual: 'Annual', one_off: 'One-off' }[f] ?? f;
}
function visitsPerMonth(freq) {
  return { weekly: 4.3, fortnightly: 2.15, monthly: 1, quarterly: 1/3, annual: 1/12, one_off: 0 }[freq] ?? 1;
}
function fmtMoney(n) {
  return `£${Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}
function fmtDuration(mins) {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function locationLabel(site) {
  if (!site) return '';
  const address = (site.address || '').trim();
  const postcode = (site.postcode || '').trim();
  if (!address) return postcode;
  const line = address.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(-2)[0] || '';
  if (line && line.toLowerCase() !== postcode.toLowerCase()) {
    return postcode ? `${line} · ${postcode}` : line;
  }
  return postcode || line;
}
function mapUrl(site) {
  if (!site) return null;
  if (site.lat != null && site.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${site.lat},${site.lng}`;
  }
  const q = encodeURIComponent([site.name, site.address, site.postcode].filter(Boolean).join(', '));
  return q ? `https://www.google.com/maps/search/?api=1&query=${q}` : null;
}

/* ─── Fit score colour on dark background ─────────────────────────────────── */
function fitColorOnDark(fit) {
  return fit >= 90 ? GREEN
       : fit >= 80 ? BLUE
       : fit >= 70 ? '#fbbf24'
       :             '#f87171';
}

/* ─── Tier badge (light on dark) ──────────────────────────────────────────── */
function TierBadge({ tier }) {
  if (!tier) return null;
  const color = TIER_COLOR[tier] || '#a3a3a3';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: '#ffffff',
      background: `${color}44`, border: `1px solid ${color}66`,
      padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap',
      letterSpacing: '0.06em',
    }}>{TIER_LABEL[tier]}</span>
  );
}

/* ─── Section label inside cards ──────────────────────────────────────────── */
const SUBLABEL = {
  fontSize: 10, fontWeight: 800, color: ON_DARK.muted,
  letterSpacing: '0.14em', textTransform: 'uppercase',
};

/* ─── Modal shell (drawer) ────────────────────────────────────────────────── */
function DrawerShell({ children, onClose }) {
  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20, 5, 0, 0.65)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', justifyContent: 'flex-end', zIndex: 50,
      }}
    >
      <div onClick={e => e.stopPropagation()}
        style={{
          width: 580, maxWidth: '96vw',
          background: 'linear-gradient(180deg, #3d0f04 0%, #1a0400 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.14)',
          padding: '24px 24px 40px',
          overflowY: 'auto',
          boxShadow: '-30px 0 80px -20px rgba(0,0,0,0.55)',
          color: '#ffffff',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Listing detail drawer ───────────────────────────────────────────────── */
function ListingDrawer({ listing, myProfile, myBid, distanceMi, onClose, onAccept, onWithdraw, isBusy }) {
  const site = listing.visit_spec?.site;
  const fm   = listing.fm_organisation;
  const scope = listing.visit_spec?.scope;
  const accessNotes = listing.visit_spec?.access_notes;
  const durationMin = listing.visit_spec?.duration_minutes;

  const isAuction   = listing.format !== 'rate_card';
  const targetPrice = listing.target_price;
  const floorPrice  = listing.floor_price  ?? targetPrice;
  const ceilingPrice = listing.ceiling_price ?? targetPrice;

  const [bidPrice, setBidPrice] = useState(String(targetPrice));
  const [bidNote,  setBidNote]  = useState('');
  useEffect(() => { setBidPrice(String(targetPrice)); setBidNote(''); }, [listing.id, targetPrice]);

  const [qaLoading, setQaLoading] = useState(true);
  const [qa,        setQa]        = useState([]);
  const [qaText,    setQaText]    = useState('');
  const [qaSending, setQaSending] = useState(false);
  const [qaError,   setQaError]   = useState(null);

  useEffect(() => {
    setQaLoading(true);
    listListingQuestions(listing.id)
      .then(setQa)
      .catch(() => setQa([]))
      .finally(() => setQaLoading(false));
  }, [listing.id]);

  async function submitQuestion(e) {
    e.preventDefault();
    if (!qaText.trim()) return;
    setQaSending(true); setQaError(null);
    try {
      const { ok, data } = await postListingQuestion({ listingId: listing.id, body: qaText.trim() });
      if (!ok) throw new Error(data?.error || 'Could not send question.');
      setQaText('');
      setQa(await listListingQuestions(listing.id));
    } catch (err) {
      setQaError(err.message);
    } finally {
      setQaSending(false);
    }
  }

  const monthly = Math.round((Number(bidPrice) || targetPrice) * visitsPerMonth(listing.visit_spec?.frequency));
  const priceForFit = Number(bidPrice) || targetPrice;
  const score = myProfile?.connect_score ?? 0;
  const locked = score < (listing.score_floor ?? 0);
  const fit = computeFitScore({
    price:         priceForFit,
    listingTarget: listing.target_price,
    listingFloor:  listing.floor_price,
    score,
    distanceMi:    distanceMi ?? 0,
    capacityFree:  Math.max(0, (myProfile?.connect_capacity ?? 0)),
  });
  const fitColor = fitColorOnDark(fit);

  const formatLabel =
    listing.format === 'rate_card' ? 'Rate card — accept at the FM\'s price' :
    listing.format === 'cluster'   ? 'Cluster — bid on multiple sites together' :
                                     'Auction — bid your price';

  const priceNum = Number(bidPrice);
  const priceValid = Number.isFinite(priceNum) && priceNum >= floorPrice && priceNum <= ceilingPrice;
  const priceError = !priceValid ? `Enter a price between £${floorPrice} and £${ceilingPrice}` : null;

  const sectionCardStyle = { ...glassDark({ padding: 16, radius: 14, strong: true }), marginBottom: 12 };

  return (
    <DrawerShell onClose={onClose}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ ...SUBLABEL }}>{fm?.name ?? 'FM'}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginTop: 4, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            {site?.name ?? 'Site'}
          </div>
          <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={11} /> {locationLabel(site) || 'Location tbc'}
          </div>
        </div>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#ffffff', cursor: 'pointer', padding: 8, borderRadius: 10 }}>
          <X size={16} />
        </button>
      </div>

      {/* Location card */}
      <div style={sectionCardStyle}>
        <div style={{ ...SUBLABEL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span>Where</span>
          {typeof distanceMi === 'number' && Number.isFinite(distanceMi) && (
            <span style={{ fontSize: 10, fontWeight: 800, color: '#ffffff', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)', padding: '3px 9px', borderRadius: 999, letterSpacing: 0, textTransform: 'none' }}>
              ~{distanceMi < 1 ? '<1' : Math.round(distanceMi)} mi from your base
            </span>
          )}
        </div>
        {site?.address ? (
          <div style={{ fontSize: 13, color: '#ffffff', whiteSpace: 'pre-wrap', lineHeight: 1.55, marginBottom: 10 }}>
            {site.address}
            {site.postcode && !site.address.includes(site.postcode) && `\n${site.postcode}`}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#ffffff', marginBottom: 10 }}>
            {site?.postcode || 'Full address will appear once you\'re awarded the job.'}
          </div>
        )}
        {mapUrl(site) && (
          <a href={mapUrl(site)} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: BLUE, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ExternalLink size={11} /> Open in Google Maps
          </a>
        )}
      </div>

      {/* Work brief */}
      <div style={sectionCardStyle}>
        <div style={{ ...SUBLABEL, marginBottom: 10 }}>What the FM wants done</div>
        <div style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.55, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
          {scope || 'The FM hasn\'t added a scope note. Ask before bidding if unsure — contact via Messages once you\'ve accepted.'}
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ON_DARK.muted }}>
            <Calendar size={12} /> <strong style={{ color: '#ffffff' }}>{fmtFreq(listing.visit_spec?.frequency)}</strong>
          </div>
          {durationMin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ON_DARK.muted }}>
              <Clock size={12} /> <strong style={{ color: '#ffffff' }}>{fmtDuration(durationMin)} per visit</strong>
            </div>
          )}
        </div>
      </div>

      {/* Access notes */}
      {accessNotes && (
        <div style={{
          background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.30)',
          borderRadius: 14, padding: 16, marginBottom: 12,
        }}>
          <div style={{ ...SUBLABEL, color: '#fcd34d', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Key size={11} /> Access notes
          </div>
          <div style={{ fontSize: 12, color: '#fef3c7', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{accessNotes}</div>
        </div>
      )}

      {/* Pricing */}
      <div style={sectionCardStyle}>
        <div style={{ ...SUBLABEL, marginBottom: 10 }}>Pricing</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'baseline', gap: 3, letterSpacing: '-0.02em' }}>
              <PoundSterling size={17} />{targetPrice}
            </div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 2 }}>per visit</div>
          </div>
          {monthly > 0 && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#ffd7bf', letterSpacing: '-0.02em' }}>
                ~{fmtMoney(monthly)}
              </div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 2 }}>estimated per month</div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 12 }}>
          {formatLabel}
          {isAuction && listing.floor_price && listing.ceiling_price && ` · £${listing.floor_price}–£${listing.ceiling_price}`}
        </div>
      </div>

      {/* Fit */}
      <div style={{
        background: `${fitColor}15`, border: `1px solid ${fitColor}44`,
        borderRadius: 14, padding: 16, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, background: `${fitColor}22`,
            border: `1.5px solid ${fitColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 900, color: fitColor,
          }}>
            {fit}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>Your fit for this job</div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 2 }}>
              Score {score} vs floor {listing.score_floor ?? 0} · price fits target
              {typeof distanceMi === 'number' && Number.isFinite(distanceMi) &&
                ` · ${distanceMi < 1 ? '<1' : Math.round(distanceMi)} mi away`}
            </div>
          </div>
        </div>
      </div>

      {/* Q&A thread */}
      <div style={sectionCardStyle}>
        <div style={{ ...SUBLABEL, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageCircleQuestion size={11} /> Questions from bidders
          <span style={{ fontSize: 9, color: ON_DARK.faint, fontWeight: 700, letterSpacing: 0, textTransform: 'none', marginLeft: 4 }}>· anonymous to other bidders</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, maxHeight: 260, overflowY: 'auto' }}>
          {qaLoading && <div style={{ fontSize: 11, color: ON_DARK.muted, fontStyle: 'italic' }}>Loading…</div>}
          {!qaLoading && qa.length === 0 && (
            <div style={{ fontSize: 12, color: ON_DARK.muted, fontStyle: 'italic', padding: '4px 0' }}>
              No questions yet — be the first. Everyone bidding will see the FM's answer.
            </div>
          )}
          {qa.map(m => {
            const isFm    = m.author_role === 'fm';
            const isMine  = m.author_id === myProfile?.id;
            const label   = isFm ? (fm?.name ?? 'FM') : isMine ? 'You asked' : 'A contractor asks';
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: isFm ? 'flex-start' : 'flex-end' }}>
                <div style={{
                  maxWidth: '82%', padding: '9px 12px', borderRadius: 12,
                  background: isFm ? 'rgba(126,163,255,0.14)' : (isMine ? '#ffffff' : 'rgba(255,255,255,0.08)'),
                  border: isFm ? '1px solid rgba(126,163,255,0.30)' : `1px solid ${isMine ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.14)'}`,
                  color: isMine ? CONNECT_COLORS.navy : '#ffffff',
                  fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: isFm ? '#c7d7ff' : (isMine ? CONNECT_COLORS.inkMuted : ON_DARK.muted), marginBottom: 4, letterSpacing: '0.02em' }}>
                    {label} · {new Date(m.created_at).toLocaleString()}
                  </div>
                  {m.body}
                </div>
              </div>
            );
          })}
        </div>

        {qaError && (
          <div style={{ padding: 9, marginBottom: 10, background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.30)', borderRadius: 8, fontSize: 11, color: '#fca5a5' }}>
            {qaError}
          </div>
        )}

        <form onSubmit={submitQuestion} style={{ display: 'flex', gap: 6 }}>
          <input
            type="text" value={qaText} onChange={e => setQaText(e.target.value)}
            placeholder="Ask a question — visible to the FM + bidders (anonymous)"
            disabled={qaSending} maxLength={2000}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.16)',
              fontSize: 12, color: '#ffffff', outline: 'none', fontFamily: 'inherit',
            }}
          />
          <button
            type="submit" disabled={!qaText.trim() || qaSending}
            style={{
              background: qaText.trim() ? '#ffffff' : 'rgba(255,255,255,0.10)',
              color: qaText.trim() ? CONNECT_COLORS.navy : ON_DARK.muted,
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 10, padding: '0 14px', fontSize: 12, fontWeight: 900,
              cursor: qaText.trim() ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
            {qaSending
              ? <Loader2 size={12} style={{ animation: 'connectSpin 0.8s linear infinite' }} />
              : <><Send size={11} /> Ask</>}
          </button>
        </form>
      </div>

      {/* What happens next */}
      <div style={{
        background: 'rgba(126,163,255,0.10)', border: '1px solid rgba(126,163,255,0.28)',
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}>
        <div style={{ ...SUBLABEL, color: '#c7d7ff', marginBottom: 10 }}>
          What happens if you {isAuction ? 'bid' : 'accept'}
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#e0e9ff', lineHeight: 1.75 }}>
          <li>{isAuction
            ? `Your bid is submitted to the FM (${fm?.name ?? 'them'}) — they review all bids at the end of the window.`
            : `You're locked in at £${targetPrice}/visit — the FM (${fm?.name ?? 'them'}) is notified.`}</li>
          <li>{isAuction
            ? 'If awarded, the FM confirms your first visit date and the site appears on your Work Completion tab.'
            : 'The site appears on your Work Completion tab as soon as the FM sets your first visit date.'}</li>
          <li>Turn up, tap Check in inside the geo-fence, do the work, tap Check out with photos + site contact.</li>
          <li>Once the FM approves your work, an invoice draft is auto-created — merge with other visits if you want, then submit.</li>
        </ol>
      </div>

      {/* Action */}
      {locked ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '14px 0', borderRadius: 12,
          background: 'rgba(192,132,252,0.14)', border: '1px solid rgba(192,132,252,0.35)',
          fontSize: 12, fontWeight: 800, color: PURPLE,
        }}>
          <Lock size={13} /> Score ≥ {listing.score_floor} needed (you're at {score})
        </div>
      ) : myBid ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12,
          background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)',
        }}>
          <CheckCircle2 size={16} color={GREEN} />
          <span style={{ fontSize: 12, color: '#ffffff', flex: 1, fontWeight: 700 }}>
            Bid £{myBid.bid_price} · {myBid.status}
          </span>
          <button
            onClick={() => onWithdraw(myBid.id)} disabled={isBusy}
            style={{
              fontSize: 11, fontWeight: 800, color: '#ffffff',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.20)', borderRadius: 8,
              padding: '6px 12px', cursor: 'pointer',
            }}>
            Withdraw
          </button>
        </div>
      ) : (
        <>
          {isAuction && (
            <div style={sectionCardStyle}>
              <div style={{ ...SUBLABEL, marginBottom: 10 }}>Your bid</div>
              <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, fontWeight: 800, color: ON_DARK.muted }}>£</span>
                    <input
                      type="number" step="1" min={floorPrice} max={ceilingPrice}
                      value={bidPrice} onChange={e => setBidPrice(e.target.value)}
                      style={{
                        width: '100%', padding: '11px 12px 11px 24px', borderRadius: 10,
                        border: `1px solid ${priceValid ? 'rgba(255,255,255,0.20)' : 'rgba(248,113,113,0.55)'}`,
                        background: priceValid ? 'rgba(255,255,255,0.06)' : 'rgba(248,113,113,0.10)',
                        fontSize: 16, fontWeight: 800, color: '#ffffff', outline: 'none',
                        fontFamily: 'inherit', boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: priceError ? '#fca5a5' : ON_DARK.faint, marginTop: 6 }}>
                    {priceError || `Range: £${floorPrice}–£${ceilingPrice} · target £${targetPrice}`}
                  </div>
                </div>
                <textarea
                  value={bidNote} onChange={e => setBidNote(e.target.value)} rows={2}
                  placeholder="Optional note — e.g. why your price, availability, questions the FM should know."
                  style={{
                    width: '100%', padding: '11px 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.16)',
                    fontSize: 12, color: '#ffffff', outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              {bidPrice && Number(bidPrice) !== targetPrice && priceValid && (
                <div style={{ marginTop: 10, fontSize: 11, color: ON_DARK.muted }}>
                  At £{bidPrice}/visit that's about <strong style={{ color: '#ffffff' }}>{fmtMoney(monthly)}/month</strong>.
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => onAccept(listing, isAuction ? { price: priceNum, note: bidNote.trim() || null } : { price: targetPrice, note: null })}
            disabled={isBusy || (isAuction && !priceValid)}
            style={{
              width: '100%', fontSize: 14, fontWeight: 900,
              color: (isBusy || (isAuction && !priceValid)) ? ON_DARK.muted : CONNECT_COLORS.navy,
              background: (isBusy || (isAuction && !priceValid)) ? 'rgba(255,255,255,0.14)' : '#ffffff',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: (isBusy || (isAuction && !priceValid)) ? 'none' : '0 12px 30px -12px rgba(255,255,255,0.4)',
              borderRadius: 12, padding: '15px 0',
              cursor: (isBusy || (isAuction && !priceValid)) ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            {isBusy && <Loader2 size={14} style={{ animation: 'connectSpin 0.8s linear infinite' }} />}
            {isAuction ? `Submit bid at £${priceValid ? priceNum : '?'}` : `Accept — £${targetPrice}/visit`}
          </button>
        </>
      )}

      <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </DrawerShell>
  );
}

/* ─── Listing card ────────────────────────────────────────────────────────── */
function ListingCard({ listing, myProfile, myBid, distanceMi, onOpen }) {
  const score = myProfile?.connect_score ?? 0;
  const locked = score < (listing.score_floor ?? 0);
  const fit = computeFitScore({
    price:         listing.target_price,
    listingTarget: listing.target_price,
    listingFloor:  listing.floor_price,
    score,
    distanceMi:    distanceMi ?? 0,
    capacityFree:  Math.max(0, (myProfile?.connect_capacity ?? 0)),
  });
  const fitColor = fitColorOnDark(fit);
  const cadiPick = listing.cadi_pick_user_id && listing.cadi_pick_user_id === myProfile?.id;
  const tierColor = TIER_COLOR[listing.visibility] || '#a3a3a3';
  const site = listing.visit_spec?.site;
  const fm   = listing.fm_organisation;
  const monthly = Math.round(listing.target_price * visitsPerMonth(listing.visit_spec?.frequency));
  const durationMin = listing.visit_spec?.duration_minutes;

  return (
    <button
      onClick={() => onOpen(listing)}
      className={HOVER_LIFT}
      style={{
        textAlign: 'left', cursor: 'pointer', width: '100%',
        ...glassDark({ padding: 16, radius: CONNECT_RADII.lg, strong: cadiPick }),
        borderLeft: `3px solid ${cadiPick ? ORANGE : tierColor}`,
        opacity: locked ? 0.65 : 1,
        position: 'relative',
        fontFamily: 'inherit',
      }}>
      {cadiPick && (
        <div style={{
          position: 'absolute', top: -10, left: 14,
          fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
          color: '#ffffff',
          background: `linear-gradient(135deg, #ff6a30 0%, ${ORANGE} 100%)`,
          padding: '4px 10px', borderRadius: 999,
          boxShadow: '0 8px 20px -6px rgba(194,65,12,0.65)',
        }}>⚡ CADI RECOMMENDS YOU</div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, marginTop: cadiPick ? 6 : 0, gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...SUBLABEL, letterSpacing: '0.10em' }}>{fm?.name ?? 'FM'}</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff', marginTop: 3, lineHeight: 1.2, letterSpacing: '-0.01em' }}>
            {site?.name ?? 'Site'}
          </div>
          <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 5, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <MapPin size={10} /> {locationLabel(site) || 'Location tbc'}
            {typeof distanceMi === 'number' && Number.isFinite(distanceMi) && (
              <span style={{
                fontSize: 9, fontWeight: 800, color: '#ffffff',
                background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)',
                padding: '2px 7px', borderRadius: 999, letterSpacing: '0.02em', marginLeft: 4,
              }}>
                ~{distanceMi < 1 ? '<1' : Math.round(distanceMi)} mi
              </span>
            )}
          </div>
        </div>
        <TierBadge tier={listing.visibility} />
      </div>

      <div style={{ fontSize: 11, color: ON_DARK.muted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span><Calendar size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />{fmtFreq(listing.visit_spec?.frequency)}</span>
        {durationMin && <><span style={{ color: ON_DARK.faint }}>·</span><span><Clock size={9} style={{ verticalAlign: 'middle', marginRight: 3 }} />{fmtDuration(durationMin)}</span></>}
      </div>

      {listing.visit_spec?.scope && (
        <div style={{
          fontSize: 12, color: '#e6e0d9', marginBottom: 12, lineHeight: 1.5,
          background: 'rgba(255,255,255,0.04)', padding: '9px 11px', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {listing.visit_spec.scope}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
        <div style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '7px 8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#ffffff' }}>£{listing.target_price}</div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>per visit</div>
        </div>
        <div style={{
          background: 'rgba(255,176,138,0.16)', border: '1px solid rgba(255,176,138,0.32)',
          borderRadius: 8, padding: '7px 8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#ffd7bf' }}>~£{monthly}</div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>per month</div>
        </div>
        <div style={{
          background: `${fitColor}18`, border: `1px solid ${fitColor}55`,
          borderRadius: 8, padding: '7px 8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: fitColor }}>{fit}</div>
          <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, marginTop: 1 }}>your fit</div>
        </div>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 12px',
        background: myBid ? 'rgba(251,191,36,0.14)' : 'rgba(255,255,255,0.05)',
        border: myBid ? '1px solid rgba(251,191,36,0.30)' : '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
      }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: myBid ? '#fcd34d' : '#ffffff' }}>
          {locked
            ? <><Lock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Locked — need score {listing.score_floor}</>
            : myBid
              ? <>Bid £{myBid.bid_price} · {myBid.status}</>
              : 'View full brief →'}
        </span>
        <ChevronRight size={14} color="rgba(255,255,255,0.55)" />
      </div>
    </button>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function EarnMarketplace() {
  const [profile, setProfile]     = useState(null);
  const [listings, setListings]   = useState([]);
  const [myBids, setMyBids]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [busyId, setBusyId]       = useState(null);
  const [openListingId, setOpenListingId] = useState(null);
  const [distanceMi, setDistanceMi] = useState({});

  async function reload() {
    setError('');
    try {
      const [p, l, b] = await Promise.all([
        getMyConnectProfile(),
        listOpenMarketplaceListings(),
        listMyBids(),
      ]);
      setProfile(p); setListings(l); setMyBids(b);

      const home = p?.home_postcode || p?.postcode;
      if (home) {
        const sitePostcodes = (l ?? []).map(x => x.visit_spec?.site?.postcode).filter(Boolean);
        if (sitePostcodes.length) {
          try {
            const geo = await geocodePostcodes([home, ...sitePostcodes]);
            const homeGeo = geo[normalisePostcode(home)];
            if (homeGeo) {
              const map = {};
              for (const listing of l) {
                const sitePc = listing.visit_spec?.site?.postcode;
                const siteLat = listing.visit_spec?.site?.lat;
                const siteLng = listing.visit_spec?.site?.lng;
                const s = (siteLat != null && siteLng != null)
                  ? { lat: siteLat, lng: siteLng }
                  : (sitePc ? geo[normalisePostcode(sitePc)] : null);
                if (s) {
                  const mi = haversineMiles(homeGeo.lat, homeGeo.lng, s.lat, s.lng);
                  if (Number.isFinite(mi)) map[listing.id] = Math.round(mi * 10) / 10;
                }
              }
              setDistanceMi(map);
            }
          } catch { /* silent */ }
        }
      }
    } catch (e) {
      setError(e.message || 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, []);

  const bidByListing = useMemo(() => {
    const m = new Map();
    for (const b of myBids) if (b.status !== 'withdrawn') m.set(b.listing_id, b);
    return m;
  }, [myBids]);

  const sortedListings = useMemo(() => {
    if (Object.keys(distanceMi).length === 0) return listings;
    return [...listings].sort((a, b) => {
      const da = distanceMi[a.id];
      const db = distanceMi[b.id];
      const va = typeof da === 'number' && Number.isFinite(da) ? da : Number.POSITIVE_INFINITY;
      const vb = typeof db === 'number' && Number.isFinite(db) ? db : Number.POSITIVE_INFINITY;
      return va - vb;
    });
  }, [listings, distanceMi]);

  async function handleAccept(listing, opts = {}) {
    setBusyId(listing.id);
    try {
      await placeBid({
        listingId: listing.id,
        price:     opts.price ?? listing.target_price,
        note:      opts.note  ?? null,
      });
      setOpenListingId(null);
      await reload();
    } catch (e) {
      setError(e.message || 'Bid failed');
    } finally {
      setBusyId(null);
    }
  }

  async function handleWithdraw(bidId) {
    setBusyId(bidId);
    try {
      await withdrawBid(bidId);
      await reload();
    } catch (e) {
      setError(e.message || 'Withdraw failed');
    } finally {
      setBusyId(null);
    }
  }

  const tier = profile?.connect_tier;
  const score = profile?.connect_score ?? 0;
  const nextTierGap = score >= 93 ? 0 : score >= 80 ? 93 - score : 80 - score;
  const nextTierLabel = score >= 93 ? null : score >= 80 ? 'Elite' : 'Verified';

  const openListing = listings.find(l => l.id === openListingId);
  const openBid = openListing ? bidByListing.get(openListing.id) : null;
  const openIsBusy = openListing && (busyId === openListing.id || (openBid && busyId === openBid.id));

  return (
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={orangeCanvas()}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: 'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.05) 0%, transparent 60%)' }} />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-5 z-10">

        {/* ─── HERO ──────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden"
          style={{
            ...glassDark({ radius: CONNECT_RADII.xl, blur: 20 }),
            background: `
              radial-gradient(120% 80% at 100% 0%, rgba(255, 176, 90, 0.30) 0%, transparent 55%),
              radial-gradient(60% 60% at 0% 100%, rgba(1, 10, 79, 0.30) 0%, transparent 60%),
              rgba(255,255,255,0.05)
            `,
          }}>
          <div className="relative px-6 md:px-9 py-7 md:py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: '#ffffff', boxShadow: '0 8px 20px -6px rgba(0,0,0,0.4)' }}>
                  <ShoppingBag size={13} color={CONNECT_COLORS.navy} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/70 uppercase">Marketplace</span>
                {tier && <span className="ml-1"><TierBadge tier={tier} /></span>}
              </div>
              <h1 className="text-white mb-2"
                style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
                Open jobs, ready{' '}
                <span style={{ color: '#ffd7bf' }}>to win.</span>
              </h1>
              <p className="text-white/70 text-[14px] leading-relaxed max-w-2xl">
                Tap a card to see the full brief — where, what and what happens if you take it. Nearby jobs float to the top.
              </p>
            </div>

            {/* Live counter — quick sense of the shelf */}
            <div className="grid grid-cols-2 gap-2 shrink-0" style={{ minWidth: 200 }}>
              {[
                { label: 'Open jobs', count: listings.length, color: '#ffd7bf' },
                { label: 'My bids',   count: myBids.filter(b => b.status !== 'withdrawn').length, color: '#fbbf24' },
              ].map(({ label, count, color }) => (
                <div key={label} style={{
                  ...glassDark({ padding: 12, radius: 12, strong: true }),
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: ON_DARK.muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── TIER PROGRESS ────────────────────────────────────────── */}
        {nextTierLabel && (
          <div className={HOVER_LIFT}
            style={{
              ...glassDark({ padding: 16, radius: CONNECT_RADII.lg, strong: true }),
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
            <div style={{
              width: 42, height: 42, borderRadius: 11,
              background: `linear-gradient(135deg, ${PURPLE} 0%, #6d28d9 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 24px -12px rgba(192,132,252,0.55)',
            }}>
              <Award size={18} color="#ffffff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>
                {nextTierGap} {nextTierGap === 1 ? 'point' : 'points'} from {nextTierLabel}
              </div>
              <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3 }}>
                Geo ✓ check-ins, complete evidence, sign-off captured → score climbs. {nextTierLabel} unlocks higher-paying listings.
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.10)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${GREEN}, ${PURPLE})` }} />
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>{score}</div>
              <div style={{ fontSize: 9, color: ON_DARK.muted, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>/ 100</div>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 14px', borderRadius: CONNECT_RADII.md,
            background: 'rgba(220,38,38,0.14)', border: '1px solid rgba(220,38,38,0.35)',
            color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div style={{ ...glassDark({ padding: 40, radius: CONNECT_RADII.lg }), textAlign: 'center', color: ON_DARK.muted, fontSize: 12 }}>
            <Loader2 size={18} className="mx-auto mb-2"
              style={{ animation: 'connectSpin 0.8s linear infinite' }} />
            Loading marketplace…
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : listings.length === 0 ? (
          <div style={{
            ...glassDark({ padding: 44, radius: CONNECT_RADII.xl, strong: true }),
            textAlign: 'center',
          }}>
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, #ffffff 0%, #ffd7bf 100%)`,
                boxShadow: '0 12px 30px -12px rgba(255,255,255,0.35)',
              }}>
              <ShoppingBag size={22} color={CONNECT_COLORS.orange} strokeWidth={2.2} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.01em' }}>No open listings right now</div>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 8, maxWidth: 380, margin: '8px auto 0', lineHeight: 1.5 }}>
              New jobs from {profile?.connect_unlocked_by_fm_id ? 'your FM' : 'FMs you connect with'} land here as they're published. Cadi will push you a notification when your fit ≥ 90.
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {sortedListings.map(l => (
              <ListingCard
                key={l.id}
                listing={l}
                myProfile={profile}
                myBid={bidByListing.get(l.id)}
                distanceMi={distanceMi[l.id]}
                onOpen={() => setOpenListingId(l.id)}
              />
            ))}
          </div>
        )}

        {openListing && (
          <ListingDrawer
            listing={openListing}
            myProfile={profile}
            myBid={openBid}
            distanceMi={distanceMi[openListing.id]}
            onClose={() => setOpenListingId(null)}
            onAccept={handleAccept}
            onWithdraw={handleWithdraw}
            isBusy={openIsBusy}
          />
        )}
      </div>
    </div>
  );
}
