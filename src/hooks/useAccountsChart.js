// src/hooks/useAccountsChart.js
// Cadi — loads the per-business chart of accounts + tax profile once and exposes the
// derived helpers the money-confidence redesign (P2) reads: lane lookups, the
// personal-lane noun (Drawings vs Director's loan), and a lane→categories index.
//
// Backs onto src/lib/db/accountsDb.js. Falls back to sole-trader framing when the
// tax profile isn't seeded yet so the UI never blanks.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getAccountsContext,
  laneForKey,
  personalNoun,
  LANES,
  LANE_META,
} from '../lib/db/accountsDb';

export function useAccountsChart() {
  const { user } = useAuth();
  const [state, setState] = useState({
    chart: [],
    chartByKey: {},
    taxProfile: null,
    businessId: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    setState((s) => ({ ...s, loading: true }));
    getAccountsContext()
      .then((ctx) => {
        if (!mounted) return;
        setState({ ...ctx, loading: false, error: null });
      })
      .catch((e) => {
        if (!mounted) return;
        console.error('useAccountsChart error:', e);
        setState((s) => ({ ...s, loading: false, error: e }));
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only on user change
  }, [user?.id]);

  const structure = state.taxProfile?.structure ?? 'sole_trader';

  return useMemo(() => {
    const { chart, chartByKey } = state;

    // lane → the chart rows in that lane (display order preserved via sort_order).
    const byLane = { income: [], expense: [], personal: [], transfer: [] };
    for (const row of chart) {
      if (row.archived) continue;
      (byLane[row.lane] ?? byLane.expense).push(row);
    }

    // Personal lane gets the entity-aware label so the whole UI reads consistently.
    const personalLabel = personalNoun(structure);
    const laneMeta = {
      ...LANE_META,
      personal: { ...LANE_META.personal, label: personalLabel },
    };

    return {
      ...state,
      structure,
      isLtd: structure === 'ltd',
      personalLabel,
      byLane,
      laneMeta,
      lanes: LANES,
      laneOf: (key) => laneForKey(chartByKey, key),
      labelOf: (key) => chartByKey?.[key]?.label ?? key,
      metaOf: (key) => chartByKey?.[key] ?? null,
    };
  }, [state, structure]);
}
