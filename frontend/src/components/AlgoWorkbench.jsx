import { useMemo, useState } from 'react';
import { fmtK, fmtPm2, fmtPrice } from '../utils/formatters';
import { modelStats } from '../utils/model';
import TargetEditor from './TargetEditor';

function factorClass(factor) {
  if (factor > 1.001) return 'est-val-up';
  if (factor < 0.999) return 'est-val-down';
  return '';
}

function renderStars(stars = 0) {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 5 - stars));
}

function priceRange(refs = []) {
  const values = refs.map(ref => ref.ppm2).filter(Number.isFinite);
  if (!values.length) return null;
  return {
    min: Math.round(Math.min(...values)),
    max: Math.round(Math.max(...values)),
  };
}

function computePrice(pm2, surfaceM2) {
  if (!Number.isFinite(pm2) || !Number.isFinite(surfaceM2) || surfaceM2 <= 0) return null;
  return Math.round(pm2 * surfaceM2);
}

function scoreCards(areaScores = {}) {
  return [
    ['transportScore', 'Transport'],
    ['walkScore', 'Walk'],
    ['educationScore', 'Ecoles'],
    ['environmentScore', 'Environnement'],
    ['safetyScore', 'Securite'],
    ['servicesScore', 'Services'],
    ['economyScore', 'Economie'],
    ['liveabilityScore', 'Cadre de vie'],
  ].filter(([key]) => areaScores?.[key] != null);
}

