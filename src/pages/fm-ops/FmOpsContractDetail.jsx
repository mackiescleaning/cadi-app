import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, MapPin, Send, Loader2, AlertCircle, Users, Plus,
} from 'lucide-react';
import {
  getContract,
  listFmActiveSubs,
  assignVisitSpec,
  sendVisitSpecsToMarketplace,
  publishListings,
  getMyFmOrganisation,
  CONTRACT_STATUS,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const SPEC_STATUS = {
  unassigned:  { label: 'Unassigned',  color: '#a16207' },
  assigned:    { label: 'Assigned',    color: GREEN     },
  marketplace: { label: 'On marketplace', color: ACCENT },
  active:      { label: 'Active',      color: NAVY      },
  closed:      { label: 'Closed',      color: MUTE      },
};

function Kpi({ label, value, accent }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function StatusPill({ status, map }) {
  const m = map[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

export default function FmOpsContractDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState(null);
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyIds, setBusyIds] = useState(new Set());
  const [fmOrg, setFmOrg] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [c, s, org] = await Promise.all([
        getContract(id),
        listFmActiveSubs(),
        getMyFmOrganisation(),
      ]);
      setContract(c);
      setSubs(s);
      setFmOrg(org);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const markBusy = (specId, busy) => {
    setBusyIds(prev => {
      const next = new Set(prev);
      if (busy) next.add(specId); else next.delete(specId);
      return next;
    });
  };

  const handleAssign = async (specId, subUserId) => {
    markBusy(specId, true);
    try {
      await assignVisitSpec({ visitSpecId: specId, subUserId });
      await load();
    } catch (e) { setError(e.message); }
    finally { markBusy(specId, false); }
  };

  const handleToMarket = async (spec) => {
    markBusy(spec.id, true);
    try {
      await sendVisitSpecsToMarketplace([spec.id]);
      if (fmOrg) {
        await publishListings({
          fmOrganisationId: fmOrg.id,
          visitSpecs: [spec],
          defaults: { visibility: 'open', bid_window_hours: 72, award_rule: 'best_fit' },
        });
      }
      await load();
    } catch (e) { setError(e.message); }
    finally { markBusy(spec.id, false); }
  };

  const grouped = useMemo(() => {
    if (!contract) return [];
    const m = new Map();
    contract.visitSpecs.forEach(vs => {
      const sid = vs.site?.id ?? '__no_site__';
      if (!m.has(sid)) m.set(sid, { site: vs.site, specs: [] });
      m.get(sid).specs.push(vs);
    });
    return Array.from(m.values());
  }, [contract]);

  const summary = useMemo(() => {
    if (!contract) return null;
    const specs = contract.visitSpecs;
    return {
      siteCount:  grouped.length,
      specCount:  specs.length,
      assigned:   specs.filter(s => s.status === 'assigned' || s.status === 'active').length,
      market:     specs.filter(s => s.status === 'marketplace').length,
      unassigned: specs.filter(s => s.status === 'unassigned').length,
      totalValue: specs.reduce((a, s) => a + (Number(s.price_per_visit) || 0), 0),
    };
  }, [contract, grouped]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
        <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading contract…
        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div>
        <button onClick={() => navigate('/fm-ops/contracts')} style={{ background: PAPER, color: SUB, border: `1px solid ${LINE}`, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14 }}>
          <ChevronLeft size={12} /> Contracts
        </button>
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>
          {error || 'Contract not found.'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate('/fm-ops/contracts')} style={{
        background: PAPER, color: SUB, border: `1px solid ${LINE}`,
        borderRadius: 8, padding: '7px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 14,
      }}>
        <ChevronLeft size={12} /> Contracts
      </button>

      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`, gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <StatusPill status={contract.status} map={CONTRACT_STATUS} />
            {contract.end_client?.name && (
              <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: SOFT, padding: '3px 8px', borderRadius: 999 }}>
                {contract.end_client.name}
              </span>
            )}
            {contract.work_type && (
              <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: SOFT, padding: '3px 8px', borderRadius: 999 }}>
                {contract.work_type}
              </span>
            )}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>{contract.name}</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            {contract.starts_on ? `Started ${new Date(contract.starts_on).toLocaleDateString()}` : 'No start date'} · created {new Date(contract.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="Sites in scope"   value={summary.siteCount}  accent={INK}    />
        <Kpi label="Visit specs"      value={summary.specCount}  accent={INK}    />
        <Kpi label="Assigned to subs" value={summary.assigned}   accent={GREEN}  />
        <Kpi label="On marketplace"   value={summary.market}     accent={ACCENT} />
        <Kpi label="Per-cycle value"  value={`£${summary.totalValue}`} accent={NAVY} />
      </div>

      {/* Sites + specs */}
      {grouped.length === 0 && (
        <div style={{ padding: 30, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 12, textAlign: 'center', fontSize: 13, color: SUB }}>
          This contract has no sites yet.
        </div>
      )}

      {grouped.map(({ site, specs }) => (
        <div key={site?.id ?? 'no-site'} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px',
            background: `${NAVY}05`, borderBottom: `1px solid ${LINE}`,
          }}>
            <MapPin size={14} color={NAVY} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {site?.name ?? 'Untitled site'}
              </div>
              <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
                {[site?.postcode, site?.address].filter(Boolean).join(' · ') || '—'}
              </div>
            </div>
          </div>
          <div style={{ padding: 12 }}>
            {specs.map((s, i) => {
              const assignedSub = subs.find(x => x.id === s.assigned_sub_user_id);
              const busy = busyIds.has(s.id);
              return (
                <div key={s.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr 1fr 1.4fr',
                  gap: 10, alignItems: 'center',
                  padding: '10px 12px', borderRadius: 8,
                  background: SOFT, marginBottom: i < specs.length - 1 ? 6 : 0,
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>{s.frequency} · {s.scope}</div>
                    {s.access_notes && <div style={{ fontSize: 10, color: SUB, marginTop: 2 }}>{s.access_notes}</div>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: INK }}>£{s.price_per_visit}</div>
                  <div>
                    <StatusPill status={s.status} map={SPEC_STATUS} />
                    {assignedSub && (
                      <div style={{ fontSize: 10, color: SUB, marginTop: 3 }}>→ {assignedSub.name}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {busy && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite', color: SUB }} />}
                    {!busy && (
                      <>
                        <select
                          value={s.assigned_sub_user_id ?? ''}
                          onChange={e => handleAssign(s.id, e.target.value || null)}
                          disabled={s.status === 'marketplace'}
                          style={{
                            padding: '5px 8px', fontSize: 11,
                            border: `1px solid ${LINE}`, borderRadius: 6,
                            background: s.status === 'marketplace' ? SOFT : PAPER,
                            color: s.status === 'marketplace' ? MUTE : INK,
                            cursor: s.status === 'marketplace' ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="">Assign sub…</option>
                          {subs.map(sub => (
                            <option key={sub.id} value={sub.id}>{sub.name}{sub.region ? ` · ${sub.region}` : ''}</option>
                          ))}
                        </select>
                        {s.status !== 'marketplace' && (
                          <button
                            onClick={() => handleToMarket(s)}
                            style={{
                              fontSize: 11, fontWeight: 700,
                              background: `${ACCENT}10`, color: ACCENT,
                              border: `1px solid ${ACCENT}30`, borderRadius: 6,
                              padding: '5px 9px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            <Send size={11} /> Market
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
