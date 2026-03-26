import { useState, useMemo } from 'react';
import { computePrixPivot } from '../utils/edm';
import { fmtPm2 } from '../utils/formatters';
import { computeAreaScores } from '../utils/model';
import NumberInput from './NumberInput';

const TYPES = ['T1', 'T2', 'T3', 'T4', 'T5'];

export default function AnalyseView({
  dossier,
  metrics,
  prixPivot,
  onPivotChange,
  onManualEstimate,
  isBuilding,
  sourceWeights,
  onSourceWeightsChange,
}) {
  const [typoW, setTypoW] = useState({ T1: 0, T2: 0, T3: 1, T4: 0, T5: 0 });
  const [manualValue, setManualValue] = useState('');

  const localPivot = useMemo(
    () => (metrics ? computePrixPivot(metrics.byType, typoW) : null),
    [metrics, typoW]
  );

  const pivotParts = TYPES.filter(type => typoW[type] > 0 && metrics?.byType[type]);
  const totalW = TYPES.reduce((sum, type) => sum + (typoW[type] || 0), 0);
  const formulaStr =
    pivotParts.length > 0
      ? pivotParts
          .map(type => `${typoW[type]}${isBuilding ? '' : '×'} × ${Math.round(metrics.byType[type].avgWeighted).toLocaleString('fr-FR')}`)
          .join(' + ')
      : null;

  const sw = sourceWeights || { dvf: 1, seloger: 1 };
  const areaScores = useMemo(() => computeAreaScores(dossier.areaContext || null), [dossier.areaContext]);

  return (
    <div className="edm-layout">
      {Object.values(areaScores).some(value => value != null && typeof value !== 'object') && (
        <div className="analyse-section">
          <div className="as-header">
            <h3 className="as-title">Scores quartier</h3>
            <span className="as-desc">Calcules a la creation du dossier a partir des transports, ecoles, amenites et risques</span>
          </div>
          <div className="as-body">
            <div className="as-score-grid">
              {areaScores.transportScore != null && (
                <div className="as-score-card">
                  <span className="as-score-kicker">Transport</span>
                  <strong>{areaScores.transportScore}/100</strong>
                </div>
              )}
              {areaScores.walkScore != null && (
                <div className="as-score-card">
                  <span className="as-score-kicker">Walk Score</span>
                  <strong>{areaScores.walkScore}/100</strong>
                </div>
              )}
              {areaScores.educationScore != null && (
                <div className="as-score-card">
                  <span className="as-score-kicker">Ecoles</span>
                  <strong>{areaScores.educationScore}/100</strong>
                </div>
              )}
              {areaScores.environmentScore != null && (
                <div className="as-score-card">
                  <span className="as-score-kicker">Environnement</span>
                  <strong>{areaScores.environmentScore}/100</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="analyse-section">
        <div className="as-header">
          <h3 className="as-title">Ponderation des sources</h3>
          <span className="as-desc">Ajustez l&apos;influence de chaque source dans le calcul des moyennes</span>
        </div>
        <div className="as-body">
          <div className="as-source-grid">
            {[
              { key: 'dvf', label: 'DVF - Transactions notarisees', count: metrics?.nDvf ?? 0, hint: 'Donnees reelles, historiques' },
              { key: 'seloger', label: 'SeLoger - Annonces actives', count: metrics?.nSl ?? 0, hint: 'Prix affiches avant nego' },
            ].map(source => (
              <div key={source.key} className="as-source-card">
                <div className="as-source-info">
                  <span className="as-source-label">{source.label}</span>
                  <span className="as-source-count">{source.count} ref.</span>
                  <span className="as-source-hint">{source.hint}</span>
                </div>
                <div className="as-source-control">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={sw[source.key]}
                    onChange={event => onSourceWeightsChange({ ...sw, [source.key]: +event.target.value })}
                    className="as-slider"
                  />
                  <span className="as-source-val">×{sw[source.key].toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {metrics && Object.keys(metrics.byType).length > 0 && (
        <div className="edm-cross-table">
          <div className="ect-header">
            <h3 className="ect-title">Prix de marche par typologie</h3>
            <span className="ect-sub">
              Base sur {metrics.n} references filtrees - {metrics.nDvf} DVF, {metrics.nSl} SeLoger
              {(sw.dvf !== 1 || sw.seloger !== 1) && (
                <span> · Pondere DVF ×{sw.dvf.toFixed(1)}, SL ×{sw.seloger.toFixed(1)}</span>
              )}
            </span>
          </div>
          <div className="ect-grid">
            <div className="ect-head-row">
              <span>Typologie</span>
              <span>Nb ref.</span>
              <span>Prix moy. pondere</span>
              <span>Prix moy. simple</span>
            </div>
            {TYPES.map(type => {
              const data = metrics.byType[type];
              return (
                <div key={type} className={`ect-row ${!data ? 'ect-row-na' : ''}`}>
                  <span className="ect-type">{type}</span>
                  <span className="ect-n">{data ? data.n : '—'}</span>
                  <span className="ect-val">{data ? fmtPm2(data.avgWeighted) : '—'}</span>
                  <span className="ect-val-light">{data ? fmtPm2(data.avg) : '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="analyse-section">
        <div className="as-header">
          <h3 className="as-title">
            {isBuilding ? 'Calcul du Prix Pivot - Lots par type' : 'Ponderations par typologie'}
          </h3>
          <span className="as-desc">
            {isBuilding
              ? 'Indiquez combien de lots de chaque type comporte votre immeuble.'
              : 'Ajustez le poids de chaque typologie dans le calcul du Prix Pivot.'}
          </span>
        </div>
        <div className="as-body">
          <div className="as-typo-grid">
            {TYPES.map(type => {
              const data = metrics?.byType[type];
              return (
                <div key={type} className={`as-typo-row ${!data ? 'as-typo-na' : ''}`}>
                  <span className="as-typo-type">{type}</span>
                  <span className="as-typo-price">
                    {data ? fmtPm2(data.avgWeighted) : 'Pas de donnees'}
                    {data && <span className="as-typo-n"> ({data.n} ref.)</span>}
                  </span>
                  <div className="as-typo-control">
                    {isBuilding ? (
                      <>
                        <NumberInput
                          label={`Lots ${type}`}
                          min={0}
                          max={999}
                          step={1}
                          size="sm"
                          value={typoW[type]}
                          disabled={!data}
                          onChange={value => setTypoW(current => ({ ...current, [type]: Math.max(0, value ?? 0) }))}
                          suffix="lots"
                        />
                      </>
                    ) : (
                      <>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={typoW[type]}
                          disabled={!data}
                          className="as-slider"
                          onChange={event => setTypoW(current => ({ ...current, [type]: +event.target.value }))}
                        />
                        <span className="as-typo-val">×{typoW[type].toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="as-pivot-result">
            {formulaStr && totalW > 0 ? (
              <div className="as-formula">
                <span className="as-formula-text">
                  ({formulaStr}) ÷ {isBuilding ? `${totalW} lot${totalW > 1 ? 's' : ''}` : totalW.toFixed(1)} =
                </span>
                <span className="as-pivot-val">{fmtPm2(localPivot)}</span>
              </div>
            ) : (
              <div className="as-formula as-formula-empty">
                {isBuilding
                  ? 'Saisissez le nombre de lots par type pour calculer le Prix Pivot'
                  : 'Ajustez au moins une ponderation pour calculer le Prix Pivot'}
              </div>
            )}
            {localPivot && onPivotChange && (
              <button className="as-send-btn" onClick={() => onPivotChange(localPivot)}>
                Utiliser ce Prix Pivot →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="analyse-manual-card">
        <div className="amc-header">
          <h3>Estimation manuelle de l&apos;analyste</h3>
          <span className="amc-desc">Votre evaluation basee sur l&apos;etude de marche</span>
        </div>
        <div className="amc-body">
          <div className="amc-row">
            <span className="amc-label">Prix Pivot calcule</span>
            <span className="amc-value">{prixPivot ? fmtPm2(prixPivot) : '—'}</span>
          </div>
          <div className="amc-override">
            <label>Estimation manuelle (€/m²)</label>
            <input
              type="number"
              min="0"
              step="1"
              placeholder={prixPivot ? String(Math.round(prixPivot)) : '—'}
              value={manualValue}
              onChange={event => setManualValue(event.target.value ? +event.target.value : '')}
            />
          </div>
          <button
            className="amc-validate-btn"
            onClick={() => onManualEstimate && onManualEstimate(manualValue || prixPivot)}
            disabled={!manualValue && !prixPivot}
          >
            Valider mon estimation →
          </button>
        </div>
      </div>
    </div>
  );
}
