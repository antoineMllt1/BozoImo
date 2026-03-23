# 🧪 Test des filtres SeLoger

## 🚀 Lancement

### Terminal 1 - Backend
```bash
cd /home/grocervo/Bureau/BozoImo/backend
npm run dev
```

### Terminal 2 - Frontend
```bash
cd /home/grocervo/Bureau/BozoImo/frontend
npm run dev
```

Ouvrir http://localhost:5173

---

## ✅ Tests à effectuer

### 1. Test du comptage automatique

1. **Sélectionner "SeLoger"** en haut
2. **Taper "Nantes"** dans le champ
3. ✅ **Vérifier** : Le compteur apparaît automatiquement
   - Message "Comptage..." pendant 1 seconde
   - Puis "📊 3885 biens trouvés" (environ)

4. **Modifier l'adresse** → "Savarieres"
5. ✅ **Vérifier** : Le compteur se met à jour automatiquement
   - "📊 106 biens trouvés" (environ)

---

### 2. Test des filtres de base

1. **Adresse** : "Nantes"
2. **Cliquer sur "Filtres"**
3. **Modifier le prix** : 
   - Min : 200k€
   - Max : 400k€
4. **Cliquer "Appliquer"**
5. ✅ **Vérifier** : 
   - Badge "2" sur le bouton Filtres
   - Compteur se met à jour → ~1800 biens

---

### 3. Test des pièces

1. **Ouvrir les filtres**
2. **Nombre de pièces** :
   - Min : 3
   - Max : 4
3. **Appliquer**
4. ✅ **Vérifier** :
   - Badge "3" (prix + pièces)
   - Compteur → ~600 biens

---

### 4. Test du type de bien

1. **Ouvrir les filtres**
2. **Décocher "Maison"** (garder seulement Appartement)
3. **Appliquer**
4. ✅ **Vérifier** :
   - Badge "4"
   - Compteur → ~400 biens

---

### 5. Test des équipements

1. **Ouvrir les filtres**
2. **Sélectionner** :
   - 🚗 Parking/Garage
   - 🌿 Balcon/Terrasse
3. **Appliquer**
4. ✅ **Vérifier** :
   - Badge "6" (type + prix + pièces + 2 équipements)
   - Compteur → ~150 biens
   - Les boutons sélectionnés sont en bleu

---

### 6. Test de la surface

1. **Ouvrir les filtres**
2. **Surface** :
   - Min : 50 m²
   - Max : 100 m²
3. **Appliquer**
4. ✅ **Vérifier** :
   - Badge "7"
   - Compteur → ~80 biens

---

### 7. Test de la recherche complète

1. **Avec tous les filtres actifs**
2. **Cliquer "Rechercher"**
3. ✅ **Vérifier** :
   - Spinner "Recherche en cours..."
   - Tableau avec 30 annonces détaillées
   - Chaque annonce affiche :
     - Prix
     - Nombre de pièces
     - Surface
     - Ville/Quartier
     - Agence
     - Bouton "Voir l'annonce"

---

### 8. Test de réinitialisation

1. **Ouvrir les filtres**
2. **Cliquer "Réinitialiser"**
3. ✅ **Vérifier** :
   - Tous les filtres reviennent aux valeurs par défaut
   - Badge disparaît
   - Compteur revient à ~3885 biens (Nantes sans filtres)

---

### 9. Test de changement d'adresse avec filtres

1. **Garder des filtres actifs**
2. **Changer l'adresse** → "Savarieres"
3. ✅ **Vérifier** :
   - Les filtres restent actifs
   - Le comptage se met à jour automatiquement avec les filtres
   - Le nombre change (plus petit car zone plus petite)

---

### 10. Test du debounce

1. **Taper rapidement** : "N-a-n-t-e-s"
2. ✅ **Vérifier** :
   - Le comptage ne se déclenche pas à chaque lettre
   - Il attend 500ms après la dernière lettre
   - Évite les requêtes inutiles

---

## 🎨 Tests visuels

### Compteur
- [ ] Apparaît bien dans une boîte grise
- [ ] Animation fluide du chiffre
- [ ] Icône 📊 visible
- [ ] Spinner pendant le comptage

