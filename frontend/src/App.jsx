import { useState, useEffect, useRef } from 'react';
import './App.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const SELOGER_FEATURES = [
  { value: 'Parking_Garage',         label: 'Parking',         icon: '🅿️' },
  { value: 'Balcony_Terrace',        label: 'Balcon',          icon: '🌿' },
  { value: 'Garden',                 label: 'Jardin',          icon: '🌳' },
  { value: 'Swimming_Pool',          label: 'Piscine',         icon: '🏊' },
  { value: 'Cellar',                 label: 'Cave',            icon: '📦' },
  { value: 'Kitchen_Fully_Equipped', label: 'Cuisine équipée', icon: '🍳' },
  { value: 'Exclusive',              label: 'Exclusivité',     icon: '⭐' },
];

const SELOGER_ESTATE_TYPES = [
  { value: 'House',     label: 'Maison',      icon: '🏠' },
  { value: 'Apartment', label: 'Appartement', icon: '🏢' },
];

const MA_ITEM_TYPES = [
  { value: 'ITEM_TYPE.HOUSE',     label: 'Maison',      icon: '🏠' },
  { value: 'ITEM_TYPE.APARTMENT', label: 'Appartement', icon: '🏢' },
];

const DEFAULT_SELOGER = {
  estateTypes: ['House', 'Apartment'],
  numberOfRoomsMin: '', numberOfRoomsMax: '',
  priceMin: '', priceMax: '',
  spaceMin: '', spaceMax: '',
  featuresIncluded: [],
};

