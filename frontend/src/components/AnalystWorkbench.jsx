import { useState } from 'react';
import { ANALYST_ADJUSTMENT_OPTIONS } from '../utils/dossiers';
import { fmtPm2, fmtPrice } from '../utils/formatters';
import TargetEditor from './TargetEditor';
import Dropdown from './Dropdown';

function makeAdjustment() {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    key: ANALYST_ADJUSTMENT_OPTIONS[0].value,
    pct: 0,
  };
}

function adjustmentLabel(key) {
  return ANALYST_ADJUSTMENT_OPTIONS.find(option => option.value === key)?.label || 'Autre';
}

function computeAnalystPm2(basePm2, adjustments) {
  if (!Number.isFinite(basePm2) || basePm2 <= 0) return null;
  const factor = adjustments.reduce((product, item) => product * (1 + (Number(item.pct) || 0) / 100), 1);
  return Math.round(basePm2 * factor);
}

function computePrice(pm2, surfaceM2) {
  if (!Number.isFinite(pm2) || !Number.isFinite(surfaceM2) || surfaceM2 <= 0) return null;
  return Math.round(pm2 * surfaceM2);
}

export default function AnalystWorkbench({
  metrics,
  areaScores,
  target,
  analystBasePm2,
  analystAdjustments,
  manualEstimate,
  onBaseChange,
  onAdjustmentsChange,
  onApplyEstimate,
  onTargetChange,
}) {
  const [showEditor, setShowEditor] = useState(false);
  const basePm2 = analystBasePm2 ?? metrics?.avgWeighted ?? metrics?.avg ?? null;
  const computedPm2 = computeAnalystPm2(basePm2, analystAdjustments);
  const displayedPm2 = computedPm2 ?? manualEstimate;
  const displayedPrice = computePrice(displayedPm2, target?.surfaceM2);
  const savedPrice = computePrice(manualEstimate, target?.surfaceM2);

  return (
    <div className="analyst-workbench">
      <div className="awb-grid">
        <section className="awb-card">
          <div className="awb-card-head">
            <div>
              <h3>Base marché</h3>
              <p>Point de départ avant vos pondérations manuelles.</p>
            </div>
          </div>

          <div className="awb-base-grid">
            <div className="awb-base-stat">
              <span>Base actuelle</span>
              <strong>{fmtPm2(basePm2)}</strong>
              <small>{metrics?.n ?? 0} références filtrées</small>
            </div>
            <label className="awb-base-input">
              <span>Base personnalisée</span>
              <input
                type="number"
                min="0"
                step="1"
                value={analystBasePm2 ?? ''}
                placeholder={basePm2 ? String(Math.round(basePm2)) : ''}
                onChange={(event) => onBaseChange(event.target.value ? +event.target.value : null)}
              />
            </label>
          </div>

          <div className="awb-context-row">
            {areaScores.transportScore != null && (
              <div className="awb-mini-score"><span>Transport</span><strong>{areaScores.transportScore}/100</strong></div>
            )}
            {areaScores.walkScore != null && (
              <div className="awb-mini-score"><span>Walk</span><strong>{areaScores.walkScore}/100</strong></div>
            )}
            {areaScores.educationScore != null && (
              <div className="awb-mini-score"><span>Ecoles</span><strong>{areaScores.educationScore}/100</strong></div>
            )}
            {areaScores.environmentScore != null && (
              <div className="awb-mini-score"><span>Env.</span><strong>{areaScores.environmentScore}/100</strong></div>
            )}
          </div>
        </section>

        <section className="awb-card">
          <div className="awb-card-head">
            <div>
              <h3>Pondérations analyste</h3>
              <p>Ajoutez autant de corrections que nécessaire.</p>
            </div>
            <button className="topbar-btn" onClick={() => onAdjustmentsChange([...(analystAdjustments || []), makeAdjustment()])}>
              Ajouter
            </button>
          </div>

          <div className="awb-adjustment-list">
            {(analystAdjustments || []).length === 0 && (
              <div className="awb-empty">Aucune pondération ajoutée. Utilisez le bouton “Ajouter”.</div>
            )}
            {(analystAdjustments || []).map(item => (
              <div key={item.id} className="awb-adjustment-row">
                <Dropdown
                  value={item.key}
                  onChange={(v) => onAdjustmentsChange(
                    analystAdjustments.map(entry => (
                      entry.id === item.id ? { ...entry, key: v } : entry
                    ))
                  )}
                  options={ANALYST_ADJUSTMENT_OPTIONS}
                />
                <input
                  type="number"
                  min="-30"
                  max="30"
                  step="0.5"
                  value={item.pct}
                  onChange={(event) => onAdjustmentsChange(
                    analystAdjustments.map(entry => (
                      entry.id === item.id ? { ...entry, pct: +event.target.value } : entry
                    ))
                  )}
                />
                <span className="awb-percent">%</span>
                <button
                  className="awb-remove-btn"
                  onClick={() => onAdjustmentsChange(analystAdjustments.filter(entry => entry.id !== item.id))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="awb-card">
        <div className="awb-card-head">
          <div>
            <h3>Caractéristiques du bien</h3>
            <p>Corrigez surface, étage, DPE, etc. pour ajuster vos calculs.</p>
          </div>
          <button className="topbar-btn" onClick={() => setShowEditor(!showEditor)}>
            {showEditor ? 'Masquer' : 'Modifier'}
          </button>
        </div>
        {showEditor && onTargetChange && (
          <TargetEditor target={target} onChange={onTargetChange} />
        )}
      </section>

      <section className="awb-card awb-result-card">
        <div className="awb-card-head">
          <div>
            <h3>Résultat analyste</h3>
            <p>Calcul manuel à partir de votre base et de vos pondérations.</p>
          </div>
        </div>

        <div className="awb-result-layout">
          <div className="awb-result-main">
            <span className="awb-result-kicker">Estimation analyste</span>
            <strong>{fmtPm2(displayedPm2)}</strong>
            <div className="awb-result-price">{fmtPrice(displayedPrice)}</div>
            <small>
              {manualEstimate
                ? `Valeur enregistrée: ${fmtPm2(manualEstimate)}${savedPrice ? ` · ${fmtPrice(savedPrice)}` : ''}`
                : 'Aucune estimation enregistrée'}
            </small>
          </div>

          <div className="awb-result-breakdown">
            <div className="awb-breakdown-row">
              <span>Base marché</span>
              <strong>{fmtPm2(basePm2)}</strong>
            </div>
            {(analystAdjustments || []).map(item => (
              <div key={item.id} className="awb-breakdown-row">
                <span>{adjustmentLabel(item.key)}</span>
                <strong>{item.pct > 0 ? '+' : ''}{item.pct}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="awb-footer">
          <button
            className="topbar-btn topbar-btn-primary"
            disabled={!displayedPm2}
            onClick={() => displayedPm2 && onApplyEstimate(displayedPm2)}
          >
            Utiliser comme estimation
          </button>
        </div>
      </section>
    </div>
  );
}
