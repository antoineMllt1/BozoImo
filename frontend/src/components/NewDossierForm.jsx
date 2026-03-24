import { useState, useRef } from 'react';
import { SELOGER_ESTATE_TYPES, SELOGER_FEATURES, DEFAULT_SELOGER, RADIUS_OPTIONS } from '../utils/constants';
import { stripDvfSnapshot } from '../utils/storage';

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

function buildSlFilters(f, size) {
  const c = { size };
  if (f.estateTypes.length)       c.estateTypes       = f.estateTypes;
  if (f.numberOfRoomsMin !== '')   c.numberOfRoomsMin  = +f.numberOfRoomsMin;
  if (f.numberOfRoomsMax !== '')   c.numberOfRoomsMax  = +f.numberOfRoomsMax;
  if (f.priceMin !== '')           c.priceMin          = +f.priceMin;
  if (f.priceMax !== '')           c.priceMax          = +f.priceMax;
  if (f.spaceMin !== '')           c.spaceMin          = +f.spaceMin;
  if (f.spaceMax !== '')           c.spaceMax          = +f.spaceMax;
  if (f.featuresIncluded.length)   c.featuresIncluded  = f.featuresIncluded;
  return c;
}

export default function NewDossierForm({ onCreated, onBack }) {
  const [address,  setAddress]  = useState('');
  const [radius,   setRadius]   = useState(500);
  const [surface,  setSurface]  = useState('');
  const [rooms,    setRooms]    = useState('');
  const [type,     setType]     = useState('Apartment');
  const [pageSize, setPageSize] = useState(30);
  const [slFilters, setSlFilters] = useState(DEFAULT_SELOGER);
  const [showAdv,  setShowAdv]  = useState(false);

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

  const toggleSlType = v => setSlFilters(p => ({
    ...p, estateTypes: p.estateTypes.includes(v) ? p.estateTypes.filter(t => t !== v) : [...p.estateTypes, v],
  }));
  const toggleFeature = v => setSlFilters(p => ({
    ...p, featuresIncluded: p.featuresIncluded.includes(v)
      ? p.featuresIncluded.filter(f => f !== v) : [...p.featuresIncluded, v],
  }));

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
      // SeLoger — on passe les coords (pas l'adresse de rue) pour éviter l'échec autocomplete
      fetch('/api/seloger/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, radius, filters: buildSlFilters(slFilters, pageSize) }),
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
      ? { data: slRes.value, fetchedAt: new Date().toISOString() }
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

  return (
    <div className="form-view">
      <button className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Retour
      </button>

      <div className="form-card">
        <h2 className="form-title">Nouvelle analyse</h2>
        <p className="form-sub">Saisissez l&apos;adresse du bien à analyser et définissez son profil.</p>

        <form onSubmit={handleSubmit} className="form-body">
          {/* Address */}
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
                  <p className="recent-title">Récentes</p>
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

          {/* Radius */}
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
            <p className="form-hint">Zone de recherche autour de l&apos;adresse pour les données DVF</p>
          </div>

          {/* Target property */}
          <div className="form-section-title">Caractéristiques du bien cible</div>
          <div className="form-row-3">
            <div className="form-field">
              <label className="form-label">Surface (m²)</label>
              <input type="number" className="fp-input fp-wide" placeholder="Ex : 65"
                value={surface} onChange={e => setSurface(e.target.value)} min="5" />
            </div>
            <div className="form-field">
              <label className="form-label">Pièces</label>
              <input type="number" className="fp-input" placeholder="Ex : 3"
                value={rooms} onChange={e => setRooms(e.target.value)} min="1" max="20" />
            </div>
            <div className="form-field">
              <label className="form-label">Type</label>
              <div className="fp-chips">
                {[{ v: 'Apartment', l: '🏢 Appartement' }, { v: 'House', l: '🏠 Maison' }].map(o => (
                  <button key={o.v} type="button"
                    className={`chip${type === o.v ? ' on' : ''}`}
                    onClick={() => setType(o.v)}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional property characteristics */}
          <button type="button" className="filter-btn" onClick={() => setShowChar(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Caractéristiques du bien <span className="filter-btn-hint">(optionnel · améliore l&apos;estimation)</span>
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

          {/* Advanced SeLoger filters toggle */}
          <button type="button" className="filter-btn" onClick={() => setShowAdv(v => !v)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/>
              <line x1="10" y1="18" x2="14" y2="18"/>
            </svg>
            Filtres SeLoger avancés
            <svg className={`chevron${showAdv ? ' up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showAdv && (
            <div className="filter-panel">
              <div className="fp-grid">
                <div className="fp-group">
                  <span className="fp-lbl">Type SeLoger</span>
                  <div className="fp-chips">
                    {SELOGER_ESTATE_TYPES.map(t => (
                      <button key={t.value} type="button"
                        className={`chip${slFilters.estateTypes.includes(t.value) ? ' on' : ''}`}
                        onClick={() => toggleSlType(t.value)}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Pièces</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input" placeholder="Min" min="1"
                      value={slFilters.numberOfRoomsMin}
                      onChange={e => setSlFilters(p => ({ ...p, numberOfRoomsMin: e.target.value }))} />
                    <span className="fp-dash">—</span>
                    <input type="number" className="fp-input" placeholder="Max" min="1"
                      value={slFilters.numberOfRoomsMax}
                      onChange={e => setSlFilters(p => ({ ...p, numberOfRoomsMax: e.target.value }))} />
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Budget €</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input fp-wide" placeholder="Min"
                      value={slFilters.priceMin}
                      onChange={e => setSlFilters(p => ({ ...p, priceMin: e.target.value }))} />
                    <span className="fp-dash">—</span>
                    <input type="number" className="fp-input fp-wide" placeholder="Max"
                      value={slFilters.priceMax}
                      onChange={e => setSlFilters(p => ({ ...p, priceMax: e.target.value }))} />
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Surface m²</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input" placeholder="Min"
                      value={slFilters.spaceMin}
                      onChange={e => setSlFilters(p => ({ ...p, spaceMin: e.target.value }))} />
                    <span className="fp-dash">—</span>
                    <input type="number" className="fp-input" placeholder="Max"
                      value={slFilters.spaceMax}
                      onChange={e => setSlFilters(p => ({ ...p, spaceMax: e.target.value }))} />
                  </div>
                </div>
                <div className="fp-group">
                  <span className="fp-lbl">Résultats</span>
                  <div className="fp-chips">
                    {[10,30,50,100].map(s => (
                      <button key={s} type="button"
                        className={`chip chip-sm${pageSize === s ? ' on' : ''}`}
                        onClick={() => setPageSize(s)}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="fp-group fp-group-full">
                  <span className="fp-lbl">Options</span>
                  <div className="fp-chips">
                    {SELOGER_FEATURES.map(f => (
                      <button key={f.value} type="button"
                        className={`chip${slFilters.featuresIncluded.includes(f.value) ? ' on' : ''}`}
                        onClick={() => toggleFeature(f.value)}>
                        {f.icon} {f.label}
                      </button>
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

          <button type="submit" className="search-btn form-submit" disabled={!address.trim() || loading}>
            {loading
              ? <><span className="btn-spin" />{step || 'Extraction…'}</>
              : <>Lancer l&apos;analyse <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
            }
          </button>
        </form>
      </div>
    </div>
  );
}
