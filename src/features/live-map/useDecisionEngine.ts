import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { systemClock } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CampaignPlan, DecisionContext, DecisionCycle, DecisionRecommendation, UserProfile, WeatherSnapshot } from '../../domain';
import { applyPolicyGates, buildDecisionContext, DeterministicDecisionEngine } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { DirectorAgentClient, HttpWeatherProvider } from '../../services';
import type { LiveTrackingState } from './useLiveTracking';
import { DirectorSchedule } from '../../domain/decision/DirectorSchedule';
import { enrichDirectorContext, recommendationsForDay, localRecommendationDate } from '../../domain/decision/directorContext';
import { isLocationSetupRecommendation } from '../../domain/decision/PolicyGates';

export type DecisionEngineState = {
  recommendations: DecisionRecommendation[];
  discardedRecommendations: DecisionRecommendation[];
  lastCycle?: DecisionCycle;
  running: boolean;
  error?: string;
  history?: DecisionRecommendation[];
  weather?: WeatherSnapshot;
  remoteWarning?: string;
  directorRunning?: boolean;
  directorError?: string;
  lastDirectorAtIso?: string;
  directorCooldownSeconds?: number;
  lastDirectorResult?: { received: number; shown: number; filtered: number };
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
  const executing = useRef(false);
  const weatherCache = useRef<{ at: number; value: WeatherSnapshot } | undefined>(undefined);
  const lastWeatherAttempt = useRef(0);
  const latestContext = useRef<DecisionContext | undefined>(undefined);
  const directorExecuting = useRef(false);
  const directorSchedule = useRef(new DirectorSchedule());
  const latestTracking = useRef(trackingState);
  latestTracking.current = trackingState;
  const currentJourney = useRef(journey);
  currentJourney.current = journey;

  const runDirectorCycle = useCallback(async (manual = false) => {
    const context = latestContext.current;
    if (!persistence.repositories || !context?.activeStage || directorExecuting.current || context.activeStage.slug !== currentJourney.current.activeStageSlug) return;
    const tracking = latestTracking.current;
    if (tracking.activeStage?.slug !== context.activeStage.slug || currentJourney.current.status === 'completed' || !tracking.currentLocation) return;
    const simulation = tracking.session?.mode === 'simulation';
    const clock = simulation ? { sessionId: tracking.session!.id, elapsedMinutes: tracking.elapsedMinutes ?? 0 } : undefined;
    if (!directorSchedule.current.take(Date.now(), clock, manual)) return;
    directorExecuting.current = true;
    setState((current) => ({ ...current, directorRunning: true, directorError: undefined, directorCooldownSeconds: 30 }));
    const repositories = persistence.repositories;
    try {
      const historyBeforeRequest = await repositories.decisionStateRepository.getNotificationHistory();
      const timestampIso = systemClock.nowIso();
      const enriched = enrichDirectorContext({
        ...context,
        simulation: { enabled: simulation },
        physical: { ...context.physical, currentLocation: tracking.currentLocation, completedDistanceKm: tracking.completedDistanceKm, remainingKm: tracking.remainingKm, progressPercent: tracking.progressPercent, etaMinutes: tracking.etaMinutes },
      }, historyBeforeRequest, timestampIso);
      const input: DecisionContext = {
        ...enriched, weather: weatherCache.current?.value,
        simulation: { enabled: simulation },
        stageContext: context.stageContext ? {
          sections: context.stageContext.sections ? {
            stageSlug: context.stageContext.sections.stageSlug,
            sourceStageSlugs: context.stageContext.sections.sourceStageSlugs,
            itinerarySummary: context.stageContext.sections.itinerarySummary.slice(0, 600),
            whatToSee: context.stageContext.sections.whatToSee.slice(0, 2).map((text) => text.slice(0, 400)),
            observations: context.stageContext.sections.observations.slice(0, 2).map((text) => text.slice(0, 300)),
            difficultyNotes: context.stageContext.sections.difficultyNotes.slice(0, 2).map((text) => text.slice(0, 300)),
            imageUrls: [],
          } : undefined,
          hostels: context.stageContext.hostels.slice(0, 4),
          services: [...context.stageContext.services].sort((left, right) => Number(tracking.nearby.some((item) => item.id === right.id)) - Number(tracking.nearby.some((item) => item.id === left.id))).slice(0, 10),
          monuments: context.stageContext.monuments.slice(0, 3),
          points: context.stageContext.points.slice(0, 4),
        } : undefined,
        physical: { ...context.physical, currentLocation: tracking.currentLocation, completedDistanceKm: tracking.completedDistanceKm, remainingKm: tracking.remainingKm, progressPercent: tracking.progressPercent, etaMinutes: tracking.etaMinutes },
        nearby: tracking.nearby,
      };
      const remote = await directorClient.invoke(input, profile.id);
      if (context.activeJourney.id !== currentJourney.current.id || context.activeStage.slug !== currentJourney.current.activeStageSlug || simulation !== (latestTracking.current.session?.mode === 'simulation')) return;
      const history = await repositories.decisionStateRepository.getNotificationHistory();
      const publicationTimestampIso = systemClock.nowIso();
      const day = localRecommendationDate(publicationTimestampIso);
      const today = recommendationsForDay(history, journey.id, publicationTimestampIso);
      const phase = Math.floor(tracking.progressPercent / 25);
      const recommendations = remote.recommendations.map((recommendation) => ({
        ...recommendation,
        id: `${journey.id}:${context.activeStage!.slug}:ai:${day}:${phase}:${recommendation.id}`,
        origin: 'foundry' as const,
        stageSlug: context.activeStage!.slug,
        createdAtIso: publicationTimestampIso,
        evidence: recommendation.evidence.map((evidence) => ({ ...evidence, simulated: simulation })),
      }));
      const output = applyPolicyGates({ output: { ...remote, recommendations }, recentRecommendations: today });
      const result = { received: remote.recommendations.length, shown: output.recommendations.length, filtered: remote.recommendations.length - output.recommendations.length };
      for (const recommendation of output.recommendations) await repositories.decisionStateRepository.markRecommendationShown(recommendation);
      const cycle: DecisionCycle = { id: createId('ai-cycle'), journeyId: journey.id, trigger: 'scheduled_check', startedAtIso: input.timestampIso, completedAtIso: systemClock.nowIso(), recommendations: output.recommendations, discardedRecommendations: output.discardedRecommendations, contextSummary: JSON.stringify({ stageSlug: context.activeStage.slug, progressPercent: tracking.progressPercent, origin: 'foundry', result, newPlaceCount: input.contentBrief?.newPlaceIds.length, newHighlightCount: input.contentBrief?.newHighlightIds.length }) };
      await repositories.decisionStateRepository.saveCycle(cycle);
      const nextHistory = (await repositories.decisionStateRepository.getNotificationHistory()).filter((item) => item.id.startsWith(`${journey.id}:`) && !isLocationSetupRecommendation(item)).sort((left, right) => (left.createdAtIso ?? '').localeCompare(right.createdAtIso ?? ''));
      setState((current) => ({ ...current, history: [...nextHistory], recommendations: nextHistory.slice(-4).reverse(), lastCycle: output.recommendations.length ? cycle : current.lastCycle, lastDirectorAtIso: systemClock.nowIso(), lastDirectorResult: result }));
    } catch (error) {
      directorSchedule.current.retryAfterFailure();
      setState((current) => ({ ...current, directorError: error instanceof Error ? error.message : 'El motor IA no pudo responder.' }));
    } finally {
      directorExecuting.current = false;
      setState((current) => ({ ...current, directorRunning: false }));
    }
  }, [directorClient, journey.id, persistence.repositories, profile.id]);

  const runDecisionCycle = useCallback(async () => {
    if (!persistence.repositories || executing.current || !trackingState.activeStage || trackingState.activeStage.slug !== journey.activeStageSlug) return;
    executing.current = true;

    setState((current) => ({ ...current, running: true, error: undefined }));

    try {
      const timestampIso = systemClock.nowIso();
      const preferences = await persistence.repositories.userProfileRepository.getPreferences(profile.id);
      const latestSample = trackingState.samples.at(-1);
      if (trackingState.currentLocation && Date.now() - lastWeatherAttempt.current > 15 * 60 * 1000) {
        lastWeatherAttempt.current = Date.now();
        void weatherProvider.getWeatherSnapshot(trackingState.currentLocation).then((result) => {
          if (result.ok) {
            weatherCache.current = { at: Date.now(), value: result.value };
            setState((current) => ({ ...current, weather: result.value }));
          } else setState((current) => ({ ...current, remoteWarning: 'Clima no disponible. Avisos locales activos.' }));
        }).catch(() => setState((current) => ({ ...current, remoteWarning: 'Sin conexion meteorologica. Avisos locales activos.' })));
      }
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
        weather: weatherCache.current?.value,
        nearby: trackingState.nearby,
      });
      context.physical.currentLocation = trackingState.currentLocation;
      const rawOutput = new DeterministicDecisionEngine().evaluate(context);
      latestContext.current = { ...context, simulation: { enabled: trackingState.session?.mode === 'simulation' } };
      const history = [...await persistence.repositories.decisionStateRepository.getNotificationHistory()];
      const seen = new Set(history.map((recommendation) => recommendation.id));
      rawOutput.recommendations = rawOutput.recommendations.map((recommendation) => ({
        ...recommendation,
        id: `${journey.id}:${journey.activeStageSlug}:${recommendation.id}`,
        origin: 'local' as const,
        stageSlug: journey.activeStageSlug,
        evidence: recommendation.evidence.map((evidence) => ({ ...evidence, simulated: trackingState.session?.mode === 'simulation' })),
      })).filter((recommendation) => !seen.has(recommendation.id));
      const output = applyPolicyGates({ output: rawOutput, recentRecommendations: [] });
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
          weatherAvailable: Boolean(weatherCache.current),
        }),
        recommendations: output.recommendations,
        discardedRecommendations: output.discardedRecommendations,
      };

      await persistence.repositories.decisionStateRepository.saveCycle(cycle);
      for (const recommendation of output.recommendations) {
        await persistence.repositories.decisionStateRepository.markRecommendationShown(recommendation);
      }
      const nextHistory = [...await persistence.repositories.decisionStateRepository.getNotificationHistory()].filter((recommendation) => recommendation.id.startsWith(`${journey.id}:`) && !isLocationSetupRecommendation(recommendation)).sort((left, right) => (left.createdAtIso ?? '').localeCompare(right.createdAtIso ?? ''));
      setState((current) => ({ ...current, recommendations: nextHistory.slice(-4).reverse(), history: nextHistory, discardedRecommendations: output.discardedRecommendations, lastCycle: output.recommendations.length ? cycle : current.lastCycle, running: false, weather: weatherCache.current?.value }));
    } catch (error) {
      setState((current) => ({ ...current, running: false, error: error instanceof Error ? error.message : 'Error ejecutando motor de decision' }));
    } finally {
      executing.current = false;
    }
  }, [campaign, directorClient, journey, persistence.repositories, profile, trackingState, weatherProvider]);

  useEffect(() => {
    if (!trackingState.activeStage || trackingState.activeStage.slug !== journey.activeStageSlug) return;
    const runKey = `${journey.id}:${journey.activeStageSlug ?? 'sin-etapa'}:${Boolean(trackingState.currentLocation)}:${trackingState.session?.mode ?? 'idle'}:${Math.floor(trackingState.progressPercent / 5)}`;

    if (state.running || lastAutomaticRunKey.current === runKey) return;

    lastAutomaticRunKey.current = runKey;
    void runDecisionCycle();
  }, [journey.activeStageSlug, journey.id, runDecisionCycle, state.running, trackingState.progressPercent, trackingState.samples]);

  useEffect(() => {
    const intervalId = setInterval(() => void runDecisionCycle(), 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [runDecisionCycle]);

  const directorRef = useRef(runDirectorCycle);
  directorRef.current = runDirectorCycle;
  useEffect(() => {
    const interval = setInterval(() => {
      const seconds = directorSchedule.current.cooldownSeconds(Date.now());
      setState((current) => current.directorCooldownSeconds === seconds ? current : { ...current, directorCooldownSeconds: seconds });
      void directorRef.current();
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const markShown = useCallback(async (recommendation: DecisionRecommendation) => {
    if (!persistence.repositories) return;
    const history = await persistence.repositories.decisionStateRepository.getNotificationHistory();
    if (!history.some((item) => item.id === recommendation.id)) await persistence.repositories.decisionStateRepository.markRecommendationShown(recommendation);
  }, [persistence.repositories]);

  return {
    state,
    runDecisionCycle,
    runDirectorCycle: () => runDirectorCycle(true),
    markShown,
  };
};
