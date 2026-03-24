// NLP patterns for SeLoger descriptions

const ETAT_PATTERNS = [
  { re: /refait\s+(à\s+neuf|entièrement|complètement)/i, coeff: 1.07, label: 'Refait à neuf' },
  { re: /entièrement\s+rénov/i,                          coeff: 1.06, label: 'Entièrement rénové' },
  { re: /\bréno(vé|vée|vation\s+récente)\b/i,            coeff: 1.05, label: 'Rénové' },
  { re: /\b(neuf|neuve)\b/i,                             coeff: 1.05, label: 'État neuf' },
  { re: /bon\s+état\s+général/i,                         coeff: 1.01, label: 'Bon état général' },
  { re: /à\s+rafraîchi/i,                                coeff: 0.93, label: 'Rafraîchissement' },
  { re: /travaux\s+à\s+prévoir/i,                        coeff: 0.90, label: 'Travaux à prévoir' },
  { re: /à\s+rénov/i,                                    coeff: 0.85, label: 'À rénover' },
  { re: /\btravaux\b/i,                                  coeff: 0.90, label: 'Travaux' },
];

const VUE_PATTERNS = [
  { re: /vue\s+panoramique/i,                                    coeff: 1.07, label: 'Vue panoramique' },
  { re: /vue\s+dégagée/i,                                        coeff: 1.06, label: 'Vue dégagée' },
  { re: /vue\s+sur\s+(mer|fleuve|rivière|lac|montagne)/i,        coeff: 1.08, label: 'Vue exceptionnelle' },
  { re: /vue\s+sur\s+(parc|jardin|square)/i,                     coeff: 1.04, label: 'Vue parc/jardin' },
  { re: /vis-à-vis/i,                                            coeff: 0.94, label: 'Vis-à-vis' },
  { re: /cour\s+intérieure/i,                                    coeff: 0.97, label: 'Cour intérieure' },
  { re: /vue\s+sur\s+(voie\s+ferrée|autoroute|boulevard\s+passant)/i, coeff: 0.90, label: 'Vue nuisance' },
  { re: /vue\s+sur\s+mur/i,                                      coeff: 0.93, label: 'Vue sur mur' },
];

export function extractKeywords(text) {
  if (!text) return [];
  const kw = [];
  for (const p of [...ETAT_PATTERNS, ...VUE_PATTERNS]) {
    if (p.re.test(text)) kw.push(p.label);
  }
  return kw;
}

export function suggestEtatCoeff(text) {
  if (!text) return null;
  for (const p of ETAT_PATTERNS) if (p.re.test(text)) return { coeff: p.coeff, label: p.label };
  return null;
}

export function suggestVueCoeff(text) {
  if (!text) return null;
  for (const p of VUE_PATTERNS) if (p.re.test(text)) return { coeff: p.coeff, label: p.label };
  return null;
}
