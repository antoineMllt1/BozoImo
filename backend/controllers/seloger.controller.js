const axios = require('axios');
const { createCirclePolyline } = require('../utils/polyline');

/**
 * Headers par défaut pour les requêtes SeLoger
 */
const DEFAULT_HEADERS = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'content-type': 'application/json',
  'origin': 'https://www.seloger.com',
  'priority': 'u=1, i',
  'referer': 'https://www.seloger.com/classified-search',
  'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Linux"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
};

/**
 * Autocomplete pour récupérer les informations d'une adresse/quartier
 * @param {string} text - Texte à rechercher
 * @returns {Promise<Object>} Premier résultat de l'autocomplete
 */
async function getLocationData(text) {
  const data = {
    text: text,
    limit: 10,
    placeTypes: ["NBH1", "NBH3", "AD09", "NBH2", "AD08", "AD06", "AD04", "POCO", "AD02"],
    parentTypes: ["NBH1", "NBH3", "AD09", "NBH2", "AD08", "AD06", "AD04", "POCO", "AD02"],
    locale: "fr"
  };

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.seloger.com/search-mfe-bff/autocomplete',
    headers: DEFAULT_HEADERS,
    data: JSON.stringify(data),
    timeout: 7000
  };

  const response = await axios.request(config);
  
  if (!response.data || response.data.length === 0) {
    throw new Error('Aucun résultat trouvé pour cette adresse');
  }

  return response.data[0];
}

/**
 * Recherche par ID de lieu
 * @param {string} placeId - ID du lieu
 * @param {Object} filters - Filtres optionnels
 * @returns {Promise<Object>} Résultats de la recherche
 */
async function searchByPlaceId(placeId, filters = {}) {
  const data = {
    criteria: {
      distributionTypes: ["Buy"],
      estateTypes: filters.estateTypes || ["House", "Apartment"],
      projectTypes: filters.projectTypes || ["Resale", "New_Build", "Projected", "Life_Annuity"],
      location: {
        placeIds: [placeId]
      }
    },
    paging: {
      page: 1,
      size: filters.size || 30,
      order: "Default"
    }
  };

  // Ajouter les filtres optionnels
  if (filters.numberOfRoomsMin) data.criteria.numberOfRoomsMin = filters.numberOfRoomsMin;
  if (filters.numberOfRoomsMax) data.criteria.numberOfRoomsMax = filters.numberOfRoomsMax;
  if (filters.priceMin) data.criteria.priceMin = filters.priceMin;
  if (filters.priceMax) data.criteria.priceMax = filters.priceMax;
  if (filters.spaceMin) data.criteria.spaceMin = filters.spaceMin;
  if (filters.spaceMax) data.criteria.spaceMax = filters.spaceMax;
  if (filters.plotSpaceMin) data.criteria.plotSpaceMin = filters.plotSpaceMin;
  if (filters.plotSpaceMax) data.criteria.plotSpaceMax = filters.plotSpaceMax;
  if (filters.featuresIncluded && filters.featuresIncluded.length > 0) {
    data.criteria.featuresIncluded = filters.featuresIncluded;
  }
  if (filters.energyCertificateClass && filters.energyCertificateClass.length > 0) {
    data.criteria.energyCertificateClass = filters.energyCertificateClass;
  }

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.seloger.com/serp-bff/search',
    headers: DEFAULT_HEADERS,
    data: JSON.stringify(data),
    timeout: 7000
  };

  const response = await axios.request(config);
  return response.data;
}

/**
 * Recherche par polyline
 * @param {string} polyline - Polyline encodée
 * @param {Object} filters - Filtres optionnels
 * @returns {Promise<Object>} Résultats de la recherche
 */
async function searchByPolyline(polyline, filters = {}) {
  const data = {
    criteria: {
      distributionTypes: ["Buy"],
      estateTypes: filters.estateTypes || ["House", "Apartment"],
      projectTypes: filters.projectTypes || ["Resale", "New_Build", "Projected", "Life_Annuity"],
      location: {
        polylines: [polyline]
      }
    },
    paging: {
      page: 1,
      size: filters.size || 30,
      order: "Default"
    }
  };

  // Ajouter les filtres optionnels
  if (filters.numberOfRoomsMin) data.criteria.numberOfRoomsMin = filters.numberOfRoomsMin;
  if (filters.numberOfRoomsMax) data.criteria.numberOfRoomsMax = filters.numberOfRoomsMax;
  if (filters.priceMin) data.criteria.priceMin = filters.priceMin;
  if (filters.priceMax) data.criteria.priceMax = filters.priceMax;
  if (filters.spaceMin) data.criteria.spaceMin = filters.spaceMin;
  if (filters.spaceMax) data.criteria.spaceMax = filters.spaceMax;
  if (filters.plotSpaceMin) data.criteria.plotSpaceMin = filters.plotSpaceMin;
  if (filters.plotSpaceMax) data.criteria.plotSpaceMax = filters.plotSpaceMax;
  if (filters.featuresIncluded && filters.featuresIncluded.length > 0) {
    data.criteria.featuresIncluded = filters.featuresIncluded;
  }
  if (filters.energyCertificateClass && filters.energyCertificateClass.length > 0) {
    data.criteria.energyCertificateClass = filters.energyCertificateClass;
  }

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.seloger.com/serp-bff/search',
    headers: DEFAULT_HEADERS,
    data: JSON.stringify(data),
    timeout: 7000
  };

  const response = await axios.request(config);
  return response.data;
}

