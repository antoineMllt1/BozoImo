const express = require('express');
const router = express.Router();

// Import des routes
const immobilierRoutes = require('./immobilier.routes');
const selogerRoutes = require('./seloger.routes');

// Configuration des routes
router.use('/immobilier', immobilierRoutes);
router.use('/seloger', selogerRoutes);

// Route racine de l'API
router.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API BozoImo',
    version: '1.0.0',
    routes: {
      immobilier: {
        health: 'GET /api/immobilier/health',
        search: 'POST /api/immobilier/search',
        geocode: 'POST /api/immobilier/geocode'
      },
      seloger: {
        search: 'POST /api/seloger/search',
        autocomplete: 'POST /api/seloger/autocomplete'
      }
    }
  });
});

module.exports = router;

