// src/lib/dashboardCache.js
// Module-level TTL cache shared by the dashboard's useCleanProData hook and the
// money DB write helpers. Kept in a dependency-free module so any write
// (createMoneyEntry / updateMoneyEntry / deleteMoneyEntry, or marking an invoice
// paid) can invalidate the dashboard's cached read without creating an import
// cycle between moneyDb and useCleanProData.

export const DB_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// { [userId]: { ts, settings, invoices, moneyEntries } }
export const _dbCache = {};

// Invalidate the cache so the next dashboard mount re-reads from the DB. Call
// after any write that changes money/invoices so the dashboard reflects it
// immediately instead of after the TTL.
export function bustCleanProDataCache() {
  for (const key of Object.keys(_dbCache)) delete _dbCache[key];
}