const DEFAULT_MA = {
  roomCount: [],
  itemTypes: ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'],
  priceMin: '', priceMax: '',
  areaMin: '', areaMax: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isoToday = () => new Date().toISOString().slice(0, 10);

const extractKf = (kf, kw) =>
  kf.find(f => f.includes(kw))?.replace(new RegExp(` ?${kw}s?`), '') || '';

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [dataSource,     setDataSource]     = useState('seloger');
  const [address,        setAddress]        = useState('');
  const [selogerFilters, setSelogerFilters] = useState(DEFAULT_SELOGER);
  const [maFilters,      setMaFilters]      = useState(DEFAULT_MA);
  const [pageSize,       setPageSize]       = useState(30);

  const [results,        setResults]        = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [searchedAddr,   setSearchedAddr]   = useState('');

  const [counting,       setCounting]       = useState(false);
  const [resultCount,    setResultCount]    = useState(null);
  const [showFilters,    setShowFilters]    = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecent,     setShowRecent]     = useState(false);

  const inputRef  = useRef(null);
  const resultsRef = useRef(null);

  // Persist recent searches
  useEffect(() => {
    try {
      const s = localStorage.getItem('estimia_recent');
      if (s) setRecentSearches(JSON.parse(s));
    } catch { /* ignore */ }
  }, []);

  const saveRecent = (addr) => {
    const updated = [addr, ...recentSearches.filter(r => r !== addr)].slice(0, 8);
    setRecentSearches(updated);
    try { localStorage.setItem('estimia_recent', JSON.stringify(updated)); } catch { /* ignore */ }
  };

  // Build SeLoger filters object
  const buildSelogerFilters = () => {
    const c = { size: pageSize };
    if (selogerFilters.estateTypes.length)       c.estateTypes       = selogerFilters.estateTypes;
    if (selogerFilters.numberOfRoomsMin !== '')   c.numberOfRoomsMin  = +selogerFilters.numberOfRoomsMin;
    if (selogerFilters.numberOfRoomsMax !== '')   c.numberOfRoomsMax  = +selogerFilters.numberOfRoomsMax;
    if (selogerFilters.priceMin !== '')           c.priceMin          = +selogerFilters.priceMin;
    if (selogerFilters.priceMax !== '')           c.priceMax          = +selogerFilters.priceMax;
    if (selogerFilters.spaceMin !== '')           c.spaceMin          = +selogerFilters.spaceMin;
    if (selogerFilters.spaceMax !== '')           c.spaceMax          = +selogerFilters.spaceMax;
    if (selogerFilters.featuresIncluded.length)   c.featuresIncluded  = selogerFilters.featuresIncluded;
    return c;
  };

  // Live count (SeLoger only)
  useEffect(() => {
    if (dataSource !== 'seloger' || address.length < 2) { setResultCount(null); return; }
    const t = setTimeout(async () => {
      setCounting(true);
      try {
        const r = await fetch('/api/seloger/count', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, filters: buildSelogerFilters() }),
        });
        const d = await r.json();
        setResultCount(d.count?.totalCount ?? d.count ?? 0);
      } catch { setResultCount(null); }
      finally   { setCounting(false); }
    }, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, selogerFilters, pageSize, dataSource]);

  // Submit search
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!address.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setShowRecent(false);
    setSearchedAddr(address.trim());
    saveRecent(address.trim());

    try {
      if (dataSource === 'seloger') {
        const res  = await fetch('/api/seloger/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, filters: buildSelogerFilters() }),
        });
        const data = await res.json();
        if (data.error) setError(data.error); else setResults(data);
      } else {
        const geo  = await fetch('/api/immobilier/geocode', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address }),
        });
        const gd   = await geo.json();
        if (!gd.response?.places?.length) {
          setError('Adresse non trouvée. Essayez un nom de ville ou de quartier.');
        } else {
          const { lat, lng } = gd.response.places[0]._geoloc;
          const delta = 0.002;
          const payload = {
            bounds: [lat - delta, lng - delta, lat + delta, lng + delta],
            roomCount: maFilters.roomCount, itemTypes: maFilters.itemTypes,
          };
          if (maFilters.priceMin !== '') payload.priceMin = +maFilters.priceMin;
          if (maFilters.priceMax !== '') payload.priceMax = +maFilters.priceMax;
          if (maFilters.areaMin  !== '') payload.areaMin  = +maFilters.areaMin;
          if (maFilters.areaMax  !== '') payload.areaMax  = +maFilters.areaMax;
          const res  = await fetch('/api/immobilier/search', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) setResults(data.data); else setError(data.error || 'Erreur serveur');
        }
      }
    } catch (err) {
      setError('Erreur de connexion : ' + err.message);
    } finally {
      setLoading(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  };

  // Filter helpers
  const resetFilters = () => { setSelogerFilters(DEFAULT_SELOGER); setMaFilters(DEFAULT_MA); setPageSize(30); };

  const toggleSEType = v => setSelogerFilters(p => ({
    ...p, estateTypes: p.estateTypes.includes(v) ? p.estateTypes.filter(t => t !== v) : [...p.estateTypes, v],
  }));
  const toggleFeature = v => setSelogerFilters(p => ({
    ...p, featuresIncluded: p.featuresIncluded.includes(v)
      ? p.featuresIncluded.filter(f => f !== v) : [...p.featuresIncluded, v],
  }));
  const toggleMAType = v => setMaFilters(p => ({
    ...p, itemTypes: p.itemTypes.includes(v)
      ? p.itemTypes.length > 1 ? p.itemTypes.filter(t => t !== v) : p.itemTypes
      : [...p.itemTypes, v],
  }));
  const toggleMARoom = r => setMaFilters(p => ({
    ...p, roomCount: p.roomCount.includes(r)
      ? p.roomCount.filter(x => x !== r) : [...p.roomCount, r].sort((a, b) => a - b),
  }));

  const countActiveFilters = () => {
    if (dataSource === 'seloger') {
      let n = 0;
      if (selogerFilters.estateTypes.length < 2) n++;
      if (selogerFilters.numberOfRoomsMin !== '' || selogerFilters.numberOfRoomsMax !== '') n++;
      if (selogerFilters.priceMin !== '' || selogerFilters.priceMax !== '') n++;
      if (selogerFilters.spaceMin !== '' || selogerFilters.spaceMax !== '') n++;
      return n + selogerFilters.featuresIncluded.length;
    }
    let n = 0;
    if (maFilters.itemTypes.length < 2) n++;
    if (maFilters.roomCount.length > 0) n++;
    if (maFilters.priceMin !== '' || maFilters.priceMax !== '') n++;
    if (maFilters.areaMin  !== '' || maFilters.areaMax  !== '') n++;
    return n;
  };

  const priceMin   = dataSource === 'seloger' ? selogerFilters.priceMin : maFilters.priceMin;
  const priceMax   = dataSource === 'seloger' ? selogerFilters.priceMax : maFilters.priceMax;
  const spaceMin   = dataSource === 'seloger' ? selogerFilters.spaceMin : maFilters.areaMin;
  const spaceMax   = dataSource === 'seloger' ? selogerFilters.spaceMax : maFilters.areaMax;
  const setPriceMin = v => dataSource === 'seloger' ? setSelogerFilters(p => ({ ...p, priceMin: v })) : setMaFilters(p => ({ ...p, priceMin: v }));
  const setPriceMax = v => dataSource === 'seloger' ? setSelogerFilters(p => ({ ...p, priceMax: v })) : setMaFilters(p => ({ ...p, priceMax: v }));
  const setSpaceMin = v => dataSource === 'seloger' ? setSelogerFilters(p => ({ ...p, spaceMin: v })) : setMaFilters(p => ({ ...p, areaMin: v }));
  const setSpaceMax = v => dataSource === 'seloger' ? setSelogerFilters(p => ({ ...p, spaceMax: v })) : setMaFilters(p => ({ ...p, areaMax: v }));

  // Export
  const dl = (content, mime, name) => {
    const b = new Blob(['\uFEFF' + content], { type: mime + ';charset=utf-8;' });
    const u = URL.createObjectURL(b);
    const a = Object.assign(document.createElement('a'), { href: u, download: name, style: 'display:none' });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
  };

  const exportData = (fmt) => {
    const sep = fmt === 'csv' ? ',' : '\t';
    const q   = v => fmt === 'csv' && typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    if (dataSource === 'seloger') {
      const list = results?.classifieds || [];
      if (!list.length) return;
      const H = ['#','Type','Prix','€/m²','Pièces','Chambres','Surface','Ville','CP','Quartier','Agence','Note','URL'];
      const rows = list.map((c, i) => {
        const kf = c.hardFacts?.keyfacts || [];
        return [i+1, q(c.hardFacts?.title||''), q(c.hardFacts?.price?.value||''),
          c.hardFacts?.price?.additionalInformation||'',
          extractKf(kf,'pièce'), extractKf(kf,'chambre'), extractKf(kf,'m²'),
          q(c.location?.address?.city||''), c.location?.address?.zipCode||'',
          q(c.location?.address?.district||''), q(c.provider?.intermediaryCard?.title||''),
          c.provider?.rating?.rating||'', q(c.url||'')].join(sep);
      });
      dl([H.join(sep), ...rows].join('\n'), fmt==='csv'?'text/csv':'application/vnd.ms-excel',
        `seloger_${searchedAddr}_${isoToday()}.${fmt==='csv'?'csv':'xls'}`);
    } else {
      const fs = results?.features || [];
      if (!fs.length) return;
      const H = ['#','Adresse','Pièces','Surface m²','Prix','Prix actualisé','€/m²','Date'];
      const rows = fs.map((f, i) => {
        const p = f.properties;
        return [i+1, q(p.address_name), p.room_count, p.area, q(p.price),
          p.updated_price, Math.round(p.updated_price/p.area), p.sale_at].join(sep);
      });
      dl([H.join(sep), ...rows].join('\n'), fmt==='csv'?'text/csv':'application/vnd.ms-excel',
        `dvf_${isoToday()}.${fmt==='csv'?'csv':'xls'}`);
    }
  };

  // Derived
  const activeFilters = countActiveFilters();
  const slList        = results?.classifieds || [];
  const maFeats       = results?.features    || [];
  const maAvg         = fn => maFeats.length
    ? Math.round(maFeats.reduce((s, f) => s + fn(f.properties), 0) / maFeats.length) : 0;

  return (
    <div className="app">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="navbar">
        <div className="nav-inner">
          <a className="nav-logo" href="/" onClick={e => { e.preventDefault(); setResults(null); setError(null); setAddress(''); }}>
            <div className="logo-mark">E</div>
            <div className="logo-text">
              <span className="logo-name">Estimia</span>
              <span className="logo-tagline">Analyse du marché immobilier</span>
            </div>
          </a>

          <nav className="source-nav">
            <button
              className={`src-pill${dataSource === 'seloger' ? ' active' : ''}`}
              onClick={() => { setDataSource('seloger'); setResults(null); setError(null); }}
            >
              <span className="src-dot" />
              Offres en cours
            </button>
            <button
              className={`src-pill${dataSource === 'meilleursagents' ? ' active' : ''}`}
              onClick={() => { setDataSource('meilleursagents'); setResults(null); setError(null); }}
            >
              <span className="src-dot" />
              Ventes passées (DVF)
            </button>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">
            {dataSource === 'seloger' ? '🏘️ SeLoger — offres actives' : '📊 MeilleursAgents — données DVF'}
          </div>
          <h1 className="hero-title">
            {dataSource === 'seloger'
              ? <>Collectez les offres <em>du marché</em></>
              : <>Analysez les ventes <em>passées</em></>}
          </h1>
          <p className="hero-sub">
            {dataSource === 'seloger'
              ? `Extrayez les annonces en cours sur une zone géographique pour analyser les prix pratiqués, les typologies de biens et les tendances du marché.`
              : `Accédez aux transactions DVF géolocalisées pour estimer la valeur d'un bien, comparer les prix au m² et identifier les tendances de vente.`}
          </p>

          {/* Search bar */}
          <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-field">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                className="search-input"
                placeholder="Zone à analyser — ville, quartier, arrondissement…"
                value={address}
                onChange={e => { setAddress(e.target.value); setShowRecent(true); }}
                onFocus={() => setShowRecent(true)}
                onBlur={() => setTimeout(() => setShowRecent(false), 180)}
                autoComplete="off"
              />

              {/* Live count badge */}
              {dataSource === 'seloger' && address.length >= 2 && (resultCount !== null || counting) && (
                <div className={`live-badge${counting ? ' counting' : ''}`}>
                  {counting
                    ? <span className="live-spin" />
                    : <>{resultCount?.toLocaleString('fr-FR')} offres</>
                  }
                </div>
              )}

              {/* Recent searches */}
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

            <button type="submit" className="search-btn" disabled={!address.trim() || loading}>
              {loading
                ? <span className="btn-spin" />
                : <>Extraire les données <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></>
              }
            </button>
          </form>

          {/* Filter toggle row */}
          <div className="filter-row">
            <button
              type="button"
              className={`filter-btn${showFilters ? ' open' : ''}`}
              onClick={() => setShowFilters(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/>
                <line x1="10" y1="18" x2="14" y2="18"/>
              </svg>
              Filtres avancés
              {activeFilters > 0 && <span className="filter-badge">{activeFilters}</span>}
              <svg className={`chevron${showFilters ? ' up' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {activeFilters > 0 && (
              <button type="button" className="clear-btn" onClick={resetFilters}>
                Effacer tout
              </button>
            )}
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="filter-panel">
              <div className="fp-grid">
                <div className="fp-group">
                  <span className="fp-lbl">Type de bien</span>
                  <div className="fp-chips">
                    {(dataSource === 'seloger' ? SELOGER_ESTATE_TYPES : MA_ITEM_TYPES).map(t => {
                      const on = dataSource === 'seloger'
                        ? selogerFilters.estateTypes.includes(t.value)
                        : maFilters.itemTypes.includes(t.value);
                      return (
                        <button key={t.value} type="button" className={`chip${on ? ' on' : ''}`}
                          onClick={() => dataSource === 'seloger' ? toggleSEType(t.value) : toggleMAType(t.value)}>
                          {t.icon} {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Pièces</span>
                  {dataSource === 'meilleursagents' ? (
                    <div className="fp-chips">
                      {[1,2,3,4,5].map(r => (
                        <button key={r} type="button"
                          className={`chip chip-sm${maFilters.roomCount.includes(r) ? ' on' : ''}`}
                          onClick={() => toggleMARoom(r)}>
                          {r}{r === 5 ? '+' : ''}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="fp-range">
                      <input type="number" className="fp-input" placeholder="Min" min="1" max="15"
                        value={selogerFilters.numberOfRoomsMin}
                        onChange={e => setSelogerFilters(p => ({ ...p, numberOfRoomsMin: e.target.value }))} />
                      <span className="fp-dash">—</span>
                      <input type="number" className="fp-input" placeholder="Max" min="1" max="15"
                        value={selogerFilters.numberOfRoomsMax}
                        onChange={e => setSelogerFilters(p => ({ ...p, numberOfRoomsMax: e.target.value }))} />
                    </div>
                  )}
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Budget (€)</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input fp-wide" placeholder="Min" min="0" step="5000"
                      value={priceMin} onChange={e => setPriceMin(e.target.value)} />
                    <span className="fp-dash">—</span>
                    <input type="number" className="fp-input fp-wide" placeholder="Max" min="0" step="5000"
                      value={priceMax} onChange={e => setPriceMax(e.target.value)} />
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Surface (m²)</span>
                  <div className="fp-range">
                    <input type="number" className="fp-input" placeholder="Min" min="0"
                      value={spaceMin} onChange={e => setSpaceMin(e.target.value)} />
                    <span className="fp-dash">—</span>
                    <input type="number" className="fp-input" placeholder="Max" min="0"
                      value={spaceMax} onChange={e => setSpaceMax(e.target.value)} />
                  </div>
                </div>

                <div className="fp-group">
                  <span className="fp-lbl">Résultats</span>
                  <div className="fp-chips">
                    {[10, 30, 50, 100].map(s => (
                      <button key={s} type="button"
                        className={`chip chip-sm${pageSize === s ? ' on' : ''}`}
                        onClick={() => setPageSize(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {dataSource === 'seloger' && (
                  <div className="fp-group fp-group-full">
                    <span className="fp-lbl">Options</span>
                    <div className="fp-chips">
                      {SELOGER_FEATURES.map(f => (
                        <button key={f.value} type="button"
                          className={`chip${selogerFilters.featuresIncluded.includes(f.value) ? ' on' : ''}`}
                          onClick={() => toggleFeature(f.value)}>
                          {f.icon} {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      <main className="results-section" ref={resultsRef}>

        {loading && (
          <div className="state-loading">
            <div className="spinner-ring" />
            <p>Extraction des données en cours…</p>
          </div>
        )}

        {!loading && error && (
          <div className="state-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong>Une erreur est survenue</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && results && (
          <div className="results-inner">
            {/* Results toolbar */}
            <div className="results-toolbar">
              <div className="results-info">
                <span className="results-num">
                  {dataSource === 'seloger' ? slList.length : maFeats.length}
                </span>
                <span className="results-desc">
                  {dataSource === 'seloger'
                    ? `offre${slList.length > 1 ? 's' : ''} collectée${slList.length > 1 ? 's' : ''}`
                    : `transaction${maFeats.length > 1 ? 's' : ''} enregistrée${maFeats.length > 1 ? 's' : ''}`}
                  &nbsp;·&nbsp;
                  <span className="results-loc">{searchedAddr}</span>
                  {dataSource === 'seloger' && results.totalCount > slList.length && (
                    <span className="results-total">
                      &nbsp;({results.totalCount?.toLocaleString('fr-FR')} sur le marché)
                    </span>
                  )}
                </span>
              </div>
              <div className="results-export">
                <button className="exp-btn" onClick={() => exportData('csv')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  CSV
                </button>
                <button className="exp-btn" onClick={() => exportData('xls')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Excel
                </button>
              </div>
            </div>

            {/* MA stats */}
            {dataSource === 'meilleursagents' && maFeats.length > 0 && (
              <div className="stats-strip">
                <div className="stat-item">
                  <span className="stat-label">Prix moyen / m²</span>
                  <span className="stat-value">{maAvg(p => p.updated_price / p.area).toLocaleString('fr-FR')} €</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Prix moyen</span>
                  <span className="stat-value">{maAvg(p => p.updated_price).toLocaleString('fr-FR')} €</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Surface moyenne</span>
                  <span className="stat-value">{maAvg(p => p.area)} m²</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Transactions</span>
                  <span className="stat-value">{maFeats.length}</span>
                </div>
              </div>
            )}

            {/* Table */}
            <div className="table-card">
              {dataSource === 'seloger' ? (
                slList.length === 0 ? (
                  <div className="empty-state">
                    <span>🔍</span>
                    <p>Aucune donnée collectée — élargissez la zone ou ajustez les filtres.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Type</th><th>Prix</th><th>€/m²</th>
                          <th>Détails</th><th>Localisation</th><th>Agence</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {slList.map((c, i) => {
                          const kf  = c.hardFacts?.keyfacts || [];
                          const loc = c.location?.address  || {};
                          const isAppt = c.hardFacts?.title?.toLowerCase().includes('appartement');
                          return (
                            <tr key={c.id || i}>
                              <td className="td-n">{i + 1}</td>
                              <td className="td-type">
                                <span>{isAppt ? '🏢' : '🏠'}</span>
                                {c.hardFacts?.title}
                              </td>
                              <td className="td-price">{c.hardFacts?.price?.value}</td>
                              <td className="td-ppm">{c.hardFacts?.price?.additionalInformation}</td>
                              <td>
                                <div className="kf-wrap">
                                  {kf.map((f, j) => <span key={j} className="kf-tag">{f}</span>)}
                                </div>
                              </td>
                              <td>
                                {loc.district && <div className="td-district">{loc.district}</div>}
                                <div className="td-city">{loc.city}{loc.zipCode ? ` (${loc.zipCode})` : ''}</div>
                              </td>
                              <td>
                                {c.provider?.intermediaryCard?.title && (
                                  <div className="td-agency">{c.provider.intermediaryCard.title}</div>
                                )}
                                {c.provider?.rating?.rating != null && (
                                  <div className="td-rating">⭐ {Number(c.provider.rating.rating).toFixed(1)}</div>
                                )}
                              </td>
                              <td>
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="view-link">
                                  Voir →
                                </a>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                maFeats.length === 0 ? (
                  <div className="empty-state">
                    <span>📊</span>
                    <p>Aucune transaction DVF trouvée dans cette zone.</p>
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>#</th><th>Adresse</th><th>Pièces</th><th>Surface m²</th>
                          <th>Prix d&apos;origine</th><th>Prix actualisé</th><th>€/m²</th><th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {maFeats.map((feat, i) => {
                          const p = feat.properties;
                          return (
                            <tr key={p.id || i}>
                              <td className="td-n">{i + 1}</td>
                              <td className="td-addr">{p.address_name}</td>
                              <td className="td-c">{p.room_count}</td>
                              <td className="td-c">{p.area}</td>
                              <td>{p.price}</td>
                              <td className="td-price">{p.updated_price?.toLocaleString('fr-FR')} €</td>
                              <td className="td-ppm">{Math.round(p.updated_price / p.area)?.toLocaleString('fr-FR')}</td>
                              <td className="td-date">{p.sale_at}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Empty state before any search */}
        {!loading && !error && !results && (
          <div className="landing-grid">
            <div className="landing-card">
              <div className="lc-icon">🏘️</div>
              <h3>Offres actives — SeLoger</h3>
              <p>Collectez les annonces en cours sur une zone pour analyser les prix demandés, les typologies de biens et l&apos;état du marché actuel.</p>
            </div>
            <div className="landing-card">
              <div className="lc-icon">📊</div>
              <h3>Ventes passées — DVF</h3>
              <p>Interrogez la base DVF pour connaître les prix réellement payés, calculer un prix au m² de référence et calibrer une estimation.</p>
            </div>
            <div className="landing-card">
              <div className="lc-icon">📥</div>
              <h3>Export structuré</h3>
              <p>Exportez les données brutes en CSV ou Excel et intégrez-les directement dans vos modèles d&apos;analyse ou vos outils BI.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        Données issues de SeLoger &amp; MeilleursAgents · Usage analytique uniquement · Non affilié
      </footer>
    </div>
  );
}
