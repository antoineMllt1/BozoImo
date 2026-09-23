const express = require('express');
const router = express.Router();

// Import des routes
const claudeRoutes = require('./claude.routes');
const pdfRoutes = require('./pdf.routes');
const enrichRoutes = require('./enrich.routes');
const immobilierRoutes = require('./immobilier.routes');
const selogerRoutes = require('./seloger.routes');
const villesAVivreRoutes = require('./villesavivre.routes');
const authRoutes = require('./auth.routes');
const dossiersRoutes = require('./dossiers.routes');

// Configuration des routes
router.use('/claude', claudeRoutes);
router.use('/pdf', pdfRoutes);
router.use('/enrich', enrichRoutes);
router.use('/immobilier', immobilierRoutes);
router.use('/seloger', selogerRoutes);
router.use('/villesavivre', villesAVivreRoutes);
router.use('/auth', authRoutes);
router.use('/dossiers', dossiersRoutes);

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
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      dossiers: {
        list: 'GET /api/dossiers',
        upsert: 'PUT /api/dossiers/:id',
        remove: 'DELETE /api/dossiers/:id'
      }
    }
  });
});

module.exports = router;