/**
 * Récupère les détails complets des annonces par leurs IDs
 * @param {Array<string>} classifiedIds - Tableau d'IDs d'annonces
 * @returns {Promise<Array>} Détails complets des annonces
 */
async function getClassifiedDetails(classifiedIds) {
  if (!classifiedIds || classifiedIds.length === 0) {
    return [];
  }

  // Joindre les IDs avec des virgules
  const idsString = classifiedIds.join(',');

  const config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: `https://www.seloger.com/classifiedList/${idsString}`,
    headers: {
      ...DEFAULT_HEADERS,
      'accept': '*/*',
      'x-language': 'fr'
    }
  };

  try {
    const response = await axios.request(config);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération des détails:', error.message);
    // Retourner un tableau vide en cas d'erreur pour ne pas bloquer la réponse
    return [];
  }
}

/**
 * Compte le nombre de résultats sans récupérer les détails
 */
async function countResults(placeId, polyline, filters = {}) {
  const data = {
    distributionTypes: ["Buy"],
    estateTypes: filters.estateTypes || ["House", "Apartment"],
    projectTypes: filters.projectTypes || ["Resale", "New_Build", "Projected", "Life_Annuity"],
  };

  // Ajouter la localisation
  if (placeId) {
    data.location = { placeIds: [placeId] };
  } else if (polyline) {
    data.location = { polylines: [polyline] };
  }

  // Ajouter tous les filtres
  if (filters.numberOfRoomsMin) data.numberOfRoomsMin = filters.numberOfRoomsMin;
  if (filters.numberOfRoomsMax) data.numberOfRoomsMax = filters.numberOfRoomsMax;
  if (filters.priceMin) data.priceMin = filters.priceMin;
  if (filters.priceMax) data.priceMax = filters.priceMax;
  if (filters.spaceMin) data.spaceMin = filters.spaceMin;
  if (filters.spaceMax) data.spaceMax = filters.spaceMax;
  if (filters.plotSpaceMin) data.plotSpaceMin = filters.plotSpaceMin;
  if (filters.plotSpaceMax) data.plotSpaceMax = filters.plotSpaceMax;
  if (filters.yearOfConstructionMin) data.yearOfConstructionMin = filters.yearOfConstructionMin;
  if (filters.yearOfConstructionMax) data.yearOfConstructionMax = filters.yearOfConstructionMax;
  if (filters.featuresIncluded && filters.featuresIncluded.length > 0) {
    data.featuresIncluded = filters.featuresIncluded;
  }
  if (filters.energyCertificateClass && filters.energyCertificateClass.length > 0) {
    data.energyCertificateClass = filters.energyCertificateClass;
  }
  if (filters.energyTypes && filters.energyTypes.length > 0) {
    data.energyTypes = filters.energyTypes;
  }

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://www.seloger.com/search-mfe-bff/count',
    headers: DEFAULT_HEADERS,
    data: JSON.stringify(data)
  };

  const response = await axios.request(config);
  return response.data;
}

/**
 * Contrôleur pour compter les résultats
 */
exports.countSeloger = async (req, res) => {
  try {
    const { address, filters = {} } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        error: 'Le paramètre "address" est requis'
      });
    }

    console.log(`🔢 Comptage pour : ${address}`);

    // Étape 1 : Récupérer les données de localisation
    const locationData = await getLocationData(address);
    const placeId = locationData.id;
    const coordinates = locationData.coordinates;
    const centerLat = coordinates.max_inscribed_circle?.lat || coordinates.centroid?.lat || coordinates.lat;
    const centerLng = coordinates.max_inscribed_circle?.lng || coordinates.centroid?.lng || coordinates.lng;

    // Étape 2 : Compter avec l'ID
    let count = await countResults(placeId, null, filters);
    let usedPolyline = null;

    // Étape 3 : Si pas assez, essayer avec polyline
    if (count < 30) {
      let radius = 100;
      const maxRadius = 5000;
      const radiusIncrement = 100;
      
      while (count < 30 && radius <= maxRadius) {
        const polyline = createCirclePolyline(centerLat, centerLng, radius);
        count = await countResults(null, polyline, filters);
        usedPolyline = polyline;
        
        if (count >= 30) break;
        radius += radiusIncrement;
      }
    }

    res.json({
      count: count,
      location: {
        address: address,
        placeId: placeId,
        coordinates: { lat: centerLat, lng: centerLng }
      },
      polyline: usedPolyline,
      filters: filters
    });

  } catch (error) {
    console.error('❌ Erreur lors du comptage:', error.message);
    res.status(500).json({
      error: 'Erreur lors du comptage',
      details: error.message
    });
  }
};

