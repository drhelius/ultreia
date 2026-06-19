import type { DecisionContext, PhysicalSignals } from './decisionTypes';
import type { ActiveJourney, CampaignPlan, CaminoStage, NearbyEntity, TrackingSample, UserPreferences, UserProfile, WeatherSnapshot } from '..';

export const buildDecisionContext = ({
  timestampIso,
  user,
  preferences,
  activeJourney,
  activeCampaign,
  activeStage,
  stageContext,
  samples,
  completedDistanceKm,
  remainingKm,
  progressPercent,
  etaMinutes,
  batteryPercent,
  weather,
  nearby,
}: {
  timestampIso: string;
  user: UserProfile;
  preferences?: UserPreferences;
  activeJourney: ActiveJourney;
  activeCampaign: CampaignPlan;
  activeStage?: CaminoStage;
  stageContext?: DecisionContext['stageContext'];
  samples: TrackingSample[];
  completedDistanceKm: number;
  remainingKm: number;
  progressPercent: number;
  etaMinutes?: number;
  batteryPercent?: number;
  weather?: WeatherSnapshot;
  nearby: NearbyEntity[];
}): DecisionContext => {
  const latestSample = samples.at(-1);
  const physical: PhysicalSignals = {
    currentLocation: latestSample?.coordinates,
    completedDistanceKm,
    remainingKm,
    progressPercent,
    etaMinutes,
    batteryPercent,
  };

  return {
    schemaVersion: '1.0',
    timestampIso,
    user,
    preferences,
    activeJourney,
    activeCampaign,
    activeStage,
    stageContext,
    physical,
    weather,
    nearby,
  };
};
