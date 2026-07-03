import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ClipboardList, Calendar, CheckCircle2, Receipt, Users, Send,
  Loader2, ArrowUpRight, Building2, Plus,
} from 'lucide-react';
import { getFmOverview, listJobsForApproval, listFmInvoices } from '../../lib/db/fmOpsDb';
import {
  blueCanvas, glassDark, primaryButton, ghostButton, ON_DARK, HOVER_LIFT, FM_POP as POP,
} from '../../lib/connectTheme';

function HeroStat({ value, label, divider }) {
  return (
    <div style={{
      textAlign: 'center', padding: '0 22px',
      borderLeft: divider ? `1px solid ${ON_DARK.line}` : 'none',
    }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: ON_DARK.primary, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: ON_DARK.muted, marginTop: 5 }}>{label}</div>
    </div>
  );
}

function KpiCard({ label, value, subValue, icon: Icon, pop = POP.blue, to }) {
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: `${pop}1f`, color: pop,
          border: `1px solid ${pop}38`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={16} /></div>
        {to && <ArrowUpRight size={14} color={ON_DARK.faint} />}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: ON_DARK.primary, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: ON_DARK.secondary, fontWeight: 700, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, marginTop: 3, minHeight: 14 }}>{subValue ?? ''}</div>
    </>
  );
  const style = {
    ...glassDark({ radius: 18, padding: '18px 20px' }),
    display: 'block', textDecoration: 'none',
  };
  if (to) return <Link to={to} className={HOVER_LIFT} style={{ ...style, cursor: 'pointer' }}>{body}</Link>;
  return <div style={style}>{body}</div>;
}

function QueueHeader({ icon: Icon, pop, title, count, to }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <Icon size={14} color={pop} />
      <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary, letterSpacing: '0.02em' }}>{title}</div>
      <span style={{
        fontSize: 10, fontWeight: 800, color: ON_DARK.primary,
        background: 'rgba(255,255,255,0.10)', border: `1px solid ${ON_DARK.line}`,
        padding: '2px 8px', borderRadius: 999,
      }}>{count}</span>
      <div style={{ flex: 1 }} />
      <Link to={to} style={{ fontSize: 11, fontWeight: 700, color: POP.blue, textDecoration: 'none' }}>See all →</Link>
    </div>
  );
}

function ActionQueueItem({ to, label, primary, secondary, pop }) {
  return (
    <Link
      to={to}
      className={HOVER_LIFT}
      style={{
        ...glassDark({ radius: 14, padding: '12px 14px' }),
        display: 'flex', alignItems: 'center', gap: 12,
        textDecoration: 'none',
      }}
    >
      <div style={{
        minWidth: 44, height: 32, borderRadius: 9, padding: '0 8px',
        background: `${pop}1f`, color: pop, border: `1px solid ${pop}38`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900,
      }}>{primary}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {secondary && <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 3 }}>{secondary}</div>}
      </div>
      <ArrowUpRight size={14} color={ON_DARK.faint} />
    </Link>
  );
}

function EmptyQueue({ children }) {
  return (
    <div style={{
      padding: 20, borderRadius: 14,
      border: '1.5px dashed rgba(255,255,255,0.16)',
      fontSize: 12, color: ON_DARK.muted, textAlign: 'center',
    }}>
      {children}
    </div>
  );
}

