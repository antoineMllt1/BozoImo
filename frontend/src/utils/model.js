function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundFactor(value) {
  return Math.round(value * 1000) / 1000;
}

function round1k(value) {
  return Math.round(value / 1000) * 1000;
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function weightedMedian(items) {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const sorted = [...items].sort((a, b) => a.value - b.value);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total / 2) return item.value;
  }
  return sorted[sorted.length - 1].value;
}

function weightedStats(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  const mean = items.reduce((sum, item) => sum + item.value * item.weight, 0) / total;
  const variance = items.reduce((sum, item) => sum + item.weight * (item.value - mean) ** 2, 0) / total;
  return { mean, std: Math.sqrt(variance) };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeFactor(factor, label = null, meta = null) {
  return {
    factor: roundFactor(factor),
    label,
    meta,
  };
}

function scoreToFactor(score, minFactor, maxFactor) {
  if (score == null) return 1;
  const centered = clamp((score - 50) / 50, -1, 1);
  if (centered >= 0) return 1 + centered * (maxFactor - 1);
  return 1 + centered * (1 - minFactor);
}

export function floorElevatorFactor(floor, totalFloors, hasElevator) {
  if (floor == null) return makeFactor(1);
  if (floor === 0) return makeFactor(0.94, 'RDC (-6%)');
  if (hasElevator === false) {
    if (floor >= 5) return makeFactor(0.86, `Et.${floor} sans ascenseur (-14%)`);
    if (floor === 4) return makeFactor(0.88, `Et.${floor} sans ascenseur (-12%)`);
    if (floor === 3) return makeFactor(0.93, `Et.${floor} sans ascenseur (-7%)`);
    if (floor === 2) return makeFactor(0.97, `Et.${floor} sans ascenseur (-3%)`);
    return makeFactor(1);
  }
  if (hasElevator === true && totalFloors != null && floor >= totalFloors) {
    return makeFactor(1.07, 'Dernier etage avec ascenseur (+7%)');
  }
  if (hasElevator === true && floor >= 4) return makeFactor(1.04, `Et.${floor} avec ascenseur (+4%)`);
  if (hasElevator === true && floor >= 2) return makeFactor(1.02, `Et.${floor} avec ascenseur (+2%)`);
  return makeFactor(1);
}

export function orientationFactor(orientation) {
  const map = {
    S: makeFactor(1.04, 'Exposition Sud (+4%)'),
    SW: makeFactor(1.03, 'Exposition Sud-Ouest (+3%)'),
    SE: makeFactor(1.03, 'Exposition Sud-Est (+3%)'),
    W: makeFactor(1.01, 'Exposition Ouest (+1%)'),
    E: makeFactor(1),
    NE: makeFactor(0.98, 'Exposition Nord-Est (-2%)'),
    NW: makeFactor(0.97, 'Exposition Nord-Ouest (-3%)'),
    N: makeFactor(0.96, 'Exposition Nord (-4%)'),
  };
  return map[orientation] || makeFactor(1);
}

export function amenitiesFactor(hasBalcony, hasParking, hasTerrace, hasCellar) {
  let factor = 1;
  const labels = [];
  if (hasBalcony === true) {
    factor += 0.03;
    labels.push('Balcon (+3%)');
  }
  if (hasTerrace === true) {
    factor += 0.045;
    labels.push('Terrasse (+4.5%)');
  }
  if (hasParking === true) {
    factor += 0.025;
    labels.push('Parking (+2.5%)');
  }
  if (hasCellar === true) {
    factor += 0.01;
    labels.push('Cave (+1%)');
  }
  return makeFactor(factor, labels.length ? labels.join(' · ') : null);
}

export function dpeFactor(dpe) {
  const map = {
    A: makeFactor(1.08, 'DPE A (+8%)'),
    B: makeFactor(1.05, 'DPE B (+5%)'),
    C: makeFactor(1.02, 'DPE C (+2%)'),
    D: makeFactor(1),
    E: makeFactor(0.95, 'DPE E (-5%)'),
    F: makeFactor(0.88, 'DPE F (-12%)'),
    G: makeFactor(0.85, 'DPE G (-15%)'),
  };
  return map[dpe] || makeFactor(1);
}

export function renovationFactor(condition) {
  const map = {
    renovated: makeFactor(1.07, 'Refait a neuf (+7%)'),
    good: makeFactor(1.02, 'Bon etat general (+2%)'),
    average: makeFactor(1),
    refresh: makeFactor(0.93, 'Rafraichissement (-7%)'),
    heavy_work: makeFactor(0.85, 'Travaux lourds (-15%)'),
  };
  return map[condition] || makeFactor(1);
}

export function buildingAgeFactor(yearBuilt) {
  if (!yearBuilt) return makeFactor(1);
  if (yearBuilt < 1948) return makeFactor(0.85, 'Avant 1948 (-15%)');
  if (yearBuilt <= 1974) return makeFactor(0.94, `Construit en ${yearBuilt} (-6%)`);
  if (yearBuilt >= 2001) return makeFactor(1.05, `Construit en ${yearBuilt} (+5%)`);
  return makeFactor(1);
}

export function viewFactor(viewQuality) {
  const map = {
    open: makeFactor(1.06, 'Vue degagee (+6%)'),
    courtyard: makeFactor(1.02, 'Vue cour ou jardin (+2%)'),
    vis_a_vis: makeFactor(0.94, 'Vis-a-vis (-6%)'),
    nuisance: makeFactor(0.9, 'Nuisance visuelle ou sonore (-10%)'),
  };
  return map[viewQuality] || makeFactor(1);
}

export function poolFactor(hasPool, type) {
  if (hasPool !== true) return makeFactor(1);
  return type === 'House' ? makeFactor(1.1, 'Piscine (+10%)') : makeFactor(1.04, 'Piscine (+4%)');
}

export function gardenFactor(hasGarden, type) {
  if (hasGarden !== true) return makeFactor(1);
  return type === 'House' ? makeFactor(1.06, 'Jardin (+6%)') : makeFactor(1.03, 'Jardin (+3%)');
}

export function duplexFactor(isDuplex) {
  return isDuplex === true ? makeFactor(1.06, 'Duplex/Triplex (+6%)') : makeFactor(1);
}

function computeTransportScore(areaContext) {
  const nearestDistance = areaContext?.transport?.nearestStop?.distanceM;
  const stopCount500m = areaContext?.transport?.stopCount500m ?? 0;
  if (nearestDistance == null) return null;
  let score = 20;
  if (nearestDistance <= 200) score = 100;
  else if (nearestDistance <= 500) score = 80;
  else if (nearestDistance <= 1000) score = 60;
  else if (nearestDistance <= 2000) score = 35;
  score += Math.min(15, stopCount500m * 2);
  return clamp(Math.round(score), 0, 100);
}

function computeEducationScore(areaContext) {
  const count = areaContext?.schools?.count1km;
  if (count == null) return null;
  const collegeCount = areaContext?.schools?.collegeCount ?? 0;
  const lyceeCount = areaContext?.schools?.lyceeCount ?? 0;
  const publicCount = areaContext?.schools?.publicCount ?? 0;
  const privateCount = areaContext?.schools?.privateCount ?? 0;
  let score = Math.min(70, count * 10);
  if (collegeCount > 0) score += 10;
  if (lyceeCount > 0) score += 10;
  if (publicCount > 0 && privateCount > 0) score += 10;
  return clamp(Math.round(score), 0, 100);
}

function computeWalkScore(areaContext) {
  const amenities = areaContext?.amenities;
  if (!amenities) return null;
  const pharmacy = amenities.pharmacyCount800m ?? 0;
  const supermarket = amenities.supermarketCount1000m ?? 0;
  const restaurant = amenities.restaurantCount1000m ?? 0;
  const parks = amenities.parkCount700m ?? 0;
  const raw = pharmacy * 18 + supermarket * 24 + Math.min(restaurant, 12) * 4 + parks * 10;
  return clamp(Math.round(raw), 0, 100);
}

function computeEnvironmentScore(areaContext) {
  const parks = areaContext?.amenities?.parkCount700m ?? null;
  const nearestRailStation = areaContext?.noise?.nearestRailStation?.distanceM ?? null;
  const floodPresent = areaContext?.risks?.flood?.present;
  if (parks == null && nearestRailStation == null && floodPresent == null) return null;

  let score = Math.min(45, (parks ?? 0) * 15);

  if (nearestRailStation == null) score += 25;
  else if (nearestRailStation <= 200) score += 8;
  else if (nearestRailStation <= 400) score += 15;
  else score += 25;

  if (floodPresent === true) score += 10;
  else if (floodPresent === false) score += 30;

  return clamp(Math.round(score), 0, 100);
}

function ratingToScore(rating) {
  return rating == null ? null : clamp(Math.round(rating * 20), 0, 100);
}

function crimeRatioScore(localValue, nationalValue) {
  if (localValue == null || nationalValue == null || nationalValue <= 0) return null;
  const ratio = localValue / nationalValue;
  return clamp(Math.round(60 - (ratio - 1) * 40), 15, 90);
}

function averageScore(scores) {
  const values = scores.filter(value => value != null);
  return values.length ? clamp(Math.round(average(values)), 0, 100) : null;
}

function computeSafetyScore(areaContext) {
  const cityContext = areaContext?.villesAVivre;
  return averageScore([
    ratingToScore(cityContext?.ratings?.security),
    crimeRatioScore(cityContext?.safety?.crimesPer1000, cityContext?.safety?.nationalCrimesPer1000),
    crimeRatioScore(cityContext?.safety?.burglaryPer1000, cityContext?.safety?.burglaryNationalPer1000),
    crimeRatioScore(cityContext?.safety?.carTheftPer1000, cityContext?.safety?.carTheftNationalPer1000),
  ]);
}

function computeServicesScore(areaContext) {
  const cityContext = areaContext?.villesAVivre;
  const trainDistanceKm = cityContext?.services?.trainStationDistanceKm;
  const stationScore =
    trainDistanceKm == null ? null :
    trainDistanceKm <= 1 ? 82 :
    trainDistanceKm <= 3 ? 68 :
    trainDistanceKm <= 6 ? 54 :
    38;

  return averageScore([
    ratingToScore(cityContext?.ratings?.services),
    ratingToScore(cityContext?.ratings?.health),
    ratingToScore(cityContext?.ratings?.culture),
    ratingToScore(cityContext?.ratings?.sport),
    stationScore,
  ]);
}

function computeEconomyScore(areaContext) {
  const cityContext = areaContext?.villesAVivre;
  const income = cityContext?.economy?.medianIncome;
  const unemployment = cityContext?.economy?.unemploymentPct;
  const fiber = cityContext?.economy?.fiberPct;
  const businessCreation = cityContext?.economy?.businessCreationPct;

  const incomeScore =
    income == null ? null : clamp(Math.round(((income - 18000) / 18000) * 50 + 50), 15, 100);
  const unemploymentScore =
    unemployment == null ? null : clamp(Math.round(100 - unemployment * 6), 20, 100);
  const fiberScore = fiber == null ? null : clamp(Math.round(fiber), 0, 100);
  const businessScore =
    businessCreation == null ? null : clamp(Math.round(businessCreation * 3), 20, 100);

  return averageScore([incomeScore, unemploymentScore, fiberScore, businessScore]);
}

function computeLiveabilityScore(areaContext) {
  const cityContext = areaContext?.villesAVivre;
  const reviewCount = cityContext?.ratings?.reviewCount ?? 0;
  const overallScore = reviewCount >= 5 ? ratingToScore(cityContext?.ratings?.overall) : null;

  return averageScore([
    overallScore,
    ratingToScore(cityContext?.ratings?.environment),
    ratingToScore(cityContext?.ratings?.transport),
    ratingToScore(cityContext?.ratings?.education),
    ratingToScore(cityContext?.ratings?.services),
  ]);
}

export function computeNeighborhoodPremium(scores) {
  const values = [
    scores?.transportScore,
    scores?.educationScore,
    scores?.walkScore,
    scores?.environmentScore,
    scores?.safetyScore,
    scores?.servicesScore,
    scores?.economyScore,
    scores?.liveabilityScore,
  ].filter(value => value != null);

  if (!values.length) {
    return makeFactor(1);
  }

  const averageScore = average(values);
  const factor = clamp(1 + (averageScore - 50) / 900, 0.94, 1.06);
  const deltaPct = Math.round((factor - 1) * 100);
  if (deltaPct === 0) {
    return makeFactor(factor, `Prime quartier (${Math.round(averageScore)}/100)`);
  }
  return makeFactor(
    factor,
    `Prime quartier (${Math.round(averageScore)}/100, ${deltaPct > 0 ? '+' : ''}${deltaPct}%)`
  );
}

export function computeAreaScores(areaContext) {
  const transportScore = computeTransportScore(areaContext);
  const educationScore = computeEducationScore(areaContext);
  const walkScore = computeWalkScore(areaContext);
  const environmentScore = computeEnvironmentScore(areaContext);
  const safetyScore = computeSafetyScore(areaContext);
  const servicesScore = computeServicesScore(areaContext);
  const economyScore = computeEconomyScore(areaContext);
  const liveabilityScore = computeLiveabilityScore(areaContext);
  const neighborhoodPremium = computeNeighborhoodPremium({
    transportScore,
    educationScore,
    walkScore,
    environmentScore,
    safetyScore,
    servicesScore,
    economyScore,
    liveabilityScore,
  });

  return {
    transportScore,
    educationScore,
    walkScore,
    environmentScore,
    safetyScore,
    servicesScore,
    economyScore,
    liveabilityScore,
    neighborhoodPremium,
  };
}

export function transitFactor(areaContext) {
  const score = computeTransportScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.97, 1.06);
  return makeFactor(factor, `Transport (${score}/100)`);
}

