// CustomerImport.jsx — Step-by-step import wizard
// Accepts CSV and Excel (.xlsx/.xls) files. Auto-maps common column names,
// lets user fix mappings, previews data, then bulk-upserts via customersDb.
//
// Steps: source → upload → map columns → preview → done

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  AlertCircle,
  ChevronDown,
  Crown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { upsertCustomer } from '../lib/db/customersDb';
import { bulkInsertRounds, deleteRoundsForCustomer } from '../lib/db/customerRoundsDb';
import { bulkCreateJobs } from '../lib/db/jobsDb';
import { supabase } from '../lib/supabase';
import { usePlan } from '../hooks/usePlan';
import {
  parseFrequency,
  parseBalance,
  parseCurrency,
  parseCleanerDate,
  normalisePostcode,
  splitAddress,
  detectSource,
} from '../lib/migration/parsers';
import { newImportBatchId, rollbackBatch } from '../lib/migration/importBatch';

const LITE_CAP = 30;

// ─── Cadi fields that imports can fill ────────────────────────────────────────
const CADI_FIELDS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'email', label: 'Email' },
  { id: 'phone', label: 'Phone' },
  { id: 'addressLine1', label: 'Address line 1' },
  { id: 'addressLine2', label: 'Address line 2' },
  { id: 'town', label: 'Town / City' },
  { id: 'county', label: 'County' },
  { id: 'postcode', label: 'Postcode' },
  { id: 'frequency', label: 'Frequency' },
  { id: 'notes', label: 'Notes' },
  { id: 'tags', label: 'Tags (comma-separated)' },
  // CleanerPlanner / Squeegee fields
  { id: 'dueDate', label: 'Due date' },
  { id: 'jobReference', label: 'Job reference' },
  { id: 'customerReference', label: 'Customer reference' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'customerBalance', label: 'Customer balance (£)' },
  { id: 'pricePerVisit', label: 'Price per visit (£)' },
  { id: 'roundName', label: 'Round' },
  { id: 'accountStatus', label: 'Status (active/suspended/cancelled)' },
  { id: '__skip', label: '— Skip this column —' },
];

// ─── Keyword → Cadi field auto-mapping ────────────────────────────────────────
const KEYWORD_MAP = [
  {
    field: 'name',
    keywords: [
      'name',
      'full name',
      'customer',
      'client',
      'contact',
      'company',
      'company name',
      'display name',
    ],
  },
  { field: 'email', keywords: ['email', 'e-mail', 'mail', 'main email'] },
  {
    field: 'phone',
    keywords: [
      'phone',
      'mobile',
      'tel',
      'telephone',
      'cell',
      'main phone',
      'work phone',
      'alt phone',
      'alt. phone',
    ],
  },
  {
    field: 'addressLine1',
    keywords: [
      'address 1',
      'address1',
      'street',
      'address line 1',
      'line 1',
      'addr1',
      'addr',
      'billing address',
      'bill to',
      'ship to',
      'billing address street',
    ],
  },
  {
    field: 'addressLine2',
    keywords: ['address 2', 'address2', 'address line 2', 'line 2', 'addr2'],
  },
  { field: 'town', keywords: ['town', 'city', 'suburb', 'billing address city'] },
  { field: 'county', keywords: ['county', 'region', 'state', 'area', 'billing address state'] },
  {
    field: 'postcode',
    keywords: ['postcode', 'post code', 'postal', 'zip', 'zipcode', 'billing address postal code'],
  },
  { field: 'frequency', keywords: ['frequency', 'recurring', 'recurrence', 'interval'] },
  { field: 'notes', keywords: ['notes', 'note', 'comments', 'comment', 'description', 'memo'] },
  { field: 'tags', keywords: ['tags', 'tag', 'labels', 'label', 'category', 'categories'] },
  // CleanerPlanner / Squeegee specific
  {
    field: 'dueDate',
    keywords: ['due date', 'due', 'next due', 'next visit', 'date due', 'duedate'],
  },
  {
    field: 'jobReference',
    keywords: ['job ref', 'job reference', 'job no', 'job number', 'jobref', 'job id'],
  },
  {
    field: 'customerReference',
    keywords: [
      'customer ref',
      'customer reference',
      'cust ref',
      'account ref',
      'account number',
      'acc ref',
      'ref',
    ],
  },
  {
    field: 'schedule',
    keywords: ['schedule', 'cleaning schedule', 'service schedule', 'visit schedule'],
  },
  {
    field: 'customerBalance',
    keywords: [
      'balance',
      'customer balance',
      'outstanding',
      'amount due',
      'account balance',
      'balance due',
      'open balance',
      'current balance',
    ],
  },
  {
    field: 'pricePerVisit',
    keywords: [
      'price',
      'cost',
      'charge',
      'amount',
      'price per visit',
      'job price',
      'visit price',
      'fee',
    ],
  },
  {
    field: 'roundName',
    keywords: ['round', 'round name', 'route', 'route name', 'rounds', 'area round'],
  },
  {
    field: 'accountStatus',
    keywords: ['status', 'account status', 'active', 'state', 'customer status'],
  },
];

function autoMap(header) {
  const lower = header.toLowerCase().trim();
  for (const { field, keywords } of KEYWORD_MAP) {
    if (keywords.some((k) => lower === k || lower.includes(k))) return field;
  }
  return '__skip';
}

// ─── CleanerPlanner Jobs format detection + parsing ───────────────────────────
function isCleanerPlannerJobs(headers) {
  const lower = headers.map((h) => h.toLowerCase().trim());
  return lower.includes('cust ref') && lower.includes('round') && lower.includes('job ref');
}

// parseCurrency + parseCleanerDate now live in ../lib/migration/parsers (pure,
// unit-tested — see src/test/parsers.test.js).

