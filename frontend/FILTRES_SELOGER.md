# 🎯 Guide des filtres SeLoger

## ✅ Backend terminé

Les routes suivantes sont maintenant disponibles :

### POST `/api/seloger/count`
Compte les résultats en temps réel
```json
{
  "address": "Savarieres",
  "filters": {
    "priceMin": 100000,
    "priceMax": 500000,
    "numberOfRoomsMin": 2,
    "numberOfRoomsMax": 4
  }
}
```

Réponse :
```json
{
  "count": 42
}
```

### POST `/api/seloger/search`
Recherche avec filtres
```json
{
  "address": "Savarieres",
  "filters": {
    "estateTypes": ["House", "Apartment"],
    "numberOfRoomsMin": 1,
    "numberOfRoomsMax": 15,
    "priceMin": 1,
    "priceMax": 2000000,
    "spaceMin": 1,
    "spaceMax": 19999,
    "plotSpaceMin": 1,
    "plotSpaceMax": 100000,
    "featuresIncluded": ["Parking_Garage", "Balcony_Terrace"],
    "energyCertificateClass": ["A", "B", "C"]
  }
}
```

## 📊 Filtres disponibles

### Types de biens (`estateTypes`)
- `House` : Maison
- `Apartment` : Appartement

### Pièces (`numberOfRooms`)
- `numberOfRoomsMin` : Minimum (1-15)
- `numberOfRoomsMax` : Maximum (1-15)

### Prix (`price`)
- `priceMin` : Prix minimum (1-2000000)
- `priceMax` : Prix maximum (1-2000000)

### Surface (`space`)
- `spaceMin` : Surface minimum en m² (1-19999)
- `spaceMax` : Surface maximum en m² (1-19999)

### Terrain (`plotSpace`)
- `plotSpaceMin` : Terrain minimum en m² (1-100000)
- `plotSpaceMax` : Terrain maximum en m² (1-100000)

### Équipements (`featuresIncluded`)
Array de strings :
- `Parking_Garage` : Parking/Garage
- `Balcony_Terrace` : Balcon/Terrasse
- `Garden` : Jardin
- `Swimming_Pool` : Piscine
- `Cellar` : Cave
- `Kitchen_Fully_Equipped` : Cuisine équipée
- `Exclusive` : Exclusivité

### Classe énergétique (`energyCertificateClass`)
Array de lettres :
- `A`, `B`, `C`, `D`, `E`, `F`, `G`

### Types de projet (`projectTypes`)
Array de strings :
- `Resale` : Ancien
- `New_Build` : Neuf
- `Projected` : En projet
- `Life_Annuity` : Viager

## 🎨 Frontend à ajouter

### 1. État des filtres

Ajouté dans `App.jsx` :
```javascript
const [selogerFilters, setSelogerFilters] = useState({
  estateTypes: ['House', 'Apartment'],
  numberOfRoomsMin: 1,
  numberOfRoomsMax: 15,
  priceMin: 1,
  priceMax: 2000000,
  spaceMin: 1,
  spaceMax: 19999,
  featuresIncluded: []
});

const [counting, setCounting] = useState(false);
const [resultCount, setResultCount] = useState(null);
```

### 2. Fonction de comptage

```javascript
const handleCountResults = async () => {
  if (!address || address.length < 2) return;
  
  setCounting(true);
  try {
    const response = await fetch('http://localhost:5000/api/seloger/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        filters: selogerFilters
      })
    });
    
    const data = await response.json();
    setResultCount(data.count);
  } catch (err) {
    console.error('Erreur comptage:', err);
  } finally {
    setCounting(false);
  }
};
```

### 3. Appeler le comptage au changement

```javascript
import { useState, useEffect } from 'react';

// Dans le composant, ajouter useEffect
useEffect(() => {
  if (dataSource === 'seloger' && address.length >= 2) {
    const timer = setTimeout(() => {
      handleCountResults();
    }, 500); // Debounce 500ms
    
    return () => clearTimeout(timer);
  }
}, [address, selogerFilters, dataSource]);
```

### 4. Afficher le compteur

```jsx
{dataSource === 'seloger' && address && (
  <div className="result-counter">
    {counting ? (
      <div className="counting">
        <div className="spinner"></div>
        Comptage...
      </div>
    ) : resultCount !== null ? (
      <div className="count-display">
        📊 {resultCount} biens trouvés
      </div>
    ) : null}
  </div>
)}
```

