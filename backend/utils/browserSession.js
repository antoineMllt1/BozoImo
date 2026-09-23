const fs = require('fs');

// ── Chrome/Edge discovery (shared across scraping controllers) ─────────────
const CHROME_PATHS = [
  // Env var override (Railway: set CHROME_EXECUTABLE=/usr/bin/chromium)
  process.env.CHROME_EXECUTABLE,
  // Linux — nixpkgs / Railway (nix profile)
  '/root/.nix-profile/bin/chromium',
  '/nix/var/nix/profiles/default/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/snap/bin/chromium',
  // Windows — local dev
  process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);

function findBrowser() {
  for (const p of CHROME_PATHS) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  // Fallback: try `which chromium` or `which chromium-browser`
  try {
    const { execSync } = require('child_process');
    for (const bin of ['chromium', 'chromium-browser', 'google-chrome']) {
      try {
        const p = execSync(`which ${bin}`, { encoding: 'utf8' }).trim();
        if (p && fs.existsSync(p)) return p;
      } catch (_) {}
    }
  } catch (_) {}
  return null;
}

const HEADER_ALLOWLIST = new Set(['accept', 'content-type', 'origin', 'referer', 'x-language', 'x-requested-with']);

function filterHeaders(headers = {}) {
  const out = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value == null) continue;
    const normalized = key.toLowerCase();
    if (HEADER_ALLOWLIST.has(normalized) || normalized.startsWith('x-')) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Crée une session de navigateur headless réutilisable, utilisée pour obtenir
 * un cookie anti-bot (DataDome) valide en visitant `warmupUrl`, puis pour
 * exécuter des requêtes `fetch` authentifiées depuis la page elle-même
 * (le navigateur gère les cookies automatiquement — pas besoin de les copier
 * à la main, ce qui évite qu'ils expirent).
 *
 * @param {Object} opts
 * @param {string} opts.warmupUrl - URL visitée pour initialiser les cookies de session
 * @param {string} [opts.userAgent]
 * @param {Object} [opts.extraHeaders]
 * @param {string} [opts.name] - nom du service, pour les messages d'erreur
 */
function createBrowserSession({ warmupUrl, userAgent, extraHeaders, name = 'ce service' }) {
  let _browser = null;
  let _page = null;
  let _sessionReady = false;

  async function resetSession() {
    if (_browser) {
      try { await _browser.close(); } catch (_) {}
    }
    _browser = null;
    _page = null;
    _sessionReady = false;
  }

  async function getPage() {
    if (_page && _sessionReady) return _page;

    const executablePath = findBrowser();
    if (!executablePath) throw new Error(`Chrome/Edge introuvable — installez Chrome pour utiliser ${name}`);

    const puppeteer = require('puppeteer-core');
    _browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    _page = await _browser.newPage();
    await _page.setUserAgent(userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await _page.setExtraHTTPHeaders({ 'accept-language': 'fr-FR,fr;q=0.9', ...extraHeaders });

    // Visite la page d'accueil pour obtenir un cookie DataDome valide
    await _page.goto(warmupUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    _sessionReady = true;

    _browser.on('disconnected', () => { _browser = null; _page = null; _sessionReady = false; });
    return _page;
  }

  async function request(config, { retryOnAuthError = true } = {}) {
    const page = await getPage();
    const method = (config.method || 'GET').toUpperCase();
    const body = config.data ? (typeof config.data === 'string' ? config.data : JSON.stringify(config.data)) : undefined;
    const headers = filterHeaders(config.headers);

    if (body) {
      const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type');
      if (!hasContentType) headers['content-type'] = 'application/json';
    } else {
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') delete headers[key];
      }
    }

    const result = await page.evaluate(async ({ url, method, body, headers }) => {
      const res = await fetch(url, { method, headers, body, credentials: 'include' });
      const text = await res.text();
      return { status: res.status, text };
    }, { url: config.url, method, body, headers });

    // Un 403 signifie probablement que le challenge anti-bot a expiré ou a changé :
    // on relance une session fraîche une seule fois avant d'abandonner.
    if (result.status === 403 && retryOnAuthError) {
      await resetSession();
      return request(config, { retryOnAuthError: false });
    }

    if (result.status >= 400) {
      const isCaptchaChallenge = result.status === 403 && /captcha-delivery\.com/.test(result.text);
      const err = new Error(
        isCaptchaChallenge
          ? `${name} demande une vérification anti-robot (captcha) — la protection DataDome bloque l'accès automatisé pour le moment`
          : `${name} a répondu avec le statut ${result.status}`
      );
      err.response = { status: result.status, data: result.text };
      err.isCaptchaChallenge = isCaptchaChallenge;
      throw err;
    }

    let data;
    try {
      data = JSON.parse(result.text);
    } catch (_) {
      const err = new Error(`${name} a renvoyé une réponse non-JSON (probable page de challenge anti-bot)`);
      err.response = { status: result.status, data: result.text };
      throw err;
    }

    return { data };
  }

  return { getPage, request, resetSession };
}

module.exports = { createBrowserSession, findBrowser };
