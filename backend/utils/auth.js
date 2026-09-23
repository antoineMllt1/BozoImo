const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';

if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET absente — l\'authentification échouera. Définis-la dans .env (voir .env.example).');
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET); // lève une erreur si invalide/expiré
}

/** Middleware Express : exige un Bearer token valide, attache req.userId. */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Session invalide ou expirée, reconnecte-toi' });
  }
}

module.exports = { signToken, verifyToken, requireAuth };
