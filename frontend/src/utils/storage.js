import { normalizeDossier } from './dossiers';
import { analyzeListingText } from './nlp';
import { inferPropertyType } from './propertyType';

const DOSSIERS_KEY = 'estimia_dossiers_v1';
const MODEL_KEY = 'estimia_model_v1';

export function loadDossiers() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DOSSIERS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeDossier) : [];
  } catch {
    return [];
  }
}

export function saveDossiers(dossiers) {
  try {
    localStorage.setItem(DOSSIERS_KEY, JSON.stringify(dossiers.slice(0, 50)));
    return { ok: true };
  } catch (e) {
    if (e.name === 'QuotaExceededError') return { ok: false, error: 'quota' };
    return { ok: false, error: e.message };
  }
}

export const DEFAULT_MODEL = {
  samples: [],
  correctionFactor: 1,
  mae: null,
  mape: null,
};

export function loadModel() {
  try {
    const s = localStorage.getItem(MODEL_KEY);
    return s ? { ...DEFAULT_MODEL, ...JSON.parse(s) } : { ...DEFAULT_MODEL };
  } catch {
    return { ...DEFAULT_MODEL };
  }
}

export function saveModel(model) {
  try {
    localStorage.setItem(MODEL_KEY, JSON.stringify(model));
  } catch {
    // Ignore non-critical persistence errors.
  }
}

function _toStr(value) {
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && typeof value.value === 'string') return value.value.toLowerCase();
  return '';
}

function _kfNum(kf, keyword) {
  const hit = kf.find(item => item.includes(keyword));
  if (!hit) return null;
  const match = hit.match(/(\d+[.,]?\d*)/);
  return match ? parseFloat(match[1].replace(',', '.')) : null;
}

function _parsePrice(str) {
  if (!str) return null;
  const digits = str.replace(/\s/g, '').match(/\d+/g);
  if (!digits) return null;
  return parseInt(digits.join(''), 10) || null;
}

