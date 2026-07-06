import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  GitBranch,
  CheckSquare,
  Star,
  PoundSterling,
  Receipt,
  Network,
  TrendingUp,
  ChevronRight,
  Sparkles,
  Loader2,
  MapPin,
  ArrowUpRight,
} from 'lucide-react';
import {
  listMyConnectJobs,
  listMyConnectInvoices,
  listOpenMarketplaceListings,
  getMyConnectProfile,
  computeFitScore,
} from '../lib/db/connectDb';
import {
  CONNECT_COLORS,
  CONNECT_RADII,
  TIER_STYLE,
  ON_DARK,
  glassDark,
  navyCanvas,
  primaryButton,
  whiteButton,
  HOVER_LIFT,
} from '../lib/connectTheme';

const ORANGE = CONNECT_COLORS.orange;

function fmtMoney(n) {
  return `£${Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
}

/* ─── Cadi Score badge ────────────────────────────────────────────────────── */
function ScoreBadge({ profile }) {
  const status = profile?.connect_score_status;
  const building = status === 'building' || !profile?.connect_score;
  const score = profile?.connect_score;
  const tier = profile?.connect_tier || 'building';
  const t = TIER_STYLE[tier] || TIER_STYLE.building;

  return (
    <div className="relative shrink-0" style={{ width: 140 }}>
      <div
        className="absolute inset-0 rounded-full blur-2xl"
        style={{ background: t.glow, transform: 'scale(0.95)' }}
      />
      <div
        className="relative flex flex-col items-center justify-center text-center"
        style={{
          ...glassDark({ radius: 999, blur: 20, strong: true }),
          width: 140,
          height: 140,
          border: `1px solid ${t.glow}`,
        }}
      >
        {building ? (
          <>
            <Sparkles size={16} className="text-white/80 mb-1" />
            <div className="text-white/70 text-[10px] font-black tracking-[0.18em] uppercase">
              Building
            </div>
            <div className="text-white text-xs font-bold mt-1 leading-tight px-3">
              Unlocks at
              <br />5 jobs
            </div>
          </>
        ) : (
          <>
            <div className="text-white/60 text-[9px] font-black tracking-[0.22em] uppercase mb-1">
              Cadi Score
            </div>
            <div className="text-white text-4xl font-black leading-none tabular-nums">{score}</div>
            <div
              className="mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.14)', color: '#ffffff' }}
            >
              {t.label}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Match ring ─────────────────────────────────────────────────────────── */
function MatchRing({ score }) {
  const color = score >= 90 ? ON_DARK.success : score >= 80 ? ON_DARK.bluePop : ON_DARK.amber;
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div
        className="w-11 h-11 rounded-full flex items-center justify-center text-xs font-black"
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: `1.5px solid ${color}`,
          color,
        }}
      >
        {score}
      </div>
      <div className="text-[9px] font-black tracking-wider uppercase" style={{ color }}>
        match
      </div>
    </div>
  );
}

/* ─── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, accent, loading }) {
  return (
    <div style={glassDark({ padding: 18, radius: CONNECT_RADII.lg })} className={HOVER_LIFT}>
      <div
        className="text-[10px] font-black uppercase tracking-widest mb-2"
        style={{ color: ON_DARK.muted }}
      >
        {label}
      </div>
      <div className="text-3xl font-black tabular-nums leading-none" style={{ color: accent }}>
        {loading ? '—' : value}
      </div>
      <div className="text-[11px] mt-2" style={{ color: ON_DARK.faint }}>
        {sub}
      </div>
    </div>
  );
}

/* ─── Quick-action tile ──────────────────────────────────────────────────── */
function QuickTile({ Icon, label, sub, tone, onClick, badge }) {
  const toneMap = {
    orange: {
      bg: `linear-gradient(135deg, #ff6a30 0%, ${ORANGE} 100%)`,
      halo: 'rgba(194,65,12,0.55)',
    },
    blue: {
      bg: `linear-gradient(135deg, #7ea3ff 0%, #1e3a8a 100%)`,
      halo: 'rgba(79,120,255,0.55)',
    },
    green: {
      bg: `linear-gradient(135deg, #34d399 0%, #047857 100%)`,
      halo: 'rgba(16,185,129,0.55)',
    },
    navy: {
      bg: `linear-gradient(135deg, #4f78ff 0%, #010a4f 100%)`,
      halo: 'rgba(79,120,255,0.45)',
    },
    amber: {
      bg: `linear-gradient(135deg, #fbbf24 0%, #b45309 100%)`,
      halo: 'rgba(245,158,11,0.55)',
    },
    purple: {
      bg: `linear-gradient(135deg, #c084fc 0%, #6d28d9 100%)`,
      halo: 'rgba(168,85,247,0.55)',
    },
  };
  const t = toneMap[tone] || toneMap.orange;

  return (
    <button
      onClick={onClick}
      className={`relative text-left group ${HOVER_LIFT}`}
      style={{ ...glassDark({ padding: 18, radius: CONNECT_RADII.lg }), cursor: 'pointer' }}
    >
      {badge != null && badge > 0 && (
        <span
          className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
          style={{ background: ORANGE, boxShadow: '0 4px 10px -2px rgba(194,65,12,0.7)' }}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <div
        className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
        style={{ background: t.bg, boxShadow: `0 12px 26px -12px ${t.halo}` }}
      >
        <Icon size={18} className="text-white" strokeWidth={2.2} />
      </div>
      <div className="font-black text-sm text-white" style={{ letterSpacing: '-0.01em' }}>
        {label}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: ON_DARK.muted }}>
        {sub}
      </div>
    </button>
  );
}

