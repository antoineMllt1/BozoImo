function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function extractPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (payload.fetchedAt && payload.data !== undefined) return payload.data;
  if (payload.success != null && payload.data !== undefined) return payload.data;
  return payload;
}

function normalizePointGeometry(geometry) {
  if (!geometry || typeof geometry !== 'object') return null;
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    return {
      type: 'Point',
      coordinates: geometry.coordinates.slice(0, 2).map(Number),
    };
  }
  return null;
}

function pickNumber(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeDvfPlusSnapshot(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);
  const sourceFeatures = Array.isArray(raw?.features)
    ? raw.features
    : ensureArray(raw?.results ?? raw?.data ?? raw);

  const features = sourceFeatures
    .map((item) => {
      if (item?.properties) {
        return {
          properties: {
            updated_price: pickNumber(item.properties.updated_price, item.properties.valeur_fonciere),
            area: pickNumber(item.properties.area, item.properties.surface_reelle_bati),
            room_count: pickNumber(item.properties.room_count, item.properties.nb_pieces_principales),
            sale_at: pickString(item.properties.sale_at, item.properties.date_mutation),
            address_name: pickString(item.properties.address_name, item.properties.address, item.properties.l_adresse),
            item_type: pickString(item.properties.item_type, item.properties.type_local),
            code_commune: pickString(item.properties.code_commune, item.properties.codeCommune, item.properties.l_codinsee),
          },
          geometry: normalizePointGeometry(item.geometry),
        };
      }

      return {
        properties: {
          updated_price: pickNumber(item?.updated_price, item?.valeur_fonciere),
          area: pickNumber(item?.area, item?.surface_reelle_bati),
          room_count: pickNumber(item?.room_count, item?.nb_pieces_principales),
          sale_at: pickString(item?.sale_at, item?.date_mutation),
          address_name: pickString(item?.address_name, item?.address, item?.l_adresse),
          item_type: pickString(item?.item_type, item?.type_local, item?.type),
          code_commune: pickString(item?.code_commune, item?.codeCommune, item?.l_codinsee),
        },
        geometry: normalizePointGeometry(item?.geometry),
      };
    })
    .filter((item) => item.properties.updated_price || item.properties.area || item.properties.address_name);

  return {
    data: {
      type: 'FeatureCollection',
      features: features.slice(0, 500),
    },
    fetchedAt,
  };
}

export function normalizeDpeSnapshot(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);
  const results = ensureArray(raw?.results ?? raw?.data ?? raw)
    .map((item) => ({
      id: pickString(item?.id, item?.['N°DPE'], item?.['NÂ°DPE']),
      dpe: pickString(item?.dpe, item?.['Etiquette_DPE']),
      ges: pickString(item?.ges, item?.['Etiquette_GES']),
      conso: pickNumber(item?.conso, item?.['Conso_5_usages_é_finale'], item?.['Conso_5_usages_Ã©_finale']),
      emission: pickNumber(item?.emission, item?.['Emission_GES_5_usages']),
      surface: pickNumber(item?.surface, item?.['Surface_habitable_logement']),
      annee: pickNumber(item?.annee, item?.['Année_construction'], item?.['AnnÃ©e_construction']),
      chauffage: pickString(item?.chauffage, item?.['Type_énergie_n°1'], item?.['Type_Ã©nergie_nÂ°1']),
      coutChauffage: pickNumber(item?.coutChauffage, item?.['Coût_chauffage'], item?.['CoÃ»t_chauffage']),
      date: pickString(item?.date, item?.['Date_réception_DPE'], item?.['Date_rÃ©ception_DPE']),
    }))
    .filter((item) => item.id || item.dpe || item.surface);

  return {
    results: results.slice(0, 100),
    fetchedAt,
  };
}

export function normalizeRiskProfile(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);

  return {
    risques: ensureArray(raw?.risques).slice(0, 20),
    radon: raw?.radon || null,
    cavites: ensureArray(raw?.cavites).slice(0, 10),
    installationsClassees: ensureArray(raw?.installationsClassees).slice(0, 10),
    sitesPollues: ensureArray(raw?.sitesPollues).slice(0, 10),
    catastrophesNaturelles: ensureArray(raw?.catastrophesNaturelles).slice(0, 20),
    zoneSismique: raw?.zoneSismique || null,
    fetchedAt,
  };
}