export function schoolFactor(areaContext) {
  const score = computeEducationScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.99, 1.03);
  return makeFactor(factor, `Ecoles (${score}/100)`);
}

export function amenityContextFactor(areaContext) {
  const score = computeWalkScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.97, 1.04);
  return makeFactor(factor, `Walk score (${score}/100)`);
}

export function riskFactor(areaContext) {
  const floodPresent = areaContext?.risks?.flood?.present;
  const naturalRiskCount = areaContext?.risks?.naturalRiskCount ?? 0;
  if (floodPresent == null && naturalRiskCount === 0) return makeFactor(1);
  if (floodPresent === true) return makeFactor(0.92, 'Risque inondation (-8%)');
  if (naturalRiskCount >= 4) return makeFactor(0.97, 'Contexte risques naturels dense (-3%)');
  return makeFactor(1);
}

export function noiseFactor(areaContext) {
  const nearestRailStation = areaContext?.noise?.nearestRailStation?.distanceM;
  if (nearestRailStation == null) return makeFactor(1);
  if (nearestRailStation <= 150) return makeFactor(0.96, 'Proximite gare ferroviaire (-4%)');
  if (nearestRailStation <= 300) return makeFactor(0.98, 'Proximite transport ferroviaire (-2%)');
  return makeFactor(1);
}

