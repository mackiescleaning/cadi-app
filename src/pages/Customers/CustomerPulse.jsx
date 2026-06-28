import { useMemo, useState } from "react";
import { generateSuggestions } from "./helpers";
import { GlassSurface } from "./primitives";

// Customer Pulse — the analytics + lifecycle workspace that sits above the
// customer list. Six KPI tiles up top, then three actionable workspace
// cards (Win-back queue, Upsell radar, This month — birthdays + anniversaries).
//
// Computes everything client-side from the already-loaded customer array;
// no extra fetches. The aggregations are all O(n) over a list that's
// already capped by the free-tier limit or the user's Pro usage — fine
// for sub-second renders into the low thousands.

const DAY_MS = 86400000;

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

function monthDayKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

function isThisMonth(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth();
}

function monthsBetween(fromIso, toDate = new Date()) {
  if (!fromIso) return 0;
  const from = new Date(fromIso);
  return (toDate.getFullYear() - from.getFullYear()) * 12 + (toDate.getMonth() - from.getMonth());
}

function yearsFrom(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (DAY_MS * 365.25);
}

function gbp(n) {
  if (!Number.isFinite(n)) return "£0";
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`;
  return `£${Math.round(n)}`;
}

function Tile({ label, value, sub, accent = "text-white", onClick }) {
  if (onClick) {
    return (
      <button onClick={onClick} className="text-left w-full group">
        <GlassSurface tone="navy" depth="lift" className="px-3 py-2.5">
          <p className="text-[10px] text-[rgba(153,197,255,0.5)] font-bold tracking-wide uppercase mb-0.5">{label}</p>
          <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
          {sub && <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{sub}</p>}
        </GlassSurface>
      </button>
    );
  }
  return (
    <GlassSurface tone="navy" depth="flat" className="px-3 py-2.5">
      <p className="text-[10px] text-[rgba(153,197,255,0.5)] font-bold tracking-wide uppercase mb-0.5">{label}</p>
      <p className={`text-xl font-black tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-[10px] text-[rgba(153,197,255,0.45)] mt-0.5 truncate">{sub}</p>}
    </GlassSurface>
  );
}

function WorkspaceCard({ title, count, accent, children, emptyText, onSeeAll }) {
  return (
    <GlassSurface tone="navy" depth="flat">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgba(153,197,255,0.08)]">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${accent} shadow-sm`} />
          <p className="text-[11px] font-black tracking-wide uppercase text-white">{title}</p>
          <span className="text-[10px] font-bold text-[rgba(153,197,255,0.5)] tabular-nums">{count}</span>
        </div>
        {onSeeAll && count > 0 && (
          <button onClick={onSeeAll} className="text-[10px] font-bold text-[#99c5ff] hover:text-white transition-colors">
            See all →
          </button>
        )}
      </div>
      <div className="divide-y divide-[rgba(153,197,255,0.06)]">
        {count === 0 ? (
          <p className="px-3 py-3 text-[11px] text-[rgba(153,197,255,0.4)] leading-snug">{emptyText}</p>
        ) : children}
      </div>
    </GlassSurface>
  );
}

function MiniRow({ name, sub, right, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-white truncate">{name}</p>
        {sub && <p className="text-[10px] text-[rgba(153,197,255,0.5)] truncate">{sub}</p>}
      </div>
      {right && <span className="text-[10px] font-bold text-[#99c5ff] tabular-nums shrink-0">{right}</span>}
    </button>
  );
}

