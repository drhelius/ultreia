import type { Coordinates, Evidence } from '../../core';

export type WeatherSnapshot = {
  location: Coordinates;
  temperatureC?: number;
  feelsLikeC?: number;
  precipitationProbability?: number;
  rainEtaMinutes?: number;
  windKmh?: number;
  uvIndex?: number;
  alertLevel?: 'none' | 'yellow' | 'orange' | 'red';
  evidence: Evidence;
};
