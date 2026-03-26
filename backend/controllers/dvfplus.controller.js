const axios = require('axios');

const DVF_BASE_URL = 'https://apidf-preprod.cerema.fr/dvf_opendata/geomutations/';
const DVF_HEADERS = {
  accept: 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  referer: 'https://app.dvf.etalab.gouv.fr/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function transformMutation(feature) {
  const props = feature?.properties || {};
  return {
    updated_price: toNumber(props.valeurfonc ?? props.valeur_fonciere),
    area: toNumber(props.sbati ?? props.surface_reelle_bati),
    room_count: toNumber(props.nbpprinc ?? props.nb_pieces_principales),
    sale_at: props.datemut || props.date_mutation || null,
    address: props.l_adresse || firstValue(props.l_idpar) || null,
    nature_mutation: props.libnatmut || props.nature_mutation || null,
    type_local: props.libtypbien || props.type_local || null,
    code_commune: firstValue(props.l_codinsee) || props.code_insee || null,
    geometry: feature?.geometry || null,
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function quarterKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
  return `${date.getUTCFullYear()}-Q${quarter}`;
}

async function fetchMutations(params) {
  const response = await axios.get(`${DVF_BASE_URL}?${params.toString()}`, {
    headers: DVF_HEADERS,
    timeout: 30000,
  });
  return response.data;
}

/**
 * Controleur pour rechercher des mutations immobilieres via DVF Cerema.
 */
exports.searchMutations = async (req, res) => {
  try {
    const { codeCommune, bounds, anneeMutMin, anneeMutMax, codtypbien } = req.body;

    if (!codeCommune || typeof codeCommune !== 'string') {
      return res.status(400).json({
        error: 'Le parametre "codeCommune" est requis et doit etre une chaine',
      });
    }

    if (!bounds || !Array.isArray(bounds) || bounds.length !== 4) {
      return res.status(400).json({
        error: 'Le parametre "bounds" doit etre un tableau [lat1, lng1, lat2, lng2]',
      });
    }

    const [lat1, lng1, lat2, lng2] = bounds.map(Number);
    const xmin = Math.min(lng1, lng2);
    const ymin = Math.min(lat1, lat2);
    const xmax = Math.max(lng1, lng2);
    const ymax = Math.max(lat1, lat2);

    const params = new URLSearchParams();
    params.append('in_bbox', `${xmin},${ymin},${xmax},${ymax}`);
    params.append('code_insee', codeCommune);
    params.append('page_size', '500');

    if (anneeMutMin) params.append('anneemut_min', String(anneeMutMin));
    if (anneeMutMax) params.append('anneemut_max', String(anneeMutMax));
    if (codtypbien) params.append('codtypbien', String(codtypbien));

    const payload = await fetchMutations(params);
    const transformedData = Array.isArray(payload.features)
      ? payload.features.map(transformMutation)
      : [];

    res.json({
      success: true,
      data: transformedData,
    });
  } catch (error) {
    console.error('Erreur lors de la recherche DVF+:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des mutations DVF+',
      details: error.message,
    });
  }
};

/**
 * Controleur pour calculer des indicateurs DVF d'une commune.
 */
exports.getIndicators = async (req, res) => {
  try {
    const codeCommune = String(req.body?.codeCommune || '').trim();

    if (!codeCommune) {
      return res.status(400).json({
        error: 'Le parametre "codeCommune" est requis',
      });
    }

    const currentYear = new Date().getUTCFullYear();
    const params = new URLSearchParams();
    params.append('code_insee', codeCommune);
    params.append('anneemut_min', String(currentYear - 3));
    params.append('page_size', '500');

    let page = 1;
    let hasNext = true;
    const features = [];

    while (hasNext && page <= 10) {
      params.set('page', String(page));
      const payload = await fetchMutations(params);
      const pageFeatures = Array.isArray(payload.features) ? payload.features : [];
      features.push(...pageFeatures);
      hasNext = Boolean(payload.next);
      page += 1;
    }

    const grouped = new Map();

    for (const feature of features) {
      const mutation = transformMutation(feature);
      const price = toNumber(mutation.updated_price);
      const area = toNumber(mutation.area);
      const saleDate = mutation.sale_at;
      const key = quarterKey(saleDate);

      if (!price || !area || area <= 5 || !key) continue;

      const entry = grouped.get(key) || { prices: [], ppm2: [], dates: [] };
      entry.prices.push(price);
      entry.ppm2.push(price / area);
      entry.dates.push(saleDate);
      grouped.set(key, entry);
    }

    const results = [...grouped.entries()]
      .map(([period, entry]) => ({
        period,
        prix_median: median(entry.prices),
        prix_median_m2: median(entry.ppm2),
        nombre_mutations: entry.prices.length,
        date_debut: entry.dates.sort()[0] || null,
      }))
      .sort((left, right) => left.period.localeCompare(right.period))
      .slice(-12);

    res.json({
      success: true,
      data: {
        source: 'derived_from_geomutations',
        codeCommune,
        results,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation des indicateurs DVF+:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des indicateurs DVF+',
      details: error.message,
    });
  }
};
