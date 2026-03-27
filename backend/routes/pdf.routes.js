const express = require('express');
const router = express.Router();

const CHROME_PATH = process.env.CHROME_EXECUTABLE
  || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('fr-FR');
}
function fmtK(n) {
  if (!n) return '—';
  return n >= 1000000
    ? (n / 1000000).toFixed(2).replace('.', ',') + ' M€'
    : Math.round(n).toLocaleString('fr-FR') + ' €';
}
function stars(n = 0) {
  return '★'.repeat(Math.min(n, 5)) + '☆'.repeat(Math.max(0, 5 - n));
}
function dpeColor(d) {
  return { A: '#059669', B: '#16a34a', C: '#ca8a04', D: '#ea580c', E: '#dc2626', F: '#b91c1c', G: '#7f1d1d' }[d] || '#94a3b8';
}
function scoreColor(s) {
  if (s >= 70) return '#059669'; if (s >= 45) return '#d97706'; return '#dc2626';
}
function deltaColor(d) {
  return Math.abs(d) <= 5 ? '#059669' : Math.abs(d) <= 12 ? '#d97706' : '#dc2626';
}
function cleanMd(s) {
  return (s || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .trim();
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildHtml({ dossier, estimate, metrics, filteredRefs, areaScores, analystAdjustments, syntheseNotes, aiSynthesis, trend }) {
  const target = dossier.target || {};
  const surf = target.surfaceM2 || 0;
  const pivotPm2 = dossier.manualEstimate || null;
  const algoPm2 = estimate?.correctedPm2 || null;
  const recoPm2 = pivotPm2 || algoPm2;
  const recoPrice = recoPm2 && surf ? recoPm2 * surf : null;
  const typeLabel = target.type === 'House' ? 'Maison' : 'Appartement';
  const dateStr = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const housing = dossier.areaContext?.villesAVivre?.housing;
  const quartierPm2 = housing?.apartmentPricePm2 || housing?.housingPricePm2 || null;
  const quartierTrend = housing?.apartmentPriceTrendPct ?? housing?.housePriceTrendPct ?? null;

  const delta = pivotPm2 && algoPm2 ? ((pivotPm2 - algoPm2) / algoPm2) * 100 : null;

  const adjKeyMap = {
    market_tension: 'Tension de marché', rarity: 'Rareté du bien', dpe: 'DPE',
    condition: 'État / travaux', floor: 'Étage', orientation: 'Orientation',
    outdoor: 'Balcon / terrasse', parking: 'Parking / cave', view: 'Vue',
    transport: 'Transport', schools: 'Écoles', environment: 'Environnement',
    noise_risk: 'Nuisances / risques', custom: 'Autre',
  };

  // Property features
  const features = [
    target.condition && { renovated: '✓ Refait à neuf', good: '✓ Bon état', average: '~ État d\'usage', refresh: '~ Rafraîchissement', heavy_work: '✗ Travaux lourds' }[target.condition],
    target.dpe && `DPE ${target.dpe}`,
    target.floor != null && `Étage ${target.floor}${target.totalFloors ? '/' + target.totalFloors : ''}`,
    target.hasElevator && 'Ascenseur',
    target.hasBalcony && 'Balcon',
    target.hasTerrace && 'Terrasse',
    target.hasParking && 'Parking',
    target.hasCellar && 'Cave',
    target.hasPool && 'Piscine',
    target.hasGarden && 'Jardin',
    target.isDuplex && 'Duplex',
    target.orientation && { south: 'Orientation Sud', north: 'Orientation Nord', east: 'Orientation Est', west: 'Orientation Ouest' }[target.orientation],
    target.viewQuality && { open: 'Vue dégagée', courtyard: 'Vue jardin', vis_a_vis: 'Vis-à-vis', nuisance: 'Vue nuisance' }[target.viewQuality],
    target.yearBuilt && `Construit en ${target.yearBuilt}`,
  ].filter(Boolean);

  // Synthesis
  let synParas = [], synBullets = [];
  const rawSyn = aiSynthesis || (syntheseNotes ? syntheseNotes : null);
  if (rawSyn) {
    for (const l of rawSyn.split('\n')) {
      const t = l.trim();
      if (!t || /^-{2,}$/.test(t) || /^\|/.test(t)) continue; // skip empty, ---, tables
      if (/^#+/.test(t)) continue; // skip # headers
      if (/^[•\-*–]/.test(t)) {
        const content = cleanMd(t.replace(/^[•\-*–]\s*/, '').trim());
        if (content && !/^-+$/.test(content)) synBullets.push(content);
        continue;
      }
      const clean = cleanMd(t);
      if (clean) synParas.push(clean);
    }
  }

  // Scores
  const scoreItems = [
    ['Transport', areaScores?.transportScore],
    ['Écoles', areaScores?.educationScore],
    ['Commerces', areaScores?.walkScore],
    ['Environnement', areaScores?.environmentScore],
    ['Sécurité', areaScores?.safetyScore],
    ['Services', areaScores?.servicesScore],
  ].filter(([, v]) => v != null);

  // Trend bars
  const trendAll = [...(trend?.series || []).slice(-6), ...(trend?.forecast || [])];
  const trendMin = trendAll.length ? Math.min(...trendAll.map(p => p.ppm2)) * 0.96 : 0;
  const trendMax = trendAll.length ? Math.max(...trendAll.map(p => p.ppm2)) * 1.02 : 1;

  // Price bar
  const barAll = [estimate?.minPm2, pivotPm2, estimate?.maxPm2, quartierPm2].filter(Boolean);
  const barLo = barAll.length ? Math.min(...barAll) * 0.94 : 0;
  const barHi = barAll.length ? Math.max(...barAll) * 1.06 : 1;
  const barPct = v => ((v - barLo) / (barHi - barLo) * 100).toFixed(1);

  // Convergence sentence
  let convergenceTxt = '';
  if (quartierPm2 && recoPm2) {
    const dev = Math.abs(recoPm2 - quartierPm2) / quartierPm2;
    const cov = Math.round(Math.max(0, 100 - dev * 100 / 0.15));
    convergenceTxt = cov >= 80
      ? `✓ Notre estimation est parfaitement cohérente avec le marché local (${cov}% de concordance).`
      : cov >= 50
      ? `Le prix estimé s'écarte modérément de la moyenne de secteur (${cov}% de concordance).`
      : `⚠ Le prix estimé s'écarte significativement de la moyenne de secteur — des éléments spécifiques justifient cet écart.`;
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Inter',sans-serif;color:#0f172a;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}

/* ── PAGES ── */
.page{width:210mm;min-height:297mm;position:relative;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}

/* ── FOOTER ── */
.footer{margin-top:auto;padding:10px 32px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #f1f5f9;background:#fff}
.footer-left{font-size:8px;color:#94a3b8;font-weight:500}
.footer-right{font-size:8px;color:#cbd5e1;font-weight:600;letter-spacing:.04em}

/* ══ PAGE 1 — COVER ══ */
.cover-hero{position:relative;height:200mm;overflow:hidden;background:linear-gradient(160deg,#0c1424 0%,#0f2044 40%,#0a1628 100%)}
.cover-hero-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}
.cover-hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,22,40,.4) 0%,rgba(10,22,40,.85) 100%)}
.cover-hero-content{position:relative;z-index:2;padding:44px 40px 40px;display:flex;flex-direction:column;height:100%}
.cover-logo{max-height:44px;max-width:130px;object-fit:contain;margin-bottom:auto}
.cover-logo-placeholder{height:44px;margin-bottom:auto}
.cover-tag{display:inline-flex;align-items:center;gap:6px;background:rgba(37,99,235,.3);border:1px solid rgba(93,156,255,.4);border-radius:999px;padding:4px 12px;font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#93c5fd;margin-bottom:20px;width:fit-content}
.cover-address{font-size:30px;font-weight:900;color:#fff;line-height:1.15;margin-bottom:10px;letter-spacing:-.02em;max-width:440px}
.cover-sub{font-size:12.5px;color:#94a3b8;font-weight:400}
.cover-date-badge{margin-top:auto;display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border-radius:6px;padding:6px 12px;font-size:10px;color:#cbd5e1;font-weight:500;width:fit-content}

.cover-strip{display:flex;background:#0f172a}
.strip-item{flex:1;padding:16px 8px;text-align:center;border-right:1px solid rgba(255,255,255,.06)}
.strip-item:last-child{border-right:none}
.strip-label{font-size:7.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#475569;margin-bottom:5px}
.strip-value{font-size:15px;font-weight:700;color:#f8fafc}
.strip-dpe{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:800}

.cover-bottom{background:#fff;padding:24px 40px 0;flex:1}
.cover-intro-box{background:linear-gradient(135deg,#eff6ff,#f0fdf4);border-radius:12px;padding:20px 24px;border-left:4px solid #2563eb;margin-bottom:16px}
.cover-intro-label{font-size:8.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#2563eb;margin-bottom:8px}
.cover-intro-text{font-size:11.5px;color:#374151;line-height:1.65}

/* ══ SECTION HEADERS ══ */
.sh{display:flex;align-items:center;gap:10px;margin:22px 0 13px}
.sh-bar{width:3px;border-radius:2px;flex-shrink:0}
.sh-title{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b}

/* ══ PRICE SECTION ══ */
.price-hero{background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:14px;padding:28px 32px;margin-bottom:16px;position:relative;overflow:hidden}
.price-hero::before{content:'';position:absolute;top:-30px;right:-30px;width:150px;height:150px;background:radial-gradient(circle,rgba(37,99,235,.25),transparent 70%);border-radius:50%}
.price-hero-label{font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#60a5fa;margin-bottom:10px}
.price-hero-amount{font-size:48px;font-weight:900;color:#fff;letter-spacing:-.03em;line-height:1;margin-bottom:4px}
.price-hero-pm2{font-size:15px;color:#93c5fd;font-weight:600;margin-bottom:16px}
.price-hero-range{display:flex;gap:20px}
.price-hero-range-item{background:rgba(255,255,255,.08);border-radius:8px;padding:8px 14px;text-align:center}
.price-hero-range-label{font-size:8px;color:#64748b;font-weight:600;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
.price-hero-range-val{font-size:13px;font-weight:700;color:#e2e8f0}

.compare-row{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin-bottom:14px}
.compare-card{border-radius:10px;padding:14px 16px}
.compare-analyst{background:#eff6ff;border:1.5px solid #bfdbfe}
.compare-algo{background:#f0fdf4;border:1.5px solid #bbf7d0}
.compare-badge{font-size:7.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px}
.compare-analyst .compare-badge{color:#2563eb}
.compare-algo .compare-badge{color:#16a34a}
.compare-pm2{font-size:20px;font-weight:800;color:#0f172a;margin-bottom:2px}
.compare-total{font-size:11px;color:#64748b;font-weight:500;margin-bottom:3px}
.compare-sub{font-size:9px;color:#94a3b8}
.compare-vs{font-size:12px;font-weight:800;color:#94a3b8;text-align:center}

/* ══ PRICE BAR ══ */
.pbar-wrap{margin:14px 0 6px}
.pbar-extremes{display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8;margin-bottom:5px}
.pbar-track{height:10px;background:#e2e8f0;border-radius:999px;position:relative}
.pbar-range{position:absolute;top:0;height:100%;background:linear-gradient(90deg,#bfdbfe,#93c5fd);border-radius:999px}
.pbar-tick{position:absolute;top:50%;transform:translateY(-50%);width:4px;height:18px;border-radius:2px}
.pbar-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:9px;color:#475569}
.pbar-legend-item{display:flex;align-items:center;gap:5px}
.pbar-dot{width:8px;height:8px;border-radius:2px}

/* ══ KPI CHIPS ══ */
.kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px}
.kpi{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;text-align:center}
.kpi-label{font-size:8px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px}
.kpi-value{font-size:13px;font-weight:700;color:#0f172a}

/* ══ FEATURES GRID ══ */
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:14px}
.feature-chip{display:flex;align-items:center;gap:6px;padding:7px 10px;border-radius:7px;font-size:10.5px;font-weight:500;background:#f8fafc;border:1px solid #e2e8f0;color:#374151}
.feature-chip.ok{background:#f0fdf4;border-color:#bbf7d0;color:#15803d}
.feature-chip.warn{background:#fef3c7;border-color:#fde68a;color:#92400e}
.feature-chip.bad{background:#fef2f2;border-color:#fecaca;color:#dc2626}

/* ══ TABLE ══ */
table{width:100%;border-collapse:collapse;font-size:10.5px}
thead tr{background:#0f172a}
th{padding:9px 10px;font-weight:600;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;text-align:left}
td{padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#374151;vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:nth-child(even) td{background:#f8fafc}
.td-num{font-weight:700;color:#2563eb;text-align:right;white-space:nowrap}
.td-src{display:inline-flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:5px;font-size:8px;font-weight:700;letter-spacing:.05em;min-width:36px}
.src-dvf{background:#dbeafe;color:#1d4ed8}
.src-sl{background:#fce7f3;color:#be185d}

/* ══ QUARTIER REDESIGN ══ */
.quartier-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
.quartier-stat{background:#fff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px 16px;text-align:center}
.quartier-stat-label{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:6px}
.quartier-stat-value{font-size:22px;font-weight:800;color:#0f172a;line-height:1}
.quartier-stat-sub{font-size:9px;color:#64748b;margin-top:3px}
.quartier-stat.highlight{background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe}
.quartier-stat.highlight .quartier-stat-value{color:#1d4ed8}
.quartier-concordance-box{border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:flex-start;gap:10px;font-size:11px;line-height:1.55}
.concordance-icon{font-size:18px;flex-shrink:0;margin-top:1px}

/* ══ SCORES ══ */
.score-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 20px;margin-bottom:16px}
.score-item{}
.score-header{display:flex;justify-content:space-between;margin-bottom:4px;font-size:9.5px;font-weight:600}
.score-track{height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden}
.score-fill{height:100%;border-radius:999px;transition:width .3s}

/* ══ TREND BARS ══ */
.trend-bars{display:flex;align-items:flex-end;gap:5px;height:68px;padding:0 4px;margin:10px 0 4px}
.trend-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:2px}
.trend-bar-val{font-size:7px;color:#64748b;font-weight:700;white-space:nowrap}
.trend-bar-body{width:100%;border-radius:3px 3px 0 0;min-height:3px}
.trend-bar-lbl{font-size:7.5px;font-weight:700;color:#94a3b8;white-space:nowrap}


/* ══ SYNTHESIS ══ */
.synth-wrap{background:linear-gradient(135deg,#f8fafc,#f0f9ff);border:1px solid #e0f2fe;border-radius:12px;padding:20px 24px}
.synth-para{font-size:11.5px;color:#374151;line-height:1.7;margin-bottom:8px}
.synth-bullets{list-style:none;margin-top:10px;display:flex;flex-direction:column;gap:7px}
.synth-bullet{display:flex;gap:10px;align-items:flex-start;font-size:11.5px;color:#374151;line-height:1.55}
.bullet-dot{width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0;margin-top:4px}

/* ══ STEPS ══ */
.steps-table{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:14px}
.steps-table tr:nth-child(even) td{background:#f8fafc}
.steps-table .step-last td{background:#eff6ff;border-top:1.5px solid #bfdbfe}
.steps-table td{padding:9px 14px;font-size:11px;border-bottom:1px solid #f1f5f9}
.steps-table tr:last-child td{border-bottom:none}
.step-lbl{color:#64748b}
.step-val{font-weight:700;text-align:right}

/* ══ CTA / NEXT STEPS ══ */
.cta-box{background:linear-gradient(135deg,#0f172a,#1e3a5f);border-radius:12px;padding:22px 28px;color:#fff;margin-top:16px}
.cta-title{font-size:14px;font-weight:800;margin-bottom:6px;color:#fff}
.cta-sub{font-size:10.5px;color:#94a3b8;margin-bottom:16px}
.cta-steps{display:flex;gap:10px}
.cta-step{flex:1;background:rgba(255,255,255,.07);border-radius:8px;padding:12px 14px;border:1px solid rgba(255,255,255,.1)}
.cta-step-num{font-size:22px;font-weight:900;color:#3b82f6;line-height:1;margin-bottom:4px}
.cta-step-text{font-size:10px;color:#cbd5e1;line-height:1.4}

/* ══ METH ══ */
.meth-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-size:10px;color:#64748b;line-height:1.65}

/* ══ DELTA ══ */
.delta{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;margin-bottom:14px;font-size:11px}

/* ══ ADJ TABLE ══ */
.adj-table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:14px}
.adj-table th{padding:7px 10px;background:#f8fafc;border:1px solid #e2e8f0;font-size:8.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#64748b;text-align:left}
.adj-table td{padding:6px 10px;border:1px solid #f1f5f9;color:#374151}
.adj-pos{color:#16a34a;font-weight:700}
.adj-neg{color:#dc2626;font-weight:700}

/* ══ CONFIDENTIAL STAMP ══ */
.conf-stamp{position:absolute;bottom:48px;right:32px;opacity:.06;font-size:42px;font-weight:900;color:#0f172a;letter-spacing:-.02em;transform:rotate(-30deg);pointer-events:none;user-select:none;text-transform:uppercase}
</style>
</head>
<body>

<!-- ══════════════════════════════════════════════════════════
     PAGE 1 — COUVERTURE
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div class="cover-hero">
    ${dossier.coverPhoto?.dataUrl ? `<img class="cover-hero-photo" src="${dossier.coverPhoto.dataUrl}" alt=""/>` : ''}
    <div class="cover-hero-overlay"></div>
    <div class="cover-hero-content">
      ${dossier.reportBrandLogo?.dataUrl
        ? `<img class="cover-logo" src="${dossier.reportBrandLogo.dataUrl}" alt=""/>`
        : `<div class="cover-logo-placeholder"></div>`}
      <div class="cover-tag">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#60a5fa"></span>
        Rapport d'estimation immobilière — Confidentiel
      </div>
      <div class="cover-address">${dossier.address || 'Adresse non renseignée'}</div>
      <div class="cover-sub">${typeLabel} · ${surf ? surf + ' m²' : '—'} · ${target.rooms ? target.rooms + ' pièces' : '—'}</div>
      <div class="cover-date-badge">
        <span style="color:#60a5fa">📅</span>
        Préparé le ${dateStr}
      </div>
    </div>
  </div>

  <div class="cover-strip">
    <div class="strip-item"><div class="strip-label">Type</div><div class="strip-value">${typeLabel}</div></div>
    <div class="strip-item"><div class="strip-label">Surface</div><div class="strip-value">${surf ? surf + ' m²' : '—'}</div></div>
    <div class="strip-item"><div class="strip-label">Pièces</div><div class="strip-value">${target.rooms || '—'}</div></div>
    <div class="strip-item"><div class="strip-label">DPE</div><div class="strip-value"><span class="strip-dpe" style="color:#fff;background:${dpeColor(target.dpe)}">${target.dpe || '—'}</span></div></div>
    <div class="strip-item"><div class="strip-label">Références</div><div class="strip-value">${metrics?.n ?? '—'}</div></div>
  </div>

  <div class="cover-bottom">
    <div class="cover-intro-box">
      <div class="cover-intro-label">Objet du rapport</div>
      <div class="cover-intro-text">
        Suite à notre analyse approfondie du bien situé au <strong>${dossier.address || '—'}</strong>,
        nous avons procédé à une évaluation rigoureuse s'appuyant sur ${metrics?.n ?? 0} transactions
        comparables issues des bases de données officielles (DVF) et du marché actuel (SeLoger),
        complétées par une analyse fine des caractéristiques intrinsèques du bien et du contexte de son quartier.
        ${dossier.propertyDescription ? `<br/><br/><em style="color:#64748b">"${dossier.propertyDescription}"</em>` : ''}
      </div>
    </div>
  </div>

  <div class="conf-stamp">Confidentiel</div>
  <div class="footer">
    <div class="footer-left">Document préparé par votre conseiller immobilier · Confidentiel</div>
    <div class="footer-right">1 / 4</div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 2 — PRIX & ANALYSE
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div style="padding:28px 32px 0;flex:1">

    <div class="sh" style="margin-top:0"><div class="sh-bar" style="height:20px;background:#2563eb"></div><div class="sh-title">Notre recommandation de prix</div></div>

    ${recoPrice ? `<div class="price-hero">
      <div class="price-hero-label">Prix de vente recommandé</div>
      <div class="price-hero-amount">${fmtK(recoPrice)}</div>
      <div class="price-hero-pm2">soit ${fmt(recoPm2)} €/m²</div>
      <div class="price-hero-range">
        ${estimate?.minPm2 && surf ? `<div class="price-hero-range-item"><div class="price-hero-range-label">Estimation basse</div><div class="price-hero-range-val">${fmtK(estimate.minPm2 * surf)}</div></div>` : ''}
        ${estimate?.maxPm2 && surf ? `<div class="price-hero-range-item"><div class="price-hero-range-label">Estimation haute</div><div class="price-hero-range-val">${fmtK(estimate.maxPm2 * surf)}</div></div>` : ''}
        ${quartierPm2 && surf ? `<div class="price-hero-range-item"><div class="price-hero-range-label">Prix moy. quartier</div><div class="price-hero-range-val">${fmtK(quartierPm2 * surf)}</div></div>` : ''}
      </div>
    </div>` : ''}

    ${barAll.length > 1 ? `<div class="pbar-wrap">
      <div class="pbar-extremes"><span>${fmt(barLo)} €/m²</span><span>${fmt(barHi)} €/m²</span></div>
      <div class="pbar-track">
        ${estimate?.minPm2 ? `<div class="pbar-range" style="left:${barPct(estimate.minPm2)}%;width:${(barPct(estimate.maxPm2 || estimate.minPm2)-barPct(estimate.minPm2)).toFixed(1)}%"></div>` : ''}
        ${quartierPm2 ? `<div class="pbar-tick" style="left:calc(${barPct(quartierPm2)}% - 2px);background:#d97706;opacity:.85"></div>` : ''}
        ${recoPm2 ? `<div class="pbar-tick" style="left:calc(${barPct(recoPm2)}% - 2px);background:#1d4ed8"></div>` : ''}
      </div>
      <div class="pbar-legend">
        ${recoPm2 ? `<div class="pbar-legend-item"><div class="pbar-dot" style="background:#1d4ed8"></div>Prix recommandé : ${fmt(recoPm2)} €/m²</div>` : ''}
        ${estimate?.minPm2 ? `<div class="pbar-legend-item"><div class="pbar-dot" style="background:#bfdbfe"></div>Fourchette : ${fmt(estimate.minPm2)} – ${fmt(estimate.maxPm2)} €/m²</div>` : ''}
        ${quartierPm2 ? `<div class="pbar-legend-item"><div class="pbar-dot" style="background:#d97706"></div>Moy. secteur : ${fmt(quartierPm2)} €/m²</div>` : ''}
      </div>
    </div>` : ''}

    ${pivotPm2 && algoPm2 ? `<div class="compare-row">
      <div class="compare-card compare-analyst">
        <div class="compare-badge">Estimation analyste</div>
        <div class="compare-pm2">${fmt(pivotPm2)} €/m²</div>
        <div class="compare-total">${pivotPm2 && surf ? fmtK(pivotPm2 * surf) : ''}</div>
        <div class="compare-sub">Basée sur l'expertise terrain</div>
      </div>
      <div class="compare-vs">VS</div>
      <div class="compare-card compare-algo">
        <div class="compare-badge">Modèle statistique</div>
        <div class="compare-pm2">${fmt(algoPm2)} €/m²</div>
        <div class="compare-total">${algoPm2 && surf ? fmtK(algoPm2 * surf) : ''}</div>
        <div class="compare-sub">${stars(estimate?.confidence?.stars)} ${estimate?.confidence?.label || ''} · ${estimate?.nComps || 0} comparables</div>
      </div>
    </div>
    ${delta != null ? `<div class="delta" style="background:${Math.abs(delta)<=5?'#f0fdf4':Math.abs(delta)<=12?'#fffbeb':'#fef2f2'};border:1px solid ${Math.abs(delta)<=5?'#86efac':Math.abs(delta)<=12?'#fcd34d':'#fca5a5'}">
      <strong style="color:${deltaColor(delta)};font-size:15px">${delta>0?'+':''}${delta.toFixed(1)}%</strong>
      <span style="color:#475569">${Math.abs(delta)<=5?'Excellente convergence entre l\'analyse terrain et le modèle statistique — estimation très fiable.':Math.abs(delta)<=12?'Légère divergence — l\'expertise terrain de l\'analyste tient compte d\'éléments non capturables par le modèle.':'Écart marqué — justifié par des spécificités du bien ou du marché local que le modèle ne peut pas appréhender seul.'}</span>
    </div>` : ''}` : ''}

    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Références analysées</div><div class="kpi-value">${metrics?.n ?? '—'}</div></div>
      <div class="kpi"><div class="kpi-label">DVF (transactions)</div><div class="kpi-value">${metrics?.nDvf ?? '—'}</div></div>
      <div class="kpi"><div class="kpi-label">SeLoger (annonces)</div><div class="kpi-value">${metrics?.nSl ?? '—'}</div></div>
      <div class="kpi"><div class="kpi-label">Indice de confiance</div><div class="kpi-value">${estimate?.confidence?.score ?? '—'}/100</div></div>
    </div>

    ${analystAdjustments?.length > 0 ? `
    <div class="sh"><div class="sh-bar" style="height:18px;background:#7c3aed"></div><div class="sh-title">Pondérations appliquées par l'analyste</div></div>
    <table class="adj-table">
      <thead><tr><th>Critère</th><th>Pondération</th><th>Impact estimé sur le prix</th></tr></thead>
      <tbody>
        ${analystAdjustments.map(adj => {
          const sign = adj.pct > 0 ? '+' : '';
          const base = dossier.analystBasePm2 || metrics?.avgWeighted || 0;
          const impact = base ? `${sign}${fmt(base * adj.pct / 100)} €/m²` : '—';
          return `<tr><td>${adjKeyMap[adj.key] || adj.key}</td><td class="${adj.pct>0?'adj-pos':'adj-neg'}">${sign}${adj.pct}%</td><td>${impact}</td></tr>`;
        }).join('')}
      </tbody>
    </table>` : ''}

  </div>
  <div class="footer">
    <div class="footer-left">Rapport d'estimation — ${dossier.address || ''}</div>
    <div class="footer-right">2 / 4</div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 3 — LE BIEN + MARCHÉ
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div style="padding:28px 32px 0;flex:1">

    <div class="sh" style="margin-top:0"><div class="sh-bar" style="height:18px;background:#2563eb"></div><div class="sh-title">Caractéristiques du bien</div></div>
    ${features.length > 0 ? `<div class="features-grid">
      ${features.map(f => {
        const cls = f.startsWith('✓') ? 'ok' : f.startsWith('✗') ? 'bad' : f.startsWith('~') ? 'warn' : '';
        return `<div class="feature-chip ${cls}">${f}</div>`;
      }).join('')}
    </div>` : ''}

    <div class="sh"><div class="sh-bar" style="height:18px;background:#2563eb"></div><div class="sh-title">Références de marché utilisées (${filteredRefs.length})</div></div>
    <table>
      <thead><tr><th>#</th><th>Source</th><th>Adresse</th><th>Surface</th><th>Date</th><th style="text-align:right">Prix /m²</th></tr></thead>
      <tbody>
        ${filteredRefs.slice(0, 12).map((ref, i) => `<tr>
          <td style="color:#94a3b8;font-weight:600;font-size:10px">${i+1}</td>
          <td><span class="td-src ${ref.source==='dvf'?'src-dvf':'src-sl'}">${ref.source?.toUpperCase()}</span></td>
          <td style="max-width:150px;font-size:10px">${(ref.address||'N/D').substring(0,42)}</td>
          <td style="font-size:10px;color:#64748b">${ref.area?ref.area+' m²':'—'}</td>
          <td style="font-size:10px;color:#94a3b8">${ref.date?new Date(ref.date).toLocaleDateString('fr-FR',{month:'2-digit',year:'numeric'}):'—'}</td>
          <td class="td-num">${ref.ppm2?fmt(ref.ppm2)+' €/m²':'—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>

    ${trendAll.length > 0 ? `
    <div class="sh" style="margin-top:16px"><div class="sh-bar" style="height:18px;background:#059669"></div><div class="sh-title">Évolution annuelle des prix — Transactions DVF</div></div>
    <div class="trend-bars">
      ${(trend?.series||[]).slice(-6).map(p => {
        const h = Math.max(4, ((p.ppm2-trendMin)/(trendMax-trendMin))*56);
        return `<div class="trend-bar-col">
          <div class="trend-bar-val">${Math.round(p.ppm2/100)*100}</div>
          <div class="trend-bar-body" style="height:${h}px;background:linear-gradient(180deg,#0f766e,#134e4a)"></div>
          <div class="trend-bar-lbl">${p.label}</div>
        </div>`;
      }).join('')}
      ${(trend?.forecast||[]).map(p => {
        const h = Math.max(4, ((p.ppm2-trendMin)/(trendMax-trendMin))*56);
        return `<div class="trend-bar-col">
          <div class="trend-bar-val" style="color:#94a3b8">${Math.round(p.ppm2/100)*100}</div>
          <div class="trend-bar-body" style="height:${h}px;background:#e2e8f0;border:1.5px dashed #94a3b8;box-sizing:border-box"></div>
          <div class="trend-bar-lbl">${p.label}*</div>
        </div>`;
      }).join('')}
    </div>
    <div style="font-size:8.5px;color:#94a3b8">* Projection — indicatif · Médiane des transactions DVF dans le secteur</div>` : ''}

  </div>
  <div class="footer">
    <div class="footer-left">Rapport d'estimation — ${dossier.address || ''}</div>
    <div class="footer-right">3 / 4</div>
  </div>
</div>

<!-- ══════════════════════════════════════════════════════════
     PAGE 4 — QUARTIER + SYNTHÈSE + SUITE
═══════════════════════════════════════════════════════════════ -->
<div class="page">
  <div style="padding:28px 32px 0;flex:1">

    <div class="sh" style="margin-top:0"><div class="sh-bar" style="height:18px;background:#d97706"></div><div class="sh-title">Contexte du quartier</div></div>

    ${quartierPm2 ? `<div class="quartier-stats">
      <div class="quartier-stat highlight">
        <div class="quartier-stat-label">Prix moyen du secteur</div>
        <div class="quartier-stat-value">${fmt(quartierPm2)}</div>
        <div class="quartier-stat-sub">€/m² · fourchette ${fmt(quartierPm2*0.85)}–${fmt(quartierPm2*1.15)}</div>
      </div>
      <div class="quartier-stat">
        <div class="quartier-stat-label">Tendance annuelle</div>
        <div class="quartier-stat-value" style="color:${quartierTrend!=null?(quartierTrend>=0?'#15803d':'#dc2626'):'#0f172a'}">${quartierTrend!=null?(quartierTrend>=0?'▲ +':'▼ ')+Math.abs(quartierTrend).toFixed(1)+'%':'—'}</div>
        <div class="quartier-stat-sub">évolution sur 1 an</div>
      </div>
      <div class="quartier-stat">
        <div class="quartier-stat-label">Prix estimé vs secteur</div>
        <div class="quartier-stat-value" style="color:${recoPm2?deltaColor((recoPm2-quartierPm2)/quartierPm2*100):'#0f172a'}">${recoPm2?((recoPm2>quartierPm2?'+':'')+((recoPm2-quartierPm2)/quartierPm2*100).toFixed(1)+'%'):'—'}</div>
        <div class="quartier-stat-sub">${recoPm2?fmt(recoPm2)+' €/m² recommandé':''}</div>
      </div>
    </div>` : ''}

    ${convergenceTxt ? `<div class="quartier-concordance-box" style="background:${convergenceTxt.startsWith('✓')?'#f0fdf4':convergenceTxt.startsWith('⚠')?'#fef3c7':'#eff6ff'};border:1.5px solid ${convergenceTxt.startsWith('✓')?'#86efac':convergenceTxt.startsWith('⚠')?'#fcd34d':'#bfdbfe'}">
      <div class="concordance-icon">${convergenceTxt.startsWith('✓')?'✅':convergenceTxt.startsWith('⚠')?'⚠️':'ℹ️'}</div>
      <div style="color:${convergenceTxt.startsWith('✓')?'#15803d':convergenceTxt.startsWith('⚠')?'#92400e':'#1d4ed8'}">${convergenceTxt.replace(/^[✓⚠]\s*/,'')}</div>
    </div>` : ''}

    ${scoreItems.length > 0 ? `<div class="score-grid">
      ${scoreItems.map(([label, score]) => `<div class="score-item">
        <div class="score-header">
          <span style="color:#475569">${label}</span>
          <span style="color:${scoreColor(score)};font-weight:800;font-size:11px">${score}<span style="font-size:8px;font-weight:500;color:#94a3b8">/100</span></span>
        </div>
        <div class="score-track"><div class="score-fill" style="width:${score}%;background:${scoreColor(score)}"></div></div>
      </div>`).join('')}
    </div>` : ''}

    <div class="sh"><div class="sh-bar" style="height:18px;background:#2563eb"></div><div class="sh-title">Synthèse et avis expert</div></div>

    ${synParas.length>0||synBullets.length>0 ? `<div class="synth-wrap">
      ${synParas.map(p=>`<p class="synth-para">${p}</p>`).join('')}
      ${synBullets.length>0?`<ul class="synth-bullets">
        ${synBullets.map(b=>`<li class="synth-bullet"><div class="bullet-dot"></div><span>${b}</span></li>`).join('')}
      </ul>`:''}
    </div>` : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;color:#94a3b8;font-style:italic;font-size:11px">Synthèse non renseignée — ajoutez vos notes dans l'onglet Analyste.</div>`}

    <div class="sh" style="margin-top:16px"><div class="sh-bar" style="height:18px;background:#059669"></div><div class="sh-title">Construction du prix — étape par étape</div></div>
    <table class="steps-table">
      <tbody>
        ${[
          ['Médiane des transactions comparables', estimate?.basePm2 ? fmt(estimate.basePm2)+' €/m²' : null],
          ['Après ajustement surface ('+surf+' m²)', estimate?.afterSurfPm2 ? fmt(estimate.afterSurfPm2)+' €/m²' : null],
          ['Après caractéristiques du bien', estimate?.afterCharPm2 ? fmt(estimate.afterCharPm2)+' €/m²' : null],
          ['Prix algorithmique final', algoPm2 ? fmt(algoPm2)+' €/m²' : null],
          ['Prix recommandé (analyste)', recoPm2 ? fmt(recoPm2)+' €/m²' : null],
        ].filter(([,v])=>v).map(([lbl,val],i,arr)=>{
          const last = i===arr.length-1;
          return `<tr class="${last?'step-last':''}"><td class="step-lbl">${lbl}</td><td class="step-val" style="color:${last?'#1d4ed8':'#0f172a'}">${val}</td></tr>`;
        }).join('')}
      </tbody>
    </table>

    <div class="cta-box">
      <div class="cta-title">Quelle est la suite ?</div>
      <div class="cta-sub">Nous restons à votre disposition pour répondre à toutes vos questions et vous accompagner dans votre projet.</div>
      <div class="cta-steps">
        <div class="cta-step"><div class="cta-step-num">01</div><div class="cta-step-text">Valider le prix de mise en vente avec votre conseiller</div></div>
        <div class="cta-step"><div class="cta-step-num">02</div><div class="cta-step-text">Signer le mandat de vente exclusif</div></div>
        <div class="cta-step"><div class="cta-step-num">03</div><div class="cta-step-text">Mise en marché et accompagnement jusqu'à la vente</div></div>
      </div>
    </div>

  </div>
  <div class="footer">
    <div class="footer-left">Sources : DVF (données officielles) · SeLoger · Analyse Estimia — Ce rapport ne constitue pas une expertise judiciaire</div>
    <div class="footer-right">4 / 4</div>
  </div>
</div>

</body>
</html>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/generate', async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
  const { dossier, estimate, metrics, filteredRefs = [], areaScores = {}, analystAdjustments = [], syntheseNotes = '', trend = {} } = req.body;

  let aiSynthesis = null;
  if (syntheseNotes?.trim() && ANTHROPIC_API_KEY) {
    try {
      const target = dossier?.target || {};
      const ctx = [
        `Bien : ${target.type==='House'?'Maison':'Appartement'} ${target.surfaceM2}m² ${target.rooms}P — ${dossier.address}`,
        `État : ${target.condition||'—'} · DPE ${target.dpe||'—'}`,
        `Prix analyste : ${dossier.manualEstimate?fmt(dossier.manualEstimate)+' €/m²':'—'} · Algo : ${estimate?.correctedPm2?fmt(estimate.correctedPm2)+' €/m²':'—'}`,
        `Marché : ${metrics?.n??0} refs · moy ${metrics?.avgWeighted?fmt(metrics.avgWeighted):'—'} €/m²`,
      ].join('\n');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 900,
          system: `Tu es un expert immobilier rédigeant un rapport client professionnel en France.
Améliore les notes en une synthèse claire et valorisante pour le propriétaire.
Commence par 1 ou 2 phrases de synthèse globale, puis liste les points clés avec "• " (bullet).
Sois précis, professionnel, rassurant. Français impeccable.
RÈGLES STRICTES : N'utilise JAMAIS de titres (#, ##), JAMAIS de gras (**), JAMAIS de tableaux markdown (|), JAMAIS de lignes "--". Texte brut uniquement.`,
          messages: [{ role: 'user', content: `Contexte :\n${ctx}\n\nNotes :\n${syntheseNotes}` }],
        }),
      });
      const d = await r.json();
      aiSynthesis = d.content?.[0]?.text || null;
    } catch (e) { console.error('Claude:', e.message); }
  }

  const html = buildHtml({ dossier, estimate, metrics, filteredRefs, areaScores, analystAdjustments, syntheseNotes, aiSynthesis, trend });

  let puppeteer;
  try { puppeteer = require('puppeteer-core'); }
  catch { return res.status(500).json({ error: 'puppeteer-core manquant.' }); }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-web-security'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4', printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    await browser.close();
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="estimia_rapport.pdf"', 'Content-Length': pdf.length });
    res.send(Buffer.from(pdf));
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('Puppeteer:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
