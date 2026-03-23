# BozoImo Backend

API Express pour rechercher des biens immobiliers via MeilleursAgents et SeLoger.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm start
```

Ou en mode développement avec nodemon :

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:5000`

## Routes disponibles

### GET /api

Documentation des routes disponibles.

---

## 📊 Routes MeilleursAgents

### GET /api/immobilier/health

Vérifier l'état de santé de l'API.

### POST /api/immobilier/geocode

Géocoder une adresse en coordonnées GPS.

**Body:**
```json
{
  "address": "19 rue du paradis Paris"
}
```

**Réponse:** (réponse brute de l'API MeilleursAgents)
```json
{
  "request": {
    "host": "geo.meilleursagents.com",
    "path": "/geo/v1/",
    "params": {
      "q": "19 rue du paradis Paris"
    }
  },
  "response": {
    "places": [
      {
        "id": "...",
        "title": "Rue du Paradis, Paris",
        "_geoloc": {
          "lat": 48.8723,
          "lng": 2.3523
        },
        "zip": "75010",
        "city_name": "Paris",
        ...
      }
    ]
  }
}
```

### POST /api/immobilier/search

Recherche des biens immobiliers selon les coordonnées et le nombre de chambres.

#### Paramètres du body (JSON)

```json
{
  "bounds": [48.8723, 2.3523, 48.8769, 2.3562],
  "roomCount": 2
}
```

ou

```json
{
  "bounds": [48.8723, 2.3523, 48.8769, 2.3562],
  "roomCount": [1, 2, 3, 4, 5]
}
```

---

## 🏠 Routes SeLoger

### POST /api/seloger/search

Recherche intelligente de biens immobiliers par nom de quartier/adresse.

**Body:**
```json
{
  "address": "Savarieres"
}
```

**Réponse:**
```json
{
  "totalCount": 106,
  "classifieds": [
    { "id": "25YPGCHBK2MF" },
    { "id": "25HBJMKJ2D2P" },
    ...
  ],
  "location": {
    "address": "Savarieres",
    "placeId": "NBH2FR3338",
    "coordinates": {
      "lat": 47.20735076237591,
      "lng": -1.4926988364845082
    }
  },
  "polyline": "whd_HnscH..." // Présent si recherche par cercle
}
```

**Fonctionnement:**
1. Autocomplete pour récupérer l'ID et les coordonnées
2. Recherche par ID de lieu
3. Si < 30 résultats : recherche par cercles croissants (100m, 200m, etc.)
4. S'arrête dès qu'au moins 30 résultats sont trouvés

### POST /api/seloger/autocomplete

Teste l'autocomplete SeLoger.

**Body:**
```json
{
  "text": "Savarieres"
}
```

**Documentation complète:** Voir [SELOGER.md](./SELOGER.md)

---

## Structure

```
backend/
├── main.js                    # Point d'entrée
├── routes/                    # Routes
│   ├── index.js
│   ├── immobilier.routes.js
│   └── seloger.routes.js
├── controllers/               # Contrôleurs
│   ├── immobilier.controller.js
│   └── seloger.controller.js
├── utils/                     # Utilitaires
│   └── polyline.js            # Encodage Google Polyline
├── test-api.http              # Tests MeilleursAgents
├── test-seloger.http          # Tests SeLoger
└── package.json
```

