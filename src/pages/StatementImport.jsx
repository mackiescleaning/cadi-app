/**
 * src/pages/StatementImport.jsx
 * Cadi — upload a bank statement into the Money tab (open-banking bridge).
 *
 * Route: /banking/upload
 * Flow:
 *   1. Drop a file (OFX / QFX / QIF / CSV / Excel)
 *   2. CSV/Excel → confirm which columns are date / amount / description
 *   3. Preview (server dry-run: categorised, deduped, matched)
 *   4. Import → rows land in the transactions table, visible on the Money tab
 *
 * This is the manual counterpart to open banking. Same destination, same
 * categorisation and invoice-matching — just without a live bank connection.
 */

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { parseStatementFile, rowsFromMapping } from '../lib/statements/parseStatement';
import { previewStatement, importStatement } from '../lib/db/statementsDb';

const BG = 'min-h-screen bg-gradient-to-br from-[#0a0f1e] via-[#0d1530] to-[#0a1628]';
const CARD = 'mx-auto max-w-lg w-full';

const MAP_FIELDS = [
  { key: 'date', label: 'Date', required: true },
  { key: 'amount', label: 'Amount (signed)', required: false },
  { key: 'paidIn', label: 'Money in', required: false },
  { key: 'paidOut', label: 'Money out', required: false },
  { key: 'merchant', label: 'Paid to / from', required: false },
  { key: 'desc', label: 'Reference', required: false },
  { key: 'category', label: 'Bank category', required: false },
  { key: 'balance', label: 'Balance', required: false },
];