### 5. Modale de filtres SeLoger

```jsx
{showFilters && dataSource === 'seloger' && (
  <div className="filters-modal-overlay" onClick={() => setShowFilters(false)}>
    <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
      <div className="filters-modal-header">
        <h2>Filtres SeLoger</h2>
        <button className="close-btn" onClick={() => setShowFilters(false)}>×</button>
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
          <label className="section-label">
            Nombre de pièces
            <span className="filter-range">
              {selogerFilters.numberOfRoomsMin} - {selogerFilters.numberOfRoomsMax}
            </span>
          </label>
          <div className="dual-range">
            <input
              type="range"
              min="1"
              max="15"
              value={selogerFilters.numberOfRoomsMin}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                numberOfRoomsMin: parseInt(e.target.value)
              }))}
              className="range-input range-min"
            />
            <input
              type="range"
              min="1"
              max="15"
              value={selogerFilters.numberOfRoomsMax}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                numberOfRoomsMax: parseInt(e.target.value)
              }))}
              className="range-input range-max"
            />
          </div>
        </div>

        {/* Prix */}
        <div className="filter-section">
          <label className="section-label">
            Prix
            <span className="filter-range">
              {Math.round(selogerFilters.priceMin / 1000)}k€ - {Math.round(selogerFilters.priceMax / 1000)}k€
            </span>
          </label>
          <div className="dual-range">
            <input
              type="range"
              min="1"
              max="2000000"
              step="10000"
              value={selogerFilters.priceMin}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                priceMin: parseInt(e.target.value)
              }))}
              className="range-input range-min"
            />
            <input
              type="range"
              min="1"
              max="2000000"
              step="10000"
              value={selogerFilters.priceMax}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                priceMax: parseInt(e.target.value)
              }))}
              className="range-input range-max"
            />
          </div>
        </div>

        {/* Surface */}
        <div className="filter-section">
          <label className="section-label">
            Surface
            <span className="filter-range">
              {selogerFilters.spaceMin} - {selogerFilters.spaceMax} m²
            </span>
          </label>
          <div className="dual-range">
            <input
              type="range"
              min="1"
              max="500"
              step="5"
              value={selogerFilters.spaceMin}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                spaceMin: parseInt(e.target.value)
              }))}
              className="range-input range-min"
            />
            <input
              type="range"
              min="1"
              max="500"
              step="5"
              value={selogerFilters.spaceMax}
              onChange={(e) => setSelogerFilters(prev => ({
                ...prev,
                spaceMax: Math.min(parseInt(e.target.value), 19999)
              }))}
              className="range-input range-max"
            />
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
              numberOfRoomsMin: 1,
              numberOfRoomsMax: 15,
              priceMin: 1,
              priceMax: 2000000,
              spaceMin: 1,
              spaceMax: 19999,
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
```

### 6. Modifier la recherche

Dans `handleSubmit` :
```javascript
if (dataSource === 'seloger') {
  const response = await fetch('http://localhost:5000/api/seloger/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: address,
      filters: selogerFilters  // ← Ajouter les filtres
    })
  });
}
```

## 🎨 CSS à ajouter

```css
/* Compteur de résultats */
.result-counter {
  margin: 1rem 0;
  padding: 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-align: center;
}

.counting {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-secondary);
}

.count-display {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--accent-primary);
}

/* Grille d'équipements */
.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.5rem;
}

.feature-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition);
  outline: none;
}

.feature-btn:hover {
  background: var(--bg-hover);
}

.feature-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: white;
}

.feature-icon {
  font-size: 1.25rem;
}

.feature-label {
  font-size: 0.875rem;
  font-weight: 500;
}
```

## 🚀 Tester

```bash
# Démarrer le backend
cd backend && npm run dev

# Dans un autre terminal
curl -X POST http://localhost:5000/api/seloger/count \
  -H "Content-Type: application/json" \
  -d '{"address": "Savarieres", "filters": {"priceMin": 100000, "priceMax": 500000}}'

# Réponse : {"count": 42}
```

## 📝 Résumé

✅ Backend :
- Route `/count` pour compter en temps réel
- Route `/search` avec filtres complets
- Tous les filtres SeLoger disponibles

🔜 Frontend :
- Ajouter état `selogerFilters`
- Fonction `handleCountResults`
- Affichage du compteur
- Modale de filtres
- CSS des équipements

**Le backend est prêt ! Il ne reste plus qu'à implémenter l'interface frontend.**



