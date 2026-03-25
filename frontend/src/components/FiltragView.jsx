import { useState, useMemo, useCallback } from 'react';
import { fmtPm2, fmtDate } from '../utils/formatters';

const TYPES   = ['T1','T2','T3','T4','T5'];
const DEFAULT_FILTERS = {
  negotiationRate: 5,
  ppm2Min: null, ppm2Max: null,
  types: [], sources: ['dvf','seloger'],
  areaMin: null, areaMax: null,
  dpe: [],
};
const DEFAULT_TEMPORAL = { enabled: false, w0_6: 1.2, w6_12: 1.0, w12_24: 0.8, w24plus: 0.6 };

/* ── Histogram sub-component ── */
function Histogram({ refs, ppm2Min, ppm2Max }) {
  const vals = refs.map(r => r.ppm2).filter(v => v != null);
  if (vals.length < 2) return null;
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const BINS = 20, W = 300, H = 52;
  const bw = (hi - lo) / BINS || 1;
  const counts = Array(BINS).fill(0);
  vals.forEach(v => { counts[Math.min(Math.floor((v - lo) / bw), BINS - 1)]++; });
  const maxC = Math.max(...counts, 1);
  const pw = W / BINS;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ display:'block', borderRadius:6, background: 'var(--bg-soft)' }}>
      {counts.map((c, i) => {
        const bMin = lo + i * bw, bMax = bMin + bw;
        const inRange = (ppm2Min == null || bMax >= ppm2Min) && (ppm2Max == null || bMin <= ppm2Max);
        const barH = (c / maxC) * (H - 4);
        return <rect key={i} x={i * pw + 1} y={H - barH} width={pw - 2} height={barH}
          fill={inRange ? 'var(--accent)' : 'var(--border-2)'} rx="2" opacity={inRange ? 1 : .5} />;
      })}
      {ppm2Min != null && <line x1={(ppm2Min-lo)/(hi-lo)*W} y1="0" x2={(ppm2Min-lo)/(hi-lo)*W} y2={H} stroke="var(--accent-text)" strokeWidth="2" strokeDasharray="4,2" />}
      {ppm2Max != null && <line x1={(ppm2Max-lo)/(hi-lo)*W} y1="0" x2={(ppm2Max-lo)/(hi-lo)*W} y2={H} stroke="var(--error)" strokeWidth="2" strokeDasharray="4,2" />}
    </svg>
  );
}

