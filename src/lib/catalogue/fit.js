// Fit observed customer prices onto a canonical template ladder.
// Buckets observed prices into the template's tiers by closest expected
// price (Voronoi-by-ratio), then fills empty tiers via the progression
// multiplier of the nearest anchor tier. Surfaces meaningful gaps only —
// 3+ adjacent empties or empty ends of the ladder.
//
// Pure function. Duplicated in the edge function — keep in sync.

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function fitObservedPricesToTemplate(template, observedPrices) {
  const tiers = template.tiers ?? [];
  const baseTier = tiers.find(t => t.key === template.baseTier) ?? tiers[0];
  const baseMul  = baseTier?.multiplier ?? 1;

  const valid = (observedPrices ?? [])
    .map(Number)
    .filter(p => Number.isFinite(p) && p > 0);

  // Anchor finding: pick the price that best fits the baseTier. If we have
  // observed prices, we want the bucket containing baseTier's expected
  // price. Use the median as a robust starting point.
  let anchorPrice = null;
  if (valid.length) {
    const allMedian = median(valid);
    // The anchor estimates "what's the base-tier price?". Assume the median
    // observed price corresponds to the tier with the closest multiplier to
    // the median observed price's *implied* tier — but without circularity
    // we just use the overall median as a first guess for base.
    anchorPrice = allMedian;
  }

  // Bucket observed prices by closest expected price (uses the first-pass
  // anchorPrice). Each tier's expected price = anchorPrice × (multiplier / baseMul).
  const buckets = tiers.map(() => []);

  if (valid.length && anchorPrice != null) {
    const expected = tiers.map(t => anchorPrice * (t.multiplier / baseMul));
    for (const p of valid) {
      let bestIdx = 0;
      let bestRatio = Infinity;
      for (let i = 0; i < expected.length; i++) {
        // log-ratio distance — symmetric for prices above/below the expected.
        const r = expected[i] > 0 ? Math.abs(Math.log(p / expected[i])) : Infinity;
        if (r < bestRatio) { bestRatio = r; bestIdx = i; }
      }
      buckets[bestIdx].push(p);
    }
  }

  // Second pass: refine anchor from the populated tier closest to baseTier.
  const baseIdx = Math.max(0, tiers.findIndex(t => t.key === template.baseTier));
  let anchorIdx = -1;
  let anchorMul = baseMul;
  // Search outward from baseIdx.
  for (let d = 0; d < tiers.length; d++) {
    const lo = baseIdx - d, hi = baseIdx + d;
    if (lo >= 0 && buckets[lo].length) { anchorIdx = lo; anchorMul = tiers[lo].multiplier; break; }
    if (hi < tiers.length && hi !== lo && buckets[hi].length) { anchorIdx = hi; anchorMul = tiers[hi].multiplier; break; }
  }
  const observedBasePrice =
    anchorIdx >= 0 ? median(buckets[anchorIdx]) : null;

  // Build the fitted tier objects.
  const fittedTiers = tiers.map((t, i) => {
    const bucket = buckets[i];
    if (bucket.length) {
      return {
        key:            t.key,
        label:          t.label,
        hint:           t.hint ?? null,
        multiplier:     t.multiplier,
        price:          median(bucket),
        customer_count: bucket.length,
        is_estimated:   false,
        observed_low:   Math.min(...bucket),
        observed_high:  Math.max(...bucket),
      };
    }
    // Estimated from anchor (or null if we have no anchor at all).
    const estimated = observedBasePrice != null
      ? Math.round(observedBasePrice * (t.multiplier / anchorMul))
      : null;
    return {
      key:            t.key,
      label:          t.label,
      hint:           t.hint ?? null,
      multiplier:     t.multiplier,
      price:          estimated,
      customer_count: 0,
      is_estimated:   true,
      observed_low:   null,
      observed_high:  null,
    };
  });

  // Meaningful-gap detection. Only flag when:
  //   - the lowest 1+ contiguous tiers are estimated (empty bottom of ladder)
  //   - the highest 1+ contiguous tiers are estimated (empty top of ladder)
  //   - 3+ adjacent middle tiers are all estimated
  const n = fittedTiers.length;
  let lowEmpty = 0;
  for (let i = 0; i < n; i++) {
    if (fittedTiers[i].is_estimated) lowEmpty++; else break;
  }
  let highEmpty = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (fittedTiers[i].is_estimated) highEmpty++; else break;
  }
  // Middle-run check — longest run of consecutive estimated tiers, excluding
  // already-counted top/bottom tails.
  let longestRun = 0, run = 0;
  for (let i = lowEmpty; i < n - highEmpty; i++) {
    if (fittedTiers[i].is_estimated) { run++; longestRun = Math.max(longestRun, run); }
    else run = 0;
  }

  let hasGap = false;
  let gapDescription = null;
  if (highEmpty >= 1 && lowEmpty < n) {
    hasGap = true;
    const firstEmpty = fittedTiers[n - highEmpty];
    gapDescription = `No customers yet at ${firstEmpty.label.toLowerCase()} or up — set a price so quoting is ready when one calls.`;
  } else if (lowEmpty >= 1 && highEmpty < n) {
    hasGap = true;
    const lastEmpty = fittedTiers[lowEmpty - 1];
    gapDescription = `No customers yet at ${lastEmpty.label.toLowerCase()} or below — set a price so quoting is ready when one calls.`;
  } else if (longestRun >= 3) {
    hasGap = true;
    gapDescription = 'A few mid-range sizes have no customers yet — review the estimates.';
  }
  // When the entire ladder is estimated (no observed prices at all), we
  // suppress the gap callout — it would be noise.
  if (valid.length === 0) { hasGap = false; gapDescription = null; }

  return {
    tiers: fittedTiers,
    base_price_observed: observedBasePrice,
    gap_summary: {
      has_meaningful_gap: hasGap,
      gap_description:    gapDescription,
    },
  };
}
