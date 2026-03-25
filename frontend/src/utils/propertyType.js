function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePropertyType(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (
    raw === 'house' ||
    raw === 'maison' ||
    raw === 'item type house' ||
    raw.includes(' house ') ||
    raw.startsWith('house ') ||
    raw.endsWith(' house') ||
    /\b(maison|villa|pavillon|propriete|propriete de prestige|hotel particulier|demeure|ferme|mas)\b/.test(raw)
  ) {
    return 'House';
  }

  if (
    raw === 'apartment' ||
    raw === 'appartement' ||
    raw === 'item type apartment' ||
    raw.includes(' apartment ') ||
    raw.startsWith('apartment ') ||
    raw.endsWith(' apartment') ||
    /\b(appartement|studio|loft|duplex|triplex|flat)\b/.test(raw)
  ) {
    return 'Apartment';
  }

  return null;
}

export function inferPropertyType(...values) {
  for (const value of values.flat()) {
    const direct = normalizePropertyType(value);
    if (direct) return direct;
  }

  const combined = normalizeText(values.flat().filter(Boolean).join(' '));
  if (!combined) return null;

  if (/\b(maison|villa|pavillon|propriete|hotel particulier|demeure|ferme|mas)\b/.test(combined)) {
    return 'House';
  }

  if (/\b(appartement|studio|loft|duplex|triplex|flat)\b/.test(combined)) {
    return 'Apartment';
  }

  return null;
}

export function estateTypesForTargetType(type) {
  if (type === 'House') return ['House'];
  if (type === 'Apartment') return ['Apartment'];
  return ['House', 'Apartment'];
}

export function itemTypesForTargetType(type) {
  if (type === 'House') return ['ITEM_TYPE.HOUSE'];
  if (type === 'Apartment') return ['ITEM_TYPE.APARTMENT'];
  return ['ITEM_TYPE.HOUSE', 'ITEM_TYPE.APARTMENT'];
}

export function matchesTargetPropertyType(ref, targetType) {
  if (!targetType) return true;
  const refType = inferPropertyType(
    ref?.propertyType,
    ref?.estateType,
    ref?.realEstateType,
    ref?.item_type,
    ref?.itemType,
    ref?.typeLabel,
    ref?.title,
    ref?.description,
    ref?.keywords
  );
  return refType ? refType === targetType : true;
}
