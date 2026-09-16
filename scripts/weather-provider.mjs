export async function getWeatherSnapshot(coordinates, fetcher = fetch) {
  if (!coordinates || !Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)
    || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180) {
    throw new Error('Coordenadas meteorologicas no validas.');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'temperature_2m,apparent_temperature,wind_speed_10m',
    hourly: 'precipitation_probability',
    daily: 'uv_index_max',
    forecast_days: '1',
    timezone: 'UTC',
  }).toString();
  const response = await fetcher(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Meteorologia no disponible (${response.status}).`);
  const payload = await response.json();
  if (!Number.isFinite(payload.current?.temperature_2m)) throw new Error('Respuesta meteorologica incompleta.');
  const hour = new Date().getUTCHours();
  return {
    location: coordinates,
    temperatureC: payload.current.temperature_2m,
    feelsLikeC: payload.current.apparent_temperature,
    windKmh: payload.current.wind_speed_10m,
    precipitationProbability: payload.hourly?.precipitation_probability?.[hour],
    uvIndex: payload.daily?.uv_index_max?.[0],
    evidence: {
      sourceType: 'external_realtime',
      sourceId: 'open-meteo',
      generatedAtIso: new Date().toISOString(),
      confidence: 'media',
    },
  };
}