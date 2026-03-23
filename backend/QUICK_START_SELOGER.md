# 🚀 Guide de démarrage rapide - API SeLoger

## Installation et démarrage

```bash
# 1. Installer les dépendances (si pas déjà fait)
cd /home/grocervo/Bureau/BozoImo/backend
npm install

# 2. Démarrer le serveur
node main.js

# Ou avec nodemon en mode développement
npm run dev
```

Le serveur démarre sur **http://localhost:5000**

## ✨ Utilisation rapide

### Avec curl

```bash
# Recherche simple
curl -X POST http://localhost:5000/api/seloger/search \
  -H "Content-Type: application/json" \
  -d '{"address": "Savarieres"}'

# Autocomplete
curl -X POST http://localhost:5000/api/seloger/autocomplete \
  -H "Content-Type: application/json" \
  -d '{"text": "Nantes"}'
```

### Avec le script de test

```bash
# Test de recherche
node test-seloger.js search Savarieres
node test-seloger.js search "Belleville Paris"
node test-seloger.js search Nantes

# Test d'autocomplete
node test-seloger.js autocomplete Savarieres
node test-seloger.js autocomplete "Paris Belleville"
```

### Avec le fichier .http (VS Code REST Client)

Ouvrir `test-seloger.http` dans VS Code et cliquer sur "Send Request".

## 📊 Exemples de résultats

### Cas 1 : Petit quartier (< 30 résultats avec ID)
**Input:** `Savarieres`

```json
{
  "totalCount": 42,
  "classifieds": [...30 annonces...],
  "location": {
    "address": "Savarieres",
    "placeId": "NBH2FR3338",
    "coordinates": {
      "lat": 47.20735076237591,
      "lng": -1.4926988364845082
    }
  },
  "polyline": "gld_HjpbHViJfA..." // ✓ Polyline présent
}
```
⏱️ Temps: ~900ms (2 requêtes: ID + cercle)

### Cas 2 : Grande ville (≥ 30 résultats avec ID)
**Input:** `Nantes`

```json
{
  "totalCount": 3885,
  "classifieds": [...30 annonces...],
  "location": {
    "address": "Nantes",
    "placeId": "AD08FR17221",
    "coordinates": {
      "lat": 47.227496583895004,
      "lng": -1.555164993451189
    }
  }
  // ✗ Pas de polyline
}
```
⏱️ Temps: ~340ms (1 seule requête)

## 🎯 Comment ça marche ?

### Algorithme en 3 étapes

1. **Autocomplete** (toujours)
   - Convertit "Savarieres" → ID `NBH2FR3338` + coordonnées

2. **Recherche par ID** (toujours)
   - Recherche avec l'ID du lieu
   - Si ≥ 30 résultats → ✅ STOP, retourner les résultats

3. **Recherche par cercles** (si < 30 résultats)
   - Rayon 100m → recherche
   - Si < 30 résultats → rayon 200m → recherche
   - Si < 30 résultats → rayon 300m → recherche
   - ... jusqu'à 30+ résultats ou max 5000m

### Encodage Google Polyline

Le cercle est converti en **Google Encoded Polyline** :
- 32 points autour du centre
- Formule géodésique (tient compte de la courbure de la Terre)
- Encodage compact (ASCII 63-127)

## 🔍 Structure de la réponse

```typescript
{
  totalCount: number,        // Nombre total de résultats
  classifieds: Array<{       // Max 30 annonces
    id: string               // ID de l'annonce SeLoger
  }>,
  location: {
    address: string,         // Adresse recherchée
    placeId: string,         // ID SeLoger du lieu
    coordinates: {
      lat: number,
      lng: number
    }
  },
  polyline?: string          // Optionnel: si recherche par cercle
}
```

## 📁 Fichiers créés

```
backend/
├── controllers/
│   └── seloger.controller.js    # Logique métier SeLoger
├── routes/
│   └── seloger.routes.js        # Définition des routes
├── utils/
│   └── polyline.js              # Encodage Google Polyline
├── test-seloger.http            # Tests REST Client
├── test-seloger.js              # Script de test interactif
├── SELOGER.md                   # Documentation complète
└── QUICK_START_SELOGER.md       # Ce fichier
```

## 🐛 Dépannage

### Le serveur ne démarre pas
```bash
# Réinstaller les dépendances
npm install

# Vérifier que le port 5000 est libre
lsof -i :5000
```

### Erreur lors de la recherche
```bash
# Vérifier que le serveur est démarré
curl http://localhost:5000/api

# Voir les logs en temps réel
node main.js
```

### Résultats vides
- Vérifier que l'adresse est correcte
- Essayer l'autocomplete d'abord pour voir les lieux disponibles

## 📖 Documentation complète

Voir [SELOGER.md](./SELOGER.md) pour :
- Détails techniques
- Limitations
- API complète
- Améliorations possibles

## 💡 Exemples d'intégration

### Frontend (React/Vue)

```javascript
async function searchSeloger(address) {
  const response = await fetch('http://localhost:5000/api/seloger/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address })
  });
  
  const data = await response.json();
  console.log(`${data.totalCount} biens trouvés`);
  return data;
}

// Utilisation
searchSeloger('Savarieres').then(data => {
  console.log(data.classifieds);
});
```

### Backend (autre service)

```javascript
const axios = require('axios');

async function getPropertiesNearby(neighborhood) {
  const { data } = await axios.post(
    'http://localhost:5000/api/seloger/search',
    { address: neighborhood }
  );
  
  return {
    count: data.totalCount,
    properties: data.classifieds,
    usedRadius: data.polyline ? true : false
  };
}
```

## 🎉 C'est prêt !

Votre API SeLoger est maintenant opérationnelle. Il vous suffit de :
1. Démarrer le serveur : `node main.js`
2. Envoyer une requête POST avec un nom de quartier
3. Récupérer les résultats au format JSON

**Bon développement ! 🚀**



