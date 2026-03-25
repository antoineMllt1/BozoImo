const axios = require('axios');

const METERS_PER_DEG_LAT = 111320;
const NOMINATIM_HEADERS = {
  'User-Agent': 'Estimia/2.0 (neighborhood-enrichment)',
  Accept: 'application/json',
};
const HTML_HEADERS = {
  'User-Agent': 'Estimia/2.0 (city-profile-enrichment)',
  Accept: 'text/html,application/xhtml+xml',
};

function toNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function radiusToBounds(lat, lng, radiusM) {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = radiusM / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = value => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function compactValue(value) {
  return value == null ? null : value;
}

function compactObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value != null)
  );
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value = '') {
  return normalizeText(value).replace(/\s+/g, '-');
}

function decodeHtmlEntities(html = '') {
  return String(html)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&eacute;/g, 'é')
    .replace(/&egrave;/g, 'è')
    .replace(/&ecirc;/g, 'ê')
    .replace(/&agrave;/g, 'à')
    .replace(/&ccedil;/g, 'ç')
    .replace(/&ocirc;/g, 'ô')
    .replace(/&uuml;/g, 'ü')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function htmlToLines(html = '') {
  const text = decodeHtmlEntities(
    String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<\/(p|div|section|article|aside|header|footer|h1|h2|h3|h4|h5|h6|li|tr|table|ul|ol)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );

  return text
    .split(/\n+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function sectionStartsWith(sectionKey, normalizedLine) {
  const map = {
    presentation: 'presentation',
    population: 'population',
    climate: 'climat',
    economy: 'economie',
    housing: 'immobilier',
    safety: 'securite',
    politics: 'politique',
    services: 'services',
    cityhall: 'mairie',
    proximity: 'communes les plus proches',
    reviews: 'avis sur',
  };

  const target = map[sectionKey];
  return target ? normalizedLine.startsWith(target) : false;
}

function extractSectionLines(lines, sectionKey) {
  const startIndex = lines.findIndex(line => sectionStartsWith(sectionKey, normalizeText(line)));
  if (startIndex < 0) return [];

  const nextIndex = lines.findIndex((line, index) => {
    if (index <= startIndex) return false;
    const normalized = normalizeText(line);
    return [
      'presentation',
      'population',
      'climate',
      'economy',
      'housing',
      'safety',
      'politics',
      'services',
      'cityhall',
      'proximity',
      'reviews',
    ].some(key => sectionStartsWith(key, normalized));
  });

  return lines.slice(startIndex + 1, nextIndex < 0 ? lines.length : nextIndex);
}

function parseNumericValue(value, kind = 'number') {
  if (value == null) return null;
  const raw = String(value).replace(/\u202f/g, ' ').trim();
  const match = raw.match(/-?\d[\d\s.,]*/);
  if (!match) return null;
  const normalized = match[0].replace(/\s/g, '').replace(',', '.');
  const parsed = kind === 'int' ? parseInt(normalized, 10) : parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function lineValueBeforeLabel(lines, label, kind = 'number') {
  const index = lines.findIndex(line => normalizeText(line) === normalizeText(label));
  if (index <= 0) return null;
  return parseNumericValue(lines[index - 1], kind);
}

function lineValueInPattern(lines, pattern, kind = 'number') {
  const line = lines.find(entry => pattern.test(normalizeText(entry)));
  return line ? parseNumericValue(line, kind) : null;
}

function lineValuesInPattern(lines, pattern) {
  const line = lines.find(entry => pattern.test(normalizeText(entry)));
  if (!line) return [];
  return [...String(line).matchAll(/\d[\d\s.,]*/g)]
    .map(match => parseNumericValue(match[0]))
    .filter(value => value != null);
}

function lineTextMatch(lines, pattern) {
  return lines.find(entry => pattern.test(normalizeText(entry))) || null;
}

function parseSequentialScoreLine(lines, label) {
  const line = lines.find(entry => normalizeText(entry).startsWith(`${normalizeText(label)} `));
  if (!line) return null;
  const match = String(line).match(/([0-9]+(?:[,.][0-9]+)?)\s*\/\s*5/);
  return match ? parseNumericValue(match[1]) : null;
}

function parsePercentageWithLabel(lines, label) {
  const normalizedLabel = normalizeText(label);
  const line = lines.find(entry => normalizeText(entry).includes(normalizedLabel));
  if (!line) return null;
  const match = String(line).match(/([0-9]+(?:[,.][0-9]+)?)\s*%/);
  return match ? parseNumericValue(match[1]) : null;
}

function parseDistanceKm(lines, label) {
  const line = lines.find(entry => normalizeText(entry).startsWith(normalizeText(label)));
  if (!line) return null;
  const match = String(line).match(/\(([0-9]+(?:[,.][0-9]+)?)\s*km\)/i);
  return match ? parseNumericValue(match[1]) : null;
}

function stripHtml(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractNuxtPayload(html = '') {
  const match = String(html).match(/<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  return JSON.parse(match[1]);
}

function resolveNuxtPayload(table) {
  if (!Array.isArray(table)) return null;

  const cache = new Map();

  function resolveValue(value) {
    if (typeof value === 'number') return resolveIndex(value);

    if (Array.isArray(value)) {
      if (value[0] === 'Reactive' || value[0] === 'ShallowReactive') {
        return resolveValue(value[1]);
      }
      if (value[0] === 'Set') {
        return value.slice(1).map(resolveValue);
      }
      return value.map(resolveValue);
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, resolveValue(entry)])
      );
    }

    return value;
  }

  function resolveIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= table.length) return null;
    if (cache.has(index)) return cache.get(index);

    const raw = table[index];
    if (raw == null || typeof raw !== 'object') return raw;

    cache.set(index, Array.isArray(raw) ? [] : {});
    const resolved = resolveValue(raw);
    cache.set(index, resolved);
    return resolved;
  }

  return resolveIndex(1);
}

