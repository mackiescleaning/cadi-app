import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  Upload,
  X,
  Loader2,
  Plus,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Send,
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
import {
  blueCanvas,
  glassDark,
  primaryButton,
  greenButton,
  ghostButton,
  ON_DARK,
  FM_POP as POP,
} from '../../lib/connectTheme';

// Region accent rotation — bright tones tuned for the dark canvas.
const REGION_COLOURS = [
  '#a78bfa',
  POP.blue,
  POP.green,
  '#22d3ee',
  POP.orange,
  '#f472b6',
  '#38bdf8',
];
const colourFor = (i) => REGION_COLOURS[i % REGION_COLOURS.length];

const CARD_LINE = ON_DARK.line;

// ─── Reusable bits ───────────────────────────────────────────────────────────
function Stepper({ step, steps, onStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 26 }}>
      {steps.map((s, i) => {
        const active = i === step;
        const done = i < step;
        const colour = done ? POP.green : active ? POP.orange : ON_DARK.muted;
        return (
          <div
            key={s}
            style={{ display: 'flex', alignItems: 'center', flex: i === steps.length - 1 ? 0 : 1 }}
          >
            <button
              onClick={() => onStep(i)}
              disabled={i > step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                cursor: i > step ? 'default' : 'pointer',
                opacity: i > step ? 0.45 : 1,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  background: active ? colour : done ? `${POP.green}1f` : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${colour}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 900,
                  color: active ? '#01062a' : colour,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  color: active ? ON_DARK.primary : ON_DARK.muted,
                  whiteSpace: 'nowrap',
                }}
              >
                {s}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? 'rgba(52,211,153,0.5)' : CARD_LINE,
                  margin: '0 14px',
                }}
              />
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
      <label
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: ON_DARK.muted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div style={{ marginTop: 5 }}>{children}</div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  border: `1px solid ${ON_DARK.lineHi}`,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.08)',
  color: ON_DARK.primary,
  outline: 'none',
  colorScheme: 'dark',
};

function Input(props) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />;
}

function Select(props) {
  return (
    <select {...props} style={{ ...inputStyle, cursor: 'pointer', ...(props.style || {}) }}>
      {props.children}
    </select>
  );
}