export default function CustomerPulse({ customers, onSelectCustomer, onMessage, onFilter }) {
  const [collapsed, setCollapsed] = useState(false);

  const data = useMemo(() => {
    const active = customers.filter(c => c.status !== 'archived');
    const total  = active.length;
    const liveActive = active.filter(c => c.status === 'active').length;
    const lapsed = active.filter(c => c.status === 'lapsed').length;
    const atRisk = active.filter(c => c.status === 'at-risk').length;

    const revenue = active.reduce((s, c) => s + (c.lifetimeValue || 0), 0);
    const withLtv = active.filter(c => (c.lifetimeValue || 0) > 0);
    const avgLtv = withLtv.length ? revenue / withLtv.length : 0;

    // Outstanding balance across all customers — sourced from the
    // customers_with_billing view, so this lights up when an invoice is
    // sent or goes overdue and clears when one is marked paid.
    const outstandingTotal = active.reduce((s, c) => s + (c.outstandingBalance || 0), 0);
    const outstandingCount = active.filter(c => (c.outstandingBalance || 0) > 0).length;

    // Tenure (avg months as customer)
    const tenures = active
      .map(c => monthsBetween(c.customerSince || c.createdAt))
      .filter(n => n > 0);
    const avgTenureMonths = tenures.length ? Math.round(tenures.reduce((s, n) => s + n, 0) / tenures.length) : 0;

    // Retention rate — active / (active + lapsed) over the last 12 months
    const totalEverActive = liveActive + lapsed + atRisk;
    const retentionPct = totalEverActive ? Math.round((liveActive / totalEverActive) * 100) : 100;

    // Win-back candidates — one-off customers >60 days since last job
    const winback = active
      .filter(c => {
        const d = daysSince(c.lastJobDate);
        if (d == null) return false;
        return d > 60 && (c.frequency === 'one-off' || c.status === 'lapsed');
      })
      .map(c => ({ c, days: daysSince(c.lastJobDate), value: c.lifetimeValue || 0 }))
      .sort((a, b) => (b.value - a.value) || (b.days - a.days))
      .slice(0, 4);

    // Upsell radar — anyone with a high/urgent suggestion
    const radar = active
      .map(c => ({ c, sug: generateSuggestions(c)?.find(s => s.priority === 'urgent' || s.priority === 'high') }))
      .filter(x => x.sug)
      .sort((a, b) => {
        const pri = p => p === 'urgent' ? 2 : 1;
        return pri(b.sug.priority) - pri(a.sug.priority) || (b.c.lifetimeValue || 0) - (a.c.lifetimeValue || 0);
      })
      .slice(0, 4);

    // Milestones this month — birthdays + anniversaries
    const now = new Date();
    const month = now.getMonth();
    const milestones = active
      .map(c => {
        const events = [];
        if (c.birthday && new Date(c.birthday).getMonth() === month) {
          events.push({ type: 'birthday', label: '🎂 Birthday', date: c.birthday });
        }
        const since = c.customerSince || c.createdAt;
        if (since && new Date(since).getMonth() === month) {
          const yrs = Math.floor(yearsFrom(since));
          if (yrs >= 1) events.push({ type: 'anniversary', label: `🎉 ${yrs}yr anniversary`, date: since });
        }
        return events.length ? { c, events } : null;
      })
      .filter(Boolean)
      .slice(0, 4);

    // Totals for the workspace card headers (full counts, not capped by slice)
    const winbackCount = active.filter(c => {
      const d = daysSince(c.lastJobDate);
      return d != null && d > 60 && (c.frequency === 'one-off' || c.status === 'lapsed');
    }).length;

    const radarCount = active.filter(c =>
      generateSuggestions(c)?.some(s => s.priority === 'urgent' || s.priority === 'high')
    ).length;

    const milestoneCount = active.filter(c => {
      const bMatch = c.birthday && new Date(c.birthday).getMonth() === month;
      const since = c.customerSince || c.createdAt;
      const aMatch = since && new Date(since).getMonth() === month && yearsFrom(since) >= 1;
      return bMatch || aMatch;
    }).length;

    return {
      total, liveActive, lapsed, atRisk, revenue, avgLtv,
      outstandingTotal, outstandingCount,
      avgTenureMonths, retentionPct,
      winback, winbackCount, radar, radarCount, milestones, milestoneCount,
    };
  }, [customers]);

  if (data.total === 0) return null;

  return (
    <div className="px-4 pt-3 pb-1">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-gradient-to-b from-[#99c5ff] to-[#1f48ff] rounded-full" />
          <p className="text-[11px] font-black tracking-[0.15em] uppercase text-white">Pulse</p>
        </div>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="text-[10px] font-bold text-[rgba(153,197,255,0.5)] hover:text-white transition-colors"
        >
          {collapsed ? 'Expand ↓' : 'Collapse ↑'}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* KPI grid — 7 tiles. 2 rows of 3-4 on mobile (last wraps),
              single row on lg via grid-cols-7. */}
          <div className="grid grid-cols-3 lg:grid-cols-7 gap-2 mb-3">
            <Tile label="Total" value={data.total} sub={`${data.liveActive} active`} />
            <Tile
              label="Lifetime"
              value={gbp(data.revenue)}
              sub={`${gbp(data.avgLtv)} avg`}
              accent="text-emerald-300"
            />
            <Tile
              label="Outstanding"
              value={gbp(data.outstandingTotal)}
              sub={`${data.outstandingCount} customer${data.outstandingCount === 1 ? '' : 's'}`}
              accent={data.outstandingTotal > 0 ? "text-amber-300" : "text-emerald-300"}
            />
            <Tile
              label="Retention"
              value={`${data.retentionPct}%`}
              sub={`${data.lapsed} lapsed`}
              accent={data.retentionPct >= 80 ? "text-emerald-300" : data.retentionPct >= 60 ? "text-amber-300" : "text-red-300"}
            />
            <Tile
              label="Avg tenure"
              value={data.avgTenureMonths >= 12 ? `${(data.avgTenureMonths / 12).toFixed(1)}y` : `${data.avgTenureMonths}m`}
              sub="as customer"
            />
            <Tile
              label="Win-back"
              value={data.winbackCount}
              sub="60+ days gap"
              accent={data.winbackCount > 0 ? "text-amber-300" : "text-[rgba(153,197,255,0.4)]"}
              onClick={data.winbackCount > 0 ? () => onFilter?.('lapsed') : undefined}
            />
            <Tile
              label="This month"
              value={data.milestoneCount}
              sub="birthdays + anniv"
              accent={data.milestoneCount > 0 ? "text-pink-300" : "text-[rgba(153,197,255,0.4)]"}
            />
          </div>

          {/* Workspace cards — three lifecycle queues */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            <WorkspaceCard
              title="Win back"
              count={data.winbackCount}
              accent="bg-amber-400"
              emptyText="No lapsed customers. Everyone's seen you recently."
              onSeeAll={data.winbackCount > 4 ? () => onFilter?.('lapsed') : undefined}
            >
              {data.winback.map(({ c, days, value }) => (
                <MiniRow
                  key={c.id}
                  name={c.name}
                  sub={`${days}d ago · ${gbp(value)} LTV`}
                  right={<span onClick={(e) => { e.stopPropagation(); onMessage?.(c, { type: 'winback', title: 'Win back' }); }} className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/25 cursor-pointer hover:bg-amber-400/25">Message</span>}
                  onClick={() => onSelectCustomer?.(c)}
                />
              ))}
            </WorkspaceCard>

            <WorkspaceCard
              title="Upsell radar"
              count={data.radarCount}
              accent="bg-[#1f48ff]"
              emptyText="No high-priority upsells right now. Quiet week."
            >
              {data.radar.map(({ c, sug }) => (
                <MiniRow
                  key={c.id}
                  name={c.name}
                  sub={sug.title || sug.message || sug.type}
                  right={<span onClick={(e) => { e.stopPropagation(); onMessage?.(c, sug); }} className="px-1.5 py-0.5 rounded bg-[#1f48ff]/20 text-[#99c5ff] border border-[#1f48ff]/40 cursor-pointer hover:bg-[#1f48ff]/30">Pitch</span>}
                  onClick={() => onSelectCustomer?.(c)}
                />
              ))}
            </WorkspaceCard>

            <WorkspaceCard
              title="This month"
              count={data.milestoneCount}
              accent="bg-pink-400"
              emptyText="No birthdays or anniversaries this month."
            >
              {data.milestones.map(({ c, events }) => (
                <MiniRow
                  key={c.id}
                  name={c.name}
                  sub={events.map(e => e.label).join(' · ')}
                  right={<span onClick={(e) => { e.stopPropagation(); onMessage?.(c, { type: events[0].type, title: events[0].label }); }} className="px-1.5 py-0.5 rounded bg-pink-400/15 text-pink-300 border border-pink-400/25 cursor-pointer hover:bg-pink-400/25">Wish</span>}
                  onClick={() => onSelectCustomer?.(c)}
                />
              ))}
            </WorkspaceCard>
          </div>
        </>
      )}
    </div>
  );
}