function metricByCode(metrics = [], code) {
  return Array.isArray(metrics) ? metrics.find(item => item?.code === code) || null : null;
}

function metricValue(metrics = [], code) {
  return metricByCode(metrics, code)?.value ?? null;
}

function metricAverage(metrics = [], code) {
  return metricByCode(metrics, code)?.avg_value ?? null;
}

function chartByCode(list = [], code) {
  return Array.isArray(list) ? list.find(item => item?.code === code) || null : null;
}

function chartPercentage(list = [], code) {
  return chartByCode(list, code)?.percentage ?? null;
}

function serviceCount(services = {}, group, label) {
  return toNumber(services?.[group]?.[label]?.count ?? null);
}

function serviceNearestDistanceKm(services = {}, group, label) {
  const distanceM = toNumber(services?.[group]?.[label]?.nearest?.distance ?? null);
  return distanceM == null ? null : Math.round((distanceM / 1000) * 10) / 10;
}

function parseVillesAVivrePage(html, commune) {
  const payload = extractNuxtPayload(html);
  const resolved = resolveNuxtPayload(payload);
  const dataEntries = resolved?.data && typeof resolved.data === 'object' ? Object.entries(resolved.data) : [];
  const cityPayload = dataEntries.find(([key]) => key.startsWith('cityMainPageData-'))?.[1];
  const cityData = cityPayload?.cityData;
  const city = cityData?.city || {};
  const metrics = Array.isArray(cityData?.metrics) ? cityData.metrics : [];
  const charts = cityData?.charts || {};
  const cityServices = cityData?.services || {};
  const pageHasNoReviews = /Il n'y a pas encore d'avis/i.test(stripHtml(html));
  const reviewCount = toNumber(city.total_reviews) ?? (pageHasNoReviews ? 0 : null);
  const hasResidentReviews = reviewCount != null && reviewCount > 0;

  if (city?.full_name) {
    const builtAfter1970Match = String(city?.summary_real_estate || '').match(/(\d+(?:[.,]\d+)?)%\s+des logements ont été construits après 1970/i);

    return compactObject({
      source: 'villesavivre.fr',
      url: `https://www.villesavivre.fr/${city.slug || `${slugify(commune?.name || city.full_name)}-${commune?.code || ''}`}/`,
      commune: compactObject({
        name: city.full_name || commune?.name || null,
        codeInsee: commune?.code || null,
        postalCode: commune?.postalCode || city.default_zipcode || null,
        department: commune?.department || city?.region?.name || null,
        region: commune?.region || null,
      }),
      ratings: compactObject({
        overall: hasResidentReviews ? toNumber(city.avg_score_global) : null,
        reviewCount,
        environment: hasResidentReviews ? toNumber(city.avg_score_environment) : null,
        security: hasResidentReviews ? toNumber(city.avg_score_security) : null,
        transport: hasResidentReviews ? toNumber(city.avg_score_transportation) : null,
        health: hasResidentReviews ? toNumber(city.avg_score_health) : null,
        education: hasResidentReviews ? toNumber(city.avg_score_education) : null,
        sport: hasResidentReviews ? toNumber(city.avg_score_sport) : null,
        services: hasResidentReviews ? toNumber(city.avg_score_services) : null,
        culture: hasResidentReviews ? toNumber(city.avg_score_culture) : null,
      }),
      population: compactObject({
        inhabitants: toNumber(city.population) ?? metricValue(metrics, 'POP'),
        growthPct: metricValue(metrics, 'DIFF_POP_2317%'),
        densityKm2: toNumber(city.density),
        medianAge: metricValue(metrics, 'AGE_MEDIAN'),
        surfaceKm2: toNumber(city.surface),
        singleHouseholdsPct: chartPercentage(charts.family, 'MENPSEUL'),
        youthPct: chartPercentage(charts.popByAge, 'POP1529'),
        familyWithChildrenPct: chartPercentage(charts.family, 'MENCOUPAENF'),
      }),
      climate: compactObject({
        type: city?.climate?.name || null,
        avgTempC: toNumber(city?.weather_station?.avg_temperature),
        maxTempC: toNumber(city?.weather_station?.avg_max_temperature),
        minTempC: toNumber(city?.weather_station?.avg_min_temperature),
        rainMm: toNumber(city?.weather_station?.rainfall),
        rainDays: toNumber(city?.weather_station?.days_raining),
        sunshineHours: toNumber(city?.weather_station?.sun_duration),
        hotDays: toNumber(city?.weather_station?.days_above_30),
        frostDays: toNumber(city?.weather_station?.days_below_0),
      }),
      economy: compactObject({
        medianIncome: metricValue(metrics, 'MED') ?? toNumber(city.median_income),
        unemploymentPct: metricValue(metrics, 'CHOM1564%'),
        fiberPct: metricValue(metrics, 'ARCEP_FTTH%'),
        taxedHouseholdsPct: metricValue(metrics, 'PIMP'),
        businessCreationPct: metricValue(metrics, 'TX_CREA_ENT'),
      }),
      housing: compactObject({
        summary: stripHtml(city.summary_real_estate),
        apartmentPricePm2: metricValue(metrics, 'EUR_MED_SQM_APT'),
        apartmentPriceTrendPct: metricValue(metrics, 'DIFF_MED_SQM_APT%'),
        housePricePm2: metricValue(metrics, 'EUR_MED_SQM_HSE'),
        housePriceTrendPct: metricValue(metrics, 'DIFF_MED_SQM_HSE%'),
        housingPricePm2: metricValue(metrics, 'EUR_MED_SQM'),
        transactionCount: metricValue(metrics, 'PROP_TRAN_COUNT'),
        apartmentTransactionCount: metricValue(metrics, 'APT_TRAN_COUNT'),
        houseTransactionCount: metricValue(metrics, 'HSE_TRAN_COUNT'),
        builtAfter1970Pct: builtAfter1970Match ? parseNumericValue(builtAfter1970Match[1]) : null,
        apartmentSharePct: chartPercentage(charts.houseOrAppt, 'APPART'),
        houseSharePct: chartPercentage(charts.houseOrAppt, 'MAISON'),
        vacantPct: chartPercentage(charts.homeByType, 'LOGVAC'),
        primaryResidencePct: chartPercentage(charts.homeByType, 'RP'),
        secondaryResidencePct: chartPercentage(charts.homeByType, 'RSECOCC'),
        ownerPct: chartPercentage(charts.rentOrOwn, 'RP_PROP'),
        tenantPct: chartPercentage(charts.rentOrOwn, 'RP_LOC'),
      }),
      safety: compactObject({
        crimesPer1000: metricValue(metrics, 'CRIMES_DELITS_BY_POP'),
        nationalCrimesPer1000: metricAverage(metrics, 'CRIMES_DELITS_BY_POP'),
        burglaryPer1000: metricValue(metrics, 'BURGLARY_RATE_BY_POP'),
        burglaryNationalPer1000: metricAverage(metrics, 'BURGLARY_RATE_BY_POP'),
        carTheftPer1000: metricValue(metrics, 'VOL_AUTOMOBILE_BY_POP'),
        carTheftNationalPer1000: metricAverage(metrics, 'VOL_AUTOMOBILE_BY_POP'),
        personalTheftPer1000: metricValue(metrics, 'VOL_SIMPLE_PARTICULIER_BY_POP'),
        personalTheftNationalPer1000: metricAverage(metrics, 'VOL_SIMPLE_PARTICULIER_BY_POP'),
        physicalViolencePer1000: metricValue(metrics, 'VIOLENCES_PHYSIQUES_BY_POP'),
        physicalViolenceNationalPer1000: metricAverage(metrics, 'VIOLENCES_PHYSIQUES_BY_POP'),
        sexualViolencePer1000: metricValue(metrics, 'VIOLENCES_SEXUELLES_BY_POP'),
        sexualViolenceNationalPer1000: metricAverage(metrics, 'VIOLENCES_SEXUELLES_BY_POP'),
      }),
      services: compactObject({
        doctors: serviceCount(cityServices, 'health', 'Médecin'),
        dentists: serviceCount(cityServices, 'health', 'Dentiste'),
        nurses: serviceCount(cityServices, 'health', 'Infirmier'),
        pharmacies: serviceCount(cityServices, 'health', 'Pharmacie'),
        emergency: serviceCount(cityServices, 'health', 'Urgences'),
        nurseries: serviceCount(cityServices, 'education', 'Crèche'),
        nurserySchools: serviceCount(cityServices, 'education', 'Ecole maternelle'),
        elementarySchools: serviceCount(cityServices, 'education', 'Ecole élementaire'),
        colleges: serviceCount(cityServices, 'education', 'Collège'),
        highSchools: serviceCount(cityServices, 'education', 'Lycée'),
        hypermarkets: serviceCount(cityServices, 'shopping', 'Hypermarché'),
        supermarkets: serviceCount(cityServices, 'shopping', 'Supermarché'),
        groceries: serviceCount(cityServices, 'shopping', 'Epicerie'),
        bakeries: serviceCount(cityServices, 'shopping', 'Boulangerie'),
        fuelStations: serviceCount(cityServices, 'shopping', 'Station service'),
        postOffices: serviceCount(cityServices, 'shopping', 'Bureau de Poste'),
        hotels: serviceCount(cityServices, 'leasure', 'Hôtel'),
        restaurants: serviceCount(cityServices, 'leasure', 'Restaurant'),
        cinemas: serviceCount(cityServices, 'leasure', 'Cinéma'),
        libraries: serviceCount(cityServices, 'leasure', 'Bibliothèque'),
        trainStationDistanceKm: serviceNearestDistanceKm(cityServices, 'leasure', 'Gare SNCF'),
        airportDistanceKm: serviceNearestDistanceKm(cityServices, 'leasure', 'Aeroport'),
      }),
      summaries: compactObject({
        city: stripHtml(city.summary),
        climate: stripHtml(city.summary_climate),
        housing: stripHtml(city.summary_real_estate),
      }),
      references: [
        'INSEE',
        'Météo-France',
        'Ministère de l’Intérieur',
        'DVF',
        'Base permanente des équipements (INSEE)',
      ],
    });
  }

  const lines = htmlToLines(html);
  const joined = lines.join('\n');

  const presentation = extractSectionLines(lines, 'presentation');
  const population = extractSectionLines(lines, 'population');
  const climate = extractSectionLines(lines, 'climate');
  const economy = extractSectionLines(lines, 'economy');
  const housing = extractSectionLines(lines, 'housing');
  const safety = extractSectionLines(lines, 'safety');
  const services = extractSectionLines(lines, 'services');

  const ratings = compactObject({
    overall: presentation.length > 1 ? parseNumericValue(presentation[1]) : null,
    reviewCount: parseNumericValue(presentation.find(line => /avis/i.test(line)) || null, 'int'),
    environment: parseSequentialScoreLine(presentation, 'Environnement'),
    security: parseSequentialScoreLine(presentation, 'Sécurité'),
    transport: parseSequentialScoreLine(presentation, 'Transports'),
    health: parseSequentialScoreLine(presentation, 'Santé'),
    education: parseSequentialScoreLine(presentation, 'Education'),
    sport: parseSequentialScoreLine(presentation, 'Sport'),
    services: parseSequentialScoreLine(presentation, 'Services'),
    culture: parseSequentialScoreLine(presentation, 'Culture'),
  });

  const populationStats = compactObject({
    inhabitants: lineValueBeforeLabel(population, 'habitants', 'int'),
    growthPct: lineValueBeforeLabel(population, 'Entre 2017 et 2023'),
    densityKm2: lineValueBeforeLabel(population, 'hab/km^2', 'int'),
    medianAge: lineValueBeforeLabel(population, 'âge médian', 'int'),
  });

  const climateStats = compactObject({
    avgTempC: lineValueBeforeLabel(climate, 'T° moyenne'),
    maxTempC: lineValueBeforeLabel(climate, 'T° maximum'),
    minTempC: lineValueBeforeLabel(climate, 'T° minimum'),
    sunshineHours: lineValueBeforeLabel(climate, 'jours de forte chaleur', 'int'),
    hotDays: lineValueInPattern(climate, /jours de forte chaleur/, 'int'),
    rainMm: lineValueBeforeLabel(climate, 'jours', 'int'),
    rainDays: lineValueInPattern(climate, /^97 jours$|^118 jours$|^135 jours$| jours$/i, 'int'),
    frostDays: lineValueInPattern(climate, /jours de gel/, 'int'),
  });

  const economyStats = compactObject({
    medianIncome: lineValueBeforeLabel(economy, 'Revenu médian', 'int'),
    unemploymentPct: lineValueBeforeLabel(economy, 'Taux de chômage'),
    fiberPct: lineValueBeforeLabel(economy, 'couverture en très haut débit (fibre)'),
    businessCreationPct: lineValueBeforeLabel(economy, "Taux de création d'entreprises"),
  });

  const apartmentPriceLineIndex = housing.findIndex(line => normalizeText(line) === normalizeText("Prix médian m2 d'un appartement"));
  const housePriceLineIndex = housing.findIndex(line => normalizeText(line) === normalizeText("Prix médian m2 d'une maison"));
  const apartmentPriceValues = apartmentPriceLineIndex > 0 ? lineValuesInPattern([housing[apartmentPriceLineIndex - 1]], /./) : [];
  const housePriceValues = housePriceLineIndex > 0 ? lineValuesInPattern([housing[housePriceLineIndex - 1]], /./) : [];

  const housingStats = compactObject({
    summary: housing[0] || null,
    builtAfter1970Pct: (() => {
      const match = joined.match(/(\d+(?:[,.]\d+)?)\s*%\s+des logements ont ete construits apres 1970/i);
      return match ? parseNumericValue(match[1]) : null;
    })(),
    apartmentPricePm2: apartmentPriceValues[0] ?? null,
    apartmentPriceTrendPct: apartmentPriceValues[1] ?? null,
    housePricePm2: housePriceValues[0] ?? null,
    housePriceTrendPct: housePriceValues[1] ?? null,
    apartmentSharePct: parsePercentageWithLabel(housing, 'Appartements'),
    houseSharePct: parsePercentageWithLabel(housing, 'Maisons'),
    vacantPct: lineValueBeforeLabel(housing, 'Logements vacants'),
    primaryResidencePct: lineValueBeforeLabel(housing, 'Résidences principales'),
    secondaryResidencePct: lineValueBeforeLabel(housing, 'Résidences secondaires'),
    tenantPct: parsePercentageWithLabel(housing, 'Locataires'),
    ownerPct: parsePercentageWithLabel(housing, 'Propriétaires'),
  });

  const crimeValues = lineValuesInPattern(safety, /crimes et delits pour 100 000 habitants/i);
  const nationalAverageLine = lineTextMatch(safety, /moyenne nationale/i);
  const zoneLine = lineTextMatch(safety, /depend de la zone de/i);

  const parseLocalNationalPair = (label) => {
    const values = lineValuesInPattern(safety, new RegExp(normalizeText(label), 'i'));
    return compactObject({
      local: values[0] ?? null,
      national: values[1] ?? null,
    });
  };

  const safetyStats = compactObject({
    crimesPer100k: crimeValues[0] ?? lineValueBeforeLabel(safety, 'crimes et délits pour 100 000 habitants.', 'int'),
    nationalCrimesPer100k: nationalAverageLine ? parseNumericValue(nationalAverageLine, 'int') : null,
    zone: zoneLine || null,
    burglary: parseLocalNationalPair('Cambriolages'),
    carTheft: parseLocalNationalPair('Vols automobiles'),
    personalTheft: parseLocalNationalPair('Vols de particulier'),
    physicalViolence: parseLocalNationalPair('Violences physiques'),
    sexualViolence: parseLocalNationalPair('Violences sexuelles'),
  });

  const servicesStats = compactObject({
    doctors: lineValueInPattern(services, /^medecin /i, 'int'),
    dentists: lineValueInPattern(services, /^dentiste /i, 'int'),
    nurses: lineValueInPattern(services, /^infirmier /i, 'int'),
    pharmacies: lineValueInPattern(services, /^pharmacie /i, 'int'),
    emergency: lineValueInPattern(services, /^urgences /i, 'int'),
    nurseries: lineValueInPattern(services, /^creche /i, 'int'),
    nurserySchools: lineValueInPattern(services, /^ecole maternelle /i, 'int'),
    elementarySchools: lineValueInPattern(services, /^ecole elementaire /i, 'int'),
    colleges: lineValueInPattern(services, /^college /i, 'int'),
    highSchools: lineValueInPattern(services, /^lycee /i, 'int'),
    hypermarkets: lineValueInPattern(services, /^hypermarch[eé] /i, 'int'),
    supermarkets: lineValueInPattern(services, /^supermarche /i, 'int'),
    groceries: lineValueInPattern(services, /^epicerie /i, 'int'),
    bakeries: lineValueInPattern(services, /^boulangerie /i, 'int'),
    fuelStations: lineValueInPattern(services, /^station service /i, 'int'),
    postOffices: lineValueInPattern(services, /^bureau de poste /i, 'int'),
    hotels: lineValueInPattern(services, /^hotel /i, 'int'),
    restaurants: lineValueInPattern(services, /^restaurant /i, 'int'),
    cinemas: lineValueInPattern(services, /^cinema /i, 'int'),
    libraries: lineValueInPattern(services, /^bibliotheque /i, 'int'),
    trainStationDistanceKm: parseDistanceKm(services, 'Gare SNCF'),
    airportDistanceKm: parseDistanceKm(services, 'Aeroport'),
  });

  return compactObject({
    commune,
    ratings,
    population: populationStats,
    climate: climateStats,
    economy: economyStats,
    housing: housingStats,
    safety: safetyStats,
    services: servicesStats,
  });
}

