/**
 * Negotiation engine — aggregates signals from all data sources
 * to score negotiation potential and generate arguments.
 */

// ── Signal generation ────────────────────────────────────────────────────────

function castSignal(type, category, label, detail, impact, source) {
  return { type, category, label, detail, impact, source };
}

function askingPriceFromDossier(dossier) {
  const surface = Number(dossier?.target?.surfaceM2) || 0;
  if (surface > 0 && Number.isFinite(dossier?.manualEstimate)) {
    return dossier.manualEstimate * surface;
  }
  if (Number.isFinite(dossier?.priceHistory?.currentPrice)) return dossier.priceHistory.currentPrice;
  if (Number.isFinite(dossier?.lastEstimate?.estimatedPrice)) return dossier.lastEstimate.estimatedPrice;
  return null;
}

function readMarketMedian(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const candidates = [
    entry.prix_median,
    entry.prix_median_m2,
    entry.prix_m2_median,
    entry.mediane_prix,
    entry.mediane_prix_m2,
    entry.median_price,
  ];
  for (const candidate of candidates) {
    const number = Number(candidate);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function signalsFromCastorus(priceHistory) {
  if (!priceHistory?.found) return [];
  const signals = [];

  const days = priceHistory.daysOnMarket;
  if (days != null) {
    if (days > 180) {
      signals.push(castSignal('positive', 'seller', `Annonce active depuis ${days} jours`,
        'Bien en vente depuis plus de 6 mois — le prix est probablement trop élevé.', 10, 'castorus'));
    } else if (days > 90) {
      signals.push(castSignal('positive', 'seller', `Annonce active depuis ${days} jours`,
        'Durée supérieure à la moyenne du marché (~60-90j).', 6, 'castorus'));
    } else if (days > 60) {
      signals.push(castSignal('neutral', 'seller', `Annonce active depuis ${days} jours`,
        'Durée dans la moyenne du marché.', 2, 'castorus'));
    }
  }

  const changes = priceHistory.priceChanges || [];
  if (changes.length >= 3) {
    signals.push(castSignal('positive', 'price', `${changes.length} baisses de prix`,
      'Plusieurs baisses successives — le vendeur accepte que son prix est trop haut.', 8, 'castorus'));
  } else if (changes.length >= 1) {
    signals.push(castSignal('positive', 'price', `${changes.length} baisse(s) de prix`,
      'Le vendeur a déjà réduit son prix.', 4, 'castorus'));
  }

  const totalChange = priceHistory.totalPriceChange;
  if (totalChange != null && totalChange < -15) {
    signals.push(castSignal('positive', 'price', `Prix réduit de ${Math.abs(totalChange).toFixed(1)}%`,
      'Forte baisse depuis la mise en vente — marge de négociation importante.', 10, 'castorus'));
  } else if (totalChange != null && totalChange < -5) {
    signals.push(castSignal('positive', 'price', `Prix réduit de ${Math.abs(totalChange).toFixed(1)}%`,
      'Le vendeur montre de la flexibilité sur le prix.', 5, 'castorus'));
  }

  const agencies = priceHistory.agencies || [];
  if (agencies.length >= 3) {
    signals.push(castSignal('positive', 'seller', `Listé chez ${agencies.length} agences`,
      'Multi-mandat = le vendeur cherche activement à vendre.', 6, 'castorus'));
  } else if (agencies.length >= 2) {
    signals.push(castSignal('positive', 'seller', `Listé chez ${agencies.length} agences`,
      'Présence chez plusieurs agences.', 3, 'castorus'));
  }

  const vsMarket = priceHistory.priceVsMarket;
  if (vsMarket != null && vsMarket > 10) {
    signals.push(castSignal('positive', 'price', `${vsMarket.toFixed(1)}% au-dessus du marché`,
      'Le prix est significativement au-dessus du marché local.', 8, 'castorus'));
  } else if (vsMarket != null && vsMarket < -5) {
    signals.push(castSignal('negative', 'price', `${Math.abs(vsMarket).toFixed(1)}% en-dessous du marché`,
      'Bien positionné en-dessous du marché — moins de marge.', -5, 'castorus'));
  }

  return signals;
}

function signalsFromRisks(riskProfile) {
  if (!riskProfile) return [];
  const signals = [];

  const risques = riskProfile.risques || [];
  const floodRisk = risques.find(r =>
    (r.libelle_risque_jo || r.type || '').toLowerCase().includes('inondation')
  );
  if (floodRisk) {
    signals.push(castSignal('positive', 'risk', 'Zone inondable',
      'Le bien est en zone de risque d\'inondation — impact sur la valeur et l\'assurance.', 8, 'georisques'));
  }

  const radon = riskProfile.radon;
  if (radon && (radon.classe_potentiel >= 3 || radon.classe >= 3)) {
    signals.push(castSignal('positive', 'risk', 'Risque radon élevé',
      'Potentiel radon de classe 3 (élevé) — des mesures de mitigation peuvent être nécessaires.', 4, 'georisques'));
  }

  const polluted = riskProfile.sitesPollues || [];
  if (polluted.length > 0) {
    signals.push(castSignal('positive', 'risk', `${polluted.length} site(s) pollué(s) à proximité`,
      'Présence de sites pollués dans un rayon de 500m.', 6, 'georisques'));
  }

  const installations = riskProfile.installationsClassees || [];
  if (installations.length >= 3) {
    signals.push(castSignal('positive', 'risk', `${installations.length} installations classées proches`,
      'Concentration d\'installations industrielles classées à proximité.', 4, 'georisques'));
  }

  const catnat = riskProfile.catastrophesNaturelles || [];
  if (catnat.length >= 5) {
    signals.push(castSignal('positive', 'risk', `${catnat.length} catastrophes naturelles déclarées`,
      'Commune avec un historique important de catastrophes naturelles.', 5, 'georisques'));
  }

  return signals;
}

function signalsFromDPE(dpeSnapshot, targetDpe) {
  if (!targetDpe) return [];
  const signals = [];

  if (targetDpe === 'F' || targetDpe === 'G') {
    signals.push(castSignal('positive', 'energy', `DPE ${targetDpe} — passoire thermique`,
      `Depuis 2025, les logements classés G sont interdits à la location. Les F seront interdits en 2028. Travaux de rénovation énergétique obligatoires.`,
      targetDpe === 'G' ? 12 : 8, 'dpe'));
  } else if (targetDpe === 'E') {
    signals.push(castSignal('positive', 'energy', 'DPE E — rénovation recommandée',
      'Classe énergétique médiocre — coûts de chauffage élevés et interdiction de location prévue en 2034.', 4, 'dpe'));
  }

  if (dpeSnapshot?.results?.length > 0) {
    const results = dpeSnapshot.results;
    const dpeValues = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 };
    const targetValue = dpeValues[targetDpe] || 4;
    const avgDpe = results.reduce((sum, r) => {
      const v = dpeValues[(r.dpe || r['Etiquette_DPE'] || 'D').charAt(0)];
      return sum + (v || 4);
    }, 0) / results.length;

    if (targetValue > avgDpe + 1) {
      signals.push(castSignal('positive', 'energy', 'DPE inférieur à la moyenne du quartier',
        `Le bien est moins performant énergétiquement que les biens voisins (moyenne ${['A','B','C','D','E','F','G'][Math.round(avgDpe)-1]}).`, 4, 'dpe'));
    }
  }

  return signals;
}

function signalsFromDVFComparison(dvfPlusSnapshot, askingPrice, targetArea) {
  if (!dvfPlusSnapshot?.data?.features?.length || !askingPrice || !targetArea) return [];
  const signals = [];

  const features = dvfPlusSnapshot.data.features;
  const validSales = features
    .map(f => f.properties)
    .filter(p => p && p.updated_price > 0 && p.area > 5);

  if (validSales.length === 0) return signals;

  const dvfPpm2Values = validSales.map(p => p.updated_price / p.area);
  const medianDvfPpm2 = dvfPpm2Values.sort((a, b) => a - b)[Math.floor(dvfPpm2Values.length / 2)];
  const askingPpm2 = askingPrice / targetArea;
  const diffPct = ((askingPpm2 - medianDvfPpm2) / medianDvfPpm2) * 100;

  if (diffPct > 20) {
    signals.push(castSignal('positive', 'price', `${diffPct.toFixed(0)}% au-dessus des transactions réelles`,
      `Le prix demandé (${Math.round(askingPpm2)}€/m²) est ${diffPct.toFixed(0)}% au-dessus de la médiane des ventes DVF (${Math.round(medianDvfPpm2)}€/m²).`,
      Math.min(15, Math.round(diffPct / 2)), 'dvf'));
  } else if (diffPct > 10) {
    signals.push(castSignal('positive', 'price', `${diffPct.toFixed(0)}% au-dessus des transactions`,
      `Prix demandé supérieur aux transactions réelles du secteur.`,
      Math.round(diffPct / 3), 'dvf'));
  } else if (diffPct < -5) {
    signals.push(castSignal('negative', 'price', `Prix sous la médiane des transactions`,
      `Le prix demandé est ${Math.abs(diffPct).toFixed(0)}% en-dessous des transactions — bien positionné.`,
      Math.max(-8, Math.round(diffPct / 3)), 'dvf'));
  }

  return signals;
}

function signalsFromProperty(target) {
  const signals = [];

  if (target?.condition === 'heavy_work') {
    signals.push(castSignal('positive', 'property', 'Travaux lourds nécessaires',
      'Le bien nécessite des travaux importants — budget supplémentaire à prévoir.', 8, 'target'));
  } else if (target?.condition === 'refresh') {
    signals.push(castSignal('positive', 'property', 'Rafraîchissement nécessaire',
      'Le bien nécessite un rafraîchissement.', 4, 'target'));
  }

  if (target?.viewQuality === 'nuisance') {
    signals.push(castSignal('positive', 'property', 'Nuisance visuelle ou sonore',
      'Le bien souffre de nuisances — impact sur le confort de vie.', 5, 'target'));
  } else if (target?.viewQuality === 'vis_a_vis') {
    signals.push(castSignal('positive', 'property', 'Vis-à-vis',
      'Vue en vis-à-vis.', 3, 'target'));
  }

  if (target?.floor === 0) {
    signals.push(castSignal('positive', 'property', 'Rez-de-chaussée',
      'Les biens en RDC sont généralement décotés de 5-10%.', 4, 'target'));
  }

  if (target?.hasElevator === false && target?.floor >= 4) {
    signals.push(castSignal('positive', 'property', `${target.floor}e étage sans ascenseur`,
      'Étage élevé sans ascenseur — forte décote.', 6, 'target'));
  }

  return signals;
}

export function generateSignals(dossier) {
  const askingPrice = askingPriceFromDossier(dossier);
  const signals = [
    ...signalsFromCastorus(dossier.priceHistory),
    ...signalsFromRisks(dossier.riskProfile),
    ...signalsFromDPE(dossier.dpeSnapshot, dossier.target?.dpe),
    ...signalsFromDVFComparison(dossier.dvfPlusSnapshot || dossier.dvfSnapshot, askingPrice, dossier.target?.surfaceM2),
    ...signalsFromProperty(dossier.target),
  ];

  return signals.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

// ── Score computation ────────────────────────────────────────────────────────

export function computeNegotiationScore(signals) {
  if (!signals.length) return 50;
  const positiveSum = signals
    .filter(s => s.type === 'positive')
    .reduce((sum, s) => sum + s.impact, 0);
  const negativeSum = signals
    .filter(s => s.type === 'negative')
    .reduce((sum, s) => sum + Math.abs(s.impact), 0);
  const raw = 50 + (positiveSum - negativeSum);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// ── Argument generation ──────────────────────────────────────────────────────

export function generateArguments(signals) {
  return signals
    .filter(s => s.type === 'positive' && s.impact >= 3)
    .map(s => ({
      title: s.label,
      body: s.detail,
      strength: s.impact >= 8 ? 'strong' : s.impact >= 5 ? 'medium' : 'weak',
      category: s.category,
      source: s.source,
    }));
}

// ── Offer range ──────────────────────────────────────────────────────────────

export function suggestOfferRange(dossier, signals) {
  const estimate = dossier.lastEstimate;
  if (!estimate?.estimatedPrice) return null;

  const fairValue = estimate.estimatedPrice;
  const score = computeNegotiationScore(signals);
  const negoMarginPct = Math.max(3, Math.min(25, score * 0.25));
  const suggestedOffer = Math.round(fairValue * (1 - negoMarginPct / 100));
  const maxRecommended = Math.round(fairValue * 1.03);

  return {
    fairValue,
    suggestedOffer,
    maxRecommended,
    negoMarginPct: Math.round(negoMarginPct * 10) / 10,
    score,
  };
}

// ── Market position ──────────────────────────────────────────────────────────

export function computeMarketPosition(dossier) {
  const indicators = dossier.marketIndicators;
  const priceHistory = dossier.priceHistory;

  const result = {
    trend: 'stable',
    trendPct: 0,
    avgDaysOnMarket: priceHistory?.daysOnMarket || null,
    buyerSellerBalance: 'balanced',
    pricePercentile: null,
  };

  if (indicators?.results?.length > 0) {
    const latest = indicators.results[indicators.results.length - 1];
    const prev = indicators.results.length > 4 ? indicators.results[indicators.results.length - 5] : null;
    const latestMedian = readMarketMedian(latest);
    const prevMedian = readMarketMedian(prev);

    if (latestMedian && prevMedian) {
      const change = ((latestMedian - prevMedian) / prevMedian) * 100;
      result.trendPct = Math.round(change * 10) / 10;
      result.trend = change > 2 ? 'rising' : change < -2 ? 'declining' : 'stable';
    }
  }

  if (result.trend === 'declining') {
    result.buyerSellerBalance = 'buyer';
  } else if (result.trend === 'rising' && result.trendPct > 5) {
    result.buyerSellerBalance = 'seller';
  }

  return result;
}
