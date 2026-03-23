import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [dataSource, setDataSource] = useState('seloger'); // 'seloger' ou 'meilleursagents'
  const [address, setAddress] = useState('');
  
  const [formData, setFormData] = useState({
    lat1: '',
    lng1: '',
    lat2: '',
    lng2: '',
    roomCount: [],
    itemTypes: ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'],
    priceMin: 0,
    priceMax: 2000000,
    areaMin: 0,
    areaMax: 300
  });
  
  // Filtres SeLoger
  const [selogerFilters, setSelogerFilters] = useState({
    estateTypes: ['House', 'Apartment'],
    numberOfRoomsMin: '',
    numberOfRoomsMax: '',
    priceMin: '',
    priceMax: '',
    spaceMin: '',
    spaceMax: '',
    featuresIncluded: []
  });
  
  const [loading, setLoading] = useState(false);
  const [counting, setCounting] = useState(false);
  const [resultCount, setResultCount] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const roomOptions = [1, 2, 3, 4, 5];
  const itemTypeOptions = [
    { value: 'ITEM_TYPE.HOUSE', label: 'Maison', icon: '🏠' },
    { value: 'ITEM_TYPE.APARTMENT', label: 'Appartement', icon: '🏢' }
  ];

  // Options pour SeLoger
  const selogerEstateTypes = [
    { value: 'House', label: 'Maison', icon: '🏠' },
    { value: 'Apartment', label: 'Appartement', icon: '🏢' }
  ];

  const selogerFeatures = [
    { value: 'Parking_Garage', label: 'Parking/Garage', icon: '🚗' },
    { value: 'Balcony_Terrace', label: 'Balcon/Terrasse', icon: '🌿' },
    { value: 'Garden', label: 'Jardin', icon: '🌳' },
    { value: 'Swimming_Pool', label: 'Piscine', icon: '🏊' },
    { value: 'Cellar', label: 'Cave', icon: '📦' },
    { value: 'Kitchen_Fully_Equipped', label: 'Cuisine équipée', icon: '🍳' },
    { value: 'Exclusive', label: 'Exclusivité', icon: '⭐' }
  ];

  const handleRoomToggle = (room) => {
    setFormData(prev => {
      const currentRooms = prev.roomCount;
      if (currentRooms.includes(room)) {
        return { ...prev, roomCount: currentRooms.filter(r => r !== room) };
      } else {
        return { ...prev, roomCount: [...currentRooms, room].sort() };
      }
    });
  };

  const handleItemTypeToggle = (type) => {
    setFormData(prev => {
      const currentTypes = prev.itemTypes;
      if (currentTypes.includes(type)) {
        if (currentTypes.length === 1) return prev;
        return { ...prev, itemTypes: currentTypes.filter(t => t !== type) };
      } else {
        return { ...prev, itemTypes: [...currentTypes, type] };
      }
    });
  };

  const handlePriceChange = (minOrMax, value) => {
    setFormData(prev => ({
      ...prev,
      [minOrMax]: parseInt(value)
    }));
  };

  const handleAreaChange = (minOrMax, value) => {
    setFormData(prev => ({
      ...prev,
      [minOrMax]: parseInt(value)
    }));
  };

  const formatPrice = (price) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M€`;
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(0)}k€`;
    }
    return `${price}€`;
  };

  const countActiveFilters = () => {
    let count = 0;
    if (formData.roomCount.length > 0) count += formData.roomCount.length;
    if (formData.priceMin > 0) count++;
    if (formData.priceMax < 2000000) count++;
    if (formData.areaMin > 0) count++;
    if (formData.areaMax < 300) count++;
    return count;
  };

  const countActiveSelogerFilters = () => {
    let count = 0;
    if (selogerFilters.estateTypes.length < 2) count++;
    if (selogerFilters.numberOfRoomsMin !== '' || selogerFilters.numberOfRoomsMax !== '') count++;
    if (selogerFilters.priceMin !== '' || selogerFilters.priceMax !== '') count++;
    if (selogerFilters.spaceMin !== '' || selogerFilters.spaceMax !== '') count++;
    if (selogerFilters.featuresIncluded.length > 0) count += selogerFilters.featuresIncluded.length;
    return count;
  };

  // Fonction de comptage des résultats SeLoger
  const handleCountResults = async () => {
    if (!address || address.length < 2) {
      setResultCount(null);
      return;
    }
    
    setCounting(true);
    try {
      // Nettoyer les filtres (enlever les valeurs vides)
      const cleanFilters = {};
      if (selogerFilters.estateTypes.length > 0) cleanFilters.estateTypes = selogerFilters.estateTypes;
      if (selogerFilters.numberOfRoomsMin !== '') cleanFilters.numberOfRoomsMin = parseInt(selogerFilters.numberOfRoomsMin);
      if (selogerFilters.numberOfRoomsMax !== '') cleanFilters.numberOfRoomsMax = parseInt(selogerFilters.numberOfRoomsMax);
      if (selogerFilters.priceMin !== '') cleanFilters.priceMin = parseInt(selogerFilters.priceMin);
      if (selogerFilters.priceMax !== '') cleanFilters.priceMax = parseInt(selogerFilters.priceMax);
      if (selogerFilters.spaceMin !== '') cleanFilters.spaceMin = parseInt(selogerFilters.spaceMin);
      if (selogerFilters.spaceMax !== '') cleanFilters.spaceMax = parseInt(selogerFilters.spaceMax);
      if (selogerFilters.featuresIncluded.length > 0) cleanFilters.featuresIncluded = selogerFilters.featuresIncluded;
      
      const response = await fetch('http://localhost:5000/api/seloger/count', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          filters: cleanFilters
        })
      });
      
      const data = await response.json();
      setResultCount(data.count?.totalCount || data.count || 0);
    } catch (err) {
      console.error('Erreur comptage:', err);
      setResultCount(null);
    } finally {
      setCounting(false);
    }
  };

  // Déclencher le comptage automatiquement
  useEffect(() => {
    if (dataSource === 'seloger' && address.length >= 2) {
      const timer = setTimeout(() => {
        handleCountResults();
      }, 500); // Debounce 500ms
      
      return () => clearTimeout(timer);
    } else {
      setResultCount(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, selogerFilters, dataSource]);

  // Export SeLoger en CSV
  const exportSelogerToCSV = () => {
    if (!results || !results.classifieds || results.classifieds.length === 0) return;

    const headers = ['#', 'Type', 'Prix', '€/m²', 'Pièces', 'Chambres', 'Surface', 'Ville', 'Code Postal', 'Quartier', 'Agence', 'Note', 'URL'];
    
    const rows = results.classifieds.map((classified, index) => {
      const keyfacts = classified.hardFacts?.keyfacts || [];
      const rooms = keyfacts.find(f => f.includes('pièce'))?.replace(' pièces', '') || '';
      const bedrooms = keyfacts.find(f => f.includes('chambre'))?.replace(' chambres', '').replace(' chambre', '') || '';
      const surface = keyfacts.find(f => f.includes('m²'))?.replace(' m²', '') || '';
      
      return [
        index + 1,
        classified.hardFacts?.title || '',
        `"${classified.hardFacts?.price?.value || ''}"`,
        classified.hardFacts?.price?.additionalInformation || '',
        rooms,
        bedrooms,
        surface,
        classified.location?.address?.city || '',
        classified.location?.address?.zipCode || '',
        classified.location?.address?.district || '',
        `"${classified.provider?.intermediaryCard?.title || ''}"`,
        classified.provider?.rating?.rating || '',
        `"${classified.url || ''}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `seloger_${address}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export MeilleursAgents en CSV
  const exportMeilleursAgentsToCSV = () => {
    if (!results || !results.features || results.features.length === 0) return;

    const headers = ['#', 'Adresse', 'Type', 'Surface (m²)', 'Prix', 'Prix actualisé', '€/m²', 'Date'];
    
    const rows = results.features.map((feature, index) => {
      const props = feature.properties;
      const pricePerSqm = props.area > 0 ? Math.round(props.updated_price / props.area) : 0;
      
      return [
        index + 1,
        `"${props.address_name}"`,
        props.room_count,
        props.area,
        `"${props.price}"`,
        props.updated_price,
        pricePerSqm,
        `"${props.sale_at}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `meilleursagents_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel
  const exportToExcel = () => {
    if (dataSource === 'seloger') {
      exportSelogerToExcel();
    } else {
      exportMeilleursAgentsToExcel();
    }
  };

  const exportSelogerToExcel = () => {
    if (!results || !results.classifieds || results.classifieds.length === 0) return;

    const headers = ['#', 'Type', 'Prix', '€/m²', 'Pièces', 'Chambres', 'Surface', 'Ville', 'Code Postal', 'Quartier', 'Agence', 'Note', 'URL'];
    
    const rows = results.classifieds.map((classified, index) => {
      const keyfacts = classified.hardFacts?.keyfacts || [];
      const rooms = keyfacts.find(f => f.includes('pièce'))?.replace(' pièces', '') || '';
      const bedrooms = keyfacts.find(f => f.includes('chambre'))?.replace(' chambres', '').replace(' chambre', '') || '';
      const surface = keyfacts.find(f => f.includes('m²'))?.replace(' m²', '') || '';
      
      return [
        index + 1,
        classified.hardFacts?.title || '',
        classified.hardFacts?.price?.value || '',
        classified.hardFacts?.price?.additionalInformation || '',
        rooms,
        bedrooms,
        surface,
        classified.location?.address?.city || '',
        classified.location?.address?.zipCode || '',
        classified.location?.address?.district || '',
        classified.provider?.intermediaryCard?.title || '',
        classified.provider?.rating?.rating || '',
        classified.url || ''
      ].join('\t');
    });

    const content = [headers.join('\t'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `seloger_${address}_${new Date().toISOString().slice(0, 10)}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMeilleursAgentsToExcel = () => {
    if (!results || !results.features || results.features.length === 0) return;

    const headers = ['#', 'Adresse', 'Type', 'Surface (m²)', 'Prix', 'Prix actualisé (€)', '€/m²', 'Date', 'Ville', 'Code Postal'];
    
    const rows = results.features.map((feature, index) => {
      const props = feature.properties;
      const pricePerSqm = props.area > 0 ? Math.round(props.updated_price / props.area) : 0;
      
      return [
        index + 1,
        props.address_name,
        props.room_count,
        props.area,
        props.price,
        props.updated_price,
        pricePerSqm,
        props.sale_at,
        props.city_name,
        props.zip
      ].join('\t');
    });

    const content = [
      headers.join('\t'),
      ...rows,
      '',
      'Statistiques',
      `Prix moyen/m²\t${Math.round(results.features.reduce((sum, f) => sum + (f.properties.updated_price / f.properties.area), 0) / results.features.length)} €`,
      `Prix moyen\t${Math.round(results.features.reduce((sum, f) => sum + f.properties.updated_price, 0) / results.features.length).toLocaleString('fr-FR')} €`,
      `Surface moyenne\t${Math.round(results.features.reduce((sum, f) => sum + f.properties.area, 0) / results.features.length)} m²`
    ].join('\n');

    const blob = new Blob(['\uFEFF' + content], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `meilleursagents_${new Date().toISOString().slice(0, 10)}.xls`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      if (dataSource === 'seloger') {
        // Recherche SeLoger avec filtres nettoyés
        const cleanFilters = {};
        if (selogerFilters.estateTypes.length > 0) cleanFilters.estateTypes = selogerFilters.estateTypes;
        if (selogerFilters.numberOfRoomsMin !== '') cleanFilters.numberOfRoomsMin = parseInt(selogerFilters.numberOfRoomsMin);
        if (selogerFilters.numberOfRoomsMax !== '') cleanFilters.numberOfRoomsMax = parseInt(selogerFilters.numberOfRoomsMax);
        if (selogerFilters.priceMin !== '') cleanFilters.priceMin = parseInt(selogerFilters.priceMin);
        if (selogerFilters.priceMax !== '') cleanFilters.priceMax = parseInt(selogerFilters.priceMax);
        if (selogerFilters.spaceMin !== '') cleanFilters.spaceMin = parseInt(selogerFilters.spaceMin);
        if (selogerFilters.spaceMax !== '') cleanFilters.spaceMax = parseInt(selogerFilters.spaceMax);
        if (selogerFilters.featuresIncluded.length > 0) cleanFilters.featuresIncluded = selogerFilters.featuresIncluded;
        
        const response = await fetch('http://localhost:5000/api/seloger/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            address: address,
            filters: cleanFilters
          })
        });

        const data = await response.json();

        if (data.error) {
          setError(data.error);
        } else {
          setResults(data);
        }
      } else {
        // Recherche MeilleursAgents - Géocodage automatique
        try {
          // 1. Géocoder l'adresse
          const geocodeResponse = await fetch('http://localhost:5000/api/immobilier/geocode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ address: address })
          });

          const geocodeData = await geocodeResponse.json();
          
          if (!geocodeData.response || !geocodeData.response.places || geocodeData.response.places.length === 0) {
            setError('Adresse non trouvée');
            return;
          }

          const place = geocodeData.response.places[0];
          const lat = place._geoloc.lat;
          const lng = place._geoloc.lng;
          
          const latOffset = 0.00236;
          const lngOffset = 0.00196;
          
          const bounds = [
            lat - latOffset,
            lng - lngOffset,
            lat + latOffset,
            lng + lngOffset
          ];

          // 2. Rechercher avec les coordonnées
          const payload = {
            bounds,
            roomCount: formData.roomCount,
            itemTypes: formData.itemTypes
          };

          if (formData.priceMin > 0) {
            payload.priceMin = formData.priceMin;
          }
          if (formData.priceMax < 2000000) {
            payload.priceMax = formData.priceMax;
          }
          if (formData.areaMin > 0) {
            payload.areaMin = formData.areaMin;
          }
          if (formData.areaMax < 300) {
            payload.areaMax = formData.areaMax;
          }

          const response = await fetch('http://localhost:5000/api/immobilier/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();

          if (data.success) {
            setResults(data.data);
          } else {
            setError(data.error || 'Une erreur est survenue');
          }
        } catch (geocodeErr) {
          setError('Erreur lors du géocodage: ' + geocodeErr.message);
        }
      }
    } catch (err) {
      setError('Erreur de connexion au serveur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour changer de source et réinitialiser
  const handleSourceChange = (newSource) => {
    setDataSource(newSource);
    setAddress('');
    setResults(null);
    setError(null);
    setResultCount(null);
    // Réinitialiser les filtres SeLoger
    if (newSource === 'seloger') {
      setSelogerFilters({
        estateTypes: ['House', 'Apartment'],
        numberOfRoomsMin: '',
        numberOfRoomsMax: '',
        priceMin: '',
        priceMax: '',
        spaceMin: '',
        spaceMax: '',
        featuresIncluded: []
      });
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🏠 Estimia</h1>
        <p>Antoine te fait gagner le temps qu'il t'a fait perdre</p>
      </header>

      <main className="container">
        {/* Sélecteur de source */}
        <div className="source-selector">
          <button
            type="button"
            className={`source-btn ${dataSource === 'seloger' ? 'active' : ''}`}
            onClick={() => handleSourceChange('seloger')}
          >
            <div className="source-icon">🏘️</div>
            <div className="source-info">
              <div className="source-name">SeLoger</div>
              <div className="source-desc">Annonces actives</div>
            </div>
          </button>
          <button
            type="button"
            className={`source-btn ${dataSource === 'meilleursagents' ? 'active' : ''}`}
            onClick={() => handleSourceChange('meilleursagents')}
          >
            <div className="source-icon">📊</div>
            <div className="source-info">
              <div className="source-name">MeilleursAgents</div>
              <div className="source-desc">Historique DVF</div>
            </div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="search-form">
          {dataSource === 'seloger' ? (
            // Interface SeLoger - Avec compteur et filtres
            <>
              <div className="form-section">
                <label className="section-label">Quartier ou Ville</label>
                <input
                  type="text"
                  className="address-input"
                  placeholder=""
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Compteur de résultats */}
              {address && address.length >= 2 && (
                <div className="result-counter">
                  {counting ? (
                    <div className="counting">
                      <div className="spinner"></div>
                      Comptage...
                    </div>
                  ) : resultCount !== null ? (
                    <div className="count-display">
                      📊 {resultCount} bien{resultCount > 1 ? 's' : ''} trouvé{resultCount > 1 ? 's' : ''}
                    </div>
                  ) : null}
                </div>
              )}

              {/* Bouton filtres */}
              <button
                type="button"
                className="filters-btn"
                onClick={() => setShowFilters(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="16" y2="6"/>
                  <line x1="4" y1="12" x2="16" y2="12"/>
                  <line x1="4" y1="18" x2="16" y2="18"/>
                  <circle cx="18" cy="6" r="2"/>
                  <circle cx="18" cy="12" r="2"/>
                  <circle cx="18" cy="18" r="2"/>
                </svg>
                Filtres
                {countActiveSelogerFilters() > 0 && (
                  <span className="filter-badge">{countActiveSelogerFilters()}</span>
                )}
              </button>
            </>
          ) : (
            // Interface MeilleursAgents - Simple
            <>
              <div className="form-section">
                <label className="section-label">Quartier ou Ville</label>
                <input
                  type="text"
                  className="address-input"
                  placeholder=""
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <button
                type="button"
                className="filters-btn"
                onClick={() => setShowFilters(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="16" y2="6"/>
                  <line x1="4" y1="12" x2="16" y2="12"/>
                  <line x1="4" y1="18" x2="16" y2="18"/>
                  <circle cx="18" cy="6" r="2"/>
                  <circle cx="18" cy="12" r="2"/>
                  <circle cx="18" cy="18" r="2"/>
                </svg>
                Filtres
                {countActiveFilters() > 0 && (
                  <span className="filter-badge">{countActiveFilters()}</span>
                )}
              </button>
            </>
          )}

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading || !address}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Recherche en cours...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <path d="m21 21-4.35-4.35"/>
                </svg>
                Rechercher
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="error-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div className="error-content">
              <h3>Erreur</h3>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Résultats SeLoger */}
        {results && dataSource === 'seloger' && results.classifieds && results.classifieds.length > 0 && (
          <div className="results-box">
            <div className="results-header">
              <div className="results-title">
                <h2>🏘️ {results.totalCount} biens trouvés sur SeLoger</h2>
                <p className="results-subtitle">
                  {results.location.address} · {results.classifieds.length} annonces affichées
                </p>
              </div>
              <div className="export-buttons">
                <button onClick={exportSelogerToCSV} className="export-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  CSV
                </button>
                <button onClick={exportToExcel} className="export-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Excel
                </button>
              </div>
            </div>
            <div className="table-container">
              <table className="results-table seloger-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Prix</th>
                    <th>€/m²</th>
                    <th>Détails</th>
                    <th>Localisation</th>
                    <th>Agence</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.classifieds.map((classified, index) => {
                    const keyfacts = classified.hardFacts?.keyfacts || [];
                    const location = classified.location?.address || {};
                    
                    return (
                      <tr key={classified.id}>
                        <td>{index + 1}</td>
                        <td className="type-cell">
                          {classified.hardFacts?.title?.includes('Appartement') ? '🏢' : '🏠'}
                          <span>{classified.hardFacts?.title}</span>
                        </td>
                        <td className="price-cell highlight">{classified.hardFacts?.price?.value}</td>
                        <td className="center">{classified.hardFacts?.price?.additionalInformation}</td>
                        <td className="details-cell">
                          {keyfacts.map((fact, i) => (
                            <span key={i} className="keyfact">{fact}</span>
                          ))}
                        </td>
                        <td className="location-cell">
                          {location.district && <div className="district">{location.district}</div>}
                          <div className="city">{location.city} ({location.zipCode})</div>
                        </td>
                        <td className="agency-cell">
                          <div className="agency-name">{classified.provider?.intermediaryCard?.title}</div>
                          {classified.provider?.rating && (
                            <div className="agency-rating">
                              ⭐ {classified.provider.rating.rating.toFixed(1)} ({classified.provider.rating.reviews})
                            </div>
                          )}
                        </td>
                        <td className="actions-cell">
                          <a href={classified.url} target="_blank" rel="noopener noreferrer" className="view-btn">
                            Voir
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Résultats MeilleursAgents */}
        {results && dataSource === 'meilleursagents' && results.features && results.features.length > 0 && (
          <div className="results-box">
            <div className="results-header">
              <div className="results-title">
                <h2>📊 {results.features.length} transactions trouvées</h2>
              </div>
              <div className="export-buttons">
                <button onClick={exportMeilleursAgentsToCSV} className="export-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  CSV
                </button>
                <button onClick={exportToExcel} className="export-btn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Excel
                </button>
              </div>
            </div>
            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Adresse</th>
                    <th>Type</th>
                    <th>Surface (m²)</th>
                    <th>Prix</th>
                    <th>Prix actualisé</th>
                    <th>€/m²</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {results.features.map((feature, index) => {
                    const props = feature.properties;
                    const pricePerSqm = props.area > 0 
                      ? Math.round(props.updated_price / props.area)
                      : 0;
                    
                    return (
                      <tr key={props.id || index}>
                        <td>{index + 1}</td>
                        <td className="address-cell">{props.address_name}</td>
                        <td className="center">{props.room_count}</td>
                        <td className="center">{props.area}</td>
                        <td className="price-cell">{props.price}</td>
                        <td className="price-cell">
                          {props.updated_price.toLocaleString('fr-FR')} €
                        </td>
                        <td className="center highlight">{pricePerSqm.toLocaleString('fr-FR')}</td>
                        <td className="center">{props.sale_at}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="stats-box">
              <div className="stat-item">
                <span className="stat-label">Prix moyen/m² :</span>
                <span className="stat-value">
                  {Math.round(
                    results.features.reduce((sum, f) => 
                      sum + (f.properties.updated_price / f.properties.area), 0
                    ) / results.features.length
                  ).toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Prix moyen :</span>
                <span className="stat-value">
                  {Math.round(
                    results.features.reduce((sum, f) => 
                      sum + f.properties.updated_price, 0
                    ) / results.features.length
                  ).toLocaleString('fr-FR')} €
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Surface moyenne :</span>
                <span className="stat-value">
                  {Math.round(
                    results.features.reduce((sum, f) => 
                      sum + f.properties.area, 0
                    ) / results.features.length
                  )} m²
                </span>
              </div>
            </div>
          </div>
        )}

        {results && (
          (dataSource === 'seloger' && (!results.classifieds || results.classifieds.length === 0)) ||
          (dataSource === 'meilleursagents' && (!results.features || results.features.length === 0))
        ) && (
          <div className="results-box">
            <h2>ℹ️ Aucun résultat</h2>
            <p>Aucun bien trouvé pour cette recherche.</p>
          </div>
        )}

        {/* Modal de filtres pour MeilleursAgents */}
        {showFilters && dataSource === 'meilleursagents' && (
          <div className="filters-modal-overlay" onClick={() => setShowFilters(false)}>
            <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
              <div className="filters-modal-header">
                <h2>Filtres</h2>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowFilters(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="filters-modal-content">
                <div className="filter-section">
                  <label className="section-label">Type de bien</label>
                  <div className="item-type-buttons">
                    {itemTypeOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        className={`item-type-btn ${formData.itemTypes.includes(option.value) ? 'active' : ''}`}
                        onClick={() => handleItemTypeToggle(option.value)}
                      >
                        <span className="item-type-icon">{option.icon}</span>
                        <span className="item-type-label">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-section">
                  <label className="section-label">Nombre de pièces</label>
                  <div className="room-buttons">
                    {roomOptions.map(room => (
                      <button
                        key={room}
                        type="button"
                        className={`room-btn ${formData.roomCount.includes(room) ? 'active' : ''}`}
                        onClick={() => handleRoomToggle(room)}
                      >
                        {room}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-section">
                  <label className="section-label">
                    Prix
                    <span className="filter-range">
                      {formatPrice(formData.priceMin)} - {formatPrice(formData.priceMax)}
                    </span>
                  </label>
                  <div className="dual-range">
                    <input
                      type="range"
                      min="0"
                      max="2000000"
                      step="10000"
                      value={formData.priceMin}
                      onChange={(e) => handlePriceChange('priceMin', e.target.value)}
                      className="range-input range-min"
                    />
                    <input
                      type="range"
                      min="0"
                      max="2000000"
                      step="10000"
                      value={formData.priceMax}
                      onChange={(e) => handlePriceChange('priceMax', e.target.value)}
                      className="range-input range-max"
                    />
                  </div>
                </div>

                <div className="filter-section">
                  <label className="section-label">
                    Surface
                    <span className="filter-range">
                      {formData.areaMin} - {formData.areaMax} m²
                    </span>
                  </label>
                  <div className="dual-range">
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="5"
                      value={formData.areaMin}
                      onChange={(e) => handleAreaChange('areaMin', e.target.value)}
                      className="range-input range-min"
                    />
                    <input
                      type="range"
                      min="0"
                      max="300"
                      step="5"
                      value={formData.areaMax}
                      onChange={(e) => handleAreaChange('areaMax', e.target.value)}
                      className="range-input range-max"
                    />
                  </div>
                </div>
              </div>

              <div className="filters-modal-footer">
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      roomCount: [],
                      itemTypes: ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'],
                      priceMin: 0,
                      priceMax: 2000000,
                      areaMin: 0,
                      areaMax: 300
                    }));
                  }}
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  className="apply-btn"
                  onClick={() => setShowFilters(false)}
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de filtres pour SeLoger */}
        {showFilters && dataSource === 'seloger' && (
          <div className="filters-modal-overlay" onClick={() => setShowFilters(false)}>
            <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
              <div className="filters-modal-header">
                <h2>Filtres SeLoger</h2>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowFilters(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div className="filters-modal-content">
                {/* Type de bien */}
                <div className="filter-section">
                  <label className="section-label">Type de bien</label>
                  <div className="item-type-buttons">
                    {selogerEstateTypes.map(type => (
                      <button
                        key={type.value}
                        type="button"
                        className={`item-type-btn ${selogerFilters.estateTypes.includes(type.value) ? 'active' : ''}`}
                        onClick={() => {
                          setSelogerFilters(prev => ({
                            ...prev,
                            estateTypes: prev.estateTypes.includes(type.value)
                              ? prev.estateTypes.filter(t => t !== type.value)
                              : [...prev.estateTypes, type.value]
                          }));
                        }}
                      >
                        <span className="item-type-icon">{type.icon}</span>
                        <span className="item-type-label">{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Nombre de pièces */}
                <div className="filter-section">
                  <label className="section-label">Nombre de pièces</label>
                  <div className="input-group">
                    <div className="input-wrapper">
                      <label className="input-label">Minimum</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={selogerFilters.numberOfRoomsMin}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          numberOfRoomsMin: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                    <span className="separator">-</span>
                    <div className="input-wrapper">
                      <label className="input-label">Maximum</label>
                      <input
                        type="number"
                        min="1"
                        max="15"
                        value={selogerFilters.numberOfRoomsMax}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          numberOfRoomsMax: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Prix */}
                <div className="filter-section">
                  <label className="section-label">Prix (€)</label>
                  <div className="input-group">
                    <div className="input-wrapper">
                      <label className="input-label">Minimum</label>
                      <input
                        type="number"
                        min="1"
                        max="2000000"
                        step="1000"
                        value={selogerFilters.priceMin}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          priceMin: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                    <span className="separator">-</span>
                    <div className="input-wrapper">
                      <label className="input-label">Maximum</label>
                      <input
                        type="number"
                        min="1"
                        max="2000000"
                        step="1000"
                        value={selogerFilters.priceMax}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          priceMax: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Surface */}
                <div className="filter-section">
                  <label className="section-label">Surface (m²)</label>
                  <div className="input-group">
                    <div className="input-wrapper">
                      <label className="input-label">Minimum</label>
                      <input
                        type="number"
                        min="1"
                        max="19999"
                        step="1"
                        value={selogerFilters.spaceMin}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          spaceMin: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                    <span className="separator">-</span>
                    <div className="input-wrapper">
                      <label className="input-label">Maximum</label>
                      <input
                        type="number"
                        min="1"
                        max="19999"
                        step="1"
                        value={selogerFilters.spaceMax}
                        onChange={(e) => setSelogerFilters(prev => ({
                          ...prev,
                          spaceMax: e.target.value
                        }))}
                        className="number-input"
                        placeholder=""
                      />
                    </div>
                  </div>
                </div>

                {/* Équipements */}
                <div className="filter-section">
                  <label className="section-label">Équipements</label>
                  <div className="features-grid">
                    {selogerFeatures.map(feature => (
                      <button
                        key={feature.value}
                        type="button"
                        className={`feature-btn ${selogerFilters.featuresIncluded.includes(feature.value) ? 'active' : ''}`}
                        onClick={() => {
                          setSelogerFilters(prev => ({
                            ...prev,
                            featuresIncluded: prev.featuresIncluded.includes(feature.value)
                              ? prev.featuresIncluded.filter(f => f !== feature.value)
                              : [...prev.featuresIncluded, feature.value]
                          }));
                        }}
                      >
                        <span className="feature-icon">{feature.icon}</span>
                        <span className="feature-label">{feature.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="filters-modal-footer">
                <button
                  type="button"
                  className="reset-btn"
                  onClick={() => {
                    setSelogerFilters({
                      estateTypes: ['House', 'Apartment'],
                      numberOfRoomsMin: '',
                      numberOfRoomsMax: '',
                      priceMin: '',
                      priceMax: '',
                      spaceMin: '',
                      spaceMax: '',
                      featuresIncluded: []
                    });
                  }}
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  className="apply-btn"
                  onClick={() => setShowFilters(false)}
                >
                  Appliquer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
