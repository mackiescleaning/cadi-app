#!/usr/bin/env node
// seed-chris-test.js
// Creates a test user "chris-test@cadi.cleaning" and imports Jobs-2.csv
// under that account. Safe to run multiple times — skips if user already exists.
//
// Usage:
//   SUPABASE_SERVICE_KEY=<your-service-role-key> node scripts/seed-chris-test.js
//
// Get your service role key from:
//   Supabase Dashboard → Project Settings → API → service_role key

import { createClient } from '@supabase/supabase-js';
import { createReadStream } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL  = 'https://cufgozpwbinjhjnkimmn.supabase.co';
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const CSV_PATH      = resolve(__dirname, '../../Downloads/Jobs-2.csv');
const TEST_EMAIL    = 'chris-test@cadi.cleaning';
const TEST_PASSWORD = 'ChrisTest2026!';
const TEST_NAME     = 'Chris Test';
const BIZ_NAME      = "Chris's Window Cleaning";

if (!SERVICE_KEY) {
  console.error('ERROR: set SUPABASE_SERVICE_KEY env var (service_role key from Supabase dashboard)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h.trim()] = (vals[i] ?? '').trim(); });
    return row;
  }).filter(r => Object.values(r).some(v => v !== ''));
}

function parseCsvLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// ─── Parse helpers (mirrors CustomerImport.jsx logic) ─────────────────────────
function parseCurrency(str) {
  if (!str) return null;
  const s = String(str).trim();
  if (s.toLowerCase() === 'quote' || s === '') return null;
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(str) {
  if (!str) return null;
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function parseFreqDays(schedule) {
  if (!schedule) return null;
  const s = schedule.toLowerCase().trim();
  if (s.includes('one off') || s.includes('one-off')) return 0;
  const w = s.match(/(\d+)\s*week/);  if (w) return parseInt(w[1]) * 7;
  const mo = s.match(/(\d+)\s*month/); if (mo) return parseInt(mo[1]) * 30;
  if (s === 'weekly') return 7;
  if (s === 'fortnightly') return 14;
  if (s === 'monthly') return 30;
  return null;
}

function buildJobDates(dueDate, schedule, windowMonths = 4) {
  if (!dueDate) return [];
  const freqDays = parseFreqDays(schedule);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const end = new Date(today); end.setMonth(end.getMonth() + windowMonths);

  if (freqDays === 0) {
    const d = new Date(dueDate + 'T00:00:00');
    if ((today - d) > 365 * 86400000) return [];
    return [dueDate];
  }
  if (!freqDays) return [];

  const start = new Date(dueDate + 'T00:00:00');
  if (start < today) {
    const skips = Math.ceil((today - start) / (freqDays * 86400000));
    start.setDate(start.getDate() + skips * freqDays);
  }
  const dates = [];
  const cur = new Date(start);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + freqDays);
  }
  return dates;
}

function detectJobType(name) {
  const lower = (name || '').toLowerCase();
  const commercial = ['ltd','limited','plc','management','lettings','school','hotel','inn','lodge','apartments','surgery','clinic','detection','primary','college','starbucks','academy','court','house'];
  return commercial.some(w => lower.includes(w)) ? 'commercial' : 'exterior';
}