async function fetchCommuneContext(lat, lng) {
  const { data } = await axios.get('https://geo.api.gouv.fr/communes', {
    params: {
      lat,
      lon: lng,
      fields: 'nom,code,codesPostaux,departement,region',
      format: 'json',
      geometry: 'centre',
    },
    timeout: 15000,
  });

  const commune = Array.isArray(data) ? data[0] : null;
  if (!commune?.nom || !commune?.code) {
    throw new Error('Commune introuvable');
  }

  return compactObject({
    name: commune.nom,
    code: commune.code,
    postalCode: Array.isArray(commune.codesPostaux) ? commune.codesPostaux[0] || null : null,
    department: commune?.departement?.nom || null,
    region: commune?.region?.nom || null,
  });
}

async function fetchCommuneByName(name, postalCode = null) {
  const { data } = await axios.get('https://geo.api.gouv.fr/communes', {
    params: {
      nom: name,
      codePostal: postalCode || undefined,
      fields: 'nom,code,codesPostaux,departement,region,population',
      boost: 'population',
      limit: 5,
      format: 'json',
    },
    timeout: 15000,
  });

  const commune = Array.isArray(data) ? data[0] : null;
  if (!commune?.nom || !commune?.code) {
    throw new Error('Commune introuvable');
  }

  return compactObject({
    name: commune.nom,
    code: commune.code,
    postalCode: Array.isArray(commune.codesPostaux) ? commune.codesPostaux[0] || null : null,
    department: commune?.departement?.nom || null,
    region: commune?.region?.nom || null,
  });
}

