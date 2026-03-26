import {
  normalizeBuildingProfile,
  normalizeCadastreSnapshot,
  normalizeCastorusSnapshot,
  normalizeDpeSnapshot,
  normalizeDvfPlusSnapshot,
  normalizeMarketIndicators,
  normalizePappersSnapshot,
  normalizeRiskProfile,
} from './enrichment';

export const EMPTY_LOT_MIX = Object.freeze({
  T1: 0,
  T2: 0,
  T3: 0,
  T4: 0,
  T5: 0,
});

export const DPE_OPTIONS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G']);

export const CONDITION_OPTIONS = Object.freeze([
  { value: 'renovated', label: 'Refait a neuf' },
  { value: 'good', label: 'Bon etat' },
  { value: 'average', label: "Etat d'usage" },
  { value: 'refresh', label: 'Rafraichissement' },
  { value: 'heavy_work', label: 'Travaux lourds' },
]);

export const VIEW_QUALITY_OPTIONS = Object.freeze([
  { value: 'open', label: 'Degagee / horizon' },
  { value: 'courtyard', label: 'Cour / jardin' },
  { value: 'vis_a_vis', label: 'Vis-a-vis' },
  { value: 'nuisance', label: 'Nuisance' },
]);

export const OCCUPANCY_STATUS_OPTIONS = Object.freeze([
  { value: 'vacant', label: 'Vacant' },
  { value: 'owner_occupied', label: 'Occupe proprietaire' },
  { value: 'tenant_occupied', label: 'Occupe locataire' },
]);

export const DEFAULT_ANALYST_FILTERS = Object.freeze({
  negotiationRate: 5,
  ppm2Min: null,
  ppm2Max: null,
  types: [],
  sources: ['dvf', 'seloger'],
  areaMin: null,
  areaMax: null,
  floorMin: null,
  floorMax: null,
  dpe: [],
  orientations: [],
  dateFrom: '',
  dateTo: '',
});

export const DEFAULT_ANALYST_REVIEW = Object.freeze({
  priceLow: null,
  priceHigh: null,
  rationale: '',
});

export const ANALYST_ADJUSTMENT_OPTIONS = Object.freeze([
  { value: 'market_tension', label: 'Tension de marche' },
  { value: 'rarity', label: 'Rareté du bien' },
  { value: 'dpe', label: 'DPE' },
  { value: 'condition', label: 'Etat / travaux' },
  { value: 'floor', label: 'Etage' },
  { value: 'orientation', label: 'Orientation' },
  { value: 'outdoor', label: 'Balcon / terrasse' },
  { value: 'parking', label: 'Parking / cave' },
  { value: 'view', label: 'Vue' },
  { value: 'transport', label: 'Transport quartier' },
  { value: 'schools', label: 'Ecoles quartier' },
  { value: 'environment', label: 'Environnement quartier' },
  { value: 'noise_risk', label: 'Nuisances / risques' },
  { value: 'custom', label: 'Autre' },
]);

export const DEFAULT_BUILDING_META = Object.freeze({
  lotMix: EMPTY_LOT_MIX,
  occupiedLotCount: null,
  vacantLotCount: null,
  commercialLotCount: null,
  commonPartsCondition: null,
  notes: '',
});

function toNullableNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNullableBoolean(value) {
  if (value === true || value === false) return value;
  return null;
}

function uniqueValues(list, fallback = []) {
  if (!Array.isArray(list)) return [...fallback];
  return [...new Set(list.filter(Boolean))];
}

function normalizeAsset(asset) {
  if (!asset || typeof asset !== 'object') return null;
  if (!asset.dataUrl) return null;
  return {
    id: asset.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: asset.name || 'image.jpg',
    dataUrl: asset.dataUrl,
    createdAt: asset.createdAt || new Date().toISOString(),
  };
}

function normalizeAssets(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAsset).filter(Boolean);
}