export function incomeFactor(areaContext) {
  const score = computeEconomyScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.98, 1.03);
  return makeFactor(factor, `Economie commune (${score}/100)`);
}

export function safetyContextFactor(areaContext) {
  const score = computeSafetyScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.95, 1.02);
  return makeFactor(factor, `Securite commune (${score}/100)`);
}

export function servicesContextFactor(areaContext) {
  const score = computeServicesScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.98, 1.03);
  return makeFactor(factor, `Services commune (${score}/100)`);
}

export function liveabilityFactor(areaContext) {
  const score = computeLiveabilityScore(areaContext);
  if (score == null) return makeFactor(1);
  const factor = scoreToFactor(score, 0.98, 1.04);
  return makeFactor(factor, `Cadre de vie (${score}/100)`);
}

function buildAdjustments(target, areaContext) {
  const areaScores = computeAreaScores(areaContext);
  const floorAdj = floorElevatorFactor(target?.floor ?? null, target?.totalFloors ?? null, target?.hasElevator ?? null);
  const orientAdj = orientationFactor(target?.orientation ?? null);
  const amenitAdj = amenitiesFactor(
    target?.hasBalcony ?? null,
    target?.hasParking ?? null,
    target?.hasTerrace ?? null,
    target?.hasCellar ?? null
  );
  const dpeAdj = dpeFactor(target?.dpe ?? null);
  const conditionAdj = renovationFactor(target?.condition ?? null);
  const ageAdj = buildingAgeFactor(target?.yearBuilt ?? null);
  const viewAdj = viewFactor(target?.viewQuality ?? null);
  const poolAdj = poolFactor(target?.hasPool ?? null, target?.type ?? null);
  const gardenAdj = gardenFactor(target?.hasGarden ?? null, target?.type ?? null);
  const duplexAdj = duplexFactor(target?.isDuplex ?? null);

  // Neighbourhood scores are computed for DISPLAY ONLY (radar chart, info tabs).
  // They must NOT influence the price estimate because the comparables already
  // come from the same area, so their €/m² already reflects neighbourhood quality.
  // Only hard risk/noise factors are kept when a concrete hazard is detected.
  const rawContextAdjustments = [
    riskFactor(areaContext),
    noiseFactor(areaContext),
  ];

  const charAdjustments = [
    ['floorAdj', floorAdj],
    ['orientAdj', orientAdj],
    ['amenitAdj', amenitAdj],
    ['dpeAdj', dpeAdj],
    ['conditionAdj', conditionAdj],
    ['ageAdj', ageAdj],
    ['viewAdj', viewAdj],
    ['poolAdj', poolAdj],
    ['gardenAdj', gardenAdj],
    ['duplexAdj', duplexAdj],
  ];

  const propertyAdjustments = charAdjustments.map(([, adj]) => adj);

  const charAdj = charAdjustments.reduce((product, [, adj]) => product * adj.factor, 1);
  const contextAdjRaw = rawContextAdjustments.reduce((product, adj) => product * adj.factor, 1);
  const contextAdj = clamp(contextAdjRaw, 0.85, 1.15);

  const contextAdjustments = rawContextAdjustments.map(adj => adj);
  return {
    floorAdj,
    orientAdj,
    amenitAdj,
    dpeAdj,
    conditionAdj,
    ageAdj,
    viewAdj,
    poolAdj,
    gardenAdj,
    duplexAdj,
    charAdj,
    contextAdj,
    propertyAdjustments,
    contextAdjustments,
    areaScores,
  };
}

