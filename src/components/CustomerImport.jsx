// CustomerImport.jsx — Step-by-step import wizard
// Accepts CSV and Excel (.xlsx/.xls) files. Auto-maps common column names,
// lets user fix mappings, previews data, then bulk-upserts via customersDb.
//
// Steps: source → upload → map columns → preview → done

import { useState, useRef, useCallback } from 'react';
import { X, Upload, ArrowRight, ArrowLeft, Check, AlertCircle, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { upsertCustomer } from '../lib/db/customersDb';

// ─── Cadi fields that imports can fill ────────────────────────────────────────
const CADI_FIELDS = [
  { id: 'name',         label: 'Name',          required: true  },
  { id: 'email',        label: 'Email'                          },
  { id: 'phone',        label: 'Phone'                          },
  { id: 'addressLine1', label: 'Address line 1'                 },
  { id: 'addressLine2', label: 'Address line 2'                 },
  { id: 'town',         label: 'Town / City'                    },
  { id: 'county',       label: 'County'                         },
  { id: 'postcode',     label: 'Postcode'                       },
  { id: 'frequency',    label: 'Frequency'                      },
  { id: 'notes',        label: 'Notes'                          },
  { id: 'tags',         label: 'Tags (comma-separated)'         },
  { id: '__skip',       label: '— Skip this column —'          },
];

// ─── Keyword → Cadi field auto-mapping ────────────────────────────────────────
const KEYWORD_MAP = [
  { field: 'name',         keywords: ['name', 'full name', 'customer', 'client', 'contact'] },
  { field: 'email',        keywords: ['email', 'e-mail', 'mail'] },
  { field: 'phone',        keywords: ['phone', 'mobile', 'tel', 'telephone', 'cell'] },
  { field: 'addressLine1', keywords: ['address 1', 'address1', 'street', 'address line 1', 'line 1', 'addr1', 'addr'] },
  { field: 'addressLine2', keywords: ['address 2', 'address2', 'address line 2', 'line 2', 'addr2'] },
  { field: 'town',         keywords: ['town', 'city', 'suburb'] },
  { field: 'county',       keywords: ['county', 'region', 'state', 'area'] },
  { field: 'postcode',     keywords: ['postcode', 'post code', 'postal', 'zip', 'zipcode'] },
  { field: 'frequency',    keywords: ['frequency', 'schedule', 'recurring', 'recurrence', 'interval'] },
  { field: 'notes',        keywords: ['notes', 'note', 'comments', 'comment', 'description', 'memo'] },
  { field: 'tags',         keywords: ['tags', 'tag', 'labels', 'label', 'category', 'categories'] },
];

function autoMap(header) {
  const lower = header.toLowerCase().trim();
  for (const { field, keywords } of KEYWORD_MAP) {
    if (keywords.some(k => lower === k || lower.includes(k))) return field;
  }
  return '__skip';
}

// ─── Parse file (CSV or Excel) → { headers, rows } ───────────────────────────
function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!raw.length) { resolve({ headers: [], rows: [] }); return; }
        const headers = Object.keys(raw[0]);
        const rows = raw.map(r => {
          const obj = {};
          headers.forEach(h => { obj[h] = String(r[h] ?? '').trim(); });
          return obj;
        }).filter(row => Object.values(row).some(v => v !== ''));
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── Source choices ────────────────────────────────────────────────────────────
const SOURCES = [
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    icon: '📒',
    hint: 'In QuickBooks go to Sales → Customers. Click the export icon (a small spreadsheet icon) in the top-right corner of the customer list. It will download an Excel file — upload that file here.',
  },
  {
    id: 'cleanerplanner',
    name: 'CleanerPlanner',
    icon: '🧹',
    hint: 'Go to Customers → Export → Download CSV. Upload it here.',
  },
  {
    id: 'jobber',
    name: 'Jobber',
    icon: '🔧',
    hint: 'In Jobber go to Clients → click the export icon in the top-right → Export as CSV.',
  },
  {
    id: 'servicem8',
    name: 'ServiceM8',
    icon: '📋',
    hint: 'Go to Clients → More → Export → CSV. Upload that file here.',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    icon: '📊',
    hint: 'In your spreadsheet go to File → Download → Comma-separated values (.csv). Then upload here.',
  },
  {
    id: 'excel',
    name: 'Excel',
    icon: '📗',
    hint: 'Upload your Excel file (.xlsx) directly — no need to convert it first.',
  },
  {
    id: 'other',
    name: 'Another tool',
    icon: '📁',
    hint: 'Export your customers as a CSV or Excel file from your current software, then upload it here. Most tools have an "Export" option under Customers or Contacts.',
  },
];

