const METERS_PER_DEG_LAT = 111320;

const CADASTRE_CODE_MAP = new Map([
  ['75101', '75056'],
  ['75102', '75056'],
  ['75103', '75056'],
  ['75104', '75056'],
  ['75105', '75056'],
  ['75106', '75056'],
  ['75107', '75056'],
  ['75108', '75056'],
  ['75109', '75056'],
  ['75110', '75056'],
  ['75111', '75056'],
  ['75112', '75056'],
  ['75113', '75056'],
  ['75114', '75056'],
  ['75115', '75056'],
  ['75116', '75056'],
  ['75117', '75056'],
  ['75118', '75056'],
  ['75119', '75056'],
  ['75120', '75056'],
  ['13201', '13055'],
  ['13202', '13055'],
  ['13203', '13055'],
  ['13204', '13055'],
  ['13205', '13055'],
  ['13206', '13055'],
  ['13207', '13055'],
  ['13208', '13055'],
  ['13209', '13055'],
  ['13210', '13055'],
  ['13211', '13055'],
  ['13212', '13055'],
  ['13213', '13055'],
  ['13214', '13055'],
  ['13215', '13055'],
  ['13216', '13055'],
  ['69381', '69123'],
  ['69382', '69123'],
  ['69383', '69123'],
  ['69384', '69123'],
  ['69385', '69123'],
  ['69386', '69123'],
  ['69387', '69123'],
  ['69388', '69123'],
  ['69389', '69123'],
  ['69390', '69123'],
]);

function normalizeCadastreCodeInsee(codeInsee) {
  const normalized = String(codeInsee || '').trim();
  if (!normalized) return null;
  return CADASTRE_CODE_MAP.get(normalized) || normalized;
}

function radiusToBounds(lat, lng, radiusMeters) {
  const safeRadius = Math.max(1, Number(radiusMeters) || 1);
  const dLat = safeRadius / METERS_PER_DEG_LAT;
  const cosLat = Math.cos((Number(lat) * Math.PI) / 180);
  const dLng = safeRadius / (METERS_PER_DEG_LAT * (Math.abs(cosLat) > 0.0001 ? cosLat : 0.0001));
  return {
    minLat: Number(lat) - dLat,
    minLng: Number(lng) - dLng,
    maxLat: Number(lat) + dLat,
    maxLng: Number(lng) + dLng,
  };
}

module.exports = {
  normalizeCadastreCodeInsee,
  radiusToBounds,
};
