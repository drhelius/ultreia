import * as Location from 'expo-location';

import type { LocationSample, LocationSensor } from './sensorTypes';

export class ExpoLocationSensor implements LocationSensor {
  async getCurrentLocation(): Promise<LocationSample | undefined> {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== 'granted') {
      return undefined;
    }

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

    return {
      coordinates: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      accuracyMeters: location.coords.accuracy ?? undefined,
      recordedAtIso: new Date(location.timestamp).toISOString(),
      evidence: {
        sourceType: 'sensor',
        sourceId: 'expo-location',
        generatedAtIso: new Date().toISOString(),
        confidence: location.coords.accuracy && location.coords.accuracy > 100 ? 'media' : 'alta',
      },
    };
  }
}
