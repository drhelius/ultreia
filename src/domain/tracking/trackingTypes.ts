import type { Coordinates, DateIso, Evidence } from '../../core';

export type TrackingSessionStatus = 'active' | 'paused' | 'completed' | 'discarded';

export type TrackingSession = {
  id: string;
  journeyId: string;
  stageSlug: string;
  status: TrackingSessionStatus;
  startedAtIso: DateIso;
  endedAtIso?: DateIso;
};

export type TrackingSample = {
  id: string;
  sessionId: string;
  recordedAtIso: DateIso;
  coordinates: Coordinates;
  accuracyMeters?: number;
  evidence: Evidence;
};
