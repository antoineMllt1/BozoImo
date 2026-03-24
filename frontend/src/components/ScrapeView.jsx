import { useState } from 'react';
import { RADIUS_OPTIONS } from '../utils/constants';
import { stripDvfSnapshot } from '../utils/storage';
import DvfTable     from './DvfTable';
import SelogerTable from './SelogerTable';

const METERS_PER_DEG_LAT = 111320;

async function safeJson(r) {
  const text = await r.text();
  if (!text) throw new Error('Réponse vide — service indisponible ou délai dépassé');
  try { return JSON.parse(text); }
  catch { throw new Error('Réponse non valide du serveur'); }
}
function radiusToBounds(lat, lng, r) {
  const dLat = r / METERS_PER_DEG_LAT;
  const dLng = r / (METERS_PER_DEG_LAT * Math.cos(lat * Math.PI / 180));
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng];
}

export default function ScrapeView({ onBack }) {
  const [query,    setQuery]    = useState('');
  const [radius,   setRadius]   = useState(500);
  const [sources,  setSources]  = useState({ dvf: true, seloger: true });
  const [type,     setType]     = useState('all'); // 'all'|'Apartment'|'House'
  const [pageSize, setPageSize] = useState(30);

  const [loading,  setLoading]  = useState(false);
  const [step,     setStep]     = useState('');
  const [error,    setError]    = useState(null);
  const [tab,      setTab]      = useState('dvf');

  const [dvfSnap,  setDvfSnap]  = useState(null);
  const [slSnap,   setSlSnap]   = useState(null);
  const [location, setLocation] = useState(null);

  const handleSearch = async e => {
    e.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    setDvfSnap(null);
    setSlSnap(null);

    // Geocode
    setStep('Géocodage…');
    let lat, lng;
    try {
      const r = await fetch('/api/immobilier/geocode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: query.trim() }),
      });
      const d = await r.json();
      const place = d.response?.places?.[0];
      if (!place) throw new Error('Adresse introuvable');
      lat = place._geoloc.lat;
      lng = place._geoloc.lng;
      setLocation({ label: place.value || query.trim(), lat, lng });
    } catch (err) {
      setLoading(false);
      setError('Géocodage impossible : ' + err.message);
      return;
    }

    setStep('Extraction des données…');

    const fetches = [];
    if (sources.dvf) {
      fetches.push(
        fetch('/api/immobilier/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bounds: radiusToBounds(lat, lng, radius),
            roomCount: [],
            itemTypes: type === 'House'
              ? ['ITEM_TYPE.HOUSE']
              : type === 'Apartment'
                ? ['ITEM_TYPE.APARTMENT']
                : ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'],
          }),
        }).then(safeJson).then(d => ({ src: 'dvf', d })).catch(e => ({ src: 'dvf', err: e.message }))
      );
    }
    if (sources.seloger) {
      fetches.push(
        fetch('/api/seloger/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, radius, filters: { size: pageSize } }),
        }).then(safeJson).then(d => ({ src: 'seloger', d })).catch(e => ({ src: 'seloger', err: e.message }))
      );
    }

    const results = await Promise.all(fetches);

    for (const res of results) {
      if (res.src === 'dvf') {
        if (res.err || !res.d?.success) {
          setDvfSnap({ error: res.err || res.d?.error || 'Erreur DVF' });
        } else {
          setDvfSnap({ data: stripDvfSnapshot(res.d.data), fetchedAt: new Date().toISOString(), radiusMeters: radius });
        }
      }
      if (res.src === 'seloger') {
        if (res.err || res.d?.error) {
          setSlSnap({ error: res.err || res.d.error });
        } else {
          setSlSnap({ data: res.d, fetchedAt: new Date().toISOString() });
        }
      }
    }

    // Auto-switch to the first successful tab
    if (sources.seloger) setTab('seloger');
    if (sources.dvf)     setTab('dvf');

    setLoading(false);
    setStep('');
  };

  const hasResults = dvfSnap || slSnap;

  return (
    <div className="scrape-view">
      <button className="back-btn" onClick={onBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
        Retour
      </button>

      <div className="scrape-layout">
        {/* Search panel */}
        <div className="scrape-form-card">
          <h2 className="form-title">Collecte de données</h2>
          <p className="form-sub">Extrayez les données de marché pour une adresse ou un quartier, sans créer de dossier d&apos;estimation.</p>

          <form onSubmit={handleSearch} className="form-body">
            <div className="form-field">
              <label className="form-label">Adresse ou quartier</label>
              <div className="search-field">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  type="text"
                  className="search-input"
                  placeholder="Ex : Montmartre Paris, 75018 Paris, 14 rue de Rivoli…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Rayon</label>
              <div className="fp-chips">
                {RADIUS_OPTIONS.map(o => (
                  <button key={o.value} type="button"
                    className={`chip${radius === o.value ? ' on' : ''}`}
                    onClick={() => setRadius(o.value)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Sources</label>
              <div className="fp-chips">
                <button type="button"
                  className={`chip${sources.dvf ? ' on' : ''}`}
                  onClick={() => setSources(p => ({ ...p, dvf: !p.dvf }))}>
                  📊 DVF (ventes passées)
                </button>
                <button type="button"
                  className={`chip${sources.seloger ? ' on' : ''}`}
                  onClick={() => setSources(p => ({ ...p, seloger: !p.seloger }))}>
                  🏘️ SeLoger (offres actives)
                </button>
              </div>
            </div>

            <div className="form-row-2">
              <div className="form-field">
                <label className="form-label">Type de bien</label>
                <div className="fp-chips">
                  {[{ v: 'all', l: 'Tous' }, { v: 'Apartment', l: '🏢 Appt' }, { v: 'House', l: '🏠 Maison' }].map(o => (
                    <button key={o.v} type="button"
                      className={`chip${type === o.v ? ' on' : ''}`}
                      onClick={() => setType(o.v)}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              {sources.seloger && (
                <div className="form-field">
                  <label className="form-label">Nb annonces SeLoger</label>
                  <div className="fp-chips">
                    {[10, 30, 50, 100].map(s => (
                      <button key={s} type="button"
                        className={`chip chip-sm${pageSize === s ? ' on' : ''}`}
                        onClick={() => setPageSize(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="state-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/>
                </svg>
                <div><strong>Erreur</strong><p>{error}</p></div>
              </div>
            )}

            <button type="submit" className="search-btn form-submit"
              disabled={!query.trim() || loading || (!sources.dvf && !sources.seloger)}>
              {loading
                ? <><span className="btn-spin" />{step || 'Extraction…'}</>
                : <>Extraire les données <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
              }
            </button>
          </form>
        </div>

        {/* Results */}
        {hasResults && (
          <div className="scrape-results">
            {location && (
              <div className="scrape-location-bar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="10" r="3"/><path d="M12 2a8 8 0 0 1 8 8c0 5-8 13-8 13S4 15 4 10a8 8 0 0 1 8-8z"/>
                </svg>
                <strong>{location.label}</strong>
                <span className="scrape-loc-coords">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
                <span className="scrape-loc-radius">· r = {radius >= 1000 ? `${radius/1000}km` : `${radius}m`}</span>
              </div>
            )}

            <div className="ws-tabs">
              {dvfSnap && (
                <button className={`ws-tab${tab === 'dvf' ? ' active' : ''}`} onClick={() => setTab('dvf')}>
                  📊 Ventes passées (DVF)
                  {dvfSnap.data?.features?.length > 0 && (
                    <span className="ws-tab-count">{dvfSnap.data.features.length}</span>
                  )}
                </button>
              )}
              {slSnap && (
                <button className={`ws-tab${tab === 'seloger' ? ' active' : ''}`} onClick={() => setTab('seloger')}>
                  🏘️ Offres actives (SeLoger)
                  {slSnap.data?.classifieds?.length > 0 && (
                    <span className="ws-tab-count">{slSnap.data.classifieds.length}</span>
                  )}
                </button>
              )}
            </div>

            {tab === 'dvf' && dvfSnap && (
              <DvfTable
                snapshot={dvfSnap}
                selectedComps={[]}
                onToggle={() => {}}
              />
            )}
            {tab === 'seloger' && slSnap && (
              <SelogerTable snapshot={slSnap} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
