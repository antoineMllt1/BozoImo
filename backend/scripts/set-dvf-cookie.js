#!/usr/bin/env node
const { setCookie, COOKIE_FILE } = require('../utils/dvfCookieStore');

const cookie = process.argv.slice(2).join(' ').trim();

if (!cookie) {
  console.log(`
Usage :
  node scripts/set-dvf-cookie.js "<cookie complet>"
  (ou depuis la racine : npm --prefix backend run refresh-dvf-cookie -- "<cookie complet>")

Comment récupérer un cookie valide :
  1. Ouvre https://www.meilleursagents.com/prix-immobilier/dvf/ dans un vrai
     navigateur (Chrome, Edge...) — PAS dans un navigateur automatisé.
  2. Si une page de vérification (captcha) s'affiche, résous-la normalement.
  3. Une fois la page chargée, ouvre les DevTools (F12) → onglet "Network".
  4. Recharge la page (F5), clique sur la 1ère requête vers
     www.meilleursagents.com → onglet "Headers" → "Request Headers".
  5. Copie toute la valeur de l'en-tête "cookie" et colle-la ici entre
     guillemets :
       node scripts/set-dvf-cookie.js "datadome=xxx; session=yyy; ..."

Ce cookie expire au bout de quelques heures (protection anti-bot DataDome) :
répète cette procédure quand la collecte DVF recommence à échouer avec une
erreur 403 / captcha.
`);
  process.exit(cookie ? 0 : 1);
}

setCookie(cookie);
console.log(`✅ Cookie DVF enregistré dans ${COOKIE_FILE}`);
console.log('   Aucun redémarrage du serveur nécessaire — relu à chaque requête.');
