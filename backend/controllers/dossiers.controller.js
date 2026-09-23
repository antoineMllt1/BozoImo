const db = require('../db');

/**
 * Historique des dossiers, scopé par compte (user_id). Chaque dossier est
 * stocké tel quel en JSONB (`data`) — même forme riche que l'ancien objet
 * localStorage — pour éviter de modéliser un schéma relationnel complet
 * pendant la bêta.
 */

exports.list = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT data FROM dossiers WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50',
      [req.userId]
    );
    res.json({ dossiers: result.rows.map(row => row.data) });
  } catch (error) {
    console.error('Erreur list dossiers:', error.message);
    res.status(500).json({ error: 'Erreur lors du chargement des dossiers', details: error.message });
  }
};

/** Crée ou met à jour un dossier (upsert par id, scopé au compte courant). */
exports.upsert = async (req, res) => {
  try {
    const { id } = req.params;
    const dossier = req.body;
    if (!dossier || typeof dossier !== 'object' || dossier.id !== id) {
      return res.status(400).json({ error: 'Le corps de la requête doit être un dossier dont l\'id correspond à l\'URL' });
    }

    await db.query(
      `INSERT INTO dossiers (user_id, id, data, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [req.userId, id, JSON.stringify(dossier)]
    );
    res.json({ ok: true, dossier });
  } catch (error) {
    console.error('Erreur upsert dossier:', error.message);
    res.status(500).json({ error: 'Erreur lors de la sauvegarde du dossier', details: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM dossiers WHERE user_id = $1 AND id = $2', [req.userId, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Erreur delete dossier:', error.message);
    res.status(500).json({ error: 'Erreur lors de la suppression du dossier', details: error.message });
  }
};