function buildVillesAVivreSlug(name, code) {
  return `${slugify(name)}-${code}`;
}

async function geocodeAddress(address) {
  const { data } = await axios.get('https://api-adresse.data.gouv.fr/search/', {
    params: { q: address, limit: 1 },
    timeout: 15000,
  });

  const feature = Array.isArray(data?.features) ? data.features[0] : null;
  const coordinates = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates : [];
  const lng = toNumber(coordinates[0]);
  const lat = toNumber(coordinates[1]);

  if (lat == null || lng == null) {
    throw new Error('Adresse introuvable');
  }

  return compactObject({
    lat,
    lng,
    city: feature?.properties?.city || null,
    postalCode: feature?.properties?.postcode || null,
    cityCode: feature?.properties?.citycode || null,
    district: feature?.properties?.district || null,
    label: feature?.properties?.label || null,
  });
}

async function resolveVillesAVivreLookup(input = {}) {
  if (input.address) {
    try {
      const addressDetails = await geocodeAddress(input.address);
      const baseCommune = await fetchCommuneContext(addressDetails.lat, addressDetails.lng);

      if (addressDetails.district && addressDetails.cityCode) {
        const districtCommune = compactObject({
          ...baseCommune,
          name: addressDetails.district,
          code: addressDetails.cityCode,
          postalCode: addressDetails.postalCode || baseCommune.postalCode || null,
        });

        return {
          commune: districtCommune,
          slug: buildVillesAVivreSlug(districtCommune.name, districtCommune.code),
        };
      }

      return {
        commune: compactObject({
          ...baseCommune,
          postalCode: addressDetails.postalCode || baseCommune.postalCode || null,
        }),
        slug: null,
      };
    } catch (error) {
      if (input.lat == null && input.lng == null && !input.commune) {
        throw error;
      }
    }
  }

  if (input.lat != null && input.lng != null) {
    return {
      commune: await fetchCommuneContext(input.lat, input.lng),
      slug: null,
    };
  }

  if (input.commune) {
    return {
      commune: await fetchCommuneByName(input.commune, input.postalCode || null),
      slug: null,
    };
  }

  throw new Error('Il faut fournir lat/lng, commune ou address');
}

