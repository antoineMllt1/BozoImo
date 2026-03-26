const axios = require('axios');
const { normalizeCadastreCodeInsee, radiusToBounds } = require('../utils/geo');

const CADASTRE_HEADERS = {
  accept: 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

function simplifyBuildingFeature(feature) {
  return {
    id: feature?.id || null,
    ...(feature?.properties || {}),
    geometry: feature?.geometry || null,
  };
}

/**
 * Recuperer les informations de parcelle cadastrale.
 */
exports.getParcelle = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const rawCodeInsee = String(req.body?.codeInsee || '').trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !rawCodeInsee) {
      return res.status(400).json({
        error: 'Les parametres "lat", "lng" et "codeInsee" sont requis',
      });
    }

    const effectiveCodeInsee = normalizeCadastreCodeInsee(rawCodeInsee);
    const geom = JSON.stringify({ type: 'Point', coordinates: [lng, lat] });
    const url = `https://apicarto.ign.fr/api/cadastre/parcelle?geom=${encodeURIComponent(geom)}&code_insee=${encodeURIComponent(effectiveCodeInsee)}`;

    const response = await axios.get(url, { headers: CADASTRE_HEADERS, timeout: 30000 });

    res.json({
      success: true,
      data: {
        ...response.data,
        requestedCodeInsee: rawCodeInsee,
        effectiveCodeInsee,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation de la parcelle:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des donnees cadastrales',
      details: error.message,
    });
  }
};

/**
 * Recuperer les informations batiment via la BDTOPO IGN.
 */
exports.getBuildingInfo = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const distance = Number(req.body?.distance) || 200;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: 'Les parametres "lat" et "lng" sont requis',
      });
    }

    const bounds = radiusToBounds(lat, lng, Math.max(50, distance));
    const bbox = `${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat},EPSG:4326`;
    const params = new URLSearchParams({
      SERVICE: 'WFS',
      VERSION: '2.0.0',
      REQUEST: 'GetFeature',
      TYPENAMES: 'BDTOPO_V3:batiment',
      OUTPUTFORMAT: 'application/json',
      COUNT: '20',
      SRSNAME: 'EPSG:4326',
      BBOX: bbox,
    });

    const response = await axios.get(`https://data.geopf.fr/wfs/ows?${params.toString()}`, {
      headers: CADASTRE_HEADERS,
      timeout: 30000,
    });

    const results = Array.isArray(response.data?.features)
      ? response.data.features.map(simplifyBuildingFeature)
      : [];

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation des donnees batiment:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des donnees batiment',
      details: error.message,
    });
  }
};