export default function AlgoWorkbench({
  estimate,
  filteredRefs,
  model,
  target,
  onTargetChange,
  onConfirm,
  alreadyConfirmed,
  disabledFactors,
  onDisabledFactorsChange,
}) {
  const [price, setPrice] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const stats = modelStats(model.samples, model.correctionFactor);
  const refsRange = useMemo(() => priceRange(filteredRefs), [filteredRefs]);
  const hasSurface = target?.surfaceM2 > 0;
  const visibleScores = scoreCards(estimate?.areaScores);

  if (!estimate) {
    return (
      <div className="algo-card">
        <div className="dw-empty">L’algorithme n’a pas assez de références pour calculer une estimation.</div>
      </div>
    );
  }

  const actualPm2 =
    alreadyConfirmed && hasSurface
      ? Math.round(alreadyConfirmed.actualPrice / target.surfaceM2)
      : null;
  const exactEstimatedPrice = computePrice(estimate.correctedPm2, target?.surfaceM2);

  const handleConfirm = () => {
    const parsed = parseFloat(price.replace(/[\s €]/g, '').replace(',', '.'));
    if (!parsed || parsed <= 0 || !hasSurface) return;
    onConfirm(estimate.basePm2, parsed);
    setPrice('');
  };

  return (
    <div className="algo-workbench">
      <section className="algo-hero-card">
        <div className="algo-hero-main">
          <span className="algo-kicker">Résultat algorithmique</span>
          <strong>{fmtPm2(estimate.correctedPm2)}</strong>
          <div className="algo-hero-price">{fmtPrice(exactEstimatedPrice || estimate.estimatedPrice)}</div>
          <small>{fmtK(estimate.minPrice)} - {fmtK(estimate.maxPrice)}</small>
        </div>
        <div className="algo-hero-side">
          <div className="algo-mini">
            <span>Confiance</span>
            <strong>{renderStars(estimate.confidence?.stars || 0)}</strong>
          </div>
          <div className="algo-mini">
            <span>Références</span>
            <strong>{filteredRefs.length}</strong>
          </div>
          <div className="algo-mini">
            <span>Fourchette algo</span>
            <strong>{fmtPm2(estimate.minPm2)} - {fmtPm2(estimate.maxPm2)}</strong>
          </div>
        </div>
      </section>

      <div className="algo-grid">
        <section className="algo-card">
          <div className="algo-card-head">
            <h3>Base utilisée</h3>
            <p>Ce que l’algorithme a retenu avant ajustements.</p>
          </div>
          <div className="algo-list">
            <div className="algo-row">
              <span>Médiane pondérée</span>
              <strong>{fmtPm2(estimate.basePm2)}</strong>
            </div>
            <div className="algo-row">
              <span>Références gardées</span>
              <strong>{filteredRefs.length}</strong>
            </div>
            {refsRange && (
              <div className="algo-row">
                <span>Fourchette des références</span>
                <strong>{fmtPm2(refsRange.min)} - {fmtPm2(refsRange.max)}</strong>
              </div>
            )}
            {stats && (
              <div className="algo-row">
                <span>Correction ML</span>
                <strong>x {model.correctionFactor.toFixed(3)}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="algo-card">
          <div className="algo-card-head">
            <h3>Pondérations du bien</h3>
            <p>Facteurs calculés automatiquement. Désactivez ceux à ignorer.</p>
          </div>
          <div className="algo-list">
            {(estimate.propertyAdjustments || []).filter(item => item?.label).map(item => {
              const off = disabledFactors?.[item.label] === true;
              const active = !off && Math.abs(item.factor - 1) > 0.0001;
              return (
                <div key={item.label} className={`algo-row algo-row-toggle ${off ? 'algo-row-off' : ''}`}>
                  <label className="algo-toggle-label">
                    <input
                      type="checkbox"
                      checked={!off}
                      onChange={() => onDisabledFactorsChange?.({
                        ...disabledFactors,
                        [item.label]: !off,
                      })}
                    />
                    <span>{item.label}</span>
                  </label>
                  <strong className={active ? factorClass(item.factor) : 'est-val-muted'}>
                    x {item.factor.toFixed(2)}
                  </strong>
                </div>
              );
            })}
            {!(estimate.propertyAdjustments || []).some(item => item?.label) && (
              <div className="algo-empty-row">Aucune correction détectée. Renseignez les caractéristiques ci-dessous.</div>
            )}
          </div>
        </section>

        <section className="algo-card">
          <div className="algo-card-head">
            <h3>Pondérations quartier</h3>
            <p>Transport, écoles, walk score et environnement.</p>
          </div>
          <div className="algo-list">
            {(estimate.contextAdjustments || []).filter(item => item?.label && Math.abs(item.factor - 1) > 0.0001).map(item => (
              <div key={item.label} className="algo-row">
                <span>{item.label}</span>
                <strong className={factorClass(item.factor)}>x {item.factor.toFixed(2)}</strong>
              </div>
            ))}
            {visibleScores.length > 0 && (
              <div className="algo-score-grid">
                {visibleScores.map(([key, label]) => (
                  <div key={key}>
                    <span>{label}</span>
                    <strong>{estimate.areaScores[key]}/100</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="algo-card">
          <div className="algo-card-head">
            <h3>Confirmation terrain</h3>
            <p>À renseigner après transaction.</p>
          </div>

          {alreadyConfirmed ? (
            <div className="algo-confirmed">
              <strong>Prix confirmé: {fmtK(alreadyConfirmed.actualPrice)}</strong>
              <span>{fmtPm2(actualPm2)}</span>
            </div>
          ) : (
            <div className="algo-confirm-form">
              <input
                type="number"
                min="10000"
                placeholder="Prix de vente réel"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
              />
              <button className="topbar-btn topbar-btn-primary" disabled={!price || !hasSurface} onClick={handleConfirm}>
                Enregistrer
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="algo-card algo-card-wide">
        <div className="algo-card-head">
          <div>
            <h3>Caractéristiques du bien</h3>
            <p>Corrigez les données pour recalculer les pondérations automatiquement.</p>
          </div>
          <button className="topbar-btn" onClick={() => setShowEditor(!showEditor)}>
            {showEditor ? 'Masquer' : 'Modifier'}
          </button>
        </div>
        {showEditor && onTargetChange && (
          <TargetEditor target={target} onChange={onTargetChange} />
        )}
      </section>
    </div>
  );
}