async function fetchVillesAVivreContext(input) {
  const { commune, slug } = await resolveVillesAVivreLookup(input);
  const url = `https://www.villesavivre.fr/${slug || buildVillesAVivreSlug(commune.name, commune.code)}/`;
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: HTML_HEADERS,
    timeout: 20000,
  });

  const html = Buffer.from(data).toString('utf8');
  return parseVillesAVivrePage(html, commune);
}

function sortByDistance(list) {
  return [...list].sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
}

function countWithin(list, radiusM) {
  return list.filter(item => item.distanceM != null && item.distanceM <= radiusM).length;
}

async function fetchTransportContext(lat, lng) {
  const bounds = radiusToBounds(lat, lng, 1200);
  const { data } = await axios.get('https://transport.data.gouv.fr/api/gtfs-stops', {
    params: bounds,
    timeout: 15000,
  });

  const stops = sortByDistance(
    (Array.isArray(data?.features) ? data.features : [])
      .map(feature => {
        const coordinates = feature?.geometry?.coordinates || [];
        const stopLng = toNumber(coordinates[0]);
        const stopLat = toNumber(coordinates[1]);
        if (stopLat == null || stopLng == null) return null;
        return compactObject({
          name: feature?.properties?.stop_name || null,
          datasetTitle: feature?.properties?.dataset_title || null,
          locationType: feature?.properties?.location_type ?? null,
          lat: stopLat,
          lng: stopLng,
          distanceM: haversineDistanceMeters(lat, lng, stopLat, stopLng),
        });
      })
      .filter(Boolean)
  );

  return compactObject({
    source: 'transport.data.gouv.fr',
    totalStops: stops.length,
    stopCount500m: countWithin(stops, 500),
    stopCount1000m: countWithin(stops, 1000),
    nearestStop: stops[0] || null,
    sample: stops.slice(0, 5),
  });
}

