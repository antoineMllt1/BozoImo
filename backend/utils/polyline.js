/**
 * Utilitaires pour l'encodage Google Polyline
 */

/**
 * Encode un tableau de coordonnées [lat, lng] en polyline Google
 * @param {Array<Array<number>>} coordinates - Tableau de coordonnées [[lat1, lng1], [lat2, lng2], ...]
 * @returns {string} Polyline encodée
 */
function encodePolyline(coordinates) {
  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const coord of coordinates) {
    const lat = Math.round(coord[0] * 1e5);
    const lng = Math.round(coord[1] * 1e5);
    
    result += encodeValue(lat - prevLat);
    result += encodeValue(lng - prevLng);
    
    prevLat = lat;
    prevLng = lng;
  }

  return result;
}

/**
 * Encode une valeur unique pour le format polyline
 * @param {number} value - Valeur à encoder
 * @returns {string} Valeur encodée
 */
function encodeValue(value) {
  // Encode en complément à deux
  value = value < 0 ? ~(value << 1) : (value << 1);
  
  let result = '';
  while (value >= 0x20) {
    result += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
    value >>= 5;
  }
  result += String.fromCharCode(value + 63);
  
  return result;
}

/**
 * Crée un cercle de points autour d'une coordonnée centrale
 * @param {number} lat - Latitude du centre
 * @param {number} lng - Longitude du centre
 * @param {number} radiusMeters - Rayon en mètres
 * @param {number} numPoints - Nombre de points pour le cercle (défaut: 32)
 * @returns {Array<Array<number>>} Tableau de coordonnées formant un cercle
 */
function createCircle(lat, lng, radiusMeters, numPoints = 32) {
  const coordinates = [];
  const earthRadius = 6378137; // Rayon de la Terre en mètres
  
  // Convertir le rayon en radians
  const angularDistance = radiusMeters / earthRadius;
  const latRad = lat * Math.PI / 180;
  const lngRad = lng * Math.PI / 180;
  
  for (let i = 0; i <= numPoints; i++) {
    const bearing = (i * 360 / numPoints) * Math.PI / 180;
    
    // Formule de destination point
    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    
    const newLngRad = lngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );
    
    const newLat = newLatRad * 180 / Math.PI;
    const newLng = newLngRad * 180 / Math.PI;
    
    coordinates.push([newLat, newLng]);
  }
  
  return coordinates;
}

/**
 * Crée un polyline encodé représentant un cercle
 * @param {number} lat - Latitude du centre
 * @param {number} lng - Longitude du centre
 * @param {number} radiusMeters - Rayon en mètres
 * @returns {string} Polyline encodée
 */
function createCirclePolyline(lat, lng, radiusMeters) {
  const circle = createCircle(lat, lng, radiusMeters);
  return encodePolyline(circle);
}

module.exports = {
  encodePolyline,
  createCircle,
  createCirclePolyline
};



