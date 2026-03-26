const express = require('express');
const router = express.Router();
const georisquesController = require('../controllers/georisques.controller');

/**
 * @route   POST /api/georisques/profile
 * @desc    Récupérer le profil de risques pour une localisation
 * @access  Public
 */
router.post('/profile', georisquesController.getRiskProfile);

module.exports = router;
