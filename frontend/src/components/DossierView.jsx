import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ANALYST_FILTERS } from '../utils/dossiers';
import { stripDvfSnapshot, stripSelogerSnapshot } from '../utils/storage';
import { normalizeRefs, applyFilters, computeMetrics, suggestRange } from '../utils/edm';
import { addConfirmation, computeAreaScores, computeEstimateFromRefs } from '../utils/model';
import { saveModel } from '../utils/storage';
import { exportDossierPdf } from '../utils/report';
import { fmtDate } from '../utils/formatters';
import { estateTypesForTargetType, itemTypesForTargetType, matchesTargetPropertyType } from '../utils/propertyType';
import DataWorkbench from './DataWorkbench';
import AnalystWorkbench from './AnalystWorkbench';
import AlgoWorkbench from './AlgoWorkbench';
import NeighborhoodWorkbench from './NeighborhoodWorkbench';
import GdpView from './GdpView';

const STATUS_LABEL = {
  draft: 'Brouillon',
  in_progress: 'En cours',
  estimated: 'Estimé',
  confirmed: 'Confirmé',
  archived: 'Archivé',
};

const STATUS_CLASS = {
  draft: 'badge-draft',
  in_progress: 'badge-estimated',
  estimated: 'badge-estimated',
  confirmed: 'badge-confirmed',
  archived: 'badge-archived',
};

const RADIUS_LABELS = { 250: '250m', 500: '500m', 1000: '1km', 2000: '2km', 5000: '5km' };
const METERS_PER_DEG_LAT = 111320;

function guessWorkStatus(status) {
  return status === 'draft' || status === 'archived' ? 'in_progress' : status;
}

function radiusToBounds(lat, lng, radiusM) {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

async function requestNeighborhoodProfile(payload) {
  const endpoints = ['/api/villesavivre/profile', '/api/villesavivre/search'];
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const error = new Error(data?.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return data;
    } catch (error) {
      lastError = error;
      if (error?.status !== 404) break;
    }
  }

  throw lastError || new Error('Route Villes a vivre indisponible');
}

