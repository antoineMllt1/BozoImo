import { useState, useMemo, useCallback, useEffect } from 'react';
import { normalizeRefs, applyFilters, computeMetrics, suggestRange, computePrixPivot } from '../utils/edm';
import { fmtPm2, fmtDate } from '../utils/formatters';

const TYPES   = ['T1','T2','T3','T4','T5'];
const DPELIST = ['A','B','C','D','E','F','G'];
const DEFAULT_FILTERS = {
  ppm2Min: null, ppm2Max: null,
  types: [], sources: ['dvf','seloger'],
  areaMin: null, areaMax: null,
  dpe: [],
};
const DEFAULT_TEMPORAL = { enabled: false, w0_6: 1.2, w6_12: 1.0, w12_24: 0.8, w24plus: 0.6 };

function Histogram({ refs, ppm2Min, ppm2Max }) {
  const vals = refs.map(r => r.ppm2).filter(v => v != null);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const BINS = 20, W = 300, H = 44;
  const bw = (hi - lo) / BINS || 1;
  const counts = Array(BINS).fill(0);
  vals.forEach(v => { counts[Math.min(Math.floor((v - lo) / bw), BINS - 1)]++; });
  const maxC = Math.max(...counts, 1);
  const pw = W / BINS;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:'block', borderRadius:4 }}>
      {counts.map((c, i) => {
        const bMin = lo + i * bw, bMax = bMin + bw;
        const inRange = (ppm2Min == null || bMax >= ppm2Min) && (ppm2Max == null || bMin <= ppm2Max);
        const barH = (c / maxC) * (H - 2);
        return <rect key={i} x={i * pw + 1} y={H - barH} width={pw - 2} height={barH}
          fill={inRange ? 'var(--accent)' : '#e2e8f0'} rx="1" />;
      })}
      {ppm2Min != null && <line x1={(ppm2Min-lo)/(hi-lo)*W} y1="0" x2={(ppm2Min-lo)/(hi-lo)*W} y2={H} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3,2" />}
      {ppm2Max != null && <line x1={(ppm2Max-lo)/(hi-lo)*W} y1="0" x2={(ppm2Max-lo)/(hi-lo)*W} y2={H} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3,2" />}
    </svg>
  );
}

