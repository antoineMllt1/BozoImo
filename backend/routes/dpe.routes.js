const express = require('express');
const router = express.Router();
const dpeController = require('../controllers/dpe.controller');

/**
 * @route   POST /api/dpe/search
 * @desc    Rechercher des diagnostics de performance énergétique à proximité
 * @access  Public
 */
router.post('/search', dpeController.searchDPE);

module.exports = router;
