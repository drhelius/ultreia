import { appConfig, err, ok, type Coordinates, type Result } from '../../core';
import type { WeatherSnapshot } from '../../domain';
import type { ExternalRealtimeRepository } from '../../repositories';

export class HttpWeatherProvider implements ExternalRealtimeRepository {
  constructor(private readonly endpointUrl: string = appConfig.weatherGatewayBaseUrl) {}

  async getWeatherSnapshot(coordinates: Coordinates): Promise<Result<WeatherSnapshot>> {
    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return err('weather_unavailable', `Weather gateway respondio HTTP ${response.status}.`);
    }

    const snapshot = await response.json() as WeatherSnapshot;
    return ok(snapshot);
  }
}
