/**
 * src/lib/statements/parseStatement.js
 * Cadi — client-side bank-statement parsers for the upload bridge.
 *
 * Turns an uploaded statement into normalised rows the `statement-import` edge
 * function understands:
 *   { date: 'YYYY-MM-DD', amount: number (+credit / -debit), description, balance? }
 *
 * Supports:
 *   - OFX / QFX  (structured — parsed straight to rows)
 *   - QIF        (structured — parsed straight to rows)
 *   - CSV / Excel (needs a column-mapping step, since every bank differs)
 *
 * OFX/QIF are the preferred formats: unambiguous dates and signed amounts, no
 * mapping needed. CSV is the fallback and goes through mapColumns() first.
 */

import * as XLSX from 'xlsx';

export function detectFormat(filename = '', text = '') {
  const name = filename.toLowerCase();
  if (name.endsWith('.ofx') || name.endsWith('.qfx')) return 'ofx';
  if (name.endsWith('.qif')) return 'qif';
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) return 'tabular';
  if (name.endsWith('.csv')) return 'tabular';
  // Sniff content when the extension is missing/wrong
  const head = text.slice(0, 400).toUpperCase();
  if (head.includes('<OFX>') || head.includes('OFXHEADER')) return 'ofx';
  if (/^!TYPE:/m.test(text) || head.includes('!TYPE:')) return 'qif';
  return 'tabular';
}

// ── OFX / QFX ───────────────────────────────────────────────────────────────
function ofxDate(raw) {
  // YYYYMMDD[HHMMSS][.xxx][+tz] → YYYY-MM-DD
  const m = (raw || '').match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseOFX(text) {
  const rows = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const seg = block.split(/<\/STMTTRN>/i)[0];
    const tag = (name) => {
      // OFX tags are often unclosed: <TRNAMT>-12.50\n<NEXTTAG>
      const re = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i');
      const mm = seg.match(re);
      return mm ? mm[1].trim() : '';
    };
    const date = ofxDate(tag('DTPOSTED'));
    const amount = parseFloat(tag('TRNAMT'));
    if (!date || !Number.isFinite(amount)) continue;
    const name = tag('NAME');
    const memo = tag('MEMO');
    rows.push({
      date,
      amount,
      description: [name, memo].filter(Boolean).join(' — ') || 'Transaction',
      merchant: name || '',
      balance: null,
    });
  }
  return rows;
}

// ── QIF ───────────────────────────────────────────────────────────────────────
function qifDate(raw) {
  // QIF is messy: D format is often M/D'YY or D/M/YYYY. Assume UK D/M/Y unless
  // the first field clearly exceeds 12 (then it's a day) — best-effort.
  const m = (raw || '').replace(/'/g, '/').match(/(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})/);
  if (!m) return null;
  let [, a, b, c] = m;
  let y, mo, d;
  if (a.length === 4) {
    y = a;
    mo = b;
    d = c;
  } // YYYY/M/D
  else {
    d = a;
    mo = b;
    y = c;
  } // D/M/YY(YY)  (UK)
  if (y.length === 2) y = (Number(y) > 70 ? '19' : '20') + y;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseQIF(text) {
  const rows = [];
  let cur = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const code = line[0];
    const val = line.slice(1).trim();
    if (code === 'D') cur.date = qifDate(val);
    else if (code === 'T' || code === 'U') cur.amount = parseFloat(val.replace(/[£$€,\s]/g, ''));
    else if (code === 'P') cur.payee = val;
    else if (code === 'M') cur.memo = val;
    else if (code === '^') {
      if (cur.date && Number.isFinite(cur.amount)) {
        rows.push({
          date: cur.date,
          amount: cur.amount,
          description: [cur.payee, cur.memo].filter(Boolean).join(' — ') || 'Transaction',
          merchant: cur.payee || '',
          balance: null,
        });
      }
      cur = {};
    }
  }
  return rows;
}

// ── CSV / Excel ─────────────────────────────────────────────────────────────
// Returns { headers, rows } where rows is an array-of-arrays (no header row).
export async function parseTabular(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
  // Find the header row: first row where >=2 cells are non-empty strings
  let headerIdx = 0;
  for (let i = 0; i < Math.min(aoa.length, 15); i++) {
    const nonEmpty = aoa[i].filter((c) => String(c).trim() !== '').length;
    if (nonEmpty >= 2) {
      headerIdx = i;
      break;
    }
  }
  const headers = (aoa[headerIdx] || []).map((h) => String(h).trim());
  const rows = aoa.slice(headerIdx + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
  return { headers, rows };
}

// Guess a column mapping from header names. Returns indexes (or -1).
// `merchant` is the payer/payee name (used for invoice matching); `category` is
// the bank's own spending category (e.g. Starling's "Spending Category"), which
// — when present — drives auto-categorisation server-side.
const HINTS = {
  date: [/date/i, /posted/i],
  amount: [/^amount/i, /^value$/i],
  paidIn: [/paid in/i, /money in/i, /^credit$/i, /^in$/i, /receipts?/i],
  paidOut: [/paid out/i, /money out/i, /^debit$/i, /^out$/i, /payments?/i, /withdrawn/i],
  merchant: [/counter\s*party/i, /payee/i, /merchant/i, /paid to/i, /^name$/i],
  desc: [/reference/i, /details|narrative|memo|notes/i, /description/i],
  category: [/spending\s*category/i, /category/i],
  balance: [/balance/i],
};

function matchCol(headers, patterns) {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i !== -1) return i;
  }
  return -1;
}

