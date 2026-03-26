const axios = require('axios');

const DPE_DATASET_ID = 'dpe03existant';
const DPE_HEADERS = {
  accept: 'application/json',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  referer: 'https://data.ademe.fr/datasets/dpe03existant',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Controleur pour rechercher des diagnostics de performance energetique via l'ADEME.
 */
exports.searchDPE = async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const distance = Number(req.body?.distance) || 500;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({
        error: 'Les parametres "lat" et "lng" sont requis et doivent etre des nombres',
      });
    }

    const params = new URLSearchParams();
    params.append('geo_distance', `${lng},${lat},${Math.max(50, distance)}`);
    params.append('size', '100');
    params.append(
      'select',
      [
        'numero_dpe',
        'etiquette_dpe',
        'etiquette_ges',
        'conso_5_usages_par_m2_ep',
        'emission_ges_5_usages_par_m2',
        'surface_habitable_logement',
        'annee_construction',
        'type_energie_n1',
        'cout_chauffage',
        'date_etablissement_dpe',
      ].join(',')
    );

    const response = await axios.get(
      `https://data.ademe.fr/data-fair/api/v1/datasets/${DPE_DATASET_ID}/lines?${params.toString()}`,
      {
        headers: DPE_HEADERS,
        timeout: 30000,
      }
    );

    const results = Array.isArray(response.data?.results)
      ? response.data.results.map((item) => ({
          id: item.numero_dpe || null,
          dpe: item.etiquette_dpe || null,
          ges: item.etiquette_ges || null,
          conso: toNumber(item.conso_5_usages_par_m2_ep),
          emission: toNumber(item.emission_ges_5_usages_par_m2),
          surface: toNumber(item.surface_habitable_logement),
          annee: toNumber(item.annee_construction),
          chauffage: item.type_energie_n1 || null,
          coutChauffage: toNumber(item.cout_chauffage),
          date: item.date_etablissement_dpe || null,
        }))
      : [];

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Erreur lors de la recherche DPE:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des donnees DPE',
      details: error.message,
    });
  }
};
