import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronLeft, MapPin, Send, Loader2,
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
import {
  blueCanvas, glassDark, ghostButton, ON_DARK, FM_POP as POP,
} from '../../lib/connectTheme';

// Status → bright accents for the dark canvas.
const CONTRACT_POP = {
  mobilising: POP.amber,
  active:     POP.green,
  paused:     'rgba(255,255,255,0.55)',
  closed:     'rgba(255,255,255,0.40)',
};
const SPEC_STATUS = {
  unassigned:  { label: 'Unassigned',     pop: POP.amber  },
  assigned:    { label: 'Assigned',       pop: POP.green  },
  marketplace: { label: 'On marketplace', pop: POP.orange },
  active:      { label: 'Active',         pop: POP.blue   },
  closed:      { label: 'Closed',         pop: 'rgba(255,255,255,0.40)' },
};

function Pill({ label, pop }) {
  const hex = pop.startsWith('#');
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: pop,
      background: hex ? `${pop}1f` : 'rgba(255,255,255,0.08)',
      border: `1px solid ${hex ? `${pop}42` : 'rgba(255,255,255,0.16)'}`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function MetaChip({ children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: ON_DARK.secondary,
      background: 'rgba(255,255,255,0.08)', border: `1px solid ${ON_DARK.line}`,
      padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Kpi({ label, value, pop }) {
  return (
    <div style={{ ...glassDark({ radius: 14, padding: '14px 16px' }) }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: pop || ON_DARK.primary, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 7 }}>{label}</div>
    </div>
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

  const canvas = { ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' };
  const backBtn = (
    <button onClick={() => navigate('/fm-ops/contracts')} style={{
      ...ghostButton({ size: 'sm', onDark: true }),
      display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 18,
    }}>
      <ChevronLeft size={12} /> Contracts
    </button>
  );

  if (loading) {
    return (
      <div style={canvas}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: 60, textAlign: 'center', fontSize: 12, color: ON_DARK.muted, fontWeight: 700 }}>
          <Loader2 size={20} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 10px' }} /> Loading contract…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div style={canvas}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          {backBtn}
          <div style={{
            padding: 18, borderRadius: 14, fontSize: 13,
            background: 'rgba(220,38,38,0.16)', border: '1px solid rgba(248,113,113,0.40)', color: '#fecaca',
          }}>
            {error || 'Contract not found.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={canvas}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        {backBtn}

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 22, gap: 16, flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Pill
                label={(CONTRACT_STATUS[contract.status] || { label: contract.status }).label}
                pop={CONTRACT_POP[contract.status] || 'rgba(255,255,255,0.55)'}
              />
              {contract.end_client?.name && <MetaChip>{contract.end_client.name}</MetaChip>}
              {contract.work_type && <MetaChip>{contract.work_type}</MetaChip>}
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: ON_DARK.primary, letterSpacing: '-0.02em', margin: 0 }}>{contract.name}</h1>
            <div style={{ fontSize: 12, color: ON_DARK.muted, marginTop: 6 }}>
              {contract.starts_on ? `Started ${new Date(contract.starts_on).toLocaleDateString()}` : 'No start date'} · created {new Date(contract.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 22 }}>
          <Kpi label="Sites in scope"   value={summary.siteCount} />
          <Kpi label="Visit specs"      value={summary.specCount} />
          <Kpi label="Assigned to subs" value={summary.assigned}   pop={POP.green}  />
          <Kpi label="On marketplace"   value={summary.market}     pop={POP.orange} />
          <Kpi label="Per-cycle value"  value={`£${summary.totalValue}`} pop={POP.blue} />
        </div>

        {/* Sites + specs */}
        {grouped.length === 0 && (
          <div style={{ padding: 34, borderRadius: 18, border: '1.5px dashed rgba(255,255,255,0.16)', textAlign: 'center', fontSize: 13, color: ON_DARK.muted }}>
            This contract has no sites yet.
          </div>
        )}

        {grouped.map(({ site, specs }) => (
          <div key={site?.id ?? 'no-site'} style={{ ...glassDark({ radius: 18 }), marginBottom: 14, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 18px',
              background: 'rgba(79,120,255,0.10)', borderBottom: `1px solid ${ON_DARK.line}`,
            }}>
              <MapPin size={14} color={POP.blue} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {site?.name ?? 'Untitled site'}
                </div>
                <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                  {[site?.postcode, site?.address].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </div>
            <div style={{ padding: 12 }}>
              {specs.map((s, i) => {
                const assignedSub = subs.find(x => x.id === s.assigned_sub_user_id);
                const busy = busyIds.has(s.id);
                const onMarket = s.status === 'marketplace';
                return (
                  <div key={s.id} style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr 1fr 1.4fr',
                    gap: 10, alignItems: 'center',
                    padding: '11px 13px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${ON_DARK.line}`,
                    marginBottom: i < specs.length - 1 ? 7 : 0,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary }}>{s.frequency} · {s.scope}</div>
                      {s.access_notes && <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 3 }}>{s.access_notes}</div>}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: ON_DARK.primary }}>£{s.price_per_visit}</div>
                    <div>
                      <Pill
                        label={(SPEC_STATUS[s.status] || { label: s.status }).label}
                        pop={(SPEC_STATUS[s.status] || { pop: 'rgba(255,255,255,0.55)' }).pop}
                      />
                      {assignedSub && (
                        <div style={{ fontSize: 10, color: ON_DARK.secondary, marginTop: 4 }}>→ {assignedSub.name}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {busy && <Loader2 size={13} color={ON_DARK.secondary} style={{ animation: 'spin 0.8s linear infinite' }} />}
                      {!busy && (
                        <>
                          <select
                            value={s.assigned_sub_user_id ?? ''}
                            onChange={e => handleAssign(s.id, e.target.value || null)}
                            disabled={onMarket}
                            style={{
                              padding: '6px 9px', fontSize: 11, fontWeight: 600,
                              border: `1px solid ${onMarket ? ON_DARK.line : ON_DARK.lineHi}`,
                              borderRadius: 8,
                              background: 'rgba(255,255,255,0.10)',
                              color: onMarket ? ON_DARK.faint : ON_DARK.primary,
                              cursor: onMarket ? 'not-allowed' : 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="" style={{ color: '#010a4f' }}>Assign sub…</option>
                            {subs.map(sub => (
                              <option key={sub.id} value={sub.id} style={{ color: '#010a4f' }}>
                                {sub.name}{sub.region ? ` · ${sub.region}` : ''}
                              </option>
                            ))}
                          </select>
                          {!onMarket && (
                            <button
                              onClick={() => handleToMarket(s)}
                              style={{
                                fontSize: 11, fontWeight: 700,
                                background: 'rgba(251,146,60,0.14)', color: POP.orange,
                                border: '1px solid rgba(251,146,60,0.35)', borderRadius: 8,
                                padding: '6px 10px', cursor: 'pointer',
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
    </div>
  );
}
