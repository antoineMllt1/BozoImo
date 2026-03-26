const express = require('express');
const router = express.Router();
const banController = require('../controllers/ban.controller');

/**
 * @route   POST /api/ban/geocode
 * @desc    Géocoder une adresse via la Base Adresse Nationale
 * @access  Public
 */
router.post('/geocode', banController.geocodeAddress);

/**
 * @route   POST /api/ban/reverse
 * @desc    Géocodage inversé via la Base Adresse Nationale
 * @access  Public
 */
router.post('/reverse', banController.reverseGeocode);

module.exports = router;
