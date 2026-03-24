import { useState, useMemo, useCallback } from 'react';
import { stripSelogerSnapshot } from '../utils/storage';
import DvfTable        from './DvfTable';
import SelogerTable    from './SelogerTable';
import EstimationPanel from './EstimationPanel';
import FiltragView     from './FiltragView';
import AnalyseView     from './AnalyseView';
import GdpView         from './GdpView';
import { normalizeRefs, applyFilters, computeMetrics, suggestRange } from '../utils/edm';
import { computeEstimateFromRefs, addConfirmation } from '../utils/model';
import { saveModel } from '../utils/storage';
import { fmtDate, fmtPm2 } from '../utils/formatters';

const STATUS_LABEL = { draft: 'Brouillon', estimated: 'Estimé', confirmed: 'Confirmé' };
const STATUS_CLASS = { draft: 'badge-draft', estimated: 'badge-estimated', confirmed: 'badge-confirmed' };
const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };

const DEFAULT_FILTERS = {
  ppm2Min: null, ppm2Max: null,
  types: [], sources: ['dvf', 'seloger'],
  areaMin: null, areaMax: null,
  dpe: [],
};

const STEPS_BUILDING = [
  { id: 'collecte', label: 'Collecte',         desc: 'Données DVF & SeLoger' },
  { id: 'filtrage', label: 'Filtrage',          desc: 'Sélection des références' },
  { id: 'analyse',  label: 'Analyse',           desc: 'Étude de marché manuelle' },
  { id: 'gdp',      label: 'Grille de prix',    desc: 'Valorisation lot par lot' },
  { id: 'estim',    label: 'Estimation',        desc: 'ML vs Analyste' },
];

const STEPS_SINGLE = [
  { id: 'collecte', label: 'Collecte',         desc: 'Données DVF & SeLoger' },
  { id: 'filtrage', label: 'Filtrage',          desc: 'Sélection des références' },
  { id: 'analyse',  label: 'Analyse',           desc: 'Étude de marché manuelle' },
  { id: 'estim',    label: 'Estimation',        desc: 'ML vs Analyste' },
];

