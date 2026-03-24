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