// ─── Modal shell ──────────────────────────────────────────────────────────────
function ModalShell({ onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="relative overflow-hidden rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.12)] w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
      >
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X size={14} className="text-white" />
        </button>
        <div className="relative flex flex-col overflow-hidden flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Step 1: Pick source ──────────────────────────────────────────────────────
function StepSource({ onSelect }) {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-1">Import customers</p>
        <h2 className="text-xl font-black text-white">Where are your customers now?</h2>
        <p className="text-sm text-[rgba(153,197,255,0.6)] mt-1">Pick your current tool and we'll walk you through the rest.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {SOURCES.map(src => (
          <button
            key={src.id}
            onClick={() => onSelect(src)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.05)] hover:bg-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.3)] transition-all text-left group"
          >
            <span className="text-2xl shrink-0">{src.icon}</span>
            <span className="text-sm font-bold text-white group-hover:text-[#99c5ff] transition-colors">{src.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Upload file ──────────────────────────────────────────────────────
function StepUpload({ source, onBack, onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = useCallback(async (file) => {
    setError(null);
    if (!file) return;
    const name = file.name.toLowerCase();
    const ok = name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls');
    if (!ok) {
      setError('Please upload a CSV or Excel (.xlsx) file.');
      return;
    }
    try {
      const { headers, rows } = await parseFile(file);
      if (rows.length === 0) {
        setError('The file looks empty. Make sure you exported the right sheet.');
        return;
      }
      onParsed({ headers, rows, fileName: file.name });
    } catch {
      setError('Could not read that file. Try exporting again or use a different format.');
    }
  }, [onParsed]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div className="p-6 overflow-y-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-5 transition-colors">
        <ArrowLeft size={12} /> Back
      </button>
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{source.icon}</span>
          <h2 className="text-xl font-black text-white">{source.name}</h2>
        </div>
        <div className="px-4 py-3 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.15)] text-sm text-[rgba(153,197,255,0.75)]">
          {source.hint}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 transition-all ${
          dragging
            ? 'border-[#1f48ff] bg-[rgba(31,72,255,0.12)]'
            : 'border-[rgba(153,197,255,0.2)] hover:border-[rgba(153,197,255,0.4)] hover:bg-[rgba(153,197,255,0.05)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[rgba(31,72,255,0.2)] flex items-center justify-center">
          <Upload size={22} className="text-[#99c5ff]" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">Drop your file here</p>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">CSV or Excel (.xlsx) · click to browse</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Map columns ──────────────────────────────────────────────────────
function StepMap({ headers, rows, onBack, onConfirm }) {
  const [mapping, setMapping] = useState(() => {
    const m = {};
    headers.forEach(h => { m[h] = autoMap(h); });
    return m;
  });
  const [error, setError] = useState(null);

  const hasName = Object.values(mapping).includes('name');

  const handleNext = () => {
    if (!hasName) {
      setError('Please map at least one column to "Name" — that\'s the only required field.');
      return;
    }
    onConfirm(mapping);
  };

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="p-6 border-b border-[rgba(153,197,255,0.1)]">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors">
          <ArrowLeft size={12} /> Back
        </button>
        <h2 className="text-xl font-black text-white">Match your columns</h2>
        <p className="text-sm text-[rgba(153,197,255,0.6)] mt-1">
          We've guessed the mapping below — check it looks right and adjust anything that's off.
        </p>
      </div>

      <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
        {headers.map(header => (
          <div key={header} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="px-3 py-2 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-xs font-mono text-[rgba(153,197,255,0.7)] truncate">
                {header}
              </div>
              {rows[0]?.[header] && (
                <p className="text-[10px] text-[rgba(153,197,255,0.35)] mt-0.5 pl-1 truncate">
                  e.g. {rows[0][header]}
                </p>
              )}
            </div>
            <ArrowRight size={12} className="shrink-0 text-[rgba(153,197,255,0.3)]" />
            <div className="flex-1 relative">
              <select
                value={mapping[header]}
                onChange={e => setMapping(m => ({ ...m, [header]: e.target.value }))}
                className="w-full appearance-none px-3 py-2 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-xs text-white focus:outline-none focus:border-[#1f48ff]/50 pr-7"
              >
                {CADI_FIELDS.map(f => (
                  <option key={f.id} value={f.id} style={{ background: '#05124a' }}>
                    {f.label}{f.required ? ' *' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgba(153,197,255,0.4)] pointer-events-none" />
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 border-t border-[rgba(153,197,255,0.1)]">
        {error && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        <button
          onClick={handleNext}
          className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#1f48ff]/30"
        >
          Preview import <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Build Cadi customer objects from raw rows + mapping ──────────────────────
function buildCustomers(rows, mapping, existingEmails) {
  const customers = [];
  const skipped = [];

  rows.forEach((row, idx) => {
    const c = {};
    Object.entries(mapping).forEach(([csvCol, cadiField]) => {
      if (cadiField === '__skip') return;
      const val = (row[csvCol] ?? '').trim();
      if (val) c[cadiField] = val;
    });

    if (!c.name) { skipped.push({ row: idx + 2, reason: 'No name' }); return; }

    // Normalise tags → array
    if (c.tags && typeof c.tags === 'string') {
      c.tags = c.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else {
      c.tags = [];
    }

    // Duplicate check by email
    const isDupe = c.email && existingEmails.has(c.email.toLowerCase());

    customers.push({ data: c, isDupe });
  });

  return { customers, skipped };
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────
function StepPreview({ rows, mapping, existingEmails, onBack, onImport, importing }) {
  const { customers, skipped } = buildCustomers(rows, mapping, existingEmails);
  const fresh = customers.filter(c => !c.isDupe);
  const dupes = customers.filter(c => c.isDupe);

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="p-6 border-b border-[rgba(153,197,255,0.1)]">
        <button onClick={onBack} disabled={importing} className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors disabled:opacity-40">
          <ArrowLeft size={12} /> Back
        </button>
        <h2 className="text-xl font-black text-white">Ready to import</h2>
        <div className="flex gap-3 mt-3">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-lg font-black text-emerald-400">{fresh.length}</p>
            <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wide mt-0.5">New customers</p>
          </div>
          {dupes.length > 0 && (
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-lg font-black text-amber-400">{dupes.length}</p>
              <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wide mt-0.5">Will update</p>
            </div>
          )}
          {skipped.length > 0 && (
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-lg font-black text-red-400">{skipped.length}</p>
              <p className="text-[10px] text-red-400/70 font-bold uppercase tracking-wide mt-0.5">Skipped</p>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
        {customers.slice(0, 8).map((c, i) => (
          <div
            key={i}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
              c.isDupe
                ? 'bg-amber-500/5 border-amber-500/15'
                : 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.1)]'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-[rgba(31,72,255,0.2)] flex items-center justify-center shrink-0 text-sm font-bold text-[#99c5ff]">
              {c.data.name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{c.data.name}</p>
              <p className="text-[11px] text-[rgba(153,197,255,0.45)] truncate">
                {[c.data.email, c.data.phone, c.data.postcode].filter(Boolean).join(' · ')}
              </p>
            </div>
            {c.isDupe && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                update
              </span>
            )}
          </div>
        ))}
        {customers.length > 8 && (
          <p className="text-xs text-center text-[rgba(153,197,255,0.3)] py-2">
            + {customers.length - 8} more customers
          </p>
        )}
        {dupes.length > 0 && (
          <div className="px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-400/80">
            Customers marked "update" already exist in Cadi (matched by email). We'll update their details with the imported data.
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[rgba(153,197,255,0.1)]">
        <button
          onClick={() => onImport(customers)}
          disabled={importing || customers.length === 0}
          className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#1f48ff]/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Importing…
            </>
          ) : (
            <>
              Import {customers.length} customer{customers.length !== 1 ? 's' : ''}
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────
function StepDone({ imported, onClose }) {
  return (
    <div className="p-8 flex flex-col items-center text-center gap-5">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
        <Check size={28} className="text-emerald-400" />
      </div>
      <div>
        <h2 className="text-2xl font-black text-white">All done!</h2>
        <p className="text-[rgba(153,197,255,0.6)] text-sm mt-2">
          {imported} customer{imported !== 1 ? 's' : ''} {imported !== 1 ? 'have' : 'has'} been added to Cadi.
        </p>
      </div>
      <div className="w-full px-4 py-3.5 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.15)] text-sm text-[rgba(153,197,255,0.7)] text-left space-y-1.5">
        <p className="font-bold text-white text-sm">What's next?</p>
        <p>• View and edit each customer from the Customers page</p>
        <p>• Cadi will automatically suggest upsell and win-back opportunities</p>
        <p>• Add job history to customers to get the most out of AI insights</p>
      </div>
      <button
        onClick={onClose}
        className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-[#1f48ff]/30"
      >
        View my customers
      </button>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function CustomerImport({ onClose, onImported, existingCustomers = [] }) {
  const [step, setStep] = useState('source'); // source | upload | map | preview | done
  const [source, setSource] = useState(null);
  const [csvData, setCsvData] = useState(null); // { headers, rows, fileName }
  const [mapping, setMapping] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importError, setImportError] = useState(null);

  const existingEmails = new Set(
    existingCustomers.map(c => c.email?.toLowerCase()).filter(Boolean)
  );

  const handleImport = async (customers) => {
    setImporting(true);
    setImportError(null);
    let count = 0;
    const failures = [];
    for (const { data } of customers) {
      try {
        await upsertCustomer(data);
        count++;
      } catch (err) {
        console.error('Import row failed:', err?.message, data);
        failures.push(err?.message || 'Unknown error');
      }
    }
    setImporting(false);
    if (count > 0) {
      setImportedCount(count);
      setStep('done');
      onImported?.();
    } else {
      const msg = failures[0] ?? 'Unknown error';
      setImportError(`Import failed: ${msg}`);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      {step === 'source' && (
        <StepSource
          onSelect={(src) => { setSource(src); setStep('upload'); }}
        />
      )}
      {step === 'upload' && (
        <StepUpload
          source={source}
          onBack={() => setStep('source')}
          onParsed={(data) => { setCsvData(data); setStep('map'); }}
        />
      )}
      {step === 'map' && (
        <StepMap
          headers={csvData.headers}
          rows={csvData.rows}
          onBack={() => setStep('upload')}
          onConfirm={(m) => { setMapping(m); setStep('preview'); }}
        />
      )}
      {step === 'preview' && (
        <>
          <StepPreview
            rows={csvData.rows}
            mapping={mapping}
            existingEmails={existingEmails}
            onBack={() => setStep('map')}
            onImport={handleImport}
            importing={importing}
          />
          {importError && (
            <div className="px-6 pb-4">
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {importError}
              </div>
            </div>
          )}
        </>
      )}
      {step === 'done' && (
        <StepDone imported={importedCount} onClose={onClose} />
      )}
    </ModalShell>
  );
}
