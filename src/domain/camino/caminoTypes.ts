import type { Coordinates, DateIso, Evidence } from '../../core';

export type TravelMode = 'walk' | 'bike' | 'car';
export type Difficulty = 'baja' | 'media' | 'alta';
export type VariantGroup = 'principal' | 'complementaria' | 'bici';
export type ContentStatus = 'imported' | 'curated' | 'enriched' | 'pending' | 'deprecated';

export type CoordinateStatus = 'verified' | 'pending' | 'not_available';

export type GeocodingTrace = {
  provider: 'consumer' | 'google_geocoding' | 'photon' | 'nominatim' | 'manual_verified' | 'other';
  fetchedAtIso: DateIso;
  providerUrl?: string;
  query?: string;
  placeId?: string;
};

export type CaminoDataTable<T> = {
  schemaVersion: string;
  generatedAt: DateIso;
  dataPackVersion: string;
  items: T[];
};

export type CaminoRoute = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  startTown: string;
  endTown: string;
  totalKm: number;
  walkingStageCount: number;
  cyclingStageCount: number;
  hostelCount: number;
  hasMonuments: boolean;
  contentStatus: ContentStatus;
};

export type CaminoStage = {
  id: string;
  routeSlug: string;
  slug: string;
  order: number;
  variantGroup: VariantGroup;
  title: string;
  startTown: string;
  endTown: string;
  distanceKm: number;
  estimatedMinutes: number;
  difficulty: Difficulty;
  summary: string;
  hostelCount: number;
  contentStatus: ContentStatus;
};

export type CaminoTown = {
  id: string;
  slug: string;
  title: string;
  routeSlugs: string[];
  stageSlugs: string[];
  coordinate?: Coordinates;
  coordinateStatus: CoordinateStatus;
  geocoding?: GeocodingTrace;
  contentStatus: ContentStatus;
};

export type ServiceType =
  | 'albergue'
  | 'bar'
  | 'restaurante'
  | 'fuente'
  | 'farmacia'
  | 'centro_salud'
  | 'cajero'
  | 'supermercado'
  | 'oficina_turismo'
  | 'taller_bici'
  | 'transporte'
  | 'sello'
  | 'monumento';

export type StagePoint = {
  id: string;
  stageSlug: string;
  type: 'albergue' | 'punto' | 'monumento' | 'fuente' | 'servicio' | 'advertencia';
  title: string;
  slug?: string;
  shortDescription?: string;
  isWarning: boolean;
  coordinate?: Coordinates;
  coordinateStatus: CoordinateStatus;
  geocoding?: GeocodingTrace;
  contentStatus: ContentStatus;
};

export type StageSections = {
  stageSlug: string;
  itinerarySummary: string;
  difficultyNotes: string[];
  observations: string[];
  whatToSee: string[];
  imageUrls: string[];
  sourceTextSummary?: string;
  ultreiaCopy?: string;
};

export type Hostel = {
  id: string;
  slug: string;
  title: string;
  routeSlug: string;
  stageSlug: string;
  town: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  priceText?: string;
  totalBeds?: number;
  coordinate?: Coordinates;
  coordinateStatus: CoordinateStatus;
  geocoding?: GeocodingTrace;
  contentStatus: ContentStatus;
};

export type Monument = {
  id: string;
  slug: string;
  title: string;
  routeSlug: string;
  stageSlug: string;
  stageOrder: number;
  shortStory: string;
  tags: string[];
  coordinate?: Coordinates;
  coordinateStatus: CoordinateStatus;
  geocoding?: GeocodingTrace;
  contentStatus: ContentStatus;
};

export type CaminoService = {
  id: string;
  slug: string;
  type: ServiceType;
  title: string;
  routeSlug?: string;
  stageSlug?: string;
  townSlug?: string;
  address?: string;
  phone?: string;
  openingHoursText?: string;
  coordinate?: Coordinates;
  coordinateStatus: CoordinateStatus;
  geocoding?: GeocodingTrace;
  tags: string[];
  contentStatus: ContentStatus;
};

export type SearchResult = {
  id: string;
  type: 'route' | 'stage' | 'hostel' | 'monument' | 'service' | 'point';
  title: string;
  subtitle?: string;
  evidence: Evidence;
};
