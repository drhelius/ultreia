import type { TrackingSample, TrackingSession } from '../domain';

export type TrackingRepository = {
  saveSession(session: TrackingSession): Promise<void>;
  getActiveSession(journeyId: string): Promise<TrackingSession | undefined>;
  completeSession(sessionId: string, endedAtIso: string): Promise<void>;
  addSample(sample: TrackingSample): Promise<void>;
  getSamples(sessionId: string): Promise<TrackingSample[]>;
};