export default function FmOpsOverview() {
  const [kpis, setKpis] = useState(null);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [submittedInvoices, setSubmittedInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [k, p, s] = await Promise.all([
          getFmOverview(),
          listJobsForApproval({ filter: 'pending' }),
          listFmInvoices({ status: 'submitted' }),
        ]);
        setKpis(k);
        setPendingJobs(p.slice(0, 5));
        setSubmittedInvoices(s.slice(0, 5));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>

        {/* Hero */}
        <div style={{
          ...glassDark({ radius: 22, padding: '26px 28px', strong: true }),
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap', marginBottom: 22,
        }}>
          <div style={{ minWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: 'rgba(79,120,255,0.22)', color: POP.blue,
                border: '1px solid rgba(79,120,255,0.40)',
                boxShadow: '0 8px 24px -8px rgba(79,120,255,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}><Building2 size={20} /></div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: ON_DARK.muted }}>
                Cadi Connect · FM Operations
              </div>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.12, color: ON_DARK.primary, margin: 0 }}>
              Run every contract<br />from <span style={{ color: POP.blue }}>one desk</span>.
            </h1>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: ON_DARK.secondary, margin: '12px 0 18px', maxWidth: 460 }}>
              Post work to the marketplace, award contracts, approve completed jobs
              and settle invoices — across your whole portfolio.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/fm-ops/marketplace" style={{ textDecoration: 'none' }}>
                <button className={HOVER_LIFT} style={{ ...primaryButton(), display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Send size={14} /> Post to marketplace
                </button>
              </Link>
              <Link to="/fm-ops/contracts/new" style={{ textDecoration: 'none' }}>
                <button className={HOVER_LIFT} style={{ ...ghostButton({ onDark: true }), display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                  <Plus size={14} /> New contract
                </button>
              </Link>
            </div>
          </div>

          {kpis && !error && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0' }}>
              <HeroStat value={kpis.activeContracts} label="Live contracts" />
              <HeroStat value={kpis.siteCount} label="Sites" divider />
              <HeroStat value={kpis.activeSubs} label="Contractors" divider />
            </div>
          )}
        </div>

        {loading && (
          <div style={{ padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
            <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading overview…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && error && (
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>{error}</div>
        )}

        {!loading && !error && kpis && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 26 }}>
              <KpiCard
                label="Active contracts"
                value={kpis.activeContracts}
                subValue={kpis.mobilisingContracts ? `${kpis.mobilisingContracts} mobilising` : null}
                icon={FileText} pop={POP.green}
                to="/fm-ops/contracts"
              />
              <KpiCard
                label="Sites in scope"
                value={kpis.siteCount}
                icon={ClipboardList} pop={POP.blue}
                to="/fm-ops/sites"
              />
              <KpiCard
                label="Jobs this week"
                value={kpis.jobsThisWeek}
                subValue={kpis.jobsThisWeekValue ? `£${kpis.jobsThisWeekValue.toFixed(0)} value` : null}
                icon={Calendar} pop={POP.blue}
                to="/fm-ops/schedule"
              />
              <KpiCard
                label="Awaiting approval"
                value={kpis.pendingApprovals}
                subValue={kpis.pendingApprovalsValue ? `£${kpis.pendingApprovalsValue.toFixed(0)} value` : null}
                icon={CheckCircle2} pop={kpis.pendingApprovals ? POP.orange : POP.blue}
                to="/fm-ops/approval"
              />
              <KpiCard
                label="Invoices due"
                value={`£${kpis.invoicesDueValue.toFixed(0)}`}
                subValue={`${kpis.invoicesDueCount} invoice${kpis.invoicesDueCount === 1 ? '' : 's'}`}
                icon={Receipt} pop={kpis.invoicesDueCount ? POP.orange : POP.blue}
                to="/fm-ops/accounts"
              />
              <KpiCard
                label="Active sub-contractors"
                value={kpis.activeSubs}
                subValue={kpis.liveListings ? `${kpis.liveListings} live listing${kpis.liveListings === 1 ? '' : 's'}` : null}
                icon={Users} pop={POP.green}
                to="/fm-ops/contractors"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {/* Action queue — pending approvals */}
              <div>
                <QueueHeader icon={CheckCircle2} pop={POP.orange} title="Awaiting your review" count={kpis.pendingApprovals} to="/fm-ops/approval" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingJobs.length === 0 && (
                    <EmptyQueue>Nothing to review — you're up to date.</EmptyQueue>
                  )}
                  {pendingJobs.map(j => (
                    <ActionQueueItem
                      key={j.id}
                      to="/fm-ops/approval"
                      label={j.site?.name ?? 'Site'}
                      primary={`£${j.price ?? 0}`}
                      secondary={`${j.subName} · ${j.completion_marked_at ? new Date(j.completion_marked_at).toLocaleDateString() : '—'}`}
                      pop={POP.orange}
                    />
                  ))}
                </div>
              </div>

              {/* Action queue — invoices */}
              <div>
                <QueueHeader icon={Receipt} pop={POP.blue} title="Invoices to action" count={kpis.invoicesDueCount} to="/fm-ops/accounts" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {submittedInvoices.length === 0 && (
                    <EmptyQueue>No submitted invoices — subs haven't sent any yet.</EmptyQueue>
                  )}
                  {submittedInvoices.map(inv => (
                    <ActionQueueItem
                      key={inv.id}
                      to="/fm-ops/accounts"
                      label={inv.siteName ?? inv.reference ?? 'Invoice'}
                      primary={`£${Number(inv.total_value).toFixed(0)}`}
                      secondary={`${inv.subName} · ${inv.service_date ? new Date(inv.service_date).toLocaleDateString() : '—'}`}
                      pop={POP.blue}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