function schoolLevel(record) {
  const nature = String(record?.libelle_nature || record?.type_etablissement || '').toLowerCase();
  if (nature.includes('lycee')) return 'lycee';
  if (nature.includes('college')) return 'college';
  if (nature.includes('maternelle')) return 'maternelle';
  if (nature.includes('elementaire') || nature.includes('ecole')) return 'ecole';
  return 'other';
}

async function fetchSchoolsContext(lat, lng) {
  const bounds = radiusToBounds(lat, lng, 1200);
  const where = [
    `latitude >= ${bounds.south}`,
    `latitude <= ${bounds.north}`,
    `longitude >= ${bounds.west}`,
    `longitude <= ${bounds.east}`,
    "etat = 'OUVERT'",
  ].join(' AND ');

  const { data } = await axios.get(
    'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-annuaire-education/records',
    {
      params: { limit: 100, where },
      timeout: 15000,
    }
  );

  const schools = sortByDistance(
    (Array.isArray(data?.results) ? data.results : [])
      .map(record => {
        const schoolLat = toNumber(record?.latitude);
        const schoolLng = toNumber(record?.longitude);
        if (schoolLat == null || schoolLng == null) return null;
        const distanceM = haversineDistanceMeters(lat, lng, schoolLat, schoolLng);
        if (distanceM > 1000) return null;
        return compactObject({
          name: record?.nom_etablissement || null,
          type: record?.type_etablissement || null,
          level: schoolLevel(record),
          status: record?.statut_public_prive || null,
          city: record?.nom_commune || null,
          distanceM,
        });
      })
      .filter(Boolean)
  );

  const publicCount = schools.filter(item => item.status === 'Public').length;
  const privateCount = schools.filter(item => item.status === 'Privé' || item.status === 'Prive').length;
  const collegeCount = schools.filter(item => item.level === 'college').length;
  const lyceeCount = schools.filter(item => item.level === 'lycee').length;

  return compactObject({
    source: 'data.education.gouv.fr',
    count1km: schools.length,
    publicCount,
    privateCount,
    collegeCount,
    lyceeCount,
    nearestSchool: schools[0] || null,
    sample: schools.slice(0, 5),
  });
}

