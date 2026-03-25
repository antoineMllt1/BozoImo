const express = require('express');
const router = express.Router();
const villesAVivreController = require('../controllers/villesavivre.controller');

router.post('/search', villesAVivreController.searchVillesAVivre);
router.post('/profile', villesAVivreController.searchVillesAVivre);

module.exports = router;