function normalizeAnalystAdjustment(item = {}) {
  return {
    id: item.id || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    key: item.key || 'custom',
    pct: toNullableNumber(item.pct) ?? 0,
  };
}

function normalizeAnalystAdjustments(list = []) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeAnalystAdjustment);
}

export function normalizeLotMix(lotMix = {}) {
  return {
    T1: Math.max(0, toNullableNumber(lotMix.T1) ?? 0),
    T2: Math.max(0, toNullableNumber(lotMix.T2) ?? 0),
    T3: Math.max(0, toNullableNumber(lotMix.T3) ?? 0),
    T4: Math.max(0, toNullableNumber(lotMix.T4) ?? 0),
    T5: Math.max(0, toNullableNumber(lotMix.T5) ?? 0),
  };
}

export function normalizeTarget(target = {}, analysisMode = 'single') {
  return {
    surfaceM2: toNullableNumber(target.surfaceM2),
    rooms: toNullableNumber(target.rooms),
    bedrooms: toNullableNumber(target.bedrooms),
    type: target.type || (analysisMode === 'single' ? 'Apartment' : null),
    floor: toNullableNumber(target.floor),
    totalFloors: toNullableNumber(target.totalFloors),
    hasElevator: toNullableBoolean(target.hasElevator),
    orientation: target.orientation || null,
    hasBalcony: toNullableBoolean(target.hasBalcony),
    hasTerrace: toNullableBoolean(target.hasTerrace),
    hasParking: toNullableBoolean(target.hasParking),
    hasCellar: toNullableBoolean(target.hasCellar),
    yearBuilt: toNullableNumber(target.yearBuilt),
    condition: target.condition || null,
    dpe: target.dpe || null,
    outdoorAreaM2: toNullableNumber(target.outdoorAreaM2),
    viewQuality: target.viewQuality || null,
    hasPool: toNullableBoolean(target.hasPool),
    hasGarden: toNullableBoolean(target.hasGarden),
    isDuplex: toNullableBoolean(target.isDuplex),
    occupancyStatus: target.occupancyStatus || null,
    notes: target.notes || '',
  };
}

export function normalizeBuildingMeta(buildingMeta = null) {
  if (!buildingMeta) return { ...DEFAULT_BUILDING_META, lotMix: { ...EMPTY_LOT_MIX } };
  return {
    lotMix: normalizeLotMix(buildingMeta.lotMix),
    occupiedLotCount: toNullableNumber(buildingMeta.occupiedLotCount),
    vacantLotCount: toNullableNumber(buildingMeta.vacantLotCount),
    commercialLotCount: toNullableNumber(buildingMeta.commercialLotCount),
    commonPartsCondition: buildingMeta.commonPartsCondition || null,
    notes: buildingMeta.notes || '',
  };
}

export function normalizeAnalystFilters(filters = {}) {
  return {
    negotiationRate: toNullableNumber(filters.negotiationRate) ?? DEFAULT_ANALYST_FILTERS.negotiationRate,
    ppm2Min: toNullableNumber(filters.ppm2Min),
    ppm2Max: toNullableNumber(filters.ppm2Max),
    types: uniqueValues(filters.types),
    sources: uniqueValues(filters.sources, DEFAULT_ANALYST_FILTERS.sources),
    areaMin: toNullableNumber(filters.areaMin),
    areaMax: toNullableNumber(filters.areaMax),
    floorMin: toNullableNumber(filters.floorMin),
    floorMax: toNullableNumber(filters.floorMax),
    dpe: uniqueValues(filters.dpe),
    orientations: uniqueValues(filters.orientations),
    dateFrom: filters.dateFrom || '',
    dateTo: filters.dateTo || '',
  };
}

export function normalizeAnalystReview(review = {}) {
  return {
    priceLow: toNullableNumber(review.priceLow),
    priceHigh: toNullableNumber(review.priceHigh),
    rationale: review.rationale || '',
  };
}

