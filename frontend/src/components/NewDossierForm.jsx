import { useState, useRef } from 'react';
import { RADIUS_OPTIONS } from '../utils/constants';
import { stripDvfSnapshot, stripSelogerSnapshot } from '../utils/storage';

const METERS_PER_DEG_LAT = 111320;

async function safeJson(r) {
  const text = await r.text();
  if (!text) throw new Error('Réponse vide — service indisponible ou délai dépassé');
  try { return JSON.parse(text); }
  catch { throw new Error('Réponse non valide du serveur'); }
}

function radiusToBounds(lat, lng, radiusM) {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}


export default function NewDossierForm({ onCreated, onBack }) {
  const [address,  setAddress]  = useState('');
  const [radius,   setRadius]   = useState(500);
  const [surface,  setSurface]  = useState('');
  const [rooms,    setRooms]    = useState('');
  const [type,     setType]     = useState('Apartment');
  const [analysisMode, setAnalysisMode] = useState('single'); // 'single' | 'building'

  // Optional property characteristics (affect estimation)
  const [floor,       setFloor]       = useState('');
  const [totalFloors, setTotalFloors] = useState('');
  const [hasElevator, setHasElevator] = useState(null); // null|true|false
  const [orientation, setOrientation] = useState('');   // ''|'N'|'NE'|...
  const [hasBalcony,  setHasBalcony]  = useState(null);
  const [hasTerrace,  setHasTerrace]  = useState(null);
  const [hasParking,  setHasParking]  = useState(null);
  const [hasCellar,   setHasCellar]   = useState(null);
  const [showChar,    setShowChar]    = useState(false);

  const [step,     setStep]     = useState(''); // progress label
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('estimia_recent') || '[]'); } catch { return []; }
  });
  const [showRecent, setShowRecent] = useState(false);
  const inputRef = useRef(null);

  const saveRecent = addr => {
    const next = [addr, ...recentSearches.filter(r => r !== addr)].slice(0, 8);
    setRecentSearches(next);
    try { localStorage.setItem('estimia_recent', JSON.stringify(next)); } catch {}
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!address.trim() || loading) return;
    setLoading(true);
    setError(null);
    saveRecent(address.trim());

    // 1. Geocode
    setStep('Géocodage de l\'adresse…');
    let lat, lng, geocodedLabel = address.trim();
    try {
      const r = await fetch('/api/immobilier/geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const d = await r.json();
      const place = d.response?.places?.[0];
      if (!place) throw new Error('Adresse introuvable');
      lat = place._geoloc.lat;
      lng = place._geoloc.lng;
      geocodedLabel = place.value || address.trim();
    } catch (err) {
      setLoading(false);
      setError('Géocodage impossible : ' + err.message);
      return;
    }

    // 2. Parallel fetches
    setStep('Extraction des données en cours (SeLoger + DVF)…');
    const [slRes, dvfRes] = await Promise.allSettled([
      // SeLoger — collecte large, 100 résultats max, aucun filtre
      fetch('/api/seloger/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius, filters: { size: 100 } }),
      }).then(safeJson),
      // DVF
      fetch('/api/immobilier/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bounds:    radiusToBounds(lat, lng, radius),
          roomCount: [],
          itemTypes: type === 'House'
            ? ['ITEM_TYPE.HOUSE']
            : type === 'Apartment'
              ? ['ITEM_TYPE.APARTMENT']
              : ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'],
        }),
      }).then(safeJson),
    ]);

    // Build snapshots
    const selogerSnapshot = slRes.status === 'fulfilled' && !slRes.value?.error
      ? { data: stripSelogerSnapshot(slRes.value), fetchedAt: new Date().toISOString() }
      : { error: slRes.status === 'rejected' ? slRes.reason.message : (slRes.value?.error || 'Erreur') };

    let dvfRaw = null;
    if (dvfRes.status === 'fulfilled' && dvfRes.value?.success) {
      dvfRaw = stripDvfSnapshot(dvfRes.value.data);
    }
    const dvfSnapshot = dvfRaw
      ? { data: dvfRaw, fetchedAt: new Date().toISOString(), radiusMeters: radius }
      : { error: dvfRes.status === 'rejected' ? dvfRes.reason.message : (dvfRes.value?.error || 'Erreur DVF') };

    // Build dossier
    const dossier = {
      id:              crypto.randomUUID ? crypto.randomUUID() : `dos_${Date.now()}`,
      createdAt:       new Date().toISOString(),
      status:          'estimated',
      analysisMode,
      address:         address.trim(),
      geocodedAddress: geocodedLabel,
      lat, lng,
      radiusMeters:    radius,
      target: {
        surfaceM2:   surface     ? +surface     : null,
        rooms:       rooms       ? +rooms       : null,
        type,
        floor:       floor       ? +floor       : null,
        totalFloors: totalFloors ? +totalFloors : null,
        hasElevator: hasElevator,
        orientation: orientation || null,
        hasBalcony:  hasBalcony,
        hasTerrace:  hasTerrace,
        hasParking:  hasParking,
        hasCellar:   hasCellar,
      },
      selogerSnapshot,
      dvfSnapshot,
      selectedComps: [],
      lastEstimate:  null,
      confirmed:     null,
    };

    setLoading(false);
    setStep('');
    onCreated(dossier);
  };

  // Count how many optional characteristics are set
  const charCount = [floor, totalFloors, hasElevator !== null && hasElevator, orientation, hasBalcony !== null && hasBalcony, hasTerrace !== null && hasTerrace, hasParking !== null && hasParking, hasCellar !== null && hasCellar].filter(Boolean).length;

  return (
    <div className="form-view">
      <button className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Retour aux dossiers
      </button>

      <div className="form-card">
        {/* Progress steps indicator */}
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

        <h2 className="form-title">Nouvelle analyse immobilière</h2>
        <p className="form-sub">Renseignez l&apos;adresse et les caractéristiques du bien pour lancer l&apos;extraction des données de marché.</p>

        <form onSubmit={handleSubmit} className="form-body">
          {/* Section 1: Address */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-num">1</span>
              <div>
                <div className="form-section-title">Localisation</div>
                <p className="form-section-desc">Adresse exacte du bien et périmètre de recherche</p>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Adresse du bien</label>
              <div className="search-field">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  className="search-input"
                  placeholder="Ex : 14 rue de la Paix, 75001 Paris"
                  value={address}
                  onChange={e => { setAddress(e.target.value); setShowRecent(true); }}
                  onFocus={() => setShowRecent(true)}
                  onBlur={() => setTimeout(() => setShowRecent(false), 180)}
                  required
                  autoComplete="off"
                />
                {showRecent && recentSearches.length > 0 && !address && (
                  <div className="recent-panel">
                    <p className="recent-title">Recherches récentes</p>
                    {recentSearches.map(r => (
                      <button key={r} type="button" className="recent-row"
                        onMouseDown={() => { setAddress(r); setShowRecent(false); }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
                        </svg>
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Rayon d&apos;analyse</label>
              <div className="fp-chips">
                {RADIUS_OPTIONS.map(o => (
                  <button key={o.value} type="button"
                    className={`chip${radius === o.value ? ' on' : ''}`}
                    onClick={() => setRadius(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="form-hint">Zone de recherche autour de l&apos;adresse pour les données DVF et annonces SeLoger</p>
            </div>
          </div>

          {/* Section 2: Target property */}
          <div className="form-section">
            <div className="form-section-header">
              <span className="form-section-num">2</span>
              <div>
                <div className="form-section-title">Bien cible</div>
                <p className="form-section-desc">Caractéristiques du bien à estimer</p>
              </div>
            </div>

            {/* Analysis mode */}
            <div className="form-field">
              <label className="form-label">Mode d&apos;analyse</label>
              <div className="ndf-mode-cards">
                <button type="button"
                  className={`ndf-mode-card${analysisMode === 'single' ? ' active' : ''}`}
                  onClick={() => setAnalysisMode('single')}>
                  <span className="ndf-mode-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <line x1="4" y1="10" x2="20" y2="10"/>
                      <line x1="10" y1="4" x2="10" y2="20"/>
                    </svg>
                  </span>
                  <span className="ndf-mode-title">Bien unique</span>
                  <span className="ndf-mode-desc">Appartement ou maison — estimation directe via l&apos;étude de marché</span>
                </button>
                <button type="button"
                  className={`ndf-mode-card${analysisMode === 'building' ? ' active' : ''}`}
                  onClick={() => setAnalysisMode('building')}>
                  <span className="ndf-mode-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="2" width="18" height="20" rx="2"/>
                      <line x1="3" y1="8" x2="21" y2="8"/>
                      <line x1="3" y1="14" x2="21" y2="14"/>
                      <line x1="9" y1="2" x2="9" y2="22"/>
                      <line x1="15" y1="2" x2="15" y2="22"/>
                    </svg>
                  </span>
                  <span className="ndf-mode-title">Immeuble complet</span>
                  <span className="ndf-mode-desc">Multi-lots avec grille de prix, coefficients et valorisation lot par lot</span>
                </button>
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-field">
                <label className="form-label">Surface habitable (m²)</label>
                <input type="number" className="fp-input fp-wide" placeholder="Ex : 65"
                  value={surface} onChange={e => setSurface(e.target.value)} min="5" />
              </div>
              <div className="form-field">
                <label className="form-label">Nombre de pièces</label>
                <input type="number" className="fp-input" placeholder="Ex : 3"
                  value={rooms} onChange={e => setRooms(e.target.value)} min="1" max="20" />
              </div>
              <div className="form-field">
                <label className="form-label">Type de bien</label>
                <div className="fp-chips">
                  {[{ v: 'Apartment', l: 'Appartement' }, { v: 'House', l: 'Maison' }].map(o => (
                    <button key={o.v} type="button"
                      className={`chip${type === o.v ? ' on' : ''}`}
                      onClick={() => setType(o.v)}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Optional property characteristics */}
          <button type="button" className="filter-btn" onClick={() => setShowChar(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Détails du bien
            {charCount > 0 && <span className="edm-filter-badge">{charCount}</span>}
            <span className="filter-btn-hint">(optionnel · améliore la précision de l&apos;estimation)</span>
            <svg className={`chevron${showChar ? ' up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showChar && (
            <div className="filter-panel">
              <div className="fp-grid">
                <div className="fp-group">
                  <span className="fp-lbl">Étage</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input" placeholder="Ex : 3" min="0" max="50"
                      value={floor} onChange={e => setFloor(e.target.value)} />
                    <span className="fp-dash">sur</span>
                    <input type="number" className="fp-input" placeholder="Total" min="1" max="50"
                      value={totalFloors} onChange={e => setTotalFloors(e.target.value)} />
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Ascenseur</span>
                  <div className="fp-chips">
                    {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(o => (
                      <button key={String(o.v)} type="button"
                        className={`chip chip-sm${hasElevator === o.v ? ' on' : ''}`}
                        onClick={() => setHasElevator(o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Exposition</span>
                  <div className="fp-chips">
                    {['N','NE','E','SE','S','SW','W','NW'].map(o => (
                      <button key={o} type="button"
                        className={`chip chip-sm${orientation === o ? ' on' : ''}`}
                        onClick={() => setOrientation(p => p === o ? '' : o)}>{o}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Balcon</span>
                  <div className="fp-chips">
                    {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(o => (
                      <button key={String(o.v)} type="button"
                        className={`chip chip-sm${hasBalcony === o.v ? ' on' : ''}`}
                        onClick={() => setHasBalcony(o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Terrasse</span>
                  <div className="fp-chips">
                    {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(o => (
                      <button key={String(o.v)} type="button"
                        className={`chip chip-sm${hasTerrace === o.v ? ' on' : ''}`}
                        onClick={() => setHasTerrace(o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Parking</span>
                  <div className="fp-chips">
                    {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(o => (
                      <button key={String(o.v)} type="button"
                        className={`chip chip-sm${hasParking === o.v ? ' on' : ''}`}
                        onClick={() => setHasParking(o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Cave</span>
                  <div className="fp-chips">
                    {[{ v: true, l: 'Oui' }, { v: false, l: 'Non' }, { v: null, l: '?' }].map(o => (
                      <button key={String(o.v)} type="button"
                        className={`chip chip-sm${hasCellar === o.v ? ' on' : ''}`}
                        onClick={() => setHasCellar(o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="state-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/>
              </svg>
              <div><strong>Erreur</strong><p>{error}</p></div>
            </div>
          )}

          {/* Summary before launch */}
          {address.trim() && (
            <div className="ndf-summary">
              <span className="ndf-summary-tag">{address.trim().substring(0, 40)}{address.trim().length > 40 ? '…' : ''}</span>
              <span className="ndf-summary-tag">Rayon {RADIUS_OPTIONS.find(o => o.value === radius)?.label}</span>
              {surface && <span className="ndf-summary-tag">{surface} m²</span>}
              {rooms && <span className="ndf-summary-tag">{rooms} pièce{rooms > 1 ? 's' : ''}</span>}
              <span className="ndf-summary-tag">{type === 'Apartment' ? 'Appartement' : 'Maison'}</span>
              <span className="ndf-summary-tag">{analysisMode === 'building' ? 'Immeuble complet' : 'Bien unique'}</span>
            </div>
          )}

          <button type="submit" className="search-btn form-submit" disabled={!address.trim() || loading}>
            {loading
              ? <><span className="btn-spin" />{step || 'Extraction…'}</>
              : <>Lancer l&apos;analyse
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