async function searchNominatim({ lat, lng, radiusM, query, limit = 25 }) {
  const bounds = radiusToBounds(lat, lng, radiusM);
  const viewbox = `${bounds.west},${bounds.north},${bounds.east},${bounds.south}`;
  const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
    params: {
      format: 'jsonv2',
      bounded: 1,
      limit,
      viewbox,
      q: query,
    },
    headers: NOMINATIM_HEADERS,
    timeout: 15000,
  });

  const seen = new Set();
  return sortByDistance(
    (Array.isArray(data) ? data : [])
      .map(item => {
        const itemLat = toNumber(item?.lat);
        const itemLng = toNumber(item?.lon);
        if (itemLat == null || itemLng == null) return null;
        const id = item?.osm_type && item?.osm_id ? `${item.osm_type}:${item.osm_id}` : String(item?.place_id);
        if (seen.has(id)) return null;
        seen.add(id);
        return compactObject({
          id,
          name: item?.name || null,
          displayName: item?.display_name || null,
          category: item?.category || null,
          type: item?.type || null,
          lat: itemLat,
          lng: itemLng,
          distanceM: haversineDistanceMeters(lat, lng, itemLat, itemLng),
        });
      })
      .filter(item => item && item.distanceM <= radiusM)
  );
}

function mergePoiLists(...lists) {
  const seen = new Set();
  const merged = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return sortByDistance(merged);
}

