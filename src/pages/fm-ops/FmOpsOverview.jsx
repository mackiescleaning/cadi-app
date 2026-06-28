import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, ClipboardList, Calendar, CheckCircle2, Receipt, Users, Send,
  Loader2, ArrowUpRight, AlertCircle,
} from 'lucide-react';
import { getFmOverview, listJobsForApproval, listFmInvoices } from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

function KpiCard({ label, value, subValue, icon: Icon, accent, to }) {
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${accent || NAVY}10`, color: accent || NAVY,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon size={16} /></div>
        {to && <ArrowUpRight size={14} color={MUTE} />}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
      {subValue != null && (
        <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{subValue}</div>
      )}
    </>
  );
  const style = {
    background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12,
    padding: '16px 18px', display: 'block', textDecoration: 'none', color: INK,
  };
  if (to) return <Link to={to} style={{ ...style, cursor: 'pointer' }}>{body}</Link>;
  return <div style={style}>{body}</div>;
}

function ActionQueueItem({ to, label, primary, secondary, accent }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', borderRadius: 8,
        background: PAPER, border: `1px solid ${LINE}`,
        textDecoration: 'none', color: INK,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${accent}15`, color: accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 900,
      }}>{primary}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
        {secondary && <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{secondary}</div>}
      </div>
      <ArrowUpRight size={14} color={MUTE} />
    </Link>
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
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Overview</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            At-a-glance status across every FM contract — KPIs and the things that need your action.
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading overview…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && kpis && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            <KpiCard
              label="Active contracts"
              value={kpis.activeContracts}
              subValue={kpis.mobilisingContracts ? `${kpis.mobilisingContracts} mobilising` : null}
              icon={FileText} accent={GREEN}
              to="/fm-ops/contracts"
            />
            <KpiCard
              label="Sites in scope"
              value={kpis.siteCount}
              icon={ClipboardList} accent={NAVY}
              to="/fm-ops/sites"
            />
            <KpiCard
              label="Jobs this week"
              value={kpis.jobsThisWeek}
              subValue={kpis.jobsThisWeekValue ? `£${kpis.jobsThisWeekValue.toFixed(0)} value` : null}
              icon={Calendar} accent={NAVY}
              to="/fm-ops/schedule"
            />
            <KpiCard
              label="Awaiting approval"
              value={kpis.pendingApprovals}
              subValue={kpis.pendingApprovalsValue ? `£${kpis.pendingApprovalsValue.toFixed(0)} value` : null}
              icon={CheckCircle2} accent={kpis.pendingApprovals ? ACCENT : MUTE}
              to="/fm-ops/approval"
            />
            <KpiCard
              label="Invoices due"
              value={`£${kpis.invoicesDueValue.toFixed(0)}`}
              subValue={`${kpis.invoicesDueCount} invoice${kpis.invoicesDueCount === 1 ? '' : 's'}`}
              icon={Receipt} accent={kpis.invoicesDueCount ? ACCENT : MUTE}
              to="/fm-ops/accounts"
            />
            <KpiCard
              label="Active sub-contractors"
              value={kpis.activeSubs}
              subValue={kpis.liveListings ? `${kpis.liveListings} live listing${kpis.liveListings === 1 ? '' : 's'}` : null}
              icon={Users} accent={GREEN}
              to="/fm-ops/contractors"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Action queue — pending approvals */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <CheckCircle2 size={14} color={ACCENT} />
                <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>Awaiting your review</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: SUB, background: SOFT, padding: '2px 8px', borderRadius: 999 }}>
                  {kpis.pendingApprovals}
                </span>
                <div style={{ flex: 1 }} />
                <Link to="/fm-ops/approval" style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>See all →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingJobs.length === 0 && (
                  <div style={{ padding: 18, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10, fontSize: 12, color: SUB, textAlign: 'center' }}>
                    Nothing to review — you're up to date.
                  </div>
                )}
                {pendingJobs.map(j => (
                  <ActionQueueItem
                    key={j.id}
                    to="/fm-ops/approval"
                    label={j.site?.name ?? 'Site'}
                    primary={`£${j.price ?? 0}`}
                    secondary={`${j.subName} · ${j.completion_marked_at ? new Date(j.completion_marked_at).toLocaleDateString() : '—'}`}
                    accent={ACCENT}
                  />
                ))}
              </div>
            </div>

            {/* Action queue — invoices */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Receipt size={14} color={NAVY} />
                <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>Invoices to action</div>
                <span style={{ fontSize: 10, fontWeight: 800, color: SUB, background: SOFT, padding: '2px 8px', borderRadius: 999 }}>
                  {kpis.invoicesDueCount}
                </span>
                <div style={{ flex: 1 }} />
                <Link to="/fm-ops/accounts" style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textDecoration: 'none' }}>See all →</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {submittedInvoices.length === 0 && (
                  <div style={{ padding: 18, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10, fontSize: 12, color: SUB, textAlign: 'center' }}>
                    No submitted invoices — subs haven't sent any yet.
                  </div>
                )}
                {submittedInvoices.map(inv => (
                  <ActionQueueItem
                    key={inv.id}
                    to="/fm-ops/accounts"
                    label={inv.siteName ?? inv.reference ?? 'Invoice'}
                    primary={`£${Number(inv.total_value).toFixed(0)}`}
                    secondary={`${inv.subName} · ${inv.service_date ? new Date(inv.service_date).toLocaleDateString() : '—'}`}
                    accent={NAVY}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