export function normalizePappersSnapshot(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);

  const parcelles = ensureArray(raw?.parcelles ?? raw)
    .map((item) => ({
      numero: pickString(item?.numero, item?.numero_parcelle, item?.id),
      section: pickString(item?.section, item?.section_parcelle),
      contenance: pickNumber(item?.contenance, item?.surface),
      adresse: pickString(item?.adresse, item?.adresse_complete, item?.libelle_voie),
      idu: pickString(item?.idu, item?.id_parcelle, item?.parcel_id),
    }))
    .filter((item) => item.numero || item.adresse);

  const detailSource = raw?.detail || (raw?.ventes || raw?.batiments || raw?.copropriete || raw?.urbanisme ? raw : null);
  const detail = detailSource
    ? {
        ventes: ensureArray(detailSource.ventes).slice(0, 20),
        batiments: ensureArray(detailSource.batiments).slice(0, 10),
        dpe: ensureArray(detailSource.dpe).slice(0, 10),
        copropriete: detailSource.copropriete || detailSource.coproprietes || null,
        urbanisme: detailSource.urbanisme || null,
      }
    : null;

  return {
    provider: pickString(raw?.provider, raw?.source),
    warning: pickString(raw?.warning),
    canLoadDetail: typeof raw?.canLoadDetail === 'boolean' ? raw.canLoadDetail : true,
    parcelles: parcelles.slice(0, 10),
    detail,
    fetchedAt,
  };
}

export function normalizeMarketIndicators(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);
  const sourceResults = ensureArray(raw?.results ?? raw?.data ?? raw);
  const results = sourceResults.filter((item) => item && typeof item === 'object').slice(-24);

  return {
    ...(raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}),
    results,
    fetchedAt,
  };
}

export function normalizeCadastreSnapshot(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);
  const features = ensureArray(raw?.features ?? raw?.parcelles ?? raw)
    .map((feature) => ({
      properties: feature?.properties || feature || {},
      geometry: feature?.geometry || null,
    }))
    .slice(0, 10);

  return { features, fetchedAt };
}

export function normalizeBuildingProfile(payload) {
  if (!payload) return null;

  const fetchedAt = payload.fetchedAt || new Date().toISOString();
  const raw = extractPayload(payload);
  const results = ensureArray(raw?.results ?? raw?.features ?? raw).slice(0, 10);

  return { results, fetchedAt };
}

export function normalizeCastorusSnapshot(payload) {
  if (!payload) return null;

  return {
    found: payload.found === true,
    daysOnMarket: pickNumber(payload.daysOnMarket),
    totalPriceChange: pickNumber(payload.totalPriceChange),
    priceChanges: ensureArray(payload.priceChanges).slice(0, 20),
    currentPrice: pickNumber(payload.currentPrice),
    pricePerM2: pickNumber(payload.pricePerM2),
    priceVsMarket: pickNumber(payload.priceVsMarket),
    agencies: ensureArray(payload.agencies).slice(0, 10),
    negotiationPotential: pickString(payload.negotiationPotential),
    listingUrl: pickString(payload.listingUrl, payload.url),
    error: pickString(payload.error),
    fetchedAt: payload.fetchedAt || new Date().toISOString(),
  };
}

export function pickBestSelogerClassified(dossier) {
  const listings = ensureArray(dossier?.selogerSnapshot?.data?.classifieds);
  if (!listings.length) return null;

  const targetSurface = Number(dossier?.target?.surfaceM2) || null;
  const targetRooms = Number(dossier?.target?.rooms) || null;

  const scored = listings
    .filter((item) => item?.url)
    .map((item) => {
      const surfacePenalty = targetSurface && item.area ? Math.abs(item.area - targetSurface) : 50;
      const roomsPenalty = targetRooms && item.rooms ? Math.abs(item.rooms - targetRooms) * 12 : 24;
      const pricePenalty = item.price ? 0 : 20;
      return {
        ...item,
        _score: surfacePenalty + roomsPenalty + pricePenalty,
      };
    })
    .sort((left, right) => left._score - right._score);

  return scored[0] || null;
}