function buildAdjustmentRows(adjustments) {
  return [
    adjustments.floorAdj,
    adjustments.orientAdj,
    adjustments.amenitAdj,
    adjustments.dpeAdj,
    adjustments.conditionAdj,
    adjustments.ageAdj,
    adjustments.viewAdj,
    adjustments.poolAdj,
    adjustments.gardenAdj,
    adjustments.duplexAdj,
    ...adjustments.contextAdjustments,
  ].filter(adj => adj.label && Math.abs(adj.factor - 1) > 0.0001);
}

function computeGeoSpreadMeters(comps, location) {
  if (location?.lat == null || location?.lng == null) return null;
  const distances = comps
    .filter(comp => comp.lat != null && comp.lng != null)
    .map(comp => haversineDistanceMeters(location.lat, location.lng, comp.lat, comp.lng));
  return distances.length ? Math.round(average(distances)) : null;
}

function computeEstimateConfidence(comps, location) {
  if (!comps.length) return null;

  const months = comps.map(comp => comp.monthsAgo).filter(value => Number.isFinite(value));
  const values = comps.map(comp => comp.pm2).filter(value => Number.isFinite(value));
  const meanPm2 = average(values) || 1;
  const stdDev = Math.sqrt(values.reduce((sum, value) => sum + (value - meanPm2) ** 2, 0) / values.length);
  const coeffVariation = stdDev / meanPm2;
  const medianMonths = median(months);
  const geoSpreadM = computeGeoSpreadMeters(comps, location);
  const sourceCount = new Set(comps.map(comp => comp.source).filter(Boolean)).size;

  let score = 0;

  if (comps.length >= 12) score += 30;
  else if (comps.length >= 8) score += 24;
  else if (comps.length >= 5) score += 18;
  else if (comps.length >= 3) score += 12;
  else score += 6;

  if (medianMonths == null) score += 8;
  else if (medianMonths <= 3) score += 20;
  else if (medianMonths <= 6) score += 16;
  else if (medianMonths <= 12) score += 12;
  else if (medianMonths <= 24) score += 8;
  else score += 4;

  if (coeffVariation <= 0.08) score += 20;
  else if (coeffVariation <= 0.12) score += 16;
  else if (coeffVariation <= 0.18) score += 10;
  else score += 4;

  if (geoSpreadM == null) score += 8;
  else if (geoSpreadM <= 300) score += 15;
  else if (geoSpreadM <= 700) score += 12;
  else if (geoSpreadM <= 1200) score += 8;
  else score += 4;

  if (sourceCount >= 2) score += 10;
  else score += 6;

  const stars =
    score >= 85 ? 5 :
    score >= 70 ? 4 :
    score >= 50 ? 3 :
    score >= 35 ? 2 :
    1;

  const label =
    stars >= 5 ? 'Tres forte' :
    stars === 4 ? 'Forte' :
    stars === 3 ? 'Moyenne' :
    stars === 2 ? 'Limitee' :
    'Faible';

  return {
    score: Math.round(score),
    stars,
    label,
    medianMonths: medianMonths != null ? Math.round(medianMonths * 10) / 10 : null,
    coeffVariation: Math.round(coeffVariation * 1000) / 1000,
    geoSpreadM,
    sourceCount,
  };
}