function _stripHtml(str) {
  return String(str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function _extractDpe(...values) {
  const candidates = values
    .flatMap(value => {
      if (value == null) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'object') return Object.values(value);
      return [value];
    })
    .map(value => String(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const direct = candidate.trim().toUpperCase();
    if (/^[A-G]$/.test(direct)) return direct;
  }

  for (const candidate of candidates) {
    const text = _toStr(candidate);
    const contextual = text.match(/(?:dpe|energie|performance energetique|classe energetique)\s*[:-]?\s*([a-g])/i);
    if (contextual) return contextual[1].toUpperCase();
  }

  return null;
}

function _extractYearBuilt(...values) {
  for (const value of values.flat()) {
    const text = _toStr(value);
    if (!text) continue;
    const match =
      text.match(/annee de construction\s*[:-]?\s*(19\d{2}|20\d{2})/i) ||
      text.match(/construit(?:e)? en\s*(19\d{2}|20\d{2})/i) ||
      text.match(/\b(19\d{2}|20\d{2})\b/);
    if (!match) continue;
    const year = parseInt(match[1], 10);
    if (year >= 1800 && year <= new Date().getFullYear()) return year;
  }
  return null;
}

function _extractCoords(classified) {
  const candidates = [
    classified?.coordinates,
    classified?.location?.coordinates,
    classified?.location?.address?.coordinates,
    classified?.location,
  ];

  for (const candidate of candidates) {
    const lat = Number(candidate?.lat ?? candidate?.latitude);
    const lng = Number(candidate?.lng ?? candidate?.lon ?? candidate?.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }

  return null;
}

export function stripSelogerClassified(classified) {
  const rawKeyfacts = Array.isArray(classified?.hardFacts?.keyfacts) ? classified.hardFacts.keyfacts : [];
  const keyfacts = rawKeyfacts.map(_toStr).filter(Boolean);
  const tags = (
    Array.isArray(classified?.tags)
      ? classified.tags
      : Array.isArray(classified?.features)
        ? classified.features
        : []
  )
    .map(_toStr)
    .filter(Boolean);
  const all = [...keyfacts, ...tags];

  let floor = null;
  for (const keyfact of all) {
    const match = keyfact.match(/[ée]tage\s+(\d+)/i) || keyfact.match(/^(\d+)\s*(?:er|ere|eme|e)\s+[ée]tage/i);
    if (match) {
      floor = parseInt(match[1], 10);
      break;
    }
  }

  const ORIENTATION_MAP = {
    'sud-ouest': 'SW',
    'sud-est': 'SE',
    'nord-ouest': 'NW',
    'nord-est': 'NE',
    sud: 'S',
    nord: 'N',
    est: 'E',
    ouest: 'W',
  };

  let orientation = null;
  outer:
  for (const entry of all) {
    for (const [word, code] of Object.entries(ORIENTATION_MAP)) {
      if (entry.includes(word)) {
        orientation = code;
        break outer;
      }
    }
  }

  const has = (...words) => all.some(entry => words.some(word => entry.includes(word)));
  const loc = classified?.location?.address || {};
  const title = classified?.hardFacts?.title || '';
  const description = _stripHtml(
    classified?.description || classified?.descriptionHtml || classified?.summary || classified?.shortDescription || ''
  );
  const textAnalysis = analyzeListingText([title, description, ...keyfacts, ...tags].join(' '));
  const coords = _extractCoords(classified);
  const dpe = _extractDpe(
    classified?.energyBalance?.energyCategory,
    classified?.energyBalance?.dpe,
    classified?.energyPerformanceDiagnosis,
    classified?.energyCertificateClass,
    rawKeyfacts,
    tags
  );
  const yearBuilt = _extractYearBuilt(
    rawKeyfacts,
    description,
    classified?.constructionYear,
    classified?.yearOfConstruction
  );
  const nbLots = _kfNum(keyfacts, 'lot');

  const stripped = {
    title,
    price: _parsePrice(classified?.hardFacts?.price?.value),
    ppm2: _parsePrice(classified?.hardFacts?.price?.additionalInformation),
    area: _kfNum(keyfacts, 'm²'),
    rooms: _kfNum(keyfacts, 'pièce'),
    city: loc.city || '',
    zip: loc.zipCode || '',
    district: loc.district || '',
    agency: classified?.provider?.intermediaryCard?.title || '',
    url: classified?.url || '',
    keywords: textAnalysis.keywords,
    propertyType: inferPropertyType(
      classified?.estateType,
      classified?.realEstateType,
      classified?.type,
      classified?.classification,
      title,
      description
    ),
  };

  const bedrooms = _kfNum(keyfacts, 'chambre');
  if (bedrooms != null) stripped.bedrooms = bedrooms;
  if (floor != null) stripped.floor = floor;
  if (orientation) stripped.orientation = orientation;
  if (dpe) stripped.dpe = dpe;
  if (yearBuilt != null) stripped.yearBuilt = yearBuilt;
  if (nbLots != null) stripped.nbLots = nbLots;
  if (has('ascenseur', 'elevator')) stripped.hasElevator = true;
  if (has('balcon', 'balcony')) stripped.hasBalcony = true;
  if (has('terrasse', 'terrace')) stripped.hasTerrace = true;
  if (has('parking', 'garage', 'box')) stripped.hasParking = true;
  if (has('cave', 'cellar')) stripped.hasCellar = true;
  if (textAnalysis.condition?.value) stripped.condition = textAnalysis.condition.value;
  if (textAnalysis.viewQuality?.value) stripped.viewQuality = textAnalysis.viewQuality.value;
  if (textAnalysis.hasPool || has('piscine', 'pool')) stripped.hasPool = true;
  if (textAnalysis.hasGarden || has('jardin', 'garden')) stripped.hasGarden = true;
  if (textAnalysis.isDuplex) stripped.isDuplex = true;
  if (coords) {
    stripped.lat = coords.lat;
    stripped.lng = coords.lng;
  }

  return stripped;
}

export function stripSelogerSnapshot(data) {
  if (!data?.classifieds) return data;
  return { ...data, classifieds: data.classifieds.map(stripSelogerClassified) };
}

export function stripDvfFeature(feature) {
  const props = feature?.properties || {};
  const stripped = {
    address_name: props.address_name || '',
    room_count: props.room_count ?? null,
    area: props.area ?? 0,
    price: props.price || '',
    updated_price: props.updated_price ?? 0,
    sale_at: props.sale_at || '',
    item_type: props.item_type || props.itemType || null,
  };

  if (props.floor_number != null) stripped.floor_number = props.floor_number;
  if (props.nb_lots != null) stripped.nb_lots = props.nb_lots;

  const geometry =
    feature?.geometry?.type === 'Point' && Array.isArray(feature?.geometry?.coordinates)
      ? { type: 'Point', coordinates: feature.geometry.coordinates.slice(0, 2) }
      : null;

  return geometry ? { properties: stripped, geometry } : { properties: stripped };
}

export function stripDvfSnapshot(data) {
  if (!data?.features) return data;
  return { ...data, features: data.features.map(stripDvfFeature) };
}
