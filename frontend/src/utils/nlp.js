function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const CONDITION_PATTERNS = [
  { re: /\brefait a neuf\b/, value: 'renovated', coeff: 1.07, label: 'Refait a neuf' },
  { re: /\b(entierement|completement) renove\b/, value: 'renovated', coeff: 1.07, label: 'Entierement renove' },
  { re: /\brenovation recente\b/, value: 'renovated', coeff: 1.06, label: 'Renovation recente' },
  { re: /\betat neuf\b|\bneuf\b|\bneuve\b/, value: 'renovated', coeff: 1.05, label: 'Etat neuf' },
  { re: /\bbon etat general\b|\bbien entretenu\b/, value: 'good', coeff: 1.02, label: 'Bon etat general' },
  { re: /\ba rafraichir\b|\brafraichissement\b/, value: 'refresh', coeff: 0.93, label: 'Rafraichissement' },
  { re: /\btravaux a prevoir\b|\btravaux\b/, value: 'heavy_work', coeff: 0.9, label: 'Travaux a prevoir' },
  { re: /\ba renover\b|\brenovation complete\b/, value: 'heavy_work', coeff: 0.85, label: 'A renover' },
];

const VIEW_PATTERNS = [
  { re: /\bvue panoramique\b/, value: 'open', coeff: 1.07, label: 'Vue panoramique' },
  { re: /\bvue degagee\b|\bsans vis a vis\b/, value: 'open', coeff: 1.06, label: 'Vue degagee' },
  { re: /\bvue sur (mer|fleuve|riviere|lac|montagne)\b/, value: 'open', coeff: 1.08, label: 'Vue exceptionnelle' },
  { re: /\bvue sur (parc|jardin|square)\b/, value: 'courtyard', coeff: 1.04, label: 'Vue parc ou jardin' },
  { re: /\bcour interieure\b/, value: 'courtyard', coeff: 0.97, label: 'Cour interieure' },
  { re: /\bvis a vis\b/, value: 'vis_a_vis', coeff: 0.94, label: 'Vis a vis' },
  { re: /\bvue sur (voie ferree|autoroute|boulevard passant|peripherique)\b/, value: 'nuisance', coeff: 0.9, label: 'Vue nuisance' },
  { re: /\bvue sur mur\b/, value: 'nuisance', coeff: 0.93, label: 'Vue sur mur' },
];

const FEATURE_PATTERNS = [
  { re: /\bpiscine\b|\bpool\b/, key: 'hasPool', label: 'Piscine' },
  { re: /\bjardin\b|\bgarden\b/, key: 'hasGarden', label: 'Jardin' },
  { re: /\bduplex\b|\btriplex\b/, key: 'isDuplex', label: 'Duplex ou triplex' },
];

function findFirstMatch(patterns, text) {
  const normalized = normalizeText(text);
  for (const pattern of patterns) {
    if (pattern.re.test(normalized)) return pattern;
  }
  return null;
}

export function analyzeListingText(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      normalized,
      keywords: [],
      condition: null,
      viewQuality: null,
      hasPool: false,
      hasGarden: false,
      isDuplex: false,
    };
  }

  const conditionMatch = findFirstMatch(CONDITION_PATTERNS, normalized);
  const viewMatch = findFirstMatch(VIEW_PATTERNS, normalized);

  const features = FEATURE_PATTERNS.reduce(
    (acc, feature) => {
      if (feature.re.test(normalized)) {
        acc[feature.key] = true;
        acc.keywords.push(feature.label);
      }
      return acc;
    },
    { hasPool: false, hasGarden: false, isDuplex: false, keywords: [] }
  );

  if (conditionMatch) features.keywords.push(conditionMatch.label);
  if (viewMatch) features.keywords.push(viewMatch.label);

  return {
    normalized,
    keywords: [...new Set(features.keywords)],
    condition: conditionMatch
      ? { value: conditionMatch.value, coeff: conditionMatch.coeff, label: conditionMatch.label }
      : null,
    viewQuality: viewMatch
      ? { value: viewMatch.value, coeff: viewMatch.coeff, label: viewMatch.label }
      : null,
    hasPool: features.hasPool,
    hasGarden: features.hasGarden,
    isDuplex: features.isDuplex,
  };
}

export function extractKeywords(text) {
  return analyzeListingText(text).keywords;
}

export function suggestEtatCoeff(text) {
  return analyzeListingText(text).condition;
}

export function suggestVueCoeff(text) {
  return analyzeListingText(text).viewQuality;
}