export default function DossierView({ dossier, model, onUpdate, onConfirmPrice, onBack }) {
  const isBuilding = dossier.analysisMode === 'building';
  const STEPS = isBuilding ? STEPS_BUILDING : STEPS_SINGLE;

  const [tab, setTab] = useState('collecte');
  const [dataTab, setDataTab] = useState('dvf');
  const [slRefetching, setSlRefetching] = useState(false);

  // ── Centralized filter/analysis state ──────────────────────────────
  const [filters, setFilters] = useState(dossier.analystFilters || DEFAULT_FILTERS);
  const [exclusions, setExclusions] = useState(dossier.analystExclusions || {});
  const [temporal, setTemporal] = useState({ enabled: false, w0_6: 1.2, w6_12: 1.0, w12_24: 0.8, w24plus: 0.6 });
  const [tauxNego, setTauxNego] = useState(5);
  const [prixPivot, setPrixPivot] = useState(dossier.prixPivot || null);
  const [manualEstimate, setManualEstimate] = useState(dossier.manualEstimate || null);
  const [iqrApplied, setIqrApplied] = useState(false);

  const effectiveTaux = tauxNego / 100;

  // ── Derived data (shared across tabs) ──────────────────────────────
  const allRefs = useMemo(() => {
    const refs = normalizeRefs(dossier.dvfSnapshot, dossier.selogerSnapshot, effectiveTaux);
    return refs.map(r => ({ ...r, excluded: exclusions[r.id] || false }));
  }, [dossier.dvfSnapshot, dossier.selogerSnapshot, effectiveTaux, exclusions]);

  const suggested = useMemo(() => suggestRange(allRefs.filter(r => !r.excluded)), [allRefs]);

  // Auto-apply IQR on first load
  useMemo(() => {
    if (!iqrApplied && suggested) {
      setFilters(p => ({ ...p, ppm2Min: suggested.min, ppm2Max: suggested.max }));
      setIqrApplied(true);
    }
  }, [suggested, iqrApplied]);

  const filtered = useMemo(() => applyFilters(allRefs, filters), [allRefs, filters]);
  const metrics = useMemo(
    () => computeMetrics(allRefs, filtered, filters, effectiveTaux, temporal.enabled ? temporal : null),
    [allRefs, filtered, filters, effectiveTaux, temporal]
  );

  // ML estimate from filtered refs
  const mlEstimate = useMemo(
    () => computeEstimateFromRefs(filtered, dossier.target, model.correctionFactor),
    [filtered, dossier.target, model.correctionFactor]
  );

  const features = dossier.dvfSnapshot?.data?.features || [];
  const t = dossier.target || {};
  const slCount = dossier.selogerSnapshot?.data?.classifieds?.length || 0;
  const dvfCount = features.length;

  // ── Persist filters/exclusions back to dossier ─────────────────────
  const persistFilters = useCallback((f) => {
    setFilters(f);
    onUpdate({ ...dossier, analystFilters: f });
  }, [dossier, onUpdate]);

  const persistExclusions = useCallback((exc) => {
    setExclusions(exc);
    onUpdate({ ...dossier, analystExclusions: exc });
  }, [dossier, onUpdate]);

  // ── Handlers ───────────────────────────────────────────────────────
  const handlePivotChange = useCallback((pivot) => {
    setPrixPivot(pivot);
    onUpdate({ ...dossier, prixPivot: pivot });
  }, [dossier, onUpdate]);

  const handleManualEstimate = useCallback((val) => {
    setManualEstimate(val);
    onUpdate({ ...dossier, manualEstimate: val });
  }, [dossier, onUpdate]);

  const handleGdpUpdate = useCallback((updated) => {
    onUpdate(updated);
  }, [onUpdate]);

  const handleConfirm = useCallback((basePm2, actualPrice) => {
    const { surfaceM2 } = dossier.target;
    if (!surfaceM2) return;
    const result = addConfirmation(model.samples, { basePm2, actualPrice, surfaceM2, dossierId: dossier.id, address: dossier.address });
    if (result.isOutlier) alert(`Ratio inhabituel (${result.samples.slice(-1)[0].ratio.toFixed(2)}×). Vérifiez le prix saisi.`);
    const updatedModel = { ...model, samples: result.samples, correctionFactor: result.correctionFactor, mae: result.mae, mape: result.mape };
    saveModel(updatedModel);
    onConfirmPrice(updatedModel);
    onUpdate({ ...dossier, status: 'confirmed', confirmed: { actualPrice, actualPm2: Math.round(actualPrice / surfaceM2), confirmedAt: new Date().toISOString() } });
  }, [dossier, model, onUpdate, onConfirmPrice]);

  const handleRefetchSeloger = useCallback(async () => {
    if (slRefetching || !dossier.lat || !dossier.lng) return;
    setSlRefetching(true);
    try {
      const res = await fetch('/api/seloger/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: dossier.lat, lng: dossier.lng, radius: dossier.radiusMeters, filters: { size: 100 } }),
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

  // ── Step completion states ─────────────────────────────────────────
  const stepState = (id) => {
    if (id === 'collecte' && (dvfCount > 0 || slCount > 0)) return 'completed';
    if (id === 'filtrage' && filtered.length > 0 && filtered.length < allRefs.length) return 'completed';
    if (id === 'analyse' && prixPivot) return 'completed';
    if (id === 'gdp' && dossier.lots?.length > 0) return 'completed';
    if (id === 'estim' && dossier.confirmed) return 'completed';
    return '';
  };

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
            <span className="ws-sep">·</span>
            <span className={`status-badge ${isBuilding ? 'badge-estimated' : 'badge-draft'}`}>
              {isBuilding ? 'Immeuble' : 'Bien unique'}
            </span>
          </div>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="step-nav">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            className={`step-nav-item ${tab === s.id ? 'active' : ''} ${stepState(s.id)}`}
            onClick={() => setTab(s.id)}
          >
            <span className="step-num">{stepState(s.id) === 'completed' ? '✓' : String(i + 1)}</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
              <span className="step-label">{s.label}</span>
              <span style={{ fontSize: '.65rem', fontWeight: 400, opacity: .7 }}>{s.desc}</span>
            </div>
            {i < STEPS.length - 1 && <span className="step-arrow" />}
          </button>
        ))}
      </div>

      {/* Quick stats bar */}
      <div className="ws-quick-stats">
        <div className="wqs-item">
          <span className="wqs-val">{dvfCount}</span>
          <span className="wqs-lbl">Transactions DVF</span>
        </div>
        <div className="wqs-item">
          <span className="wqs-val">{slCount}</span>
          <span className="wqs-lbl">Annonces SeLoger</span>
        </div>
        <div className="wqs-item">
          <span className="wqs-val">{filtered.length}<span style={{ fontSize: '.75rem', fontWeight: 400, color: 'var(--text-3)' }}> / {allRefs.length}</span></span>
          <span className="wqs-lbl">Refs retenues</span>
        </div>
        {prixPivot && (
          <div className="wqs-item wqs-highlight">
            <span className="wqs-val">{Math.round(prixPivot).toLocaleString('fr-FR')} €/m²</span>
            <span className="wqs-lbl">Prix Pivot</span>
          </div>
        )}
        {mlEstimate && (
          <div className="wqs-item wqs-highlight">
            <span className="wqs-val">{Math.round(mlEstimate.correctedPm2).toLocaleString('fr-FR')} €/m²</span>
            <span className="wqs-lbl">Estimation ML</span>
          </div>
        )}
        {isBuilding && dossier.lots?.length > 0 && (
          <div className="wqs-item">
            <span className="wqs-val">{dossier.lots.length}</span>
            <span className="wqs-lbl">Lots saisis</span>
          </div>
        )}
      </div>

      {/* ── Tab: Collecte ── */}
      {tab === 'collecte' && (
        <div className="ws-data">
          <div className="ws-tabs">
            <button className={`ws-tab ${dataTab === 'dvf' ? 'active' : ''}`} onClick={() => setDataTab('dvf')}>
              DVF — Transactions notariées {dvfCount > 0 && <span className="ws-tab-count">{dvfCount}</span>}
            </button>
            <button className={`ws-tab ${dataTab === 'seloger' ? 'active' : ''}`} onClick={() => setDataTab('seloger')}>
              SeLoger — Offres actives {slCount > 0 && <span className="ws-tab-count">{slCount}</span>}
            </button>
          </div>
          {dataTab === 'dvf' && <DvfTable snapshot={dossier.dvfSnapshot} selectedComps={dossier.selectedComps || []} onToggle={() => {}} />}
          {dataTab === 'seloger' && <SelogerTable snapshot={dossier.selogerSnapshot} onRefetch={handleRefetchSeloger} refetching={slRefetching} />}
        </div>
      )}

      {/* ── Tab: Filtrage ── */}
      {tab === 'filtrage' && (
        <FiltragView
          allRefs={allRefs}
          filters={filters}
          onFiltersChange={persistFilters}
          exclusions={exclusions}
          onExclusionsChange={persistExclusions}
          filtered={filtered}
          metrics={metrics}
          suggested={suggested}
          onTemporalChange={setTemporal}
        />
      )}

      {/* ── Tab: Analyse ── */}
      {tab === 'analyse' && (
        <AnalyseView
          dossier={dossier}
          filteredRefs={filtered}
          metrics={metrics}
          prixPivot={prixPivot}
          onPivotChange={handlePivotChange}
          isBuilding={isBuilding}
          onManualEstimate={handleManualEstimate}
        />
      )}

      {/* ── Tab: GDP (building only) ── */}
      {tab === 'gdp' && (
        <GdpView
          dossier={dossier}
          prixPivot={prixPivot}
          onUpdate={handleGdpUpdate}
        />
      )}

      {/* ── Tab: Estimation ── */}
      {tab === 'estim' && (
        <div className="ws-estim-layout">
          <EstimationPanel
            estimate={mlEstimate}
            target={t}
            model={model}
            onConfirm={handleConfirm}
            alreadyConfirmed={dossier.confirmed}
            manualEstimate={manualEstimate}
            prixPivot={prixPivot}
            nFilteredRefs={filtered.length}
          />
        </div>
      )}
    </div>
  );
}
