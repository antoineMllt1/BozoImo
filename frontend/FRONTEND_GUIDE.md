# 🎨 Guide Frontend Estimia

## ✨ Nouvelles fonctionnalités

### 🔄 Sélecteur de source de données

L'interface permet maintenant de choisir entre **deux sources** :

1. **🏘️ SeLoger** - Annonces actives
   - Recherche simple par nom de quartier ou ville
   - 30 annonces détaillées avec photos, prix, agences
   - Données en temps réel

2. **📊 MeilleursAgents** - Historique DVF
   - Recherche par adresse précise
   - Filtres avancés (prix, surface, nombre de pièces)
   - Transactions passées réelles

---

## 🎯 Utilisation

### Pour SeLoger

1. Cliquer sur le bouton **SeLoger** (actif par défaut)
2. Entrer un nom de quartier ou ville (ex: "Savarieres", "Belleville Paris", "Nantes")
3. Cliquer sur **Rechercher**
4. Les résultats s'affichent avec :
   - Type de bien (🏠 Maison / 🏢 Appartement)
   - Prix et prix au m²
   - Nombre de pièces, chambres, surface
   - Localisation détaillée
   - Agence et note
   - Lien vers l'annonce

### Pour MeilleursAgents

1. Cliquer sur le bouton **MeilleursAgents**
2. Taper une adresse dans la barre de recherche
3. Sélectionner une suggestion
4. (Optionnel) Cliquer sur **Filtres** pour affiner
5. Cliquer sur **Rechercher**
6. Les résultats s'affichent avec :
   - Adresse complète
   - Type, surface, prix
   - Prix actualisé et €/m²
   - Date de transaction

---

## 📥 Export des données

### CSV
- Format standard pour Excel, Google Sheets
- Séparateur : virgule
- Encodage : UTF-8 avec BOM

### Excel (.xls)
- Format TSV compatible Excel
- Inclut des statistiques en bas (MeilleursAgents)
- Prêt à l'emploi

### Boutons d'export
Disponibles en haut à droite des résultats :
- 📥 **CSV** : Export rapide
- 📥 **Excel** : Export formaté

---

## 📊 Tableau SeLoger

Colonnes disponibles :
- **#** : Numéro
- **Type** : Icône + nom du bien
- **Prix** : Prix affiché (en gros)
- **€/m²** : Prix au mètre carré
- **Détails** : Badges avec caractéristiques
- **Localisation** : Quartier + Ville (Code postal)
- **Agence** : Nom + Note/Avis
- **Actions** : Bouton "Voir" (ouvre l'annonce)

## 📊 Tableau MeilleursAgents

Colonnes disponibles :
- **#** : Numéro
- **Adresse** : Adresse complète
- **Type** : Nombre de pièces
- **Surface** : m²
- **Prix** : Prix d'origine
- **Prix actualisé** : Prix ajusté
- **€/m²** : Prix au m² (surligné)
- **Date** : Date de transaction

### Statistiques (MeilleursAgents uniquement)
Affichées sous le tableau :
- Prix moyen/m²
- Prix moyen
- Surface moyenne

---

## 🎨 Design

### Thème sombre moderne
- Arrière-plan noir/gris foncé
- Texte clair pour le confort visuel
- Accents bleu indigo (#6366f1)
- Animations douces

### Responsive
- Desktop : Tableau complet
- Tablette : Adapté
- Mobile : Optimisé pour petits écrans

---

## 🚀 Démarrage

```bash
# Dans le dossier frontend
cd /home/grocervo/Bureau/BozoImo/frontend

# Installer les dépendances (si nécessaire)
npm install

# Lancer en mode développement
npm run dev

# Le frontend démarre sur http://localhost:5173
```

**Important** : Le backend doit tourner sur `http://localhost:5000`

```bash
# Dans un autre terminal
cd /home/grocervo/Bureau/BozoImo/backend
npm run dev
```

---

## 📁 Structure du code

```javascript
// État principal
const [dataSource, setDataSource] = useState('seloger'); // Source active

// Résultats SeLoger
results.classifieds[]  // Tableau d'annonces
results.totalCount     // Nombre total
results.location       // Infos lieu recherché

// Résultats MeilleursAgents  
results.features[]     // Tableau de transactions
```

### Fonctions d'export

- `exportSelogerToCSV()` : Export CSV SeLoger
- `exportMeilleursAgentsToCSV()` : Export CSV MA
- `exportToExcel()` : Dispatch vers la bonne fonction

---

## 🎯 Exemples d'utilisation

### Recherche rapide SeLoger
1. Interface par défaut
2. Taper "Nantes" → Rechercher
3. 3885 biens trouvés instantanément
4. Export CSV en 1 clic

### Recherche détaillée MeilleursAgents
1. Cliquer sur MeilleursAgents
2. Chercher "19 rue du paradis Paris"
3. Sélectionner la suggestion
4. Ouvrir les filtres
5. Sélectionner 3-4 pièces
6. Prix max 800k€
7. Rechercher
8. Export Excel avec stats

---

## 🔧 Personnalisation

### Changer les couleurs
Fichier : `src/App.css`

```css
:root {
  --accent-primary: #6366f1;  /* Couleur principale */
  --accent-hover: #4f46e5;    /* Survol */
  --bg-primary: #0a0a0b;      /* Fond */
}
```

### Ajouter une source
1. Ajouter un bouton dans `.source-selector`
2. Gérer l'état `dataSource`
3. Ajouter la logique dans `handleSubmit()`
4. Créer le tableau de résultats correspondant

---

## 🐛 Résolution de problèmes

### Le backend ne répond pas
```bash
# Vérifier que le backend tourne
curl http://localhost:5000/api

# Redémarrer si nécessaire
cd backend && npm run dev
```

### Les résultats SeLoger sont vides
- Vérifier l'orthographe du quartier
- Essayer avec juste le nom de la ville
- Le backend affiche des logs détaillés

### Export ne fonctionne pas
- Vérifier les bloqueurs de pop-up
- Autoriser les téléchargements
- Les fichiers sont générés côté client (pas de serveur)

---

## 💡 Astuces

### Raccourcis clavier
- `Enter` dans le champ de recherche : Lancer la recherche

### Performance
- SeLoger : ~1 seconde par recherche
- MeilleursAgents : Instantané (déjà optimisé)

### Meilleurs résultats
- **SeLoger** : Noms de ville complets ("Nantes" plutôt que "Nant")
- **MeilleursAgents** : Adresses précises avec numéro

---

## 📖 Voir aussi

- **Backend API** : `/backend/SELOGER.md`
- **Guide rapide** : `/backend/QUICK_START_SELOGER.md`
- **Exemples d'intégration** : `/backend/exemple-integration.js`

---

**🎉 Votre interface est prête ! Bon développement !**



