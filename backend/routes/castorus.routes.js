const express = require('express');
const router = express.Router();
const castorusController = require('../controllers/castorus.controller');

/**
 * @route   POST /api/castorus/lookup
 * @desc    Rechercher l'historique de prix d'une annonce SeLoger sur Castorus
 * @access  Public
 * @body    { "url": "https://www.seloger.com/annonces/achat/appartement/paris-10eme-75/xxx.htm" }
 */
router.post('/lookup', castorusController.lookupListing);

/**
 * @route   POST /api/castorus/price-drops
 * @desc    Lister les annonces avec baisses de prix pour un departement
 * @access  Public
 * @body    { "department": "75" }
 */
router.post('/price-drops', castorusController.getPriceDrops);

module.exports = router;
