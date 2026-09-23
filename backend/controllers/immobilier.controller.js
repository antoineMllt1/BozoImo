const axios = require('axios');
const { getCookie } = require('../utils/dvfCookieStore');

/**
 * Scraping meilleursagents.com/prix-immobilier/dvf. Le domaine est protégé
 * par DataDome (anti-bot) sur ses pages HTML — même un vrai Chrome piloté
 * par Puppeteer (headless ou non) s'y fait bloquer par un captcha — donc pas
 * de rafraîchissement de cookie automatisable via un navigateur headless.
 *
 * En revanche les endpoints JSON appelés ici (`/prix-immobilier/dvf/search`,
 * `geo.meilleursagents.com/geo/v1/`) se sont montrés bien plus permissifs :
 * un simple en-tête Cookie (même avec des valeurs bidon) suffit tant que la
 * requête part de Node/axios. Le cookie n'est donc PAS codé en dur dans le
 * code source : il est lu depuis backend/.cache/meilleursagents-cookie.txt
 * (jamais commité), avec une valeur par défaut si ce fichier n'existe pas.
 *
 * Si le site durcit un jour la vérification et se remet à répondre 403, un
 * vrai cookie capturé depuis un navigateur peut être enregistré sans
 * redémarrer le serveur :
 *   npm --prefix backend run refresh-dvf-cookie -- "<cookie>"
 * (voir backend/scripts/set-dvf-cookie.js pour la procédure).
 */

const COOKIE_HELP = 'npm --prefix backend run refresh-dvf-cookie -- "<cookie>" (voir backend/scripts/set-dvf-cookie.js)';

function dvfErrorPayload(error, cookie) {
  const status = error.response?.status;
  const isBlocked = status === 403;
  return {
    status: status || 500,
    error: isBlocked
      ? `MeilleursAgents bloque la requête (403)${cookie.isDefault ? ' — aucun cookie enregistré, ' + COOKIE_HELP : ' — cookie enregistré probablement expiré, ' + COOKIE_HELP}`
      : 'Erreur lors de la récupération des données',
    details: error.message,
  };
}

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

    const cookie = getCookie();

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
        'sec-ch-ua': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
        'Cookie': cookie.value,
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
    console.error('Erreur lors de la requête DVF:', error.message);
    const payload = dvfErrorPayload(error, getCookie());
    res.status(payload.status).json({ success: false, error: payload.error, details: payload.details });
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

    const cookie = getCookie();

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
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
        'Cookie': cookie.value,
      }
    };

    // Exécuter la requête
    const response = await axios.request(config);

    // Retourner directement la réponse de l'API
    res.json(response.data);

  } catch (error) {
    console.error('Erreur lors du géocodage:', error.message);
    const payload = dvfErrorPayload(error, getCookie());
    res.status(payload.status).json({ success: false, error: payload.error, details: payload.details });
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
