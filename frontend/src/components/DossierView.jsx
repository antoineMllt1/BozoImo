import { useState, useMemo, useCallback, useRef } from 'react';
import { stripSelogerSnapshot } from '../utils/storage';
import DvfTable        from './DvfTable';
import SelogerTable    from './SelogerTable';
import EstimationPanel from './EstimationPanel';
import EdmView         from './EdmView';
import GdpView         from './GdpView';
import { computeEstimate, addConfirmation } from '../utils/model';
import { saveModel } from '../utils/storage';
import { fmtDate } from '../utils/formatters';

const STATUS_LABEL = { draft: 'Brouillon', estimated: 'Estimé', confirmed: 'Confirmé' };
const STATUS_CLASS = { draft: 'badge-draft', estimated: 'badge-estimated', confirmed: 'badge-confirmed' };
const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };

export default function DossierView({ dossier, model, onUpdate, onConfirmPrice, onBack }) {
  const [tab, setTab] = useState('edm');
  const [dataTab, setDataTab] = useState('dvf');
  const [prixPivotEdm, setPrixPivotEdm] = useState(dossier.prixPivot || null);
  const [slRefetching, setSlRefetching] = useState(false);

  const features = dossier.dvfSnapshot?.data?.features || [];

  const handleToggle = useCallback((idx) => {
    const next = dossier.selectedComps.includes(idx)
      ? dossier.selectedComps.filter(i => i !== idx)
      : [...dossier.selectedComps, idx];
    onUpdate({ ...dossier, selectedComps: next });
  }, [dossier, onUpdate]);

  const estimate = useMemo(
    () => computeEstimate(features, dossier.selectedComps, dossier.target, model.correctionFactor),
    [features, dossier.selectedComps, dossier.target, model.correctionFactor]
  );

  const handleConfirm = (basePm2, actualPrice) => {
    const { surfaceM2 } = dossier.target;
    if (!surfaceM2) return;
    const result = addConfirmation(model.samples, { basePm2, actualPrice, surfaceM2, dossierId: dossier.id, address: dossier.address });
    if (result.isOutlier) alert(`Ratio inhabituel (${result.samples.slice(-1)[0].ratio.toFixed(2)}×). Vérifiez le prix saisi.`);
    const updatedModel = { ...model, samples: result.samples, correctionFactor: result.correctionFactor, mae: result.mae, mape: result.mape };
    saveModel(updatedModel);
    onConfirmPrice(updatedModel);
    onUpdate({ ...dossier, status: 'confirmed', confirmed: { actualPrice, actualPm2: Math.round(actualPrice / surfaceM2), confirmedAt: new Date().toISOString() } });
  };

  const handlePivotChange = (pivot) => {
    setPrixPivotEdm(pivot);
    onUpdate({ ...dossier, prixPivot: pivot });
  };

  const handleGdpUpdate = (updated) => {
    onUpdate(updated);
  };

  const handleRefetchSeloger = useCallback(async () => {
    if (slRefetching || !dossier.lat || !dossier.lng) return;
    setSlRefetching(true);
    try {
      const res = await fetch('/api/seloger/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: dossier.lat, lng: dossier.lng, radius: dossier.radiusMeters, filters: { size: 50 } }),
      });
      const data = await res.json();
      const selogerSnapshot = data?.error
        ? { error: data.error }
        : { data: stripSelogerSnapshot(data), fetchedAt: new Date().toISOString() };
      onUpdate({ ...dossier, selogerSnapshot });
    } catch (e) {
      onUpdate({ ...dossier, selogerSnapshot: { error: e.message } });
    } finally {
      setSlRefetching(false);
    }
  }, [dossier, slRefetching, onUpdate]);

  const t = dossier.target || {};
  const slCount = dossier.selogerSnapshot?.data?.classifieds?.length || 0;
  const dvfCount = features.length;

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
            {t.rooms && <><span className="ws-sep">·</span><span>{t.rooms} pièce{t.rooms > 1 ? 's' : ''}</span></>}
            {t.type && <><span className="ws-sep">·</span><span>{t.type === 'Apartment' ? 'Appartement' : 'Maison'}</span></>}
            <span className="ws-sep">·</span><span>{fmtDate(dossier.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ws-tabs ws-tabs-main">
        <button className={`ws-tab ${tab === 'edm' ? 'active' : ''}`} onClick={() => setTab('edm')}>
          <span className="ws-tab-step">1</span> Analyse de marché
          <span className="ws-tab-count">{dvfCount + slCount}</span>
        </button>
        <button className={`ws-tab ${tab === 'gdp' ? 'active' : ''}`} onClick={() => setTab('gdp')}>
          <span className="ws-tab-step">2</span> Grille de prix
          {(dossier.lots?.length > 0) && <span className="ws-tab-count">{dossier.lots.length}</span>}
        </button>
        <button className={`ws-tab ws-tab-secondary ${tab === 'donnees' ? 'active' : ''}`} onClick={() => setTab('donnees')}>
          📊 Données brutes
        </button>
        <button className={`ws-tab ws-tab-secondary ${tab === 'estim' ? 'active' : ''}`} onClick={() => setTab('estim')}>
          🔢 Estimation ML
        </button>
      </div>

      {tab === 'edm' && (
        <EdmView
          dossier={dossier}
          tauxNego={0.05}
          onPivotChange={handlePivotChange}
        />
      )}

      {tab === 'gdp' && (
        <GdpView
          dossier={dossier}
          prixPivot={prixPivotEdm}
          onUpdate={handleGdpUpdate}
        />
      )}

      {tab === 'donnees' && (
        <div className="ws-data">
          <div className="ws-tabs">
            <button className={`ws-tab ${dataTab === 'dvf' ? 'active' : ''}`} onClick={() => setDataTab('dvf')}>
              📊 DVF {dvfCount > 0 && <span className="ws-tab-count">{dvfCount}</span>}
            </button>
            <button className={`ws-tab ${dataTab === 'seloger' ? 'active' : ''}`} onClick={() => setDataTab('seloger')}>
              🏘️ SeLoger {slCount > 0 && <span className="ws-tab-count">{slCount}</span>}
            </button>
          </div>
          {dataTab === 'dvf' && <DvfTable snapshot={dossier.dvfSnapshot} selectedComps={dossier.selectedComps} onToggle={handleToggle} />}
          {dataTab === 'seloger' && <SelogerTable snapshot={dossier.selogerSnapshot} onRefetch={handleRefetchSeloger} refetching={slRefetching} />}
        </div>
      )}

      {tab === 'estim' && (
        <div className="ws-body">
          <div className="ws-data">
            <div className="ws-tabs">
              <button className={`ws-tab${true ? ' active' : ''}`}>📊 DVF {dvfCount > 0 && <span className="ws-tab-count">{dvfCount}</span>}</button>
            </div>
            <DvfTable snapshot={dossier.dvfSnapshot} selectedComps={dossier.selectedComps} onToggle={handleToggle} />
          </div>
          <div className="ws-est">
            <EstimationPanel estimate={estimate} target={t} model={model} onConfirm={handleConfirm} alreadyConfirmed={dossier.confirmed} />
          </div>
        </div>
      )}
    </div>
  );
}