// ─── Build customer + rounds map from CSV rows ────────────────────────────────
function buildData(rows) {
  const map = new Map();
  const skipped = [];

  for (const row of rows) {
    const get = k => (row[k] ?? '').trim();
    const custRef  = get('Cust Ref');
    const rawName  = get('Name');
    const address  = get('Address Line 1');
    const name     = rawName || address;
    const status   = get('Status').toLowerCase();
    const cancelled = get('Cancelled');

    if (!name)              { skipped.push({ name, reason: 'No name' }); continue; }
    if (status === 'quote') { skipped.push({ name, reason: 'Quote'  }); continue; }

    const key = custRef || `${name}::${address}`.toLowerCase();
    const accountStatus = cancelled ? 'cancelled'
      : status.includes('suspend') ? 'suspended'
      : 'active';

    const price   = parseCurrency(get('Price'));
    const balance = parseCurrency(get('Balance')) ?? 0;
    const dueDate = parseDate(get('Due'));
    const schedule  = get('Schedule') || null;
    const roundName = get('Round') || null;
    const jobRef    = get('Job Ref') || null;

    const round = { jobReference: jobRef, roundName, schedule, pricePerVisit: price, dueDate, accountStatus };

    if (!map.has(key)) {
      map.set(key, {
        customer: {
          name,
          address_line1: address || null,
          phone:  get('Mobile') || get('Phone') || null,
          email:  get('Email') || null,
          customer_reference: custRef || null,
          status: accountStatus === 'active' ? 'active' : 'inactive',
          frequency: schedule,
          tags: [],
        },
        rounds: [round],
      });
    } else {
      map.get(key).rounds.push(round);
    }
  }

  console.log(`  Parsed: ${map.size} customers, ${skipped.length} skipped (quotes/unnamed)`);
  return [...map.values()];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🧹 Chris test account seeder\n');

  // 1. Create or fetch test user
  console.log(`→ Checking for ${TEST_EMAIL}…`);
  const { data: listData } = await supabase.auth.admin.listUsers();
  let user = listData?.users?.find(u => u.email === TEST_EMAIL);

  if (user) {
    console.log(`  User already exists: ${user.id}`);
  } else {
    console.log(`  Creating user…`);
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { first_name: TEST_NAME, business_name: BIZ_NAME },
    });
    if (error) { console.error('Failed to create user:', error.message); process.exit(1); }
    user = created.user;
    console.log(`  Created: ${user.id}`);
    // Give triggers a moment to fire (profile + business auto-creation)
    await new Promise(r => setTimeout(r, 1500));
  }

  const userId = user.id;

  // 2. Ensure profile exists (trigger should have fired, but be safe)
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (!existingProfile) {
    await supabase.from('profiles').upsert({
      id: userId,
      first_name: TEST_NAME,
      business_name: BIZ_NAME,
    }, { onConflict: 'id' });
    console.log('  Profile created manually (trigger may not have fired yet)');
  }

  // 3. Ensure business exists
  let { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle();

  if (!biz) {
    const { data: newBiz } = await supabase
      .from('businesses')
      .insert({ owner_user_id: userId, name: BIZ_NAME })
      .select('id')
      .single();
    biz = newBiz;
    console.log('  Business created manually');
  }

  const bizId = biz.id;
  console.log(`  Business ID: ${bizId}\n`);

  // 4. Read & parse CSV
  console.log(`→ Reading ${CSV_PATH}…`);
  const csvText = await new Promise((res, rej) => {
    let buf = '';
    createReadStream(CSV_PATH, 'utf8')
      .on('data', chunk => { buf += chunk; })
      .on('end', () => res(buf))
      .on('error', rej);
  });
  const rows = parseCsv(csvText);
  console.log(`  ${rows.length} CSV rows`);

  const entries = buildData(rows);

  // 5. Delete existing data for this test user (clean re-run)
  console.log('\n→ Clearing previous test data…');
  const { data: existing } = await supabase.from('customers').select('id').eq('owner_id', userId);
  if (existing?.length) {
    const ids = existing.map(c => c.id);
    await supabase.from('customer_rounds').delete().in('customer_id', ids);
    await supabase.from('jobs').delete().in('customer_id', ids);
    await supabase.from('customers').delete().eq('owner_id', userId);
    console.log(`  Cleared ${ids.length} previous customers + their rounds/jobs`);
  } else {
    console.log('  Nothing to clear');
  }

  // 6. Insert customers
  console.log(`\n→ Inserting ${entries.length} customers…`);
  let custOk = 0, custFail = 0;
  const idMap = new Map(); // entry index → saved customer id

  for (let i = 0; i < entries.length; i++) {
    const { customer } = entries[i];
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...customer, owner_id: userId })
      .select('id')
      .single();

    if (error) {
      console.warn(`  WARN: ${customer.name} — ${error.message}`);
      custFail++;
    } else {
      idMap.set(i, data.id);
      custOk++;
    }
  }
  console.log(`  ${custOk} inserted, ${custFail} failed`);

  // 7. Insert rounds
  console.log(`\n→ Inserting rounds…`);
  const allRounds = [];
  for (let i = 0; i < entries.length; i++) {
    const custId = idMap.get(i);
    if (!custId) continue;
    for (const r of entries[i].rounds) {
      allRounds.push({
        business_id:      bizId,
        customer_id:      custId,
        job_reference:    r.jobReference,
        round_name:       r.roundName,
        schedule:         r.schedule,
        price_per_visit:  r.pricePerVisit,
        due_date:         r.dueDate,
        account_status:   r.accountStatus,
      });
    }
  }
  const { error: roundErr } = await supabase.from('customer_rounds').insert(allRounds);
  if (roundErr) console.warn(`  Rounds insert error: ${roundErr.message}`);
  else console.log(`  ${allRounds.length} rounds inserted`);

  // 8. Generate scheduled jobs (next 4 months)
  console.log(`\n→ Generating scheduled jobs…`);
  const jobRows = [];
  for (let i = 0; i < entries.length; i++) {
    const custId = idMap.get(i);
    if (!custId) continue;
    const { customer, rounds } = entries[i];
    const jobType = detectJobType(customer.name);
    for (const r of rounds) {
      if (r.accountStatus !== 'active') continue;
      const dates = buildJobDates(r.dueDate, r.schedule, 4);
      for (const date of dates) {
        jobRows.push({
          owner_id:     userId,
          customer_id:  custId,
          customer:     customer.name,
          postcode:     customer.address_line1 || '',
          date,
          start_hour:   9,
          duration_hrs: 1,
          type:         jobType,
          service:      r.roundName || 'Window clean',
          price:        r.pricePerVisit || 0,
          status:       'scheduled',
          recurrence:   r.schedule || 'one-off',
          notes:        r.jobReference ? `Job ref: ${r.jobReference}` : '',
        });
      }
    }
  }

  if (jobRows.length > 0) {
    // Insert in batches of 200 to avoid request size limits
    let jobOk = 0;
    for (let i = 0; i < jobRows.length; i += 200) {
      const batch = jobRows.slice(i, i + 200);
      const { error: je } = await supabase.from('jobs').insert(batch);
      if (je) console.warn(`  Jobs batch error: ${je.message}`);
      else jobOk += batch.length;
    }
    console.log(`  ${jobOk} jobs scheduled across next 4 months`);
  } else {
    console.log('  No future jobs generated (all one-offs or no due dates)');
  }

  console.log(`
✅ Done!

  Login at your staging URL with:
    Email:    ${TEST_EMAIL}
    Password: ${TEST_PASSWORD}

  Then open Customers → Scheduler to test the auto-schedule.
  This data is completely separate from your Cadi account.
`);
}

main().catch(err => { console.error(err); process.exit(1); });
