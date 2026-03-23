const express = require('express');
const router = express.Router();
const selogerController = require('../controllers/seloger.controller');

/**
 * @route   POST /api/seloger/count
 * @desc    Compter les résultats sans récupérer les détails
 * @access  Public
 * @body    { "address": "Quartier", "filters": {...} }
 */
router.post('/count', selogerController.countSeloger);

/**
 * @route   POST /api/seloger/search
 * @desc    Rechercher des biens immobiliers sur SeLoger
 * @access  Public
 * @body    { "address": "Nom du quartier ou de l'adresse", "filters": {...} }
 * 
 * Exemple de requête:
 * POST /api/seloger/search
 * {
 *   "address": "Savarières",
 *   "filters": {
 *     "priceMin": 100000,
 *     "priceMax": 500000,
 *     "numberOfRoomsMin": 2,
 *     "numberOfRoomsMax": 4,
 *     "estateTypes": ["Apartment"],
 *     "featuresIncluded": ["Parking_Garage", "Balcony_Terrace"]
 *   }
 * }
 * 
 * Réponse:
 * {
 *   "totalCount": 106,
 *   "classifieds": [{ "id": "..." }, ...],
 *   "location": {
 *     "address": "Savarières",
 *     "placeId": "NBH2FR3338",
 *     "coordinates": { "lat": 47.20735076237591, "lng": -1.4926988364845082 }
 *   },
 *   "polyline": "whd_HnscH..." // Présent uniquement si recherche par cercle
 * }
 */
router.post('/search', selogerController.searchSeloger);

/**
 * @route   POST /api/seloger/autocomplete
 * @desc    Tester l'autocomplete SeLoger
 * @access  Public
 * @body    { "text": "Texte à rechercher" }
 */
router.post('/autocomplete', selogerController.autocompleteTest);

module.exports = router;

