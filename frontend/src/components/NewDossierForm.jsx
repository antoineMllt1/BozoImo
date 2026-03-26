import { useState, useRef } from 'react';
import { RADIUS_OPTIONS } from '../utils/constants';
import { CONDITION_OPTIONS, DPE_OPTIONS, VIEW_QUALITY_OPTIONS } from '../utils/dossiers';
import { stripDvfSnapshot, stripSelogerSnapshot } from '../utils/storage';
import { estateTypesForTargetType, itemTypesForTargetType } from '../utils/propertyType';
import NumberInput from './NumberInput';

const METERS_PER_DEG_LAT = 111320;

async function safeJson(response) {
  const text = await response.text();
  if (!text) throw new Error('Reponse vide');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Reponse non valide du serveur');
  }
}

function radiusToBounds(lat, lng, radiusM) {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

function booleanChoices(value, setter) {
  return (
    <div className="fp-chips">
      {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(option => (
        <button
          key={String(option.v)}
          type="button"
          className={`chip chip-sm${value === option.v ? ' on' : ''}`}
          onClick={() => setter(option.v)}
        >
          {option.l}
        </button>
      ))}
    </div>
  );
}

function toNullableNumber(value) {
  return value === '' ? null : Number(value);
}

function toFieldString(value) {
  return value == null ? '' : String(value);
}

export default function NewDossierForm({ onCreated, onBack }) {
  const [address, setAddress] = useState('');
  const [radius, setRadius] = useState(500);
  const [surface, setSurface] = useState('');
  const [rooms, setRooms] = useState('');
  const [type, setType] = useState('Apartment');
  const [analysisMode, setAnalysisMode] = useState('single');

  const [floor, setFloor] = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [hasElevator, setHasElevator] = useState(null);
  const [orientation, setOrientation] = useState('');
  const [hasBalcony, setHasBalcony] = useState(null);
  const [hasTerrace, setHasTerrace] = useState(null);
  const [hasParking, setHasParking] = useState(null);
  const [hasCellar, setHasCellar] = useState(null);
  const [dpe, setDpe] = useState('');
  const [condition, setCondition] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [viewQuality, setViewQuality] = useState('');
  const [hasPool, setHasPool] = useState(null);
  const [hasGarden, setHasGarden] = useState(null);
  const [isDuplex, setIsDuplex] = useState(null);
  const [showChar, setShowChar] = useState(false);

  const [step, setStep] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('estimia_recent') || '[]');
    } catch {
      return [];
    }
  });
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef(null);

  const saveRecent = nextAddress => {
    const next = [nextAddress, ...recentSearches.filter(item => item !== nextAddress)].slice(0, 8);
    setRecentSearches(next);
    try {
      localStorage.setItem('estimia_recent', JSON.stringify(next));
    } catch {
      // Ignore local-only persistence failures.
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!address.trim() || loading) return;

    setLoading(true);
    setError(null);
    saveRecent(address.trim());

    let lat;
    let lng;
    let geocodedLabel = address.trim();

    try {
      setStep("Geocodage de l'adresse...");
      const geocodeResponse = await fetch('/api/immobilier/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const geocodeData = await geocodeResponse.json();
      const place = geocodeData.response?.places?.[0];
      if (!place) throw new Error('Adresse introuvable');
      lat = place._geoloc.lat;
      lng = place._geoloc.lng;
      geocodedLabel = place.value || address.trim();
    } catch (err) {
      setLoading(false);
      setError(`Geocodage impossible : ${err.message}`);
      return;
    }

    setStep('Collecte SeLoger, DVF et contexte quartier principal...');
    const [selogerResult, dvfResult, enrichResult] = await Promise.allSettled([
      fetch('/api/seloger/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius, filters: { size: 100, estateTypes: estateTypesForTargetType(type) } }),
      }).then(safeJson),
      fetch('/api/immobilier/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds: radiusToBounds(lat, lng, radius),
          roomCount: [],
          itemTypes: itemTypesForTargetType(type),
        }),
      }).then(safeJson),
      fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      }).then(safeJson),
    ]);

    const selogerSnapshot =
      selogerResult.status === 'fulfilled' && !selogerResult.value?.error
        ? { data: stripSelogerSnapshot(selogerResult.value), fetchedAt: new Date().toISOString() }
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
      ? { data: dvfRaw, fetchedAt: new Date().toISOString(), radiusMeters: radius }
      : {
          error:
            dvfResult.status === 'rejected'
              ? dvfResult.reason.message
              : dvfResult.value?.error || 'Erreur DVF',
        };

    const areaContext =
      enrichResult.status === 'fulfilled' && enrichResult.value?.success
        ? enrichResult.value.context
        : {
            error:
              enrichResult.status === 'rejected'
                ? enrichResult.reason.message
                : enrichResult.value?.error || 'Erreur enrichissement',
          };

    const dossier = {
      id: crypto.randomUUID ? crypto.randomUUID() : `dos_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'estimated',
      analysisMode,
      address: address.trim(),
      geocodedAddress: geocodedLabel,
      lat,
      lng,
      radiusMeters: radius,
      target: {
        surfaceM2: surface ? +surface : null,
        rooms: rooms ? +rooms : null,
        type,
        floor: floor ? +floor : null,
        totalFloors: totalFloors ? +totalFloors : null,
        hasElevator,
        orientation: orientation || null,
        hasBalcony,
        hasTerrace,
        hasParking,
        hasCellar,
        dpe: dpe || null,
        condition: condition || null,
        yearBuilt: yearBuilt ? +yearBuilt : null,
        viewQuality: viewQuality || null,
        hasPool,
        hasGarden,
        isDuplex,
      },
      selogerSnapshot,
      dvfSnapshot,
      areaContext,
      selectedComps: [],
      lastEstimate: null,
      confirmed: null,
    };

    setLoading(false);
    setStep('');
    onCreated(dossier);
  };

  const charCount = [
    floor,
    totalFloors,
    hasElevator !== null,
    orientation,
    hasBalcony !== null,
    hasTerrace !== null,
    hasParking !== null,
    hasCellar !== null,
    dpe,
    condition,
    yearBuilt,
    viewQuality,
    hasPool !== null,
    hasGarden !== null,
    isDuplex !== null,
  ].filter(Boolean).length;

  return (
    <div className="form-view">
      <button className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Retour aux dossiers
      </button>

      <div className="form-card">
        <div className="ndf-steps">
          <div className={`ndf-step ${address.trim() ? 'done' : 'active'}`}>
            <span className="ndf-step-num">{address.trim() ? '✓' : '1'}</span>
            <span className="ndf-step-label">Adresse</span>
          </div>
          <span className="ndf-step-line" />
          <div className={`ndf-step ${surface && rooms ? 'done' : address.trim() ? 'active' : ''}`}>
            <span className="ndf-step-num">{surface && rooms ? '✓' : '2'}</span>
            <span className="ndf-step-label">Bien cible</span>
          </div>
          <span className="ndf-step-line" />
          <div className={`ndf-step ${address.trim() && surface ? 'active' : ''}`}>
            <span className="ndf-step-num">3</span>
            <span className="ndf-step-label">Lancer</span>
          </div>
        </div>

        <h2 className="form-title">Nouvelle analyse immobiliere</h2>
        <p className="form-sub">
          Renseignez l&apos;adresse et les caracteristiques du bien pour lancer la collecte marche et l&apos;enrichissement quartier.
        </p>

        <form onSubmit={handleSubmit} className="form-body">
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-num">1</span>
              <div>
                <div className="form-section-title">Localisation</div>
                <p className="form-section-desc">Adresse exacte du bien et perimetre de recherche</p>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Adresse du bien</label>
              <div className="search-field">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  placeholder="Ex : 14 rue de la Paix, 75001 Paris"
                  value={address}
                  onChange={event => {
                    setAddress(event.target.value);
                    setShowRecent(true);
                  }}
                  onFocus={() => setShowRecent(true)}
                  onBlur={() => setTimeout(() => setShowRecent(false), 180)}
                  required
                  autoComplete="off"
                />
                {showRecent && recentSearches.length > 0 && !address && (
                  <div className="recent-panel">
                    <p className="recent-title">Recherches recentes</p>
                    {recentSearches.map(item => (
                      <button
                        key={item}
                        type="button"
                        className="recent-row"
                        onMouseDown={() => {
                          setAddress(item);
                          setShowRecent(false);
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9" />
                          <polyline points="12 7 12 12 15 14" />
                        </svg>
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Rayon d&apos;analyse</label>
              <div className="fp-chips">
                {RADIUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    className={`chip${radius === option.value ? ' on' : ''}`}
                    onClick={() => setRadius(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="form-hint">Zone de recherche autour de l&apos;adresse pour DVF, SeLoger et le contexte quartier</p>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-num">2</span>
              <div>
                <div className="form-section-title">Bien cible</div>
                <p className="form-section-desc">Caracteristiques du bien a estimer</p>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Mode d&apos;analyse</label>
              <div className="ndf-mode-cards">
                <button
                  type="button"
                  className={`ndf-mode-card${analysisMode === 'single' ? ' active' : ''}`}
                  onClick={() => setAnalysisMode('single')}
                >
                  <span className="ndf-mode-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <line x1="4" y1="10" x2="20" y2="10" />
                      <line x1="10" y1="4" x2="10" y2="20" />
                    </svg>
                  </span>
                  <span className="ndf-mode-title">Bien unique</span>
                  <span className="ndf-mode-desc">Appartement ou maison avec estimation directe</span>
                </button>
                <button
                  type="button"
                  className={`ndf-mode-card${analysisMode === 'building' ? ' active' : ''}`}
                  onClick={() => setAnalysisMode('building')}
                >
                  <span className="ndf-mode-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="2" width="18" height="20" rx="2" />
                      <line x1="3" y1="8" x2="21" y2="8" />
                      <line x1="3" y1="14" x2="21" y2="14" />
                      <line x1="9" y1="2" x2="9" y2="22" />
                      <line x1="15" y1="2" x2="15" y2="22" />
                    </svg>
                  </span>
                  <span className="ndf-mode-title">Immeuble complet</span>
                  <span className="ndf-mode-desc">Multi-lots avec grille de prix et valorisation lot par lot</span>
                </button>
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-field">
                <label className="form-label">Surface habitable (m²)</label>
                <NumberInput
                  label="Surface habitable"
                  min={5}
                  step={0.5}
                  size="md"
                  value={toNullableNumber(surface)}
                  placeholder="65"
                  onChange={value => setSurface(toFieldString(value))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Nombre de pieces</label>
                <NumberInput
                  label="Nombre de pieces"
                  min={1}
                  max={20}
                  step={1}
                  size="sm"
                  value={toNullableNumber(rooms)}
                  placeholder="3"
                  onChange={value => setRooms(toFieldString(value))}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Type de bien</label>
                <div className="fp-chips">
                  {[{ v: 'Apartment', l: 'Appartement' }, { v: 'House', l: 'Maison' }].map(option => (
                    <button
                      key={option.v}
                      type="button"
                      className={`chip${type === option.v ? ' on' : ''}`}
                      onClick={() => setType(option.v)}
                    >
                      {option.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button type="button" className="filter-btn" onClick={() => setShowChar(value => !value)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
            Details du bien
            {charCount > 0 && <span className="edm-filter-badge">{charCount}</span>}
            <span className="filter-btn-hint">(optionnel · ameliore la precision de l&apos;estimation)</span>
            <svg className={`chevron${showChar ? ' up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showChar && (
            <div className="filter-panel">
              <div className="fp-grid">
                <div className="fp-group">
                  <span className="fp-lbl">Etage</span>
                  <div className="fp-range">
                    <NumberInput
                      label="Etage"
                      min={0}
                      max={50}
                      step={1}
                      size="sm"
                      value={toNullableNumber(floor)}
                      placeholder="3"
                      onChange={value => setFloor(toFieldString(value))}
                    />
                    <span className="fp-dash">sur</span>
                    <NumberInput
                      label="Etages total"
                      min={1}
                      max={50}
                      step={1}
                      size="sm"
                      value={toNullableNumber(totalFloors)}
                      placeholder="Total"
                      onChange={value => setTotalFloors(toFieldString(value))}
                    />
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Ascenseur</span>
                  {booleanChoices(hasElevator, setHasElevator)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Exposition</span>
                  <div className="fp-chips">
                    {['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].map(option => (
                      <button
                        key={option}
                        type="button"
                        className={`chip chip-sm${orientation === option ? ' on' : ''}`}
                        onClick={() => setOrientation(current => (current === option ? '' : option))}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Balcon</span>
                  {booleanChoices(hasBalcony, setHasBalcony)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Terrasse</span>
                  {booleanChoices(hasTerrace, setHasTerrace)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Parking</span>
                  {booleanChoices(hasParking, setHasParking)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Cave</span>
                  {booleanChoices(hasCellar, setHasCellar)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">DPE</span>
                  <div className="fp-chips">
                    {['', ...DPE_OPTIONS].map(option => (
                      <button
                        key={option || 'unknown'}
                        type="button"
                        className={`chip chip-sm${dpe === option ? ' on' : ''}`}
                        onClick={() => setDpe(option)}
                      >
                        {option || '?'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Etat</span>
                  <div className="fp-chips">
                    {[{ value: '', label: '?' }, ...CONDITION_OPTIONS].map(option => (
                      <button
                        key={option.value || 'unknown'}
                        type="button"
                        className={`chip chip-sm${condition === option.value ? ' on' : ''}`}
                        onClick={() => setCondition(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Vue</span>
                  <div className="fp-chips">
                    {[{ value: '', label: '?' }, ...VIEW_QUALITY_OPTIONS].map(option => (
                      <button
                        key={option.value || 'unknown'}
                        type="button"
                        className={`chip chip-sm${viewQuality === option.value ? ' on' : ''}`}
                        onClick={() => setViewQuality(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Annee construction</span>
                  <NumberInput
                    label="Annee construction"
                    min={1800}
                    max={new Date().getFullYear()}
                    step={1}
                    size="md"
                    value={toNullableNumber(yearBuilt)}
                    placeholder="1998"
                    onChange={value => setYearBuilt(toFieldString(value))}
                  />
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Piscine</span>
                  {booleanChoices(hasPool, setHasPool)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Jardin</span>
                  {booleanChoices(hasGarden, setHasGarden)}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Duplex / Triplex</span>
                  {booleanChoices(isDuplex, setIsDuplex)}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="state-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="13" />
              </svg>
              <div>
                <strong>Erreur</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          {address.trim() && (
            <div className="ndf-summary">
              <span className="ndf-summary-tag">
                {address.trim().substring(0, 40)}
                {address.trim().length > 40 ? '...' : ''}
              </span>
              <span className="ndf-summary-tag">Rayon {RADIUS_OPTIONS.find(option => option.value === radius)?.label}</span>
              {surface && <span className="ndf-summary-tag">{surface} m²</span>}
              {rooms && <span className="ndf-summary-tag">{rooms} piece{Number(rooms) > 1 ? 's' : ''}</span>}
              <span className="ndf-summary-tag">{type === 'Apartment' ? 'Appartement' : 'Maison'}</span>
              <span className="ndf-summary-tag">{analysisMode === 'building' ? 'Immeuble complet' : 'Bien unique'}</span>
            </div>
          )}

          <button type="submit" className="search-btn form-submit" disabled={!address.trim() || loading}>
            {loading ? (
              <>
                <span className="btn-spin" />
                {step || 'Extraction...'}
              </>
            ) : (
              <>
                Lancer l&apos;analyse
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
