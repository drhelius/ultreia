import type { Coordinates } from '../../core';
import type { CaminoService, ServiceType } from './caminoTypes';
import { distanceKmBetween } from '../tracking/trackingCalculations';

export const serviceCategories: ServiceType[] = ['albergue', 'bar', 'restaurante', 'fuente', 'farmacia', 'centro_salud', 'cajero', 'supermercado', 'oficina_turismo', 'taller_bici', 'transporte', 'sello', 'monumento'];

export type NearbyServiceSearch = {
  radiusKm: number;
  limitPerCategory: number;
  totalMatches: number;
  categories: Array<{ type: ServiceType; matches: number; returned: number }>;
  items: Array<{ service: CaminoService; distanceKm: number }>;
};

export function findServicesNear(services: CaminoService[], origin: Coordinates, radiusKm = 20, limitPerCategory = 3): NearbyServiceSearch {
  if (!Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude) || Math.abs(origin.latitude) > 90 || Math.abs(origin.longitude) > 180) throw new Error('Coordenadas de busqueda no validas.');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || !Number.isInteger(limitPerCategory) || limitPerCategory < 1) throw new Error('Limites de busqueda no validos.');
  const unique = new Map<string, { service: CaminoService; distanceKm: number }>();
  for (const service of services) {
    if (service.coordinateStatus !== 'verified' || !service.coordinate) continue;
    const { latitude, longitude } = service.coordinate;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const distanceKm = distanceKmBetween(origin, service.coordinate);
    if (distanceKm > radiusKm) continue;
    const osmId = service.id.match(/^osm:(node|way|relation):\d+/)?.[0];
    const identity = osmId ?? service.geocoding?.placeId ?? service.id;
    const key = `${service.type}:${identity}`;
    const existing = unique.get(key);
    if (!existing || distanceKm < existing.distanceKm) unique.set(key, { service, distanceKm });
  }
  const sorted = [...unique.values()].sort((left, right) => left.distanceKm - right.distanceKm || left.service.id.localeCompare(right.service.id));
  const items: NearbyServiceSearch['items'] = [];
  const categories = serviceCategories.map((type) => {
    const matches = sorted.filter((item) => item.service.type === type);
    const selected = matches.slice(0, limitPerCategory);
    items.push(...selected);
    return { type, matches: matches.length, returned: selected.length };
  });
  return { radiusKm, limitPerCategory, totalMatches: sorted.length, categories, items: items.sort((left, right) => left.distanceKm - right.distanceKm) };
}