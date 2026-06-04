// CustomerImport.jsx — Step-by-step import wizard
// Accepts CSV and Excel (.xlsx/.xls) files. Auto-maps common column names,
// lets user fix mappings, previews data, then bulk-upserts via customersDb.
//
// Steps: source → upload → map columns → preview → done

import { useState, useRef, useCallback } from 'react';
import { X, Upload, ArrowRight, ArrowLeft, Check, AlertCircle, ChevronDown, Crown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { upsertCustomer } from '../lib/db/customersDb';
import { bulkInsertRounds, deleteRoundsForCustomer } from '../lib/db/customerRoundsDb';
import { bulkCreateJobs } from '../lib/db/jobsDb';
import { supabase } from '../lib/supabase';
import { usePlan } from '../hooks/usePlan';

const LITE_CAP = 30;

// ─── Cadi fields that imports can fill ────────────────────────────────────────
const CADI_FIELDS = [
  { id: 'name',              label: 'Name',                  required: true  },
  { id: 'email',             label: 'Email'                                  },
  { id: 'phone',             label: 'Phone'                                  },
  { id: 'addressLine1',      label: 'Address line 1'                         },
  { id: 'addressLine2',      label: 'Address line 2'                         },
  { id: 'town',              label: 'Town / City'                            },
  { id: 'county',            label: 'County'                                 },
  { id: 'postcode',          label: 'Postcode'                               },
  { id: 'frequency',         label: 'Frequency'                              },
  { id: 'notes',             label: 'Notes'                                  },
  { id: 'tags',              label: 'Tags (comma-separated)'                 },
  // CleanerPlanner / Squeegee fields
  { id: 'dueDate',           label: 'Due date'                               },
  { id: 'jobReference',      label: 'Job reference'                          },
  { id: 'customerReference', label: 'Customer reference'                     },
  { id: 'schedule',          label: 'Schedule'                               },
  { id: 'customerBalance',   label: 'Customer balance (£)'                   },
  { id: 'pricePerVisit',     label: 'Price per visit (£)'                    },
  { id: 'roundName',         label: 'Round'                                  },
  { id: 'accountStatus',     label: 'Status (active/suspended/cancelled)'    },
  { id: '__skip',            label: '— Skip this column —'                  },
];

// ─── Keyword → Cadi field auto-mapping ────────────────────────────────────────
const KEYWORD_MAP = [
  { field: 'name',              keywords: ['name', 'full name', 'customer', 'client', 'contact'] },
  { field: 'email',             keywords: ['email', 'e-mail', 'mail'] },
  { field: 'phone',             keywords: ['phone', 'mobile', 'tel', 'telephone', 'cell'] },
  { field: 'addressLine1',      keywords: ['address 1', 'address1', 'street', 'address line 1', 'line 1', 'addr1', 'addr'] },
  { field: 'addressLine2',      keywords: ['address 2', 'address2', 'address line 2', 'line 2', 'addr2'] },
  { field: 'town',              keywords: ['town', 'city', 'suburb'] },
  { field: 'county',            keywords: ['county', 'region', 'state', 'area'] },
  { field: 'postcode',          keywords: ['postcode', 'post code', 'postal', 'zip', 'zipcode'] },
  { field: 'frequency',         keywords: ['frequency', 'recurring', 'recurrence', 'interval'] },
  { field: 'notes',             keywords: ['notes', 'note', 'comments', 'comment', 'description', 'memo'] },
  { field: 'tags',              keywords: ['tags', 'tag', 'labels', 'label', 'category', 'categories'] },
  // CleanerPlanner / Squeegee specific
  { field: 'dueDate',           keywords: ['due date', 'due', 'next due', 'next visit', 'date due', 'duedate'] },
  { field: 'jobReference',      keywords: ['job ref', 'job reference', 'job no', 'job number', 'jobref', 'job id'] },
  { field: 'customerReference', keywords: ['customer ref', 'customer reference', 'cust ref', 'account ref', 'account number', 'acc ref', 'ref'] },
  { field: 'schedule',          keywords: ['schedule', 'cleaning schedule', 'service schedule', 'visit schedule'] },
  { field: 'customerBalance',   keywords: ['balance', 'customer balance', 'outstanding', 'amount due', 'account balance', 'balance due'] },
  { field: 'pricePerVisit',     keywords: ['price', 'cost', 'charge', 'amount', 'price per visit', 'job price', 'visit price', 'fee'] },
  { field: 'roundName',         keywords: ['round', 'round name', 'route', 'route name', 'rounds', 'area round'] },
  { field: 'accountStatus',     keywords: ['status', 'account status', 'active', 'state', 'customer status'] },
];

function autoMap(header) {
  const lower = header.toLowerCase().trim();
  for (const { field, keywords } of KEYWORD_MAP) {
    if (keywords.some(k => lower === k || lower.includes(k))) return field;
  }
  return '__skip';
}

// ─── CleanerPlanner Jobs format detection + parsing ───────────────────────────
function isCleanerPlannerJobs(headers) {
  const lower = headers.map(h => h.toLowerCase().trim());
  return lower.includes('cust ref') && lower.includes('round') && lower.includes('job ref');
}

function parseCurrency(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.toLowerCase() === 'quote' || s === '') return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

function parseCleanerDate(val) {
  if (!val) return null;

  // Already a JS Date object (XLSX parses Excel date cells as Date objects)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }

  const s = String(val).trim();
  if (!s || s === '-' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'overdue') return null;

  // ISO: YYYY-MM-DD (already normalised)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Excel serial number (e.g. 46983 — days since 1900-01-01)
  if (/^\d{5}$/.test(s)) {
    const serial = Number(s);
    // Excel epoch: Dec 31 1899 (with Lotus leap-year bug offset 1)
    const d = new Date(Date.UTC(1899, 11, 31) + serial * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or DD/MM/YY
  const slash = s.split('/');
  if (slash.length === 3) {
    const [d, m, y] = slash;
    const year = y.length === 2 ? `20${y}` : y;
    const result = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  }

  // DD-MM-YYYY or DD-MM-YY (dash separated, day first)
  const dash = s.split('-');
  if (dash.length === 3 && dash[0].length <= 2 && isNaN(Number(dash[1])) === false) {
    const [d, m, y] = dash;
    const year = y.length === 2 ? `20${y}` : y;
    const result = `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(result)) return result;
  }

  // D MMM YYYY or DD MMM YY  (e.g. "1 Jun 2026", "01 Jun 26", "1st Jun 2026")
  const named = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})[a-z]*[\s,]+(\d{2,4})$/i);
  if (named) {
    const d  = named[1];
    const m  = MONTH_MAP[named[2].toLowerCase()];
    const yr = named[3].length === 2 ? `20${named[3]}` : named[3];
    if (m) return `${yr}-${String(m).padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Fallback: let JS Date try to parse it (handles "Thu Jun 05 2026 00:00:00 GMT+…")
  const js = new Date(s);
  if (!isNaN(js.getTime())) return js.toISOString().slice(0, 10);

  return null;
}

// Returns { entries: [{customer, rounds, isDupe}], skipped }
// One entry per unique Cust Ref. Each entry has its customer data + all its rounds.
function buildCleanerPlannerData(rows, existingCustRefs = new Set()) {
  const customerMap = new Map(); // dedupKey → { customer, rounds, isDupe }
  const skipped = [];

  rows.forEach((row, idx) => {
    const get = (col) => (row[col] ?? '').toString().trim();

    const custRef   = get('Cust Ref');
    const rawName   = get('Name');
    const address   = get('Address Line 1');
    const name      = rawName || address; // address fallback for unnamed rows
    const status    = get('Status').toLowerCase();
    const cancelled = get('Cancelled');

    if (!name) { skipped.push({ row: idx + 2, reason: 'No name or address' }); return; }
    if (status === 'quote') { skipped.push({ row: idx + 2, reason: 'Quote — skipped' }); return; }

    const dedupKey = custRef || `${name}::${address}`.toLowerCase();

    const accountStatus = cancelled
      ? 'cancelled'
      : status.includes('suspend') ? 'suspended'
      : 'active';

    const pricePerVisit  = parseCurrency(get('Price') || get('Job Price') || get('Price Per Visit') || get('Visit Price'));
    const balance        = parseCurrency(get('Balance') || get('Account Balance') || get('Outstanding')) ?? 0;
    const dueDate        = parseCleanerDate(get('Due') || get('Next Due') || get('Due Date') || get('Next Clean') || get('Next Visit'));
    const schedule       = get('Schedule') || get('Frequency') || get('Recurring') || get('Recurrence') || null;
    const roundName      = get('Round')    || get('Round Name') || get('Route') || null;
    const jobRef         = get('Job Ref')  || get('Job Reference') || get('Job No') || null;

    const round = { jobReference: jobRef, roundName, schedule, pricePerVisit, dueDate, accountStatus };

    if (!customerMap.has(dedupKey)) {
      const phone = get('Mobile') || get('Phone') || null;
      const email = get('Email') || null;
      customerMap.set(dedupKey, {
        customer: {
          name,
          addressLine1:      address || null,
          addressLine2:      get('Address Line 2') || get('Address 2') || null,
          town:              get('Town') || get('City') || null,
          county:            get('County') || get('Region') || null,
          postcode:          get('Postcode') || get('Post Code') || null,
          phone:             phone || null,
          email:             email || null,
          notes:             get('Account Notes') || get('Notes') || get('Comments') || null,
          customerReference: custRef || null,
          accountStatus,
          customerBalance:   balance,
          schedule,
          roundName,
          pricePerVisit,
          dueDate,
          tags: [],
        },
        rounds:  [round],
        isDupe:  custRef ? existingCustRefs.has(custRef) : false,
      });
    } else {
      const entry = customerMap.get(dedupKey);
      entry.rounds.push(round);
      entry.customer.customerBalance = (entry.customer.customerBalance || 0) + balance;
      if (dueDate && (!entry.customer.dueDate || dueDate < entry.customer.dueDate)) {
        entry.customer.dueDate = dueDate;
      }
    }
  });

  return { entries: [...customerMap.values()], skipped };
}

// ─── Schedule generation helpers ─────────────────────────────────────────────

function parseFrequencyDays(scheduleStr) {
  if (!scheduleStr) return null;
  const s = scheduleStr.toLowerCase().trim();
  if (s.includes('one off') || s.includes('one-off')) return 0;
  const weeksMatch = s.match(/(\d+)\s*week/);
  if (weeksMatch) return parseInt(weeksMatch[1]) * 7;
  const monthsMatch = s.match(/(\d+)\s*month/);
  if (monthsMatch) return parseInt(monthsMatch[1]) * 30;
  if (s === 'weekly') return 7;
  if (s === 'fortnightly') return 14;
  if (s === 'monthly') return 30;
  return null;
}

function detectJobType(customerName) {
  const lower = (customerName || '').toLowerCase();
  const commercial = ['ltd', 'limited', 'plc', 'management', 'lettings', 'school', 'hotel', 'inn', 'lodge', 'apartments', 'surgery', 'clinic', 'detection', 'primary', 'college'];
  return commercial.some(w => lower.includes(w)) ? 'commercial' : 'exterior';
}

function generateJobDatesFromRound(round, windowMonths = 4) {
  const freqDays = parseFrequencyDays(round.schedule);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setMonth(windowEnd.getMonth() + windowMonths);

  // One-off: single job on due date (skip if no date or > 1yr stale)
  if (freqDays === 0) {
    if (!round.dueDate) return [];
    const d = new Date(round.dueDate + 'T00:00:00');
    const msAgo = today - d;
    if (msAgo > 365 * 86400000) return []; // skip very stale one-offs
    return [round.dueDate];
  }
  if (!freqDays) return [];

  // Advance from due date (or today if none) to first occurrence on or after today.
  // Use Math.floor so customers who are slightly overdue (< 14 days) stay visible as
  // overdue rather than being bumped a full cycle into the future.
  const start = round.dueDate
    ? new Date(round.dueDate + 'T00:00:00')
    : new Date(today);
  if (start < today) {
    const diff = today - start;
    const skips = Math.floor(diff / (freqDays * 86400000));
    start.setDate(start.getDate() + skips * freqDays);
    // If still more than 14 days in the past, advance one more cycle
    if ((today - start) > 14 * 86400000) {
      start.setDate(start.getDate() + freqDays);
    }
  }

  const dates = [];
  const cur = new Date(start);
  while (cur <= windowEnd) {
    // Shift Sunday → Monday
    if (cur.getDay() === 0) cur.setDate(cur.getDate() + 1);
    if (cur <= windowEnd) dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + freqDays);
  }
  return dates;
}

function fmtJobDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const tom = new Date(t); tom.setDate(tom.getDate() + 1);
  if (d < t) return 'Overdue';
  if (d.getTime() === t.getTime()) return 'Today';
  if (d.getTime() === tom.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
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
        if (!workbook.SheetNames.length) throw new Error('No sheets found in file.');
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
        if (!raw.length) throw new Error('The sheet appears empty — make sure row 1 is the header row and rows 2+ are your customers.');
        const headers = Object.keys(raw[0]);
        const rows = raw.map(r => {
          const obj = {};
          headers.forEach(h => {
            const v = r[h] ?? '';
            // Excel date cells come through as JS Date objects — normalise to DD/MM/YYYY
            // so downstream parsers (parseCleanerDate etc.) always see a consistent format
            if (v instanceof Date && !isNaN(v.getTime())) {
              const dd = String(v.getDate()).padStart(2, '0');
              const mm = String(v.getMonth() + 1).padStart(2, '0');
              obj[h] = `${dd}/${mm}/${v.getFullYear()}`;
            } else {
              obj[h] = String(v).trim();
            }
          });
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
    sampleFile: '/test-imports/quickbooks-sample.csv',
  },
  {
    id: 'cleanerplanner',
    name: 'CleanerPlanner',
    icon: '🧹',
    hint: 'In CleanerPlanner go to Jobs → click the Export button (top right) → Download CSV. This gives Cadi your rounds, due dates, schedules, and pricing. Do NOT use the Customers export — use Jobs.',
    sampleFile: '/test-imports/cleanerplanner-sample.csv',
  },
  {
    id: 'squeegee',
    name: 'Squeegee',
    icon: '🪣',
    hint: 'In Squeegee go to Customers → Export → All Jobs CSV. Upload the "All jobs.csv" file here — Cadi will map your rounds, schedules, and pricing automatically.',
    sampleFile: '/test-imports/squeegee-sample.csv',
  },
  {
    id: 'aworka',
    name: 'Aworka',
    icon: '🔄',
    hint: 'In Aworka go to Settings → Export Data and download your customer CSV. Upload it here — Cadi will map your rounds and schedule details.',
    sampleFile: '/test-imports/aworka-sample.csv',
  },
  {
    id: 'jobber',
    name: 'Jobber',
    icon: '🔧',
    hint: 'In Jobber go to Clients → click the export icon in the top-right → Export as CSV.',
    sampleFile: '/test-imports/jobber-sample.csv',
  },
  {
    id: 'servicem8',
    name: 'ServiceM8',
    icon: '📋',
    hint: 'Go to Clients → More → Export → CSV. Upload that file here.',
    sampleFile: '/test-imports/generic-spreadsheet-sample.csv',
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    icon: '📊',
    hint: 'In your spreadsheet go to File → Download → Comma-separated values (.csv). Then upload here.',
    sampleFile: '/test-imports/generic-spreadsheet-sample.csv',
  },
  {
    id: 'excel',
    name: 'Excel',
    icon: '📗',
    hint: 'Upload your Excel file (.xlsx) directly — no need to convert it first.',
    sampleFile: '/test-imports/generic-spreadsheet-sample.csv',
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
        {source.sampleFile && (
          <a
            href={source.sampleFile}
            download
            className="mt-2 flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] transition-colors w-fit"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-[10px]">↓</span> Download sample file to test with
          </a>
        )}
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

    // Normalise accountStatus → active | suspended | cancelled
    if (c.accountStatus) {
      const s = c.accountStatus.toLowerCase().trim();
      if (s.includes('suspend')) c.accountStatus = 'suspended';
      else if (s.includes('cancel') || s.includes('inactive') || s.includes('closed')) c.accountStatus = 'cancelled';
      else c.accountStatus = 'active';
    }

    // Normalise numeric fields — strip currency symbols
    if (c.customerBalance) c.customerBalance = parseFloat(String(c.customerBalance).replace(/[^0-9.-]/g, '')) || 0;
    if (c.pricePerVisit)   c.pricePerVisit   = parseFloat(String(c.pricePerVisit).replace(/[^0-9.-]/g, '')) || null;

    // Duplicate check by email
    const isDupe = c.email && existingEmails.has(c.email.toLowerCase());

    customers.push({ data: c, isDupe });
  });

  return { customers, skipped };
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────
function StepPreview({ rows, mapping, existingEmails, cpData, onBack, onImport, importing, importError }) {

  // ─── CleanerPlanner Jobs preview ────────────────────────────────────────────
  if (cpData) {
    const { entries, skipped } = cpData;
    const fresh = entries.filter(e => !e.isDupe);
    const dupes = entries.filter(e => e.isDupe);
    const totalRounds = entries.reduce((sum, e) => sum + e.rounds.length, 0);
    const withDueDates = entries.filter(e => e.customer.dueDate).length;
    const withSchedule = entries.filter(e => e.rounds.some(r => r.schedule)).length;

    // Round name breakdown (top 4 rounds by customer count)
    const roundCounts = {};
    entries.forEach(e => e.rounds.forEach(r => {
      const key = r.roundName || 'No round';
      roundCounts[key] = (roundCounts[key] || 0) + 1;
    }));
    const topRounds = Object.entries(roundCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return (
      <div className="flex flex-col overflow-hidden">
        <div className="p-6 border-b border-[rgba(153,197,255,0.1)]">
          <button onClick={onBack} disabled={importing} className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors disabled:opacity-40">
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧹</span>
            <h2 className="text-xl font-black text-white">Ready to import</h2>
          </div>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-3">CleanerPlanner format detected — rounds, due dates and pricing mapped automatically.</p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-lg font-black text-emerald-400">{fresh.length}</p>
              <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wide mt-0.5">Customers</p>
            </div>
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-center">
              <p className="text-lg font-black text-[#99c5ff]">{topRounds.length > 0 ? topRounds.length : totalRounds}</p>
              <p className="text-[10px] text-[rgba(153,197,255,0.5)] font-bold uppercase tracking-wide mt-0.5">Rounds</p>
            </div>
            <div className={`flex-1 px-3 py-2.5 rounded-xl text-center ${withDueDates === entries.length ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              <p className={`text-lg font-black ${withDueDates === entries.length ? 'text-emerald-400' : 'text-amber-400'}`}>{withDueDates}</p>
              <p className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${withDueDates === entries.length ? 'text-emerald-400/70' : 'text-amber-400/70'}`}>Due dates</p>
            </div>
            {dupes.length > 0 && (
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-lg font-black text-amber-400">{dupes.length}</p>
                <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wide mt-0.5">Update</p>
              </div>
            )}
          </div>
          {/* Round breakdown */}
          {topRounds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topRounds.map(([name, count]) => (
                <span key={name} className="text-[10px] px-2 py-1 rounded-full bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)]">
                  {name} · {count}
                </span>
              ))}
              {Object.keys(roundCounts).length > 4 && (
                <span className="text-[10px] px-2 py-1 rounded-full bg-[rgba(153,197,255,0.05)] text-[rgba(153,197,255,0.4)]">
                  +{Object.keys(roundCounts).length - 4} more
                </span>
              )}
            </div>
          )}
          {/* Schedule quality warning */}
          {withDueDates < entries.length && (
            <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/15 text-xs text-amber-300/80">
              <AlertCircle size={13} className="shrink-0 mt-0.5 text-amber-400" />
              {entries.length - withDueDates} customer{entries.length - withDueDates !== 1 ? 's' : ''} have no due date in this file — they'll be added to your customer list but won't appear on the schedule until you set a date.
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
          {entries.slice(0, 8).map((e, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                e.isDupe
                  ? 'bg-amber-500/5 border-amber-500/15'
                  : 'bg-[rgba(153,197,255,0.04)] border-[rgba(153,197,255,0.1)]'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[rgba(31,72,255,0.2)] flex items-center justify-center shrink-0 text-sm font-bold text-[#99c5ff]">
                {e.customer.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{e.customer.name}</p>
                <p className="text-[11px] text-[rgba(153,197,255,0.45)] truncate">
                  {e.rounds.length} round{e.rounds.length !== 1 ? 's' : ''}
                  {e.rounds[0]?.roundName ? ` · ${e.rounds[0].roundName}` : ''}
                  {e.rounds[0]?.pricePerVisit != null ? ` · £${e.rounds[0].pricePerVisit}` : ''}
                </p>
              </div>
              {e.isDupe && (
                <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                  update
                </span>
              )}
            </div>
          ))}
          {entries.length > 8 && (
            <p className="text-xs text-center text-[rgba(153,197,255,0.3)] py-2">
              + {entries.length - 8} more customers
            </p>
          )}
          {skipped.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.05)] border border-[rgba(153,197,255,0.1)] text-xs text-[rgba(153,197,255,0.5)]">
              {skipped.length} row{skipped.length !== 1 ? 's' : ''} skipped (quotes, missing names, or cancelled).
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[rgba(153,197,255,0.1)] space-y-3">
          {importError && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              {importError}
            </div>
          )}
          <button
            onClick={() => onImport(entries)}
            disabled={importing || entries.length === 0}
            className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#1f48ff]/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Importing…
              </>
            ) : (
              <>
                Import {entries.length} customer{entries.length !== 1 ? 's' : ''} + {totalRounds} round{totalRounds !== 1 ? 's' : ''}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ─── Standard CSV/Excel preview ─────────────────────────────────────────────
  const { customers, skipped } = buildCustomers(rows, mapping, existingEmails);
  const fresh = customers.filter(c => !c.isDupe);
  const dupes = customers.filter(c => c.isDupe);
  const allSkipped = customers.length === 0 && skipped.length > 0;

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

      <div className="p-6 border-t border-[rgba(153,197,255,0.1)] space-y-3">
        {allSkipped && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            All {skipped.length} rows were skipped because no Name value was found. Go back and make sure a column is mapped to "Name".
          </div>
        )}
        {importError && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            {importError}
          </div>
        )}
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
function StepDone({ imported, rounds, jobs, upcomingJobs = [], onClose, onViewScheduler }) {
  const hasSchedule = jobs > 0;

  return (
    <div className="p-6 flex flex-col items-center gap-4 overflow-y-auto">
      {/* Success icon */}
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mt-2">
        <Check size={26} className="text-emerald-400" />
      </div>

      {/* Headline */}
      <div className="text-center">
        <h2 className="text-2xl font-black text-white">
          {hasSchedule ? 'Your schedule is live in Cadi!' : 'Customers imported!'}
        </h2>
        <p className="text-[rgba(153,197,255,0.6)] text-sm mt-1.5">
          {imported} customer{imported !== 1 ? 's' : ''}
          {rounds > 0 ? ` · ${rounds} recurring service${rounds !== 1 ? 's' : ''}` : ''}
          {hasSchedule ? ` · ${jobs} jobs scheduled` : ''}.
        </p>
      </div>

      {/* Mini schedule preview — the wow moment */}
      {upcomingJobs.length > 0 && (
        <div className="w-full">
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[rgba(153,197,255,0.45)] mb-2">Coming up in your schedule</p>
          <div className="rounded-xl border border-[rgba(153,197,255,0.12)] overflow-hidden">
            {upcomingJobs.map((job, i) => (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-2.5 ${i < upcomingJobs.length - 1 ? 'border-b border-[rgba(153,197,255,0.08)]' : ''}`}
                style={{ background: i % 2 === 0 ? 'rgba(153,197,255,0.03)' : 'transparent' }}
              >
                <span className={`text-[11px] font-bold w-16 shrink-0 ${job.date < new Date().toISOString().slice(0, 10) ? 'text-amber-400' : 'text-[#99c5ff]'}`}>
                  {fmtJobDate(job.date)}
                </span>
                <span className="text-sm text-white font-semibold truncate flex-1">{job.customer}</span>
                {job.price > 0 && (
                  <span className="text-[11px] text-[rgba(153,197,255,0.45)] shrink-0">£{job.price}</span>
                )}
              </div>
            ))}
          </div>
          {jobs > upcomingJobs.length && (
            <p className="text-[11px] text-center text-[rgba(153,197,255,0.35)] mt-2">
              + {jobs - upcomingJobs.length} more jobs over the next 4 months
            </p>
          )}
        </div>
      )}

      {/* No-schedule fallback info */}
      {!hasSchedule && (
        <div className="w-full px-4 py-3.5 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.15)] text-sm text-[rgba(153,197,255,0.7)] text-left space-y-1.5">
          <p className="font-bold text-white text-sm">What's next?</p>
          <p>• View and edit each customer from the Customers page</p>
          <p>• Add service schedules to customers to populate the Scheduler</p>
          <p>• Cadi will suggest upsell and win-back opportunities automatically</p>
        </div>
      )}

      {/* CTAs */}
      <div className="w-full space-y-2">
        {hasSchedule && onViewScheduler && (
          <button
            onClick={onViewScheduler}
            className="w-full py-3 bg-[#1f48ff] hover:bg-[#3a5eff] text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-[#1f48ff]/30"
          >
            Open Scheduler →
          </button>
        )}
        <button
          onClick={onClose}
          className={`w-full py-3 text-sm font-bold rounded-xl transition-colors ${
            hasSchedule && onViewScheduler
              ? 'text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff]'
              : 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white shadow-lg shadow-[#1f48ff]/30'
          }`}
        >
          {hasSchedule ? 'Back to dashboard' : 'View my customers'}
        </button>
      </div>
    </div>
  );
}

// ─── 50-customer cap modal ────────────────────────────────────────────────────
function CapModal({ total, onUpgrade, onPick, onImportRecent }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(153,197,255,0.15)]"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
          backgroundSize: '28px 28px',
        }} />
        <div className="relative p-6">
          <div className="text-3xl mb-4">🏢</div>
          <h2 className="text-xl font-black text-white mb-2">You've got {total} customers — that's a real business.</h2>
          <p className="text-sm text-[rgba(153,197,255,0.7)] leading-relaxed mb-6">
            Cadi Lite holds your first {LITE_CAP} to get you started. Pro unlocks the rest plus automated reminders, recurring invoices, and profit tracking per customer.
            <br /><br />
            What would you like to do?
          </p>

          <div className="space-y-2.5">
            {/* Path A — Upgrade */}
            <button
              onClick={onUpgrade}
              className="w-full flex items-center gap-3 p-4 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] transition-colors text-left group"
            >
              <Crown size={18} className="text-white shrink-0" />
              <div>
                <p className="text-sm font-black text-white">Upgrade to Pro — £39/month</p>
                <p className="text-xs text-[rgba(255,255,255,0.7)] mt-0.5">Unlock all {total} customers and everything else.</p>
              </div>
            </button>

            {/* Path B — Pick 50 */}
            <button
              onClick={onPick}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(153,197,255,0.2)] bg-[rgba(153,197,255,0.05)] hover:bg-[rgba(153,197,255,0.1)] transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[rgba(153,197,255,0.1)] flex items-center justify-center shrink-0 text-sm font-black text-[#99c5ff]">50</div>
              <div>
                <p className="text-sm font-bold text-white">Choose my first {LITE_CAP}</p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">Pick which customers to bring in now. Upgrade later when you're ready.</p>
              </div>
            </button>

            {/* Path C — Later */}
            <button
              onClick={onImportRecent}
              className="w-full py-3 text-sm text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] font-semibold transition-colors"
            >
              Remind me later — import my {LITE_CAP} most recent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customer picker (Path B) ─────────────────────────────────────────────────
function CustomerPicker({ customers, onConfirm, onBack }) {
  const [selected, setSelected] = useState(new Set());
  const [sort, setSort] = useState('name');

  const sorted = [...customers].sort((a, b) => {
    if (sort === 'name') return (a.data.name ?? '').localeCompare(b.data.name ?? '');
    return 0;
  });

  const toggle = (i) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(i)) { next.delete(i); return next; }
      if (next.size >= LITE_CAP) return prev; // cap reached
      next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col overflow-hidden max-h-[85vh]">
      <div className="p-5 border-b border-[rgba(153,197,255,0.1)] shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-3 transition-colors">
          <ArrowLeft size={12} /> Back
        </button>
        <h2 className="text-lg font-black text-white">Which {LITE_CAP} customers do you want in Cadi first?</h2>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1">The rest stay safe and load in when you upgrade.</p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm font-bold text-[#4f78ff]">{selected.size} of {LITE_CAP} selected</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.15)] text-white"
          >
            <option value="name">Alphabetical</option>
          </select>
        </div>
        <div className="h-1.5 bg-[rgba(153,197,255,0.1)] rounded-full mt-2">
          <div className="h-full bg-[#4f78ff] rounded-full transition-all" style={{ width: `${(selected.size / LITE_CAP) * 100}%` }} />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1.5">
        {sorted.map((c, i) => {
          const originalIndex = customers.indexOf(c);
          const isSelected = selected.has(originalIndex);
          const atCap = selected.size >= LITE_CAP && !isSelected;
          return (
            <button
              key={i}
              onClick={() => toggle(originalIndex)}
              disabled={atCap}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                isSelected
                  ? 'bg-[#4f78ff]/15 border-[#4f78ff]/40'
                  : atCap
                  ? 'opacity-30 border-transparent cursor-not-allowed'
                  : 'border-[rgba(153,197,255,0.1)] hover:bg-[rgba(153,197,255,0.05)] hover:border-[rgba(153,197,255,0.2)]'
              }`}
            >
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                isSelected ? 'bg-[#4f78ff] border-[#4f78ff]' : 'border-[rgba(153,197,255,0.3)]'
              }`}>
                {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <div className="w-7 h-7 rounded-full bg-[rgba(31,72,255,0.2)] flex items-center justify-center shrink-0 text-xs font-bold text-[#99c5ff]">
                {c.data.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{c.data.name}</p>
                {(c.data.email || c.data.postcode) && (
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] truncate">{[c.data.email, c.data.postcode].filter(Boolean).join(' · ')}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="p-5 border-t border-[rgba(153,197,255,0.1)] shrink-0">
        <button
          onClick={() => onConfirm([...selected])}
          disabled={selected.size === 0}
          className="w-full py-3 rounded-xl bg-[#4f78ff] hover:bg-[#3d68ff] text-white font-black text-sm transition-colors disabled:opacity-50"
        >
          Confirm my {selected.size > 0 ? selected.size : LITE_CAP}
        </button>
      </div>
    </div>
  );
}

// ─── Pending customers helper ─────────────────────────────────────────────────
async function storePendingCustomers(customers) {
  const { data: bizId } = await supabase.rpc('my_business_id');
  if (!bizId || !customers.length) return;
  const rows = customers.map(c => ({ business_id: bizId, customer_data: c.data }));
  await supabase.from('pending_customers').insert(rows);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function CustomerImport({ onClose, onImported, onViewScheduler, existingCustomers = [] }) {
  const { isPro } = usePlan();
  const [step, setStep] = useState('source'); // source | upload | map | preview | cap | pick | done
  const [source, setSource] = useState(null);
  const [csvData, setCsvData] = useState(null); // { headers, rows, fileName }
  const [mapping, setMapping] = useState(null);
  const [cpData, setCpData] = useState(null);   // CleanerPlanner Jobs: { entries, skipped }
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importedRoundCount, setImportedRoundCount] = useState(0);
  const [importedJobCount, setImportedJobCount] = useState(0);
  const [importedUpcomingJobs, setImportedUpcomingJobs] = useState([]);
  const [importError, setImportError] = useState(null);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [showCap, setShowCap] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const existingEmails   = new Set(existingCustomers.map(c => c.email?.toLowerCase()).filter(Boolean));
  const existingCustRefs = new Set(existingCustomers.map(c => c.customer_reference).filter(Boolean));

  // CleanerPlanner Jobs import: create customers, rounds, then auto-schedule jobs
  const doImportCP = async (entries) => {
    setImporting(true);
    setImportError(null);
    let count = 0;
    let roundCount = 0;
    const failures = [];
    const jobsToCreate = [];

    for (const { customer, rounds } of entries) {
      try {
        const saved = await upsertCustomer(customer);
        count++;
        if (rounds.length > 0 && saved?.id) {
          try {
            await deleteRoundsForCustomer(saved.id);
            await bulkInsertRounds(rounds.map(r => ({ ...r, customerId: saved.id })));
            roundCount += rounds.length;
          } catch (re) {
            console.warn('Rounds insert failed for', customer.name, re?.message);
          }

          // Build scheduled jobs for the next 4 months
          const jobType = detectJobType(customer.name);
          for (const round of rounds) {
            if (round.accountStatus === 'cancelled' || round.accountStatus === 'suspended') continue;
            const dates = generateJobDatesFromRound(round, 4);
            for (const date of dates) {
              jobsToCreate.push({
                customerId:   saved.id,
                customer:     customer.name,
                addressLine1: customer.addressLine1 || null,
                addressLine2: customer.addressLine2 || null,
                town:         customer.town || null,
                county:       customer.county || null,
                postcode:     customer.postcode || '',
                date,
                type:         jobType,
                service:      round.roundName || 'Window clean',
                price:        round.pricePerVisit || 0,
                recurrence:   round.schedule || 'one-off',
                isRecurring:  (parseFrequencyDays(round.schedule) ?? 0) > 0,
                notes:        round.jobReference ? `Job ref: ${round.jobReference}` : '',
              });
            }
          }
        }
      } catch (err) {
        console.error('CP import row failed:', err?.message, customer.name);
        failures.push(err?.message || 'Unknown error');
      }
    }

    // Bulk-insert all scheduled jobs in one shot
    let jobCount = 0;
    if (jobsToCreate.length > 0) {
      try {
        await bulkCreateJobs(jobsToCreate);
        jobCount = jobsToCreate.length;
      } catch (je) {
        console.warn('Schedule generation failed:', je?.message);
      }
    }

    // Build the mini-schedule preview (next 5 upcoming jobs by date)
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = jobsToCreate
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter(j => j.date >= todayStr)
      .slice(0, 5);

    setImporting(false);
    if (count > 0) {
      setImportedCount(count);
      setImportedRoundCount(roundCount);
      setImportedJobCount(jobCount);
      setImportedUpcomingJobs(upcoming);
      setStep('done');
      onImported?.();
    } else {
      setImportError(`Import failed: ${failures[0] ?? 'Unknown error'}`);
    }
  };

  const handleImportCP = async (entries) => {
    // Resolve existing customer ids so upsert updates rather than inserts duplicates
    const refToId = new Map(
      existingCustomers
        .filter(c => c.customer_reference)
        .map(c => [c.customer_reference, c.id])
    );
    const resolved = entries.map(e => ({
      ...e,
      customer: {
        ...e.customer,
        id: e.customer.customerReference ? refToId.get(e.customer.customerReference) : undefined,
      },
    }));

    if (!isPro) {
      const fresh = resolved.filter(e => !e.isDupe);
      if (fresh.length > LITE_CAP) {
        const dupes = resolved.filter(e => e.isDupe);
        await doImportCP([...fresh.slice(0, LITE_CAP), ...dupes]);
        return;
      }
    }
    await doImportCP(resolved);
  };

  const doImport = async (customers, overflow = []) => {
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
    if (overflow.length > 0) {
      try { await storePendingCustomers(overflow); } catch (e) { console.warn('pending_customers store failed', e); }
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

  const handleImport = async (customers) => {
    const freshCustomers = customers.filter(c => !c.isDupe);
    if (!isPro && freshCustomers.length > LITE_CAP) {
      setPendingCustomers(customers);
      setShowCap(true);
      return;
    }
    await doImport(customers);
  };

  const handleCapUpgrade = () => {
    setShowCap(false);
    window.location.href = '/upgrade';
  };

  const handleCapPick = () => {
    setShowCap(false);
    setShowPicker(true);
  };

  const handleCapImportRecent = async () => {
    setShowCap(false);
    const toImport = pendingCustomers.slice(0, LITE_CAP);
    const overflow = pendingCustomers.slice(LITE_CAP);
    await doImport(toImport, overflow);
  };

  const handlePickerConfirm = async (selectedIndices) => {
    setShowPicker(false);
    const toImport = selectedIndices.map(i => pendingCustomers[i]);
    const overflow = pendingCustomers.filter((_, i) => !selectedIndices.includes(i));
    await doImport(toImport, overflow);
  };

  return (
    <>
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
            onParsed={(data) => {
              setCsvData(data);
              if (isCleanerPlannerJobs(data.headers)) {
                const built = buildCleanerPlannerData(data.rows, existingCustRefs);
                setCpData(built);
                setStep('preview');
              } else {
                setStep('map');
              }
            }}
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
          <StepPreview
            rows={csvData?.rows ?? []}
            mapping={mapping ?? {}}
            existingEmails={existingEmails}
            cpData={cpData}
            onBack={() => cpData ? setStep('upload') : setStep('map')}
            onImport={cpData ? handleImportCP : handleImport}
            importing={importing}
            importError={importError}
          />
        )}
        {step === 'done' && (
          <StepDone
            imported={importedCount}
            rounds={importedRoundCount}
            jobs={importedJobCount}
            upcomingJobs={importedUpcomingJobs}
            onClose={onClose}
            onViewScheduler={onViewScheduler}
          />
        )}
      </ModalShell>

      {/* 50-cap modal — renders outside ModalShell so it's above everything */}
      {showCap && (
        <CapModal
          total={pendingCustomers.length}
          onUpgrade={handleCapUpgrade}
          onPick={handleCapPick}
          onImportRecent={handleCapImportRecent}
        />
      )}

      {/* Customer picker (Path B) */}
      {showPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-4">
          <div
            className="relative w-full max-w-md max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-[rgba(153,197,255,0.15)] overflow-hidden"
            style={{ background: 'linear-gradient(145deg, #010a4f 0%, #05124a 50%, #0d1e78 100%)' }}
          >
            <button onClick={() => setShowPicker(false)} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
              <X size={14} className="text-white" />
            </button>
            <CustomerPicker
              customers={pendingCustomers}
              onConfirm={handlePickerConfirm}
              onBack={() => { setShowPicker(false); setShowCap(true); }}
            />
          </div>
        </div>
      )}
    </>
  );
}
