const express = require('express');
const router = express.Router();
const dvfplusController = require('../controllers/dvfplus.controller');

/**
 * @route   POST /api/dvfplus/search
 * @desc    Rechercher des mutations immobilières via DVF Cerema
 * @access  Public
 */
router.post('/search', dvfplusController.searchMutations);

/**
 * @route   POST /api/dvfplus/indicators
 * @desc    Récupérer les indicateurs DVF d'une commune
 * @access  Public
 */
router.post('/indicators', dvfplusController.getIndicators);

module.exports = router;
