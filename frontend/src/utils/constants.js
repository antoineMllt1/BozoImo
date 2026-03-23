export const SELOGER_FEATURES = [
  { value: 'Parking_Garage',         label: 'Parking',         icon: '🅿️' },
  { value: 'Balcony_Terrace',        label: 'Balcon',          icon: '🌿' },
  { value: 'Garden',                 label: 'Jardin',          icon: '🌳' },
  { value: 'Swimming_Pool',          label: 'Piscine',         icon: '🏊' },
  { value: 'Cellar',                 label: 'Cave',            icon: '📦' },
  { value: 'Kitchen_Fully_Equipped', label: 'Cuisine équipée', icon: '🍳' },
  { value: 'Exclusive',              label: 'Exclusivité',     icon: '⭐' },
];

export const SELOGER_ESTATE_TYPES = [
  { value: 'House',     label: 'Maison',      icon: '🏠' },
  { value: 'Apartment', label: 'Appartement', icon: '🏢' },
];

export const MA_ITEM_TYPES = [
  { value: 'ITEM_TYPE.HOUSE',     label: 'Maison',      icon: '🏠' },
  { value: 'ITEM_TYPE.APARTMENT', label: 'Appartement', icon: '🏢' },
];

export const DEFAULT_SELOGER = {
  estateTypes: ['House', 'Apartment'],
  numberOfRoomsMin: '', numberOfRoomsMax: '',
  priceMin: '', priceMax: '',
  spaceMin: '', spaceMax: '',
  featuresIncluded: [],
};

export const RADIUS_OPTIONS = [
  { value: 250,  label: '250m' },
  { value: 500,  label: '500m' },
  { value: 1000, label: '1km'  },
  { value: 2000, label: '2km'  },
  { value: 5000, label: '5km'  },
];
