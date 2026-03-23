import { useState } from 'react';
import { fmtK, fmtPm2 } from '../utils/formatters';
import { modelStats } from '../utils/model';

export default function EstimationPanel({ estimate, target, model, onConfirm, alreadyConfirmed }) {
  const [price, setPrice]     = useState('');
  const [saved,  setSaved]    = useState(false);

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

  return (
    <div className="est-card">
      {/* Header */}
      <div className="est-header">
        <h3 className="est-title">Estimation</h3>
        {stats ? (
          <div className="model-pill">
            <span className="model-dot" />
            Modèle · {stats.n} confirmation{stats.n > 1 ? 's' : ''} · MAE {stats.mae} €/m²
          </div>
        ) : (
          <div className="model-pill model-pill-cold">
            <span className="model-dot-cold" />
            Modèle non calibré
          </div>
        )}
      </div>

      {/* Main value */}
      {estimate ? (
        <>
          <div className="est-main">
            <div className="est-value">{fmtPm2(estimate.correctedPm2)}</div>
            <div className="est-range">
              {fmtPm2(estimate.minPm2)} — {fmtPm2(estimate.maxPm2)}
            </div>
            {hasSurface && (
              <div className="est-total">
                {fmtK(estimate.minPrice)} — {fmtK(estimate.maxPrice)}
                <span className="est-center-val">&nbsp;· estimé {fmtK(estimate.estimatedPrice)}</span>
              </div>
            )}
          </div>

          {/* Breakdown */}
          <div className="est-breakdown">
            <div className="est-row">
              <span>Médiane DVF pondérée</span>
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
            {estimate.charAdj !== 1 && (
              <div className="est-row">
                <span>→ Après ajustements bien</span>
                <span>{fmtPm2(estimate.adjustedPm2)}</span>
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
                {stats
                  ? `${stats.biasPct > 0 ? '+' : ''}${stats.biasPct}%`
                  : '—'
                }
              </span>
            </div>
            <div className="est-row est-row-final">
              <span>Estimation finale</span>
              <strong>{fmtPm2(estimate.correctedPm2)}</strong>
            </div>
            <div className="est-row">
              <span>Comparables utilisés</span>
              <span>{estimate.nComps} transaction{estimate.nComps > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Confirmation section */}
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
                      &nbsp;· écart {errorPct > 0 ? '+' : ''}{errorPct}%
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
                    Enregistrer
                  </button>
                </div>
                {!hasSurface && (
                  <p className="est-warn">Surface du bien non renseignée — impossible de calculer le ratio.</p>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="est-empty">
          <span>📐</span>
          <p>
            {(model.samples.length === 0
              ? 'Aucune transaction DVF disponible'
              : 'Sélectionnez des transactions ci-dessus'
            ) + ' pour calculer une estimation.'}
          </p>
        </div>
      )}
    </div>
  );
}
