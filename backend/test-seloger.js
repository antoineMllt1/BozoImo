/**
 * Script de test pour l'API SeLoger
 * Usage: node test-seloger.js [adresse]
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api/seloger';

async function testSearch(address) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🔍 Test de recherche pour: "${address}"`);
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const startTime = Date.now();
    
    const response = await axios.post(`${API_URL}/search`, {
      address: address
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    const data = response.data;

    console.log('✅ Recherche réussie!\n');
    
    console.log('📊 Résultats:');
    console.log(`   • Nombre total: ${data.totalCount}`);
    console.log(`   • Annonces retournées: ${data.classifieds?.length || 0}`);
    
    console.log('\n📍 Localisation:');
    console.log(`   • Adresse: ${data.location.address}`);
    console.log(`   • ID SeLoger: ${data.location.placeId}`);
    console.log(`   • Coordonnées: ${data.location.coordinates.lat}, ${data.location.coordinates.lng}`);
    
    if (data.polyline) {
      console.log('\n🔄 Recherche par cercle:');
      console.log(`   • Polyline utilisée: ${data.polyline.substring(0, 50)}...`);
      console.log(`   • (Recherche par ID a retourné < 30 résultats)`);
    } else {
      console.log('\n✓ Recherche par ID suffisante (≥ 30 résultats)');
    }

    console.log(`\n⏱️  Temps de réponse: ${duration}ms`);

    if (data.classifieds && data.classifieds.length > 0) {
      console.log(`\n📋 Premiers résultats (IDs):`);
      data.classifieds.slice(0, 5).forEach((classified, index) => {
        console.log(`   ${index + 1}. ${classified.id}`);
      });
      if (data.classifieds.length > 5) {
        console.log(`   ... et ${data.classifieds.length - 5} autres`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur lors de la recherche:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

async function testAutocomplete(text) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🔍 Test d'autocomplete pour: "${text}"`);
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    const response = await axios.post(`${API_URL}/autocomplete`, {
      text: text
    });

    const data = response.data;

    console.log('✅ Autocomplete réussi!\n');
    console.log(`📍 Lieu trouvé:`);
    console.log(`   • Label: ${data.labels?.[0] || 'N/A'}`);
    console.log(`   • ID: ${data.id}`);
    console.log(`   • Type: ${data.type_key}`);
    console.log(`   • Code postal: ${data.postal_codes?.join(', ') || 'N/A'}`);
    console.log(`   • Coordonnées: ${data.coordinates.lat}, ${data.coordinates.lng}`);

  } catch (error) {
    console.error('❌ Erreur lors de l\'autocomplete:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.error(`   ${error.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

// Récupérer l'adresse depuis les arguments de ligne de commande
const args = process.argv.slice(2);
const command = args[0];
const value = args.slice(1).join(' ') || 'Savarieres';

if (command === 'autocomplete') {
  testAutocomplete(value);
} else if (command === 'search' || !command) {
  testSearch(value);
} else {
  console.log('Usage:');
  console.log('  node test-seloger.js search [adresse]');
  console.log('  node test-seloger.js autocomplete [texte]');
  console.log('\nExemples:');
  console.log('  node test-seloger.js search Savarieres');
  console.log('  node test-seloger.js search "Belleville Paris"');
  console.log('  node test-seloger.js autocomplete Nantes');
}



