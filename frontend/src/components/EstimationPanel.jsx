import { useState } from 'react';
import { fmtK, fmtPm2 } from '../utils/formatters';
import { modelStats } from '../utils/model';

export default function EstimationPanel({ estimate, target, model, onConfirm, alreadyConfirmed, manualEstimate, prixPivot, nFilteredRefs }) {
  const [price, setPrice]  = useState('');
  const [saved, setSaved]  = useState(false);

  const stats = modelStats(model.samples, model.correctionFactor);
  const hasSurface = target?.surfaceM2 > 0;

  const handleConfirm = () => {
    const p = parseFloat(price.replace(/[\s €]/g, '').replace(',', '.'));
    if (!p || p <= 0 || !hasSurface) return;
    onConfirm(estimate.basePm2, p);
    setSaved(true);
  };

  const actualPm2 = alreadyConfirmed && target?.surfaceM2
    ? Math.round(alreadyConfirmed.actualPrice / target.surfaceM2)
    : null;

  const errorPct = estimate && actualPm2
    ? ((actualPm2 - estimate.correctedPm2) / estimate.correctedPm2 * 100).toFixed(1)
    : null;

  const manualErrorPct = manualEstimate && actualPm2
    ? ((actualPm2 - manualEstimate) / manualEstimate * 100).toFixed(1)
    : null;

  // Comparison between ML and analyst
  const hasComparison = estimate && manualEstimate;
  const delta = hasComparison ? estimate.correctedPm2 - manualEstimate : null;
  const deltaPct = hasComparison ? ((delta / manualEstimate) * 100).toFixed(1) : null;

  return (
    <div className="est-layout">
      {/* ── Side-by-side comparison ── */}
      <div className="est-compare-grid">
        {/* ML Estimate Card */}
        <div className="est-card est-card-ml">
          <div className="est-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="est-card-icon est-icon-ml">ML</span>
              <h3 className="est-title">Estimation algorithmique</h3>
            </div>
            {stats ? (
              <div className="model-pill">
                <span className="model-dot" />
                {stats.n} conf. · MAE {stats.mae} €/m²
              </div>
            ) : (
              <div className="model-pill model-pill-cold">
                <span className="model-dot-cold" />
                Non calibré
              </div>
            )}
          </div>

          {estimate ? (
            <>
              <div className="est-main">
                <div className="est-value">{fmtPm2(estimate.correctedPm2)}</div>
                <div className="est-confidence-bar">
                  <div className="est-conf-track">
                    <div className="est-conf-range" style={{
                      left: `${Math.max(0, (estimate.minPm2 / (estimate.maxPm2 * 1.1)) * 100)}%`,
                      right: `${Math.max(0, 100 - (estimate.maxPm2 / (estimate.maxPm2 * 1.1)) * 100)}%`,
                    }} />
                    <div className="est-conf-marker" style={{
                      left: `${(estimate.correctedPm2 / (estimate.maxPm2 * 1.1)) * 100}%`,
                    }} />
                  </div>
                  <div className="est-conf-labels">
                    <span>{fmtPm2(estimate.minPm2)}</span>
                    <span>{fmtPm2(estimate.maxPm2)}</span>
                  </div>
                </div>
                {hasSurface && (
                  <div className="est-total">
                    {fmtK(estimate.minPrice)} — {fmtK(estimate.maxPrice)}
                    <span className="est-center-val">&nbsp;· estimé {fmtK(estimate.estimatedPrice)}</span>
                  </div>
                )}
              </div>

              <div className="est-breakdown">
                <div className="est-row">
                  <span>Médiane pondérée ({nFilteredRefs || estimate.nComps} réf.)</span>
                  <span>{fmtPm2(estimate.basePm2)}</span>
                </div>
                {estimate.surfAdj !== 1 && (
                  <div className="est-row">
                    <span>Ajustement surface ({Math.round((1 - estimate.surfAdj) * 100)}%)</span>
                    <span>{fmtPm2(estimate.afterSurfPm2)}</span>
                  </div>
                )}
                {estimate.floorAdj?.label && (
                  <div className="est-row">
                    <span>{estimate.floorAdj.label}</span>
                    <span className={estimate.floorAdj.factor > 1 ? 'est-val-up' : estimate.floorAdj.factor < 1 ? 'est-val-down' : ''}>
                      × {estimate.floorAdj.factor.toFixed(2)}
                    </span>
                  </div>
                )}
                {estimate.orientAdj?.label && (
                  <div className="est-row">
                    <span>{estimate.orientAdj.label}</span>
                    <span className={estimate.orientAdj.factor > 1 ? 'est-val-up' : estimate.orientAdj.factor < 1 ? 'est-val-down' : ''}>
                      × {estimate.orientAdj.factor.toFixed(2)}
                    </span>
                  </div>
                )}
                {estimate.amenitAdj?.label && (
                  <div className="est-row">
                    <span>{estimate.amenitAdj.label}</span>
                    <span className="est-val-up">× {estimate.amenitAdj.factor.toFixed(2)}</span>
                  </div>
                )}
                <div className="est-row">
                  <span>
                    Facteur correcteur ML
                    {stats ? ` (× ${model.correctionFactor.toFixed(3)})` : ' (aucune donnée)'}
                  </span>
                  <span className={
                    model.correctionFactor > 1.02 ? 'est-val-up'
                    : model.correctionFactor < 0.98 ? 'est-val-down'
                    : ''
                  }>
                    {stats ? `${stats.biasPct > 0 ? '+' : ''}${stats.biasPct}%` : '—'}
                  </span>
                </div>
                <div className="est-row est-row-final">
                  <span>Estimation finale</span>
                  <strong>{fmtPm2(estimate.correctedPm2)}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="est-empty">
              <span style={{ fontSize: '1.5rem', opacity: .4 }}>📐</span>
              <p>Filtrez des références dans l'onglet Filtrage pour calculer l'estimation ML.</p>
            </div>
          )}
        </div>

        {/* Analyst Estimate Card */}
        <div className="est-card est-card-analyst">
          <div className="est-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="est-card-icon est-icon-analyst">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <h3 className="est-title">Estimation analyste</h3>
            </div>
            <div className="model-pill" style={{ background: 'var(--pastel-amber)', borderColor: 'var(--warn-bdr)', color: 'var(--warn-text)' }}>
              Analyse manuelle
            </div>
          </div>

          {manualEstimate || prixPivot ? (
            <>
              <div className="est-main">
                <div className="est-value" style={{ color: 'var(--warn-text)' }}>
                  {fmtPm2(manualEstimate || prixPivot)}
                </div>
                {hasSurface && (
                  <div className="est-total">
                    Estimé {fmtK(Math.round(((manualEstimate || prixPivot) * target.surfaceM2) / 1000) * 1000)}
                  </div>
                )}
              </div>
              <div className="est-breakdown">
                {prixPivot && (
                  <div className="est-row">
                    <span>Prix Pivot (étude de marché)</span>
                    <span>{fmtPm2(prixPivot)}</span>
                  </div>
                )}
                {manualEstimate && manualEstimate !== prixPivot && (
                  <div className="est-row">
                    <span>Estimation manuelle saisie</span>
                    <strong>{fmtPm2(manualEstimate)}</strong>
                  </div>
                )}
                <div className="est-row est-row-final">
                  <span>Estimation analyste retenue</span>
                  <strong>{fmtPm2(manualEstimate || prixPivot)}</strong>
                </div>
              </div>
            </>
          ) : (
            <div className="est-empty">
              <span style={{ fontSize: '1.5rem', opacity: .4 }}>👤</span>
              <p>Complétez l'onglet Analyse pour saisir votre estimation manuelle ou calculer le Prix Pivot.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delta comparison banner ── */}
      {hasComparison && (
        <div className={`est-delta-banner ${Math.abs(delta) < manualEstimate * 0.05 ? 'est-delta-ok' : 'est-delta-warn'}`}>
          <div className="est-delta-content">
            <span className="est-delta-label">Écart ML vs Analyste</span>
            <span className="est-delta-value">
              {delta > 0 ? '+' : ''}{Math.round(delta).toLocaleString('fr-FR')} €/m²
              <span className="est-delta-pct">({deltaPct > 0 ? '+' : ''}{deltaPct}%)</span>
            </span>
          </div>
          <span className="est-delta-hint">
            {Math.abs(delta) < manualEstimate * 0.05
              ? 'Les deux estimations convergent — bonne confiance.'
              : Math.abs(delta) < manualEstimate * 0.15
                ? 'Écart modéré — vérifiez les hypothèses.'
                : 'Écart significatif — revoyez les filtres ou l\'analyse.'
            }
          </span>
        </div>
      )}

      {/* ── Confirmation section ── */}
      <div className="est-card">
        <div className="est-confirm">
          {alreadyConfirmed ? (
            <div className="est-confirmed-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <strong>Prix confirmé : {fmtK(alreadyConfirmed.actualPrice)}</strong>
                <span> · {fmtPm2(actualPm2)}</span>
                {errorPct !== null && (
                  <span className={parseFloat(errorPct) >= 0 ? 'est-err-pos' : 'est-err-neg'}>
                    &nbsp;· écart ML {errorPct > 0 ? '+' : ''}{errorPct}%
                  </span>
                )}
                {manualErrorPct !== null && (
                  <span className={parseFloat(manualErrorPct) >= 0 ? 'est-err-pos' : 'est-err-neg'}>
                    &nbsp;· écart analyste {manualErrorPct > 0 ? '+' : ''}{manualErrorPct}%
                  </span>
                )}
              </div>
            </div>
          ) : saved ? (
            <div className="est-saved-msg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Confirmation enregistrée — le modèle s&apos;améliore.
            </div>
          ) : (
            <div className="est-confirm-form">
              <p className="est-confirm-label">
                Prix de vente réel <span className="est-confirm-hint">(à renseigner après la transaction)</span>
              </p>
              <div className="est-confirm-row">
                <input
                  type="number"
                  className="est-confirm-input"
                  placeholder="Ex : 450 000"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  min="10000"
                />
                <span className="est-confirm-unit">€</span>
                {price && hasSurface && (
                  <span className="est-confirm-pm2">
                    = {Math.round(parseFloat(price) / target.surfaceM2).toLocaleString('fr-FR')} €/m²
                  </span>
                )}
                <button
                  className="est-confirm-btn"
                  disabled={!price || !hasSurface}
                  onClick={handleConfirm}
                >
                  Enregistrer la confirmation
                </button>
              </div>
              {!hasSurface && (
                <p className="est-warn">Surface du bien non renseignée — impossible de calculer le ratio.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