/* ── FiltragView ── */
export default function FiltragView({
  allRefs,
  filters,
  onFiltersChange,
  exclusions,
  onExclusionsChange,
  filtered,
  metrics,
  suggested,
  onTemporalChange,
  hoveredRefId = null,
  onHoverRef = null,
}) {
  const [temporal,  setTemporal]  = useState(DEFAULT_TEMPORAL);
  const [sortCol,   setSortCol]   = useState('ppm2');
  const [sortDir,   setSortDir]   = useState('asc');
  const [showAll,   setShowAll]   = useState(false);
  const negotiationRate = filters.negotiationRate ?? 5;

  /* propagate temporal changes to parent */
  const updateTemporal = useCallback((next) => {
    const val = typeof next === 'function' ? next(temporal) : next;
    setTemporal(val);
    onTemporalChange?.(val);
  }, [temporal, onTemporalChange]);

  /* helpers */
  const sf = (k, v) => onFiltersChange({ ...filters, [k]: v });
  const toggleChip = (key, val) => onFiltersChange({
    ...filters,
    [key]: filters[key].includes(val)
      ? filters[key].filter(x => x !== val)
      : [...filters[key], val],
  });
  const sortBy = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };
  const toggleExclude = useCallback(id => {
    onExclusionsChange({ ...exclusions, [id]: !exclusions[id] });
  }, [exclusions, onExclusionsChange]);

  /* counts */
  const nDvf = allRefs.filter(r => r.source === 'dvf').length;
  const nSl  = allRefs.filter(r => r.source === 'seloger').length;

  /* active filters summary */
  const activeFiltersList = useMemo(() => {
    const list = [];
    if (filters.ppm2Min != null || filters.ppm2Max != null)
      list.push(`${filters.ppm2Min?.toLocaleString('fr-FR') ?? '\u2014'} \u2013 ${filters.ppm2Max?.toLocaleString('fr-FR') ?? '\u2014'} \u20ac/m\u00b2`);
    if (filters.types.length > 0)
      list.push(`Types: ${filters.types.join(', ')}`);
    if (filters.areaMin != null || filters.areaMax != null)
      list.push(`Surface: ${filters.areaMin ?? '\u2014'} \u2013 ${filters.areaMax ?? '\u2014'} m\u00b2`);
    if (filters.dpe.length > 0)
      list.push(`DPE: ${filters.dpe.join(', ')}`);
    if (!filters.sources.includes('dvf'))     list.push('DVF masqu\u00e9');
    if (!filters.sources.includes('seloger')) list.push('SeLoger masqu\u00e9');
    return list;
  }, [filters]);

  /* sorted rows */
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = a[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    const vb = b[sortCol] ?? (sortDir === 'asc' ? Infinity : -Infinity);
    return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
  }), [filtered, sortCol, sortDir]);

  const rowClass = r => {
    if (r.excluded) return 'ref-excluded';
    if (r.ppm2 == null) return '';
    if (filters.ppm2Min != null && r.ppm2 < filters.ppm2Min) return 'ref-low';
    if (filters.ppm2Max != null && r.ppm2 > filters.ppm2Max) return 'ref-high';
    return 'ref-in';
  };

  const renderSortHeader = (col, label) => (
    <th className="th-sort" onClick={() => sortBy(col)}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' \u2191' : ' \u2193') : ''}
    </th>
  );

  const ROWS_DEFAULT = 20;

  return (
    <div className="edm-layout">

      {/* ── 1. KPI summary row ── */}
      <div className="edm-kpi-row">
        <div className="edm-kpi-card">
          <div>
            <span className="edm-kpi-val">
              {metrics?.n ?? 0}<span className="edm-kpi-total"> / {allRefs.length}</span>
            </span>
            <span className="edm-kpi-lbl">R&eacute;f&eacute;rences retenues</span>
          </div>
        </div>
        <div className="edm-kpi-card">
          <div>
            <span className="edm-kpi-val">{metrics?.avgWeighted ? fmtPm2(metrics.avgWeighted) : '\u2014'}</span>
            <span className="edm-kpi-lbl">Prix moyen pond&eacute;r&eacute;</span>
          </div>
        </div>
        <div className="edm-kpi-card">
          <div>
            <span className="edm-kpi-val">{metrics?.stdDev > 0 ? `\u00b1 ${fmtPm2(metrics.stdDev)}` : '\u2014'}</span>
            <span className="edm-kpi-lbl">&Eacute;cart-type</span>
          </div>
        </div>
        <div className="edm-kpi-card">
          <div>
            <span className="edm-kpi-val">{nDvf} DVF &middot; {nSl} SL</span>
            <span className="edm-kpi-lbl">Sources de donn&eacute;es</span>
          </div>
        </div>
      </div>

      {/* ── 2. Active filters summary bar ── */}
      {activeFiltersList.length > 0 && (
        <div className="filter-summary">
          <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" style={{ flexShrink: 0 }}>
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm2 4a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm2 4a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span style={{ fontWeight: 600, fontSize: '.75rem' }}>Filtres actifs :</span>
          {activeFiltersList.map((f, i) => (
            <span key={i} className="filter-summary-tag">{f}</span>
          ))}
          <button className="filter-summary-clear" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
            &#10005; R&eacute;initialiser
          </button>
        </div>
      )}

      {/* ── Retained percentage indicator ── */}
      {metrics && (
        <div style={{ fontSize: '.8rem', color: 'var(--text-2)', padding: '4px 0 8px' }}>
          {metrics.pctCovered}% des r&eacute;f&eacute;rences retenues
        </div>
      )}

      {/* ── 3. Filter panel (always visible) ── */}
      <div className="edm-filter-panel" style={{ marginBottom: 24 }}>
        <div className="efp-intro">
          <strong>Param&eacute;trage des r&eacute;f&eacute;rences de march&eacute;</strong> &mdash; Ajustez la fourchette de prix, les sources et typologies pour ne garder que les r&eacute;f&eacute;rences pertinentes.
        </div>
        <div className="efp-blocks">

          {/* Fourchette prix */}
          <div className="efp-block">
            <div className="efp-label">
              Fourchette &euro;/m&sup2;
              <span className="efp-hint">Exclure les valeurs aberrantes</span>
            </div>
            <div className="efp-histo">
              <Histogram refs={allRefs.filter(r => !r.excluded)} ppm2Min={filters.ppm2Min} ppm2Max={filters.ppm2Max} />
            </div>
            {suggested && (
              <button className="ef-suggest-btn"
                onClick={() => onFiltersChange({ ...filters, ppm2Min: suggested.min, ppm2Max: suggested.max })}>
                &#8634; Suggestion IQR : {suggested.min.toLocaleString('fr-FR')} &ndash; {suggested.max.toLocaleString('fr-FR')} &euro;/m&sup2; ({suggested.pct}% couvert)
              </button>
            )}
            <div className="ef-range-row">
              <input type="number" placeholder="Min" className="ef-input"
                value={filters.ppm2Min ?? ''}
                onChange={e => sf('ppm2Min', e.target.value ? +e.target.value : null)} />
              <span>&mdash;</span>
              <input type="number" placeholder="Max" className="ef-input"
                value={filters.ppm2Max ?? ''}
                onChange={e => sf('ppm2Max', e.target.value ? +e.target.value : null)} />
            </div>
          </div>

          {/* Source */}
          <div className="efp-block">
            <div className="efp-label">Source</div>
            <div className="ef-chips">
              {[
                ['dvf',     'DVF',     nDvf, 'Transactions notari\u00e9es'],
                ['seloger', 'SeLoger', nSl,  'Offres actives (n\u00e9go.)'],
              ].map(([s, lbl, n, hint]) => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button className={`ef-chip ${filters.sources.includes(s) ? 'on' : ''}`}
                    onClick={() => toggleChip('sources', s)}>
                    {lbl} <span className="ef-chip-n">({n})</span>
                  </button>
                  <span style={{ fontSize: '.625rem', color: 'var(--text-3)' }}>{hint}</span>
                </div>
              ))}
            </div>
            {filters.sources.includes('seloger') && (
              <div className="efp-taux">
                <span>Taux de n&eacute;gociation :</span>
                <input type="number" min="0" max="20" step="0.5" className="ef-input ef-input-sm"
                  value={negotiationRate}
                  onChange={e => {
                    const next = +e.target.value;
                    sf('negotiationRate', next);
                  }} />
                <span>%</span>
                <span className="efp-hint">Prix SeLoger r&eacute;duits de ce %</span>
              </div>
            )}
          </div>

          {/* Typologies */}
          <div className="efp-block">
            <div className="efp-label">Typologies <span className="efp-hint">Tout inclure si vide</span></div>
            <div className="ef-chips">
              {TYPES.map(t => (
                <button key={t} className={`ef-chip ${filters.types.includes(t) ? 'on' : ''}`}
                  onClick={() => toggleChip('types', t)}>
                  {t}{metrics?.byType[t] ? <span className="ef-chip-n"> ({metrics.byType[t].n})</span> : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Surface */}
          <div className="efp-block">
            <div className="efp-label">Surface m&sup2; <span className="efp-hint">Filtrer par taille</span></div>
            <div className="ef-range-row">
              <input type="number" placeholder="Min" className="ef-input"
                value={filters.areaMin ?? ''}
                onChange={e => sf('areaMin', e.target.value ? +e.target.value : null)} />
              <span>&mdash;</span>
              <input type="number" placeholder="Max" className="ef-input"
                value={filters.areaMax ?? ''}
                onChange={e => sf('areaMax', e.target.value ? +e.target.value : null)} />
            </div>
          </div>

          {/* Pond&eacute;ration temporelle */}
          <div className="efp-block">
            <div className="efp-label">
              Pond&eacute;ration temporelle
              <label className="ef-toggle" style={{ marginLeft: 8 }}>
                <input type="checkbox" checked={temporal.enabled}
                  onChange={e => updateTemporal(p => ({ ...p, enabled: e.target.checked }))} />
                <span className="ef-tog-track"><span className="ef-tog-thumb" /></span>
              </label>
            </div>
            <div className="efp-hint" style={{ marginBottom: 6 }}>
              Donne plus de poids aux transactions r&eacute;centes
            </div>
            {temporal.enabled && (
              <div className="efp-temporal">
                {[['w0_6','< 6 mois'],['w6_12','6\u201312 mois'],['w12_24','12\u201324 mois'],['w24plus','> 24 mois']].map(([k, lbl]) => (
                  <div key={k} className="efp-temp-row">
                    <span>{lbl}</span>
                    <input type="number" step="0.1" min="0" max="2" className="ef-input ef-input-sm"
                      value={temporal[k]}
                      onChange={e => updateTemporal(p => ({ ...p, [k]: +e.target.value }))} />
                    <span>&times;</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        <div className="efp-footer">
          <button className="efp-reset" onClick={() => onFiltersChange(DEFAULT_FILTERS)}>
            R&eacute;initialiser les filtres
          </button>
        </div>
      </div>

      {/* ── 4. Reference table ── */}
      <div className="edm-refs-section">
        <div className="edm-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {renderSortHeader('source', 'Source')}
                <th>Adresse</th>
                {renderSortHeader('date', 'Date')}
                {renderSortHeader('type', 'Type')}
                {renderSortHeader('area', 'm&sup2;')}
                {renderSortHeader('floor', '&Eacute;t.')}
                {renderSortHeader('dpe', 'DPE')}
                {renderSortHeader('price', 'Prix &euro;')}
                {renderSortHeader('ppm2', '&euro;/m&sup2;')}
                <th title="Cocher pour exclure de l'analyse">Excl.</th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? sorted : sorted.slice(0, ROWS_DEFAULT)).map(r => {
                const rc = rowClass(r);
                return (
                  <tr
                    key={r.id}
                    className={`${rc} ${hoveredRefId === r.id ? 'ref-hovered' : ''}`.trim()}
                    onMouseEnter={() => onHoverRef?.(r.id)}
                    onMouseLeave={() => onHoverRef?.(null)}
                  >
                    <td>
                      <span className={`src-badge src-${r.source}`}>
                        {r.source === 'dvf' ? 'DVF' : 'SL'}
                      </span>
                    </td>
                    <td className="td-addr">
                      {r.url
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.address || '\u2014'}</a>
                        : r.address || '\u2014'}
                    </td>
                    <td className="td-date">{r.date ? fmtDate(r.date) : '\u2014'}</td>
                    <td className="td-c">{r.type ?? '\u2014'}</td>
                    <td className="td-c">{r.area ?? '\u2014'}</td>
                    <td className="td-c">{r.floor ?? '\u2014'}</td>
                    <td className="td-c">{r.dpe ?? '\u2014'}</td>
                    <td className="td-price">
                      {r.price != null ? r.price.toLocaleString('fr-FR') + ' \u20ac' : '\u2014'}
                    </td>
                    <td className={`td-ppm ${rc === 'ref-low' ? 'ppm-low' : rc === 'ref-high' ? 'ppm-high' : ''}`}>
                      {r.ppm2 != null ? r.ppm2.toLocaleString('fr-FR') : '\u2014'}
                    </td>
                    <td>
                      <input type="checkbox" checked={!!r.excluded}
                        onChange={() => toggleExclude(r.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sorted.length > ROWS_DEFAULT && (
            <button className="edm-show-more" onClick={() => setShowAll(p => !p)}>
              {showAll ? '\u25b2 R\u00e9duire' : `\u25bc Voir les ${sorted.length} r\u00e9f\u00e9rences`}
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
