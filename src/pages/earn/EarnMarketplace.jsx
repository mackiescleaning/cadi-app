import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, MapPin, Send, Lock, AlertCircle, CheckCircle2, Award, Star,
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
} from '../../lib/db/connectDb';

const ORANGE = '#C2410C';
const GREEN  = '#16a34a';
const PURPLE = '#7c3aed';

function fmtFreq(f) {
  return {
    weekly:      'Weekly',
    fortnightly: 'Fortnightly',
    monthly:     'Monthly',
    quarterly:   'Quarterly',
    annual:      'Annual',
    one_off:     'One-off',
  }[f] ?? f;
}

function TierBadge({ tier }) {
  if (!tier) return null;
  const color = TIER_COLOR[tier] || '#6b7280';
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color,
      background: `${color}15`, border: `1px solid ${color}30`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{TIER_LABEL[tier]}</span>
  );
}

function ListingCard({ listing, myProfile, myBid, onAccept, onWithdraw, isBusy }) {
  const score = myProfile?.connect_score ?? 0;
  const tier  = myProfile?.connect_tier;

  // Subs are RLS-gated by score_floor, but we still want to render a clear
  // "you're 5 points away" if the sub is somehow looking at a tier-locked
  // listing (e.g. they got the URL directly).
  const locked = score < (listing.score_floor ?? 0);

  const fit = computeFitScore({
    price:         listing.target_price,
    listingTarget: listing.target_price,
    listingFloor:  listing.floor_price,
    score,
    distanceMi:    0,   // TODO: real postcode → distance lookup
    capacityFree:  Math.max(0, (myProfile?.connect_capacity ?? 0)),
  });
  const fitColor = fit >= 90 ? GREEN : fit >= 80 ? '#3b82f6' : fit >= 70 ? '#fbbf24' : '#ef4444';
  const cadiPick = listing.cadi_pick_user_id && listing.cadi_pick_user_id === myProfile?.id;
  const tierColor = TIER_COLOR[listing.visibility] || '#6b7280';
  const site = listing.visit_spec?.site;
  const fm   = listing.fm_organisation;

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${cadiPick ? `${ORANGE}40` : '#e2e8f0'}`,
      borderLeft: `4px solid ${cadiPick ? ORANGE : tierColor}`,
      borderRadius: 10, padding: 14,
      opacity: locked ? 0.6 : 1,
      position: 'relative',
    }}>
      {cadiPick && (
        <div style={{
          position: 'absolute', top: -10, left: 14,
          fontSize: 9, fontWeight: 900, letterSpacing: '0.08em',
          color: 'white', background: ORANGE,
          padding: '4px 10px', borderRadius: 999,
        }}>⚡ CADI RECOMMENDS YOU</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: cadiPick ? 6 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>#{listing.id.slice(0, 8)}</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>· {fm?.name ?? 'FM'}</span>
        </div>
        <TierBadge tier={listing.visibility} />
      </div>

      <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', marginBottom: 2 }}>{site?.name ?? 'Site'}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
        <MapPin size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
        {site?.postcode ?? ''} · {fmtFreq(listing.visit_spec?.frequency)} · {listing.visit_spec?.scope ?? ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a' }}>£{listing.target_price}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>per visit</div>
        </div>
        <div style={{ background: `${fitColor}10`, border: `1px solid ${fitColor}25`, borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: fitColor }}>{fit}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>your fit</div>
        </div>
        <div style={{ background: '#f1f5f9', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{listing.format === 'rate_card' ? 'Rate card' : listing.format === 'cluster' ? 'Cluster' : 'Auction'}</div>
          <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>format</div>
        </div>
      </div>

      {locked ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 0', borderRadius: 6,
          background: `${PURPLE}10`, border: `1px solid ${PURPLE}30`,
          fontSize: 11, fontWeight: 700, color: PURPLE,
        }}>
          <Lock size={11} /> Need score ≥ {listing.score_floor} (you're at {score})
        </div>
      ) : myBid ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 6, background: '#fef9f0', border: `1px solid #fcd34d` }}>
          <CheckCircle2 size={13} color={GREEN} />
          <span style={{ fontSize: 11, color: '#0f172a', flex: 1, fontWeight: 700 }}>
            Bid £{myBid.bid_price} · {myBid.status}
          </span>
          <button
            onClick={() => onWithdraw(myBid.id)}
            disabled={isBusy}
            style={{ fontSize: 11, fontWeight: 700, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
            Withdraw
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => onAccept(listing)}
            disabled={isBusy}
            style={{ flex: 1, fontSize: 12, fontWeight: 800, color: 'white', background: ORANGE, border: 'none', borderRadius: 7, padding: '8px 0', cursor: 'pointer', opacity: isBusy ? 0.6 : 1 }}>
            {listing.format === 'rate_card' ? `Accept at £${listing.target_price}` : `Bid at £${listing.target_price}`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function EarnMarketplace() {
  const [profile, setProfile]   = useState(null);
  const [listings, setListings] = useState([]);
  const [myBids, setMyBids]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [busyId, setBusyId]     = useState(null);

  async function reload() {
    setError('');
    try {
      const [p, l, b] = await Promise.all([
        getMyConnectProfile(),
        listOpenMarketplaceListings(),
        listMyBids(),
      ]);
      setProfile(p);
      setListings(l);
      setMyBids(b);
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

  async function handleAccept(listing) {
    setBusyId(listing.id);
    try {
      await placeBid({ listingId: listing.id, price: listing.target_price });
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

  return (
    <div style={{ background: '#f8faff', minHeight: '100%', padding: '1.25rem', fontFamily: "'Satoshi','Inter',sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} color={ORANGE} />
            <h1 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>Marketplace</h1>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Open jobs from FMs you're connected to · ranked by your fit · filtered to your tier
          </div>
        </div>
        {tier && <TierBadge tier={tier} />}
      </div>

      {/* Tier progress (only when below Elite) */}
      {nextTierLabel && (
        <div style={{
          background: `linear-gradient(135deg, ${PURPLE}08, ${ORANGE}06)`,
          border: `1px solid ${PURPLE}25`, borderRadius: 12, padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Award size={18} color={PURPLE} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
              {nextTierGap} {nextTierGap === 1 ? 'point' : 'points'} from {nextTierLabel}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
              Geo ✓ check-ins, complete evidence, sign-off captured → score climbs. {nextTierLabel} unlocks higher-paying listings.
            </div>
            <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${score}%`, background: `linear-gradient(90deg, ${GREEN}, ${PURPLE})` }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: PURPLE }}>{score}</div>
            <div style={{ fontSize: 9, color: '#64748b', fontWeight: 700 }}>/ 100</div>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Loading marketplace…</div>
      ) : listings.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center',
          background: 'white', border: '1.5px dashed #e2e8f0', borderRadius: 12,
          color: '#64748b',
        }}>
          <ShoppingBag size={28} color="#cbd5e1" style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>No open listings right now</div>
          <div style={{ fontSize: 11, marginTop: 6, maxWidth: 360, margin: '6px auto 0' }}>
            New jobs from {profile?.connect_unlocked_by_fm_id ? 'your FM' : 'FMs you connect with'} land here as they're published. Cadi will push you a notification when your fit ≥ 90.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {listings.map(l => (
            <ListingCard
              key={l.id}
              listing={l}
              myProfile={profile}
              myBid={bidByListing.get(l.id)}
              onAccept={handleAccept}
              onWithdraw={handleWithdraw}
              isBusy={busyId === l.id || (bidByListing.get(l.id) && busyId === bidByListing.get(l.id).id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
