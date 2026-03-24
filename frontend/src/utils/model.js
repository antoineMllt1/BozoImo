/**
 * Estimation algorithm + ML feedback loop
 *
 * Core idea:
 * 1. Compute a weighted median price/m² from selected DVF comps
 *    (recent transactions carry more weight — 18-month half-life)
 * 2. Apply a surface adjustment (larger properties trade at a slight discount)
 * 3. Apply a learned correction factor derived from past confirmed transactions
 *    (geometric mean of actual/estimated ratios — correct for systematic bias)
 * 4. Derive a confidence interval from the weighted spread of the comps
 *
 * The correction factor starts at 1.0 (no effect) and converges
 * toward the true market as analysts confirm more transactions.
 */

// ─── Property characteristic adjustments ─────────────────────────────────────
//
// These are multiplicative corrections applied on top of the surface-adjusted
// median price/m².  All factors default to 1 when the field is unknown (null).
//
// Sources: empirical French real-estate price studies (FNAIM, Meilleurs Agents)
// All factors are optional — if target field is null, the correction is skipped.

export function floorElevatorFactor(floor, totalFloors, hasElevator) {
  if (floor == null) return { factor: 1, label: null };
  if (floor === 0) return { factor: 0.94, label: 'RDC (−6%)' };
  // Sans ascenseur — pénalité croissante avec l'étage
  if (hasElevator === false) {
    if (floor >= 5) return { factor: 0.86, label: `Ét.${floor} sans ascenseur (−14%)` };
    if (floor === 4) return { factor: 0.88, label: `Ét.${floor} sans ascenseur (−12%)` };
    if (floor === 3) return { factor: 0.93, label: `Ét.${floor} sans ascenseur (−7%)` };
    if (floor === 2) return { factor: 0.97, label: `Ét.${floor} sans ascenseur (−3%)` };
    return { factor: 1, label: null };
  }
  // Dernier étage avec ascenseur — prime
  if (hasElevator === true && totalFloors != null && floor >= totalFloors) {
    return { factor: 1.07, label: `Dernier étage avec ascenseur (+7%)` };
  }
  // Étage élevé avec ascenseur
  if (hasElevator === true && floor >= 4) return { factor: 1.04, label: `Ét.${floor} avec ascenseur (+4%)` };
  if (hasElevator === true && floor >= 2) return { factor: 1.02, label: `Ét.${floor} avec ascenseur (+2%)` };
  return { factor: 1, label: null };
}

export function orientationFactor(orientation) {
  const map = {
    S:  { factor: 1.04, label: 'Exposition Sud (+4%)' },
    SW: { factor: 1.03, label: 'Exposition Sud-Ouest (+3%)' },
    SE: { factor: 1.03, label: 'Exposition Sud-Est (+3%)' },
    W:  { factor: 1.01, label: 'Exposition Ouest (+1%)' },
    E:  { factor: 1.00, label: null },
    NE: { factor: 0.98, label: 'Exposition Nord-Est (−2%)' },
    NW: { factor: 0.97, label: 'Exposition Nord-Ouest (−3%)' },
    N:  { factor: 0.96, label: 'Exposition Nord (−4%)' },
  };
  return map[orientation] || { factor: 1, label: null };
}

export function amenitiesFactor(hasBalcony, hasParking, hasTerrace, hasCellar) {
  let f = 1;
  const labels = [];
  if (hasBalcony  === true) { f += 0.030; labels.push('Balcon (+3%)'); }
  if (hasTerrace  === true) { f += 0.045; labels.push('Terrasse (+4.5%)'); }
  if (hasParking  === true) { f += 0.025; labels.push('Parking (+2.5%)'); }
  if (hasCellar   === true) { f += 0.010; labels.push('Cave (+1%)'); }
  return { factor: f, label: labels.length ? labels.join(' · ') : null };
}

// ─── Weighted median ──────────────────────────────────────────────────────────

