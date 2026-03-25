import { useState } from 'react';
import { fmtK, fmtPm2 } from '../utils/formatters';
import { modelStats } from '../utils/model';

function factorClass(factor) {
  if (factor > 1.001) return 'est-val-up';
  if (factor < 0.999) return 'est-val-down';
  return '';
}

function renderStars(stars = 0) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

export default function EstimationPanel({
  estimate,
  target,
  model,
  onConfirm,
  alreadyConfirmed,
  manualEstimate,
  prixPivot,
  nFilteredRefs,
}) {
  const [price, setPrice] = useState('');
  const [saved, setSaved] = useState(false);

  const stats = modelStats(model.samples, model.correctionFactor);
  const hasSurface = target?.surfaceM2 > 0;

  const handleConfirm = () => {
    const parsed = parseFloat(price.replace(/[\s €]/g, '').replace(',', '.'));
    if (!parsed || parsed <= 0 || !hasSurface) return;
    onConfirm(estimate.basePm2, parsed);
    setSaved(true);
  };

  const actualPm2 =
    alreadyConfirmed && target?.surfaceM2
      ? Math.round(alreadyConfirmed.actualPrice / target.surfaceM2)
      : null;

  const errorPct =
    estimate && actualPm2
      ? ((actualPm2 - estimate.correctedPm2) / estimate.correctedPm2 * 100).toFixed(1)
      : null;

  const manualErrorPct =
    manualEstimate && actualPm2
      ? ((actualPm2 - manualEstimate) / manualEstimate * 100).toFixed(1)
      : null;

  const hasComparison = estimate && manualEstimate;
  const delta = hasComparison ? estimate.correctedPm2 - manualEstimate : null;
  const deltaPct = hasComparison ? ((delta / manualEstimate) * 100).toFixed(1) : null;
  const areaScores = estimate?.areaScores || {};

  return (
    <div className="est-layout">
      <div className="est-compare-grid">
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
                Non calibre
              </div>
            )}
          </div>

          {estimate ? (
            <>
              <div className="est-main">
                <div className="est-value">{fmtPm2(estimate.correctedPm2)}</div>
                {estimate.confidence && (
                  <div className="est-confidence-pill">
                    <span className="est-stars">{renderStars(estimate.confidence.stars)}</span>
                    <span>{estimate.confidence.label}</span>
                    <span className="est-confidence-score">{estimate.confidence.score}/100</span>
                  </div>
                )}
                <div className="est-confidence-bar">
                  <div className="est-conf-track">
                    <div
                      className="est-conf-range"
                      style={{
                        left: `${Math.max(0, (estimate.minPm2 / (estimate.maxPm2 * 1.1)) * 100)}%`,
                        right: `${Math.max(0, 100 - (estimate.maxPm2 / (estimate.maxPm2 * 1.1)) * 100)}%`,
                      }}
                    />
                    <div
                      className="est-conf-marker"
                      style={{
                        left: `${(estimate.correctedPm2 / (estimate.maxPm2 * 1.1)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="est-conf-labels">
                    <span>{fmtPm2(estimate.minPm2)}</span>
                    <span>{fmtPm2(estimate.maxPm2)}</span>
                  </div>
                </div>
                {hasSurface && (
                  <div className="est-total">
                    {fmtK(estimate.minPrice)} - {fmtK(estimate.maxPrice)}
                    <span className="est-center-val">&nbsp;· estime {fmtK(estimate.estimatedPrice)}</span>
                  </div>
                )}
              </div>

              <div className="est-breakdown">
                <div className="est-row">
                  <span>Mediane ponderee ({nFilteredRefs || estimate.nComps} ref.)</span>
                  <span>{fmtPm2(estimate.basePm2)}</span>
                </div>
                {estimate.surfAdj !== 1 && (
                  <div className="est-row">
                    <span>Ajustement surface</span>
                    <span>{fmtPm2(estimate.afterSurfPm2)}</span>
                  </div>
                )}
                {estimate.adjustments?.map(adjustment => (
                  <div className="est-row" key={adjustment.label}>
                    <span>{adjustment.label}</span>
                    <span className={factorClass(adjustment.factor)}>× {adjustment.factor.toFixed(2)}</span>
                  </div>
                ))}
                <div className="est-row">
                  <span>
                    Facteur correcteur ML
                    {stats ? ` (× ${model.correctionFactor.toFixed(3)})` : ' (aucune donnee)'}
                  </span>
                  <span className={factorClass(model.correctionFactor)}>
                    {stats ? `${stats.biasPct > 0 ? '+' : ''}${stats.biasPct}%` : '—'}
                  </span>
                </div>
                <div className="est-row est-row-final">
                  <span>Estimation finale</span>
                  <strong>{fmtPm2(estimate.correctedPm2)}</strong>
                </div>
              </div>

              {Object.values(areaScores).some(value => value != null && typeof value !== 'object') && (
                <div className="est-context-grid">
                  {areaScores.transportScore != null && (
                    <div className="est-context-card">
                      <span className="est-context-kicker">Transport</span>
                      <strong>{areaScores.transportScore}/100</strong>
                    </div>
                  )}
                  {areaScores.walkScore != null && (
                    <div className="est-context-card">
                      <span className="est-context-kicker">Walk Score</span>
                      <strong>{areaScores.walkScore}/100</strong>
                    </div>
                  )}
                  {areaScores.educationScore != null && (
                    <div className="est-context-card">
                      <span className="est-context-kicker">Ecoles</span>
                      <strong>{areaScores.educationScore}/100</strong>
                    </div>
                  )}
                  {areaScores.environmentScore != null && (
                    <div className="est-context-card">
                      <span className="est-context-kicker">Environnement</span>
                      <strong>{areaScores.environmentScore}/100</strong>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="est-empty">
              <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>📐</span>
              <p>Filtrez des references dans l&apos;onglet Filtrage pour calculer l&apos;estimation ML.</p>
            </div>
          )}
        </div>

        <div className="est-card est-card-analyst">
          <div className="est-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="est-card-icon est-icon-analyst">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
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
                    Estime {fmtK(Math.round(((manualEstimate || prixPivot) * target.surfaceM2) / 1000) * 1000)}
                  </div>
                )}
              </div>
              <div className="est-breakdown">
                {prixPivot && (
                  <div className="est-row">
                    <span>Prix Pivot (etude de marche)</span>
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
              <span style={{ fontSize: '1.5rem', opacity: 0.4 }}>👤</span>
              <p>Completez l&apos;onglet Analyse pour saisir votre estimation manuelle ou calculer le Prix Pivot.</p>
            </div>
          )}
        </div>
      </div>

      {hasComparison && (
        <div className={`est-delta-banner ${Math.abs(delta) < manualEstimate * 0.05 ? 'est-delta-ok' : 'est-delta-warn'}`}>
          <div className="est-delta-content">
            <span className="est-delta-label">Ecart ML vs Analyste</span>
            <span className="est-delta-value">
              {delta > 0 ? '+' : ''}
              {Math.round(delta).toLocaleString('fr-FR')} €/m²
              <span className="est-delta-pct">({deltaPct > 0 ? '+' : ''}{deltaPct}%)</span>
            </span>
          </div>
          <span className="est-delta-hint">
            {Math.abs(delta) < manualEstimate * 0.05
              ? 'Les deux estimations convergent.'
              : Math.abs(delta) < manualEstimate * 0.15
                ? 'Ecart modere : verifier les hypotheses.'
                : 'Ecart significatif : revoir filtres ou analyse.'}
          </span>
        </div>
      )}

      <div className="est-card">
        <div className="est-confirm">
          {alreadyConfirmed ? (
            <div className="est-confirmed-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <div>
                <strong>Prix confirme : {fmtK(alreadyConfirmed.actualPrice)}</strong>
                <span> · {fmtPm2(actualPm2)}</span>
                {errorPct !== null && (
                  <span className={parseFloat(errorPct) >= 0 ? 'est-err-pos' : 'est-err-neg'}>
                    &nbsp;· ecart ML {errorPct > 0 ? '+' : ''}
                    {errorPct}%
                  </span>
                )}
                {manualErrorPct !== null && (
                  <span className={parseFloat(manualErrorPct) >= 0 ? 'est-err-pos' : 'est-err-neg'}>
                    &nbsp;· ecart analyste {manualErrorPct > 0 ? '+' : ''}
                    {manualErrorPct}%
                  </span>
                )}
              </div>
            </div>
          ) : saved ? (
            <div className="est-saved-msg">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Confirmation enregistree.
            </div>
          ) : (
            <div className="est-confirm-form">
              <p className="est-confirm-label">
                Prix de vente reel <span className="est-confirm-hint">(a renseigner apres la transaction)</span>
              </p>
              <div className="est-confirm-row">
                <input
                  type="number"
                  className="est-confirm-input"
                  placeholder="Ex : 450 000"
                  value={price}
                  onChange={event => setPrice(event.target.value)}
                  min="10000"
                />
                <span className="est-confirm-unit">€</span>
                {price && hasSurface && (
                  <span className="est-confirm-pm2">
                    = {Math.round(parseFloat(price) / target.surfaceM2).toLocaleString('fr-FR')} €/m²
                  </span>
                )}
                <button className="est-confirm-btn" disabled={!price || !hasSurface} onClick={handleConfirm}>
                  Enregistrer la confirmation
                </button>
              </div>
              {!hasSurface && (
                <p className="est-warn">Surface du bien non renseignee : impossible de calculer le ratio.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
