const fs = require('fs');
const path = require('path');

/**
 * Stockage du cookie de session MeilleursAgents utilisé pour le scraping DVF.
 * Volontairement PAS codé en dur dans le code source : lu depuis un fichier
 * local (ignoré par git, jamais commité) et relu à chaque requête, pour
 * pouvoir être rafraîchi sans redémarrer le serveur.
 *
 * Constat en le testant (04/09/2026) : les endpoints JSON scrapés
 * (`/prix-immobilier/dvf/search`, `geo.meilleursagents.com/geo/v1/`)
 * répondent 200 dès qu'un en-tête Cookie contenant `datadome=`/`session=`
 * est présent — même avec des valeurs bidon — tant que la requête part de
 * Node/axios (contrairement à curl, bloqué en 403 quel que soit le cookie,
 * probablement sur la seule empreinte TLS). Ça peut changer sans préavis si
 * DataDome durcit la règle sur ce endpoint : un vrai cookie capturé dans un
 * navigateur reste alors le recours (voir setCookie / scripts/set-dvf-cookie.js).
 *
 * Mise à jour manuelle : `npm --prefix backend run refresh-dvf-cookie -- "<cookie>"`.
 */

const COOKIE_FILE = path.join(__dirname, '..', '.cache', 'meilleursagents-cookie.txt');
const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // un vrai cookie DataDome expire en quelques heures

// Cookie de secours utilisé tant qu'aucun cookie réel n'a été enregistré —
// suffisant aujourd'hui pour ces endpoints (voir note ci-dessus), mais pas
// garanti de le rester : `isDefault` permet au contrôleur d'adapter son
// message d'erreur si le site se met à vraiment le valider.
const DEFAULT_COOKIE = 'datadome=; session=;';

function getCookie() {
  try {
    const raw = fs.readFileSync(COOKIE_FILE, 'utf8').trim();
    if (raw) {
      const stat = fs.statSync(COOKIE_FILE);
      const ageMs = Date.now() - stat.mtimeMs;
      return { value: raw, ageMs, stale: ageMs > STALE_AFTER_MS, isDefault: false };
    }
  } catch (_) {
    // pas de fichier -> cookie par défaut
  }
  return { value: DEFAULT_COOKIE, ageMs: 0, stale: false, isDefault: true };
}

function setCookie(cookie) {
  fs.mkdirSync(path.dirname(COOKIE_FILE), { recursive: true });
  fs.writeFileSync(COOKIE_FILE, cookie.trim(), 'utf8');
}

module.exports = { getCookie, setCookie, COOKIE_FILE };
