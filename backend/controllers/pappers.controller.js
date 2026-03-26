const axios = require('axios');
const { normalizeCadastreCodeInsee } = require('../utils/geo');

const PAPPERS_HEADERS = {
  accept: 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9',
  origin: 'https://immobilier.pappers.fr',
  referer: 'https://immobilier.pappers.fr/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

const PAPPERS_API_TOKEN = String(process.env.PAPPERS_API_TOKEN || '').trim();

function buildPappersUrl(pathname, params = {}) {
  const searchParams = new URLSearchParams(params);
  if (PAPPERS_API_TOKEN) searchParams.set('api_token', PAPPERS_API_TOKEN);
  return `https://api-immobilier.pappers.fr/v1${pathname}?${searchParams.toString()}`;
}

async function resolveCodeInsee(lat, lng, fallbackCodeInsee = null) {
  if (fallbackCodeInsee) return normalizeCadastreCodeInsee(fallbackCodeInsee);

  const response = await axios.get('https://api-adresse.data.gouv.fr/reverse/', {
    headers: { 'user-agent': PAPPERS_HEADERS['user-agent'] },
    params: { lon: lng, lat },
    timeout: 30000,
  });

  const citycode = response.data?.features?.[0]?.properties?.citycode || null;
  return normalizeCadastreCodeInsee(citycode);
}

async function fallbackParcellesFromIgn(lat, lng, codeInsee) {
  const effectiveCodeInsee = await resolveCodeInsee(lat, lng, codeInsee);
  if (!effectiveCodeInsee) return { parcelles: [], effectiveCodeInsee: null, addressLabel: null };

  const reverse = await axios.get('https://api-adresse.data.gouv.fr/reverse/', {
    headers: { 'user-agent': PAPPERS_HEADERS['user-agent'] },
    params: { lon: lng, lat },
    timeout: 30000,
  });
  const addressLabel = reverse.data?.features?.[0]?.properties?.label || null;

  const geom = JSON.stringify({ type: 'Point', coordinates: [lng, lat] });
  const cadastre = await axios.get(
    `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${encodeURIComponent(geom)}&code_insee=${encodeURIComponent(effectiveCodeInsee)}`,
    { headers: PAPPERS_HEADERS, timeout: 30000 }
  );

  const parcelles = Array.isArray(cadastre.data?.features)
    ? cadastre.data.features.map((feature) => {
        const properties = feature?.properties || {};
        return {
          numero: properties.numero || null,
          section: properties.section || null,
          contenance: properties.contenance || null,
          adresse: addressLabel,
          idu: properties.idu || null,
          codeInsee: properties.code_insee || effectiveCodeInsee,
        };
      })
    : [];

  return { parcelles, effectiveCodeInsee, addressLabel };
}

/**
 * Rechercher des parcelles autour d'une localisation via Pappers Immobilier.
 */
exports.searchParcelles = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const distance = Number(req.body?.distance) || 500;
    const codeInsee = String(req.body?.codeInsee || '').trim() || null;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: 'Les parametres "lat" et "lng" sont requis',
      });
    }

    try {
      const url = buildPappersUrl('/parcelles', {
        latitude: lat,
        longitude: lng,
        distance,
        par_page: 20,
      });
      const response = await axios.get(url, {
        headers: PAPPERS_HEADERS,
        timeout: 30000,
      });

      return res.json({
        success: true,
        data: {
          ...(response.data || {}),
          provider: 'pappers',
          canLoadDetail: true,
        },
      });
    } catch (error) {
      const status = error?.response?.status;
      const isAuthIssue = status === 401 || status === 403;
      if (!isAuthIssue && status && status < 500) {
        throw error;
      }
    }

    const fallback = await fallbackParcellesFromIgn(lat, lng, codeInsee);
    return res.json({
      success: true,
      data: {
        provider: 'ign_fallback',
        warning: 'Pappers Immobilier exige actuellement un token ou un scraping dedie. Affichage cadastral de secours via IGN.',
        canLoadDetail: false,
        parcelles: fallback.parcelles,
        effectiveCodeInsee: fallback.effectiveCodeInsee,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la recherche de parcelles Pappers:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche de parcelles',
      details: error.message,
    });
  }
};

/**
 * Recuperer le detail d'une parcelle via Pappers Immobilier.
 */
exports.getParcelleDetail = async (req, res) => {
  try {
    const numeroParcelle = String(req.body?.numeroParcelle || '').trim();
    const bases = Array.isArray(req.body?.bases) && req.body.bases.length
      ? req.body.bases
      : ['ventes', 'batiments', 'dpe', 'coproprietes', 'urbanisme'];

    if (!numeroParcelle) {
      return res.status(400).json({
        error: 'Le parametre "numeroParcelle" est requis',
      });
    }

    if (!PAPPERS_API_TOKEN) {
      return res.status(424).json({
        success: false,
        error: 'Le detail Pappers natif n est pas disponible sans token ou scraping dedie.',
      });
    }

    const url = buildPappersUrl(`/parcelles/${encodeURIComponent(numeroParcelle)}`, {
      bases: bases.join(','),
    });

    const response = await axios.get(url, {
      headers: PAPPERS_HEADERS,
      timeout: 30000,
    });

    res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation du detail parcelle Pappers:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation du detail de la parcelle',
      details: error.message,
    });
  }
};
