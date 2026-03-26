const express = require('express');
const router = express.Router();
const pappersController = require('../controllers/pappers.controller');

/**
 * @route   POST /api/pappers/search
 * @desc    Rechercher des parcelles autour d'une localisation
 * @access  Public
 */
router.post('/search', pappersController.searchParcelles);

/**
 * @route   POST /api/pappers/parcelle
 * @desc    Récupérer le détail d'une parcelle
 * @access  Public
 */
router.post('/parcelle', pappersController.getParcelleDetail);

module.exports = router;
