// EDM — Étude De Marché calculations

function roomsToType(n) {
  const r = parseInt(n, 10);
  if (!r || r < 1) return null;
  return r >= 5 ? 'T5' : `T${r}`;
}

function temporalWeight(dateStr, now, s) {
  if (!s?.enabled || !dateStr) return 1;
  const months = (now - new Date(dateStr)) / (1000 * 60 * 60 * 24 * 30);
  if (months < 6)  return s.w0_6  ?? 1.2;
  if (months < 12) return s.w6_12 ?? 1.0;
  if (months < 24) return s.w12_24 ?? 0.8;
  return s.w24plus ?? 0.6;
}

// Unify DVF + SeLoger into a common reference list
export function normalizeRefs(dvfSnapshot, selogerSnapshot, tauxNego = 0.05) {
  const refs = [];
  const fetchedAt = selogerSnapshot?.fetchedAt || new Date().toISOString();

  // DVF
  (dvfSnapshot?.data?.features || []).forEach((f, i) => {
    const p = f.properties || {};
    const area  = p.area || null;
    const price = p.updated_price || null;
    refs.push({
      id: `dvf_${i}`,
      source: 'dvf',
      address: p.address_name || '',
      date: p.sale_at || null,
      type: roomsToType(p.room_count),
      area,
      floor: p.floor_number ?? null,
      dpe: null,
      orientation: null,
      price,
      ppm2: area > 0 && price ? Math.round(price / area) : null,
      keywords: [],
      excluded: false,
      url: null,
    });
  });

  // SeLoger — apply negotiation discount
  (selogerSnapshot?.data?.classifieds || []).forEach((c, i) => {
    const rawPrice = c.price;
    const rawPpm2  = c.ppm2;
    refs.push({
      id: `sl_${i}`,
      source: 'seloger',
      address: [c.district, c.city && c.zip ? `${c.city} (${c.zip})` : c.city].filter(Boolean).join(', '),
      date: fetchedAt,
      type: roomsToType(c.rooms),
      area: c.area || null,
      floor: c.floor ?? null,
      dpe: c.dpe || null,
      orientation: c.orientation || null,
      price:    rawPrice ? Math.round(rawPrice * (1 - tauxNego)) : null,
      ppm2:     rawPpm2  ? Math.round(rawPpm2  * (1 - tauxNego)) : null,
      priceRaw: rawPrice,
      ppm2Raw:  rawPpm2,
      keywords: c.keywords || [],
      excluded: false,
      url: c.url || null,
    });
  });

  return refs;
}

export function applyFilters(refs, filters = {}) {
  return refs.filter(r => {
    if (r.excluded) return false;
    if (r.ppm2 == null) return false;
    if (filters.sources?.length && !filters.sources.includes(r.source)) return false;
    if (filters.ppm2Min != null && r.ppm2 < filters.ppm2Min) return false;
    if (filters.ppm2Max != null && r.ppm2 > filters.ppm2Max) return false;
    if (filters.types?.length && !filters.types.includes(r.type)) return false;
    if (filters.areaMin != null && (r.area == null || r.area < filters.areaMin)) return false;
    if (filters.areaMax != null && (r.area == null || r.area > filters.areaMax)) return false;
    if (filters.floorMin != null && (r.floor == null || r.floor < filters.floorMin)) return false;
    if (filters.floorMax != null && (r.floor == null || r.floor > filters.floorMax)) return false;
    if (filters.dpe?.length && r.dpe && !filters.dpe.includes(r.dpe)) return false;
    if (filters.orientations?.length && r.orientation && !filters.orientations.includes(r.orientation)) return false;
    if (filters.dateFrom && r.date && new Date(r.date) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo   && r.date && new Date(r.date) > new Date(filters.dateTo))   return false;
    return true;
  });
}

export function computeMetrics(allRefs, filteredRefs, filters = {}, tauxNego = 0.05, temporalSettings = null) {
  const n = filteredRefs.length;
  const ppm2s = filteredRefs.map(r => r.ppm2).filter(v => v != null);
  if (!ppm2s.length) return null;

  const now = new Date();
  const avg = ppm2s.reduce((a, b) => a + b, 0) / ppm2s.length;

  let sumPrice = 0, sumArea = 0;
  filteredRefs.forEach(r => {
    if (!r.ppm2 || !r.area) return;
    const w = temporalWeight(r.date, now, temporalSettings);
    sumPrice += (r.price || r.ppm2 * r.area) * w;
    sumArea  += r.area * w;
  });
  const avgWeighted = sumArea > 0 ? Math.round(sumPrice / sumArea) : Math.round(avg);
  const stdDev = Math.round(Math.sqrt(ppm2s.reduce((a, v) => a + (v - avg) ** 2, 0) / ppm2s.length));

  const activeRefs = allRefs.filter(r => !r.excluded && r.ppm2 != null);
  const nExcludedLow  = filters.ppm2Min != null ? activeRefs.filter(r => r.ppm2 < filters.ppm2Min).length : 0;
  const nExcludedHigh = filters.ppm2Max != null ? activeRefs.filter(r => r.ppm2 > filters.ppm2Max).length : 0;
  const pctCovered = activeRefs.length > 0 ? Math.round((n / activeRefs.length) * 100) : 0;

  const slRefs  = filteredRefs.filter(r => r.source === 'seloger' && r.ppm2Raw);
  const avgNego = slRefs.length
    ? Math.round(slRefs.reduce((a, r) => a + r.ppm2Raw, 0) / slRefs.length * (1 - tauxNego))
    : null;

  // Per-type stats
  const byType = {};
  ['T1','T2','T3','T4','T5'].forEach(t => {
    const tr = filteredRefs.filter(r => r.type === t && r.ppm2);
    if (!tr.length) return;
    let sp = 0, sa = 0;
    tr.forEach(r => { if (r.area) { sp += r.price || r.ppm2 * r.area; sa += r.area; } });
    byType[t] = {
      n: tr.length,
      avg: Math.round(tr.reduce((a, r) => a + r.ppm2, 0) / tr.length),
      avgWeighted: sa > 0 ? Math.round(sp / sa) : Math.round(tr.reduce((a, r) => a + r.ppm2, 0) / tr.length),
    };
  });

  return {
    n, nDvf: filteredRefs.filter(r => r.source === 'dvf').length,
    nSl: filteredRefs.filter(r => r.source === 'seloger').length,
    nActiveTotal: activeRefs.length, pctCovered, nExcludedLow, nExcludedHigh,
    avg: Math.round(avg), avgWeighted, avgNego, stdDev, byType,
  };
}

// IQR-based outlier detection
export function suggestRange(refs) {
  const vals = refs.filter(r => r.ppm2 != null).map(r => r.ppm2).sort((a, b) => a - b);
  if (vals.length < 4) return null;
  const q1 = vals[Math.floor(vals.length * 0.25)];
  const q3 = vals[Math.floor(vals.length * 0.75)];
  const iqr = q3 - q1;
  const min = Math.max(0, Math.round(q1 - 1.5 * iqr));
  const max = Math.round(q3 + 1.5 * iqr);
  const inRange = vals.filter(v => v >= min && v <= max).length;
  return { min, max, pct: Math.round((inRange / vals.length) * 100) };
}

export function computePrixPivot(byType, typoWeights) {
  let sum = 0, w = 0;
  for (const [t, weight] of Object.entries(typoWeights)) {
    if (!byType[t] || weight <= 0) continue;
    sum += byType[t].avgWeighted * weight;
    w   += weight;
  }
  return w > 0 ? Math.round(sum / w) : null;
}
