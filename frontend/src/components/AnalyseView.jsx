import { useState, useMemo } from 'react';
import { computePrixPivot } from '../utils/edm';
import { fmtPm2 } from '../utils/formatters';

const TYPES = ['T1', 'T2', 'T3', 'T4', 'T5'];

export default function AnalyseView({
  dossier,
  filteredRefs,
  metrics,
  prixPivot,
  onPivotChange,
  onManualEstimate,
  isBuilding,
}) {
  const [typoW, setTypoW] = useState({ T1: 0, T2: 0, T3: 1, T4: 0, T5: 0 });
  const [manualValue, setManualValue] = useState('');

  // Compute local pivot from typoW + metrics
  const localPivot = useMemo(
    () => (metrics ? computePrixPivot(metrics.byType, typoW) : null),
    [metrics, typoW],
  );

  // Formula display helpers
  const pivotParts = TYPES.filter(t => typoW[t] > 0 && metrics?.byType[t]);
  const totalLots = TYPES.reduce((s, t) => s + (typoW[t] || 0), 0);
  const formulaStr =
    pivotParts.length > 0
      ? pivotParts
          .map(
            t =>
              `${typoW[t]} \u00d7 ${Math.round(metrics.byType[t].avgWeighted).toLocaleString('fr-FR')}`,
          )
          .join(' + ')
      : null;

  /* ------------------------------------------------------------------ */
  return (
    <div className="edm-layout">
      {/* ── Cross-table: Prix par typologie ── */}
      {metrics && Object.keys(metrics.byType).length > 0 && (
        <div className="edm-cross-table">
          <div className="ect-header">
            <h3 className="ect-title">Prix de marché par typologie</h3>
            <span className="ect-sub">
              Basé sur {metrics.n} références filtrées — {metrics.nDvf} DVF,{' '}
              {metrics.nSl} SeLoger
            </span>
          </div>
          <div className="ect-grid">
            <div className="ect-head-row">
              <span>Typologie</span>
              <span>Nb références</span>
              <span>Prix moyen pondéré</span>
              <span>Prix moyen simple</span>
            </div>
            {TYPES.map(t => {
              const d = metrics.byType[t];
              return (
                <div key={t} className={`ect-row ${!d ? 'ect-row-na' : ''}`}>
                  <span className="ect-type">{t}</span>
                  <span className="ect-n">{d ? d.n : '—'}</span>
                  <span className="ect-val">
                    {d ? fmtPm2(d.avgWeighted) : '—'}
                  </span>
                  <span className="ect-val-light">
                    {d ? fmtPm2(d.avg) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Prix Pivot Calculator ── */}
      <div className="edm-pivot-card-v2">
        <div className="epc2-header">
          <div className="epc2-title">Calcul du Prix Pivot</div>
          <div className="epc2-desc">
            Indiquez combien de lots de chaque type comporte votre immeuble. Le
            Prix Pivot est la <strong>moyenne pondérée</strong> des prix de
            marché par typologie.
          </div>
        </div>

        <div className="epc2-table">
          <div className="epc2-thead">
            <span>Type</span>
            <span>
              Prix moyen de marché
              <span className="epc2-src">
                ({metrics?.n ?? 0} réf. filtrées)
              </span>
            </span>
            <span>Nb de lots dans l'immeuble</span>
          </div>
          {TYPES.map(t => {
            const d = metrics?.byType[t];
            return (
              <div
                key={t}
                className={`epc2-row ${!d ? 'epc2-row-na' : ''}`}
              >
                <span className="epc2-type">{t}</span>
                <div className="epc2-price">
                  {d ? (
                    <>
                      <strong>{fmtPm2(d.avgWeighted)}</strong>
                      <span className="epc2-n">{d.n} références</span>
                    </>
                  ) : (
                    <span className="epc2-none">
                      Pas de données sur ce secteur
                    </span>
                  )}
                </div>
                <div className="epc2-input">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    step="1"
                    className={`epc2-lots-input ${typoW[t] > 0 ? 'has-val' : ''}`}
                    value={typoW[t]}
                    disabled={!d}
                    onChange={e =>
                      setTypoW(p => ({
                        ...p,
                        [t]: Math.max(0, +e.target.value),
                      }))
                    }
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
              <span className="epc2-pivot-val">{fmtPm2(localPivot)}</span>
            </div>
          ) : (
            <div className="epc2-formula epc2-formula-empty">
              Saisissez le nombre de lots par type pour calculer le Prix Pivot
            </div>
          )}
          {localPivot && onPivotChange && (
            <button
              className="epc2-send-btn"
              onClick={() => onPivotChange(localPivot)}
            >
              Utiliser ce Prix Pivot →
            </button>
          )}
        </div>
      </div>

      {/* ── Manual estimate card ── */}
      <div className="analyse-manual-card">
        <div className="amc-header">
          <h3>Estimation manuelle de l&apos;analyste</h3>
          <span className="amc-desc">Votre évaluation basée sur l&apos;étude de marché</span>
        </div>
        <div className="amc-body">
          <div className="amc-row">
            <span className="amc-label">Prix Pivot calculé</span>
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
              onChange={e => setManualValue(e.target.value ? +e.target.value : '')}
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