### Modale de filtres
- [ ] S'ouvre en cliquant sur "Filtres"
- [ ] Fond semi-transparent
- [ ] Bouton X pour fermer
- [ ] Boutons "Réinitialiser" et "Appliquer"

### Filtres individuels
- [ ] Boutons Maison/Appartement bien stylés
- [ ] Sliders de prix fonctionnent bien
- [ ] Sliders de pièces fonctionnent bien
- [ ] Sliders de surface fonctionnent bien
- [ ] Grille d'équipements bien alignée (7 équipements sur 2 lignes)
- [ ] Équipements sélectionnés en bleu
- [ ] Icônes bien visibles

### Badge de compteur
- [ ] Apparaît sur le bouton "Filtres"
- [ ] Affiche le bon nombre
- [ ] Style rond bleu

---

## 🐛 Tests d'erreur

### 1. Adresse invalide
1. **Taper** : "azertyuiop123456"
2. ✅ **Vérifier** : Message d'erreur approprié

### 2. Sans connexion backend
1. **Arrêter le backend** (Ctrl+C)
2. **Taper une adresse**
3. ✅ **Vérifier** : Message d'erreur "Erreur de connexion"

---

## 📊 Valeurs attendues (approximatives)

| Adresse | Filtres | Résultats attendus |
|---------|---------|-------------------|
| Nantes | Aucun | ~3800-4000 |
| Nantes | Prix 200-400k€ | ~1800-2000 |
| Nantes | Prix + 3-4 pièces | ~600-700 |
| Nantes | Prix + Pièces + Appartement | ~400-500 |
| Nantes | Tous filtres | ~80-150 |
| Savarieres | Aucun | ~100-120 |
| Savarieres | Prix 100-500k€ | ~10-15 |
| Paris | Aucun | ~20000+ |
| Belleville Paris | Aucun | ~500-600 |

---

## ✨ Scénario complet de démo

```
1. Ouvrir l'app → "SeLoger" sélectionné par défaut

2. Taper "Nantes"
   → Comptage automatique : 3885 biens

3. Clic "Filtres"
   → Modale s'ouvre

4. Sélectionner :
   - 🏢 Appartement uniquement (décocher Maison)
   - Pièces : 3-4
   - Prix : 200k - 400k€
   - 🚗 Parking
   - 🌿 Balcon
   
5. Clic "Appliquer"
   → Badge "6" apparaît
   → Compteur : ~150 biens

6. Clic "Rechercher"
   → Tableau avec 30 annonces détaillées

7. Tester une annonce
   → Clic "Voir l'annonce"
   → Page SeLoger s'ouvre dans un nouvel onglet

8. Retour → Changer adresse → "Savarieres"
   → Compteur se met à jour : ~8 biens
   → Filtres toujours actifs

9. Clic "Filtres" → "Réinitialiser"
   → Compteur : ~106 biens (Savarieres sans filtres)
```

---

## 🎯 Critères de réussite

✅ **Fonctionnalités**
- [x] Comptage automatique fonctionne
- [x] Tous les filtres fonctionnent
- [x] Recherche retourne les bons résultats
- [x] Filtres persistent au changement d'adresse
- [x] Réinitialisation fonctionne

✅ **Performance**
- [x] Comptage rapide (<2s)
- [x] Debounce évite les requêtes inutiles
- [x] Pas de lag lors du changement de filtres

✅ **UX**
- [x] Interface intuitive
- [x] Feedback visuel clair
- [x] Animations fluides
- [x] Badge informatif

✅ **Stabilité**
- [x] Pas d'erreurs console
- [x] Gestion des erreurs réseau
- [x] Pas de crash

---

## 🔥 Test de charge (optionnel)

1. **Changer rapidement de filtres** (10x en 10 secondes)
2. ✅ **Vérifier** : L'app reste fluide

3. **Taper/effacer l'adresse rapidement**
4. ✅ **Vérifier** : Le debounce fonctionne, pas de spam de requêtes

---

## 📝 Notes

- Les nombres exacts peuvent varier selon les données SeLoger
- Le comptage peut prendre 1-2 secondes selon la connexion
- Si le compteur affiche 0, vérifier que l'adresse est valide
- Le backend utilise l'API SeLoger en direct (pas de cache)

**Tout fonctionne ? Félicitations ! 🎉**



