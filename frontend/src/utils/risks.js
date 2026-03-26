/**
 * Risk scoring and impact utilities — aggregates Géorisques data
 * into a score and estimates value impact.
 */

// ── Risk score computation ───────────────────────────────────────────────────

export function computeRiskScore(riskProfile) {
  if (!riskProfile) return null;

  let score = 100; // Start at 100 (no risk), subtract for each risk

  // Natural risks from GASPAR
  const risques = riskProfile.risques || [];
  for (const r of risques) {
    const type = (r.libelle_risque_jo || r.type || '').toLowerCase();
    if (type.includes('inondation')) score -= 15;
    else if (type.includes('sismique') || type.includes('seisme')) score -= 10;
    else if (type.includes('mouvement de terrain')) score -= 10;
    else if (type.includes('feu de foret') || type.includes('incendie')) score -= 8;
    else if (type.includes('tempete') || type.includes('cyclone')) score -= 5;
    else score -= 3;
  }

  // Radon
  const radon = riskProfile.radon;
  if (radon) {
    const classe = radon.classe_potentiel || radon.classe || 0;
    if (classe >= 3) score -= 12;
    else if (classe >= 2) score -= 5;
  }

  // Underground cavities
  const cavites = riskProfile.cavites || [];
  if (cavites.length >= 3) score -= 10;
  else if (cavites.length > 0) score -= 5;

  // Classified installations (pollution)
  const installations = riskProfile.installationsClassees || [];
  if (installations.length >= 5) score -= 12;
  else if (installations.length >= 2) score -= 6;
  else if (installations.length > 0) score -= 3;

  // Polluted sites
  const polluted = riskProfile.sitesPollues || [];
  if (polluted.length > 0) score -= 15;

  // Natural disasters history
  const catnat = riskProfile.catastrophesNaturelles || [];
  if (catnat.length >= 10) score -= 10;
  else if (catnat.length >= 5) score -= 5;

  // Seismic zone
  const sismique = riskProfile.zoneSismique;
  if (sismique) {
    const zone = parseInt(sismique.code_zone || sismique.zone || '1');
    if (zone >= 4) score -= 15;
    else if (zone >= 3) score -= 8;
    else if (zone >= 2) score -= 3;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Value impact estimation ──────────────────────────────────────────────────

export function riskImpactOnValue(riskProfile) {
  if (!riskProfile) return { impactPct: 0, details: [] };

  const details = [];
  let totalImpact = 0;

  const risques = riskProfile.risques || [];
  const hasFlood = risques.some(r =>
    (r.libelle_risque_jo || r.type || '').toLowerCase().includes('inondation')
  );
  if (hasFlood) {
    details.push({ type: 'Inondation', impactPct: -8, description: 'Zone inondable — décote typique de 5-15%' });
    totalImpact -= 8;
  }

  const polluted = riskProfile.sitesPollues || [];
  if (polluted.length > 0) {
    const impact = Math.min(polluted.length * 3, 10);
    details.push({ type: 'Site pollué', impactPct: -impact, description: `${polluted.length} site(s) pollué(s) à proximité` });
    totalImpact -= impact;
  }

  const installations = riskProfile.installationsClassees || [];
  if (installations.length >= 3) {
    details.push({ type: 'Installations classées', impactPct: -4, description: 'Concentration d\'installations industrielles' });
    totalImpact -= 4;
  }

  const sismique = riskProfile.zoneSismique;
  if (sismique) {
    const zone = parseInt(sismique.code_zone || sismique.zone || '1');
    if (zone >= 4) {
      details.push({ type: 'Zone sismique', impactPct: -5, description: `Zone sismique ${zone} (forte)` });
      totalImpact -= 5;
    }
  }

  const radon = riskProfile.radon;
  if (radon && (radon.classe_potentiel >= 3 || radon.classe >= 3)) {
    details.push({ type: 'Radon', impactPct: -3, description: 'Potentiel radon élevé (classe 3)' });
    totalImpact -= 3;
  }

  return {
    impactPct: Math.max(-25, totalImpact),
    details,
  };
}

// ── Human-readable summary ───────────────────────────────────────────────────

export function formatRiskSummary(riskProfile) {
  if (!riskProfile) return 'Données de risques non disponibles.';

  const parts = [];
  const risques = riskProfile.risques || [];
  if (risques.length > 0) {
    parts.push(`${risques.length} risque(s) naturel(s) identifié(s)`);
  }

  const radon = riskProfile.radon;
  if (radon) {
    const classe = radon.classe_potentiel || radon.classe || 0;
    const labels = ['', 'faible', 'moyen', 'élevé'];
    parts.push(`Radon : potentiel ${labels[classe] || 'inconnu'}`);
  }

  const polluted = riskProfile.sitesPollues || [];
  if (polluted.length > 0) {
    parts.push(`${polluted.length} site(s) pollué(s) dans un rayon de 500m`);
  }

  const installations = riskProfile.installationsClassees || [];
  if (installations.length > 0) {
    parts.push(`${installations.length} installation(s) classée(s) dans un rayon de 1km`);
  }

  const catnat = riskProfile.catastrophesNaturelles || [];
  if (catnat.length > 0) {
    parts.push(`${catnat.length} catastrophe(s) naturelle(s) déclarée(s)`);
  }

  const sismique = riskProfile.zoneSismique;
  if (sismique) {
    const zone = sismique.code_zone || sismique.zone || '1';
    const labels = { '1': 'très faible', '2': 'faible', '3': 'modérée', '4': 'moyenne', '5': 'forte' };
    parts.push(`Zone sismique : ${labels[zone] || zone}`);
  }

  return parts.length > 0 ? parts.join(' · ') : 'Aucun risque majeur identifié.';
}

// ── Risk level label ─────────────────────────────────────────────────────────

export function riskScoreLabel(score) {
  if (score == null) return 'Inconnu';
  if (score >= 80) return 'Faible';
  if (score >= 60) return 'Modéré';
  if (score >= 40) return 'Élevé';
  return 'Très élevé';
}

export function riskScoreColor(score) {
  if (score == null) return '#9ca3af';
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}