/**
 * Contrôleur principal pour la recherche SeLoger
 * Implémente la logique incrémentale de recherche
 */
exports.searchSeloger = async (req, res) => {
  try {
    const { address, lat, lng, radius, filters = {} } = req.body;
    const searchSize = filters.size || 30;

    // ── Mode coordonnées : on saute l'autocomplete ────────────────────────────
    if (lat != null && lng != null) {
      const searchRadius = radius || 500;
      console.log(`🔍 Recherche SeLoger par coordonnées (${lat}, ${lng}) r=${searchRadius}m (${searchSize} annonces)`);

      const polyline = createCirclePolyline(lat, lng, searchRadius);
      let searchResults = await searchByPolyline(polyline, filters);
      let totalCount = searchResults.totalCount || 0;
      let usedRadius = searchRadius;

      // Expansion si pas assez de résultats
      if (totalCount < searchSize && searchRadius < 5000) {
        let r = Math.max(searchRadius, 500);
        while (totalCount < searchSize && r <= 5000) {
          r = Math.min(r + 500, 5000);
          const pl = createCirclePolyline(lat, lng, r);
          searchResults = await searchByPolyline(pl, filters);
          totalCount = searchResults.totalCount || 0;
          usedRadius = r;
          if (totalCount >= searchSize) break;
        }
      }

      console.log(`📊 ${totalCount} résultats avec r=${usedRadius}m`);

      const classifiedIds = searchResults.classifieds?.map(c => c.id) || [];
      const classifiedDetails = await getClassifiedDetails(classifiedIds);

      return res.json({
        totalCount,
        classifieds: classifiedDetails,
        location: { address, coordinates: { lat, lng }, radiusMeters: usedRadius },
      });
    }

    // ── Mode texte (quartier / ville) : autocomplete ──────────────────────────
    if (!address || typeof address !== 'string') {
      return res.status(400).json({ error: 'Fournir "address" ou "lat"+"lng"' });
    }

    console.log(`🔍 Recherche SeLoger par lieu : ${address} (${searchSize} annonces)`);

    const locationData = await getLocationData(address);
    const placeId = locationData.id;
    const coordinates = locationData.coordinates;
    const centerLat = coordinates.max_inscribed_circle?.lat || coordinates.centroid?.lat || coordinates.lat;
    const centerLng = coordinates.max_inscribed_circle?.lng || coordinates.centroid?.lng || coordinates.lng;

    console.log(`✅ ID : ${placeId}, coords : ${centerLat}, ${centerLng}`);

    let searchResults = await searchByPlaceId(placeId, filters);
    let totalCount = searchResults.totalCount || 0;
    let usedPolyline = null;

    if (totalCount < searchSize) {
      let r = 100;
      while (totalCount < searchSize && r <= 5000) {
        const pl = createCirclePolyline(centerLat, centerLng, r);
        searchResults = await searchByPolyline(pl, filters);
        totalCount = searchResults.totalCount || 0;
        usedPolyline = pl;
        if (totalCount >= searchSize) break;
        r += 100;
      }
    }

    const classifiedIds = searchResults.classifieds?.map(c => c.id) || [];
    const classifiedDetails = await getClassifiedDetails(classifiedIds);

    const response = {
      totalCount,
      classifieds: classifiedDetails,
      location: { address, placeId, coordinates: { lat: centerLat, lng: centerLng } },
    };
    if (usedPolyline) response.polyline = usedPolyline;

    console.log(`✅ Recherche terminée : ${totalCount} résultats`);
    res.json(response);

  } catch (error) {
    console.error('❌ Erreur SeLoger:', error.message);
    if (error.response) {
      return res.status(error.response.status || 500).json({
        error: 'Erreur communication SeLoger',
        details: error.response.data || error.message,
      });
    }
    res.status(500).json({ error: 'Erreur lors de la recherche', details: error.message });
  }
};

/**
 * Contrôleur pour tester l'autocomplete
 */
exports.autocompleteTest = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        error: 'Le paramètre "text" est requis et doit être une chaîne de caractères'
      });
    }

    const locationData = await getLocationData(text);
    res.json(locationData);

  } catch (error) {
    console.error('Erreur lors de l\'autocomplete:', error.message);
    res.status(500).json({
      error: 'Erreur lors de l\'autocomplete',
      details: error.message
    });
  }
};