// ─── Pick a header from CSV row using common aliases ─────────────────────────
// Normalises both the row's own keys and the searched aliases to lowercase +
// trimmed, so headers like "Car Dealership Name" or " Cost Per Clean" match
// aliases like "car dealership name" / "cost per clean" without the operator
// having to clean the source file by hand.
function pickHeader(row, ...keys) {
  // Build a one-shot normalised lookup table for the row's own keys.
  const norm = {};
  for (const rk of Object.keys(row || {})) {
    norm[String(rk).trim().toLowerCase()] = row[rk];
  }
  for (const k of keys) {
    const v = norm[String(k).trim().toLowerCase()];
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
  const defaultPrice =
    parseFloat(
      pickHeader(csvRow, 'price', 'cost', 'cost per visit', 'cost per clean', 'price_per_visit')
    ) || 0;

  const specs =
    specCells.length > 0
      ? specCells.map((cell, i) => ({
          frequency: i === 0 ? 'monthly' : i === 1 ? 'quarterly' : 'annual',
          scope: cell,
          access_notes: '',
          duration_minutes: null,
          price_per_visit: i === 0 ? defaultPrice : 0,
        }))
      : [
          {
            frequency: 'monthly',
            scope: 'Standard clean',
            access_notes: '',
            duration_minutes: null,
            price_per_visit: defaultPrice,
          },
        ];

  return {
    site: {
      name: pickHeader(
        csvRow,
        'site',
        'site name',
        'name',
        'location',
        'dealership',
        'car dealership name',
        'branch'
      ),
      address: pickHeader(csvRow, 'address', 'street'),
      postcode: pickHeader(csvRow, 'postcode', 'postal code', 'zip'),
      notes: pickHeader(csvRow, 'notes', 'note'),
    },
    specs,
  };
}

// ─── STEP 1 — Upload ─────────────────────────────────────────────────────────
function StepUpload({ contract, setContract, rows, setRows, onNext }) {
  const fileRef = useRef(null);
  const [, setCsvText] = useState('');
  const [parseErr, setParseErr] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setParseErr(null);
    try {
      const name = (file.name || '').toLowerCase();
      const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
      let headers = [];
      let parsed = [];

      if (isExcel) {
        // Read the workbook → take the first sheet → first row is the header.
        // Empty rows are skipped so trailing blank rows in the spreadsheet
        // don't produce zero-site drafts.
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
          raw: true,
          blankrows: false,
        });
        if (aoa.length < 2) {
          setParseErr(
            'Spreadsheet has no data rows (just a header row, or empty). Add at least one site row.'
          );
          return;
        }
        headers = aoa[0].map((h) => String(h ?? '').trim());
        parsed = aoa
          .slice(1)
          .map((r) => {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = r[i] != null ? r[i] : '';
            });
            return obj;
          })
          .filter((r) => Object.values(r).some((v) => String(v).trim().length));
        setCsvText(`(parsed from ${file.name})`);
      } else {
        const txt = await file.text();
        setCsvText(txt);
        const parsedCsv = parseCsv(txt);
        headers = parsedCsv.headers;
        parsed = parsedCsv.rows;
      }

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
    setRows(rows.map((r, idx) => (idx === i ? { ...r, site: { ...r.site, ...patch } } : r)));
  };
  const updateSpec = (i, j, patch) => {
    setRows(
      rows.map((r, idx) =>
        idx === i ? { ...r, specs: r.specs.map((s, sj) => (sj === j ? { ...s, ...patch } : s)) } : r
      )
    );
  };
  const addSpec = (i) => {
    setRows(
      rows.map((r, idx) =>
        idx === i
          ? {
              ...r,
              specs: [
                ...r.specs,
                {
                  frequency: 'monthly',
                  scope: '',
                  access_notes: '',
                  duration_minutes: null,
                  price_per_visit: 0,
                },
              ],
            }
          : r
      )
    );
  };
  const removeSpec = (i, j) => {
    setRows(
      rows.map((r, idx) =>
        idx === i
          ? { ...r, specs: r.specs.length > 1 ? r.specs.filter((_, sj) => sj !== j) : r.specs }
          : r
      )
    );
  };

  const ready =
    contract.name.trim() &&
    contract.end_client_name.trim() &&
    rows.length > 0 &&
    rows.every((r) => r.site.name.trim() && r.specs.some((s) => s.scope.trim()));

  return (
    <>
      {/* Contract metadata */}
      <div style={{ ...glassDark({ radius: 18, padding: 20 }), marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary, marginBottom: 14 }}>
          Contract details
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="FM client / chain">
            <Input
              value={contract.end_client_name}
              onChange={(e) => setContract({ ...contract, end_client_name: e.target.value })}
              placeholder="e.g. ACERTA"
            />
          </Field>
          <Field label="Contract reference">
            <Input
              value={contract.name}
              onChange={(e) => setContract({ ...contract, name: e.target.value })}
              placeholder="e.g. ACERTA June 26"
            />
          </Field>
          <Field label="Work type">
            <Select
              value={contract.work_type}
              onChange={(e) => setContract({ ...contract, work_type: e.target.value })}
            >
              <option value="" style={{ color: '#010a4f' }}>
                — select —
              </option>
              {WORK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} style={{ color: '#010a4f' }}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={contract.starts_on}
              onChange={(e) => setContract({ ...contract, starts_on: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Upload box */}
      {rows.length === 0 && (
        <>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files?.[0]);
            }}
            style={{
              ...glassDark({ radius: 18 }),
              border: '2px dashed rgba(251,146,60,0.45)',
              padding: 34,
              textAlign: 'center',
              marginBottom: 14,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 13,
                background: 'rgba(251,146,60,0.16)',
                color: POP.orange,
                border: '1px solid rgba(251,146,60,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <Upload size={20} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: ON_DARK.primary, marginBottom: 4 }}>
              Drop the FM's site list (CSV or Excel)
            </div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, marginBottom: 12 }}>
              Site · cost per visit · spec 1..3 · notes — any column order, Cadi maps it.
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileRef.current?.click();
              }}
              style={{ ...primaryButton({ size: 'sm' }) }}
            >
              Choose file
            </button>
            <div style={{ fontSize: 10, color: ON_DARK.faint, marginTop: 12 }}>
              Or{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadTemplate();
                }}
                style={{
                  color: POP.orange,
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                download template
              </button>{' '}
              · or{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addManualRow();
                }}
                style={{
                  color: POP.blue,
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                add sites manually
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            style={{ display: 'none' }}
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {parseErr && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                marginBottom: 14,
                fontSize: 12,
                background: 'rgba(220,38,38,0.16)',
                border: '1px solid rgba(248,113,113,0.40)',
                color: '#fecaca',
              }}
            >
              {parseErr}
            </div>
          )}
        </>
      )}

      {/* Editable preview */}
      {rows.length > 0 && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary }}>
              Sites preview · {rows.length} row{rows.length === 1 ? '' : 's'}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={addManualRow}
                style={{
                  ...ghostButton({ size: 'sm', onDark: true }),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                }}
              >
                <Plus size={11} /> Add row
              </button>
              <button
                onClick={() => setRows([])}
                style={{ ...ghostButton({ size: 'sm', onDark: true }), fontSize: 11 }}
              >
                Start over
              </button>
            </div>
          </div>
          <div
            style={{
              ...glassDark({ radius: 16 }),
              maxHeight: 480,
              overflowY: 'auto',
              marginBottom: 14,
            }}
          >
            {rows.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  borderBottom: i < rows.length - 1 ? `1px solid ${CARD_LINE}` : 'none',
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 1fr 0.8fr 30px',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Input
                    value={r.site.name}
                    onChange={(e) => updateSite(i, { name: e.target.value })}
                    placeholder="Site name"
                  />
                  <Input
                    value={r.site.address}
                    onChange={(e) => updateSite(i, { address: e.target.value })}
                    placeholder="Address (optional)"
                  />
                  <Input
                    value={r.site.postcode}
                    onChange={(e) => updateSite(i, { postcode: e.target.value })}
                    placeholder="Postcode"
                  />
                  <button
                    onClick={() => removeRow(i)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: ON_DARK.faint,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.specs.map((s, j) => (
                    <div
                      key={j}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '110px 1fr 90px 30px',
                        gap: 8,
                        alignItems: 'center',
                        padding: '7px 9px',
                        borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)',
                        border: `1px solid ${CARD_LINE}`,
                      }}
                    >
                      <Select
                        value={s.frequency}
                        onChange={(e) => updateSpec(i, j, { frequency: e.target.value })}
                        style={{ padding: '6px 8px', fontSize: 11 }}
                      >
                        {FREQUENCY_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value} style={{ color: '#010a4f' }}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Input
                        value={s.scope}
                        onChange={(e) => updateSpec(i, j, { scope: e.target.value })}
                        placeholder="Scope — e.g. in & out hand-height"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                      />
                      <Input
                        type="number"
                        min="0"
                        value={s.price_per_visit}
                        onChange={(e) => updateSpec(i, j, { price_per_visit: e.target.value })}
                        placeholder="£/visit"
                        style={{ padding: '6px 8px', fontSize: 12 }}
                      />
                      <button
                        onClick={() => removeSpec(i, j)}
                        disabled={r.specs.length === 1}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: r.specs.length === 1 ? 'default' : 'pointer',
                          color: ON_DARK.faint,
                          opacity: r.specs.length === 1 ? 0.4 : 1,
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addSpec(i)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: POP.orange,
                      background: 'none',
                      border: '1px dashed rgba(251,146,60,0.40)',
                      borderRadius: 8,
                      padding: '5px 10px',
                      cursor: 'pointer',
                      alignSelf: 'flex-start',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
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
            ...primaryButton(),
            opacity: ready ? 1 : 0.45,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
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
    contractDetail.visitSpecs.forEach((vs) => {
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
    subs.forEach((s) => {
      const r = (s.region || 'Unassigned').toUpperCase();
      if (!m.has(r)) m.set(r, []);
      m.get(r).push(s);
    });
    return m;
  }, [subs]);

  const allSpecIds = contractDetail.visitSpecs.map((s) => s.id);
  const summary = allSpecIds.reduce(
    (acc, id) => {
      const a = allocations[id];
      if (!a) acc.unassigned++;
      else if (a === '__MARKET__') acc.market++;
      else acc.network++;
      return acc;
    },
    { network: 0, market: 0, unassigned: 0 }
  );

  const allRegionToSub = (region, subId, specs) => {
    const next = { ...allocations };
    specs.forEach((s) => {
      next[s.id] = subId;
    });
    setAllocations(next);
  };

  const ready = summary.unassigned === 0;

  return (
    <>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}
      >
        {[
          { l: 'Total visit specs', v: allSpecIds.length, c: ON_DARK.primary },
          { l: 'Allocated to network', v: summary.network, c: POP.green },
          { l: 'To marketplace', v: summary.market, c: POP.orange },
          {
            l: 'Unassigned',
            v: summary.unassigned,
            c: summary.unassigned ? POP.amber : ON_DARK.faint,
          },
        ].map((s) => (
          <div key={s.l} style={{ ...glassDark({ radius: 14, padding: '13px 15px' }) }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700, marginTop: 6 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: 11, color: ON_DARK.muted, fontWeight: 700 }}>Bulk ·</span>
        <button
          onClick={() => {
            const next = { ...allocations };
            regionMap.forEach(({ region, specs }) => {
              const sub = subsByRegion.get(region)?.[0];
              specs.forEach((s) => {
                if (!next[s.id]) next[s.id] = sub?.id ?? '__MARKET__';
              });
            });
            setAllocations(next);
          }}
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: POP.blue,
            background: 'rgba(79,120,255,0.14)',
            border: '1px solid rgba(79,120,255,0.35)',
            borderRadius: 9,
            padding: '6px 11px',
            cursor: 'pointer',
          }}
        >
          Auto-allocate by region
        </button>
        <button
          onClick={() => {
            const next = { ...allocations };
            allSpecIds.forEach((id) => {
              if (!next[id]) next[id] = '__MARKET__';
            });
            setAllocations(next);
          }}
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: POP.orange,
            background: 'rgba(251,146,60,0.12)',
            border: '1px solid rgba(251,146,60,0.35)',
            borderRadius: 9,
            padding: '6px 11px',
            cursor: 'pointer',
          }}
        >
          Send unassigned → marketplace
        </button>
        <button
          onClick={() => {
            const next = {};
            allSpecIds.forEach((id) => {
              next[id] = null;
            });
            setAllocations(next);
          }}
          style={{
            ...ghostButton({ size: 'sm', onDark: true }),
            fontSize: 11,
            padding: '6px 11px',
          }}
        >
          Clear all
        </button>
      </div>

      {loadingSubs && (
        <div style={{ padding: 24, textAlign: 'center', fontSize: 11, color: ON_DARK.muted }}>
          <Loader2
            size={16}
            color={ON_DARK.secondary}
            style={{
              animation: 'spin 0.8s linear infinite',
              display: 'block',
              margin: '0 auto 6px',
            }}
          />{' '}
          Loading your contractor network…
          <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loadingSubs &&
        regionMap.map(({ region, specs }, idx) => {
          const colour = colourFor(idx);
          const regionSubs = subsByRegion.get(region) ?? [];
          return (
            <div
              key={region}
              style={{ ...glassDark({ radius: 18 }), marginBottom: 14, overflow: 'hidden' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  background: `${colour}14`,
                  borderBottom: `1px solid ${CARD_LINE}`,
                  borderLeft: `4px solid ${colour}`,
                }}
              >
                <MapPin size={14} color={colour} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary }}>
                    {region}
                  </div>
                  <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                    {specs.length} spec{specs.length === 1 ? '' : 's'} · {regionSubs.length} sub
                    {regionSubs.length === 1 ? '' : 's'} available
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', minHeight: 100 }}>
                {/* Specs */}
                <div style={{ padding: '12px 16px', borderRight: `1px solid ${CARD_LINE}` }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: ON_DARK.muted,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Specs in region
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {specs.map((vs) => {
                      const cur = allocations[vs.id];
                      const isMkt = cur === '__MARKET__';
                      const assignedSub = subs.find((s) => s.id === cur);
                      return (
                        <div
                          key={vs.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: isMkt
                              ? 'rgba(251,146,60,0.10)'
                              : assignedSub
                                ? 'rgba(52,211,153,0.10)'
                                : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${isMkt ? 'rgba(251,146,60,0.30)' : assignedSub ? 'rgba(52,211,153,0.30)' : CARD_LINE}`,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                color: ON_DARK.primary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {vs.site?.name ?? 'Site'}
                            </div>
                            <div style={{ fontSize: 9, color: ON_DARK.muted, marginTop: 2 }}>
                              {vs.site?.postcode ?? ''} · {vs.frequency} · £{vs.price_per_visit}
                              /visit
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {cur ? (
                              <>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: isMkt ? POP.orange : POP.green,
                                    background: isMkt
                                      ? 'rgba(251,146,60,0.16)'
                                      : 'rgba(52,211,153,0.16)',
                                    border: `1px solid ${isMkt ? 'rgba(251,146,60,0.35)' : 'rgba(52,211,153,0.35)'}`,
                                    padding: '3px 8px',
                                    borderRadius: 999,
                                  }}
                                >
                                  {isMkt ? '→ Marketplace' : `→ ${assignedSub?.name ?? cur}`}
                                </span>
                                <button
                                  onClick={() => setAllocations({ ...allocations, [vs.id]: null })}
                                  style={{
                                    fontSize: 11,
                                    color: ON_DARK.faint,
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '2px 4px',
                                  }}
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: POP.amber,
                                  background: 'rgba(251,191,36,0.14)',
                                  border: '1px solid rgba(251,191,36,0.30)',
                                  padding: '3px 8px',
                                  borderRadius: 999,
                                }}
                              >
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
                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)' }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: ON_DARK.muted,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Allocate to ·{' '}
                    {regionSubs.length ? 'subs in this region' : 'no subs — marketplace only'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {regionSubs.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => allRegionToSub(region, sub.id, specs)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 10px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.06)',
                          border: `1px solid ${ON_DARK.lineHi}`,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 7,
                            background: `${colour}22`,
                            color: colour,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontWeight: 900,
                          }}
                        >
                          {(sub.name?.[0] ?? '?').toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              color: ON_DARK.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {sub.name}
                          </div>
                          <div style={{ fontSize: 9, color: ON_DARK.muted, marginTop: 2 }}>
                            Score {sub.score ?? '—'} · cap {sub.capacity ?? '—'}
                          </div>
                        </div>
                        <ChevronRight size={11} color={ON_DARK.faint} />
                      </button>
                    ))}
                    <button
                      onClick={() => allRegionToSub(region, '__MARKET__', specs)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 10,
                        background: 'rgba(251,146,60,0.08)',
                        border: '1px dashed rgba(251,146,60,0.40)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 7,
                          background: 'rgba(251,146,60,0.16)',
                          color: POP.orange,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Send size={11} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: POP.orange }}>
                          Send region to marketplace
                        </div>
                        <div style={{ fontSize: 9, color: ON_DARK.muted, marginTop: 2 }}>
                          Open to any verified sub in region
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            ...ghostButton({ onDark: true }),
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <ChevronLeft size={13} /> Back to upload
        </button>
        <button
          onClick={onNext}
          disabled={!ready}
          style={{
            ...primaryButton(),
            opacity: ready ? 1 : 0.45,
            cursor: ready ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          Continue → marketplace listings <ChevronRight size={13} />
        </button>
      </div>
    </>
  );
}

// ─── STEP 3 — Publish ────────────────────────────────────────────────────────
function StepPublish({
  contractDetail,
  allocations,
  defaults,
  setDefaults,
  onPublish,
  onBack,
  busy,
}) {
  const marketSpecs = contractDetail.visitSpecs.filter((vs) => allocations[vs.id] === '__MARKET__');
  const networkSpecs = contractDetail.visitSpecs.filter((vs) => {
    const a = allocations[vs.id];
    return a && a !== '__MARKET__';
  });
  return (
    <>
      <div style={{ ...glassDark({ radius: 16, padding: 18 }), marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: ON_DARK.primary, marginBottom: 5 }}>
          {marketSpecs.length} spec{marketSpecs.length === 1 ? '' : 's'} going to marketplace ·{' '}
          {networkSpecs.length} pre-allocated
        </div>
        <div style={{ fontSize: 12, color: ON_DARK.secondary }}>
          Set how listings are exposed to the network. Direct-allocated specs skip this step —
          they're already with the sub.
        </div>
      </div>

      <div style={{ ...glassDark({ radius: 16, padding: 18 }), marginBottom: 16 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: ON_DARK.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Listing defaults · apply to all
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            {
              k: 'visibility',
              l: 'Visibility',
              opts: [
                { v: 'elite', l: 'Elite (≥93)' },
                { v: 'verified', l: 'Verified (≥80)' },
                { v: 'eligible', l: 'Eligible (≥70)' },
                { v: 'open', l: 'Any score' },
              ],
            },
            {
              k: 'bid_window_hours',
              l: 'Bid window',
              opts: [
                { v: 24, l: '24h' },
                { v: 72, l: '72h' },
                { v: 168, l: '7 days' },
              ],
            },
            {
              k: 'award_rule',
              l: 'Award rule',
              opts: [
                { v: 'lowest_price', l: 'Lowest bid' },
                { v: 'best_fit', l: 'Best fit (auto)' },
                { v: 'manual', l: 'Manual' },
              ],
            },
          ].map((g) => (
            <div key={g.k}>
              <div style={{ fontSize: 10, color: ON_DARK.muted, fontWeight: 700, marginBottom: 6 }}>
                {g.l}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.opts.map((o) => {
                  const active = defaults[g.k] === o.v;
                  return (
                    <button
                      key={o.v}
                      onClick={() => setDefaults({ ...defaults, [g.k]: o.v })}
                      style={{
                        fontSize: 11,
                        padding: '7px 11px',
                        borderRadius: 9,
                        border: `1px solid ${active ? 'rgba(251,146,60,0.45)' : CARD_LINE}`,
                        background: active ? 'rgba(251,146,60,0.14)' : 'rgba(255,255,255,0.04)',
                        color: active ? POP.orange : ON_DARK.secondary,
                        fontWeight: active ? 800 : 600,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 150ms ease, border-color 150ms ease',
                      }}
                    >
                      {o.l}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...glassDark({ radius: 16 }), overflow: 'hidden', marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
            padding: '10px 18px',
            background: 'rgba(255,255,255,0.04)',
            borderBottom: `1px solid ${CARD_LINE}`,
            fontSize: 10,
            fontWeight: 800,
            color: ON_DARK.muted,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <div>Listing</div>
          <div>Target price</div>
          <div>Visibility</div>
          <div>Bid window</div>
        </div>
        {marketSpecs.length === 0 && (
          <div style={{ padding: 18, fontSize: 12, color: ON_DARK.muted }}>
            No specs going to marketplace — everything was allocated to your network. Click Publish
            to activate the contract.
          </div>
        )}
        {marketSpecs.map((vs, i) => (
          <div
            key={vs.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 1fr',
              padding: '12px 18px',
              borderBottom: i < marketSpecs.length - 1 ? `1px solid ${CARD_LINE}` : 'none',
              alignItems: 'center',
              fontSize: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: ON_DARK.primary }}>
                {vs.site?.name ?? 'Site'}
              </div>
              <div style={{ fontSize: 10, color: ON_DARK.muted, marginTop: 2 }}>
                {vs.frequency} · {vs.scope}
              </div>
            </div>
            <div style={{ fontWeight: 800, color: ON_DARK.primary }}>£{vs.price_per_visit}</div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: POP.orange,
                background: 'rgba(251,146,60,0.14)',
                border: '1px solid rgba(251,146,60,0.35)',
                padding: '3px 8px',
                borderRadius: 999,
                justifySelf: 'start',
              }}
            >
              {defaults.visibility === 'open'
                ? 'Open'
                : defaults.visibility[0].toUpperCase() + defaults.visibility.slice(1)}
            </span>
            <span style={{ color: ON_DARK.secondary }}>{defaults.bid_window_hours}h</span>
          </div>
        ))}
      </div>

      <div
        style={{
          background: 'rgba(79,120,255,0.10)',
          border: '1px solid rgba(79,120,255,0.30)',
          borderRadius: 14,
          padding: 14,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AlertCircle size={16} color={POP.blue} />
        <div style={{ flex: 1, fontSize: 11, color: ON_DARK.secondary, lineHeight: 1.5 }}>
          <strong style={{ color: ON_DARK.primary }}>Listings appear instantly</strong> in matched
          subs' Cadi Connect tabs. Pre-allocated specs land in the assigned sub's My Jobs.
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 20 }}>
        <button
          onClick={onBack}
          disabled={busy}
          style={{
            ...ghostButton({ onDark: true }),
            cursor: busy ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <ChevronLeft size={13} /> Back to allocate
        </button>
        <button
          onClick={onPublish}
          disabled={busy}
          style={{
            ...greenButton(),
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
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
    name: '',
    end_client_name: '',
    work_type: '',
    starts_on: '',
    billing_terms: '',
  });
  const [rows, setRows] = useState([]); // [{ site, specs[] }]
  const [contractDetail, setContractDetail] = useState(null);
  const [allocations, setAllocations] = useState({}); // visitSpecId → subUserId | '__MARKET__' | null
  const [defaults, setDefaults] = useState({
    visibility: 'open',
    bid_window_hours: 72,
    award_rule: 'best_fit',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fmOrg, setFmOrg] = useState(null);

  useEffect(() => {
    getMyFmOrganisation()
      .then(setFmOrg)
      .catch((e) => setError(e.message));
  }, []);

  const STEPS = ['Upload site list', 'Allocate to network', 'Marketplace listings'];

  const goToAllocate = async () => {
    setBusy(true);
    setError(null);
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
      detail.visitSpecs.forEach((vs) => {
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
    setBusy(true);
    setError(null);
    try {
      // 1. Push allocations
      const networkUpdates = Object.entries(allocations).filter(
        ([_, v]) => v && v !== '__MARKET__'
      );
      for (const [visitSpecId, subUserId] of networkUpdates) {
        await assignVisitSpec({ visitSpecId, subUserId });
      }

      const marketIds = Object.entries(allocations)
        .filter(([_, v]) => v === '__MARKET__')
        .map(([k]) => k);

      if (marketIds.length > 0) {
        await sendVisitSpecsToMarketplace(marketIds);
        const marketSpecs = contractDetail.visitSpecs.filter((vs) => marketIds.includes(vs.id));
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
    <div style={{ ...blueCanvas(), margin: '-28px -32px', padding: '34px 36px 56px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: ON_DARK.muted,
                marginBottom: 8,
              }}
            >
              FM Operations · Contracts
            </div>
            <h1
              style={{
                fontSize: 26,
                fontWeight: 900,
                color: ON_DARK.primary,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              New <span style={{ color: POP.blue }}>contract</span>
            </h1>
            <div style={{ fontSize: 12.5, color: ON_DARK.secondary, marginTop: 6 }}>
              Upload the FM's site list, allocate to your network, publish the rest to marketplace.
            </div>
          </div>
          <button
            onClick={() => navigate('/fm-ops/contracts')}
            style={{ ...ghostButton({ size: 'sm', onDark: true }) }}
          >
            Cancel
          </button>
        </div>

        <Stepper step={step} steps={STEPS} onStep={(i) => i <= step && setStep(i)} />

        {error && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              marginBottom: 14,
              fontSize: 12,
              background: 'rgba(220,38,38,0.16)',
              border: '1px solid rgba(248,113,113,0.40)',
              color: '#fecaca',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
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
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(1,4,25,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100,
            }}
          >
            <div
              style={{
                ...glassDark({ radius: 18, padding: '20px 28px', strong: true }),
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: 14,
                fontWeight: 700,
                color: ON_DARK.primary,
              }}
            >
              <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> Creating
              contract…
              <style>{`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}</style>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