/* ─── Section heading ───────────────────────────────────────────────────── */
function SectionHeading({ children, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      <h2
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: ON_DARK.muted,
        }}
      >
        {children}
      </h2>
      {action && (
        <button
          onClick={onAction}
          className="text-[11px] font-black flex items-center gap-1 hover:underline"
          style={{ color: ON_DARK.orangeSoft, letterSpacing: '0.02em' }}
        >
          {action} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
}

/* ─── Chip on dark ──────────────────────────────────────────────────────── */
function chipDark(tone = 'neutral') {
  const map = {
    neutral: { bg: 'rgba(255,255,255,0.08)', fg: '#ffffff' },
    orange: { bg: 'rgba(255,176,138,0.14)', fg: '#ffb08a' },
    green: { bg: 'rgba(34,197,94,0.14)', fg: '#4ade80' },
    amber: { bg: 'rgba(251,191,36,0.14)', fg: '#fbbf24' },
  };
  const t = map[tone] || map.neutral;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
    borderRadius: 999,
    background: t.bg,
    color: t.fg,
    border: '1px solid rgba(255,255,255,0.14)',
    whiteSpace: 'nowrap',
  };
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function EarnLanding() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [listings, setListings] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [j, i, l, p] = await Promise.all([
          listMyConnectJobs().catch(() => []),
          listMyConnectInvoices().catch(() => []),
          listOpenMarketplaceListings().catch(() => []),
          getMyConnectProfile().catch(() => null),
        ]);
        setJobs(j);
        setInvoices(i);
        setListings(l);
        setProfile(p);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summary = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const connectedFmIds = new Set(jobs.map((j) => j.fm_organisation?.id).filter(Boolean));
    let pending = 0,
      earnedThisMonth = 0;
    for (const inv of invoices) {
      const total = Number(inv.total_value ?? 0);
      if (['submitted', 'exported'].includes(inv.status)) pending += total;
      if (inv.status === 'paid' && inv.paid_at && new Date(inv.paid_at) >= monthStart) {
        earnedThisMonth += total;
      }
    }
    return {
      connectedFms: connectedFmIds.size,
      availableJobs: listings.length,
      pendingPay: pending,
      earnedThisMonth,
    };
  }, [jobs, invoices, listings]);

  const topFm = useMemo(() => {
    const byFm = new Map();
    for (const inv of invoices) {
      const id = inv.fm_organisation?.id;
      if (!id) continue;
      const cur = byFm.get(id) ?? {
        id,
        name: inv.fm_organisation?.name ?? 'FM',
        total: 0,
        pending: 0,
      };
      const total = Number(inv.total_value ?? 0);
      if (['submitted', 'exported', 'paid'].includes(inv.status)) cur.total += total;
      if (['submitted', 'exported'].includes(inv.status)) cur.pending += total;
      byFm.set(id, cur);
    }
    for (const j of jobs) {
      const id = j.fm_organisation?.id;
      if (!id) continue;
      const cur = byFm.get(id) ?? {
        id,
        name: j.fm_organisation?.name ?? 'FM',
        total: 0,
        pending: 0,
      };
      cur.jobsDone = (cur.jobsDone ?? 0) + (j.approval_status === 'approved' ? 1 : 0);
      byFm.set(id, cur);
    }
    return Array.from(byFm.values()).sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0] ?? null;
  }, [invoices, jobs]);

  const pipeline = useMemo(() => {
    const onSite = jobs.filter((j) => j.status === 'in_progress').length;
    const queried = jobs.filter((j) => j.approval_status === 'queried').length;
    const pendingRev = jobs.filter(
      (j) => j.status === 'complete' && j.approval_status === 'pending'
    ).length;
    const upcoming = jobs.filter((j) =>
      ['scheduled', 'unassigned', 'pending_confirmation'].includes(j.status)
    ).length;
    return [
      { status: 'On site now', count: onSite, color: ON_DARK.bluePop },
      { status: 'FM queried', count: queried, color: ON_DARK.orangeSoft },
      { status: 'Pending review', count: pendingRev, color: ON_DARK.amber },
      { status: 'Upcoming', count: upcoming, color: '#a5b4fc' },
    ];
  }, [jobs]);

  const featured = useMemo(() => {
    const score = profile?.connect_score ?? 70;
    return listings
      .slice(0, 10)
      .map((l) => ({
        ...l,
        matchScore: Math.round(
          computeFitScore({
            price: l.target_price ?? l.floor_price ?? 0,
            listingTarget: l.target_price ?? 0,
            listingFloor: l.floor_price ?? 0,
            score,
            distanceMi: 0,
            capacityFree: true,
          }) || 70
        ),
      }))
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }, [listings, profile]);

  const queriedCount = pipeline[1]?.count ?? 0;
  const onSiteCount = pipeline[0]?.count ?? 0;
  const marketplaceCount = summary.availableJobs;

  const greeting = useMemo(() => {
    const hr = new Date().getHours();
    return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  }, []);

  return (
    // Bleed navy edge-to-edge past the AppLayout main padding.
    <div className="-mx-4 md:-mx-8 -my-6 relative" style={navyCanvas()}>
      {/* soft grain layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(60% 40% at 30% 100%, rgba(255,255,255,0.04) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto px-4 md:px-8 pt-6 pb-28 space-y-6 z-10">
        {/* ─── HERO ───────────────────────────────────────────────────── */}
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
          <div className="relative px-6 md:px-10 py-8 md:py-10 flex flex-col md:flex-row md:items-center gap-8">
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-2 mb-4">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: ORANGE, boxShadow: '0 8px 20px -6px rgba(194,65,12,0.6)' }}
                >
                  <TrendingUp size={13} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black tracking-[0.28em] text-white/60 uppercase">
                  Cadi Connect
                </span>
              </div>
              <h1
                className="mb-2.5"
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  color: '#ffffff',
                }}
              >
                {greeting},{' '}
                <span style={{ color: ON_DARK.orangeSoft }}>
                  {profile?.business_name || profile?.first_name || 'operator'}
                </span>
              </h1>
              <p className="text-white/60 text-[15px] leading-relaxed max-w-lg">
                {loading
                  ? 'Loading your work…'
                  : summary.connectedFms === 0 && summary.availableJobs === 0
                    ? 'Your gateway to premium commercial cleaning. Browse the marketplace to land your first FM.'
                    : summary.connectedFms === 0
                      ? `${summary.availableJobs} live ${summary.availableJobs === 1 ? 'job' : 'jobs'} on the marketplace — place your first bid to unlock an FM.`
                      : `${summary.connectedFms} FM ${summary.connectedFms === 1 ? 'connection' : 'connections'} · ${summary.availableJobs} open ${summary.availableJobs === 1 ? 'job' : 'jobs'} · ${fmtMoney(summary.pendingPay)} awaiting payment`}
              </p>
              <div className="flex flex-wrap gap-2.5 mt-6">
                <button
                  onClick={() => navigate('/connect/marketplace')}
                  style={primaryButton({ size: 'lg' })}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.filter = 'brightness(1.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = '';
                    e.currentTarget.style.transform = '';
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingBag size={15} /> Browse marketplace
                  </span>
                </button>
                <button
                  onClick={() => navigate('/connect/completion')}
                  style={whiteButton({ size: 'lg' })}
                >
                  {onSiteCount > 0 ? `${onSiteCount} on site now` : 'View my work'}
                </button>
              </div>
            </div>
            <ScoreBadge profile={profile} />
          </div>
        </div>

        {error && (
          <div
            className="rounded-2xl px-5 py-4 text-sm"
            style={{
              background: 'rgba(220,38,38,0.14)',
              color: '#fca5a5',
              border: '1px solid rgba(220,38,38,0.30)',
            }}
          >
            {error}
          </div>
        )}

        {/* ─── STATS ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Connected FMs"
            value={summary.connectedFms}
            sub={summary.connectedFms === 0 ? 'no FMs yet' : `${summary.connectedFms} active`}
            accent={ON_DARK.success}
            loading={loading}
          />
          <StatCard
            label="Marketplace"
            value={summary.availableJobs}
            sub="open to bid"
            accent={ON_DARK.orangeSoft}
            loading={loading}
          />
          <StatCard
            label="Awaiting payment"
            value={fmtMoney(summary.pendingPay)}
            sub="invoiced, not paid"
            accent={ON_DARK.amber}
            loading={loading}
          />
          <StatCard
            label="Earned this month"
            value={fmtMoney(summary.earnedThisMonth)}
            sub="confirmed paid"
            accent="#ffffff"
            loading={loading}
          />
        </div>

        {/* ─── QUICK ACTIONS ──────────────────────────────────────────── */}
        <div>
          <SectionHeading>Quick actions</SectionHeading>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <QuickTile
              Icon={ShoppingBag}
              label="Marketplace"
              sub="Bid on open jobs"
              tone="orange"
              badge={marketplaceCount}
              onClick={() => navigate('/connect/marketplace')}
            />
            <QuickTile
              Icon={GitBranch}
              label="Current Work"
              sub="Schedule & sites"
              tone="blue"
              onClick={() => navigate('/connect/pipeline')}
            />
            <QuickTile
              Icon={CheckSquare}
              label="Work Completion"
              sub="Check in / out & evidence"
              tone="green"
              badge={onSiteCount + queriedCount}
              onClick={() => navigate('/connect/completion')}
            />
            <QuickTile
              Icon={Star}
              label="My Profile"
              sub="Score, docs, reviews"
              tone="purple"
              onClick={() => navigate('/connect/reputation')}
            />
            <QuickTile
              Icon={PoundSterling}
              label="Earnings"
              sub="Paid, pending, projections"
              tone="navy"
              onClick={() => navigate('/connect/earnings')}
            />
            <QuickTile
              Icon={Receipt}
              label="Invoicing"
              sub="Draft, submit, merge"
              tone="amber"
              onClick={() => navigate('/connect/invoice')}
            />
          </div>
        </div>

        {/* ─── TOP FM ────────────────────────────────────────────────── */}
        {!loading && topFm && (
          <div>
            <SectionHeading action="All FMs" onAction={() => navigate('/connect/connections')}>
              Top connection
            </SectionHeading>
            <div style={glassDark({ padding: 22, radius: CONNECT_RADII.lg, strong: true })}>
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, #7ea3ff, #010a4f)',
                    boxShadow: '0 12px 30px -12px rgba(79,120,255,0.55)',
                  }}
                >
                  {(topFm.name?.[0] ?? '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-base truncate text-white">{topFm.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: ON_DARK.muted }}>
                    {topFm.jobsDone ?? 0} approved {topFm.jobsDone === 1 ? 'job' : 'jobs'}
                    {topFm.pending > 0 ? ` · ${fmtMoney(topFm.pending)} pending` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-black tabular-nums text-white">
                    {fmtMoney(topFm.total)}
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-widest font-black"
                    style={{ color: ON_DARK.faint }}
                  >
                    total earned
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => navigate('/connect/connections')}
                  style={{ ...primaryButton({ size: 'md' }), flex: 1 }}
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Network size={13} /> View connection
                  </span>
                </button>
                <button
                  onClick={() => navigate('/connect/earnings')}
                  style={whiteButton({ size: 'md' })}
                >
                  Earnings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── PIPELINE ──────────────────────────────────────────────── */}
        {!loading && jobs.length > 0 && (
          <div>
            <SectionHeading action="Full pipeline" onAction={() => navigate('/connect/completion')}>
              Job pipeline
            </SectionHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {pipeline.map(({ status, count, color }) => (
                <button
                  key={status}
                  onClick={() => navigate('/connect/completion')}
                  className={`text-left ${HOVER_LIFT}`}
                  style={{
                    ...glassDark({ padding: 14, radius: CONNECT_RADII.md }),
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 0 4px ${color}22` }}
                    />
                    <span
                      className="text-[10px] font-black uppercase tracking-widest"
                      style={{ color: ON_DARK.muted }}
                    >
                      {status}
                    </span>
                  </div>
                  <div className="text-2xl font-black tabular-nums" style={{ color }}>
                    {count}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── FEATURED JOBS ─────────────────────────────────────────── */}
        {!loading && featured.length > 0 && (
          <div>
            <SectionHeading
              action={`See all ${listings.length}`}
              onAction={() => navigate('/connect/marketplace')}
            >
              Best matches for you
            </SectionHeading>
            <div className="space-y-3">
              {featured.map((l) => {
                const siteName = l.visit_spec?.site?.name ?? 'Site';
                const sitePc = l.visit_spec?.site?.postcode ?? '';
                const fmName = l.fm_organisation?.name ?? 'FM';
                const scope = l.visit_spec?.scope;
                return (
                  <button
                    key={l.id}
                    onClick={() => navigate('/connect/marketplace')}
                    className={`w-full text-left ${HOVER_LIFT}`}
                    style={{
                      ...glassDark({ padding: 16, radius: CONNECT_RADII.lg }),
                      cursor: 'pointer',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-black text-sm truncate text-white">{siteName}</span>
                          {sitePc && (
                            <span style={chipDark('neutral')}>
                              <MapPin size={10} /> {sitePc}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] mb-2" style={{ color: ON_DARK.muted }}>
                          {fmName}
                          {scope ? ` · ${scope}` : ''}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black tabular-nums text-white">
                            {fmtMoney(l.target_price ?? l.floor_price ?? 0)}
                          </span>
                          <span className="text-[11px]" style={{ color: ON_DARK.faint }}>
                            / visit
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <MatchRing score={l.matchScore} />
                        <div
                          className="inline-flex items-center gap-1 text-[11px] font-black"
                          style={{ color: ON_DARK.orangeSoft }}
                        >
                          View <ArrowUpRight size={12} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── EMPTY STATE ───────────────────────────────────────────── */}
        {!loading && jobs.length === 0 && featured.length === 0 && (
          <div
            className="text-center px-6 py-12"
            style={glassDark({ radius: CONNECT_RADII.xl, strong: true })}
          >
            <div
              className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{
                background: `linear-gradient(135deg, #ff6a30 0%, ${ORANGE} 100%)`,
                boxShadow: '0 12px 30px -12px rgba(194,65,12,0.6)',
              }}
            >
              <ShoppingBag size={22} className="text-white" strokeWidth={2.2} />
            </div>
            <div className="font-black text-lg mb-1 text-white">Your pipeline is clear</div>
            <div
              className="text-sm max-w-md mx-auto leading-relaxed mb-6"
              style={{ color: ON_DARK.muted }}
            >
              No live work right now. Browse the marketplace to place your first bid — every job you
              win builds your Cadi Score.
            </div>
            <button
              onClick={() => navigate('/connect/marketplace')}
              style={primaryButton({ size: 'lg' })}
            >
              <span className="inline-flex items-center gap-2">
                <ShoppingBag size={15} /> Open marketplace
              </span>
            </button>
          </div>
        )}

        {/* ─── LOADING ───────────────────────────────────────────────── */}
        {loading && (
          <div
            className="text-center py-10"
            style={{
              ...glassDark({ padding: 24, radius: CONNECT_RADII.lg }),
              color: ON_DARK.muted,
            }}
          >
            <Loader2
              size={18}
              className="mx-auto mb-2"
              style={{ animation: 'connectSpin 0.8s linear infinite', color: ON_DARK.muted }}
            />
            <div className="text-xs">Loading your work…</div>
            <style>{`@keyframes connectSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}
