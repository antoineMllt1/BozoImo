const express = require('express');
const router = express.Router();

// Import des routes
const enrichRoutes = require('./enrich.routes');
const immobilierRoutes = require('./immobilier.routes');
const selogerRoutes = require('./seloger.routes');
const villesAVivreRoutes = require('./villesavivre.routes');

// Configuration des routes
router.use('/enrich', enrichRoutes);
router.use('/immobilier', immobilierRoutes);
router.use('/seloger', selogerRoutes);
router.use('/villesavivre', villesAVivreRoutes);

// Route racine de l'API
router.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API BozoImo',
    version: '1.0.0',
    routes: {
      enrich: {
        create: 'POST /api/enrich'
      },
      villesavivre: {
        search: 'POST /api/villesavivre/search',
        profile: 'POST /api/villesavivre/profile'
      },
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

