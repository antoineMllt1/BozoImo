// GDP — Grille De Prix calculations

export const DEFAULT_COEFFICIENTS = {
  floorNoElevator: { 0: 0.90, 1: 0.95, 2: 1.00, 3: 1.02, 4: 1.04, 5: 1.06, 6: 1.08 },
  floorElevator:   { 0: 0.95, 1: 0.97, 2: 1.00, 3: 1.02, 4: 1.04, 5: 1.06, 6: 1.10 },
  orientation: { N: 0.95, E: 0.99, S: 1.04, O: 1.02 },
  dpe: { A: 1.02, B: 1.00, C: 0.97, D: 0.93, E: 0.88, F: 0.80, G: 0.80 },
  vue: {
    'Dégagée / Horizon':     1.07,
    'Jardin / Cour arborée': 1.03,
    'Standard':              1.00,
    'Cour intérieure':       0.97,
    'Vis-à-vis / Mur':       0.93,
    'Nuisance':              0.90,
  },
  etat: {
    'Refait à neuf':     1.06,
    'Bon état général':  1.01,
    "État d'usage":      0.96,
    'Rafraîchissement':  0.92,
    'Travaux importants':0.86,
    'Travaux lourds':    0.78,
  },
};

export const VUE_OPTIONS  = Object.keys(DEFAULT_COEFFICIENTS.vue);
export const ETAT_OPTIONS = Object.keys(DEFAULT_COEFFICIENTS.etat);

export function getFloorCoeff(floor, hasElevator, c) {
  const table = hasElevator ? c.floorElevator : c.floorNoElevator;
  return table[Math.min(floor ?? 0, 6)] ?? 1.00;
}

export function computeSurfacePonderee(SHAB, surface_ext = 0) {
  return +(SHAB + (surface_ext || 0) * 0.20).toFixed(2);
}

export function computePrixFaiVacant(prixPivot, lot, c) {
  if (!prixPivot || !lot.SHAB) return null;
  const cFloor  = getFloorCoeff(lot.floor, lot.hasElevator, c);
  const cOrient = lot.orientation ? (c.orientation[lot.orientation] ?? 1.00) : 1.00;
  const cDpe    = lot.dpe         ? (c.dpe[lot.dpe]                 ?? 1.00) : 1.00;
  const cVue    = lot.vue         ? (c.vue[lot.vue]                 ?? 1.00) : 1.00;
  const cEtat   = lot.etat        ? (c.etat[lot.etat]               ?? 1.00) : 1.00;
  const coeffCombined = cFloor * cOrient * cDpe * cVue * cEtat;
  const surfPond = computeSurfacePonderee(lot.SHAB, lot.surface_ext);
  const prixFai  = Math.round(prixPivot * coeffCombined * surfPond);
  return { prixFai, surfPond, coeffCombined, detail: { cFloor, cOrient, cDpe, cVue, cEtat } };
}

function decoteReversion(loyerPlace, loyerMarche) {
  if (!loyerPlace || !loyerMarche) return 0;
  const reversion = (loyerMarche - loyerPlace) / loyerMarche;
  if (reversion < -0.10) return 0.25;
  if (reversion < 0) return 0.10 + ((-reversion) / 0.10) * 0.15;
  if (reversion < 0.50) return 0.06;
  if (reversion < 1.00) return 0.10;
  return 0.15;
}

export function computePrixOccupe(prixFaiVacant, lot) {
  if (!prixFaiVacant || !lot.isOccupied) return null;
  const dRev   = decoteReversion(lot.loyer_en_place, lot.loyer_marche_estime);
  const dAge   = (lot.age_locataire != null && lot.age_locataire > 59) ? 0.10 : 0;
  const dDuree = lot.decote_duree ?? 0;
  const decoteTotal = 1 - (1 - dRev) * (1 - dAge) * (1 - dDuree);
  return { prixOccupe: Math.round(prixFaiVacant * (1 - decoteTotal)), dRev, dAge, dDuree, decoteTotal };
}

export function computeAlerts(lot) {
  const a = [];
  if (!lot.vue || !lot.etat) a.push({ type: 'warn', msg: 'Vue et état requis — lot incomplet GDP' });
  if (lot.dpe === 'F' || lot.dpe === 'G') a.push({ type: 'danger', msg: `DPE ${lot.dpe} — passoire thermique` });
  if (lot.isOccupied && lot.age_locataire > 59) a.push({ type: 'danger', msg: `Locataire protégé (${lot.age_locataire} ans)` });
  return a;
}

export function computeLot(lot, prixPivot, c) {
  const vacant  = computePrixFaiVacant(prixPivot, lot, c);
  const occupe  = lot.isOccupied ? computePrixOccupe(vacant?.prixFai, lot) : null;
  const alerts  = computeAlerts(lot);
  const parking = (lot.parking_count || 0) * (lot.parking_unit_price || 0);
  const travaux = lot.travaux_estime || 0;
  const prixBase  = occupe?.prixOccupe ?? vacant?.prixFai ?? 0;
  const prixFinal = prixBase + parking;
  const prixNet   = prixFinal - travaux;
  return { ...vacant, ...occupe, alerts, parking, travaux, prixFinal, prixNet };
}

export function newLot(overrides = {}) {
  return {
    id: `lot_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ugNumber: '',
    nature: 'Appartement',
    type: 'T3',
    floor: 2,
    hasElevator: true,
    orientation: null,
    dpe: null,
    vue: null,
    etat: null,
    SHAB: null,
    surface_ext: 0,
    isOccupied: false,
    loyer_en_place: null,
    loyer_marche_estime: null,
    age_locataire: null,
    decote_duree: 0,
    parking_count: 0,
    parking_unit_price: 0,
    travaux_estime: 0,
    ...overrides,
  };
}
