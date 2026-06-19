export type DateIso = string;
export type EntityId = string;
export type Locale = 'es-ES';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Bounds = {
  northEast: Coordinates;
  southWest: Coordinates;
};
