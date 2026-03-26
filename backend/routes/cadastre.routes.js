const express = require('express');
const router = express.Router();
const cadastreController = require('../controllers/cadastre.controller');

/**
 * @route   POST /api/cadastre/parcelle
 * @desc    Récupérer les informations de parcelle cadastrale
 * @access  Public
 */
router.post('/parcelle', cadastreController.getParcelle);

/**
 * @route   POST /api/cadastre/building
 * @desc    Récupérer les informations bâtiment (BDNB)
 * @access  Public
 */
router.post('/building', cadastreController.getBuildingInfo);

module.exports = router;
