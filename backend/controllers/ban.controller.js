const axios = require('axios');

/**
 * Contrôleur pour géocoder une adresse via la Base Adresse Nationale (BAN)
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

    // Configuration de la requête
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://api-adresse.data.gouv.fr/search?q=${encodeURIComponent(address)}&limit=5`,
      headers: {
        'accept': 'application/json',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
      }
    };

    // Exécuter la requête
    const response = await axios.request(config);

    // Transformer la réponse BAN au format attendu par le frontend
    const places = (response.data.features || []).map(feature => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [0, 0];
      return {
        value: props.label || '',
        _geoloc: {
          lat: coords[1],
          lng: coords[0]
        },
        citycode: props.citycode || '',
        postcode: props.postcode || '',
        city: props.city || '',
        context: props.context || ''
      };
    });

    res.json({
      response: {
        places
      }
    });

  } catch (error) {
    console.error('Erreur lors du géocodage BAN:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du géocodage de l\'adresse',
      details: error.message
    });
  }
};

/**
 * Contrôleur pour le géocodage inversé via la Base Adresse Nationale (BAN)
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    // Validation des paramètres
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        error: 'Les paramètres "lat" et "lng" sont requis'
      });
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({
        error: 'Les paramètres "lat" et "lng" doivent être des nombres'
      });
    }

    // Configuration de la requête
    const config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://api-adresse.data.gouv.fr/reverse?lat=${lat}&lon=${lng}`,
      headers: {
        'accept': 'application/json',
        'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
      }
    };

    // Exécuter la requête
    const response = await axios.request(config);

    // Transformer la réponse BAN au format attendu par le frontend
    const places = (response.data.features || []).map(feature => {
      const props = feature.properties || {};
      const coords = feature.geometry?.coordinates || [0, 0];
      return {
        value: props.label || '',
        _geoloc: {
          lat: coords[1],
          lng: coords[0]
        },
        citycode: props.citycode || '',
        postcode: props.postcode || '',
        city: props.city || '',
        context: props.context || ''
      };
    });

    res.json({
      response: {
        places
      }
    });

  } catch (error) {
    console.error('Erreur lors du géocodage inversé BAN:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du géocodage inversé',
      details: error.message
    });
  }
};