// Returns { entries: [{customer, rounds, isDupe}], skipped }
// One entry per unique Cust Ref. Each entry has its customer data + all its rounds.
function buildCleanerPlannerData(rows, existingCustRefs = new Set()) {
  const customerMap = new Map(); // dedupKey → { customer, rounds, isDupe }
  const skipped = [];

  rows.forEach((row, idx) => {
    const get = (col) => (row[col] ?? '').toString().trim();

    const custRef = get('Cust Ref');
    const rawName = get('Name');
    const address = get('Address Line 1');
    const name = rawName || address; // address fallback for unnamed rows
    const status = get('Status').toLowerCase();
    const cancelled = get('Cancelled');

    if (!name) {
      skipped.push({ row: idx + 2, reason: 'No name or address' });
      return;
    }
    if (status === 'quote') {
      skipped.push({ row: idx + 2, reason: 'Quote — skipped' });
      return;
    }

    const dedupKey = custRef || `${name}::${address}`.toLowerCase();

    const accountStatus = cancelled
      ? 'cancelled'
      : status.includes('suspend')
        ? 'suspended'
        : 'active';

    const pricePerVisit = parseCurrency(
      get('Price') || get('Job Price') || get('Price Per Visit') || get('Visit Price')
    );
    // parseBalance honours CR/DR suffixes (CleanerPlanner and Squeegee both emit them).
    // Falls back to parseCurrency for purely numeric cells.
    const rawBalance = get('Balance') || get('Account Balance') || get('Outstanding');
    const balance = parseBalance(rawBalance) ?? parseCurrency(rawBalance) ?? 0;
    const dueDate = parseCleanerDate(
      get('Due') || get('Next Due') || get('Due Date') || get('Next Clean') || get('Next Visit')
    );
    const schedule =
      get('Schedule') || get('Frequency') || get('Recurring') || get('Recurrence') || null;
    const roundName = get('Round') || get('Round Name') || get('Route') || null;
    const jobRef = get('Job Ref') || get('Job Reference') || get('Job No') || null;

    const round = {
      jobReference: jobRef,
      roundName,
      schedule,
      pricePerVisit,
      dueDate,
      accountStatus,
    };

    if (!customerMap.has(dedupKey)) {
      const phone = get('Mobile') || get('Phone') || null;
      const email = get('Email') || null;
      // Postcode normalisation: "sw191aa" → "SW19 1AA". Falls back to raw if invalid.
      const rawPc = get('Postcode') || get('Post Code') || null;
      const postcode = normalisePostcode(rawPc) ?? (rawPc ? rawPc.trim() : null);

      // If the import lacks structured fields but has a one-line address,
      // try splitting it (defensive — most CP exports have structured cols).
      let line1 = address || null;
      let line2 = get('Address Line 2') || get('Address 2') || null;
      let town = get('Town') || get('City') || null;
      let county = get('County') || get('Region') || null;
      if (!town && !county && line1 && /,/.test(line1)) {
        const parts = splitAddress(line1);
        line1 = parts.addressLine1 ?? line1;
        line2 = line2 ?? parts.addressLine2;
        town = town ?? parts.town;
        county = county ?? parts.county;
      }

      customerMap.set(dedupKey, {
        customer: {
          name,
          addressLine1: line1,
          addressLine2: line2,
          town,
          county,
          postcode,
          phone: phone || null,
          email: email || null,
          notes: get('Account Notes') || get('Notes') || get('Comments') || null,
          customerReference: custRef || null,
          accountStatus,
          customerBalance: balance,
          schedule,
          roundName,
          pricePerVisit,
          dueDate,
          tags: [],
        },
        rounds: [round],
        isDupe: custRef ? existingCustRefs.has(custRef) : false,
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
// parseFrequency is shared across the import wizard, ServiceChat and AddCustomerModal —
// lives in src/lib/migration/parsers.js. parseFrequencyDays kept as a local thin
// wrapper for back-compat with the inline call sites below.

function parseFrequencyDays(scheduleStr) {
  const f = parseFrequency(scheduleStr);
  return f ? f.days : null;
}

function detectJobType(customerName) {
  const lower = (customerName || '').toLowerCase();
  const commercial = [
    'ltd',
    'limited',
    'plc',
    'management',
    'lettings',
    'school',
    'hotel',
    'inn',
    'lodge',
    'apartments',
    'surgery',
    'clinic',
    'detection',
    'primary',
    'college',
  ];
  return commercial.some((w) => lower.includes(w)) ? 'commercial' : 'exterior';
}

function generateJobDatesFromRound(round, windowMonths = 4) {
  const freqDays = parseFrequencyDays(round.schedule);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
  const start = round.dueDate ? new Date(round.dueDate + 'T00:00:00') : new Date(today);
  if (start < today) {
    const diff = today - start;
    const skips = Math.floor(diff / (freqDays * 86400000));
    start.setDate(start.getDate() + skips * freqDays);
    // If still more than 14 days in the past, advance one more cycle
    if (today - start > 14 * 86400000) {
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
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const tom = new Date(t);
  tom.setDate(tom.getDate() + 1);
  if (d < t) return 'Overdue';
  if (d.getTime() === t.getTime()) return 'Today';
  if (d.getTime() === tom.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ─── Parse file (CSV or Excel) → { headers, rows } ───────────────────────────
// Header-hint words used to locate the real header row when a file has
// preamble rows above it (QuickBooks .xls exports have a business-name title,
// a report title, a date, and a blank row before the actual column headers).
const HEADER_HINTS = [
  'name',
  'customer',
  'client',
  'company',
  'contact',
  'display name',
  'email',
  'phone',
  'mobile',
  'telephone',
  'main phone',
  'fax',
  'address',
  'street',
  'town',
  'city',
  'county',
  'state',
  'postcode',
  'post code',
  'zip',
  'postal',
  'balance',
  'open balance',
  'outstanding',
  'round',
  'route',
  'due',
  'schedule',
  'frequency',
  'ref',
  'job ref',
  'cust ref',
  'status',
  'tags',
  'notes',
  'memo',
  'comments',
  'bill to',
  'ship to',
  'billing address',
];

function normaliseCell(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${v.getFullYear()}`;
  }
  return String(v ?? '').trim();
}

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

        // Read as array-of-arrays so we can locate the real header row.
        // QuickBooks XLS exports prefix the table with several title/blank rows.
        const aoa = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: '',
          raw: true,
          blankrows: false,
        });
        if (!aoa.length)
          throw new Error(
            'The sheet appears empty — make sure row 1 is the header row and rows 2+ are your customers.'
          );

        // Score each of the first 20 rows for header-likeness; the row with
        // the most header-hint matches (and at least 2 non-empty cells) wins.
        let headerRowIdx = 0;
        let bestScore = 0;
        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
          const row = aoa[i];
          const cells = row.map((c) =>
            String(c ?? '')
              .toLowerCase()
              .trim()
          );
          const nonEmpty = cells.filter(Boolean).length;
          if (nonEmpty < 2) continue;
          const score = cells.reduce((acc, s) => {
            if (!s || s.length > 40) return acc;
            return acc + (HEADER_HINTS.some((h) => s === h || s.includes(h)) ? 1 : 0);
          }, 0);
          if (score > bestScore) {
            bestScore = score;
            headerRowIdx = i;
          }
        }

        const rawHeaderRow = aoa[headerRowIdx] || [];
        const seen = {};
        const headers = rawHeaderRow.map((h, i) => {
          let s = String(h ?? '').trim();
          if (!s) s = `Column ${i + 1}`;
          if (seen[s] == null) {
            seen[s] = 1;
            return s;
          }
          seen[s]++;
          return `${s} (${seen[s]})`;
        });

        const dataRows = aoa.slice(headerRowIdx + 1);
        const rows = dataRows
          .map((arr) => {
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = normaliseCell(arr[i]);
            });
            return obj;
          })
          .filter((row) => {
            const vals = Object.values(row).filter((v) => v !== '');
            if (vals.length === 0) return false;
            // QuickBooks "Total" / summary footer rows have a single labelled cell
            if (vals.length <= 2 && /^total\b/i.test(vals[0])) return false;
            return true;
          });

        if (!rows.length)
          throw new Error(
            'The sheet appears empty — make sure row 1 is the header row and rows 2+ are your customers.'
          );
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
    hint: 'In QuickBooks go to Sales → Customers and click the export icon (top-right) — or run Reports → Customer Contact List → Export to Excel. Both .xls and .xlsx work. Cadi will skip the title rows and detect "Bill to", "Main Phone" and "Open Balance" columns automatically.',
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
        <div className="relative flex flex-col overflow-hidden flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── Step 1: Pick source ──────────────────────────────────────────────────────
function StepSource({ onSelect }) {
  return (
    <div className="p-6 overflow-y-auto">
      <div className="mb-5">
        <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#99c5ff] mb-1">
          Import customers
        </p>
        <h2 className="text-xl font-black text-white">Where are your customers now?</h2>
        <p className="text-sm text-[rgba(153,197,255,0.6)] mt-1">
          Pick your current tool and we'll walk you through the rest.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {SOURCES.map((src) => (
          <button
            key={src.id}
            onClick={() => onSelect(src)}
            className="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-[rgba(153,197,255,0.15)] bg-[rgba(153,197,255,0.05)] hover:bg-[rgba(153,197,255,0.12)] hover:border-[rgba(153,197,255,0.3)] transition-all text-left group"
          >
            <span className="text-2xl shrink-0">{src.icon}</span>
            <span className="text-sm font-bold text-white group-hover:text-[#99c5ff] transition-colors">
              {src.name}
            </span>
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

  const handleFile = useCallback(
    async (file) => {
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
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile]
  );

  return (
    <div className="p-6 overflow-y-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-5 transition-colors"
      >
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
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-[10px]">↓</span> Download sample file to test with
          </a>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
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
          <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
            CSV or Excel (.xlsx) · click to browse
          </p>
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
function StepMap({ headers, rows, onBack, onConfirm, detectedSource }) {
  const SOURCE_LABEL = {
    'cleaner-planner': 'CleanerPlanner',
    squeegee: 'Squeegee',
    aworka: 'Aworka',
    jobber: 'Jobber',
    servicem8: 'ServiceM8',
    'housecall-pro': 'Housecall Pro',
    quickbooks: 'QuickBooks',
  };
  const [mapping, setMapping] = useState(() => {
    const m = {};
    headers.forEach((h) => {
      m[h] = autoMap(h);
    });
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
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-black text-white">Match your columns</h2>
          {detectedSource && SOURCE_LABEL[detectedSource] && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
              Detected: {SOURCE_LABEL[detectedSource]}
            </span>
          )}
        </div>
        <p className="text-sm text-[rgba(153,197,255,0.6)] mt-1">
          We've guessed the mapping below — check it looks right and adjust anything that's off.
        </p>
      </div>

      <div className="overflow-y-auto flex-1 px-6 py-4 space-y-2">
        {headers.map((header) => (
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
                onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value }))}
                className="w-full appearance-none px-3 py-2 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-xs text-white focus:outline-none focus:border-[#1f48ff]/50 pr-7"
              >
                {CADI_FIELDS.map((f) => (
                  <option key={f.id} value={f.id} style={{ background: '#05124a' }}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={10}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[rgba(153,197,255,0.4)] pointer-events-none"
              />
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

    if (!c.name) {
      skipped.push({ row: idx + 2, reason: 'No name' });
      return;
    }

    // QuickBooks "Bill to" / "Billing Address" cells are one multi-line string.
    // If the mapped addressLine1 contains newlines or looks like a full address,
    // split it into structured parts before saving.
    if (c.addressLine1 && /[\n,]/.test(c.addressLine1) && !c.postcode && !c.town) {
      const flat = c.addressLine1.replace(/\r?\n/g, ', ');
      const parts = splitAddress(flat);
      if (parts.addressLine1) c.addressLine1 = parts.addressLine1;
      if (parts.addressLine2 && !c.addressLine2) c.addressLine2 = parts.addressLine2;
      if (parts.town && !c.town) c.town = parts.town;
      if (parts.county && !c.county) c.county = parts.county;
      if (parts.postcode && !c.postcode) c.postcode = parts.postcode;
    }
    // Normalise postcode if present
    if (c.postcode) {
      const np = normalisePostcode(c.postcode);
      if (np) c.postcode = np;
    }

    // Normalise tags → array
    if (c.tags && typeof c.tags === 'string') {
      c.tags = c.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      c.tags = [];
    }

    // Normalise accountStatus → active | suspended | cancelled
    if (c.accountStatus) {
      const s = c.accountStatus.toLowerCase().trim();
      if (s.includes('suspend')) c.accountStatus = 'suspended';
      else if (s.includes('cancel') || s.includes('inactive') || s.includes('closed'))
        c.accountStatus = 'cancelled';
      else c.accountStatus = 'active';
    }

    // Normalise numeric fields — strip currency symbols
    if (c.customerBalance)
      c.customerBalance = parseFloat(String(c.customerBalance).replace(/[^0-9.-]/g, '')) || 0;
    if (c.pricePerVisit)
      c.pricePerVisit = parseFloat(String(c.pricePerVisit).replace(/[^0-9.-]/g, '')) || null;

    // Duplicate check by email
    const isDupe = c.email && existingEmails.has(c.email.toLowerCase());

    customers.push({ data: c, isDupe });
  });

  return { customers, skipped };
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────
function StepPreview({
  rows,
  mapping,
  existingEmails,
  cpData,
  onBack,
  onImport,
  importing,
  importError,
}) {
  // ─── CleanerPlanner Jobs preview ────────────────────────────────────────────
  if (cpData) {
    const { entries, skipped } = cpData;
    const fresh = entries.filter((e) => !e.isDupe);
    const dupes = entries.filter((e) => e.isDupe);
    const totalRounds = entries.reduce((sum, e) => sum + e.rounds.length, 0);
    const withDueDates = entries.filter((e) => e.customer.dueDate).length;

    // Round name breakdown (top 4 rounds by customer count)
    const roundCounts = {};
    entries.forEach((e) =>
      e.rounds.forEach((r) => {
        const key = r.roundName || 'No round';
        roundCounts[key] = (roundCounts[key] || 0) + 1;
      })
    );
    const topRounds = Object.entries(roundCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return (
      <div className="flex flex-col overflow-hidden">
        <div className="p-6 border-b border-[rgba(153,197,255,0.1)]">
          <button
            onClick={onBack}
            disabled={importing}
            className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors disabled:opacity-40"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🧹</span>
            <h2 className="text-xl font-black text-white">Ready to import</h2>
          </div>
          <p className="text-xs text-[rgba(153,197,255,0.5)] mb-3">
            CleanerPlanner format detected — rounds, due dates and pricing mapped automatically.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <p className="text-lg font-black text-emerald-400">{fresh.length}</p>
              <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wide mt-0.5">
                Customers
              </p>
            </div>
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-center">
              <p className="text-lg font-black text-[#99c5ff]">
                {topRounds.length > 0 ? topRounds.length : totalRounds}
              </p>
              <p className="text-[10px] text-[rgba(153,197,255,0.5)] font-bold uppercase tracking-wide mt-0.5">
                Rounds
              </p>
            </div>
            <div
              className={`flex-1 px-3 py-2.5 rounded-xl text-center ${withDueDates === entries.length ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}
            >
              <p
                className={`text-lg font-black ${withDueDates === entries.length ? 'text-emerald-400' : 'text-amber-400'}`}
              >
                {withDueDates}
              </p>
              <p
                className={`text-[10px] font-bold uppercase tracking-wide mt-0.5 ${withDueDates === entries.length ? 'text-emerald-400/70' : 'text-amber-400/70'}`}
              >
                Due dates
              </p>
            </div>
            {dupes.length > 0 && (
              <div className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                <p className="text-lg font-black text-amber-400">{dupes.length}</p>
                <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wide mt-0.5">
                  Update
                </p>
              </div>
            )}
          </div>
          {/* Round breakdown */}
          {topRounds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topRounds.map(([name, count]) => (
                <span
                  key={name}
                  className="text-[10px] px-2 py-1 rounded-full bg-[rgba(153,197,255,0.08)] border border-[rgba(153,197,255,0.15)] text-[rgba(153,197,255,0.6)]"
                >
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
              {entries.length - withDueDates} customer
              {entries.length - withDueDates !== 1 ? 's' : ''} have no due date in this file —
              they'll be added to your customer list but won't appear on the schedule until you set
              a date.
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
              {skipped.length} row{skipped.length !== 1 ? 's' : ''} skipped (quotes, missing names,
              or cancelled).
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
                Import {entries.length} customer{entries.length !== 1 ? 's' : ''} + {totalRounds}{' '}
                round{totalRounds !== 1 ? 's' : ''}
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
  const fresh = customers.filter((c) => !c.isDupe);
  const dupes = customers.filter((c) => c.isDupe);
  const allSkipped = customers.length === 0 && skipped.length > 0;

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="p-6 border-b border-[rgba(153,197,255,0.1)]">
        <button
          onClick={onBack}
          disabled={importing}
          className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-4 transition-colors disabled:opacity-40"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <h2 className="text-xl font-black text-white">Ready to import</h2>
        <div className="flex gap-3 mt-3">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-lg font-black text-emerald-400">{fresh.length}</p>
            <p className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-wide mt-0.5">
              New customers
            </p>
          </div>
          {dupes.length > 0 && (
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-lg font-black text-amber-400">{dupes.length}</p>
              <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-wide mt-0.5">
                Will update
              </p>
            </div>
          )}
          {skipped.length > 0 && (
            <div className="flex-1 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
              <p className="text-lg font-black text-red-400">{skipped.length}</p>
              <p className="text-[10px] text-red-400/70 font-bold uppercase tracking-wide mt-0.5">
                Skipped
              </p>
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
            Customers marked "update" already exist in Cadi (matched by email). We'll update their
            details with the imported data.
          </div>
        )}
      </div>

      <div className="p-6 border-t border-[rgba(153,197,255,0.1)] space-y-3">
        {allSkipped && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            All {skipped.length} rows were skipped because no Name value was found. Go back and make
            sure a column is mapped to "Name".
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

// ─── Step 5: Done — celebration screen ────────────────────────────────────────
function StepDone({
  imported,
  rounds,
  jobs,
  upcomingJobs = [],
  onClose,
  onViewScheduler,
  batchId,
  onUndo,
}) {
  const hasSchedule = jobs > 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Count-up animation for the headline number
  const [displayCount, setDisplayCount] = useState(0);
  useEffect(() => {
    if (!imported) return;
    const duration = 900;
    const steps = 35;
    const inc = imported / steps;
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + inc, imported);
      setDisplayCount(Math.round(cur));
      if (cur >= imported) clearInterval(t);
    }, duration / steps);
    return () => clearInterval(t);
  }, [imported]);

  // Confetti squares — fired once on mount
  const confetti = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    left: `${(i * 4.2 + 2) % 94}%`,
    delay: `${(i * 0.07) % 0.75}s`,
    dur: `${0.95 + (i % 6) * 0.15}s`,
    color: ['#1f48ff', '#10b981', '#f59e0b', '#a78bfa', '#f472b6', '#34d399'][i % 6],
    size: `${5 + (i % 4)}px`,
  }));

  return (
    <div className="relative flex flex-col overflow-hidden">
      {/* ── keyframes — use longhands so inline duration/delay always win ── */}
      <style>{`
        @keyframes _confetti {
          0%   { transform: translateY(-10px) rotate(0deg) scale(1);   opacity: 1; }
          85%  { opacity: 1; }
          100% { transform: translateY(330px) rotate(680deg) scale(0.5); opacity: 0; }
        }
        @keyframes _pop {
          0%   { transform: scale(0.3); opacity: 0; }
          65%  { transform: scale(1.18); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes _ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes _up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        ._pop  {
          animation-name: _pop;
          animation-duration: 0.55s;
          animation-timing-function: cubic-bezier(0.34,1.56,0.64,1);
          animation-fill-mode: both;
        }
        ._ring {
          animation-name: _ring;
          animation-duration: 1s;
          animation-timing-function: ease-out;
          animation-fill-mode: both;
        }
        ._up1 { animation-name:_up; animation-duration:0.4s; animation-timing-function:ease-out; animation-delay:0.3s;  animation-fill-mode:both; }
        ._up2 { animation-name:_up; animation-duration:0.4s; animation-timing-function:ease-out; animation-delay:0.45s; animation-fill-mode:both; }
        ._up3 { animation-name:_up; animation-duration:0.4s; animation-timing-function:ease-out; animation-delay:0.6s;  animation-fill-mode:both; }
        ._conf {
          animation-name: _confetti;
          animation-timing-function: ease-in;
          animation-fill-mode: forwards;
        }
      `}</style>

      {/* Confetti burst */}
      <div className="absolute inset-x-0 top-0 h-56 pointer-events-none overflow-hidden">
        {confetti.map((c) => (
          <div
            key={c.id}
            className="_conf absolute rounded-sm"
            style={{
              left: c.left,
              top: '-8px',
              width: c.size,
              height: c.size,
              background: c.color,
              animationDuration: c.dur,
              animationDelay: c.delay,
            }}
          />
        ))}
      </div>

      {/* Soft emerald glow behind icon */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-48 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative p-6 flex flex-col items-center gap-5 overflow-y-auto">
        {/* Animated icon + ring */}
        <div className="relative mt-4 flex items-center justify-center">
          <div className="_ring absolute w-16 h-16 rounded-full bg-emerald-400/30" />
          <div className="_pop w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Check size={38} className="text-emerald-400" strokeWidth={2.5} />
          </div>
        </div>

        {/* Count-up headline */}
        <div className="_up1 text-center">
          <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-emerald-400/70 mb-1">
            Import complete
          </p>
          <h2 className="text-4xl font-black text-white leading-none">
            {displayCount.toLocaleString()}
          </h2>
          <p className="text-lg font-black mt-1" style={{ color: '#99c5ff' }}>
            {hasSchedule ? 'customers on your schedule' : 'customers added to Cadi'}
          </p>
          {hasSchedule && (
            <p className="text-sm text-[rgba(153,197,255,0.5)] mt-1.5">
              {jobs.toLocaleString()} jobs plotted across the next 4 months
              {rounds > 0 ? ` · ${rounds} services` : ''}
            </p>
          )}
        </div>

        {/* Schedule preview — shows they're really on the schedule */}
        {upcomingJobs.length > 0 && (
          <div className="_up2 w-full">
            <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[rgba(153,197,255,0.4)] mb-2 text-center">
              Your schedule starts here ↓
            </p>
            <div
              className="rounded-2xl border border-[rgba(153,197,255,0.12)] overflow-hidden"
              style={{ background: 'rgba(153,197,255,0.03)' }}
            >
              {upcomingJobs.map((job, i) => {
                const isPast = job.date < todayStr;
                const isToday = job.date === todayStr;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 ${i < upcomingJobs.length - 1 ? 'border-b border-[rgba(153,197,255,0.07)]' : ''}`}
                  >
                    {/* Date pill */}
                    <span
                      className={`text-[11px] font-black shrink-0 px-2.5 py-1 rounded-full ${
                        isPast
                          ? 'bg-amber-500/20 text-amber-300'
                          : isToday
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-[rgba(31,72,255,0.25)] text-[#99c5ff]'
                      }`}
                    >
                      {fmtJobDate(job.date)}
                    </span>
                    <span className="text-sm font-semibold text-white truncate flex-1">
                      {job.customer}
                    </span>
                    {job.price > 0 && (
                      <span className="text-sm font-black text-emerald-400 shrink-0">
                        £{job.price}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {jobs > upcomingJobs.length && (
              <p className="text-[11px] text-center text-[rgba(153,197,255,0.3)] mt-2">
                + {(jobs - upcomingJobs.length).toLocaleString()} more jobs over the next 4 months
              </p>
            )}
          </div>
        )}

        {/* No-schedule state */}
        {!hasSchedule && (
          <div className="_up2 w-full px-4 py-3.5 rounded-xl bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.12)] text-sm text-[rgba(153,197,255,0.6)] space-y-1.5">
            <p className="font-bold text-white">What's next?</p>
            <p>• View and edit customers from the Customers page</p>
            <p>• Add a schedule to each customer to populate the Scheduler</p>
          </div>
        )}

        {/* CTAs */}
        <div className="_up3 w-full space-y-2.5 pb-2">
          {hasSchedule && onViewScheduler && (
            <button
              onClick={onViewScheduler}
              className="w-full py-3.5 rounded-xl text-white text-sm font-black transition-all shadow-lg shadow-[#1f48ff]/40 hover:shadow-[#1f48ff]/60 active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #1f48ff 0%, #3a6bff 100%)' }}
            >
              See my schedule →
            </button>
          )}
          <button
            onClick={onClose}
            className={`w-full py-3 text-sm font-semibold rounded-xl transition-colors ${
              hasSchedule && onViewScheduler
                ? 'text-[rgba(153,197,255,0.4)] hover:text-[rgba(153,197,255,0.7)]'
                : 'bg-[#1f48ff] hover:bg-[#3a5eff] text-white font-black shadow-lg shadow-[#1f48ff]/30'
            }`}
          >
            {hasSchedule && onViewScheduler ? 'Back to dashboard' : 'View my customers'}
          </button>
          {batchId && onUndo && (
            <button
              onClick={onUndo}
              className="w-full py-2 text-[11px] font-semibold rounded-xl text-[rgba(153,197,255,0.45)] hover:text-red-300 transition-colors"
              title="Delete every customer, round and job created in this import"
            >
              Undo this import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Lite-plan customer cap modal ─────────────────────────────────────────────
function CapModal({ total, onUpgrade, onPick, onImportRecent }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden border border-[rgba(153,197,255,0.15)]"
        style={{ background: 'linear-gradient(160deg, #010b52 0%, #040e3e 60%, #0d1e78 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(153,197,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(153,197,255,1) 1px,transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative p-6">
          <div className="text-3xl mb-4">🏢</div>
          <h2 className="text-xl font-black text-white mb-2">
            You've got {total} customers — that's a real business.
          </h2>
          <p className="text-sm text-[rgba(153,197,255,0.7)] leading-relaxed mb-6">
            Cadi Lite holds your first {LITE_CAP} to get you started. Pro unlocks the rest plus
            automated reminders, recurring invoices, and profit tracking per customer.
            <br />
            <br />
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
                <p className="text-xs text-[rgba(255,255,255,0.7)] mt-0.5">
                  Unlock all {total} customers and everything else.
                </p>
              </div>
            </button>

            {/* Path B — Pick the first LITE_CAP. The badge mirrors the
                actual constant so the visual never drifts from the limit. */}
            <button
              onClick={onPick}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-[rgba(153,197,255,0.2)] bg-[rgba(153,197,255,0.05)] hover:bg-[rgba(153,197,255,0.1)] transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-[rgba(153,197,255,0.1)] flex items-center justify-center shrink-0 text-sm font-black text-[#99c5ff]">
                {LITE_CAP}
              </div>
              <div>
                <p className="text-sm font-bold text-white">Choose my first {LITE_CAP}</p>
                <p className="text-xs text-[rgba(153,197,255,0.5)] mt-0.5">
                  Pick which customers to bring in now. Upgrade later when you're ready.
                </p>
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
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
        return next;
      }
      if (next.size >= LITE_CAP) return prev; // cap reached
      next.add(i);
      return next;
    });
  };

  return (
    <div className="flex flex-col overflow-hidden max-h-[85vh]">
      <div className="p-5 border-b border-[rgba(153,197,255,0.1)] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-[rgba(153,197,255,0.5)] hover:text-[#99c5ff] mb-3 transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <h2 className="text-lg font-black text-white">
          Which {LITE_CAP} customers do you want in Cadi first?
        </h2>
        <p className="text-xs text-[rgba(153,197,255,0.5)] mt-1">
          The rest stay safe and load in when you upgrade.
        </p>
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm font-bold text-[#4f78ff]">
            {selected.size} of {LITE_CAP} selected
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="text-xs px-2 py-1.5 rounded-lg bg-[rgba(153,197,255,0.07)] border border-[rgba(153,197,255,0.15)] text-white"
          >
            <option value="name">Alphabetical</option>
          </select>
        </div>
        <div className="h-1.5 bg-[rgba(153,197,255,0.1)] rounded-full mt-2">
          <div
            className="h-full bg-[#4f78ff] rounded-full transition-all"
            style={{ width: `${(selected.size / LITE_CAP) * 100}%` }}
          />
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
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected ? 'bg-[#4f78ff] border-[#4f78ff]' : 'border-[rgba(153,197,255,0.3)]'
                }`}
              >
                {isSelected && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <div className="w-7 h-7 rounded-full bg-[rgba(31,72,255,0.2)] flex items-center justify-center shrink-0 text-xs font-bold text-[#99c5ff]">
                {c.data.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{c.data.name}</p>
                {(c.data.email || c.data.postcode) && (
                  <p className="text-[10px] text-[rgba(153,197,255,0.4)] truncate">
                    {[c.data.email, c.data.postcode].filter(Boolean).join(' · ')}
                  </p>
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
  const rows = customers.map((c) => ({ business_id: bizId, customer_data: c.data }));
  await supabase.from('pending_customers').insert(rows);
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function CustomerImport({
  onClose,
  onImported,
  onViewScheduler,
  existingCustomers = [],
}) {
  const { isPro } = usePlan();
  const [step, setStep] = useState('source'); // source | upload | map | preview | cap | pick | done
  const [source, setSource] = useState(null);
  const [csvData, setCsvData] = useState(null); // { headers, rows, fileName }
  const [detectedSource, setDetectedSource] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [cpData, setCpData] = useState(null); // CleanerPlanner Jobs: { entries, skipped }
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [importedRoundCount, setImportedRoundCount] = useState(0);
  const [importedJobCount, setImportedJobCount] = useState(0);
  const [importedUpcomingJobs, setImportedUpcomingJobs] = useState([]);
  const [importError, setImportError] = useState(null);
  const [pendingCustomers, setPendingCustomers] = useState([]);
  const [showCap, setShowCap] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [capMode, setCapMode] = useState('csv'); // 'csv' | 'cp' — which importer the cap modal drives
  const [lastImportBatchId, setLastImportBatchId] = useState(null);

  const handleUndoImport = async () => {
    if (!lastImportBatchId) return;
    if (
      !window.confirm(
        'Undo this import? Every customer, round and job created by this run will be permanently deleted.'
      )
    )
      return;
    try {
      const r = await rollbackBatch(lastImportBatchId);
      try {
        localStorage.removeItem('cadi_last_import_batch');
      } catch {}
      setLastImportBatchId(null);
      window.alert(
        `Reversed: ${r.customers} customers, ${r.rounds} rounds, ${r.jobs} jobs, ${r.recurringJobs} recurring rules removed.`
      );
      onImported?.();
      onClose?.();
    } catch (err) {
      window.alert(`Couldn't undo: ${err?.message ?? 'unknown error'}`);
    }
  };

  const existingEmails = new Set(
    existingCustomers.map((c) => c.email?.toLowerCase()).filter(Boolean)
  );
  const existingCustRefs = new Set(
    existingCustomers.map((c) => c.customer_reference).filter(Boolean)
  );

  // CleanerPlanner Jobs import: create customers, rounds, then auto-schedule jobs.
  // Every row created here is stamped with the same import_batch_id so the
  // entire import can be undone in one click.
  const doImportCP = async (entries) => {
    setImporting(true);
    setImportError(null);
    const batchId = newImportBatchId();
    let count = 0;
    let roundCount = 0;
    const failures = [];
    const jobsToCreate = [];
    // Lite hard cap — divert overflow to pending_customers rather than letting
    // the enforce_free_customer_limit trigger reject the insert with a 400.
    const existingActiveCP = existingCustomers.filter(
      (c) => (c.status ?? 'active') !== 'archived'
    ).length;
    const overflowPending = [];

    for (let i = 0; i < entries.length; i++) {
      const { customer, rounds } = entries[i];
      if (!isPro && existingActiveCP + count >= LITE_CAP) {
        overflowPending.push({ data: customer });
        continue;
      }
      try {
        const saved = await upsertCustomer({
          ...customer,
          importBatchId: batchId,
          source: customer.source ?? 'import:cleaner-planner',
        });
        count++;
        if (rounds.length > 0 && saved?.id) {
          try {
            await deleteRoundsForCustomer(saved.id);
            await bulkInsertRounds(
              rounds.map((r) => ({ ...r, customerId: saved.id, importBatchId: batchId }))
            );
            roundCount += rounds.length;
          } catch (re) {
            console.warn(`Rounds insert failed for row ${i}: ${re?.message}`);
          }

          // Build scheduled jobs for the next 4 months
          const jobType = detectJobType(customer.name);
          for (const round of rounds) {
            if (round.accountStatus === 'cancelled' || round.accountStatus === 'suspended')
              continue;
            const dates = generateJobDatesFromRound(round, 4);
            for (const date of dates) {
              jobsToCreate.push({
                customerId: saved.id,
                customer: customer.name,
                addressLine1: customer.addressLine1 || null,
                addressLine2: customer.addressLine2 || null,
                town: customer.town || null,
                county: customer.county || null,
                postcode: customer.postcode || '',
                date,
                type: jobType,
                service: round.roundName || 'Window clean',
                price: round.pricePerVisit || 0,
                recurrence: round.schedule || 'one-off',
                isRecurring: (parseFrequencyDays(round.schedule) ?? 0) > 0,
                notes: round.jobReference ? `Job ref: ${round.jobReference}` : '',
                importBatchId: batchId,
              });
            }
          }
        }
      } catch (err) {
        console.error(`CP import row ${i} failed: ${err?.message}`);
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
      .filter((j) => j.date >= todayStr)
      .slice(0, 5);

    if (overflowPending.length > 0) {
      try {
        await storePendingCustomers(overflowPending);
      } catch (e) {
        console.warn('pending_customers store failed (CP)', e);
      }
    }

    setImporting(false);
    if (count > 0) {
      setImportedCount(count);
      setImportedRoundCount(roundCount);
      setImportedJobCount(jobCount);
      setImportedUpcomingJobs(upcoming);
      setLastImportBatchId(batchId);
      try {
        localStorage.setItem(
          'cadi_last_import_batch',
          JSON.stringify({
            id: batchId,
            at: Date.now(),
            source: 'cleaner-planner',
            customers: count,
            rounds: roundCount,
            jobs: jobCount,
          })
        );
      } catch {}
      setStep('done');
      onImported?.();
    } else {
      setImportError(`Import failed: ${failures[0] ?? 'Unknown error'}`);
    }
  };

  const handleImportCP = async (entries) => {
    // Resolve existing customer ids so upsert updates rather than inserts duplicates
    const refToId = new Map(
      existingCustomers.filter((c) => c.customer_reference).map((c) => [c.customer_reference, c.id])
    );
    const resolved = entries.map((e) => ({
      ...e,
      customer: {
        ...e.customer,
        id: e.customer.customerReference ? refToId.get(e.customer.customerReference) : undefined,
      },
    }));

    const existingActive = existingCustomers.filter(
      (c) => (c.status ?? 'active') !== 'archived'
    ).length;
    const fresh = resolved.filter((e) => !e.isDupe);
    if (!isPro && existingActive + fresh.length > LITE_CAP) {
      // Same choose-30-or-upgrade popup as the standard CSV path. Wrap each
      // entry as { data } so CapModal / CustomerPicker can render it, keeping
      // the original CleanerPlanner entry on __cp for the importer.
      setCapMode('cp');
      setPendingCustomers(resolved.map((e) => ({ data: e.customer, __cp: e })));
      setShowCap(true);
      return;
    }
    await doImportCP(resolved);
  };

  const doImport = async (customers, overflow = []) => {
    setImporting(true);
    setImportError(null);
    const batchId = newImportBatchId();
    let count = 0;
    const failures = [];
    // Lite hard cap — never attempt an insert the enforce_free_customer_limit
    // trigger will reject (which surfaces as a raw 400). Anything past the cap
    // is diverted to pending_customers instead of hitting the DB.
    const existingActive = existingCustomers.filter(
      (c) => (c.status ?? 'active') !== 'archived'
    ).length;
    const cappedOverflow = [];
    for (let i = 0; i < customers.length; i++) {
      if (!isPro && existingActive + count >= LITE_CAP) {
        cappedOverflow.push(customers[i]);
        continue;
      }
      try {
        await upsertCustomer({ ...customers[i].data, importBatchId: batchId });
        count++;
      } catch (err) {
        console.error(`Import row ${i} failed: ${err?.message}`);
        failures.push(err?.message || 'Unknown error');
      }
    }
    const allOverflow = [...overflow, ...cappedOverflow];
    if (allOverflow.length > 0) {
      try {
        await storePendingCustomers(allOverflow);
      } catch (e) {
        console.warn('pending_customers store failed', e);
      }
    }
    setImporting(false);
    if (count > 0) {
      setImportedCount(count);
      setLastImportBatchId(batchId);
      try {
        localStorage.setItem(
          'cadi_last_import_batch',
          JSON.stringify({ id: batchId, at: Date.now(), source: 'csv', customers: count })
        );
      } catch {}
      setStep('done');
      onImported?.();
    } else {
      const msg = failures[0] ?? 'Unknown error';
      setImportError(`Import failed: ${msg}`);
    }
  };

  const handleImport = async (customers) => {
    const freshCustomers = customers.filter((c) => !c.isDupe);
    const existingActive = existingCustomers.filter(
      (c) => (c.status ?? 'active') !== 'archived'
    ).length;
    if (!isPro && existingActive + freshCustomers.length > LITE_CAP) {
      setCapMode('csv');
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
    if (capMode === 'cp') {
      // doImportCP applies the same Lite cap internally and stages the rest.
      await doImportCP(pendingCustomers.map((p) => p.__cp));
      return;
    }
    const toImport = pendingCustomers.slice(0, LITE_CAP);
    const overflow = pendingCustomers.slice(LITE_CAP);
    await doImport(toImport, overflow);
  };

  const handlePickerConfirm = async (selectedIndices) => {
    setShowPicker(false);
    if (capMode === 'cp') {
      const entries = pendingCustomers.map((p) => p.__cp);
      const selectedSet = new Set(selectedIndices);
      const selected = selectedIndices.map((i) => entries[i]);
      const rest = entries.filter((_, i) => !selectedSet.has(i));
      // Stage the unpicked ones so they load in on upgrade, then import the picks.
      if (rest.length > 0) {
        try {
          await storePendingCustomers(rest.map((e) => ({ data: e.customer })));
        } catch (e) {
          console.warn('pending_customers store failed (CP)', e);
        }
      }
      await doImportCP(selected);
      return;
    }
    const toImport = selectedIndices.map((i) => pendingCustomers[i]);
    const overflow = pendingCustomers.filter((_, i) => !selectedIndices.includes(i));
    await doImport(toImport, overflow);
  };

  return (
    <>
      <ModalShell onClose={onClose}>
        {step === 'source' && (
          <StepSource
            onSelect={(src) => {
              setSource(src);
              setStep('upload');
            }}
          />
        )}
        {step === 'upload' && (
          <StepUpload
            source={source}
            onBack={() => setStep('source')}
            onParsed={(data) => {
              setCsvData(data);
              const detected = detectSource(data.headers);
              setDetectedSource(detected);
              if (isCleanerPlannerJobs(data.headers) || detected === 'cleaner-planner') {
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
            detectedSource={detectedSource}
            onBack={() => setStep('upload')}
            onConfirm={(m) => {
              setMapping(m);
              setStep('preview');
            }}
          />
        )}
        {step === 'preview' && (
          <StepPreview
            rows={csvData?.rows ?? []}
            mapping={mapping ?? {}}
            existingEmails={existingEmails}
            cpData={cpData}
            onBack={() => (cpData ? setStep('upload') : setStep('map'))}
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
            batchId={lastImportBatchId}
            onUndo={handleUndoImport}
          />
        )}
      </ModalShell>

      {/* Lite-plan cap modal — renders outside ModalShell so it's above everything */}
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
            <button
              onClick={() => setShowPicker(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-white" />
            </button>
            <CustomerPicker
              customers={pendingCustomers}
              onConfirm={handlePickerConfirm}
              onBack={() => {
                setShowPicker(false);
                setShowCap(true);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
