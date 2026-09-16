import { along, lineString, nearestPointOnLine, point, lineSliceAlong, length } from '@turf/turf';
import type { Coordinates } from '../../core';

export const routeLength = (coordinates: [number, number][]) => length(lineString(coordinates));

export const positionOnRoute = (coordinates: [number, number][], distanceKm: number): Coordinates => {
  const line = lineString(coordinates);
  const [longitude, latitude] = along(line, Math.max(0, Math.min(length(line), distanceKm))).geometry.coordinates;
  return { latitude, longitude };
};

export const progressOnRoute = (coordinates: [number, number][], position: Coordinates) => {
  const nearest = nearestPointOnLine(lineString(coordinates), point([position.longitude, position.latitude]));
  return { distanceKm: nearest.properties.location, deviationKm: nearest.properties.dist };
};

export const completedRoute = (coordinates: [number, number][], distanceKm: number): [number, number][] => {
  if (distanceKm <= 0) return [];
  const line = lineString(coordinates);
  return lineSliceAlong(line, 0, Math.min(distanceKm, length(line))).geometry.coordinates as [number, number][];
};