function computeEstimateCore(comps, target, correctionFactor = 1, areaContext = null, location = null) {
  if (!comps.length) return null;

  const basePm2 = weightedMedian(comps.map(comp => ({ value: comp.pm2, weight: comp.weight })));
  if (!basePm2) return null;

  const surf = target?.surfaceM2;
  const surfAdj = surf && surf > 0
    ? Math.max(0.8, 1 - 0.0015 * Math.max(0, surf - 50))
    : 1;

  const adjustments = buildAdjustments(target, areaContext);
  const afterSurfPm2 = basePm2 * surfAdj;
  const afterCharPm2 = afterSurfPm2 * adjustments.charAdj;
  const afterContextPm2 = afterCharPm2 * adjustments.contextAdj;
  const correctedPm2 = afterContextPm2 * correctionFactor;

  const { std } = weightedStats(comps.map(comp => ({ value: comp.pm2, weight: comp.weight })));
  const halfWidth =
    comps.length === 1 ? correctedPm2 * 0.25 :
    comps.length < 3 ? correctedPm2 * 0.2 :
    std * correctionFactor * 1.5;

  const minPm2 = Math.max(correctedPm2 * 0.6, correctedPm2 - halfWidth);
  const maxPm2 = correctedPm2 + halfWidth;
  const confidence = computeEstimateConfidence(comps, location);

  return {
    basePm2: Math.round(basePm2),
    afterSurfPm2: Math.round(afterSurfPm2),
    afterCharPm2: Math.round(afterCharPm2),
    afterContextPm2: Math.round(afterContextPm2),
    adjustedPm2: Math.round(afterContextPm2),
    correctedPm2: Math.round(correctedPm2),
    minPm2: Math.round(minPm2),
    maxPm2: Math.round(maxPm2),
    estimatedPrice: surf ? round1k(correctedPm2 * surf) : null,
    minPrice: surf ? round1k(minPm2 * surf) : null,
    maxPrice: surf ? round1k(maxPm2 * surf) : null,
    nComps: comps.length,
    correctionFactor,
    surfAdj: roundFactor(surfAdj),
    floorAdj: adjustments.floorAdj,
    orientAdj: adjustments.orientAdj,
    amenitAdj: adjustments.amenitAdj,
    dpeAdj: adjustments.dpeAdj,
    conditionAdj: adjustments.conditionAdj,
    ageAdj: adjustments.ageAdj,
    viewAdj: adjustments.viewAdj,
    poolAdj: adjustments.poolAdj,
    gardenAdj: adjustments.gardenAdj,
    duplexAdj: adjustments.duplexAdj,
    charAdj: roundFactor(adjustments.charAdj),
    contextAdj: roundFactor(adjustments.contextAdj),
    propertyAdjustments: adjustments.propertyAdjustments,
    contextAdjustments: adjustments.contextAdjustments,
    adjustments: buildAdjustmentRows(adjustments),
    areaScores: adjustments.areaScores,
    confidence,
  };
}