export function autoMap(headers) {
  const m = {
    date: matchCol(headers, HINTS.date),
    amount: matchCol(headers, HINTS.amount),
    paidIn: matchCol(headers, HINTS.paidIn),
    paidOut: matchCol(headers, HINTS.paidOut),
    merchant: matchCol(headers, HINTS.merchant),
    desc: matchCol(headers, HINTS.desc),
    category: matchCol(headers, HINTS.category),
    balance: matchCol(headers, HINTS.balance),
  };
  // Fallback: if we found no reference/description column, reuse the name column
  if (m.desc === -1 && m.merchant !== -1) m.desc = m.merchant;
  return m;
}

function toNum(v) {
  if (v == null) return null;
  let s = String(v)
    .trim()
    .replace(/[£$€,\s]/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith('-')) {
    neg = true;
    s = s.slice(0, -1);
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -Math.abs(n) : n;
}

// Apply a mapping to array-of-arrays rows → normalised rows.
// Supports either a single signed `amount` column, or separate paidIn/paidOut.
export function rowsFromMapping(rows, mapping) {
  const out = [];
  for (const r of rows) {
    const rawDate = mapping.date >= 0 ? r[mapping.date] : '';
    let amount = null;
    if (mapping.amount >= 0) {
      amount = toNum(r[mapping.amount]);
    } else {
      const inAmt = mapping.paidIn >= 0 ? toNum(r[mapping.paidIn]) : null;
      const outAmt = mapping.paidOut >= 0 ? toNum(r[mapping.paidOut]) : null;
      if (inAmt != null && inAmt !== 0) amount = Math.abs(inAmt);
      else if (outAmt != null && outAmt !== 0) amount = -Math.abs(outAmt);
    }
    const merchant = mapping.merchant >= 0 ? String(r[mapping.merchant] ?? '').trim() : '';
    const desc = mapping.desc >= 0 ? String(r[mapping.desc] ?? '').trim() : '';
    const bankCategory = mapping.category >= 0 ? String(r[mapping.category] ?? '').trim() : '';
    const balance = mapping.balance >= 0 ? toNum(r[mapping.balance]) : null;
    if (rawDate === '' || amount == null || amount === 0) continue;
    out.push({
      date: String(rawDate).trim(),
      amount,
      description: desc || merchant,
      merchant,
      balance,
      bankCategory,
    });
  }
  return out;
}

/**
 * One-shot entry: parse a file into either finished rows (OFX/QIF) or a tabular
 * payload needing column mapping.
 * Returns { kind: 'rows', rows } or { kind: 'tabular', headers, rows, mapping }.
 */
export async function parseStatementFile(file) {
  const isText = /\.(ofx|qfx|qif|csv)$/i.test(file.name) || file.size < 5_000_000;
  const text = isText ? await file.text() : '';
  const fmt = detectFormat(file.name, text);

  if (fmt === 'ofx') return { kind: 'rows', rows: parseOFX(text) };
  if (fmt === 'qif') return { kind: 'rows', rows: parseQIF(text) };

  const { headers, rows } = await parseTabular(file);
  return { kind: 'tabular', headers, rows, mapping: autoMap(headers) };
}
