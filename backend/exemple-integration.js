/**
 * Exemple d'intégration de l'API SeLoger dans votre application
 * 
 * Ce fichier montre comment utiliser l'API SeLoger de différentes manières
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api/seloger';

// ============================================
// 1. Fonction simple de recherche
// ============================================

async function searchProperties(address) {
  try {
    const response = await axios.post(`${API_BASE_URL}/search`, {
      address: address
    });
    
    return response.data;
  } catch (error) {
    console.error('Erreur de recherche:', error.message);
    throw error;
  }
}

// ============================================
// 2. Fonction avec extraction des infos clés
// ============================================

async function getPropertySummaries(address) {
  const data = await searchProperties(address);
  
  return data.classifieds.map(property => ({
    id: property.id,
    title: property.hardFacts?.title,
    price: property.hardFacts?.price?.value,
    pricePerM2: property.hardFacts?.price?.additionalInformation,
    rooms: property.hardFacts?.keyfacts?.[0],
    surface: property.hardFacts?.keyfacts?.find(f => f.includes('m²')),
    city: property.location?.address?.city,
    zipCode: property.location?.address?.zipCode,
    district: property.location?.address?.district,
    imageCount: property.gallery?.images?.length || 0,
    firstImage: property.gallery?.images?.[0]?.url,
    agency: property.provider?.intermediaryCard?.title,
    agencyRating: property.provider?.rating?.rating,
    url: property.url,
    isExclusive: property.tags?.isExclusive,
    isNew: property.tags?.isNew,
    has3DVisit: property.tags?.has3DVisit
  }));
}

// ============================================
// 3. Fonction de filtrage par prix
// ============================================

async function findPropertiesInBudget(address, minPrice, maxPrice) {
  const data = await searchProperties(address);
  
  return data.classifieds.filter(property => {
    // Extraire le prix numérique
    const priceStr = property.hardFacts?.price?.value?.replace(/[^\d]/g, '');
    const price = parseInt(priceStr);
    
    return price >= minPrice && price <= maxPrice;
  });
}

// ============================================
// 4. Fonction de tri par prix au m²
// ============================================

async function getBestValueProperties(address, limit = 10) {
  const data = await searchProperties(address);
  
  // Trier par prix au m²
  const sorted = data.classifieds
    .filter(p => p.hardFacts?.price?.additionalInformation)
    .map(p => {
      const pricePerM2Str = p.hardFacts.price.additionalInformation.replace(/[^\d]/g, '');
      return {
        ...p,
        numericPricePerM2: parseInt(pricePerM2Str)
      };
    })
    .sort((a, b) => a.numericPricePerM2 - b.numericPricePerM2);
  
  return sorted.slice(0, limit);
}

// ============================================
// 5. Fonction pour trouver des exclusivités
// ============================================

async function getExclusiveProperties(address) {
  const data = await searchProperties(address);
  
  return data.classifieds.filter(property => property.tags?.isExclusive);
}

// ============================================
// 6. Fonction pour les nouveautés avec photos
// ============================================

async function getNewPropertiesWithPhotos(address, minPhotos = 5) {
  const data = await searchProperties(address);
  
  return data.classifieds.filter(property => 
    property.tags?.isNew && 
    (property.gallery?.images?.length || 0) >= minPhotos
  );
}

// ============================================
// 7. Fonction pour grouper par ville
// ============================================

async function groupPropertiesByCity(address) {
  const data = await searchProperties(address);
  
  const grouped = {};
  
  data.classifieds.forEach(property => {
    const city = property.location?.address?.city || 'Inconnu';
    
    if (!grouped[city]) {
      grouped[city] = [];
    }
    
    grouped[city].push(property);
  });
  
  return grouped;
}

// ============================================
// 8. Fonction pour calculer des statistiques
// ============================================

async function getMarketStatistics(address) {
  const data = await searchProperties(address);
  
  const prices = data.classifieds
    .map(p => {
      const priceStr = p.hardFacts?.price?.value?.replace(/[^\d]/g, '');
      return parseInt(priceStr);
    })
    .filter(p => !isNaN(p));
  
  const pricesPerM2 = data.classifieds
    .map(p => {
      const priceStr = p.hardFacts?.price?.additionalInformation?.replace(/[^\d]/g, '');
      return parseInt(priceStr);
    })
    .filter(p => !isNaN(p));
  
  return {
    totalCount: data.totalCount,
    returnedCount: data.classifieds.length,
    averagePrice: prices.reduce((a, b) => a + b, 0) / prices.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    averagePricePerM2: pricesPerM2.reduce((a, b) => a + b, 0) / pricesPerM2.length,
    minPricePerM2: Math.min(...pricesPerM2),
    maxPricePerM2: Math.max(...pricesPerM2),
    location: data.location
  };
}

// ============================================
// EXEMPLES D'UTILISATION
// ============================================

async function runExamples() {
  console.log('🏠 Exemples d\'utilisation de l\'API SeLoger\n');
  console.log('═'.repeat(60));
  
  const address = 'Savarieres';
  
  try {
    // Exemple 1 : Recherche simple
    console.log('\n📌 Exemple 1 : Recherche simple');
    const results = await searchProperties(address);
    console.log(`   Trouvé : ${results.totalCount} biens`);
    
    // Exemple 2 : Résumés
    console.log('\n📌 Exemple 2 : Résumés des biens');
    const summaries = await getPropertySummaries(address);
    console.log(`   ${summaries.length} résumés créés`);
    if (summaries[0]) {
      console.log(`   Premier bien : ${summaries[0].title} - ${summaries[0].price}`);
    }
    
    // Exemple 3 : Budget
    console.log('\n📌 Exemple 3 : Biens entre 200k€ et 400k€');
    const inBudget = await findPropertiesInBudget(address, 200000, 400000);
    console.log(`   ${inBudget.length} biens dans ce budget`);
    
    // Exemple 4 : Meilleur rapport qualité/prix
    console.log('\n📌 Exemple 4 : Top 5 meilleur prix au m²');
    const bestValue = await getBestValueProperties(address, 5);
    bestValue.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.numericPricePerM2}€/m² - ${p.hardFacts?.title}`);
    });
    
    // Exemple 5 : Exclusivités
    console.log('\n📌 Exemple 5 : Exclusivités');
    const exclusives = await getExclusiveProperties(address);
    console.log(`   ${exclusives.length} biens en exclusivité`);
    
    // Exemple 6 : Nouveautés
    console.log('\n📌 Exemple 6 : Nouveautés avec 5+ photos');
    const newOnes = await getNewPropertiesWithPhotos(address, 5);
    console.log(`   ${newOnes.length} nouveaux biens avec photos`);
    
    // Exemple 7 : Groupement par ville
    console.log('\n📌 Exemple 7 : Groupement par ville');
    const grouped = await groupPropertiesByCity(address);
    Object.entries(grouped).forEach(([city, properties]) => {
      console.log(`   ${city} : ${properties.length} biens`);
    });
    
    // Exemple 8 : Statistiques
    console.log('\n📌 Exemple 8 : Statistiques du marché');
    const stats = await getMarketStatistics(address);
    console.log(`   Prix moyen : ${Math.round(stats.averagePrice).toLocaleString('fr-FR')}€`);
    console.log(`   Fourchette : ${Math.round(stats.minPrice).toLocaleString('fr-FR')}€ - ${Math.round(stats.maxPrice).toLocaleString('fr-FR')}€`);
    console.log(`   Prix m² moyen : ${Math.round(stats.averagePricePerM2).toLocaleString('fr-FR')}€/m²`);
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('   Assurez-vous que le serveur est démarré (npm run dev)');
  }
  
  console.log('\n' + '═'.repeat(60));
}

// Exécuter les exemples si lancé directement
if (require.main === module) {
  runExamples();
}

// Exporter les fonctions pour utilisation dans d'autres fichiers
module.exports = {
  searchProperties,
  getPropertySummaries,
  findPropertiesInBudget,
  getBestValueProperties,
  getExclusiveProperties,
  getNewPropertiesWithPhotos,
  groupPropertiesByCity,
  getMarketStatistics
};



