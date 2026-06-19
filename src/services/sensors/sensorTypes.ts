import type { Coordinates, DateIso, Evidence } from '../../core';

export type LocationSample = {
  coordinates: Coordinates;
  accuracyMeters?: number;
  recordedAtIso: DateIso;
  evidence: Evidence;
};

export type LocationSensor = {
  getCurrentLocation(): Promise<LocationSample | undefined>;
};

export type BatterySnapshot = {
  levelPercent?: number;
  lowPowerMode?: boolean;
  evidence: Evidence;
};

export type BatterySensor = {
  getBatterySnapshot(): Promise<BatterySnapshot | undefined>;
};