async function fetchAmenitiesContext(lat, lng) {
  const [pharmacies, supermarkets, restaurants, parks, gardens, railStations] = await Promise.all([
    searchNominatim({ lat, lng, radiusM: 800, query: 'pharmacy', limit: 20 }),
    searchNominatim({ lat, lng, radiusM: 1000, query: 'supermarket', limit: 20 }),
    searchNominatim({ lat, lng, radiusM: 1000, query: 'restaurant', limit: 40 }),
    searchNominatim({ lat, lng, radiusM: 700, query: 'park', limit: 20 }),
    searchNominatim({ lat, lng, radiusM: 700, query: 'jardin', limit: 20 }),
    searchNominatim({ lat, lng, radiusM: 1000, query: 'railway station', limit: 15 }),
  ]);

  const parkList = mergePoiLists(parks, gardens);

  return compactObject({
    source: 'nominatim.openstreetmap.org',
    pharmacyCount800m: pharmacies.length,
    supermarketCount1000m: supermarkets.length,
    restaurantCount1000m: restaurants.length,
    parkCount700m: parkList.length,
    nearestPark: parkList[0] || null,
    nearestRailStation: railStations[0] || null,
    railStationCount1000m: railStations.length,
    sample: compactObject({
      pharmacies: pharmacies.slice(0, 3),
      supermarkets: supermarkets.slice(0, 3),
      parks: parkList.slice(0, 3),
    }),
  });
}

function buildRiskSummary(response) {
  const natural = response?.risquesNaturels || {};
  const presentNaturalRisks = Object.values(natural).filter(item => item?.present);

  return compactObject({
    source: 'georisques.gouv.fr',
    commune: compactObject({
      name: response?.commune?.libelle || null,
      codeInsee: response?.commune?.codeInsee || null,
      postalCode: response?.commune?.codePostal || null,
    }),
    flood: compactObject({
      present: Boolean(natural?.inondation?.present),
      communeStatus: natural?.inondation?.libelleStatutCommune || null,
      addressStatus: natural?.inondation?.libelleStatutAdresse || null,
    }),
    naturalRiskCount: presentNaturalRisks.length,
    naturalRisks: Object.entries(natural)
      .filter(([, value]) => value?.present)
      .map(([, value]) =>
        compactObject({
          label: value?.libelle || null,
          communeStatus: value?.libelleStatutCommune || null,
          addressStatus: value?.libelleStatutAdresse || null,
        })
      )
      .slice(0, 8),
  });
}

async function fetchRiskContext(lat, lng) {
  const latlon = `${lng},${lat}`;
  const { data } = await axios.get('https://www.georisques.gouv.fr/api/v1/resultats_rapport_risque', {
    params: { latlon },
    timeout: 15000,
  });
  return buildRiskSummary(data);
}

function withResult(result, source) {
  if (result.status === 'fulfilled') return result.value;
  return {
    source,
    error: result.reason?.message || 'Enrichment unavailable',
  };
}

exports.enrichArea = async (req, res) => {
  try {
    const lat = toNumber(req.body?.lat);
    const lng = toNumber(req.body?.lng);

    if (lat == null || lng == null) {
      return res.status(400).json({
        success: false,
        error: 'Les parametres "lat" et "lng" sont requis',
      });
    }

    const [transport, schools, amenities, risks] = await Promise.allSettled([
      fetchTransportContext(lat, lng),
      fetchSchoolsContext(lat, lng),
      fetchAmenitiesContext(lat, lng),
      fetchRiskContext(lat, lng),
    ]);

    const context = {
      fetchedAt: new Date().toISOString(),
      location: { lat, lng },
      transport: withResult(transport, 'transport.data.gouv.fr'),
      schools: withResult(schools, 'data.education.gouv.fr'),
      amenities: withResult(amenities, 'nominatim.openstreetmap.org'),
      risks: withResult(risks, 'georisques.gouv.fr'),
      noise: compactObject({
        source: 'nominatim.openstreetmap.org',
        nearestRailStation: amenities.status === 'fulfilled' ? amenities.value.nearestRailStation || null : null,
        railStationCount1000m: amenities.status === 'fulfilled' ? compactValue(amenities.value.railStationCount1000m) : null,
      }),
    };

    res.json({ success: true, context });
  } catch (error) {
    console.error('Erreur enrichissement quartier:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l enrichissement du quartier',
      details: error.message,
    });
  }
};

exports.enrichVillesAVivre = async (req, res) => {
  try {
    const lat = toNumber(req.body?.lat);
    const lng = toNumber(req.body?.lng);
    const commune = String(req.body?.commune || '').trim() || null;
    const postalCode = String(req.body?.postalCode || '').trim() || null;
    const address = String(req.body?.address || '').trim() || null;

    if ((lat == null || lng == null) && !commune && !address) {
      return res.status(400).json({
        success: false,
        error: 'Les parametres "lat/lng", "commune" ou "address" sont requis',
      });
    }

    const villesAVivre = await fetchVillesAVivreContext({
      lat,
      lng,
      commune,
      postalCode,
      address,
    });

    res.json({
      success: true,
      fetchedAt: new Date().toISOString(),
      location: compactObject({ lat, lng }),
      lookup: compactObject({
        method: lat != null && lng != null ? 'latlng' : commune ? 'commune' : 'address',
        commune,
        postalCode,
        address,
      }),
      villesAVivre,
    });
  } catch (error) {
    console.error('Erreur Villes a vivre:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation Villes a vivre',
      details: error.message,
    });
  }
};
