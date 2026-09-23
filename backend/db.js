const { Pool } = require('pg');

/**
 * Connexion Postgres partagée (comptes agents + historique des dossiers).
 * DATABASE_URL est fourni automatiquement par Railway quand un plugin
 * Postgres est attaché au service. En local, mets la même valeur dans .env
 * (voir .env.example) pour pointer vers la même base pendant le dev.
 */

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL absente — les comptes et l\'historique des dossiers ne fonctionneront pas.');
}

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      // Railway (et la plupart des Postgres managés) exigent TLS mais avec un
      // certificat auto-signé côté serveur — on le désactive sans forcer une
      // config de cert manuelle, ce qui reste raisonnable pour un backend qui
      // ne fait que parler à sa propre base.
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : null;

async function query(text, params) {
  if (!pool) throw new Error('Base de données non configurée (DATABASE_URL manquante)');
  return pool.query(text, params);
}

/**
 * Crée les tables si elles n'existent pas encore. Appelé une fois au
 * démarrage du serveur — idempotent, donc sans danger à chaque redéploiement.
 */
async function migrate() {
  if (!pool) return;

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

  console.log('✅ Migrations base de données appliquées');
}

module.exports = { pool, query, migrate };