export default function DossierView({ dossier, model, onUpdate, onConfirmPrice, onBack }) {
  const isBuilding = dossier.analysisMode === 'building';
  const target = dossier.target || {};

  const [tab, setTab] = useState('data');
  const [dataTab, setDataTab] = useState('retained');
  const [slRefetching, setSlRefetching] = useState(false);
  const [reloadingRadius, setReloadingRadius] = useState(false);
  const [filters, setFilters] = useState(dossier.analystFilters || DEFAULT_ANALYST_FILTERS);
  const [exclusions, setExclusions] = useState(dossier.analystExclusions || {});
  const [analystBasePm2, setAnalystBasePm2] = useState(dossier.analystBasePm2 ?? dossier.prixPivot ?? null);
  const [analystAdjustments, setAnalystAdjustments] = useState(dossier.analystAdjustments || []);
  const [manualEstimate, setManualEstimate] = useState(dossier.manualEstimate || null);
  const [pendingRadius, setPendingRadius] = useState(dossier.radiusMeters || 500);
  const [hoveredRefId, setHoveredRefId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [neighborhoodReloading, setNeighborhoodReloading] = useState(false);
  const [neighborhoodError, setNeighborhoodError] = useState('');
  const [iqrApplied, setIqrApplied] = useState(
    dossier.analystFilters?.ppm2Min != null || dossier.analystFilters?.ppm2Max != null
  );

  const exportMapRef = useRef(null);
  const activeDossierIdRef = useRef(dossier.id);

  // Re-seed local editing state only when opening a different dossier.
  useEffect(() => {
    if (activeDossierIdRef.current === dossier.id) return;
    activeDossierIdRef.current = dossier.id;
    setFilters(dossier.analystFilters || DEFAULT_ANALYST_FILTERS);
    setExclusions(dossier.analystExclusions || {});
    setAnalystBasePm2(dossier.analystBasePm2 ?? dossier.prixPivot ?? null);
    setAnalystAdjustments(dossier.analystAdjustments || []);
    setManualEstimate(dossier.manualEstimate || null);
    setPendingRadius(dossier.radiusMeters || 500);
    setDataTab('retained');
    setHoveredRefId(null);
    setNeighborhoodError('');
    setIqrApplied(dossier.analystFilters?.ppm2Min != null || dossier.analystFilters?.ppm2Max != null);
  }, [dossier]);

  const persistDossier = useCallback((patch, nextStatus = null) => {
    const status = nextStatus || dossier.status;
    onUpdate({
      ...dossier,
      ...patch,
      archivedAt: status === 'archived'
        ? (patch.archivedAt || dossier.archivedAt || new Date().toISOString())
        : (Object.prototype.hasOwnProperty.call(patch, 'archivedAt') ? patch.archivedAt : null),
      status,
    });
  }, [dossier, onUpdate]);

  const effectiveTaux = (filters.negotiationRate ?? 5) / 100;
  const allRefs = useMemo(() => {
    const refs = normalizeRefs(dossier.dvfSnapshot, dossier.selogerSnapshot, effectiveTaux);
    return refs
      .map(ref => ({ ...ref, excluded: exclusions[ref.id] || false }))
      .filter(ref => matchesTargetPropertyType(ref, dossier.target?.type || null));
  }, [dossier.dvfSnapshot, dossier.selogerSnapshot, dossier.target?.type, effectiveTaux, exclusions]);

  const suggested = useMemo(() => suggestRange(allRefs.filter(ref => !ref.excluded)), [allRefs]);

  useEffect(() => {
    if (iqrApplied || !suggested) return;
    if (filters.ppm2Min != null || filters.ppm2Max != null) return;
    const nextFilters = { ...filters, ppm2Min: suggested.min, ppm2Max: suggested.max };
    setFilters(nextFilters);
    setIqrApplied(true);
    persistDossier({ analystFilters: nextFilters }, guessWorkStatus(dossier.status));
  }, [dossier.status, filters, iqrApplied, persistDossier, suggested]);

  const filtered = useMemo(() => applyFilters(allRefs, filters, dossier.target?.type || null), [allRefs, dossier.target?.type, filters]);
  const metrics = useMemo(
    () => computeMetrics(allRefs, filtered, filters, effectiveTaux, null, dossier.analystSourceWeights || { dvf: 1, seloger: 1 }),
    [allRefs, dossier.analystSourceWeights, effectiveTaux, filtered, filters]
  );

  const mlEstimate = useMemo(
    () => computeEstimateFromRefs(
      filtered,
      dossier.target,
      model.correctionFactor,
      dossier.areaContext || null,
      { lat: dossier.lat, lng: dossier.lng }
    ),
    [filtered, dossier.areaContext, dossier.lat, dossier.lng, dossier.target, model.correctionFactor]
  );

  const areaScores = mlEstimate?.areaScores || computeAreaScores(dossier.areaContext || null);

  const persistFilters = useCallback((nextFilters) => {
    setFilters(nextFilters);
    setIqrApplied(true);
    persistDossier({ analystFilters: nextFilters }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const persistExclusions = useCallback((nextExclusions) => {
    setExclusions(nextExclusions);
    persistDossier({ analystExclusions: nextExclusions }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const handleAnalystBaseChange = useCallback((value) => {
    setAnalystBasePm2(value);
    persistDossier({ analystBasePm2: value }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const handleAnalystAdjustmentsChange = useCallback((nextAdjustments) => {
    setAnalystAdjustments(nextAdjustments);
    persistDossier({ analystAdjustments: nextAdjustments }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const handleReloadNeighborhood = useCallback(async () => {
    if (neighborhoodReloading || dossier.lat == null || dossier.lng == null) return;

    setNeighborhoodError('');
    setNeighborhoodReloading(true);
    try {
      const data = await requestNeighborhoodProfile({
        lat: dossier.lat,
        lng: dossier.lng,
        address: dossier.geocodedAddress || dossier.address || null,
      });
      if (!data?.success || !data?.villesAVivre) return;
      persistDossier({
        areaContext: {
          ...(dossier.areaContext || {}),
          fetchedAt: dossier.areaContext?.fetchedAt || new Date().toISOString(),
          location: dossier.areaContext?.location || { lat: dossier.lat, lng: dossier.lng },
          villesAVivre: data.villesAVivre,
        },
      }, guessWorkStatus(dossier.status));
    } catch (error) {
      if (error?.status === 404) {
        setNeighborhoodError('API Villes a vivre introuvable. Redemarre le backend.');
      } else {
        setNeighborhoodError(error.message || 'Erreur Villes a vivre');
      }
    } finally {
      setNeighborhoodReloading(false);
    }
  }, [dossier.areaContext, dossier.lat, dossier.lng, dossier.status, neighborhoodReloading, persistDossier]);

  const handleManualEstimate = useCallback((value) => {
    setManualEstimate(value);
    persistDossier({ manualEstimate: value }, 'estimated');
  }, [persistDossier]);

  const handleConfirm = useCallback((basePm2, actualPrice) => {
    const surfaceM2 = dossier.target?.surfaceM2;
    if (!surfaceM2) return;

    const result = addConfirmation(model.samples, {
      basePm2,
      actualPrice,
      surfaceM2,
      dossierId: dossier.id,
      address: dossier.address,
    });

    const updatedModel = {
      ...model,
      samples: result.samples,
      correctionFactor: result.correctionFactor,
      mae: result.mae,
      mape: result.mape,
    };

    saveModel(updatedModel);
    onConfirmPrice(updatedModel);
    persistDossier({
      confirmed: {
        actualPrice,
        actualPm2: Math.round(actualPrice / surfaceM2),
        confirmedAt: new Date().toISOString(),
      },
    }, 'confirmed');
  }, [dossier, model, onConfirmPrice, persistDossier]);

  const handleReloadMarketData = useCallback(async () => {
    if (reloadingRadius || !dossier.lat || !dossier.lng) return;

    const nextRadius = pendingRadius || dossier.radiusMeters || 500;
    setReloadingRadius(true);

    try {
      const [selogerResult, dvfResult] = await Promise.allSettled([
        fetch('/api/seloger/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: dossier.lat,
            lng: dossier.lng,
            radius: nextRadius,
            filters: { size: 100, estateTypes: estateTypesForTargetType(dossier.target?.type) },
          }),
        }).then(response => response.json()),
        fetch('/api/immobilier/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bounds: radiusToBounds(dossier.lat, dossier.lng, nextRadius),
            roomCount: [],
            itemTypes: itemTypesForTargetType(dossier.target?.type),
          }),
        }).then(response => response.json()),
      ]);

      const nextExclusions = {};
      setExclusions(nextExclusions);
      setHoveredRefId(null);
      setDataTab('retained');

      const selogerSnapshot =
        selogerResult.status === 'fulfilled' && !selogerResult.value?.error
          ? {
              data: stripSelogerSnapshot(selogerResult.value),
              fetchedAt: new Date().toISOString(),
              radiusMeters: nextRadius,
            }
          : {
              error:
                selogerResult.status === 'rejected'
                  ? selogerResult.reason.message
                  : selogerResult.value?.error || 'Erreur SeLoger',
            };

      let dvfRaw = null;
      if (dvfResult.status === 'fulfilled' && dvfResult.value?.success) {
        dvfRaw = stripDvfSnapshot(dvfResult.value.data);
      }

      const dvfSnapshot = dvfRaw
        ? { data: dvfRaw, fetchedAt: new Date().toISOString(), radiusMeters: nextRadius }
        : {
            error:
              dvfResult.status === 'rejected'
                ? dvfResult.reason.message
                : dvfResult.value?.error || 'Erreur DVF',
          };

      persistDossier({
        radiusMeters: nextRadius,
        analystExclusions: nextExclusions,
        selectedComps: [],
        dvfSnapshot,
        selogerSnapshot,
      }, guessWorkStatus(dossier.status));
    } finally {
      setReloadingRadius(false);
    }
  }, [dossier, pendingRadius, persistDossier, reloadingRadius]);

  const handleRefetchSeloger = useCallback(async () => {
    if (slRefetching || !dossier.lat || !dossier.lng) return;
    setSlRefetching(true);
    try {
      const response = await fetch('/api/seloger/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: dossier.lat,
          lng: dossier.lng,
          radius: dossier.radiusMeters,
          filters: { size: 100, estateTypes: estateTypesForTargetType(dossier.target?.type) },
        }),
      });
      const data = await response.json();
      const selogerSnapshot = data?.error
        ? { error: data.error }
        : { data: stripSelogerSnapshot(data), fetchedAt: new Date().toISOString() };
      persistDossier({ selogerSnapshot }, guessWorkStatus(dossier.status));
    } catch (error) {
      persistDossier({ selogerSnapshot: { error: error.message } }, guessWorkStatus(dossier.status));
    } finally {
      setSlRefetching(false);
    }
  }, [dossier, persistDossier, slRefetching]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await exportDossierPdf({
        dossier,
        estimate: mlEstimate,
        metrics,
        filteredRefs: filtered,
        trend: null,
        logoDataUrl: dossier.reportBrandLogo?.dataUrl || null,
        chartNodes: { mapNode: tab === 'data' ? exportMapRef.current : null },
      });
    } finally {
      setExporting(false);
    }
  }, [dossier, filtered, metrics, mlEstimate, tab]);

  const summaryCards = [
    { label: 'Références retenues', value: filtered.length },
    { label: 'DVF', value: allRefs.filter(ref => ref.source === 'dvf').length },
    { label: 'SeLoger', value: allRefs.filter(ref => ref.source === 'seloger').length },
    { label: 'Algo', value: mlEstimate ? `${Math.round(mlEstimate.correctedPm2).toLocaleString('fr-FR')} €/m²` : '—' },
  ];

  return (
    <div className="workspace workspace-clean">
      <div className="ws-header ws-header-compact">
        <button className="back-btn" onClick={onBack}>Dossiers</button>
        <div className="ws-title-block">
          <div className="ws-title-row">
            <h2 className="ws-address">{dossier.address}</h2>
            <span className={`status-badge ${STATUS_CLASS[dossier.status] || 'badge-draft'}`}>
              {STATUS_LABEL[dossier.status] || 'Brouillon'}
            </span>
          </div>
          <div className="ws-meta">
            <span>{RADIUS_LABELS[dossier.radiusMeters] || `${dossier.radiusMeters}m`}</span>
            {target.surfaceM2 && <><span className="ws-sep">·</span><span>{target.surfaceM2} m²</span></>}
            {target.rooms && <><span className="ws-sep">·</span><span>{target.rooms}P</span></>}
            {target.type && <><span className="ws-sep">·</span><span>{target.type === 'House' ? 'Maison' : 'Appartement'}</span></>}
            <span className="ws-sep">·</span>
            <span>{fmtDate(dossier.createdAt)}</span>
          </div>
        </div>
        <div className="ws-header-actions">
          <select
            className="ws-status-select"
            value={dossier.status}
            onChange={(event) => persistDossier({}, event.target.value)}
          >
            <option value="draft">Brouillon</option>
            <option value="in_progress">En cours</option>
            <option value="estimated">Estimé</option>
            <option value="confirmed">Confirmé</option>
            <option value="archived">Archivé</option>
          </select>
          <button className="topbar-btn topbar-btn-primary" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? 'Génération...' : 'Exporter PDF'}
          </button>
        </div>
      </div>

      <div className="ws-summary-row">
        {summaryCards.map(card => (
          <div key={card.label} className="ws-summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="clean-tabs">
        <button className={`clean-tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>Données</button>
        <button className={`clean-tab ${tab === 'neighborhood' ? 'active' : ''}`} onClick={() => setTab('neighborhood')}>Quartier</button>
        <button className={`clean-tab ${tab === 'analyst' ? 'active' : ''}`} onClick={() => setTab('analyst')}>Analyste</button>
        <button className={`clean-tab ${tab === 'algo' ? 'active' : ''}`} onClick={() => setTab('algo')}>Algo</button>
        {isBuilding && (
          <button className={`clean-tab ${tab === 'gdp' ? 'active' : ''}`} onClick={() => setTab('gdp')}>Grille</button>
        )}
      </div>

      <div ref={exportMapRef}>
        {tab === 'data' && (
          <DataWorkbench
            dossier={dossier}
            allRefs={allRefs}
            filteredRefs={filtered}
            filters={filters}
            onFiltersChange={persistFilters}
            suggested={suggested}
            exclusions={exclusions}
            onExclusionsChange={persistExclusions}
            dataTab={dataTab}
            onDataTabChange={setDataTab}
            hoveredRefId={hoveredRefId}
            onHoverRef={setHoveredRefId}
            onRefetchSeloger={handleRefetchSeloger}
            slRefetching={slRefetching}
            targetType={dossier.target?.type || null}
            pendingRadius={pendingRadius}
            onPendingRadiusChange={setPendingRadius}
            onReloadRadius={handleReloadMarketData}
            reloadingRadius={reloadingRadius}
          />
        )}

        {tab === 'neighborhood' && (
          <NeighborhoodWorkbench
            areaContext={dossier.areaContext || null}
            areaScores={areaScores}
            target={target}
            onReload={handleReloadNeighborhood}
            reloading={neighborhoodReloading}
            canReload={dossier.lat != null && dossier.lng != null}
            error={neighborhoodError}
          />
        )}

        {tab === 'analyst' && (
          <AnalystWorkbench
            metrics={metrics}
            areaScores={areaScores}
            target={target}
            analystBasePm2={analystBasePm2}
            analystAdjustments={analystAdjustments}
            manualEstimate={manualEstimate}
            onBaseChange={handleAnalystBaseChange}
            onAdjustmentsChange={handleAnalystAdjustmentsChange}
            onApplyEstimate={handleManualEstimate}
          />
        )}

        {tab === 'algo' && (
          <AlgoWorkbench
            estimate={mlEstimate}
            filteredRefs={filtered}
            model={model}
            target={target}
            onConfirm={handleConfirm}
            alreadyConfirmed={dossier.confirmed}
          />
        )}

        {tab === 'gdp' && isBuilding && (
          <GdpView
            dossier={dossier}
            prixPivot={manualEstimate || analystBasePm2}
            onUpdate={(updated) => onUpdate({ ...updated, status: guessWorkStatus(dossier.status) })}
          />
        )}
      </div>
    </div>
  );
}
