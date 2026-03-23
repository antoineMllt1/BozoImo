const axios = require('axios');

/**
 * Contrôleur pour rechercher des biens immobiliers
 */
exports.searchBiens = async (req, res) => {
  try {
    const { bounds, roomCount, itemTypes, priceMin, priceMax, areaMin, areaMax } = req.body;

    // Validation des paramètres
    if (!bounds || !Array.isArray(bounds) || bounds.length !== 4) {
      return res.status(400).json({
        error: 'Le paramètre "bounds" doit être un tableau de 4 coordonnées [lat1, lng1, lat2, lng2]'
      });
    }

    // Formater les coordonnées
    const boundsString = bounds.join(',');

    // Construire l'URL avec les paramètres de recherche
    const params = new URLSearchParams();
    params.append('bounds', boundsString);

    // Ajouter room_count si spécifié
    if (roomCount && Array.isArray(roomCount) && roomCount.length > 0) {
      const rooms = roomCount.join(',');
      params.append('room_count', rooms);
    }

    // Ajouter item_types si spécifié
    if (itemTypes && Array.isArray(itemTypes) && itemTypes.length > 0) {
      const types = itemTypes.join(',');
      params.append('item_types', types);
    }

    // Ajouter les filtres de prix si spécifiés
    if (priceMin !== undefined && priceMin > 0) {
      params.append('price_min', priceMin);
    }
    if (priceMax !== undefined) {
      params.append('price_max', priceMax);
    }

    // Ajouter les filtres de surface si spécifiés
    if (areaMin !== undefined && areaMin > 0) {
      params.append('area_min', areaMin);
    }
    if (areaMax !== undefined) {
      params.append('area_max', areaMax);
    }

    // Configuration de la requête
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://www.meilleursagents.com/prix-immobilier/dvf/search?${params.toString()}`,
      headers: { 
        'accept': 'application/json', 
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', 
        'priority': 'u=1, i', 
        'referer': 'https://www.meilleursagents.com/prix-immobilier/dvf/paris-75000/rue-de-paradis-3921/10/', 
        'sec-ch-device-memory': '8', 
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"', 
        'sec-ch-ua-arch': '"x86"', 
        'sec-ch-ua-full-version-list': '"Google Chrome";v="141.0.7390.122", "Not?A_Brand";v="8.0.0.0", "Chromium";v="141.0.7390.122"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-model': '""', 
        'sec-ch-ua-platform': '"Linux"', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-origin', 
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 
        'x-requested-with': 'XMLHttpRequest', 
        'Cookie': 'visitor_uuid=f0e53514-7a0f-48b8-adf0-537b3fd8f3c1; landing_page_template="{ga_page_template}"; datadome=~~ZpjvIy~KqAZtnvasAigIgVhdFnT8UGjE~opSF6P9ToQ4g2xZ6ENYiCeECBM1MyX4fyanSenJvEzGatvBGcINgyz9qxBy4MXI8tSiqR6_KGR4phrLTLRKzkPqGZ08kB; session=eyJhbmFseXRpY3NfdGFncyI6W10sIl9mcmVzaCI6ZmFsc2V9.aRT-Fg.WE_W68Wo50L67JfOHUDMveBYDek; _dd_s=rum=0&expire=1762984507872; datadome=wQEbunN~jQoIbnjA_K_85J4EyKTf65j0hJm8hovfcaEEnswlr4MzI6dzk2kuQOB2f69OFTaslnpeNjEqvq1cK2hU5CIB9OpZEjqhwuTTy5UtSBe7zKxCGC8rUt9W7zL~; session=eyJhbmFseXRpY3NfdGFncyI6W10sIl9mcmVzaCI6ZmFsc2V9.aRT-Vg.P4njJqrcz-R6Zj0lGJbdE3-viGY'
      }
    };

    // Exécuter la requête
    const response = await axios.request(config);

    // Retourner les données
    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Erreur lors de la requête:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des données',
      details: error.message
    });
  }
};

/**
 * Contrôleur pour géocoder une adresse en coordonnées GPS
 */
exports.geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body;

    // Validation du paramètre
    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        error: 'Le paramètre "address" est requis et doit être une chaîne de caractères'
      });
    }

    // Configuration de la requête de géocodage
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://geo.meilleursagents.com/geo/v1/?q=${encodeURIComponent(address)}`,
      headers: { 
        'accept': 'application/json, text/javascript, */*; q=0.01', 
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7', 
        'origin': 'https://www.meilleursagents.com', 
        'priority': 'u=1, i', 
        'referer': 'https://www.meilleursagents.com/prix-immobilier/dvf/', 
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"', 
        'sec-ch-ua-mobile': '?0', 
        'sec-ch-ua-platform': '"Linux"', 
        'sec-fetch-dest': 'empty', 
        'sec-fetch-mode': 'cors', 
        'sec-fetch-site': 'same-site', 
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36', 
        'Cookie': 'datadome=wQEbunN~jQoIbnjA_K_85J4EyKTf65j0hJm8hovfcaEEnswlr4MzI6dzk2kuQOB2f69OFTaslnpeNjEqvq1cK2hU5CIB9OpZEjqhwuTTy5UtSBe7zKxCGC8rUt9W7zL~; session=eyJhbmFseXRpY3NfdGFncyI6W10sIl9mcmVzaCI6ZmFsc2V9.aRT-Vg.P4njJqrcz-R6Zj0lGJbdE3-viGY'
      }
    };

    // Exécuter la requête
    const response = await axios.request(config);

    // Retourner directement la réponse de l'API
    res.json(response.data);

  } catch (error) {
    console.error('Erreur lors du géocodage:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du géocodage de l\'adresse',
      details: error.message
    });
  }
};

/**
 * Contrôleur pour vérifier l'état de santé de l'API
 */
exports.healthCheck = (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API BozoImo opérationnelle',
    timestamp: new Date().toISOString()
  });
};

