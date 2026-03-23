const express = require('express');
const router = express.Router();
const immobilierController = require('../controllers/immobilier.controller');

/**
 * @route   POST /api/immobilier/geocode
 * @desc    Géocoder une adresse en coordonnées GPS
 * @access  Public
 */
router.post('/geocode', immobilierController.geocodeAddress);

/**
 * @route   POST /api/immobilier/search
 * @desc    Rechercher des biens immobiliers
 * @access  Public
 */
router.post('/search', immobilierController.searchBiens);

/**
 * @route   GET /api/immobilier/health
 * @desc    Vérifier l'état de santé de l'API
 * @access  Public
 */
router.get('/health', immobilierController.healthCheck);

module.exports = router;

