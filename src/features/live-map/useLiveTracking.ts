import { useCallback, useEffect, useMemo, useState } from 'react';

import { systemClock } from '../../core';
import { staticCaminoDataRepository } from '../../data/camino';
import type { ActiveJourney, CaminoStage, TrackingSample, TrackingSession } from '../../domain';
import { calculateStageProgress, calculateTrackedDistanceKm, estimateEtaMinutes, findNearbyEntities, type NearbyEntity } from '../../domain';
import { useLocalPersistence } from '../../persistence';
import { ExpoBatterySensor, ExpoLocationSensor } from '../../services';

export type LiveTrackingState = {
  activeStage?: CaminoStage;
  session?: TrackingSession;
  samples: TrackingSample[];
  completedDistanceKm: number;
  remainingKm: number;
  progressPercent: number;
  etaMinutes?: number;
  nearby: NearbyEntity[];
  batteryPercent?: number;
  lastError?: string;
};

const createId = (scope: string): string => `${scope}:${Date.now()}`;

export const useLiveTracking = (journey: ActiveJourney) => {
  const persistence = useLocalPersistence();
  const [state, setState] = useState<LiveTrackingState>({ samples: [], completedDistanceKm: 0, remainingKm: 0, progressPercent: 0, nearby: [] });
  const locationSensor = useMemo(() => new ExpoLocationSensor(), []);
  const batterySensor = useMemo(() => new ExpoBatterySensor(), []);

  const refresh = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug) return;

    const [activeStage, session] = await Promise.all([
      staticCaminoDataRepository.getStage(journey.activeStageSlug),
      persistence.repositories.trackingRepository.getActiveSession(journey.id),
    ]);
    const samples = session ? await persistence.repositories.trackingRepository.getSamples(session.id) : [];
    const completedDistanceKm = calculateTrackedDistanceKm(samples);
    const progress = activeStage ? calculateStageProgress(activeStage, completedDistanceKm) : { remainingKm: 0, progressPercent: 0 };
    const averageSpeedKmh = samples.length > 1 && completedDistanceKm > 0 ? 4.8 : 0;
    const etaMinutes = estimateEtaMinutes(progress.remainingKm, averageSpeedKmh);
    const latestSample = samples.at(-1);
    const battery = await batterySensor.getBatterySnapshot().catch(() => undefined);

    let nearby: NearbyEntity[] = [];
    if (latestSample && journey.activeStageSlug) {
      const [services, monuments, stagePoints] = await Promise.all([
        staticCaminoDataRepository.getServicesByStage(journey.activeStageSlug),
        staticCaminoDataRepository.getMonumentsByStage(journey.activeStageSlug),
        staticCaminoDataRepository.getStagePoints(journey.activeStageSlug),
      ]);
      nearby = findNearbyEntities({
        origin: latestSample.coordinates,
        services,
        monuments,
        stagePoints,
        radiusKm: 2,
        generatedAtIso: systemClock.nowIso(),
      }).slice(0, 8);
    }

    setState({
      activeStage,
      session,
      samples,
      completedDistanceKm,
      remainingKm: progress.remainingKm,
      progressPercent: progress.progressPercent,
      etaMinutes,
      nearby,
      batteryPercent: battery?.levelPercent,
    });
  }, [batterySensor, journey.activeStageSlug, journey.id, persistence.repositories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startTracking = useCallback(async () => {
    if (!persistence.repositories || !journey.activeStageSlug) return;

    const nowIso = systemClock.nowIso();
    const session: TrackingSession = {
      id: createId('tracking-session'),
      journeyId: journey.id,
      stageSlug: journey.activeStageSlug,
      status: 'active',
      startedAtIso: nowIso,
    };

    await persistence.repositories.trackingRepository.saveSession(session);
    await refresh();
  }, [journey.activeStageSlug, journey.id, persistence.repositories, refresh]);

  const pauseTracking = useCallback(async () => {
    if (!persistence.repositories || !state.session) return;

    await persistence.repositories.trackingRepository.saveSession({ ...state.session, status: 'paused' });
    await refresh();
  }, [persistence.repositories, refresh, state.session]);

  const resumeTracking = useCallback(async () => {
    if (!persistence.repositories || !state.session) return;

    await persistence.repositories.trackingRepository.saveSession({ ...state.session, status: 'active' });
    await refresh();
  }, [persistence.repositories, refresh, state.session]);

  const completeTracking = useCallback(async () => {
    if (!persistence.repositories || !state.session) return;

    await persistence.repositories.trackingRepository.completeSession(state.session.id, systemClock.nowIso());
    await refresh();
  }, [persistence.repositories, refresh, state.session]);

  const recordLocationSample = useCallback(async () => {
    if (!persistence.repositories || !state.session) return;

    const location = await locationSensor.getCurrentLocation().catch(() => undefined);

    if (!location) {
      setState((current) => ({ ...current, lastError: 'No se pudo obtener una ubicacion GPS real.' }));
      return;
    }

    const sample: TrackingSample = {
      id: createId('tracking-sample'),
      sessionId: state.session.id,
      recordedAtIso: location.recordedAtIso,
      coordinates: location.coordinates,
      accuracyMeters: location.accuracyMeters,
      evidence: location.evidence,
    };

    await persistence.repositories.trackingRepository.addSample(sample);
    await refresh();
  }, [locationSensor, persistence.repositories, refresh, state.session]);

  return {
    state,
    startTracking,
    pauseTracking,
    resumeTracking,
    completeTracking,
    recordLocationSample,
    refresh,
  };
};
