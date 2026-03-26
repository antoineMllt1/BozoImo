const express = require('express');
const router = express.Router();

// Import des routes
const enrichRoutes = require('./enrich.routes');
const immobilierRoutes = require('./immobilier.routes');
const selogerRoutes = require('./seloger.routes');
const villesAVivreRoutes = require('./villesavivre.routes');
const banRoutes = require('./ban.routes');
const dvfplusRoutes = require('./dvfplus.routes');
const dpeRoutes = require('./dpe.routes');
const castorusRoutes = require('./castorus.routes');
const georisquesRoutes = require('./georisques.routes');
const cadastreRoutes = require('./cadastre.routes');
const pappersRoutes = require('./pappers.routes');

// Configuration des routes
router.use('/enrich', enrichRoutes);
router.use('/immobilier', immobilierRoutes);
router.use('/seloger', selogerRoutes);
router.use('/villesavivre', villesAVivreRoutes);
router.use('/ban', banRoutes);
router.use('/dvfplus', dvfplusRoutes);
router.use('/dpe', dpeRoutes);
router.use('/castorus', castorusRoutes);
router.use('/georisques', georisquesRoutes);
router.use('/cadastre', cadastreRoutes);
router.use('/pappers', pappersRoutes);

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
      },
      ban: {
        geocode: 'POST /api/ban/geocode',
        reverse: 'POST /api/ban/reverse'
      },
      dvfplus: {
        search: 'POST /api/dvfplus/search',
        indicators: 'POST /api/dvfplus/indicators'
      },
      dpe: {
        search: 'POST /api/dpe/search'
      },
      castorus: {
        lookup: 'POST /api/castorus/lookup',
        priceDrops: 'POST /api/castorus/price-drops'
      },
      georisques: {
        profile: 'POST /api/georisques/profile'
      },
      cadastre: {
        parcelle: 'POST /api/cadastre/parcelle',
        building: 'POST /api/cadastre/building'
      },
      pappers: {
        search: 'POST /api/pappers/search',
        parcelle: 'POST /api/pappers/parcelle'
      }
    }
  });
});

module.exports = router;

