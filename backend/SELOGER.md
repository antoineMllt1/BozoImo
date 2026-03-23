# API SeLoger - Documentation

## 🎯 Description

L'API SeLoger permet de rechercher des biens immobiliers à partir d'un nom de quartier ou d'adresse.

### Fonctionnalités

1. **Autocomplete** : Récupère les informations d'un lieu (ID, coordonnées)
2. **Recherche intelligente** :
   - Recherche d'abord par ID de lieu
   - Si < 30 résultats : recherche par cercles croissants (100m, 200m, 300m, etc.)
   - S'arrête dès qu'au moins 30 résultats sont trouvés
   - Maximum : rayon de 5000m

## 📡 Routes disponibles

### 1. POST `/api/seloger/search`

Recherche des biens immobiliers à partir d'un nom de quartier/adresse.

#### Requête

```json
{
  "address": "Savarieres"
}
```

#### Réponse (succès)

```json
{
  "totalCount": 106,
  "classifieds": [
    {
      "id": "25YPGCHBK2MF",
      "hardFacts": {
        "title": "Appartement à vendre",
        "keyfacts": ["2 pièces", "1 chambre", "47 m²", "Étage 1/3"],
        "price": {
          "value": "199 299 €",
          "additionalInformation": "4 240 €/m²"
        }
      },
      "location": {
        "address": {
          "city": "Saint Sebastien sur Loire",
          "zipCode": "44230",
          "district": "Savarières"
        }
      },
      "gallery": {
        "images": [
          {
            "url": "https://mms.seloger.com/...",
            "alt": "..."
          }
        ]
      },
      "mainDescription": {
        "headline": "Appartement T2",
        "description": "Au calme, bel appartement..."
      },
      "provider": {
        "intermediaryCard": {
          "title": "AJP Immobilier",
          "logoUrl": "..."
        },
        "rating": {
          "rating": 4.5,
          "reviews": 35
        }
      },
      "url": "https://www.seloger.com/annonces/...",
      "tags": {
        "isExclusive": true,
        "has3DVisit": false
      }
    },
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
  "polyline": "whd_HnscH..." // Présent uniquement si recherche par cercle
}
```

#### Champs de réponse

