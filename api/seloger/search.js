let searchSeloger;
try {
  searchSeloger = require('../../backend/controllers/seloger.controller').searchSeloger;
  console.log('[seloger/search] module loaded OK, SCRAPER_API_KEY set:', !!process.env.SCRAPER_API_KEY);
} catch (e) {
  console.error('[seloger/search] LOAD ERROR:', e.message);
}

module.exports = async (req, res) => {
  console.log('[seloger/search] invoked', req.method);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  if (!searchSeloger) {
    return res.status(500).json({ error: 'Controller failed to load — check function logs' });
  }
  return searchSeloger(req, res);
};
