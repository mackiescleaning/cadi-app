import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Download, X, Loader2, Plus, MapPin, ChevronLeft, ChevronRight,
  AlertCircle, CheckCircle2, Send,
} from 'lucide-react';
import {
  parseCsv,
  createContract,
  listFmActiveSubs,
  getContract,
  assignVisitSpec,
  sendVisitSpecsToMarketplace,
  publishListings,
  getMyFmOrganisation,
  FREQUENCY_OPTIONS,
  WORK_TYPE_OPTIONS,
} from '../../lib/db/fmOpsDb';
import { FM_OPS_TOKENS } from '../../components/fm-ops/FmOpsLayout';

const { NAVY, INK, SUB, MUTE, LINE, PAPER, ACCENT } = FM_OPS_TOKENS;
const SOFT  = '#f1f5f9';
const GREEN = '#16a34a';

const REGION_COLOURS = ['#7c3aed', NAVY, GREEN, '#0891b2', ACCENT, '#db2777', '#0ea5e9'];
const colourFor = (i) => REGION_COLOURS[i % REGION_COLOURS.length];

// ─── Reusable bits ───────────────────────────────────────────────────────────
function Stepper({ step, steps, onStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done   = i < step;
        const colour = done ? GREEN : active ? ACCENT : SUB;
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === steps.length - 1 ? 0 : 1 }}>
            <button onClick={() => onStep(i)} disabled={i > step} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'none', border: 'none',
              cursor: i > step ? 'default' : 'pointer',
              opacity: i > step ? 0.5 : 1,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: active ? colour : done ? `${colour}15` : SOFT,
                border: `1.5px solid ${colour}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 900,
                color: active ? 'white' : colour,
              }}>{done ? '✓' : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: active ? INK : SUB }}>{s}</span>
            </button>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? GREEN : LINE, margin: '0 14px' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</label>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: '100%', padding: '9px 12px', fontSize: 13,
        border: `1px solid ${LINE}`, borderRadius: 8,
        background: PAPER, color: INK, outline: 'none',
        ...(props.style || {}),
      }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      style={{
        width: '100%', padding: '9px 12px', fontSize: 13,
        border: `1px solid ${LINE}`, borderRadius: 8,
        background: PAPER, color: INK, outline: 'none',
        ...(props.style || {}),
      }}
    >
      {props.children}
    </select>
  );
}

// ─── Pick a header from CSV row using common aliases ─────────────────────────
function pickHeader(row, ...keys) {
  for (const k of keys) {
    const v = row[k];
    if (v != null && String(v).trim().length) return String(v).trim();
  }
  return '';
}

function rowToDraft(csvRow) {
  // Map a parsed CSV row → a draft site + N specs.
  // Specs come from columns like spec1/spec2/spec3 OR specification 1/etc.
  const specCells = [
    pickHeader(csvRow, 'spec1', 'specification 1', 'spec_1', 'specification1'),
    pickHeader(csvRow, 'spec2', 'specification 2', 'spec_2', 'specification2'),
    pickHeader(csvRow, 'spec3', 'specification 3', 'spec_3', 'specification3'),
  ].filter(Boolean);

  // If no spec columns, fall back to a single default monthly spec.
  const defaultPrice = parseFloat(pickHeader(csvRow, 'price', 'cost', 'cost per visit', 'cost per clean', 'price_per_visit')) || 0;

  const specs = specCells.length > 0
    ? specCells.map((cell, i) => ({
        frequency: i === 0 ? 'monthly' : i === 1 ? 'quarterly' : 'annual',
        scope: cell,
        access_notes: '',
        duration_minutes: null,
        price_per_visit: i === 0 ? defaultPrice : 0,
      }))
    : [{
        frequency: 'monthly',
        scope: 'Standard clean',
        access_notes: '',
        duration_minutes: null,
        price_per_visit: defaultPrice,
      }];

  return {
    site: {
      name:     pickHeader(csvRow, 'site', 'site name', 'name', 'location', 'dealership', 'car dealership name', 'branch'),
      address:  pickHeader(csvRow, 'address', 'street'),
      postcode: pickHeader(csvRow, 'postcode', 'postal code', 'zip'),
      notes:    pickHeader(csvRow, 'notes', 'note'),
    },
    specs,
  };
}

// ─── STEP 1 — Upload ─────────────────────────────────────────────────────────
function StepUpload({ contract, setContract, rows, setRows, onNext }) {
  const fileRef = useRef(null);
  const [csvText, setCsvText] = useState('');
  const [parseErr, setParseErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setParseErr(null);
    try {
      const txt = await file.text();
      setCsvText(txt);
      const { headers, rows: parsed } = parseCsv(txt);
      if (headers.length === 0 || parsed.length === 0) {
        setParseErr('Could not find any rows. Check the file has a header row.');
        return;
      }
      setRows(parsed.map(rowToDraft));
    } catch (e) {
      setParseErr(e.message || String(e));
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'site,address,postcode,specification 1,specification 2,cost per visit,notes',
      'Stratstone JLR Nottingham,Lenton Lane,NG7 2NR,Monthly in & out hand-height,Quarterly high-level internal,200,Service yard · gate code 4471',
      'Vauxhall Bedford,Cardington Road,MK42 9HG,Monthly in & out hand-height,,45,Front showroom · key holder Mon-Sat',
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cadi-contract-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const addManualRow = () => setRows([...rows, rowToDraft({})]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));
  const updateSite = (i, patch) => {
    setRows(rows.map((r, idx) => idx === i ? { ...r, site: { ...r.site, ...patch } } : r));
  };
  const updateSpec = (i, j, patch) => {
    setRows(rows.map((r, idx) => idx === i
      ? { ...r, specs: r.specs.map((s, sj) => sj === j ? { ...s, ...patch } : s) }
      : r));
  };
  const addSpec = (i) => {
    setRows(rows.map((r, idx) => idx === i
      ? { ...r, specs: [...r.specs, { frequency: 'monthly', scope: '', access_notes: '', duration_minutes: null, price_per_visit: 0 }] }
      : r));
  };
  const removeSpec = (i, j) => {
    setRows(rows.map((r, idx) => idx === i
      ? { ...r, specs: r.specs.length > 1 ? r.specs.filter((_, sj) => sj !== j) : r.specs }
      : r));
  };

  const ready = contract.name.trim() && contract.end_client_name.trim() && rows.length > 0 &&
    rows.every(r => r.site.name.trim() && r.specs.some(s => s.scope.trim()));

  return (
    <>
      {/* Contract metadata */}
      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: INK, marginBottom: 12 }}>Contract details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="FM client / chain">
            <Input
              value={contract.end_client_name}
              onChange={e => setContract({ ...contract, end_client_name: e.target.value })}
              placeholder="e.g. ACERTA"
            />
          </Field>
          <Field label="Contract reference">
            <Input
              value={contract.name}
              onChange={e => setContract({ ...contract, name: e.target.value })}
              placeholder="e.g. ACERTA June 26"
            />
          </Field>
          <Field label="Work type">
            <Select value={contract.work_type} onChange={e => setContract({ ...contract, work_type: e.target.value })}>
              <option value="">— select —</option>
              {WORK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={contract.starts_on}
              onChange={e => setContract({ ...contract, starts_on: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Upload box */}
      {rows.length === 0 && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
            style={{
              background: PAPER, border: `2px dashed ${ACCENT}55`, borderRadius: 14,
              padding: 32, textAlign: 'center', marginBottom: 14, cursor: 'pointer',
            }}
          >
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `${ACCENT}18`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Upload size={20} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: INK, marginBottom: 4 }}>
              Drop the FM's site list (CSV)
            </div>
            <div style={{ fontSize: 11, color: SUB, marginBottom: 10 }}>
              Site · cost per visit · spec 1..3 · notes — any column order, Cadi maps it.
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              style={{
                background: ACCENT, color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              }}
            >
              Choose file
            </button>
            <div style={{ fontSize: 10, color: MUTE, marginTop: 10 }}>
              Or <button type="button" onClick={(e) => { e.stopPropagation(); downloadTemplate(); }} style={{ color: ACCENT, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>download template</button> · or <button type="button" onClick={(e) => { e.stopPropagation(); addManualRow(); }} style={{ color: NAVY, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>add sites manually</button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
          {parseErr && (
            <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#b91c1c' }}>
              {parseErr}
            </div>
          )}
        </>
      )}

      {/* Editable preview */}
      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>
              Sites preview · {rows.length} row{rows.length === 1 ? '' : 's'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={addManualRow} style={{ fontSize: 11, fontWeight: 700, color: SUB, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Plus size={11} /> Add row
              </button>
              <button onClick={() => setRows([])} style={{ fontSize: 11, fontWeight: 700, color: SUB, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}>
                Start over
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 480, overflowY: 'auto', border: `1px solid ${LINE}`, borderRadius: 10, background: PAPER, marginBottom: 14 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ padding: 14, borderBottom: i < rows.length - 1 ? `1px solid ${SOFT}` : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.8fr 30px', gap: 10, marginBottom: 8 }}>
                  <Input
                    value={r.site.name}
                    onChange={e => updateSite(i, { name: e.target.value })}
                    placeholder="Site name"
                  />
                  <Input
                    value={r.site.address}
                    onChange={e => updateSite(i, { address: e.target.value })}
                    placeholder="Address (optional)"
                  />
                  <Input
                    value={r.site.postcode}
                    onChange={e => updateSite(i, { postcode: e.target.value })}
                    placeholder="Postcode"
                  />
                  <button onClick={() => removeRow(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTE }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.specs.map((s, j) => (
                    <div key={j} style={{
                      display: 'grid',
                      gridTemplateColumns: '110px 1fr 90px 30px',
                      gap: 8, alignItems: 'center',
                      padding: '6px 8px', borderRadius: 6, background: SOFT,
                    }}>
                      <Select value={s.frequency} onChange={e => updateSpec(i, j, { frequency: e.target.value })} style={{ padding: '6px 8px' }}>
                        {FREQUENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </Select>
                      <Input
                        value={s.scope}
                        onChange={e => updateSpec(i, j, { scope: e.target.value })}
                        placeholder="Scope — e.g. in & out hand-height"
                        style={{ padding: '6px 10px' }}
                      />
                      <Input
                        type="number" min="0"
                        value={s.price_per_visit}
                        onChange={e => updateSpec(i, j, { price_per_visit: e.target.value })}
                        placeholder="£/visit"
                        style={{ padding: '6px 8px' }}
                      />
                      <button onClick={() => removeSpec(i, j)} disabled={r.specs.length === 1} style={{ background: 'none', border: 'none', cursor: r.specs.length === 1 ? 'default' : 'pointer', color: r.specs.length === 1 ? MUTE : SUB, opacity: r.specs.length === 1 ? 0.4 : 1 }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSpec(i)} style={{
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                    background: 'none', border: `1px dashed ${ACCENT}40`,
                    borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <Plus size={11} /> Add visit spec
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <div />
        <button
          onClick={onNext}
          disabled={!ready}
          style={{
            background: ready ? ACCENT : MUTE, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Continue → allocate sites <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// ─── STEP 2 — Allocate ───────────────────────────────────────────────────────
function StepAllocate({ contractDetail, allocations, setAllocations, onNext, onBack }) {
  const [subs, setSubs] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const rows = await listFmActiveSubs();
        setSubs(rows);
      } finally {
        setLoadingSubs(false);
      }
    })();
  }, []);

  // Group sites by their postcode/region — use the site's notes/postcode prefix
  // or fall back to a single "All sites" bucket.
  const regionMap = useMemo(() => {
    const m = new Map();
    contractDetail.visitSpecs.forEach(vs => {
      const pc = vs.site?.postcode ?? '';
      // crude region: first letters of postcode (NG, MK, W1, etc)
      const region = (pc.match(/^[A-Z]+/i)?.[0] ?? 'Unzoned').toUpperCase();
      if (!m.has(region)) m.set(region, []);
      m.get(region).push(vs);
    });
    return Array.from(m.entries()).map(([region, specs]) => ({ region, specs }));
  }, [contractDetail.visitSpecs]);

  const subsByRegion = useMemo(() => {
    const m = new Map();
    subs.forEach(s => {
      const r = (s.region || 'Unassigned').toUpperCase();
      if (!m.has(r)) m.set(r, []);
      m.get(r).push(s);
    });
    return m;
  }, [subs]);

  const allSpecIds = contractDetail.visitSpecs.map(s => s.id);
  const summary = allSpecIds.reduce((acc, id) => {
    const a = allocations[id];
    if (!a) acc.unassigned++;
    else if (a === '__MARKET__') acc.market++;
    else acc.network++;
    return acc;
  }, { network: 0, market: 0, unassigned: 0 });

  const allRegionToSub = (region, subId, specs) => {
    const next = { ...allocations };
    specs.forEach(s => { next[s.id] = subId; });
    setAllocations(next);
  };

  const ready = summary.unassigned === 0;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
        {[
          { l: 'Total visit specs',  v: allSpecIds.length,   c: INK },
          { l: 'Allocated to network', v: summary.network,  c: GREEN },
          { l: 'To marketplace',     v: summary.market,    c: ACCENT },
          { l: 'Unassigned',         v: summary.unassigned, c: summary.unassigned ? '#a16207' : MUTE },
        ].map(s => (
          <div key={s.l} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: SUB, fontWeight: 700, marginTop: 4 }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>Bulk ·</span>
        <button
          onClick={() => {
            const next = { ...allocations };
            regionMap.forEach(({ region, specs }) => {
              const sub = subsByRegion.get(region)?.[0];
              specs.forEach(s => { if (!next[s.id]) next[s.id] = sub?.id ?? '__MARKET__'; });
            });
            setAllocations(next);
          }}
          style={{ fontSize: 11, fontWeight: 800, color: NAVY, background: `${NAVY}08`, border: `1px solid ${NAVY}25`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
        >
          Auto-allocate by region
        </button>
        <button
          onClick={() => {
            const next = { ...allocations };
            allSpecIds.forEach(id => { if (!next[id]) next[id] = '__MARKET__'; });
            setAllocations(next);
          }}
          style={{ fontSize: 11, fontWeight: 800, color: ACCENT, background: `${ACCENT}08`, border: `1px solid ${ACCENT}30`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
        >
          Send unassigned → marketplace
        </button>
        <button
          onClick={() => {
            const next = {}; allSpecIds.forEach(id => { next[id] = null; });
            setAllocations(next);
          }}
          style={{ fontSize: 11, fontWeight: 700, color: SUB, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer' }}
        >
          Clear all
        </button>
      </div>

      {loadingSubs && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: SUB }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', display: 'block', margin: '0 auto 6px' }} /> Loading your contractor network…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loadingSubs && regionMap.map(({ region, specs }, idx) => {
        const colour = colourFor(idx);
        const regionSubs = subsByRegion.get(region) ?? [];
        return (
          <div key={region} style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              background: `${colour}06`, borderBottom: `1px solid ${colour}20`,
              borderLeft: `4px solid ${colour}`,
            }}>
              <MapPin size={14} color={colour} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: INK }}>{region}</div>
                <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>
                  {specs.length} spec{specs.length === 1 ? '' : 's'} · {regionSubs.length} sub{regionSubs.length === 1 ? '' : 's'} available
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', minHeight: 100 }}>
              {/* Specs */}
              <div style={{ padding: '12px 16px', borderRight: `1px solid ${LINE}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Specs in region</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {specs.map(vs => {
                    const cur = allocations[vs.id];
                    const isMkt = cur === '__MARKET__';
                    const assignedSub = subs.find(s => s.id === cur);
                    return (
                      <div key={vs.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8,
                        background: isMkt ? `${ACCENT}06` : assignedSub ? `${GREEN}06` : '#fafbff',
                        border: `1px solid ${isMkt ? `${ACCENT}25` : assignedSub ? `${GREEN}25` : LINE}`,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vs.site?.name ?? 'Site'}</div>
                          <div style={{ fontSize: 9, color: MUTE, marginTop: 1 }}>
                            {vs.site?.postcode ?? ''} · {vs.frequency} · £{vs.price_per_visit}/visit
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {cur ? (
                            <>
                              <span style={{
                                fontSize: 10, fontWeight: 800,
                                color: isMkt ? ACCENT : GREEN,
                                background: isMkt ? `${ACCENT}15` : `${GREEN}15`,
                                padding: '3px 8px', borderRadius: 999,
                              }}>
                                {isMkt ? '→ Marketplace' : `→ ${assignedSub?.name ?? cur}`}
                              </span>
                              <button onClick={() => setAllocations({ ...allocations, [vs.id]: null })} style={{
                                fontSize: 11, color: MUTE, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                              }}>✕</button>
                            </>
                          ) : (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#a16207', background: '#fef3c7', padding: '3px 8px', borderRadius: 999 }}>
                              unassigned
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Sub picker */}
              <div style={{ padding: '12px 16px', background: '#fafbff' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Allocate to · {regionSubs.length ? 'subs in this region' : 'no subs — marketplace only'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {regionSubs.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => allRegionToSub(region, sub.id, specs)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', borderRadius: 8,
                        background: PAPER, border: `1px solid ${LINE}`,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ width: 26, height: 26, borderRadius: 6, background: `${colour}15`, color: colour, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>
                        {(sub.name?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.name}</div>
                        <div style={{ fontSize: 9, color: SUB, marginTop: 1 }}>Score {sub.score ?? '—'} · cap {sub.capacity ?? '—'}</div>
                      </div>
                      <ChevronRight size={11} color={MUTE} />
                    </button>
                  ))}
                  <button
                    onClick={() => allRegionToSub(region, '__MARKET__', specs)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 8,
                      background: `${ACCENT}06`, border: `1px dashed ${ACCENT}40`,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Send size={11} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT }}>Send region to marketplace</div>
                      <div style={{ fontSize: 9, color: SUB, marginTop: 1 }}>Open to any verified sub in region</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button onClick={onBack} style={{
          background: PAPER, color: SUB, border: `1px solid ${LINE}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <ChevronLeft size={13} /> Back to upload
        </button>
        <button
          onClick={onNext}
          disabled={!ready}
          style={{
            background: ready ? ACCENT : MUTE, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          Continue → marketplace listings <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// ─── STEP 3 — Publish ────────────────────────────────────────────────────────
function StepPublish({ contractDetail, allocations, defaults, setDefaults, onPublish, onBack, busy }) {
  const marketSpecs = contractDetail.visitSpecs.filter(vs => allocations[vs.id] === '__MARKET__');
  const networkSpecs = contractDetail.visitSpecs.filter(vs => {
    const a = allocations[vs.id]; return a && a !== '__MARKET__';
  });
  return (
    <>
      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: INK, marginBottom: 4 }}>
          {marketSpecs.length} spec{marketSpecs.length === 1 ? '' : 's'} going to marketplace · {networkSpecs.length} pre-allocated
        </div>
        <div style={{ fontSize: 12, color: SUB }}>
          Set how listings are exposed to the network. Direct-allocated specs skip this step — they're already with the sub.
        </div>
      </div>

      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Listing defaults · apply to all</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { k: 'visibility', l: 'Visibility', opts: [
              { v: 'elite',    l: 'Elite (≥93)' },
              { v: 'verified', l: 'Verified (≥80)' },
              { v: 'eligible', l: 'Eligible (≥70)' },
              { v: 'open',     l: 'Any score' },
            ]},
            { k: 'bid_window_hours', l: 'Bid window', opts: [
              { v: 24,  l: '24h' },
              { v: 72,  l: '72h' },
              { v: 168, l: '7 days' },
            ]},
            { k: 'award_rule', l: 'Award rule', opts: [
              { v: 'lowest_price', l: 'Lowest bid' },
              { v: 'best_fit',     l: 'Best fit (auto)' },
              { v: 'manual',       l: 'Manual' },
            ]},
          ].map(g => (
            <div key={g.k}>
              <div style={{ fontSize: 10, color: SUB, fontWeight: 700, marginBottom: 6 }}>{g.l}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.opts.map(o => {
                  const active = defaults[g.k] === o.v;
                  return (
                    <button key={o.v} onClick={() => setDefaults({ ...defaults, [g.k]: o.v })} style={{
                      fontSize: 11, padding: '6px 10px', borderRadius: 6,
                      border: `1px solid ${active ? ACCENT : LINE}`,
                      background: active ? `${ACCENT}10` : PAPER,
                      color: active ? ACCENT : INK,
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer', textAlign: 'left',
                    }}>{o.l}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: PAPER, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
          padding: '10px 16px', background: SOFT, borderBottom: `1px solid ${LINE}`,
          fontSize: 10, fontWeight: 800, color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>
          <div>Listing</div><div>Target price</div><div>Visibility</div><div>Bid window</div>
        </div>
        {marketSpecs.length === 0 && (
          <div style={{ padding: 18, fontSize: 12, color: SUB }}>
            No specs going to marketplace — everything was allocated to your network. Click Publish to activate the contract.
          </div>
        )}
        {marketSpecs.map((vs, i) => (
          <div key={vs.id} style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
            padding: '12px 16px', borderBottom: i < marketSpecs.length - 1 ? `1px solid ${LINE}` : 'none',
            alignItems: 'center', fontSize: 12,
          }}>
            <div>
              <div style={{ fontWeight: 800, color: INK }}>{vs.site?.name ?? 'Site'}</div>
              <div style={{ fontSize: 10, color: MUTE, marginTop: 2 }}>{vs.frequency} · {vs.scope}</div>
            </div>
            <div style={{ fontWeight: 800, color: INK }}>£{vs.price_per_visit}</div>
            <span style={{ fontSize: 10, fontWeight: 800, color: ACCENT, background: `${ACCENT}10`, padding: '3px 8px', borderRadius: 999, alignSelf: 'flex-start' }}>
              {defaults.visibility === 'open' ? 'Open' : defaults.visibility[0].toUpperCase() + defaults.visibility.slice(1)}
            </span>
            <span style={{ color: SUB }}>{defaults.bid_window_hours}h</span>
          </div>
        ))}
      </div>

      <div style={{ background: `${ACCENT}06`, border: `1px solid ${ACCENT}25`, borderRadius: 10, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertCircle size={16} color={ACCENT} />
        <div style={{ flex: 1, fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
          <strong>Listings appear instantly</strong> in matched subs' Cadi Connect tabs. Pre-allocated specs land in the assigned sub's My Jobs.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button onClick={onBack} disabled={busy} style={{
          background: PAPER, color: SUB, border: `1px solid ${LINE}`,
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700,
          cursor: busy ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <ChevronLeft size={13} /> Back to allocate
        </button>
        <button
          onClick={onPublish}
          disabled={busy}
          style={{
            background: GREEN, color: 'white', border: 'none',
            borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 800,
            cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {busy && <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />}
          Publish &amp; activate contract ✓
        </button>
      </div>
    </>
  );
}

// ─── Page wrapper ────────────────────────────────────────────────────────────
export default function FmOpsContractNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [contract, setContract] = useState({
    name: '', end_client_name: '', work_type: '', starts_on: '', billing_terms: '',
  });
  const [rows, setRows] = useState([]); // [{ site, specs[] }]
  const [contractDetail, setContractDetail] = useState(null);
  const [allocations, setAllocations] = useState({});  // visitSpecId → subUserId | '__MARKET__' | null
  const [defaults, setDefaults] = useState({ visibility: 'open', bid_window_hours: 72, award_rule: 'best_fit' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fmOrg, setFmOrg] = useState(null);

  useEffect(() => {
    getMyFmOrganisation().then(setFmOrg).catch(e => setError(e.message));
  }, []);

  const STEPS = ['Upload site list', 'Allocate to network', 'Marketplace listings'];

  const goToAllocate = async () => {
    setBusy(true); setError(null);
    try {
      const { contractId } = await createContract({
        fmOrganisationId: fmOrg.id,
        contract,
        rows,
      });
      const detail = await getContract(contractId);
      setContractDetail(detail);
      // initial allocations: anything already assigned stays; rest start null
      const init = {};
      detail.visitSpecs.forEach(vs => {
        init[vs.id] = vs.assigned_sub_user_id ?? null;
      });
      setAllocations(init);
      setStep(1);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const goToPublish = () => {
    setError(null);
    setStep(2);
  };

  const publish = async () => {
    setBusy(true); setError(null);
    try {
      // 1. Push allocations
      const networkUpdates = Object.entries(allocations)
        .filter(([_, v]) => v && v !== '__MARKET__');
      for (const [visitSpecId, subUserId] of networkUpdates) {
        await assignVisitSpec({ visitSpecId, subUserId });
      }

      const marketIds = Object.entries(allocations)
        .filter(([_, v]) => v === '__MARKET__')
        .map(([k]) => k);

      if (marketIds.length > 0) {
        await sendVisitSpecsToMarketplace(marketIds);
        const marketSpecs = contractDetail.visitSpecs.filter(vs => marketIds.includes(vs.id));
        await publishListings({
          fmOrganisationId: fmOrg.id,
          visitSpecs: marketSpecs,
          defaults,
        });
      }

      navigate(`/fm-ops/contracts/${contractDetail.id}`);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${LINE}`,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, color: INK, letterSpacing: '-0.01em' }}>New contract</div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>
            Upload the FM's site list, allocate to your network, publish the rest to marketplace.
          </div>
        </div>
        <button
          onClick={() => navigate('/fm-ops/contracts')}
          style={{
            background: PAPER, color: SUB, border: `1px solid ${LINE}`,
            borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>

      <Stepper step={step} steps={STEPS} onStep={(i) => i <= step && setStep(i)} />

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {step === 0 && (
        <StepUpload
          contract={contract}
          setContract={setContract}
          rows={rows}
          setRows={setRows}
          onNext={goToAllocate}
        />
      )}
      {step === 1 && contractDetail && (
        <StepAllocate
          contractDetail={contractDetail}
          allocations={allocations}
          setAllocations={setAllocations}
          onNext={goToPublish}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && contractDetail && (
        <StepPublish
          contractDetail={contractDetail}
          allocations={allocations}
          defaults={defaults}
          setDefaults={setDefaults}
          onPublish={publish}
          onBack={() => setStep(1)}
          busy={busy}
        />
      )}

      {busy && step === 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: PAPER, padding: '20px 28px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: INK }}>
            <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating contract…
            <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
    </div>
  );
}
