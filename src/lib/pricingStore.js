import { createMoneyEntry, listMoneyEntries } from './db/moneyDb';
import { createQuote, updateQuoteStatus } from './db/quotesDb';

const QUOTES_STORAGE_KEY = 'cleaning-blueprints.pricing-quotes';
const INCOME_STORAGE_KEY = 'cleaning-blueprints.pricing-income';

function readArray(key) {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key, value) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function getStoredPricingQuotes() {
  return readArray(QUOTES_STORAGE_KEY);
}

export async function saveStoredPricingQuotes(quotes) {
  writeArray(QUOTES_STORAGE_KEY, quotes);
}

function mapMoneyRowToLegacyEntry(row) {
  return {
    id: row.id,
    client: row.client || 'Quote Accepted',
    amount: Number(row.amount) || 0,
    date: row.date,
    method: row.method || 'Quote Accepted',
    notes: row.notes || '',
    type: row.kind || 'income',
  };
}

export async function getStoredPricingIncome() {
  try {
    const rows = await listMoneyEntries();
    return rows.map(mapMoneyRowToLegacyEntry);
  } catch {
    return readArray(INCOME_STORAGE_KEY);
  }
}

export async function saveStoredPricingIncome(entries) {
  writeArray(INCOME_STORAGE_KEY, entries);
}

export function quoteToIncomeEntry(quote) {
  const entryDate = quote.date ? quote.date.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return {
    id: `pricing-${entryDate}-${quote.jobLabel}-${quote.price}`,
    client: `${quote.type} — ${quote.jobLabel}`,
    amount: Number(quote.price) || 0,
    date: entryDate,
    method: 'Quote Accepted',
    notes: quote.notes || 'Accepted from pricing calculator',
    type: 'income',
  };
}

export async function saveDraftQuote(quote) {
  return await createQuote({
    type: quote.type,
    customer: quote.customer,
    jobLabel: quote.jobLabel || quote.customer || quote.type,
    price: quote.price,
    hrs: quote.hrs,
    notes: quote.notes,
    payload: quote,
    status: quote.status || 'draft',
  });
}

export async function acceptSavedQuote(savedQuote) {
  const entry = quoteToIncomeEntry(savedQuote);

  // Always save to localStorage as backup first
  const existing = readArray(INCOME_STORAGE_KEY);
  const next = [entry, ...existing.filter((item) => item.id !== entry.id)];
  writeArray(INCOME_STORAGE_KEY, next);

  // Upgrade the quote's status in Supabase
  if (savedQuote.id) {
    await updateQuoteStatus(savedQuote.id, 'accepted');
  }

  // Create the income entry
  await createMoneyEntry({
    quoteId: savedQuote.id ?? null,
    client: entry.client,
    amount: entry.amount,
    date: entry.date,
    method: entry.method,
    notes: entry.notes,
    kind: 'income',
  });

  return await getStoredPricingIncome();
}

// Legacy: creates an accepted quote in one step. Prefer saveDraftQuote + acceptSavedQuote.
export async function addAcceptedQuoteIncome(quote) {
  const saved = await saveDraftQuote({ ...quote, status: 'accepted' });
  return await acceptSavedQuote({ ...quote, id: saved.id });
}