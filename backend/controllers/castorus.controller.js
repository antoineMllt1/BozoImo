const fs = require('fs');

// ── Puppeteer session (own browser, separate from SeLoger) ──────────────────
let _browser = null;
let _page    = null;
let _sessionReady = false;

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

async function getPage() {
  if (_page && _sessionReady) return _page;

  const executablePath = findBrowser();
  if (!executablePath) throw new Error('Chrome/Edge introuvable — installez Chrome pour utiliser Castorus');

  const puppeteer = require('puppeteer-core');
  _browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  _page = await _browser.newPage();
  await _page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await _page.setExtraHTTPHeaders({ 'accept-language': 'fr-FR,fr;q=0.9' });

  // Visit Castorus to establish session cookies
  await _page.goto('https://www.castorus.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  _sessionReady = true;

  _browser.on('disconnected', () => { _browser = null; _page = null; _sessionReady = false; });
  return _page;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNumber(text) {
  if (!text) return null;
  const cleaned = text.replace(/[^\d.,-]/g, '').replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parsePercentage(text) {
  if (!text) return null;
  const match = text.match(/([+-]?\d+[.,]?\d*)\s*%/);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

function assessNegotiationPotential(daysOnMarket, totalPriceChange) {
  // Strong negotiation potential: long time on market OR large price drops
  if ((daysOnMarket && daysOnMarket > 180) || (totalPriceChange && totalPriceChange < -15)) {
    return 'fort';
  }
  if ((daysOnMarket && daysOnMarket > 90) || (totalPriceChange && totalPriceChange < -5)) {
    return 'moyen';
  }
  return 'faible';
}

// ── Controllers ─────────────────────────────────────────────────────────────

/**
 * Look up a SeLoger listing URL on Castorus to get price history & negotiation data.
 * POST /api/castorus/lookup
 * Body: { url: "https://www.seloger.com/annonces/..." }
 */
exports.lookupListing = async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Le paramètre "url" est requis' });
  }

  try {
    const page = await getPage();

    // Navigate to Castorus search page
    await page.goto('https://www.castorus.com/recherche/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check for login wall / captcha
    const loginWall = await page.evaluate(() => {
      const body = document.body.innerText || '';
      if (body.includes('Connectez-vous') || body.includes('captcha') || body.includes('CAPTCHA')) {
        return true;
      }
      return false;
    });

    if (loginWall) {
      return res.json({ found: false, error: 'login_required', listingUrl: url });
    }

    // Find search input and type the listing URL
    await page.waitForSelector('input[type="text"], input[type="search"], input[name="q"], #search, .search-input', { timeout: 10000 });

    // Clear any existing text and type the URL
    const inputSelector = await page.evaluate(() => {
      const selectors = ['input[name="q"]', 'input[type="search"]', 'input[type="text"]', '#search', '.search-input'];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return sel;
      }
      // Fallback: first visible input
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.offsetParent !== null && inp.type !== 'hidden') return `input[type="${inp.type}"]`;
      }
      return null;
    });

    if (!inputSelector) {
      return res.status(500).json({ error: 'Impossible de trouver le champ de recherche Castorus' });
    }

    await page.click(inputSelector, { clickCount: 3 }); // select all
    await page.type(inputSelector, url, { delay: 20 });

    // Submit the form
    await page.keyboard.press('Enter');

    // Wait for results / navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

    // Give extra time for content to load
    await new Promise(r => setTimeout(r, 2000));

    // Check if we landed on a listing page or a "not found" page
    const currentUrl = page.url();

    // Check for login wall again after navigation
    const loginWallAfter = await page.evaluate(() => {
      const body = document.body.innerText || '';
      if (body.includes('Connectez-vous') || body.includes('captcha') || body.includes('CAPTCHA')) {
        return true;
      }
      return false;
    });

    if (loginWallAfter) {
      return res.json({ found: false, error: 'login_required', listingUrl: url });
    }

    // Try to scrape listing data from the page
    const data = await page.evaluate(() => {
      const getText = (selector) => {
        const el = document.querySelector(selector);
        return el ? el.innerText.trim() : null;
      };

      const body = document.body.innerText || '';

      // Check if listing was found
      if (body.includes('Aucun résultat') || body.includes('pas trouvé') || body.includes('introuvable')) {
        return { found: false };
      }

      // ── Days on market ──
      let daysOnMarket = null;
      const dayMatches = body.match(/(\d+)\s*jours?/i);
      if (dayMatches) {
        daysOnMarket = parseInt(dayMatches[1], 10);
      }

      // ── Price evolution (total percentage change) ──
      let totalPriceChange = null;
      const pctMatches = body.match(/([+-]?\d+[.,]?\d*)\s*%/g);
      if (pctMatches && pctMatches.length > 0) {
        // Take the first prominent percentage as the total change
        const first = pctMatches[0].replace(',', '.').replace('%', '').trim();
        totalPriceChange = parseFloat(first);
        if (isNaN(totalPriceChange)) totalPriceChange = null;
      }

      // ── Current price ──
      let currentPrice = null;
      const priceMatches = body.match(/([\d\s.,]+)\s*€/g);
      if (priceMatches && priceMatches.length > 0) {
        const cleaned = priceMatches[0].replace(/[^\d.,]/g, '').replace(',', '.').replace(/\s/g, '');
        currentPrice = parseFloat(cleaned);
        if (isNaN(currentPrice)) currentPrice = null;
      }

      // ── Price per m² ──
      let pricePerM2 = null;
      const m2Matches = body.match(/([\d\s.,]+)\s*€\s*\/\s*m²/i);
      if (m2Matches) {
        const cleaned = m2Matches[1].replace(/[^\d.,]/g, '').replace(',', '.').replace(/\s/g, '');
        pricePerM2 = parseFloat(cleaned);
        if (isNaN(pricePerM2)) pricePerM2 = null;
      }

      // ── Price vs market ──
      let priceVsMarket = null;
      const vsMarketMatch = body.match(/([+-]?\d+[.,]?\d*)\s*%\s*vs\s*march/i);
      if (vsMarketMatch) {
        priceVsMarket = parseFloat(vsMarketMatch[1].replace(',', '.'));
        if (isNaN(priceVsMarket)) priceVsMarket = null;
      }

      // ── Price changes (timeline) ──
      const priceChanges = [];
      // Look for modification/timeline cards
      const cards = document.querySelectorAll('.modification, .timeline-item, .price-change, [class*="modif"], [class*="histo"]');
      cards.forEach(card => {
        const text = card.innerText || '';
        const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        const prices = text.match(/([\d\s.,]+)\s*€/g);
        const pctMatch = text.match(/([+-]?\d+[.,]?\d*)\s*%/);

        if (dateMatch && prices && prices.length >= 1) {
          const entry = { date: dateMatch[1] };
          if (prices.length >= 2) {
            entry.oldPrice = parseFloat(prices[0].replace(/[^\d.,]/g, '').replace(',', '.'));
            entry.newPrice = parseFloat(prices[1].replace(/[^\d.,]/g, '').replace(',', '.'));
          } else {
            entry.oldPrice = null;
            entry.newPrice = parseFloat(prices[0].replace(/[^\d.,]/g, '').replace(',', '.'));
          }
          entry.changePct = pctMatch ? parseFloat(pctMatch[1].replace(',', '.')) : null;
          priceChanges.push(entry);
        }
      });

      // ── Agencies ──
      const agencies = [];
      const agencyEls = document.querySelectorAll('.agency, .agence, [class*="agenc"], [class*="agent"]');
      agencyEls.forEach(el => {
        const name = el.querySelector('a, .name, .agency-name, [class*="name"]');
        const price = el.innerText.match(/([\d\s.,]+)\s*€/);
        agencies.push({
          name: name ? name.innerText.trim() : el.innerText.trim().substring(0, 80),
          price: price ? parseFloat(price[1].replace(/[^\d.,]/g, '').replace(',', '.')) : null,
        });
      });

      return {
        found: true,
        daysOnMarket,
        totalPriceChange,
        priceChanges,
        currentPrice,
        pricePerM2,
        priceVsMarket,
        agencies,
      };
    });

    if (!data.found) {
      return res.json({ found: false, listingUrl: url });
    }

    // Assess negotiation potential
    const negotiationPotential = assessNegotiationPotential(data.daysOnMarket, data.totalPriceChange);

    return res.json({
      found: true,
      daysOnMarket: data.daysOnMarket,
      totalPriceChange: data.totalPriceChange,
      priceChanges: data.priceChanges || [],
      currentPrice: data.currentPrice,
      pricePerM2: data.pricePerM2,
      priceVsMarket: data.priceVsMarket,
      agencies: data.agencies || [],
      negotiationPotential,
      listingUrl: url,
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erreur Castorus lookupListing:', error.message);
    return res.status(500).json({
      error: 'Erreur lors de la recherche Castorus',
      details: error.message,
      listingUrl: url,
    });
  }
};

/**
 * Get listings with recent price drops for a given department.
 * POST /api/castorus/price-drops
 * Body: { department: "75" }
 */
exports.getPriceDrops = async (req, res) => {
  const { department } = req.body;

  if (!department || typeof department !== 'string') {
    return res.status(400).json({ error: 'Le paramètre "department" est requis (ex: "75")' });
  }

  try {
    const page = await getPage();

    await page.goto(`https://www.castorus.com/annonces/prix-baisse/${department}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Check for login wall / captcha
    const loginWall = await page.evaluate(() => {
      const body = document.body.innerText || '';
      if (body.includes('Connectez-vous') || body.includes('captcha') || body.includes('CAPTCHA')) {
        return true;
      }
      return false;
    });

    if (loginWall) {
      return res.json({ found: false, error: 'login_required', department });
    }

    // Wait for listing cards to appear
    await page.waitForSelector('.annonce, .listing, .card, [class*="annonce"], [class*="listing"], article, .result', { timeout: 10000 }).catch(() => {});

    // Give extra time for content
    await new Promise(r => setTimeout(r, 2000));

    const listings = await page.evaluate(() => {
      const results = [];

      // Try multiple possible selectors for listing cards
      const cardSelectors = [
        '.annonce', '.listing', '.card', '[class*="annonce"]',
        '[class*="listing"]', 'article', '.result', 'tr', '.item',
      ];

      let cards = [];
      for (const sel of cardSelectors) {
        cards = document.querySelectorAll(sel);
        if (cards.length > 1) break; // found real cards
      }

      cards.forEach(card => {
        const text = card.innerText || '';
        if (!text.trim()) return;

        // Title: first link or heading
        const titleEl = card.querySelector('a, h2, h3, h4, .title, [class*="title"]');
        const title = titleEl ? titleEl.innerText.trim() : text.split('\n')[0]?.trim() || '';

        // Link
        const linkEl = card.querySelector('a[href]');
        const link = linkEl ? linkEl.href : null;

        // Price
        let price = null;
        const priceMatch = text.match(/([\d\s.,]+)\s*€/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(/[^\d.,]/g, '').replace(',', '.'));
          if (isNaN(price)) price = null;
        }

        // Price change percentage
        let priceChange = null;
        const pctMatch = text.match(/([+-]?\d+[.,]?\d*)\s*%/);
        if (pctMatch) {
          priceChange = parseFloat(pctMatch[1].replace(',', '.'));
          if (isNaN(priceChange)) priceChange = null;
        }

        // Date
        let date = null;
        const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/);
        if (dateMatch) {
          date = dateMatch[1];
        }

        if (title || price) {
          results.push({ title, price, priceChange, link, date });
        }
      });

      return results;
    });

    return res.json({
      found: true,
      department,
      count: listings.length,
      listings,
      fetchedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erreur Castorus getPriceDrops:', error.message);
    return res.status(500).json({
      error: 'Erreur lors de la recherche des baisses de prix',
      details: error.message,
      department,
    });
  }
};
