const path = require('path');

/**
 * Connexion base de données (comptes agents + historique des dossiers).
 *
 * - En production (Railway) : DATABASE_URL est fournie automatiquement quand
 *   un plugin Postgres est attaché au service → on utilise `pg`.
 * - En local sans DATABASE_URL : on utilise une base Postgres embarquée
 *   (@electric-sql/pglite, Postgres compilé en WASM — aucune install, aucun
 *   Docker) persistée dans backend/.cache/pglite-dev/. Pratique pour tester
 *   tout le flux (comptes, historique) sans rien déployer. Les données ne
 *   vivent que sur cette machine — à ne jamais utiliser en prod.
 */

const hasRealDb = Boolean(process.env.DATABASE_URL);

if (!hasRealDb) {
  console.warn('⚠️  DATABASE_URL absente — utilisation d\'une base Postgres locale embarquée (dev uniquement, voir backend/db.js)');
}

const pool = hasRealDb
  ? new (require('pg').Pool)({
      connectionString: process.env.DATABASE_URL,
      // Railway (et la plupart des Postgres managés) exigent TLS mais avec un
      // certificat auto-signé côté serveur — on le désactive sans forcer une
      // config de cert manuelle, ce qui reste raisonnable pour un backend qui
      // ne fait que parler à sa propre base.
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

let _pgliteReady = null;
function getPglite() {
  if (!_pgliteReady) {
    const { PGlite } = require('@electric-sql/pglite');
    const dataDir = path.join(__dirname, '.cache', 'pglite-dev');
    _pgliteReady = PGlite.create ? PGlite.create({ dataDir }) : Promise.resolve(new PGlite(dataDir));
  }
  return _pgliteReady;
}

async function query(text, params) {
  if (pool) return pool.query(text, params);
  const db = await getPglite();
  return db.query(text, params);
}

/**
 * Crée les tables si elles n'existent pas encore. Appelé une fois au
 * démarrage du serveur — idempotent, donc sans danger à chaque redéploiement.
 */
async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      model JSONB NOT NULL DEFAULT '{"samples":[],"correctionFactor":1,"mae":null,"mape":null}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dossiers (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, id)
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_dossiers_user_id ON dossiers(user_id);`);

  console.log(`✅ Migrations base de données appliquées${hasRealDb ? '' : ' (base locale embarquée — dev uniquement)'}`);
}

module.exports = { pool, query, migrate, hasRealDb };