function money(n) {
  const v = Math.abs(n).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? '−' : '+'}£${v}`;
}

export default function StatementImport() {
  const navigate = useNavigate();
  const { canUseOpenBanking } = usePlan();
  const fileRef = useRef(null);

  const [stage, setStage] = useState('drop'); // drop | map | preview | done
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const [tabular, setTabular] = useState(null); // { headers, rows, mapping }
  const [rows, setRows] = useState([]); // normalised rows
  const [preview, setPreview] = useState(null); // { summary, preview }
  const [result, setResult] = useState(null); // { imported, autoMatched, summary }

  async function handleFile(file) {
    if (!file) return;
    setError('');
    setBusy(true);
    setFileName(file.name);
    try {
      const parsed = await parseStatementFile(file);
      if (parsed.kind === 'tabular') {
        setTabular(parsed);
        setStage('map');
      } else {
        if (!parsed.rows.length)
          throw new Error('No transactions found in that file. Try a CSV export instead.');
        setRows(parsed.rows);
        await runPreview(parsed.rows);
      }
    } catch (e) {
      setError(e.message ?? 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function runPreview(theRows) {
    setBusy(true);
    setError('');
    try {
      const data = await previewStatement(theRows);
      setPreview(data);
      setRows(theRows);
      setStage('preview');
    } catch (e) {
      if (e.upgradeRequired) {
        navigate('/upgrade');
        return;
      }
      setError(e.message ?? 'Preview failed.');
    } finally {
      setBusy(false);
    }
  }

  function confirmMapping() {
    if (tabular.mapping.date < 0) {
      setError('Pick which column holds the date.');
      return;
    }
    const hasAmount =
      tabular.mapping.amount >= 0 || tabular.mapping.paidIn >= 0 || tabular.mapping.paidOut >= 0;
    if (!hasAmount) {
      setError('Pick an Amount column, or Money in / Money out columns.');
      return;
    }
    const normalised = rowsFromMapping(tabular.rows, tabular.mapping);
    if (!normalised.length) {
      setError('No usable rows with those columns — check your picks.');
      return;
    }
    runPreview(normalised);
  }

  async function commit() {
    setBusy(true);
    setError('');
    try {
      const data = await importStatement(rows);
      setResult(data);
      setStage('done');
    } catch (e) {
      if (e.upgradeRequired) {
        navigate('/upgrade');
        return;
      }
      setError(e.message ?? 'Import failed.');
    } finally {
      setBusy(false);
    }
  }

  // Paywall — same gate as open banking
  if (!canUseOpenBanking) {
    return (
      <div className={`${BG} flex items-center justify-center p-4`}>
        <div className={`${CARD} bg-white/4 border border-white/10 rounded-2xl p-8 text-center`}>
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[#4f78ff]/15 border border-[#4f78ff]/30 flex items-center justify-center text-2xl">
            📄
          </div>
          <h1 className="text-xl font-black text-white mb-2">Statement import is a Pro feature</h1>
          <p className="text-sm text-white/55 leading-relaxed mb-6">
            Upload a bank statement and Cadi categorises every transaction and matches payments to
            invoices — the same as a live bank feed, no connection needed.
          </p>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full py-3 rounded-xl bg-[#1f48ff] text-white text-sm font-black hover:bg-[#3a5eff] transition-colors"
          >
            See what Pro unlocks — £39/mo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={BG}>
      <div className="px-4 pt-10 pb-16">
        <div className={CARD}>
          <button
            onClick={() => navigate('/money')}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-semibold mb-8 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Money
          </button>

          <div className="mb-6">
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#4f78ff] mb-2">
              Money · Import
            </p>
            <h1 className="text-2xl font-black text-white leading-tight mb-2">
              Upload a bank statement
            </h1>
            <p className="text-white/50 text-sm leading-relaxed">
              No open banking yet? Export a statement from your bank and drop it here. Cadi
              categorises everything and matches payments to invoices — same as a live feed.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* ── Drop ── */}
          {stage === 'drop' && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full rounded-2xl border-2 border-dashed border-white/15 hover:border-[#4f78ff]/50 bg-white/[0.03] hover:bg-white/[0.05] transition-colors py-12 px-4 text-center disabled:opacity-50"
              >
                <div className="text-3xl mb-3">📄</div>
                <p className="text-white font-bold text-sm mb-1">
                  {busy ? 'Reading…' : 'Choose a statement file'}
                </p>
                <p className="text-white/40 text-xs">OFX, QFX, QIF, CSV or Excel</p>
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".ofx,.qfx,.qif,.csv,.xls,.xlsx"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <div className="mt-5 px-4 py-3 rounded-xl bg-white/4 border border-white/8">
                <p className="text-xs text-white/50 leading-relaxed">
                  <span className="text-white/70 font-semibold">Tip:</span> most banks let you
                  download an OFX or QIF file — those import cleanly with no setup. CSV works too;
                  you'll just confirm which columns are which.
                </p>
              </div>
            </>
          )}

          {/* ── Map columns (CSV/Excel) ── */}
          {stage === 'map' && tabular && (
            <>
              <p className="text-white/60 text-sm mb-4">
                From <span className="text-white font-semibold">{fileName}</span> — tell Cadi which
                column is which. Use a signed <span className="text-white/80">Amount</span> column,
                or separate
                <span className="text-white/80"> Money in / Money out</span> columns.
              </p>
              <div className="space-y-3 mb-5">
                {MAP_FIELDS.map((f) => (
                  <div key={f.key} className="flex items-center gap-3">
                    <label className="w-32 shrink-0 text-sm text-white/70 font-semibold">
                      {f.label}
                      {f.required && <span className="text-[#4f78ff]"> *</span>}
                    </label>
                    <select
                      value={tabular.mapping[f.key]}
                      onChange={(e) =>
                        setTabular({
                          ...tabular,
                          mapping: { ...tabular.mapping, [f.key]: Number(e.target.value) },
                        })
                      }
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#4f78ff]/60"
                    >
                      <option value={-1}>— none —</option>
                      {tabular.headers.map((h, i) => (
                        <option key={i} value={i}>
                          {h || `Column ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-white/8 overflow-hidden mb-5">
                <div className="px-3 py-2 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                  First rows ({tabular.rows.length} total)
                </div>
                <div className="max-h-40 overflow-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {tabular.rows.slice(0, 4).map((r, i) => (
                        <tr key={i} className="border-t border-white/5">
                          {tabular.headers.map((_, ci) => (
                            <td
                              key={ci}
                              className="px-2 py-1.5 text-white/50 whitespace-nowrap truncate max-w-[120px]"
                            >
                              {String(r[ci] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStage('drop');
                    setTabular(null);
                    setError('');
                  }}
                  className="px-4 py-3 rounded-xl text-white/50 text-sm font-semibold hover:text-white/80"
                >
                  ← Back
                </button>
                <button
                  onClick={confirmMapping}
                  disabled={busy}
                  className="flex-1 py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-50 text-white font-black text-sm transition-colors"
                >
                  {busy ? 'Checking…' : 'Preview import'}
                </button>
              </div>
            </>
          )}

          {/* ── Preview ── */}
          {stage === 'preview' && preview && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Stat label="New" value={preview.summary.newRows} accent />
                <Stat label="Already imported" value={preview.summary.duplicates} />
                <Stat label="Matched to invoices" value={preview.summary.matched} />
              </div>
              {preview.summary.transfers > 0 && (
                <p className="text-xs text-white/45 mb-4 px-1">
                  ↔ {preview.summary.transfers} internal transfer
                  {preview.summary.transfers === 1 ? '' : 's'} imported but{' '}
                  <span className="text-white/70">excluded from income &amp; expenses</span> (money
                  moved between your own accounts).
                </p>
              )}
              {preview.summary.newRows === 0 ? (
                <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-5">
                  <p className="text-sm text-amber-300">
                    Everything in this file is already in Cadi — nothing new to import.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-white/8 overflow-hidden mb-5">
                  <div className="px-3 py-2 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Sample of what will be imported
                  </div>
                  <div className="max-h-56 overflow-auto divide-y divide-white/5">
                    {preview.preview.map((p, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
                        <div className="min-w-0">
                          <p
                            className={`text-sm truncate ${p.excluded ? 'text-white/45' : 'text-white'}`}
                          >
                            {p.description || 'Transaction'}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {p.date} · {p.excluded ? 'transfer · excluded' : p.category}
                            {p.matched ? ' · matched' : ''}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-bold shrink-0 ${p.excluded ? 'text-white/30' : p.amount < 0 ? 'text-white/70' : 'text-emerald-400'}`}
                        >
                          {money(p.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setStage('drop');
                    setPreview(null);
                    setRows([]);
                    setTabular(null);
                  }}
                  className="px-4 py-3 rounded-xl text-white/50 text-sm font-semibold hover:text-white/80"
                >
                  Start over
                </button>
                <button
                  onClick={commit}
                  disabled={busy || preview.summary.newRows === 0}
                  className="flex-1 py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] disabled:opacity-40 text-white font-black text-sm transition-colors"
                >
                  {busy
                    ? 'Importing…'
                    : `Import ${preview.summary.newRows} transaction${preview.summary.newRows === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {stage === 'done' && result && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-white font-black text-xl mb-2">
                Imported {result.imported} transaction{result.imported === 1 ? '' : 's'}.
              </h2>
              <p className="text-white/50 text-sm mb-6">
                They're on your Money tab now, categorised and ready to review.
                {result.autoMatched > 0 &&
                  ` ${result.autoMatched} payment${result.autoMatched === 1 ? ' was' : 's were'} matched to invoices and marked paid.`}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => navigate('/money')}
                  className="w-full py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors"
                >
                  Go to Money tab
                </button>
                <button
                  onClick={() => {
                    setStage('drop');
                    setResult(null);
                    setPreview(null);
                    setRows([]);
                    setTabular(null);
                    setFileName('');
                  }}
                  className="w-full py-2.5 text-sm text-white/40 hover:text-white/60 font-semibold transition-colors"
                >
                  Upload another statement
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 text-center ${accent ? 'bg-[#4f78ff]/10 border-[#4f78ff]/25' : 'bg-white/4 border-white/8'}`}
    >
      <p className={`text-2xl font-black ${accent ? 'text-[#99c5ff]' : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}