export function computeEstimate(features, selectedIndices, target, correctionFactor = 1, areaContext = null, location = null) {
  const indices = selectedIndices.length > 0 ? selectedIndices : features.map((_, index) => index);
  const now = Date.now();

  const comps = indices
    .map(index => features[index])
    .filter(Boolean)
    .map(feature => {
      const properties = feature.properties || {};
      if (!(properties.area > 5 && properties.updated_price > 0)) return null;
      const saleTs = properties.sale_at ? new Date(properties.sale_at).getTime() : now;
      const monthsAgo = Math.max(0, (now - saleTs) / (1000 * 60 * 60 * 24 * 30.44));
      const weight = Math.exp(-monthsAgo / 18);
      const coordinates = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
      return {
        pm2: properties.updated_price / properties.area,
        weight,
        monthsAgo,
        source: 'dvf',
        lat: Number.isFinite(Number(coordinates[1])) ? Number(coordinates[1]) : null,
        lng: Number.isFinite(Number(coordinates[0])) ? Number(coordinates[0]) : null,
      };
    })
    .filter(comp => comp && Number.isFinite(comp.pm2) && comp.pm2 > 0);

  return computeEstimateCore(comps, target, correctionFactor, areaContext, location);
}

export function computeEstimateFromRefs(filteredRefs, target, correctionFactor = 1, areaContext = null, location = null) {
  const now = Date.now();

  const comps = filteredRefs
    .filter(ref => ref.ppm2 > 0 && ref.area > 5)
    .map(ref => {
      const saleTs = ref.date ? new Date(ref.date).getTime() : now;
      const monthsAgo = Math.max(0, (now - saleTs) / (1000 * 60 * 60 * 24 * 30.44));
      const weight = Math.exp(-monthsAgo / 18);
      return {
        pm2: ref.ppm2,
        weight,
        monthsAgo,
        source: ref.source,
        lat: ref.lat ?? null,
        lng: ref.lng ?? null,
      };
    });

  return computeEstimateCore(comps, target, correctionFactor, areaContext, location);
}

