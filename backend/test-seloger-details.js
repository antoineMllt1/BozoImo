/**
 * Script de test pour afficher les détails complets des annonces SeLoger
 * Usage: node test-seloger-details.js [adresse] [nombre_d_annonces_à_afficher]
 */

const axios = require('axios');

const API_URL = 'http://localhost:5000/api/seloger';

async function testSearchWithDetails(address, displayCount = 3) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`🔍 Recherche détaillée pour: "${address}"`);
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
    
    console.log('📊 Statistiques:');
    console.log(`   • Nombre total de biens: ${data.totalCount}`);
    console.log(`   • Annonces détaillées: ${data.classifieds?.length || 0}`);
    console.log(`   • Temps de réponse: ${duration}ms`);
    
    console.log('\n📍 Localisation:');
    console.log(`   • Adresse: ${data.location.address}`);
    console.log(`   • ID SeLoger: ${data.location.placeId}`);
    console.log(`   • Coordonnées: ${data.location.coordinates.lat}, ${data.location.coordinates.lng}`);
    
    if (data.polyline) {
      console.log('\n🔄 Recherche par cercle utilisée');
      console.log(`   • Polyline: ${data.polyline.substring(0, 40)}...`);
    }

    if (data.classifieds && data.classifieds.length > 0) {
      console.log(`\n\n🏠 DÉTAILS DES ${Math.min(displayCount, data.classifieds.length)} PREMIÈRES ANNONCES:\n`);
      
      data.classifieds.slice(0, displayCount).forEach((classified, index) => {
        console.log('─'.repeat(60));
        console.log(`\n📋 ANNONCE ${index + 1} - ID: ${classified.id}`);
        console.log('─'.repeat(60));
        
        // Titre et type
        console.log(`\n📌 ${classified.hardFacts?.title || 'N/A'}`);
        if (classified.mainDescription?.headline) {
          console.log(`   ${classified.mainDescription.headline}`);
        }
        
        // Prix
        if (classified.hardFacts?.price) {
          console.log(`\n💰 Prix: ${classified.hardFacts.price.value}`);
          if (classified.hardFacts.price.additionalInformation) {
            console.log(`   (${classified.hardFacts.price.additionalInformation})`);
          }
        }
        
        // Caractéristiques principales
        if (classified.hardFacts?.keyfacts) {
          console.log(`\n🔑 Caractéristiques:`);
          classified.hardFacts.keyfacts.forEach(fact => {
            console.log(`   • ${fact}`);
          });
        }
        
        // Localisation
        if (classified.location?.address) {
          console.log(`\n📍 Adresse:`);
          const addr = classified.location.address;
          console.log(`   ${addr.district ? addr.district + ', ' : ''}${addr.city} (${addr.zipCode})`);
          if (classified.location.isAddressPublished) {
            console.log(`   ✓ Adresse exacte publiée`);
          }
        }
        
        // Images
        if (classified.gallery?.images) {
          console.log(`\n📷 Photos: ${classified.gallery.images.length} images disponibles`);
          if (classified.gallery.images.length > 0) {
            console.log(`   Première image: ${classified.gallery.images[0].url}`);
          }
          if (classified.tags?.has3DVisit) {
            console.log(`   🏗️  Visite 3D disponible`);
          }
        }
        
        // Classe énergétique
        if (classified.energyClass) {
          console.log(`\n⚡ Classe énergétique: ${classified.energyClass}`);
        }
        
        // Description
        if (classified.mainDescription?.description) {
          const desc = classified.mainDescription.description;
          const shortDesc = desc.length > 150 ? desc.substring(0, 150) + '...' : desc;
          console.log(`\n📝 Description:`);
          console.log(`   ${shortDesc}`);
        }
        
        // Agence
        if (classified.provider?.intermediaryCard) {
          console.log(`\n🏢 Agence: ${classified.provider.intermediaryCard.title}`);
          if (classified.provider.rating) {
            console.log(`   ⭐ Note: ${classified.provider.rating.rating.toFixed(1)}/5 (${classified.provider.rating.reviews} avis)`);
          }
        }
        
        // Tags spéciaux
        const tags = [];
        if (classified.tags?.isExclusive) tags.push('🔒 Exclusivité');
        if (classified.tags?.isNew) tags.push('🆕 Nouveau');
        if (classified.tags?.has3DVisit) tags.push('🏗️ Visite 3D');
        if (tags.length > 0) {
          console.log(`\n🏷️  ${tags.join(' • ')}`);
        }
        
        // URL
        if (classified.url) {
          console.log(`\n🔗 Lien: ${classified.url}`);
        }
        
        console.log('\n');
      });
      
      console.log('═'.repeat(60));
      
      if (data.classifieds.length > displayCount) {
        console.log(`\n... et ${data.classifieds.length - displayCount} autres annonces`);
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

// Récupérer les arguments
const args = process.argv.slice(2);
const address = args.join(' ') || 'Savarieres';
const displayCount = 3; // Par défaut, afficher 3 annonces

testSearchWithDetails(address, displayCount);