export default function EdmView({ dossier, tauxNego = 0.05, onPivotChange }) {
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);
  const [temporal,    setTemporal]    = useState(DEFAULT_TEMPORAL);
  const [exclusions,  setExclusions]  = useState({});
  const [sortCol,     setSortCol]     = useState('ppm2');
  const [sortDir,     setSortDir]     = useState('asc');
  const [typoW,       setTypoW]       = useState({ T1:0, T2:0, T3:1, T4:0, T5:0 });
  const [localTaux,   setLocalTaux]   = useState(tauxNego * 100);
  const [showAll,     setShowAll]     = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refsOpen,    setRefsOpen]    = useState(false);
  const [iqrApplied,  setIqrApplied]  = useState(false);

  const effectiveTaux = localTaux / 100;

  const allRefs = useMemo(() => {
    const refs = normalizeRefs(dossier.dvfSnapshot, dossier.selogerSnapshot, effectiveTaux);
    return refs.map(r => ({ ...r, excluded: exclusions[r.id] || false }));
  }, [dossier.dvfSnapshot, dossier.selogerSnapshot, effectiveTaux, exclusions]);

  const suggested  = useMemo(() => suggestRange(allRefs.filter(r => !r.excluded)), [allRefs]);
  const filtered   = useMemo(() => applyFilters(allRefs, filters), [allRefs, filters]);
  const metrics    = useMemo(
    () => computeMetrics(allRefs, filtered, filters, effectiveTaux, temporal.enabled ? temporal : null),
    [allRefs, filtered, filters, effectiveTaux, temporal]
  );
  const prixPivot  = useMemo(() => metrics ? computePrixPivot(metrics.byType, typoW) : null, [metrics, typoW]);

  // Auto-apply IQR on first load
  useEffect(() => {
    if (!iqrApplied && suggested) {
      setFilters(p => ({ ...p, ppm2Min: suggested.min, ppm2Max: suggested.max }));
      setIqrApplied(true);
    }
  }, [suggested, iqrApplied]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = a[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    const vb = b[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  }), [filtered, sortCol, sortDir]);

  // Prix Pivot formula display
  const pivotParts = TYPES.filter(t => typoW[t] > 0 && metrics?.byType[t]);
  const totalLots  = TYPES.reduce((s, t) => s + (typoW[t] || 0), 0);
  const formulaStr = pivotParts.length > 0
    ? pivotParts.map(t => `${typoW[t]} × ${Math.round(metrics.byType[t].avgWeighted).toLocaleString('fr-FR')}`).join(' + ')
    : null;

  const sf = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const toggleChip = (key, val) => setFilters(p => ({
    ...p, [key]: p[key].includes(val) ? p[key].filter(x => x !== val) : [...p[key], val]
  }));
  const sortBy = col => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc'); } };
  const toggleExclude = useCallback(id => setExclusions(p => ({ ...p, [id]: !p[id] })), []);

  const nDvf = allRefs.filter(r => r.source === 'dvf').length;
  const nSl  = allRefs.filter(r => r.source === 'seloger').length;
  const activeFilters = [
    filters.ppm2Min != null || filters.ppm2Max != null,
    filters.types.length > 0,
    filters.areaMin != null || filters.areaMax != null,
    filters.dpe.length > 0,
  ].filter(Boolean).length;

  const rowClass = r => {
    if (r.excluded) return 'ref-excluded';
    if (r.ppm2 == null) return '';
    if (filters.ppm2Min != null && r.ppm2 < filters.ppm2Min) return 'ref-low';
    if (filters.ppm2Max != null && r.ppm2 > filters.ppm2Max) return 'ref-high';
    return 'ref-in';
  };

  const Th = ({ col, label }) => (
    <th className="th-sort" onClick={() => sortBy(col)}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="edm-layout">

      {/* ── Barre de synthèse ── */}
      <div className="edm-summary-bar">
        <div className="esb-left">
          <span className="esb-count">{metrics?.n ?? 0}</span>
          <span className="esb-label">références utilisées</span>
          {(filters.ppm2Min != null || filters.ppm2Max != null) && (
            <span className="esb-range">
              · fourchette {filters.ppm2Min?.toLocaleString('fr-FR')} – {filters.ppm2Max?.toLocaleString('fr-FR')} €/m²
              <span className="esb-pct"> ({metrics?.pctCovered ?? 0}% du marché)</span>
            </span>
          )}
        </div>
        <div className="esb-metrics">
          {metrics?.avgWeighted && (
            <div className="esb-kpi">
              <span className="esb-kpi-val">{fmtPm2(metrics.avgWeighted)}</span>
              <span className="esb-kpi-lbl">prix moyen</span>
            </div>
          )}
          {metrics?.stdDev > 0 && (
            <div className="esb-kpi">
              <span className="esb-kpi-val">± {fmtPm2(metrics.stdDev)}</span>
              <span className="esb-kpi-lbl">écart-type</span>
            </div>
          )}
        </div>
        <button className={`edm-filter-toggle ${filtersOpen ? 'on' : ''}`} onClick={() => setFiltersOpen(p => !p)}>
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm2 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd"/>
          </svg>
          Affiner les références
          {activeFilters > 0 && <span className="edm-filter-badge">{activeFilters}</span>}
        </button>
      </div>

      {/* ── Panneau filtres ── */}
      {filtersOpen && (
        <div className="edm-filter-panel">
          <div className="efp-intro">
            <strong>Affiner les références de marché</strong> — Seules les références dans la fourchette sont utilisées pour calculer les prix par typologie ci-dessous. Les barres grises sont exclues du calcul.
          </div>
          <div className="efp-blocks">
            {/* Fourchette */}
            <div className="efp-block">
              <div className="efp-label">Fourchette €/m²
                <span className="efp-hint">Exclure les valeurs aberrantes</span>
              </div>
              <div className="efp-histo"><Histogram refs={allRefs.filter(r => !r.excluded)} ppm2Min={filters.ppm2Min} ppm2Max={filters.ppm2Max} /></div>
              {suggested && (
                <button className="ef-suggest-btn" onClick={() => setFilters(p => ({ ...p, ppm2Min: suggested.min, ppm2Max: suggested.max }))}>
                  ↺ Suggestion automatique : {suggested.min.toLocaleString('fr-FR')} – {suggested.max.toLocaleString('fr-FR')} €/m² ({suggested.pct}% couvert)
                </button>
              )}
              <div className="ef-range-row">
                <input type="number" placeholder="Min" className="ef-input" value={filters.ppm2Min ?? ''} onChange={e => sf('ppm2Min', e.target.value ? +e.target.value : null)} />
                <span>—</span>
                <input type="number" placeholder="Max" className="ef-input" value={filters.ppm2Max ?? ''} onChange={e => sf('ppm2Max', e.target.value ? +e.target.value : null)} />
              </div>
            </div>
            {/* Source */}
            <div className="efp-block">
              <div className="efp-label">Source</div>
              <div className="ef-chips">
                {[['dvf','📊 DVF',nDvf,'Transactions notariées'],['seloger','🏘️ SeLoger',nSl,'Offres actives (prix négo.)']].map(([s,lbl,n,hint]) => (
                  <div key={s} style={{display:'flex',flexDirection:'column',gap:2}}>
                    <button className={`ef-chip ${filters.sources.includes(s) ? 'on' : ''}`} onClick={() => toggleChip('sources', s)}>
                      {lbl} <span className="ef-chip-n">({n})</span>
                    </button>
                    <span style={{fontSize:'.625rem',color:'var(--text-3)'}}>{hint}</span>
                  </div>
                ))}
              </div>
              {filters.sources.includes('seloger') && (
                <div className="efp-taux">
                  <span>Taux de négociation annonces :</span>
                  <input type="number" min="0" max="20" step="0.5" className="ef-input ef-input-sm"
                    value={localTaux} onChange={e => setLocalTaux(+e.target.value)} />
                  <span>%</span>
                  <span className="efp-hint">Les prix SeLoger sont réduits de ce % avant calcul</span>
                </div>
              )}
            </div>
            {/* Typologies */}
            <div className="efp-block">
              <div className="efp-label">Typologies <span className="efp-hint">Tout inclure si vide</span></div>
              <div className="ef-chips">
                {TYPES.map(t => (
                  <button key={t} className={`ef-chip ${filters.types.includes(t) ? 'on' : ''}`} onClick={() => toggleChip('types', t)}>
                    {t}{metrics?.byType[t] ? <span className="ef-chip-n"> ({metrics.byType[t].n})</span> : ''}
                  </button>
                ))}
              </div>
            </div>
            {/* Surface */}
            <div className="efp-block">
              <div className="efp-label">Surface m² <span className="efp-hint">Filtrer par taille</span></div>
              <div className="ef-range-row">
                <input type="number" placeholder="Min" className="ef-input" value={filters.areaMin ?? ''} onChange={e => sf('areaMin', e.target.value ? +e.target.value : null)} />
                <span>—</span>
                <input type="number" placeholder="Max" className="ef-input" value={filters.areaMax ?? ''} onChange={e => sf('areaMax', e.target.value ? +e.target.value : null)} />
              </div>
            </div>
            {/* Pondération temporelle */}
            <div className="efp-block">
              <div className="efp-label">Pondération temporelle
                <label className="ef-toggle" style={{marginLeft:8}}>
                  <input type="checkbox" checked={temporal.enabled} onChange={e => setTemporal(p => ({ ...p, enabled: e.target.checked }))} />
                  <span className="ef-tog-track"><span className="ef-tog-thumb" /></span>
                </label>
              </div>
              <div className="efp-hint" style={{marginBottom:6}}>
                Donne plus de poids aux transactions récentes dans le calcul de la moyenne
              </div>
              {temporal.enabled && (
                <div className="efp-temporal">
                  {[['w0_6','< 6 mois'],['w6_12','6–12 mois'],['w12_24','12–24 mois'],['w24plus','> 24 mois']].map(([k,lbl]) => (
                    <div key={k} className="efp-temp-row">
                      <span>{lbl}</span>
                      <input type="number" step="0.1" min="0" max="2" className="ef-input ef-input-sm"
                        value={temporal[k]} onChange={e => setTemporal(p => ({ ...p, [k]: +e.target.value }))} />
                      <span>× (poids relatif)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="efp-footer">
            <button className="efp-reset" onClick={() => { setFilters(DEFAULT_FILTERS); setIqrApplied(false); }}>Réinitialiser les filtres</button>
          </div>
        </div>
      )}

      {/* ── Prix Pivot ── */}
      <div className="edm-pivot-card-v2">
        <div className="epc2-header">
          <div className="epc2-title">Calcul du Prix Pivot</div>
          <div className="epc2-desc">
            Indiquez combien de lots de chaque type comporte votre immeuble.
            Le Prix Pivot est la <strong>moyenne pondérée</strong> des prix de marché par typologie.
          </div>
        </div>

        <div className="epc2-table">
          <div className="epc2-thead">
            <span>Type</span>
            <span>Prix moyen de marché<span className="epc2-src">({metrics?.n ?? 0} réf. filtrées)</span></span>
            <span>Nb de lots dans l'immeuble</span>
          </div>
          {TYPES.map(t => {
            const d = metrics?.byType[t];
            return (
              <div key={t} className={`epc2-row ${!d ? 'epc2-row-na' : ''}`}>
                <span className="epc2-type">{t}</span>
                <div className="epc2-price">
                  {d
                    ? <><strong>{fmtPm2(d.avgWeighted)}</strong><span className="epc2-n">{d.n} références</span></>
                    : <span className="epc2-none">Pas de données sur ce secteur</span>
                  }
                </div>
                <div className="epc2-input">
                  <input type="number" min="0" max="999" step="1"
                    className={`epc2-lots-input ${typoW[t] > 0 ? 'has-val' : ''}`}
                    value={typoW[t]} disabled={!d}
                    onChange={e => setTypoW(p => ({ ...p, [t]: Math.max(0, +e.target.value) }))}
                  />
                  <span className="epc2-lots-unit">lots</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="epc2-result">
          {formulaStr && totalLots > 0 ? (
            <div className="epc2-formula">
              <span className="epc2-formula-text">
                ({formulaStr}) ÷ {totalLots} lot{totalLots > 1 ? 's' : ''} =
              </span>
              <span className="epc2-pivot-val">{fmtPm2(prixPivot)}</span>
            </div>
          ) : (
            <div className="epc2-formula epc2-formula-empty">
              Saisissez le nombre de lots par type pour calculer le Prix Pivot
            </div>
          )}
          {prixPivot && onPivotChange && (
            <button className="epc2-send-btn" onClick={() => onPivotChange(prixPivot)}>
              Utiliser ce Prix Pivot dans la Grille de prix →
            </button>
          )}
        </div>
      </div>

      {/* ── Références (détail) ── */}
      <div className="edm-refs-section">
        <button className="edm-refs-toggle" onClick={() => setRefsOpen(p => !p)}>
          <span>Voir les références de marché utilisées</span>
          <span className="edm-refs-meta">
            {metrics?.nDvf ?? 0} DVF · {metrics?.nSl ?? 0} SeLoger · triées par €/m²
          </span>
          <span className="edm-refs-arrow">{refsOpen ? '▲ Masquer' : '▼ Afficher'}</span>
        </button>

        {refsOpen && (
          <div className="edm-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <Th col="source" label="Source" />
                  <th>Adresse</th>
                  <Th col="date"  label="Date" />
                  <Th col="type"  label="Type" />
                  <Th col="area"  label="m²" />
                  <Th col="floor" label="Ét." />
                  <Th col="dpe"   label="DPE" />
                  <Th col="price" label="Prix €" />
                  <Th col="ppm2"  label="€/m²" />
                  <th title="Cocher pour exclure de l'analyse">Excl.</th>
                </tr>
              </thead>
              <tbody>
                {(showAll ? sorted : sorted.slice(0, 15)).map(r => {
                  const rc = rowClass(r);
                  return (
                    <tr key={r.id} className={rc}>
                      <td><span className={`src-badge src-${r.source}`}>{r.source === 'dvf' ? 'DVF' : 'SL'}</span></td>
                      <td className="td-addr">
                        {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.address || '—'}</a> : r.address || '—'}
                      </td>
                      <td className="td-date">{r.date ? fmtDate(r.date) : '—'}</td>
                      <td className="td-c">{r.type ?? '—'}</td>
                      <td className="td-c">{r.area ?? '—'}</td>
                      <td className="td-c">{r.floor ?? '—'}</td>
                      <td className="td-c">{r.dpe ?? '—'}</td>
                      <td className="td-price">{r.price != null ? r.price.toLocaleString('fr-FR') + ' €' : '—'}</td>
                      <td className={`td-ppm ${rc === 'ref-low' ? 'ppm-low' : rc === 'ref-high' ? 'ppm-high' : ''}`}>
                        {r.ppm2 != null ? r.ppm2.toLocaleString('fr-FR') : '—'}
                      </td>
                      <td><input type="checkbox" checked={!!r.excluded} onChange={() => toggleExclude(r.id)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sorted.length > 15 && (
              <button className="edm-show-more" onClick={() => setShowAll(p => !p)}>
                {showAll ? '▲ Réduire' : `▼ Voir les ${sorted.length} références`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
