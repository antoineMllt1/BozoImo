const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken } = require('../utils/auth');

const DEFAULT_MODEL = { samples: [], correctionFactor: 1, mae: null, mape: null };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name || null };
}

/**
 * Inscription. En bêta fermée : un code d'invitation partagé (BETA_INVITE_CODE)
 * peut être exigé pour limiter qui peut créer un compte — laisse la variable
 * d'env vide pour désactiver ce contrôle.
 */
exports.signup = async (req, res) => {
  try {
    const { email, password, name, inviteCode } = req.body;

    if (!email || !EMAIL_RE.test(String(email).trim())) {
      return res.status(400).json({ error: 'Adresse e-mail invalide' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères' });
    }
    const requiredCode = process.env.BETA_INVITE_CODE;
    if (requiredCode && inviteCode !== requiredCode) {
      return res.status(403).json({ error: 'Code d\'invitation invalide' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Un compte existe déjà avec cet e-mail' });
    }

    const passwordHash = await bcrypt.hash(String(password), 12);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, model)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [normalizedEmail, passwordHash, name ? String(name).trim() : null, JSON.stringify(DEFAULT_MODEL)]
    );

    const user = result.rows[0];
    res.status(201).json({ token: signToken(user.id), user: publicUser(user), model: DEFAULT_MODEL });
  } catch (error) {
    console.error('Erreur signup:', error.message);
    res.status(500).json({ error: 'Erreur lors de la création du compte', details: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail et mot de passe requis' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const result = await db.query(
      'SELECT id, email, name, password_hash, model FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];
    // Message volontairement identique dans les deux cas pour ne pas révéler
    // si un e-mail est enregistré ou non.
    const invalid = () => res.status(401).json({ error: 'E-mail ou mot de passe incorrect' });
    if (!user) return invalid();

    const ok = await bcrypt.compare(String(password), user.password_hash);
    if (!ok) return invalid();

    res.json({ token: signToken(user.id), user: publicUser(user), model: user.model || DEFAULT_MODEL });
  } catch (error) {
    console.error('Erreur login:', error.message);
    res.status(500).json({ error: 'Erreur lors de la connexion', details: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, name, model FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: publicUser(user), model: user.model || DEFAULT_MODEL });
  } catch (error) {
    console.error('Erreur me:', error.message);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

