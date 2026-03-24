const DOSSIERS_KEY = 'estimia_dossiers_v1';
const MODEL_KEY    = 'estimia_model_v1';

// ─── Dossiers ─────────────────────────────────────────────────────────────────

export function loadDossiers() {
  try { return JSON.parse(localStorage.getItem(DOSSIERS_KEY) || '[]'); }
  catch { return []; }
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

// ─── Model ────────────────────────────────────────────────────────────────────

export const DEFAULT_MODEL = {
  samples:          [],
  correctionFactor: 1,
  mae:              null,
  mape:             null,
};

export function loadModel() {
  try {
    const s = localStorage.getItem(MODEL_KEY);
    return s ? { ...DEFAULT_MODEL, ...JSON.parse(s) } : { ...DEFAULT_MODEL };
  } catch { return { ...DEFAULT_MODEL }; }
}

export function saveModel(model) {
  try { localStorage.setItem(MODEL_KEY, JSON.stringify(model)); }
  catch { /* ignore — not critical */ }
}

// ─── SeLoger classified strip ─────────────────────────────────────────────────

function _toStr(v) {
  if (typeof v === 'string') return v.toLowerCase();
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && typeof v.value === 'string') return v.value.toLowerCase();
  return '';
}

function _kfNum(kf, kw) {
  const hit = kf.find(f => f.includes(kw));
  if (!hit) return null;
  const m = hit.match(/(\d+[\.,]?\d*)/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function _parsePrice(str) {
  if (!str) return null;
  const digits = str.replace(/\s/g, '').match(/\d+/g);
  if (!digits) return null;
  return parseInt(digits.join(''), 10) || null;
}

export function stripSelogerClassified(c) {
  const rawKf = Array.isArray(c.hardFacts?.keyfacts) ? c.hardFacts.keyfacts : [];
  const kf    = rawKf.map(_toStr).filter(Boolean);
  const tags  = (Array.isArray(c.tags) ? c.tags : Array.isArray(c.features) ? c.features : []).map(_toStr).filter(Boolean);
  const all   = [...kf, ...tags];

  // Floor
  let floor = null;
  for (const k of all) {
    const m = k.match(/[ée]tage\s+(\d+)/) || k.match(/^(\d+)\s*(?:er|ère|ème|e)\s+[ée]tage/i);
    if (m) { floor = parseInt(m[1], 10); break; }
  }

  // Orientation
  const ORI = { 'sud-ouest':'SW','sud-est':'SE','nord-ouest':'NW','nord-est':'NE', sud:'S',nord:'N',est:'E',ouest:'W' };
  let orientation = null;
  outer: for (const k of all) for (const [w, code] of Object.entries(ORI)) if (k.includes(w)) { orientation = code; break outer; }

  const has = (...ws) => all.some(k => ws.some(w => k.includes(w)));
  const loc = c.location?.address || {};

  const s = {
    title:    c.hardFacts?.title    || '',
    price:    _parsePrice(c.hardFacts?.price?.value),
    ppm2:     _parsePrice(c.hardFacts?.price?.additionalInformation),
    area:     _kfNum(kf, 'm²'),
    rooms:    _kfNum(kf, 'pièce'),
    city:     loc.city     || '',
    zip:      loc.zipCode  || '',
    district: loc.district || '',
    agency:   c.provider?.intermediaryCard?.title || '',
    url:      c.url || '',
  };

  // Optional — only include when present to save space
  const bedrooms = _kfNum(kf, 'chambre');
  if (bedrooms != null)                          s.bedrooms    = bedrooms;
  if (floor != null)                             s.floor       = floor;
  if (orientation)                               s.orientation = orientation;
  if (has('ascenseur', 'elevator'))              s.hasElevator = true;
  if (has('balcon', 'balcony'))                  s.hasBalcony  = true;
  if (has('terrasse', 'terrace'))                s.hasTerrace  = true;
  if (has('parking', 'garage', 'box'))           s.hasParking  = true;
  if (has('cave', 'cellar'))                     s.hasCellar   = true;

  return s;
}

export function stripSelogerSnapshot(data) {
  if (!data?.classifieds) return data;
  return { ...data, classifieds: data.classifieds.map(stripSelogerClassified) };
}

// ─── DVF feature strip ────────────────────────────────────────────────────────
// Keep only what's needed for display + estimation to save localStorage space

export function stripDvfFeature(feature) {
  const p = feature?.properties || {};
  const stripped = {
    address_name:  p.address_name  || '',
    room_count:    p.room_count    ?? null,
    area:          p.area          ?? 0,
    price:         p.price         || '',
    updated_price: p.updated_price ?? 0,
    sale_at:       p.sale_at       || '',
  };
  // Optional fields — only kept when present to save space
  if (p.floor_number != null)  stripped.floor_number  = p.floor_number;
  if (p.nb_lots       != null)  stripped.nb_lots       = p.nb_lots;
  return { properties: stripped };
}

export function stripDvfSnapshot(data) {
  if (!data?.features) return data;
  return { ...data, features: data.features.map(stripDvfFeature) };
}
