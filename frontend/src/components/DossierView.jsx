import { useState, useMemo, useCallback } from 'react';
import DvfTable        from './DvfTable';
import SelogerTable    from './SelogerTable';
import EstimationPanel from './EstimationPanel';
import { computeEstimate, addConfirmation } from '../utils/model';
import { saveModel } from '../utils/storage';
import { fmtDate } from '../utils/formatters';

const STATUS_LABEL = { draft: 'Brouillon', estimated: 'Estimé', confirmed: 'Confirmé' };
const STATUS_CLASS = { draft: 'badge-draft', estimated: 'badge-estimated', confirmed: 'badge-confirmed' };

const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };

export default function DossierView({ dossier, model, onUpdate, onConfirmPrice, onBack }) {
  const [tab, setTab] = useState('dvf'); // 'dvf' | 'seloger'

  const features = dossier.dvfSnapshot?.data?.features || [];

  // Comp toggle — functional update so no stale closure
  const handleToggle = useCallback((idx) => {
    const current = dossier.selectedComps;
    const next = current.includes(idx)
      ? current.filter(i => i !== idx)
      : [...current, idx];
    onUpdate({ ...dossier, selectedComps: next });
  }, [dossier, onUpdate]);

  // Estimation — recomputed whenever comps or model changes
  const estimate = useMemo(
    () => computeEstimate(features, dossier.selectedComps, dossier.target, model.correctionFactor),
    [features, dossier.selectedComps, dossier.target, model.correctionFactor]
  );

  // Confirm actual price → update model and dossier
  const handleConfirm = (basePm2, actualPrice) => {
    const { surfaceM2 } = dossier.target;
    if (!surfaceM2) return;

    const result = addConfirmation(model.samples, {
      basePm2,
      actualPrice,
      surfaceM2,
      dossierId: dossier.id,
      address:   dossier.address,
    });

    if (result.isOutlier) {
      alert(`Ratio inhabituel (${(result.samples.slice(-1)[0].ratio).toFixed(2)}×). Vérifiez le prix saisi.`);
    }

    const updatedModel = {
      ...model,
      samples:          result.samples,
      correctionFactor: result.correctionFactor,
      mae:              result.mae,
      mape:             result.mape,
    };
    saveModel(updatedModel);
    onConfirmPrice(updatedModel);

    onUpdate({
      ...dossier,
      status:    'confirmed',
      confirmed: {
        actualPrice,
        actualPm2:   Math.round(actualPrice / dossier.target.surfaceM2),
        confirmedAt: new Date().toISOString(),
      },
    });
  };

  const t = dossier.target || {};
  const slFetching = dossier.selogerSnapshot === undefined;
  const dvfFetching = dossier.dvfSnapshot === undefined;

  return (
    <div className="workspace">
      {/* Header */}
      <div className="ws-header">
        <button className="back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Dossiers
        </button>

        <div className="ws-title-block">
          <div className="ws-title-row">
            <h2 className="ws-address">{dossier.address}</h2>
            <span className={`status-badge ${STATUS_CLASS[dossier.status] || 'badge-draft'}`}>
              {STATUS_LABEL[dossier.status] || 'Brouillon'}
            </span>
          </div>
          <div className="ws-meta">
            <span>Rayon {RADIUS_LABELS[dossier.radiusMeters] || `${dossier.radiusMeters}m`}</span>
            {t.surfaceM2 && <><span className="ws-sep">·</span><span>{t.surfaceM2} m²</span></>}
            {t.rooms     && <><span className="ws-sep">·</span><span>{t.rooms} pièce{t.rooms > 1 ? 's' : ''}</span></>}
            {t.type      && <><span className="ws-sep">·</span><span>{t.type === 'Apartment' ? 'Appartement' : 'Maison'}</span></>}
            <span className="ws-sep">·</span>
            <span>{fmtDate(dossier.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Body: two columns on desktop */}
      <div className="ws-body">
        {/* Left: data tables */}
        <div className="ws-data">
          {/* Tabs */}
          <div className="ws-tabs">
            <button
              className={`ws-tab${tab === 'dvf' ? ' active' : ''}`}
              onClick={() => setTab('dvf')}
            >
              📊 Ventes passées (DVF)
              {features.length > 0 && <span className="ws-tab-count">{features.length}</span>}
              {dvfFetching && <span className="ws-tab-spin" />}
            </button>
            <button
              className={`ws-tab${tab === 'seloger' ? ' active' : ''}`}
              onClick={() => setTab('seloger')}
            >
              🏘️ Offres actives (SeLoger)
              {dossier.selogerSnapshot?.data?.classifieds?.length > 0 && (
                <span className="ws-tab-count">{dossier.selogerSnapshot.data.classifieds.length}</span>
              )}
              {slFetching && <span className="ws-tab-spin" />}
            </button>
          </div>

          {tab === 'dvf' && (
            <DvfTable
              snapshot={dossier.dvfSnapshot}
              selectedComps={dossier.selectedComps}
              onToggle={handleToggle}
            />
          )}
          {tab === 'seloger' && (
            <SelogerTable snapshot={dossier.selogerSnapshot} />
          )}
        </div>

        {/* Right: estimation */}
        <div className="ws-est">
          <EstimationPanel
            estimate={estimate}
            target={t}
            model={model}
            onConfirm={handleConfirm}
            alreadyConfirmed={dossier.confirmed}
          />
        </div>
      </div>
    </div>
  );
}