export function computeCorrectionFactor(samples) {
  if (!samples.length) return 1;
  const recent = samples.slice(-20);
  const logSum = recent.reduce((sum, sample) => sum + Math.log(sample.ratio), 0);
  const factor = Math.exp(logSum / recent.length);
  return Math.max(0.5, Math.min(2, factor));
}

export function addConfirmation(samples, { basePm2, actualPrice, surfaceM2, dossierId, address }) {
  const actualPm2 = actualPrice / surfaceM2;
  const ratio = actualPm2 / basePm2;
  const isOutlier = ratio < 0.3 || ratio > 3;

  const sample = {
    dossierId,
    address,
    basePm2: Math.round(basePm2),
    actualPm2: Math.round(actualPm2),
    actualPrice,
    surfaceM2,
    ratio,
    isOutlier,
    confirmedAt: new Date().toISOString(),
  };

  const updated = [...samples, sample].slice(-100);
  const validSamples = updated.filter(entry => !entry.isOutlier);
  const factor = computeCorrectionFactor(validSamples);

  const mae = validSamples.length
    ? Math.round(
        validSamples.reduce((sum, entry) => sum + Math.abs(entry.actualPm2 - entry.basePm2 * factor), 0) / validSamples.length
      )
    : null;

  const mape = validSamples.length
    ? Math.round(
        validSamples.reduce(
          (sum, entry) => sum + Math.abs(entry.actualPm2 / (entry.basePm2 * factor) - 1) * 100,
          0
        ) / validSamples.length
      )
    : null;

  return { samples: updated, correctionFactor: factor, mae, mape, isOutlier };
}

export function modelStats(samples, correctionFactor) {
  const valid = samples.filter(sample => !sample.isOutlier);
  if (!valid.length) return null;

  const mae = Math.round(
    valid.reduce((sum, sample) => sum + Math.abs(sample.actualPm2 - sample.basePm2 * correctionFactor), 0) / valid.length
  );
  const mape = Math.round(
    valid.reduce((sum, sample) => sum + Math.abs(sample.actualPm2 / (sample.basePm2 * correctionFactor) - 1) * 100, 0) / valid.length
  );
  const biasPct = Math.round((correctionFactor - 1) * 100);

  return {
    n: valid.length,
    mae,
    mape,
    biasPct,
    correctionFactor: roundFactor(correctionFactor),
  };
}
