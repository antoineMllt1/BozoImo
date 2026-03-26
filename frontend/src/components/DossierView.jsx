import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ANALYST_FILTERS } from '../utils/dossiers';
import {
  stripBuildingProfile,
  stripCadastreSnapshot,
  stripCastorusSnapshot,
  stripDpeSnapshot,
  stripDvfPlusSnapshot,
  stripDvfSnapshot,
  stripMarketIndicatorsSnapshot,
  stripPappersSnapshot,
  stripRiskProfile,
  stripSelogerSnapshot,
} from '../utils/storage';
import { normalizeRefs, applyFilters, computeMetrics, suggestRange } from '../utils/edm';
import { addConfirmation, computeAreaScores, computeEstimateFromRefs } from '../utils/model';
import { saveModel } from '../utils/storage';
import { exportDossierPdf } from '../utils/report';
import { fmtDate } from '../utils/formatters';
import { estateTypesForTargetType, itemTypesForTargetType, matchesTargetPropertyType } from '../utils/propertyType';
import { buildTrendFromRefs } from '../utils/trend';
import { computeMarketPosition, computeNegotiationScore, generateArguments, generateSignals, suggestOfferRange } from '../utils/negotiation';
import { pickBestSelogerClassified } from '../utils/enrichment';
import DataWorkbench from './DataWorkbench';
import AnalystWorkbench from './AnalystWorkbench';
import AlgoWorkbench from './AlgoWorkbench';
import NeighborhoodWorkbench from './NeighborhoodWorkbench';
import SyntheseView from './SyntheseView';
import Dropdown from './Dropdown';
import GdpView from './GdpView';
import PappersPanel from './PappersPanel';
import CastorusPanel from './CastorusPanel';
import DvfPlusPanel from './DvfPlusPanel';
import RiskPanel from './RiskPanel';
import DPEPanel from './DPEPanel';
import CadastrePanel from './CadastrePanel';
import NegotiationDashboard from './NegotiationDashboard';
import InvestmentPanel from './InvestmentPanel';

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
  const [castorusLoading, setCastorusLoading] = useState(false);
  const [castorusError, setCastorusError] = useState('');
  const [pappersLoading, setPappersLoading] = useState(false);
  const [pappersError, setPappersError] = useState('');
  const [infoBackfilling, setInfoBackfilling] = useState(false);
  const [infoBackfillError, setInfoBackfillError] = useState('');
  const [disabledFactors, setDisabledFactors] = useState(dossier.disabledFactors || {});
  const [iqrApplied, setIqrApplied] = useState(
    dossier.analystFilters?.ppm2Min != null || dossier.analystFilters?.ppm2Max != null
  );

  const exportMapRef = useRef(null);
  const activeDossierIdRef = useRef(dossier.id);
  const infoBackfillAttemptedRef = useRef({});

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
    setCastorusError('');
    setPappersError('');
    setInfoBackfillError('');
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

  const trend = useMemo(
    () => buildTrendFromRefs(allRefs, mlEstimate?.correctedPm2),
    [allRefs, mlEstimate?.correctedPm2]
  );

  const bestSelogerListing = useMemo(() => pickBestSelogerClassified(dossier), [dossier]);
  const negotiationSignals = useMemo(() => generateSignals(dossier), [dossier]);
  const negotiationScore = useMemo(() => computeNegotiationScore(negotiationSignals), [negotiationSignals]);
  const negotiationArguments = useMemo(() => generateArguments(negotiationSignals), [negotiationSignals]);
  const suggestedOfferRange = useMemo(() => suggestOfferRange(dossier, negotiationSignals), [dossier, negotiationSignals]);
  const marketPosition = useMemo(() => computeMarketPosition(dossier), [dossier]);

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

  const fetchEnrichData = useCallback(async (lat, lng) => {
    try {
      const response = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await response.json();
      return response.ok ? data : null;
    } catch {
      return null;
    }
  }, []);

  const postJson = useCallback(async (url, body) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  }, []);

  const resolveCodeInsee = useCallback(async () => {
    if (dossier.codeInsee) return dossier.codeInsee;
    if (dossier.lat == null || dossier.lng == null) return null;

    try {
      const data = await postJson('/api/ban/reverse', { lat: dossier.lat, lng: dossier.lng });
      const place = data?.response?.places?.[0];
      const nextCodeInsee = place?.citycode || null;
      if (nextCodeInsee && nextCodeInsee !== dossier.codeInsee) {
        persistDossier({
          codeInsee: nextCodeInsee,
          geocodedAddress: dossier.geocodedAddress || place?.value || dossier.address,
        }, guessWorkStatus(dossier.status));
      }
      return nextCodeInsee;
    } catch {
      return null;
    }
  }, [dossier.address, dossier.codeInsee, dossier.geocodedAddress, dossier.lat, dossier.lng, dossier.status, persistDossier, postJson]);

  const enrichAreaSilent = useCallback(async () => {
    if (!dossier.lat || !dossier.lng) return;
    const data = await fetchEnrichData(dossier.lat, dossier.lng);
    if (!data) return;
    const prev = dossier.areaContext || {};
    persistDossier({
      areaContext: {
        ...prev,
        fetchedAt: prev.fetchedAt || new Date().toISOString(),
        location: prev.location || { lat: dossier.lat, lng: dossier.lng },
        transport: data.transport ?? prev.transport,
        schools: data.schools ?? prev.schools,
        amenities: data.amenities ?? prev.amenities,
        risks: data.risks ?? prev.risks,
        noise: data.noise ?? prev.noise,
      },
    }, guessWorkStatus(dossier.status));
  }, [dossier.areaContext, dossier.lat, dossier.lng, dossier.status, fetchEnrichData, persistDossier]);

  const handleReloadNeighborhood = useCallback(async () => {
    if (neighborhoodReloading || dossier.lat == null || dossier.lng == null) return;

    setNeighborhoodError('');
    setNeighborhoodReloading(true);
    try {
      // Run both API calls in parallel
      const [neighborhoodResult, enrichResult] = await Promise.allSettled([
        requestNeighborhoodProfile({
          lat: dossier.lat,
          lng: dossier.lng,
          address: dossier.geocodedAddress || dossier.address || null,
        }),
        fetchEnrichData(dossier.lat, dossier.lng),
      ]);

      const neighborhoodData = neighborhoodResult.status === 'fulfilled' ? neighborhoodResult.value : null;
      const enrichData = enrichResult.status === 'fulfilled' ? enrichResult.value : null;

      if (!neighborhoodData?.success && !neighborhoodData?.villesAVivre && !enrichData) {
        setNeighborhoodError('Aucune donnee recue.');
        return;
      }

      const prev = dossier.areaContext || {};
      const merged = {
        ...prev,
        fetchedAt: prev.fetchedAt || new Date().toISOString(),
        location: prev.location || { lat: dossier.lat, lng: dossier.lng },
      };

      if (neighborhoodData?.success && neighborhoodData?.villesAVivre) {
        merged.villesAVivre = neighborhoodData.villesAVivre;
      }
      if (enrichData) {
        merged.transport = enrichData.transport ?? prev.transport;
        merged.schools = enrichData.schools ?? prev.schools;
        merged.amenities = enrichData.amenities ?? prev.amenities;
        merged.risks = enrichData.risks ?? prev.risks;
        merged.noise = enrichData.noise ?? prev.noise;
      }

      persistDossier({ areaContext: merged }, guessWorkStatus(dossier.status));
    } catch (error) {
      if (error?.status === 404) {
        setNeighborhoodError('API Villes a vivre introuvable. Redemarre le backend.');
      } else {
        setNeighborhoodError(error.message || 'Erreur Villes a vivre');
      }
    } finally {
      setNeighborhoodReloading(false);
    }
  }, [dossier.areaContext, dossier.lat, dossier.lng, dossier.geocodedAddress, dossier.address, dossier.status, fetchEnrichData, neighborhoodReloading, persistDossier]);

  const handleTargetChange = useCallback((nextTarget) => {
    persistDossier({ target: nextTarget }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const handleDisabledFactorsChange = useCallback((nextDisabled) => {
    setDisabledFactors(nextDisabled);
    persistDossier({ disabledFactors: nextDisabled }, guessWorkStatus(dossier.status));
  }, [dossier.status, persistDossier]);

  const backfillMissingInfo = useCallback(async (force = false) => {
    if (infoBackfilling || dossier.lat == null || dossier.lng == null) return;

    const alreadyAttempted = infoBackfillAttemptedRef.current[dossier.id] === true;
    if (alreadyAttempted && !force) return;
    infoBackfillAttemptedRef.current[dossier.id] = true;

    setInfoBackfilling(true);
    setInfoBackfillError('');

    try {
      const codeInsee = await resolveCodeInsee();
      const bounds = radiusToBounds(dossier.lat, dossier.lng, dossier.radiusMeters || 500);
      const fetchedAt = new Date().toISOString();
      const tasks = [];

      if (force || !dossier.dvfPlusSnapshot?.data?.features?.length) {
        if (codeInsee) tasks.push(['dvfplus', postJson('/api/dvfplus/search', { bounds, codeCommune: codeInsee })]);
      }
      if (force || !dossier.marketIndicators?.results?.length) {
        if (codeInsee) tasks.push(['indicators', postJson('/api/dvfplus/indicators', { codeCommune: codeInsee })]);
      }
      if (force || !dossier.dpeSnapshot?.results?.length) {
        tasks.push(['dpe', postJson('/api/dpe/search', { lat: dossier.lat, lng: dossier.lng, distance: dossier.radiusMeters || 500 })]);
      }
      if (force || !dossier.riskProfile) {
        if (codeInsee) tasks.push(['risks', postJson('/api/georisques/profile', { lat: dossier.lat, lng: dossier.lng, codeInsee })]);
      }
      if (force || !dossier.pappersSnapshot?.parcelles?.length) {
        tasks.push(['pappers', postJson('/api/pappers/search', {
          lat: dossier.lat,
          lng: dossier.lng,
          distance: dossier.radiusMeters || 500,
          codeInsee,
        })]);
      }
      if (force || !dossier.parcelleInfo?.features?.length) {
        if (codeInsee) tasks.push(['cadastre', postJson('/api/cadastre/parcelle', { lat: dossier.lat, lng: dossier.lng, codeInsee })]);
      }
      if (force || !dossier.buildingProfile?.results?.length) {
        tasks.push(['building', postJson('/api/cadastre/building', { lat: dossier.lat, lng: dossier.lng, distance: 200 })]);
      }

      if (!tasks.length) return;

      const settled = await Promise.allSettled(tasks.map(([, promise]) => promise));
      const patch = {};
      const errors = [];

      tasks.forEach(([key], index) => {
        const result = settled[index];
        if (result.status !== 'fulfilled') {
          errors.push(`${key}: ${result.reason?.message || 'Erreur'}`);
          return;
        }

        const value = result.value;
        if (value?.success === false || value?.error) {
          errors.push(`${key}: ${value?.error || 'Erreur'}`);
          return;
        }

        if (key === 'dvfplus') patch.dvfPlusSnapshot = stripDvfPlusSnapshot({ ...value, fetchedAt });
        if (key === 'indicators') patch.marketIndicators = stripMarketIndicatorsSnapshot({ ...value, fetchedAt });
        if (key === 'dpe') patch.dpeSnapshot = stripDpeSnapshot({ ...value, fetchedAt });
        if (key === 'risks') patch.riskProfile = stripRiskProfile({ ...value, fetchedAt });
        if (key === 'pappers') patch.pappersSnapshot = stripPappersSnapshot({ ...value, fetchedAt });
        if (key === 'cadastre') patch.parcelleInfo = stripCadastreSnapshot({ ...value, fetchedAt });
        if (key === 'building') patch.buildingProfile = stripBuildingProfile({ ...value, fetchedAt });
      });

      if (codeInsee && codeInsee !== dossier.codeInsee) patch.codeInsee = codeInsee;
      if (Object.keys(patch).length) {
        persistDossier(patch, guessWorkStatus(dossier.status));
      }
      if (errors.length && !Object.keys(patch).length) {
        setInfoBackfillError(errors[0]);
      }
    } catch (error) {
      setInfoBackfillError(error.message || 'Erreur de collecte');
    } finally {
      setInfoBackfilling(false);
    }
  }, [
    dossier.buildingProfile?.results?.length,
    dossier.codeInsee,
    dossier.dpeSnapshot?.results?.length,
    dossier.dvfPlusSnapshot?.data?.features?.length,
    dossier.id,
    dossier.lat,
    dossier.lng,
    dossier.marketIndicators?.results?.length,
    dossier.parcelleInfo?.features?.length,
    dossier.pappersSnapshot?.parcelles?.length,
    dossier.radiusMeters,
    dossier.riskProfile,
    dossier.status,
    infoBackfilling,
    persistDossier,
    postJson,
    resolveCodeInsee,
  ]);

  // Auto-enrich when area context has no transport/schools data
  useEffect(() => {
    if (!dossier.lat || !dossier.lng) return;
    const ctx = dossier.areaContext;
    if (ctx?.transport || ctx?.schools || ctx?.amenities) return;
    enrichAreaSilent();
  }, [dossier.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (dossier.lat == null || dossier.lng == null) return;
    const missingAnyInfo =
      !dossier.dvfPlusSnapshot?.data?.features?.length ||
      !dossier.dpeSnapshot?.results?.length ||
      !dossier.riskProfile ||
      !dossier.pappersSnapshot?.parcelles?.length ||
      !dossier.parcelleInfo?.features?.length ||
      !dossier.buildingProfile?.results?.length ||
      !dossier.marketIndicators?.results?.length;
    if (!missingAnyInfo) return;
    backfillMissingInfo(false);
  }, [
    backfillMissingInfo,
    dossier.buildingProfile?.results?.length,
    dossier.dpeSnapshot?.results?.length,
    dossier.dvfPlusSnapshot?.data?.features?.length,
    dossier.id,
    dossier.lat,
    dossier.lng,
    dossier.marketIndicators?.results?.length,
    dossier.parcelleInfo?.features?.length,
    dossier.pappersSnapshot?.parcelles?.length,
    dossier.riskProfile,
  ]);

  const handleCoverPhoto = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      persistDossier({ coverPhoto: { dataUrl: reader.result, name: file.name } }, dossier.status);
    };
    reader.readAsDataURL(file);
  }, [dossier.status, persistDossier]);

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

  const handleFetchCastorus = useCallback(async (force = false) => {
    const listingUrl = bestSelogerListing?.url;
    if (!listingUrl || castorusLoading) return;
    if (!force && dossier.priceHistory?.listingUrl === listingUrl && dossier.priceHistory?.fetchedAt) return;

    setCastorusLoading(true);
    setCastorusError('');
    try {
      const response = await fetch('/api/castorus/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: listingUrl }),
      });
      const data = await response.json();
      const nextPriceHistory = stripCastorusSnapshot({ ...data, listingUrl });
      persistDossier({ priceHistory: nextPriceHistory }, guessWorkStatus(dossier.status));
      if (data?.error) setCastorusError(data.error);
    } catch (error) {
      setCastorusError(error.message || 'Erreur Castorus');
    } finally {
      setCastorusLoading(false);
    }
  }, [bestSelogerListing?.url, castorusLoading, dossier.priceHistory?.fetchedAt, dossier.priceHistory?.listingUrl, dossier.status, persistDossier]);

  const handleLoadPappersDetail = useCallback(async () => {
    if (dossier.pappersSnapshot?.canLoadDetail === false) {
      setPappersError(dossier.pappersSnapshot?.warning || 'Le detail Pappers natif n est pas disponible pour cette source.');
      return;
    }

    const parcelleNumber = dossier.pappersSnapshot?.parcelles?.[0]?.numero;
    if (!parcelleNumber || pappersLoading) return;

    setPappersLoading(true);
    setPappersError('');
    try {
      const response = await fetch('/api/pappers/parcelle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroParcelle: parcelleNumber }),
      });
      const data = await response.json();
      if (!response.ok || data?.error) throw new Error(data?.error || `HTTP ${response.status}`);

      const nextSnapshot = stripPappersSnapshot({
        ...(dossier.pappersSnapshot || {}),
        detail: data?.data || data,
        fetchedAt: new Date().toISOString(),
      });
      persistDossier({ pappersSnapshot: nextSnapshot }, guessWorkStatus(dossier.status));
    } catch (error) {
      setPappersError(error.message || 'Erreur Pappers');
    } finally {
      setPappersLoading(false);
    }
  }, [dossier.pappersSnapshot, dossier.status, pappersLoading, persistDossier]);

  useEffect(() => {
    if (!bestSelogerListing?.url) return;
    if (dossier.priceHistory?.listingUrl === bestSelogerListing.url && dossier.priceHistory?.fetchedAt) return;
    handleFetchCastorus(false);
  }, [bestSelogerListing?.url, dossier.priceHistory?.fetchedAt, dossier.priceHistory?.listingUrl, handleFetchCastorus]);

  const handleExportPdf = useCallback(async () => {
    setExporting(true);
    try {
      await exportDossierPdf({
        dossier,
        estimate: mlEstimate,
        metrics,
        filteredRefs: filtered,
        trend,
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
          <Dropdown
            className="ws-status-select dd-status"
            value={dossier.status}
            onChange={(v) => persistDossier({}, v)}
            options={[
              { value: 'draft', label: 'Brouillon' },
              { value: 'in_progress', label: 'En cours' },
              { value: 'estimated', label: 'Estimé' },
              { value: 'confirmed', label: 'Confirmé' },
              { value: 'archived', label: 'Archivé' },
            ]}
          />
          <label className="topbar-btn topbar-btn-photo">
            {dossier.coverPhoto ? 'Changer photo' : 'Photo'}
            <input type="file" accept="image/*" hidden onChange={handleCoverPhoto} />
          </label>
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

      <div className="tab-group-stack">
        <div className="tab-group-row">
          <span className="tab-group-label">Analyse</span>
          <div className="clean-tabs">
            <button className={`clean-tab ${tab === 'data' ? 'active' : ''}`} onClick={() => setTab('data')}>Donnees</button>
            <button className={`clean-tab ${tab === 'neighborhood' ? 'active' : ''}`} onClick={() => setTab('neighborhood')}>Quartier</button>
            <button className={`clean-tab ${tab === 'analyst' ? 'active' : ''}`} onClick={() => setTab('analyst')}>Analyste</button>
            <button className={`clean-tab ${tab === 'algo' ? 'active' : ''}`} onClick={() => setTab('algo')}>Algo</button>
            <button className={`clean-tab ${tab === 'synthese' ? 'active' : ''}`} onClick={() => setTab('synthese')}>Synthese</button>
            {isBuilding && (
              <button className={`clean-tab ${tab === 'gdp' ? 'active' : ''}`} onClick={() => setTab('gdp')}>Grille</button>
            )}
          </div>
        </div>

        <div className="tab-group-row">
          <span className="tab-group-label">Infos</span>
          <div className="tab-group-actions">
            <div className="clean-tabs clean-tabs-secondary">
            <button className={`clean-tab ${tab === 'pappers' ? 'active' : ''}`} onClick={() => setTab('pappers')}>Pappers</button>
            <button className={`clean-tab ${tab === 'castorus' ? 'active' : ''}`} onClick={() => setTab('castorus')}>Castorus</button>
            <button className={`clean-tab ${tab === 'dvfplus' ? 'active' : ''}`} onClick={() => setTab('dvfplus')}>DVF+</button>
            <button className={`clean-tab ${tab === 'risks' ? 'active' : ''}`} onClick={() => setTab('risks')}>Risques</button>
            <button className={`clean-tab ${tab === 'energy' ? 'active' : ''}`} onClick={() => setTab('energy')}>Energie</button>
            <button className={`clean-tab ${tab === 'cadastre' ? 'active' : ''}`} onClick={() => setTab('cadastre')}>Cadastre</button>
            <button className={`clean-tab ${tab === 'negotiation' ? 'active' : ''}`} onClick={() => setTab('negotiation')}>Nego</button>
            <button className={`clean-tab ${tab === 'investment' ? 'active' : ''}`} onClick={() => setTab('investment')}>Invest.</button>
            </div>
            <button className="topbar-btn" onClick={() => backfillMissingInfo(true)} disabled={infoBackfilling}>
              {infoBackfilling ? 'Collecte...' : 'Actualiser les infos'}
            </button>
          </div>
        </div>
      </div>

      {infoBackfillError ? (
        <div className="info-inline-error" style={{ marginBottom: 12 }}>{infoBackfillError}</div>
      ) : null}

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
            onTargetChange={handleTargetChange}
          />
        )}

        {tab === 'algo' && (
          <AlgoWorkbench
            estimate={mlEstimate}
            filteredRefs={filtered}
            model={model}
            target={target}
            onTargetChange={handleTargetChange}
            onConfirm={handleConfirm}
            alreadyConfirmed={dossier.confirmed}
            disabledFactors={disabledFactors}
            onDisabledFactorsChange={handleDisabledFactorsChange}
          />
        )}

        {tab === 'synthese' && (
          <SyntheseView
            dossier={dossier}
            mlEstimate={mlEstimate}
            manualEstimate={manualEstimate}
            metrics={metrics}
            areaScores={areaScores}
            trend={trend}
            filteredRefs={filtered}
          />
        )}

        {tab === 'pappers' && (
          <PappersPanel
            snapshot={dossier.pappersSnapshot}
            onLoadDetail={handleLoadPappersDetail}
            loading={pappersLoading}
            error={pappersError}
          />
        )}

        {tab === 'castorus' && (
          <CastorusPanel
            priceHistory={dossier.priceHistory}
            listingUrl={bestSelogerListing?.url || null}
            onRefresh={() => handleFetchCastorus(true)}
            loading={castorusLoading}
            error={castorusError}
          />
        )}

        {tab === 'dvfplus' && (
          <DvfPlusPanel
            snapshot={dossier.dvfPlusSnapshot}
            marketIndicators={dossier.marketIndicators}
          />
        )}

        {tab === 'risks' && (
          <RiskPanel riskProfile={dossier.riskProfile} />
        )}

        {tab === 'energy' && (
          <DPEPanel snapshot={dossier.dpeSnapshot} target={target} />
        )}

        {tab === 'cadastre' && (
          <CadastrePanel
            parcelleInfo={dossier.parcelleInfo}
            buildingProfile={dossier.buildingProfile}
          />
        )}

        {tab === 'negotiation' && (
          <NegotiationDashboard
            signals={negotiationSignals}
            score={negotiationScore}
            argumentsList={negotiationArguments}
            offerRange={suggestedOfferRange}
            marketPosition={marketPosition}
            onRefreshCastorus={() => handleFetchCastorus(true)}
            castorusLoading={castorusLoading}
            hasCastorusSource={Boolean(bestSelogerListing?.url)}
          />
        )}

        {tab === 'investment' && (
          <InvestmentPanel dossier={dossier} />
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
