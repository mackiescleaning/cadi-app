import { useEffect, useMemo, useState } from 'react';
import { Search, MapPin, ChevronRight, Loader2, ClipboardList, X, Send } from 'lucide-react';
import {
  listFmSites, SITE_STATUS,
  listFmActiveSubs, assignVisitSpec, sendVisitSpecsToMarketplace, publishListings,
  getMyFmOrganisation,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const FREQ_LABEL = {
  weekly: 'Weekly', fortnightly: '2-wk', monthly: 'Mthly',
  quarterly: 'Qtrly', annual: 'Annual', one_off: 'One-off',
};

const SPEC_STATUS_LABEL = {
  unassigned:  { label: 'Unassigned',  color: '#a16207' },
  assigned:    { label: 'Assigned',    color: GREEN     },
  marketplace: { label: 'Marketplace', color: ACCENT    },
  active:      { label: 'Active',      color: NAVY      },
  closed:      { label: 'Closed',      color: MUTE      },
};

function Pill({ map, status }) {
  const m = map[status] || { label: status, color: SUB };
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: m.color,
      background: `${m.color}14`, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap',
    }}>{m.label}</span>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 24, fontWeight: 900, color: accent || INK, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 6 }}>{label}</div>
    </div>
  );
}

function SiteDrawer({ site, subs, fmOrg, onClose, onChanged }) {
  const [busy, setBusy] = useState(new Set());
  const [err, setErr]   = useState(null);
  const markBusy = (specId, on) => setBusy(prev => {
    const n = new Set(prev);
    if (on) n.add(specId); else n.delete(specId);
    return n;
  });

  const handleAssign = async (specId, subUserId) => {
    markBusy(specId, true);
    setErr(null);
    try {
      await assignVisitSpec({ visitSpecId: specId, subUserId });
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { markBusy(specId, false); }
  };

  const handleToMarket = async (spec) => {
    markBusy(spec.id, true);
    setErr(null);
    try {
      await sendVisitSpecsToMarketplace([spec.id]);
      if (fmOrg) {
        await publishListings({
          fmOrganisationId: fmOrg.id,
          visitSpecs: [spec],
          defaults: { visibility: 'open', bid_window_hours: 72, award_rule: 'best_fit' },
        });
      }
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { markBusy(spec.id, false); }
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Pill map={SITE_STATUS} status={site.status} />
              {site.endClientName && (
                <span style={{ fontSize: 10, fontWeight: 700, color: SUB, background: SOFT, padding: '3px 8px', borderRadius: 999 }}>{site.endClientName}</span>
              )}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: INK }}>{site.name}</div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>
              <MapPin size={10} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {site.postcode}{site.address ? ` · ${site.address}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE, padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <Kpi label="Visit specs"     value={site.specs.length} accent={NAVY} />
          <Kpi label="Per-cycle value" value={`£${site.perVisit}`} accent={INK} />
        </div>

        {site.notes && (
          <div style={{ background: SOFT, padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 12, color: '#334155' }}>
            <strong>Notes · </strong>{site.notes}
          </div>
        )}

        {err && (
          <div style={{ padding: 10, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#b91c1c' }}>
            {err}
          </div>
        )}

        <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Visit specs</div>
        {site.specs.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: SUB, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 10 }}>
            This site has no visit specs yet.
          </div>
        )}
        {site.specs.map(s => {
          const assignedSub = subs.find(sub => sub.id === s.assigned_sub_user_id);
          const isBusy = busy.has(s.id);
          const locked = s.status === 'marketplace' || s.status === 'active';
          return (
            <div key={s.id} style={{
              padding: '10px 12px', borderRadius: 8, background: SOFT, marginBottom: 6,
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '70px 1fr 60px 90px',
                gap: 8, alignItems: 'center', marginBottom: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: INK }}>{FREQ_LABEL[s.frequency] ?? s.frequency}</div>
                <div style={{ fontSize: 11, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.scope}</div>
                <div style={{ fontSize: 11, fontWeight: 800 }}>£{s.price_per_visit}</div>
                <Pill map={SPEC_STATUS_LABEL} status={s.status} />
              </div>
              {assignedSub && (
                <div style={{ fontSize: 10, color: SUB, marginBottom: 6 }}>→ {assignedSub.name}</div>
              )}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {isBusy && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite', color: SUB }} />}
                {!isBusy && (
                  <>
                    <select
                      value={s.assigned_sub_user_id ?? ''}
                      onChange={e => handleAssign(s.id, e.target.value || null)}
                      disabled={locked}
                      style={{
                        flex: 1,
                        padding: '5px 8px', fontSize: 11,
                        border: `1px solid ${LINE}`, borderRadius: 6,
                        background: locked ? PAPER : 'white',
                        color: locked ? MUTE : INK,
                        cursor: locked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <option value="">{locked ? '(locked while on marketplace / active)' : 'Assign sub…'}</option>
                      {subs.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}{sub.region ? ` · ${sub.region}` : ''}</option>
                      ))}
                    </select>
                    {!locked && (
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

        {site.contract?.name && (
          <div style={{ marginTop: 14, fontSize: 11, color: SUB }}>
            Contract · <strong style={{ color: INK }}>{site.contract.name}</strong>
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function FmOpsSites() {
  const [sites, setSites] = useState([]);
  const [subs, setSubs] = useState([]);
  const [fmOrg, setFmOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [openSite, setOpenSite] = useState(null);

  const reload = async () => {
    const fresh = await listFmSites();
    setSites(fresh);
    // Keep the drawer in sync with refreshed data so post-assign labels update.
    if (openSite) {
      const next = fresh.find(s => s.id === openSite.id);
      if (next) setOpenSite(next);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [s, subList, org] = await Promise.all([
          listFmSites(),
          listFmActiveSubs(),
          getMyFmOrganisation(),
        ]);
        setSites(s);
        setSubs(subList);
        setFmOrg(org);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return sites;
    const needle = q.trim().toLowerCase();
    return sites.filter(s =>
      s.name?.toLowerCase().includes(needle) ||
      s.postcode?.toLowerCase().includes(needle) ||
      s.endClientName?.toLowerCase().includes(needle),
    );
  }, [sites, q]);

  const kpis = useMemo(() => ({
    total:        sites.length,
    active:       sites.filter(s => s.status === 'active' || s.status === 'assigned').length,
    onMarket:     sites.filter(s => s.status === 'marketplace').length,
    unassigned:   sites.filter(s => s.status === 'unassigned' || s.status === 'no-specs').length,
    pendingApprovals: sites.reduce((a, s) => a + (s.pendingJobs || 0), 0),
  }), [sites]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>Sites / Job Cards</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Master list of every site across your contracts, with current allocation + next visit rolled up.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
        <Kpi label="Total sites"    value={kpis.total}              accent={INK} />
        <Kpi label="Active"         value={kpis.active}             accent={GREEN} />
        <Kpi label="On marketplace" value={kpis.onMarket}           accent={ACCENT} />
        <Kpi label="Unassigned"     value={kpis.unassigned}         accent={kpis.unassigned ? '#a16207' : MUTE} />
        <Kpi label="Pending approval" value={kpis.pendingApprovals} accent={kpis.pendingApprovals ? ACCENT : MUTE} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
          padding: '6px 10px', flex: 1, maxWidth: 360,
        }}>
          <Search size={12} color={MUTE} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search by site, postcode or client…"
            style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12, color: INK, background: 'transparent' }}
          />
        </div>
      </div>

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: SUB, fontWeight: 700 }}>
          <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 8px' }} /> Loading sites…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 18, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: 13 }}>{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ padding: 40, background: PAPER, border: `1.5px dashed ${LINE}`, borderRadius: 14, textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: `${NAVY}10`, color: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <ClipboardList size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: INK, marginBottom: 6 }}>
            {sites.length === 0 ? 'No sites yet' : 'Nothing matches that search'}
          </div>
          <div style={{ fontSize: 12, color: SUB, maxWidth: 400, margin: '0 auto' }}>
            {sites.length === 0
              ? 'Sites land here when you upload them via Contracts → New contract.'
              : 'Try a different search term.'}
          </div>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 2fr 1.4fr 1fr 1fr 1fr 1fr 40px',
            padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
            fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>
            <input type="checkbox" disabled style={{ accentColor: ACCENT }} />
            <div>Site</div>
            <div>Specs</div>
            <div>Per-cycle</div>
            <div>Last visit</div>
            <div>Next visit</div>
            <div>Status</div>
            <div></div>
          </div>
          {filtered.map((s, i) => (
            <div
              key={s.id}
              onClick={() => setOpenSite(s)}
              style={{
                display: 'grid', gridTemplateColumns: '40px 2fr 1.4fr 1fr 1fr 1fr 1fr 40px',
                padding: '12px 16px', borderBottom: i < filtered.length - 1 ? `1px solid ${LINE}` : 'none',
                alignItems: 'center', fontSize: 12, color: INK, cursor: 'pointer',
              }}
            >
              <input type="checkbox" disabled style={{ accentColor: ACCENT }} onClick={e => e.stopPropagation()} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>
                  {s.postcode}{s.endClientName ? ` · ${s.endClientName}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {s.specs.slice(0, 3).map((spec, idx) => (
                  <span key={spec.id ?? idx} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, background: SOFT, color: SUB, fontWeight: 700 }}>
                    {FREQ_LABEL[spec.frequency] ?? spec.frequency}
                  </span>
                ))}
                {s.specs.length === 0 && <span style={{ fontSize: 10, color: MUTE }}>—</span>}
              </div>
              <div style={{ fontWeight: 800 }}>{s.perVisit ? `£${s.perVisit}` : '—'}</div>
              <div style={{ color: SUB }}>{s.lastVisit ? new Date(s.lastVisit).toLocaleDateString() : '—'}</div>
              <div style={{ color: s.nextVisit ? INK : MUTE, fontWeight: s.nextVisit ? 700 : 500 }}>
                {s.nextVisit ? new Date(s.nextVisit).toLocaleDateString() : '—'}
              </div>
              <div><Pill map={SITE_STATUS} status={s.status} /></div>
              <ChevronRight size={14} color={MUTE} />
            </div>
          ))}
        </div>
      )}

      {openSite && (
        <SiteDrawer
          site={openSite}
          subs={subs}
          fmOrg={fmOrg}
          onClose={() => setOpenSite(null)}
          onChanged={reload}
        />
      )}
    </div>
  );
}