export function normalizeDossier(dossier = {}) {
  const analysisMode = dossier.analysisMode === 'building' ? 'building' : 'single';
  const target = normalizeTarget(dossier.target, analysisMode);
  const buildingMeta = analysisMode === 'building'
    ? normalizeBuildingMeta(dossier.buildingMeta)
    : null;
  const photos = normalizeAssets(dossier.photos);
  const coverPhoto = normalizeAsset(dossier.coverPhoto) || photos[0] || null;
  const reportBrandLogo = normalizeAsset(dossier.reportBrandLogo);
  const archivedAt = dossier.archivedAt || null;
  const allowedStatuses = ['draft', 'in_progress', 'estimated', 'confirmed', 'archived'];
  const normalizedStatus = archivedAt
    ? 'archived'
    : allowedStatuses.includes(dossier.status)
      ? dossier.status
      : 'draft';

  return {
    id: dossier.id,
    createdAt: dossier.createdAt || new Date().toISOString(),
    updatedAt: dossier.updatedAt || dossier.createdAt || new Date().toISOString(),
    status: normalizedStatus,
    analysisMode,
    address: dossier.address || '',
    geocodedAddress: dossier.geocodedAddress || dossier.address || '',
    lat: toNullableNumber(dossier.lat),
    lng: toNullableNumber(dossier.lng),
    radiusMeters: toNullableNumber(dossier.radiusMeters) ?? 500,
    target,
    buildingMeta,
    selogerSnapshot: dossier.selogerSnapshot || null,
    dvfSnapshot: dossier.dvfSnapshot || null,
    collectionCriteria: dossier.collectionCriteria || null,
    selectedComps: Array.isArray(dossier.selectedComps) ? dossier.selectedComps : [],
    lots: Array.isArray(dossier.lots) ? dossier.lots : [],
    analystFilters: normalizeAnalystFilters(dossier.analystFilters),
    analystExclusions: dossier.analystExclusions || {},
    analystSourceWeights: dossier.analystSourceWeights || { dvf: 1, seloger: 1 },
    analystBasePm2: toNullableNumber(dossier.analystBasePm2),
    analystAdjustments: normalizeAnalystAdjustments(dossier.analystAdjustments),
    analystReview: normalizeAnalystReview(dossier.analystReview),
    prixPivot: toNullableNumber(dossier.prixPivot),
    manualEstimate: toNullableNumber(dossier.manualEstimate),
    areaContext: dossier.areaContext || null,
    lastEstimate: dossier.lastEstimate || null,
    confirmed: dossier.confirmed || null,
    propertyDescription: dossier.propertyDescription || '',
    photos,
    coverPhoto,
    reportBrandLogo,
    archivedAt,

    // ── New enrichment snapshots (nullable, backward-compatible) ──
    codeInsee: dossier.codeInsee || null,
    dvfPlusSnapshot: normalizeDvfPlusSnapshot(dossier.dvfPlusSnapshot),
    dpeSnapshot: normalizeDpeSnapshot(dossier.dpeSnapshot),
    riskProfile: normalizeRiskProfile(dossier.riskProfile),
    buildingProfile: normalizeBuildingProfile(dossier.buildingProfile),
    parcelleInfo: normalizeCadastreSnapshot(dossier.parcelleInfo),
    coproProfile: dossier.coproProfile || null,
    marketIndicators: normalizeMarketIndicators(dossier.marketIndicators),
    priceHistory: normalizeCastorusSnapshot(dossier.priceHistory),
    pappersSnapshot: normalizePappersSnapshot(dossier.pappersSnapshot),
    negotiation: dossier.negotiation || null,
  };
}

export function sumLotMix(lotMix = EMPTY_LOT_MIX) {
  return Object.values(normalizeLotMix(lotMix)).reduce((sum, value) => sum + value, 0);
}

export function formatLotMixSummary(lotMix = EMPTY_LOT_MIX) {
  return Object.entries(normalizeLotMix(lotMix))
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${type}`)
    .join(', ');
}