- `totalCount` : Nombre total de résultats trouvés
- `classifieds` : Liste des biens détaillés (jusqu'à 30 par page)
  - `id` : ID unique de l'annonce
  - `hardFacts` : Caractéristiques principales
    - `title` : Titre (ex: "Appartement à vendre")
    - `keyfacts` : Faits clés (pièces, chambres, surface, étage)
    - `price` : Prix et prix au m²
  - `location` : Localisation de l'annonce
    - `address` : Ville, code postal, quartier
    - `isAddressPublished` : Adresse exacte publiée ou non
  - `gallery` : Photos et médias
    - `images` : Tableau d'images avec URLs
    - `availableFeatures` : Plans, visites virtuelles
  - `mainDescription` : Description textuelle
  - `provider` : Informations sur l'agence/agent
    - `intermediaryCard` : Nom et logo de l'agence
    - `rating` : Note et nombre d'avis
  - `url` : Lien vers l'annonce complète
  - `tags` : Tags spéciaux (exclusivité, nouveau, visite 3D)
  - `energyClass` : Classe énergétique (A-G)
- `location` : Informations sur le lieu recherché
  - `address` : Adresse recherchée
  - `placeId` : ID SeLoger du lieu
  - `coordinates` : Coordonnées GPS du centre
- `polyline` : (optionnel) Polyline encodée utilisée pour la recherche circulaire

### 2. POST `/api/seloger/autocomplete`

Teste l'autocomplete pour récupérer les informations d'un lieu.

#### Requête

```json
{
  "text": "Savarieres"
}
```

#### Réponse

```json
{
  "labels": ["Savarières Saint-Sébastien-sur-Loire (44230)"],
  "postal_codes": ["44230"],
  "id": "NBH2FR3338",
  "type_key": "NBH2",
  "coordinates": {
    "lat": 47.20668236977603,
    "lng": -1.487968748055694,
    "centroid": { ... },
    "point_on_surface": { ... },
    "max_inscribed_circle": { ... }
  },
  "parents": [...]
}
```

## 🔄 Logique de recherche

### Étape 1 : Autocomplete
- Appel à l'API d'autocomplete SeLoger
- Récupération de l'ID du lieu et des coordonnées

### Étape 2 : Recherche par ID
- Recherche avec l'ID du lieu
- Critères : Achat, Maison/Appartement, tous types de projets
- Récupération des IDs des annonces uniquement

### Étape 3 : Recherche par cercles (si < 30 résultats)
1. Création d'un cercle de 100m autour des coordonnées
2. Encodage en Google Polyline
3. Recherche avec le polyline
4. Si < 30 résultats : augmentation du rayon de 100m
5. Répétition jusqu'à avoir 30+ résultats ou atteindre 5000m

### Étape 4 : Récupération des détails complets
- Utilise les IDs récupérés aux étapes précédentes
- Appel à `/classifiedList/{id1},{id2},{id3},...`
- Récupération de toutes les informations : prix, photos, descriptions, agence, etc.

## 🛠️ Utilisation avec curl

```bash
# Recherche simple
curl -X POST http://localhost:5000/api/seloger/search \
  -H "Content-Type: application/json" \
  -d '{"address": "Savarieres"}'

# Autocomplete
curl -X POST http://localhost:5000/api/seloger/autocomplete \
  -H "Content-Type: application/json" \
  -d '{"text": "Paris"}'
```

## 🧪 Tests avec le fichier .http

Utilisez le fichier `test-seloger.http` avec l'extension REST Client de VS Code :

```http
POST http://localhost:5000/api/seloger/search
Content-Type: application/json

{
  "address": "Savarieres"
}
```

## 🔧 Implémentation technique

### Fichiers créés

1. **`utils/polyline.js`** : Encodage Google Polyline
   - `encodePolyline()` : Encode des coordonnées en polyline
   - `createCircle()` : Crée un cercle de points
   - `createCirclePolyline()` : Crée un polyline circulaire

2. **`controllers/seloger.controller.js`** : Logique métier
   - `getLocationData()` : Autocomplete
   - `searchByPlaceId()` : Recherche par ID
   - `searchByPolyline()` : Recherche par polyline
   - `searchSeloger()` : Contrôleur principal

3. **`routes/seloger.routes.js`** : Définition des routes

### Algorithme de cercle

Pour créer un cercle autour d'un point :
1. Rayon de la Terre : 6378137 mètres
2. Distance angulaire = rayon_mètres / rayon_terre
3. Pour chaque point du cercle (32 points) :
   - Calcul avec formule de destination point
   - Conversion en lat/lng

### Encodage Polyline

Format : Google Encoded Polyline Algorithm
- Précision : 5 décimales (1e-5)
- Encodage en complément à deux
- Caractères ASCII de 63 à 127

## 📊 Exemples de résultats

### Cas 1 : Quartier avec beaucoup de biens (> 30)
- Utilise uniquement l'ID du lieu
- Pas de polyline dans la réponse
- Rapide (1 requête)

### Cas 2 : Quartier avec peu de biens (< 30)
- Recherche d'abord par ID
- Puis par cercles croissants
- Polyline inclus dans la réponse
- Plus lent (2+ requêtes)

## ⚠️ Limitations

- Maximum 30 résultats par page (limitation SeLoger)
- Rayon maximum : 5000 mètres
- Pas de pagination implémentée
- Types de biens : Maison et Appartement uniquement
- Type de transaction : Achat uniquement

## 🔐 Headers requis

Les requêtes vers SeLoger nécessitent des headers spécifiques :
- `User-Agent` : Simule un navigateur Chrome
- `Referer` : seloger.com
- `Origin` : seloger.com
- Headers de sécurité : `sec-fetch-*`, `sec-ch-ua-*`

## 🚀 Améliorations possibles

1. Ajouter la pagination
2. Supporter d'autres types de biens (Terrain, Commerce, etc.)
3. Supporter d'autres types de transactions (Location)
4. Ajouter des filtres (prix, surface, nombre de pièces)
5. Cache des résultats d'autocomplete
6. Optimisation du nombre de points du cercle selon le rayon

