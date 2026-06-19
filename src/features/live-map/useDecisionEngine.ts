import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { systemClock } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CampaignPlan, DecisionCycle, DecisionRecommendation, UserProfile } from '../../domain';
import { applyPolicyGates, buildDecisionContext } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { DirectorAgentClient, HttpWeatherProvider } from '../../services';
import type { LiveTrackingState } from './useLiveTracking';

export type DecisionEngineState = {
  recommendations: DecisionRecommendation[];
  discardedRecommendations: DecisionRecommendation[];
  lastCycle?: DecisionCycle;
  running: boolean;
  error?: string;
};

const createId = (scope: string): string => `${scope}:${Date.now()}`;

export const useDecisionEngine = ({
  profile,
  journey,
  campaign,
  trackingState,
}: {
  profile: UserProfile;
  journey: ActiveJourney;
  campaign: CampaignPlan;
  trackingState: LiveTrackingState;
}) => {
  const persistence = useLocalPersistence();
  const weatherProvider = useMemo(() => new HttpWeatherProvider(), []);
  const directorClient = useMemo(() => new DirectorAgentClient(), []);
  const [state, setState] = useState<DecisionEngineState>({ recommendations: [], discardedRecommendations: [], running: false });
  const lastAutomaticRunKey = useRef<string | undefined>(undefined);

  const runDecisionCycle = useCallback(async () => {
    if (!persistence.repositories) return;

    setState((current) => ({ ...current, running: true, error: undefined }));

    try {
      const timestampIso = systemClock.nowIso();
      const preferences = await persistence.repositories.userProfileRepository.getPreferences(profile.id);
      const latestSample = trackingState.samples.at(-1);
      const weatherResult = latestSample ? await weatherProvider.getWeatherSnapshot(latestSample.coordinates) : undefined;
      if (weatherResult && !weatherResult.ok) throw new Error(weatherResult.message ?? 'No se pudo invocar el servicio meteorologico.');
      const [sections, hostels, services, monuments, points] = trackingState.activeStage ? await Promise.all([
        staticCaminoDataRepository.getStageSections(trackingState.activeStage.slug),
        staticCaminoDataRepository.getHostelsByStage(trackingState.activeStage.slug),
        staticCaminoDataRepository.getServicesByStage(trackingState.activeStage.slug),
        staticCaminoDataRepository.getMonumentsByStage(trackingState.activeStage.slug),
        staticCaminoDataRepository.getStagePoints(trackingState.activeStage.slug),
      ]) : [undefined, [], [], [], []];
      const context = buildDecisionContext({
        timestampIso,
        user: profile,
        preferences,
        activeJourney: journey,
        activeCampaign: campaign,
        activeStage: trackingState.activeStage,
        stageContext: trackingState.activeStage ? { sections, hostels, services, monuments, points } : undefined,
        samples: trackingState.samples,
        completedDistanceKm: trackingState.completedDistanceKm,
        remainingKm: trackingState.remainingKm,
        progressPercent: trackingState.progressPercent,
        etaMinutes: trackingState.etaMinutes,
        batteryPercent: trackingState.batteryPercent,
        weather: weatherResult?.ok ? weatherResult.value : undefined,
        nearby: trackingState.nearby,
      });
      const rawOutput = await directorClient.invoke(context, profile.id);
      const previousCycle = await persistence.repositories.decisionStateRepository.getLastCycle();
      const output = applyPolicyGates({ output: rawOutput, recentRecommendations: previousCycle?.recommendations ?? [] });
      const cycle: DecisionCycle = {
        id: createId('decision-cycle'),
        trigger: latestSample ? 'location_changed' : 'scheduled_check',
        journeyId: journey.id,
        startedAtIso: timestampIso,
        completedAtIso: systemClock.nowIso(),
        contextSummary: JSON.stringify({
          stageSlug: journey.activeStageSlug,
          progressPercent: trackingState.progressPercent,
          nearbyCount: trackingState.nearby.length,
          weatherAvailable: Boolean(weatherResult?.ok),
        }),
        recommendations: output.recommendations,
        discardedRecommendations: output.discardedRecommendations,
      };

      await persistence.repositories.decisionStateRepository.saveCycle(cycle);
      setState({ recommendations: output.recommendations, discardedRecommendations: output.discardedRecommendations, lastCycle: cycle, running: false });
    } catch (error) {
      setState((current) => ({ ...current, running: false, error: error instanceof Error ? error.message : 'Error ejecutando motor de decision' }));
    }
  }, [campaign, directorClient, journey, persistence.repositories, profile, trackingState, weatherProvider]);

  useEffect(() => {
    const latestSample = trackingState.samples.at(-1);
    const runKey = `${journey.id}:${journey.activeStageSlug ?? 'sin-etapa'}:${latestSample?.id ?? 'sin-gps'}:${trackingState.progressPercent}`;

    if (state.running || lastAutomaticRunKey.current === runKey) return;

    lastAutomaticRunKey.current = runKey;
    void runDecisionCycle();
  }, [journey.activeStageSlug, journey.id, runDecisionCycle, state.running, trackingState.progressPercent, trackingState.samples]);

  useEffect(() => {
    const intervalId = setInterval(() => void runDecisionCycle(), 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [runDecisionCycle]);

  const markShown = useCallback(async (recommendation: DecisionRecommendation) => {
    if (!persistence.repositories) return;

    await persistence.repositories.decisionStateRepository.markRecommendationShown(recommendation);
  }, [persistence.repositories]);

  return {
    state,
    runDecisionCycle,
    markShown,
  };
};
