import type { Coordinates, Result } from '../core';
import type { WeatherSnapshot } from '../domain';

export type ExternalRealtimeRepository = {
  getWeatherSnapshot(coordinates: Coordinates): Promise<Result<WeatherSnapshot>>;
};