function weightedMedian(items) {
  // items: [{ value, weight }]
  if (!items.length) return null;
  const total = items.reduce((s, x) => s + x.weight, 0);
  const sorted = [...items].sort((a, b) => a.value - b.value);
  let cum = 0;
  for (const item of sorted) {
    cum += item.weight;
    if (cum >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

function weightedStats(items) {
  // items: [{ value, weight }]
  const total = items.reduce((s, x) => s + x.weight, 0);
  const mean  = items.reduce((s, x) => s + x.value * x.weight, 0) / total;
  const variance = items.reduce((s, x) => s + x.weight * Math.pow(x.value - mean, 2), 0) / total;
  return { mean, std: Math.sqrt(variance) };
}

// ─── Estimation ───────────────────────────────────────────────────────────────

/**
 * computeEstimate(features, selectedIndices, target, correctionFactor)
 *
 * features:          array of DVF feature objects ({ properties: { updated_price, area, sale_at, ... } })
 * selectedIndices:   number[] — indices into features. If empty, all features are used.
 * target:            { surfaceM2, rooms, type }
 * correctionFactor:  number — learned multiplier (starts at 1.0)
 *
 * Returns an estimate object or null if no valid comps.
 */
export function computeEstimate(features, selectedIndices, target, correctionFactor = 1) {
  const indices = selectedIndices.length > 0 ? selectedIndices : features.map((_, i) => i);
  const now = Date.now();

  const comps = indices
    .map(i => features[i]?.properties)
    .filter(p => p && p.area > 5 && p.updated_price > 0)
    .map(p => {
      const pm2 = p.updated_price / p.area;
      const saleTs = p.sale_at ? new Date(p.sale_at).getTime() : now;
      const monthsAgo = Math.max(0, (now - saleTs) / (1000 * 60 * 60 * 24 * 30.44));
      const weight = Math.exp(-monthsAgo / 18); // half-life 18 months
      return { pm2, weight, pm2Raw: p.updated_price / p.area };
    })
    .filter(c => isFinite(c.pm2) && c.pm2 > 0);

  if (!comps.length) return null;

  const basePm2 = weightedMedian(comps.map(c => ({ value: c.pm2, weight: c.weight })));
  if (!basePm2) return null;

  // Surface adjustment: −0.15% per m² above 50m²
  const surf = target?.surfaceM2;
  const surfAdj = surf && surf > 0
    ? Math.max(0.80, 1 - 0.0015 * Math.max(0, surf - 50))
    : 1;

  // Property characteristic adjustments (all optional)
  const floorAdj   = floorElevatorFactor(target?.floor ?? null, target?.totalFloors ?? null, target?.hasElevator ?? null);
  const orientAdj  = orientationFactor(target?.orientation ?? null);
  const amenitAdj  = amenitiesFactor(target?.hasBalcony ?? null, target?.hasParking ?? null, target?.hasTerrace ?? null, target?.hasCellar ?? null);

  const charAdj = floorAdj.factor * orientAdj.factor * amenitAdj.factor;

  const afterSurfPm2 = basePm2 * surfAdj;
  const adjustedPm2  = afterSurfPm2 * charAdj;
  const correctedPm2 = adjustedPm2 * correctionFactor;

  // Confidence interval from weighted std
  const { std } = weightedStats(comps.map(c => ({ value: c.pm2, weight: c.weight })));
  const halfWidth = comps.length === 1 ? correctedPm2 * 0.25
    : comps.length < 3   ? correctedPm2 * 0.20
    : std * correctionFactor * 1.5;

  const minPm2 = Math.max(correctedPm2 * 0.6, correctedPm2 - halfWidth);
  const maxPm2 = correctedPm2 + halfWidth;

  const round1k = v => Math.round(v / 1000) * 1000;

  return {
    basePm2:        Math.round(basePm2),
    afterSurfPm2:   Math.round(afterSurfPm2),
    adjustedPm2:    Math.round(adjustedPm2),
    correctedPm2:   Math.round(correctedPm2),
    minPm2:         Math.round(minPm2),
    maxPm2:         Math.round(maxPm2),
    estimatedPrice: surf ? round1k(correctedPm2 * surf) : null,
    minPrice:       surf ? round1k(minPm2 * surf) : null,
    maxPrice:       surf ? round1k(maxPm2 * surf) : null,
    nComps:         comps.length,
    correctionFactor,
    surfAdj:        Math.round(surfAdj * 1000) / 1000,
    floorAdj:       { factor: Math.round(floorAdj.factor * 1000) / 1000, label: floorAdj.label },
    orientAdj:      { factor: Math.round(orientAdj.factor * 1000) / 1000, label: orientAdj.label },
    amenitAdj:      { factor: Math.round(amenitAdj.factor * 1000) / 1000, label: amenitAdj.label },
    charAdj:        Math.round(charAdj * 1000) / 1000,
  };
}

// ─── Correction factor ────────────────────────────────────────────────────────

/**
 * Geometric mean of the last 20 (actual/estimated) ratios.
 * Geometric mean is appropriate for multiplicative ratios —
 * it avoids the upward bias of arithmetic mean.
 */
export function computeCorrectionFactor(samples) {
  if (!samples.length) return 1;
  const recent = samples.slice(-20);
  const logSum = recent.reduce((s, x) => s + Math.log(x.ratio), 0);
  const factor = Math.exp(logSum / recent.length);
  // Clamp to [0.5, 2.0] — safety rail against data entry errors
  return Math.max(0.5, Math.min(2.0, factor));
}

/**
 * Add a confirmed transaction and return updated model stats.
 */
export function addConfirmation(samples, { basePm2, actualPrice, surfaceM2, dossierId, address }) {
  const actualPm2 = actualPrice / surfaceM2;
  const ratio     = actualPm2 / basePm2;

  // Sanity check — flag extreme ratios (likely data entry error)
  const isOutlier = ratio < 0.3 || ratio > 3.0;

  const sample = {
    dossierId,
    address,
    basePm2:     Math.round(basePm2),
    actualPm2:   Math.round(actualPm2),
    actualPrice,
    surfaceM2,
    ratio,
    isOutlier,
    confirmedAt: new Date().toISOString(),
  };

  const updated = [...samples, sample].slice(-100);
  const validSamples = updated.filter(s => !s.isOutlier);
  const correctionFactor = computeCorrectionFactor(validSamples);

  // MAE: how wrong was the corrected estimate?
  const mae = validSamples.length
    ? Math.round(validSamples.reduce((s, x) => s + Math.abs(x.actualPm2 - x.basePm2 * correctionFactor), 0) / validSamples.length)
    : null;

  const mape = validSamples.length
    ? Math.round(validSamples.reduce((s, x) => s + Math.abs(x.actualPm2 / (x.basePm2 * correctionFactor) - 1) * 100, 0) / validSamples.length)
    : null;

  return { samples: updated, correctionFactor, mae, mape, isOutlier };
}

/**
 * Compute display stats from sample array.
 */
export function modelStats(samples, correctionFactor) {
  const valid = samples.filter(s => !s.isOutlier);
  if (!valid.length) return null;

  const mae = Math.round(
    valid.reduce((s, x) => s + Math.abs(x.actualPm2 - x.basePm2 * correctionFactor), 0) / valid.length
  );
  const mape = Math.round(
    valid.reduce((s, x) => s + Math.abs(x.actualPm2 / (x.basePm2 * correctionFactor) - 1) * 100, 0) / valid.length
  );
  const biasPct = Math.round((correctionFactor - 1) * 100);

  return {
    n:      valid.length,
    mae,
    mape,
    biasPct, // positive = model was underestimating, negative = overestimating
    correctionFactor: Math.round(correctionFactor * 1000) / 1000,
  };
}
