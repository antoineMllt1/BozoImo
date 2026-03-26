const axios = require('axios');

const GEORISQUES_BASE_URL = 'https://www.georisques.gouv.fr/api/v1';
const GEORISQUES_HEADERS = {
  accept: 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  referer: 'https://www.georisques.gouv.fr/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

function readGeorisquesData(payload) {
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function readSingleResult(payload) {
  const data = readGeorisquesData(payload);
  return data[0] || null;
}

/**
 * Recuperer le profil de risques pour une localisation donnee.
 */
exports.getRiskProfile = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const codeInsee = String(req.body?.codeInsee || '').trim();

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !codeInsee) {
      return res.status(400).json({
        error: 'Les parametres "lat", "lng" et "codeInsee" sont requis',
      });
    }

    const requests = [
      ['risques', `${GEORISQUES_BASE_URL}/gaspar/risques?code_insee=${encodeURIComponent(codeInsee)}&page=1&page_size=50`],
      ['radon', `${GEORISQUES_BASE_URL}/radon?code_insee=${encodeURIComponent(codeInsee)}`],
      ['cavites', `${GEORISQUES_BASE_URL}/cavites?latlon=${encodeURIComponent(`${lat},${lng}`)}&rayon=1000`],
      ['installationsClassees', `${GEORISQUES_BASE_URL}/installations_classees?latlon=${encodeURIComponent(`${lat},${lng}`)}&rayon=1000&page=1&page_size=50`],
      ['ssp', `${GEORISQUES_BASE_URL}/ssp?latlon=${encodeURIComponent(`${lat},${lng}`)}&rayon=500`],
      ['zoneSismique', `${GEORISQUES_BASE_URL}/zonage_sismique?code_insee=${encodeURIComponent(codeInsee)}`],
    ];

    const settled = await Promise.allSettled(
      requests.map(([, url]) => axios.get(url, { headers: GEORISQUES_HEADERS, timeout: 30000 }))
    );

    const payloadByKey = {};
    const warnings = [];

    requests.forEach(([key], index) => {
      const result = settled[index];
      if (result.status === 'fulfilled') {
        payloadByKey[key] = result.value.data;
        return;
      }
      payloadByKey[key] = null;
      warnings.push(`${key}: ${result.reason?.message || 'indisponible'}`);
    });

    const ssp = payloadByKey.ssp || {};
    const sitesPollues = [
      ...readGeorisquesData(ssp.casias),
      ...readGeorisquesData(ssp.instructions),
      ...readGeorisquesData(ssp.conclusions_sis),
      ...readGeorisquesData(ssp.conclusions_sup),
    ];

    res.json({
      success: true,
      data: {
        risques: readGeorisquesData(payloadByKey.risques),
        radon: readSingleResult(payloadByKey.radon),
        cavites: readGeorisquesData(payloadByKey.cavites),
        installationsClassees: readGeorisquesData(payloadByKey.installationsClassees),
        sitesPollues,
        catastrophesNaturelles: [],
        zoneSismique: readSingleResult(payloadByKey.zoneSismique),
        warnings,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Erreur lors de la recuperation du profil de risques:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation du profil de risques',
      details: error.message,
    });
  }
};
