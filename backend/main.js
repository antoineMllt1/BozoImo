const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors()); // Permettre les requêtes depuis le frontend
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger middleware (optionnel)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes de l'API
app.use('/api', apiRoutes);

// ── Electron production: serve built frontend ──────────────────────────────────
if (process.env.ELECTRON_STATIC === 'true') {
  const distPath = path.join(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(distPath));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// Route racine
app.get('/', (req, res) => {
  res.json({
    message: 'Bienvenue sur l\'API BozoImo',
    documentation: '/api'
  });
});

// Middleware pour gérer les routes non trouvées
app.use((req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    path: req.path
  });
});

// Middleware pour gérer les erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err.stack);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: err.message
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📍 Routes disponibles:`);
  console.log(`   GET  http://localhost:${PORT}/api`);
  console.log(`\n   📊 Immobilier (MeilleursAgents):`);
  console.log(`   GET  http://localhost:${PORT}/api/immobilier/health`);
  console.log(`   POST http://localhost:${PORT}/api/immobilier/search`);
  console.log(`   POST http://localhost:${PORT}/api/immobilier/geocode`);
  console.log(`\n   🏠 SeLoger:`);
  console.log(`   POST http://localhost:${PORT}/api/seloger/search`);
  console.log(`   POST http://localhost:${PORT}/api/seloger/autocomplete`);
});
